package com.miotranslate.modules.collaboration.api;

import com.miotranslate.modules.collaboration.model.Comment;
import com.miotranslate.modules.collaboration.model.ExportJob;
import com.miotranslate.modules.collaboration.service.CollaborationService;
import com.miotranslate.shared.auth.SecurityUtils;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/v1")
public class CollaborationController {

    private final CollaborationService collaborationService;

    public CollaborationController(CollaborationService collaborationService) {
        this.collaborationService = collaborationService;
    }

    @PostMapping("/tags/{tagId}/comments")
    public ResponseEntity<Comment> addComment(
            @PathVariable String tagId,
            @RequestBody Map<String, String> payload) {
        UUID authorId = SecurityUtils.getCurrentUserId();
        String body = payload.get("body");
        String scope = payload.get("scope");
        
        return ResponseEntity.ok(collaborationService.addComment(tagId, body, scope, authorId));
    }

    @GetMapping("/tags/{tagId}/comments")
    public ResponseEntity<List<Comment>> getComments(
            @PathVariable String tagId,
            @RequestParam(required = false) String scope) {
        return ResponseEntity.ok(collaborationService.getComments(tagId, scope));
    }

    @PatchMapping("/comments/{commentId}/resolve")
    public ResponseEntity<Comment> resolveComment(@PathVariable UUID commentId) {
        UUID resolvedBy = SecurityUtils.getCurrentUserId();
        return ResponseEntity.ok(collaborationService.resolveComment(commentId, resolvedBy));
    }

    @GetMapping("/audit")
    public ResponseEntity<List<Map<String, Object>>> getAuditTrail() {
        return ResponseEntity.ok(collaborationService.getAuditTrail());
    }

    @PostMapping("/exports")
    public ResponseEntity<ExportJob> requestExport(@RequestBody Map<String, String> payload) {
        UUID requestedBy = SecurityUtils.getCurrentUserId();
        String pageId = payload.get("pageId");
        String languageCode = payload.get("languageCode");
        
        return ResponseEntity.ok(collaborationService.requestExport(pageId, languageCode, requestedBy));
    }

    @GetMapping("/exports/{id}")
    public ResponseEntity<ExportJob> getExportStatus(@PathVariable UUID id) {
        return ResponseEntity.ok(collaborationService.getExportStatus(id));
    }

    @GetMapping("/exports/{id}/download")
    public ResponseEntity<Map<String, String>> getExportDownloadUrl(@PathVariable UUID id) {
        String url = collaborationService.getExportDownloadUrl(id);
        return ResponseEntity.ok(Map.of("downloadUrl", url));
    }

    @GetMapping("/notifications")
    public ResponseEntity<List<Map<String, Object>>> getNotifications() {
        UUID userId = SecurityUtils.getCurrentUserId();
        return ResponseEntity.ok(collaborationService.getNotifications(userId));
    }

    @PatchMapping("/notifications/read")
    public ResponseEntity<Void> markNotificationsAsRead(@RequestBody Map<String, List<UUID>> payload) {
        UUID userId = SecurityUtils.getCurrentUserId();
        List<UUID> notificationIds = payload.get("notificationIds");
        collaborationService.markNotificationsAsRead(userId, notificationIds);
        return ResponseEntity.noContent().build();
    }
}
