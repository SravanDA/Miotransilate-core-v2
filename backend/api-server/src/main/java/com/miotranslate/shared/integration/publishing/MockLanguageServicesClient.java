package com.miotranslate.shared.integration.publishing;

import lombok.extern.slf4j.Slf4j;
import org.springframework.context.annotation.Profile;
import org.springframework.stereotype.Component;

import java.util.List;
import java.util.Map;
import java.util.concurrent.TimeUnit;

@Slf4j
@Component
@Profile("mock")
public class MockLanguageServicesClient implements LanguageServicesClient {

    @Override
    public PushResult pushBundle(String pageId, String languageCode, String environment, Map<String, String> tags, List<String> removeTags) {
        try {
            // Simulate network latency (200ms) for local development
            TimeUnit.MILLISECONDS.sleep(200);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
        }
        
        log.info("Published bundle for page={}, lang={}, env={}, tagsCount={}", pageId, languageCode, environment, tags.size());

        // Mocking a successful response from Language Services
        String payload = String.format("{\"status\":\"SUCCESS\", \"processed_tags\":%d, \"env\":\"%s\"}", tags.size(), environment);
        
        return new PushResult(true, payload, 200);
    }
}
