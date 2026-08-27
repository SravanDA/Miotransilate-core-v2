package com.miotranslate.shared.integration.publishing;

import com.miotranslate.playground.MockLsDataStore;
import lombok.RequiredArgsConstructor;
import org.springframework.context.annotation.Profile;
import org.springframework.stereotype.Component;

import java.util.List;
import java.util.Map;
import java.util.concurrent.TimeUnit;

@Component
@Profile("mock")
@RequiredArgsConstructor
public class MockLanguageServicesClient implements LanguageServicesClient {

    private final MockLsDataStore mockLsDataStore;

    @Override
    public PushResult pushBundle(String pageId, String languageCode, String environment, Map<String, String> tags, List<String> removeTags) {
        try {
            // Simulate network latency (200ms) for local development
            TimeUnit.MILLISECONDS.sleep(200);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
        }
        
        // Upsert tags into mock data store. removeTags is intentionally ignored.
        mockLsDataStore.upsert(environment, pageId, languageCode, tags);

        // Mocking a successful response from Language Services
        String payload = String.format("{\"status\":\"SUCCESS\", \"processed_tags\":%d, \"env\":\"%s\"}", tags.size(), environment);
        
        return new PushResult(true, payload, 200);
    }
}
