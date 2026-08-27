package com.miotranslate.modules.migration.service;

import com.miotranslate.modules.migration.model.ImportEvent;
import com.miotranslate.modules.migration.repository.ImportEventRepository;
import com.miotranslate.shared.job.JobDispatcher;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Isolation;
import org.springframework.transaction.annotation.Transactional;

import java.time.OffsetDateTime;
import java.util.UUID;

@Service
public class MigrationService {

    private final ImportEventRepository importEventRepository;
    private final JobDispatcher jobDispatcher;

    public MigrationService(ImportEventRepository importEventRepository,
                            JobDispatcher jobDispatcher) {
        this.importEventRepository = importEventRepository;
        this.jobDispatcher = jobDispatcher;
    }

    @Transactional(isolation = Isolation.READ_COMMITTED)
    public ImportEvent uploadImportFile(String filename, Long sizeBytes, UUID initiatedBy) {
        
        ImportEvent event = new ImportEvent();
        event.setOriginalFilename(filename);
        event.setFileSizeBytes(sizeBytes);
        event.setInitiatedBy(initiatedBy);
        event.setStatus("UPLOAD_READY");
        // event.setFileExpiresAt(OffsetDateTime.now().plusDays(1));
        
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
        
        // Dispatch job to be picked up by JobEventListener (Phase 5 framework)
        jobDispatcher.dispatch("MIGRATION_EXECUTION", importEventId);
    }
}
