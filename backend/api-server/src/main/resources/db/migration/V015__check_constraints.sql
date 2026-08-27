-- Admin
ALTER TABLE admin.languages ADD CONSTRAINT languages_status_check CHECK (status IN ('ACTIVE', 'INACTIVE'));
ALTER TABLE admin.languages ADD CONSTRAINT languages_direction_check CHECK (direction IN ('LTR', 'RTL'));
ALTER TABLE admin.system_configuration ADD CONSTRAINT sysconfig_value_type_check CHECK (value_type IN ('STRING', 'INTEGER', 'BOOLEAN', 'JSON'));

-- Registry
ALTER TABLE registry.pages ADD CONSTRAINT pages_status_check CHECK (status IN ('ACTIVE', 'DEPRECATED'));
ALTER TABLE registry.tags ADD CONSTRAINT tags_status_check CHECK (status IN ('ACTIVE', 'DEPRECATED'));

-- Content
ALTER TABLE content.english_copies ADD CONSTRAINT ec_status_check CHECK (status IN ('NO_COPY', 'DRAFT', 'PENDING_REVIEW', 'APPROVED'));
ALTER TABLE content.english_copy_versions ADD CONSTRAINT ecv_status_check CHECK (status IN ('DRAFT', 'PENDING_REVIEW', 'APPROVED', 'SUPERSEDED', 'REJECTED'));

-- Translation
ALTER TABLE translation.translations ADD CONSTRAINT tr_status_check CHECK (status IN ('NO_TRANSLATION', 'DRAFT', 'PENDING_REVIEW', 'APPROVED', 'STALE'));
ALTER TABLE translation.translation_versions ADD CONSTRAINT tv_status_check CHECK (status IN ('DRAFT', 'PENDING_REVIEW', 'APPROVED', 'SUPERSEDED', 'REJECTED'));
ALTER TABLE translation.translation_versions ADD CONSTRAINT tv_creation_method_check CHECK (creation_method IN ('MANUAL', 'AI_GENERATED', 'MIGRATED'));

-- Publishing
ALTER TABLE publishing.publishing_approval_requests ADD CONSTRAINT par_status_check CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED', 'CANCELLED', 'EXPIRED'));
ALTER TABLE publishing.releases ADD CONSTRAINT releases_status_check CHECK (status IN ('PENDING', 'IN_PROGRESS', 'SUCCESSFUL', 'FAILED', 'ROLLED_BACK'));
ALTER TABLE publishing.releases ADD CONSTRAINT releases_type_check CHECK (release_type IN ('PUBLISH', 'ROLLBACK'));
ALTER TABLE publishing.releases ADD CONSTRAINT releases_trigger_check CHECK (trigger_source IN ('USER_INITIATED', 'SYSTEM:AUTO_PUBLISH', 'SYSTEM:MIGRATION'));

-- System Ops
ALTER TABLE system_ops.notifications ADD CONSTRAINT notif_delivery_status_check CHECK (delivery_status IN ('PENDING', 'SUCCESS', 'FAILED'));
ALTER TABLE system_ops.notifications ADD CONSTRAINT notif_status_check CHECK (status IN ('UNREAD', 'READ'));

-- Reporting
-- (Status check already defined in V009 inline)

-- Collaboration
-- (export_jobs checks already defined in V008 inline)

-- Migration
ALTER TABLE migration.import_events ADD CONSTRAINT import_status_check CHECK (status IN ('UPLOAD_READY', 'VALIDATING', 'VALIDATION_FAILED', 'PROCESSING', 'COMPLETED', 'FAILED', 'REPORT_AVAILABLE'));
ALTER TABLE migration.import_events ADD CONSTRAINT import_validation_status_check CHECK (validation_summary_status IN ('PASS', 'PASS_WITH_WARNINGS', 'FAIL'));
-- (migration_row_events checks already defined in V011 inline)
