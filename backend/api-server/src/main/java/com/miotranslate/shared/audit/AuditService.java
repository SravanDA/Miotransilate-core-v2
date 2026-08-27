package com.miotranslate.shared.audit;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.miotranslate.shared.auth.SecurityUtils;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.UUID;

@Service
public class AuditService {

    private final JdbcTemplate jdbcTemplate;
    private final ObjectMapper objectMapper;

    public AuditService(JdbcTemplate jdbcTemplate, ObjectMapper objectMapper) {
        this.jdbcTemplate = jdbcTemplate;
        this.objectMapper = objectMapper;
    }

    /**
     * Standard audit record creation. GP-05 requires this to be within the same transaction.
     */
    @Transactional
    public void record(String action, String entityType, String entityId, String detail) {
        recordFull(action, entityType, entityId, null, null, null, detail);
    }
    
    @Transactional
    public void recordStateChange(String action, String entityType, String entityId, Object beforeState, Object afterState, String detail) {
        recordFull(action, entityType, entityId, beforeState, afterState, null, detail);
    }

    private void recordFull(String action, String entityType, String entityId, Object beforeState, Object afterState, String apiId, String detail) {
        UUID auditRecordId = UUID.randomUUID();
        UUID userId = SecurityUtils.getCurrentUserId();
        
        String beforeJson = null;
        String afterJson = null;
        
        try {
            if (beforeState != null) beforeJson = objectMapper.writeValueAsString(beforeState);
            if (afterState != null) afterJson = objectMapper.writeValueAsString(afterState);
        } catch (JsonProcessingException e) {
            // fallback to string representation if serialization fails
            if (beforeState != null) beforeJson = "{\"error\": \"serialization_failed\", \"type\": \"" + beforeState.getClass().getSimpleName() + "\"}";
            if (afterState != null) afterJson = "{\"error\": \"serialization_failed\", \"type\": \"" + afterState.getClass().getSimpleName() + "\"}";
        }

        String sql = """
            INSERT INTO system_ops.audit_records 
            (audit_record_id, action, subject_entity_type, subject_entity_id, performed_by_user_id, before_state, after_state, detail) 
            VALUES (?, ?, ?, ?, ?, ?::jsonb, ?::jsonb, ?)
            """;

        jdbcTemplate.update(sql, 
            auditRecordId, 
            action, 
            entityType, 
            entityId, 
            userId, 
            beforeJson, 
            afterJson, 
            detail
        );
    }
}
