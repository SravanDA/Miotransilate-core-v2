package com.miotranslate.modules.publishing.api;

import com.miotranslate.modules.publishing.model.PublishingApprovalRequest;
import com.miotranslate.modules.publishing.model.Release;
import com.miotranslate.modules.publishing.service.PublishingService;
import com.miotranslate.shared.auth.SecurityUtils;
import com.miotranslate.shared.auth.RequiresPermission;
import org.springframework.http.HttpHeaders;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/v1")
@RequiresPermission("CONTENT_VIEW")
public class PublishingController {

    private final PublishingService publishingService;

    public PublishingController(PublishingService publishingService) {
        this.publishingService = publishingService;
    }

    @GetMapping("/pages/{pageId}/languages/{languageCode}/environments")
    public ResponseEntity<Map<String, Object>> getEnvironmentStatus(
            @PathVariable String pageId,
            @PathVariable String languageCode) {
        return ResponseEntity.ok(publishingService.getEnvironmentStatus(pageId, languageCode));
    }

    @GetMapping("/pages/{pageId}/languages/{languageCode}/environments/{environment}/preview")
    public ResponseEntity<Map<String, Object>> getPrePublishingSummary(
            @PathVariable String pageId,
            @PathVariable String languageCode,
            @PathVariable String environment) {
        return ResponseEntity.ok(publishingService.getPrePublishingSummary(pageId, languageCode, environment));
    }

    @PostMapping("/pages/{pageId}/languages/{languageCode}/environments/{environment}/publish")
    public ResponseEntity<Release> publishDirect(
            @PathVariable String pageId,
            @PathVariable String languageCode,
            @PathVariable String environment) {
            
        UUID userId = SecurityUtils.getCurrentUserId();
        Release release = publishingService.publishDirect(pageId, languageCode, environment, userId);
        return ResponseEntity.ok().body(release);
    }

    @PostMapping("/pages/{pageId}/languages/{languageCode}/environments/{environment}/approval-requests")
    public ResponseEntity<PublishingApprovalRequest> requestPublishingApproval(
            @PathVariable String pageId,
            @PathVariable String languageCode,
            @PathVariable String environment) {
            
        UUID userId = SecurityUtils.getCurrentUserId();
        PublishingApprovalRequest par = publishingService.requestPublishingApproval(pageId, languageCode, environment, userId);
        return ResponseEntity.ok().body(par);
    }

    @PostMapping("/approval-requests/{parId}/review")
    public ResponseEntity<PublishingApprovalRequest> reviewPublishingApproval(
            @PathVariable UUID parId,
            @RequestHeader(value = HttpHeaders.IF_MATCH, required = false) String ifMatch,
            @RequestBody Map<String, String> payload) {
            
        UUID userId = SecurityUtils.getCurrentUserId();
        String action = payload.getOrDefault("action", "APPROVE");
        
        PublishingApprovalRequest par = publishingService.reviewPublishingApproval(parId, ifMatch, action, userId);
        return ResponseEntity.ok().eTag(String.valueOf(par.getEtagVersion())).body(par);
    }

    @GetMapping("/pages/{pageId}/languages/{languageCode}/deployments")
    public ResponseEntity<List<Release>> getDeploymentHistory(
            @PathVariable String pageId,
            @PathVariable String languageCode) {
        return ResponseEntity.ok(publishingService.getDeploymentHistory(pageId, languageCode));
    }

    @PostMapping("/pages/{pageId}/languages/{languageCode}/environments/{environment}/rollback")
    @RequiresPermission("ROLLBACK")
    public ResponseEntity<Release> executeRollback(
            @PathVariable String pageId,
            @PathVariable String languageCode,
            @PathVariable String environment,
            @RequestBody Map<String, String> payload) {
            
        UUID userId = SecurityUtils.getCurrentUserId();
        UUID targetReleaseId = UUID.fromString(payload.get("targetReleaseId"));
        
        Release newRelease = publishingService.executeRollback(pageId, languageCode, environment, targetReleaseId, userId);
        return ResponseEntity.ok().body(newRelease);
    }
}
