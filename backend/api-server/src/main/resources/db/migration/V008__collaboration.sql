CREATE TABLE collaboration.comments (
    comment_id          UUID            NOT NULL,
    tag_id              VARCHAR(150)    NOT NULL REFERENCES registry.tags(tag_id),
    comment_scope       VARCHAR(20)     NOT NULL DEFAULT 'TAG',
    language_code       VARCHAR(10)     NULL REFERENCES admin.languages(language_code),
    comment_text        TEXT            NOT NULL,
    author_id           UUID            NOT NULL REFERENCES admin.users(user_id),
    is_resolved         BOOLEAN         NOT NULL DEFAULT FALSE,
    resolved_at         TIMESTAMPTZ     NULL,
    resolved_by         UUID            NULL REFERENCES admin.users(user_id),
    created_at          TIMESTAMPTZ     NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ     NOT NULL DEFAULT now(),
    CONSTRAINT comments_pkey PRIMARY KEY (comment_id)
);

CREATE TABLE collaboration.export_jobs (
    export_job_id           UUID            NOT NULL,
    page_id                 VARCHAR(100)    NOT NULL REFERENCES registry.pages(page_id),
    language_code           VARCHAR(10)     NOT NULL REFERENCES admin.languages(language_code),
    format                  VARCHAR(10)     NOT NULL,
    requested_by            UUID            NOT NULL REFERENCES admin.users(user_id),
    status                  VARCHAR(15)     NOT NULL DEFAULT 'GENERATING',
    dataset_capture_at      TIMESTAMPTZ     NULL,
    row_count               INTEGER         NULL,
    generated_at            TIMESTAMPTZ     NULL,
    file_reference_url      TEXT            NULL,
    expires_at              TIMESTAMPTZ     NULL,
    failure_reason          TEXT            NULL,
    request_id              UUID            NULL,
    created_at              TIMESTAMPTZ     NOT NULL DEFAULT now(),
    updated_at              TIMESTAMPTZ     NOT NULL DEFAULT now(),
    CONSTRAINT export_jobs_pkey PRIMARY KEY (export_job_id)
);
