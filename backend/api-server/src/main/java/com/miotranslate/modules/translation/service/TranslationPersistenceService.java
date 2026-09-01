package com.miotranslate.modules.translation.service;

import com.miotranslate.modules.content.model.EnglishCopy;
import com.miotranslate.modules.content.repository.EnglishCopyRepository;
import com.miotranslate.modules.translation.engine.model.EngineResult;
import com.miotranslate.modules.translation.model.Translation;
import com.miotranslate.modules.translation.model.TranslationVersion;
import com.miotranslate.modules.translation.repository.TranslationRepository;
import com.miotranslate.modules.translation.repository.TranslationVersionRepository;
import com.miotranslate.shared.audit.AuditService;
import com.miotranslate.shared.concurrency.ConcurrencyUtils;
import com.miotranslate.shared.integration.ai.TranslationResult;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Isolation;
import org.springframework.transaction.annotation.Transactional;

import java.util.UUID;

/**
 * Dedicated persistence service for translation writes.
 * 
 * Extracted from TranslationService to fix the @Transactional self-invocation bug (P0-2):
 * Spring's proxy-based transaction support only works when the call crosses a proxy boundary.
 * Self-invocation via `this.method()` bypasses the proxy, making @Transactional annotations
 * silently ineffective. By placing these methods in a separate @Service, all calls from
 * TranslationService go through the Spring proxy and transactions are properly honoured.
 * 
 * This service also fixes:
 * - P0-3: Status derived from triage, not from null-ness of stateCause
 * - P0-6: Blocked tags are persisted with FAILED/BLOCKED status instead of being silently dropped
 * - P0-7: Approved translations are guarded from re-translation
 * - P0-8: currentVersionNumber is set on the head row
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class TranslationPersistenceService {

    private final TranslationRepository translationRepository;
    private final TranslationVersionRepository versionRepository;
    private final EnglishCopyRepository englishCopyRepository;
    private final AuditService auditService;

    /**
     * Persist a single engine result (from bulk AI translation).
     * 
     * Fixes applied:
     * - P0-2: This method is public on a separate @Service, so @Transactional works via proxy
     * - P0-3: Status derived from triage flagging (isFlagged), not from stateCause null-ness
     * - P0-6: Blocked results are persisted with variableIntegrityStatus=FAILED and status=BLOCKED
     * - P0-7: Skips tags whose translation is already APPROVED and not STALE
     * - P0-8: Sets currentVersionNumber on the head row
     */
    @Transactional(isolation = Isolation.READ_COMMITTED)
    public void saveEngineResult(EngineResult result, String languageCode, UUID userId) {
        String tagId = result.getTagId();
        EnglishCopy ec = englishCopyRepository.findById(tagId).orElseThrow();

        Translation translation = translationRepository.findByIdForUpdate(tagId, languageCode)
                .orElseGet(() -> {
                    Translation newTrans = new Translation();
                    newTrans.setTagId(tagId);
                    newTrans.setLanguageCode(languageCode);
                    newTrans.setStatus("NO_TRANSLATION");
                    newTrans.setEtagVersion(1);
                    return translationRepository.save(newTrans);
                });

        // P0-7: Guard approved translations from re-translation.
        // Never let an AI draft overwrite the head status of an approved, non-stale row.
        if ("APPROVED".equals(translation.getStatus()) && translation.getStaleTriggeredAt() == null) {
            log.info("Skipping tag {} — translation is already APPROVED and not stale", tagId);
            return;
        }

        TranslationVersion latest = versionRepository
                .findTopByTagIdAndLanguageCodeOrderByVersionNumberDesc(tagId, languageCode)
                .orElse(null);
        int nextVersion = (latest == null) ? 1 : latest.getVersionNumber() + 1;

        TranslationVersion draft = new TranslationVersion();
        draft.setTagId(tagId);
        draft.setLanguageCode(languageCode);
        draft.setVersionNumber(nextVersion);
        draft.setText(result.getRawResult().getTranslation());
        draft.setCreationMethod("AI");
        draft.setSourceEnglishVersion(ec.getCurrentVersionNumber());
        draft.setBackTranslation(result.getRawResult().getBackTranslation());
        draft.setAuthoredBySource("AI_SERVICE");

        // P0-6: Blocked results are persisted with status BLOCKED so reviewers can see them
        if (result.isBlocked()) {
            draft.setVariableIntegrityStatus("FAILED");
            draft.setStatus("BLOCKED");
        } else {
            draft.setVariableIntegrityStatus("PASSED");
            // P0-3 + P0-4: Status derived from triage, not from stateCause null-ness.
            // RiskGate.triage() result is now wired through to EngineResult.isFlagged.
            draft.setStatus(result.isFlagged() ? "NEEDS_ATTENTION" : "DRAFT");
        }

        // Persist the engine's AI signals (sense, resolvedBy, risk) from the model output.
        // These fields are populated by the EngineResult builder in BatchRunner after
        // being extracted from the model's ScreenTranslationResult.
        draft.setSense(result.getSense());
        draft.setResolvedBy(result.getResolvedBy());
        draft.setRisk(result.getRisk());
        draft.setModelUsed(result.getModelUsed());
        
        // Do NOT set a hardcoded confidence score. The old `new BigDecimal("0.90")` was actively
        // misleading — a fabricated number in the shape of a measurement. Reviewers should look
        // at the `risk` enum and triage cause, not a decimal.

        translation.setStatus(draft.getStatus());
        translation.setEtagVersion(translation.getEtagVersion() + 1);
        // P0-8: Set currentVersionNumber on the head row
        translation.setCurrentVersionNumber(nextVersion);

        versionRepository.save(draft);
        translationRepository.save(translation);

        auditService.record("AI_TRANSLATION_GENERATED", "TRANSLATION",
                tagId + "/" + languageCode,
                String.format("AI Engine Draft v%d created [%s]", nextVersion, draft.getStatus()));
    }

    /**
     * Save a single-tag AI result (from the 3-phase single-tag endpoint).
     * Also extracted here to fix the self-invocation @Transactional bug.
     */
    @Transactional(isolation = Isolation.READ_COMMITTED)
    public TranslationVersion saveAiResult(String tagId, String languageCode,
                                            Integer originalETag, Integer sourceEnglishVersion,
                                            TranslationResult aiResult, UUID userId) {
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

        // P0-7: Guard approved translations from re-translation
        if ("APPROVED".equals(translation.getStatus()) && translation.getStaleTriggeredAt() == null) {
            log.info("Skipping tag {} — translation is already APPROVED and not stale", tagId);
            return null;
        }

        TranslationVersion latest = versionRepository
                .findTopByTagIdAndLanguageCodeOrderByVersionNumberDesc(tagId, languageCode)
                .orElse(null);
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
        // P0-8: Set currentVersionNumber on the head row
        translation.setCurrentVersionNumber(nextVersion);

        versionRepository.save(draft);
        translationRepository.save(translation);

        auditService.record("AI_TRANSLATION_GENERATED", "TRANSLATION",
                tagId + "/" + languageCode, "AI Draft created");

        return draft;
    }
}
