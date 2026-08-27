CREATE TABLE registry.pages (
    page_id             VARCHAR(100)    NOT NULL,
    page_name           VARCHAR(255)    NOT NULL,
    module              VARCHAR(100)    NULL,
    status              VARCHAR(20)     NOT NULL DEFAULT 'ACTIVE',
    created_by          UUID            NOT NULL REFERENCES admin.users(user_id),
    etag_version        INTEGER         NOT NULL DEFAULT 1,
    created_at          TIMESTAMPTZ     NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ     NOT NULL DEFAULT now(),
    CONSTRAINT pages_pkey PRIMARY KEY (page_id)
);

CREATE TABLE registry.tags (
    tag_id              VARCHAR(150)    NOT NULL,
    page_id             VARCHAR(100)    NOT NULL,
    copy_type           VARCHAR(100)    NULL,
    status              VARCHAR(20)     NOT NULL DEFAULT 'ACTIVE',
    search_vector       TSVECTOR        GENERATED ALWAYS AS (
                            to_tsvector('simple', tag_id)
                        ) STORED,
    created_by          UUID            NOT NULL REFERENCES admin.users(user_id),
    etag_version        INTEGER         NOT NULL DEFAULT 1,
    created_at          TIMESTAMPTZ     NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ     NOT NULL DEFAULT now(),
    CONSTRAINT tags_pkey PRIMARY KEY (tag_id),
    CONSTRAINT tags_page_id_fkey
        FOREIGN KEY (page_id) REFERENCES registry.pages(page_id)
);
