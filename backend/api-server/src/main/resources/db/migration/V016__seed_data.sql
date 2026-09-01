-- Seed data to satisfy Foreign Key constraints before API usage

-- 1. Insert a dummy Admin User matching the MockAuthFilter UUID
INSERT INTO admin.users (user_id, display_name, email, is_active, created_at, updated_at)
VALUES (
    '11111111-1111-1111-1111-111111111111', 
    'System Admin', 
    'admin@miotranslate.local', 
    TRUE, 
    now(), 
    now()
)
ON CONFLICT (user_id) DO NOTHING;

INSERT INTO admin.languages (language_code, language_name, direction, status, added_by, created_at, updated_at)
VALUES 
    ('ar', 'Arabic', 'RTL', 'ACTIVE', '11111111-1111-1111-1111-111111111111', now(), now()),
    ('es', 'Spanish', 'LTR', 'ACTIVE', '11111111-1111-1111-1111-111111111111', now(), now()),
    ('tr', 'Turkish', 'LTR', 'ACTIVE', '11111111-1111-1111-1111-111111111111', now(), now()),
    ('bg', 'Bulgarian', 'LTR', 'ACTIVE', '11111111-1111-1111-1111-111111111111', now(), now()),
    ('it', 'Italian', 'LTR', 'ACTIVE', '11111111-1111-1111-1111-111111111111', now(), now()),
    ('fr', 'French (Canada)', 'LTR', 'ACTIVE', '11111111-1111-1111-1111-111111111111', now(), now()),
    ('de', 'German', 'LTR', 'ACTIVE', '11111111-1111-1111-1111-111111111111', now(), now())
ON CONFLICT (language_code) DO NOTHING;
