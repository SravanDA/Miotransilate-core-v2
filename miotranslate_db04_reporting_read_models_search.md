# MioTranslate — DB-04: Reporting, Read Models & Search Schema

**Product:** MioTranslate  
**Document Type:** Database Design — Layer 4 (Reporting, Read Models & Search)  
**Document ID:** DB-04  
**Version:** 1.0  
**Author:** Principal Database Architect + Senior Data/Read-Model Architect  
**Date:** August 2026  
**Mandatory Standards Reference:** DB-01 v1.0  
**Direct Predecessor:** DB-03 v1.0  
**Entity Model Sources:** ED-01 v1.1, ED-02 v1.0, ED-03 v1.0

---

> **Purpose of this document.**  
> DB-04 defines the physical persistence and query structures that serve MioTranslate's reporting, dashboarding, search, and user-navigation features. Every structure here is derived from the source-of-truth tables in DB-02 and DB-03. Source tables are never modified by this document.
>
> **Core principle (from DB-01 §18):** Derived models are never authoritative inputs to business rules. They exist for read performance and aggregation convenience only. Every derived model must be rebuildable from its source tables.
>
> **Scope of DB-04:**
> - `reporting.coverage_metrics` — the one new denormalized derived table
> - `search.recently_edited_events` — the view-event store for Recently Viewed/Edited
> - Resolution of DB-02-OI-05 — search index strategy for approved-vs-all English text
> - Live query definitions and index requirements for all Group 6 and Group 7 APIs that do not require a derived table
> - New indexes added on existing DB-02 tables to support Group 6/7 query patterns
>
> **Scope exclusions:** Export jobs, collaboration tables, administration schema supplementary, migration operational storage — belong in later DB documents.

---

## Table of Contents

1. Read Model Decision Matrix
2. `reporting.coverage_metrics` — Derived Table
   - 2.1 Coverage Semantics (Denominator, Numerator, Stale-But-Covered)
   - 2.2 Table Definition
   - 2.3 Coverage Computation SQL
   - 2.4 Refresh Triggers and Incremental Update Strategy
   - 2.5 Full Rebuild Strategy
   - 2.6 Computation Failure Handling
   - 2.7 Freshness Semantics for API Consumers
   - 2.8 Indexes
3. Environment Status — Live Query Model
4. Review Queue — Live Query Model
   - 4.1 Query Patterns per Role
   - 4.2 Supporting Indexes (from DB-02)
5. Pending Work Summary — Live Query Model
6. Activity Timeline — Live Query over Audit Records
7. Global Search — Physical Search Architecture
   - 7.1 Resolution of DB-02-OI-05 (Approved-Only vs. All-Version Search)
   - 7.2 Tag ID and Page Name Identifier Search
   - 7.3 Unified Search Query Architecture
   - 7.4 New Partial GIN Index for Approved English Text
   - 7.5 Search Result Ranking
   - 7.6 Scale Assessment — No External Search Engine at v1
8. `search.recently_edited_events` — View-Event Store
   - 8.1 Table Definition
   - 8.2 Write Pattern (Upsert on Every Page View)
   - 8.3 Retention and Cleanup
   - 8.4 Recently-Edited API Response Assembly
9. Bookmarks — Reference to DB-02
10. New Indexes Added in DB-04
11. Read Model Source-to-API Traceability
12. Consistency Audit

---

## 1. Read Model Decision Matrix

The single most important design decision in DB-04 is choosing between **live query**, **materialized view**, and **denormalized table** for each feature. The decision matrix below documents the outcome and rationale for every Group 6 and Group 7 API.

| API | Feature | Decision | Rationale |
|---|---|---|---|
| API-0601/0602 | Coverage Metrics | **Denormalized table** (`reporting.coverage_metrics`) | Multi-table aggregation (tags + translations + releases + snapshots); requires freshness timestamp; has a failure state; event-driven incremental recalculation preferred over full recompute on every read. |
| API-0401/0402 | Environment Status | **Live query** over `publishing.releases` | 89 pages × 8 languages × 3 environments = max 2,136 cells. `idx_releases_scope_successful` makes this trivially fast. No derived state beyond what releases already hold. |
| API-0606 | Review Queue | **Live query** across 3 tables | Review state changes frequently. Any materialized view would be stale within seconds during active work. Existing partial indexes on `status` columns are sufficient. |
| API-0604 | Pending Work Summary | **Live query** with aggregation | 4,500 tags × 8 languages at max. All dimensions indexed. No persistence needed — count queries with `WHERE status IN (...)` are fast. |
| API-0605 | Activity Timeline | **Live query** over `system_ops.audit_records` | Audit table already has `idx_audit_performed_at`, `idx_audit_subject`, `idx_audit_user`. No separate activity table needed. Materializing the audit stream would create a second audit source and violate the single-source principle. |
| API-0701 | Global Search | **Live query** over GIN indexes + B-tree prefix indexes | ~4,500 tags at v1. PostgreSQL GIN on `search_vector` is fast enough with no separate search index table. Three-branch UNION query. |
| API-0705 | Recently Edited | **Live query** over `system_ops.audit_records` | Write events (edits) come from audit records. `idx_audit_user` + `idx_audit_subject` support efficient per-user filtering. |
| API-0706 | Recently Viewed | **Denormalized table** (`search.recently_edited_events`) | Page views are NOT in audit records (they are read events, not mutations). Require a dedicated event store. Upsert-per-visit pattern with last-accessed timestamp. |
| API-0702/0703/0704 | Bookmarks | **Defined in DB-02** (`search.bookmarks`) | Already complete. Referenced here for traceability. |
| API-0603 | Stale Translations | **Live query** over `translation.translations` | Stale state is primary state in the transactional table. `idx_translations_stale` (PARTIAL: `status='STALE'`) is the primary index. |

**Decision rules applied (from DB-01 §18):**
1. If the data is already indexed and selectively queryable in source tables → **live query**
2. If the query requires multi-table aggregation + stores freshness state + has a failure mode → **denormalized table**
3. If the data volume × query latency exceeds acceptable range → **materialized view** (none required at v1 scale)
4. If the event stream is not captured in any source table → **dedicated event store**

---

## 2. `reporting.coverage_metrics` — Derived Table

**Classification:** `DERIVED_READ_MODEL`  
**FRD Reference:** §F-10 (Coverage visibility), §5.6 (Coverage computation triggers)  
**Entity Model:** ED-01 §CoverageMetrics  
**ED-03 Contract:** §2.15  
**DB-01 Reference:** §18.3 (Coverage Metrics), OQ-4 (materialization strategy resolution)  
**DB-02 Open Item:** DB-02-OI-03 (deferred from DB-02)  
**Schema:** `reporting`

### 2.1 Coverage Semantics

**The coverage formula must implement these exact business rules:**

**Denominator — `active_tag_count`:**  
Active tags for this page that have an APPROVED English Copy version.  
- `registry.tags.status = 'ACTIVE'` AND `content.english_copies.status = 'APPROVED'`
- Tags in `NO_COPY`, `DRAFT`, `PENDING_REVIEW` English copy state are excluded from the denominator — they are not yet translatable
- Deprecated tags are excluded

**Numerator — `deployed_tag_count`:**  
Tags from the denominator that appear in the content snapshot of the most recent SUCCESSFUL (non-ROLLED_BACK) PRODUCTION release for this (page_id, language_code).
- Source: `publishing.release_content_snapshots` joined to the current live release
- "Current live release" = most recent `publishing.releases` WHERE `page_id = $1 AND language_code = $2 AND environment = 'PRODUCTION' AND status = 'SUCCESSFUL'` ORDER BY `deployment_version DESC LIMIT 1`
- Tags that were added to the page AFTER the last release are not in the snapshot → uncovered
- A tag in the snapshot but since deprecated: still counted as covered (it was deployed; deprecation is a registry change, not a deployment rollback)

**Stale-but-covered — `stale_deployed_count`:**  
Of the deployed tags: those where `translation.translations.status = 'STALE'`.  
These are covered (the old approved text was deployed) but their content is no longer current.  
They count toward the covered numerator, not against it.

**Approved-not-deployed — `approved_not_deployed_count`:**  
Tags in the denominator with `translation.translations.status = 'APPROVED'` AND NOT in the current live release snapshot.  
These are "ready but waiting" — translation approved but no PRODUCTION release has included them yet.

**No-translation — computed, not stored:**  
`active_tag_count - deployed_tag_count - approved_not_deployed_count - in_progress_count`  
Not stored as a separate field. Computable from the stored fields.

**In-progress — `in_progress_count`:**  
Tags in the denominator with `translation.translations.status IN ('DRAFT', 'PENDING_REVIEW', 'NO_TRANSLATION', 'REJECTED')`.  
Computed as: `active_tag_count - deployed_tag_count - approved_not_deployed_count`

**Rollback behavior:**  
When a release is rolled back (`status = 'ROLLED_BACK'`), the "current live release" query automatically skips it (it is no longer `status = 'SUCCESSFUL'`). The prior SUCCESSFUL release becomes current. Coverage is recomputed against the prior release's snapshot. A tag that was first deployed in the rolled-back release is no longer "covered" after rollback — this is correct product behavior.

**No release yet — zero coverage:**  
If no SUCCESSFUL PRODUCTION release exists for (page_id, language_code), the current live release is NULL. `deployed_tag_count = 0`. Coverage = 0%.

### 2.2 Table Definition

```sql
CREATE TABLE reporting.coverage_metrics (
    -- Scope identity
    page_id                     VARCHAR(100)    NOT NULL,
    language_code               VARCHAR(10)     NOT NULL,

    -- Denominator
    active_tag_count            INTEGER         NOT NULL DEFAULT 0,
    -- Active tags with APPROVED English Copy

    -- Numerator: deployed content
    deployed_tag_count          INTEGER         NOT NULL DEFAULT 0,
    -- Tags in the current live PRODUCTION release snapshot (still ACTIVE)

    -- Breakdowns (sum to explain the gap between denominator and deployed)
    stale_deployed_count        INTEGER         NOT NULL DEFAULT 0,
    -- Of deployed_tag_count: how many have translation.status = 'STALE'
    -- These count as covered; sub-count for visibility only

    approved_not_deployed_count INTEGER         NOT NULL DEFAULT 0,
    -- Approved translation exists but not yet in any PRODUCTION release

    -- Computed coverage percentage
    coverage_percentage         NUMERIC(5,2)    NOT NULL DEFAULT 0.00,
    -- (deployed_tag_count / NULLIF(active_tag_count, 0)) * 100
    -- 100.00 at most; 0.00 when no active tags or no deployments

    -- Lineage reference: which release was used as the coverage snapshot base
    current_live_release_id     UUID            NULL,
    -- NULL when no SUCCESSFUL PRODUCTION release exists for this scope
    -- NOT a FK — releases are in a different schema; see §2.2 FK note

    current_live_deployment_version INTEGER     NULL,
    -- The deployment_version of current_live_release_id for human readability

    -- Freshness tracking
    last_computed_at            TIMESTAMPTZ     NOT NULL DEFAULT now(),
    computation_status          VARCHAR(20)     NOT NULL DEFAULT 'PENDING',
    -- PENDING: row just created, never computed
    -- CURRENT: computed and fresh
    -- STALE: source data has changed; scheduled for recompute
    -- COMPUTING: recalculation job is currently running
    -- FAILED: last computation attempt threw an error

    computation_error           TEXT            NULL,
    -- Non-NULL only when computation_status = 'FAILED'

    -- Timestamps
    created_at                  TIMESTAMPTZ     NOT NULL DEFAULT now(),
    updated_at                  TIMESTAMPTZ     NOT NULL DEFAULT now(),

    -- Constraints
    CONSTRAINT coverage_metrics_pkey PRIMARY KEY (page_id, language_code),
    CONSTRAINT coverage_metrics_page_fkey
        FOREIGN KEY (page_id) REFERENCES registry.pages(page_id),
    CONSTRAINT coverage_metrics_language_fkey
        FOREIGN KEY (language_code) REFERENCES admin.languages(language_code),
    CONSTRAINT coverage_metrics_status_check
        CHECK (computation_status IN (
            'PENDING', 'CURRENT', 'STALE', 'COMPUTING', 'FAILED'
        )),
    CONSTRAINT coverage_metrics_percentage_range
        CHECK (coverage_percentage >= 0.00 AND coverage_percentage <= 100.00),
    CONSTRAINT coverage_metrics_count_consistency
        CHECK (
            deployed_tag_count <= active_tag_count AND
            stale_deployed_count <= deployed_tag_count AND
            approved_not_deployed_count <= active_tag_count
        )
);

COMMENT ON TABLE reporting.coverage_metrics IS
    'DERIVED_READ_MODEL: Denormalized per-(page_id, language_code) coverage summary. '
    'Source of truth: registry.tags, content.english_copies, translation.translations, '
    'publishing.releases, publishing.release_content_snapshots. '
    'Never written directly by business APIs. Written only by the coverage recalculation '
    'worker (API-0503 trigger). Must be rebuildable from source tables at any time. '
    'Rows are created when a Language is activated (one row per page × language). '
    'Never deleted — set computation_status = STALE if the scope becomes inactive.';

COMMENT ON COLUMN reporting.coverage_metrics.deployed_tag_count IS
    'Tags from the denominator (active + approved EC) that appear in the content snapshot '
    'of the most recent SUCCESSFUL PRODUCTION release for this page × language. '
    'Stale-but-deployed translations count as covered. '
    'This is the numerator of coverage_percentage.';

COMMENT ON COLUMN reporting.coverage_metrics.current_live_release_id IS
    'UUID of the publishing.releases row used as the coverage baseline. '
    'NULL when no SUCCESSFUL PRODUCTION release exists. '
    'Not a database-enforced FK because: (1) release schema is separate; '
    '(2) releases are never deleted, so the reference is always valid; '
    '(3) adding an FK would require a cross-schema FK with deferred checking. '
    'Application code must validate consistency during recalculation.';

COMMENT ON COLUMN reporting.coverage_metrics.computation_status IS
    'PENDING: initial state; row created but computation not yet run. '
    'CURRENT: last computation succeeded and no source data has changed since. '
    'STALE: source data has changed (trigger fired); recomputation scheduled. '
    'COMPUTING: worker has claimed this row; prevents concurrent recomputation. '
    'FAILED: last computation threw an error; computation_error has details. '
    'FAILED rows are retried on the next scheduled full recompute cycle.';
```

**Triggers:**
```sql
CREATE TRIGGER coverage_metrics_set_updated_at
    BEFORE UPDATE ON reporting.coverage_metrics
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- No raise_on_delete() — coverage rows may be purged if a language is
-- fully removed, though this is extremely rare. Language deactivation
-- does NOT delete coverage rows (it sets them STALE).
```

**FK Note on `current_live_release_id`:** This field intentionally lacks a database FK to `publishing.releases`. Reasons: (1) Releases are never deleted — no dangling reference risk. (2) Adding a cross-schema FK creates a circular dependency on the read layer referencing the write layer. (3) The computation job validates the release_id during calculation. This is a documented exception to the FK rule (DB-01 §5.2 Pattern B: application-enforced cross-domain reference where DB FK is not practical).

### 2.3 Coverage Computation SQL

The following SQL computes a single (page_id, language_code) coverage cell. It is executed by the coverage recalculation worker.

```sql
-- Step 1: Find the current live PRODUCTION release for this scope
WITH current_live AS (
    SELECT r.release_id, r.deployment_version
    FROM publishing.releases r
    WHERE r.page_id          = $page_id
      AND r.language_code    = $language_code
      AND r.environment      = 'PRODUCTION'
      AND r.status           = 'SUCCESSFUL'
    ORDER BY r.deployment_version DESC
    LIMIT 1
),

-- Step 2: Find all ACTIVE tags with APPROVED English Copy (denominator)
denominator AS (
    SELECT t.tag_id
    FROM registry.tags t
    JOIN content.english_copies ec ON ec.tag_id = t.tag_id
    WHERE t.page_id   = $page_id
      AND t.status    = 'ACTIVE'
      AND ec.status   = 'APPROVED'
),

-- Step 3: Find tags in the current live release snapshot (numerator)
-- Only denominator tags — tags deprecated since the release are excluded
deployed AS (
    SELECT rcs.tag_id
    FROM publishing.release_content_snapshots rcs
    JOIN current_live cl ON cl.release_id = rcs.release_id
    WHERE rcs.tag_id IN (SELECT tag_id FROM denominator)
    -- NOTE: rcs contains ALL tags in the snapshot; joining with denominator
    -- ensures deprecated-since-release tags are excluded from the count
),

-- Step 4: Find stale-but-deployed tags
stale_deployed AS (
    SELECT d.tag_id
    FROM deployed d
    JOIN translation.translations tr ON tr.tag_id = d.tag_id
                                    AND tr.language_code = $language_code
    WHERE tr.status = 'STALE'
),

-- Step 5: Find approved-not-deployed tags
approved_not_deployed AS (
    SELECT dn.tag_id
    FROM denominator dn
    LEFT JOIN deployed dep ON dep.tag_id = dn.tag_id
    JOIN translation.translations tr ON tr.tag_id = dn.tag_id
                                    AND tr.language_code = $language_code
    WHERE dep.tag_id IS NULL            -- not in current deployed set
      AND tr.status  = 'APPROVED'
)

-- Final aggregation
SELECT
    (SELECT COUNT(*) FROM denominator)             AS active_tag_count,
    (SELECT COUNT(*) FROM deployed)                AS deployed_tag_count,
    (SELECT COUNT(*) FROM stale_deployed)          AS stale_deployed_count,
    (SELECT COUNT(*) FROM approved_not_deployed)   AS approved_not_deployed_count,
    (SELECT release_id FROM current_live)          AS current_live_release_id,
    (SELECT deployment_version FROM current_live)  AS current_live_deployment_version,
    CASE
        WHEN (SELECT COUNT(*) FROM denominator) = 0 THEN 0.00
        ELSE ROUND(
            (SELECT COUNT(*) FROM deployed)::NUMERIC
            / (SELECT COUNT(*) FROM denominator)::NUMERIC * 100,
            2
        )
    END AS coverage_percentage;
```

**This query runs in the `reporting.recalculate_coverage($page_id, $language_code)` function.** The worker calls this function, then UPDATEs `reporting.coverage_metrics` with the result.

### 2.4 Refresh Triggers and Incremental Update Strategy

**Event-driven incremental refresh (OQ-4 resolution from DB-01 §18.3):** Only the affected (page_id, language_code) cell is recomputed, not the entire table. A full recompute runs as a nightly maintenance job for consistency validation.

**Events that trigger coverage recomputation:**

| Trigger Event | API | Affected Scope | What Changes |
|---|---|---|---|
| English Copy approved for the first time (NO_COPY → APPROVED) | API-0203 | `(tag.page_id, ALL active languages)` | Denominator increases |
| Translation approved (APPROVED status set) | API-0304 | `(tag.page_id, translation.language_code)` | `approved_not_deployed_count` increases |
| PRODUCTION release succeeds | API-0405 callback | `(release.page_id, release.language_code)` | Numerator may increase; `approved_not_deployed_count` may decrease |
| PRODUCTION release rolled back | API-0407 | `(release.page_id, release.language_code)` | Numerator may decrease |
| Tag deprecated | API-0107 | `(tag.page_id, ALL active languages)` | Denominator decreases |
| Language deactivated | API-0803 | `(ALL pages, language_code)` | Entire language column set to STALE |
| New language activated | API-0803 | `(ALL pages, new language_code)` | New rows created in coverage_metrics |

**The recomputation is NOT triggered:**
- By Translation stale-flagging (API-0501) — stale translations still count as covered; the stale_deployed_count breakdown updates, but `coverage_percentage` does not change. This is a deliberate design choice: staleness is not the same as uncovered.
- By DEV or QA releases — coverage is PRODUCTION-only

**Incremental update mechanism:**

```
1. Business API (e.g., API-0405 release success callback) completes its primary transaction.
2. After committing, the API service enqueues a coverage recalculation job for the affected scope.
   (Not in the primary transaction — decoupled to avoid slowing the response path.)
3. Worker picks up the job:
   a. UPDATE reporting.coverage_metrics
      SET computation_status = 'COMPUTING'
      WHERE page_id = $1 AND language_code = $2
        AND computation_status != 'COMPUTING';  -- idempotency guard
   b. Run the §2.3 computation SQL.
   c. UPDATE reporting.coverage_metrics SET
        active_tag_count = ..., deployed_tag_count = ..., ...,
        computation_status = 'CURRENT',
        last_computed_at = now()
      WHERE page_id = $1 AND language_code = $2;
4. If step b or c throws an error:
   a. UPDATE computation_status = 'FAILED', computation_error = $error_message
   b. Log the failure for the nightly recompute job to pick up.
```

**Concurrent worker protection:** The `computation_status = 'COMPUTING'` check (step 3a) uses an `AND computation_status != 'COMPUTING'` predicate. If two workers race, one UPDATE wins and the other's UPDATE affects 0 rows (it reads the COMPUTING status and backs off). This requires a `SELECT ... FOR UPDATE` in the worker before setting COMPUTING, or a `UPDATE ... RETURNING *` to confirm ownership.

### 2.5 Full Rebuild Strategy

```sql
-- Full rebuild: iterate all (page_id, language_code) combinations
-- Run as a maintenance job (nightly or on-demand)
SELECT cm.page_id, cm.language_code
FROM reporting.coverage_metrics cm
ORDER BY cm.page_id, cm.language_code;
-- For each row: call reporting.recalculate_coverage(page_id, language_code)
```

A full rebuild creates rows for any (page_id, language_code) combination that lacks a coverage_metrics row (can happen if the row-creation logic in the Language activation path failed):

```sql
-- Create missing coverage_metrics rows
INSERT INTO reporting.coverage_metrics (page_id, language_code, computation_status)
SELECT p.page_id, l.language_code, 'PENDING'
FROM registry.pages p
CROSS JOIN admin.languages l
WHERE l.status = 'ACTIVE'
  AND p.status = 'ACTIVE'
ON CONFLICT (page_id, language_code) DO NOTHING;
-- Then trigger recompute for all PENDING rows
```

**Rebuild does not affect source data.** Coverage_metrics is derived; a full rebuild is always safe.

### 2.6 Computation Failure Handling

**If coverage recomputation fails:**

1. `computation_status = 'FAILED'` is recorded with `computation_error`.
2. The API (API-0601, API-0602) returns the last known values with `computedAt` and `computationStatus: "FAILED"` in the response, allowing clients to know the data may be stale.
3. The nightly full-rebuild job retries FAILED cells.
4. Operations team monitors for FAILED cells via `SELECT * FROM reporting.coverage_metrics WHERE computation_status = 'FAILED'`.

**STALE cells (source data changed but recompute not yet run):**
- API returns the last known values with a `computationStatus: "STALE"` indicator.
- Clients should treat STALE data as "approximately correct" — the direction of coverage change may be inferred from the trigger event (e.g., "a new language was deployed, so coverage likely increased").
- STALE cells are recomputed within the typical worker cycle time (seconds to low single-digit minutes at v1 scale).

### 2.7 Freshness Semantics for API Consumers

| `computation_status` | API Response Guidance |
|---|---|
| `CURRENT` | Data is fresh as of `last_computed_at`. Fully trustworthy. |
| `STALE` | Source data has changed; recomputation is scheduled. Return last known values + `computationStatus: "STALE"` in the API response so clients can display a "refreshing" indicator. |
| `COMPUTING` | Recomputation in progress. Return last known values + `computationStatus: "COMPUTING"`. |
| `FAILED` | Return last known values + `computationStatus: "FAILED"` + `lastComputedAt`. Log an alert. |
| `PENDING` | Row just created, never computed. Return zeros + `computationStatus: "PENDING"`. |

**`last_computed_at` is always returned by API-0601 and API-0602** so clients can display a "Coverage last updated X minutes ago" label.

### 2.8 Indexes

```sql
-- Primary coverage lookup: single page × language (API-0601)
-- Served by PRIMARY KEY (page_id, language_code) — no additional index needed

-- All coverage cells for a page (API-0602 dashboard query)
CREATE INDEX idx_coverage_metrics_page_id
    ON reporting.coverage_metrics (page_id);

-- Find all STALE or FAILED cells (worker queue, monitoring)
CREATE INDEX idx_coverage_metrics_status
    ON reporting.coverage_metrics (computation_status)
    WHERE computation_status IN ('STALE', 'FAILED', 'PENDING', 'COMPUTING');
```

---

## 3. Environment Status — Live Query Model

**API:** API-0401 (Get Page Deployment Status), API-0402 (Get Pre-Publish Summary)  
**Storage:** Live query against `publishing.releases`  
**Supporting index:** `idx_releases_scope_successful` (DB-02 §13.12)

**Environment status is NOT a derived table.** The data volume (89 pages × 8 languages × 3 environments = 2,136 maximum cells, most empty) makes a live query trivially fast with the existing index.

**Current environment status query (what is live in each environment):**

```sql
-- "What is the current live deployment for (page_id, language_code) across all environments?"
SELECT DISTINCT ON (r.environment)
    r.environment,
    r.deployment_version,
    r.status,
    r.initiated_at          AS published_at,
    r.published_by,
    r.published_by_source,
    r.release_id
FROM publishing.releases r
WHERE r.page_id         = $page_id
  AND r.language_code   = $language_code
  AND r.status          = 'SUCCESSFUL'
ORDER BY r.environment, r.deployment_version DESC;
-- One row per environment showing the most recent SUCCESSFUL deployment
-- DISTINCT ON (environment) + ORDER BY deployment_version DESC
-- = most recent per environment
-- Served by: idx_releases_scope_successful (page_id, language_code, environment, deployment_version DESC)
--            WHERE status = 'SUCCESSFUL'
```

**Pre-publish summary (API-0402) — "What translations are approved but not yet published?":**

```sql
-- Find approved translations for (page_id, language_code) not in the current live PROD snapshot
WITH current_prod AS (
    SELECT r.release_id
    FROM publishing.releases r
    WHERE r.page_id       = $page_id
      AND r.language_code = $language_code
      AND r.environment   = 'PRODUCTION'
      AND r.status        = 'SUCCESSFUL'
    ORDER BY r.deployment_version DESC
    LIMIT 1
),
deployed_tags AS (
    SELECT rcs.tag_id, rcs.translation_version_number
    FROM publishing.release_content_snapshots rcs
    WHERE rcs.release_id = (SELECT release_id FROM current_prod)
)
SELECT
    t.tag_id,
    tv.text              AS approved_text,
    tv.version_number    AS approved_version,
    tr.status            AS translation_status,
    dt.tag_id IS NULL    AS is_new_since_last_publish,
    dt.translation_version_number <> tv.version_number AS has_newer_approved_version
FROM registry.tags t
JOIN translation.translations tr ON tr.tag_id = t.tag_id
                                 AND tr.language_code = $language_code
JOIN translation.translation_versions tv ON tv.tag_id = t.tag_id
                                         AND tv.language_code = $language_code
                                         AND tv.status = 'APPROVED'
LEFT JOIN deployed_tags dt ON dt.tag_id = t.tag_id
WHERE t.page_id  = $page_id
  AND t.status   = 'ACTIVE'
  AND tr.status  = 'APPROVED'
ORDER BY t.tag_id;
```

**No derived table is needed.** All data comes directly from source tables with their existing indexes.

---

## 4. Review Queue — Live Query Model

**API:** API-0606 (Get Review Queue)  
**Storage:** Live query across three source tables  
**Design rationale (DB-01 §18.4):** The review queue changes every few minutes during active work sessions. Materializing it would require near-realtime refresh and provide no meaningful benefit. Live queries with partial indexes on status values are sub-millisecond at v1 scale.

### 4.1 Query Patterns per Role

**English Copy Review Queue (visible to: Content Reviewer, Founder):**

```sql
-- All English Copy versions awaiting review
SELECT
    ecv.tag_id,
    ecv.version_number,
    ecv.text,
    ecv.change_reason,
    ecv.authored_by,
    ecv.submitted_at,
    ecv.escalated_to_founder,
    t.page_id,
    t.copy_type
FROM content.english_copy_versions ecv
JOIN registry.tags t ON t.tag_id = ecv.tag_id
WHERE ecv.status = 'PENDING_REVIEW'
  AND t.status   = 'ACTIVE'
  -- Role filter: Founder can also see escalated items
  -- AND ecv.escalated_to_founder = TRUE  (Founder-only view: escalated items)
ORDER BY ecv.submitted_at ASC NULLS LAST;
-- Served by: idx_english_copies_status_pending (PARTIAL WHERE status='PENDING_REVIEW')
--            Note: index is on english_copies (live state); query is on english_copy_versions
--            Both tables need efficient status access.
-- New index needed: idx_ecv_status_pending (see §10)
```

**Translation Review Queue (visible to: Translation Reviewer, Founder):**

```sql
-- All translations awaiting review, optionally filtered by language
SELECT
    tr.tag_id,
    tr.language_code,
    tv.text             AS pending_text,
    tv.version_number,
    tv.back_translation,
    tv.confidence_score,
    tv.variable_integrity_status,
    tv.authored_by,
    tv.submitted_at,
    t.page_id,
    t.copy_type,
    -- Include the current approved English text for review context
    ecv.text            AS source_english_text,
    ecv.version_number  AS source_english_version
FROM translation.translations tr
JOIN translation.translation_versions tv ON tv.tag_id = tr.tag_id
                                         AND tv.language_code = tr.language_code
                                         AND tv.status = 'PENDING_REVIEW'
JOIN registry.tags t ON t.tag_id = tr.tag_id
JOIN content.english_copy_versions ecv ON ecv.tag_id = tr.tag_id
                                       AND ecv.status = 'APPROVED'
WHERE tr.status   = 'PENDING_REVIEW'
  AND t.status    = 'ACTIVE'
  [AND tr.language_code = $language_code]  -- optional filter
ORDER BY tv.submitted_at ASC NULLS LAST;
-- Served by: idx_translations_pending_review (PARTIAL: status='PENDING_REVIEW')
--            idx_translation_versions_approved (PARTIAL: status='APPROVED') on ECVs
```

**Publishing Approval Queue (visible to: Founder):**

```sql
-- All pending publishing approval requests
SELECT
    par.approval_request_id,
    par.page_id,
    par.language_code,
    par.environment,
    par.requested_by,
    par.created_at        AS requested_at,
    par.expires_at,
    par.bundle_snapshot_hash,
    p.page_name
FROM publishing.publishing_approval_requests par
JOIN registry.pages p ON p.page_id = par.page_id
WHERE par.status = 'PENDING'
ORDER BY par.created_at ASC;
-- Served by: idx_par_pending (PARTIAL: status='PENDING')
```

**Combined Review Queue for API-0606 (role-aware multi-source merge):**  
API-0606 returns all three queues in a unified response structure. The API layer executes the relevant sub-queries based on the caller's role and merges results. No `UNION` in SQL — three separate queries are more efficient and produce structurally distinct result types.

### 4.2 Supporting Indexes (from DB-02)

All required indexes already exist in DB-02:
- `idx_english_copies_status_pending` on `content.english_copies` — English Copy live state
- `idx_translations_pending_review` on `translation.translations`
- `idx_translation_versions_approved` on `translation.translation_versions`
- `idx_par_pending` on `publishing.publishing_approval_requests`

One new index is needed (see §10): `idx_ecv_pending_review` on `content.english_copy_versions.status` for the review queue query that joins on version status.

---

## 5. Pending Work Summary — Live Query Model

**API:** API-0604 (Get Pending Work Summary)  
**Storage:** Live aggregation query  
**Design rationale:** Aggregates over at most 36,000 rows (`4,500 tags × 8 languages`). All dimensions are indexed. No derived table needed.

```sql
-- Pending work summary for a page × language combination (API-0604)
-- Returns counts of tags in each workflow state

SELECT
    -- English Copy state distribution (all languages share the same EC per tag)
    COUNT(*) FILTER (WHERE ec.status = 'NO_COPY')           AS ec_no_copy,
    COUNT(*) FILTER (WHERE ec.status = 'DRAFT')             AS ec_draft,
    COUNT(*) FILTER (WHERE ec.status = 'PENDING_REVIEW')    AS ec_pending_review,
    COUNT(*) FILTER (WHERE ec.status = 'APPROVED')          AS ec_approved,

    -- Translation state for the requested language
    COUNT(*) FILTER (WHERE tr.status = 'NO_TRANSLATION')    AS tr_no_translation,
    COUNT(*) FILTER (WHERE tr.status = 'DRAFT')             AS tr_draft,
    COUNT(*) FILTER (WHERE tr.status = 'PENDING_REVIEW')    AS tr_pending_review,
    COUNT(*) FILTER (WHERE tr.status = 'APPROVED')          AS tr_approved,
    COUNT(*) FILTER (WHERE tr.status = 'STALE')             AS tr_stale,

    -- Totals
    COUNT(*)                                                 AS total_active_tags

FROM registry.tags t
JOIN content.english_copies ec ON ec.tag_id = t.tag_id
LEFT JOIN translation.translations tr ON tr.tag_id = t.tag_id
                                      AND tr.language_code = $language_code
WHERE t.page_id = $page_id
  AND t.status  = 'ACTIVE';

-- Served by: idx_tags_page_id_active (PARTIAL: status='ACTIVE')
--            idx_english_copies_status (status distribution)
--            idx_translations_language_code + join on tag_id
```

**For the global pending work summary (across all pages):**
```sql
-- Global summary — one row per page
SELECT
    t.page_id,
    COUNT(*) FILTER (WHERE ec.status = 'NO_COPY')           AS total_no_copy,
    COUNT(*) FILTER (WHERE ec.status = 'PENDING_REVIEW')    AS total_ec_pending,
    COUNT(*) FILTER (WHERE ec.status = 'APPROVED')          AS total_ec_approved
    -- Translation counts per language are separate sub-queries or GROUPING
FROM registry.tags t
JOIN content.english_copies ec ON ec.tag_id = t.tag_id
WHERE t.status = 'ACTIVE'
GROUP BY t.page_id
ORDER BY total_no_copy DESC, total_ec_pending DESC;
```

This query is a group-by aggregate over ~4,500 active tags — trivially fast.

---

## 6. Activity Timeline — Live Query over Audit Records

**API:** API-0605 (Get Activity Timeline)  
**Storage:** Live query over `system_ops.audit_records`  
**Supporting indexes:** `idx_audit_performed_at`, `idx_audit_subject`, `idx_audit_user` (all from DB-03 §4.6)

**Design decision (DB-01 §18.5):** No separate `activity_timeline` table. The Activity Timeline IS a formatted view of audit records. Materializing the audit stream into a second table would:
1. Create a second source of audit truth (violates DB-01 §17 "single source of audit truth")
2. Require near-realtime refresh for any user experience benefit
3. Add a write fan-out to every mutating API

**Activity Timeline query (API-0605) — global feed:**

```sql
-- Most recent N events across all entities (global activity feed)
SELECT
    ar.audit_record_id,
    ar.action,
    ar.subject_entity_type,
    ar.subject_entity_id,
    ar.subject_entity_id_aux,
    ar.performed_by_user_id,
    ar.performed_by_source,
    ar.performed_at,
    ar.detail,
    ar.api_id
FROM system_ops.audit_records ar
WHERE ar.performed_at > now() - interval '7 days'  -- configurable window
  [AND ar.subject_entity_type = $filter_entity_type]
  [AND ar.subject_entity_id   = $filter_entity_id]
  [AND ar.performed_by_user_id = $filter_user_id]
ORDER BY ar.performed_at DESC
LIMIT 50;
-- Served by: idx_audit_performed_at on (performed_at DESC) — chronological scan
-- With entity filter: idx_audit_subject on (subject_entity_type, subject_entity_id, performed_at DESC)
-- With user filter: idx_audit_user on (performed_by_user_id, performed_at DESC)
```

**Activity Timeline for a specific tag (API-0605 with tag scope):**

```sql
SELECT ar.*
FROM system_ops.audit_records ar
WHERE ar.subject_entity_type = 'TAG'
  AND ar.subject_entity_id   = $tag_id
ORDER BY ar.performed_at DESC
LIMIT 50;
-- Also returns related VERSION events by filtering on ENGLISH_COPY_VERSION and TRANSLATION_VERSION
-- with the same tag_id
```

**Boundary with notifications and comments:**

| What | Source | Reason |
|---|---|---|
| "Who approved this translation?" | `system_ops.audit_records` | Mutation event — audit is the source |
| "A new comment was added" | `system_ops.audit_records` (`COMMENT_CREATED` action) | Mutation event |
| "This notification was delivered" | `system_ops.notifications` | Delivery state, not content event |
| "What did the reviewer say in the comment?" | `collaboration.comments` | Comment text is in the comments table, not in the audit detail field |

The Activity Timeline API joins audit records with display metadata (user names from `admin.users`, page names from `registry.pages`) at the API layer. The join is fast (small tables, PK lookups).

---

## 7. Global Search — Physical Search Architecture

**API:** API-0701 (Global Search)  
**Existing infrastructure (from DB-02):**
- `registry.tags.search_vector` — GIN-indexed `tsvector` using `'simple'` dictionary; covers `tag_id` only
- `content.english_copy_versions.search_vector` — GIN-indexed `tsvector`; covers all version texts (all statuses)

### 7.1 Resolution of DB-02-OI-05

**DB-02-OI-05:** The `search_vector` GENERATED column on `english_copy_versions` covers all version texts (DRAFT, PENDING_REVIEW, APPROVED, SUPERSEDED). API-0701 requires searching "approved and fallback" text — not REJECTED or SUPERSEDED versions.

**Decision:** Add a separate partial function-based GIN index restricted to APPROVED and DRAFT/PENDING_REVIEW versions. Do NOT change the GENERATED column (it serves other potential future uses and is correct for its own purpose). The search query will use the partial index via a status filter.

**Resolution:** Two-tier search over english_copy_versions:
1. **APPROVED text** — the primary searchable content; most users want to find the approved translation source
2. **DRAFT and PENDING_REVIEW text** — included so Content Editors can find tags they are actively working on

SUPERSEDED and REJECTED versions are excluded from search results (they are historical; finding them by content is confusing and usually unintended).

### 7.2 Tag ID and Page Name Identifier Search

**Tag ID exact and prefix matching:**

```sql
-- Exact tag_id match
SELECT tag_id, page_id FROM registry.tags
WHERE tag_id = $query AND status = 'ACTIVE';
-- Served by: tags_pkey (B-tree PK)

-- Prefix match (e.g., query = "QUICK")
SELECT tag_id, page_id FROM registry.tags
WHERE tag_id LIKE $query || '%'  -- B-tree LIKE prefix (anchored left = index-eligible)
  AND status = 'ACTIVE';
-- Served by: tags_pkey (prefix scan on B-tree PK for VARCHAR)
-- Note: LIKE 'QUICK%' uses the B-tree index because it is left-anchored.
-- LIKE '%QUICK%' would require a full scan or trigram index.
-- At 4,500 tags, a sequential scan on LIKE '%X%' is still <1ms.
```

**Page name search:**

```sql
-- Page name prefix or substring match
SELECT page_id, page_name FROM registry.pages
WHERE page_name ILIKE '%' || $query || '%'
  AND status = 'ACTIVE';
-- At 89 pages, a sequential scan is acceptable (no index needed).
-- If page count grows beyond ~5,000: add trigram index (pg_trgm extension).
```

**Page ID exact match:**

```sql
SELECT page_id, page_name FROM registry.pages
WHERE page_id = $query AND status = 'ACTIVE';
-- Served by: pages_pkey (B-tree PK)
```

### 7.3 Unified Search Query Architecture

API-0701 receives a `query` string and returns mixed results (tags and pages). The query is processed in three branches that are merged at the API layer (not via SQL UNION, for clarity and independent ranking):

**Branch 1 — Full-text search on English Copy text (APPROVED and in-progress):**

```sql
SELECT
    ecv.tag_id,
    t.page_id,
    ecv.text                                             AS matched_text,
    ecv.status                                           AS version_status,
    ecv.version_number,
    ts_rank(ecv.search_vector, plainto_tsquery('english', $query)) AS rank,
    'ENGLISH_TEXT'                                       AS match_type
FROM content.english_copy_versions ecv
JOIN registry.tags t ON t.tag_id = ecv.tag_id
WHERE ecv.search_vector @@ plainto_tsquery('english', $query)
  AND ecv.status IN ('APPROVED', 'DRAFT', 'PENDING_REVIEW')  -- OI-05 resolution
  AND t.status = 'ACTIVE'
ORDER BY rank DESC, ecv.status = 'APPROVED' DESC  -- APPROVED results rank higher
LIMIT 20;
-- Served by: idx_english_copy_versions_search_vector GIN on search_vector
-- Filtered by status IN (...) — partial GIN index (§7.4) makes this efficient
```

**Branch 2 — Tag ID full-text and prefix search:**

```sql
SELECT
    t.tag_id,
    t.page_id,
    t.tag_id                                             AS matched_text,
    1.0                                                  AS rank,
    'TAG_ID'                                             AS match_type
FROM registry.tags t
WHERE (
    t.search_vector @@ plainto_tsquery('simple', $query)  -- full-text on tag_id
    OR t.tag_id ILIKE $query || '%'                        -- prefix match
)
AND t.status = 'ACTIVE'
LIMIT 10;
-- Served by: idx_tags_search_vector GIN + tags_pkey prefix scan
```

**Branch 3 — Page search:**

```sql
SELECT
    p.page_id,
    p.page_name,
    1.0                                                  AS rank,
    'PAGE'                                               AS match_type
FROM registry.pages p
WHERE (
    p.page_id   ILIKE '%' || $query || '%'
    OR p.page_name ILIKE '%' || $query || '%'
)
AND p.status = 'ACTIVE'
LIMIT 10;
-- Sequential scan at 89 pages — acceptable
```

**API layer merging:** The API service runs all three branches in parallel (or sequentially), deduplicates by `tag_id` (a tag may appear in both Branch 1 and Branch 2), and returns a ranked merged result set. Deduplication is simpler and more controllable at the application layer than in SQL.

### 7.4 New Partial GIN Index for Approved/In-Progress English Text

The existing `idx_english_copy_versions_search_vector` covers all statuses. To efficiently serve the `WHERE status IN ('APPROVED', 'DRAFT', 'PENDING_REVIEW')` filter in Branch 1, a partial GIN index is added:

```sql
-- New partial GIN index: English Copy text search, APPROVED and in-progress versions only
-- Resolves DB-02-OI-05
CREATE INDEX idx_ecv_search_vector_active_statuses
    ON content.english_copy_versions USING GIN (search_vector)
    WHERE status IN ('APPROVED', 'DRAFT', 'PENDING_REVIEW');
```

This index is smaller than the full `idx_english_copy_versions_search_vector` (excludes SUPERSEDED and REJECTED versions, which can be the majority of rows over time as content evolves). PostgreSQL selects this partial index automatically for queries with the matching `WHERE status IN (...)` predicate.

**Note:** The existing full index (`idx_english_copy_versions_search_vector`) is retained for any future queries that need to search across all versions (e.g., admin audit search). The partial index is additive, not a replacement.

### 7.5 Search Result Ranking

Results are ranked using `ts_rank()` for full-text matches and exact-match priority for identifier searches. The final ranking applied by the API layer:

| Priority | Result Type | Rationale |
|---|---|---|
| 1 (highest) | Exact `tag_id` match | Developer-intent search — they know the tag ID |
| 2 | Exact `page_id` match | Same |
| 3 | APPROVED English text full-text match | The canonical content; most relevant for copy editors |
| 4 | Tag ID prefix match | Partial identifier search |
| 5 | Page name substring match | Navigational search |
| 6 (lowest) | DRAFT/PENDING_REVIEW text match | In-progress content; less authoritative |

Within each category, `ts_rank()` provides the ordering signal.

### 7.6 Scale Assessment — No External Search Engine at v1

At v1 scale (4,500 tags, 89 pages), PostgreSQL's built-in FTS satisfies all API-0701 requirements with sub-10ms response times for all three branches. The design defers external search infrastructure (Elasticsearch, OpenSearch) until one of these conditions is met:
- Tag count exceeds 50,000 (GIN index scans remain fast beyond 100,000 rows, but UNION result merging may become visible latency)
- Search requirements expand to translation text (multilingual FTS with language-specific analyzers exceeds PostgreSQL's built-in capabilities)
- Ranking sophistication is required (BM25, personalization) that `ts_rank()` cannot approximate

---

## 8. `search.recently_edited_events` — View-Event Store

**API:** API-0706 (Get Recently Viewed), API-0705 (Get Recently Edited — view portion)  
**Classification:** `USER_PERSONAL` (per DB-01 §3.1 — delete-permitted for cleanup)  
**Schema:** `search`  
**Design rationale (DB-01 §18.9):** Page view events are READ events — they do not appear in `system_ops.audit_records` (which records only mutations). A dedicated event store is the only way to persist view history. The DB-01 §18.9 schema sketch is now formalized.

### 8.1 Table Definition

```sql
CREATE TABLE search.recently_edited_events (
    -- Compound PK: one row per (user, target) — upsert updates the timestamp
    user_id             UUID            NOT NULL REFERENCES admin.users(user_id),
    target_type         VARCHAR(20)     NOT NULL,
    -- 'PAGE' or 'TAG' — the type of entity viewed
    target_id           TEXT            NOT NULL,
    -- page_id or tag_id depending on target_type

    -- Freshness: updated on every view
    last_accessed_at    TIMESTAMPTZ     NOT NULL DEFAULT now(),

    -- Optional: count of views (useful for "most visited" analytics)
    access_count        INTEGER         NOT NULL DEFAULT 1,

    CONSTRAINT recently_edited_events_pkey
        PRIMARY KEY (user_id, target_type, target_id),
    CONSTRAINT recently_edited_events_target_type_check
        CHECK (target_type IN ('PAGE', 'TAG'))
);

COMMENT ON TABLE search.recently_edited_events IS
    'USER_PERSONAL: Per-user record of the most recent page/tag view events. '
    'One row per (user_id, target_type, target_id). Upserted on every view — '
    'INSERT ... ON CONFLICT DO UPDATE SET last_accessed_at = now(). '
    'Not a permanent business record — rows older than 30 days may be purged. '
    'DELETE is permitted per DB-01 §3.1 (USER_PERSONAL exception). '
    'Write events (edits, approvals) come from system_ops.audit_records — not here.';

COMMENT ON COLUMN search.recently_edited_events.target_type IS
    'PAGE: the user viewed a page-level screen. target_id = page_id. '
    'TAG: the user opened a specific tag detail view. target_id = tag_id.';

COMMENT ON COLUMN search.recently_edited_events.access_count IS
    'Total number of times this user has viewed this target. '
    'Incremented on each upsert. Not used by v1 APIs — reserved for future analytics.';
```

**No `created_at` column.** The `last_accessed_at` is the only timestamp needed for "recently viewed" queries. First-access time is not required by any API contract.

**No `updated_at` + trigger.** This table is high-frequency writes (every page navigation). Adding a trigger for `updated_at` would be redundant — `last_accessed_at` serves the same purpose and is set explicitly in the upsert.

### 8.2 Write Pattern (Upsert on Every Page View)

```sql
-- Every time a user navigates to a page or tag, the API fires this upsert:
INSERT INTO search.recently_edited_events
    (user_id, target_type, target_id, last_accessed_at, access_count)
VALUES
    ($user_id, $target_type, $target_id, now(), 1)
ON CONFLICT (user_id, target_type, target_id) DO UPDATE
SET last_accessed_at = EXCLUDED.last_accessed_at,
    access_count     = search.recently_edited_events.access_count + 1;
```

**Write frequency:** Every page navigation by every user. At 15 users × ~100 page navigations/day = ~1,500 upserts/day. The PK index handles this trivially. Upserts (not inserts) — row count stays bounded at `(user_count × max_distinct_pages_per_user)`.

**Maximum row count:** 15 users × 89 pages = 1,335 rows maximum for PAGE type. Small table.

**This is NOT written inside the primary business transaction.** The view event is fire-and-forget — the API response is not blocked by this upsert. If the upsert fails (e.g., transient DB error), the view is not recorded. This is an acceptable loss (recently-viewed is a UX convenience feature, not a business record).

### 8.3 Retention and Cleanup

```sql
-- Cleanup job: delete rows older than 30 days
-- Run nightly as a maintenance job
DELETE FROM search.recently_edited_events
WHERE last_accessed_at < now() - interval '30 days';
```

**30-day retention** (configurable). After 30 days without a view, the entry is purged. If the user visits again after 30 days, a new row is inserted. This bounds the table size permanently.

**Indexes:**

```sql
-- Recently viewed by a user (API-0706)
CREATE INDEX idx_recently_edited_user_id
    ON search.recently_edited_events (user_id, last_accessed_at DESC);
-- Retrieves the user's most recent views, newest first

-- Cleanup job
CREATE INDEX idx_recently_edited_last_accessed
    ON search.recently_edited_events (last_accessed_at)
    WHERE last_accessed_at < now() - interval '25 days';
-- NOTE: This index cannot use now() as a static expression.
-- In practice, the cleanup job does a time-range DELETE:
-- DELETE WHERE last_accessed_at < $cutoff_date
-- The index on (last_accessed_at) — without the WHERE clause — is sufficient:
CREATE INDEX idx_recently_edited_last_accessed
    ON search.recently_edited_events (last_accessed_at);
```

### 8.4 Recently-Edited API Response Assembly

**API-0705 (Get Recently Edited) — assembles two sources:**

```sql
-- Source 1: Write events from audit records (edits, submissions, approvals)
SELECT
    ar.subject_entity_type  AS entity_type,
    ar.subject_entity_id    AS entity_id,
    ar.subject_entity_id_aux AS entity_id_aux,
    ar.action,
    ar.performed_at         AS event_at,
    'EDIT_EVENT'            AS source
FROM system_ops.audit_records ar
WHERE ar.performed_by_user_id = $user_id
  AND ar.subject_entity_type IN ('TAG', 'ENGLISH_COPY_VERSION', 'TRANSLATION_VERSION')
  AND ar.performed_at > now() - interval '30 days'
ORDER BY ar.performed_at DESC
LIMIT 30;
-- Served by: idx_audit_user (performed_by_user_id, performed_at DESC)
```

```sql
-- Source 2: View events from recently_edited_events
SELECT
    target_type             AS entity_type,
    target_id               AS entity_id,
    NULL                    AS entity_id_aux,
    'PAGE_VIEWED'           AS action,
    last_accessed_at        AS event_at,
    'VIEW_EVENT'            AS source
FROM search.recently_edited_events
WHERE user_id = $user_id
ORDER BY last_accessed_at DESC
LIMIT 20;
-- Served by: idx_recently_edited_user_id (user_id, last_accessed_at DESC)
```

**API layer merges and deduplicates:** For the same entity appearing in both sources, the most recent `event_at` wins. The merged list is re-sorted by `event_at DESC` and returned to the client.

---

## 9. Bookmarks — Reference to DB-02

**APIs:** API-0702 (Add Bookmark), API-0703 (Get Bookmarks), API-0704 (Remove Bookmark)  
**Physical table:** `search.bookmarks` (DB-02 §8.1)  
**Indexes:** `bookmarks_user_target_unique`, `idx_bookmarks_user_id` (DB-02 §13.16)

No additional design required. DB-04 documents the query patterns for completeness.

**List user's bookmarks (API-0703):**

```sql
SELECT
    b.bookmark_id,
    b.target_type,
    b.target_id,
    b.created_at,
    -- Enrich with current entity details
    CASE b.target_type
        WHEN 'PAGE' THEN p.page_name
        WHEN 'TAG'  THEN t.tag_id
    END AS target_display_name
FROM search.bookmarks b
LEFT JOIN registry.pages p ON p.page_id = b.target_id AND b.target_type = 'PAGE'
LEFT JOIN registry.tags  t ON t.tag_id  = b.target_id AND b.target_type = 'TAG'
WHERE b.user_id = $user_id
ORDER BY b.created_at DESC;
-- Served by: idx_bookmarks_user_id (user_id, created_at DESC)
```

**Check if a specific entity is bookmarked (API-0702 toggle):**

```sql
SELECT EXISTS (
    SELECT 1 FROM search.bookmarks
    WHERE user_id     = $user_id
      AND target_type = $target_type
      AND target_id   = $target_id
);
-- Served by: bookmarks_user_target_unique (user_id, target_type, target_id)
```

---

## 10. New Indexes Added in DB-04

The following indexes are additions to tables defined in DB-02, required by Group 6/7 read patterns that were not fully addressed in DB-02's index catalog.

```sql
-- INDEX 1: English Copy Versions — pending review status
-- Required for Review Queue (API-0606) which queries english_copy_versions.status directly
-- DB-02 had idx_english_copies_status_pending on english_copies (live state),
-- but the review queue joins to english_copy_versions to get the draft text and submitted_at.
CREATE INDEX idx_ecv_pending_review
    ON content.english_copy_versions (status, submitted_at ASC NULLS LAST)
    WHERE status = 'PENDING_REVIEW';
-- Query: "Find all ECV rows with status = PENDING_REVIEW, ordered by submission date"
-- Covered by: Review Queue query Branch 1 (§4.1)

-- INDEX 2: English Copy Versions — active search (OI-05 resolution, §7.4)
CREATE INDEX idx_ecv_search_vector_active_statuses
    ON content.english_copy_versions USING GIN (search_vector)
    WHERE status IN ('APPROVED', 'DRAFT', 'PENDING_REVIEW');
-- Query: API-0701 full-text search on English text, excluding SUPERSEDED and REJECTED
-- Resolves DB-02-OI-05

-- INDEX 3: Reporting — coverage metrics by computation status
CREATE INDEX idx_coverage_metrics_status
    ON reporting.coverage_metrics (computation_status)
    WHERE computation_status IN ('STALE', 'FAILED', 'PENDING', 'COMPUTING');
-- Query: Worker queue (find cells needing recomputation); monitoring dashboard

-- INDEX 4: Reporting — coverage by page
CREATE INDEX idx_coverage_metrics_page_id
    ON reporting.coverage_metrics (page_id);
-- Query: API-0602 "get all languages' coverage for a page"

-- INDEX 5: Search — recently edited events by user (defined in §8.3 above)
CREATE INDEX idx_recently_edited_user_id
    ON search.recently_edited_events (user_id, last_accessed_at DESC);
-- Query: API-0706 "get user's recently viewed pages/tags"

-- INDEX 6: Search — recently edited events cleanup
CREATE INDEX idx_recently_edited_last_accessed
    ON search.recently_edited_events (last_accessed_at);
-- Query: Nightly cleanup DELETE WHERE last_accessed_at < $cutoff
```

**Indexes NOT added (with rationale):**

| Candidate | Reason Not Added |
|---|---|
| `idx_pages_page_name` (B-tree or trigram on page_name) | Only 89 pages — sequential scan is <1ms. Not needed until page count exceeds ~5,000. |
| `idx_translations_approved_not_deployed` (on translations.status = 'APPROVED') | Pre-publish summary query (§3) is infrequent and runs against a well-indexed join. The existing `idx_translation_versions_approved` handles the TV join. |
| Composite index on `(user_id, target_type)` for recently_edited_events | `idx_recently_edited_user_id` already covers user-scoped queries; target_type is a filter over a small per-user result set. Not needed. |
| GIN trigram index on `page_name` | 89 pages × ILIKE is µs-level. Trigram index adds maintenance overhead without benefit at current scale. |

---

## 11. Read Model Source-to-API Traceability

For every API in Groups 6 and 7, this table traces: source tables → query mechanism → API response.

| API | Feature | Source Tables | Mechanism | Freshness |
|---|---|---|---|---|
| API-0601 | Coverage for page × language | `reporting.coverage_metrics` | Derived table read | Event-driven; `last_computed_at` returned |
| API-0602 | Coverage dashboard (all pages) | `reporting.coverage_metrics` | Derived table scan | Same |
| API-0503 | Trigger coverage recompute | `reporting.coverage_metrics` (write) | Worker recalculation | Async |
| API-0401 | Environment status per scope | `publishing.releases` | Live query | Real-time |
| API-0402 | Pre-publish summary | `publishing.releases`, `release_content_snapshots`, `translation.translation_versions`, `registry.tags` | Live join query | Real-time |
| API-0604 | Pending work summary | `registry.tags`, `content.english_copies`, `translation.translations` | Live aggregation | Real-time |
| API-0606 | Review queue | `content.english_copy_versions`, `translation.translations`, `translation.translation_versions`, `publishing.publishing_approval_requests` | Live multi-query | Real-time |
| API-0605 | Activity timeline | `system_ops.audit_records` | Live query | Real-time (audit records written in primary transaction) |
| API-0603 | Stale translations | `translation.translations`, `content.english_copy_versions` | Live query | Real-time |
| API-0701 | Global search | `registry.tags`, `content.english_copy_versions`, `registry.pages` | Live query (GIN + B-tree) | Real-time (GIN indexes auto-maintain) |
| API-0702 | Add bookmark | `search.bookmarks` | Direct write | N/A |
| API-0703 | Get bookmarks | `search.bookmarks`, `registry.pages`, `registry.tags` | Live join | Real-time |
| API-0704 | Remove bookmark | `search.bookmarks` | Direct DELETE | N/A |
| API-0705 | Recently edited | `system_ops.audit_records`, `search.recently_edited_events` | Live dual-query merge | Real-time |
| API-0706 | Recently viewed | `search.recently_edited_events` | Live query | Near-real-time (upsert async from page navigation) |

---

## 12. Consistency Audit

### 12.1 DB-01 Read-Model Architecture Compliance

| DB-01 §18 Requirement | DB-04 Compliance |
|---|---|
| Derived models are not authoritative inputs to business rules | ✅ `coverage_metrics` is read-only by business APIs; business rules (approval, publishing) always read from source tables |
| Derived models are rebuildable from source tables | ✅ §2.5 provides the full rebuild SQL and procedure |
| Derived model rows carry `computed_at TIMESTAMPTZ` | ✅ `last_computed_at` column in `coverage_metrics` |
| No FK from source tables to derived model tables | ✅ No source table has a FK to `reporting.coverage_metrics` |
| Coverage: event-driven incremental update per cell | ✅ §2.4 — worker picks up trigger events, recomputes only the affected scope |
| Review queue: live query | ✅ §4 — live query with partial indexes |
| Activity timeline: live query over `audit_records` | ✅ §6 — no separate activity table |
| Environment status: live query | ✅ §3 — DISTINCT ON query over releases |
| Pending work: live aggregation | ✅ §5 — group-by aggregate |
| Recently-edited view events: `search.recently_edited_events` | ✅ §8 — full physical definition |

### 12.2 Coverage Formula Consistency

| DB-01 §18.3 Coverage Formula Component | DB-04 Implementation |
|---|---|
| `approved_and_deployed_count`: COUNT from release_content_snapshots JOIN releases WHERE env=PRODUCTION AND status=SUCCESSFUL, scoped to current live release | ✅ §2.3 Step 3: `deployed` CTE |
| `total_active_count`: COUNT from registry.tags WHERE page_id AND status='ACTIVE' | ✅ §2.3 Step 2: `denominator` CTE with additional APPROVED EC filter (more precise than DB-01's sketch) |
| `coverage_percentage = deployed / NULLIF(active, 0) * 100` | ✅ §2.3 final SELECT |

**Addition beyond DB-01 formula:** The DB-04 denominator adds `AND ec.status = 'APPROVED'` (tags with NO_COPY English do not count as coverable targets). DB-01 §18.3 was a preliminary sketch; the ED-01 coverage definition requires an APPROVED English Copy. The formula is correct in DB-04.

### 12.3 Search Index Correctness

| Requirement | DB-04 Resolution |
|---|---|
| DB-02-OI-05: approved-only search index | ✅ New partial GIN index `idx_ecv_search_vector_active_statuses` (§7.4) — covers APPROVED, DRAFT, PENDING_REVIEW; excludes SUPERSEDED, REJECTED |
| Tag ID full-text search | ✅ Existing `idx_tags_search_vector` on `'simple'` tsvector (preserves identifier tokens) |
| Page name search at v1 scale | ✅ ILIKE sequential scan at 89 pages — acceptable; trigram deferred |
| No external search engine at v1 | ✅ All search served by PostgreSQL GIN + B-tree; external search deferred to scale trigger |

### 12.4 Duplicated Source-of-Truth Check

| Risk | Assessment |
|---|---|
| Coverage_metrics duplicating release data | ✅ No — coverage_metrics derives from release_content_snapshots; does not store release content |
| Recently_edited_events duplicating audit records | ✅ No — audit records store edit events; recently_edited_events stores view events. Different events, different stores |
| Activity Timeline duplicating audit records | ✅ No — Activity Timeline IS the audit records (live query, no separate table) |
| Pending Work duplicating translations live state | ✅ No — Pending Work is a live aggregate, not a copy |
| Environment Status duplicating release state | ✅ No — Environment Status is a live query projection, not a copy |

### 12.5 Missing Freshness Semantics — Check

| Read Model | Freshness Source | Stale State Handled? |
|---|---|---|
| `coverage_metrics` | `last_computed_at` + `computation_status` | ✅ STALE and FAILED states; API returns freshness metadata |
| Environment Status | Live query — always current | N/A — no staleness possible |
| Review Queue | Live query | N/A |
| Pending Work | Live query | N/A |
| Activity Timeline | Live query | N/A (audit records are written in same transaction) |
| Search | GIN index — maintained automatically by PostgreSQL | N/A |
| Recently Edited (write events) | Live query over audit records | N/A |
| Recently Viewed | Last_accessed_at on the event row | Acceptable: fire-and-forget write means a view may be missed if the upsert fails. Not a business-critical gap. |

### 12.6 Query Patterns Without Suitable Indexes — Check

| Query | Index | Gap? |
|---|---|---|
| Coverage metrics by page (API-0602) | `idx_coverage_metrics_page_id` (new, §10) | ✅ Resolved |
| Coverage worker queue (STALE/FAILED cells) | `idx_coverage_metrics_status` (new, §10) | ✅ Resolved |
| ECV pending review queue (API-0606) | `idx_ecv_pending_review` (new, §10) | ✅ Resolved |
| ECV search — approved/in-progress only (API-0701) | `idx_ecv_search_vector_active_statuses` (new, §10) | ✅ Resolved |
| Recently viewed by user | `idx_recently_edited_user_id` (new, §10) | ✅ Resolved |
| Recently edited write events | `idx_audit_user` (DB-03) | ✅ Existing |
| Activity timeline chronological | `idx_audit_performed_at` (DB-03) | ✅ Existing |
| Bookmarks by user | `idx_bookmarks_user_id` (DB-02) | ✅ Existing |
| Stale translations (API-0603) | `idx_translations_stale` (DB-02) | ✅ Existing |
| Environment status — current SUCCESSFUL | `idx_releases_scope_successful` (DB-02) | ✅ Existing |
| Review queue — PAR pending | `idx_par_pending` (DB-02) | ✅ Existing |
| Page name search | Sequential scan — 89 pages | ✅ Acceptable at v1 |
| Tag ID prefix search | B-tree PK prefix scan | ✅ Existing |

**No unresolved query pattern gaps found.**

### 12.7 Open Items from DB-04

| # | Item | Severity | Recommendation |
|---|---|---|---|
| DB-04-OI-01 | `published_by_source` CHECK constraint (from DB-02-OI-04) was flagged in DB-02 but not resolved there. DB-04 does not use this field directly. | Low | Resolve in DB-02 revision or a schema addendum. Recommended values: `CHECK (published_by_source IN ('USER', 'SYSTEM:AUTO_PUBLISH', 'SYSTEM:MIGRATION'))` |
| DB-04-OI-02 | `coverage_metrics` row creation on Language activation (API-0803). The `INSERT INTO reporting.coverage_metrics` for new language × all pages must be documented as a side-effect of API-0803. Currently implied but not explicitly in the transaction boundary docs. | Low | Document in the API-0803 transaction boundary: after creating translation slots (API-0506 equivalent), INSERT coverage_metrics rows for (all active pages, new language_code) with `computation_status = 'PENDING'` |
| DB-04-OI-03 | The `search.recently_edited_events` table is named "recently_edited" but serves "recently viewed." Consider renaming to `search.page_view_events` for semantic clarity. | Low | Rename in schema migration if desired; the name from DB-01 §18.9 was kept for backward reference. Either name is acceptable as long as the `COMMENT ON TABLE` is accurate. |
| DB-04-OI-04 | Tag-level view events: `target_type = 'TAG'` in recently_edited_events. Which APIs generate a TAG view event? Likely API-0201 (open English Copy editor), API-0303 (open Translation editor). These APIs must upsert a TAG view event when called. | Low | Document in the API layer (not the DB schema). |

---

*End of MioTranslate — DB-04: Reporting, Read Models & Search Schema v1.0*

*Documents in the DB series:*  
*DB-01 — Database Architecture & Standards ✅*  
*DB-02 — Core Transactional Schema ✅*  
*DB-03 — History, Versioning & Audit Schema ✅*  
*DB-04 — Reporting, Read Models & Search Schema ✅*  
*DB-05 — Collaboration & Export Schema (Export Jobs)*  
*DB-06 — Administration Supplementary Schema*  
*DB-07 — Migration Operational Schema*
