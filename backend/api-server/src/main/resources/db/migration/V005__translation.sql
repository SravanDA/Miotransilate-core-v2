CREATE TABLE translation.translations (
    tag_id                          VARCHAR(150)    NOT NULL,
    language_code                   VARCHAR(10)     NOT NULL,
    status                          VARCHAR(30)     NOT NULL DEFAULT 'NO_TRANSLATION',
    current_version_number          INTEGER         NULL,
    stale_triggered_at              TIMESTAMPTZ     NULL,
    stale_triggered_by_english_ver  INTEGER         NULL,
    stale_prior_confirmed_ec_ver    INTEGER         NULL,
    stale_current_english_text      TEXT            NULL,
    stale_previous_english_text     TEXT            NULL,
    etag_version                    INTEGER         NOT NULL DEFAULT 1,
    created_at                      TIMESTAMPTZ     NOT NULL DEFAULT now(),
    updated_at                      TIMESTAMPTZ     NOT NULL DEFAULT now(),
    CONSTRAINT translations_pkey PRIMARY KEY (tag_id, language_code),
    CONSTRAINT translations_tag_id_fkey
        FOREIGN KEY (tag_id) REFERENCES registry.tags(tag_id),
    CONSTRAINT translations_language_code_fkey
        FOREIGN KEY (language_code) REFERENCES admin.languages(language_code)
);

CREATE TABLE translation.translation_versions (
    tag_id                          VARCHAR(150)    NOT NULL,
    language_code                   VARCHAR(10)     NOT NULL,
    version_number                  INTEGER         NOT NULL,
    text                            TEXT            NOT NULL,
    creation_method                 VARCHAR(20)     NOT NULL,
    source_english_version          INTEGER         NOT NULL,
    confidence_score                NUMERIC(5,4)    NULL,
    back_translation                TEXT            NULL,
    variable_integrity_status       VARCHAR(20)     NOT NULL DEFAULT 'NOT_CHECKED',
    change_reason                   TEXT            NULL,
    authored_by                     UUID            NULL REFERENCES admin.users(user_id),
    authored_by_source              VARCHAR(100)    NOT NULL DEFAULT 'USER',
    authored_at                     TIMESTAMPTZ     NOT NULL DEFAULT now(),
    status                          VARCHAR(30)     NOT NULL DEFAULT 'DRAFT',
    submitted_for_review_at         TIMESTAMPTZ     NULL,
    submitted_for_review_by         UUID            NULL REFERENCES admin.users(user_id),
    reviewed_by                     UUID            NULL REFERENCES admin.users(user_id),
    reviewed_at                     TIMESTAMPTZ     NULL,
    approved_by                     UUID            NULL REFERENCES admin.users(user_id),
    approved_at                     TIMESTAMPTZ     NULL,
    rejection_reason                TEXT            NULL,
    created_at                      TIMESTAMPTZ     NOT NULL DEFAULT now(),
    CONSTRAINT translation_versions_pkey PRIMARY KEY (tag_id, language_code, version_number),
    CONSTRAINT translation_versions_translation_fkey
        FOREIGN KEY (tag_id, language_code)
        REFERENCES translation.translations(tag_id, language_code),
    CONSTRAINT translation_versions_source_ec_fkey
        FOREIGN KEY (tag_id, source_english_version)
        REFERENCES content.english_copy_versions(tag_id, version_number)
        DEFERRABLE INITIALLY DEFERRED
);
