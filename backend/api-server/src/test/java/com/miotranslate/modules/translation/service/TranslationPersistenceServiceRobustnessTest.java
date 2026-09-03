package com.miotranslate.modules.translation.service;

import com.miotranslate.modules.content.model.EnglishCopy;
import com.miotranslate.modules.content.repository.EnglishCopyRepository;
import com.miotranslate.modules.translation.engine.model.EngineResult;
import com.miotranslate.modules.translation.model.Translation;
import com.miotranslate.modules.translation.model.TranslationVersion;
import com.miotranslate.modules.translation.repository.TranslationRepository;
import com.miotranslate.modules.translation.repository.TranslationVersionRepository;
import com.miotranslate.shared.audit.AuditService;
import com.miotranslate.shared.integration.ai.model.ScreenTranslationResult;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.Optional;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
@DisplayName("TranslationPersistenceService Robustness & Invariant Tests")
class TranslationPersistenceServiceRobustnessTest {

    @Mock
    private TranslationRepository translationRepository;

    @Mock
    private TranslationVersionRepository versionRepository;

    @Mock
    private EnglishCopyRepository englishCopyRepository;

    @Mock
    private AuditService auditService;

    private TranslationPersistenceService persistenceService;

    @BeforeEach
    void setUp() {
        persistenceService = new TranslationPersistenceService(
                translationRepository, versionRepository, englishCopyRepository, auditService
        );
    }

    @Test
    @DisplayName("P0-7 Invariant: Existing non-stale APPROVED translation is NEVER downgraded or overwritten")
    void testApprovedTranslationNeverOverwritten() {
        String tagId = "btn.submit";
        String lang = "ar";

        EnglishCopy ec = new EnglishCopy();
        ec.setTagId(tagId);
        ec.setCurrentVersionNumber(2);
        when(englishCopyRepository.findById(tagId)).thenReturn(Optional.of(ec));

        Translation existing = new Translation();
        existing.setTagId(tagId);
        existing.setLanguageCode(lang);
        existing.setStatus("APPROVED");
        existing.setStaleTriggeredAt(null); // Not stale!
        existing.setEtagVersion(5);
        when(translationRepository.findByIdForUpdate(tagId, lang)).thenReturn(Optional.of(existing));

        EngineResult er = EngineResult.builder()
                .tagId(tagId)
                .rawResult(ScreenTranslationResult.builder().translation("إرسال جديد").build())
                .isFlagged(false)
                .build();

        persistenceService.saveEngineResult(er, lang, UUID.randomUUID());

        // Verify versionRepository.save and translationRepository.save were NOT called
        verify(versionRepository, never()).save(any());
        // Existing status remains APPROVED
        assertEquals("APPROVED", existing.getStatus());
    }

    @Test
    @DisplayName("STALE translations ARE updated with new AI version")
    void testStaleTranslationCanBeUpdated() {
        String tagId = "btn.submit";
        String lang = "ar";

        EnglishCopy ec = new EnglishCopy();
        ec.setTagId(tagId);
        ec.setCurrentVersionNumber(3);
        when(englishCopyRepository.findById(tagId)).thenReturn(Optional.of(ec));

        Translation existing = new Translation();
        existing.setTagId(tagId);
        existing.setLanguageCode(lang);
        existing.setStatus("APPROVED");
        existing.setStaleTriggeredAt(OffsetDateTime.now()); // Is stale!
        existing.setEtagVersion(5);
        when(translationRepository.findByIdForUpdate(tagId, lang)).thenReturn(Optional.of(existing));
        when(versionRepository.findTopByTagIdAndLanguageCodeOrderByVersionNumberDesc(tagId, lang)).thenReturn(Optional.empty());

        EngineResult er = EngineResult.builder()
                .tagId(tagId)
                .rawResult(ScreenTranslationResult.builder().translation("إرسال").build())
                .isFlagged(false)
                .sense("Submit action")
                .resolvedBy("unambiguous")
                .risk("low")
                .build();

        persistenceService.saveEngineResult(er, lang, UUID.randomUUID());

        verify(versionRepository, times(1)).save(any());
        verify(translationRepository, times(1)).save(any());
        assertEquals("DRAFT", existing.getStatus());
        assertEquals(1, existing.getCurrentVersionNumber());
        assertEquals(6, existing.getEtagVersion());
    }

    @Test
    @DisplayName("P0-3, P0-4 & P1-2 Invariants: Triage status, signals (sense, risk), and head version are properly persisted")
    void testTriageStatusAndSignalsPersisted() {
        String tagId = "cust.gender.female";
        String lang = "ar";

        EnglishCopy ec = new EnglishCopy();
        ec.setTagId(tagId);
        ec.setCurrentVersionNumber(1);
        when(englishCopyRepository.findById(tagId)).thenReturn(Optional.of(ec));

        Translation existing = new Translation();
        existing.setTagId(tagId);
        existing.setLanguageCode(lang);
        existing.setStatus("NO_TRANSLATION");
        existing.setEtagVersion(1);
        when(translationRepository.findByIdForUpdate(tagId, lang)).thenReturn(Optional.of(existing));

        TranslationVersion v1 = new TranslationVersion();
        v1.setVersionNumber(1);
        when(versionRepository.findTopByTagIdAndLanguageCodeOrderByVersionNumberDesc(tagId, lang)).thenReturn(Optional.of(v1));

        EngineResult er = EngineResult.builder()
                .tagId(tagId)
                .rawResult(ScreenTranslationResult.builder().translation("أنثى").backTranslation("Female").build())
                .isFlagged(true) // Triage flagged!
                .triageCause("short_ambiguous")
                .sense("Gender option for customer")
                .resolvedBy("siblings")
                .risk("medium")
                .modelUsed("gemini-2.5-flash")
                .build();

        persistenceService.saveEngineResult(er, lang, UUID.randomUUID());

        ArgumentCaptor<TranslationVersion> versionCaptor = ArgumentCaptor.forClass(TranslationVersion.class);
        verify(versionRepository).save(versionCaptor.capture());

        TranslationVersion savedVersion = versionCaptor.getValue();
        assertEquals(2, savedVersion.getVersionNumber());
        assertEquals("NEEDS_ATTENTION", savedVersion.getStatus(), "Flagged tag must be saved as NEEDS_ATTENTION");
        assertEquals("Gender option for customer", savedVersion.getSense());
        assertEquals("medium", savedVersion.getRisk());
        assertEquals("PASSED", savedVersion.getVariableIntegrityStatus());
        assertEquals(new BigDecimal("0.70"), savedVersion.getConfidenceScore(), "Computed confidence score based on signals should be 0.70");

        // Verify head row was updated with currentVersionNumber
        assertEquals(2, existing.getCurrentVersionNumber());
        assertEquals("NEEDS_ATTENTION", existing.getStatus());
        assertEquals(2, existing.getEtagVersion());
    }

    @Test
    @DisplayName("P0-6 Invariant: Blocked results are persisted with status=BLOCKED and variableIntegrityStatus=FAILED")
    void testBlockedResultsPersistedAsBlocked() {
        String tagId = "msg.welcome";
        String lang = "ar";

        EnglishCopy ec = new EnglishCopy();
        ec.setTagId(tagId);
        ec.setCurrentVersionNumber(1);
        when(englishCopyRepository.findById(tagId)).thenReturn(Optional.of(ec));

        Translation existing = new Translation();
        existing.setTagId(tagId);
        existing.setLanguageCode(lang);
        existing.setStatus("NO_TRANSLATION");
        existing.setEtagVersion(1);
        when(translationRepository.findByIdForUpdate(tagId, lang)).thenReturn(Optional.of(existing));

        EngineResult er = EngineResult.builder()
                .tagId(tagId)
                .rawResult(ScreenTranslationResult.builder().translation("مرحبا").build())
                .isBlocked(true) // Hard gate failed!
                .stateCause("blocked_FAILED_PLACEHOLDER")
                .build();

        persistenceService.saveEngineResult(er, lang, UUID.randomUUID());

        ArgumentCaptor<TranslationVersion> versionCaptor = ArgumentCaptor.forClass(TranslationVersion.class);
        verify(versionRepository).save(versionCaptor.capture());

        TranslationVersion savedVersion = versionCaptor.getValue();
        assertEquals("BLOCKED", savedVersion.getStatus());
        assertEquals("FAILED", savedVersion.getVariableIntegrityStatus());
        assertEquals("BLOCKED", existing.getStatus());
    }
}
