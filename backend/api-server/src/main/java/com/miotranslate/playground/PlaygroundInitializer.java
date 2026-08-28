package com.miotranslate.playground;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.annotation.Profile;
import org.springframework.context.event.EventListener;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

@Slf4j
@Component
@Profile("mock")
@RequiredArgsConstructor
public class PlaygroundInitializer {

    private final CsvImporter csvImporter;
    private final JdbcTemplate jdbcTemplate;

    private static final String BCRYPT_PASSWORD_HASH = "$2b$12$Ml4YAzFM2zA2Q15NR4SvWua.7Nps5XdbcnANvyIzp3jgc4fBDR1VK";

    @EventListener(ApplicationReadyEvent.class)
    public void onApplicationReady() {
        log.info("Playground mock profile active, starting data import...");
        seedRbacData();
        csvImporter.importTags();
        log.info("Playground data initialization complete.");
    }

    private void seedRbacData() {
        try {
            // 1. Roles
            jdbcTemplate.update("MERGE INTO admin.roles (role_code, role_name, description, is_system, is_active, created_at, updated_at) " +
                    "KEY(role_code) VALUES ('DEV', 'Developer', 'View-only access', true, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)");
            jdbcTemplate.update("MERGE INTO admin.roles (role_code, role_name, description, is_system, is_active, created_at, updated_at) " +
                    "KEY(role_code) VALUES ('PM', 'Product Manager', 'Authors English copy', true, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)");
            jdbcTemplate.update("MERGE INTO admin.roles (role_code, role_name, description, is_system, is_active, created_at, updated_at) " +
                    "KEY(role_code) VALUES ('QA', 'Quality Assurance', 'Reviews English copy', true, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)");
            jdbcTemplate.update("MERGE INTO admin.roles (role_code, role_name, description, is_system, is_active, created_at, updated_at) " +
                    "KEY(role_code) VALUES ('LR', 'Localization Reviewer', 'Approves translations', true, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)");
            jdbcTemplate.update("MERGE INTO admin.roles (role_code, role_name, description, is_system, is_active, created_at, updated_at) " +
                    "KEY(role_code) VALUES ('SR', 'Support Reviewer', 'Production publishing', true, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)");
            jdbcTemplate.update("MERGE INTO admin.roles (role_code, role_name, description, is_system, is_active, created_at, updated_at) " +
                    "KEY(role_code) VALUES ('FN', 'Founder', 'All permissions', true, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)");
            jdbcTemplate.update("MERGE INTO admin.roles (role_code, role_name, description, is_system, is_active, created_at, updated_at) " +
                    "KEY(role_code) VALUES ('ADMIN', 'Administrator', 'System management', true, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)");

            // 2. Permissions
            String[][] permissions = {
                {"CONTENT_VIEW", "View pages, tags, statuses", "content", "false"},
                {"HISTORY_VIEW", "View version history", "content", "false"},
                {"AUDIT_VIEW", "View audit trail", "audit", "false"},
                {"COMMENT_CREATE", "Add comments", "collaboration", "false"},
                {"PAGE_TAG_CREATE", "Create pages and tags", "content", "false"},
                {"ENGLISH_AUTHOR", "Author/edit English copy", "content", "false"},
                {"SUBMIT_FOR_REVIEW", "Submit content for review", "content", "false"},
                {"ENGLISH_APPROVE", "Approve English copy", "content", "false"},
                {"TRANSLATION_CREATE", "Create AI translations", "translation", "false"},
                {"TRANSLATION_EDIT", "Edit translations manually", "translation", "false"},
                {"TRANSLATION_APPROVE", "Approve translations", "translation", "false"},
                {"TRANSLATION_BULK_APPROVE", "Bulk approve translations", "translation", "false"},
                {"PUBLISH_DEV", "Publish to Dev environment", "publishing", "false"},
                {"PUBLISH_QA", "Publish to QA environment", "publishing", "false"},
                {"ESCALATE", "Escalate to Founder", "collaboration", "false"},
                {"EXPORT", "Export tag data", "reporting", "false"},
                {"PUBLISH_PRODUCTION", "Publish to Production environment", "publishing", "true"},
                {"ROLLBACK", "Rollback deployments", "publishing", "true"},
                {"ADMIN_USERS", "Manage users and roles", "admin", "true"},
                {"ADMIN_LANGUAGES", "Add/deactivate languages", "admin", "true"},
                {"ADMIN_CONFIG", "Configure system settings", "admin", "true"},
                {"ADMIN_MIGRATION", "Run data migrations", "admin", "true"}
            };

            for (String[] perm : permissions) {
                jdbcTemplate.update("MERGE INTO admin.permissions (permission_code, description, category, is_protected) " +
                        "KEY(permission_code) VALUES (?, ?, ?, ?)", perm[0], perm[1], perm[2], Boolean.parseBoolean(perm[3]));
            }

            // 3. Role Permissions
            String[][] rolePerms = {
                // DEV
                {"DEV", "CONTENT_VIEW"}, {"DEV", "HISTORY_VIEW"}, {"DEV", "AUDIT_VIEW"}, {"DEV", "COMMENT_CREATE"},
                // PM
                {"PM", "CONTENT_VIEW"}, {"PM", "HISTORY_VIEW"}, {"PM", "AUDIT_VIEW"}, {"PM", "COMMENT_CREATE"},
                {"PM", "PAGE_TAG_CREATE"}, {"PM", "ENGLISH_AUTHOR"}, {"PM", "SUBMIT_FOR_REVIEW"}, {"PM", "TRANSLATION_CREATE"},
                {"PM", "PUBLISH_DEV"}, {"PM", "ESCALATE"}, {"PM", "EXPORT"},
                // LR
                {"LR", "CONTENT_VIEW"}, {"LR", "HISTORY_VIEW"}, {"LR", "AUDIT_VIEW"}, {"LR", "COMMENT_CREATE"},
                {"LR", "SUBMIT_FOR_REVIEW"}, {"LR", "TRANSLATION_CREATE"}, {"LR", "TRANSLATION_EDIT"},
                {"LR", "TRANSLATION_APPROVE"}, {"LR", "TRANSLATION_BULK_APPROVE"}, {"LR", "PUBLISH_DEV"},
                {"LR", "PUBLISH_QA"}, {"LR", "ESCALATE"}, {"LR", "EXPORT"},
                // SR
                {"SR", "CONTENT_VIEW"}, {"SR", "HISTORY_VIEW"}, {"SR", "AUDIT_VIEW"}, {"SR", "COMMENT_CREATE"},
                {"SR", "ENGLISH_APPROVE"}, {"SR", "PUBLISH_DEV"}, {"SR", "PUBLISH_QA"}, {"SR", "PUBLISH_PRODUCTION"},
                {"SR", "ROLLBACK"}, {"SR", "ESCALATE"}, {"SR", "EXPORT"},
                // ADMIN
                {"ADMIN", "CONTENT_VIEW"}, {"ADMIN", "HISTORY_VIEW"}, {"ADMIN", "AUDIT_VIEW"}, {"ADMIN", "COMMENT_CREATE"},
                {"ADMIN", "PAGE_TAG_CREATE"}, {"ADMIN", "EXPORT"}, {"ADMIN", "ADMIN_USERS"}, {"ADMIN", "ADMIN_LANGUAGES"},
                {"ADMIN", "ADMIN_CONFIG"}, {"ADMIN", "ADMIN_MIGRATION"}
            };

            for (String[] rp : rolePerms) {
                jdbcTemplate.update("MERGE INTO admin.role_permissions (role_code, permission_code, created_at) " +
                        "KEY(role_code, permission_code) VALUES (?, ?, CURRENT_TIMESTAMP)", rp[0], rp[1]);
            }

            // FN gets all permissions except ESCALATE
            for (String[] perm : permissions) {
                if (!"ESCALATE".equals(perm[0])) {
                    jdbcTemplate.update("MERGE INTO admin.role_permissions (role_code, permission_code, created_at) " +
                            "KEY(role_code, permission_code) VALUES ('FN', ?, CURRENT_TIMESTAMP)", perm[0]);
                }
            }

            // 4. Users
            // Founder
            jdbcTemplate.update("MERGE INTO admin.users (user_id, display_name, email, password_hash, must_change_password, is_active, created_at, updated_at) " +
                    "KEY(user_id) VALUES ('a0000000-0000-0000-0000-000000000001', 'Founder', 'founder@miosalonsoftware.com', ?, false, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)",
                    BCRYPT_PASSWORD_HASH);
            jdbcTemplate.update("MERGE INTO admin.user_role_assignments (assignment_id, user_id, role, assigned_by, assigned_at, created_at) " +
                    "KEY(assignment_id) VALUES ('a0000000-0000-0000-0001-000000000001', 'a0000000-0000-0000-0000-000000000001', 'FN', 'a0000000-0000-0000-0000-000000000001', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)");
            jdbcTemplate.update("MERGE INTO admin.user_role_assignments (assignment_id, user_id, role, assigned_by, assigned_at, created_at) " +
                    "KEY(assignment_id) VALUES ('a0000000-0000-0000-0001-000000000002', 'a0000000-0000-0000-0000-000000000001', 'ADMIN', 'a0000000-0000-0000-0000-000000000001', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)");

            // Developer
            jdbcTemplate.update("MERGE INTO admin.users (user_id, display_name, email, password_hash, must_change_password, is_active, created_at, updated_at) " +
                    "KEY(user_id) VALUES ('b0000000-0000-0000-0000-000000000002', 'Developer', 'dev@miosalonsoftware.com', ?, false, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)",
                    BCRYPT_PASSWORD_HASH);
            jdbcTemplate.update("MERGE INTO admin.user_role_assignments (assignment_id, user_id, role, assigned_by, assigned_at, created_at) " +
                    "KEY(assignment_id) VALUES ('b0000000-0000-0000-0001-000000000001', 'b0000000-0000-0000-0000-000000000002', 'DEV', 'a0000000-0000-0000-0000-000000000001', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)");

            // PM
            jdbcTemplate.update("MERGE INTO admin.users (user_id, display_name, email, password_hash, must_change_password, is_active, created_at, updated_at) " +
                    "KEY(user_id) VALUES ('c0000000-0000-0000-0000-000000000003', 'Product Manager', 'pm@miosalonsoftware.com', ?, false, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)",
                    BCRYPT_PASSWORD_HASH);
            jdbcTemplate.update("MERGE INTO admin.user_role_assignments (assignment_id, user_id, role, assigned_by, assigned_at, created_at) " +
                    "KEY(assignment_id) VALUES ('c0000000-0000-0000-0001-000000000001', 'c0000000-0000-0000-0000-000000000003', 'PM', 'a0000000-0000-0000-0000-000000000001', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)");

            // LR
            jdbcTemplate.update("MERGE INTO admin.users (user_id, display_name, email, password_hash, must_change_password, is_active, created_at, updated_at) " +
                    "KEY(user_id) VALUES ('d0000000-0000-0000-0000-000000000004', 'Localization Reviewer', 'lr@miosalonsoftware.com', ?, false, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)",
                    BCRYPT_PASSWORD_HASH);
            jdbcTemplate.update("MERGE INTO admin.user_role_assignments (assignment_id, user_id, role, assigned_by, assigned_at, created_at) " +
                    "KEY(assignment_id) VALUES ('d0000000-0000-0000-0001-000000000001', 'd0000000-0000-0000-0000-000000000004', 'LR', 'a0000000-0000-0000-0000-000000000001', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)");

            log.info("RBAC mock data seeded successfully.");
        } catch (Exception e) {
            log.error("Failed to seed RBAC mock data", e);
        }
    }
}

