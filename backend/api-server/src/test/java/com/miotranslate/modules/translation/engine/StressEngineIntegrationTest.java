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
import java.util.concurrent.*;
import java.util.concurrent.atomic.AtomicInteger;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
@DisplayName("Brutal Stress, Chaos & Concurrency Engine Tests")
class StressEngineIntegrationTest {

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
        config.setMaxParallelism(8);
        config.setMaxRetries(3);
        config.setBackoffBaseMs(1);
    }

    @Test
    @DisplayName("Stress Test: 300 tags across 10 chunks executed concurrently under high load")
    void testHighConcurrencyChunkExecution() throws Exception {
        int totalTags = 300;
        int chunkSize = 30;
        int numChunks = totalTags / chunkSize;

        List<TagContext> allTags = new ArrayList<>();
        Set<String> allTagIds = new HashSet<>();
        List<TranslationChunk> chunks = new ArrayList<>();

        for (int c = 0; c < numChunks; c++) {
            List<TagContext> chunkTags = new ArrayList<>();
            for (int t = 0; t < chunkSize; t++) {
                String tagId = "tag_" + c + "_" + t;
                allTagIds.add(tagId);
                TagContext tc = new TagContext(tagId, "Service " + t + " for {{client}} at %s", 1);
                chunkTags.add(tc);
                allTags.add(tc);
            }
            chunks.add(TranslationChunk.builder()
                    .chunkIndex(c)
                    .tagsToTranslate(chunkTags)
                    .pageName("HighLoadPage")
                    .domain("APPOINTMENTS")
                    .targetLanguage("ar")
                    .build());
        }

        PageJob job = PageJob.builder()
                .pageId("high_load_page")
                .pageName("HighLoadPage")
                .targetLanguage("ar")
                .allTagIds(allTagIds)
                .chunks(chunks)
                .build();

        when(promptBuilder.build(any())).thenReturn("prompt");

        // Mock AI responds concurrently with valid translations for all tags in the chunk
        when(aiClient.translateScreen(anyString())).thenAnswer(invocation -> {
            // Emulate non-trivial translation latency
            Thread.sleep(10);
            List<ScreenTranslationResult> resList = new ArrayList<>();
            for (int i = 0; i < chunkSize; i++) {
                // Determine which chunk by matching tag pattern
                resList.add(ScreenTranslationResult.builder()
                        .sense("Service item")
                        .resolvedBy("unambiguous")
                        .risk("low")
                        .build());
            }
            return resList;
        });

        // Better mock: return actual matching tags for the chunk
        when(promptBuilder.build(any())).thenAnswer(invocation -> {
            TranslationChunk c = invocation.getArgument(0);
            return "chunk_" + c.getChunkIndex();
        });

        when(aiClient.translateScreen(anyString())).thenAnswer(invocation -> {
            String prompt = invocation.getArgument(0);
            int chunkIdx = Integer.parseInt(prompt.replace("chunk_", ""));
            TranslationChunk chunk = chunks.get(chunkIdx);
            List<ScreenTranslationResult> results = new ArrayList<>();
            for (TagContext tc : chunk.getTagsToTranslate()) {
                results.add(ScreenTranslationResult.builder()
                        .tag(tc.getTagId())
                        .translation("خدمة للعميل {{client}} في %s")
                        .sense("Service item description")
                        .resolvedBy("unambiguous")
                        .risk("low")
                        .build());
            }
            return results;
        });

        PageTranslationResult result = batchRunner.translatePage(job, config);

        assertNotNull(result);
        assertEquals("COMPLETE", result.getStatus());
        assertEquals(300, result.getRequested());
        assertEquals(300, result.getSucceeded());
        assertEquals(0, result.getBlocked());
        assertEquals(0, result.getRemaining());
        assertEquals(300, result.getResults().size());
    }

    @Test
    @DisplayName("Chaos Test: Mixed scenario with clean, flagged, audited, and placeholder-corrupted tags")
    void testChaosScenarioMixedOutputs() {
        TagContext cleanTag = new TagContext("tag_clean", "Select Service", 1);
        TagContext flaggedTag = new TagContext("tag_flagged", "Female", 1);
        TagContext corruptedTag = new TagContext("tag_corrupted", "Hello {{name}}", 1);

        TranslationChunk chunk = TranslationChunk.builder()
                .chunkIndex(0)
                .tagsToTranslate(List.of(cleanTag, flaggedTag, corruptedTag))
                .pageName("ChaosPage")
                .domain("CRM")
                .targetLanguage("ar")
                .build();

        PageJob job = PageJob.builder()
                .pageId("chaos_page")
                .pageName("ChaosPage")
                .targetLanguage("ar")
                .allTagIds(Set.of("tag_clean", "tag_flagged", "tag_corrupted"))
                .chunks(List.of(chunk))
                .build();

        when(promptBuilder.build(any())).thenReturn("prompt");
        when(promptBuilder.buildAuditPrompt(any(), any())).thenReturn("audit_prompt");

        // AI returns:
        // 1. clean: valid translation
        ScreenTranslationResult rClean = ScreenTranslationResult.builder()
                .tag("tag_clean").translation("اختر الخدمة").sense("Selection").resolvedBy("unambiguous").risk("low").build();
        // 2. flagged: ambiguous, resolved by guessed
        ScreenTranslationResult rFlagged = ScreenTranslationResult.builder()
                .tag("tag_flagged").translation("نادر").sense("Gender option").resolvedBy("guessed").risk("high").build();
        // 3. corrupted: dropped {{name}} placeholder
        ScreenTranslationResult rCorrupted = ScreenTranslationResult.builder()
                .tag("tag_corrupted").translation("مرحبا").sense("Greeting").resolvedBy("unambiguous").risk("low").build();

        when(aiClient.translateScreen(anyString())).thenReturn(List.of(rClean, rFlagged, rCorrupted));

        // Auditor improves the flagged tag to 'أنثى'
        AuditResultItem auditItem = AuditResultItem.builder()
                .tag("tag_flagged")
                .verdict("wrong_sense")
                .reading("Reads as rare")
                .better("أنثى")
                .build();
        when(aiClient.auditScreen(anyString())).thenReturn(List.of(auditItem));

        PageTranslationResult result = batchRunner.translatePage(job, config);

        assertNotNull(result);
        assertEquals("PARTIAL_SUCCESS", result.getStatus());
        assertEquals(3, result.getRequested());
        assertEquals(2, result.getSucceeded());
        assertEquals(1, result.getBlocked());
        assertTrue(result.getBlockedTagIds().contains("tag_corrupted"));

        Map<String, EngineResult> resultMap = new HashMap<>();
        for (EngineResult er : result.getResults()) {
            resultMap.put(er.getTagId(), er);
        }

        // Verify clean tag
        EngineResult erClean = resultMap.get("tag_clean");
        assertNotNull(erClean);
        assertFalse(erClean.isBlocked());
        assertFalse(erClean.isFlagged());
        assertEquals("اختر الخدمة", erClean.getRawResult().getTranslation());

        // Verify flagged + audited tag
        EngineResult erFlagged = resultMap.get("tag_flagged");
        assertNotNull(erFlagged);
        assertFalse(erFlagged.isBlocked());
        assertTrue(erFlagged.isFlagged());
        assertEquals("أنثى", erFlagged.getRawResult().getTranslation(), "Auditor's correction must be applied");

        // Verify corrupted tag
        EngineResult erCorrupted = resultMap.get("tag_corrupted");
        assertNotNull(erCorrupted);
        assertTrue(erCorrupted.isBlocked());
        assertEquals("blocked_FAILED_PLACEHOLDER", erCorrupted.getStateCause());
    }

    @Test
    @DisplayName("Adversarial Unicode & Non-Latin Scripts: Arabic RTL, Japanese, Hindi, French-Canadian, Thai")
    void testAdversarialUnicodeScripts() {
        TranslationChunk chunk = TranslationChunk.builder()
                .tagsToTranslate(List.of(
                        new TagContext("tag_ar", "Total: {amount} SAR", 1),
                        new TagContext("tag_ja", "予約確認 {{booking_id}}", 1),
                        new TagContext("tag_hi", "अपॉइंटमेंट %s", 1),
                        new TagContext("tag_fr", "Rendez-vous annulé %d", 1),
                        new TagContext("tag_th", "ยินดีต้อนรับ {user}", 1)
                ))
                .build();

        PreValidationResult pre = validator.preValidate(chunk);
        assertEquals(5, pre.getExpectedPlaceholders().size());

        List<ScreenTranslationResult> results = List.of(
                ScreenTranslationResult.builder().tag("tag_ar").translation("الإجمالي: {amount} ر.س").build(),
                ScreenTranslationResult.builder().tag("tag_ja").translation("予約確認 {{booking_id}} です").build(),
                ScreenTranslationResult.builder().tag("tag_hi").translation("अपॉइंटमेंट %s सफल").build(),
                ScreenTranslationResult.builder().tag("tag_fr").translation("Rendez-vous annulé %d avec succès").build(),
                ScreenTranslationResult.builder().tag("tag_th").translation("ยินดีต้อนรับ {user} สู่ระบบ").build()
        );

        ValidationOutcome outcome = validator.postValidate(results, chunk, pre);
        for (String tag : List.of("tag_ar", "tag_ja", "tag_hi", "tag_fr", "tag_th")) {
            ValidationDetails details = outcome.getDetails().get(tag);
            assertNotNull(details, "Details missing for " + tag);
            assertTrue(details.isPassed(), "Validation failed unexpectedly for " + tag);
        }
    }
}
