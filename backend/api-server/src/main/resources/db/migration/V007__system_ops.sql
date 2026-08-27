CREATE TABLE system_ops.notifications (
    notification_id         UUID            NOT NULL,
    recipient_user_id       UUID            NOT NULL REFERENCES admin.users(user_id),
    event_type              VARCHAR(100)    NOT NULL,
    subject_entity_type     VARCHAR(50)     NULL,
    subject_entity_id       TEXT            NULL,
    title                   VARCHAR(500)    NOT NULL,
    body                    TEXT            NULL,
    delivery_status         VARCHAR(20)     NOT NULL DEFAULT 'PENDING',
    delivered_at            TIMESTAMPTZ     NULL,
    delivery_error          TEXT            NULL,
    status                  VARCHAR(20)     NOT NULL DEFAULT 'UNREAD',
    read_at                 TIMESTAMPTZ     NULL,
    created_at              TIMESTAMPTZ     NOT NULL DEFAULT now(),
    updated_at              TIMESTAMPTZ     NOT NULL DEFAULT now(),
    CONSTRAINT notifications_pkey PRIMARY KEY (notification_id)
);

CREATE TABLE system_ops.audit_records (
    audit_record_id         UUID            NOT NULL,
    action                  VARCHAR(100)    NOT NULL,
    subject_entity_type     VARCHAR(60)     NOT NULL,
    subject_entity_id       TEXT            NOT NULL,
    subject_entity_id_aux   TEXT            NULL,
    performed_by_user_id    UUID            NULL    REFERENCES admin.users(user_id),
    performed_by_source     VARCHAR(100)    NOT NULL DEFAULT 'USER',
    performed_at            TIMESTAMPTZ     NOT NULL DEFAULT now(),
    api_id                  VARCHAR(20)     NULL,
    request_id              UUID            NULL,
    before_state            JSONB           NULL,
    after_state             JSONB           NULL,
    detail                  TEXT            NULL,
    created_at              TIMESTAMPTZ     NOT NULL DEFAULT now(),
    CONSTRAINT audit_records_pkey PRIMARY KEY (audit_record_id)
);
