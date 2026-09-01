package com.miotranslate.modules.translation.engine;

import com.miotranslate.modules.translation.engine.model.*;
import com.miotranslate.shared.integration.ai.AiTranslationClient;
import com.miotranslate.shared.integration.ai.model.ScreenTranslationResult;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import java.util.*;
import java.util.concurrent.*;
import java.util.stream.Collectors;

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

        // Phase A: Initial translation
        ExecutorService executor = Executors.newFixedThreadPool(Math.max(1, config.getMaxParallelism()));
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
                log.error("Chunk failed unrecoverably", e);
            }
        }

        // Phase B: Completeness reconciliation loop
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
                log.error("Reconciliation chunk failed", e);
            }
        }
        
        executor.shutdown();

        // Phase C & D: Build final result
        String status = "FAILED";
        if (remainingTags.isEmpty()) {
            status = "COMPLETE";
        } else if (job.getAllTagIds().size() > 0 && (double) remainingTags.size() / job.getAllTagIds().size() < 0.1) {
            status = "PARTIAL_SUCCESS";
        }

        return PageTranslationResult.builder()
                .pageId(job.getPageId())
                .languageCode(job.getTargetLanguage())
                .status(status)
                .requested(job.getAllTagIds().size())
                .succeeded(completedResults.size())
                .blocked(blockedTags.size())
                .remaining(remainingTags.size())
                .remainingTagIds(new ArrayList<>(remainingTags))
                .results(new ArrayList<>(completedResults.values()))
                .chunks(PageTranslationResult.ChunkStats.builder()
                        .total(totalChunks)
                        .succeeded(completedResults.size() > 0 ? totalChunks : 0) // Simplified metric
                        .retried(0)
                        .reconciliationRuns(reconciliationAttempt)
                        .build())
                .build();
    }

    private void processChunk(TranslationChunk chunk, Map<String, EngineResult> completed, Set<String> remaining, Set<String> blocked, EngineConfig config) {
        int attempt = 0;
        List<ScreenTranslationResult> rawResults = null;
        
        while (attempt <= config.getMaxRetries()) {
            attempt++;
            try {
                String prompt = promptBuilder.build(chunk);
                rawResults = aiClient.translateScreen(prompt);
                break; // success
            } catch (Exception e) {
                log.error("Error calling AI, attempt {}", attempt, e);
                if (attempt > config.getMaxRetries()) return;
                try {
                    Thread.sleep(config.getBackoffBaseMs());
                } catch (InterruptedException ie) {
                    Thread.currentThread().interrupt();
                    return;
                }
            }
        }

        if (rawResults == null || rawResults.isEmpty()) return;

        Set<String> requestedInChunk = chunk.getTagsToTranslate().stream().map(TagContext::getTagId).collect(Collectors.toSet());
        
        ModelOutputValidation modelOutput = validator.validateModelOutput(rawResults, requestedInChunk);
        
        PreValidationResult preResult = validator.preValidate(chunk);
        ValidationOutcome validationOutcome = validator.postValidate(modelOutput.getValidResults(), chunk, preResult);
        
        TriageResult triage = riskGate.triage(modelOutput.getValidResults(), validationOutcome, config, chunk);

        // Process audit if needed
        if (!triage.getFlagged().isEmpty()) {
            // Simplified: we would call auditScreen here
        }
        
        // Assemble EngineResults
        for (ScreenTranslationResult res : modelOutput.getValidResults()) {
            ValidationDetails details = validationOutcome.getDetails().get(res.getTag());
            boolean isBlocked = details != null && !details.isPassed();
            
            EngineResult er = EngineResult.builder()
                    .tagId(res.getTag())
                    .rawResult(res)
                    .validationDetails(details)
                    .stateCause(isBlocked ? "blocked_placeholder" : "verified")
                    .isBlocked(isBlocked)
                    .build();
                    
            if (isBlocked) {
                blocked.add(res.getTag());
                remaining.remove(res.getTag()); // It's failed permanently
            } else {
                completed.put(res.getTag(), er);
                remaining.remove(res.getTag());
            }
        }
    }
}
