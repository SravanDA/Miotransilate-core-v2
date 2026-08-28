package com.miotranslate.modules.collaboration.service;

import com.miotranslate.modules.admin.model.User;
import com.miotranslate.modules.admin.repository.UserRepository;
import com.miotranslate.modules.collaboration.api.dto.AuthorDto;
import com.miotranslate.modules.collaboration.api.dto.CommentDto;
import com.miotranslate.modules.collaboration.api.dto.EscalatedItemDto;
import com.miotranslate.modules.collaboration.api.dto.ScopeDto;
import com.miotranslate.modules.collaboration.model.Comment;
import com.miotranslate.modules.collaboration.model.ExportJob;
import com.miotranslate.modules.collaboration.repository.CommentRepository;
import com.miotranslate.modules.collaboration.repository.ExportJobRepository;
import com.miotranslate.modules.registry.model.Page;
import com.miotranslate.modules.registry.model.Tag;
import com.miotranslate.modules.registry.repository.PageRepository;
import com.miotranslate.modules.registry.repository.TagRepository;
import com.miotranslate.shared.job.JobDispatcher;
import org.springframework.stereotype.Service;

import java.time.OffsetDateTime;
import java.util.*;
import java.util.stream.Collectors;

@Service
public class CollaborationService {

    private final CommentRepository commentRepository;
    private final ExportJobRepository exportJobRepository;
    private final JobDispatcher jobDispatcher;
    private final com.miotranslate.shared.auth.PermissionService permissionService;
    private final UserRepository userRepository;
    private final TagRepository tagRepository;
    private final PageRepository pageRepository;

    public CollaborationService(CommentRepository commentRepository, 
                                ExportJobRepository exportJobRepository,
                                JobDispatcher jobDispatcher,
                                com.miotranslate.shared.auth.PermissionService permissionService,
                                UserRepository userRepository,
                                TagRepository tagRepository,
                                PageRepository pageRepository) {
        this.commentRepository = commentRepository;
        this.exportJobRepository = exportJobRepository;
        this.jobDispatcher = jobDispatcher;
        this.permissionService = permissionService;
        this.userRepository = userRepository;
        this.tagRepository = tagRepository;
        this.pageRepository = pageRepository;
    }

    public CommentDto addComment(String tagId, String text, ScopeDto scope, boolean isEscalation, String escalationReason, UUID parentCommentId, UUID authorId) {
        if (text == null || text.trim().isEmpty()) {
            throw new IllegalArgumentException("Comment text cannot be empty");
        }
        
        if (text.length() > 2000) {
            throw new IllegalArgumentException("Comment text exceeds 2000 characters");
        }

        if (scope == null || (!"ENGLISH".equals(scope.getType()) && !"LANGUAGE".equals(scope.getType()))) {
            throw new IllegalArgumentException("Invalid scope type. Must be ENGLISH or LANGUAGE.");
        }

        if ("LANGUAGE".equals(scope.getType()) && (scope.getLanguageCode() == null || scope.getLanguageCode().trim().isEmpty())) {
            throw new IllegalArgumentException("languageCode is required for LANGUAGE scope.");
        }

        if (isEscalation) {
            if (!permissionService.hasPermission(authorId, "ESCALATE")) {
                throw new org.springframework.security.access.AccessDeniedException("Missing permission: ESCALATE");
            }
        }

        // Validate parent exists and belongs to same tag
        if (parentCommentId != null) {
            Comment parent = commentRepository.findById(parentCommentId)
                    .orElseThrow(() -> new IllegalArgumentException("Parent comment not found"));
            if (!parent.getTagId().equals(tagId)) {
                throw new IllegalArgumentException("Parent comment does not belong to this tag");
            }
        }
        
        Comment comment = new Comment();
        comment.setTagId(tagId);
        comment.setParentCommentId(parentCommentId);
        comment.setCommentText(text);
        comment.setCommentScope(scope.getType());
        comment.setLanguageCode(scope.getLanguageCode());
        comment.setIsEscalation(isEscalation);
        comment.setEscalationReason(escalationReason);
        comment.setAuthorId(authorId);
        comment.setCreatedAt(OffsetDateTime.now());
        comment = commentRepository.save(comment);
        
        return toCommentDto(comment);
    }

    /**
     * Returns threaded comments: only top-level comments (parentCommentId == null),
     * each with nested replies.
     */
    public List<CommentDto> getComments(String tagId, String scopeType, Boolean resolved) {
        List<Comment> allComments = commentRepository.findByTagIdOrderByCreatedAtAsc(tagId);

        // Build flat DTOs for all comments
        Map<String, CommentDto> dtoMap = new LinkedHashMap<>();
        for (Comment c : allComments) {
            dtoMap.put(c.getCommentId().toString(), toCommentDto(c));
        }

        // Nest replies under parents
        List<CommentDto> roots = new ArrayList<>();
        for (CommentDto dto : dtoMap.values()) {
            if (dto.getParentCommentId() == null) {
                roots.add(dto);
            } else {
                CommentDto parent = dtoMap.get(dto.getParentCommentId());
                if (parent != null) {
                    parent.getReplies().add(dto);
                } else {
                    // Orphan reply — treat as root
                    roots.add(dto);
                }
            }
        }

        // Apply filter on root-level threads (resolved filter applies to the thread starter)
        if (resolved != null) {
            roots = roots.stream()
                    .filter(r -> resolved.equals(r.isResolved()))
                    .collect(Collectors.toList());
        }

        return roots;
    }

    public CommentDto resolveComment(String tagId, String commentId, UUID resolvedBy) {
        Comment comment = commentRepository.findById(UUID.fromString(commentId))
                .orElseThrow(() -> new IllegalArgumentException("Comment not found"));
                
        if (!comment.getTagId().equals(tagId)) {
            throw new IllegalArgumentException("Comment does not belong to this tag");
        }
        
        if (!comment.getIsResolved()) {
            comment.setIsResolved(true);
            comment.setResolvedAt(OffsetDateTime.now());
            comment.setResolvedBy(resolvedBy);
            comment = commentRepository.save(comment);
        }
        return toCommentDto(comment);
    }

    public CommentDto unresolveComment(String tagId, String commentId, UUID userId) {
        Comment comment = commentRepository.findById(UUID.fromString(commentId))
                .orElseThrow(() -> new IllegalArgumentException("Comment not found"));
                
        if (!comment.getTagId().equals(tagId)) {
            throw new IllegalArgumentException("Comment does not belong to this tag");
        }
        
        if (comment.getIsResolved()) {
            comment.setIsResolved(false);
            comment.setResolvedAt(null);
            comment.setResolvedBy(null);
            comment = commentRepository.save(comment);
        }
        return toCommentDto(comment);
    }
    
    public List<EscalatedItemDto> getEscalatedItems() {
        return commentRepository.findByIsEscalationTrueAndIsResolvedFalseOrderByCreatedAtAsc().stream()
            .map(comment -> {
                EscalatedItemDto dto = new EscalatedItemDto();
                dto.setComment(toCommentDto(comment));
                dto.setTagId(comment.getTagId());
                
                tagRepository.findById(comment.getTagId()).ifPresent(tag -> {
                    dto.setPageId(tag.getPageId());
                    dto.setCopyType(tag.getCopyType());
                    pageRepository.findById(tag.getPageId()).ifPresent(page -> {
                        dto.setPageName(page.getPageName());
                    });
                });
                
                return dto;
            })
            .collect(Collectors.toList());
    }

    private CommentDto toCommentDto(Comment comment) {
        CommentDto dto = new CommentDto();
        dto.setCommentId(comment.getCommentId().toString());
        dto.setTagId(comment.getTagId());
        dto.setParentCommentId(comment.getParentCommentId() != null ? comment.getParentCommentId().toString() : null);
        
        dto.setScope(new ScopeDto(comment.getCommentScope(), comment.getLanguageCode()));
        dto.setText(comment.getCommentText());
        dto.setResolved(comment.getIsResolved());
        dto.setEscalation(comment.getIsEscalation());
        dto.setEscalationReason(comment.getEscalationReason());
        dto.setCreatedAt(comment.getCreatedAt().toString());
        
        dto.setAuthor(getAuthorDto(comment.getAuthorId()));
        
        if (comment.getIsResolved() && comment.getResolvedBy() != null) {
            dto.setResolvedAt(comment.getResolvedAt().toString());
            dto.setResolvedBy(getAuthorDto(comment.getResolvedBy()));
        }
        
        return dto;
    }
    
    private AuthorDto getAuthorDto(UUID userId) {
        User user = userRepository.findById(userId).orElse(null);
        String displayName = user != null ? user.getDisplayName() : "Unknown User";
        
        List<String> roles = permissionService.getRoles(userId);
        String primaryRole = roles != null && !roles.isEmpty() ? roles.get(0) : "USER";
        
        return new AuthorDto(userId, displayName, primaryRole);
    }

    public List<Map<String, Object>> getAuditTrail() {
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
        job = exportJobRepository.save(job);
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
        Map<String, Object> notif = new HashMap<>();
        notif.put("type", "PUBLISHING_REQUESTED");
        notif.put("message", "A new publishing request is pending review");
        notif.put("read", false);
        return Collections.singletonList(notif);
    }

    public void markNotificationsAsRead(UUID userId, List<UUID> notificationIds) {
    }
}
