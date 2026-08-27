package com.miotranslate.shared.job;

import com.miotranslate.modules.migration.model.ImportEvent;
import com.miotranslate.modules.migration.model.MigrationRowEvent;
import com.miotranslate.modules.migration.repository.ImportEventRepository;
import com.miotranslate.modules.migration.repository.MigrationRowEventRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.time.OffsetDateTime;
import java.util.UUID;

@Component
public class MigrationExecutionWorker {
    private static final Logger log = LoggerFactory.getLogger(MigrationExecutionWorker.class);
    
    private final ImportEventRepository importEventRepository;
    private final MigrationRowEventRepository migrationRowEventRepository;

    public MigrationExecutionWorker(ImportEventRepository importEventRepository,
                                    MigrationRowEventRepository migrationRowEventRepository) {
        this.importEventRepository = importEventRepository;
        this.migrationRowEventRepository = migrationRowEventRepository;
    }

    public void process(Object payload) {
        UUID importEventId = (UUID) payload;
        log.info("Running MIGRATION_EXECUTION for importEventId={}", importEventId);
        
        ImportEvent importEvent = importEventRepository.findById(importEventId).orElse(null);
        if (importEvent == null) {
            log.warn("ImportEvent {} not found", importEventId);
            return;
        }

        try {
            importEvent.setProcessingStartedAt(OffsetDateTime.now());
            importEventRepository.save(importEvent);
            
            // Simulating page-by-page transaction loop
            simulatePageMigration(importEvent);
            
            importEvent.setStatus("COMPLETED");
            importEvent.setCompletedAt(OffsetDateTime.now());
            importEvent.setValidationReport("{\"status\":\"VALID\"}");
            
            importEventRepository.save(importEvent);
            log.info("Migration event {} completed successfully", importEventId);
            
        } catch (Exception e) {
            log.error("Failed to process migration event {}", importEventId, e);
            importEvent.setStatus("FAILED");
            importEvent.setErrorSummary(e.getMessage());
            importEventRepository.save(importEvent);
        }
    }

    @Transactional
    protected void simulatePageMigration(ImportEvent importEvent) {
        // Simulate 5 rows being processed as a single transaction block for one page
        for (int i = 1; i <= 5; i++) {
            MigrationRowEvent row = new MigrationRowEvent();
            row.setImportEventId(importEvent.getImportEventId());
            row.setSourceRowNumber(i);
            
            if (i % 2 != 0) {
                row.setEventType("IMPORTED");
                row.setReasonCode("SUCCESS");
                
                // MOCK: Insert English Copy (APPROVED)
                // MOCK: Insert Translation (APPROVED)
                // MOCK: Insert Release (SUCCESSFUL) for DEV, QA, PROD with trigger_source = MIGRATION
                
                importEvent.setTranslationsImported(importEvent.getTranslationsImported() + 1);
            } else {
                row.setEventType("SKIPPED");
                row.setReasonCode("TAG_ALREADY_EXISTS");
            }
            migrationRowEventRepository.save(row);
        }
    }
}
