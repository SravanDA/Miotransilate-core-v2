package com.miotranslate.shared.integration.ai;

import com.miotranslate.shared.integration.ai.model.ScreenTranslationResult;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.context.annotation.Primary;
import org.springframework.stereotype.Component;

import java.util.ArrayList;
import java.util.List;

@Slf4j
@Component
@Primary
@RequiredArgsConstructor
public class GeminiTranslationClient implements AiTranslationClient {

    // private final RestTemplate restTemplate; or WebClient
    
    @Override
    public List<ScreenTranslationResult> translateScreen(String prompt) {
        log.info("Sending prompt to Gemini: {}", prompt);
        // Implementation for actual Gemini API call
        // 1. Build HTTP request
        // 2. Call Gemini API
        // 3. Parse JSON response into List<ScreenTranslationResult>
        return new ArrayList<>();
    }

    @Override
    public String auditScreen(String prompt) {
        log.info("Sending audit prompt to Gemini: {}", prompt);
        return "{}";
    }
}
