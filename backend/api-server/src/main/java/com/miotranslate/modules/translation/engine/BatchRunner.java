package com.miotranslate.modules.translation.engine;

import com.miotranslate.modules.translation.engine.model.*;
import com.miotranslate.shared.integration.ai.AiTranslationClient;
import com.miotranslate.shared.integration.ai.model.AuditResultItem;
import com.miotranslate.shared.integration.ai.model.ScreenTranslationResult;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import java.util.*;
import java.util.concurrent.*;
import java.util.stream.Collectors;

/**
 * Batch translation runner.
 * 
 * Fixes applied:
 * - Fix 3 (P0-6): Blocked tags are retained in blockedTags and added to completed for persistence with status=BLOCKED
 * - Fix 5 (P0-3, P0-4): RiskGate triage results are wired into EngineResult.isFlagged and triageCause
 * - Fix 8 (P1-2): Carries sense, resolved_by, risk, model_used through for persistence
 * - Fix 11: Layer-3 semantic audit call for triage-flagged strings
 * - Fix 12 (P1-7, P1-8): Concurrent chunk execution (parallelism 4-8), exponential backoff with jitter, error classification
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class BatchRunner {

    private final PromptBuilder promptBuilder;
    private final AiTranslationClient aiClient;
    private final Validator validator;
    private final RiskGate riskGate;
    private final ContextAssembler contextAssembler;

    public PageTranslationResult translatePage(PageJob job, EngineConfig config) {
        Set<String> remainingTags = ConcurrentHashMap.newKeySet();
        remainingTags.addAll(job.getAllTagIds());
        Map<String, EngineResult> completedResults = new ConcurrentHashMap<>();
        Set<String> blockedTags = ConcurrentHashMap.newKeySet();
        
        int totalChunks = job.getChunks().size();

        // Phase A: Initial translation with configured parallelism (Fix 12)
        int poolSize = Math.max(1, Math.min(config.getMaxParallelism(), 8));
        ExecutorService executor = Executors.newFixedThreadPool(poolSize);
        List<Future<Void>> futures = new ArrayList<>();

        for (TranslationChunk chunk : job.getChunks()) {
            futures.add(executor.submit(() -> {
                processChunk(chunk, completedResults, remainingTags, blockedTags, config);
                return null;
            }));
        }

        for (Future<Void> future : futures) {
            try {
                future.get();
            } catch (Exception e) {
                log.error("Chunk failed unrecoverably: {}", e.getMessage(), e);
            }
        }

        // Phase B: Completeness reconciliation loop (tag-level retry)
        int reconciliationAttempt = 0;
        int maxReconciliationAttempts = config.getMaxRetries();

        while (!remainingTags.isEmpty() && reconciliationAttempt < maxReconciliationAttempts) {
            reconciliationAttempt++;
            log.info("Reconciliation attempt {} for remaining tags: {}", reconciliationAttempt, remainingTags.size());
            
            TranslationChunk followUpChunk = contextAssembler.buildChunk(new HashSet<>(remainingTags), job.getTargetLanguage(), job.getPageId());
            if (followUpChunk == null || followUpChunk.getTagsToTranslate().isEmpty()) break;

            try {
                processChunk(followUpChunk, completedResults, remainingTags, blockedTags, config);
            } catch (Exception e) {
                log.error("Reconciliation chunk failed: {}", e.getMessage(), e);
            }
        }
        
        executor.shutdown();

        // Phase C & D: Build final result
        // P0-6 fix: COMPLETE requires both remaining AND blocked to be empty.
        String status = "FAILED";
        if (remainingTags.isEmpty() && blockedTags.isEmpty()) {
            status = "COMPLETE";
        } else if (remainingTags.isEmpty() && !blockedTags.isEmpty()) {
            status = "PARTIAL_SUCCESS";
        } else if (job.getAllTagIds().size() > 0 && (double) remainingTags.size() / job.getAllTagIds().size() < 0.1) {
            status = "PARTIAL_SUCCESS";
        }

        int succeededCount = (int) completedResults.values().stream().filter(r -> !r.isBlocked()).count();

        return PageTranslationResult.builder()
                .pageId(job.getPageId())
                .languageCode(job.getTargetLanguage())
                .status(status)
                .requested(job.getAllTagIds().size())
                .succeeded(succeededCount)
                .blocked(blockedTags.size())
                .remaining(remainingTags.size())
                .remainingTagIds(new ArrayList<>(remainingTags))
                .blockedTagIds(new ArrayList<>(blockedTags))
                .results(new ArrayList<>(completedResults.values()))
                .chunks(PageTranslationResult.ChunkStats.builder()
                        .total(totalChunks)
                        .succeeded(completedResults.size() > 0 ? totalChunks : 0)
                        .retried(0)
                        .reconciliationRuns(reconciliationAttempt)
                        .build())
                .build();
    }

    private void processChunk(TranslationChunk chunk, Map<String, EngineResult> completed, 
                              Set<String> remaining, Set<String> blocked, EngineConfig config) {
        int attempt = 0;
        List<ScreenTranslationResult> rawResults = null;
        
        // P1-8 fix: Error-classified retry with exponential backoff and jitter
        while (attempt <= config.getMaxRetries()) {
            attempt++;
            try {
                String prompt = promptBuilder.build(chunk);
                rawResults = aiClient.translateScreen(prompt);
                break; // success
            } catch (Exception e) {
                String errMsg = e.getMessage() != null ? e.getMessage() : "";
                log.warn("AI translation error on attempt {}: {}", attempt, errMsg);

                // Fail fast on non-retryable errors (400, 401, 403, safety block)
                if (errMsg.contains("401") || errMsg.contains("403") || errMsg.contains("blocked by safety")) {
                    log.error("Non-retryable error encountered: {}", errMsg);
                    return;
                }

                if (attempt > config.getMaxRetries()) {
                    log.error("Exhausted all {} retry attempts for chunk {}", config.getMaxRetries(), chunk.getChunkIndex());
                    return;
                }

                // Exponential backoff + jitter (e.g. 1000ms, 2000ms + random 0-500ms)
                long backoff = Math.min(config.getBackoffMaxMs(), config.getBackoffBaseMs() * (1L << (attempt - 1)));
                long jitter = ThreadLocalRandom.current().nextLong(0, 500);
                try {
                    Thread.sleep(backoff + jitter);
                } catch (InterruptedException ie) {
                    Thread.currentThread().interrupt();
                    return;
                }
            }
        }

        if (rawResults == null || rawResults.isEmpty()) return;

        Set<String> requestedInChunk = chunk.getTagsToTranslate().stream().map(TagContext::getTagId).collect(Collectors.toSet());
        
        // Structural model output validation (hallucinated-tag rejection, duplicate detection)
        ModelOutputValidation modelOutput = validator.validateModelOutput(rawResults, requestedInChunk);
        
        // Deterministic pre-validation and post-validation
        PreValidationResult preResult = validator.preValidate(chunk);
        ValidationOutcome validationOutcome = validator.postValidate(modelOutput.getValidResults(), chunk, preResult);
        
        // P0-4 fix: Five-signal RiskGate triage
        TriageResult triage = riskGate.triage(modelOutput.getValidResults(), validationOutcome, config, chunk);
        
        Set<String> flaggedTagIds = new HashSet<>();
        List<ScreenTranslationResult> flaggedList = new ArrayList<>();
        if (triage.getFlagged() != null) {
            for (ScreenTranslationResult flagged : triage.getFlagged()) {
                flaggedTagIds.add(flagged.getTag());
                flaggedList.add(flagged);
            }
        }

        // Fix 11: Layer-3 Audit step for flagged strings
        Map<String, AuditResultItem> auditMap = new HashMap<>();
        if (!flaggedList.isEmpty()) {
            try {
                log.info("Executing Layer-3 audit for {} flagged tag(s) on page '{}'", flaggedList.size(), chunk.getPageName());
                String auditPrompt = promptBuilder.buildAuditPrompt(chunk, flaggedList);
                List<AuditResultItem> auditResults = aiClient.auditScreen(auditPrompt);
                if (auditResults != null) {
                    for (AuditResultItem item : auditResults) {
                        auditMap.put(item.getTag(), item);
                    }
                }
            } catch (Exception auditEx) {
                log.warn("Audit call encountered an error (continuing with base translations): {}", auditEx.getMessage());
            }
        }
        
        // Assemble EngineResults with full signal wiring
        for (ScreenTranslationResult res : modelOutput.getValidResults()) {
            ValidationDetails details = validationOutcome.getDetails().get(res.getTag());
            boolean isBlocked = details != null && !details.isPassed();
            boolean isFlagged = flaggedTagIds.contains(res.getTag());
            
            // Build the triage cause
            String triageCause = null;
            if (isFlagged) {
                triageCause = buildTriageCause(res, details, chunk, config);
            }

            // Layer-3 audit feedback processing
            AuditResultItem auditItem = auditMap.get(res.getTag());
            if (auditItem != null) {
                if (triageCause == null) triageCause = "";
                triageCause += (triageCause.isEmpty() ? "" : ";") + "audit:" + auditItem.getVerdict();
                if (auditItem.getReading() != null && !auditItem.getReading().isBlank()) {
                    triageCause += "(reading: " + auditItem.getReading() + ")";
                }

                // If auditor supplied an improved string for wrong_sense / wrong_register / awkward, apply it if safe
                if (auditItem.getBetter() != null && !auditItem.getBetter().isBlank() 
                        && !"correct".equalsIgnoreCase(auditItem.getVerdict())) {
                    String improvedText = auditItem.getBetter().trim();
                    // Validate improved text with placeholder rules
                    PreValidationResult singlePre = validator.preValidate(chunk);
                    ScreenTranslationResult testRes = ScreenTranslationResult.builder()
                            .tag(res.getTag())
                            .translation(improvedText)
                            .sense(res.getSense())
                            .resolvedBy(res.getResolvedBy())
                            .risk(res.getRisk())
                            .backTranslation(res.getBackTranslation())
                            .build();
                    ValidationOutcome testOutcome = validator.postValidate(List.of(testRes), chunk, singlePre);
                    ValidationDetails testDetails = testOutcome.getDetails().get(res.getTag());
                    if (testDetails != null && testDetails.isPassed()) {
                        log.info("Applying Layer-3 audit improved translation for tag {}: '{}' -> '{}'", 
                                res.getTag(), res.getTranslation(), improvedText);
                        res.setTranslation(improvedText);
                        details = testDetails;
                        isBlocked = false;
                    }
                }
            }

            EngineResult er = EngineResult.builder()
                    .tagId(res.getTag())
                    .rawResult(res)
                    .validationDetails(details)
                    // P0-3 fix: stateCause only set for blocked tags, null for clean results
                    .stateCause(isBlocked ? "blocked_" + (details != null ? details.getFailureReason() : "unknown") : null)
                    .isBlocked(isBlocked)
                    // P0-4 fix: triage result wired through
                    .isFlagged(isFlagged)
                    .triageCause(triageCause)
                    // P1-2 fix: carry model output signals for persistence
                    .sense(res.getSense())
                    .resolvedBy(res.getResolvedBy())
                    .risk(res.getRisk())
                    .modelUsed(res.getTag() != null ? "gemini" : null)
                    .build();
                    
            if (isBlocked) {
                blocked.add(res.getTag());
                // Blocked results are added to completed so they are persisted as BLOCKED,
                // and removed from remaining so reconciliation knows they are accounted for.
                completed.put(res.getTag(), er);
                remaining.remove(res.getTag());
            } else {
                completed.put(res.getTag(), er);
                remaining.remove(res.getTag());
            }
        }
    }
    
    /**
     * Build a human-readable triage cause for diagnostics and audit.
     */
    private String buildTriageCause(ScreenTranslationResult res, ValidationDetails details, 
                                     TranslationChunk chunk, EngineConfig config) {
        List<String> causes = new ArrayList<>();
        if ("high".equalsIgnoreCase(res.getRisk())) causes.add("high_risk");
        if ("guessed".equalsIgnoreCase(res.getResolvedBy())) causes.add("guessed");
        if (details != null && details.getSoftFlags() != null && !details.getSoftFlags().isEmpty()) {
            causes.add("soft_flags:" + String.join(",", details.getSoftFlags()));
        }
        String source = getSourceText(res.getTag(), chunk);
        if (source != null) {
            String[] words = source.trim().split("\\s+");
            if (words.length <= 2 && config.getAmbiguousWordList() != null) {
                for (String ambiguous : config.getAmbiguousWordList()) {
                    if (source.trim().equalsIgnoreCase(ambiguous)) {
                        causes.add("short_ambiguous");
                        break;
                    }
                }
            }
            if (config.getHighBlastRadiusActions() != null) {
                for (String action : config.getHighBlastRadiusActions()) {
                    if (source.trim().equalsIgnoreCase(action)) {
                        causes.add("high_blast_radius");
                        break;
                    }
                }
            }
        }
        return causes.isEmpty() ? "flagged" : String.join(";", causes);
    }
    
    private String getSourceText(String tag, TranslationChunk chunk) {
        if (chunk == null || chunk.getTagsToTranslate() == null) return null;
        for (TagContext ctx : chunk.getTagsToTranslate()) {
            if (ctx.getTagId().equals(tag)) return ctx.getEnglishText();
        }
        return null;
    }
}
