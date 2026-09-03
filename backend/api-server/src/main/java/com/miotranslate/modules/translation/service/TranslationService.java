package com.miotranslate.modules.translation.service;

import com.miotranslate.modules.registry.model.Tag;
import com.miotranslate.modules.registry.repository.TagRepository;
import com.miotranslate.modules.content.model.EnglishCopy;
import com.miotranslate.modules.content.repository.EnglishCopyRepository;
import com.miotranslate.modules.translation.model.Translation;
import com.miotranslate.modules.translation.model.TranslationId;
import com.miotranslate.modules.translation.model.TranslationVersion;
import com.miotranslate.modules.translation.repository.TranslationRepository;
import com.miotranslate.modules.translation.repository.TranslationVersionRepository;
import com.miotranslate.shared.audit.AuditService;
import com.miotranslate.shared.concurrency.ConcurrencyUtils;
import com.miotranslate.shared.integration.ai.AiTranslationClient;
import com.miotranslate.shared.integration.ai.TranslationResult;
import com.miotranslate.shared.job.JobDispatcher;
import com.miotranslate.modules.translation.engine.TranslationEngine;
import com.miotranslate.modules.translation.engine.model.EngineConfig;
import com.miotranslate.modules.translation.engine.model.PageTranslationResult;
import com.miotranslate.modules.translation.engine.model.EngineResult;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Isolation;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@Slf4j
@Service
public class TranslationService {

    private final TranslationRepository translationRepository;
    private final TranslationVersionRepository versionRepository;
    private final TagRepository tagRepository;
    private final EnglishCopyRepository englishCopyRepository;
    private final AiTranslationClient aiClient;
    private final AuditService auditService;
    private final JobDispatcher jobDispatcher;
    private final TranslationEngine translationEngine;
    private final TranslationPersistenceService persistenceService;

    @org.springframework.beans.factory.annotation.Value("${miotranslate.bulk-approve.confidence-threshold:0.80}")
    private BigDecimal bulkApproveThreshold;

    public TranslationService(TranslationRepository translationRepository,
                              TranslationVersionRepository versionRepository,
                              TagRepository tagRepository,
                              EnglishCopyRepository englishCopyRepository,
                              AiTranslationClient aiClient,
                              AuditService auditService,
                              JobDispatcher jobDispatcher,
                              TranslationEngine translationEngine,
                              TranslationPersistenceService persistenceService) {
        this.translationRepository = translationRepository;
        this.versionRepository = versionRepository;
        this.tagRepository = tagRepository;
        this.englishCopyRepository = englishCopyRepository;
        this.aiClient = aiClient;
        this.auditService = auditService;
        this.jobDispatcher = jobDispatcher;
        this.translationEngine = translationEngine;
        this.persistenceService = persistenceService;
    }

    public TranslationVersion generateAiTranslation(String tagId, String languageCode, String ifMatchETag, UUID userId) {
        EnglishCopy ec = englishCopyRepository.findById(tagId).orElseThrow();
        if (!"APPROVED".equals(ec.getStatus())) {
            throw new IllegalStateException("Cannot translate unapproved English Copy");
        }
        
        // 3-Phase Commit
        Integer validatedETag = validateBeforeAiCall(tagId, languageCode, ifMatchETag);
        TranslationResult aiResult = new TranslationResult();
        aiResult.setTranslatedText("Mock AI Result");
        // P0-2 fix: call crosses proxy boundary via injected persistenceService
        return persistenceService.saveAiResult(tagId, languageCode, validatedETag, ec.getCurrentVersionNumber(), aiResult, userId);
    }

    @Transactional(readOnly = true)
    public Integer validateBeforeAiCall(String tagId, String languageCode, String ifMatchETag) {
        Translation translation = translationRepository.findById(new TranslationId(tagId, languageCode))
                .orElse(null);
        if (translation == null) {
            return null;
        }
        ConcurrencyUtils.validateETag(ifMatchETag, translation.getEtagVersion(), "TRANSLATION", tagId + "/" + languageCode);
        return translation.getEtagVersion();
    }

    @Transactional(isolation = Isolation.READ_COMMITTED)
    public TranslationVersion editTranslationManually(String tagId, String languageCode, String ifMatchETag, String text, BigDecimal confidenceScore, UUID userId) {
        Translation translation = translationRepository.findByIdForUpdate(tagId, languageCode)
                .orElseGet(() -> {
                    Translation newTrans = new Translation();
                    newTrans.setTagId(tagId);
                    newTrans.setLanguageCode(languageCode);
                    newTrans.setStatus("NO_TRANSLATION");
                    newTrans.setEtagVersion(1);
                    return translationRepository.save(newTrans);
                });
        ConcurrencyUtils.validateETag(ifMatchETag, translation.getEtagVersion(), "TRANSLATION", tagId + "/" + languageCode);
        
        TranslationVersion latest = versionRepository.findTopByTagIdAndLanguageCodeOrderByVersionNumberDesc(tagId, languageCode).orElse(null);
        int nextVersion = (latest == null) ? 1 : latest.getVersionNumber() + 1;
        
        TranslationVersion draft = new TranslationVersion();
        draft.setTagId(tagId);
        draft.setLanguageCode(languageCode);
        draft.setVersionNumber(nextVersion);
        draft.setText(text);
        draft.setCreationMethod("MANUAL");
        draft.setConfidenceScore(confidenceScore != null ? confidenceScore : new BigDecimal("0.95"));
        
        // Fetch current English copy version
        EnglishCopy ec = englishCopyRepository.findById(tagId).orElse(null);
        draft.setSourceEnglishVersion(ec != null && ec.getCurrentVersionNumber() != null ? ec.getCurrentVersionNumber() : 1);
        
        draft.setAuthoredBy(userId);
        draft.setStatus("DRAFT");
        
        translation.setStatus("DRAFT");
        translation.setEtagVersion(translation.getEtagVersion() + 1);
        // P0-8: Set currentVersionNumber
        translation.setCurrentVersionNumber(nextVersion);
        
        versionRepository.save(draft);
        translationRepository.save(translation);
        auditService.record("TRANSLATION_MANUAL_EDIT", "TRANSLATION", tagId + "/" + languageCode, "Manual edit saved");
        return draft;
    }

    @Transactional(isolation = Isolation.READ_COMMITTED)
    public TranslationVersion editTranslationManually(String tagId, String languageCode, String ifMatchETag, String text, UUID userId) {
        return editTranslationManually(tagId, languageCode, ifMatchETag, text, null, userId);
    }

    @Transactional(isolation = Isolation.READ_COMMITTED)
    public Translation submitForReview(String tagId, String languageCode, String ifMatchETag, UUID userId) {
        Translation translation = translationRepository.findByIdForUpdate(tagId, languageCode).orElseThrow();
        ConcurrencyUtils.validateETag(ifMatchETag, translation.getEtagVersion(), "TRANSLATION", tagId + "/" + languageCode);
        
        TranslationVersion latest = versionRepository.findTopByTagIdAndLanguageCodeOrderByVersionNumberDesc(tagId, languageCode).orElseThrow();
        if (!"DRAFT".equals(latest.getStatus()) && !"PENDING_REVIEW".equals(latest.getStatus())) {
            throw new IllegalStateException("Only DRAFT or PENDING_REVIEW can be submitted for review");
        }
        
        latest.setStatus("PENDING_REVIEW");
        translation.setStatus("PENDING_REVIEW");
        translation.setEtagVersion(translation.getEtagVersion() + 1);
        
        versionRepository.save(latest);
        translationRepository.save(translation);
        auditService.record("TRANSLATION_SUBMITTED", "TRANSLATION", tagId + "/" + languageCode, "Submitted for review");
        return translation;
    }

    @Transactional(isolation = Isolation.SERIALIZABLE)
    public Translation reviewTranslation(String tagId, String languageCode, String ifMatchETag, String action, UUID userId) {
        Translation translation = translationRepository.findByIdForUpdate(tagId, languageCode).orElseThrow();
        ConcurrencyUtils.validateETag(ifMatchETag, translation.getEtagVersion(), "TRANSLATION", tagId + "/" + languageCode);
        
        TranslationVersion latest = versionRepository.findTopByTagIdAndLanguageCodeOrderByVersionNumberDesc(tagId, languageCode).orElseThrow();
        
        if ("APPROVE".equals(action)) {
            latest.setStatus("APPROVED");
            latest.setApprovedBy(userId);
            latest.setApprovedAt(OffsetDateTime.now());
            
            translation.setStatus("APPROVED");
            translation.setCurrentVersionNumber(latest.getVersionNumber());
            
            // clear stale marks
            translation.setStaleTriggeredAt(null);
        } else if ("REJECT".equals(action)) {
            latest.setStatus("REJECTED");
            translation.setStatus("DRAFT");
        } else if ("RETURN_FOR_REVISION".equals(action)) {
            latest.setStatus("DRAFT");
            translation.setStatus("DRAFT");
        }
        
        translation.setEtagVersion(translation.getEtagVersion() + 1);
        versionRepository.save(latest);
        translationRepository.save(translation);
        auditService.record("TRANSLATION_" + action, "TRANSLATION", tagId + "/" + languageCode, "Reviewed");
        
        if ("APPROVE".equals(action)) {
            jobDispatcher.dispatch("IMPLICIT_DEV_PUBLISH", tagId);
        }
        return translation;
    }

    @Transactional(isolation = Isolation.READ_COMMITTED)
    public Translation confirmStale(String tagId, String languageCode, String ifMatchETag, UUID userId) {
        Translation translation = translationRepository.findByIdForUpdate(tagId, languageCode).orElseThrow();
        ConcurrencyUtils.validateETag(ifMatchETag, translation.getEtagVersion(), "TRANSLATION", tagId + "/" + languageCode);
        
        if (!"STALE".equals(translation.getStatus())) throw new IllegalStateException("Not stale");
        
        // Update version row's source_english_version to current English copy version
        EnglishCopy ec = englishCopyRepository.findById(tagId).orElse(null);
        if (ec != null && ec.getCurrentVersionNumber() != null) {
            TranslationVersion latest = versionRepository
                .findTopByTagIdAndLanguageCodeOrderByVersionNumberDesc(tagId, languageCode)
                .orElse(null);
            if (latest != null) {
                latest.setSourceEnglishVersion(ec.getCurrentVersionNumber());
                latest.setStatus("APPROVED");
                latest.setApprovedBy(userId);
                latest.setApprovedAt(OffsetDateTime.now());
                versionRepository.save(latest);
            }
        }
        
        translation.setStatus("APPROVED");
        translation.setEtagVersion(translation.getEtagVersion() + 1);
        translation.setStaleTriggeredAt(null);
        
        translationRepository.save(translation);
        auditService.record("TRANSLATION_STALE_CONFIRMED", "TRANSLATION", tagId + "/" + languageCode, "Stale confirmed");
        jobDispatcher.dispatch("IMPLICIT_DEV_PUBLISH", tagId);
        return translation;
    }

    public TranslationVersion retranslate(String tagId, String languageCode, String ifMatchETag, UUID userId) {
        return generateAiTranslation(tagId, languageCode, ifMatchETag, userId);
    }

    @Transactional(readOnly = true)
    public List<TranslationVersion> getVersions(String tagId, String languageCode) {
        return versionRepository.findByTagIdAndLanguageCodeOrderByVersionNumberDesc(tagId, languageCode);
    }

    public Map<String, Object> generateAiTranslationsBulk(String pageId, String languageCode, UUID userId) {
        // Step 1: Pre-flight checks on DB (Phase 1)
        // ... (simplified for now, ideally checking all tags if they're approved and we have the latest Etag)
        
        // Step 2: Call the Engine (Phase 2 - purely out of transaction)
        EngineConfig config = new EngineConfig();
        // Setup config from SystemConfig if needed
        PageTranslationResult engineResult = translationEngine.translatePage(pageId, languageCode, null, config);
        
        // Step 3: Persist results (Phase 3 - transaction per tag via proxy call)
        // P0-6 fix: persist ALL results including blocked tags.
        // Blocked tags are saved with status=BLOCKED so reviewers can see them.
        int successCount = 0;
        int blockedCount = 0;
        int needsAttentionCount = 0;
        if (engineResult.getResults() != null) {
            for (EngineResult result : engineResult.getResults()) {
                try {
                    // P0-2 fix: call crosses proxy boundary via injected persistenceService
                    persistenceService.saveEngineResult(result, languageCode, userId);
                    if (result.isBlocked()) {
                        blockedCount++;
                    } else {
                        successCount++;
                        if (result.isFlagged()) {
                            needsAttentionCount++;
                        }
                    }
                } catch (Exception e) {
                    log.error("Failed to persist result for tag {}: {}", result.getTagId(), e.getMessage());
                }
            }
        }
        
        // P0-5 fix: propagate real engine status, remaining tags, and flagged counts.
        // Don't hardcode COMPLETE — the frontend needs the truth.
        Map<String, Object> response = new HashMap<>();
        response.put("status", engineResult.getStatus());
        response.put("processed", successCount);
        response.put("total", engineResult.getRequested());
        response.put("blocked", blockedCount);
        response.put("needsAttention", needsAttentionCount);
        response.put("remainingTagIds", engineResult.getRemainingTagIds());
        response.put("blockedTagIds", engineResult.getBlockedTagIds());
        return response;
    }

    @Transactional
    public Map<String, Object> bulkApproveTranslations(String pageId, String languageCode, UUID userId) {
        List<Tag> tags = tagRepository.findByPageIdAndStatusNot(pageId, "DEPRECATED");
        int approvedCount = 0;
        int skippedCount = 0;
        Map<String, String> skipReasons = new HashMap<>();
        
        for (Tag tag : tags) {
            Translation translation = translationRepository.findByIdForUpdate(tag.getTagId(), languageCode).orElse(null);
            if (translation == null) {
                skippedCount++;
                skipReasons.put(tag.getTagId(), "NO_TRANSLATION");
                continue;
            }

            // Gate 1: Both DRAFT and PENDING_REVIEW statuses are eligible for bulk approve.
            // Already-APPROVED tags are not re-processed.
            String headStatus = translation.getStatus();
            if (!"DRAFT".equals(headStatus) && !"PENDING_REVIEW".equals(headStatus)) {
                if (!"APPROVED".equals(headStatus)) {  // Don't count already-approved as "skipped"
                    skippedCount++;
                    skipReasons.put(tag.getTagId(), "STATUS_" + headStatus);
                }
                continue;
            }

            TranslationVersion latest = versionRepository
                    .findTopByTagIdAndLanguageCodeOrderByVersionNumberDesc(tag.getTagId(), languageCode)
                    .orElse(null);
            if (latest == null) {
                skippedCount++;
                skipReasons.put(tag.getTagId(), "NO_VERSION");
                continue;
            }

            // Gate 2: Confidence score must exist and meet the configurable threshold
            if (latest.getConfidenceScore() == null) {
                skippedCount++;
                skipReasons.put(tag.getTagId(), "NO_CONFIDENCE_SCORE");
                continue;
            }
            if (latest.getConfidenceScore().compareTo(bulkApproveThreshold) < 0) {
                skippedCount++;
                skipReasons.put(tag.getTagId(), "LOW_CONFIDENCE_" + latest.getConfidenceScore());
                continue;
            }

            // Gate 3: Variable integrity must have passed
            if (!"PASSED".equals(latest.getVariableIntegrityStatus())) {
                skippedCount++;
                skipReasons.put(tag.getTagId(), "VARIABLE_INTEGRITY_" + latest.getVariableIntegrityStatus());
                continue;
            }

            // Gate 4: Risk must not be high, and ambiguity must not be guessed
            if ("high".equalsIgnoreCase(latest.getRisk())) {
                skippedCount++;
                skipReasons.put(tag.getTagId(), "HIGH_RISK");
                continue;
            }
            if ("guessed".equalsIgnoreCase(latest.getResolvedBy())) {
                skippedCount++;
                skipReasons.put(tag.getTagId(), "AMBIGUITY_GUESSED");
                continue;
            }

            // Gate 5: Back-translation must exist (no verifiability = no auto-approve)
            if (latest.getBackTranslation() == null || latest.getBackTranslation().isBlank()) {
                skippedCount++;
                skipReasons.put(tag.getTagId(), "NO_BACK_TRANSLATION");
                continue;
            }

            // All gates passed — approve
            try {
                reviewTranslation(tag.getTagId(), languageCode, String.valueOf(translation.getEtagVersion()), "APPROVE", userId);
                approvedCount++;
            } catch (Exception e) {
                skippedCount++;
                skipReasons.put(tag.getTagId(), "APPROVE_ERROR_" + e.getMessage());
                log.warn("Bulk approve failed for tag {}: {}", tag.getTagId(), e.getMessage());
            }
        }

        log.info("Bulk approve for page {} / {}: approved={}, skipped={}, total={}",
                pageId, languageCode, approvedCount, skippedCount, tags.size());

        Map<String, Object> response = new HashMap<>();
        response.put("approved", approvedCount);
        response.put("skipped", skippedCount);
        response.put("total", tags.size());
        response.put("threshold", bulkApproveThreshold.toString());
        response.put("skipReasons", skipReasons);
        return response;
    }

}
