CREATE TABLE search.bookmarks (
    bookmark_id         UUID            NOT NULL,
    user_id             UUID            NOT NULL REFERENCES admin.users(user_id),
    target_type         VARCHAR(10)     NOT NULL,
    target_id           TEXT            NOT NULL,
    created_at          TIMESTAMPTZ     NOT NULL DEFAULT now(),
    CONSTRAINT bookmarks_pkey PRIMARY KEY (bookmark_id),
    CONSTRAINT bookmarks_user_target_unique
        UNIQUE (user_id, target_type, target_id)
);

CREATE TABLE search.recently_edited_events (
    recently_edited_id  UUID            NOT NULL,
    user_id             UUID            NOT NULL REFERENCES admin.users(user_id),
    target_type         VARCHAR(20)     NOT NULL,
    target_id           TEXT            NOT NULL,
    last_accessed_at    TIMESTAMPTZ     NOT NULL DEFAULT now(),
    created_at          TIMESTAMPTZ     NOT NULL DEFAULT now(),
    CONSTRAINT recently_edited_events_pkey PRIMARY KEY (recently_edited_id),
    CONSTRAINT recently_edited_events_unique
        UNIQUE (user_id, target_type, target_id)
);
