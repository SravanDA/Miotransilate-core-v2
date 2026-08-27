package com.miotranslate.shared.job;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

@Component
public class ExportGenerationWorker {
    private static final Logger log = LoggerFactory.getLogger(ExportGenerationWorker.class);
    
    public void process(Object payload) {
        log.info("Running EXPORT_GENERATION for payload={}", payload);
        // Mocking the CSV/Excel generation and upload to Object Storage
    }
}
