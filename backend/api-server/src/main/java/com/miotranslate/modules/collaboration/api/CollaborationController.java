package com.miotranslate.modules.collaboration.api;

import com.miotranslate.modules.collaboration.api.dto.CommentDto;
import com.miotranslate.modules.collaboration.api.dto.EscalatedItemDto;
import com.miotranslate.modules.collaboration.api.dto.ScopeDto;
import com.miotranslate.modules.collaboration.model.ExportJob;
import com.miotranslate.modules.collaboration.service.CollaborationService;
import com.miotranslate.shared.auth.RequiresPermission;
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

    public static class AddCommentRequest {
        public String text;
        public ScopeDto scope;
        public boolean isEscalation;
        public String escalationReason;
        public String parentCommentId;
    }

    @PostMapping("/tags/{tagId}/comments")
    @RequiresPermission("COMMENT_CREATE")
    public ResponseEntity<CommentDto> addComment(
            @PathVariable String tagId,
            @RequestBody AddCommentRequest payload) {
        UUID authorId = SecurityUtils.getCurrentUserId();
        UUID parentId = payload.parentCommentId != null ? UUID.fromString(payload.parentCommentId) : null;
        return ResponseEntity.ok(collaborationService.addComment(
            tagId, payload.text, payload.scope, payload.isEscalation, payload.escalationReason, parentId, authorId));
    }

    @GetMapping("/tags/{tagId}/comments")
    @RequiresPermission("CONTENT_VIEW")
    public ResponseEntity<List<CommentDto>> getComments(
            @PathVariable String tagId,
            @RequestParam(required = false) String scope,
            @RequestParam(required = false) Boolean resolved) {
        return ResponseEntity.ok(collaborationService.getComments(tagId, scope, resolved));
    }

    @PatchMapping("/tags/{tagId}/comments/{commentId}/resolve")
    @RequiresPermission("COMMENT_CREATE")
    public ResponseEntity<CommentDto> resolveComment(
            @PathVariable String tagId,
            @PathVariable String commentId) {
        UUID resolvedBy = SecurityUtils.getCurrentUserId();
        return ResponseEntity.ok(collaborationService.resolveComment(tagId, commentId, resolvedBy));
    }

    @PatchMapping("/tags/{tagId}/comments/{commentId}/unresolve")
    @RequiresPermission("COMMENT_CREATE")
    public ResponseEntity<CommentDto> unresolveComment(
            @PathVariable String tagId,
            @PathVariable String commentId) {
        UUID userId = SecurityUtils.getCurrentUserId();
        return ResponseEntity.ok(collaborationService.unresolveComment(tagId, commentId, userId));
    }

    @GetMapping("/escalations")
    @RequiresPermission("CONTENT_VIEW")
    public ResponseEntity<List<EscalatedItemDto>> getEscalatedItems() {
        return ResponseEntity.ok(collaborationService.getEscalatedItems());
    }

    @GetMapping("/audit")
    @RequiresPermission("AUDIT_VIEW")
    public ResponseEntity<List<Map<String, Object>>> getAuditTrail() {
        return ResponseEntity.ok(collaborationService.getAuditTrail());
    }

    @PostMapping("/exports")
    @RequiresPermission("EXPORT")
    public ResponseEntity<ExportJob> requestExport(@RequestBody Map<String, String> payload) {
        UUID requestedBy = SecurityUtils.getCurrentUserId();
        String pageId = payload.get("pageId");
        String languageCode = payload.get("languageCode");
        
        return ResponseEntity.ok(collaborationService.requestExport(pageId, languageCode, requestedBy));
    }

    @GetMapping("/exports/{id}")
    @RequiresPermission("EXPORT")
    public ResponseEntity<ExportJob> getExportStatus(@PathVariable UUID id) {
        return ResponseEntity.ok(collaborationService.getExportStatus(id));
    }

    @GetMapping("/exports/{id}/download")
    @RequiresPermission("EXPORT")
    public ResponseEntity<Map<String, String>> getExportDownloadUrl(@PathVariable UUID id) {
        String url = collaborationService.getExportDownloadUrl(id);
        return ResponseEntity.ok(Map.of("downloadUrl", url));
    }

    @GetMapping("/notifications")
    @RequiresPermission("CONTENT_VIEW")
    public ResponseEntity<List<Map<String, Object>>> getNotifications() {
        UUID userId = SecurityUtils.getCurrentUserId();
        return ResponseEntity.ok(collaborationService.getNotifications(userId));
    }

    @PatchMapping("/notifications/read")
    @RequiresPermission("CONTENT_VIEW")
    public ResponseEntity<Void> markNotificationsAsRead(@RequestBody Map<String, List<UUID>> payload) {
        UUID userId = SecurityUtils.getCurrentUserId();
        List<UUID> notificationIds = payload.get("notificationIds");
        collaborationService.markNotificationsAsRead(userId, notificationIds);
        return ResponseEntity.noContent().build();
    }
}
