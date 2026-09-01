package com.miotranslate.modules.translation.service;

import com.miotranslate.modules.content.repository.EnglishCopyRepository;
import com.miotranslate.modules.registry.repository.TagRepository;
import com.miotranslate.modules.translation.engine.TranslationEngine;
import com.miotranslate.modules.translation.engine.model.EngineConfig;
import com.miotranslate.modules.translation.engine.model.EngineResult;
import com.miotranslate.modules.translation.engine.model.PageTranslationResult;
import com.miotranslate.modules.translation.repository.TranslationRepository;
import com.miotranslate.modules.translation.repository.TranslationVersionRepository;
import com.miotranslate.shared.audit.AuditService;
import com.miotranslate.shared.integration.ai.AiTranslationClient;
import com.miotranslate.shared.integration.ai.model.ScreenTranslationResult;
import com.miotranslate.shared.job.JobDispatcher;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;
import java.util.Map;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
@DisplayName("TranslationService Bulk Orchestration & API Contract Tests")
class TranslationServiceRobustnessTest {

    @Mock
    private TranslationRepository translationRepository;
    @Mock
    private TranslationVersionRepository versionRepository;
    @Mock
    private TagRepository tagRepository;
    @Mock
    private EnglishCopyRepository englishCopyRepository;
    @Mock
    private AiTranslationClient aiClient;
    @Mock
    private AuditService auditService;
    @Mock
    private JobDispatcher jobDispatcher;
    @Mock
    private TranslationEngine translationEngine;
    @Mock
    private TranslationPersistenceService persistenceService;

    private TranslationService translationService;

    @BeforeEach
    void setUp() {
        translationService = new TranslationService(
                translationRepository, versionRepository, tagRepository,
                englishCopyRepository, aiClient, auditService,
                jobDispatcher, translationEngine, persistenceService
        );
    }

    @Test
    @DisplayName("Bulk translation correctly orchestrates engine call, per-tag persistence, and accurate response metrics")
    void testBulkTranslationOrchestration() {
        String pageId = "p_calendar";
        String lang = "ar";
        UUID userId = UUID.randomUUID();

        EngineResult er1 = EngineResult.builder()
                .tagId("t1")
                .isBlocked(false)
                .isFlagged(false)
                .rawResult(ScreenTranslationResult.builder().translation("مرحبا").build())
                .build();

        EngineResult er2 = EngineResult.builder()
                .tagId("t2")
                .isBlocked(false)
                .isFlagged(true) // Needs attention
                .rawResult(ScreenTranslationResult.builder().translation("أنثى").build())
                .build();

        EngineResult er3 = EngineResult.builder()
                .tagId("t3")
                .isBlocked(true) // Blocked
                .rawResult(ScreenTranslationResult.builder().translation("خطأ").build())
                .build();

        PageTranslationResult engineResult = PageTranslationResult.builder()
                .pageId(pageId)
                .languageCode(lang)
                .status("PARTIAL_SUCCESS")
                .requested(3)
                .succeeded(2)
                .blocked(1)
                .remaining(0)
                .remainingTagIds(List.of())
                .blockedTagIds(List.of("t3"))
                .results(List.of(er1, er2, er3))
                .build();

        when(translationEngine.translatePage(eq(pageId), eq(lang), isNull(), any(EngineConfig.class)))
                .thenReturn(engineResult);

        Map<String, Object> response = translationService.generateAiTranslationsBulk(pageId, lang, userId);

        assertNotNull(response);
        assertEquals("PARTIAL_SUCCESS", response.get("status"));
        assertEquals(2, response.get("processed")); // 2 successful translations
        assertEquals(3, response.get("total"));     // 3 total requested
        assertEquals(1, response.get("blocked"));   // 1 blocked
        assertEquals(1, response.get("needsAttention")); // 1 needs attention
        assertEquals(List.of("t3"), response.get("blockedTagIds"));

        // Verify persistence service was called for ALL 3 results (including the blocked tag)
        verify(persistenceService, times(1)).saveEngineResult(er1, lang, userId);
        verify(persistenceService, times(1)).saveEngineResult(er2, lang, userId);
        verify(persistenceService, times(1)).saveEngineResult(er3, lang, userId);
    }
}
