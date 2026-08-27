CREATE TABLE publishing.publishing_approval_requests (
    approval_request_id         UUID            NOT NULL,
    page_id                     VARCHAR(100)    NOT NULL REFERENCES registry.pages(page_id),
    language_code               VARCHAR(10)     NOT NULL REFERENCES admin.languages(language_code),
    environment                 VARCHAR(20)     NOT NULL,
    bundle_snapshot_hash        VARCHAR(64)     NOT NULL,
    required_approver_role      VARCHAR(10)     NOT NULL,
    requested_by                UUID            NOT NULL REFERENCES admin.users(user_id),
    status                      VARCHAR(20)     NOT NULL DEFAULT 'PENDING',
    expires_at                  TIMESTAMPTZ     NOT NULL,
    decided_by                  UUID            NULL REFERENCES admin.users(user_id),
    decided_at                  TIMESTAMPTZ     NULL,
    rejection_reason            TEXT            NULL,
    etag_version                INTEGER         NOT NULL DEFAULT 1,
    created_at                  TIMESTAMPTZ     NOT NULL DEFAULT now(),
    updated_at                  TIMESTAMPTZ     NOT NULL DEFAULT now(),
    CONSTRAINT publishing_approval_requests_pkey PRIMARY KEY (approval_request_id)
);

CREATE TABLE publishing.releases (
    release_id                      UUID            NOT NULL,
    page_id                         VARCHAR(100)    NOT NULL REFERENCES registry.pages(page_id),
    language_code                   VARCHAR(10)     NOT NULL REFERENCES admin.languages(language_code),
    environment                     VARCHAR(20)     NOT NULL,
    deployment_version              INTEGER         NOT NULL,
    release_type                    VARCHAR(20)     NOT NULL DEFAULT 'PUBLISH',
    trigger_source                  VARCHAR(30)     NOT NULL DEFAULT 'USER_INITIATED',
    rolled_back_from_deployment_version INTEGER     NULL,
    status                          VARCHAR(20)     NOT NULL DEFAULT 'PENDING',
    approval_request_id             UUID            NULL
                                    REFERENCES publishing.publishing_approval_requests(approval_request_id)
                                    DEFERRABLE INITIALLY DEFERRED,
    published_by                    UUID            NULL REFERENCES admin.users(user_id),
    published_by_source             VARCHAR(100)    NOT NULL DEFAULT 'USER',
    initiated_at                    TIMESTAMPTZ     NOT NULL DEFAULT now(),
    completed_at                    TIMESTAMPTZ     NULL,
    rolled_back_at                  TIMESTAMPTZ     NULL,
    api_response_payload            JSONB           NULL,
    api_response_success            BOOLEAN         NULL,
    created_at                      TIMESTAMPTZ     NOT NULL DEFAULT now(),
    updated_at                      TIMESTAMPTZ     NOT NULL DEFAULT now(),
    CONSTRAINT releases_pkey PRIMARY KEY (release_id),
    CONSTRAINT releases_deployment_identity_unique
        UNIQUE (page_id, language_code, environment, deployment_version)
);

CREATE TABLE publishing.release_content_snapshots (
    release_id                      UUID            NOT NULL,
    tag_id                          VARCHAR(150)    NOT NULL,
    translation_version_number      INTEGER         NOT NULL,
    source_english_version_number   INTEGER         NOT NULL,
    translation_text                TEXT            NOT NULL,
    CONSTRAINT release_content_snapshots_pkey PRIMARY KEY (release_id, tag_id),
    CONSTRAINT rcs_release_fkey
        FOREIGN KEY (release_id) REFERENCES publishing.releases(release_id),
    CONSTRAINT rcs_tag_fkey
        FOREIGN KEY (tag_id) REFERENCES registry.tags(tag_id)
);
