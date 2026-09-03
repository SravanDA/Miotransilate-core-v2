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

import java.math.BigDecimal;
import java.math.RoundingMode;
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
 * - CONFIDENCE-FIX: Derives a real, multi-signal confidence score (replaces the old fabricated 0.90)
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
     * Compute a REAL confidence score from the multi-signal pipeline output.
     *
     * This replaces the old approach of either hardcoding 0.90 or leaving it null.
     * The score is derived from deterministic signals — not from the LLM grading itself.
     *
     * Scoring logic (starts at 0.95, penalties subtract):
     *   - risk=high:        -0.25  (model itself says this is risky)
     *   - risk=medium:      -0.10
     *   - resolved_by=guessed: -0.20  (no context resolved the ambiguity)
     *   - isFlagged:        -0.10  (RiskGate triage flagged it)
     *   - isBlocked:        forced to 0.00 (hard validation failure)
     *   - No back_translation: -0.10  (no verifiability)
     *   - triageCause contains audit:wrong_sense or audit:wrong_register: -0.25
     *   - triageCause contains audit:awkward: -0.10
     *   - triageCause contains short_ambiguous: -0.05
     *   - triageCause contains high_blast_radius: -0.05
     *
     * Floor: 0.05 (never 0 unless blocked)
     * Ceiling: 0.95 (AI never gets 1.00 — only human review can confirm 100%)
     */
    private BigDecimal computeConfidenceScore(EngineResult result) {
        // Blocked tags always get 0
        if (result.isBlocked()) {
            return BigDecimal.ZERO.setScale(2, RoundingMode.HALF_UP);
        }

        double score = 0.95;  // Base: clean, low-risk, unambiguous, verified

        // Signal 1: Model's self-assessed risk
        String risk = result.getRisk();
        if ("high".equalsIgnoreCase(risk)) {
            score -= 0.25;
        } else if ("medium".equalsIgnoreCase(risk)) {
            score -= 0.10;
        }

        // Signal 2: How ambiguity was resolved
        String resolvedBy = result.getResolvedBy();
        if ("guessed".equalsIgnoreCase(resolvedBy)) {
            score -= 0.20;
        }

        // Signal 3: RiskGate triage flagging
        if (result.isFlagged()) {
            score -= 0.10;
        }

        // Signal 4: Back-translation availability (verifiability)
        String backTranslation = result.getRawResult() != null ? result.getRawResult().getBackTranslation() : null;
        if (backTranslation == null || backTranslation.isBlank()) {
            score -= 0.10;
        }

        // Signal 5: Layer-3 audit verdict (encoded in triageCause)
        String triageCause = result.getTriageCause();
        if (triageCause != null) {
            if (triageCause.contains("audit:wrong_sense") || triageCause.contains("audit:wrong_register")) {
                score -= 0.25;
            } else if (triageCause.contains("audit:awkward")) {
                score -= 0.10;
            } else if (triageCause.contains("audit:unsure")) {
                score -= 0.15;
            }
            // Additional triage signals
            if (triageCause.contains("short_ambiguous")) {
                score -= 0.05;
            }
            if (triageCause.contains("high_blast_radius")) {
                score -= 0.05;
            }
        }

        // Floor at 0.05 (non-blocked always gets at least minimal score)
        score = Math.max(0.05, Math.min(0.95, score));

        return BigDecimal.valueOf(score).setScale(2, RoundingMode.HALF_UP);
    }

    /**
     * Persist a single engine result (from bulk AI translation).
     * 
     * Fixes applied:
     * - P0-2: This method is public on a separate @Service, so @Transactional works via proxy
     * - P0-3: Status derived from triage flagging (isFlagged), not from stateCause null-ness
     * - P0-6: Blocked results are persisted with variableIntegrityStatus=FAILED and status=BLOCKED
     * - P0-7: Skips tags whose translation is already APPROVED and not STALE
     * - P0-8: Sets currentVersionNumber on the head row
     * - CONFIDENCE-FIX: Computes a real confidence score from pipeline signals
     */
    @Transactional(isolation = Isolation.READ_COMMITTED)
    public void saveEngineResult(EngineResult result, String languageCode, UUID userId) {
        String tagId = result.getTagId();
        EnglishCopy ec = englishCopyRepository.findById(tagId).orElse(null);

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
        draft.setCreationMethod("AI_GENERATED");
        draft.setSourceEnglishVersion(ec.getCurrentVersionNumber());
        draft.setBackTranslation(result.getRawResult().getBackTranslation());
        draft.setAuthoredBySource("AI_SERVICE");

        // P0-6: Conform to tv_status_check & tr_status_check (DRAFT, PENDING_REVIEW, APPROVED, SUPERSEDED, REJECTED)
        if (result.isBlocked()) {
            draft.setVariableIntegrityStatus("FAILED");
            draft.setStatus("DRAFT");
        } else {
            draft.setVariableIntegrityStatus("PASSED");
            draft.setStatus(result.isFlagged() ? "PENDING_REVIEW" : "DRAFT");
        }

        // Persist the engine's AI signals (sense, resolvedBy, risk) from the model output.
        // These fields are populated by the EngineResult builder in BatchRunner after
        // being extracted from the model's ScreenTranslationResult.
        draft.setSense(result.getSense());
        draft.setResolvedBy(result.getResolvedBy());
        draft.setRisk(result.getRisk());
        draft.setModelUsed(result.getModelUsed());
        
        // CONFIDENCE-FIX: Compute a REAL confidence score from the multi-signal pipeline.
        // This replaces the old pattern of either hardcoding 0.90 or leaving it null.
        // The score is derived from risk, resolved_by, triage flags, audit verdict,
        // and back-translation availability — NOT from the LLM grading itself.
        BigDecimal computedConfidence = computeConfidenceScore(result);
        draft.setConfidenceScore(computedConfidence);
        log.debug("Tag {} confidence: {} (risk={}, resolvedBy={}, flagged={}, blocked={})",
                tagId, computedConfidence, result.getRisk(), result.getResolvedBy(),
                result.isFlagged(), result.isBlocked());

        translation.setStatus(draft.getStatus());
        translation.setEtagVersion(translation.getEtagVersion() + 1);
        // P0-8: Set currentVersionNumber on the head row
        translation.setCurrentVersionNumber(nextVersion);

        versionRepository.save(draft);
        translationRepository.save(translation);

        auditService.record("AI_TRANSLATION_GENERATED", "TRANSLATION",
                tagId + "/" + languageCode,
                String.format("AI Engine Draft v%d created [%s] confidence=%.2f", nextVersion, draft.getStatus(), computedConfidence));
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
        draft.setCreationMethod("AI_GENERATED");
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

