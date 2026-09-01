package com.miotranslate.modules.translation.engine;

import com.miotranslate.modules.translation.engine.model.*;
import com.miotranslate.shared.integration.ai.model.ScreenTranslationResult;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Set;

import static org.junit.jupiter.api.Assertions.*;

class ValidatorTest {

    private Validator validator;

    @BeforeEach
    void setUp() {
        validator = new Validator();
    }

    @Test
    void testPreValidateExtractsPlaceholders() {
        TranslationChunk chunk = TranslationChunk.builder()
                .tagsToTranslate(List.of(
                        new TagContext("tag1", "Hello {name}, you have %d messages.", 1)
                ))
                .build();

        PreValidationResult result = validator.preValidate(chunk);
        assertNotNull(result);
        assertTrue(result.getSkipList().isEmpty());
        List<String> placeholders = result.getExpectedPlaceholders().get("tag1");
        assertNotNull(placeholders);
        assertEquals(2, placeholders.size());
        assertTrue(placeholders.contains("{name}"));
        assertTrue(placeholders.contains("%d"));
    }

    @Test
    void testValidateModelOutput() {
        ScreenTranslationResult r1 = ScreenTranslationResult.builder()
                .tag("tag1")
                .sense("Greeting")
                .translation("Bonjour")
                .resolvedBy("siblings")
                .risk("low")
                .build();

        ScreenTranslationResult r2 = ScreenTranslationResult.builder()
                .tag("tag2")
                .sense("Missing translation")
                .translation("") // Invalid
                .resolvedBy("page")
                .risk("low")
                .build();

        ModelOutputValidation out = validator.validateModelOutput(List.of(r1, r2), Set.of("tag1", "tag2", "tag3"));
        assertEquals(1, out.getValidResults().size());
        assertEquals("tag1", out.getValidResults().get(0).getTag());
        assertTrue(out.getRejectedTagIds().contains("tag2"));
        assertTrue(out.getMissingTagIds().contains("tag3"));
    }

    @Test
    void testPostValidatePlaceholderIntegrity() {
        TranslationChunk chunk = TranslationChunk.builder()
                .tagsToTranslate(List.of(
                        new TagContext("tag1", "Hello {name}", 1)
                ))
                .build();

        PreValidationResult pre = validator.preValidate(chunk);

        ScreenTranslationResult r1 = ScreenTranslationResult.builder()
                .tag("tag1")
                .translation("Bonjour {name}") // Correct
                .build();

        ValidationOutcome outcome = validator.postValidate(List.of(r1), chunk, pre);
        assertTrue(outcome.getDetails().get("tag1").isPassed());

        ScreenTranslationResult r2 = ScreenTranslationResult.builder()
                .tag("tag1")
                .translation("Bonjour") // Missing placeholder
                .build();
        ValidationOutcome outcome2 = validator.postValidate(List.of(r2), chunk, pre);
        assertFalse(outcome2.getDetails().get("tag1").isPassed());
        assertEquals("FAILED_PLACEHOLDER", outcome2.getDetails().get("tag1").getFailureReason());
    }
}
