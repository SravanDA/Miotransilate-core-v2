package com.miotranslate.shared.job;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

@Component
public class CoverageRecalcWorker {
    private static final Logger log = LoggerFactory.getLogger(CoverageRecalcWorker.class);
    
    public void process(Object payload) {
        log.info("Running COVERAGE_RECALC for payload={}", payload);
        // Mocking the UPSERT into reporting.coverage_metrics
    }
}
