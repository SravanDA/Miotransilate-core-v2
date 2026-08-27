CREATE TABLE admin.users (
    user_id             UUID            NOT NULL,
    display_name        VARCHAR(255)    NOT NULL,
    email               VARCHAR(320)    NOT NULL,
    external_auth_id    VARCHAR(512)    NULL,
    is_active           BOOLEAN         NOT NULL DEFAULT TRUE,
    created_at          TIMESTAMPTZ     NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ     NOT NULL DEFAULT now(),
    CONSTRAINT users_pkey PRIMARY KEY (user_id),
    CONSTRAINT users_email_unique UNIQUE (email)
);

CREATE TABLE admin.languages (
    language_code       VARCHAR(10)     NOT NULL,
    language_name       VARCHAR(100)    NOT NULL,
    direction           VARCHAR(3)      NOT NULL DEFAULT 'LTR',
    status              VARCHAR(20)     NOT NULL DEFAULT 'ACTIVE',
    added_by            UUID            NOT NULL REFERENCES admin.users(user_id),
    created_at          TIMESTAMPTZ     NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ     NOT NULL DEFAULT now(),
    CONSTRAINT languages_pkey PRIMARY KEY (language_code)
);

CREATE TABLE admin.user_role_assignments (
    assignment_id       UUID            NOT NULL,
    user_id             UUID            NOT NULL REFERENCES admin.users(user_id),
    role                VARCHAR(10)     NOT NULL,
    assigned_by         UUID            NOT NULL REFERENCES admin.users(user_id),
    assigned_at         TIMESTAMPTZ     NOT NULL DEFAULT now(),
    revoked_at          TIMESTAMPTZ     NULL,
    revoked_by          UUID            NULL     REFERENCES admin.users(user_id),
    created_at          TIMESTAMPTZ     NOT NULL DEFAULT now(),
    CONSTRAINT user_role_assignments_pkey PRIMARY KEY (assignment_id)
);

CREATE TABLE admin.system_configuration (
    config_key          VARCHAR(100)    NOT NULL,
    config_value        TEXT            NOT NULL,
    value_type          VARCHAR(20)     NOT NULL DEFAULT 'STRING',
    description         TEXT            NULL,
    updated_by          UUID            NOT NULL REFERENCES admin.users(user_id),
    etag_version        INTEGER         NOT NULL DEFAULT 1,
    created_at          TIMESTAMPTZ     NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ     NOT NULL DEFAULT now(),
    CONSTRAINT system_configuration_pkey PRIMARY KEY (config_key)
);
