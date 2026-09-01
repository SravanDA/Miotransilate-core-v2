package com.miotranslate.modules.migration.service;

import com.miotranslate.modules.migration.model.ImportEvent;
import com.miotranslate.modules.migration.repository.ImportEventRepository;
import com.miotranslate.playground.CsvImporter;
import com.miotranslate.playground.EnvironmentStore;
import com.miotranslate.playground.MockLsDataStore;
import com.miotranslate.playground.PageStore;
import com.miotranslate.shared.job.JobDispatcher;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Isolation;
import org.springframework.transaction.annotation.Transactional;

import java.time.OffsetDateTime;
import java.util.*;
import java.util.concurrent.atomic.AtomicInteger;

@Slf4j
@Service
public class MigrationService {

    private final ImportEventRepository importEventRepository;
    private final JobDispatcher jobDispatcher;
    private final JdbcTemplate jdbcTemplate;
    private final ObjectProvider<CsvImporter> csvImporterProvider;
    private final ObjectProvider<MockLsDataStore> mockLsDataStoreProvider;

    private static final UUID SYSTEM_USER_ID = UUID.fromString("11111111-1111-1111-1111-111111111111");
    private static final String[] DEFAULT_LANGUAGES = {"ar", "es", "tr", "bg", "it", "fr", "de", "arabic", "spanish"};

    public MigrationService(ImportEventRepository importEventRepository,
                            JobDispatcher jobDispatcher,
                            JdbcTemplate jdbcTemplate,
                            ObjectProvider<CsvImporter> csvImporterProvider,
                            ObjectProvider<MockLsDataStore> mockLsDataStoreProvider) {
        this.importEventRepository = importEventRepository;
        this.jobDispatcher = jobDispatcher;
        this.jdbcTemplate = jdbcTemplate;
        this.csvImporterProvider = csvImporterProvider;
        this.mockLsDataStoreProvider = mockLsDataStoreProvider;
    }

    @Transactional(isolation = Isolation.READ_COMMITTED)
    public ImportEvent uploadImportFile(String filename, Long sizeBytes, UUID initiatedBy) {
        ImportEvent event = new ImportEvent();
        event.setOriginalFilename(filename);
        event.setFileSizeBytes(sizeBytes);
        event.setInitiatedBy(initiatedBy);
        event.setStatus("UPLOAD_READY");
        return importEventRepository.save(event);
    }

    @Transactional(isolation = Isolation.READ_COMMITTED)
    public void executeMigrationImport(UUID importEventId) {
        ImportEvent event = importEventRepository.findById(importEventId)
                .orElseThrow(() -> new IllegalArgumentException("ImportEvent not found"));
                
        if (!"UPLOAD_READY".equals(event.getStatus())) {
            throw new IllegalStateException("Migration can only be executed when UPLOAD_READY");
        }
        
        event.setStatus("PROCESSING");
        importEventRepository.save(event);
        
        jobDispatcher.dispatch("MIGRATION_EXECUTION", importEventId);
    }

    /**
     * Migrates all pages and tags from Mock Language Services / tags directory into MioTranslate DB.
     */
    @Transactional
    public Map<String, Object> syncFromMockLs() {
        log.info("Starting synchronization from Mock Language Services to MioTranslate DB...");
        
        CsvImporter csvImporter = csvImporterProvider.getIfAvailable();
        if (csvImporter != null) {
            csvImporter.importTags();
        }

        MockLsDataStore dataStore = mockLsDataStoreProvider.getIfAvailable();
        EnvironmentStore baseline = dataStore != null ? dataStore.getBaseline() : null;

        AtomicInteger pagesCount = new AtomicInteger(0);
        AtomicInteger tagsCount = new AtomicInteger(0);
        List<String> migratedPageIds = new ArrayList<>();

        if (baseline != null && !baseline.getPages().isEmpty()) {
            for (Map.Entry<String, PageStore> pageEntry : baseline.getPages().entrySet()) {
                String pageId = pageEntry.getKey();
                PageStore pageStore = pageEntry.getValue();
                String pageName = pageStore.getPageName() != null ? pageStore.getPageName() : CsvImporter.PAGE_NAMES.getOrDefault(pageId, pageId + " Module");

                jdbcTemplate.update(
                    "MERGE INTO registry.pages (page_id, page_name, module, status, etag_version, created_by, created_at, updated_at) " +
                    "KEY(page_id) VALUES (?, ?, ?, 'ACTIVE', 1, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)",
                    pageId, pageName, pageName, SYSTEM_USER_ID
                );
                pagesCount.incrementAndGet();
                migratedPageIds.add(pageId);

                if (pageStore.getTags() != null) {
                    for (Map.Entry<String, Map<String, String>> tagEntry : pageStore.getTags().entrySet()) {
                        String tagName = tagEntry.getKey();
                        Map<String, String> langValues = tagEntry.getValue();
                        String englishText = langValues != null ? langValues.getOrDefault("eng", "") : "";

                        jdbcTemplate.update(
                            "MERGE INTO registry.tags (tag_id, page_id, copy_type, status, etag_version, created_by, created_at, updated_at) " +
                            "KEY(tag_id) VALUES (?, ?, 'General', 'ACTIVE', 1, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)",
                            tagName, pageId, SYSTEM_USER_ID
                        );

                        jdbcTemplate.update(
                            "MERGE INTO content.english_copies (tag_id, status, current_version_number, etag_version, created_at, updated_at) " +
                            "KEY(tag_id) VALUES (?, 'APPROVED', 1, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)",
                            tagName
                        );

                        jdbcTemplate.update(
                            "MERGE INTO content.english_copy_versions (tag_id, version_number, text, change_reason, authored_by, authored_at, status, escalated_to_founder, created_at) " +
                            "KEY(tag_id, version_number) VALUES (?, 1, ?, 'Mock LS Migration', ?, CURRENT_TIMESTAMP, 'APPROVED', false, CURRENT_TIMESTAMP)",
                            tagName, englishText, SYSTEM_USER_ID
                        );

                        for (String lang : DEFAULT_LANGUAGES) {
                            String transVal = langValues != null ? langValues.get(lang) : null;
                            if (transVal != null && !transVal.isBlank()) {
                                jdbcTemplate.update(
                                    "MERGE INTO translation.translations (tag_id, language_code, status, current_version_number, etag_version, created_at, updated_at) " +
                                    "KEY(tag_id, language_code) VALUES (?, ?, 'APPROVED', 1, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)",
                                    tagName, lang
                                );
                                jdbcTemplate.update(
                                    "MERGE INTO translation.translation_versions (tag_id, language_code, version_number, text, creation_method, source_english_version, confidence_score, variable_integrity_status, authored_by, status, created_at) " +
                                    "KEY(tag_id, language_code, version_number) VALUES (?, ?, 1, ?, 'HUMAN', 1, 1.00, 'VALID', ?, 'APPROVED', CURRENT_TIMESTAMP)",
                                    tagName, lang, transVal, SYSTEM_USER_ID
                                );
                            } else {
                                jdbcTemplate.update(
                                    "MERGE INTO translation.translations (tag_id, language_code, status, current_version_number, etag_version, created_at, updated_at) " +
                                    "KEY(tag_id, language_code) VALUES (?, ?, 'NO_TRANSLATION', null, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)",
                                    tagName, lang
                                );
                            }
                        }

                        tagsCount.incrementAndGet();
                    }
                }
            }
        }

        ImportEvent syncEvent = new ImportEvent();
        syncEvent.setOriginalFilename("MOCK_LS_SYNC");
        syncEvent.setFileSizeBytes(0L);
        syncEvent.setInitiatedBy(SYSTEM_USER_ID);
        syncEvent.setExecutedBy(SYSTEM_USER_ID);
        syncEvent.setStatus("COMPLETED");
        syncEvent.setPagesAttempted(pagesCount.get());
        syncEvent.setPagesSucceeded(pagesCount.get());
        syncEvent.setTagsImported(tagsCount.get());
        syncEvent.setProcessingStartedAt(OffsetDateTime.now());
        syncEvent.setCompletedAt(OffsetDateTime.now());
        syncEvent.setValidationReport(String.format("{\"migratedPages\":%d,\"migratedTags\":%d}", pagesCount.get(), tagsCount.get()));
        importEventRepository.save(syncEvent);

        OffsetDateTime now = OffsetDateTime.now();
        log.info("Mock LS migration finished: {} pages, {} tags migrated", pagesCount.get(), tagsCount.get());

        Map<String, Object> response = new HashMap<>();
        response.put("status", "SUCCESS");
        response.put("pagesMigrated", pagesCount.get());
        response.put("tagsMigrated", tagsCount.get());
        response.put("pageIds", migratedPageIds);
        response.put("lastMigrationAt", now.toString());
        response.put("message", String.format("Successfully migrated %d tags across %d pages from Mock LS to MioTranslate DB.", tagsCount.get(), pagesCount.get()));
        return response;
    }

    /**
     * Returns the status and timestamp of the last Mock LS migration.
     */
    @Transactional(readOnly = true)
    public Map<String, Object> getMockLsSyncStatus() {
        Optional<ImportEvent> lastEvent = importEventRepository.findTopByOriginalFilenameOrderByCreatedAtDesc("MOCK_LS_SYNC");
        
        Map<String, Object> response = new HashMap<>();
        if (lastEvent.isPresent()) {
            ImportEvent event = lastEvent.get();
            response.put("hasMigrated", true);
            response.put("status", event.getStatus());
            response.put("lastMigrationAt", event.getCompletedAt() != null ? event.getCompletedAt().toString() : event.getCreatedAt().toString());
            response.put("pagesMigrated", event.getPagesSucceeded());
            response.put("tagsMigrated", event.getTagsImported());
        } else {
            response.put("hasMigrated", false);
            response.put("lastMigrationAt", null);
            response.put("pagesMigrated", 0);
            response.put("tagsMigrated", 0);
        }
        return response;
    }

    /**
     * Deletes all migrated data from the database (pages, tags, English copy, translations, releases).
     */
    @Transactional
    public Map<String, Object> deleteAllMigratedData() {
        log.info("Deleting all migrated data from MioTranslate database...");
        
        try {
            jdbcTemplate.update("DELETE FROM migration.migration_row_events");
            jdbcTemplate.update("DELETE FROM migration.import_events");
            jdbcTemplate.update("DELETE FROM translation.translation_versions");
            jdbcTemplate.update("DELETE FROM translation.translations");
            jdbcTemplate.update("DELETE FROM content.english_copy_versions");
            jdbcTemplate.update("DELETE FROM content.english_copies");
            jdbcTemplate.update("DELETE FROM publishing.release_content_snapshots");
            jdbcTemplate.update("DELETE FROM publishing.releases");
            jdbcTemplate.update("DELETE FROM publishing.publishing_approval_requests");
            jdbcTemplate.update("DELETE FROM registry.tags");
            jdbcTemplate.update("DELETE FROM registry.pages");
        } catch (Exception e) {
            log.warn("Error during table cleanup: {}", e.getMessage());
        }

        Map<String, Object> response = new HashMap<>();
        response.put("status", "SUCCESS");
        response.put("message", "All migrated pages, tags, and translation copies deleted successfully from database.");
        return response;
    }
}
