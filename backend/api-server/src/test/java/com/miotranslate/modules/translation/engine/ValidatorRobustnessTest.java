package com.miotranslate.modules.translation.engine;

import com.miotranslate.modules.translation.engine.model.*;
import com.miotranslate.shared.integration.ai.model.ScreenTranslationResult;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;

import java.util.Collections;
import java.util.List;
import java.util.Set;

import static org.junit.jupiter.api.Assertions.*;

@DisplayName("Validator Robustness & Adversarial Input Tests")
class ValidatorRobustnessTest {

    private Validator validator;

    @BeforeEach
    void setUp() {
        validator = new Validator();
    }

    @Nested
    @DisplayName("Pre-Validation & Skip List Edge Cases")
    class PreValidationTests {

        @Test
        @DisplayName("Handles null and empty chunks gracefully without throwing NullPointerException")
        void testNullAndEmptyChunk() {
            assertDoesNotThrow(() -> {
                PreValidationResult res = validator.preValidate(new TranslationChunk());
                assertNotNull(res);
                assertTrue(res.getSkipList().isEmpty());
                assertTrue(res.getExpectedPlaceholders().isEmpty());
            });

            TranslationChunk chunkWithNullTags = TranslationChunk.builder().tagsToTranslate(null).build();
            PreValidationResult res2 = validator.preValidate(chunkWithNullTags);
            assertNotNull(res2);
        }

        @ParameterizedTest
        @ValueSource(strings = {"", "   ", "---", "...", "123", "99.9%", "@#$%", "!?:", "123-456-7890"})
        @DisplayName("Correctly adds punctuation, empty, and numeric-only strings to skip list")
        void testPunctuationAndNumericSkipped(String source) {
            TranslationChunk chunk = TranslationChunk.builder()
                    .tagsToTranslate(List.of(new TagContext("tag_skip", source, 1)))
                    .build();

            PreValidationResult res = validator.preValidate(chunk);
            assertTrue(res.getSkipList().contains("tag_skip"), "Expected " + source + " to be skipped");
        }

        @Test
        @DisplayName("Extracts all varieties of placeholders: {{double}}, {single}, %1$s, %s, %d")
        void testComplexPlaceholderExtraction() {
            String complex = "Dear {{client.name}}, appointment on %1$s with {staff_name} for %d services costs %s.";
            TranslationChunk chunk = TranslationChunk.builder()
                    .tagsToTranslate(List.of(new TagContext("complex_tag", complex, 1)))
                    .build();

            PreValidationResult res = validator.preValidate(chunk);
            List<String> placeholders = res.getExpectedPlaceholders().get("complex_tag");
            assertNotNull(placeholders);
            assertEquals(5, placeholders.size());
            assertTrue(placeholders.contains("{{client.name}}"));
            assertTrue(placeholders.contains("%1$s"));
            assertTrue(placeholders.contains("{staff_name}"));
            assertTrue(placeholders.contains("%d"));
            assertTrue(placeholders.contains("%s"));
        }
    }

    @Nested
    @DisplayName("Model Output Structural Gate Tests")
    class ModelOutputValidationTests {

        @Test
        @DisplayName("Rejects hallucinated tag IDs that were never requested")
        void testRejectsHallucinatedTags() {
            ScreenTranslationResult r1 = ScreenTranslationResult.builder()
                    .tag("hallucinated_tag_999")
                    .sense("Fabricated")
                    .translation("Fake")
                    .resolvedBy("unambiguous")
                    .risk("low")
                    .build();

            ModelOutputValidation out = validator.validateModelOutput(List.of(r1), Set.of("tag1", "tag2"));
            assertTrue(out.getValidResults().isEmpty());
            assertTrue(out.getMissingTagIds().contains("tag1"));
            assertTrue(out.getMissingTagIds().contains("tag2"));
        }

        @Test
        @DisplayName("Rejects duplicate tags in model output")
        void testRejectsDuplicateTags() {
            ScreenTranslationResult r1 = ScreenTranslationResult.builder()
                    .tag("tag1")
                    .sense("Sense 1")
                    .translation("Translation 1")
                    .resolvedBy("siblings")
                    .risk("low")
                    .build();

            ScreenTranslationResult r2 = ScreenTranslationResult.builder()
                    .tag("tag1")
                    .sense("Sense 2")
                    .translation("Translation 2")
                    .resolvedBy("siblings")
                    .risk("low")
                    .build();

            ModelOutputValidation out = validator.validateModelOutput(List.of(r1, r2), Set.of("tag1"));
            assertEquals(1, out.getValidResults().size());
            assertEquals("Sense 1", out.getValidResults().get(0).getSense());
        }

        @ParameterizedTest
        @ValueSource(strings = {"unknown_source", "llm_thought", "magic", "CUSTOM", ""})
        @DisplayName("Rejects invalid resolved_by enum values")
        void testRejectsInvalidResolvedBy(String invalidResolvedBy) {
            ScreenTranslationResult r = ScreenTranslationResult.builder()
                    .tag("tag1")
                    .sense("Sense")
                    .translation("Valid")
                    .resolvedBy(invalidResolvedBy)
                    .risk("low")
                    .build();

            ModelOutputValidation out = validator.validateModelOutput(List.of(r), Set.of("tag1"));
            assertTrue(out.getValidResults().isEmpty());
            assertTrue(out.getRejectedTagIds().contains("tag1"));
        }

        @ParameterizedTest
        @ValueSource(strings = {"critical", "extreme", "none", "very_high", "0.90", ""})
        @DisplayName("Rejects invalid risk enum values")
        void testRejectsInvalidRisk(String invalidRisk) {
            ScreenTranslationResult r = ScreenTranslationResult.builder()
                    .tag("tag1")
                    .sense("Sense")
                    .translation("Valid")
                    .resolvedBy("unambiguous")
                    .risk(invalidRisk)
                    .build();

            ModelOutputValidation out = validator.validateModelOutput(List.of(r), Set.of("tag1"));
            assertTrue(out.getValidResults().isEmpty());
            assertTrue(out.getRejectedTagIds().contains("tag1"));
        }

        @Test
        @DisplayName("Rejects blank or whitespace-only translation and sense")
        void testRejectsEmptySenseOrTranslation() {
            ScreenTranslationResult emptySense = ScreenTranslationResult.builder()
                    .tag("tag1")
                    .sense("   ")
                    .translation("Valid")
                    .resolvedBy("unambiguous")
                    .risk("low")
                    .build();

            ScreenTranslationResult emptyTrans = ScreenTranslationResult.builder()
                    .tag("tag2")
                    .sense("Valid")
                    .translation("   ")
                    .resolvedBy("unambiguous")
                    .risk("low")
                    .build();

            ModelOutputValidation out = validator.validateModelOutput(List.of(emptySense, emptyTrans), Set.of("tag1", "tag2"));
            assertTrue(out.getValidResults().isEmpty());
            assertEquals(2, out.getRejectedTagIds().size());
        }
    }

    @Nested
    @DisplayName("Post-Validation & Multiset Deterministic Gates")
    class PostValidationTests {

        @Test
        @DisplayName("Multiset check fails when count of repeated placeholders differs: '{count} of {count}' -> '{count}'")
        void testRepeatedPlaceholderMultisetComparison() {
            TranslationChunk chunk = TranslationChunk.builder()
                    .tagsToTranslate(List.of(new TagContext("tag1", "Page {count} of {count}", 1)))
                    .build();

            PreValidationResult pre = validator.preValidate(chunk);

            // Defect: model collapsed 2 instances into 1
            ScreenTranslationResult collapsed = ScreenTranslationResult.builder()
                    .tag("tag1")
                    .translation("صفحة {count}")
                    .build();

            ValidationOutcome outcome = validator.postValidate(List.of(collapsed), chunk, pre);
            ValidationDetails details = outcome.getDetails().get("tag1");
            assertNotNull(details);
            assertFalse(details.isPassed());
            assertEquals("FAILED_PLACEHOLDER", details.getFailureReason());

            // Success: model kept both 2 instances
            ScreenTranslationResult correct = ScreenTranslationResult.builder()
                    .tag("tag1")
                    .translation("صفحة {count} من {count}")
                    .build();

            ValidationOutcome outcomeCorrect = validator.postValidate(List.of(correct), chunk, pre);
            assertTrue(outcomeCorrect.getDetails().get("tag1").isPassed());
        }

        @Test
        @DisplayName("Markup preservation check: catches missing HTML tags, extra tags, entities")
        void testMarkupPreservation() {
            TranslationChunk chunk = TranslationChunk.builder()
                    .tagsToTranslate(List.of(new TagContext("tag1", "Click <b>here</b> for &amp; help.<br/>", 1)))
                    .build();

            PreValidationResult pre = validator.preValidate(chunk);

            // Missing <b> and <br/>
            ScreenTranslationResult broken = ScreenTranslationResult.builder()
                    .tag("tag1")
                    .translation("انقر هنا للمساعدة")
                    .build();

            ValidationOutcome outcome = validator.postValidate(List.of(broken), chunk, pre);
            ValidationDetails details = outcome.getDetails().get("tag1");
            assertNotNull(details);
            assertFalse(details.isPassed());
            assertEquals("FAILED_MARKUP", details.getFailureReason());

            // Correct markup
            ScreenTranslationResult fixed = ScreenTranslationResult.builder()
                    .tag("tag1")
                    .translation("انقر <b>هنا</b> للمساعدة &amp;<br/>")
                    .build();

            ValidationOutcome outcomeFixed = validator.postValidate(List.of(fixed), chunk, pre);
            assertTrue(outcomeFixed.getDetails().get("tag1").isPassed());
        }

        @Test
        @DisplayName("Leading/trailing whitespace is auto-fixed to match source")
        void testWhitespaceAutoFix() {
            TranslationChunk chunk = TranslationChunk.builder()
                    .tagsToTranslate(List.of(new TagContext("tag1", " Total Amount: ", 1)))
                    .build();

            PreValidationResult pre = validator.preValidate(chunk);

            // Model returned trimmed translation
            ScreenTranslationResult trimmed = ScreenTranslationResult.builder()
                    .tag("tag1")
                    .translation("المبلغ الإجمالي:")
                    .build();

            ValidationOutcome outcome = validator.postValidate(List.of(trimmed), chunk, pre);
            ValidationDetails details = outcome.getDetails().get("tag1");
            assertNotNull(details);
            assertTrue(details.isPassed());
            assertEquals(" المبلغ الإجمالي: ", details.getFixedTranslation());
        }

        @Test
        @DisplayName("Untranslated copy check: allowlist terms pass clean, regular identical copy gets soft flag")
        void testUntranslatedCopyAllowlist() {
            TranslationChunk chunk = TranslationChunk.builder()
                    .tagsToTranslate(List.of(
                            new TagContext("tag_sms", "SMS", 1),
                            new TagContext("tag_pos", "POS", 1),
                            new TagContext("tag_brand", "MioSalon", 1),
                            new TagContext("tag_normal", "Appointments Today", 1)
                    ))
                    .build();

            PreValidationResult pre = validator.preValidate(chunk);

            ScreenTranslationResult rSms = ScreenTranslationResult.builder().tag("tag_sms").translation("SMS").build();
            ScreenTranslationResult rPos = ScreenTranslationResult.builder().tag("tag_pos").translation("POS").build();
            ScreenTranslationResult rBrand = ScreenTranslationResult.builder().tag("tag_brand").translation("MioSalon").build();
            ScreenTranslationResult rNormal = ScreenTranslationResult.builder().tag("tag_normal").translation("Appointments Today").build();

            ValidationOutcome outcome = validator.postValidate(List.of(rSms, rPos, rBrand, rNormal), chunk, pre);

            // Allowed terms should have no soft flag
            assertTrue(outcome.getDetails().get("tag_sms").getSoftFlags().isEmpty());
            assertTrue(outcome.getDetails().get("tag_pos").getSoftFlags().isEmpty());
            assertTrue(outcome.getDetails().get("tag_brand").getSoftFlags().isEmpty());

            // Regular untranslated phrase gets soft flag
            assertTrue(outcome.getDetails().get("tag_normal").getSoftFlags().contains("needs_attention_untranslated"));
        }
    }
}
