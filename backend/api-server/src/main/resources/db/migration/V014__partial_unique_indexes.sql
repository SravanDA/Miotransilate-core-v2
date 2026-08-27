CREATE UNIQUE INDEX user_role_assignments_active_unique ON admin.user_role_assignments (user_id, role) WHERE revoked_at IS NULL;
CREATE UNIQUE INDEX english_copy_versions_approved_unique ON content.english_copy_versions (tag_id) WHERE status = 'APPROVED';
CREATE UNIQUE INDEX par_pending_unique ON publishing.publishing_approval_requests (page_id, language_code, environment) WHERE status = 'PENDING';
CREATE UNIQUE INDEX releases_in_flight_unique ON publishing.releases (page_id, language_code, environment) WHERE status IN ('PENDING', 'IN_PROGRESS');
CREATE UNIQUE INDEX import_events_active_unique ON migration.import_events (initiated_by) WHERE status IN ('UPLOAD_READY', 'VALIDATING', 'PROCESSING');
