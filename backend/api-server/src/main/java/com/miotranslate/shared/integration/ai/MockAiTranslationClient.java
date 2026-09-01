package com.miotranslate.shared.integration.ai;

import org.springframework.stereotype.Component;

import java.math.BigDecimal;
import java.util.concurrent.TimeUnit;

@Component
public class MockAiTranslationClient implements AiTranslationClient {

    @Override
    public java.util.List<com.miotranslate.shared.integration.ai.model.ScreenTranslationResult> translateScreen(String prompt) {
        try {
            TimeUnit.MILLISECONDS.sleep(200);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
        }
        
        // Mocking: In a real test, we would parse the prompt and return results per tag.
        // For now, return an empty list. The actual mock logic will be updated later.
        return new java.util.ArrayList<>();
    }

    @Override
    public String auditScreen(String prompt) {
        return "{}";
    }
}
