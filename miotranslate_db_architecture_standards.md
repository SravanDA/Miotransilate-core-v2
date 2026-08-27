# MioTranslate — Database Architecture & Standards

**Product:** MioTranslate  
**Document Type:** Database Design — Layer 1 (Foundation)  
**Document ID:** DB-01  
**Version:** 1.0  
**Author:** Principal Database Architect + Principal Backend Architect  
**Date:** August 2026  
**Predecessors:** ED-01 v1.1, ED-02 v1.0, ED-03 v1.0

**Source Documents (all studied before authoring):**  
BRD, FRD (all sections), API List, Locked API Design Groups 1–10, ED-01, ED-02, ED-03, System Design v3, Post-Audit Resolution Walkthrough

---

> **Purpose of this document.**  
> DB-01 defines the physical persistence foundation that all subsequent MioTranslate schema documents (DB-02 through DB-09) must follow. It resolves the open design questions raised in ED-02 and ED-03, establishes the database technology and architecture, and defines every convention, standard, and constraint strategy that will govern the physical implementation.
>
> **This document does not design individual tables, indexes, columns, or SQL migrations.** Those belong in DB-02 through DB-09.

---

## Table of Contents

1. Database Technology Selection
2. Database and Schema Boundary Strategy
3. Physical Data Modeling Principles
4. Primary Key Strategy
5. Foreign Key and Referential Integrity Strategy
6. Uniqueness and Compound Identity Strategy
7. Naming Conventions
8. Timestamp and Timezone Standards
9. Enumerated Value Strategy
10. Nullability and Optionality Conventions
11. ETag and Optimistic Concurrency Strategy
12. Transaction Boundaries and Isolation Model
13. Immutability and Append-Only History Enforcement
14. Deprecation and Inactivation Strategy
15. JSON and Structured-Object Usage
16. Large Payload and Blob Handling
17. Audit Storage Principles
18. Derived and Read-Model Architecture
19. External Integration Persistence Boundaries
20. Security and Governance Principles
21. Operational Principles
22. Open Question Resolutions (OQ-1 through OQ-7)
23. Standards All Subsequent DB Documents Must Follow
24. Consistency Audit against ED-01, ED-02, ED-03, and API Groups 1–10

---

## 1. Database Technology Selection

### 1.1 Decision: PostgreSQL (Single Primary Database)

**Chosen technology:** PostgreSQL 16+

**Rationale:**

MioTranslate's data requirements are fundamentally relational with several characteristics that map precisely to PostgreSQL's strengths:

| Requirement | Why PostgreSQL Satisfies It |
|---|---|
| **Strong relational integrity** | Native foreign keys, CHECK constraints, and deferred constraint evaluation. Entity relationships established in ED-01/02/03 are all relational. |
| **Immutable history (append-only)** | Row-level security policies + application-enforced immutability + audit triggers. PostgreSQL's MVCC model is well-suited to append-heavy workloads. |
| **Transactional ACID guarantees** | Critical for English Copy approval → stale cascade → implicit DEV publish chains. The entire approval side-effect chain must be atomic. |
| **Compound primary keys and partial unique indexes** | Required for `(tagId, languageCode)` Translation identity, `(tagId, versionNumber)` version identity, `(pageId, languageCode, environment, deploymentVersion)` Release identity. |
| **JSONB support** | Required for `contentSnapshot` (Release deployment snapshot) and `apiResponsePayload` (Language Services response trace). Native JSONB with GIN indexing avoids a separate document store. |
| **Full-text search (tsvector/tsquery)** | API-0701 (Global Search) requires text search across English Copy and Tag data. PostgreSQL's built-in FTS with `tsvector` columns handles the moderate search volume (89 pages × ~50 tags = ~4,500 rows) without requiring an external search service at initial scale. |
| **Partial indexes** | Efficient for queries like "active tags only", "STALE translations only", "PENDING_REVIEW items only" — highly selective queries across small subsets. |
| **Row-level security** | Provides a database-layer enforcement point for audit record immutability and user-scoped data policies. |
| **Materialized views** | Well-suited for Coverage Metrics precomputation, which requires joining Tags, Translations, and Releases on a scheduled basis (§18). |
| **pg_stat_statements + pg_audit** | Production operational observability without additional tooling. |

**Scale context:** MioTranslate is an internal platform for a team of ~15 concurrent users. The data volume at launch is: ~89 pages, ~4,500 tags, ~8 languages, ~36,000 Translation entities, version history rows growing over time. This is a modest scale — a correctly designed PostgreSQL instance handles it trivially. Scalability concerns for this v1 are operational (uptime, backup, failover), not throughput.

**What is NOT chosen and why:**

| Alternative | Rejection Reason |
|---|---|
| **MongoDB / document store** | Entity relationships are deeply relational (ED-01, ED-02). Foreign key integrity, version lineage (`sourceEnglishVersion` joins), and transactional multi-entity mutations (approval → stale → release creation) require joins and ACID transactions, not document isolation. |
| **Separate event store (Kafka / EventStoreDB)** | Audit Records and Version History are append-only event-like records, but MioTranslate does not require event sourcing. The entity states are the source of truth, not event replays. An event store adds operational complexity with no architectural benefit at this scale. |
| **Redis as primary store** | Redis is considered as a supplementary cache only (§18). Never as primary entity storage. |
| **Multi-database splitting by domain** | Groups 1–10 are logical API domains, not independent services with separate data stores. Queries cross domain boundaries (coverage joins Tags + Translations + Releases). A single database with schema-based separation is appropriate (§2). |
| **Separate full-text search (Elasticsearch)** | The FTS requirement is modest (English Copy text, Tag IDs, Page names). PostgreSQL's built-in `tsvector` is sufficient. An external search service is a future consideration if search complexity grows. |

---

## 2. Database and Schema Boundary Strategy

### 2.1 Single Database, Multiple Schemas

MioTranslate uses a **single PostgreSQL database** partitioned into **logical schemas** aligned to the ED-03 domain classification. This provides:
- Cross-domain transactional integrity when entity mutations span domains (e.g., English approval → stale flag → audit record across Groups 2, 5)
- No network hop for cross-schema joins (Coverage computation joins tags, translations, releases)
- Schema-level namespace separation for clarity and future migration if domain decomposition is ever needed

### 2.2 Schema Map

| Schema | Domain | Tables (defined in DB-0X) |
|---|---|---|
| `registry` | Group 1 — Pages & Tags | pages, tags |
| `content` | Group 2 — English Copy | english_copies, english_copy_versions |
| `translation` | Group 3 — Translation Management | translations, translation_versions |
| `publishing` | Group 4 — Publishing & Deployment | publishing_approval_requests, releases, release_content_snapshots |
| `system_ops` | Group 5 — System-Triggered | audit_records, notifications, coverage_metrics |
| `reporting` | Group 6 — Visibility & Reporting | Materialized views and denormalized reporting tables |
| `search` | Group 7 — Search & Navigation | bookmarks, recently_edited_events, search_index (tsvector) |
| `admin` | Group 8 — Administration | languages, users, user_role_assignments, system_configuration |
| `collaboration` | Group 9 — Comments, Audit & Export | comments, export_jobs |
| `migration` | Group 10 — Migration | import_events |

### 2.3 Schema Access Rules

Each schema is the owning domain's write scope. Cross-schema writes must only occur:
- Within the same PostgreSQL transaction (e.g., English approval → audit_record in `system_ops` — one transaction)
- Through documented, bounded cross-domain writes (the one accepted cross-domain write: stale flagging on `translation.translations` by the Group 5 system process)

No schema may be used as the write target for another domain's business logic except in the explicitly documented case above.

### 2.4 Database Connection Model

| Layer | Connection Strategy |
|---|---|
| **Application/API services** | Connection pool via PgBouncer (transaction pooling mode). Each API Group's service connects to the PostgreSQL database as the same physical user but uses `SET ROLE schema_owner` or service-level role separation for schema isolation if needed. |
| **Read replicas** | One hot-standby read replica for: (a) reporting queries (Group 6), (b) audit trail queries (Group 9 API-0904), (c) global search reads. Primary handles all writes. |
| **Migration execution** | Dedicated migration connection with higher statement timeout. Never uses the pooled connection. |
| **Background jobs** | Separate worker pool (audit dispatch, notification dispatch, coverage recalculation, implicit DEV publishing). Not in the API request path. |

---

## 3. Physical Data Modeling Principles

The following principles govern every table designed in DB-02 through DB-09. No table may deviate without explicit documented justification.

### 3.1 Record Permanence

**No `DELETE` operations on business records.** Every entity documented in ED-01 is permanent. The database must enforce this.

Permanent record classes:
- All source-of-truth entities (pages, tags, english_copies, english_copy_versions, translations, translation_versions, languages, users, user_role_assignments)
- All immutable history (releases, release_content_snapshots, audit_records)
- All governance records (publishing_approval_requests, comments, notifications, import_events)

The only records for which deletion is acceptable:
- `bookmarks` (user-personal, no business state — DELETE is the correct operation for API-0704)
- `recently_edited_events` (user-personal projection — time-limited retention acceptable)
- `export_jobs` (transient — deleteable after download TTL expires or by explicit cleanup)

No application code, migration script, or database job may issue `DELETE` on any non-permitted table. Soft-delete (status field transition) is the only mechanism for any permanent record.

### 3.2 Two Physical Layers for Stateful Entities

The entities in ED-02 described as having both "live state" and "immutable version history" must be implemented as **two separate row concerns**:

| Concern | Physical Implementation | Mutability |
|---|---|---|
| **Live state** | One row per entity instance. Fields on this row that represent current operational state (status, staleInfo, updatedAt, currentVersionNumber, etagVersion) are mutable. | Mutable — updated in-place via UPDATE |
| **Version history** | One row per version event. All content/snapshot fields on version rows are written at INSERT time and never UPDATEd. | Immutable — INSERT-only |

This directly resolves ED-03 OQ-2.

**Affected tables by this principle:**

| Entity | Live State Table | Version History Table |
|---|---|---|
| English Copy | `content.english_copies` | `content.english_copy_versions` |
| Translation | `translation.translations` | `translation.translation_versions` |

**Rule:** If a field appears in both the live state table and the version table, it must have a clear, documented purpose in each context. There is no "source of truth conflict" when the purposes are different: the live state row holds current operational fields; the version row holds the immutable content snapshot at a specific point in time.

### 3.3 Distinguish Table Responsibilities

Each table must be classified in its schema header comment as one of:

| Classification | Meaning |
|---|---|
| `SOURCE_OF_TRUTH` | Authoritative record for this entity. Mutable (lifecycle transitions). Permanent. |
| `IMMUTABLE_HISTORY` | Append-only. No UPDATE after INSERT except where explicitly documented. |
| `GOVERNANCE_RECORD` | Mutable lifecycle record (status transitions). Permanent. |
| `SYSTEM_EVENT` | Written by system operations. Immutable after write. |
| `DERIVED_READ_MODEL` | Computed from source tables. Rebuilddable from scratch. |
| `USER_PERSONAL` | Per-user scoped. Not business state. Delete-permitted per §3.1 exceptions. |

### 3.4 No Orphan Records

Every dependent row must have a valid parent via a database-enforced foreign key. No application-only "soft" foreign keys. No nullable foreign keys on mandatory relationships (see §5).

---

## 4. Primary Key Strategy

### 4.1 Surrogate UUIDs for System-Generated Entities

Entities whose identity is system-assigned use **UUID v7** (time-ordered UUID, also known as UUIDv7) as the primary key.

**Why UUID v7 over UUID v4:**
- Time-ordered: B-tree indexes maintain sequential insert order, avoiding random-access index fragmentation that UUID v4 causes.
- Globally unique: safe for future cross-system references or API exposure.
- Embeds creation time: sortable without a separate `created_at` index for simple time-ordered queries.

**Tables using UUID v7 primary keys:**
`publishing_approval_requests`, `releases`, `audit_records`, `notifications`, `comments`, `export_jobs`, `import_events`, `bookmarks`

Also: `users.user_id` (system-assigned on first authentication).

### 4.2 Natural Identity for Registry Entities

Entities whose identity is externally defined or human-assigned use **natural primary keys** that enforce identity uniqueness at the database level.

| Table | Natural Primary Key | Rationale |
|---|---|---|
| `registry.pages` | `page_id VARCHAR(100)` | Developer-assigned. Externally meaningful. `QUICK`, `CUSWISH`, etc. |
| `registry.tags` | `tag_id VARCHAR(150)` | Developer-assigned. Must begin with `page_id_`. |
| `admin.languages` | `language_code VARCHAR(10)` | ISO 639-1 code. Externally standard. |
| `admin.system_configuration` | Singleton — `config_key VARCHAR(100)` (or single-row design — see §4.3) |

### 4.3 Compound Natural Keys for Dependent Entities

Entities whose identity is derived from their parents use compound natural primary keys.

| Table | Compound Primary Key | Rationale |
|---|---|---|
| `content.english_copies` | `tag_id` (FK → `registry.tags.tag_id`) | 1:1 with Tag. The Tag's identity is the EC's identity. |
| `content.english_copy_versions` | `(tag_id, version_number)` | Sequential version per tag. No gaps permitted. |
| `translation.translations` | `(tag_id, language_code)` | Unique per Tag × Language. ED-03 XI-04. |
| `translation.translation_versions` | `(tag_id, language_code, version_number)` | Sequential version per Translation. |
| `admin.user_role_assignments` | `(user_id, role, assigned_at)` — or surrogate UUID with unique constraint on `(user_id, role)` where revoked_at IS NULL | Point-in-time role history |

**Rule on version numbers:** `version_number` is a positive integer starting at 1, incrementing by 1 per new version, with no gaps. Gaps constitute a history integrity violation. The database must enforce this via a `CHECK (version_number > 0)` constraint and application-level sequential assignment. A future `GENERATED ALWAYS` or trigger may enforce strict no-gap sequencing if the application layer allows gaps (not recommended).

### 4.4 System Configuration as Singleton

`admin.system_configuration` is a singleton. Implementation options:

**Chosen approach:** Single-key-value row design with `config_key VARCHAR(100) PRIMARY KEY` and `config_value TEXT`. This allows individual settings to be queried and updated atomically without a full-row lock. Version number on each key row for ETag-based concurrency control. An alternative is a single-row table with `id = 1` enforced by a `CHECK (id = 1)` — acceptable but inflexible if new settings are added. The key-value approach is preferred.

---

## 5. Foreign Key and Referential Integrity Strategy

### 5.1 All Mandatory Relationships Use NOT NULL Foreign Keys

Every mandatory relationship in ED-01/ED-02 is implemented as a `NOT NULL` FK column. No nullable FK for a relationship that is never optional in the domain model.

| Relationship | FK Column | Nullable? |
|---|---|---|
| Tag → Page | `tags.page_id → pages.page_id` | NOT NULL |
| English Copy → Tag | `english_copies.tag_id → tags.tag_id` | NOT NULL (1:1 identity) |
| English Copy Version → English Copy | `english_copy_versions.tag_id → english_copies.tag_id` | NOT NULL |
| Translation → Tag | `translations.tag_id → tags.tag_id` | NOT NULL |
| Translation → Language | `translations.language_code → languages.language_code` | NOT NULL |
| Translation Version → Translation | `translation_versions.(tag_id, language_code) → translations.(tag_id, language_code)` | NOT NULL |
| Translation Version `source_english_version` → English Copy Version | `translation_versions.source_english_version → english_copy_versions.version_number WHERE tag_id = translation_versions.tag_id` | NOT NULL (except: MIGRATED TV — enforced at app layer during atomic bootstrap step) |
| Release → Publishing Approval Request | `releases.approval_request_id → publishing_approval_requests.approval_request_id` | NULLABLE (NULL for SYSTEM_AUTO_DEV and MIGRATION trigger sources) |
| Comment → Tag | `comments.tag_id → tags.tag_id` | NOT NULL |
| Audit Record → subject | `audit_records.subject_type + subject_id` — polymorphic (see §5.3) | NOT NULL |
| Notification → User | `notifications.recipient_user_id → users.user_id` | NOT NULL |
| Bookmark → User | `bookmarks.user_id → users.user_id` | NOT NULL |

### 5.2 ON DELETE Behaviour

Because all permanent records must never be deleted (§3.1), foreign keys on permanent tables must never cascade a delete. The following rules apply:

| FK Target | ON DELETE Rule | Rationale |
|---|---|---|
| Any permanent entity | `RESTRICT` (default) | Application must never attempt to delete a row that another row references. If it does, the constraint is correct to reject it. |
| `bookmarks.tag_id → tags.tag_id` | `RESTRICT` | Bookmarks reference permanent Tags. Bookmark deletion is by user action (API-0704), not by Tag deletion (which never happens). |

**No `ON DELETE CASCADE` on permanent tables.** Cascade deletes are the primary mechanism by which historical records can be accidentally destroyed. They are prohibited.

### 5.3 Polymorphic References in Audit Records

`audit_records` references heterogeneous subjects (tags, english_copies, translations, releases, etc.). Two implementation patterns are permitted:

**Pattern A (chosen for v1):** `subject_entity_type VARCHAR(50)` + `subject_entity_id TEXT`. No FK. Application layer validates subject existence. The tradeoff (no FK enforcement) is acceptable because Audit Records are write-append-only (their subject always exists at write time), and subjects are never deleted (permanent records).

**Pattern B (future):** If a specific join query is needed (e.g., "all audit records for tag X"), a partial index on `(subject_entity_type, subject_entity_id)` makes the polymorphic reference queryable. This is an indexing decision, not an FK one.

No sparse FK tables (one nullable FK per possible subject type on the same row) shall be used for Audit Records.

### 5.4 Deferred Constraints

Deferred constraint checking (`DEFERRABLE INITIALLY DEFERRED`) is used for:
- The `release.approval_request_id` FK where the PAR and Release are created in the same transaction (API-0404 approval step creates both). If the PAR is created first and the Release references it, no deferral is needed. If any circular dependency arises, DEFERRED FK is the resolution mechanism.
- The English Copy creation during Tag creation: `english_copies.tag_id` references `tags.tag_id`. Since both rows are inserted in the same transaction (at Tag creation time), the FK is satisfied within the transaction. No deferral needed but allowed.

---

## 6. Uniqueness and Compound Identity Strategy

### 6.1 Database-Enforced Unique Constraints (from ED-03 §5.1 Invariants)

All identity uniqueness invariants from ED-03 (XI-01 through XI-10) must be enforced at the database level, not only at the API level.

| Invariant | Database Enforcement |
|---|---|
| XI-01: `page_id` globally unique | `PRIMARY KEY (page_id)` on `registry.pages` |
| XI-02: `tag_id` globally unique + `pageId_` prefix | `PRIMARY KEY (tag_id)` on `registry.tags` + `CHECK (tag_id LIKE page_id || '\_%' ESCAPE '\')` |
| XI-03: `language_code` globally unique | `PRIMARY KEY (language_code)` on `admin.languages` |
| XI-04: `(tag_id, language_code)` unique per Translation | `PRIMARY KEY (tag_id, language_code)` on `translation.translations` |
| XI-05: `(tag_id, version_number)` unique per EC Version | `PRIMARY KEY (tag_id, version_number)` on `content.english_copy_versions` |
| XI-06: `(tag_id, language_code, version_number)` unique per TV | `PRIMARY KEY (tag_id, language_code, version_number)` on `translation.translation_versions` |
| XI-07: `(page_id, language_code, environment, deployment_version)` unique per Release | `UNIQUE (page_id, language_code, environment, deployment_version)` on `publishing.releases` |
| XI-08: `approval_request_id` globally unique | `PRIMARY KEY (approval_request_id)` on `publishing.publishing_approval_requests` |
| XI-09: `audit_record_id` globally unique | `PRIMARY KEY (audit_record_id)` on `system_ops.audit_records` |
| XI-10: `user_id` globally unique | `PRIMARY KEY (user_id)` on `admin.users` |

### 6.2 Partial Unique Constraints for Business Rules

Business rules requiring uniqueness only within a subset of rows use **partial unique indexes** (PostgreSQL-native).

| Business Rule | Partial Unique Index |
|---|---|
| XI-19: At most one APPROVED English Copy Version per tag at any time | `UNIQUE (tag_id) WHERE status = 'APPROVED'` on `content.english_copy_versions` |
| XI-20: At most one PENDING PAR per `(page_id, language_code, environment)` | `UNIQUE (page_id, language_code, environment) WHERE status = 'PENDING'` on `publishing.publishing_approval_requests` |
| Active role: at most one active grant per `(user_id, role)` | `UNIQUE (user_id, role) WHERE revoked_at IS NULL` on `admin.user_role_assignments` |
| Bookmark deduplication: at most one bookmark per `(user_id, target_type, target_id)` | `UNIQUE (user_id, target_type, target_id)` on `search.bookmarks` |

---

## 7. Naming Conventions

### 7.1 Table Names

- Lowercase, underscore-separated (snake_case)
- Plural nouns: `pages`, `tags`, `english_copy_versions`, `translations`
- Schema-qualified in all SQL: `registry.pages`, `content.english_copies`

### 7.2 Column Names

- Lowercase, snake_case
- Boolean columns: prefix with `is_` or `has_` — e.g., `is_deprecated`, `has_english_copy`, `is_stale`
- Timestamp columns: suffix with `_at` — e.g., `created_at`, `updated_at`, `approved_at`, `revoked_at`
- Actor columns (who performed an action): suffix with `_by` — e.g., `created_by`, `approved_by`, `reviewed_by`
- Status columns: named `status` on all stateful entities. Type: `VARCHAR(50)` storing the canonical state machine value.
- FK columns referencing a parent PK: use the parent table's PK column name — e.g., `tag_id`, `page_id`, `language_code`
- FK columns referencing a parent's non-PK column: use `parent_table_name_column_name` — e.g., `source_english_version` (referencing `english_copy_versions.version_number`)

### 7.3 Index Names

Pattern: `idx_{table}_{columns}[_{descriptor}]`

Examples:
- `idx_tags_page_id` — B-tree on `registry.tags(page_id)`
- `idx_translation_versions_tag_lang_version` — compound B-tree
- `idx_english_copy_versions_approved` — partial index for APPROVED versions

### 7.4 Constraint Names

Pattern: `{table}_{columns}_{constraint_type}`

Examples:
- `tags_tag_id_pkey` — primary key
- `tags_page_id_fkey` — foreign key to pages
- `english_copy_versions_approved_unique` — partial unique index for APPROVED constraint
- `translations_status_check` — CHECK constraint on status values

### 7.5 Sequence Names

Pattern: `{schema}_{table}_{column}_seq`

---

## 8. Timestamp and Timezone Standards

### 8.1 All Timestamps Use `TIMESTAMPTZ` (Timestamp with Time Zone)

Every timestamp column is `TIMESTAMPTZ`, stored as UTC internally by PostgreSQL. Never use `TIMESTAMP WITHOUT TIME ZONE`. MioTranslate's internal team operates from a specific timezone but the database is timezone-agnostic — timezone conversion happens at the API layer.

**Rationale:** The FRD specifies that audit records must record exact timestamps. Version history must be chronologically sortable. The database's UTC storage guarantees correctness regardless of server timezone configuration.

### 8.2 Standard Timestamp Columns

Every permanent entity table (SOURCE_OF_TRUTH, GOVERNANCE_RECORD, IMMUTABLE_HISTORY) includes:

| Column | Type | When Set | Mutable? |
|---|---|---|---|
| `created_at` | TIMESTAMPTZ | At INSERT, `DEFAULT now()` | Never |
| `updated_at` | TIMESTAMPTZ | At INSERT and every UPDATE, via trigger | Yes (by trigger) |

**Version history tables** (IMMUTABLE_HISTORY) have `created_at` but no `updated_at` — there are no updates.

### 8.3 `updated_at` Trigger Standard

All mutable entity tables (SOURCE_OF_TRUTH, GOVERNANCE_RECORD) must use a trigger to set `updated_at = now()` on every UPDATE. This is the canonical `updated_at` trigger pattern — application code must not manually set `updated_at`.

```sql
-- Standard trigger function (defined once in public schema)
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
```

Applied to every mutable entity table:
```sql
CREATE TRIGGER set_updated_at
BEFORE UPDATE ON {schema}.{table}
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
```

### 8.4 Append-Once Timestamp Columns

For audit lifecycle fields on version records (e.g., `submitted_for_review_at`, `reviewed_at`, `approved_at`) that are written exactly once and never modified:

These columns are `TIMESTAMPTZ NULL`. `NULL` means the event has not occurred yet. Once written, they must never be overwritten. This is enforced at the application layer with a database `CHECK` constraint where feasible:

```sql
-- Example: once approved_at is set, it cannot be cleared (application must not do this,
-- but a trigger can enforce it in future if needed)
```

**Rule:** No migration script may zero-out or overwrite a non-null append-once timestamp column.

---

## 9. Enumerated Value Strategy

### 9.1 String-Based Enums via CHECK Constraints (Not PostgreSQL ENUM Types)

All enumerated values (entity statuses, trigger sources, creation methods, environments) are stored as `VARCHAR(50)` columns with a `CHECK` constraint listing the permitted values.

**Why not PostgreSQL ENUM types:**
- Adding a new value to a PostgreSQL ENUM type requires an `ALTER TYPE ... ADD VALUE` statement, which cannot be done inside a transaction in older versions and is operationally inconvenient.
- `VARCHAR` with `CHECK` allows adding new values via a simple `ALTER TABLE ... ADD CONSTRAINT` or constraint replacement — transactionally safe.
- String values are human-readable in queries and logs without lookups.

**Standard pattern:**

```sql
status VARCHAR(50) NOT NULL,
CONSTRAINT {table}_status_check CHECK (status IN (
    'VALUE_A',
    'VALUE_B',
    'VALUE_C'
))
```

### 9.2 Canonical Enum Values (from ED-01/ED-02)

| Entity | Status Values |
|---|---|
| `registry.pages` | `ACTIVE`, `DEPRECATED` |
| `registry.tags` | `ACTIVE`, `DEPRECATED` |
| `content.english_copies` | `NO_COPY`, `DRAFT`, `PENDING_REVIEW`, `APPROVED` |
| `content.english_copy_versions` | `DRAFT`, `PENDING_REVIEW`, `APPROVED`, `SUPERSEDED`, `REJECTED` |
| `translation.translations` | `NO_TRANSLATION`, `DRAFT`, `PENDING_REVIEW`, `APPROVED`, `STALE`, `REJECTED` |
| `translation.translation_versions` | `DRAFT`, `PENDING_REVIEW`, `APPROVED`, `SUPERSEDED`, `REJECTED` |
| `admin.languages` | `ACTIVE`, `INACTIVE` |
| `publishing.publishing_approval_requests` | `PENDING`, `APPROVED`, `REJECTED`, `CANCELLED`, `EXPIRED` |
| `publishing.releases` | `PENDING`, `IN_PROGRESS`, `SUCCESSFUL`, `FAILED`, `ROLLED_BACK` |
| `publishing.releases.trigger_source` | `USER_INITIATED`, `SYSTEM_AUTO_DEV`, `MIGRATION` |
| `publishing.releases.release_type` | `PUBLISH`, `ROLLBACK` |
| `translation.translation_versions.creation_method` | `AI_GENERATED`, `MANUAL`, `MIGRATED` |
| `admin.user_role_assignments.role` | `PM`, `QA`, `LR`, `SR`, `FN`, `DEV`, `ADMIN` |
| `system_ops.notifications.status` | `UNREAD`, `READ` |
| `system_ops.notifications.delivery_status` | `PENDING`, `DELIVERED`, `FAILED` |
| `collaboration.export_jobs.status` | `PENDING`, `GENERATING`, `READY`, `EXPIRED`, `FAILED` |
| `migration.import_events.status` | `UPLOAD_READY`, `PROCESSING`, `COMPLETED`, `FAILED`, `REPORT_AVAILABLE` |
| Environment values | `DEV`, `QA`, `PRODUCTION` |

---

## 10. Nullability and Optionality Conventions

### 10.1 Default to NOT NULL

Every column that represents a mandatory field in the entity model (ED-01) is `NOT NULL`. Nullable columns are explicitly justified in the schema documentation.

### 10.2 Permitted Nullable Columns

| Column Type | When Nullable |
|---|---|
| **Append-once lifecycle timestamps** | `reviewed_at`, `approved_at`, `submitted_for_review_at` etc. — NULL until the event occurs |
| **Optional entity attributes** | `tags.copy_type`, `pages.module` — explicitly optional in FRD |
| **FK to optional parent** | `releases.approval_request_id` — NULL for SYSTEM_AUTO_DEV and MIGRATION releases (ED-03 §2.8) |
| **Revocation/expiry fields** | `user_role_assignments.revoked_at`, `user_role_assignments.revoked_by` — NULL until revoked |
| **AI-specific fields** | `translation_versions.confidence_score`, `translation_versions.back_translation` — NULL for MANUAL and MIGRATED creation methods |
| **Change reason** | `english_copy_versions.change_reason`, `translation_versions.change_reason` — explicitly optional |
| **Rejection reason** | `translation_versions.rejection_reason`, `publishing_approval_requests.rejection_reason` — NULL unless rejected |
| **staleInfo fields** | `translations.stale_triggered_at`, `translations.stale_current_english_version`, `translations.stale_previous_english_text`, `translations.stale_current_english_text` — NULL unless status = STALE |

### 10.3 Default Values

- Boolean columns: explicit `DEFAULT FALSE` or `DEFAULT TRUE` — never rely on `NULL` as "false"
- `created_at`: `DEFAULT now()`
- `updated_at`: `DEFAULT now()`
- `status` on stateful entities: `DEFAULT` set to the initial/entry state (e.g., `DEFAULT 'NO_COPY'` on `content.english_copies`)

---

## 11. ETag and Optimistic Concurrency Strategy

### 11.1 Optimistic Locking via `etag_version`

MioTranslate uses **optimistic locking** (confirmed in the API Production-Readiness Audit via `If-Match` ETag headers). The database persistence model for ETags is:

Every mutable source-of-truth entity and mutable governance record that supports concurrent modification has an `etag_version INTEGER NOT NULL DEFAULT 1` column.

**Mechanics:**
1. API GET returns the entity with `ETag: "{etag_version}"` header.
2. API mutating request includes `If-Match: "{etag_version}"`.
3. The UPDATE statement includes `WHERE etag_version = $incoming_etag_version`.
4. If the `WHERE` clause matches 0 rows (because another update incremented `etag_version` first), the operation returns `409 Conflict`.
5. The UPDATE also increments: `etag_version = etag_version + 1`.

**Affected tables:**

| Table | Concurrent Operations Protected |
|---|---|
| `content.english_copies` | Concurrent draft saves (API-0201), concurrent review submissions |
| `translation.translations` | Concurrent translation edits, concurrent status transitions |
| `publishing.publishing_approval_requests` | Concurrent approve/reject decisions |
| `admin.system_configuration` | Concurrent configuration updates |

**Version history tables** (IMMUTABLE_HISTORY) do not need `etag_version` — they are INSERT-only.

### 11.2 Concurrency-Specific Database Guarantees

The database provides the following guarantees for concurrent operations documented in ED-03:

| Concurrent Scenario | Database Enforcement |
|---|---|
| Duplicate English copy draft by two users simultaneously | `etag_version` check + transaction serialization on the UPDATE |
| Two users approving the same EC version simultaneously | `etag_version` check ensures only one UPDATE succeeds; second returns 409 |
| Two users creating a PAR for the same `(page_id, language_code, environment)` | Partial unique index `UNIQUE (page_id, language_code, environment) WHERE status = 'PENDING'` — second INSERT fails with unique violation → 409 |
| Duplicate translation slot creation (API-0506 bulk) | `PRIMARY KEY (tag_id, language_code)` — INSERT with ON CONFLICT DO NOTHING for idempotent bulk slot creation |
| Duplicate bookmark | `UNIQUE (user_id, target_type, target_id)` — INSERT with ON CONFLICT (toggle to DELETE) |
| Concurrent migration execution | `UNIQUE (status) WHERE status = 'PROCESSING'` partial index on `import_events` — prevents two concurrent migrations |
| Concurrent implicit DEV publishing | Application-level idempotency key + `UNIQUE (page_id, language_code, environment) WHERE status IN ('PENDING', 'IN_PROGRESS')` on releases — prevents concurrent in-flight publishes |
| Role assignment: last admin lockout | Application-layer check before API-0804 write. No DB-level enforcement possible (this is a count-based rule, not a uniqueness rule). |

### 11.3 SELECT FOR UPDATE Usage

For critical decision points that must read-then-write atomically:
- English Copy approval (must check current status before transitioning)
- PAR approval (must verify PAR is still PENDING and hash matches before creating Release)
- stale resolution (must verify Translation is still STALE before resolving)

These operations use `SELECT ... FOR UPDATE` to acquire a row-level lock within the transaction, preventing concurrent modification between the read and the write.

---

## 12. Transaction Boundaries and Isolation Model

### 12.1 Default Isolation Level

`READ COMMITTED` (PostgreSQL default). Sufficient for the majority of MioTranslate's operations: single-entity reads and writes within a short transaction.

### 12.2 `SERIALIZABLE` for Multi-Entity Atomic Operations

The following multi-entity operations must be `SERIALIZABLE` to prevent serialization anomalies:

| Operation | Entities Touched in One Transaction |
|---|---|
| **English Copy approval** | `english_copy_versions` (status → APPROVED, prior version → SUPERSEDED) + `english_copies` (status update) + all `translation.translations` for this tag (status → STALE + staleInfo) + `system_ops.audit_records` (INSERT) |
| **Translation approval → implicit DEV publish** | `translation.translations` (status → APPROVED) + `translation_versions` (review fields written) + `publishing.releases` (INSERT PENDING) + `system_ops.audit_records` (INSERT) [Note: the actual Language Services call and Release status update to SUCCESSFUL/FAILED happen after the transaction in the async publish worker] |
| **PAR approval → Release creation** | `publishing.publishing_approval_requests` (status → APPROVED) + `publishing.releases` (INSERT PENDING) + `system_ops.audit_records` (INSERT) |
| **Rollback execution** | `publishing.releases` (new Rollback Release INSERT) + prior Release (status → ROLLED_BACK) + `system_ops.audit_records` (INSERT) |
| **Tag deprecation → page deprecation cascade** | `registry.tags` (status → DEPRECATED) + conditional `registry.pages` (status → DEPRECATED if last active tag) + `system_ops.audit_records` (INSERT) |
| **Migration import** | Full page/tag/EC/ECVersion/Translation/TVVersion/Release bulk INSERT per migrated record — batched within a single transaction per page for rollback safety |

### 12.3 Transaction Scope Rules

1. **One API request = at most one database transaction.** Never span a transaction across multiple HTTP requests or async waits.
2. **External service calls (Language Services, AI Translation) must not be inside a database transaction.** The transaction commits before the external call is initiated. The external call result triggers a follow-up transaction to update Release status.
3. **Audit record creation is within the same transaction as the primary operation.** If the primary operation succeeds but the audit record fails to write, the entire transaction rolls back. This is the "guaranteed audit" contract from the API audit.
4. **Notification dispatch is outside the transaction.** Notifications are dispatched asynchronously after the primary transaction commits. A failed notification does not roll back the primary operation.

### 12.4 Saga Pattern for Long-Running Operations

The implicit DEV publish flow and the migration import flow span multiple steps that cannot all be in one transaction. These use a **saga-like sequential step pattern**:

- Each step is its own transaction.
- Each step records its output/state to the DB before initiating the next step.
- Failure at any step leaves the system in a recoverable, deterministic intermediate state.
- Retries are safe because each step is idempotent (either INSERT with ON CONFLICT or UPDATE with `etag_version` guard).

---

## 13. Immutability and Append-Only History Enforcement

### 13.1 Immutable Tables — No UPDATE Permitted

The following tables must never receive an UPDATE after INSERT. This is enforced by:
1. Application code: no UPDATE statement is generated for these tables.
2. Database-layer rule: a `BEFORE UPDATE` trigger raises an exception for any UPDATE attempt.

```sql
-- Standard immutability trigger (applied to all IMMUTABLE_HISTORY tables)
CREATE OR REPLACE FUNCTION public.raise_on_update()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'Update not permitted on immutable table %', TG_TABLE_NAME;
END;
$$ LANGUAGE plpgsql;
```

**Immutable tables:**

| Table | What Makes It Immutable |
|---|---|
| `system_ops.audit_records` | Every audit record is a permanent, permanent-once fact of what happened |
| `content.english_copy_versions` | Content snapshot fields. Exception: `status` field is the single permitted post-creation change (APPROVED → SUPERSEDED). This exception is handled by allowing a narrow UPDATE on `status` only — a `BEFORE UPDATE` trigger validates that only `status` changes. |
| `translation.translation_versions` | Content snapshot fields. Same exception: `status` may change APPROVED → SUPERSEDED via a narrow, trigger-guarded UPDATE. |
| `publishing.release_content_snapshots` | The content snapshot of what was sent to Language Services. Never mutated. |

**Partially mutable tables (main release record):**

`publishing.releases` — the main Release record has status that can transition (PENDING → IN_PROGRESS → SUCCESSFUL/FAILED, and SUCCESSFUL → ROLLED_BACK). The `contentSnapshot` field on the Release (or in a separate table — see §13.2) is immutable once written.

### 13.2 Content Snapshot Separation

**Resolution of ED-03 OQ-6:** `contentSnapshot` is stored in a **separate table** `publishing.release_content_snapshots` with one row per `(release_id, tag_id)`.

**Why separate table, not JSONB blob:**
- The pre-publishing summary diff (API-0402) and coverage numerator computation both require querying individual tag-level snapshot data. A JSONB blob would require extracting rows from JSON at query time.
- Rollback reads the snapshot of the target prior release — querying individual tag-level rows is more efficient than extracting from JSON.
- The snapshot table is IMMUTABLE_HISTORY — its immutability trigger is clean.
- The release JSONB column for `api_response_payload` (Language Services raw response) is retained as JSONB — it is trace data, not queried per-tag.

**Schema:**
```
release_content_snapshots:
  release_id (UUID, FK to releases.release_id, NOT NULL)
  tag_id (VARCHAR, FK to tags.tag_id, NOT NULL)
  tag_name (VARCHAR — snapshot of tag name at publish time)
  translation_version_number (INTEGER)
  source_english_version_number (INTEGER)
  translation_text (TEXT — the actual string sent to Language Services)
  PRIMARY KEY (release_id, tag_id)
```

This is the resolution to OQ-6.

### 13.3 Comment Immutability

`collaboration.comments` — comment `text` is immutable after INSERT. The `resolved_at` and `resolved_by` fields are append-once (NULL until resolved, written once). A trigger enforces that `text` cannot be changed on UPDATE:

```sql
CREATE OR REPLACE FUNCTION collaboration.raise_on_comment_text_update()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.comment_text <> OLD.comment_text THEN
    RAISE EXCEPTION 'Comment text is immutable after creation';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
```

### 13.4 No Hard Deletes — Enforcement

A `BEFORE DELETE` trigger on all permanent tables raises an exception unconditionally:

```sql
CREATE OR REPLACE FUNCTION public.raise_on_delete()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'Delete not permitted on permanent table %', TG_TABLE_NAME;
END;
$$ LANGUAGE plpgsql;
```

Applied to: `registry.pages`, `registry.tags`, `content.english_copies`, `content.english_copy_versions`, `translation.translations`, `translation.translation_versions`, `admin.languages`, `admin.users`, `admin.user_role_assignments`, `system_ops.audit_records`, `collaboration.comments`, `publishing.publishing_approval_requests`, `publishing.releases`, `publishing.release_content_snapshots`, `migration.import_events`.

---

## 14. Deprecation and Inactivation Strategy

Deprecated or inactive entities are never deleted. Their lifecycle state is expressed through a `status` column transition.

| Entity | "Inactive" Status | Excluded From (App Layer) |
|---|---|---|
| Page | `DEPRECATED` | Active tag listing, publishing bundles, coverage numerator |
| Tag | `DEPRECATED` | Translation operations, publishing bundles, coverage denominator |
| Language | `INACTIVE` | New translation operations, publishing bundles, slot creation |

**Deprecated/inactive entities are still included in:**
- Version history queries
- Audit trail queries
- Historical Release contentSnapshot queries (deprecated tags may appear in old snapshots)
- Global search (with an `isDeprecated` indicator in results)

**No `is_deleted` boolean columns.** `status` is the single lifecycle authority. No separate deletion flag that conflicts with or duplicates status.

---

## 15. JSON and Structured-Object Usage

### 15.1 JSONB Usage Policy

JSONB is used exclusively for:

| Use Case | Column | Rationale |
|---|---|---|
| Language Services API response trace | `releases.api_response_payload JSONB` | Unstructured external API response. Never queried field-by-field in application logic. Stored for audit and debugging. |
| Migration source validation data | `import_events.validation_report JSONB` | Freeform report structure. Not queried programmatically. |
| System Configuration values (if complex) | Not for simple string values — only if a configuration value is itself a structured object | Simple string values use `TEXT` in the key-value config table |

**JSONB is NOT used for:**
- Entity status or lifecycle fields (these are `VARCHAR` columns)
- Content snapshot per-tag data (this is the separate `release_content_snapshots` table — §13.2)
- staleInfo fields (these are explicit columns on `translation.translations`)
- Any field that is queried, filtered, sorted, or joined on in application logic

### 15.2 JSONB Index Requirement

Any JSONB column that is searched or extracted in application queries must have a GIN index. JSONB columns used only for storage/retrieval (trace data) do not require GIN indexes.

### 15.3 No Nested Object Arrays for Relational Data

If a value is a list of structured objects that are queried individually, they must be normalized into rows — not stored as a JSONB array. The `release_content_snapshots` design (§13.2) applies this principle: tags in a snapshot are rows, not elements of a JSON array.

---

## 16. Large Payload and Blob Handling

### 16.1 Migration Upload Files

The uploaded migration file (API-1001) may be a large CSV/Excel file containing all 89 pages × all tags × all languages. This must not be stored as a binary column in PostgreSQL.

**Approach:** Store the uploaded file in object storage (e.g., S3-compatible storage) referenced by a `file_reference_url TEXT` on the `import_events` record. The migration execution process reads from object storage, not from the database.

**Why not `BYTEA` in PostgreSQL:** Large binary files in PostgreSQL bloat the database, cause table bloat in TOAST storage, and make backups larger. Object storage is the correct tier for file payloads.

### 16.2 Export Files

Export files generated by API-0905 are similarly stored in object storage, referenced by `file_reference_url TEXT` on the `export_jobs` record. The `GET /v1/exports/{exportId}/download` endpoint generates a time-limited pre-signed URL to the object storage file.

### 16.3 English Copy and Translation Text

Individual tag text values are `TEXT` (not `VARCHAR(n)`). MioSalon UX copy can be short (1–3 words) or long (full sentences for tooltips/error messages). A hard VARCHAR limit that rejects valid copy is operationally harmful. `TEXT` with no length limit is used for all English and translation content fields.

**Note on `TOAST`:** PostgreSQL automatically stores long `TEXT` values out-of-line in TOAST storage. No manual handling is needed.

---

## 17. Audit Storage Principles

### 17.1 Audit Records Are Their Own Entity

`system_ops.audit_records` is a standalone append-only table. It is not an extension of any other entity table. No entity table contains a `last_audit_record_id` FK or similar back-reference.

### 17.2 Audit Record Fields

Every audit record row contains:

| Field | Type | Description |
|---|---|---|
| `audit_record_id` | UUID v7 | Primary key |
| `action` | VARCHAR(100) | The action that occurred (e.g., `ENGLISH_COPY_APPROVED`, `TRANSLATION_STALE_FLAGGED`) |
| `subject_entity_type` | VARCHAR(50) | The entity type the action was performed on |
| `subject_entity_id` | TEXT | The entity's primary key (serialized as text) |
| `performed_by_user_id` | UUID | FK to users (NULL for system actions) |
| `performed_by_source` | VARCHAR(100) | `USER`, `SYSTEM:AUTO_PUBLISH`, `SYSTEM:STALE_FLAG`, etc. |
| `performed_at` | TIMESTAMPTZ | Exact UTC timestamp |
| `before_value` | JSONB NULL | State snapshot before the action (selective — not all actions) |
| `after_value` | JSONB NULL | State snapshot after the action |
| `api_id` | VARCHAR(20) NULL | The API that triggered this audit record (e.g., `API-0203`) |
| `request_id` | UUID NULL | The API request correlation ID |
| `details` | TEXT NULL | Human-readable description |

### 17.3 Audit Table Partitioning (Forward-Looking)

At initial scale, `audit_records` is a single table. As the system grows over years, audit records accumulate. The table design must be compatible with **range partitioning by `performed_at`** for future annual partition management.

**Design rule:** Do not create a surrogate integer PK on audit_records. UUID v7 (time-ordered) as PK supports partition range alignment without a separate partition key.

### 17.4 Audit Retention

FRD requires audit records to be permanent and never deleted. No retention limit is imposed in the approved product scope. The database schema must not include any retention/expiry fields on audit_records.

---

## 18. Derived and Read-Model Architecture

### 18.1 Two-Tier Architecture

| Tier | Technology | Examples | Properties |
|---|---|---|---|
| **Source of Truth** | PostgreSQL tables (transactional) | pages, tags, english_copies, translations, releases | ACID, relational, authoritative |
| **Read Models** | PostgreSQL Materialized Views + Denormalized Summary Tables | coverage_metrics, environment_status_matrix, review_queue, activity_timeline, pending_work_summary | Refreshable, queryable, never written to directly |

No third tier (external cache) is required at initial scale. Redis cache may be introduced for specific hot-read paths (e.g., System Configuration, active language list) in a later phase.

### 18.2 Source-of-Truth to Derived Model Rules

1. **Derived models are never authoritative inputs to business rules.** Business rule validation always reads from source-of-truth tables.
2. **Derived models may be rebuilt from scratch** from their source tables at any time. This is their consistency guarantee.
3. **Derived model rows carry a `computed_at TIMESTAMPTZ`** to indicate when they were last refreshed. The API layer returns this timestamp so clients know the freshness.
4. **No foreign keys from source tables to derived model tables.** Dependency is one-way: derived models reference source tables; source tables are unaware of derived models.

### 18.3 Coverage Metrics

**Storage:** Materialized view or denormalized table in `reporting.coverage_metrics`.

**Refresh triggers (from API-0503):** Translation approved/stale, Tag created/deprecated, page published to Production, Language added. These are 9 documented trigger events in the API List.

**Refresh strategy:** **Event-driven incremental update** preferred over full recompute. When a Translation is approved for `(page_id, language_code)`, only that coverage cell is recomputed. Full recompute available for consistency validation.

**Formula in DB terms:**
```sql
approved_and_deployed_count =
  COUNT(DISTINCT rcs.tag_id)
  FROM publishing.release_content_snapshots rcs
  JOIN publishing.releases r ON r.release_id = rcs.release_id
  JOIN registry.tags t ON t.tag_id = rcs.tag_id
  WHERE r.page_id = $page_id
    AND r.language_code = $language_code
    AND r.environment = 'PRODUCTION'
    AND r.status = 'SUCCESSFUL'
    AND t.status = 'ACTIVE'
    AND r.release_id = (SELECT release_id FROM publishing.releases
                        WHERE page_id = $page_id AND language_code = $language_code
                          AND environment = 'PRODUCTION' AND status = 'SUCCESSFUL'
                        ORDER BY deployment_version DESC LIMIT 1)

total_active_count =
  COUNT(*) FROM registry.tags WHERE page_id = $page_id AND status = 'ACTIVE'

coverage_percentage = (approved_and_deployed_count::FLOAT / NULLIF(total_active_count, 0)) * 100
```

**This is the resolution to OQ-4** (Coverage Metrics materialization strategy): event-driven incremental update per `(page_id, language_code)` cell, full-recompute available via a maintenance job.

### 18.4 Review Queue

**Storage:** Not a materialized table. The Review Queue (API-0606) is a **live query** against source tables, filtered by `status IN ('PENDING_REVIEW')` on english_copies, translations, and publishing_approval_requests.

**Rationale:** The Review Queue changes frequently (new submissions arrive constantly during active work sessions). A materialized view would be stale by the time it is refreshed. The query across three tables is fast with appropriate indexes (`idx_english_copies_status_pending`, `idx_translations_status_pending`, `idx_pars_status_pending`).

### 18.5 Activity Timeline

**Storage:** `system_ops.audit_records` is the source. API-0605 (Get Activity Timeline) is a filtered, ordered read of audit_records with formatting applied at the API layer.

**No separate `activity_timeline` table.** The audit records table is the authoritative source. A `(performed_at DESC, subject_entity_type, performed_by_user_id)` index on `audit_records` supports the timeline query.

### 18.6 Environment Status Matrix

**Storage:** Derived from a query against `publishing.releases`:
```sql
SELECT DISTINCT ON (page_id, language_code, environment)
  page_id, language_code, environment, deployment_version, status, published_at, published_by
FROM publishing.releases
WHERE status = 'SUCCESSFUL'
ORDER BY page_id, language_code, environment, deployment_version DESC
```

This is a live query, not a materialized table. With 89 pages × 8 languages × 3 environments = 2,136 potential cells, this query is trivially fast with a `(page_id, language_code, environment, deployment_version DESC)` index.

### 18.7 Pending Work Summary

**Storage:** Live aggregation query across:
- `registry.tags WHERE status = 'ACTIVE'` with English Copy status counts
- `translation.translations` with status distribution
- `publishing.publishing_approval_requests WHERE status = 'PENDING'`

At 4,500 tags × 8 languages, this is ~36,000 rows in the worst case — entirely within PostgreSQL's efficient range with appropriate indexes. No materialization needed at v1 scale.

### 18.8 Search Index

**Storage:** `tsvector` column on `registry.tags` (for tagId + pageName) and `content.english_copies` (for English copy text). Updated via a `BEFORE INSERT OR UPDATE` trigger.

```sql
ALTER TABLE registry.tags ADD COLUMN search_vector TSVECTOR
  GENERATED ALWAYS AS (
    to_tsvector('english', coalesce(tag_id, '') || ' ' || coalesce(tag_name, ''))
  ) STORED;

ALTER TABLE content.english_copies ADD COLUMN search_vector TSVECTOR
  GENERATED ALWAYS AS (
    to_tsvector('english', coalesce(approved_text, '') || ' ' || coalesce(draft_text, ''))
  ) STORED;
```

GIN index on both `search_vector` columns supports API-0701 full-text search.

**This is the resolution to OQ-5's related concern** (the search data source): no external search engine is needed at v1 scale.

### 18.9 Recently-Edited

**Resolution of ED-03 OQ-5:** Recently-Edited requires two data sources:
1. **Write events:** Derived from `system_ops.audit_records` WHERE `performed_by_user_id = $user_id AND subject_entity_type IN ('TAG', 'ENGLISH_COPY', 'TRANSLATION')` ORDER BY `performed_at DESC`.
2. **View events (page visits):** Require a separate **lightweight event store** — `search.recently_edited_events`.

**`search.recently_edited_events` table:**
```
user_id         UUID (FK to users)
target_type     VARCHAR(20) — 'TAG' or 'PAGE'
target_id       TEXT — the tag_id or page_id
last_accessed_at TIMESTAMPTZ DEFAULT now()
PRIMARY KEY (user_id, target_type, target_id)
```

ON CONFLICT (user_id, target_type, target_id) DO UPDATE SET `last_accessed_at = now()`. This is an upsert — every page visit updates the timestamp. High-write, low-row-count (at most a few hundred rows per user). Short retention: `last_accessed_at < now() - interval '30 days'` rows may be purged by a cleanup job.

The API-0705 response merges: (audit-based write events) UNION (recently_edited_events view events) DISTINCT ON target_id, ordered by most recent first.

---

## 19. External Integration Persistence Boundaries

### 19.1 Language Services

MioTranslate owns its own representation of every interaction with Language Services. It does not model or replicate the Language Services database schema.

**What MioTranslate persists about Language Services:**

| What | Where | Details |
|---|---|---|
| What was sent (content) | `publishing.release_content_snapshots` | Tag-by-tag rows: tag_id, translation_text, version references |
| What Language Services responded | `publishing.releases.api_response_payload JSONB` | Full raw response for audit/debugging |
| Whether the push succeeded per language | `publishing.releases.status` + `api_response_success BOOLEAN` | The outcome, not the mechanism |
| Environment endpoint configuration | `admin.system_configuration` | DEV/QA/PROD endpoint URLs, domain name |

**What MioTranslate does NOT persist:**
- The Language Services internal database schema
- Tags that were already in Language Services before MioTranslate pushed (only the tags MioTranslate sent are tracked)
- Language Services' internal version numbers

### 19.2 AI Translation Service

MioTranslate captures AI service outputs at the time of translation creation. The AI service itself has no database presence in MioTranslate.

**What MioTranslate persists about AI Translation:**

| What | Where |
|---|---|
| Generated translated text | `translation.translation_versions.text` (immutable snapshot) |
| Confidence score | `translation.translation_versions.confidence_score NUMERIC(5,4)` |
| Back-translation | `translation.translation_versions.back_translation TEXT` |
| Variable integrity check result | `translation.translation_versions.variable_integrity_status VARCHAR(20)` |
| Creation method (AI vs Manual) | `translation.translation_versions.creation_method` — `AI_GENERATED` or `MANUAL` |

**What MioTranslate does NOT persist:**
- The AI model version or prompt used
- The raw AI service request/response payload (only the output fields)
- AI service account or billing information

---

## 20. Security and Governance Principles

### 20.1 Single-Tenant Architecture

MioTranslate is an internal single-tenant application for MioSalon. There is no multi-tenant isolation requirement in the approved product scope. No tenant_id columns.

### 20.2 User Data Isolation

User-personal records (`bookmarks`, `recently_edited_events`) include `user_id` as a mandatory FK column. Application layer enforces that users can only read their own records. No row-level security policy is required at the DB layer for v1 (team of ~15 users), but the schema is RLS-compatible if needed in future.

### 20.3 Role-Sensitive Data

`admin.user_role_assignments` contains sensitive RBAC data. Database access for reads is unrestricted within the application (all API endpoints check roles). Database access for writes is restricted to the administration service (`admin` schema owner role).

### 20.4 Audit Record Access

Audit records (`system_ops.audit_records`) are readable by all authenticated users (FRD — audit trail is accessible to all roles via API-0904). Database-level read grants are open to the application read role.

### 20.5 Immutability as Security

The `raise_on_delete` and `raise_on_update` (for immutable tables) triggers defined in §13 serve a security function: they prevent both application bugs and operational accidents from destroying historical records. Even a privileged database user cannot delete audit records without explicitly dropping the trigger — an action that would be captured in PostgreSQL's operational logs.

### 20.6 No Sensitive PII in Current Scope

MioTranslate does not store sensitive PII as defined by the approved product scope. User records contain `user_id`, `display_name`, and `email` for internal team members (not salon customers). No encryption-at-rest requirement beyond standard database encryption is imposed by the current product scope.

**Standard-practice encryption:** Disk-level encryption (e.g., AWS EBS encryption) is recommended as an operational baseline. Not modeled in the schema.

### 20.7 Retention Principles

| Record Type | Retention | Deletion Permitted? |
|---|---|---|
| Audit Records | Permanent (no expiry defined in product scope) | No |
| Version History (EC, Translation) | Permanent | No |
| Release History | Permanent | No |
| Comments | Permanent | No |
| Notifications | Permanent (mark-read is the user action, not delete) | No |
| Export Jobs | 24 hours after `READY` (or configurable TTL) | Yes — file purged from object storage; export_jobs row can be soft-expired via status `EXPIRED` |
| Recently-Edited Events | 30 days | Yes — cleanup job deletes rows older than 30 days |
| Migration Files (object storage) | 7 days after `COMPLETED` (configurable) | Yes — file purged from object storage; import_events row permanent |

---

## 21. Operational Principles

### 21.1 Backup Strategy

| Backup Type | Frequency | Retention | Target |
|---|---|---|---|
| **Continuous WAL archiving** | Streaming (near real-time) | 7 days | Object storage (S3-compatible) |
| **Daily base backup** | Every 24 hours | 30 days | Object storage |
| **Weekly full snapshot** | Every 7 days | 90 days | Object storage |
| **Pre-migration snapshot** | Before every schema migration | Until next migration | Object storage |

**Recovery time objective (RTO):** < 1 hour for point-in-time recovery using WAL archiving. MioTranslate is an internal tool — not a customer-facing production system. 1-hour RTO is appropriate.

**Recovery point objective (RPO):** < 5 minutes (WAL archiving interval).

### 21.2 Schema Migration Strategy

All schema changes use **Flyway** (or equivalent versioned migration tool). Rules:

1. Every schema change is a versioned SQL migration file: `V{number}__{description}.sql`
2. Migrations are additive wherever possible: add columns with defaults, add tables, add indexes.
3. Destructive changes (DROP COLUMN, DROP TABLE) require a multi-phase migration: (a) stop writing to the column/table, (b) confirm no reads in production, (c) drop in a subsequent release.
4. Every migration script is reviewed by the Principal Database Architect before execution in production.
5. Migration is run against a staging environment first.
6. **Pre-migration snapshot taken before every production migration** (§21.1).

### 21.3 Index Maintenance

`REINDEX CONCURRENTLY` is available for index rebuild without locking. `VACUUM ANALYZE` runs automatically via `autovacuum`. Manual `VACUUM ANALYZE` is run after bulk operations (migration import, initial language slot creation for a new language).

### 21.4 Long-Running Query Policy

- API response queries: maximum 10-second statement timeout.
- Background job queries (coverage recompute, audit queries): maximum 60-second timeout.
- Migration execution: no timeout (runs to completion with progress logging).
- Bulk slot creation (API-0506 — new language): runs as a background job with batching (1,000 rows per batch, COMMIT between batches).

### 21.5 Read Replica Usage

The hot-standby read replica handles:
- `GET` requests from Group 6 reporting APIs (API-0601, API-0602, API-0603, API-0604, API-0607)
- Audit trail queries (API-0904)
- Activity timeline (API-0605)
- Global search (API-0701)

All writes and read-your-own-writes reads go to the primary. The API layer uses `PRIMARY` session preference for requests immediately following a write (to avoid replication lag returning stale data).

---

## 22. Open Question Resolutions (OQ-1 through OQ-7)

The following resolutions are final decisions for the DB design. They supersede the "open question" status from ED-02 and ED-03.

### OQ-1: `Tag.englishCopyStatus` Denormalization

**Decision:** The `tags` table does **NOT** store a denormalized `english_copy_status` column.

**Rationale:** The Tag entity (Group 1) is the registry of tag identity. English Copy status (Group 2) is Group 2's data. Denormalizing EC status onto Tag creates a guaranteed source of truth consistency problem — any failure in the synchronization path produces silently wrong data visible to all Group 3 operations.

**Implementation:** Group 3 APIs that need to validate English Copy status JOIN to `content.english_copies` directly. The join is on `english_copies.tag_id = tags.tag_id` — a PK-to-PK join, trivially fast. The `english_copies.status` column has an index supporting status-based filtering (`idx_english_copies_status`).

**Impact on Tag Detail API (API-0105):** The Tag Detail response includes English copy status — this is a JOIN in the query, not a denormalized column. One join per tag detail request is acceptable.

---

### OQ-2: Translation Live State vs. Version History Separation

**Decision:** Two **separate tables**:
- `translation.translations` — live state, mutable.
- `translation.translation_versions` — version history, IMMUTABLE_HISTORY.

**Fields on `translation.translations` (live state):**
- `tag_id`, `language_code` (PK)
- `status VARCHAR(50)` — current operational status
- `current_version_number INTEGER` — FK to the current TV row
- `stale_triggered_at`, `stale_current_english_version`, `stale_previous_english_text`, `stale_current_english_text` — staleInfo fields (NULL unless STALE)
- `etag_version INTEGER`
- `created_at`, `updated_at`

**Fields on `translation.translation_versions` (version history):**
- `tag_id`, `language_code`, `version_number` (PK)
- All content snapshot fields: `text`, `creation_method`, `source_english_version`, `confidence_score`, `back_translation`, `variable_integrity_status`, `change_reason`
- All actor fields: `authored_by`, `authored_at`
- All append-once review lifecycle fields: `submitted_for_review_at`, `submitted_for_review_by`, `reviewed_by`, `reviewed_at`, `approved_by`, `approved_at`, `rejection_reason`
- `status` (DRAFT/PENDING_REVIEW/APPROVED/SUPERSEDED/REJECTED)

**The staleInfo fields live on the live state table (`translations`), not on version history.** Stale metadata is operational mutable state, not a version snapshot.

---

### OQ-3: Append-Once Review Fields on Version Records

**Decision:** **In-place fields on the version row** (not separate review-event rows).

**Rationale:** Each version has at most one review lifecycle (submitted → reviewed → approved/rejected). Separate review-event rows add a join for every version history query with no corresponding query-time benefit. The append-once discipline is enforced by the immutability trigger (§13) plus application-layer checks.

**Enforcement:** A `BEFORE UPDATE` trigger on `english_copy_versions` and `translation_versions` verifies:
1. Only `status` and the append-once lifecycle fields change.
2. The immutable content snapshot fields (`text`, `authored_by`, `authored_at`, `creation_method`, `source_english_version`, `confidence_score`, `back_translation`, `change_reason`) never change.
3. A field that is already non-NULL cannot be set to a different non-NULL value.

---

### OQ-4: Coverage Metrics Materialization Strategy

**Decision:** Event-driven incremental update with a background recompute job.

**Implementation:** `reporting.coverage_metrics` is a persistent denormalized table (not a PostgreSQL materialized view) with one row per `(page_id, language_code)`. It has a `computed_at TIMESTAMPTZ` column.

**Why a persistent table over a materialized view:**
- PostgreSQL materialized views require a full `REFRESH MATERIALIZED VIEW` which scans all source rows, not just the changed cells. For 89 pages × 8 languages = 712 cells, a full refresh is fast — but an incremental update is faster and expresses the domain intent more clearly.
- A persistent table allows column-level partial updates (`UPDATE coverage_metrics SET approved_count = $x WHERE page_id = $p AND language_code = $l`), whereas a materialized view is replaced entirely on refresh.

**Rebuild path:** A background job can recompute all cells from scratch using the source query in §18.3. This is the consistency validation path run on demand or after schema migrations.

---

### OQ-5: Access-Event Store for Recently-Edited

**Decision:** Separate persistent table `search.recently_edited_events` as described in §18.9.

- High-write, low-row-count per user.
- Upsert on access: ON CONFLICT UPDATE `last_accessed_at`.
- 30-day retention cleanup job.
- Never queried by any business rule — user-personal display only.

---

### OQ-6: `contentSnapshot` Storage Format

**Decision:** Separate normalized table `publishing.release_content_snapshots` as described in §13.2.

- One row per `(release_id, tag_id)`.
- The Language Services raw API response is retained as JSONB on the main `releases` row for trace purposes.

---

### OQ-7: Audit Record Index Strategy

**Decision:** Three composite indexes on `system_ops.audit_records`:

| Index | Columns | Use Case |
|---|---|---|
| `idx_audit_performed_at` | `(performed_at DESC)` | Timeline queries (newest first) |
| `idx_audit_subject` | `(subject_entity_type, subject_entity_id, performed_at DESC)` | "All audit records for tag X" |
| `idx_audit_user` | `(performed_by_user_id, performed_at DESC)` | "All actions by user Y" |

**Partitioning strategy for the future:** If the audit table grows beyond ~10 million rows (years of operation), partition by `performed_at` in annual ranges. The UUID v7 PK is compatible with range partitioning. The index strategy above remains valid within each partition.

---

## 23. Standards All Subsequent DB Documents Must Follow

The following standards are mandatory for DB-02 through DB-09. Non-compliance requires explicit documented justification.

### 23.1 Schema Assignment

Every table must be in its assigned schema as defined in §2.2. Cross-schema tables require Principal DB Architect approval.

### 23.2 Table Classification Comment

Every table's `CREATE TABLE` statement must include a comment classifying the table per §3.3:
```sql
COMMENT ON TABLE registry.pages IS 'SOURCE_OF_TRUTH: Authoritative record for page identity and lifecycle.';
```

### 23.3 Primary Key

Every table has a primary key as defined in §4 — no table without a PK.

### 23.4 Timestamps

Every permanent table has `created_at TIMESTAMPTZ NOT NULL DEFAULT now()`. Every mutable table additionally has `updated_at TIMESTAMPTZ NOT NULL DEFAULT now()` with the `set_updated_at` trigger applied.

### 23.5 ETag Version

Every mutable Source-of-Truth entity and Governance Record that is exposed to concurrent writes has `etag_version INTEGER NOT NULL DEFAULT 1`.

### 23.6 Immutability Triggers

Every IMMUTABLE_HISTORY table has the `raise_on_update` trigger applied. Every permanent table has the `raise_on_delete` trigger applied (except the four explicitly exempted in §3.1).

### 23.7 Status Constraints

Every `status` column has a `CHECK` constraint listing all permitted values. New status values may not be added without updating the CHECK constraint and documenting the reason.

### 23.8 Enum Value Documentation

Every schema document must include the complete set of permitted values for every `status`, `trigger_source`, `creation_method`, `environment`, and `role` column, with the state machine transitions that are permitted.

### 23.9 No Application Logic in Triggers

Triggers are used only for:
- `updated_at` automatic maintenance
- Immutability enforcement (`raise_on_update`, `raise_on_delete`)
- Comment text immutability
- `tsvector` search vector maintenance (for search index columns)

No business logic (eligibility checks, side-effects, notification dispatch) goes in triggers. Business logic is in the application service layer.

### 23.10 Index Design Requirement

Every DB-0X schema document must include an index design section listing:
- Every index on the table(s) in scope
- The query pattern the index supports
- The index type (B-tree, GIN, partial)

No table may go into production without its index design reviewed.

### 23.11 Column Naming for Actor Fields

- `*_by` columns reference `user_id` (UUID). Named: `created_by`, `authored_by`, `reviewed_by`, `approved_by`, `performed_by_user_id`.
- System-performed actions use `performed_by_source VARCHAR(100)` to record the system action source (e.g., `SYSTEM:AUTO_PUBLISH`) rather than a user FK.

### 23.12 Version Number Columns

All `version_number` columns are `INTEGER NOT NULL` with `CHECK (version_number >= 1)`. They are assigned sequentially by the application with no gaps. Sequence gaps are a history integrity fault.

---

## 24. Consistency Audit against ED-01, ED-02, ED-03, and API Groups 1–10

### 24.1 ED-01 (Canonical Entity Model) Alignment

| ED-01 Entity | DB-01 Coverage | Status |
|---|---|---|
| Page | `registry.pages` table — §2.2, §4.2 | ✅ |
| Tag | `registry.tags` table — §2.2, §4.2, §6 (tag_id prefix constraint) | ✅ |
| English Copy | `content.english_copies` live state table — §3.2, OQ-1, OQ-2 | ✅ |
| English Copy Version | `content.english_copy_versions` IMMUTABLE_HISTORY — §3.2, §13.1, OQ-3 | ✅ |
| Translation | `translation.translations` live state + `translation.translation_versions` history — §3.2, OQ-2 | ✅ |
| Translation Version | `translation.translation_versions` IMMUTABLE_HISTORY — §13.1, OQ-3 | ✅ |
| Language | `admin.languages` — §2.2, §4.2 | ✅ |
| Publishing Approval Request | `publishing.publishing_approval_requests` GOVERNANCE_RECORD — §2.2, §5.1 | ✅ |
| Release | `publishing.releases` IH+MG + `publishing.release_content_snapshots` IH — §2.2, §13.1, OQ-6 | ✅ |
| Import Event | `migration.import_events` GOVERNANCE_RECORD — §2.2, §16.1 | ✅ |
| User | `admin.users` SOURCE_OF_TRUTH — §2.2 | ✅ |
| User Role Assignment | `admin.user_role_assignments` MG+IH — §2.2, §4.3, §6.2 | ✅ |
| Comment | `collaboration.comments` GOVERNANCE_RECORD — §2.2, §13.3 | ✅ |
| Audit Record | `system_ops.audit_records` IH+SE — §2.2, §17, OQ-7 | ✅ |
| Notification | `system_ops.notifications` MG+SE — §2.2 | ✅ |
| Export Job | `collaboration.export_jobs` MG — §2.2, §16.2 | ✅ |
| Coverage Metrics | `reporting.coverage_metrics` DR — §18.3, OQ-4 | ✅ |
| System Configuration | `admin.system_configuration` ST — §4.4 | ✅ |
| Bookmark | `search.bookmarks` UP — §3.1, §6.2 | ✅ |
| Recently-Edited | `search.recently_edited_events` UP+DR — §18.9, OQ-5 | ✅ |

### 24.2 ED-02 Lifecycle and Invariant Alignment

| ED-02 Requirement | DB-01 Coverage | Status |
|---|---|---|
| Version number sequential, no gaps | §4.3, §23.12 | ✅ |
| `staleInfo` on live Translation state | OQ-2: explicit columns on `translation.translations`, not on version rows | ✅ |
| EC status progression enforced | CHECK constraints (§9), partial unique index for single APPROVED (§6.2) | ✅ |
| PAR uniqueness per scope when PENDING | Partial unique index (§6.2, XI-20) | ✅ |
| Release contentSnapshot immutable | Separate `release_content_snapshots` table with immutability trigger (OQ-6, §13.2) | ✅ |
| Rollback creates new Release, old → ROLLED_BACK | `releases.status` UPDATE is the one permitted exception to IMMUTABLE_HISTORY for Releases (§13.1) | ✅ |
| Audit write within same transaction as primary op | §12.3 | ✅ |
| Notification dispatch outside transaction | §12.3 | ✅ |
| Admin-lockout guard | Application layer only (§11.2 — count-based rule, not DB-enforceable) | ✅ |
| Migration: two discriminator flags only | `translation_versions.creation_method = 'MIGRATED'`, `releases.trigger_source = 'MIGRATION'` (§9.2) | ✅ |

### 24.3 ED-03 Cross-Domain Invariant Alignment

| ED-03 Invariant Group | DB-01 Coverage | Status |
|---|---|---|
| XI-01 to XI-10: Identity uniqueness | §6.1 — all 10 enforced via PK or UNIQUE constraints | ✅ |
| XI-11 to XI-14: Language isolation | Schema separation by `language_code` FK; no cross-language JOIN paths in business logic | ✅ |
| XI-15 to XI-18: English-to-translation lineage | `source_english_version` FK on translation_versions (§5.1); NOT NULL for all non-MIGRATED TVs | ✅ |
| XI-19: Single APPROVED EC Version per tag | Partial unique index (§6.2) | ✅ |
| XI-20: Single PENDING PAR per scope | Partial unique index (§6.2) | ✅ |
| XI-21: Release requires APPROVED PAR | Application layer check + nullable FK (`approval_request_id NULL` for system/migration triggers) — §5.1 | ✅ |
| XI-22: Bundle hash match | Application layer check at API-0404 time — no DB-level hash comparison possible | ✅ ⚠️ (app layer only) |
| XI-23 to XI-27: Release/snapshot invariants | release_content_snapshots IMMUTABLE_HISTORY (§13.2), ROLLED_BACK single permitted transition (§13.1) | ✅ |
| XI-28 to XI-30: Migration exceptions | creation_method, trigger_source CHECK constraints (§9.2) | ✅ |
| XI-31 to XI-32: Audit invariants | raise_on_delete trigger on audit_records; audit within same transaction (§12.3, §13) | ✅ |
| XI-33 to XI-34: Derived model invariants | computed_at timestamp on coverage_metrics, no FK from source tables to derived tables (§18.2) | ✅ |

### 24.4 API Group Coverage

| API Group | DB-01 Support | Notes |
|---|---|---|
| Group 1: Pages & Tags | `registry` schema | Tag prefix constraint (§6.1 XI-02), page cascade (§12.2) |
| Group 2: English Copy | `content` schema + live state / version separation (OQ-2) | Partial unique on APPROVED (§6.2) |
| Group 3: Translation | `translation` schema + staleInfo on live state (OQ-2) | Language isolation FK |
| Group 4: Publishing | `publishing` schema + `release_content_snapshots` (OQ-6) | PAR partial unique (§6.2) |
| Group 5: System-Triggered | `system_ops` schema: audit_records, notifications, coverage_metrics | ETA-driven coverage (OQ-4) |
| Group 6: Visibility & Reporting | `reporting` schema: live queries + coverage_metrics | §18.3–18.7 |
| Group 7: Search & Navigation | `search` schema: bookmarks, recently_edited_events, tsvector | §18.8, §18.9, OQ-5 |
| Group 8: Administration | `admin` schema: users, roles, languages, system_config | Partial unique on active roles (§6.2) |
| Group 9: Comments, Audit & Export | `collaboration` schema: comments, export_jobs | `system_ops.audit_records` is the read source for API-0904 |
| Group 10: Migration | `migration` schema: import_events | File storage in object storage (§16.1) |

### 24.5 Physical DB Requirements Not Previously in Entity Model

The following requirements are identified here for the first time and must be incorporated into DB-02 through DB-09 schema documents:

| # | Requirement | Origin | Action |
|---|---|---|---|
| DB-R-01 | `tag_id LIKE page_id || '_'` prefix constraint on `tags` | API-0102 validation | Add `CHECK` constraint in DB-02 (registry schema) |
| DB-R-02 | `tsvector` search index columns on `tags` and `english_copies` | API-0701 search requirement | Add generated column + GIN index in DB-02 and DB-03 |
| DB-R-03 | `recently_edited_events` table with upsert + 30-day retention | API-0705 | Define in DB-07 (search schema) |
| DB-R-04 | `release_content_snapshots` as separate normalized table | OQ-6 resolution | Define in DB-04 (publishing schema) |
| DB-R-05 | `api_response_payload JSONB` on `releases` for Language Services response trace | API-0405 audit requirements | Define in DB-04 |
| DB-R-06 | `file_reference_url TEXT` on `import_events` and `export_jobs` (not binary columns) | §16.1, §16.2 | Define in DB-09 (migration) and DB-08 (collaboration) |
| DB-R-07 | `system_configuration` as key-value table, not single-row singleton | §4.4 decision | Define in DB-08 (admin schema) |
| DB-R-08 | `etag_version` on PAR, EC live state, Translation live state, system_config | §11 | Apply in respective schema documents |
| DB-R-09 | Partial unique index for single PROCESSING import event | §11.2 concurrent migration guard | Define in DB-09 |
| DB-R-10 | Partial unique index for in-flight Releases per scope | §11.2 concurrent implicit publish guard | Define in DB-04 |

---

*End of MioTranslate — Database Architecture & Standards — DB-01 v1.0*

*This document is the foundation for all subsequent schema design documents:*  
*DB-02 — Registry Schema (Pages & Tags)*  
*DB-03 — Content Schema (English Copy)*  
*DB-04 — Publishing Schema (Releases & PAR)*  
*DB-05 — Translation Schema*  
*DB-06 — System Operations Schema (Audit, Notifications, Coverage)*  
*DB-07 — Search & Navigation Schema*  
*DB-08 — Administration Schema*  
*DB-09 — Collaboration, Export & Migration Schema*
