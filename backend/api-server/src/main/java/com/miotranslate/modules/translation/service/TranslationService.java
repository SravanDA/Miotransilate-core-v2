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
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Isolation;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
public class TranslationService {

    private final TranslationRepository translationRepository;
    private final TranslationVersionRepository versionRepository;
    private final TagRepository tagRepository;
    private final EnglishCopyRepository englishCopyRepository;
    private final AiTranslationClient aiClient;
    private final AuditService auditService;
    private final JobDispatcher jobDispatcher;

    public TranslationService(TranslationRepository translationRepository,
                              TranslationVersionRepository versionRepository,
                              TagRepository tagRepository,
                              EnglishCopyRepository englishCopyRepository,
                              AiTranslationClient aiClient,
                              AuditService auditService,
                              JobDispatcher jobDispatcher) {
        this.translationRepository = translationRepository;
        this.versionRepository = versionRepository;
        this.tagRepository = tagRepository;
        this.englishCopyRepository = englishCopyRepository;
        this.aiClient = aiClient;
        this.auditService = auditService;
        this.jobDispatcher = jobDispatcher;
    }

    public TranslationVersion generateAiTranslation(String tagId, String languageCode, String ifMatchETag, UUID userId) {
        EnglishCopy ec = englishCopyRepository.findById(tagId).orElseThrow();
        if (!"APPROVED".equals(ec.getStatus())) {
            throw new IllegalStateException("Cannot translate unapproved English Copy");
        }
        
        // 3-Phase Commit
        Integer validatedETag = validateBeforeAiCall(tagId, languageCode, ifMatchETag);
        TranslationResult aiResult = aiClient.translate("Source Text Placeholder", languageCode, "General Context");
        return saveAiResult(tagId, languageCode, validatedETag, ec.getCurrentVersionNumber(), aiResult, userId);
    }

    @Transactional(readOnly = true)
    protected Integer validateBeforeAiCall(String tagId, String languageCode, String ifMatchETag) {
        Translation translation = translationRepository.findById(new TranslationId(tagId, languageCode))
                .orElse(null);
        if (translation == null) {
            return null;
        }
        ConcurrencyUtils.validateETag(ifMatchETag, translation.getEtagVersion(), "TRANSLATION", tagId + "/" + languageCode);
        return translation.getEtagVersion();
    }

    @Transactional(isolation = Isolation.READ_COMMITTED)
    protected TranslationVersion saveAiResult(String tagId, String languageCode, Integer originalETag, Integer sourceEnglishVersion, TranslationResult aiResult, UUID userId) {
        Translation translation = translationRepository.findByIdForUpdate(tagId, languageCode)
                .orElseGet(() -> {
                    Translation newTrans = new Translation();
                    newTrans.setTagId(tagId);
                    newTrans.setLanguageCode(languageCode);
                    newTrans.setStatus("NO_TRANSLATION");
                    newTrans.setEtagVersion(1);
                    return translationRepository.save(newTrans);
                });
                
        if (originalETag != null && !translation.getEtagVersion().equals(originalETag)) {
            throw new IllegalStateException("Translation was modified during AI generation");
        }

        TranslationVersion latest = versionRepository.findTopByTagIdAndLanguageCodeOrderByVersionNumberDesc(tagId, languageCode).orElse(null);
        int nextVersion = (latest == null) ? 1 : latest.getVersionNumber() + 1;

        TranslationVersion draft = new TranslationVersion();
        draft.setTagId(tagId);
        draft.setLanguageCode(languageCode);
        draft.setVersionNumber(nextVersion);
        draft.setText(aiResult.getTranslatedText());
        draft.setCreationMethod("AI");
        draft.setSourceEnglishVersion(sourceEnglishVersion);
        draft.setConfidenceScore(aiResult.getConfidenceScore());
        draft.setBackTranslation(aiResult.getBackTranslation());
        draft.setVariableIntegrityStatus(aiResult.getVariableIntegrityStatus());
        draft.setAuthoredBySource("AI_SERVICE");
        draft.setStatus("DRAFT");

        translation.setStatus("DRAFT");
        translation.setEtagVersion(translation.getEtagVersion() + 1);

        versionRepository.save(draft);
        translationRepository.save(translation);

        auditService.record("AI_TRANSLATION_GENERATED", "TRANSLATION", tagId + "/" + languageCode, "AI Draft created");

        return draft;
    }

    @Transactional(isolation = Isolation.READ_COMMITTED)
    public TranslationVersion editTranslationManually(String tagId, String languageCode, String ifMatchETag, String text, UUID userId) {
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
        
        // Fetch current English copy version
        EnglishCopy ec = englishCopyRepository.findById(tagId).orElseThrow();
        draft.setSourceEnglishVersion(ec.getCurrentVersionNumber() != null ? ec.getCurrentVersionNumber() : 1);
        
        draft.setAuthoredBy(userId);
        draft.setStatus("DRAFT");
        
        translation.setStatus("DRAFT");
        translation.setEtagVersion(translation.getEtagVersion() + 1);
        
        versionRepository.save(draft);
        translationRepository.save(translation);
        auditService.record("TRANSLATION_MANUAL_EDIT", "TRANSLATION", tagId + "/" + languageCode, "Manual edit saved");
        return draft;
    }

    @Transactional(isolation = Isolation.READ_COMMITTED)
    public Translation submitForReview(String tagId, String languageCode, String ifMatchETag, UUID userId) {
        Translation translation = translationRepository.findByIdForUpdate(tagId, languageCode).orElseThrow();
        ConcurrencyUtils.validateETag(ifMatchETag, translation.getEtagVersion(), "TRANSLATION", tagId + "/" + languageCode);
        
        TranslationVersion latest = versionRepository.findTopByTagIdAndLanguageCodeOrderByVersionNumberDesc(tagId, languageCode).orElseThrow();
        if (!"DRAFT".equals(latest.getStatus())) throw new IllegalStateException("Only DRAFT can be submitted");
        
        latest.setStatus("IN_REVIEW");
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
        // dummy return
        return List.of();
    }

    public Map<String, Object> generateAiTranslationsBulk(String pageId, String languageCode, UUID userId) {
        // Find tags for page, loop 3-phase commit
        // Simplified for Phase 3 skeleton
        List<Tag> tags = tagRepository.findAll().stream().filter(t -> t.getPageId().equals(pageId)).toList();
        int successCount = 0;
        for (Tag tag : tags) {
            try {
                EnglishCopy ec = englishCopyRepository.findById(tag.getTagId()).orElse(null);
                if (ec != null && "APPROVED".equals(ec.getStatus())) {
                    Translation translation = translationRepository.findById(new TranslationId(tag.getTagId(), languageCode)).orElse(null);
                    if (translation != null) {
                        generateAiTranslation(tag.getTagId(), languageCode, String.valueOf(translation.getEtagVersion()), userId);
                        successCount++;
                    }
                }
            } catch (Exception e) {
                // Skip errors in bulk
            }
        }
        
        Map<String, Object> response = new HashMap<>();
        response.put("processed", successCount);
        response.put("total", tags.size());
        return response;
    }

    @Transactional
    public Map<String, Object> bulkApproveTranslations(String pageId, String languageCode, UUID userId) {
        // Find tags for page
        List<Tag> tags = tagRepository.findAll().stream().filter(t -> t.getPageId().equals(pageId)).toList();
        int approvedCount = 0;
        
        BigDecimal threshold = new BigDecimal("0.90"); // Mock threshold
        
        for (Tag tag : tags) {
            Translation translation = translationRepository.findByIdForUpdate(tag.getTagId(), languageCode).orElse(null);
            if (translation != null && ("DRAFT".equals(translation.getStatus()) || "PENDING_REVIEW".equals(translation.getStatus()))) {
                TranslationVersion latest = versionRepository.findTopByTagIdAndLanguageCodeOrderByVersionNumberDesc(tag.getTagId(), languageCode).orElse(null);
                if (latest != null && latest.getConfidenceScore() != null && latest.getConfidenceScore().compareTo(threshold) >= 0) {
                    reviewTranslation(tag.getTagId(), languageCode, String.valueOf(translation.getEtagVersion()), "APPROVE", userId);
                    approvedCount++;
                }
            }
        }
        
        Map<String, Object> response = new HashMap<>();
        response.put("approved", approvedCount);
        return response;
    }
}
