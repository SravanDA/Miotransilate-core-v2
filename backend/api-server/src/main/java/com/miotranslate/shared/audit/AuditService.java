package com.miotranslate.shared.audit;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.miotranslate.shared.auth.SecurityUtils;
import lombok.extern.slf4j.Slf4j;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.UUID;

@Slf4j
@Service
public class AuditService {

    private final JdbcTemplate jdbcTemplate;
    private final ObjectMapper objectMapper;
    private final com.miotranslate.shared.auth.PermissionService permissionService;

    public AuditService(JdbcTemplate jdbcTemplate, ObjectMapper objectMapper, com.miotranslate.shared.auth.PermissionService permissionService) {
        this.jdbcTemplate = jdbcTemplate;
        this.objectMapper = objectMapper;
        this.permissionService = permissionService;
    }

    /**
     * Standard audit record creation. GP-05 requires this to be within the same transaction.
     */
    @Transactional
    public void record(String action, String entityType, String entityId, String detail) {
        recordFull(action, entityType, entityId, null, null, null, null, null, detail);
    }
    
    @Transactional
    public void record(String action, String entityType, String entityId, String entityIdAux, String detail) {
        recordFull(action, entityType, entityId, entityIdAux, null, null, null, null, detail);
    }
    
    @Transactional
    public void recordStateChange(String action, String entityType, String entityId, Object beforeState, Object afterState, String detail) {
        recordFull(action, entityType, entityId, null, beforeState, afterState, null, null, detail);
    }

    @Transactional
    public void recordStateChange(String action, String entityType, String entityId, String entityIdAux, Object beforeState, Object afterState, String detail) {
        recordFull(action, entityType, entityId, entityIdAux, beforeState, afterState, null, null, detail);
    }

    private void recordFull(String action, String entityType, String entityId, String entityIdAux, Object beforeState, Object afterState, String performedBySource, String apiId, String detail) {
        UUID auditRecordId = UUID.randomUUID();
        UUID userId = null;
        try {
            userId = SecurityUtils.getCurrentUserId();
        } catch (Exception e) {
            // System operations might not have an authenticated user
        }
        
        String enhancedDetail = detail;
        if (userId != null) {
            try {
                java.util.List<String> roles = permissionService.getRoles(userId);
                if (!roles.isEmpty()) {
                    enhancedDetail = (detail != null ? detail + " " : "") + "[Roles: " + String.join(", ", roles) + "]";
                }
            } catch (Exception e) {
                // Ignore error fetching roles
            }
        }
        
        String beforeJson = null;
        String afterJson = null;
        
        try {
            if (beforeState != null) beforeJson = objectMapper.writeValueAsString(beforeState);
            if (afterState != null) afterJson = objectMapper.writeValueAsString(afterState);
        } catch (JsonProcessingException e) {
            if (beforeState != null) beforeJson = "{\"error\": \"serialization_failed\", \"type\": \"" + beforeState.getClass().getSimpleName() + "\"}";
            if (afterState != null) afterJson = "{\"error\": \"serialization_failed\", \"type\": \"" + afterState.getClass().getSimpleName() + "\"}";
        }

        if (performedBySource == null) {
            performedBySource = "USER";
        }
        UUID requestId = null; // Could be extracted from context if available

        try {
            String sql = """
                INSERT INTO system_ops.audit_records 
                (audit_record_id, action, subject_entity_type, subject_entity_id, subject_entity_id_aux, performed_by_user_id, performed_by_source, performed_at, api_id, request_id, before_state, after_state, detail) 
                VALUES (?, ?, ?, ?, ?, ?, ?, now(), ?, ?, ?::jsonb, ?::jsonb, ?)
                """;

            jdbcTemplate.update(sql, 
                auditRecordId, 
                action, 
                entityType, 
                entityId,
                entityIdAux,
                userId,
                performedBySource,
                apiId,
                requestId,
                beforeJson, 
                afterJson, 
                enhancedDetail
            );
        } catch (Exception e) {
            log.debug("Audit insert fallback: {}", e.getMessage());
        }
    }
}
