# MioTranslate — DB-06: Database Implementation, Indexing & Performance Specification

**Product:** MioTranslate  
**Document Type:** Database Design — Layer 6 (Physical Implementation, Indexing & Performance)  
**Document ID:** DB-06  
**Version:** 1.0  
**Author:** Principal Database Architect + PostgreSQL Performance Architect + Senior Backend Engineer  
**Date:** August 2026  
**Mandatory Standards Reference:** DB-01 v1.0  
**Direct Predecessors:** DB-02 v1.0, DB-03 v1.0, DB-04 v1.0, DB-05 v1.0  
**Entity Model Sources:** ED-01 v1.1, ED-02 v1.0, ED-03 v1.0  
**API Sources:** Locked API Design Groups 1–10

---

> **Purpose of this document.**  
> DB-06 answers the question: *"Can the database design actually support the documented API contracts at the expected scale, with correct concurrency behaviour, without hidden performance traps?"*
>
> This is the physical implementation-readiness pass — not a redesign. Every finding is classified as a **P0–P3 correction or observation**. P0 findings block production deployment. P1 findings must be resolved before initial load testing. P2 findings should be addressed before GA. P3 findings are deferred improvements.
>
> **What this document does not do:** It does not redesign entities, API contracts, or database architecture. It does not add new tables. It validates, completes, and hardens what DB-02 through DB-05 specified.

---

## Table of Contents

1. Scope and Methodology
2. Master Index Catalog
   - 2.1 `admin` Schema
   - 2.2 `registry` Schema
   - 2.3 `content` Schema
   - 2.4 `translation` Schema
   - 2.5 `publishing` Schema
   - 2.6 `collaboration` Schema
   - 2.7 `system_ops` Schema
   - 2.8 `reporting` Schema
   - 2.9 `search` Schema
   - 2.10 `migration` Schema
3. Query Pattern → Index Traceability
   - 3.1 Group 1: Pages & Tags
   - 3.2 Group 2: English Copy
   - 3.3 Group 3: Translation Management
   - 3.4 Group 4: Publishing & Deployment
   - 3.5 Group 5: System-Triggered Operations
   - 3.6 Group 6: Visibility & Reporting
   - 3.7 Group 7: Search & Navigation
   - 3.8 Group 8: Administration
   - 3.9 Group 9: Comments, Audit & Export
   - 3.10 Group 10: Migration
4. Index Redundancy Audit
5. Concurrency & Locking Validation
   - 5.1 ETag / Optimistic Locking Coverage
   - 5.2 SELECT FOR UPDATE Coverage
   - 5.3 SERIALIZABLE Isolation Scope
   - 5.4 Race Condition Analysis: Critical Paths
   - 5.5 Cross-Domain Write: Group 5 → Translation
6. Transaction Boundary Verification
   - 6.1 Tag Creation (API-0102)
   - 6.2 English Copy Approval → Stale Cascade (API-0203 APPROVE)
   - 6.3 Translation Approval → Implicit DEV Publish (API-0304 + API-0502)
   - 6.4 PAR Approval → Release Creation (API-0404 APPROVE)
   - 6.5 Rollback Release Creation (API-0407)
   - 6.6 Migration Import — Per-Page Batch (API-1002)
   - 6.7 Tag Deprecation → Page Cascade (API-0107)
7. Performance & Scale Assessment
   - 7.1 Table Size Projections (v1 Scale)
   - 7.2 Index Cardinality Analysis
   - 7.3 Hot-Path Query Analysis
   - 7.4 N+1 Query Vulnerability Audit
   - 7.5 Bulk Operation Performance
   - 7.6 What Does Not Need Optimization at v1
8. Implementation Readiness Report (P0–P3)
9. Physical Implementation Ordering
10. Final Integrity Check

---

## 1. Scope and Methodology

### 1.1 Documents Reviewed

This document synthesises and validates:

| Document | Version | Purpose in this review |
|---|---|---|
| DB-01 — Database Architecture & Standards | v1.0 | Mandatory foundation: all standards, OQ resolutions, schema ownership |
| DB-02 — Core Transactional Schema | v1.0 | 16 tables across 7 schemas; primary index and trigger definitions |
| DB-03 — History, Versioning & Audit Schema | v1.0 | `system_ops.audit_records`, `migration.import_events` base definition, lineage model |
| DB-04 — Reporting, Read Models & Search | v1.0 | `reporting.coverage_metrics`, `search.recently_edited_events`, search architecture |
| DB-05 — Migration & Operational Storage | v1.0 | `migration.import_events` extensions, `collaboration.export_jobs` |
| ED-01 — Canonical Entity Model | v1.1 | Authoritative entity definitions |
| ED-02 — Entity Relationships, Lifecycle & Versioning | v1.0 | Lifecycle state machines, cross-entity invariants |
| ED-03 — Cross-Domain Entity Contract & Traceability | v1.0 | Invariant catalog (XI-01 to XI-34), API → entity mapping |
| API Design Groups 1–10 | Locked | Precise API contracts, request/response fields, concurrency protocols |

### 1.2 Finding Classification

| Priority | Meaning | Blocking? |
|---|---|---|
| **P0** | Schema or logic error that will cause data corruption, invariant violation, or production outage | ✅ Blocks deployment |
| **P1** | Missing index or constraint that will cause unacceptable query performance or concurrency gap at any realistic scale | ✅ Blocks load testing |
| **P2** | Identified gap or ambiguity that should be resolved before GA; non-blocking for testing | ⚠️ Resolve before GA |
| **P3** | Deferred improvement: not needed at v1 scale; document for future reference | ℹ️ Informational |

### 1.3 Assumptions

- **Scale:** ~15 internal users. ~89 pages at launch, ~50 tags per page (4,450 tags total), 8 active languages. Max 35,600 Translation live-state rows and ~35,600+ Translation version rows over the first year of operation.
- **Concurrency:** Peak concurrent writes: ≤ 10 simultaneous users. No consumer-facing load. Query performance requirements: P95 < 200ms for all user-facing APIs.
- **Environment:** PostgreSQL 15+. Single primary, one hot-standby read replica (DB-01 §21.5).

---

## 2. Master Index Catalog

The following is the authoritative, consolidated index inventory across all schemas. Every index previously defined in DB-02 through DB-05 is catalogued here. Any index appearing here that was NOT defined in those documents is a **new P1 or P2 finding** and is marked `[NEW – P1]` or `[NEW – P2]`.

### 2.1 `admin` Schema

**Table: `admin.users`**

| Index Name | Type | Columns | Predicate | Source | Query Pattern |
|---|---|---|---|---|---|
| `users_pkey` | B-tree (PK) | `user_id` | — | DB-02 §2.1 | All FK lookups, auth token resolution |
| `users_email_unique` | B-tree (UNIQUE) | `email` | — | DB-02 §2.1 | Login: `WHERE email = $1` |

**Table: `admin.languages`**

| Index Name | Type | Columns | Predicate | Source | Query Pattern |
|---|---|---|---|---|---|
| `languages_pkey` | B-tree (PK) | `language_code` | — | DB-02 §2.2 | All FK lookups by `language_code` |
| `idx_languages_active` | B-tree (PARTIAL) | `language_code` | `status = 'ACTIVE'` | DB-02 §13.2 | Language selector UI; API-0102 slot creation filter; API-0803 |

**Table: `admin.user_role_assignments`**

| Index Name | Type | Columns | Predicate | Source | Query Pattern |
|---|---|---|---|---|---|
| `user_role_assignments_pkey` | B-tree (PK) | `assignment_id` | — | DB-02 §2.3 | Direct record lookup |
| `user_role_assignments_active_unique` | B-tree (PARTIAL UNIQUE) | `(user_id, role)` | `revoked_at IS NULL` | DB-02 §13.3 | Concurrent grant deduplication; one-active-role invariant |
| `idx_user_role_assignments_user_active` | B-tree (PARTIAL) | `user_id` | `revoked_at IS NULL` | DB-02 §13.3 | RBAC check on every authenticated request (hot path) |
| `idx_user_role_assignments_role_active` | B-tree (PARTIAL) | `role` | `revoked_at IS NULL` | DB-02 §13.3 | Find all active holders of a role (notification targeting, Group 8) |
| `idx_user_role_assignments_user_id` | B-tree | `(user_id, assigned_at DESC)` | — | DB-02 §13.3 | Full role history for a user (API-0801) |

**Table: `admin.system_configuration`**

| Index Name | Type | Columns | Predicate | Source | Query Pattern |
|---|---|---|---|---|---|
| `system_configuration_pkey` | B-tree (PK) | `config_key` | — | DB-02 §2.4 | Single-key lookup for all configuration reads |

---

### 2.2 `registry` Schema

**Table: `registry.pages`**

| Index Name | Type | Columns | Predicate | Source | Query Pattern |
|---|---|---|---|---|---|
| `pages_pkey` | B-tree (PK) | `page_id` | — | DB-02 §3.1 | All FK lookups; direct page lookup (API-0104) |
| `idx_pages_status_active` | B-tree (PARTIAL) | `page_id` | `status = 'ACTIVE'` | DB-02 §13.5 | Active page list (API-0103) |
| `idx_pages_module` | B-tree (PARTIAL) | `module` | `module IS NOT NULL` | DB-02 §13.5 | Module filter in page list (API-0103 filter by module) |
| `idx_pages_search_vector` | GIN | `search_vector` | — | **[NEW – P1]** | Full-text search on page_name (API-0701 `type=page` branch) |

> **Finding [P1-01]: Missing GIN index on `registry.pages.search_vector`.**  
> DB-04 §7.2 specifies that API-0701 searches page names via FTS. DB-02 §13.5 defines `idx_tags_search_vector` on `registry.tags` but does not define a corresponding GIN index on `registry.pages.search_vector`. The `search_vector` generated column is defined on `registry.pages` (DB-02 §3.1), but without a GIN index the FTS query degrades to a full-table sequential scan.  
> **Action:** `CREATE INDEX idx_pages_search_vector ON registry.pages USING GIN (search_vector);`

**Table: `registry.tags`**

| Index Name | Type | Columns | Predicate | Source | Query Pattern |
|---|---|---|---|---|---|
| `tags_pkey` | B-tree (PK) | `tag_id` | — | DB-02 §3.2 | All FK lookups; direct tag lookup (API-0105) |
| `idx_tags_page_id` | B-tree | `(page_id, tag_id)` | — | DB-02 §13.6 | All tags on a page (API-0104 full list, ordered) |
| `idx_tags_page_id_active` | B-tree (PARTIAL) | `page_id` | `status = 'ACTIVE'` | DB-02 §13.6 | Active tags on a page (publishing bundle construction, coverage denominator, slot creation) |
| `idx_tags_active` | B-tree (PARTIAL) | `tag_id` | `status = 'ACTIVE'` | DB-02 §13.6 | All active tags system-wide (API-0506 new language slot bulk-create) |
| `idx_tags_search_vector` | GIN | `search_vector` | — | DB-02 §13.6 | Full-text search by tag_id + tag_name (API-0701) |

---

### 2.3 `content` Schema

**Table: `content.english_copies`**

| Index Name | Type | Columns | Predicate | Source | Query Pattern |
|---|---|---|---|---|---|
| `english_copies_pkey` | B-tree (PK) | `tag_id` | — | DB-02 §4.1 | EC lookup by tag (1:1 — hot path for Group 2 and Group 3 validation) |
| `idx_english_copies_status_pending` | B-tree (PARTIAL) | `tag_id` | `status = 'PENDING_REVIEW'` | DB-02 §13.7 | Review queue: English copy items (API-0606) |
| `idx_english_copies_status_no_copy` | B-tree (PARTIAL) | `tag_id` | `status = 'NO_COPY'` | DB-02 §13.7 | Pending work: tags needing English copy authoring (API-0604) |
| `idx_english_copies_status` | B-tree | `status` | — | DB-02 §13.7 | Status distribution aggregation (API-0604 totals, coverage denominator filter) |

**Table: `content.english_copy_versions`**

| Index Name | Type | Columns | Predicate | Source | Query Pattern |
|---|---|---|---|---|---|
| `english_copy_versions_pkey` | B-tree (PK) | `(tag_id, version_number)` | — | DB-02 §4.2 | Specific version lookup; `source_english_version` FK joins from `translation_versions` |
| `english_copy_versions_approved_unique` | B-tree (PARTIAL UNIQUE) | `tag_id` | `status = 'APPROVED'` | DB-02 §4.2 | Single approved version invariant (XI-19); fast approved version retrieval |
| `idx_english_copy_versions_tag_id_desc` | B-tree | `(tag_id, version_number DESC)` | — | DB-02 §13.8 | Version history ordered list (API-0204) |
| `idx_english_copy_versions_search_vector` | GIN | `search_vector` | — | DB-02 §13.8 | Full-text search on English copy text (API-0701) |

> **Finding [P2-01]: FTS index covers all version texts, not only APPROVED versions.**  
> DB-02 OI-05 documents this known issue. API-0701 should search approved English text. The current generated-column approach indexes all versions. **Action (P2):** Replace with a partial GIN index on approved versions only, or maintain an `approved_search_vector` column on `content.english_copies` updated on approval. Deferred to DB-07 (search schema). Does not block v1 correctness — causes over-returning in search results, not data loss.

---

### 2.4 `translation` Schema

**Table: `translation.translations`**

| Index Name | Type | Columns | Predicate | Source | Query Pattern |
|---|---|---|---|---|---|
| `translations_pkey` | B-tree (PK) | `(tag_id, language_code)` | — | DB-02 §5.1 | Direct translation lookup; FK anchor |
| `idx_translations_tag_id` | B-tree | `tag_id` | — | DB-02 §13.9 | All languages for a tag (API-0501 stale cascade — hot path after EC approval) |
| `idx_translations_language_code` | B-tree | `language_code` | — | DB-02 §13.9 | All translations for a language (coverage computation, reporting) |
| `idx_translations_stale` | B-tree (PARTIAL) | `(language_code, stale_triggered_at)` | `status = 'STALE'` | DB-02 §13.9 | Stale translations report (API-0603), ordered by oldest-first |
| `idx_translations_pending_review` | B-tree (PARTIAL) | `language_code` | `status = 'PENDING_REVIEW'` | DB-02 §13.9 | Review queue: translation items per language (API-0606) |
| `idx_translations_no_translation` | B-tree (PARTIAL) | `language_code` | `status = 'NO_TRANSLATION'` | DB-02 §13.9 | Pending work: untranslated slots per language (API-0604) |

**Table: `translation.translation_versions`**

| Index Name | Type | Columns | Predicate | Source | Query Pattern |
|---|---|---|---|---|---|
| `translation_versions_pkey` | B-tree (PK) | `(tag_id, language_code, version_number)` | — | DB-02 §5.2 | Specific version lookup |
| `idx_translation_versions_tag_lang_desc` | B-tree | `(tag_id, language_code, version_number DESC)` | — | DB-02 §13.10 | Version history for a (tag, language) ordered by version (API-0308) |
| `idx_translation_versions_source_ec_version` | B-tree | `(tag_id, source_english_version)` | — | DB-02 §13.10 | "Which translations were based on EC version N?" — stale analysis, audit |
| `idx_translation_versions_approved` | B-tree (PARTIAL) | `(tag_id, language_code)` | `status = 'APPROVED'` | DB-02 §13.10 | Publishing bundle construction: find APPROVED TV for each tag × language |

---

### 2.5 `publishing` Schema

**Table: `publishing.publishing_approval_requests`**

| Index Name | Type | Columns | Predicate | Source | Query Pattern |
|---|---|---|---|---|---|
| `publishing_approval_requests_pkey` | B-tree (PK) | `approval_request_id` | — | DB-02 §6.1 | Direct PAR lookup |
| `par_pending_unique` | B-tree (PARTIAL UNIQUE) | `(page_id, language_code, environment)` | `status = 'PENDING'` | DB-02 §6.1 | Concurrent PAR prevention; one-PENDING-PAR-per-scope invariant (XI-20) |
| `idx_par_scope` | B-tree | `(page_id, language_code, environment)` | — | DB-02 §13.11 | PAR lookup by scope (pre-publish summary, API-0402 status) |
| `idx_par_pending` | B-tree (PARTIAL) | `(required_approver_role, created_at)` | `status = 'PENDING'` | DB-02 §13.11 | Review queue: publishing approvals per role (API-0606) |
| `idx_par_expiry` | B-tree (PARTIAL) | `expires_at` | `status = 'PENDING'` | DB-02 §13.11 | Background PAR expiry job |

**Table: `publishing.releases`**

| Index Name | Type | Columns | Predicate | Source | Query Pattern |
|---|---|---|---|---|---|
| `releases_pkey` | B-tree (PK) | `release_id` | — | DB-02 §6.2 | Direct release lookup |
| `releases_deployment_identity_unique` | B-tree (UNIQUE) | `(page_id, language_code, environment, deployment_version)` | — | DB-02 §6.2 | Deployment version uniqueness enforcement; lookup by scope + version number |
| `releases_in_flight_unique` | B-tree (PARTIAL UNIQUE) | `(page_id, language_code, environment)` | `status IN ('PENDING', 'IN_PROGRESS')` | DB-02 §6.2 | Concurrent publishing prevention (DB-R-10 resolution) |
| `idx_releases_scope_successful` | B-tree (PARTIAL) | `(page_id, language_code, environment, deployment_version DESC)` | `status = 'SUCCESSFUL'` | DB-02 §13.12 | Current environment status; coverage numerator; rollback target selection |
| `idx_releases_scope_history` | B-tree | `(page_id, language_code, environment, deployment_version DESC)` | — | DB-02 §13.12 | Full deployment history (API-0406) |
| `idx_releases_approval_request_id` | B-tree (PARTIAL) | `approval_request_id` | `approval_request_id IS NOT NULL` | DB-02 §13.12 | PAR → Release link lookup |
| `idx_releases_in_flight` | B-tree (PARTIAL) | `initiated_at` | `status IN ('PENDING', 'IN_PROGRESS')` | DB-02 §13.12 | Monitoring in-flight publishes |

**Table: `publishing.release_content_snapshots`**

| Index Name | Type | Columns | Predicate | Source | Query Pattern |
|---|---|---|---|---|---|
| `release_content_snapshots_pkey` | B-tree (PK) | `(release_id, tag_id)` | — | DB-02 §6.3 | All tags in a release (leading-column scan on `release_id`); single tag lookup |

---

### 2.6 `collaboration` Schema

**Table: `collaboration.comments`**

| Index Name | Type | Columns | Predicate | Source | Query Pattern |
|---|---|---|---|---|---|
| `comments_pkey` | B-tree (PK) | `comment_id` | — | DB-02 §7.1 | Direct comment lookup |
| `idx_comments_tag_id` | B-tree | `(tag_id, created_at DESC)` | — | DB-02 §13.14 | All comments for a tag ordered by recency (API-0902) |
| `idx_comments_tag_scope` | B-tree | `(tag_id, comment_scope, language_code)` | — | DB-02 §13.14 | Scoped comment retrieval with scope filter (API-0902 with `scope=ENGLISH` or `scope=LANGUAGE`) |
| `idx_comments_unresolved` | B-tree (PARTIAL) | `tag_id` | `is_resolved = FALSE` | DB-02 §13.14 | Unresolved comment count on tag detail view |

**Table: `collaboration.export_jobs`**

| Index Name | Type | Columns | Predicate | Source | Query Pattern |
|---|---|---|---|---|---|
| `export_jobs_pkey` | B-tree (PK) | `export_job_id` | — | DB-05 §7.2 | Direct export job lookup (API-0905 status poll) |
| `idx_export_jobs_requested_by` | B-tree (PARTIAL) | `(requested_by, created_at DESC)` | `status != 'EXPIRED'` | DB-05 §7.6 | User's export job history (non-expired) |
| `idx_export_jobs_pending_processing` | B-tree (PARTIAL) | `created_at` | `status IN ('PENDING', 'PROCESSING')` | DB-05 §7.6 | Background export worker queue |
| `idx_export_jobs_expiry` | B-tree (PARTIAL) | `file_expires_at` | `status = 'READY'` | DB-05 §7.6 | Background cleanup: READY export jobs past TTL |

---

### 2.7 `system_ops` Schema

**Table: `system_ops.notifications`**

| Index Name | Type | Columns | Predicate | Source | Query Pattern |
|---|---|---|---|---|---|
| `notifications_pkey` | B-tree (PK) | `notification_id` | — | DB-02 §8.1 | Direct notification lookup |
| `idx_notifications_user_unread` | B-tree (PARTIAL) | `(recipient_user_id, created_at DESC)` | `status = 'UNREAD'` | DB-02 §13.15 | Primary notification inbox (API-0906) |
| `idx_notifications_user_all` | B-tree | `(recipient_user_id, created_at DESC)` | — | DB-02 §13.15 | All notifications for a user (API-0906 with `status=all`) |
| `idx_notifications_delivery_pending` | B-tree (PARTIAL) | `created_at` | `delivery_status = 'PENDING'` | DB-02 §13.15 | Async delivery worker queue |

**Table: `system_ops.audit_records`**

| Index Name | Type | Columns | Predicate | Source | Query Pattern |
|---|---|---|---|---|---|
| `audit_records_pkey` | B-tree (PK) | `audit_record_id` | — | DB-03 §4.1 | Direct record lookup; UUID v7 ensures time-ordered inserts |
| `idx_audit_performed_at` | B-tree | `performed_at DESC` | — | DB-03 §4.6 | Global timeline (API-0605, API-0904 default sort) |
| `idx_audit_subject` | B-tree | `(subject_entity_type, subject_entity_id, performed_at DESC)` | — | DB-03 §4.6 | "All changes to tag X" (API-0904 entity filter) |
| `idx_audit_user` | B-tree (PARTIAL) | `(performed_by_user_id, performed_at DESC)` | `performed_by_user_id IS NOT NULL` | DB-03 §4.6 | "All actions by user Y" (API-0904 actor filter) |
| `idx_audit_request_id` | B-tree (PARTIAL) | `request_id` | `request_id IS NOT NULL` | DB-03 §4.6 | Request trace reconstruction (operational debugging) |
| `idx_audit_action` | B-tree | `(action, performed_at DESC)` | — | DB-03 §4.6 | Filter by action type (API-0904 action filter, operational monitoring) |

---

### 2.8 `reporting` Schema

**Table: `reporting.coverage_metrics`**

| Index Name | Type | Columns | Predicate | Source | Query Pattern |
|---|---|---|---|---|---|
| `coverage_metrics_pkey` | B-tree (PK) | `(page_id, language_code)` | — | DB-04 §2.2 | Direct cell lookup (API-0601, API-0602) |
| `idx_coverage_stale_pending` | B-tree (PARTIAL) | `(page_id, language_code)` | `computation_status IN ('STALE', 'PENDING')` | DB-04 §2.8 | Coverage recomputation worker: find cells needing recalculation |
| `idx_coverage_language` | B-tree | `language_code` | — | **[NEW – P2]** | Language deactivation: set all cells for a language to STALE (API-0803) |

> **Finding [P2-03]: Missing index on `reporting.coverage_metrics.language_code`.**  
> When a language is deactivated (API-0803), the coverage worker must set all cells for that language to `computation_status = 'STALE'`. Without this index, the query degrades to a sequential scan on the PK. At 712 rows this is fast now, but the index documents intent.  
> **Action:** `CREATE INDEX idx_coverage_language ON reporting.coverage_metrics (language_code);`

---

### 2.9 `search` Schema

**Table: `search.bookmarks`**

| Index Name | Type | Columns | Predicate | Source | Query Pattern |
|---|---|---|---|---|---|
| `bookmarks_pkey` | B-tree (PK) | `bookmark_id` | — | DB-02 §9.1 | Direct lookup for DELETE (API-0704) |
| `bookmarks_user_target_unique` | B-tree (UNIQUE) | `(user_id, target_type, target_id)` | — | DB-02 §9.1 | Toggle deduplication (API-0702); existence check before creating |
| `idx_bookmarks_user_id` | B-tree | `(user_id, created_at DESC)` | — | DB-02 §13.16 | User's bookmark list ordered by recency (API-0703) |

**Table: `search.recently_edited_events`**

| Index Name | Type | Columns | Predicate | Source | Query Pattern |
|---|---|---|---|---|---|
| `recently_edited_events_pkey` | B-tree (PK) | `(user_id, target_type, target_id)` | — | DB-04 §8.1 | Upsert anchor; direct row lookup for cleanup |
| `idx_recently_edited_user_recent` | B-tree | `(user_id, last_accessed_at DESC)` | — | DB-04 §8.1 | User's recently-viewed pages ordered by recency (API-0706) |
| `idx_recently_edited_cleanup` | B-tree | `last_accessed_at` | — | **[NEW – P2]** | 30-day cleanup job: `WHERE last_accessed_at < now() - interval '30 days'` |

> **Finding [P2-04]: Missing index for recently-edited cleanup job.**  
> The 30-day retention cleanup job (DB-01 §20.7, DB-04 §8.3) scans by `last_accessed_at`. Without an index, the cleanup degrades to a full-table scan.  
> **Action:** `CREATE INDEX idx_recently_edited_cleanup ON search.recently_edited_events (last_accessed_at);`

---

### 2.10 `migration` Schema

**Table: `migration.import_events`**

| Index Name | Type | Columns | Predicate | Source | Query Pattern |
|---|---|---|---|---|---|
| `import_events_pkey` | B-tree (PK) | `import_event_id` | — | DB-03 §5.1 | Direct event lookup (API-1002 status poll) |
| `import_events_active_unique` | B-tree (PARTIAL UNIQUE) | `(initiated_by)` | `status IN ('UPLOAD_READY', 'VALIDATING', 'PROCESSING')` | DB-05 §9.1 | One-at-a-time migration enforcement (DB-R-09) |
| `idx_import_events_status` | B-tree | `(status, created_at DESC)` | — | DB-05 §3.3 | Migration dashboard: list by status; monitoring active import |
| `idx_import_events_initiated_by` | B-tree | `(initiated_by, created_at DESC)` | — | DB-05 §3.3 | User's migration history (API-1001 history view) |

**Table: `migration.migration_row_events`**

| Index Name | Type | Columns | Predicate | Source | Query Pattern |
|---|---|---|---|---|---|
| `migration_row_events_pkey` | B-tree (PK) | `row_event_id` | — | DB-05 §5.2 | Direct row event lookup |
| `idx_migration_row_events_import` | B-tree | `(import_event_id, row_number)` | — | DB-05 §5.2 | All row events for an import (API-1003 report assembly) |
| `idx_migration_row_events_failed` | B-tree (PARTIAL) | `import_event_id` | `outcome = 'FAILED'` | DB-05 §5.2 | Failed rows summary in report (API-1003) |

---

## 3. Query Pattern → Index Traceability

### 3.1 Group 1: Pages & Tags

| API | Operation | Index(es) Used | Verdict |
|---|---|---|---|
| API-0101 Create Page | INSERT `registry.pages` | PK | ✅ |
| API-0102 Create Tag | INSERT `registry.tags`, `content.english_copies`, `translation.translations` (batch) | PKs; `idx_languages_active` for language list | ✅ |
| API-0103 List Pages | SELECT `registry.pages WHERE status='ACTIVE'` | `idx_pages_status_active` | ✅ |
| API-0104 Get Page Detail | SELECT `registry.pages` + tags | `pages_pkey`, `idx_tags_page_id` | ✅ |
| API-0105 Get Tag Detail | SELECT `registry.tags` + JOIN `english_copies`, `translations` | `tags_pkey`, `english_copies_pkey`, `translations_pkey` | ✅ |
| API-0106 Update Page Metadata | UPDATE `registry.pages` | `pages_pkey` | ✅ |
| API-0107 Deprecate Tag | UPDATE `registry.tags`; COUNT remaining active; possibly UPDATE `registry.pages` | `tags_pkey`, `idx_tags_page_id_active` (COUNT) | ✅ |
| API-0108 Update Tag Metadata | UPDATE `registry.tags` | `tags_pkey` | ✅ |

### 3.2 Group 2: English Copy

| API | Operation | Index(es) Used | Verdict |
|---|---|---|---|
| API-0201 Save Draft | INSERT or UPDATE `english_copy_versions`; UPDATE `english_copies` | `english_copies_pkey` (SFU), `english_copy_versions_pkey` | ✅ |
| API-0202 Submit for Review | UPDATE `english_copy_versions` status; UPDATE `english_copies` | `english_copies_pkey`, `english_copy_versions_pkey` | ✅ |
| API-0203 Reviewer Actions | SFU on `english_copies`; UPDATE `english_copy_versions` ×2; bulk UPDATE `translations` to STALE | `english_copies_pkey`, `english_copy_versions_approved_unique`, `idx_translations_tag_id` | ✅ |
| API-0204 List Versions | SELECT `english_copy_versions WHERE tag_id=$1` | `idx_english_copy_versions_tag_id_desc` | ✅ |

### 3.3 Group 3: Translation Management

| API | Operation | Index(es) Used | Verdict |
|---|---|---|---|
| API-0301 AI Single Translate | SFU on `translations`; INSERT `translation_versions`; UPDATE `translations` | `translations_pkey`, `translation_versions_pkey` | ✅ |
| API-0302 AI Bulk Translate | SELECT NO_TRANSLATION slots; batch INSERT TVs; batch UPDATE translations | `idx_tags_page_id_active`, `translations_pkey`, `idx_translations_no_translation` | ✅ |
| API-0303 Manual Edit | INSERT `translation_versions`; UPDATE `translations` | `translations_pkey` (SFU), `translation_versions_pkey` | ✅ |
| API-0304 Reviewer Actions | UPDATE `translations`; INSERT `translation_versions` (for EDIT_AND_APPROVE, REQUEST_RETRANSLATION); UPDATE prior APPROVED TV → SUPERSEDED | `translations_pkey` (SFU), `idx_translation_versions_approved`, `translation_versions_pkey` | ✅ |
| API-0305 Bulk Approve | SELECT pending TVs with confidence score; batch UPDATE `translations` and `translation_versions` | `idx_translation_versions_approved` + filtered scan on `translation_versions` | ✅ |
| API-0306 Resolve Stale | SFU on `translations`; INSERT `translation_versions`; UPDATE `translations` (clear stale fields) | `translations_pkey` (SFU), `translation_versions_pkey` | ✅ |
| API-0307 Retranslate Stale | Same as API-0301 but restricted to STALE translations | `translations_pkey` (SFU) | ✅ |
| API-0308 List Translation Versions | SELECT `translation_versions WHERE (tag_id, language_code)=$1` | `idx_translation_versions_tag_lang_desc` | ✅ |
| API-0309 Submit for Review | UPDATE `translation_versions` status; UPDATE `translations` | `translations_pkey` (SFU), `translation_versions_pkey` | ✅ |

### 3.4 Group 4: Publishing & Deployment

| API | Operation | Index(es) Used | Verdict |
|---|---|---|---|
| API-0401 Get Environment Status | SELECT most recent SUCCESSFUL release per scope | `idx_releases_scope_successful` | ✅ |
| API-0402 Get Page Language Bundle | SELECT all APPROVED TVs for (page, language) + current deployment | `idx_tags_page_id_active`, `idx_translation_versions_approved`, `idx_releases_scope_successful` | ✅ |
| API-0403 Request Publishing Approval | CHECK pending PAR (partial unique); INSERT PAR | `par_pending_unique` | ✅ |
| API-0404 Decide on PAR | SFU on PAR; recompute hash; UPDATE PAR; INSERT Release | `publishing_approval_requests_pkey` (SFU), `releases_in_flight_unique` | ✅ |
| API-0405 Execute Publish | INSERT `release_content_snapshots`; UPDATE `releases` status | `release_content_snapshots_pkey`, `releases_pkey` | ✅ |
| API-0406 Deployment History | SELECT `releases` by scope ordered by deployment_version DESC | `idx_releases_scope_history` | ✅ |
| API-0407 Rollback | SELECT SUCCESSFUL target; INSERT ROLLBACK release; UPDATE prior release → ROLLED_BACK | `idx_releases_scope_successful`, `releases_in_flight_unique`, `releases_pkey` | ✅ |

### 3.5 Group 5: System-Triggered Operations

| API | Operation | Index(es) Used | Verdict |
|---|---|---|---|
| API-0501 Flag Stale | SELECT all `translations WHERE tag_id=$1`; batch UPDATE to STALE | `idx_translations_tag_id` | ✅ |
| API-0502 Implicit DEV Publish | Evaluate conditions; INSERT Release | `english_copies_pkey`, `idx_translation_versions_approved`, `idx_releases_scope_successful`, `releases_in_flight_unique` | ✅ |
| API-0503 Recalculate Coverage | Multi-CTE aggregation query; UPDATE `coverage_metrics` | `idx_tags_page_id_active`, `idx_releases_scope_successful`, `release_content_snapshots_pkey`, `idx_translations_language_code` | ✅ |
| API-0504 Dispatch Notifications | SELECT targeting criteria by role; INSERT `notifications` per recipient | `idx_user_role_assignments_role_active` | ✅ |
| API-0506 New Language Slot Creation | SELECT all ACTIVE tags; batch INSERT `translation.translations` | `idx_tags_active` | ✅ |

### 3.6 Group 6: Visibility & Reporting

| API | Operation | Index(es) Used | Verdict |
|---|---|---|---|
| API-0601 Coverage Dashboard | SELECT `reporting.coverage_metrics WHERE page_id=$1` | `coverage_metrics_pkey` (leading-column scan) | ✅ |
| API-0602 Language Coverage Detail | SELECT `reporting.coverage_metrics WHERE (page_id, language_code)=$1` | `coverage_metrics_pkey` | ✅ |
| API-0603 Stale Translations Report | SELECT `translations WHERE status='STALE'` per language | `idx_translations_stale` | ✅ |
| API-0604 Pending Work Summary | COUNT across `english_copies`, `translations` per status | `idx_english_copies_status_no_copy`, `idx_translations_no_translation`, `idx_translations_pending_review` | ✅ |
| API-0605 Activity Timeline | SELECT `audit_records` with filters | `idx_audit_performed_at`, `idx_audit_subject`, `idx_audit_user`, `idx_audit_action` | ✅ |
| API-0606 Review Queue | Multi-branch: PENDING_REVIEW on english_copies, translations, and PARs | `idx_english_copies_status_pending`, `idx_translations_pending_review`, `idx_par_pending` | ✅ |
| API-0607 Tag Language Status Grid | SELECT `translations` for page (via tag JOIN); GROUP BY language | `idx_tags_page_id_active`, `idx_translations_language_code` | ✅ |

### 3.7 Group 7: Search & Navigation

| API | Operation | Index(es) Used | Verdict |
|---|---|---|---|
| API-0701 Global Search | 3-branch UNION: tag FTS, page FTS, English copy FTS | `idx_tags_search_vector`, `idx_pages_search_vector` [P1-01 — missing], `idx_english_copy_versions_search_vector` | ⚠️ [P1-01] |
| API-0702 Create Bookmark | INSERT OR CONFLICT UPDATE `search.bookmarks` | `bookmarks_user_target_unique` | ✅ |
| API-0703 Get Bookmarks | SELECT `search.bookmarks WHERE user_id=$1` | `idx_bookmarks_user_id` | ✅ |
| API-0704 Remove Bookmark | DELETE `search.bookmarks WHERE bookmark_id=$1` | `bookmarks_pkey` | ✅ |
| API-0705 Recently Edited | SELECT `system_ops.audit_records WHERE performed_by_user_id=$1` (write events) | `idx_audit_user` | ✅ |
| API-0706 Recently Viewed | SELECT `search.recently_edited_events WHERE user_id=$1` | `idx_recently_edited_user_recent` | ✅ |

### 3.8 Group 8: Administration

| API | Operation | Index(es) Used | Verdict |
|---|---|---|---|
| API-0801 List Users / Roles | SELECT `admin.users`, `admin.user_role_assignments` | `users_pkey`, `idx_user_role_assignments_user_id` | ✅ |
| API-0802 Add Language | INSERT `admin.languages`; INSERT `translation.translations` batch | `languages_pkey`, `idx_tags_active` | ✅ |
| API-0803 Activate / Deactivate Language | UPDATE `admin.languages`; UPDATE `reporting.coverage_metrics` (batch STALE) | `languages_pkey`, `idx_coverage_language` [P2-03 — missing] | ⚠️ [P2-03] |
| API-0804 Grant / Revoke Role | SFU on `user_role_assignments`; INSERT or UPDATE | `user_role_assignments_active_unique`, `idx_user_role_assignments_user_active` | ✅ |
| API-0805 Get System Configuration | SELECT `admin.system_configuration WHERE config_key=$1` | `system_configuration_pkey` | ✅ |
| API-0806 Create / Deprovision User | INSERT or UPDATE `admin.users` | `users_pkey`, `users_email_unique` | ✅ |
| API-0807 Update System Configuration | UPDATE `admin.system_configuration WHERE config_key=$1` | `system_configuration_pkey` | ✅ |

### 3.9 Group 9: Comments, Audit & Export

| API | Operation | Index(es) Used | Verdict |
|---|---|---|---|
| API-0901 Post Comment | INSERT `collaboration.comments` | `comments_pkey` | ✅ |
| API-0902 Get Comments | SELECT `collaboration.comments WHERE tag_id=$1` (with optional scope filter) | `idx_comments_tag_id`, `idx_comments_tag_scope` | ✅ |
| API-0903 Resolve Comment | UPDATE `collaboration.comments` | `comments_pkey` | ✅ |
| API-0904 Get Audit Trail | SELECT `system_ops.audit_records` with filters | `idx_audit_performed_at`, `idx_audit_subject`, `idx_audit_user`, `idx_audit_action` | ✅ |
| API-0905 Export (Create / Poll / Download) | INSERT `collaboration.export_jobs`; SELECT for poll; generate file; soft-expire | `export_jobs_pkey`, `idx_export_jobs_requested_by` | ✅ |
| API-0906 Get Notifications | SELECT `system_ops.notifications WHERE recipient_user_id=$1` | `idx_notifications_user_unread`, `idx_notifications_user_all` | ✅ |
| API-0907 Mark Notification Read | UPDATE `system_ops.notifications` | `notifications_pkey` | ✅ |

### 3.10 Group 10: Migration

| API | Operation | Index(es) Used | Verdict |
|---|---|---|---|
| API-1001 Upload Migration File | INSERT `migration.import_events`; check no active import in progress | `import_events_active_unique` | ✅ |
| API-1002 Execute Migration | UPDATE `migration.import_events` status; per-page SERIALIZABLE transactions (INSERT pages, tags, ECVs, TVs, releases, snapshots) | `import_events_pkey`, PKs on all entity tables | ✅ |
| API-1003 Generate Report | SELECT `migration.import_events`; SELECT `migration.migration_row_events` | `import_events_pkey`, `idx_migration_row_events_import`, `idx_migration_row_events_failed` | ✅ |

---

## 4. Index Redundancy Audit

| Table | Index A | Index B | Analysis | Recommendation |
|---|---|---|---|---|
| `registry.tags` | `idx_tags_page_id (page_id, tag_id)` | `idx_tags_page_id_active (page_id) PARTIAL` | A covers ordered full tag list. B is more selective for active-only queries. Different query shapes. | **Keep both.** |
| `publishing.releases` | `idx_releases_scope_successful PARTIAL` | `idx_releases_scope_history` (full) | Both share the same leading columns. Planner correctly uses the partial for SUCCESSFUL-filtered queries. Full index needed for all-status history (API-0406). | **Keep both.** |
| `admin.user_role_assignments` | `idx_user_role_assignments_user_active PARTIAL(user_id)` | `idx_user_role_assignments_user_id (user_id, assigned_at DESC)` | A covers active-role RBAC (cannot substitute B — B returns revoked entries). B covers full history. | **Keep both.** |
| `system_ops.notifications` | `idx_notifications_user_unread PARTIAL` | `idx_notifications_user_all` | Partial index significantly reduces I/O for the most common query (inbox view). Full index needed for `status=all` filter. | **Keep both.** |
| `content.english_copies` | `idx_english_copies_status_pending PARTIAL(tag_id)` | `idx_english_copies_status (status)` | Partial index for review queue (join-friendly, returns tag_ids). Status index for aggregation across all statuses. | **Keep both.** |

**Conclusion:** No indexes are identified as purely redundant. All defined indexes serve distinct and documented query patterns.

---

## 5. Concurrency & Locking Validation

### 5.1 ETag / Optimistic Locking Coverage

| Table | `etag_version` | APIs That Enforce ETag | Risk If Missed |
|---|---|---|---|
| `content.english_copies` | ✅ | API-0201, API-0202, API-0203 | Concurrent review overwrite — one reviewer's action silently clobbers another's |
| `translation.translations` | ✅ | API-0303, API-0304, API-0305, API-0306, API-0307, API-0309 | Concurrent translation save overwrite; concurrent stale flagging from Group 5 |
| `publishing.publishing_approval_requests` | ✅ | API-0404 | Concurrent approve + reject both succeeding |
| `migration.import_events` | ✅ | API-1002 | Concurrent execution attempt after first execution begins |

**ETag increment trigger coverage:** All four tables have `increment_etag()` BEFORE UPDATE trigger applied (DB-02 §10). The trigger fires on every UPDATE unconditionally.

> **P0 Finding [P0-01]: Group 5 stale flagging (API-0501) must implement retry on ETag mismatch.**  
> When a concurrent Group 3 writer commits first, the stale flagging UPDATE will find a changed ETag. If it does not retry, the translation will not be flagged STALE — a silent correctness failure. The translation appears as APPROVED against an outdated English copy.  
> **Action:** API-0501 implementation must implement a bounded retry loop (3 attempts, exponential backoff) before logging a permanent audit failure.

### 5.2 SELECT FOR UPDATE Coverage

| Workflow | Table Locked | Why |
|---|---|---|
| EC Version creation (API-0201) | `content.english_copies` | Prevents two concurrent drafts assigning same version number |
| EC Approval (API-0203) | `content.english_copies` | Prevents concurrent approve and submit racing |
| EC Approval — prior version supersede | `content.english_copy_versions WHERE status='APPROVED'` | Prevents concurrent approval of two versions |
| Translation write operations (API-0303, 0304, 0306, 0307, 0309) | `translation.translations` | Prevents concurrent manual edit and AI retranslation |
| Stale flagging (API-0501) | `translation.translations` (each row) | Prevents stale flag racing with Group 3 approval |
| PAR decision (API-0404) | `publishing.publishing_approval_requests` | Prevents two concurrent decisions on same PAR |
| Deployment version assignment (API-0404, API-0502, API-0407) | `publishing.releases` (latest row for scope) | `SELECT MAX(deployment_version) FOR UPDATE` |
| Tag deprecation (API-0107) | `registry.tags` | Prevents concurrent deprecation operations on same tag |
| Migration status transitions (API-1002) | `migration.import_events` | Prevents double-execution |

All workflows above have their `SELECT FOR UPDATE` documented in the transaction boundary analysis (DB-02 §12).

### 5.3 SERIALIZABLE Isolation Scope

The following transactions **must** run at `SERIALIZABLE` isolation level (per DB-01 §12.2):

| Transaction | Why SERIALIZABLE |
|---|---|
| Tag Creation (API-0102) | Language list snapshot must be stable during slot creation |
| EC Approval → Stale Cascade (API-0203 APPROVE) | Prior APPROVED version must be uniquely identified and superseded atomically |
| Translation Approval → DEV Publish (API-0304 + API-0502) | Approval result and publish trigger must be an atomic decision |
| PAR Approval → Release Creation (API-0404) | Hash check and release creation must be atomic |
| Rollback Release Creation (API-0407) | Two-release mutation must be atomic |
| Migration Per-Page Import (API-1002) | All entities for a page must be created atomically |
| Tag Deprecation with Page Cascade (API-0107) | Cascade decision (remaining active count) must be atomically consistent |

> **Observation:** At v1 scale with ≤ 10 concurrent users, SERIALIZABLE transactions are practically equivalent to REPEATABLE READ. The overhead of PostgreSQL SSI is negligible at this concurrency level.

### 5.4 Race Condition Analysis: Critical Paths

**Race 1: Concurrent EC Approval and Translation Review**

Both read `translation.translations` and attempt to write `status`. The `etag_version` increment on the first commit causes the second to fail its ETag check. The second transaction must retry, re-reading the new translation status (now STALE). Translation reviewer action on a STALE translation is a 409 application-layer validation failure.

**Resolution:** Correct. ETag + SERIALIZABLE prevents silent clobber. Application must surface 409 to the reviewer.

---

**Race 2: Concurrent PAR Approve and PAR Expire**

If the expiry job wins, the human approver gets a 409 (PAR already EXPIRED). If the human approver wins, the expiry job's UPDATE affects 0 rows (it checks `WHERE status = 'PENDING'` which is no longer true).

**Resolution:** Correct. Both paths are safe.

---

**Race 3: Concurrent Translation Save and Stale Flagging (API-0303 + API-0501)**

One transaction acquires the SFU lock; the other waits. The first commits; the second re-reads the new ETag and fails → retry. Application retry logic required.

> **P0 Finding [P0-02]: Application must implement retry on ETag mismatch for all concurrent translation domain writers.**  
> All API-0303, API-0304, API-0305, API-0306, API-0307, API-0309 implementations must surface 409 ETag conflict and prompt users to refresh. API-0501 must retry silently (bounded retry loop). A silent failure on ETag collision leaves data in an inconsistent state.

### 5.5 Cross-Domain Write: Group 5 → Translation

The cross-domain write from API-0501 into `translation.translations` is the only accepted non-Group-3 write to the translation domain (DB-02 §5.1, ED-03 §4.2).

**Validation checklist:**

- [x] The write only touches `stale_*` columns and `status` — not `translation.translation_versions`
- [x] The ETag increment trigger fires on UPDATE → concurrent Group 3 writers will see a changed ETag
- [x] The write is within a SERIALIZABLE transaction
- [x] The transaction includes an audit record INSERT for `TRANSLATIONS_STALE_FLAGGED`
- [x] The stale cascade uses `WHERE status NOT IN ('NO_TRANSLATION', 'STALE')` — does not re-flag already-stale rows unless double-change
- [x] Double-change scenario: only `stale_triggered_by_english_ver` and `stale_current_english_text` are updated in-place; `stale_previous_english_text` is NOT updated (original prior text preserved)

---

## 6. Transaction Boundary Verification

### 6.1 Tag Creation (API-0102)

**Isolation:** SERIALIZABLE

| Step | Operation | Correctness |
|---|---|---|
| 1 | INSERT `registry.tags` | tag_id prefix CHECK enforced at INSERT ✅ |
| 2 | INSERT `content.english_copies (status='NO_COPY')` | 1:1 with tag; created simultaneously ✅ |
| 3 | SELECT active languages (within same SERIALIZABLE tx) | Language list stable for duration of transaction ✅ |
| 4 | Batch INSERT `translation.translations (status='NO_TRANSLATION')` per active language | FK to tags and languages; compound PK prevents duplicates ✅ |
| 5 | INSERT audit record | Within same transaction; rollback on failure ✅ |

**Edge case — new language added concurrently:** A concurrent API-0802 that activates a new language after Step 3 will miss the new language. This gap is filled by API-0802/API-0506 slot creation using `ON CONFLICT DO NOTHING`. Tag creation side does not need to handle this.

### 6.2 English Copy Approval → Stale Cascade (API-0203 APPROVE)

**Isolation:** SERIALIZABLE

| Step | Operation | Why This Order |
|---|---|---|
| 1 | `SELECT FOR UPDATE` on `english_copies` with ETag check | Acquires row lock; prevents concurrent EC operations |
| 2 | `SELECT FOR UPDATE` on `english_copy_versions WHERE status='APPROVED'` | Identifies current APPROVED version to be SUPERSEDED |
| 3 | UPDATE prior APPROVED → SUPERSEDED | Must happen BEFORE Step 4 |
| 4 | UPDATE current version → APPROVED | Partial unique index enforces Step 3 must precede this |
| 5 | UPDATE `english_copies`: `status='APPROVED'`, `current_version_number=$new` | Live state updated after history |
| 6 | (If text changed) Batch UPDATE `translations SET status='STALE'` | Stale cascade within same transaction |
| 7 | INSERT audit record | Within same transaction |

**Critical enforcement:** If Step 4 is attempted before Step 3, the partial unique index `english_copy_versions_approved_unique` rejects Step 4 with a unique violation. The index is the database-level safeguard for correct ordering.

### 6.3 Translation Approval → Implicit DEV Publish (API-0304 + API-0502)

**Phase A — Translation Approval (SERIALIZABLE):**

1. `SELECT FOR UPDATE` on `translation.translations` with ETag check
2. UPDATE `translations SET status='APPROVED'` (no new TV created — ED-02 §7.2)
3. UPDATE prior APPROVED TV → SUPERSEDED (via `idx_translation_versions_approved`)
4. INSERT audit record

**Phase B — DEV Publish eligibility (separate SERIALIZABLE transaction, async post-commit):**

All conditions are evaluated in a fresh SERIALIZABLE transaction. If a concurrent transaction already inserted an in-flight release before this INSERT, the `releases_in_flight_unique` unique constraint violation causes a rollback. Application handles this as "already in progress" — not an error.

### 6.4 PAR Approval → Release Creation (API-0404 APPROVE)

**Isolation:** SERIALIZABLE

1. `SELECT FOR UPDATE` on PAR with `status='PENDING'` and ETag check
2. Recompute bundle hash; compare with `par.bundle_snapshot_hash` → if mismatch: UPDATE PAR → CANCELLED; COMMIT; return 409
3. UPDATE PAR → APPROVED
4. `SELECT MAX(deployment_version) FOR UPDATE` on scope
5. INSERT `releases (deployment_version = max+1, status='PENDING')`
6. INSERT audit record

**Hash mismatch handling:** The CANCELLED PAR is committed before the 409 is returned. This is correct — the CANCELLED status is a permanent governance record.

### 6.5 Rollback Release Creation (API-0407)

**Isolation:** SERIALIZABLE

1. SELECT most recent SUCCESSFUL release for scope (`idx_releases_scope_successful`)
2. SELECT content snapshot from target prior release (`release_content_snapshots_pkey` leading-column scan)
3. `SELECT MAX(deployment_version) FOR UPDATE`
4. INSERT new ROLLBACK release (`releases_in_flight_unique` enforces no concurrent in-flight)
5. COMMIT; execute Language Services call (async, outside transaction)
6. On Language Services success: BEGIN new transaction; INSERT `release_content_snapshots`; UPDATE new Release → SUCCESSFUL; UPDATE prior release → ROLLED_BACK; INSERT audit; COMMIT

**Trigger validation:** `publishing.validate_release_update()` permits `SUCCESSFUL → ROLLED_BACK` transition. All other transitions from SUCCESSFUL are rejected. ✅

### 6.6 Migration Import — Per-Page Batch (API-1002)

**Isolation:** SERIALIZABLE per page

**Key correctness requirement:** `source_english_version` FK on `translation_versions` is `DEFERRABLE INITIALLY DEFERRED`. EC v1 and TV v1 are inserted in the same transaction — the FK is checked at COMMIT, not at INSERT time. EC v1 is inserted before TV v1 (step 2c before step 2d), so the FK is satisfied when COMMIT fires.

**Concurrent migration prevention:** `import_events_active_unique` (PARTIAL UNIQUE on `status IN ('UPLOAD_READY', 'VALIDATING', 'PROCESSING')`) prevents two concurrent active migrations. API-1002 checks this constraint before beginning processing.

### 6.7 Tag Deprecation → Page Cascade (API-0107)

**Isolation:** SERIALIZABLE

1. `SELECT FOR UPDATE` on `registry.tags WHERE tag_id=$1`
2. UPDATE `registry.tags SET status='DEPRECATED'`
3. `SELECT COUNT(*) FROM registry.tags WHERE page_id=$page AND status='ACTIVE'`
4. If 0 active tags remain: UPDATE `registry.pages SET status='DEPRECATED'`
5. INSERT audit record(s)

**Race condition with concurrent tag creation:** SERIALIZABLE isolation ensures that either: (a) this deprecation transaction sees the new tag (count > 0, no cascade), or (b) the tag creation transaction runs after the deprecation commits (new tag on a deprecated page — rejected at API validation layer by `page.status = 'ACTIVE'` check).

---

## 7. Performance & Scale Assessment

### 7.1 Table Size Projections (v1 Scale)

| Table | Rows at Launch | Growth Rate | Size in 12 Months |
|---|---|---|---|
| `registry.pages` | ~89 | ~5/month | ~150 |
| `registry.tags` | ~4,450 | ~250/month | ~7,450 |
| `content.english_copies` | ~4,450 | ~250/month | ~7,450 |
| `content.english_copy_versions` | ~4,450 | ~500/month | ~10,450 |
| `translation.translations` | ~35,600 | ~2,000/month | ~59,600 |
| `translation.translation_versions` | ~35,600 | ~4,000/month | ~83,600 |
| `publishing.releases` | ~89 | ~100/month | ~1,289 |
| `publishing.release_content_snapshots` | ~35,600 | ~4,450/month | ~88,600 |
| `publishing.publishing_approval_requests` | ~0 | ~50/month | ~600 |
| `system_ops.audit_records` | ~100,000 (migration) | ~10,000/month | ~220,000 |
| `system_ops.notifications` | ~0 | ~5,000/month | ~60,000 |
| `reporting.coverage_metrics` | ~712 | ~40/month | ~1,192 |
| `search.bookmarks` | ~0 | ~100/month | ~1,200 |
| `search.recently_edited_events` | ~0 | ~200/month | ~2,400 (steady state, TTL-capped) |
| `migration.import_events` | 1 | < 1/year | 1–3 |
| `collaboration.comments` | ~0 | ~500/month | ~6,000 |

**Assessment:** All tables are well within single-node PostgreSQL's comfortable operating range. The largest tables after 12 months are `translation.translation_versions` (~83,600 rows) and `publishing.release_content_snapshots` (~88,600 rows). Both are append-only with no UPDATE-induced table bloat. No partitioning, sharding, or external storage is required at v1 scale.

### 7.2 Index Cardinality Analysis

| Table | Index | Estimated Cardinality | Selectivity |
|---|---|---|---|
| `registry.tags` | `idx_tags_page_id_active` | ~50 rows per page_id | High (50/7,450 = 0.7%) ✅ |
| `content.english_copies` | `idx_english_copies_status_pending` | ~50–200 rows system-wide | High ✅ |
| `translation.translations` | `idx_translations_tag_id` | ~8 rows per tag_id | High ✅ |
| `translation.translations` | `idx_translations_stale` | ~100–500 rows system-wide | High ✅ |
| `translation.translation_versions` | `idx_translation_versions_approved` | ~1 row per (tag, language) | Extremely selective ✅ |
| `publishing.releases` | `idx_releases_scope_successful` | ~1 row per scope | Extremely selective ✅ |
| `system_ops.audit_records` | `idx_audit_subject` | ~10–100 rows per entity | Moderate-high ✅ |

All indexes have appropriate selectivity for their intended query patterns.

### 7.3 Hot-Path Query Analysis

**Hot Path 1: RBAC check (every authenticated request)**

```sql
SELECT role FROM admin.user_role_assignments
WHERE user_id = $1 AND revoked_at IS NULL;
```

Index: `idx_user_role_assignments_user_active` (PARTIAL). Expected: single index scan, 1–5 rows. **Sub-millisecond.** ✅

---

**Hot Path 2: English Copy status check before translation operations**

```sql
SELECT status, current_version_number FROM content.english_copies WHERE tag_id = $1;
```

Index: `english_copies_pkey` (PK). Expected: single-row PK lookup. **Sub-millisecond.** ✅

---

**Hot Path 3: Stale cascade — find all translations for a tag**

```sql
UPDATE translation.translations SET status='STALE', ...
WHERE tag_id = $1 AND status NOT IN ('NO_TRANSLATION', 'STALE');
```

Index: `idx_translations_tag_id`. Expected: index scan returning 8 rows, filtered inline. **< 5ms including UPDATE.** ✅

---

**Hot Path 4: Publishing bundle construction**

```sql
SELECT tv.tag_id, tv.language_code, tv.text
FROM translation.translation_versions tv
JOIN registry.tags t ON t.tag_id = tv.tag_id
WHERE t.page_id = $1 AND tv.language_code = $2 AND tv.status = 'APPROVED' AND t.status = 'ACTIVE';
```

Indexes: `idx_tags_page_id_active` + `idx_translation_versions_approved`. Expected: index scan on ~50 active tags, nested loop join to approved TVs. **< 20ms for 50 tags.** ✅

---

**Hot Path 5: Coverage computation per cell**

The multi-CTE query (DB-04 §2.3) joins across 4 tables. At 50 tags per page: **~50ms per cell**. Total full rebuild: 712 cells × 50ms = ~36 seconds — acceptable for a background maintenance job. Event-driven incremental recompute of a single cell: ~50ms — acceptable for async post-commit processing. ✅

---

**Hot Path 6: Review queue construction (API-0606)**

Three index scans on partial indexes returning 0–50 rows each. **< 30ms.** ✅

### 7.4 N+1 Query Vulnerability Audit

| API | N+1 Risk | Required Pattern |
|---|---|---|
| API-0104 Get Page Detail (tags list) | Fetching EC status per tag in a loop | JOIN `english_copies` in the tags query, not a per-tag loop |
| API-0402 Get Bundle (all approved TVs for page) | Fetching TV per tag in a loop | JOIN `translation_versions` in a single query |
| API-0607 Tag Language Status Grid | Fetching translation status per (tag × language) in a loop | JOIN `translations` in a single query, pivot in application layer |
| API-0302 AI Bulk Translate (response) | Fetching created TVs per tag after bulk insert | Use RETURNING clause on batch INSERT |
| API-0606 Review Queue | Fetching user details per reviewer in a loop | JOIN `admin.users` in each branch query |

> **Finding [P2-05]: Application must use batch/JOIN patterns for list APIs.**  
> The schema design supports efficient batch queries for all multi-entity list endpoints. Per-row queries are a P2 implementation concern — the indexes exist to make batch queries fast, but the application code must use them correctly.

### 7.5 Bulk Operation Performance

**Language slot creation (API-0506 / API-0802):** ~4,450 `translation.translations` INSERTs for a new language. Strategy: batches of 1,000 rows, COMMIT between batches (DB-01 §21.4). Total estimated time: **~500ms.** ✅

**Migration import (API-1002):** ~89 pages, ~50 tags per page. Per-page: ~3,800 row inserts. At ~5ms per INSERT (with index maintenance): ~19 seconds per page.

> **Finding [P3-01]: Migration per-page transaction time should be benchmarked.**  
> 89 pages × 19 seconds = ~28 minutes total migration time. Acceptable for a one-time internal operation. Progress bar in the migration UI (API-1002 status polling) mitigates the UX concern. Not a blocker.

### 7.6 What Does Not Need Optimization at v1

| Topic | Why Not Needed Now |
|---|---|
| Redis cache for system configuration | `admin.system_configuration` has < 20 rows. PK lookup < 1ms. Caching adds complexity for negligible benefit. |
| Partitioning of `audit_records` | Max 220,000 rows after 12 months. PostgreSQL handles comfortably without partitioning. Partition when rows exceed ~10 million. |
| Partitioning of `translation_versions` or `release_content_snapshots` | Max ~83,600 and ~88,600 rows after 12 months respectively. No partitioning needed. |
| Connection pooling (PgBouncer) | At 15 users, max ~20 concurrent connections. Native PostgreSQL connection handling adequate. Add before scaling beyond 50 users. |
| Materialized views for coverage | Event-driven incremental update on a 712-row denormalized table is faster and simpler than PostgreSQL REFRESH MATERIALIZED VIEW. |
| External full-text search (Elasticsearch) | At 4,450 tags and 89 pages, PostgreSQL native GIN FTS is fully adequate. Elasticsearch introduces operational complexity for no benefit at this scale. |
| `VACUUM ANALYZE` scheduling | `autovacuum` handles the table sizes at v1. Manual VACUUM ANALYZE only needed post-migration import (single, known event). |
| Read replica routing | All queries run in < 50ms on primary. Read replica is provisioned for safety but reporting load does not require it at 15 users. |

---

## 8. Implementation Readiness Report (P0–P3)

### P0 Findings — Block Production Deployment

| ID | Component | Finding | Required Action |
|---|---|---|---|
| P0-01 | API-0501 implementation | Group 5 stale flagging does not have documented retry on ETag mismatch — silent failure would leave translations un-flagged | Implement bounded retry loop (3 attempts, exponential backoff) in API-0501 stale flagging service |
| P0-02 | All translation domain writers | ETag mismatch retry semantics not formally specified — concurrent writers may silently fail | All API-0303, API-0304, API-0305, API-0306, API-0307, API-0309 must surface 409 to user; API-0501 must retry silently |

### P1 Findings — Block Load Testing

| ID | Table | Finding | Required Action |
|---|---|---|---|
| P1-01 | `registry.pages` | Missing GIN index on `search_vector` — API-0701 page-name search would do a sequential scan | `CREATE INDEX idx_pages_search_vector ON registry.pages USING GIN (search_vector);` |
| P1-02 | `publishing.releases` | `MAX() + 1` deployment version assignment must be protected by unique constraint retry in the application layer — unique violation on concurrent INSERT must be handled | Document and implement unique constraint violation retry for deployment version assignment in the Release creation service |

### P2 Findings — Resolve Before GA

| ID | Table | Finding | Required Action |
|---|---|---|---|
| P2-01 | `content.english_copy_versions` | FTS index covers all versions, not just APPROVED; API-0701 may return results for superseded/rejected English copy text | Implement approved-only FTS via partial GIN index or maintained approved text column on `content.english_copies` — defer to DB-07 |
| P2-02 | `publishing.releases` | `idx_releases_scope_history` and `idx_releases_scope_successful` share prefix — observation only | No action required — both indexes serve distinct query patterns |
| P2-03 | `reporting.coverage_metrics` | Missing index on `language_code` for language deactivation batch update | `CREATE INDEX idx_coverage_language ON reporting.coverage_metrics (language_code);` |
| P2-04 | `search.recently_edited_events` | Missing index on `last_accessed_at` for 30-day cleanup job | `CREATE INDEX idx_recently_edited_cleanup ON search.recently_edited_events (last_accessed_at);` |
| P2-05 | Application layer (all list APIs) | N+1 query patterns must be avoided; batch JOIN patterns required for API-0104, API-0402, API-0607 | Code review requirement before GA |

### P3 Findings — Deferred Improvements

| ID | Topic | Finding | Deferred Until |
|---|---|---|---|
| P3-01 | Migration performance | Per-page migration transaction ~19s; total migration ~28 minutes | Acceptable for one-time internal operation; benchmark before migration date |
| P3-02 | Audit partitioning | `system_ops.audit_records` will need range partitioning by `performed_at` when rows exceed ~10 million | 3–5 years at current growth rate |
| P3-03 | `published_by_source` CHECK constraint | DB-02 OI-04: `published_by_source` on `releases` lacks a CHECK constraint | Add `CHECK (published_by_source IN ('USER', 'SYSTEM:AUTO_PUBLISH', 'SYSTEM:MIGRATION'))` in next schema patch |
| P3-04 | Connection pooling | PgBouncer not required at 15 users | Add before scaling beyond 50 concurrent users |
| P3-05 | GIN index FTS dictionary | English dictionary used for all FTS; product-specific terms (e.g., `quickbill`, `walkIn`) may not stem well | Consider `simple` dictionary for tag IDs; `english` for natural language text |

---

## 9. Physical Implementation Ordering

### Phase 0: Shared Infrastructure (must be first)

```sql
-- 1. Create all schemas
CREATE SCHEMA IF NOT EXISTS admin;
CREATE SCHEMA IF NOT EXISTS registry;
CREATE SCHEMA IF NOT EXISTS content;
CREATE SCHEMA IF NOT EXISTS translation;
CREATE SCHEMA IF NOT EXISTS publishing;
CREATE SCHEMA IF NOT EXISTS collaboration;
CREATE SCHEMA IF NOT EXISTS system_ops;
CREATE SCHEMA IF NOT EXISTS reporting;
CREATE SCHEMA IF NOT EXISTS search;
CREATE SCHEMA IF NOT EXISTS migration;

-- 2. Install shared trigger functions in public schema
CREATE OR REPLACE FUNCTION public.set_updated_at() ...;
CREATE OR REPLACE FUNCTION public.increment_etag() ...;
CREATE OR REPLACE FUNCTION public.raise_on_delete() ...;
CREATE OR REPLACE FUNCTION public.raise_on_update() ...;
```

### Phase 1: Foundation Tables (no FK dependencies)

```
admin.users
admin.languages
admin.system_configuration
registry.pages
```

### Phase 2: FK-Dependent Core Tables

```
admin.user_role_assignments         → admin.users
registry.tags                       → registry.pages
content.english_copies              → registry.tags
translation.translations            → registry.tags, admin.languages
```

*Apply all triggers and indexes on Phase 1 and Phase 2 tables before proceeding.*

### Phase 3: Version History Tables

```
content.english_copy_versions       → content.english_copies, admin.users
translation.translation_versions    → translation.translations, content.english_copy_versions (DEFERRED FK), admin.users
```

*The DEFERRABLE INITIALLY DEFERRED FK on `translation_versions.source_english_version` must be applied at this phase.*

### Phase 4: Publishing Tables

```
publishing.publishing_approval_requests  → registry.pages, admin.languages, admin.users
publishing.releases                      → registry.pages, admin.languages, publishing_approval_requests (DEFERRED FK), admin.users
publishing.release_content_snapshots     → publishing.releases, registry.tags
```

### Phase 5: System Operations Tables

```
system_ops.notifications            → admin.users
system_ops.audit_records            → admin.users (FK); all other references are polymorphic (no DB FK)
```

### Phase 6: Collaboration Tables

```
collaboration.comments              → registry.tags, admin.users, admin.languages
collaboration.export_jobs           → admin.users, registry.pages, admin.languages
```

### Phase 7: Derived and Navigation Tables

```
reporting.coverage_metrics          → registry.pages, admin.languages (FK); other references are application-enforced
search.bookmarks                    → admin.users; polymorphic target_id (no FK)
search.recently_edited_events       → admin.users; polymorphic target_id (no FK)
```

### Phase 8: Migration Tables

```
migration.import_events             → admin.users
migration.migration_row_events      → migration.import_events
```

### Phase 9: P1/P2 Index Additions (new indexes from this document)

```sql
-- P1-01: Page search vector GIN index
CREATE INDEX idx_pages_search_vector
    ON registry.pages USING GIN (search_vector);

-- P2-03: Coverage metrics language index
CREATE INDEX idx_coverage_language
    ON reporting.coverage_metrics (language_code);

-- P2-04: Recently-edited cleanup index
CREATE INDEX idx_recently_edited_cleanup
    ON search.recently_edited_events (last_accessed_at);
```

### Phase 10: Post-Deployment Validation Queries

```sql
-- Verify no table is missing its primary key
SELECT schemaname, tablename FROM pg_tables
WHERE schemaname IN ('admin','registry','content','translation','publishing',
                     'collaboration','system_ops','reporting','search','migration')
  AND tablename NOT IN (
    SELECT tablename FROM pg_indexes WHERE indexdef LIKE '%PRIMARY KEY%'
  );
-- Expected: 0 rows

-- Verify all PARTIAL UNIQUE indexes exist
SELECT indexname FROM pg_indexes
WHERE indexname IN (
    'user_role_assignments_active_unique',
    'english_copy_versions_approved_unique',
    'par_pending_unique',
    'releases_in_flight_unique',
    'import_events_active_unique',
    'bookmarks_user_target_unique'
);
-- Expected: 6 rows

-- Verify all raise_on_delete triggers are attached
SELECT tgname, relname FROM pg_trigger t
JOIN pg_class c ON c.oid = t.tgrelid
WHERE tgname LIKE '%no_delete%'
ORDER BY relname;
-- Expected: one trigger per permanent table

-- Verify all GIN indexes exist for FTS
SELECT indexname, tablename FROM pg_indexes
WHERE indexdef LIKE '%GIN%'
  AND schemaname IN ('registry','content');
-- Expected: idx_tags_search_vector, idx_pages_search_vector, idx_english_copy_versions_search_vector
```

---

## 10. Final Integrity Check

### 10.1 Entity-to-Table Coverage

| ED-01 Entity | Table(s) | Status |
|---|---|---|
| Page | `registry.pages` | ✅ |
| Tag | `registry.tags` | ✅ |
| English Copy (live) | `content.english_copies` | ✅ |
| English Copy Version | `content.english_copy_versions` | ✅ |
| Translation (live) | `translation.translations` | ✅ |
| Translation Version | `translation.translation_versions` | ✅ |
| Language | `admin.languages` | ✅ |
| Publishing Approval Request | `publishing.publishing_approval_requests` | ✅ |
| Release | `publishing.releases` + `publishing.release_content_snapshots` | ✅ |
| Import Event | `migration.import_events` + `migration.migration_row_events` | ✅ |
| User | `admin.users` | ✅ |
| User Role Assignment | `admin.user_role_assignments` | ✅ |
| Comment | `collaboration.comments` | ✅ |
| Audit Record | `system_ops.audit_records` | ✅ |
| Notification | `system_ops.notifications` | ✅ |
| Export Job | `collaboration.export_jobs` | ✅ |
| Coverage Metrics | `reporting.coverage_metrics` | ✅ |
| System Configuration | `admin.system_configuration` | ✅ |
| Bookmark | `search.bookmarks` | ✅ |
| Recently-Edited | `search.recently_edited_events` | ✅ |

**All 20 ED-01 entities are physically persisted. No entity is unrepresented.**

### 10.2 Invariant Enforcement Coverage

| Invariant Range | Coverage | Notes |
|---|---|---|
| XI-01 to XI-10: Identity uniqueness | ✅ DB-enforced | PK or UNIQUE constraints on all identity fields |
| XI-11 to XI-14: Language isolation | ✅ DB + App | `language_code` FK on all translation tables |
| XI-15 to XI-18: EC → TV lineage | ✅ DB | DEFERRED FK `translation_versions.source_english_version → english_copy_versions` |
| XI-19: Single APPROVED EC Version | ✅ DB | Partial UNIQUE index `WHERE status='APPROVED'` on `english_copy_versions` |
| XI-20: Single PENDING PAR per scope | ✅ DB | Partial UNIQUE index `WHERE status='PENDING'` on `publishing_approval_requests` |
| XI-21: Release requires APPROVED PAR | ✅ App | Application validates PAR status before Release creation |
| XI-22: Bundle hash match at PAR decision | ✅ App | Hash recomputed at API-0404 decision time; PAR CANCELLED on mismatch |
| XI-23 to XI-27: Release/snapshot invariants | ✅ DB + Trigger | `raise_on_update()` on snapshots; `validate_release_update()` guards all Release transitions |
| XI-28 to XI-30: Migration exceptions | ✅ DB | `creation_method CHECK` includes 'MIGRATED'; `trigger_source CHECK` includes 'MIGRATION' |
| XI-31 to XI-32: Audit invariants | ✅ DB | `raise_on_update()` and `raise_on_delete()` on `audit_records`; audit INSERT within primary transaction |
| XI-33 to XI-34: Derived model invariants | ✅ App + DB | `coverage_metrics` has `last_computed_at`; no FK from source tables to derived tables |

### 10.3 Open Item Closure Status

| Item | Source | Status |
|---|---|---|
| DB-02-OI-01: `system_ops.audit_records` definition | DB-02 | ✅ Closed — defined in DB-03 §4 |
| DB-02-OI-02: `migration.import_events` definition | DB-02 | ✅ Closed — defined in DB-03 §5 + DB-05 §3 |
| DB-02-OI-03: `reporting.coverage_metrics` definition | DB-02 | ✅ Closed — defined in DB-04 §2 |
| DB-02-OI-04: `published_by_source` CHECK constraint | DB-02 | ⚠️ Open [P3-03] — add CHECK constraint in next schema patch |
| DB-02-OI-05: FTS search approved-only vs. all versions | DB-02 | ⚠️ Open [P2-01] — architectural resolution documented; implementation deferred to DB-07 |
| DB-01 DB-R-01: tag_id prefix CHECK | DB-01 | ✅ Closed — CHECK constraint on `registry.tags` |
| DB-01 DB-R-02: tsvector search index | DB-01 | ✅ Closed — generated columns + GIN indexes defined in DB-02 |
| DB-01 DB-R-09: Concurrent migration prevention | DB-01 | ✅ Closed — `import_events_active_unique` partial UNIQUE index |
| DB-01 DB-R-10: In-flight release prevention | DB-01 | ✅ Closed — `releases_in_flight_unique` partial UNIQUE index |

### 10.4 Implementation Readiness Verdict

| Category | Status | Notes |
|---|---|---|
| Schema completeness | ✅ Complete | All 20 entities physically persisted across 10 schemas |
| Index coverage | ⚠️ 3 gaps identified | P1-01 (GIN page FTS), P2-03 (coverage language), P2-04 (recently-edited cleanup) |
| Concurrency model | ✅ Sound | ETag + SFU + SERIALIZABLE covers all concurrent write paths |
| Invariant enforcement | ✅ Complete | All XI-01–XI-34 invariants enforced at DB or App layer |
| Transaction boundaries | ✅ Verified | All 7 multi-table write workflows correctly specified and verified |
| Performance at v1 scale | ✅ Acceptable | All hot paths < 50ms; no partitioning or external services required |
| P0 application-layer gaps | ⚠️ 2 gaps | Retry logic for ETag conflicts must be implemented before go-live |
| P1 index / app gaps | ⚠️ 2 items | Missing GIN index (P1-01) and deployment version retry (P1-02) |

> [!IMPORTANT]
> **Overall verdict: Not yet production-ready. Resolve P0 and P1 findings before deployment. P2 and P3 findings may be deferred post-launch.**

---

*End of MioTranslate — DB-06: Database Implementation, Indexing & Performance Specification v1.0*

*This document closes the Database Architecture layer. The complete DB layer consists of:*  
*DB-01 — Database Architecture & Standards*  
*DB-02 — Core Transactional Schema*  
*DB-03 — History, Versioning & Audit Schema*  
*DB-04 — Reporting, Read Models & Search Schema*  
*DB-05 — Migration & Operational Storage Schema*  
*DB-06 — Database Implementation, Indexing & Performance Specification (this document)*
