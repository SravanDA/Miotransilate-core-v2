package com.miotranslate.modules.collaboration.service;

import com.miotranslate.modules.collaboration.model.Comment;
import com.miotranslate.modules.collaboration.model.ExportJob;
import com.miotranslate.modules.collaboration.repository.CommentRepository;
import com.miotranslate.modules.collaboration.repository.ExportJobRepository;
import com.miotranslate.shared.job.JobDispatcher;
import org.springframework.stereotype.Service;

import java.time.OffsetDateTime;
import java.util.Collections;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@Service
public class CollaborationService {

    private final CommentRepository commentRepository;
    private final ExportJobRepository exportJobRepository;
    private final JobDispatcher jobDispatcher;

    public CollaborationService(CommentRepository commentRepository, 
                                ExportJobRepository exportJobRepository,
                                JobDispatcher jobDispatcher) {
        this.commentRepository = commentRepository;
        this.exportJobRepository = exportJobRepository;
        this.jobDispatcher = jobDispatcher;
    }

    public Comment addComment(String tagId, String body, String scope, UUID authorId) {
        Comment comment = new Comment();
        comment.setTagId(tagId);
        comment.setCommentText(body);
        comment.setCommentScope(scope);
        comment.setAuthorId(authorId);
        comment.setCreatedAt(OffsetDateTime.now());
        return commentRepository.save(comment);
    }

    public List<Comment> getComments(String tagId, String scope) {
        return commentRepository.findAll().stream()
                .filter(c -> c.getTagId().equals(tagId))
                .filter(c -> scope == null || scope.equals(c.getCommentScope()))
                .toList();
    }

    public Comment resolveComment(UUID commentId, UUID resolvedBy) {
        Comment comment = commentRepository.findById(commentId)
                .orElseThrow(() -> new IllegalArgumentException("Comment not found"));
        comment.setResolvedAt(OffsetDateTime.now());
        comment.setResolvedBy(resolvedBy);
        return commentRepository.save(comment);
    }

    public List<Map<String, Object>> getAuditTrail() {
        // Mock query from system_ops.audit_records
        Map<String, Object> audit = new HashMap<>();
        audit.put("action", "TAG_UPDATED");
        audit.put("entityId", "test_tag");
        return Collections.singletonList(audit);
    }

    public ExportJob requestExport(String pageId, String languageCode, UUID requestedBy) {
        ExportJob job = new ExportJob();
        job.setPageId(pageId);
        job.setLanguageCode(languageCode);
        job.setStatus("PENDING");
        job.setRequestedBy(requestedBy);
        // job.setRequestedAt(OffsetDateTime.now());
        
        job = exportJobRepository.save(job);
        
        // Dispatch job for background processing
        jobDispatcher.dispatch("EXPORT_GENERATION", job.getExportJobId());
        
        return job;
    }

    public ExportJob getExportStatus(UUID jobId) {
        return exportJobRepository.findById(jobId)
                .orElseThrow(() -> new IllegalArgumentException("Export Job not found"));
    }

    public String getExportDownloadUrl(UUID jobId) {
        ExportJob job = getExportStatus(jobId);
        if (!"COMPLETED".equals(job.getStatus())) {
            throw new IllegalStateException("Export is not completed yet");
        }
        return job.getFileReferenceUrl();
    }

    public List<Map<String, Object>> getNotifications(UUID userId) {
        // Mock query from system_ops.notifications
        Map<String, Object> notif = new HashMap<>();
        notif.put("type", "PUBLISHING_REQUESTED");
        notif.put("message", "A new publishing request is pending review");
        notif.put("read", false);
        return Collections.singletonList(notif);
    }

    public void markNotificationsAsRead(UUID userId, List<UUID> notificationIds) {
        // Mock batch update
    }
}
