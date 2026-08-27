# MioTranslate — DB-03: History, Versioning & Audit Schema

**Product:** MioTranslate  
**Document Type:** Database Design — Layer 3 (Historical, Versioned & Audit Persistence)  
**Document ID:** DB-03  
**Version:** 1.0  
**Author:** Principal Database Architect + Principal Backend Architect + Data Governance Architect  
**Date:** August 2026  
**Mandatory Standards Reference:** DB-01 v1.0  
**Direct Predecessor:** DB-02 v1.0  
**Entity Model Sources:** ED-01 v1.1, ED-02 v1.0, ED-03 v1.0

---

> **Purpose of this document.**  
> DB-03 completes the historical persistence layer. It defines the two tables not yet physically specified (the full `system_ops.audit_records` model and `migration.import_events`), documents the version lineage architecture that spans all history-bearing tables from DB-02, establishes the rollback and snapshot reproducibility guarantees, and performs the full cross-document consistency audit.
>
> **Relationship to DB-02:** The version history tables (`content.english_copy_versions`, `translation.translation_versions`, `publishing.releases`, `publishing.release_content_snapshots`, `publishing.publishing_approval_requests`) were physically defined in DB-02. This document does not redefine their DDL. It provides:
> - The version lineage architecture that governs how those tables work together
> - The migration exception resolution for the version FK chain
> - The full rollback and snapshot reproducibility model
> - Two new table definitions: `system_ops.audit_records` and `migration.import_events`
> - The retention and permanence classification for the entire history layer
> - The complete consistency audit
>
> **Scope exclusions:** Derived/read models (coverage metrics, reporting views), search index structures, export jobs, and recently-edited events belong to later DB documents.

---

## Table of Contents

1. Historical Architecture Overview
2. Version History Lineage Model
   - 2.1 English Copy Version Lineage
   - 2.2 Translation Version Lineage and `source_english_version`
   - 2.3 Migration Exception: Translation Without Prior English History
   - 2.4 Version Sequencing Contract
   - 2.5 Superseded Version Mechanics
   - 2.6 Concurrent Version Creation Guarantees
3. Publishing and Deployment History Model
   - 3.1 Deployment History Permanence
   - 3.2 Rollback Lineage Architecture
   - 3.3 Snapshot Reproducibility Guarantee
   - 3.4 PAR Approval History Chain
4. `system_ops.audit_records` — Complete Physical Definition
   - 4.1 Table Definition
   - 4.2 Canonical Action Catalog
   - 4.3 Subject Entity Taxonomy
   - 4.4 Before/After State Capture Strategy
   - 4.5 Immutability Guarantees
   - 4.6 Indexes
   - 4.7 Partitioning Readiness
   - 4.8 Audit vs Other Historical Structures (Boundary)
5. `migration.import_events` — Historical Governance Record
   - 5.1 Table Definition
   - 5.2 Concurrent Migration Prevention
   - 5.3 Relationship to Core Transactional Schema
6. Historical Permanence and Retention Classification
7. Concurrency and Write Ordering for Historical Structures
8. Database Guarantees Summary
9. Consistency Audit

---

## 1. Historical Architecture Overview

MioTranslate's persistence layer separates records into five roles (DB-01 §3.3). The history layer covers three of these:

| Classification | Role | Tables in History Layer |
|---|---|---|
| `IMMUTABLE_HISTORY` | Append-only snapshots. Written once. Never mutated (except narrow lifecycle fields). | `english_copy_versions`, `translation_versions`, `release_content_snapshots`, `audit_records` |
| `GOVERNANCE_RECORD` with history | Permanent records with mutable lifecycle. History of state transitions is implied by append-once fields. | `publishing_approval_requests`, `user_role_assignments`, `import_events` |
| `SYSTEM_EVENT` | Machine-initiated, append-only records of system actions. | `audit_records` (dual role: IH + SE) |

The history layer interacts with the core transactional layer (DB-02) through the following integration points:

```
registry.tags ──────────────────────────────┐
  │                                          │
  ├── content.english_copies (live state)    │ all tables defined in DB-02
  │     └── content.english_copy_versions ◄──┤ (history)
  │                                          │
  ├── translation.translations (live state)  │
  │     └── translation.translation_versions ◄┘ (history, FK to ECVs)
  │
  └── publishing.publishing_approval_requests
        └── publishing.releases
              └── publishing.release_content_snapshots
                    │
                    ▼
              system_ops.audit_records ◄── (all events write here)
              migration.import_events  ◄── (migration governance)
```

**Design principle (from ED-02 §2.1):** The live state entity and its version history are separate physical concerns. The live state row answers "what is the current situation?". The version history answers "what was it at each point in time?" These must never be conflated.

---

## 2. Version History Lineage Model

### 2.1 English Copy Version Lineage

Each tag has exactly one `content.english_copies` live state row and zero or more `content.english_copy_versions` history rows.

**Lineage chain:**

```
registry.tags
  tag_id = "QUICK_1"
      │
      ▼
content.english_copies
  tag_id = "QUICK_1" | status = APPROVED | current_version_number = 3
      │
      ├── content.english_copy_versions (tag_id="QUICK_1", version_number=1)
      │     text = "Quick Sale"        | status = SUPERSEDED | approved_at = T1
      │
      ├── content.english_copy_versions (tag_id="QUICK_1", version_number=2)
      │     text = "Quick Sale"        | status = SUPERSEDED | approved_at = T2
      │     (minor copy change; re-approved)
      │
      └── content.english_copy_versions (tag_id="QUICK_1", version_number=3)
            text = "Quick Billing"     | status = APPROVED   | approved_at = T3
            (current approved version)
```

**Invariants enforced by DB-02 + DB-03:**

| Invariant | Mechanism |
|---|---|
| At most one APPROVED version per tag | Partial unique index `WHERE status = 'APPROVED'` on `english_copy_versions` |
| All versions for a tag are accessible | `WHERE tag_id = $1 ORDER BY version_number DESC` — no version ever deleted |
| `current_version_number` on live state is consistent | Application maintains this in the approval transaction; no DB FK (would create a circular dependency between the two tables) |
| SUPERSEDED versions retain their content snapshot | `raise_on_delete()` trigger prevents deletion; `validate_ecv_update()` trigger prevents content mutation |

**What `current_version_number` tracks:** It points to the highest version currently being worked on — this may be a DRAFT or PENDING_REVIEW version sitting above the current APPROVED version. For example, if v3 is APPROVED and a new v4 draft has been started, `current_version_number = 4`. The APPROVED version is always discoverable independently via the partial unique index without relying on `current_version_number`.

### 2.2 Translation Version Lineage and `source_english_version`

Translation versions form a two-dimensional lineage: they chain to prior translation versions (via `version_number`) AND to the English Copy version they were based on (via `source_english_version`).

**Full lineage chain:**

```
content.english_copy_versions
  (tag_id="QUICK_1", version_number=1)   ──────────────────────┐
  (tag_id="QUICK_1", version_number=3)   ──────────────────┐   │
                                                            │   │
translation.translations                                    │   │
  (tag_id="QUICK_1", language_code="ar")                   │   │
      │                                                     │   │
      ├── translation.translation_versions                  │   │
      │     (tag_id="QUICK_1", lang="ar", version_number=1) │   │
      │     text = "بيع سريع"   | creation_method=MIGRATED  │   │
      │     source_english_version = 1 ────────────────────────┘
      │     status = SUPERSEDED
      │
      ├── translation.translation_versions
      │     (tag_id="QUICK_1", lang="ar", version_number=2)
      │     text = "بيع سريع (AI)"  | creation_method=AI_GENERATED
      │     source_english_version = 3 ───────────────────────┘
      │     status = SUPERSEDED
      │     (English changed to v3; AI retranslated)
      │
      └── translation.translation_versions
            (tag_id="QUICK_1", lang="ar", version_number=3)
            text = "فاتورة سريعة" | creation_method=MANUAL
            source_english_version = 3
            status = APPROVED
```

**The `source_english_version` FK (from DB-02 §5.2):**

```sql
-- Cross-schema FK: translation_versions.source_english_version →
-- english_copy_versions.version_number for the same tag_id
CONSTRAINT translation_versions_source_ec_fkey
    FOREIGN KEY (tag_id, source_english_version)
    REFERENCES content.english_copy_versions(tag_id, version_number)
    DEFERRABLE INITIALLY DEFERRED
```

**Why DEFERRED:** The migration bootstrap inserts EC Version 1 and TV Version 1 in the same transaction. At the moment TV is inserted, EC Version 1 has already been inserted (step 2c before step 2d in the migration transaction sequence from DB-02 §12.6), so the FK is satisfiable within the transaction. `DEFERRABLE INITIALLY DEFERRED` ensures the constraint is checked at `COMMIT` time rather than at each INSERT statement — covering the case where batch inserts produce a temporarily-inconsistent state within a single transaction.

**Lineage query — "which EC version was this translation based on?":**
```sql
SELECT ecv.*
FROM content.english_copy_versions ecv
WHERE ecv.tag_id = $tag_id
  AND ecv.version_number = (
    SELECT tv.source_english_version
    FROM translation.translation_versions tv
    WHERE tv.tag_id = $tag_id
      AND tv.language_code = $language_code
      AND tv.version_number = $tv_version_number
  );
```

**Lineage query — "which translations were based on EC version N?":**
```sql
SELECT tv.*
FROM translation.translation_versions tv
WHERE tv.tag_id = $tag_id
  AND tv.source_english_version = $ec_version_number;
-- Served by idx_translation_versions_source_ec_version (defined in DB-02 §13.10)
```

**Stale lineage:** When English Copy is approved and the text has changed (EC v3 approved), the stale flag on `translation.translations` records:
- `stale_triggered_by_english_ver = 3` — the version that triggered the stale
- `stale_prior_confirmed_ec_ver` — the EC version the existing APPROVED TV was based on

This allows the reviewer to see exactly which English change made the translation stale, by joining `content.english_copy_versions` on both version numbers.

### 2.3 Migration Exception: Translation Without Prior English History

**The exception (from ED-01, ED-02, ED-03):** During the one-time migration, translations are imported alongside their English copy. This creates TV Version 1 simultaneously with EC Version 1 in the same transaction. There is no "prior APPROVED English Copy" that predates the TV — they are born at the same moment.

**How the physical schema represents this:**

| Field | Normal Operational TV | MIGRATED TV |
|---|---|---|
| `creation_method` | `AI_GENERATED` or `MANUAL` | `MIGRATED` |
| `source_english_version` | Points to a pre-existing APPROVED EC Version | `1` (EC v1 created in same transaction) |
| `authored_by` | UUID of the human translator or NULL (AI) | UUID of the migration system user |
| `authored_by_source` | `USER` or `SYSTEM:AI_TRANSLATE` | `SYSTEM:MIGRATION` |
| `status` at creation | `DRAFT` or `PENDING_REVIEW` | `APPROVED` (already approved at migration time) |

**The FK is valid:** Because EC Version 1 is inserted in step 2c and TV Version 1 is inserted in step 2d of the same migration transaction, and the FK is `DEFERRABLE INITIALLY DEFERRED`, the FK is satisfied at `COMMIT` time.

**The invariant preserved:** After migration commits, the TV `source_english_version = 1` correctly references EC Version 1, which exists. The normal operational invariant — "every TV must have a valid `source_english_version` referencing an existing EC Version for the same tag" — holds. Only the timing differs; the operational path validates an existing approved EC before creating a TV.

**The discriminator flags:** `creation_method = 'MIGRATED'` is the permanent, irrevocable marker. No post-migration TV should ever have `creation_method = 'MIGRATED'`. The `CHECK` constraint on `creation_method` does not restrict which APIs can set it — that is application-enforced (only API-1002 sets `MIGRATED`).

### 2.4 Version Sequencing Contract

**Rule (from DB-01 §23.12):** Version numbers are positive integers starting at 1, incrementing by 1 per new version, with no gaps.

**Application enforcement:**
```sql
-- Version assignment pattern (within a SERIALIZABLE transaction):
SELECT COALESCE(MAX(version_number), 0) + 1
FROM content.english_copy_versions   -- or translation.translation_versions
WHERE tag_id = $1
[AND language_code = $2]             -- for translation versions only
FOR UPDATE;                          -- row-lock scope via the parent entity row
```

The `SELECT FOR UPDATE` on the parent entity row (via `content.english_copies` or `translation.translations`) provides the serialization guarantee without needing a separate sequence table. Because all version creation must go through a `SERIALIZABLE` transaction that also updates the parent's `current_version_number`, no two concurrent transactions can assign the same version number.

**Database-level check (but not gap enforcement):**
```sql
CHECK (version_number >= 1)
```

The database cannot enforce no-gap sequencing without a trigger or materialized constraint — the application is responsible for sequential assignment. The CHECK constraint only prevents negative or zero version numbers.

**Deployment version sequencing** on `publishing.releases` follows the same contract, scoped to `(page_id, language_code, environment)`. The unique constraint `UNIQUE (page_id, language_code, environment, deployment_version)` enforces no duplicate numbers but not sequential order. Sequential ordering is application-enforced.

### 2.5 Superseded Version Mechanics

When a new English Copy Version is approved (API-0203 APPROVE), the prior APPROVED version must be transitioned to SUPERSEDED within the same transaction, before the new version is marked APPROVED.

**The critical ordering constraint:**

```
Within the same SERIALIZABLE transaction:
  Step 1: UPDATE english_copy_versions SET status = 'SUPERSEDED'
          WHERE tag_id = $1 AND status = 'APPROVED'
          ← This drops the APPROVED partial unique index entry for this tag

  Step 2: UPDATE english_copy_versions SET status = 'APPROVED', approved_by = ..., approved_at = ...
          WHERE tag_id = $1 AND version_number = $new_version
          ← This inserts a new APPROVED partial unique index entry for this tag

  Step 3: UPDATE english_copies SET status = 'APPROVED',
          current_version_number = $new_version WHERE tag_id = $1
```

If Step 2 runs before Step 1, the partial unique index `WHERE status = 'APPROVED'` will reject Step 2 (a second APPROVED row for the same tag). The application must execute Step 1 first. No trigger is needed to enforce this ordering — the partial unique index itself enforces it by rejecting the second INSERT/UPDATE that would create a duplicate.

**SUPERSEDED versions are never deleted.** They remain accessible for:
- Full version history audit (API-0204)
- Translation lineage (`source_english_version` may reference any version, including SUPERSEDED ones)
- Audit record context (before_value may capture the text of the superseded version)

**Same mechanics apply to Translation Versions:** Translation version APPROVED → SUPERSEDED follows the same pattern (Step 1: prior APPROVED TV → SUPERSEDED; Step 2: new TV → APPROVED). Unlike EC Versions, there is no partial unique index enforcing single-approved-TV per (tag, language) in DB-02 — this was a deliberate difference noted in DB-02 §13.10 ("approval uniqueness enforced at translations live-state level"). The `translation.translations.status` field is the authoritative single indicator. The `translation_versions.status` APPROVED row is discoverable via `idx_translation_versions_approved`.

### 2.6 Concurrent Version Creation Guarantees

**Scenario:** Two users simultaneously attempt to create a new English Copy Version for the same tag.

**Protection chain:**
1. Both requests read `content.english_copies` with `SELECT FOR UPDATE`.
2. One transaction acquires the lock first; the second waits.
3. The first transaction assigns `version_number = N+1`, updates `current_version_number = N+1`, and commits.
4. The second transaction acquires the lock, re-reads `current_version_number = N+1`, assigns `N+2`.
5. Both transactions succeed sequentially; no version number collision.

**If both transactions are in SERIALIZABLE isolation:** PostgreSQL's serialization conflict detection prevents concurrent writes to the same row, providing an additional layer of protection beyond the explicit `FOR UPDATE` lock.

**The partial unique index as final backstop:** If application code fails to use `FOR UPDATE` and two transactions concurrently assign the same version number, the `PRIMARY KEY (tag_id, version_number)` constraint on `english_copy_versions` rejects the second INSERT with a unique violation error. The transaction rolls back cleanly.

---

## 3. Publishing and Deployment History Model

### 3.1 Deployment History Permanence

Every publishing event — whether successful, failed, or rolled back — is a permanent record in `publishing.releases`.

```
Deployment History for (page_id="QUICK", language_code="ar", environment="PRODUCTION"):

releases.deployment_version=1  | status=SUCCESSFUL  | type=PUBLISH    | trigger=MIGRATION
releases.deployment_version=2  | status=SUCCESSFUL  | type=PUBLISH    | trigger=USER_INITIATED
releases.deployment_version=3  | status=FAILED      | type=PUBLISH    | trigger=USER_INITIATED
releases.deployment_version=4  | status=SUCCESSFUL  | type=PUBLISH    | trigger=USER_INITIATED
releases.deployment_version=5  | status=ROLLED_BACK | type=PUBLISH    | trigger=USER_INITIATED
releases.deployment_version=6  | status=SUCCESSFUL  | type=ROLLBACK   | trigger=USER_INITIATED
                                   ↑ rolled_back_from_deployment_version=5
                                   (rolled back to the content from deployment_version=4)
```

FAILED releases are retained permanently (never deleted, never retried in-place — a new Release is created for a retry attempt). ROLLED_BACK releases are retained permanently with `rolled_back_at` timestamp.

The `idx_releases_scope_successful` index (from DB-02 §13.12) efficiently finds the most recent SUCCESSFUL non-rolled-back release, which represents the current live deployment.

### 3.2 Rollback Lineage Architecture

**Rollback creates a new Release record. It never overwrites the prior release.**

**Rollback release fields:**

| Field | Value |
|---|---|
| `release_type` | `ROLLBACK` |
| `deployment_version` | MAX + 1 for the scope |
| `rolled_back_from_deployment_version` | The deployment_version of the release that was the "current" live one at rollback time (which becomes ROLLED_BACK) |
| `status` | `PENDING` → `IN_PROGRESS` → `SUCCESSFUL` or `FAILED` |

**The "rolled back TO" release:** The content actually published by the rollback release comes from a prior SUCCESSFUL release's `release_content_snapshots`. The application reads the snapshot of the target prior release, constructs the Language Services payload from those snapshots, and pushes it. The rollback Release's own `release_content_snapshots` records the content that was actually pushed (identical to the target prior release's snapshot).

**Marking the superseded release ROLLED_BACK:**

```sql
-- When the Rollback release reaches SUCCESSFUL status:
UPDATE publishing.releases
SET status = 'ROLLED_BACK',
    rolled_back_at = now()
WHERE page_id = $page_id
  AND language_code = $language_code
  AND environment = $environment
  AND deployment_version = $rolled_back_from_deployment_version
  AND status = 'SUCCESSFUL';
```

This is the only permitted post-creation status mutation on a previously-SUCCESSFUL release (enforced by `publishing.validate_release_update()` trigger from DB-02 §6.2).

**Finding the target rollback content:**

```sql
-- What content should the rollback push? The snapshot from the release
-- BEFORE the rolled_back_from_deployment_version.
-- If rolling back FROM v5, the target is the most recent SUCCESSFUL release < v5.
SELECT rcs.*
FROM publishing.release_content_snapshots rcs
JOIN publishing.releases r ON r.release_id = rcs.release_id
WHERE r.page_id = $page_id
  AND r.language_code = $language_code
  AND r.environment = $environment
  AND r.deployment_version < $rolled_back_from_deployment_version
  AND r.status = 'SUCCESSFUL'
ORDER BY r.deployment_version DESC
LIMIT 1 -- per tag, which means LATERAL join in practice
```

**Rollback reproducibility guarantee:** Because `release_content_snapshots` is IMMUTABLE_HISTORY (never deleted, never mutated), the content from any prior successful release is always available for rollback, regardless of how many subsequent English Copy or Translation version changes have occurred.

### 3.3 Snapshot Reproducibility Guarantee

The `publishing.release_content_snapshots` table guarantees that for any historical release:
- The exact text pushed to Language Services is permanently recorded per tag
- The `translation_version_number` and `source_english_version_number` identify the lineage at deploy time
- Even if the Translation or English Copy has since changed, the snapshot reflects what was live

**Snapshot query — "what was deployed in release X for tag Y?":**
```sql
SELECT rcs.translation_text,
       rcs.translation_version_number,
       rcs.source_english_version_number,
       r.initiated_at AS deployed_at,
       r.deployment_version
FROM publishing.release_content_snapshots rcs
JOIN publishing.releases r ON r.release_id = rcs.release_id
WHERE rcs.release_id = $release_id
  AND rcs.tag_id = $tag_id;
```

**"What is currently live in PRODUCTION for this page and language?":**
```sql
SELECT rcs.*
FROM publishing.release_content_snapshots rcs
JOIN publishing.releases r ON r.release_id = rcs.release_id
WHERE r.page_id = $page_id
  AND r.language_code = $language_code
  AND r.environment = 'PRODUCTION'
  AND r.status = 'SUCCESSFUL'
ORDER BY r.deployment_version DESC
LIMIT (SELECT COUNT(*) FROM registry.tags WHERE page_id = $page_id AND status = 'ACTIVE');
-- In practice: most recent SUCCESSFUL release's snapshot via DISTINCT ON or subquery
```

### 3.4 PAR Approval History Chain

The `publishing.publishing_approval_requests` table (DB-02 §6.1) captures the complete approval governance chain.

**Every PAR permanently records:**
- Who requested publishing (`requested_by`, `created_at`)
- What bundle was requested (`bundle_snapshot_hash`)
- What environment and scope (`page_id`, `language_code`, `environment`)
- What the outcome was (`status`, `decided_by`, `decided_at`, `rejection_reason`)
- What Release was created (`releases.approval_request_id` FK back-reference)

**Completeness of the history:** Because PARs are never deleted and status is permanently recorded, the full history of approval requests for any scope is queryable:

```sql
SELECT par.*, r.deployment_version, r.status AS release_status
FROM publishing.publishing_approval_requests par
LEFT JOIN publishing.releases r ON r.approval_request_id = par.approval_request_id
WHERE par.page_id = $page_id
  AND par.language_code = $language_code
  AND par.environment = $environment
ORDER BY par.created_at DESC;
```

**Hash mismatch CANCELLED PARs:** These are permanent records demonstrating that an approval request was invalidated because the bundle content changed between request and decision. This is auditable evidence of governance working correctly.

---

## 4. `system_ops.audit_records` — Complete Physical Definition

**Classification:** `IMMUTABLE_HISTORY` + `SYSTEM_EVENT`  
**FRD Reference:** §F-13 (Audit Trail requirement), §§5.1–5.7 (all operations must be audited)  
**Entity Model:** ED-01 §AuditRecord  
**ED-03 Contract:** §2.14  
**DB-01 Reference:** §17 (Audit Storage Principles), OQ-7 (Index Strategy)  
**DB-02 Open Item:** DB-02-OI-01 (deferred from DB-02; required before production deployment)

### 4.1 Table Definition

```sql
CREATE TABLE system_ops.audit_records (
    -- Identity: UUID v7 (time-ordered — supports partition range alignment)
    audit_record_id         UUID            NOT NULL,

    -- === ACTION ===
    -- The operation that occurred. See §4.2 for the canonical action catalog.
    action                  VARCHAR(100)    NOT NULL,

    -- === SUBJECT ===
    -- The entity that was acted upon (polymorphic — see §4.3)
    subject_entity_type     VARCHAR(60)     NOT NULL,
    subject_entity_id       TEXT            NOT NULL,
    -- Compound identity for entities with compound PKs
    -- (e.g., translations: stored as "tag_id::language_code")
    subject_entity_id_aux   TEXT            NULL,

    -- === ACTOR ===
    -- Who or what performed this action
    performed_by_user_id    UUID            NULL    REFERENCES admin.users(user_id),
    -- NULL for system-initiated actions
    performed_by_source     VARCHAR(100)    NOT NULL DEFAULT 'USER',
    -- USER | SYSTEM:AUTO_PUBLISH | SYSTEM:STALE_FLAG | SYSTEM:MIGRATION
    -- | SYSTEM:EXPIRY_JOB | SYSTEM:COVERAGE_RECALC | SYSTEM:NOTIFICATION_DISPATCH

    -- === TIMESTAMP ===
    performed_at            TIMESTAMPTZ     NOT NULL DEFAULT now(),

    -- === REQUEST CORRELATION ===
    api_id                  VARCHAR(20)     NULL,
    -- The API that triggered this record (e.g., API-0203, API-0405)
    request_id              UUID            NULL,
    -- The HTTP request correlation ID. Enables full request trace reconstruction.
    -- NULL for system-triggered actions that are not tied to a user request.

    -- === STATE CAPTURE ===
    -- Selective snapshots of entity state before/after the action.
    -- See §4.4 for the capture strategy. Not populated for every action.
    before_state            JSONB           NULL,
    after_state             JSONB           NULL,

    -- === DETAIL ===
    -- Human-readable description for audit trail UI (API-0904)
    detail                  TEXT            NULL,

    -- === NO updated_at — immutable after INSERT ===
    created_at              TIMESTAMPTZ     NOT NULL DEFAULT now(),

    -- Constraints
    CONSTRAINT audit_records_pkey PRIMARY KEY (audit_record_id),
    CONSTRAINT audit_records_actor_consistency
        CHECK (
            (performed_by_source = 'USER' AND performed_by_user_id IS NOT NULL) OR
            (performed_by_source <> 'USER')
            -- System-source actions may have NULL performed_by_user_id
        )
);

COMMENT ON TABLE system_ops.audit_records IS
    'IMMUTABLE_HISTORY + SYSTEM_EVENT: Canonical audit record for every significant action in MioTranslate. '
    'Written within the same SERIALIZABLE transaction as the primary operation. '
    'Never updated or deleted. Partitioning-ready via UUID v7 PK (time-ordered). '
    'Single source of audit truth — not duplicated by notifications, comments, or timeline views.';

COMMENT ON COLUMN system_ops.audit_records.audit_record_id IS
    'UUID v7 (time-ordered). PK. Supports future range partitioning by performed_at. '
    'Time-ordered UUIDs avoid random B-tree index fragmentation under high write rates.';
COMMENT ON COLUMN system_ops.audit_records.action IS
    'The named action that occurred. See the canonical action catalog in DB-03 §4.2. '
    'VARCHAR(100) — no CHECK constraint on action values. New action types may be added '
    'without schema migration. The canonical list is maintained in this document.';
COMMENT ON COLUMN system_ops.audit_records.subject_entity_type IS
    'The entity type affected. See the taxonomy in DB-03 §4.3. '
    'Examples: TAG, ENGLISH_COPY_VERSION, TRANSLATION, RELEASE, PUBLISHING_APPROVAL_REQUEST.';
COMMENT ON COLUMN system_ops.audit_records.subject_entity_id IS
    'The serialized primary key of the subject entity. '
    'For simple PKs: the raw value (e.g., tag_id = "QUICK_1", release_id = "uuid"). '
    'For compound PKs: the first component (tag_id for versions). '
    'subject_entity_id_aux holds the second component where needed.';
COMMENT ON COLUMN system_ops.audit_records.subject_entity_id_aux IS
    'Second component of compound PKs. '
    'For TRANSLATION and TRANSLATION_VERSION: language_code. '
    'For ENGLISH_COPY_VERSION: version_number (as text). '
    'For TRANSLATION_VERSION: "language_code::version_number". NULL for simple PKs.';
COMMENT ON COLUMN system_ops.audit_records.performed_by_source IS
    'USER: action initiated by a human via API. '
    'SYSTEM:AUTO_PUBLISH: implicit DEV publishing job. '
    'SYSTEM:STALE_FLAG: stale flagging cascade after English approval. '
    'SYSTEM:MIGRATION: one-time migration process. '
    'SYSTEM:EXPIRY_JOB: PAR expiry background job. '
    'SYSTEM:COVERAGE_RECALC: coverage metrics recalculation. '
    'SYSTEM:NOTIFICATION_DISPATCH: async notification dispatch.';
COMMENT ON COLUMN system_ops.audit_records.before_state IS
    'Selective JSONB snapshot of entity state BEFORE this action. '
    'Populated for mutating actions where the prior state is important for audit. '
    'See §4.4 for which actions capture before_state. '
    'NULL for creation events and read events.';
COMMENT ON COLUMN system_ops.audit_records.after_state IS
    'Selective JSONB snapshot of entity state AFTER this action. '
    'Populated for important state transitions. See §4.4.';
```

**Immutability Triggers:**
```sql
-- Absolutely immutable: no UPDATE permitted
CREATE TRIGGER audit_records_no_update
    BEFORE UPDATE ON system_ops.audit_records
    FOR EACH ROW EXECUTE FUNCTION public.raise_on_update();

-- Absolutely permanent: no DELETE permitted
CREATE TRIGGER audit_records_no_delete
    BEFORE DELETE ON system_ops.audit_records
    FOR EACH ROW EXECUTE FUNCTION public.raise_on_delete();
```

**No `updated_at` column.** The immutability trigger prevents any UPDATE, so `updated_at` would never change and is therefore omitted. `created_at` serves as the definitive event timestamp. `performed_at` is the business-meaningful event time (always `= created_at` for synchronous operations; may differ for async system events written after the fact).

### 4.2 Canonical Action Catalog

The `action` column stores one of the following named values. This list is the canonical enumeration — not a database CHECK constraint (allowing non-breaking extension). New action types require only code changes, not schema migrations.

**Group 1 — Pages & Tags (Registry)**

| Action | Trigger API | Subject Entity Type | Notes |
|---|---|---|---|
| `TAG_CREATED` | API-0102 | `TAG` | Includes implicit EC and Translation slot creation |
| `TAG_DEPRECATED` | API-0107 | `TAG` | |
| `TAG_METADATA_UPDATED` | API-0108 | `TAG` | copy_type changed |
| `PAGE_CREATED` | API-0101 | `PAGE` | Explicit page registration |
| `PAGE_DEPRECATED` | API-0107 cascade | `PAGE` | Cascade from last tag deprecation; same transaction |
| `PAGE_METADATA_UPDATED` | API-0106 | `PAGE` | page_name or module changed |

**Group 2 — English Copy**

| Action | Trigger API | Subject Entity Type | Notes |
|---|---|---|---|
| `ENGLISH_COPY_DRAFT_SAVED` | API-0201 | `ENGLISH_COPY_VERSION` | New version created or draft updated |
| `ENGLISH_COPY_SUBMITTED_FOR_REVIEW` | API-0202 | `ENGLISH_COPY_VERSION` | Status → PENDING_REVIEW |
| `ENGLISH_COPY_REVIEW_RETURNED` | API-0203 RETURN | `ENGLISH_COPY_VERSION` | Status → DRAFT |
| `ENGLISH_COPY_APPROVED` | API-0203 APPROVE | `ENGLISH_COPY_VERSION` | Includes stale cascade side-effect |
| `ENGLISH_COPY_REJECTED` | API-0203 REJECT | `ENGLISH_COPY_VERSION` | |
| `ENGLISH_COPY_ESCALATED` | API-0203 ESCALATE | `ENGLISH_COPY_VERSION` | Sent to Founder for review |

**Group 3 — Translation Management**

| Action | Trigger API | Subject Entity Type | Notes |
|---|---|---|---|
| `TRANSLATION_AI_GENERATED` | API-0301 | `TRANSLATION_VERSION` | Single AI translation created |
| `TRANSLATION_AI_BULK_GENERATED` | API-0302 | `TRANSLATION` | Records page-level bulk; individual TV audit by TV |
| `TRANSLATION_DRAFT_SAVED` | API-0303 | `TRANSLATION_VERSION` | Manual translation draft |
| `TRANSLATION_SUBMITTED_FOR_REVIEW` | API-0309 | `TRANSLATION` | Status → PENDING_REVIEW |
| `TRANSLATION_APPROVED` | API-0304 APPROVE | `TRANSLATION_VERSION` | Includes implicit DEV publish trigger check |
| `TRANSLATION_BULK_APPROVED` | API-0305 | `TRANSLATION` | Records per-language bulk approval |
| `TRANSLATION_REVIEWER_EDITED_AND_APPROVED` | API-0304 EDIT_AND_APPROVE | `TRANSLATION_VERSION` | New version created + approved |
| `TRANSLATION_RETRANSLATION_REQUESTED` | API-0304 REQUEST_RETRANSLATION | `TRANSLATION_VERSION` | New AI version created |
| `TRANSLATION_REJECTED` | API-0304 REJECT | `TRANSLATION_VERSION` | |
| `TRANSLATION_STALE_RESOLVED_CONFIRMED` | API-0306 CONFIRM | `TRANSLATION_VERSION` | New version created from confirmed-stale |
| `TRANSLATION_STALE_RETRANSLATED` | API-0307 | `TRANSLATION_VERSION` | New AI version from stale |
| `TRANSLATION_STALE_MANUALLY_EDITED` | API-0306 EDIT | `TRANSLATION_VERSION` | Manual edit of stale translation |

**Group 4 — Publishing & Deployment**

| Action | Trigger API | Subject Entity Type | Notes |
|---|---|---|---|
| `PUBLISHING_APPROVAL_REQUESTED` | API-0403 | `PUBLISHING_APPROVAL_REQUEST` | |
| `PUBLISHING_APPROVAL_GRANTED` | API-0404 APPROVE | `PUBLISHING_APPROVAL_REQUEST` | Includes Release creation |
| `PUBLISHING_APPROVAL_REJECTED` | API-0404 REJECT | `PUBLISHING_APPROVAL_REQUEST` | |
| `PUBLISHING_APPROVAL_CANCELLED` | API-0404 (hash mismatch) | `PUBLISHING_APPROVAL_REQUEST` | Bundle changed between request and decision |
| `PUBLISHING_APPROVAL_EXPIRED` | SYSTEM:EXPIRY_JOB | `PUBLISHING_APPROVAL_REQUEST` | |
| `RELEASE_INITIATED` | API-0404/API-0502 | `RELEASE` | Release status → IN_PROGRESS |
| `RELEASE_SUCCEEDED` | API-0405 callback | `RELEASE` | Language Services confirmed receipt |
| `RELEASE_FAILED` | API-0405 callback | `RELEASE` | Language Services returned error |
| `ROLLBACK_INITIATED` | API-0407 | `RELEASE` | Rollback release created |
| `ROLLBACK_SUCCEEDED` | API-0407 callback | `RELEASE` | Rollback confirmed by Language Services |
| `ROLLBACK_FAILED` | API-0407 callback | `RELEASE` | Rollback failed at Language Services |

**Group 5 — System-Triggered Operations**

| Action | Trigger API | Subject Entity Type | Notes |
|---|---|---|---|
| `TRANSLATIONS_STALE_FLAGGED` | API-0501 | `TRANSLATION` | One audit record per flagged translation, OR one summary record |
| `AUTO_PUBLISH_DEV_INITIATED` | API-0502 | `RELEASE` | Implicit DEV publish triggered |
| `AUTO_PUBLISH_DEV_SUCCEEDED` | API-0502 callback | `RELEASE` | |
| `AUTO_PUBLISH_DEV_FAILED` | API-0502 callback | `RELEASE` | |
| `COVERAGE_METRICS_UPDATED` | API-0503 | `COVERAGE_METRICS` | One record per trigger event |
| `NOTIFICATION_DISPATCHED` | API-0504 | `NOTIFICATION` | One per notification delivery attempt |

**Group 7 — Search & Navigation**

| Action | Trigger API | Subject Entity Type | Notes |
|---|---|---|---|
| `BOOKMARK_CREATED` | API-0702 | `BOOKMARK` | |
| `BOOKMARK_REMOVED` | API-0704 | `BOOKMARK` | Deletion permitted for bookmarks, but deletion IS still audited |

**Group 8 — Administration**

| Action | Trigger API | Subject Entity Type | Notes |
|---|---|---|---|
| `LANGUAGE_ADDED` | API-0802 | `LANGUAGE` | Includes bulk translation slot creation |
| `LANGUAGE_ACTIVATED` | API-0803 | `LANGUAGE` | |
| `LANGUAGE_DEACTIVATED` | API-0803 | `LANGUAGE` | |
| `TRANSLATION_SLOTS_BULK_CREATED` | API-0506 | `TRANSLATION` | Summary record for new language slot creation |
| `USER_CREATED` | API-0806 | `USER` | |
| `USER_DEPROVISIONED` | API-0806 | `USER` | |
| `ROLE_GRANTED` | API-0804 | `USER_ROLE_ASSIGNMENT` | |
| `ROLE_REVOKED` | API-0804 | `USER_ROLE_ASSIGNMENT` | |
| `SYSTEM_CONFIGURATION_UPDATED` | API-0807 | `SYSTEM_CONFIGURATION` | before_state and after_state populated |

**Group 9 — Comments, Audit & Export**

| Action | Trigger API | Subject Entity Type | Notes |
|---|---|---|---|
| `COMMENT_CREATED` | API-0901 | `COMMENT` | |
| `COMMENT_RESOLVED` | API-0903 | `COMMENT` | |
| `EXPORT_JOB_CREATED` | API-0905 | `EXPORT_JOB` | |
| `EXPORT_JOB_DOWNLOADED` | API-0905 download | `EXPORT_JOB` | |

**Group 10 — Migration**

| Action | Trigger API | Subject Entity Type | Notes |
|---|---|---|---|
| `MIGRATION_STARTED` | API-1001 | `IMPORT_EVENT` | Upload received, validation initiated |
| `MIGRATION_PAGE_IMPORT_SUCCEEDED` | API-1002 (per page) | `IMPORT_EVENT` | Per-page success within migration |
| `MIGRATION_PAGE_IMPORT_FAILED` | API-1002 (per page) | `IMPORT_EVENT` | Per-page failure |
| `MIGRATION_COMPLETED` | API-1002 | `IMPORT_EVENT` | All pages processed |
| `MIGRATION_FAILED` | API-1002 | `IMPORT_EVENT` | Migration aborted |

**Total named actions: 60.** New actions must be documented here before they can be emitted by application code.

### 4.3 Subject Entity Taxonomy

The `subject_entity_type` column uses the following controlled vocabulary:

| `subject_entity_type` | Corresponding Table | `subject_entity_id` | `subject_entity_id_aux` |
|---|---|---|---|
| `PAGE` | `registry.pages` | `page_id` | NULL |
| `TAG` | `registry.tags` | `tag_id` | NULL |
| `ENGLISH_COPY` | `content.english_copies` | `tag_id` | NULL |
| `ENGLISH_COPY_VERSION` | `content.english_copy_versions` | `tag_id` | `version_number` (as text) |
| `TRANSLATION` | `translation.translations` | `tag_id` | `language_code` |
| `TRANSLATION_VERSION` | `translation.translation_versions` | `tag_id` | `language_code::version_number` |
| `LANGUAGE` | `admin.languages` | `language_code` | NULL |
| `USER` | `admin.users` | `user_id` (UUID as text) | NULL |
| `USER_ROLE_ASSIGNMENT` | `admin.user_role_assignments` | `assignment_id` (UUID as text) | NULL |
| `SYSTEM_CONFIGURATION` | `admin.system_configuration` | `config_key` | NULL |
| `PUBLISHING_APPROVAL_REQUEST` | `publishing.publishing_approval_requests` | `approval_request_id` (UUID) | NULL |
| `RELEASE` | `publishing.releases` | `release_id` (UUID) | NULL |
| `COMMENT` | `collaboration.comments` | `comment_id` (UUID) | NULL |
| `NOTIFICATION` | `system_ops.notifications` | `notification_id` (UUID) | NULL |
| `BOOKMARK` | `search.bookmarks` | `bookmark_id` (UUID) | NULL |
| `EXPORT_JOB` | `collaboration.export_jobs` | `export_job_id` (UUID) | NULL |
| `IMPORT_EVENT` | `migration.import_events` | `import_event_id` (UUID) | NULL |
| `COVERAGE_METRICS` | `reporting.coverage_metrics` | `page_id::language_code` | NULL |

**No FK from `audit_records` to subject tables.** The polymorphic reference is enforced at application layer only (DB-01 §5.3, Pattern A). Because audit records are written at the same moment the subject exists, and subjects are never deleted, the reference is always valid at write time and remains valid forever.

### 4.4 Before/After State Capture Strategy

Not every action captures `before_state` and `after_state`. Populating them for every action would be excessively verbose and storage-intensive. The following table defines which actions capture state snapshots and what they contain.

**Selective capture policy:**

| Action Group | `before_state` | `after_state` |
|---|---|---|
| TAG_CREATED, PAGE_CREATED | NULL | `{tag_id, page_id, status}` |
| TAG_DEPRECATED, PAGE_DEPRECATED | `{status: "ACTIVE"}` | `{status: "DEPRECATED"}` |
| ENGLISH_COPY_APPROVED | `{version_number, text_preview, status: "PENDING_REVIEW"}` | `{version_number, status: "APPROVED", approved_by}` |
| ENGLISH_COPY_REJECTED | `{version_number, status: "PENDING_REVIEW"}` | `{version_number, status: "REJECTED", rejection_reason}` |
| TRANSLATIONS_STALE_FLAGGED | `{status: "APPROVED", current_english_version_number}` | `{status: "STALE", stale_triggered_by_english_ver}` |
| TRANSLATION_APPROVED | `{version_number, status: "PENDING_REVIEW"}` | `{version_number, status: "APPROVED", approved_by}` |
| RELEASE_SUCCEEDED | `{status: "IN_PROGRESS"}` | `{status: "SUCCESSFUL", deployment_version, completed_at}` |
| RELEASE_FAILED | `{status: "IN_PROGRESS"}` | `{status: "FAILED", error_summary}` |
| ROLLBACK_SUCCEEDED | NULL | `{deployment_version, rolled_back_from_deployment_version, status: "SUCCESSFUL"}` |
| SYSTEM_CONFIGURATION_UPDATED | `{config_key, config_value: <prior>}` | `{config_key, config_value: <new>}` |
| ROLE_GRANTED | NULL | `{user_id, role, assigned_at}` |
| ROLE_REVOKED | `{user_id, role, assigned_at}` | `{revoked_at, revoked_by}` |
| LANGUAGE_DEACTIVATED | `{status: "ACTIVE"}` | `{status: "INACTIVE"}` |
| All other creation events | NULL | NULL |
| All read-only APIs | Not recorded | Not recorded |

**`text_preview` convention:** For `before_state` on content changes, the English or translation `text` field is truncated to the first 200 characters with `"..."` appended if longer. This prevents excessively large JSONB values in the audit table while still providing human-readable context.

**Read events are not audited.** GET requests do not generate audit records. The audit table records mutations and system events only. API-0904 (Get Audit Trail) reads from this table — it does not create records about its own reads.

### 4.5 Immutability Guarantees

`system_ops.audit_records` is subject to the strictest immutability rules in the entire schema:

1. **No UPDATE.** `raise_on_update()` trigger fires on any UPDATE attempt, regardless of which columns are being changed.
2. **No DELETE.** `raise_on_delete()` trigger fires on any DELETE attempt.
3. **No `updated_at` column.** Its absence makes clear that updates are neither expected nor possible.
4. **Written within the primary transaction.** If the audit INSERT fails, the entire primary operation rolls back. This ensures no mutation exists without an audit record (DB-01 §12.3).
5. **Async system events (notifications, coverage updates) write their audit records in a separate follow-up transaction.** If the follow-up fails, the audit record is missing but the primary operation is not rolled back. This is an accepted trade-off for system event auditing vs. business operation auditing.

**Implication:** Audit records may contain errors (e.g., a truncated text_preview, a wrong api_id). These errors are NOT correctable — a new, corrective audit record with action `AUDIT_CORRECTION_NOTE` may be appended, but the original erroneous record is never modified.

### 4.6 Indexes

The following indexes on `system_ops.audit_records` are derived from API-0904 (Get Audit Trail) query patterns, which supports filters by entity, by actor, by time range, and by action type:

```sql
-- OQ-7 resolution: Index 1 — Chronological timeline (newest first)
-- Used by: API-0904 default timeline, API-0605 Activity Timeline
CREATE INDEX idx_audit_performed_at
    ON system_ops.audit_records (performed_at DESC);

-- OQ-7 resolution: Index 2 — All audit records for a specific entity
-- Used by: API-0904 filter by entity (e.g., "show all changes to tag QUICK_1")
CREATE INDEX idx_audit_subject
    ON system_ops.audit_records (subject_entity_type, subject_entity_id, performed_at DESC);

-- OQ-7 resolution: Index 3 — All actions by a specific user
-- Used by: API-0904 filter by actor (e.g., "show all changes made by user X")
CREATE INDEX idx_audit_user
    ON system_ops.audit_records (performed_by_user_id, performed_at DESC)
    WHERE performed_by_user_id IS NOT NULL;

-- Index 4 — Lookup by API request correlation ID
-- Used by: request tracing and debugging (not a user-facing API, but operational necessity)
CREATE INDEX idx_audit_request_id
    ON system_ops.audit_records (request_id)
    WHERE request_id IS NOT NULL;

-- Index 5 — Filter by action type (e.g., "show all ENGLISH_COPY_APPROVED events")
-- Used by: API-0904 filter by action, operational monitoring
CREATE INDEX idx_audit_action
    ON system_ops.audit_records (action, performed_at DESC);
```

**Note on composite vs. separate indexes:** The above indexes are single-column or two-column leading-column indexes because PostgreSQL's query planner can combine them via bitmap index scans for multi-filter queries (e.g., "by entity AND by time range"). Separate indexes avoid the combinatorial explosion of multi-column composite indexes for all possible filter combinations.

### 4.7 Partitioning Readiness

As documented in DB-01 §17.3, `system_ops.audit_records` is designed for future range partitioning by `performed_at`.

**Design decisions that make partitioning non-breaking:**

1. **UUID v7 primary key** (time-ordered): Partition keys in PostgreSQL range partitioning work alongside UUID PKs without conflict. The UUID v7's embedded time component means insert patterns are naturally sequential, avoiding cross-partition hotspot writes.

2. **No FK from other tables to `audit_records`.** No table references `audit_record_id` as a FK — so partitioning does not break any FK relationship (partitioned tables in PostgreSQL cannot be FK targets in older versions).

3. **No self-referencing relationships** within `audit_records`.

4. **Index designs are partition-local.** Each of the five indexes above is applied per partition when partitioning is enabled.

**Future partitioning DDL pattern (not executed now):**
```sql
-- When the table exceeds ~10 million rows, convert to partitioned table:
-- 1. Rename existing table as the first partition
-- 2. Create new partitioned parent table with same schema
-- 3. Attach renamed table as partition for the historical range
-- 4. Create new partitions for current and future ranges
-- Annual partitions are recommended (e.g., audit_records_2026, audit_records_2027)
```

**Current volume estimate:** At initial scale (~15 users, 89 pages, ~50 tags per page), the audit table will accumulate roughly 500–2,000 records per day. Partitioning is not needed for several years. The design ensures it can be added without schema changes.

### 4.8 Audit vs Other Historical Structures (Boundary)

`system_ops.audit_records` is the **single source of audit truth**. The following structures provide related but distinct functions and must not duplicate the audit table:

| Structure | Purpose | Distinct From Audit? |
|---|---|---|
| `collaboration.comments` | Team discussion on tags. Human-authored text. Not tied to a specific action. | ✅ Different domain: communication, not record of state change |
| `system_ops.notifications` | Per-user delivery of event notifications. Tracks delivery state and read state. | ✅ Different domain: delivery mechanism. Notifications reference events; they don't record the event. |
| Activity Timeline (API-0605) | UI view of recent activity. | ✅ A read projection over `audit_records`. Not a separate table. The timeline IS the audit records with formatting applied. |
| `publishing.publishing_approval_requests` | Records the approval decision with actor and timestamp. | ⚠️ Overlapping: PAR records who approved and when. `audit_records` also records `PUBLISHING_APPROVAL_GRANTED`. **Resolution:** The PAR table is the governance record (contains the full request context, hash, expiry). The audit record is the event log entry (action + actor + timestamp + before/after). Both are maintained — they serve different query patterns. |
| `publishing.release_content_snapshots` | Records what was deployed. | ✅ Different domain: content snapshot, not event record. |

---

## 5. `migration.import_events` — Historical Governance Record

**Classification:** `GOVERNANCE_RECORD` (lifecycle-mutable) — the import event record itself is permanent  
**FRD Reference:** §F-14 (Migration capability), §5.9  
**Entity Model:** ED-01 §ImportEvent  
**ED-03 Contract:** §2.19  
**DB-01 Reference:** §16.1 (file storage in object storage), DB-R-09 (concurrent migration prevention)

### 5.1 Table Definition

```sql
CREATE TABLE migration.import_events (
    -- Identity: surrogate UUID v7
    import_event_id         UUID            NOT NULL,

    -- Status lifecycle
    status                  VARCHAR(30)     NOT NULL DEFAULT 'UPLOAD_READY',

    -- Upload reference (object storage — NOT a BYTEA column per DB-01 §16.1)
    file_reference_url      TEXT            NOT NULL,
    original_filename       VARCHAR(500)    NULL,
    file_size_bytes         BIGINT          NULL,

    -- Execution tracking
    initiated_by            UUID            NOT NULL REFERENCES admin.users(user_id),
    initiated_at            TIMESTAMPTZ     NOT NULL DEFAULT now(),
    processing_started_at   TIMESTAMPTZ     NULL,   -- when actual import processing began
    completed_at            TIMESTAMPTZ     NULL,   -- when all pages processed (SUCCESS or FAIL)

    -- Import result counts (updated incrementally during processing)
    pages_attempted         INTEGER         NOT NULL DEFAULT 0,
    pages_succeeded         INTEGER         NOT NULL DEFAULT 0,
    pages_failed            INTEGER         NOT NULL DEFAULT 0,
    tags_imported           INTEGER         NOT NULL DEFAULT 0,
    translations_imported   INTEGER         NOT NULL DEFAULT 0,

    -- Validation and error reporting (freeform — not queried per-field)
    validation_report       JSONB           NULL,
    error_summary           TEXT            NULL,

    -- Concurrency control
    etag_version            INTEGER         NOT NULL DEFAULT 1,

    -- Timestamps
    created_at              TIMESTAMPTZ     NOT NULL DEFAULT now(),
    updated_at              TIMESTAMPTZ     NOT NULL DEFAULT now(),

    -- Constraints
    CONSTRAINT import_events_pkey PRIMARY KEY (import_event_id),
    CONSTRAINT import_events_status_check
        CHECK (status IN (
            'UPLOAD_READY',
            'VALIDATING',
            'VALIDATION_FAILED',
            'PROCESSING',
            'COMPLETED',
            'FAILED',
            'REPORT_AVAILABLE'
        )),
    CONSTRAINT import_events_completion_consistency
        CHECK (
            (completed_at IS NULL AND status IN ('UPLOAD_READY', 'VALIDATING', 'VALIDATION_FAILED', 'PROCESSING')) OR
            (completed_at IS NOT NULL AND status IN ('COMPLETED', 'FAILED', 'REPORT_AVAILABLE'))
        ),
    CONSTRAINT import_events_processing_started_consistency
        CHECK (
            (processing_started_at IS NULL AND status IN ('UPLOAD_READY', 'VALIDATING', 'VALIDATION_FAILED')) OR
            (processing_started_at IS NOT NULL AND status IN ('PROCESSING', 'COMPLETED', 'FAILED', 'REPORT_AVAILABLE'))
        )
);

COMMENT ON TABLE migration.import_events IS
    'GOVERNANCE_RECORD: Permanent record of every migration import attempt. '
    'Created when migration file is uploaded (API-1001). '
    'Status lifecycle: UPLOAD_READY → VALIDATING → VALIDATION_FAILED (terminal) or '
    'PROCESSING → COMPLETED or FAILED → REPORT_AVAILABLE. '
    'file_reference_url points to object storage — NOT a BYTEA column. '
    'Never deleted. Concurrent processing prevented by partial unique index.';

COMMENT ON COLUMN migration.import_events.file_reference_url IS
    'Presigned or permanent URL to the uploaded migration file in object storage (e.g., S3). '
    'The migration processing job reads from this URL, not from the database. '
    'NOT a BYTEA column — per DB-01 §16.1.';
COMMENT ON COLUMN migration.import_events.pages_attempted IS
    'Count of pages for which import was attempted. Updated during processing. '
    'pages_succeeded + pages_failed should equal pages_attempted on COMPLETED status.';
COMMENT ON COLUMN migration.import_events.validation_report IS
    'JSONB freeform validation summary. Populated after validation phase. '
    'Contains per-page validation results. Not queried field-by-field by application logic — '
    'only returned as-is via API-1003 (Get Migration Report).';
COMMENT ON COLUMN migration.import_events.status IS
    'UPLOAD_READY: file received, validation not yet started. '
    'VALIDATING: validation in progress. '
    'VALIDATION_FAILED: file failed validation — no import attempted. '
    'PROCESSING: import in progress. '
    'COMPLETED: all pages processed (some may have failed — check pages_failed). '
    'FAILED: import aborted before completion. '
    'REPORT_AVAILABLE: completed + report generated and available for download.';
```

**Triggers:**
```sql
CREATE TRIGGER import_events_set_updated_at
    BEFORE UPDATE ON migration.import_events
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER import_events_etag_increment
    BEFORE UPDATE ON migration.import_events
    FOR EACH ROW EXECUTE FUNCTION public.increment_etag();

CREATE TRIGGER import_events_no_delete
    BEFORE DELETE ON migration.import_events
    FOR EACH ROW EXECUTE FUNCTION public.raise_on_delete();
```

### 5.2 Concurrent Migration Prevention

```sql
-- At most one PROCESSING migration at any time (DB-R-09 from DB-01)
-- Prevents two concurrent migration jobs from simultaneously writing to the same tables.
CREATE UNIQUE INDEX import_events_processing_unique
    ON migration.import_events (status)
    WHERE status = 'PROCESSING';
```

This partial unique index on `status` WHERE `status = 'PROCESSING'` means only one row can have `status = 'PROCESSING'` at any time. A second migration attempt returns a `409 Conflict` at the API layer when the application checks this condition before transitioning status to `PROCESSING`.

**Note:** The partial unique index on a single value works in PostgreSQL. Attempting to INSERT or UPDATE a second row to `status = 'PROCESSING'` while one exists will violate the partial unique constraint.

### 5.3 Relationship to Core Transactional Schema

When migration processing succeeds for a page, the following records are created (in the migration transaction sequence from DB-02 §12.6):

| Created Record | Table | Discriminator |
|---|---|---|
| Page | `registry.pages` | `created_by = migration_system_user` |
| Tags | `registry.tags` | `created_by = migration_system_user` |
| English Copy (live state) | `content.english_copies` | `status = 'APPROVED'` at creation |
| English Copy Version 1 | `content.english_copy_versions` | `authored_by_source = 'SYSTEM:MIGRATION'` |
| Translation (live state) | `translation.translations` | `status = 'APPROVED'` at creation |
| Translation Version 1 | `translation.translation_versions` | `creation_method = 'MIGRATED'` |
| Production Release (v1) | `publishing.releases` | `trigger_source = 'MIGRATION'`, `approval_request_id = NULL` |
| Release snapshots | `publishing.release_content_snapshots` | Per tag per language |
| Audit record per page | `system_ops.audit_records` | `action = 'MIGRATION_PAGE_IMPORT_SUCCEEDED'` |

The `import_event_id` is not stored on any of the created transactional records (it would require a column on every imported entity). Instead, the audit records for migration actions include the `import_event_id` in `subject_entity_id` (subject_entity_type = `IMPORT_EVENT`) so all created records are traceable to their import event via the audit trail.

**Indexes:**
```sql
-- Lookup import events by status (API-1003, monitoring)
CREATE INDEX idx_import_events_status
    ON migration.import_events (status, initiated_at DESC);

-- All imports by a specific user
CREATE INDEX idx_import_events_initiated_by
    ON migration.import_events (initiated_by, initiated_at DESC);
```

---

## 6. Historical Permanence and Retention Classification

This table provides the definitive retention and permanence classification for every history-bearing structure in MioTranslate.

| Table | Classification | Mutable Fields (if any) | Deletable? | Retention |
|---|---|---|---|---|
| `content.english_copy_versions` | `IMMUTABLE_HISTORY` | `status` (APPROVED→SUPERSEDED only via trigger-guarded UPDATE); append-once review lifecycle fields | ❌ Never | Permanent |
| `translation.translation_versions` | `IMMUTABLE_HISTORY` | `status` (APPROVED→SUPERSEDED only); append-once review lifecycle fields | ❌ Never | Permanent |
| `publishing.releases` | `IMMUTABLE_HISTORY` + `GOVERNANCE_RECORD` | `status` (SUCCESSFUL→ROLLED_BACK only); `rolled_back_at` (append-once); `api_response_payload` (written at completion) | ❌ Never | Permanent |
| `publishing.release_content_snapshots` | `IMMUTABLE_HISTORY` | None — absolutely immutable | ❌ Never | Permanent |
| `publishing.publishing_approval_requests` | `GOVERNANCE_RECORD` | `status` (all lifecycle transitions); append-once decision fields | ❌ Never | Permanent |
| `system_ops.audit_records` | `IMMUTABLE_HISTORY` + `SYSTEM_EVENT` | None — absolutely immutable (no UPDATE trigger) | ❌ Never | Permanent |
| `admin.user_role_assignments` | `GOVERNANCE_RECORD` | `revoked_at`, `revoked_by` (append-once) | ❌ Never | Permanent |
| `migration.import_events` | `GOVERNANCE_RECORD` | `status`, result counts, `validation_report`, `error_summary` (lifecycle updates) | ❌ Never | Permanent |
| `collaboration.comments` | `GOVERNANCE_RECORD` | `is_resolved`, `resolved_at`, `resolved_by` (append-once) | ❌ Never | Permanent |
| `system_ops.notifications` | `GOVERNANCE_RECORD` + `SYSTEM_EVENT` | `status` (UNREAD→READ), `read_at` (append-once), delivery fields | ❌ Never | Permanent |

**Rebuildable structures (not yet defined in DB-02 or DB-03):**

| Structure | Classification | Rebuildable from |
|---|---|---|
| `reporting.coverage_metrics` | `DERIVED_READ_MODEL` | Source tables (tags, translations, releases) — full rebuild always possible |
| `search.recently_edited_events` | `USER_PERSONAL` | Audit records + notification of page views (partial rebuild — view events are ephemeral) |

---

## 7. Concurrency and Write Ordering for Historical Structures

### 7.1 Append-Only History — No Concurrency Problem

Immutable history tables (`english_copy_versions`, `translation_versions`, `release_content_snapshots`, `audit_records`) are INSERT-only. INSERTs into append-only tables have no concurrency conflict — PostgreSQL MVCC allows concurrent INSERTs without blocking. The only concurrency concern is version number uniqueness (§2.6, handled by PK constraint and application-level FOR UPDATE on the parent row).

### 7.2 Mutable Lifecycle Fields — ETag Protection

Tables with mutable lifecycle fields (`english_copies`, `translations`, `publishing_approval_requests`, `releases`) use `etag_version` optimistic locking (DB-02 §11) to protect against lost updates. Historical tables that permit narrow lifecycle mutations (`english_copy_versions.status`, `translation_versions.status`, `releases.status`) do NOT have `etag_version` — they are only mutated as part of a transaction that already holds a `SELECT FOR UPDATE` on the parent live-state row.

### 7.3 Write Ownership per Historical Table

| Table | Write Owner | Trigger |
|---|---|---|
| `english_copy_versions` | Group 2 (Content Domain) | EC draft save, submit, approve, reject |
| `translation_versions` | Group 3 (Translation Domain) | Translation creation, approval, stale resolution |
| `release_content_snapshots` | Group 4 (Publishing Domain) | Language Services success callback (API-0405) |
| `publishing.releases` | Groups 4 + 5 | PAR approval (Group 4) + Status updates (Group 4/5 async) |
| `publishing.publishing_approval_requests` | Group 4 | API-0403, API-0404 |
| `system_ops.audit_records` | ALL groups (within their primary transactions) | Every mutating API |
| `migration.import_events` | Group 10 (Migration) | API-1001, API-1002 |
| `admin.user_role_assignments` | Group 8 (Administration) | API-0804 |

**One-way write rule (from ED-03 §4):** No group writes to another group's authoritative tables **except** the one documented cross-domain write: Group 5 writes `status = STALE` and `staleInfo` fields to `translation.translations` (Group 3's table). This exception is explicitly documented in DB-02 §5.1 and DB-01 §2.3.

### 7.4 Audit Record Write Ordering

Within a SERIALIZABLE transaction for any primary operation:

```
1. All primary table INSERTs/UPDATEs
2. audit_records INSERT (same transaction, last step)
COMMIT
```

If Step 2 fails (e.g., disk full, constraint violation), the transaction rolls back entirely — no primary operation succeeds without its audit record.

For async system events (notification dispatch, coverage recalculation):
```
Primary transaction COMMITS first.
Worker picks up event → writes audit record in a SEPARATE transaction.
If worker fails → audit record may be missing for this specific system event.
(Accepted trade-off per DB-01 §12.3.)
```

---

## 8. Database Guarantees Summary

The following table explicitly states the database-level guarantee for each key historical correctness property:

| Property | Guarantee | Mechanism |
|---|---|---|
| No historical content mutation on versions | DB-enforced | `validate_ecv_update()` and `validate_tv_update()` triggers prevent content field changes |
| No accidental deletion of any historical record | DB-enforced | `raise_on_delete()` trigger on all permanent tables |
| Single APPROVED EC Version per tag at any time | DB-enforced | Partial unique index `WHERE status = 'APPROVED'` on `english_copy_versions` |
| `source_english_version` references a valid EC Version | DB-enforced | Cross-table FK `(tag_id, source_english_version)` REFERENCES `english_copy_versions(tag_id, version_number)` |
| Version number is positive integer | DB-enforced | `CHECK (version_number >= 1)` |
| Deployment version identity uniqueness | DB-enforced | `UNIQUE (page_id, language_code, environment, deployment_version)` on releases |
| Only one in-flight release per scope | DB-enforced | Partial unique index `WHERE status IN ('PENDING', 'IN_PROGRESS')` on releases |
| Only one PENDING PAR per scope | DB-enforced | Partial unique index `WHERE status = 'PENDING'` on publishing_approval_requests |
| Only one PROCESSING migration | DB-enforced | Partial unique index `WHERE status = 'PROCESSING'` on import_events |
| Release content snapshot immutable | DB-enforced | `raise_on_update()` trigger on `release_content_snapshots` |
| Audit records immutable | DB-enforced | `raise_on_update()` + `raise_on_delete()` triggers on `audit_records` |
| Valid status transitions on version rows | DB-enforced | `validate_ecv_update()` and `validate_tv_update()` trigger state machine checks |
| Valid status transitions on releases | DB-enforced | `validate_release_update()` trigger |
| Comment text immutable | DB-enforced | `validate_comment_update()` trigger |
| Version number is sequential (no gaps) | Application-enforced | `SELECT FOR UPDATE` on parent + `MAX(version_number) + 1` assignment in SERIALIZABLE transaction |
| `source_english_version` is the EC version at translation time | Application-enforced | API-0301/0302/0303/0304/0306/0307 assign current approved EC version at call time |
| SUPERSEDED before new APPROVED (EC/TV ordering) | Application-enforced | Application executes SUPERSEDE step before APPROVE step in transaction |
| Audit record for every mutation | Application-enforced | Every mutating API inserts audit record in same transaction |
| MIGRATED TVs only created by migration process | Application-enforced | API-1002 is the only code path that sets `creation_method = 'MIGRATED'` |
| Rollback reproduces prior snapshot content | Application-enforced | Rollback reads `release_content_snapshots` of target deployment_version |
| Admin-lockout guard | Application-enforced | Count-based check before API-0804 write |

---

## 9. Consistency Audit

### 9.1 ED-01 Historical Entity Coverage

| ED-01 Historical Entity | Covered In | Missing? |
|---|---|---|
| EnglishCopyVersion | DB-02 (full DDL) + DB-03 (lineage, sequencing, SUPERSEDED) | ✅ |
| TranslationVersion | DB-02 (full DDL) + DB-03 (lineage, source_english_version, migration exception) | ✅ |
| Release | DB-02 (full DDL) + DB-03 (rollback lineage, snapshot reproducibility) | ✅ |
| ReleaseContentSnapshot | DB-02 (full DDL) + DB-03 (reproducibility guarantee) | ✅ |
| PublishingApprovalRequest | DB-02 (full DDL) + DB-03 (history chain, PAR → Release linkage) | ✅ |
| AuditRecord | DB-03 §4 (full DDL + action catalog + indexes) | ✅ |
| ImportEvent | DB-03 §5 (full DDL + concurrent prevention) | ✅ |
| UserRoleAssignment | DB-02 (full DDL with append-once revocation) | ✅ |

### 9.2 ED-02 Lifecycle Completeness

| ED-02 Lifecycle Requirement | Satisfied? | Evidence |
|---|---|---|
| EC Version history: DRAFT→PENDING_REVIEW→APPROVED→SUPERSEDED | ✅ | `validate_ecv_update()` state machine; partial unique for single APPROVED |
| TV Version history: same progression | ✅ | `validate_tv_update()` state machine |
| staleInfo is live state, not version history | ✅ | staleInfo on `translation.translations` (DB-02 §5.1), not on translation_versions |
| source_english_version forms the lineage chain | ✅ | Cross-schema FK (DEFERRED) enforced at COMMIT time |
| Migration exception: TV1 ↔ ECV1 simultaneous creation | ✅ | DB-03 §2.3: DEFERRED FK + transaction ordering documented |
| Rollback: new Release record, prior SUCCESSFUL → ROLLED_BACK | ✅ | DB-03 §3.2 + `validate_release_update()` narrow transition |
| Release contentSnapshot immutable once written | ✅ | `raise_on_update()` trigger on `release_content_snapshots` |
| Double-change stale: in-place staleInfo update | ✅ | `stale_triggered_by_english_ver` + `stale_current_english_text` updatable (live state) |
| SUPERSEDED before new APPROVED | ✅ | Partial unique index enforces via ordering (§2.5 Step 1 before Step 2) |

### 9.3 ED-03 Cross-Domain Invariant Satisfaction

| ED-03 Invariant | Satisfied? | Notes |
|---|---|---|
| XI-05: `(tag_id, version_number)` unique per ECV | ✅ | PRIMARY KEY |
| XI-06: `(tag_id, language_code, version_number)` unique per TV | ✅ | PRIMARY KEY |
| XI-07: Deployment identity unique | ✅ | UNIQUE constraint + partial unique for in-flight |
| XI-15: TV.source_english_version references valid ECV | ✅ | Cross-schema FK DEFERRED |
| XI-16: Migration exception is only discriminated form | ✅ | `creation_method = 'MIGRATED'` CHECK + SYSTEM:MIGRATION source only |
| XI-19: Single APPROVED ECV per tag | ✅ | Partial unique index |
| XI-23: Release contentSnapshot written once | ✅ | `raise_on_update()` trigger |
| XI-24: Rollback creates new Release | ✅ | `release_type = 'ROLLBACK'` + deployment_version increment |
| XI-27: Release not deleted | ✅ | `raise_on_delete()` trigger |
| XI-31: Audit records immutable | ✅ | `raise_on_update()` + `raise_on_delete()` triggers |
| XI-32: Audit records permanent | ✅ | No retention expiry defined; permanent storage |
| XI-33: Coverage metrics derived, rebuildable | ✅ | Not in DB-03; flagged as future derived model |

### 9.4 API Fields Referenced But Not Previously Persisted

After reviewing all API Group contracts:

| API Field | Where Persisted | Status |
|---|---|---|
| API-0203: `escalatedToFounder` | `english_copy_versions.escalated_to_founder` (DB-02 §4.2) | ✅ |
| API-0304: `variableIntegrityStatus` | `translation_versions.variable_integrity_status` (DB-02 §5.2) | ✅ |
| API-0304: `backTranslation` | `translation_versions.back_translation` (DB-02 §5.2) | ✅ |
| API-0403: `bundleSnapshotHash` | `publishing_approval_requests.bundle_snapshot_hash` (DB-02 §6.1) | ✅ |
| API-0404: `expiresAt` | `publishing_approval_requests.expires_at` (DB-02 §6.1) | ✅ |
| API-0405: `apiResponsePayload` | `publishing.releases.api_response_payload` JSONB (DB-02 §6.2) | ✅ |
| API-0603: `staleTriggeredAt` | `translation.translations.stale_triggered_at` (DB-02 §5.1) | ✅ |
| API-0904: action, subject, actor, timestamp, request_id | `system_ops.audit_records` (DB-03 §4.1) | ✅ |
| API-0904: before_state, after_state | `system_ops.audit_records.before_state/.after_state` (DB-03 §4.4) | ✅ |
| API-1003: validation_report | `migration.import_events.validation_report` (DB-03 §5.1) | ✅ |

**No unresisted API fields found.**

### 9.5 DB Fields With No Product/API Purpose

Reviewing all columns defined in DB-02 and DB-03:

| Field | Table | Assessment |
|---|---|---|
| `subject_entity_id_aux` | `audit_records` | Required for compound-PK subjects (tag_id + language_code for translations). Not redundant. |
| `performed_by_source` | `audit_records` | Required to distinguish user vs. system-triggered actions (ED-03 §4 cross-domain writes). Not redundant. |
| `pages_attempted` / `pages_succeeded` / `pages_failed` | `import_events` | Required for API-1003 (Migration Report). Not redundant. |
| `api_response_success` | `publishing.releases` | Convenience derived from `api_response_payload`. Could be computed at API layer, but stored as a boolean to avoid parsing JSONB on every release status check. Low risk of staleness (written once at completion). Retained. |

**No DB fields found that lack product/API purpose.**

### 9.6 Identified Gaps and Open Items

| # | Gap / Open Item | Severity | Recommended Resolution |
|---|---|---|---|
| DB-03-OI-01 | `TRANSLATIONS_STALE_FLAGGED` audit record granularity: one record per flagged translation OR one summary record for the entire cascade? At 89 pages × 8 languages, a single English approval could generate 8 audit records simultaneously. | Low | **Recommended:** One audit record per flagged Translation (not a summary). Each record: `subject_entity_type = TRANSLATION`, `subject_entity_id = tag_id`, `subject_entity_id_aux = language_code`. The `idx_audit_subject` index covers per-translation queries. Total records per approval: ≤ 8 (one per active language). Acceptable volume. |
| DB-03-OI-02 | `TRANSLATION_AI_BULK_GENERATED` audit granularity: one record per TV created, or one summary per page? Bulk translation (API-0302) can create dozens of TVs at once. | Low | **Recommended:** One summary audit record with `subject_entity_type = TRANSLATION`, `subject_entity_id = page_id`, and `after_state = {tags_count: N, language_code: $lang}`. Individual TV creation is traceable via `translation_versions.authored_at` timestamps + `creation_method = AI_GENERATED`. |
| DB-03-OI-03 | `TRANSLATION_SLOTS_BULK_CREATED` (API-0506 — new language added): audit granularity for creating thousands of NO_TRANSLATION slots. | Low | **Recommended:** One summary audit record with `subject_entity_type = LANGUAGE`, `subject_entity_id = language_code`, `after_state = {slots_created: N}`. Not one record per slot (would be catastrophic at ~4,500 slots). |
| DB-03-OI-04 | `migration.import_events` file retention: after COMPLETED status, how long is the object storage file retained? DB-01 §20.7 suggests 7 days. This requires a cleanup job that updates `file_reference_url` to NULL or marks the file expired. The import_events table itself is permanent. | Low | Define in operational runbook. Add `file_expires_at TIMESTAMPTZ NULL` column to `import_events` in a future schema iteration to support automated cleanup signaling. Not a blocking issue for DB-03. |
| DB-03-OI-05 | `english_copy_versions.search_vector` covers all version texts, including DRAFT and REJECTED versions. API-0701 search may want to search only APPROVED version texts. | Low | Revisit in DB-04 (Search & Navigation Schema). The current GIN index covers all versions. A partial GIN index `WHERE status = 'APPROVED'` can be added independently without changing the column definition. |
| DB-03-OI-06 | Missing audit action for `PAGE_METADATA_UPDATED` (API-0106) in the catalog. Added in the §4.2 catalog above. No schema change needed — action catalog is documentation only. | Resolved | Listed in the action catalog in §4.2 above. |

### 9.7 Broken Lineage Checks

| Lineage | Status | How Verified |
|---|---|---|
| `translation_versions.source_english_version` → `english_copy_versions(tag_id, version_number)` | ✅ Unbroken | Cross-schema FK DEFERRABLE; verified in DB-03 §2.2 |
| Migration TV1 → ECv1 (simultaneous creation) | ✅ Representable | DEFERRED FK; verified in DB-03 §2.3 |
| Rollback release → prior SUCCESSFUL release content | ✅ Reproducible | `release_content_snapshots` is IMMUTABLE_HISTORY; verified in DB-03 §3.2–3.3 |
| PAR → Release linkage | ✅ Unbroken | `releases.approval_request_id FK → publishing_approval_requests.approval_request_id`; NULL for system/migration releases |
| SUPERSEDED versions → APPROVED version | ✅ Queryable | Partial unique on APPROVED guarantees uniqueness; SUPERSEDED versions remain in table |
| Audit record → subject entity | ✅ Valid at write time | Polymorphic reference; subject always exists when audit record is written; subject never deleted |

### 9.8 Contradictory Constraint Checks

| Potential Contradiction | Resolution |
|---|---|
| `validate_ecv_update()` permits `APPROVED → SUPERSEDED` but partial unique index says "only one APPROVED". | No contradiction. The UPDATE that sets `status = 'SUPERSEDED'` removes that row from the partial unique index scope, allowing the next row to be set to `APPROVED`. The trigger permits the transition; the index prevents two simultaneous APPROVED rows. They work together. |
| `releases.rolled_back_at` is set by an UPDATE on a previously-SUCCESSFUL release, but `validate_release_update()` only permits `SUCCESSFUL → ROLLED_BACK`. | No contradiction. The trigger explicitly permits `SUCCESSFUL → ROLLED_BACK` as the narrow exception for rollback operations. |
| `translation_versions.source_english_version` FK is DEFERRABLE — does this weaken integrity? | No. `DEFERRABLE INITIALLY DEFERRED` means the FK is checked at COMMIT, not at statement time. Within any committed transaction, the FK is always satisfied. The only case where FK satisfaction happens "late" is during migration bootstrap, where EC Version 1 is inserted in step 2c and TV Version 1 in step 2d of the same transaction — both are present at COMMIT. |
| EC Version has `change_reason NULL` but the product requires explaining edits. | No contradiction. `change_reason` is explicitly optional per FRD. The application does not enforce that it is provided; it is recorded when supplied. |

---

*End of MioTranslate — DB-03: History, Versioning & Audit Schema v1.0*

*Documents in the DB series:*  
*DB-01 — Database Architecture & Standards ✅*  
*DB-02 — Core Transactional Schema ✅*  
*DB-03 — History, Versioning & Audit Schema ✅*  
*DB-04 — Reporting & Read Model Schema (Coverage Metrics, Environment Status, Pending Work)*  
*DB-05 — Search & Navigation Schema (Search Index, Recently Edited, Bookmarks supplementary)*  
*DB-06 — Collaboration & Export Schema (Export Jobs)*  
*DB-07 — Administration Supplementary Schema*  
*DB-08 — Migration Operational Schema*
