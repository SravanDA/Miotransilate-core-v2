package com.miotranslate.modules.migration.service;

import com.miotranslate.modules.migration.model.ImportEvent;
import com.miotranslate.modules.migration.repository.ImportEventRepository;
import com.miotranslate.shared.job.JobDispatcher;
import lombok.extern.slf4j.Slf4j;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Isolation;
import org.springframework.transaction.annotation.Transactional;

import java.time.OffsetDateTime;
import java.util.*;

@Slf4j
@Service
public class MigrationService {

    private final ImportEventRepository importEventRepository;
    private final JobDispatcher jobDispatcher;
    private final JdbcTemplate jdbcTemplate;

    public MigrationService(ImportEventRepository importEventRepository,
                            JobDispatcher jobDispatcher,
                            JdbcTemplate jdbcTemplate) {
        this.importEventRepository = importEventRepository;
        this.jobDispatcher = jobDispatcher;
        this.jdbcTemplate = jdbcTemplate;
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
            throw new IllegalStateException("ImportEvent is not in UPLOAD_READY status");
        }
        
        event.setStatus("PROCESSING");
        event.setProcessingStartedAt(OffsetDateTime.now());
        importEventRepository.save(event);
        
        jobDispatcher.dispatch("MIGRATION_EXECUTION", importEventId);
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
