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

import org.springframework.jdbc.core.JdbcTemplate;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.core.type.TypeReference;

@Service
public class CollaborationService {

    private final CommentRepository commentRepository;
    private final ExportJobRepository exportJobRepository;
    private final JobDispatcher jobDispatcher;
    private final com.miotranslate.shared.auth.PermissionService permissionService;
    private final UserRepository userRepository;
    private final TagRepository tagRepository;
    private final PageRepository pageRepository;
    private final JdbcTemplate jdbcTemplate;
    private final ObjectMapper objectMapper;

    public CollaborationService(CommentRepository commentRepository, 
                                ExportJobRepository exportJobRepository,
                                JobDispatcher jobDispatcher,
                                com.miotranslate.shared.auth.PermissionService permissionService,
                                UserRepository userRepository,
                                TagRepository tagRepository,
                                PageRepository pageRepository,
                                JdbcTemplate jdbcTemplate,
                                ObjectMapper objectMapper) {
        this.commentRepository = commentRepository;
        this.exportJobRepository = exportJobRepository;
        this.jobDispatcher = jobDispatcher;
        this.permissionService = permissionService;
        this.userRepository = userRepository;
        this.tagRepository = tagRepository;
        this.pageRepository = pageRepository;
        this.jdbcTemplate = jdbcTemplate;
        this.objectMapper = objectMapper;
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

    public Map<String, Object> getAuditTrail(int page, int size, String entityType, String entityId, String action, UUID userId) {
        StringBuilder sql = new StringBuilder("""
            SELECT a.*, u.display_name as performed_by_display_name
            FROM system_ops.audit_records a
            LEFT JOIN admin.users u ON a.performed_by_user_id = u.user_id
            WHERE 1=1
        """);
        
        List<Object> params = new ArrayList<>();
        
        if (entityType != null && !entityType.isEmpty()) {
            sql.append(" AND a.subject_entity_type = ?");
            params.add(entityType);
        }
        if (entityId != null && !entityId.isEmpty()) {
            sql.append(" AND a.subject_entity_id = ?");
            params.add(entityId);
        }
        if (action != null && !action.isEmpty()) {
            sql.append(" AND a.action = ?");
            params.add(action);
        }
        if (userId != null) {
            sql.append(" AND a.performed_by_user_id = ?");
            params.add(userId);
        }
        
        // Count query
        String countSql = "SELECT COUNT(*) FROM (" + sql.toString() + ") AS count_query";
        Long totalCount = jdbcTemplate.queryForObject(countSql, Long.class, params.toArray());
        
        sql.append(" ORDER BY a.performed_at DESC, a.created_at DESC LIMIT ? OFFSET ?");
        params.add(size);
        params.add(page * size);
        
        List<Map<String, Object>> records = jdbcTemplate.query(sql.toString(), (rs, rowNum) -> {
            Map<String, Object> map = new HashMap<>();
            map.put("auditRecordId", rs.getString("audit_record_id"));
            map.put("action", rs.getString("action"));
            map.put("subjectEntityType", rs.getString("subject_entity_type"));
            map.put("subjectEntityId", rs.getString("subject_entity_id"));
            map.put("subjectEntityIdAux", rs.getString("subject_entity_id_aux"));
            map.put("performedByUserId", rs.getString("performed_by_user_id"));
            map.put("performedByDisplayName", rs.getString("performed_by_display_name"));
            map.put("performedBySource", rs.getString("performed_by_source"));
            map.put("performedAt", rs.getString("performed_at"));
            map.put("detail", rs.getString("detail"));
            map.put("createdAt", rs.getString("created_at"));
            
            try {
                String beforeStr = rs.getString("before_state");
                if (beforeStr != null) {
                    map.put("beforeState", objectMapper.readValue(beforeStr, new TypeReference<Map<String, Object>>() {}));
                } else {
                    map.put("beforeState", null);
                }
                
                String afterStr = rs.getString("after_state");
                if (afterStr != null) {
                    map.put("afterState", objectMapper.readValue(afterStr, new TypeReference<Map<String, Object>>() {}));
                } else {
                    map.put("afterState", null);
                }
            } catch (Exception e) {
                // Ignore JSON parsing errors
            }
            
            return map;
        }, params.toArray());
        
        Map<String, Object> result = new HashMap<>();
        result.put("records", records);
        result.put("totalCount", totalCount != null ? totalCount : 0);
        result.put("page", page);
        result.put("size", size);
        return result;
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
