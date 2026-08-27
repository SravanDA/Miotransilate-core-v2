package com.miotranslate.playground;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.context.annotation.Profile;
import org.springframework.stereotype.Service;

import java.io.BufferedReader;
import java.io.FileReader;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.stream.Stream;

@Slf4j
@Service
@Profile("mock")
@RequiredArgsConstructor
public class CsvImporter {

    private final MockLsDataStore dataStore;

    private static final Map<String, String> PAGE_NAMES = Map.of(
            "SERSET", "Service Settings",
            "CUSINS", "Customer Insights",
            "CAMREW", "Campaign & Rewards",
            "POTSALESET", "POS / Sale Settings",
            "STAFFSET", "Staff Settings",
            "CUSWISH", "Customer Wishlist"
    );

    public void importTags() {
        Path tagsDir = Paths.get("tags");
        if (!Files.exists(tagsDir)) {
            tagsDir = Paths.get("../tags");
        }
        if (!Files.exists(tagsDir)) {
            tagsDir = Paths.get("../../tags");
        }
        if (!Files.exists(tagsDir)) {
            tagsDir = Paths.get("/Users/srvns/Desktop/miotransilate/tags");
        }
        if (!Files.exists(tagsDir)) {
            log.warn("Directory 'tags' does not exist, skipping import");
            return;
        }

        EnvironmentStore baseline = new EnvironmentStore();

        try (Stream<Path> paths = Files.list(tagsDir)) {
            paths.filter(p -> p.toString().endsWith(".csv"))
                 .forEach(path -> importCsv(path, baseline));
        } catch (IOException e) {
            log.error("Error reading tags directory", e);
        }

        dataStore.setBaseline(baseline);
        log.info("Baseline seeded with {} pages", baseline.getPages().size());
    }

    private void importCsv(Path csvPath, EnvironmentStore baseline) {
        log.info("Importing {}", csvPath.getFileName());
        try (BufferedReader br = new BufferedReader(new FileReader(csvPath.toFile()))) {
            String line = br.readLine(); // skip header
            if (line == null) return;

            while ((line = br.readLine()) != null) {
                // simple split by comma handling potential quotes
                String[] parts = line.split(",(?=(?:[^\"]*\"[^\"]*\")*[^\"]*$)", -1);
                if (parts.length < 3) continue;

                String pageId = parts[0].replaceAll("^\"|\"$", "").trim();
                String tagName = parts[1].replaceAll("^\"|\"$", "").trim();
                String englishText = parts[2].replaceAll("^\"|\"$", "").trim();

                if (pageId.isEmpty() || tagName.isEmpty()) continue;

                PageStore pageStore = baseline.getPages().computeIfAbsent(pageId, k -> 
                    PageStore.builder()
                        .pageId(pageId)
                        .pageName(PAGE_NAMES.getOrDefault(pageId, pageId))
                        .build()
                );

                Map<String, String> tagValues = pageStore.getTags().computeIfAbsent(tagName, k -> new ConcurrentHashMap<>());
                tagValues.put("eng", englishText);
            }
        } catch (Exception e) {
            log.error("Failed to parse CSV: {}", csvPath, e);
        }
    }
}
