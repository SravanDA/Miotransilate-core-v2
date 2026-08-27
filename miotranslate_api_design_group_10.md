# MioTranslate API Design — Group 10: Migration

**Product:** MioTranslate  
**Document Type:** API Design Specification  
**Scope:** Group 10 — Migration (API-1001 through API-1003)  
**Source Documents:** Approved API List (Domain 10), FRD §5.7/F-21, User Flow UF-02 (Initial One-Time Migration), Group 1 Conventions Baseline, Group 5 (Audit record model — API-0505)  
**Audience:** Backend Engineering, Frontend Engineering, QA, Administrator  
**Prerequisites:** Group 1 (locked baseline conventions, Page/Tag registry), Group 5 (Audit record model — API-0505 is the write path for migration audit records)

---

## Document Status & Revision History

| Version | Date | Author | Status | Summary of Changes |
|---|---|---|---|---|
| **v1.0** | Aug 2026 | API Design | Draft | Initial specification — all 3 APIs authored. |
| **v1.1** | Aug 2026 | API Design | Locked | Audit finding resolution pass: (1) OQ-1 through OQ-5 resolved as **working v1 decisions** (see §9 Open Questions register — now closed). Import format locked to CSV. File size limit confirmed at 50 MB / 50,000 rows. Validation report is JSON-only in v1. Discrepancy classification rules defined. (2) RBAC terminology standardized — "Founder, Administrator" replaced with `FN, ADMIN` throughout to match Groups 1–9. (3) EN-G10-06 added: post-migration coverage verification is a go-live acceptance criterion. (4) CG-G10-03 closed — Group 4 Release entity now includes `triggerSource: MIGRATION` enum value (Group 4 v1.x). |

> **Lock Status:** Group 10 is **locked**. No further changes may be made without a documented revision entry above and traceability to an approved source document.

---

## 1. Group 10 Context

### 1.1 What Group 10 Covers

Group 10 defines the **one-time initial data migration** API surface — the mechanism by which all existing UX copy and translations are transferred from the current system (a spreadsheet, a legacy CMS, or a prior data store) into MioTranslate before it goes live. This is a **bootstrapping operation**, not an ongoing data-management workflow.

Group 10 has three APIs that execute in strict sequence:

| API ID | Name | HTTP | URL | Primary Purpose |
|---|---|---|---|---|
| **API-1001** | Upload Import File | POST | `/v1/migrations/upload` | Accept and validate the import file |
| **API-1002** | Execute Migration Import | POST | `/v1/migrations/{migrationId}/execute` | Process the file and populate MioTranslate |
| **API-1003** | Get Migration Validation Report | GET | `/v1/migrations/{migrationId}/report` | Retrieve the post-import validation report |

**Critical design properties for all Group 10 APIs:**

- **One-time operation.** Migration is expected to be executed once per MioTranslate instance, before the product is used operationally. It is not a recurring import mechanism.
- **All-or-nothing per entity type.** A partial import that silently succeeds for some pages but fails for others without a clear report is worse than a clean failure. The validation report (API-1003) is the definitive post-import integrity check.
- **Imported content enters as Production-deployed.** All content brought in via migration is assumed to already be live in production — it enters MioTranslate at `Approved` status and recorded as deployed to the Production environment, not as a draft requiring review.
- **Module and Copy Type are not migrated.** These MioTranslate-internal metadata fields are not present in the source system data and are not populated during migration. They can be assigned after migration through normal operations.
- **Rollback is available before validation is confirmed.** If a migration import fails mid-process, the system must be able to roll back to the clean pre-migration state. After the user explicitly confirms the validation report as acceptable, rollback is no longer applicable.
- **Audit trail is written for every created entity.** Each page, tag, English copy record, and translation record created during migration must produce an audit entry via Group 5 API-0505, attributed to the user who executed the migration.

---

### 1.2 Domain Position and Dependencies

| Data / Service | Owned By | Group 10 Relationship |
|---|---|---|
| Page records | Group 1 (API-0101) | Migration creates page records equivalent to API-0101, but bypasses the interactive API to support bulk creation from file. |
| Tag records | Group 1 (API-0102) | Migration creates tag records equivalent to API-0102 in bulk. |
| English Copy records | Group 2 (API-0201/0203) | Migration creates English copy records directly in Approved state — bypassing the draft/review cycle, because migrated copy is already production-live. |
| Translation records | Group 3 (API-0301/0304) | Migration creates translation records directly in Approved state — same rationale as English copy. |
| Audit records (write) | Group 5 API-0505 | Every entity created during API-1002 execution produces an audit record via API-0505. |
| Coverage metrics | Group 5 API-0503 | Coverage is recalculated after the migration is complete — not after every row, to avoid excessive recalculation during a large batch. |
| Import Event record | **Group 10 — Migration** | Group 10 owns the Import Event entity. It tracks the state of the migration process from upload through validation. |

---

### 1.3 Baseline Conventions Inheritance

Group 10 inherits all conventions from Group 1 §1 without modification:

- URL base and versioning: `https://{host}/api/v1/...`
- JSON casing: `camelCase` for fields, `SCREAMING_SNAKE_CASE` for enums and error codes
- Response envelopes per Group 1 §1.5
- HTTP status codes per Group 1 §1.6
- Cursor-based pagination where applicable (Group 1 §1.7)
- Error model: RFC 9457-inspired `{ "error": { "code", "status", "message", "target", "details" } }`
- Authorization: RBAC per FRD §8

**URL pattern note:** All migration APIs are scoped under the `/v1/migrations` resource. An Import Event is the primary resource. The upload, execute, and report are sub-actions on that resource or on its sub-resources.

---

### 1.4 RBAC Summary for Group 10

| API | Authorized Roles | Notes |
|---|---|---|
| API-1001 Upload Import File | `FN`, `ADMIN` | FRD §8: Migration is an administrative bootstrapping operation. Only the highest-authority roles may initiate it. |
| API-1002 Execute Migration Import | `FN`, `ADMIN` | Same rationale — execution is irreversible in terms of data creation. |
| API-1003 Get Migration Validation Report | `FN`, `ADMIN` | Validation report is the integrity check for administrators only. PM and other roles receive content through normal workflows after migration. |

---

### 1.5 Migration State Machine

An Import Event moves through a deterministic lifecycle:

```
                  ┌─────────────────┐
                  │   UPLOAD_READY  │  ← API-1001 succeeds
                  └────────┬────────┘
                           │
                           │ API-1002 called
                           ▼
                  ┌─────────────────┐
                  │   PROCESSING    │  ← Import is executing
                  └────────┬────────┘
                           │
               ┌───────────┼───────────┐
               │ success   │ failure   │
               ▼           ▼           │
       ┌─────────────┐  ┌──────────┐   │
       │  COMPLETED  │  │  FAILED  │   │ (rollback to
       └──────┬──────┘  └──────────┘   │  pre-migration)
              │
              │ API-1003 called
              ▼
       ┌──────────────────┐
       │ REPORT_AVAILABLE │  ← Validation report generated
       └──────────────────┘
```

| State | Meaning |
|---|---|
| `UPLOAD_READY` | File uploaded and structurally validated. Awaiting execution. |
| `PROCESSING` | Migration import is running. |
| `COMPLETED` | All entities created. Validation report is available via API-1003. |
| `FAILED` | Import failed during processing. Rollback has been applied. A new upload may be attempted. |
| `REPORT_AVAILABLE` | Validation report has been generated and is viewable. Terminal state for a successful migration. |

---

## 2. Resource Models

### 2.1 Import Event Record

The Import Event is the primary entity of Group 10. It tracks the full lifecycle of a migration attempt.

```json
{
  "migrationId": "mig_20260821_090000_abc001",
  "status": "COMPLETED",
  "uploadedBy": {
    "userId": "user:admin-priya",
    "displayName": "Priya Nair"
  },
  "uploadedAt": "2026-08-21T09:00:00Z",
  "fileName": "miosaloncopydump_aug2026.xlsx",
  "fileFormat": "EXCEL",
  "fileSizeBytes": 204800,
  "executedBy": {
    "userId": "user:admin-priya",
    "displayName": "Priya Nair"
  },
  "executionStartedAt": "2026-08-21T09:05:00Z",
  "executionCompletedAt": "2026-08-21T09:12:00Z",
  "counts": {
    "pagesCreated": 14,
    "tagsCreated": 892,
    "englishCopyCreated": 892,
    "translationsCreated": 2676,
    "rowsSkipped": 3,
    "rowsFailed": 0
  },
  "reportAvailable": true
}
```

| Field | Type | Description |
|---|---|---|
| `migrationId` | string | Unique identifier for this migration attempt. |
| `status` | enum | Current Import Event state. See §1.5 for the state machine. |
| `uploadedBy` | object | `{ userId, displayName }` of the user who uploaded the file. |
| `uploadedAt` | string (ISO 8601) | When the file was uploaded. |
| `fileName` | string | Original file name. Stored for reference. |
| `fileFormat` | enum | `CSV`, `EXCEL`, or `JSON`. Detected from file type at upload. |
| `fileSizeBytes` | integer | File size in bytes. |
| `executedBy` | object | `{ userId, displayName }` of the user who triggered execution. Null until API-1002 is called. |
| `executionStartedAt` | string (ISO 8601) \| null | When processing began. Null until API-1002 starts. |
| `executionCompletedAt` | string (ISO 8601) \| null | When processing finished (success or failure). Null while PROCESSING. |
| `counts` | object | Entity counts. See §2.1.1. Null until COMPLETED. |
| `reportAvailable` | boolean | `true` once API-1003 has generated the validation report. |

---

#### 2.1.1 Migration Counts

| Counter | Description |
|---|---|
| `pagesCreated` | Number of page records created in MioTranslate. |
| `tagsCreated` | Number of tag records created in MioTranslate. |
| `englishCopyCreated` | Number of English copy records created (one per tag). |
| `translationsCreated` | Total translation records created across all languages. |
| `rowsSkipped` | Rows in the source file that were skipped — e.g., rows with no Tag ID, rows with a tag whose English copy was empty, or rows explicitly marked as excluded. Each skipped row is logged in the validation report with a reason. |
| `rowsFailed` | Rows that caused an error during processing. If `rowsFailed > 0` and the migration was still marked COMPLETED, the validation report details each failure. If failure is critical (e.g., duplicate Page ID collision), the entire import is rolled back and the status moves to FAILED. |

---

### 2.2 Import File Schema

> **Note:** The exact file format (CSV, Excel, XLSX, or JSON) is marked as **TBD** in the API List (FRD F-21). This design assumes a **row-per-tag structure** based on FRD F-21's description ("pages, tags, English copy, and per-language translation values"). The format decision must be confirmed before Group 10 is locked.

The import file is structured with one row per tag. Each row carries the tag's English copy and all of its existing translations.

**Required columns:**

| Column Name | Type | Required | Description |
|---|---|---|---|
| `page_id` | string | Yes | The Page ID as it will exist in MioTranslate. Must follow the same naming rules as API-0101. |
| `page_name` | string | Yes | Human-readable page name. May differ from `page_id`. |
| `tag_id` | string | Yes | The Tag ID as it will exist in MioTranslate. Must be unique within the page. Must follow the same naming rules as API-0102. |

**Optional columns:**

| Column Name | Type | Required | Description |
|---|---|---|---|
| `english_copy` | string | Recommended | The approved English copy text. If absent, the tag is created with `NO_COPY` status. |
| `[language_code]` | string | Per language | One column per language code (e.g., `ar`, `ta`, `hi`, `fr`). Contains the existing approved translation text for that language. Empty cells mean no translation exists for that language on this tag. |

> **Page deduplication:** If the same `page_id` appears in multiple rows (because a page has many tags), only one page record is created. The `page_name` from the first occurrence is used. Conflicting `page_name` values for the same `page_id` across rows are flagged in the validation report.

---

### 2.3 Validation Report Record

```json
{
  "migrationId": "mig_20260821_090000_abc001",
  "generatedAt": "2026-08-21T09:13:00Z",
  "summary": {
    "status": "PASS",
    "pagesExpected": 14,
    "pagesFound": 14,
    "tagsExpected": 892,
    "tagsFound": 892,
    "translationsExpected": 2676,
    "translationsFound": 2676,
    "discrepancyCount": 0
  },
  "discrepancies": [],
  "skippedRows": [
    {
      "rowNumber": 45,
      "pageId": "INVOICE",
      "tagId": null,
      "reason": "TAG_ID_MISSING"
    },
    {
      "rowNumber": 301,
      "pageId": "APPOINTMENTS",
      "tagId": "APT_CANCEL_BTN",
      "reason": "ENGLISH_COPY_EMPTY"
    },
    {
      "rowNumber": 714,
      "pageId": null,
      "tagId": null,
      "reason": "PAGE_ID_MISSING"
    }
  ]
}
```

| Field | Type | Description |
|---|---|---|
| `migrationId` | string | Links the report to its Import Event. |
| `generatedAt` | string (ISO 8601) | When the report was generated. |
| `summary.status` | enum | `PASS` — zero discrepancies. `PASS_WITH_WARNINGS` — discrepancies exist but migration was accepted (e.g., skipped rows only). `FAIL` — critical discrepancies that indicate data integrity problems. |
| `summary.pagesExpected` | integer | Distinct page IDs counted in the source file. |
| `summary.pagesFound` | integer | Pages confirmed to exist in MioTranslate post-import. |
| `summary.tagsExpected` | integer | Total tag rows in the source file (excluding rows with missing `tag_id`). |
| `summary.tagsFound` | integer | Tags confirmed to exist in MioTranslate post-import. |
| `summary.translationsExpected` | integer | Total non-empty language cells in the source file. |
| `summary.translationsFound` | integer | Translation records confirmed in MioTranslate post-import. |
| `summary.discrepancyCount` | integer | Number of items in the `discrepancies` array. Zero for a clean migration. |
| `discrepancies` | array | Detailed list of entities present in the source file but missing or mismatched in MioTranslate. Each entry includes `pageId`, `tagId`, `languageCode` (if applicable), and `reason`. |
| `skippedRows` | array | Rows intentionally skipped during processing. Each entry includes the source `rowNumber`, `pageId`, `tagId` (where available), and `reason`. |

#### 2.3.1 Discrepancy and Skip Reason Codes

| Reason Code | Description |
|---|---|
| `TAG_ID_MISSING` | Row has no Tag ID. Cannot create a tag. Skipped. |
| `PAGE_ID_MISSING` | Row has no Page ID. Cannot associate a tag with a page. Skipped. |
| `ENGLISH_COPY_EMPTY` | Row has a Tag ID but no English copy and no translations. Tag is created with `NO_COPY` status but noted as a skip in the report. |
| `DUPLICATE_TAG_ID` | Same Tag ID appears more than once within the same Page ID. Only the first occurrence is imported; subsequent occurrences are skipped and flagged. |
| `DUPLICATE_PAGE_NAME_CONFLICT` | Same `page_id` appears with different `page_name` values in different rows. |
| `TRANSLATION_LANGUAGE_UNKNOWN` | A language column exists in the file for a language code not configured in MioTranslate. Translations for that language are skipped. |
| `ENTITY_NOT_FOUND_POST_IMPORT` | An entity (page, tag, or translation) counted as expected was not found during the post-import comparison. Indicates a data integrity problem. |

---

## 3. API Specifications

### API-1001: Upload Import File

> **Source:** FRD F-21, UF-02 (Initial One-Time Migration) Steps 3–5. API List API-1001.

**Endpoint:**
```
POST /v1/migrations/upload
```

**Purpose:** Accept the migration source file and validate its structure. This API performs structural validation only — it checks that the file is parseable, contains the required columns (`page_id`, `page_name`, `tag_id`), and does not exceed the allowed file size. It does not create any pages, tags, or translations. Once validated, the file is stored and a `migrationId` is returned. The administrator must then call API-1002 to begin actual processing.

**Authorization:** `FN`, `ADMIN`.

**Content-Type:** `multipart/form-data`

---

#### 3.1.1 Request

The file is sent as a multipart form upload.

| Field | Type | Required | Description |
|---|---|---|---|
| `file` | file | Yes | The import file. Accepted MIME types: `text/csv`, `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet` (xlsx), `application/json`. Max file size: 50 MB. |

> **Why multipart and not a JSON body?** The import file may be large (hundreds of kilobytes to several megabytes for large tag inventories). Embedding a file as base64 in a JSON body increases payload size by ~33% and makes streaming impractical. Multipart form upload is the standard HTTP mechanism for file transfer and is universally supported by API clients.

---

#### 3.1.2 Response — 201 Created

```json
{
  "data": {
    "migrationId": "mig_20260821_090000_abc001",
    "status": "UPLOAD_READY",
    "fileName": "miosaloncopydump_aug2026.xlsx",
    "fileFormat": "EXCEL",
    "fileSizeBytes": 204800,
    "uploadedAt": "2026-08-21T09:00:00Z",
    "detectedColumns": {
      "requiredColumns": ["page_id", "page_name", "tag_id"],
      "optionalColumns": ["english_copy"],
      "languageColumns": ["ar", "ta", "hi", "fr"]
    },
    "structuralValidation": {
      "rowCount": 895,
      "headerValid": true,
      "requiredColumnsMissing": []
    }
  }
}
```

| Field | Description |
|---|---|
| `migrationId` | The identifier for this migration attempt. Must be retained by the caller to invoke API-1002 and API-1003. |
| `status` | Always `UPLOAD_READY` on success. |
| `detectedColumns.languageColumns` | The language codes detected as column headers. The administrator should verify this list matches their intention before calling API-1002. |
| `structuralValidation.rowCount` | Total data rows in the file (excluding the header row). |
| `structuralValidation.requiredColumnsMissing` | Empty array means all required columns are present. |

---

#### 3.1.3 Business Rules

| Rule | Source | Enforcement |
|---|---|---|
| Authorized roles only | FRD §8 | 403 for non-`FN`/non-`ADMIN` roles. |
| File size limit: 50 MB / 50,000 rows | Working v1 Decision (OQ-1, OQ-3) | Files exceeding 50 MB are rejected immediately with 413 `FILE_TOO_LARGE`. Files with more than 50,000 data rows are rejected with 422 `ROW_COUNT_EXCEEDED`. Both limits can be raised by engineering if operational data shows larger files are needed before or after go-live. |
| CSV is the v1 import format | Working v1 Decision (OQ-1) | Accepted MIME type for v1: `text/csv`. Excel (XLSX) and JSON are not accepted in v1. If the source system cannot export CSV, engineering must agree on a pre-processing step or format upgrade before migration is run. The error message for unsupported MIME types explicitly states: "Only CSV format is supported in v1. Please export your source data as CSV." |
| Structural validation only — no entity creation | FRD F-21 | API-1001 checks file parsability and required columns. It does not access the MioTranslate entity store. No pages, tags, or translations are created. |
| Required columns must be present | Working v1 Decision (OQ-2) | Required column names for v1 are: `page_id`, `page_name`, `tag_id`. Column names are case-sensitive and matched exactly. If any required column is absent, the upload is rejected with 422 `REQUIRED_COLUMNS_MISSING`. Language columns are any columns whose header is a valid ISO 639-1 code (e.g., `ar`, `hi`, `ta`, `fr`). English copy column must be named `english_copy`. |
| Detected language columns are informational | API Design | The `detectedColumns.languageColumns` list is derived from the file header. Language codes not configured in MioTranslate are noted here and will be flagged as skipped during API-1002 execution. API-1001 does not reject the upload on this basis. |
| Only one active migration allowed at a time | API Design | If a migration is currently in `PROCESSING` state, a new upload is rejected with 409 `MIGRATION_IN_PROGRESS`. Completed or failed migrations do not block new uploads. |
| No audit record for upload | API Design | File upload is a preparatory step, not a data-modifying action. The audit record is created when API-1002 creates entities. |

---

#### 3.1.4 Error Catalogue

| HTTP | Code | Condition |
|---|---|---|
| 400 | `REQUIRED` on `file` | No file was included in the request. |
| 403 | `FORBIDDEN` | Caller does not hold `FN` or `ADMIN` role. |
| 409 | `MIGRATION_IN_PROGRESS` | Another migration is currently in `PROCESSING` state. Wait for it to complete or fail before uploading a new file. |
| 413 | `FILE_TOO_LARGE` | File exceeds 50 MB. |
| 415 | `UNSUPPORTED_MEDIA_TYPE` | File is not CSV. Only `text/csv` is accepted in v1. |
| 422 | `ROW_COUNT_EXCEEDED` | File contains more than 50,000 data rows. |
| 422 | `REQUIRED_COLUMNS_MISSING` | One or more of `page_id`, `page_name`, `tag_id`, or `english_copy` are absent from the file header. The response `details` array lists the missing column names. |
| 422 | `FILE_PARSE_ERROR` | The file could not be parsed (e.g., malformed CSV). The error message includes the parser error for debugging. |

---

### API-1002: Execute Migration Import

> **Source:** FRD F-21, UF-02 Steps 6–9. API List API-1002.

**Endpoint:**
```
POST /v1/migrations/{migrationId}/execute
```

**Purpose:** Process the uploaded file and populate MioTranslate with existing pages, tags, English copy, and translations. This is the data-creating action of the migration pipeline. It runs as an asynchronous operation because large imports (hundreds of pages, thousands of tags, and multiple languages) may take minutes to complete. The caller polls for completion status via `GET /v1/migrations/{migrationId}` (a sub-endpoint of API-1002 — see §3.2.4). Once `COMPLETED`, API-1003 is used to retrieve and review the validation report.

**Authorization:** `FN`, `ADMIN`.

---

#### 3.2.1 Path Parameters

| Parameter | Type | Description |
|---|---|---|
| `migrationId` | string | The Import Event ID returned by API-1001. Must be in `UPLOAD_READY` status. |

#### 3.2.2 Request Body

No request body is required. The migration target is fully determined by the stored file (identified by `migrationId`) and the system's current state.

```json
{}
```

> **Design note:** No request body is intentional. The administrator confirms their intent by calling this endpoint. No additional parameters are needed — the file was validated at upload time, the target MioTranslate instance is the current system, and all language processing is determined from the file's detected language columns. This keeps the execution step simple and reduces the risk of misconfiguration.

---

#### 3.2.3 Response — 202 Accepted

```json
{
  "data": {
    "migrationId": "mig_20260821_090000_abc001",
    "status": "PROCESSING",
    "executionStartedAt": "2026-08-21T09:05:00Z",
    "executedBy": {
      "userId": "user:admin-priya",
      "displayName": "Priya Nair"
    },
    "statusPollUrl": "/v1/migrations/mig_20260821_090000_abc001"
  }
}
```

| Field | Description |
|---|---|
| `status` | Always `PROCESSING` on 202 acceptance. |
| `executionStartedAt` | When processing began. |
| `statusPollUrl` | The URL the client should poll to check when processing finishes. See §3.2.4. |

---

#### 3.2.4 Migration Status — Public Sub-Endpoint of API-1002

```
GET /v1/migrations/{migrationId}
```

**Classification:** Public sub-endpoint of API-1002. Part of API-1002's approved contract. Required for the async execution polling flow. Must be documented in OpenAPI/API documentation alongside the POST.

**Authorization:** `FN`, `ADMIN`.

Returns the full Import Event record (same schema as §2.1). The client polls this endpoint after receiving a 202 until `status` transitions from `PROCESSING` to `COMPLETED` or `FAILED`.

**Polling recommendation:** Poll every 5 seconds. For very large imports (1,000+ tags across 5+ languages), allow up to 10 minutes before treating the migration as timed out and contacting engineering.

**Error Catalogue:**

| HTTP | Code | Condition |
|---|---|---|
| 403 | `FORBIDDEN` | Caller is not Founder or Administrator. |
| 404 | `MIGRATION_NOT_FOUND` | `migrationId` does not exist. |

---

#### 3.2.5 Processing Behaviour

When API-1002 executes, it performs the following operations in order:

**Step 1 — Pre-execution check**
- Verify the Import Event is in `UPLOAD_READY` status. If not, return 409 `INVALID_MIGRATION_STATUS`.
- Verify MioTranslate is not already populated with pages (i.e., migration is being applied to a clean system). If pages already exist, return 409 `SYSTEM_NOT_EMPTY` — migration is a bootstrapping operation, not an append operation.

**Step 2 — File parsing**
- Read the stored file for the given `migrationId`.
- Parse all rows into an in-memory representation.

**Step 3 — Page creation**
- For each distinct `page_id` in the file, create a page record (equivalent to API-0101). Page status: `Active`.
- Duplicate `page_id` values use the `page_name` from the first occurrence.
- Audit record created per page via API-0505 with action `PAGE_CREATED`, attributed to the executing user.

**Step 4 — Tag creation**
- For each valid row (has `page_id` and `tag_id`), create a tag record under its page (equivalent to API-0102). Tag status: `Active`.
- If a `tag_id` is duplicated within the same `page_id`, only the first occurrence is created. Subsequent duplicates are logged in `skippedRows`.
- Audit record created per tag via API-0505 with action `TAG_CREATED`.

**Step 5 — English copy creation**
- For each tag where the `english_copy` column is non-empty, create an English copy record in `Approved` status with no review cycle (FRD F-21: migrated content is production-live).
- English copy version: 1. Author: the user who executed the migration. Approval date: the execution timestamp.
- Audit record created per English copy via API-0505 with action `ENGLISH_COPY_APPROVED`.

**Step 6 — Translation creation**
- For each non-empty language column cell in the row, create a translation record in `Approved` status.
- Language codes not configured in MioTranslate are skipped and logged.
- Translation version: 1. Creation method: `MIGRATED`. Author: the executing user.
- Audit record created per translation via API-0505 with action `TRANSLATION_APPROVED`.

**Step 7 — Deployment record creation**
- After all entity creation, create a deployment record for every page in every migrated language, targeting the `Production` environment. This reflects the reality that migrated content is already live in production.
- The deployment record notes it was created via migration, not via the standard publishing workflow (API-0405).

**Step 8 — Coverage recalculation**
- After all entities are created, trigger API-0503 (Recalculate Coverage) for all migrated pages and languages.

**Step 9 — Import Event update**
- Set Import Event `status` to `COMPLETED`.
- Populate `counts` with the totals from Steps 3–6.
- Set `executionCompletedAt`.

**On failure at any step:**
- Set Import Event `status` to `FAILED`.
- Roll back all entity creation performed so far (transactional rollback — the database must return to the pre-migration state).
- The error reason is stored in the Import Event and surfaced in the status poll response.

---

#### 3.2.6 Business Rules

| Rule | Source | Enforcement |
|---|---|---|
| Authorized roles only | FRD §8 | 403 for non-Founder/non-Administrator roles. |
| Migration Event must be in `UPLOAD_READY` status | API Design | 409 `INVALID_MIGRATION_STATUS` if the event is in any other state. |
| System must be empty (no existing pages) | FRD F-21: migration is a bootstrapping operation | 409 `SYSTEM_NOT_EMPTY` if pages already exist. Prevents accidental re-execution on a live system. |
| Migrated content enters as Approved + Production-deployed | FRD F-21: "All imported content enters as Published in Production" | English copy and translation records are created directly in `Approved` state. A Production deployment record is created for each page+language combination. |
| Module and Copy Type not populated | FRD F-21: "Module and Copy Type are not present in imported data" | These fields are left null on all created page and tag records. |
| Rollback on failure | FRD F-21: "Partial failure — rollback to pre-migration state possible" | If any critical error occurs, the entire import is rolled back. The system must return to the state it was in before API-1002 was called. |
| Audit record created per entity | FRD §7 Rule 20, F-17 | Every page, tag, English copy record, and translation record created triggers API-0505. |
| One migration execution at a time | API Design | 409 `MIGRATION_IN_PROGRESS` if any Import Event is currently `PROCESSING`. |

---

#### 3.2.7 Error Catalogue

| HTTP | Code | Condition |
|---|---|---|
| 403 | `FORBIDDEN` | Caller is not Founder or Administrator. |
| 404 | `MIGRATION_NOT_FOUND` | `migrationId` does not exist. |
| 409 | `INVALID_MIGRATION_STATUS` | Import Event is not in `UPLOAD_READY` status. The current status is included in the response. |
| 409 | `SYSTEM_NOT_EMPTY` | MioTranslate already contains pages. Migration cannot proceed on a non-empty system. |
| 409 | `MIGRATION_IN_PROGRESS` | Another migration is currently processing. |

> **Processing failures during async execution** (e.g., file parse error mid-stream, database write failure) are not surfaced as synchronous HTTP errors — the 202 is already returned. Instead, they are reflected as `status: FAILED` on the Import Event record, which the client discovers via the status poll endpoint (`GET /v1/migrations/{migrationId}`). The `failureReason` field in the poll response provides the error detail.

---

### API-1003: Get Migration Validation Report

> **Source:** FRD F-21 ("After import, a validation report is generated"), UF-02 Steps 10–12. API List API-1003.

**Endpoint:**
```
GET /v1/migrations/{migrationId}/report
```

**Purpose:** Generate and return a detailed validation report comparing the source file's content counts against MioTranslate's post-import state. The report confirms whether all expected pages, tags, English copy records, and translations were successfully created. It also lists all skipped rows and any discrepancies found. Zero discrepancies indicates a clean, complete migration.

The report is generated on demand when this endpoint is first called after a successful import. Subsequent calls return the same cached report. The report is the final step in the migration workflow — the administrator reviews it and decides whether the migration was successful.

**Authorization:** `FN`, `ADMIN`.

---

#### 3.3.1 Path Parameters

| Parameter | Type | Description |
|---|---|---|
| `migrationId` | string | The Import Event ID from API-1001. Must be in `COMPLETED` or `REPORT_AVAILABLE` status. |

#### 3.3.2 Request

No query parameters. The report scope is the full migration — all pages, tags, and languages imported.

---

#### 3.3.3 Response — 200 OK

The response is the Validation Report Record (see §2.3):

```json
{
  "data": {
    "migrationId": "mig_20260821_090000_abc001",
    "generatedAt": "2026-08-21T09:13:00Z",
    "summary": {
      "status": "PASS",
      "pagesExpected": 14,
      "pagesFound": 14,
      "tagsExpected": 892,
      "tagsFound": 892,
      "translationsExpected": 2676,
      "translationsFound": 2676,
      "discrepancyCount": 0
    },
    "discrepancies": [],
    "skippedRows": [
      {
        "rowNumber": 45,
        "pageId": "INVOICE",
        "tagId": null,
        "reason": "TAG_ID_MISSING"
      },
      {
        "rowNumber": 301,
        "pageId": "APPOINTMENTS",
        "tagId": "APT_CANCEL_BTN",
        "reason": "ENGLISH_COPY_EMPTY"
      },
      {
        "rowNumber": 714,
        "pageId": null,
        "tagId": null,
        "reason": "PAGE_ID_MISSING"
      }
    ]
  }
}
```

---

#### 3.3.4 Business Rules

| Rule | Source | Enforcement |
|---|---|---|
| Authorized roles only | FRD §8 | 403 for non-Founder/non-Administrator roles. |
| Import Event must be COMPLETED | FRD F-21 | 409 `INVALID_MIGRATION_STATUS` if the event is `UPLOAD_READY`, `PROCESSING`, or `FAILED`. |
| Report is generated once and cached | API Design | The first call generates the report and transitions the Import Event to `REPORT_AVAILABLE`. Subsequent calls return the cached report. No re-generation on repeat calls. |
| Skipped rows are not discrepancies | API Design | A skipped row was intentionally excluded during processing (e.g., missing tag ID). It is listed in `skippedRows` but does not increment `discrepancyCount`. Discrepancies are entities that should have been created but were not. |
| Zero discrepancies = PASS | FRD F-21: "Zero discrepancies = successful migration" | `summary.status` is `PASS` when `discrepancyCount` is 0. |
| Non-zero discrepancies = PASS_WITH_WARNINGS or FAIL | API Design | Suggested classification: `ENTITY_NOT_FOUND_POST_IMPORT` — FAIL. `DUPLICATE_PAGE_NAME_CONFLICT`, `TRANSLATION_LANGUAGE_UNKNOWN` — PASS_WITH_WARNINGS. |
| No audit record for report generation | API Design | Report generation is a read operation. Per Group 5 rules, read-equivalent operations do not produce audit records. |

---

#### 3.3.5 Error Catalogue

| HTTP | Code | Condition |
|---|---|---|
| 403 | `FORBIDDEN` | Caller is not Founder or Administrator. |
| 404 | `MIGRATION_NOT_FOUND` | `migrationId` does not exist. |
| 409 | `INVALID_MIGRATION_STATUS` | Import Event is not `COMPLETED` or `REPORT_AVAILABLE`. The current status is included in the response (e.g., `PROCESSING` — import not yet finished; `FAILED` — import failed, rollback applied). |

---

## 4. System Relationships

### 4.1 API-1002 → Group 1/2/3 (Entity Creation)

API-1002 creates entities across three domains. It does so by executing the equivalent logic of the normal-path APIs, but in bulk and bypassing the interactive draft/review cycle:

```
API-1002 Execute Migration
    |
    |-- creates Pages        (equivalent to Group 1 API-0101)
    |-- creates Tags         (equivalent to Group 1 API-0102)
    |-- creates English Copy (equivalent to Group 2 API-0203 "Approve" path)
    |   in Approved state
    +-- creates Translations (equivalent to Group 3 API-0304 "Approve" path)
        in Approved state
```

> **Implementation note:** API-1002 should not call Group 1/2/3 APIs over HTTP — it should use the same underlying service/repository layer directly to avoid unnecessary round-trips and allow atomic transaction management across all entity types.

---

### 4.2 API-1002 → API-0405 (Deployment Record)

API-1002 creates a Production deployment record for every migrated page+language combination. This record is written to the same `Release` entity store used by API-0405, but with the source marked as `MIGRATION` rather than the normal publishing workflow.

```
API-1002 ---- creates Release record ----> Release Store
              (type: MIGRATION,
               environment: PRODUCTION,
               per page+language)
```

This ensures the Coverage Dashboard (Group 6 API-0601) and the Environment Status Matrix (Group 6 API-0607) correctly reflect migrated content as deployed to Production from day one.

---

### 4.3 API-1002 → API-0505 (Audit Records)

Every entity creation in API-1002 produces an audit record via Group 5 API-0505:

| Entity Created | Audit Action |
|---|---|
| Page | `PAGE_CREATED` |
| Tag | `TAG_CREATED` |
| English Copy (Approved) | `ENGLISH_COPY_APPROVED` |
| Translation (Approved) | `TRANSLATION_APPROVED` |

All records are attributed to the user who called API-1002 (`executedBy`). The `details` field on each record includes a note: `"Created via initial migration — Import Event: mig_20260821_090000_abc001"`.

---

### 4.4 API-1002 → API-0503 (Coverage Recalculation)

Coverage is recalculated once after all entity creation is complete — not row-by-row. This is the correct strategy for a bulk migration: recalculating after every row would produce thousands of intermediate coverage calculations that are meaningless and computationally expensive.

```
API-1002 entity creation complete
    |
    +-- triggers API-0503 (Recalculate Coverage)
        +-- for each migrated page x language combination
```

---

## 5. Cross-Group Consistency Audit

### 5.1 Group 1 (Page & Tag Registry) — Consistency

| Concern | Check Result |
|---|---|
| Page ID naming rules | OK — API-1001 structural validation checks that `page_id` and `tag_id` columns are present. API-1002 applies the same naming validation as API-0101 and API-0102 during entity creation. Rows with IDs that violate naming rules are logged as `rowsFailed` and included in the validation report. |
| Tag ID uniqueness within page | OK — API-1002 enforces uniqueness: duplicate `tag_id` within the same `page_id` results in the subsequent rows being skipped and flagged in `skippedRows` with reason `DUPLICATE_TAG_ID`. |
| Deprecated tags | OK — Migration creates all tags as `Active`. Deprecation is a post-migration operation performed through normal Group 1 API-0107. |

---

### 5.2 Group 2 (English Copy) — Consistency

| Concern | Check Result |
|---|---|
| Migrated English copy enters as Approved | OK — Consistent with FRD F-21. Migrated content is production-live; no review cycle is appropriate. The English Copy state model (Group 2) allows a record to exist in `Approved` state directly — this is the state produced by API-0203 Approve action. Migration uses the same state. |
| Version number | OK — Migrated English copy starts at version 1. Subsequent edits through the normal workflow (API-0201) will create version 2, 3, etc. Version history is preserved correctly. |
| Tags with no English copy | OK — Tags where `english_copy` is empty are created with `NO_COPY` status. This is a valid state in the Tag state model (FRD §4.2). They are logged in `skippedRows` with reason `ENGLISH_COPY_EMPTY` to make the omission visible to the administrator. |

---

### 5.3 Group 3 (Translation) — Consistency

| Concern | Check Result |
|---|---|
| Migrated translations enter as Approved | OK — Same rationale as English copy — migrated translations are production-live. They enter directly in `Approved` state. Consistent with the translation state model where `Approved` is a valid terminal state (Group 3). |
| Languages not configured in MioTranslate | OK — Language columns in the file for unknown language codes are skipped. The language must be added via API-0802 (Add Language) before it is usable. If the administrator wants to migrate content for a new language, they must add the language first, then run the migration. |
| Confidence score for migrated translations | OK — Migrated translations have no AI confidence score (they were not generated by the AI translation service). The `confidenceScore` field on the translation record is `null`. This is valid — the field is nullable (human-authored and migrated translations do not have scores). |
| Stale flagging for migrated content | OK — No stale flagging occurs during migration. Stale flagging is triggered by English copy changes (Group 5 API-0501). Migration creates English copy once at version 1 — no change event occurs. Stale flagging will behave normally for any subsequent edits through the standard workflow. |

---

### 5.4 Group 4 (Publishing & Deployment) — Consistency

| Concern | Check Result |
|---|---|
| Deployment record for migrated content | OK — API-1002 creates a Production deployment record per page+language. This is stored in the same Release entity as Group 4 API-0405, ensuring the deployment history (API-0406) correctly shows the migration as the first deployment. |
| Pre-publishing summary for migrated content | OK — After migration, if a user calls Group 4 API-0402 (Get Pre-Publishing Summary) to publish an update to QA or Production, the comparison will correctly show the diff between the migrated version (v1) and the current approved content. |

---

### 5.5 Group 5 (System-Triggered) — Consistency

| Concern | Check Result |
|---|---|
| Audit records attributed correctly | OK — All audit records created during migration are attributed to the user who called API-1002 (`executedBy`). The `details` field notes the migration context. This is consistent with Group 5 API-0505's model where `performedBy` is the triggering user. |
| Coverage recalculation timing | OK — API-0503 is triggered once after all entity creation, not per-row. This is consistent with API-0503's design (it recalculates for a given scope) and avoids redundant computation during bulk operations. |

---

### 5.6 Cross-Group Issues Found

| Issue ID | Classification | Description |
|---|---|---|
| **CG-G10-01** | Format Decision Required | The import file format (`CSV`, `Excel`, `JSON`) is marked as TBD in the API List (FRD F-21). The column schema in §2.2 assumes a row-per-tag structure, but the exact format and column naming conventions must be agreed upon before Group 10 can be locked. This is the most critical open item for Group 10. |
| **CG-G10-02** | System-Not-Empty Guard | API-1002 rejects execution if MioTranslate already contains pages (`SYSTEM_NOT_EMPTY`). This guard is essential but has implications: if a partial migration completes (some pages created) and then fails, the rollback must genuinely remove all created entities. Engineering must ensure the rollback is transactional and complete — otherwise the guard will prevent a re-run even when it is needed. |
| **CG-G10-03** | Deployment Record Source Tag | The Production deployment records created by API-1002 are tagged with `source: MIGRATION`. The Group 4 deployment history API (API-0406) must handle this source type — it currently only expects `MANUAL` (user-initiated via API-0405) and `AUTO` (implicit Dev publish via API-0502). `MIGRATION` must be added as a valid `source` enum value to the Release entity. |
| **CG-G10-04** | Coverage Baseline | Coverage is recalculated after migration (§4.4). Because all migrated translations enter as `Approved` and the deployment record targets `Production`, the Coverage Dashboard (Group 6 API-0601) should immediately show 100% coverage for all migrated languages. If it does not, the coverage recalculation logic must be investigated. This is a useful sanity check that engineering can run after migration to validate end-to-end consistency. |

---

## 6. RBAC Summary

| API | Write? | Authorization |
|---|---|---|
| API-1001 Upload Import File | No (stores file only) | `FN`, `ADMIN` |
| API-1002 Execute Migration Import | Yes (creates entities) | `FN`, `ADMIN` |
| API-1002 (sub) Get Migration Status | No | `FN`, `ADMIN` |
| API-1003 Get Migration Validation Report | No (reads only) | `FN`, `ADMIN` |

---

## 7. Engineering Notes

| ID | Note | Impact if Not Met |
|---|---|---|
| **EN-G10-01** | **File format decision — RESOLVED.** The import file format is **CSV** (`text/csv`) for v1. This is a working v1 decision (see §9 Open Question register — OQ-1 closed). The column schema in §2.2 uses the approved column names: `page_id`, `page_name`, `tag_id`, `english_copy`, and one column per language code. If the actual source system export uses different column names, a pre-processing mapping step must be agreed before the migration file is prepared. | Group 10 is now locked on CSV for v1. Any format change requires a revision entry. |
| **EN-G10-02** | **Transactional rollback is mandatory.** API-1002 must execute within a database transaction (or equivalent mechanism) that can be rolled back atomically if any step fails. Partial migrations — where some pages are created but others are not — are worse than a clean failure, because the `SYSTEM_NOT_EMPTY` guard will block re-runs. | Partial migrations can leave MioTranslate in an unusable state that requires manual database intervention to clean up. |
| **EN-G10-03** | **Async execution polling endpoint is required.** The `GET /v1/migrations/{migrationId}` sub-endpoint (§3.2.4) must be implemented and deployed alongside API-1002. The UI depends on it to show progress. Without it, the administrator has no way to know when processing finishes. | The UI will be unable to show migration progress or completion. |
| **EN-G10-04** | **Audit record volume.** For a large migration (e.g., 1,000 tags x 5 languages = 5,000 translations + 1,000 English copy records + pages + tags), API-1002 will generate ~7,000+ audit records in a single execution. Bulk-insert the audit records rather than calling API-0505 individually for each entity. Engineering must decide on the optimal batch write strategy for audit records during migration. | Per-entity audit inserts at this scale will cause the import to run extremely slowly and may generate unacceptable database load. |
| **EN-G10-05** | **Coverage recalculation scope.** After a large migration, triggering API-0503 for every page x language combination could itself be expensive. Engineering must determine whether coverage recalculation should be enqueued as a background task after migration completes, rather than being executed synchronously before the `COMPLETED` status is set. | If coverage recalculation is synchronous and slow, the time from the last entity being created to `COMPLETED` status could be unexpectedly long, confusing administrators who are polling for completion. |
| **EN-G10-06** | **Post-migration coverage verification is a go-live acceptance criterion.** After API-1002 completes and API-0503 has run for all migrated (pageId, language) pairs, engineering must verify that the Coverage Dashboard (Group 6 API-0601) shows the expected coverage percentage for all migrated languages. For a fully migrated language (every active tag has an approved translation), the coverage should be 100%. Any value below 100% indicates that some translations were not migrated correctly or that the coverage recalculation has a data integrity issue. This check must be performed and confirmed before MioTranslate is opened to operational users. (Resolves FINDING-018 / CG-G10-04.) |

---

## 8. Endpoint Summary

| API ID | Method | URL | Purpose | Auth |
|---|---|---|---|---|
| **API-1001** | `POST` | `/v1/migrations/upload` | Upload and structurally validate the import file | `FN`, `ADMIN` |
| **API-1002** | `POST` | `/v1/migrations/{migrationId}/execute` | Execute the migration import — create all entities | `FN`, `ADMIN` |
| **API-1002** (sub) | `GET` | `/v1/migrations/{migrationId}` | Poll for migration execution status | `FN`, `ADMIN` |
| **API-1003** | `GET` | `/v1/migrations/{migrationId}/report` | Get the post-import validation report | `FN`, `ADMIN` |

> **Migration sub-endpoint:** `GET /v1/migrations/{migrationId}` (§3.2.4) is a **public sub-endpoint** of API-1002. It is not a separate Domain 10 API List entry. It must be documented in OpenAPI/API documentation alongside the POST and carries the same authorization restriction (Founder, Administrator only). See §3.2.4 for its error catalogue.

---

## 9. Open Questions Register

> **All open questions for v1 are now resolved as working v1 decisions. The register is closed. Any re-opening of a decision requires a documented revision entry in §Document Status.**

| # | Question | Status | Resolution |
|---|---|---|---|
| **OQ-1** | What is the exact import file format? | **Resolved — Working v1 Decision** | **CSV** (`text/csv`). XLSX and JSON are deferred to a future version. The column naming scheme in §2.2 applies. If the source system cannot export CSV directly, a pre-processing step must be agreed before migration. This decision is adjustable before implementation if the Founder identifies a specific source-system constraint. |
| **OQ-2** | What are the exact column names in the source system's export? | **Resolved — Working v1 Decision** | Column names are agreed for v1: `page_id`, `page_name`, `tag_id`, `english_copy`, and one column per ISO 639-1 language code (e.g., `ar`, `hi`, `ta`, `fr`). Column names are case-sensitive and matched exactly against the header row. If the actual source system uses different names, the CSV must be pre-processed to match these names before upload. |
| **OQ-3** | What is the maximum expected file size and row count? | **Resolved — Working v1 Decision** | **50 MB** file size limit. **50,000 rows** maximum. These cover the largest expected source systems at launch. If operational data shows these limits are insufficient, they can be raised by engineering without an API contract change. |
| **OQ-4** | Should the validation report be downloadable in addition to being returned as JSON? | **Resolved — Working v1 Decision** | **JSON-only in v1.** API-1003 returns the validation report as a JSON response only. A downloadable format (PDF, CSV) is deferred to a future version. Administrators requiring a persistent record should copy the JSON response. |
| **OQ-5** | Which discrepancy types result in `FAIL` vs `PASS_WITH_WARNINGS`? | **Resolved — Working v1 Decision** | **`FAIL`:** Structural file errors (missing required columns, malformed CSV), duplicate IDs within the same page in the source file (`DUPLICATE_TAG_ID`), any entity count mismatch where `tagsFound < tagsExpected` or `pagesFound < pagesExpected` in the validation report (`ENTITY_NOT_FOUND_POST_IMPORT`). **`PASS_WITH_WARNINGS`:** Empty `english_copy` cells (tag created as `NO_COPY`), unrecognized language columns (`TRANSLATION_LANGUAGE_UNKNOWN`), conflicting `page_name` for the same `page_id` (`DUPLICATE_PAGE_NAME_CONFLICT`). **`PASS`:** Zero discrepancies, zero skipped rows, all expected counts match. |

---

*End of Group 10 API Design Specification — v1.1 (Locked).*
