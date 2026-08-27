-- admin schema
CREATE INDEX idx_languages_active ON admin.languages (language_code) WHERE status = 'ACTIVE';
CREATE INDEX idx_user_role_assignments_user_active ON admin.user_role_assignments (user_id) WHERE revoked_at IS NULL;
CREATE INDEX idx_user_role_assignments_role_active ON admin.user_role_assignments (role) WHERE revoked_at IS NULL;
CREATE INDEX idx_user_role_assignments_user_id ON admin.user_role_assignments (user_id, assigned_at DESC);

-- registry schema
CREATE INDEX idx_pages_status_active ON registry.pages (page_id) WHERE status = 'ACTIVE';
CREATE INDEX idx_pages_module ON registry.pages (module) WHERE module IS NOT NULL;
CREATE INDEX idx_tags_page_id ON registry.tags (page_id, tag_id);
CREATE INDEX idx_tags_page_id_active ON registry.tags (page_id) WHERE status = 'ACTIVE';
CREATE INDEX idx_tags_active ON registry.tags (tag_id) WHERE status = 'ACTIVE';
CREATE INDEX idx_tags_search_vector ON registry.tags USING GIN (search_vector);

-- content schema
CREATE INDEX idx_english_copies_status_pending ON content.english_copies (tag_id) WHERE status = 'PENDING_REVIEW';
CREATE INDEX idx_english_copies_status_no_copy ON content.english_copies (tag_id) WHERE status = 'NO_COPY';
CREATE INDEX idx_english_copies_status ON content.english_copies (status);
CREATE INDEX idx_english_copy_versions_tag_id_desc ON content.english_copy_versions (tag_id, version_number DESC);
CREATE INDEX idx_english_copy_versions_search_vector ON content.english_copy_versions USING GIN (search_vector);
CREATE INDEX idx_ecv_pending_review ON content.english_copy_versions (tag_id) WHERE status = 'PENDING_REVIEW';

-- translation schema
CREATE INDEX idx_translations_tag_id ON translation.translations (tag_id);
CREATE INDEX idx_translations_language_code ON translation.translations (language_code);
CREATE INDEX idx_translations_stale ON translation.translations (language_code, stale_triggered_at) WHERE status = 'STALE';
CREATE INDEX idx_translations_pending_review ON translation.translations (language_code) WHERE status = 'PENDING_REVIEW';
CREATE INDEX idx_translations_no_translation ON translation.translations (language_code) WHERE status = 'NO_TRANSLATION';
CREATE INDEX idx_translation_versions_tag_lang_desc ON translation.translation_versions (tag_id, language_code, version_number DESC);
CREATE INDEX idx_translation_versions_source_ec_version ON translation.translation_versions (tag_id, source_english_version);
CREATE INDEX idx_translation_versions_approved ON translation.translation_versions (tag_id, language_code) WHERE status = 'APPROVED';

-- publishing schema
CREATE INDEX idx_par_scope ON publishing.publishing_approval_requests (page_id, language_code, environment);
CREATE INDEX idx_par_pending ON publishing.publishing_approval_requests (required_approver_role, created_at) WHERE status = 'PENDING';
CREATE INDEX idx_par_expiry ON publishing.publishing_approval_requests (expires_at) WHERE status = 'PENDING';
CREATE INDEX idx_releases_scope_successful ON publishing.releases (page_id, language_code, environment, deployment_version DESC) WHERE status = 'SUCCESSFUL';
CREATE INDEX idx_releases_scope_history ON publishing.releases (page_id, language_code, environment, deployment_version DESC);
CREATE INDEX idx_releases_approval_request_id ON publishing.releases (approval_request_id) WHERE approval_request_id IS NOT NULL;
CREATE INDEX idx_releases_in_flight ON publishing.releases (initiated_at) WHERE status IN ('PENDING', 'IN_PROGRESS');

-- collaboration schema
CREATE INDEX idx_comments_tag_id ON collaboration.comments (tag_id, created_at DESC);
CREATE INDEX idx_comments_tag_scope ON collaboration.comments (tag_id, comment_scope, language_code);
CREATE INDEX idx_comments_unresolved ON collaboration.comments (tag_id) WHERE is_resolved = FALSE;
CREATE INDEX idx_export_jobs_requested_by ON collaboration.export_jobs (requested_by, created_at DESC) WHERE status != 'EXPIRED';
CREATE INDEX idx_export_jobs_pending_processing ON collaboration.export_jobs (created_at) WHERE status IN ('PENDING', 'PROCESSING');
CREATE INDEX idx_export_jobs_expiry ON collaboration.export_jobs (expires_at) WHERE status = 'READY';

-- system_ops schema
CREATE INDEX idx_notifications_user_unread ON system_ops.notifications (recipient_user_id, created_at DESC) WHERE status = 'UNREAD';
CREATE INDEX idx_notifications_user_all ON system_ops.notifications (recipient_user_id, created_at DESC);
CREATE INDEX idx_notifications_delivery_pending ON system_ops.notifications (created_at) WHERE delivery_status = 'PENDING';
CREATE INDEX idx_audit_performed_at ON system_ops.audit_records (performed_at DESC);
CREATE INDEX idx_audit_subject ON system_ops.audit_records (subject_entity_type, subject_entity_id, performed_at DESC);
CREATE INDEX idx_audit_user ON system_ops.audit_records (performed_by_user_id, performed_at DESC) WHERE performed_by_user_id IS NOT NULL;
CREATE INDEX idx_audit_request_id ON system_ops.audit_records (request_id) WHERE request_id IS NOT NULL;
CREATE INDEX idx_audit_action ON system_ops.audit_records (action, performed_at DESC);

-- reporting schema
CREATE INDEX idx_coverage_stale_pending ON reporting.coverage_metrics (page_id, language_code) WHERE computation_status IN ('STALE', 'PENDING');
CREATE INDEX idx_coverage_language ON reporting.coverage_metrics (language_code);

-- search schema
CREATE INDEX idx_bookmarks_user_id ON search.bookmarks (user_id, created_at DESC);
CREATE INDEX idx_recently_edited_user_recent ON search.recently_edited_events (user_id, last_accessed_at DESC);
CREATE INDEX idx_recently_edited_cleanup ON search.recently_edited_events (last_accessed_at);

-- migration schema
CREATE INDEX idx_import_events_status ON migration.import_events (status, created_at DESC);
CREATE INDEX idx_import_events_initiated_by ON migration.import_events (initiated_by, created_at DESC);
CREATE INDEX idx_migration_row_events_import ON migration.migration_row_events (import_event_id, source_row_number);
CREATE INDEX idx_migration_row_events_failed ON migration.migration_row_events (import_event_id) WHERE event_type = 'FAILED';
