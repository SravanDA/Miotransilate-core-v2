package com.miotranslate.shared.integration.ai;

import org.springframework.stereotype.Component;

import java.math.BigDecimal;
import java.util.concurrent.TimeUnit;

@Component
public class MockAiTranslationClient implements AiTranslationClient {

    @Override
    public TranslationResult translate(String englishText, String targetLanguageCode, String context) {
        
        try {
            // Simulate network latency (200ms) for local development
            TimeUnit.MILLISECONDS.sleep(200);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
        }
        
        // Mocking translation logic
        String translatedText = "[AI-" + targetLanguageCode.toUpperCase() + "] " + englishText;
        String backTranslation = "[Back-English] " + englishText;
        BigDecimal confidence = new BigDecimal("0.9500");
        String varIntegrity = "PASSED"; // Assume always passed for mock
        
        return new TranslationResult(translatedText, backTranslation, confidence, varIntegrity);
    }
}
