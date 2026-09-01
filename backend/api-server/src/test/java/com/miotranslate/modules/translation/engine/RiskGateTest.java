package com.miotranslate.modules.translation.engine;

import com.miotranslate.modules.translation.engine.model.*;
import com.miotranslate.shared.integration.ai.model.ScreenTranslationResult;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;

class RiskGateTest {

    private RiskGate riskGate;
    private EngineConfig config;

    @BeforeEach
    void setUp() {
        riskGate = new RiskGate();
        config = new EngineConfig();
        config.setAmbiguousWordList(List.of("Save", "Charge", "Female"));
        config.setHighBlastRadiusActions(List.of("Delete", "Void", "Refund"));
    }

    @Test
    void testTriageRoutesHighRiskToFlagged() {
        ScreenTranslationResult r1 = ScreenTranslationResult.builder()
                .tag("tag1")
                .risk("high")
                .build();
        TranslationChunk chunk = TranslationChunk.builder()
                .tagsToTranslate(List.of(new TagContext("tag1", "Normal text", 1)))
                .build();

        TriageResult result = riskGate.triage(List.of(r1), new ValidationOutcome(), config, chunk);
        assertTrue(result.getClean().isEmpty());
        assertEquals(1, result.getFlagged().size());
    }

    @Test
    void testTriageRoutesAmbiguousToFlagged() {
        ScreenTranslationResult r1 = ScreenTranslationResult.builder()
                .tag("tag1")
                .risk("low")
                .resolvedBy("siblings")
                .build();
        TranslationChunk chunk = TranslationChunk.builder()
                .tagsToTranslate(List.of(new TagContext("tag1", "Female", 1))) // Short and in ambiguous list
                .build();

        TriageResult result = riskGate.triage(List.of(r1), new ValidationOutcome(), config, chunk);
        assertTrue(result.getClean().isEmpty());
        assertEquals(1, result.getFlagged().size());
    }

    @Test
    void testTriageRoutesCleanToClean() {
        ScreenTranslationResult r1 = ScreenTranslationResult.builder()
                .tag("tag1")
                .risk("low")
                .resolvedBy("siblings")
                .build();
        TranslationChunk chunk = TranslationChunk.builder()
                .tagsToTranslate(List.of(new TagContext("tag1", "Normal text longer than two words", 1)))
                .build();

        TriageResult result = riskGate.triage(List.of(r1), new ValidationOutcome(), config, chunk);
        assertEquals(1, result.getClean().size());
        assertTrue(result.getFlagged().isEmpty());
    }
}
