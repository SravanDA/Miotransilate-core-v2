-- V020__rbac_seed.sql

-- System roles
INSERT INTO admin.roles (role_code, role_name, description, is_system) VALUES
  ('DEV',   'Developer',             'View-only access', true),
  ('PM',    'Product Manager',       'Authors English copy, creates pages/tags', true),
  ('QA',    'Quality Assurance',     'Reviews and corrects English copy', true),
  ('LR',    'Localization Reviewer', 'Reviews/approves translations', true),
  ('SR',    'Support Reviewer',      'Approves English copy, Production publishing', true),
  ('FN',    'Founder',               'All permissions. Final authority.', true),
  ('ADMIN', 'Administrator',         'Role/language/config management', true);

-- 22 permissions with is_protected classification
INSERT INTO admin.permissions (permission_code, description, category, is_protected) VALUES
  ('CONTENT_VIEW',             'View pages, tags, statuses',          'content',       false),
  ('HISTORY_VIEW',             'View version history',                'content',       false),
  ('AUDIT_VIEW',               'View audit trail',                    'audit',         false),
  ('COMMENT_CREATE',           'Add comments',                        'collaboration', false),
  ('PAGE_TAG_CREATE',          'Create pages and tags',               'content',       false),
  ('ENGLISH_AUTHOR',           'Author/edit English copy',            'content',       false),
  ('SUBMIT_FOR_REVIEW',        'Submit content for review',           'content',       false),
  ('ENGLISH_APPROVE',          'Approve English copy',                'content',       false),
  ('TRANSLATION_CREATE',       'Create AI translations',              'translation',   false),
  ('TRANSLATION_EDIT',         'Edit translations manually',          'translation',   false),
  ('TRANSLATION_APPROVE',      'Approve translations',                'translation',   false),
  ('TRANSLATION_BULK_APPROVE', 'Bulk approve translations',           'translation',   false),
  ('PUBLISH_DEV',              'Publish to Dev environment',          'publishing',    false),
  ('PUBLISH_QA',               'Publish to QA environment',           'publishing',    false),
  ('ESCALATE',                 'Escalate to Founder',                 'collaboration', false),
  ('EXPORT',                   'Export tag data',                     'reporting',     false),
  ('PUBLISH_PRODUCTION',       'Publish to Production environment',   'publishing',    true),
  ('ROLLBACK',                 'Rollback deployments',                'publishing',    true),
  ('ADMIN_USERS',              'Manage users and roles',              'admin',         true),
  ('ADMIN_LANGUAGES',          'Add/deactivate languages',            'admin',         true),
  ('ADMIN_CONFIG',             'Configure system settings',           'admin',         true),
  ('ADMIN_MIGRATION',          'Run data migrations',                 'admin',         true);

-- Role → Permission mappings (from §6.3 matrix)
-- DEV: 4 permissions
INSERT INTO admin.role_permissions (role_code, permission_code) VALUES
  ('DEV', 'CONTENT_VIEW'), ('DEV', 'HISTORY_VIEW'),
  ('DEV', 'AUDIT_VIEW'),   ('DEV', 'COMMENT_CREATE');

-- PM: 11 permissions
INSERT INTO admin.role_permissions (role_code, permission_code) VALUES
  ('PM', 'CONTENT_VIEW'),       ('PM', 'HISTORY_VIEW'),
  ('PM', 'AUDIT_VIEW'),         ('PM', 'COMMENT_CREATE'),
  ('PM', 'PAGE_TAG_CREATE'),    ('PM', 'ENGLISH_AUTHOR'),
  ('PM', 'SUBMIT_FOR_REVIEW'),  ('PM', 'TRANSLATION_CREATE'),
  ('PM', 'PUBLISH_DEV'),        ('PM', 'ESCALATE'),
  ('PM', 'EXPORT');

-- QA: 9 permissions
INSERT INTO admin.role_permissions (role_code, permission_code) VALUES
  ('QA', 'CONTENT_VIEW'),       ('QA', 'HISTORY_VIEW'),
  ('QA', 'AUDIT_VIEW'),         ('QA', 'COMMENT_CREATE'),
  ('QA', 'ENGLISH_AUTHOR'),     ('QA', 'SUBMIT_FOR_REVIEW'),
  ('QA', 'PUBLISH_DEV'),        ('QA', 'ESCALATE'),
  ('QA', 'EXPORT');

-- LR: 13 permissions
INSERT INTO admin.role_permissions (role_code, permission_code) VALUES
  ('LR', 'CONTENT_VIEW'),             ('LR', 'HISTORY_VIEW'),
  ('LR', 'AUDIT_VIEW'),               ('LR', 'COMMENT_CREATE'),
  ('LR', 'SUBMIT_FOR_REVIEW'),        ('LR', 'TRANSLATION_CREATE'),
  ('LR', 'TRANSLATION_EDIT'),         ('LR', 'TRANSLATION_APPROVE'),
  ('LR', 'TRANSLATION_BULK_APPROVE'), ('LR', 'PUBLISH_DEV'),
  ('LR', 'PUBLISH_QA'),               ('LR', 'ESCALATE'),
  ('LR', 'EXPORT');

-- SR: 11 permissions
INSERT INTO admin.role_permissions (role_code, permission_code) VALUES
  ('SR', 'CONTENT_VIEW'),         ('SR', 'HISTORY_VIEW'),
  ('SR', 'AUDIT_VIEW'),           ('SR', 'COMMENT_CREATE'),
  ('SR', 'ENGLISH_APPROVE'),      ('SR', 'PUBLISH_DEV'),
  ('SR', 'PUBLISH_QA'),           ('SR', 'PUBLISH_PRODUCTION'),
  ('SR', 'ROLLBACK'),             ('SR', 'ESCALATE'),
  ('SR', 'EXPORT');

-- FN: 21 permissions (ALL except ESCALATE)
INSERT INTO admin.role_permissions (role_code, permission_code)
SELECT 'FN', permission_code FROM admin.permissions
WHERE permission_code != 'ESCALATE';

-- ADMIN: 10 permissions
INSERT INTO admin.role_permissions (role_code, permission_code) VALUES
  ('ADMIN', 'CONTENT_VIEW'),      ('ADMIN', 'HISTORY_VIEW'),
  ('ADMIN', 'AUDIT_VIEW'),        ('ADMIN', 'COMMENT_CREATE'),
  ('ADMIN', 'PAGE_TAG_CREATE'),   ('ADMIN', 'EXPORT'),
  ('ADMIN', 'ADMIN_USERS'),       ('ADMIN', 'ADMIN_LANGUAGES'),
  ('ADMIN', 'ADMIN_CONFIG'),      ('ADMIN', 'ADMIN_MIGRATION');

-- Founder seed user
INSERT INTO admin.users (user_id, display_name, email, password_hash, must_change_password, is_active)
VALUES (
  'a0000000-0000-0000-0000-000000000001',
  'Founder',
  'founder@miosalonsoftware.com',
  -- Hash for 'ChangeMe123!'
  '$2b$12$Ml4YAzFM2zA2Q15NR4SvWua.7Nps5XdbcnANvyIzp3jgc4fBDR1VK',
  true,
  true
);

INSERT INTO admin.user_role_assignments (assignment_id, user_id, role, assigned_by, assigned_at)
VALUES
  (gen_random_uuid(), 'a0000000-0000-0000-0000-000000000001', 'FN',
   'a0000000-0000-0000-0000-000000000001', now()),
  (gen_random_uuid(), 'a0000000-0000-0000-0000-000000000001', 'ADMIN',
   'a0000000-0000-0000-0000-000000000001', now());

-- Developer seed user
INSERT INTO admin.users (user_id, display_name, email, password_hash, must_change_password, is_active)
VALUES (
  'b0000000-0000-0000-0000-000000000002',
  'Developer',
  'dev@miosalonsoftware.com',
  '$2b$12$Ml4YAzFM2zA2Q15NR4SvWua.7Nps5XdbcnANvyIzp3jgc4fBDR1VK',
  true,
  true
);

INSERT INTO admin.user_role_assignments (assignment_id, user_id, role, assigned_by, assigned_at)
VALUES
  (gen_random_uuid(), 'b0000000-0000-0000-0000-000000000002', 'DEV',
   'a0000000-0000-0000-0000-000000000001', now());

-- PM seed user
INSERT INTO admin.users (user_id, display_name, email, password_hash, must_change_password, is_active)
VALUES (
  'c0000000-0000-0000-0000-000000000003',
  'Product Manager',
  'pm@miosalonsoftware.com',
  '$2b$12$Ml4YAzFM2zA2Q15NR4SvWua.7Nps5XdbcnANvyIzp3jgc4fBDR1VK',
  true,
  true
);

INSERT INTO admin.user_role_assignments (assignment_id, user_id, role, assigned_by, assigned_at)
VALUES
  (gen_random_uuid(), 'c0000000-0000-0000-0000-000000000003', 'PM',
   'a0000000-0000-0000-0000-000000000001', now());
