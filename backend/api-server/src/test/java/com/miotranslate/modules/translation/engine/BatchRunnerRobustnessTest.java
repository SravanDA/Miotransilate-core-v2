package com.miotranslate.modules.translation.engine;

import com.miotranslate.modules.translation.engine.model.*;
import com.miotranslate.shared.integration.ai.AiTranslationClient;
import com.miotranslate.shared.integration.ai.model.AuditResultItem;
import com.miotranslate.shared.integration.ai.model.ScreenTranslationResult;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.*;
import java.util.concurrent.atomic.AtomicInteger;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
@DisplayName("BatchRunner Pipeline & Reconciliation Robustness Tests")
class BatchRunnerRobustnessTest {

    @Mock
    private PromptBuilder promptBuilder;

    @Mock
    private AiTranslationClient aiClient;

    @Mock
    private ContextAssembler contextAssembler;

    private Validator validator;
    private RiskGate riskGate;
    private BatchRunner batchRunner;
    private EngineConfig config;

    @BeforeEach
    void setUp() {
        validator = new Validator();
        riskGate = new RiskGate();
        batchRunner = new BatchRunner(promptBuilder, aiClient, validator, riskGate, contextAssembler);
        config = new EngineConfig();
        config.setMaxRetries(2);
        config.setBackoffBaseMs(10); // fast for tests
        config.setMaxParallelism(4);
    }

    @Test
    @DisplayName("Completeness reconciliation recovers missing tags on second attempt")
    void testReconciliationLoopRecoversMissingTags() {
        TagContext t1 = new TagContext("tag1", "Hello", 1);
        TagContext t2 = new TagContext("tag2", "World", 1);
        TranslationChunk initialChunk = TranslationChunk.builder()
                .chunkIndex(0)
                .tagsToTranslate(List.of(t1, t2))
                .pageName("TestPage")
                .domain("CRM")
                .targetLanguage("ar")
                .build();

        PageJob job = PageJob.builder()
                .pageId("p1")
                .pageName("TestPage")
                .targetLanguage("ar")
                .allTagIds(Set.of("tag1", "tag2"))
                .chunks(List.of(initialChunk))
                .build();

        when(promptBuilder.build(any())).thenReturn("{\"prompt\": true}");

        // Attempt 1: AI only returns tag1 (tag2 was dropped)
        ScreenTranslationResult r1 = ScreenTranslationResult.builder()
                .tag("tag1").translation("مرحبا").sense("Greeting").resolvedBy("unambiguous").risk("low").build();

        // Attempt 2 (reconciliation follow-up chunk for tag2): AI returns tag2
        ScreenTranslationResult r2 = ScreenTranslationResult.builder()
                .tag("tag2").translation("العالم").sense("World noun").resolvedBy("unambiguous").risk("low").build();

        AtomicInteger callCount = new AtomicInteger(0);
        when(aiClient.translateScreen(anyString())).thenAnswer(invocation -> {
            int c = callCount.incrementAndGet();
            if (c == 1) {
                return List.of(r1);
            } else {
                return List.of(r2);
            }
        });

        TranslationChunk followUpChunk = TranslationChunk.builder()
                .chunkIndex(0)
                .tagsToTranslate(List.of(t2))
                .pageName("TestPage")
                .domain("CRM")
                .targetLanguage("ar")
                .build();
        when(contextAssembler.buildChunk(eq(Set.of("tag2")), eq("ar"), eq("p1"))).thenReturn(followUpChunk);

        PageTranslationResult result = batchRunner.translatePage(job, config);

        assertNotNull(result);
        assertEquals("COMPLETE", result.getStatus());
        assertEquals(2, result.getRequested());
        assertEquals(2, result.getSucceeded());
        assertEquals(0, result.getBlocked());
        assertEquals(0, result.getRemaining());
        assertEquals(2, result.getResults().size());
        assertEquals(1, result.getChunks().getReconciliationRuns());
    }

    @Test
    @DisplayName("Blocked tags (failed placeholders) are retained and prevent status from being COMPLETE")
    void testBlockedTagsAreNotReportedAsComplete() {
        TagContext t1 = new TagContext("tag1", "Hello {name}", 1);
        TranslationChunk chunk = TranslationChunk.builder()
                .chunkIndex(0)
                .tagsToTranslate(List.of(t1))
                .pageName("TestPage")
                .domain("CRM")
                .targetLanguage("ar")
                .build();

        PageJob job = PageJob.builder()
                .pageId("p1")
                .pageName("TestPage")
                .targetLanguage("ar")
                .allTagIds(Set.of("tag1"))
                .chunks(List.of(chunk))
                .build();

        when(promptBuilder.build(any())).thenReturn("prompt");

        // Model dropped {name} placeholder -> hard fail
        ScreenTranslationResult r1 = ScreenTranslationResult.builder()
                .tag("tag1")
                .translation("مرحبا") // Missing {name}
                .sense("Greeting")
                .resolvedBy("unambiguous")
                .risk("low")
                .build();

        when(aiClient.translateScreen(anyString())).thenReturn(List.of(r1));

        PageTranslationResult result = batchRunner.translatePage(job, config);

        assertNotNull(result);
        // Status must NOT be COMPLETE because tag1 failed hard validation
        assertEquals("PARTIAL_SUCCESS", result.getStatus());
        assertEquals(1, result.getBlocked());
        assertTrue(result.getBlockedTagIds().contains("tag1"));
        assertEquals(1, result.getResults().size());
        assertTrue(result.getResults().get(0).isBlocked());
    }

    @Test
    @DisplayName("Layer-3 audit corrects wrong_sense translation with improved string")
    void testLayer3AuditCorrectsWrongSense() {
        TagContext t1 = new TagContext("cust.gender.female", "Female", 1);
        TranslationChunk chunk = TranslationChunk.builder()
                .chunkIndex(0)
                .tagsToTranslate(List.of(t1))
                .pageName("Customer Profile")
                .domain("CRM")
                .targetLanguage("ar")
                .build();

        PageJob job = PageJob.builder()
                .pageId("p1")
                .pageName("Customer Profile")
                .targetLanguage("ar")
                .allTagIds(Set.of("cust.gender.female"))
                .chunks(List.of(chunk))
                .build();

        when(promptBuilder.build(any())).thenReturn("prompt");
        when(promptBuilder.buildAuditPrompt(any(), any())).thenReturn("audit_prompt");

        // AI generated translation with 'high' risk or short ambiguous word -> triggers triage
        ScreenTranslationResult r1 = ScreenTranslationResult.builder()
                .tag("cust.gender.female")
                .translation("نادر") // Mistranslation (means 'rare/female scarcity' instead of gender)
                .sense("Gender of customer")
                .resolvedBy("guessed")
                .risk("high")
                .build();

        when(aiClient.translateScreen(anyString())).thenReturn(List.of(r1));

        // Auditor detects wrong_sense and provides corrected string 'أنثى'
        AuditResultItem auditItem = AuditResultItem.builder()
                .tag("cust.gender.female")
                .verdict("wrong_sense")
                .reading("Reads as 'rare'")
                .better("أنثى")
                .build();
        when(aiClient.auditScreen(anyString())).thenReturn(List.of(auditItem));

        PageTranslationResult result = batchRunner.translatePage(job, config);

        assertNotNull(result);
        assertEquals(1, result.getResults().size());
        EngineResult er = result.getResults().get(0);
        assertEquals("أنثى", er.getRawResult().getTranslation(), "Expected auditor's improved translation to be applied");
        assertTrue(er.isFlagged());
        assertTrue(er.getTriageCause().contains("audit:wrong_sense"));
    }

    @Test
    @DisplayName("Non-retryable 401 error fails fast without burning retry sleeps")
    void testNonRetryableErrorFailsFast() {
        TagContext t1 = new TagContext("tag1", "Hello", 1);
        TranslationChunk chunk = TranslationChunk.builder()
                .chunkIndex(0)
                .tagsToTranslate(List.of(t1))
                .pageName("TestPage")
                .targetLanguage("ar")
                .build();

        PageJob job = PageJob.builder()
                .pageId("p1")
                .pageName("TestPage")
                .targetLanguage("ar")
                .allTagIds(Set.of("tag1"))
                .chunks(List.of(chunk))
                .build();

        when(promptBuilder.build(any())).thenReturn("prompt");
        when(aiClient.translateScreen(anyString())).thenThrow(new RuntimeException("Failed to call Gemini API: 401"));

        PageTranslationResult result = batchRunner.translatePage(job, config);

        assertNotNull(result);
        assertEquals("FAILED", result.getStatus());
        assertEquals(0, result.getSucceeded());
        // Verify translateScreen was only called once because 401 is non-retryable
        verify(aiClient, times(1)).translateScreen(anyString());
    }
}
