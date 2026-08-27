CREATE TABLE reporting.coverage_metrics (
    page_id                     VARCHAR(100)    NOT NULL,
    language_code               VARCHAR(10)     NOT NULL,
    active_tag_count            INTEGER         NOT NULL DEFAULT 0,
    deployed_tag_count          INTEGER         NOT NULL DEFAULT 0,
    stale_deployed_count        INTEGER         NOT NULL DEFAULT 0,
    approved_not_deployed_count INTEGER         NOT NULL DEFAULT 0,
    coverage_percentage         NUMERIC(5,2)    NOT NULL DEFAULT 0.00,
    current_live_release_id     UUID            NULL,
    current_live_deployment_version INTEGER     NULL,
    last_computed_at            TIMESTAMPTZ     NOT NULL DEFAULT now(),
    computation_status          VARCHAR(20)     NOT NULL DEFAULT 'PENDING',
    computation_error           TEXT            NULL,
    created_at                  TIMESTAMPTZ     NOT NULL DEFAULT now(),
    updated_at                  TIMESTAMPTZ     NOT NULL DEFAULT now(),
    CONSTRAINT coverage_metrics_pkey PRIMARY KEY (page_id, language_code),
    CONSTRAINT coverage_metrics_page_fkey
        FOREIGN KEY (page_id) REFERENCES registry.pages(page_id),
    CONSTRAINT coverage_metrics_language_fkey
        FOREIGN KEY (language_code) REFERENCES admin.languages(language_code)
);
