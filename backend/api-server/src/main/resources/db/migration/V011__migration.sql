CREATE TABLE migration.import_events (
    import_event_id             UUID            NOT NULL,
    status                      VARCHAR(30)     NOT NULL,
    file_reference_url          TEXT            NULL,
    original_filename           VARCHAR(500)    NOT NULL,
    file_size_bytes             BIGINT          NOT NULL,
    initiated_by                UUID            NOT NULL REFERENCES admin.users(user_id),
    initiated_at                TIMESTAMPTZ     NOT NULL DEFAULT now(),
    processing_started_at       TIMESTAMPTZ     NULL,
    completed_at                TIMESTAMPTZ     NULL,
    pages_attempted             INTEGER         NOT NULL DEFAULT 0,
    pages_succeeded             INTEGER         NOT NULL DEFAULT 0,
    pages_failed                INTEGER         NOT NULL DEFAULT 0,
    tags_imported               INTEGER         NOT NULL DEFAULT 0,
    translations_imported       INTEGER         NOT NULL DEFAULT 0,
    validation_report           JSONB           NULL,
    error_summary               TEXT            NULL,
    etag_version                INTEGER         NOT NULL DEFAULT 1,
    created_at                  TIMESTAMPTZ     NOT NULL DEFAULT now(),
    updated_at                  TIMESTAMPTZ     NOT NULL DEFAULT now(),
    
    executed_by                 UUID            NULL REFERENCES admin.users(user_id),
    file_format                 VARCHAR(10)     NOT NULL DEFAULT 'CSV',
    file_checksum_sha256        VARCHAR(64)     NULL,
    detected_language_columns   JSONB           NULL,
    structural_validation_result JSONB          NULL,
    failure_reason              TEXT            NULL,
    file_expires_at             TIMESTAMPTZ     NULL,
    report_generated_at         TIMESTAMPTZ     NULL,
    
    validation_summary_status   VARCHAR(20)     NULL,
    tags_expected               INTEGER         NOT NULL DEFAULT 0,
    translations_expected       INTEGER         NOT NULL DEFAULT 0,
    discrepancy_count           INTEGER         NOT NULL DEFAULT 0,
    
    CONSTRAINT import_events_pkey PRIMARY KEY (import_event_id)
);

CREATE TABLE migration.migration_row_events (
    row_event_id            UUID            NOT NULL,
    import_event_id         UUID            NOT NULL REFERENCES migration.import_events(import_event_id),
    source_row_number       INTEGER         NOT NULL,
    source_page_id          VARCHAR(100)    NULL,
    source_tag_id           VARCHAR(150)    NULL,
    source_language_code    VARCHAR(10)     NULL,
    event_type              VARCHAR(10)     NOT NULL DEFAULT 'SKIPPED',
    reason_code             VARCHAR(60)     NOT NULL,
    reason_detail           TEXT            NULL,
    recorded_at             TIMESTAMPTZ     NOT NULL DEFAULT now(),
    CONSTRAINT migration_row_events_pkey PRIMARY KEY (row_event_id)
);
