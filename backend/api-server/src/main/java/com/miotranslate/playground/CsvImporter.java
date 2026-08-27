package com.miotranslate.playground;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.context.annotation.Profile;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.io.BufferedReader;
import java.io.FileReader;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.HashSet;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;
import java.util.stream.Stream;

@Slf4j
@Service
@Profile("mock")
@RequiredArgsConstructor
public class CsvImporter {

    private final MockLsDataStore dataStore;
    private final JdbcTemplate jdbcTemplate;

    public static final Map<String, String> PAGE_NAMES = Map.of(
            "SERSET", "Service Settings",
            "CUSINS", "Customer Insights",
            "CAMREW", "Campaign & Rewards",
            "POTSALESET", "POS / Sale Settings",
            "STAFFSET", "Staff Settings",
            "CUSWISH", "Customer Wishlist"
    );

    private static final String[] DEFAULT_LANGUAGES = {"ar", "es", "tr", "bg", "it", "fr", "de", "arabic", "spanish"};

    @Transactional
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
        log.info("Baseline seeded with {} pages into MockLsDataStore and database", baseline.getPages().size());
    }

    public void importCsv(Path csvPath, EnvironmentStore baseline) {
        log.info("Importing CSV: {}", csvPath.getFileName());
        Set<String> createdPages = new HashSet<>();

        try (BufferedReader br = new BufferedReader(new FileReader(csvPath.toFile()))) {
            String line = br.readLine(); // skip header
            if (line == null) return;

            while ((line = br.readLine()) != null) {
                String[] parts = line.split(",(?=(?:[^\"]*\"[^\"]*\")*[^\"]*$)", -1);
                if (parts.length < 3) continue;

                String pageId = parts[0].replaceAll("^\"|\"$", "").trim().toUpperCase();
                String tagName = parts[1].replaceAll("^\"|\"$", "").trim();
                String englishText = parts[2].replaceAll("^\"|\"$", "").trim();

                if (pageId.isEmpty() || tagName.isEmpty()) continue;

                String pageName = PAGE_NAMES.getOrDefault(pageId, pageId + " Module");

                // 1. In-memory MockLsDataStore (for playground)
                if (baseline != null) {
                    PageStore pageStore = baseline.getPages().computeIfAbsent(pageId, k -> 
                        PageStore.builder()
                            .pageId(pageId)
                            .pageName(pageName)
                            .build()
                    );

                    Map<String, String> tagValues = pageStore.getTags().computeIfAbsent(tagName, k -> new ConcurrentHashMap<>());
                    tagValues.put("eng", englishText);
                }

                // 2. Database persistence (for MioTranslate core platform)
                try {
                    // Page
                    if (!createdPages.contains(pageId)) {
                        jdbcTemplate.update(
                            "MERGE INTO registry.pages (page_id, page_name, module, status, etag_version, created_by, created_at, updated_at) " +
                            "KEY(page_id) VALUES (?, ?, ?, 'ACTIVE', 1, '11111111-1111-1111-1111-111111111111', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)",
                            pageId, pageName, pageName
                        );
                        createdPages.add(pageId);
                    }

                    // Tag
                    jdbcTemplate.update(
                        "MERGE INTO registry.tags (tag_id, page_id, copy_type, status, etag_version, created_by, created_at, updated_at) " +
                        "KEY(tag_id) VALUES (?, ?, 'General', 'ACTIVE', 1, '11111111-1111-1111-1111-111111111111', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)",
                        tagName, pageId
                    );

                    // English copy
                    jdbcTemplate.update(
                        "MERGE INTO content.english_copies (tag_id, status, current_version_number, etag_version, created_at, updated_at) " +
                        "KEY(tag_id) VALUES (?, 'APPROVED', 1, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)",
                        tagName
                    );

                    // English copy version
                    jdbcTemplate.update(
                        "MERGE INTO content.english_copy_versions (tag_id, version_number, text, change_reason, authored_by, authored_at, status, escalated_to_founder, created_at) " +
                        "KEY(tag_id, version_number) VALUES (?, 1, ?, 'Initial CSV Import', '11111111-1111-1111-1111-111111111111', CURRENT_TIMESTAMP, 'APPROVED', false, CURRENT_TIMESTAMP)",
                        tagName, englishText
                    );

                    // Initialize translation slots for active languages
                    for (String lang : DEFAULT_LANGUAGES) {
                        jdbcTemplate.update(
                            "MERGE INTO translation.translations (tag_id, language_code, status, current_version_number, etag_version, created_at, updated_at) " +
                            "KEY(tag_id, language_code) VALUES (?, ?, 'NO_TRANSLATION', null, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)",
                            tagName, lang
                        );
                    }
                } catch (Exception e) {
                    log.debug("DB insert for {}/{}: {}", pageId, tagName, e.getMessage());
                }
            }
        } catch (Exception e) {
            log.error("Failed to parse CSV: {}", csvPath, e);
        }
    }
}
