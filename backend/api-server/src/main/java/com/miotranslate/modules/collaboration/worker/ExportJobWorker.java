package com.miotranslate.modules.collaboration.worker;

import com.miotranslate.modules.collaboration.model.ExportJob;
import com.miotranslate.modules.collaboration.repository.ExportJobRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.context.event.EventListener;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Component;

import java.time.OffsetDateTime;
import java.util.concurrent.TimeUnit;

@Component
public class ExportJobWorker {

    private static final Logger log = LoggerFactory.getLogger(ExportJobWorker.class);

    private final ExportJobRepository exportJobRepository;

    public ExportJobWorker(ExportJobRepository exportJobRepository) {
        this.exportJobRepository = exportJobRepository;
    }

    @Async
    @EventListener
    public void handleExportRequestedEvent(ExportRequestedEvent event) {
        log.info("Processing export job {}", event.getExportJobId());
        
        ExportJob job = exportJobRepository.findById(event.getExportJobId()).orElse(null);
        if (job == null) {
            log.warn("Export job {} not found", event.getExportJobId());
            return;
        }

        try {
            // Update status to PROCESSING
            job.setStatus("PROCESSING");
            exportJobRepository.save(job);
            
            // Simulate complex data extraction and formatting
            TimeUnit.SECONDS.sleep(1);
            
            job.setStatus("COMPLETED");
            job.setRowCount(150); // Mock value
            job.setDatasetCaptureAt(OffsetDateTime.now().minusSeconds(1));
            job.setGeneratedAt(OffsetDateTime.now());
            // Mock S3 URL
            job.setFileReferenceUrl("s3://miotranslate-exports/" + job.getFormat().toLowerCase() + "/export_" + job.getExportJobId() + "." + job.getFormat().toLowerCase());
            
            exportJobRepository.save(job);
            log.info("Export job {} completed successfully", event.getExportJobId());
            
        } catch (Exception e) {
            log.error("Failed to process export job {}", event.getExportJobId(), e);
            job.setStatus("FAILED");
            job.setFailureReason(e.getMessage());
            exportJobRepository.save(job);
        }
    }
}
