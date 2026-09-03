package com.miotranslate.shared.config;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.context.annotation.Profile;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

import java.util.UUID;

@Slf4j
@Component
@Profile("mock")
@RequiredArgsConstructor
public class MockProfileSeeder implements ApplicationRunner {

    private final JdbcTemplate jdbcTemplate;

    private static final String DEFAULT_PASSWORD_HASH = "$2a$12$w1b3uW7CTAswxqXj4AFUieqbU8OVL0Vj56/XFceKv2hWiVYgs9fNu"; // ChangeMe123!
    private static final UUID FOUNDER_ID = UUID.fromString("a0000000-0000-0000-0000-000000000001");
    private static final UUID DEV_ID = UUID.fromString("b0000000-0000-0000-0000-000000000002");
    private static final UUID PM_ID = UUID.fromString("c0000000-0000-0000-0000-000000000003");

    @Override
    public void run(ApplicationArguments args) {
        log.info("Initializing in-memory mock database with RBAC and user seed data...");

        try {
            seedRbac();
            seedUsers();
            log.info("Mock database seeding completed successfully (no page/tag seed data).");
        } catch (Exception e) {
            log.error("Error seeding mock database: {}", e.getMessage(), e);
        }
    }

    private void seedRbac() {
        // Roles
        String[] roles = {"FN", "ADMIN", "DEV", "PM", "TRANSLATOR", "QA", "LEAD_DEV"};
        String[] names = {"Founder", "Administrator", "Developer", "Product Manager", "Translator", "QA Engineer", "Lead Developer"};
        for (int i = 0; i < roles.length; i++) {
            jdbcTemplate.update(
                "MERGE INTO admin.roles (role_code, role_name, description, is_system, is_active, created_at, updated_at) " +
                "KEY(role_code) VALUES (?, ?, ?, true, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)",
                roles[i], names[i], names[i] + " Role"
            );
        }

        // Permissions
        String[] permissions = {
            "CONTENT_VIEW", "ENGLISH_AUTHOR", "ENGLISH_APPROVE", "ENGLISH_ESCALATE",
            "TRANSLATION_CREATE", "TRANSLATION_EDIT", "TRANSLATION_APPROVE", "TRANSLATION_BULK_APPROVE",
            "SUBMIT_FOR_REVIEW", "REQUEST_CHANGES", "PAGE_CREATE", "PAGE_DEPRECATE",
            "PAGE_TAG_CREATE", "PAGE_TAG_DEPRECATE", "PUBLISH_DEV", "PUBLISH_QA",
            "PUBLISH_PRODUCTION", "PUBLISH_REQUEST_APPROVAL", "PUBLISH_DECIDE_APPROVAL",
            "ROLLBACK", "REPORTS_VIEW", "AUDIT_VIEW", "ADMIN_USERS", "ADMIN_LANGUAGES",
            "ADMIN_CONFIG", "ADMIN_MIGRATION"
        };
        for (String perm : permissions) {
            jdbcTemplate.update(
                "MERGE INTO admin.permissions (permission_code, description, category, is_protected) " +
                "KEY(permission_code) VALUES (?, ?, 'general', true)",
                perm, perm
            );
            // Grant to FN
            jdbcTemplate.update(
                "MERGE INTO admin.role_permissions (role_code, permission_code, created_at) " +
                "KEY(role_code, permission_code) VALUES ('FN', ?, CURRENT_TIMESTAMP)",
                perm
            );
            // Grant to ADMIN
            jdbcTemplate.update(
                "MERGE INTO admin.role_permissions (role_code, permission_code, created_at) " +
                "KEY(role_code, permission_code) VALUES ('ADMIN', ?, CURRENT_TIMESTAMP)",
                perm
            );
        }
    }

    private void seedUsers() {
        // Founder
        jdbcTemplate.update(
            "MERGE INTO admin.users (user_id, display_name, email, password_hash, must_change_password, is_active, created_at, updated_at) " +
            "KEY(user_id) VALUES (?, 'Founder', 'founder@miosalonsoftware.com', ?, false, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)",
            FOUNDER_ID, DEFAULT_PASSWORD_HASH
        );
        jdbcTemplate.update(
            "MERGE INTO admin.user_role_assignments (assignment_id, user_id, role, assigned_by, assigned_at, created_at) " +
            "KEY(assignment_id) VALUES (?, ?, 'FN', ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)",
            UUID.randomUUID(), FOUNDER_ID, FOUNDER_ID
        );
        jdbcTemplate.update(
            "MERGE INTO admin.user_role_assignments (assignment_id, user_id, role, assigned_by, assigned_at, created_at) " +
            "KEY(assignment_id) VALUES (?, ?, 'ADMIN', ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)",
            UUID.randomUUID(), FOUNDER_ID, FOUNDER_ID
        );

        // Dev
        jdbcTemplate.update(
            "MERGE INTO admin.users (user_id, display_name, email, password_hash, must_change_password, is_active, created_at, updated_at) " +
            "KEY(user_id) VALUES (?, 'Developer', 'dev@miosalonsoftware.com', ?, false, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)",
            DEV_ID, DEFAULT_PASSWORD_HASH
        );
        jdbcTemplate.update(
            "MERGE INTO admin.user_role_assignments (assignment_id, user_id, role, assigned_by, assigned_at, created_at) " +
            "KEY(assignment_id) VALUES (?, ?, 'DEV', ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)",
            UUID.randomUUID(), DEV_ID, FOUNDER_ID
        );

        // PM
        jdbcTemplate.update(
            "MERGE INTO admin.users (user_id, display_name, email, password_hash, must_change_password, is_active, created_at, updated_at) " +
            "KEY(user_id) VALUES (?, 'Product Manager', 'pm@miosalonsoftware.com', ?, false, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)",
            PM_ID, DEFAULT_PASSWORD_HASH
        );
        jdbcTemplate.update(
            "MERGE INTO admin.user_role_assignments (assignment_id, user_id, role, assigned_by, assigned_at, created_at) " +
            "KEY(assignment_id) VALUES (?, ?, 'PM', ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)",
            UUID.randomUUID(), PM_ID, FOUNDER_ID
        );
    }
}
