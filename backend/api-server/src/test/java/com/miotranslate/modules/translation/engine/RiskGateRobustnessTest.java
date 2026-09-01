package com.miotranslate.modules.translation.engine;

import com.miotranslate.modules.translation.engine.model.*;
import com.miotranslate.shared.integration.ai.model.ScreenTranslationResult;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;

import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;

@DisplayName("RiskGate 5-Signal Triage Escalation Tests")
class RiskGateRobustnessTest {

    private RiskGate riskGate;
    private EngineConfig config;

    @BeforeEach
    void setUp() {
        riskGate = new RiskGate();
        config = new EngineConfig();
    }

    @Test
    @DisplayName("Signal 1: Self-reported HIGH risk escalates to flagged")
    void testSignal1HighRisk() {
        ScreenTranslationResult r = ScreenTranslationResult.builder()
                .tag("tag1")
                .risk("HIGH") // Case-insensitive
                .resolvedBy("unambiguous")
                .build();
        TranslationChunk chunk = TranslationChunk.builder()
                .tagsToTranslate(List.of(new TagContext("tag1", "General description", 1)))
                .build();

        TriageResult result = riskGate.triage(List.of(r), new ValidationOutcome(), config, chunk);
        assertEquals(1, result.getFlagged().size());
        assertTrue(result.getClean().isEmpty());
    }

    @Test
    @DisplayName("Signal 2: Ambiguity resolved by GUESSED escalates to flagged")
    void testSignal2Guessed() {
        ScreenTranslationResult r = ScreenTranslationResult.builder()
                .tag("tag1")
                .risk("low")
                .resolvedBy("GUESSED") // Case-insensitive
                .build();
        TranslationChunk chunk = TranslationChunk.builder()
                .tagsToTranslate(List.of(new TagContext("tag1", "Staff list", 1)))
                .build();

        TriageResult result = riskGate.triage(List.of(r), new ValidationOutcome(), config, chunk);
        assertEquals(1, result.getFlagged().size());
        assertTrue(result.getClean().isEmpty());
    }

    @ParameterizedTest
    @ValueSource(strings = {"Save", "Female", "Male", "Due", "Tip", "Close", "Open", "Book", "Service", "Balance"})
    @DisplayName("Signal 3: Short ambiguous words from ambiguous list escalate to flagged")
    void testSignal3ShortAmbiguous(String ambiguousWord) {
        ScreenTranslationResult r = ScreenTranslationResult.builder()
                .tag("tag1")
                .risk("low")
                .resolvedBy("siblings")
                .build();
        TranslationChunk chunk = TranslationChunk.builder()
                .tagsToTranslate(List.of(new TagContext("tag1", ambiguousWord, 1)))
                .build();

        TriageResult result = riskGate.triage(List.of(r), new ValidationOutcome(), config, chunk);
        assertEquals(1, result.getFlagged().size(), "Word '" + ambiguousWord + "' should have been flagged");
    }

    @Test
    @DisplayName("Signal 4: Soft flags from post-validation escalate to flagged")
    void testSignal4SoftFlags() {
        ScreenTranslationResult r = ScreenTranslationResult.builder()
                .tag("tag1")
                .risk("low")
                .resolvedBy("page")
                .build();
        TranslationChunk chunk = TranslationChunk.builder()
                .tagsToTranslate(List.of(new TagContext("tag1", "Standard title text", 1)))
                .build();

        ValidationOutcome outcome = new ValidationOutcome(Map.of(
                "tag1", ValidationDetails.builder()
                        .tagId("tag1")
                        .passed(true)
                        .softFlags(List.of("needs_attention_length"))
                        .build()
        ));

        TriageResult result = riskGate.triage(List.of(r), outcome, config, chunk);
        assertEquals(1, result.getFlagged().size());
        assertTrue(result.getClean().isEmpty());
    }

    @ParameterizedTest
    @ValueSource(strings = {"Delete", "Cancel", "Reset", "Refund", "Void", "Terminate", "Remove", "Purge"})
    @DisplayName("Signal 5: High blast radius actions escalate to flagged")
    void testSignal5HighBlastRadius(String blastAction) {
        ScreenTranslationResult r = ScreenTranslationResult.builder()
                .tag("tag1")
                .risk("low")
                .resolvedBy("unambiguous")
                .build();
        TranslationChunk chunk = TranslationChunk.builder()
                .tagsToTranslate(List.of(new TagContext("tag1", blastAction, 1)))
                .build();

        TriageResult result = riskGate.triage(List.of(r), new ValidationOutcome(), config, chunk);
        assertEquals(1, result.getFlagged().size(), "Action '" + blastAction + "' should have been flagged");
    }

    @Test
    @DisplayName("Completely clean translation is routed to clean set without flags")
    void testCleanTranslationRoutesToClean() {
        ScreenTranslationResult r = ScreenTranslationResult.builder()
                .tag("tag1")
                .risk("low")
                .resolvedBy("siblings")
                .build();
        TranslationChunk chunk = TranslationChunk.builder()
                .tagsToTranslate(List.of(new TagContext("tag1", "Please select your preferred appointment date", 1)))
                .build();

        TriageResult result = riskGate.triage(List.of(r), new ValidationOutcome(), config, chunk);
        assertEquals(1, result.getClean().size());
        assertTrue(result.getFlagged().isEmpty());
    }
}
