CREATE TABLE content.english_copies (
    tag_id                  VARCHAR(150)    NOT NULL,
    status                  VARCHAR(30)     NOT NULL DEFAULT 'NO_COPY',
    current_version_number  INTEGER         NULL,
    etag_version            INTEGER         NOT NULL DEFAULT 1,
    created_at              TIMESTAMPTZ     NOT NULL DEFAULT now(),
    updated_at              TIMESTAMPTZ     NOT NULL DEFAULT now(),
    CONSTRAINT english_copies_pkey PRIMARY KEY (tag_id),
    CONSTRAINT english_copies_tag_id_fkey
        FOREIGN KEY (tag_id) REFERENCES registry.tags(tag_id)
);

CREATE TABLE content.english_copy_versions (
    tag_id                      VARCHAR(150)    NOT NULL,
    version_number              INTEGER         NOT NULL,
    text                        TEXT            NOT NULL,
    authored_by                 UUID            NOT NULL REFERENCES admin.users(user_id),
    authored_at                 TIMESTAMPTZ     NOT NULL DEFAULT now(),
    change_reason               TEXT            NULL,
    search_vector               TSVECTOR        GENERATED ALWAYS AS (
                                    to_tsvector('english', text)
                                ) STORED,
    status                      VARCHAR(30)     NOT NULL DEFAULT 'DRAFT',
    submitted_for_review_at     TIMESTAMPTZ     NULL,
    submitted_for_review_by     UUID            NULL REFERENCES admin.users(user_id),
    reviewed_by                 UUID            NULL REFERENCES admin.users(user_id),
    reviewed_at                 TIMESTAMPTZ     NULL,
    approved_by                 UUID            NULL REFERENCES admin.users(user_id),
    approved_at                 TIMESTAMPTZ     NULL,
    rejection_reason            TEXT            NULL,
    escalated_to_founder        BOOLEAN         NOT NULL DEFAULT FALSE,
    escalated_at                TIMESTAMPTZ     NULL,
    escalated_by                UUID            NULL REFERENCES admin.users(user_id),
    created_at                  TIMESTAMPTZ     NOT NULL DEFAULT now(),
    CONSTRAINT english_copy_versions_pkey PRIMARY KEY (tag_id, version_number),
    CONSTRAINT english_copy_versions_ec_fkey
        FOREIGN KEY (tag_id) REFERENCES content.english_copies(tag_id)
);
