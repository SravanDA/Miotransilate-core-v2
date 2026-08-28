package com.miotranslate.playground;

import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.extern.slf4j.Slf4j;
import org.springframework.context.annotation.Profile;
import org.springframework.stereotype.Component;

import java.io.File;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

@Slf4j
@Component
@Profile("mock")
public class MockLsDataStore {

    private final Map<String, EnvironmentStore> environments = new ConcurrentHashMap<>();
    private EnvironmentStore baseline = new EnvironmentStore();
    private final ObjectMapper objectMapper = new ObjectMapper();
    private final Path dataDir = Paths.get("playground-data");

    public MockLsDataStore() {
        try {
            Files.createDirectories(dataDir);
        } catch (IOException e) {
            log.error("Failed to create playground-data directory", e);
        }
    }

    public void setBaseline(EnvironmentStore baseline) {
        this.baseline = baseline;
        saveBaseline();
        // Initialize environments if they don't exist yet
        for (String env : new String[]{"DEV", "QA", "PRODUCTION", "MOCK"}) {
            environments.put(env, loadEnvironment(env, baseline));
        }
    }

    public void upsert(String environment, String pageId, String languageCode, Map<String, String> incomingTags) {
        EnvironmentStore envStore = environments.computeIfAbsent(environment, k -> new EnvironmentStore(baseline));
        PageStore pageStore = envStore.getPages().computeIfAbsent(pageId, k -> PageStore.builder().pageId(pageId).pageName(pageId).build());

        incomingTags.forEach((tagName, text) -> {
            Map<String, String> tagValues = pageStore.getTags().computeIfAbsent(tagName, k -> new ConcurrentHashMap<>());
            tagValues.put(languageCode, text);
        });

        saveEnvironment(environment, envStore);
    }

    public EnvironmentStore getEnvironment(String environment) {
        return environments.getOrDefault(environment, new EnvironmentStore(baseline));
    }

    public EnvironmentStore getBaseline() {
        return baseline;
    }

    public void resetEnvironment(String environment) {
        EnvironmentStore newEnvStore = new EnvironmentStore(baseline);
        environments.put(environment, newEnvStore);
        saveEnvironment(environment, newEnvStore);
    }

    public void resetPage(String environment, String pageId) {
        EnvironmentStore envStore = environments.get(environment);
        if (envStore != null) {
            PageStore baselinePage = baseline.getPages().get(pageId);
            if (baselinePage != null) {
                envStore.getPages().put(pageId, new PageStore(baselinePage));
            } else {
                envStore.getPages().remove(pageId);
            }
            saveEnvironment(environment, envStore);
        }
    }

    private void saveBaseline() {
        try {
            objectMapper.writeValue(new File(dataDir.toFile(), "baseline.json"), baseline);
        } catch (IOException e) {
            log.error("Failed to save baseline.json", e);
        }
    }

    private void saveEnvironment(String env, EnvironmentStore store) {
        try {
            objectMapper.writeValue(new File(dataDir.toFile(), env + ".json"), store);
        } catch (IOException e) {
            log.error("Failed to save {}.json", env, e);
        }
    }

    private EnvironmentStore loadEnvironment(String env, EnvironmentStore fallback) {
        File file = new File(dataDir.toFile(), env + ".json");
        if (file.exists()) {
            try {
                return objectMapper.readValue(file, EnvironmentStore.class);
            } catch (IOException e) {
                log.error("Failed to load {}.json, using fallback", env, e);
            }
        }
        return new EnvironmentStore(fallback);
    }
}
