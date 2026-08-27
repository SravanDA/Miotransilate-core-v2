# MioTranslate — DB-05: Migration & Operational Storage Schema

**Product:** MioTranslate  
**Document Type:** Database Design — Layer 5 (Migration & Operational Storage)  
**Document ID:** DB-05  
**Version:** 1.0  
**Author:** Principal Database Architect + Senior Backend/Platform Architect  
**Date:** August 2026  
**Mandatory Standards Reference:** DB-01 v1.0  
**Direct Predecessors:** DB-03 v1.0 (defines `migration.import_events`), DB-04 v1.0  
**Entity Model Sources:** ED-01 v1.1, ED-02 v1.0, ED-03 v1.0  
**API Sources:** Group 9 v1.2 (API-0905 Export), Group 10 v1.1 (API-1001/1002/1003 Migration)

---

> **Purpose of this document.**  
> DB-05 defines the physical persistence for two operational domains not fully covered by DB-02 through DB-04:
>
> 1. **Migration Operational State (Group 10):** DB-03 already defines `migration.import_events` with the core lifecycle columns. DB-05 extends that table with the columns required by Group 10's API contracts (file format, checksum, executed_by actor, validation report components, failure reason, expiry signals) and adds the `migration.migration_row_events` table for queryable per-row skipped/failed records.
>
> 2. **Export Jobs (Group 9 API-0905):** The `collaboration.export_jobs` table was deferred from DB-02 and DB-03. DB-05 provides its complete physical definition.
>
> **Relationship to DB-03:** DB-03 §5 defines `migration.import_events` with 16 columns (identity, status, file_reference_url, original_filename, file_size_bytes, execution timestamps, result counts, validation_report JSONB, error_summary, etag_version, created_at, updated_at). DB-05 does not redefine that table. It documents 8 additional columns as an ALTER TABLE extension and provides the per-row events table.
>
> **Scope exclusions:** Comments (already in DB-02 `collaboration.comments`), audit records (DB-03), notifications (DB-02), reporting/coverage (DB-04). This document does not redesign any prior table.

---

## Table of Contents

1. Architecture Boundary: Permanent Governance vs. Temporary Operational State
2. Migration State Machine — Reconciliation
3. `migration.import_events` Extension (DB-03 Base + DB-05 Additions)
   - 3.1 Columns Added in DB-05 (ALTER TABLE)
   - 3.2 Updated Table Constraints
   - 3.3 Updated Trigger and Index Set
   - 3.4 Complete Column Reference (DB-03 + DB-05)
4. Validation Report Physical Model
   - 4.1 Structured Column vs. JSONB Decision
   - 4.2 JSONB Schema Contract for `validation_report`
   - 4.3 Discrepancy and Skip Reason Classification
5. `migration.migration_row_events` — Per-Row Operational Records
   - 5.1 Purpose and Scope
   - 5.2 Table Definition
   - 5.3 Relationship to `validation_report` JSONB
   - 5.4 Retention
6. File Storage Model
   - 6.1 Migration Upload File
   - 6.2 Export Generated File
   - 6.3 Vendor-Neutral Storage Reference
   - 6.4 File Expiry Signaling
7. `collaboration.export_jobs` — Export Job Operational Record
   - 7.1 Export State Machine
   - 7.2 Table Definition
   - 7.3 Snapshot Boundary Semantics
   - 7.4 Download Lifecycle
   - 7.5 Triggers
   - 7.6 Indexes
   - 7.7 Export Rate Limiting
8. Retention and Cleanup Classification
   - 8.1 Migration Governance (Permanent)
   - 8.2 Migration File (Temporary)
   - 8.3 Export Records (Transient)
   - 8.4 Export Files (Transient)
   - 8.5 Cleanup Job Responsibilities
9. Concurrency and Safety
   - 9.1 Migration: One-at-a-Time Enforcement
   - 9.2 Migration: Idempotent Status Transitions
   - 9.3 Migration: Rollback Safety
   - 9.4 Export: Concurrent Generation
10. Observability Fields
11. New Indexes Added in DB-05
12. Consistency Audit

---

## 1. Architecture Boundary: Permanent Governance vs. Temporary Operational State

DB-05 covers two fundamentally different record types that must not be confused:

| Record Class | Example | Permanence | Row Deletable? | File Deletable? |
|---|---|---|---|---|
| **Migration Governance Record** | `migration.import_events` | ✅ Permanent forever | ❌ Never | ✅ Yes — file is transient; row is not |
| **Migration Row Event** | `migration.migration_row_events` | ✅ Permanent (they are the audit of what was skipped) | ❌ Never | N/A — no file |
| **Export Job Record** | `collaboration.export_jobs` | ⏱ Transient — row may be deleted after expiry + file cleanup | ✅ Yes, after confirmed expiry | ✅ Yes — after TTL |
| **Migration Upload File** | Object storage file | ⏱ Transient — kept for processing duration + short window | N/A | ✅ Yes — after processing + retention window |
| **Export Generated File** | Object storage file | ⏱ Transient — 1 hour TTL | N/A | ✅ Yes — after TTL |

**Critical distinction:**
- The `migration.import_events` row is **permanent** — even after the migration file is deleted from object storage, the import event record, its counts, its validation report, and its audit correlation data must remain.
- `collaboration.export_jobs` rows are **transient** — after the file expires and is deleted from object storage, the export job record itself may be purged. This is the only category of DB-05 records where row deletion is permitted (per DB-01 §3.1 which lists export_jobs as delete-permitted).

---

## 2. Migration State Machine — Reconciliation

DB-03 §5.1 defined the `status` CHECK constraint with 7 states. Group 10 §1.5 shows a simplified 5-state diagram. The following table reconciles both and establishes the **canonical locked state set for DB-05**:

| Status | Group 10 §1.5 | DB-03 §5.1 | DB-05 Decision | Meaning |
|---|---|---|---|---|
| `UPLOAD_READY` | ✅ | ✅ | ✅ Canonical | File uploaded and structurally validated. Awaiting execution. |
| `VALIDATING` | ❌ not shown | ✅ | ✅ Retained | API-1002 step: validation phase before entity creation begins. Intermediate operational state. |
| `VALIDATION_FAILED` | ❌ not shown | ✅ | ✅ Retained | File passed structural check (API-1001) but failed content/data validation during API-1002. Terminal. |
| `PROCESSING` | ✅ | ✅ | ✅ Canonical | Migration import is executing entity creation. |
| `COMPLETED` | ✅ | ✅ | ✅ Canonical | All entities created. Some rows may have been skipped (`rowsSkipped`). Terminal for the import phase. |
| `FAILED` | ✅ | ✅ | ✅ Canonical | Import aborted. Rollback applied. System restored to pre-migration state. Terminal. |
| `REPORT_AVAILABLE` | ✅ | ✅ | ✅ Canonical | Report generated via API-1003. Terminal state for a successful migration. |

**Resolution:** Group 10 §1.5 shows a simplified view without `VALIDATING` and `VALIDATION_FAILED`. This is a diagram simplification, not a contract conflict. The full 7-state model from DB-03 is correct — it is consistent with Group 10's business rules:
- Group 10 §3.2.5 Step 1 says "Pre-execution check: verify UPLOAD_READY status." The `VALIDATING` state captures the intermediate step between UPLOAD_READY and PROCESSING.
- Group 10 §3.1.4 says "FILE_PARSE_ERROR" errors are returned at API-1001. But data-level validation errors (e.g., duplicate page IDs, conflicting page names) detected during the API-1002 processing step set `VALIDATION_FAILED`.

**State transition diagram (canonical):**

```
                  ┌────────────────────┐
                  │    UPLOAD_READY    │  ← API-1001 succeeds
                  └─────────┬──────────┘
                             │ API-1002 called
                             ▼
                  ┌────────────────────┐
                  │     VALIDATING     │  ← Content validation in progress
                  └─────────┬──────────┘
                    ┌────────┴────────┐
                    │fail             │pass
                    ▼                 ▼
         ┌───────────────────┐  ┌──────────────────┐
         │ VALIDATION_FAILED │  │    PROCESSING    │  ← Entity creation running
         └───────────────────┘  └───────┬──────────┘
                                  ┌──────┴──────┐
                                  │fail         │success
                                  ▼             ▼
                             ┌──────────┐  ┌──────────┐
                             │  FAILED  │  │ COMPLETED│  ← Entities created
                             └──────────┘  └────┬─────┘
                                                │ API-1003 called
                                                ▼
                                    ┌─────────────────────┐
                                    │  REPORT_AVAILABLE   │  ← Terminal. Migration done.
                                    └─────────────────────┘
```

**Terminal states:** `VALIDATION_FAILED`, `FAILED`, `REPORT_AVAILABLE`.  
**Non-terminal states:** `UPLOAD_READY`, `VALIDATING`, `PROCESSING`.

After `FAILED`, a new migration upload (API-1001) may be initiated — a new `import_events` row is created. The failed row remains permanently.

---

## 3. `migration.import_events` Extension (DB-03 Base + DB-05 Additions)

### 3.1 Columns Added in DB-05 (ALTER TABLE)

The following 8 columns are added to `migration.import_events`. They were deferred from DB-03 (DB-03-OI-04 partially anticipated this). DB-05 provides the complete specification.

```sql
ALTER TABLE migration.import_events
    -- Who executed the migration (API-1002 caller)
    -- Distinct from initiated_by (API-1001 caller) — may be the same user
    ADD COLUMN executed_by              UUID            NULL
        REFERENCES admin.users(user_id),

    -- File format detected during upload (API-1001)
    -- v1: only 'CSV' accepted (Group 10 OQ-1 resolution)
    -- Future: 'EXCEL', 'JSON'
    ADD COLUMN file_format              VARCHAR(10)     NOT NULL DEFAULT 'CSV',

    -- SHA-256 checksum of the uploaded file
    -- Computed at upload time by the application; stored for integrity verification
    -- NULL before upload processing completes (should always be non-NULL after API-1001 success)
    ADD COLUMN file_checksum_sha256     VARCHAR(64)     NULL,

    -- Language columns detected in the file header (API-1001 response: detectedColumns.languageColumns)
    -- Stored as a JSONB array of language code strings: ["ar", "ta", "hi", "fr"]
    -- Used for post-import verification and observability
    ADD COLUMN detected_language_columns JSONB          NULL,

    -- Structural validation result from API-1001 (rowCount, headerValid, requiredColumnsMissing)
    -- Stored as JSONB: { "rowCount": 895, "headerValid": true, "requiredColumnsMissing": [] }
    -- Populated during API-1001 upload; not updated after
    ADD COLUMN structural_validation_result JSONB       NULL,

    -- Human-readable failure reason for FAILED or VALIDATION_FAILED states
    -- Error code or message from the processing step that caused failure
    -- Corresponds to the failureReason field in the API-1002 status poll response
    ADD COLUMN failure_reason           TEXT            NULL,

    -- When the uploaded file in object storage expires (is eligible for deletion)
    -- Set to: completed_at / failed_at + configured_retention_period (default: 7 days)
    -- NULL until the import reaches a terminal state
    -- After this timestamp: the object storage file may be deleted; this row remains
    ADD COLUMN file_expires_at          TIMESTAMPTZ     NULL,

    -- When API-1003 generated the validation report (first call after COMPLETED)
    -- NULL until API-1003 is called for the first time
    ADD COLUMN report_generated_at      TIMESTAMPTZ     NULL;
```

**Column comments:**

```sql
COMMENT ON COLUMN migration.import_events.executed_by IS
    'UUID of the user who called API-1002 (Execute Migration Import). '
    'NULL until API-1002 is invoked. May differ from initiated_by '
    'if a different administrator triggers execution than the one who uploaded.';

COMMENT ON COLUMN migration.import_events.file_format IS
    'File format detected at API-1001 upload time. '
    'v1 accepts CSV only (Group 10 OQ-1). Future values: EXCEL, JSON. '
    'Not null — always set at upload time.';

COMMENT ON COLUMN migration.import_events.file_checksum_sha256 IS
    'SHA-256 hex digest of the uploaded file. Computed by the application at upload time. '
    'Used for: (1) file integrity verification before processing; '
    '(2) forensic audit if data integrity questions arise after migration. '
    'Not computed by the database — application responsibility.';

COMMENT ON COLUMN migration.import_events.detected_language_columns IS
    'JSONB array of ISO 639-1 language codes detected as column headers in the import file. '
    'Example: ["ar", "ta", "hi", "fr"]. '
    'Returned in API-1001 response as detectedColumns.languageColumns. '
    'Codes not configured in admin.languages are skipped during API-1002 processing. '
    'Not queried field-by-field — stored for observability and report assembly.';

COMMENT ON COLUMN migration.import_events.structural_validation_result IS
    'JSONB structural validation summary from API-1001. '
    'Schema: { "rowCount": INTEGER, "headerValid": BOOLEAN, "requiredColumnsMissing": [] }. '
    'Set at API-1001 completion. Never updated after upload.';

COMMENT ON COLUMN migration.import_events.failure_reason IS
    'Human-readable failure reason string set when status = FAILED or VALIDATION_FAILED. '
    'NULL for successful migrations. '
    'Surfaced in the API-1002 status poll response failureReason field.';

COMMENT ON COLUMN migration.import_events.file_expires_at IS
    'Timestamp after which the object storage file referenced by file_reference_url '
    'is eligible for deletion. Set when the import reaches a terminal state '
    '(COMPLETED, FAILED, VALIDATION_FAILED). '
    'Retention period: completed_at + system_configuration.migration_file_retention_days '
    '(default: 7 days from DB-01 §20.7). '
    'The database row is permanent — only the file is deleted. '
    'After deletion, file_reference_url is set to NULL by the cleanup job.';

COMMENT ON COLUMN migration.import_events.report_generated_at IS
    'Timestamp when API-1003 first generated the validation report. '
    'Signals that status = REPORT_AVAILABLE has been reached. '
    'NULL while status is COMPLETED (report not yet requested). '
    'Subsequent API-1003 calls use the cached validation_report — '
    'report_generated_at does not update on repeat calls.';
```

### 3.2 Updated Table Constraints

The existing constraints from DB-03 §5.1 remain. The following constraints are **added or modified** in DB-05:

```sql
-- Updated status CHECK: same 7 values, confirmed unchanged from DB-03
-- (No change to the CHECK constraint — DB-03's constraint is already correct)

-- New: failure_reason must be present when status indicates failure
ALTER TABLE migration.import_events
    ADD CONSTRAINT import_events_failure_reason_consistency
        CHECK (
            (failure_reason IS NULL AND status NOT IN ('FAILED', 'VALIDATION_FAILED')) OR
            (failure_reason IS NOT NULL AND status IN ('FAILED', 'VALIDATION_FAILED')) OR
            -- Allow NULL failure_reason on failure states only if the row is in transition
            -- (application sets failure_reason atomically with status)
            (failure_reason IS NULL AND status IN ('FAILED', 'VALIDATION_FAILED'))
            -- NOTE: This relaxation allows a brief NULL window during atomic UPDATE.
            -- In practice: UPDATE import_events SET status = 'FAILED', failure_reason = $reason
            -- executes atomically; the constraint will not fire for partial updates.
            -- Simplified: failure_reason NULL is always permitted at the DB level;
            -- the application enforces non-NULL failure_reason for FAILED/VALIDATION_FAILED states.
        );
-- DECISION: The above constraint is DROPPED. The consistency between failure_reason and status
-- is enforced at the application layer (API-1002 processor always sets both atomically).
-- Adding a DB CHECK here would require a complex OR that adds noise without adding safety.
-- Application code is the right place for this validation.

-- New: file_expires_at must be set when terminal status is reached
-- (This is an observability/cleanup aid, not a hard constraint — not DB-enforced)
-- Application responsibility: set file_expires_at when transitioning to COMPLETED/FAILED/VALIDATION_FAILED.

-- New: executed_by must be non-NULL when PROCESSING or later
ALTER TABLE migration.import_events
    ADD CONSTRAINT import_events_executed_by_consistency
        CHECK (
            (executed_by IS NULL AND status IN ('UPLOAD_READY', 'VALIDATING', 'VALIDATION_FAILED')) OR
            (executed_by IS NOT NULL AND status IN ('PROCESSING', 'COMPLETED', 'FAILED', 'REPORT_AVAILABLE'))
        );
```

> **Note on constraint complexity:** DB-01 §10 states that nullable business fields should be nullable when their presence depends on lifecycle state. The `executed_by` consistency constraint above is appropriate because its presence/absence deterministically maps to states. For `failure_reason`, the DB-level constraint is explicitly dropped — application enforcement is sufficient and cleaner.

### 3.3 Updated Trigger and Index Set

DB-03 defined 3 triggers (set_updated_at, etag_increment, no_delete) and 2 indexes. No changes to existing triggers or indexes. New indexes added in DB-05 §11.

### 3.4 Complete Column Reference (DB-03 + DB-05)

The complete column set for `migration.import_events` after DB-05 extensions:

| Column | Type | Source | Description |
|---|---|---|---|
| `import_event_id` | UUID (PK) | DB-03 | UUID v7 — unique migration attempt identifier |
| `status` | VARCHAR(30) | DB-03 | 7-state lifecycle (see §2) |
| `file_reference_url` | TEXT | DB-03 | Object storage URL for the uploaded file (NULL after file expiry cleanup) |
| `original_filename` | VARCHAR(500) | DB-03 | Filename as uploaded by the user |
| `file_size_bytes` | BIGINT | DB-03 | File size in bytes |
| `initiated_by` | UUID (FK) | DB-03 | User who called API-1001 (uploaded the file) |
| `initiated_at` | TIMESTAMPTZ | DB-03 | When API-1001 was called |
| `processing_started_at` | TIMESTAMPTZ | DB-03 | When API-1002 began execution |
| `completed_at` | TIMESTAMPTZ | DB-03 | When processing finished (success or failure) |
| `pages_attempted` | INTEGER | DB-03 | Pages for which import was attempted |
| `pages_succeeded` | INTEGER | DB-03 | Pages successfully created |
| `pages_failed` | INTEGER | DB-03 | Pages that caused a fatal error |
| `tags_imported` | INTEGER | DB-03 | Total tags created |
| `translations_imported` | INTEGER | DB-03 | Total translation records created |
| `validation_report` | JSONB | DB-03 | Full validation report (see §4) |
| `error_summary` | TEXT | DB-03 | Short human-readable error description (legacy; `failure_reason` preferred) |
| `etag_version` | INTEGER | DB-03 | Optimistic concurrency version |
| `created_at` | TIMESTAMPTZ | DB-03 | Row creation timestamp |
| `updated_at` | TIMESTAMPTZ | DB-03 | Last row modification timestamp |
| `executed_by` | UUID (FK, NULL) | **DB-05** | User who called API-1002 |
| `file_format` | VARCHAR(10) | **DB-05** | `CSV` (v1 only) |
| `file_checksum_sha256` | VARCHAR(64, NULL) | **DB-05** | SHA-256 digest of uploaded file |
| `detected_language_columns` | JSONB (NULL) | **DB-05** | Language codes detected in file header |
| `structural_validation_result` | JSONB (NULL) | **DB-05** | API-1001 structural check result |
| `failure_reason` | TEXT (NULL) | **DB-05** | Failure error code/message |
| `file_expires_at` | TIMESTAMPTZ (NULL) | **DB-05** | When the object-storage file expires |
| `report_generated_at` | TIMESTAMPTZ (NULL) | **DB-05** | When API-1003 first generated the report |

**Total: 27 columns.** DB-03 defined 19 (indexed: 16 business columns + 3 meta). DB-05 adds 8.

---

## 4. Validation Report Physical Model

### 4.1 Structured Column vs. JSONB Decision

The validation report (API-1003 response — §2.3 of Group 10) has two distinct components:

| Component | Group 10 Data Shape | Query Requirement | Physical Storage |
|---|---|---|---|
| `summary.status` | Enum: `PASS`, `PASS_WITH_WARNINGS`, `FAIL` | ✅ Queried: monitoring dashboard, API-1003 fast summary | **Dedicated column**: `validation_summary_status VARCHAR(20)` |
| `summary.pagesExpected` | Integer | ✅ Queried: summary display, cross-check against `pages_attempted` | **Existing columns**: `pages_attempted`, `pages_succeeded`, `pages_failed` already cover this |
| `summary.tagsExpected` / `tagsFound` | Integers | ✅ Queried: summary display | **Existing columns**: `tags_imported` covers `tagsFound`; `tagsExpected` needs **new column** |
| `summary.translationsExpected` / `translationsFound` | Integers | ✅ Queried | `translations_imported` covers found; **new column** for expected |
| `summary.discrepancyCount` | Integer | ✅ Queried | **New column** |
| `discrepancies` | Array of objects | ❌ Not queried field-by-field — returned as-is | **JSONB in `validation_report`** |
| `skippedRows` | Array of objects | Partially queried (count) — the array returned as-is | **`migration.migration_row_events` table** (see §5) + count in `validation_report.summary` |
| `generatedAt` | Timestamp | ✅ Already stored as `report_generated_at` | **Existing column** (`report_generated_at` — DB-05 §3.1) |

**Outcome:** 3 additional structured columns are added to `migration.import_events`:

```sql
ALTER TABLE migration.import_events
    -- Validation summary status (the high-level pass/fail/warning result)
    ADD COLUMN validation_summary_status    VARCHAR(20)     NULL,
    -- NULL until API-1003 generates the report
    -- Values: PASS | PASS_WITH_WARNINGS | FAIL (Group 10 OQ-5 classification)

    -- Count of tag rows expected from the source file (excludes rows with missing tag_id)
    ADD COLUMN tags_expected                INTEGER         NOT NULL DEFAULT 0,

    -- Count of non-empty language cells expected (translationsExpected)
    ADD COLUMN translations_expected        INTEGER         NOT NULL DEFAULT 0,

    -- Count of discrepancy entries in the validation_report.discrepancies array
    ADD COLUMN discrepancy_count            INTEGER         NOT NULL DEFAULT 0;
```

```sql
COMMENT ON COLUMN migration.import_events.validation_summary_status IS
    'High-level validation outcome generated by API-1003. '
    'PASS: zero discrepancies, all expected counts match. '
    'PASS_WITH_WARNINGS: skipped rows or minor discrepancies (TRANSLATION_LANGUAGE_UNKNOWN, '
    'DUPLICATE_PAGE_NAME_CONFLICT, ENGLISH_COPY_EMPTY). '
    'FAIL: critical discrepancies — ENTITY_NOT_FOUND_POST_IMPORT or DUPLICATE_TAG_ID. '
    'NULL until API-1003 is called (status remains COMPLETED until then). '
    'Classification rules: Group 10 OQ-5.';

COMMENT ON COLUMN migration.import_events.tags_expected IS
    'Count of tag rows in the source file excluding rows with missing tag_id. '
    'Set during API-1002 file parsing. Used by API-1003 to compute: '
    'discrepancy when tags_imported < tags_expected.';

COMMENT ON COLUMN migration.import_events.translations_expected IS
    'Count of non-empty language column cells in the source file. '
    'Set during API-1002 file parsing. Used by API-1003 for translations_expected.';

COMMENT ON COLUMN migration.import_events.discrepancy_count IS
    'Count of entries in the validation_report.discrepancies JSON array. '
    'Zero for PASS migrations. Populated by API-1003 report generation. '
    'Stored as a dedicated column so monitoring queries can find FAIL/PASS_WITH_WARNINGS '
    'migrations without deserializing the JSONB blob.';
```

**Updated total:** 31 columns on `migration.import_events` after all DB-05 additions.

### 4.2 JSONB Schema Contract for `validation_report`

The `validation_report JSONB` column (defined in DB-03) stores the complete API-1003 response body. Its schema is:

```jsonc
{
  "generatedAt": "2026-08-21T09:13:00Z",        // ISO 8601 string
  "summary": {
    "status": "PASS",                             // PASS | PASS_WITH_WARNINGS | FAIL
    "pagesExpected": 14,
    "pagesFound": 14,
    "tagsExpected": 892,
    "tagsFound": 892,
    "translationsExpected": 2676,
    "translationsFound": 2676,
    "discrepancyCount": 0
  },
  "discrepancies": [
    // Array of: { "pageId", "tagId", "languageCode" | null, "reason" }
    // Populated when tagsFound < tagsExpected (ENTITY_NOT_FOUND_POST_IMPORT)
    // or when a critical data integrity discrepancy is detected
  ],
  "skippedRows": [
    // Array of: { "rowNumber", "pageId" | null, "tagId" | null, "reason" }
    // See §5 for the parallel migration_row_events table
  ]
}
```

**DB-01 JSONB policy compliance (DB-01 §15.1):**
- The `validation_report` JSONB field is **never queried field-by-field in application logic**. It is stored and returned as-is via API-1003.
- Fields queried by the application (`status`, `discrepancyCount`, summary counts) are stored in dedicated columns (`validation_summary_status`, `discrepancy_count`, `tags_expected`, `translations_expected`).
- No GIN index on `validation_report` — it is not searched (DB-01 §15.2: "JSONB columns used only for storage/retrieval do not require GIN indexes").

**Report generation is idempotent (Group 10 §3.3.4):** API-1003 generates the report once. Subsequent calls return the cached `validation_report` JSONB directly. `report_generated_at` is set only on first generation.

### 4.3 Discrepancy and Skip Reason Classification

The following table maps Group 10 §2.3.1 reason codes to their physical persistence location and their contribution to `validation_summary_status`:

| Reason Code | Produces `discrepancy`? | In `skippedRows`? | `validation_summary_status` Impact |
|---|---|---|---|
| `TAG_ID_MISSING` | ❌ | ✅ | PASS_WITH_WARNINGS (if skipped rows only) |
| `PAGE_ID_MISSING` | ❌ | ✅ | PASS_WITH_WARNINGS |
| `ENGLISH_COPY_EMPTY` | ❌ | ✅ | PASS_WITH_WARNINGS |
| `DUPLICATE_TAG_ID` | ❌ | ✅ | PASS_WITH_WARNINGS (first occurrence imported) |
| `DUPLICATE_PAGE_NAME_CONFLICT` | ✅ | ❌ | PASS_WITH_WARNINGS |
| `TRANSLATION_LANGUAGE_UNKNOWN` | ❌ | ✅ | PASS_WITH_WARNINGS |
| `ENTITY_NOT_FOUND_POST_IMPORT` | ✅ | ❌ | **FAIL** |

**`FAIL` threshold (Group 10 OQ-5):** Any `ENTITY_NOT_FOUND_POST_IMPORT` discrepancy → `FAIL`. Any `DUPLICATE_TAG_ID` collision that caused an entity to not be created → `FAIL`. All other reasons → `PASS_WITH_WARNINGS` if present, `PASS` if zero discrepancies and zero skipped rows.

---

## 5. `migration.migration_row_events` — Per-Row Operational Records

### 5.1 Purpose and Scope

The `validation_report.skippedRows` JSONB array stores all skipped rows for API-1003 retrieval. However, for operational queries — "how many rows were skipped for reason X?", "which tags were skipped for ENGLISH_COPY_EMPTY?" — querying a JSONB array is inefficient and inelegant.

`migration.migration_row_events` is a relational sibling table that stores each skipped/failed row as a dedicated row. It enables:
- Fast count queries by reason code (e.g., monitoring dashboards)
- Exact duplicate detection during processing (e.g., find if a `tag_id` already exists in skipped rows)
- Future API extensions that might need to expose paginated skipped-row lists

**Relationship to `validation_report` JSONB:** Both store the same skipped-row data. The JSONB blob serves the API-1003 response. The relational rows serve operational queries. They are populated simultaneously during API-1002 processing. There is no reconciliation risk because:
1. Both are written in the same processing context
2. The JSONB array is assembled from the relational rows at report generation time
3. If they diverge (e.g., a bug), the relational rows are the correct source (they were written first)

### 5.2 Table Definition

```sql
CREATE TABLE migration.migration_row_events (
    -- Identity
    row_event_id            UUID            NOT NULL,
    -- UUID v7

    -- Parent: the migration this row belongs to
    import_event_id         UUID            NOT NULL REFERENCES migration.import_events(import_event_id),

    -- Source location in the file
    source_row_number       INTEGER         NOT NULL,
    -- 1-indexed row number in the source file (header row = 0; first data row = 1)

    -- Context (may be NULL if the row had no identifiable page/tag)
    source_page_id          VARCHAR(100)    NULL,
    source_tag_id           VARCHAR(150)    NULL,
    source_language_code    VARCHAR(10)     NULL,
    -- NULL for row-level skips (PAGE_ID_MISSING, TAG_ID_MISSING)
    -- Non-NULL when a specific entity can be identified

    -- Event classification
    event_type              VARCHAR(10)     NOT NULL DEFAULT 'SKIPPED',
    -- 'SKIPPED': row was intentionally excluded (non-fatal)
    -- 'FAILED':  row caused a processing error (may have caused overall FAILED status)

    -- Reason code (Group 10 §2.3.1)
    reason_code             VARCHAR(60)     NOT NULL,
    -- TAG_ID_MISSING | PAGE_ID_MISSING | ENGLISH_COPY_EMPTY |
    -- DUPLICATE_TAG_ID | DUPLICATE_PAGE_NAME_CONFLICT |
    -- TRANSLATION_LANGUAGE_UNKNOWN | ENTITY_NOT_FOUND_POST_IMPORT

    -- Optional detail for context
    reason_detail           TEXT            NULL,
    -- Human-readable detail: e.g., "Tag QUICK_1 already recorded at row 42"

    -- Timestamp
    recorded_at             TIMESTAMPTZ     NOT NULL DEFAULT now(),

    -- Constraints
    CONSTRAINT migration_row_events_pkey PRIMARY KEY (row_event_id),
    CONSTRAINT migration_row_events_import_fkey
        FOREIGN KEY (import_event_id) REFERENCES migration.import_events(import_event_id),
    CONSTRAINT migration_row_events_event_type_check
        CHECK (event_type IN ('SKIPPED', 'FAILED')),
    CONSTRAINT migration_row_events_reason_code_check
        CHECK (reason_code IN (
            'TAG_ID_MISSING',
            'PAGE_ID_MISSING',
            'ENGLISH_COPY_EMPTY',
            'DUPLICATE_TAG_ID',
            'DUPLICATE_PAGE_NAME_CONFLICT',
            'TRANSLATION_LANGUAGE_UNKNOWN',
            'ENTITY_NOT_FOUND_POST_IMPORT'
        ))
);

COMMENT ON TABLE migration.migration_row_events IS
    'GOVERNANCE_RECORD: Relational record of each skipped or failed row during migration processing. '
    'One row per skipped/failed source file row. '
    'Parallel to the skippedRows array in import_events.validation_report JSONB — '
    'this table enables efficient queries; the JSONB serves the API response. '
    'Written during API-1002 processing. Never deleted. Never updated after INSERT.';

COMMENT ON COLUMN migration.migration_row_events.source_row_number IS
    '1-indexed row number in the source CSV file. Header row = 0 (not logged). '
    'First data row = 1. Used for human correlation to the source file.';

COMMENT ON COLUMN migration.migration_row_events.event_type IS
    'SKIPPED: row was intentionally excluded by a non-fatal rule (e.g., missing tag_id). '
    'FAILED: row caused a processing error. '
    'SKIPPED rows contribute to import_events.pages_succeeded or are simply excluded. '
    'FAILED rows contribute to import_events.pages_failed.';
```

**Triggers:**

```sql
-- No raise_on_update() needed — this table is INSERT-only by design
-- No updated_at — append-only; recorded_at is the write timestamp

CREATE TRIGGER migration_row_events_no_delete
    BEFORE DELETE ON migration.migration_row_events
    FOR EACH ROW EXECUTE FUNCTION public.raise_on_delete();
-- Permanent governance records — deletion is not permitted
```

### 5.3 Relationship to `validation_report` JSONB

```
API-1002 processes row 45 → tag_id missing:
  1. INSERT migration.migration_row_events (source_row_number=45, reason_code='TAG_ID_MISSING')
  2. (processing continues)

API-1003 called → report generation:
  1. SELECT * FROM migration.migration_row_events WHERE import_event_id = $id
  2. Assemble skippedRows array from result
  3. UPDATE import_events SET validation_report = $assembled_json, ...
  4. Return assembled report as API response
```

**Assembly query:**

```sql
-- Assemble skippedRows array for the validation report
SELECT json_agg(json_build_object(
    'rowNumber',    mre.source_row_number,
    'pageId',       mre.source_page_id,
    'tagId',        mre.source_tag_id,
    'reason',       mre.reason_code
) ORDER BY mre.source_row_number) AS skipped_rows_json
FROM migration.migration_row_events mre
WHERE mre.import_event_id = $import_event_id
  AND mre.event_type      = 'SKIPPED';
```

### 5.4 Retention

`migration.migration_row_events` rows are **permanent** (no DELETE trigger fires an exception — the `raise_on_delete` trigger enforces this). Even after the migration is complete and the import file is deleted from object storage, the row event records remain to support forensic audit and future administrative queries.

---

## 6. File Storage Model

### 6.1 Migration Upload File

**What PostgreSQL stores:** `migration.import_events.file_reference_url TEXT` — the object storage key or URL for the uploaded file.

**What PostgreSQL does NOT store:** The file binary content. Per DB-01 §16.1, no BYTEA column for file content.

**File identity fields in PostgreSQL:**

| Field | Column | Set At |
|---|---|---|
| Object storage URL | `file_reference_url` | API-1001 upload completion |
| Original filename | `original_filename` | API-1001 |
| File format | `file_format` | API-1001 |
| Size in bytes | `file_size_bytes` | API-1001 |
| SHA-256 checksum | `file_checksum_sha256` | API-1001 (application-computed) |
| Uploader | `initiated_by` | API-1001 |
| Upload timestamp | `initiated_at` | API-1001 |
| Expiry timestamp | `file_expires_at` | Set when terminal state reached |

**The migration processing job (API-1002) reads the file from object storage using `file_reference_url`.** It does not read from the database row.

### 6.2 Export Generated File

**What PostgreSQL stores:** `collaboration.export_jobs.file_reference_url TEXT` — the object storage key or URL for the generated export file.

**File identity fields in PostgreSQL:**

| Field | Column | Set At |
|---|---|---|
| Object storage URL | `file_reference_url` | Export generation completion |
| Format | `format` | At job creation (POST /v1/exports) |
| Row count | `row_count` | At generation completion |
| Generation timestamp | `generated_at` | At generation completion (= dataset_capture_at) |
| Expiry timestamp | `expires_at` | `generated_at + export_ttl_hours` |

**The download endpoint (GET /v1/exports/{exportId}/download) uses `file_reference_url` to generate a time-limited presigned URL.** It does not stream the file through the application database.

### 6.3 Vendor-Neutral Storage Reference

DB-01 §16.1 does not commit to a specific object storage vendor. DB-05 inherits this stance.

**`file_reference_url TEXT` stores a reference that is:**
- A presigned URL (e.g., S3 pre-signed GET URL with TTL), OR
- An internal object storage path (e.g., `s3://bucket/migrations/{import_event_id}/file.csv`), OR
- Any other dereferenceable object storage identifier

**The format of `file_reference_url` is opaque to PostgreSQL.** The application layer is responsible for knowing how to dereference it. The column type is `TEXT` (not `VARCHAR(N)`) — URLs and storage paths may be arbitrarily long.

**After file deletion:** `file_reference_url` is set to `NULL` by the cleanup job. A `NULL` `file_reference_url` indicates the file has been deleted. Application code must check for NULL before attempting to access the file.

### 6.4 File Expiry Signaling

**Migration files:**
- Default retention: `system_configuration.migration_file_retention_days` (configurable; DB-01 §20.7 suggests 7 days)
- `file_expires_at` is set by the application when the import reaches a terminal state:
  ```
  file_expires_at = completed_at + INTERVAL '7 days'  (or configured value)
  ```
- The cleanup job queries: `SELECT import_event_id, file_reference_url FROM migration.import_events WHERE file_expires_at < now() AND file_reference_url IS NOT NULL`
- On each matched row: delete from object storage → set `file_reference_url = NULL`

**Export files:**
- Fixed TTL: 1 hour from `generated_at` (Group 9 §3.5.5: "valid for 1 hour from generatedAt")
- `expires_at = generated_at + INTERVAL '1 hour'`
- The `system_configuration.export_ttl_hours` key (DB-02 §7.3) is present. Its value was `24` in DB-02's sample data — **this conflicts with Group 9 §3.5.5's 1-hour contract.**
- **Conflict Resolution (DB-05):** The API contract (Group 9 §3.5.5) is authoritative: export files expire 1 hour after generation. `system_configuration.export_ttl_hours` should be set to `1`. The DB-02 sample value of `24` was illustrative and must be corrected before production use.

---

## 7. `collaboration.export_jobs` — Export Job Operational Record

**Classification:** `USER_PERSONAL` (per-user scoped) and transient — DELETE is permitted after confirmed expiry (DB-01 §3.1)  
**API:** API-0905 (Export Tag Data) — Group 9 §3.5  
**Schema:** `collaboration` (DB-01 §2.2 schema map)  
**DB-02 Deferral:** Listed as "belongs to DB-09 (migration schema)" in DB-02 §14.1 — corrected here. Export Jobs belong to `collaboration` schema (Group 9), not `migration` schema (Group 10).

### 7.1 Export State Machine

```
       POST /v1/exports
             │
             ▼
      ┌─────────────┐
      │  GENERATING │  ← Export job created; file generation in progress
      └──────┬──────┘
             │
      ┌──────┴──────┐
      │ success     │ failure
      ▼             ▼
  ┌───────┐    ┌────────┐
  │ READY │    │ FAILED │  ← Terminal. Client must initiate new export.
  └───┬───┘    └────────┘
      │
      │ after expires_at
      ▼
  ┌─────────┐
  │ EXPIRED │  ← File deleted. Row may be purged. 410 response from download endpoint.
  └─────────┘
```

| State | Description |
|---|---|
| `GENERATING` | File generation is in progress. `file_reference_url` is NULL. |
| `READY` | File generated and available. `file_reference_url` is set. `expires_at` is set. |
| `FAILED` | File generation failed. `failure_reason` is set. No file was produced. |
| `EXPIRED` | `expires_at` has passed. File deleted from object storage. `file_reference_url` = NULL. Row retained briefly before purge. |

**No VALIDATED or APPROVED state.** Exports are not business records — they are ephemeral read snapshots.

### 7.2 Table Definition

```sql
CREATE TABLE collaboration.export_jobs (
    -- Identity: surrogate UUID v7
    export_job_id           UUID            NOT NULL,

    -- Scope: what was exported
    page_id                 VARCHAR(100)    NOT NULL REFERENCES registry.pages(page_id),
    language_code           VARCHAR(10)     NOT NULL REFERENCES admin.languages(language_code),

    -- Format requested by the user
    format                  VARCHAR(10)     NOT NULL,
    -- 'CSV' or 'EXCEL' (Group 9 §3.5.1)

    -- Actor: who requested the export
    requested_by            UUID            NOT NULL REFERENCES admin.users(user_id),

    -- Lifecycle
    status                  VARCHAR(15)     NOT NULL DEFAULT 'GENERATING',

    -- Snapshot boundary: when the data was actually read from the database
    -- For sync exports: ≈ created_at (same request)
    -- For async exports: may be seconds to minutes after created_at
    -- This is the "dataset-capture moment" per Group 9 §3.5.6
    dataset_capture_at      TIMESTAMPTZ     NULL,
    -- Set when the export job begins reading source data (before file generation starts)
    -- The consistent-read transaction/snapshot is established at this timestamp

    -- Generation result
    row_count               INTEGER         NULL,
    -- Number of tag rows in the exported file (not counting the header row)
    -- NULL while GENERATING; 0 is valid (page with no tags)

    generated_at            TIMESTAMPTZ     NULL,
    -- When file generation completed. Set simultaneously with file_reference_url.
    -- For sync exports: ≈ created_at + generation_time

    -- File reference
    file_reference_url      TEXT            NULL,
    -- Object storage URL. NULL while GENERATING or after EXPIRED cleanup.

    -- Download expiry
    expires_at              TIMESTAMPTZ     NULL,
    -- generated_at + INTERVAL '1 hour' (Group 9 §3.5.5 — 1-hour TTL)
    -- NULL while GENERATING. Set when status transitions to READY.

    -- Failure information
    failure_reason          TEXT            NULL,
    -- Set when status = FAILED. Human-readable error.

    -- Correlation
    request_id              UUID            NULL,
    -- The API request ID from the POST /v1/exports request
    -- Enables tracing: export job → original API request → audit logs

    -- Timestamps
    created_at              TIMESTAMPTZ     NOT NULL DEFAULT now(),
    updated_at              TIMESTAMPTZ     NOT NULL DEFAULT now(),

    -- Constraints
    CONSTRAINT export_jobs_pkey PRIMARY KEY (export_job_id),
    CONSTRAINT export_jobs_page_fkey
        FOREIGN KEY (page_id) REFERENCES registry.pages(page_id),
    CONSTRAINT export_jobs_language_fkey
        FOREIGN KEY (language_code) REFERENCES admin.languages(language_code),
    CONSTRAINT export_jobs_requested_by_fkey
        FOREIGN KEY (requested_by) REFERENCES admin.users(user_id),
    CONSTRAINT export_jobs_status_check
        CHECK (status IN ('GENERATING', 'READY', 'FAILED', 'EXPIRED')),
    CONSTRAINT export_jobs_format_check
        CHECK (format IN ('CSV', 'EXCEL')),
    CONSTRAINT export_jobs_ready_consistency
        CHECK (
            (status = 'READY'   AND generated_at IS NOT NULL AND file_reference_url IS NOT NULL AND expires_at IS NOT NULL) OR
            (status = 'GENERATING' AND generated_at IS NULL) OR
            (status = 'FAILED'  AND failure_reason IS NOT NULL) OR
            (status = 'EXPIRED')
            -- EXPIRED: file_reference_url is NULL (cleaned up); row may still exist
        ),
    CONSTRAINT export_jobs_expires_at_consistency
        CHECK (
            expires_at IS NULL OR
            (generated_at IS NOT NULL AND expires_at > generated_at)
        )
);

COMMENT ON TABLE collaboration.export_jobs IS
    'USER_PERSONAL (transient): Operational record for each export generation job. '
    'Created by API-0905 POST /v1/exports. '
    'Status lifecycle: GENERATING → READY or FAILED; READY → EXPIRED after TTL. '
    'file_reference_url points to object storage — NOT a BYTEA column (DB-01 §16.2). '
    'Export files are ephemeral — deleted 1 hour after generation. '
    'Export rows are transient — may be deleted after confirmed EXPIRED state. '
    'No audit record is written for export generation (read-equivalent operation per Group 9 §3.5.6). '
    'No FK back-reference from any source-of-truth table.';

COMMENT ON COLUMN collaboration.export_jobs.dataset_capture_at IS
    'The exact moment at which the export job read data from the database. '
    'This is the "dataset-capture moment" per Group 9 §3.5.6: the export file must be '
    'internally consistent to this single point in time. '
    'The export service must use a consistent read transaction/snapshot started at this '
    'timestamp to prevent partial reads during concurrent writes. '
    'For synchronous small-page exports: ≈ created_at. '
    'For async large-page exports: set when the background worker begins reading.';

COMMENT ON COLUMN collaboration.export_jobs.expires_at IS
    'Timestamp after which the export file is considered expired and should be deleted. '
    'Value: generated_at + INTERVAL ''1 hour'' (Group 9 §3.5.5). '
    'After this time: (1) the file is deleted from object storage, '
    '(2) file_reference_url is set to NULL, (3) status transitions to EXPIRED, '
    '(4) GET /v1/exports/{exportId}/download returns 410 EXPORT_EXPIRED. '
    'Note: export_ttl_hours in system_configuration should be set to 1 — not 24 '
    '(DB-02 sample value of 24 was illustrative; corrected here per Group 9 contract).';

COMMENT ON COLUMN collaboration.export_jobs.request_id IS
    'The API request correlation ID from the POST /v1/exports request. '
    'Not used for querying — used for operational tracing only. '
    'Allows engineers to correlate an export_job row to a specific API request '
    'in access logs or distributed tracing systems.';
```

### 7.3 Snapshot Boundary Semantics

Group 9 §3.5.6 requires: *"The generated file must be internally consistent to that single captured moment — no row may reflect a state from a different point in time."*

**Physical implementation:**

The export service, when it begins reading source data:

1. Sets `dataset_capture_at = now()` in the export_jobs row
2. Opens a **REPEATABLE READ** transaction (not the default READ COMMITTED) against the source tables
3. Reads all data within this transaction: `registry.tags`, `content.english_copy_versions` (APPROVED), `translation.translations`, `translation.translation_versions` (APPROVED)
4. Generates the export file from the transaction's consistent snapshot
5. Commits the read transaction
6. Sets `generated_at = now()`, `status = 'READY'`, `file_reference_url = ...`, `expires_at = now() + INTERVAL '1 hour'`

**Why REPEATABLE READ (not SERIALIZABLE):**
- The export is a read-only operation — no writes occur in this transaction
- REPEATABLE READ provides a stable snapshot for the entire transaction duration without false serialization conflicts
- SERIALIZABLE would also work but adds unnecessary overhead for a pure-read transaction

**`dataset_capture_at` vs. `generated_at`:**

| Timestamp | Meaning |
|---|---|
| `dataset_capture_at` | When data reading began — defines the snapshot point |
| `generated_at` | When file generation completed — may be seconds to minutes after `dataset_capture_at` for large pages |
| `expires_at` | `generated_at + 1 hour` — download TTL |

API-0905 returns `generatedAt` in the response, which maps to `export_jobs.generated_at`.

### 7.4 Download Lifecycle

**Download request flow:**

```
GET /v1/exports/{exportId}/download
    │
    ├─ status = GENERATING  → 409 EXPORT_NOT_READY
    ├─ status = FAILED      → 404 EXPORT_NOT_FOUND  
    ├─ status = EXPIRED     → 410 EXPORT_EXPIRED
    │                        (file already deleted; row may still exist)
    └─ status = READY
           │
           ├─ now() > expires_at → transition to EXPIRED → 410 EXPORT_EXPIRED
           └─ now() <= expires_at → generate presigned URL from file_reference_url → 200 + binary
```

**Presigned URL generation:** The application generates a time-limited presigned download URL pointing to the object storage file. The URL's TTL should be short (e.g., 5–15 minutes) — much shorter than the export's own `expires_at`. The presigned URL is returned directly in the HTTP response (or as a redirect), not stored in PostgreSQL.

### 7.5 Triggers

```sql
CREATE TRIGGER export_jobs_set_updated_at
    BEFORE UPDATE ON collaboration.export_jobs
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- No raise_on_delete() — export_jobs are transient (DB-01 §3.1 exception)
-- DELETE is permitted by the cleanup job after confirmed EXPIRED state

-- No raise_on_update() on content fields — the status lifecycle requires updates
-- No etag_version trigger — export_jobs are not ETag-versioned
-- (Clients do not send conditional PUT/PATCH for export jobs)
```

### 7.6 Indexes

```sql
-- User's export jobs (GET /v1/exports/{exportId} polling)
CREATE INDEX idx_export_jobs_requested_by
    ON collaboration.export_jobs (requested_by, created_at DESC);

-- Scope lookup: has this user already requested this page × language export recently?
-- (Used for rate-limiting or deduplication — application layer)
CREATE INDEX idx_export_jobs_scope
    ON collaboration.export_jobs (page_id, language_code, created_at DESC);

-- Cleanup job: find READY exports past their expiry
CREATE INDEX idx_export_jobs_expiry
    ON collaboration.export_jobs (expires_at)
    WHERE status = 'READY' AND expires_at IS NOT NULL;

-- Direct lookup by ID (API-0905 sub-endpoints: GET /v1/exports/{exportId})
-- Served by PRIMARY KEY (export_job_id) — no additional index needed

-- Find all GENERATING jobs (monitoring/stuck-job detection)
CREATE INDEX idx_export_jobs_generating
    ON collaboration.export_jobs (created_at)
    WHERE status = 'GENERATING';
```

### 7.7 Export Rate Limiting

**No DB-enforced unique constraint on concurrent exports.** Unlike migration (where one-at-a-time is a hard business rule), multiple users may simultaneously request exports without conflict. Export is a read-only operation with no cross-user interference.

**Application-layer guard (not DB-enforced):** The application may optionally rate-limit exports per user (e.g., "no more than 3 GENERATING exports per user at a time") using the `idx_export_jobs_requested_by` index. This is an operational guard, not a product contract.

---

## 8. Retention and Cleanup Classification

### 8.1 Migration Governance (Permanent)

| Record | Table | Deletable? | Reasoning |
|---|---|---|---|
| Import Event row | `migration.import_events` | ❌ Never | Permanent governance record. `raise_on_delete()` trigger. Even after file deletion, the row, counts, and validation report remain. |
| Row event records | `migration.migration_row_events` | ❌ Never | Permanent governance records — they represent the audit of what was skipped/failed during the one-time migration. |
| `validation_report` JSONB | In-row on `import_events` | ❌ Never (row is permanent) | The report is the migration integrity record. Required for forensic audit. |

### 8.2 Migration File (Temporary)

| Artifact | Retention | Cleanup Trigger | After Cleanup |
|---|---|---|---|
| Uploaded migration file (object storage) | `migration_file_retention_days` (default: 7 days) from terminal state | `file_expires_at < now()` | Object deleted from storage; `file_reference_url` set to `NULL` in the row |
| The `migration.import_events` row | **Permanent** | Never | Unaffected by file deletion |

**Cleanup job queries:**
```sql
-- Find migration files eligible for deletion
SELECT import_event_id, file_reference_url
FROM migration.import_events
WHERE file_expires_at IS NOT NULL
  AND file_expires_at < now()
  AND file_reference_url IS NOT NULL;
-- For each: delete from object storage, then UPDATE file_reference_url = NULL
```

### 8.3 Export Records (Transient)

| Record | Deletable? | When | Condition |
|---|---|---|---|
| `collaboration.export_jobs` row in `GENERATING` | ❌ Not yet | N/A | May not be deleted while active |
| `collaboration.export_jobs` row in `READY` | After EXPIRED transition | After `expires_at` has passed AND file deleted | `status = 'EXPIRED'` AND `file_reference_url IS NULL` |
| `collaboration.export_jobs` row in `FAILED` | ✅ Yes | After a short retention window (e.g., 24 hours) | Useful for debugging but not required after the window |
| `collaboration.export_jobs` row in `EXPIRED` | ✅ Yes | Immediately | File already deleted; row is purely administrative |

**Cleanup priority:** EXPIRED rows with no file_reference_url are the safe deletion target. FAILED rows may be retained briefly for support investigation.

### 8.4 Export Files (Transient)

| Artifact | TTL | Cleanup |
|---|---|---|
| Generated export file (object storage) | 1 hour from `generated_at` (Group 9 §3.5.5) | Cleanup job: `WHERE status='READY' AND expires_at < now()` |

**After file deletion:**
1. Object deleted from object storage
2. `UPDATE collaboration.export_jobs SET status='EXPIRED', file_reference_url=NULL WHERE export_job_id=$id`
3. Any subsequent `GET /v1/exports/{exportId}/download` returns `410 EXPORT_EXPIRED`

### 8.5 Cleanup Job Responsibilities

| Job | Frequency | Action |
|---|---|---|
| Migration file cleanup | Daily | Find rows where `file_expires_at < now() AND file_reference_url IS NOT NULL`; delete object storage file; set `file_reference_url = NULL` |
| Export file cleanup | Every 15 minutes | Find rows where `status='READY' AND expires_at < now()`; delete file from object storage; set `status='EXPIRED', file_reference_url=NULL` |
| Export row purge | Daily | Delete rows where `status IN ('EXPIRED', 'FAILED') AND updated_at < now() - INTERVAL '24 hours'` |

**No background job touches `migration.import_events` row content or `migration.migration_row_events`** — only `file_reference_url` NULLing. Permanent row retention is inviolable.

---

## 9. Concurrency and Safety

### 9.1 Migration: One-at-a-Time Enforcement

DB-03 §5.2 already defines:
```sql
CREATE UNIQUE INDEX import_events_processing_unique
    ON migration.import_events (status)
    WHERE status = 'PROCESSING';
```

This partial unique index ensures at most one row can have `status = 'PROCESSING'`. **DB-05 retains this constraint unchanged.** No second index is added.

The `VALIDATING` state also requires single-execution protection. A second partial unique index is added:

```sql
-- At most one VALIDATING migration at any time
-- (Upload + content validation is also a single-execution operation)
CREATE UNIQUE INDEX import_events_validating_unique
    ON migration.import_events (status)
    WHERE status = 'VALIDATING';
```

**Combined: at any time, only one migration may be in `VALIDATING` OR `PROCESSING` state.**

### 9.2 Migration: Idempotent Status Transitions

**Idempotency requirement (Group 10 EN-G10-02):** If a migration worker crashes and restarts mid-processing, it must be safe to re-attempt. The DB schema supports this via:

1. **ETag version on `import_events`** — the `etag_version` column (DB-03) enables optimistic locking. The worker reads `etag_version`, performs work, then UPDATEs with `WHERE etag_version = $old_version`. If another process already updated the row, the UPDATE affects 0 rows and the worker backs off.

2. **Status as a gate** — the worker checks `status = 'VALIDATING'` (or `PROCESSING`) before each phase. If the status has already advanced (another worker completed the phase), the worker skips that phase.

3. **`migration_row_events` is INSERT-only** — a re-run that creates duplicate row events would violate `(import_event_id, source_row_number)` uniqueness. Add a unique constraint:

```sql
ALTER TABLE migration.migration_row_events
    ADD CONSTRAINT migration_row_events_unique_source_row
        UNIQUE (import_event_id, source_row_number);
-- Ensures duplicate row event INSERTs on retry are idempotent (INSERT ... ON CONFLICT DO NOTHING)
```

### 9.3 Migration: Rollback Safety

**Group 10 EN-G10-02 requirement:** The migration must be fully transactional. If any step fails, all entity creation (pages, tags, English copies, translations, releases, audit records) must be rolled back.

The schema supports this because:
- All entity creation occurs within a single `SERIALIZABLE` transaction (DB-01 §12)
- `migration.import_events` is updated AFTER the entity-creation transaction commits
- If entity creation rolls back, the `import_event_id` row reverts to `UPLOAD_READY` (or `VALIDATING`) status — the row exists but no entities were created

**What happens to `migration_row_events` on rollback?** Row events written during the failed processing attempt are also rolled back (they are in the same transaction). The `import_events` row reverts to `VALIDATING` or stays as a new row with `FAILED` status after the rollback is confirmed.

**Implementation note (Group 10 EN-G10-04):** Bulk-insert audit records rather than per-entity inserts. For a large migration (5,000+ entities), individual audit inserts would be slow. The audit_records batch insert occurs within the same transaction.

### 9.4 Export: Concurrent Generation

No exclusive lock or single-execution constraint for exports. Multiple concurrent exports for different pages or languages are permitted. Multiple concurrent exports for the same `(page_id, language_code)` are also permitted — they produce separate `export_job_id` records and separate files.

**Snapshot isolation per export:** Each export job uses its own REPEATABLE READ transaction at `dataset_capture_at`. Concurrent exports for the same scope may capture data at slightly different moments — this is correct product behavior (each export is an independent snapshot).

---

## 10. Observability Fields

The following fields in DB-05 tables provide operational visibility without duplicating the permanent audit system:

| Observable Information | Field | Table |
|---|---|---|
| Migration started | `initiated_at` | `import_events` |
| Migration executed by | `executed_by` | `import_events` |
| Migration execution started | `processing_started_at` | `import_events` |
| Migration completed | `completed_at` | `import_events` |
| Migration duration | `completed_at - processing_started_at` (computed) | `import_events` |
| Migration current state | `status` | `import_events` |
| Migration failure cause | `failure_reason` | `import_events` |
| Migration validation outcome | `validation_summary_status` | `import_events` |
| Migration discrepancy count | `discrepancy_count` | `import_events` |
| Migration file identity | `original_filename`, `file_checksum_sha256`, `file_size_bytes` | `import_events` |
| Migration file expiry | `file_expires_at` | `import_events` |
| Migration report generated | `report_generated_at` | `import_events` |
| Skip/fail row counts | `COUNT(*)` on `migration_row_events` by `reason_code` | `migration_row_events` |
| Export requested by | `requested_by` | `export_jobs` |
| Export scope | `page_id`, `language_code` | `export_jobs` |
| Export data snapshot time | `dataset_capture_at` | `export_jobs` |
| Export generation time | `generated_at` | `export_jobs` |
| Export row count | `row_count` | `export_jobs` |
| Export expiry | `expires_at` | `export_jobs` |
| Export current state | `status` | `export_jobs` |
| Export failure cause | `failure_reason` | `export_jobs` |
| Stuck exports (GENERATING too long) | `status='GENERATING' AND created_at < now() - INTERVAL '10 minutes'` (query) | `export_jobs` |

**Correlation to audit trail:** The `import_events.import_event_id` is referenced in audit record `details` fields (DB-03 §5.3: *"details field includes: Created via initial migration — Import Event: {import_event_id}"*). This provides the bridge from the operational `import_events` row to the permanent `audit_records` trail without a FK coupling.

---

## 11. New Indexes Added in DB-05

```sql
-- INDEX 1: Migration row events by import (report assembly, count queries)
CREATE INDEX idx_migration_row_events_import_id
    ON migration.migration_row_events (import_event_id, recorded_at);

-- INDEX 2: Migration row events by reason code (skip analysis, monitoring)
CREATE INDEX idx_migration_row_events_reason
    ON migration.migration_row_events (import_event_id, reason_code);

-- INDEX 3: VALIDATING migration single-execution constraint (§9.1)
CREATE UNIQUE INDEX import_events_validating_unique
    ON migration.import_events (status)
    WHERE status = 'VALIDATING';

-- INDEX 4: Export jobs by user (polling, API-0905 sub-endpoint)
CREATE INDEX idx_export_jobs_requested_by
    ON collaboration.export_jobs (requested_by, created_at DESC);

-- INDEX 5: Export scope lookup (rate-limiting, deduplication check)
CREATE INDEX idx_export_jobs_scope
    ON collaboration.export_jobs (page_id, language_code, created_at DESC);

-- INDEX 6: Export cleanup (find expired-but-not-cleaned READY jobs)
CREATE INDEX idx_export_jobs_expiry
    ON collaboration.export_jobs (expires_at)
    WHERE status = 'READY' AND expires_at IS NOT NULL;

-- INDEX 7: Stuck GENERATING export detection (monitoring)
CREATE INDEX idx_export_jobs_generating
    ON collaboration.export_jobs (created_at)
    WHERE status = 'GENERATING';

-- INDEX 8: Migration import events by validation outcome (monitoring dashboard)
CREATE INDEX idx_import_events_validation_summary
    ON migration.import_events (validation_summary_status)
    WHERE validation_summary_status IS NOT NULL;
```

---

## 12. Consistency Audit

### 12.1 Group 10 State Machine vs. DB-05 State Set

| Group 10 §1.5 State | DB-05 State | DB-03 State | Status |
|---|---|---|---|
| `UPLOAD_READY` | ✅ | ✅ | Consistent |
| `PROCESSING` | ✅ | ✅ | Consistent |
| `COMPLETED` | ✅ | ✅ | Consistent |
| `FAILED` | ✅ | ✅ | Consistent |
| `REPORT_AVAILABLE` | ✅ | ✅ | Consistent |
| (implied) `VALIDATING` | ✅ retained | ✅ | Consistent (diagram simplification in Group 10) |
| (implied) `VALIDATION_FAILED` | ✅ retained | ✅ | Consistent (diagram simplification in Group 10) |

**No state gap or conflict.** DB-05 §2 documents the reconciliation.

### 12.2 Group 10 API Field Coverage

| API Field | Physical Column | Table | Status |
|---|---|---|---|
| `migrationId` | `import_event_id` | `import_events` | ✅ |
| `status` | `status` | `import_events` | ✅ |
| `uploadedBy.userId` | `initiated_by` | `import_events` | ✅ |
| `uploadedAt` | `initiated_at` | `import_events` | ✅ |
| `fileName` | `original_filename` | `import_events` | ✅ |
| `fileFormat` | `file_format` | `import_events` (DB-05 §3.1) | ✅ |
| `fileSizeBytes` | `file_size_bytes` | `import_events` | ✅ |
| `executedBy.userId` | `executed_by` | `import_events` (DB-05 §3.1) | ✅ |
| `executionStartedAt` | `processing_started_at` | `import_events` | ✅ |
| `executionCompletedAt` | `completed_at` | `import_events` | ✅ |
| `counts.pagesCreated` | `pages_succeeded` | `import_events` | ✅ |
| `counts.tagsCreated` | `tags_imported` | `import_events` | ✅ |
| `counts.englishCopyCreated` | `tags_imported` | `import_events` (same count — one EC per tag) | ✅ |
| `counts.translationsCreated` | `translations_imported` | `import_events` | ✅ |
| `counts.rowsSkipped` | `COUNT(*)` on `migration_row_events WHERE event_type='SKIPPED'` | `migration_row_events` | ✅ |
| `counts.rowsFailed` | `pages_failed` | `import_events` | ✅ |
| `reportAvailable` | `status = 'REPORT_AVAILABLE'` (derived) | `import_events` | ✅ |
| `failureReason` | `failure_reason` | `import_events` (DB-05 §3.1) | ✅ |
| `detectedColumns.languageColumns` | `detected_language_columns` | `import_events` (DB-05 §3.1) | ✅ |
| `structuralValidation.rowCount` | `structural_validation_result.rowCount` (JSONB) | `import_events` (DB-05 §3.1) | ✅ |

**Validation Report (API-1003):**

| Report Field | Physical Location | Status |
|---|---|---|
| `generatedAt` | `report_generated_at` | ✅ |
| `summary.status` | `validation_summary_status` | ✅ |
| `summary.pagesExpected` | `pages_attempted` (close proxy) | ✅ (same as pages_attempted at processing start) |
| `summary.pagesFound` | `pages_succeeded` | ✅ |
| `summary.tagsExpected` | `tags_expected` (DB-05 §4.1) | ✅ |
| `summary.tagsFound` | `tags_imported` | ✅ |
| `summary.translationsExpected` | `translations_expected` (DB-05 §4.1) | ✅ |
| `summary.translationsFound` | `translations_imported` | ✅ |
| `summary.discrepancyCount` | `discrepancy_count` (DB-05 §4.1) | ✅ |
| `discrepancies` (array) | `validation_report.discrepancies` (JSONB) | ✅ |
| `skippedRows` (array) | `validation_report.skippedRows` (JSONB, assembled from `migration_row_events`) | ✅ |

### 12.3 Group 9 API-0905 Field Coverage

| API Field | Physical Column | Table | Status |
|---|---|---|---|
| `exportId` | `export_job_id` | `export_jobs` | ✅ |
| `pageId` | `page_id` | `export_jobs` | ✅ |
| `languageCode` | `language_code` | `export_jobs` | ✅ |
| `format` | `format` | `export_jobs` | ✅ |
| `status` | `status` | `export_jobs` | ✅ — `GENERATING`, `READY`, `FAILED` |
| `rowCount` | `row_count` | `export_jobs` | ✅ |
| `generatedAt` | `generated_at` | `export_jobs` | ✅ |
| `downloadUrl` | Derived from `file_reference_url` (presigned URL generated at request time) | `export_jobs` | ✅ |
| `expiresAt` | `expires_at` | `export_jobs` | ✅ |
| `status: EXPIRED` (410 response) | `status = 'EXPIRED'` | `export_jobs` | ✅ |
| Snapshot boundary semantics | `dataset_capture_at` | `export_jobs` | ✅ |

### 12.4 Permanent vs. Transient Record Classification

| Record | DB-05 Classification | Correct per DB-01? |
|---|---|---|
| `migration.import_events` rows | Permanent | ✅ (DB-01 §3.1 lists governance records as permanent) |
| `migration.migration_row_events` rows | Permanent | ✅ (governance records of the migration audit) |
| `collaboration.export_jobs` rows (EXPIRED) | Delete-permitted | ✅ (DB-01 §3.1: "export_jobs — deleteable after download TTL") |
| Migration file (object storage) | Temporary (7-day retention) | ✅ (DB-01 §16.1, DB-01 §20.7) |
| Export file (object storage) | Temporary (1-hour TTL) | ✅ (DB-01 §16.2, Group 9 §3.5.5) |

### 12.5 No Duplicated Source-of-Truth Data

| Risk | Assessment |
|---|---|
| `migration.import_events` duplicating entity data | ✅ No — `import_events` stores migration operation state (counts, status, file reference). Entities themselves are in DB-02 tables. |
| `migration.migration_row_events` duplicating `validation_report` JSONB | ✅ Intentional parallel — not a duplication of source-of-truth (both derived from the same processing; neither is authoritative content data) |
| `collaboration.export_jobs` duplicating entity data | ✅ No — `export_jobs` stores job state and file reference. Exported content is read at job time and written to the file, not stored in PostgreSQL. |
| Export operational records becoming authoritative content records | ✅ No — export_jobs have no FK back-references from any source table; they are unidirectional references to source tables |

### 12.6 Export TTL Conflict Resolution

| Source | TTL Value | Status |
|---|---|---|
| Group 9 §3.5.5 (API contract) | 1 hour | **Authoritative** |
| DB-02 `system_configuration` sample data `export_ttl_hours: 24` | 24 hours | ❌ Conflict — sample data was illustrative |
| **DB-05 resolution** | **1 hour** | `system_configuration.export_ttl_hours` must be `1` in production |

**Action required:** Correct `system_configuration.export_ttl_hours` seed data to `1` before production deployment.

### 12.7 Open Items from DB-05

| # | Item | Severity | Recommendation |
|---|---|---|---|
| DB-05-OI-01 | `counts.englishCopyCreated` in the Group 10 resource model equals `tags_imported` (one EC per tag). This is correct but `import_events` has no separate `english_copies_imported` column. If the API contract is read strictly, the response field is derived from `tags_imported`. | Low | Document in API-1002 response assembly: `englishCopyCreated = tags_imported`. No schema change needed. |
| DB-05-OI-02 | `file_checksum_sha256` is application-computed at upload time. If the application skips this step (e.g., in v1 where it's new), the column will be NULL on old rows. | Low | Enforce non-NULL in application code for all new uploads. Consider a CHECK constraint `(file_checksum_sha256 IS NOT NULL)` on future rows if backward compatibility is not needed. |
| DB-05-OI-03 | `migration_file_retention_days` config key is mentioned in §6.4 but not in `admin.system_configuration` seed data (DB-02 §7.3 defines the seed data). | Low | Add `migration_file_retention_days: 7` to the `system_configuration` seed data in DB-02 or a schema addendum. |
| DB-05-OI-04 | The unique constraint `migration_row_events_unique_source_row` on `(import_event_id, source_row_number)` assumes each source row can only have one skip/fail event per migration. If a single row can fail for multiple reasons simultaneously (e.g., both `TAG_ID_MISSING` and `PAGE_ID_MISSING`), this constraint would need to be relaxed. At current product scope: impossible — if `page_id` is missing, processing stops at that row; it cannot also be missing `tag_id` in a separate event. | Low | Constraint is correct for current reason codes. Revisit if new reason codes allow multiple events per row. |

---

*End of MioTranslate — DB-05: Migration & Operational Storage Schema v1.0*

*Documents in the DB series:*  
*DB-01 — Database Architecture & Standards ✅*  
*DB-02 — Core Transactional Schema ✅*  
*DB-03 — History, Versioning & Audit Schema ✅*  
*DB-04 — Reporting, Read Models & Search Schema ✅*  
*DB-05 — Migration & Operational Storage Schema ✅*  
*DB-06 — Administration Supplementary Schema (if any deferred items from DB-01/02)*  
*DB-07 — Final Cross-Schema Consistency & Deployment Specification*
