package com.miotranslate.shared.job;

import com.miotranslate.modules.publishing.model.PublishingApprovalRequest;
import com.miotranslate.modules.publishing.service.PublishingService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

import java.util.UUID;

@Component
public class ImplicitDevPublishWorker {
    private static final Logger log = LoggerFactory.getLogger(ImplicitDevPublishWorker.class);
    
    private final PublishingService publishingService;

    public ImplicitDevPublishWorker(PublishingService publishingService) {
        this.publishingService = publishingService;
    }

    public void process(Object payload) {
        String tagId = (String) payload;
        log.info("Running IMPLICIT_DEV_PUBLISH triggered by tagId={}", tagId);
        
        // Simulating the worker creating a request and executing it for DEV
        // To be strictly correct, we need the pageId and languageCode, but since payload is just tagId for now, we mock it.
        try {
            UUID systemId = UUID.fromString("00000000-0000-0000-0000-000000000000");
            PublishingApprovalRequest par = publishingService.requestPublishingApproval("mockPageId", "es", "DEV", systemId);
            publishingService.reviewPublishingApproval(par.getApprovalRequestId(), String.valueOf(par.getEtagVersion()), "APPROVE", systemId);
        } catch (Exception e) {
            log.warn("Mock execution of implicit dev publish failed/skipped (expected if missing data): {}", e.getMessage());
        }
    }
}
