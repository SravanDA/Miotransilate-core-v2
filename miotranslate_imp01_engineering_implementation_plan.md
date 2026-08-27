# MioTranslate — IMP-01: Engineering Implementation Plan

**Product:** MioTranslate  
**Document Type:** Engineering Implementation Plan  
**Document ID:** IMP-01  
**Version:** 1.0  
**Author:** Principal Engineering Manager + Principal Backend Architect + Technical Program Lead  
**Date:** August 2026  

**Governing Baseline (all locked and studied before authoring):**  
BRD, FRD (all sections, F-01–F-21, 19 User Flows), UX Flows, IA / Page Hierarchy, API List (63 owned APIs, 10 domains), API Design Groups 1–10 (locked), Full API Architecture Audit + Resolutions, ED-01 v1.1, ED-02 v1.0, ED-03 v1.0, DB-01 through DB-06, Final DB Architecture Audit (DB-AUDIT-FINAL v1.1), SYS-01 v1.0

---

> **Purpose of this document.**  
> IMP-01 converts the approved MioTranslate architecture into a practical, dependency-correct engineering implementation sequence. It answers: *What do we build first, what depends on what, what can be built in parallel, how do we validate each phase, and what exactly constitutes completion?*
>
> **This document does not:**  
> - Redesign any locked product behaviour, API contract, entity model, database schema, or system architecture.  
> - Reopen architectural decisions.  
> - Produce code, Jira tickets, or deployment manifests.  
> - Invent features not in the approved baseline.  
> - Assume arbitrary timelines unless the baseline documents specify them.

---

## Table of Contents

1. [Implementation Dependency Graph](#1-implementation-dependency-graph)
2. [Phase Overview](#2-phase-overview)
3. [Phase 0 — Engineering Foundation](#3-phase-0--engineering-foundation)
4. [Phase 1 — Database & Schema Foundation](#4-phase-1--database--schema-foundation)
5. [Phase 2 — Core Content Domain](#5-phase-2--core-content-domain)
6. [Phase 3 — Translation Domain](#6-phase-3--translation-domain)
7. [Phase 4 — Publishing & Deployment](#7-phase-4--publishing--deployment)
8. [Phase 5 — System-Triggered Behaviours](#8-phase-5--system-triggered-behaviours)
9. [Phase 6 — Administration & Configuration](#9-phase-6--administration--configuration)
10. [Phase 7 — Visibility, Reporting, Search & Collaboration](#10-phase-7--visibility-reporting-search--collaboration)
11. [Phase 8 — Migration](#11-phase-8--migration)
12. [Phase 9 — Frontend Implementation](#12-phase-9--frontend-implementation)
13. [Phase 10 — Production Hardening & Release](#13-phase-10--production-hardening--release)
14. [Critical Workflow Validation Matrix](#14-critical-workflow-validation-matrix)
15. [Async Job Implementation Plan](#15-async-job-implementation-plan)
16. [External Integration Implementation Plan](#16-external-integration-implementation-plan)
17. [Testing Strategy](#17-testing-strategy)
18. [Migration & Deployment Plan](#18-migration--deployment-plan)
19. [Parallelization Matrix](#19-parallelization-matrix)
20. [Delivery Dependencies](#20-delivery-dependencies)
21. [Risk Register](#21-risk-register)
22. [Release Milestones](#22-release-milestones)
23. [Final Traceability Matrix](#23-final-traceability-matrix)
24. [Implementation Start Checklist](#24-implementation-start-checklist)

---

## 1. Implementation Dependency Graph

### 1.1 Why Not API Group Order?

The API Groups (1–10) are specification boundaries, not implementation boundaries. The actual implementation order is determined by:

1. **Data dependencies** — You cannot build English Copy (Group 2) without Pages & Tags (Group 1), and you cannot build Translation (Group 3) without English Copy.
2. **Infrastructure dependencies** — You cannot build any API without the auth/audit/ETag framework, and you cannot build any domain module without database schemas.
3. **External integration dependencies** — Publishing (Group 4) requires Language Services client; Translation (Group 3) requires AI Translation client.
4. **Cross-module dependencies** — System-Triggered Behaviours (Group 5) depends on Groups 1–4 being functionally complete because it orchestrates side-effects across all of them.
5. **Derived model dependencies** — Reporting (Group 6) reads from source tables populated by Groups 1–4. Search (Group 7) indexes data from Groups 1–3.

### 1.2 Dependency Graph

```
Phase 0: Engineering Foundation
  │  Repository, CI/CD, environments, project scaffold
  │
  ▼
Phase 1: Database & Schema Foundation ─────────────────────────────────────┐
  │  Flyway, all schemas (DB-01–06), PgBouncer, triggers, indexes          │
  │                                                                        │
  ▼                                                                        │
Phase 2: Core Content Domain                                               │
  │  Auth middleware, audit framework, ETag framework,                     │
  │  Group 1 (Registry), Group 2 (English Copy)                            │
  │  ► First end-to-end: Page → Tag → English Draft → Approve             │
  │                                                                        │
  ├──────────────────────────────────────────────────┐                     │
  ▼                                                  ▼                     │
Phase 3: Translation Domain              Phase 6: Admin & Config           │
  │  Group 3 (Translation)                  │  Group 8 (Admin)              │
  │  AI Translation client                  │  Users, Roles, Languages,    │
  │  ► First translation workflow           │  Config                       │
  │                                         │                              │
  ├─────────────────────────┐               │                              │
  ▼                         ▼               ▼                              │
Phase 4: Publishing   Phase 5: System-   (feeds into Phase 5)             │
  │  Group 4             Triggered                                         │
  │  Language Services   Group 5                                           │
  │  client              Stale cascade,                                    │
  │  3-Phase Commit      implicit publish,                                 │
  │  ► Pub pipeline      coverage, notify                                  │
  │                      ► Background worker                               │
  │                                                                        │
  ├──────────────────────────┐                                             │
  ▼                          ▼                                             │
Phase 7: Reporting,    Phase 8: Migration                                  │
  Search, Collab          Group 10                                         │
  Groups 6, 7, 9          One-time import                                  │
  Dashboard, Search,      ► Bootstrap from                                 │
  Comments, Export,         Language Services                               │
  Notifications UI                                                         │
  │                          │                                             │
  └──────────┬───────────────┘                                             │
             ▼                                                             │
Phase 9: Frontend Implementation ◄─────────────────────────────────────────┘
  │  SPA shell, all IA surfaces, integration with all API Groups           │
  │  (Frontend work starts in Phase 2 and grows incrementally)             │
  │                                                                        │
  ▼                                                                        │
Phase 10: Production Hardening & Release
     Observability, security audit, staging validation,
     production migration, operational readiness
```

---

## 2. Phase Overview

| Phase | Name | Scope | Entry Criteria | Exit Criteria |
|---|---|---|---|---|
| **0** | Engineering Foundation | Repository, CI/CD, environments, project scaffold | Decision on technology stack (language/framework) confirmed | Clean build, CI pipeline runs, dev environment boots |
| **1** | Database & Schema | All Flyway migrations (DB-01–06), PgBouncer, triggers | Phase 0 complete; PostgreSQL provisioned | All schemas created; triggers verified; seed data loaded |
| **2** | Core Content Domain | Auth, Audit, ETag, Group 1 (Registry), Group 2 (English Copy) | Phase 1 complete | Page → Tag → English Draft → Approve flow works end-to-end |
| **3** | Translation Domain | Group 3 (Translation), AI Translation client | Phase 2 complete; AI Translation contract available | Single tag translate → review → approve flow works |
| **4** | Publishing & Deployment | Group 4 (Publishing), Language Services client | Phase 3 complete; Language Services endpoints accessible | Dev/QA/Production publish + rollback flow works |
| **5** | System-Triggered Behaviours | Group 5 (Background Worker), all 6 async job types | Phases 2–4 complete | Stale cascade, implicit publish, coverage, notifications all verified |
| **6** | Administration & Config | Group 8 (Admin) | Phase 2 complete (can run in parallel with Phase 3) | User/Role CRUD, Language add/deactivate, Config get/update |
| **7** | Reporting, Search, Collaboration | Groups 6, 7, 9 | Phases 2–5 complete (source data must be flowing) | Dashboard, Search, Comments, Export, Notifications UI |
| **8** | Migration | Group 10 | Phases 1–6 complete (all target schemas must exist) | Upload → Execute → Report flow works; staging dry-run passes |
| **9** | Frontend Implementation | Complete SPA across all IA surfaces | Backend APIs for each surface available | All 19 User Flows executable in the UI |
| **10** | Production Hardening | Observability, security, staging, production readiness | Phases 0–9 complete | Production readiness checklist passes |

---

## 3. Phase 0 — Engineering Foundation

### 3.0 Objective
Establish the repository, project structure, CI/CD pipeline, and development environments so the team can begin implementation.

### 3.1 Scope

| Deliverable | Details | Reference |
|---|---|---|
| **Repository setup** | Monorepo structure per SYS-01 §6.1. Backend modules + shared layer + worker entry point + frontend SPA. | SYS-01 §6.1 |
| **Build system** | Build configuration for both API Server and Background Worker entry points (same codebase, two targets). | SYS-01 §3.2 |
| **CI/CD pipeline** | Build → Unit Test → Lint → Integration Test (DB required) → Docker image → Deploy to Dev. | — |
| **Development environment** | Docker Compose: PostgreSQL 16+, PgBouncer, API Server, Background Worker, Object Storage (MinIO). | SYS-01 §4, §12 |
| **Configuration framework** | Environment variable loading, config file parsing, per-environment overrides. | SYS-01 §12.4 |
| **Logging framework** | Structured JSON logging with `requestId`, `userId`, `module`, `action`, `duration_ms`. | SYS-01 §14.1 |
| **Health check endpoints** | `GET /health`, `GET /health/ready`, `GET /health/live`. | SYS-01 §14.3 |

### 3.2 Outputs
- Working repository with modular backend structure matching SYS-01 §6.1
- CI pipeline building and running initial (empty) test suite
- Docker Compose environment bootstrapping API Server, Worker, PostgreSQL, PgBouncer, MinIO
- Health check endpoints returning 200

### 3.3 Validation
- `docker compose up` starts all services without errors
- `GET /health` returns 200
- CI pipeline completes green on empty test suite

### 3.4 Definition of Done
- [ ] Repository created with SYS-01 §6.1 directory structure
- [ ] CI/CD pipeline configured and running
- [ ] Docker Compose environment works end-to-end
- [ ] Configuration loading works for dev/staging/production profiles
- [ ] Structured logging emits valid JSON
- [ ] Health check endpoints respond correctly

---

## 4. Phase 1 — Database & Schema Foundation

### 4.0 Objective
Create the complete physical database from DB-01 through DB-06 using Flyway migration scripts, including all schemas, tables, indexes, constraints, triggers, and seed data.

### 4.1 Scope

#### 4.1.1 Flyway Migration Sequence

The Flyway migration scripts must be ordered to respect foreign key dependencies. The following sequence satisfies all referential integrity constraints:

| Migration | Schema | Tables/Objects | Source Document |
|---|---|---|---|
| `V001__create_schemas.sql` | All 10 schemas | Schema creation (`registry`, `content`, `translation`, `publishing`, `system_ops`, `reporting`, `search`, `admin`, `collaboration`, `migration`) | DB-01 §2.2 |
| `V002__admin_foundation.sql` | `admin` | `languages`, `users`, `user_role_assignments`, `system_configuration` | DB-02 §8 |
| `V003__registry.sql` | `registry` | `pages`, `tags` (with generated `search_vector` columns) | DB-02 §3 |
| `V004__content.sql` | `content` | `english_copies`, `english_copy_versions` | DB-02 §4, DB-03 §3 |
| `V005__translation.sql` | `translation` | `translations`, `translation_versions` (with `DEFERRABLE INITIALLY DEFERRED` FK per P1-03) | DB-02 §5, DB-03 §4 |
| `V006__publishing.sql` | `publishing` | `publishing_approval_requests`, `releases`, `release_content_snapshots` | DB-02 §6, DB-03 §5 |
| `V007__system_ops.sql` | `system_ops` | `audit_records`, `notifications` | DB-03 §4, DB-02 §9 |
| `V008__collaboration.sql` | `collaboration` | `comments`, `export_jobs` | DB-02 §10 |
| `V009__reporting.sql` | `reporting` | `coverage_metrics` | DB-04 §2 |
| `V010__search.sql` | `search` | `bookmarks`, `recently_edited_events` | DB-04 §8 |
| `V011__migration.sql` | `migration` | `import_events`, `migration_row_events` | DB-05 §3 |
| `V012__immutability_triggers.sql` | All applicable | `raise_on_update()`, `raise_on_delete()` triggers on all immutable tables | DB-01 §13, DB-03 |
| `V013__indexes.sql` | All | All 60+ indexes from DB-06 master index catalog, including P1-01 GIN index on `registry.pages.search_vector` | DB-06 §2, DB-AUDIT P1-01 |
| `V014__partial_unique_indexes.sql` | `publishing`, `migration` | `par_pending_unique`, `import_events_active_unique`, `releases_inflight_unique` | DB-06 §3 |
| `V015__check_constraints.sql` | All | All CHECK constraints: status enums, trigger_source (P2-04), naming conventions | DB-02, DB-AUDIT P2-04 |
| `V016__seed_data.sql` | `admin` | Seed: 8 active languages (ar, bg, it, fr-CA, es, de, tr + en as reference), system configuration defaults (confidence threshold = 95%) | FRD §4.5, API-0805 |

#### 4.1.2 DB Audit Corrections (Incorporated in Migrations)

| Audit Finding | Migration | Implementation |
|---|---|---|
| P1-01: Missing GIN index on `registry.pages.search_vector` | V013 | `CREATE INDEX idx_pages_search_vector ON registry.pages USING GIN (search_vector);` |
| P1-03: Deferred FK on `translation_versions.source_english_version` | V005 | `DEFERRABLE INITIALLY DEFERRED` on FK constraint |
| P2-02: Missing index on `reporting.coverage_metrics(language_code)` | V013 | `CREATE INDEX idx_coverage_language ON reporting.coverage_metrics (language_code);` |
| P2-03: Missing index on `search.recently_edited_events(last_accessed_at)` | V013 | `CREATE INDEX idx_recently_edited_cleanup ON search.recently_edited_events (last_accessed_at);` |
| P2-04: CHECK constraint on `publishing.releases.trigger_source` | V015 | `CHECK (trigger_source IN ('USER_INITIATED', 'SYSTEM_AUTO_DEV', 'MIGRATION', 'ROLLBACK'))` |

#### 4.1.3 PgBouncer Configuration

| Setting | Value | Reference |
|---|---|---|
| Pool mode | Transaction | DB-01 §2.4, SYS-01 §8.2 |
| API Server pool | 10–20 connections | SYS-01 §8.2 |
| Worker pool | 5–10 connections | SYS-01 §8.2 |
| Statement timeout (API) | 10 seconds | SYS-01 §8.2 |
| Statement timeout (Worker) | 60 seconds | SYS-01 §8.2 |

### 4.2 Dependencies
- Phase 0 complete (PostgreSQL provisioned in Docker Compose)

### 4.3 Outputs
- 16+ Flyway migration scripts creating the complete physical database
- PgBouncer configured and connecting
- All immutability triggers tested and verified
- Seed data loaded

### 4.4 Validation

| Test | Method |
|---|---|
| All migrations run cleanly | `flyway migrate` from empty database produces zero errors |
| Immutability triggers fire | Attempt `UPDATE` on `audit_records` → exception raised |
| Immutability triggers fire | Attempt `DELETE` on `english_copy_versions` → exception raised |
| Partial unique indexes enforce uniqueness | Attempt duplicate PENDING PAR for same (page, lang, env) → constraint violation |
| CHECK constraints enforce enums | Attempt invalid status value → constraint violation |
| Foreign keys enforce integrity | Attempt tag creation without page → FK violation |
| `DEFERRABLE` FK works | Within SERIALIZABLE tx, insert EC and TV referencing each other in deferred mode → succeeds |
| Seed data present | Query `admin.languages` → 8 rows; Query `admin.system_configuration` → defaults present |

### 4.5 Definition of Done
- [ ] All Flyway migrations execute cleanly from empty database
- [ ] All immutability triggers verified (UPDATE/DELETE blocked on immutable tables)
- [ ] All partial unique indexes verified
- [ ] All CHECK constraints verified
- [ ] All foreign keys verified (including deferred FK)
- [ ] PgBouncer transaction pooling verified
- [ ] Seed data loaded and queryable
- [ ] Migration scripts reviewed by DBA

---

## 5. Phase 2 — Core Content Domain

### 5.0 Objective
Build the foundational backend infrastructure (auth, audit, ETag, error handling, correlation) and the first two domain modules (Registry + English Copy), enabling the first end-to-end content workflow: Page → Tag → English Draft → Submit → Approve.

### 5.1 Scope

#### 5.1.1 Cross-Cutting Infrastructure (shared layer)

| Component | Module | Details | Reference |
|---|---|---|---|
| **Authentication middleware** | `shared/auth` | Token validation (JWT or opaque), user identity extraction, `Authorization: Bearer` header parsing | SYS-01 §11.1 |
| **Authorization middleware** | `shared/auth` | RBAC enforcement: coarse-grained (endpoint-level) + fine-grained (service-level) per FRD §8 permission matrix | SYS-01 §11.2 |
| **Audit service** | `shared/audit` | `AuditService.record(action, subject, performedBy, beforeValue, afterValue, correlationId)` — writes `system_ops.audit_records` within the caller's transaction | SYS-01 §6.2, GP-05 |
| **ETag/concurrency framework** | `shared/concurrency` | `If-Match` header parsing, `etag_version` comparison, `409 Conflict` response generation with latest entity snapshot | SYS-01 §16.1, DB-01 §11, DB-AUDIT P0-02 |
| **Error handler** | `shared/error` | Standardized error envelope: `{ "error": { "code": "...", "message": "...", "details": [...] } }`. Exception-to-HTTP mapping. | SYS-01 §7.1 |
| **Request correlation** | `shared/correlation` | Generate `X-Request-Id` if not present. Attach to MDC/request context. Propagate to audit records and logs. | SYS-01 §7.3, §14.1 |
| **Pagination utilities** | `shared/pagination` | Cursor-based and offset pagination helpers for list endpoints. | SYS-01 §7.1 |
| **Job queue dispatcher** | `shared/job` | `JobService.enqueue(jobType, payload)` — inserts into `job_queue` table within caller's transaction. | SYS-01 §9.1 |

#### 5.1.2 Group 1: Registry Module (Pages & Tags)

| API | Operation | Key Implementation Notes |
|---|---|---|
| **API-0101** Create Page | `POST /v1/pages` | Validate unique `page_id`. Insert `registry.pages`. Audit record. |
| **API-0102** Create Tag(s) | `POST /v1/pages/{pageId}/tags` | SERIALIZABLE tx: insert `registry.tags` + init `content.english_copies` (NO_COPY) + init `translation.translations` (NO_TRANSLATION × active languages). Audit per tag. |
| **API-0103** List Pages | `GET /v1/pages` | Paginated, filterable (module, status, coverage). Joins to aggregate per-language summaries. |
| **API-0104** Get Page Detail | `GET /v1/pages/{pageId}` | Page header + paginated tag list. Batch JOIN to avoid N+1 (P2-05). |
| **API-0105** Get Tag Detail | `GET /v1/tags/{tagId}` | Tag + EC status + per-language translation status + comment count + deployment status. |
| **API-0106** Update Page Metadata | `PATCH /v1/pages/{pageId}` | ETag validation. Update `page_name`, `module`. Audit record. |
| **API-0107** Deprecate Tag | `POST /v1/tags/{tagId}/deprecate` | Set tag DEPRECATED. Evaluate page deprecation cascade. Audit. |
| **API-0108** Update Tag Metadata | `PATCH /v1/tags/{tagId}` | ETag validation. Update `copy_type`. Audit. |

**Critical implementation notes for Group 1:**
- API-0102 is the most complex Group 1 API. It atomically creates the tag, the English Copy entity (NO_COPY state), and Translation slots for all active languages. This is a SERIALIZABLE transaction (SYS-01 §8.3 Pattern 3).
- API-0107 must evaluate whether all tags on the page are now deprecated; if so, deprecate the page too (FRD §4.1 lifecycle).

#### 5.1.3 Group 2: English Copy Module (Content)

| API | Operation | Key Implementation Notes |
|---|---|---|
| **API-0201** Save English Copy Draft | `PUT /v1/tags/{tagId}/english-copy/draft` | ETag validation on `english_copies`. Create/update `english_copy_versions` (DRAFT). Update `english_copies` status. Audit. |
| **API-0202** Submit for Review | `POST /v1/tags/{tagId}/english-copy/submit` | Validate DRAFT exists. Transition to PENDING_REVIEW. Dispatch NOTIFICATION_DISPATCH job (post-commit). Audit. |
| **API-0203** Review English Copy | `POST /v1/tags/{tagId}/english-copy/review` | Four actions: APPROVE, REJECT, RETURN_FOR_REVISION, ESCALATE. On APPROVE: SERIALIZABLE tx, update version APPROVED, prior version SUPERSEDED, dispatch STALE_CASCADE + IMPLICIT_DEV_PUBLISH jobs if text changed. Audit. |
| **API-0204** Get English Copy Version History | `GET /v1/tags/{tagId}/english-copy/versions` | Read-only. Version list with comparison support. |

**Critical implementation notes for Group 2:**
- API-0203 APPROVE is the single most complex API in MioTranslate. It must: validate ETag, transition version states, detect text change, and dispatch async jobs (stale cascade, implicit publish, notification) post-commit. The stale cascade and implicit publish are dispatched as async jobs — not executed synchronously (SYS-01 §9.4). The audit record IS written synchronously in the same transaction (GP-05).

### 5.2 Dependencies
- Phase 1 complete (all database schemas exist)
- Authentication provider integration details confirmed (OIDC issuer, client credentials)

### 5.3 Outputs
- Complete cross-cutting infrastructure (auth, audit, ETag, error, correlation, pagination, job queue)
- Group 1 Registry module: 8 APIs fully implemented
- Group 2 English Copy module: 4 APIs fully implemented
- First end-to-end workflow executable: Create Page → Create Tag → Save Draft → Submit → Approve

### 5.4 Validation

| Test | Method |
|---|---|
| Page creation | POST → 201, verify DB row, verify audit record |
| Tag creation with side-effects | POST tag → verify EC (NO_COPY) created, verify Translation slots created for all 8 languages |
| English Copy draft/submit/approve | Full lifecycle through all states |
| ETag concurrency | Two concurrent updates → second returns 409 with latest snapshot |
| Audit trail completeness | Every write operation has a corresponding audit record with correct action, before/after values |
| Authorization enforcement | DEV role cannot author English copy → 403 |
| Error format consistency | Invalid request → standardized error envelope |

### 5.5 Definition of Done
- [ ] All 12 APIs (8 Group 1 + 4 Group 2) pass contract tests
- [ ] Cross-cutting audit: every write produces an audit record
- [ ] ETag concurrency verified on all mutation endpoints
- [ ] Authorization verified for all roles against the permission matrix
- [ ] Page → Tag → EC Draft → Submit → Approve workflow passes end-to-end
- [ ] Job queue dispatcher working (jobs enqueued but not yet consumed — Worker comes in Phase 5)

---

## 6. Phase 3 — Translation Domain

### 6.0 Objective
Build the Translation module (Group 3) and the AI Translation Service client, enabling the translation workflow: Generate AI Translation → Review → Approve.

### 6.1 Scope

#### 6.1.1 AI Translation Service Client (`shared/integration`)

| Component | Details | Reference |
|---|---|---|
| **AI Translation HTTP Client** | Abstracted client interface. Request: source text, target language, context (page, module, copy type). Response: translated text, back-translation, confidence score, variable integrity status. | SYS-01 §10.3, API List §4.2 |
| **3-Phase Commit wrapper** | Phase 1: Set Translation to PENDING_AI (in DB tx). Phase 2: Call AI service (outside tx). Phase 3: Save result, set status DRAFT (in new DB tx). | SYS-01 §8.3 Pattern 4, GP-02 |
| **Timeout configuration** | Connect: 30s, Read: 120s. | SYS-01 §10.1 |
| **Circuit breaker** | 5 failures/60s → open 30s → half-open probe. | SYS-01 §13.3 |
| **Mock/stub for testing** | In-memory mock returning canned translations for integration tests. | — |

#### 6.1.2 Group 3: Translation Module

| API | Operation | Key Implementation Notes |
|---|---|---|
| **API-0301** Generate AI Translation (Single) | `POST /v1/tags/{tagId}/translations/{lang}/generate` | Validate EC is APPROVED. 3-Phase Commit for AI call. Create `translation_versions` (DRAFT). Update `translations`. Audit. |
| **API-0302** Generate AI Translations (Bulk) | `POST /v1/pages/{pageId}/translations/{lang}/generate-all` | Identify eligible tags. Loop AI calls per tag (3-Phase each). Progress tracking for large pages. Audit per tag. |
| **API-0303** Edit Translation Manually | `PUT /v1/tags/{tagId}/translations/{lang}/draft` | ETag validation. Create/update `translation_versions` (creation_method=MANUAL). Audit. |
| **API-0304** Review Translation | `POST /v1/tags/{tagId}/translations/{lang}/review` | Four actions: APPROVE, EDIT_AND_APPROVE, REQUEST_RETRANSLATION, REJECT. On APPROVE: dispatch IMPLICIT_DEV_PUBLISH job. Audit. |
| **API-0305** Bulk Approve Translations | `POST /v1/pages/{pageId}/translations/{lang}/bulk-approve` | Validate confidence threshold (from `system_configuration`). Exclude variable integrity failures. Per-tag audit records. |
| **API-0306** Resolve Stale — Confirm | `POST /v1/tags/{tagId}/translations/{lang}/confirm-stale` | Validate STALE state. Transition to APPROVED. Record confirmed-against English version. Audit. |
| **API-0307** Resolve Stale — Retranslate | `POST /v1/tags/{tagId}/translations/{lang}/retranslate` | 3-Phase Commit for AI call. Preserve stale version in history. New version as DRAFT. Audit. |
| **API-0308** Get Translation Version History | `GET /v1/tags/{tagId}/translations/{lang}/versions` | Read-only. |
| **API-0309** Submit Translation for Review | `POST /v1/tags/{tagId}/translations/{lang}/submit` | Validate DRAFT state. Transition to PENDING_REVIEW. Dispatch notification. Audit. |

**Critical implementation notes for Group 3:**
- All mutation endpoints must implement ETag-based `409 Conflict` handling per DB-AUDIT P0-02.
- AI Translation calls MUST follow 3-Phase Commit (GP-02).
- API-0304 APPROVE dispatches IMPLICIT_DEV_PUBLISH as an async job post-commit.

### 6.2 Dependencies
- Phase 2 complete (auth, audit, ETag, Registry, English Copy all working)
- AI Translation Service contract available (API endpoint, request/response schema)
  - **If contract not finalized:** Implement behind an interface with a mock. The mock returns realistic canned data with confidence scores and back-translations. The interface is swapped when the real contract is available.

### 6.3 Outputs
- Group 3 Translation module: 9 APIs fully implemented
- AI Translation Service client (or mock) integrated
- Translation workflow executable: Generate → Review → Approve

### 6.4 Validation

| Test | Method |
|---|---|
| AI translation generation (single) | POST → verify DRAFT translation created with confidence, back-translation |
| AI translation generation (bulk) | POST → verify all eligible tags translated, skipped tags reported |
| Manual edit | PUT → verify manual creation method, version history |
| Review actions (all 4) | Verify state transitions and audit for each action |
| Bulk approve with threshold | Verify confidence filtering, variable integrity exclusion |
| Stale confirm | Verify STALE → APPROVED transition with confirmation record |
| Stale retranslate | Verify new DRAFT version, stale version preserved in history |
| 3-Phase Commit | Verify external call occurs outside DB transaction; verify FAILED status on timeout |
| 409 Conflict handling | Concurrent translation edits → second returns 409 |

### 6.5 Definition of Done
- [ ] All 9 Group 3 APIs pass contract tests
- [ ] AI Translation client working (real or mock)
- [ ] 3-Phase Commit pattern verified (external call outside transaction)
- [ ] ETag/409 handling verified on all mutation endpoints
- [ ] Generate → Submit → Review → Approve workflow passes end-to-end
- [ ] Stale confirm and retranslate workflows pass

---

## 7. Phase 4 — Publishing & Deployment

### 7.0 Objective
Build the Publishing module (Group 4) and the Language Services client, enabling the complete publishing pipeline: Request → Approve → Execute (3-Phase Commit) → Record, and Rollback.

### 7.1 Scope

#### 7.1.1 Language Services Client (`shared/integration`)

| Component | Details | Reference |
|---|---|---|
| **Language Services HTTP Client** | `POST /multilingual/bulkImportPages`. Per-environment endpoint URLs loaded from `admin.system_configuration`. | SYS-01 §10.2, API List §4.1 |
| **Payload constructor** | Builds payload per AF-1–AF-10: `{ domain, pageId, pageName, tags: [{ tagName, values: { lang: text } }] }`. | API List §4.1 |
| **Response parser** | Extracts per-language status from response (AF-10). Classifies success/partial failure/full failure. | API List AF-9, AF-10 |
| **3-Phase Commit wrapper** | Same pattern as AI client. Phase 1: Release → PENDING. Phase 2: HTTP POST. Phase 3: Release → SUCCESSFUL/FAILED. | SYS-01 §8.3 Pattern 4 |
| **Timeout configuration** | Connect: 30s, Read: 60s. | SYS-01 §10.1 |
| **Circuit breaker** | Same config as AI client. | SYS-01 §13.3 |
| **Raw response persistence** | Full raw API response stored as JSONB in `releases.api_response_payload`. | DB-01 §19.1 |

#### 7.1.2 Group 4: Publishing Module

| API | Operation | Key Implementation Notes |
|---|---|---|
| **API-0401** Get Environment Status | `GET /v1/pages/{pageId}/languages/{lang}/environments` | Read-only. Per-environment: current version, date, published_by. |
| **API-0402** Get Pre-Publishing Summary | `GET /v1/pages/{pageId}/languages/{lang}/environments/{env}/preview` | Compare approved content vs last successful release. Return diff. |
| **API-0403** Request Publishing Approval | `POST /v1/pages/{pageId}/languages/{lang}/environments/{env}/approval-requests` | Compute bundle hash. Insert PAR (PENDING). Partial unique index `par_pending_unique` prevents duplicates. Notify approver. Audit. |
| **API-0404** Approve/Reject Publishing | `POST /v1/approval-requests/{parId}/review` | SERIALIZABLE tx. Recompute hash → mismatch = CANCELLED + 409. On APPROVE: create Release (PENDING). Dispatch EXECUTE_PUBLISH job. Audit. |
| **API-0405** Execute Publishing | Background job / internal | 3-Phase Commit. Phase 1: Release → IN_PROGRESS. Phase 2: POST to Language Services. Phase 3: Insert `release_content_snapshots`, Release → SUCCESSFUL/FAILED. Audit. Deployment version: `MAX + 1` with retry on unique constraint (P1-02). |
| **API-0406** Get Deployment History | `GET /v1/pages/{pageId}/languages/{lang}/deployments` | Read-only. Chronological release list. |
| **API-0407** Execute Rollback | `POST /v1/pages/{pageId}/languages/{lang}/environments/{env}/rollback` | Identify prior SUCCESSFUL release. Fetch content snapshot. 3-Phase Commit to re-push. New release record (trigger_source=ROLLBACK). Prior release → ROLLED_BACK. Audit. |

**Critical implementation notes for Group 4:**
- API-0405 and API-0407 make external HTTP calls. These MUST use 3-Phase Commit (GP-02).
- Deployment version race (P1-02): automated retry on unique constraint violation for `MAX(deployment_version) + 1`.
- Release content snapshots (`release_content_snapshots`) capture exact tag versions and texts at publish time — this is the rollback source data.

### 7.2 Dependencies
- Phase 3 complete (translations exist to publish)
- Language Services DEV endpoint accessible for testing
- Language Services QA and PRODUCTION endpoints accessible (or mockable)

### 7.3 Outputs
- Group 4 Publishing module: 7 APIs fully implemented
- Language Services client integrated
- Complete publishing pipeline: Request → Approve → Execute → Record
- Rollback working

### 7.4 Validation

| Test | Method |
|---|---|
| Pre-publishing summary | Compare approved content vs empty environment → all tags shown as new |
| Publishing approval request | Create PAR → verify PENDING, verify partial unique index blocks duplicate |
| Approval with hash mismatch | Approve when content changed → 409 CANCELLED |
| Execute publishing (DEV) | 3-Phase Commit → verify Release SUCCESSFUL, content snapshot captured, audit |
| Execute publishing (PRODUCTION) | Same as DEV but verify SR/FN authorization enforcement |
| Rollback | Fetch prior snapshot → re-push → verify new release, prior ROLLED_BACK |
| Deployment version race | Concurrent publishes → both succeed with sequential versions (retry works) |
| Language Services failure | Timeout → Release FAILED, entity in consistent state, manual retry available |
| Raw response stored | Verify JSONB in `releases.api_response_payload` |

### 7.5 Definition of Done
- [ ] All 7 Group 4 APIs pass contract tests
- [ ] Language Services client working against DEV endpoint
- [ ] 3-Phase Commit pattern verified
- [ ] Publishing pipeline end-to-end: PAR → Approve → Execute → SUCCESSFUL
- [ ] Rollback end-to-end: Identify prior → Re-push → ROLLED_BACK
- [ ] Deployment version retry verified
- [ ] Content snapshots captured correctly

---

## 8. Phase 5 — System-Triggered Behaviours

### 8.0 Objective
Build the Background Worker process and implement all 6 system-triggered behaviours (Group 5), completing the async architecture defined in SYS-01 §9.

### 8.1 Scope

#### 8.1.1 Background Worker Infrastructure

| Component | Details | Reference |
|---|---|---|
| **Worker process** | Separate entry point (`worker/main`), same codebase. Polls `job_queue` table. `SELECT FOR UPDATE SKIP LOCKED`. | SYS-01 §9.1, §9.3 |
| **Job lifecycle** | PENDING → PROCESSING → COMPLETED/FAILED. On failure: retry_count++, PENDING with scheduled backoff. After max retries: DEAD. | SYS-01 §9.3, §13.4 |
| **Job dispatcher** | Already built in Phase 2 (`shared/job`). Worker is the consumer side. | — |
| **Dead letter handling** | DEAD jobs visible in metrics. Associated entities remain in intermediate state. Manual investigation required. | SYS-01 §13.4 |

#### 8.1.2 Job Implementations

| Job Type | Handler | Details | Retry | Idempotency |
|---|---|---|---|---|
| **STALE_CASCADE** | `StaleCascadeWorker` | Batch UPDATE translations to STALE for a tag across all languages. ETag retry per row (P0-01). Insert audit records per language. Dispatch COVERAGE_RECALC + NOTIFICATION_DISPATCH. | 3× exponential (100ms, 200ms, 400ms) | Yes — `WHERE status NOT IN ('NO_TRANSLATION', 'STALE')` |
| **IMPLICIT_DEV_PUBLISH** | `ImplicitDevPublishWorker` | Evaluate eligible (page, language) pairs. Compute bundle hash. If different from last DEV release: create release + 3-Phase Commit to Language Services DEV. | 3× exponential (1s, 5s, 15s) | Yes — hash comparison |
| **COVERAGE_RECALC** | `CoverageRecalcWorker` | Full cell recompute for (page_id, language_code). `INSERT ON CONFLICT UPDATE` into `reporting.coverage_metrics`. | 3× with 30s delay | Yes — full recompute |
| **NOTIFICATION_DISPATCH** | `NotificationDispatchWorker` | Insert notification record into `system_ops.notifications`. `INSERT ON CONFLICT DO NOTHING` for deduplication. | 3× no backoff | Yes — dedup key |
| **EXPORT_GENERATION** | `ExportGenerationWorker` | Query tag data for (page, language). Generate CSV/Excel. Upload to Object Storage. Update `export_jobs` with download URL. | 3× exponential | Yes — regenerates file |
| **MIGRATION_EXECUTION** | `MigrationExecutionWorker` | Process uploaded file page-by-page in SERIALIZABLE transactions. Log per-row events in `migration.migration_row_events`. Update `import_events` status. | No retry (manual re-trigger) | Guarded by partial unique index |

### 8.2 Dependencies
- Phases 2–4 complete (all domain modules that produce async jobs must exist)
- Phase 6 partially complete (languages table populated for stale cascade scope)

### 8.3 Outputs
- Background Worker process running and consuming jobs
- All 6 job types implemented with correct retry/idempotency semantics
- English approval cascade fully operational: approve → stale → implicit publish → coverage → notification

### 8.4 Validation

| Test | Method |
|---|---|
| Stale cascade | Approve EC with text change → verify all translations for that tag become STALE, verify audit per language, verify coverage recalc dispatched |
| Stale cascade ETag conflict (P0-01) | Concurrently edit a translation while stale cascade runs → verify retry succeeds |
| Implicit DEV publish | Approve translation → verify DEV release created automatically, verify bundle pushed to Language Services DEV |
| Implicit DEV publish skip | Approve translation when hash unchanged → verify no new release |
| Coverage recalculation | Approve translation → verify `coverage_metrics` row updated |
| Notification dispatch | Approve EC → verify notification created for target user(s) |
| Export generation | Request export → verify file generated in Object Storage, export_job updated |
| Dead letter | Job fails 4× → verify DEAD status, verify associated entity in intermediate state |
| Job idempotency | Process same job twice → verify no duplicate side-effects |

### 8.5 Definition of Done
- [ ] Background Worker process starts and polls job queue
- [ ] All 6 job types implemented and verified
- [ ] Stale cascade with ETag retry verified (P0-01)
- [ ] Implicit DEV publish with 3-Phase Commit verified
- [ ] Coverage recalculation verified
- [ ] Notification dispatch with deduplication verified
- [ ] Export generation with Object Storage verified
- [ ] Dead letter handling verified
- [ ] English approval cascade works end-to-end (approve → stale → publish → coverage → notify)

---

## 9. Phase 6 — Administration & Configuration

### 9.0 Objective
Build the Administration module (Group 8), enabling user/role management, language management, and system configuration.

**Note:** Phase 6 can begin in parallel with Phase 3 because it depends only on Phase 2 (auth/audit framework) and Phase 1 (admin schema).

### 9.1 Scope

| API | Operation | Key Implementation Notes |
|---|---|---|
| **API-0801** List Users and Roles | `GET /v1/users` | Read-only. Users + active roles. |
| **API-0802** Add Language | `POST /v1/languages` | Insert `admin.languages`. Dispatch API-0506 (CREATE_TRANSLATION_SLOTS job) to create NO_TRANSLATION entries for all active tags. Audit. |
| **API-0803** Deactivate Language | `PATCH /v1/languages/{code}/deactivate` | Set status=INACTIVE. Existing translations preserved. Advisory warning if deployed to Production. Audit. |
| **API-0804** Assign/Update User Role | `POST /v1/users/{userId}/roles` | Insert `admin.user_role_assignments`. Lockout guard: cannot remove last ADMIN or FN. Audit. Notify. |
| **API-0805** Get System Configuration | `GET /v1/config` | Read-only. Returns confidence threshold, endpoints, domain. |
| **API-0806** Update System Configuration | `PATCH /v1/config` | ETag validation. Update `admin.system_configuration`. Audit with before/after. |
| **API-0807** List Languages | `GET /v1/languages` | Read-only. All languages with status, direction, coverage summary. |

**Critical implementation notes:**
- API-0802 (Add Language) triggers API-0506 (empty slot creation) as a background job. This is a potentially large batch (4,500+ tags × 1 language = 4,500 inserts). Must be implemented as a batched operation in the Worker.
- API-0804 role cache: active roles cached with TTL ≤ 30 seconds per SYS-01 §11.2.

### 9.2 Dependencies
- Phase 2 complete (auth, audit, ETag framework)
- Phase 1 complete (admin schema)

### 9.3 Definition of Done
- [ ] All 7 Group 8 APIs pass contract tests
- [ ] Add Language → translation slot creation verified (all active tags receive NO_TRANSLATION for new language)
- [ ] Role assignment lockout guard verified (cannot remove last ADMIN/FN)
- [ ] System configuration update with ETag verified
- [ ] Authorization: only ADMIN/FN can access admin endpoints

---

## 10. Phase 7 — Visibility, Reporting, Search & Collaboration

### 10.0 Objective
Build the read-heavy modules (Groups 6, 7, 9) that provide visibility, search, collaboration, and export capabilities.

### 10.1 Scope

#### 10.1.1 Group 6: Reporting Module

| API | Operation | Key Notes |
|---|---|---|
| **API-0601** Get Coverage Dashboard | `GET /v1/dashboard/coverage` | Matrix: pages × languages. Reads `reporting.coverage_metrics`. |
| **API-0602** Get Language Readiness | `GET /v1/dashboard/languages/{code}/readiness` | Pages ranked by coverage for one language. |
| **API-0603** Get Stale Translations Report | `GET /v1/reports/stale` | All STALE translations, grouped by language/page, sorted by age. |
| **API-0604** Get Pending Work Summary | `GET /v1/dashboard/pending-work` | Aggregate counts: needs EC, needs translation, pending review, stale, pending publish. |
| **API-0605** Get Activity Timeline | `GET /v1/activity` | Recent audit records formatted for display. Filterable. |
| **API-0606** Get Review Queue | `GET /v1/review-queue` | Role-aware: items pending review for current user's role. |
| **API-0607** Get Environment Status Matrix | `GET /v1/dashboard/environments` | Pages × languages × environments. Current published versions. |

#### 10.1.2 Group 7: Search Module

| API | Operation | Key Notes |
|---|---|---|
| **API-0701** Global Search | `GET /v1/search?q={query}` | Full-text search across tag IDs, EC text, page names. Uses `tsvector` indexes. |
| **API-0702** Save Bookmark | `POST /v1/bookmarks` | Per-user. Target: page or tag. |
| **API-0703** Get Bookmarks | `GET /v1/bookmarks` | Per-user bookmark list. |
| **API-0704** Remove Bookmark | `DELETE /v1/bookmarks/{id}` | Only table where DELETE is permitted (DB-01 §3.1). |
| **API-0705** Get Recently Edited | `GET /v1/recently-edited` | Per-user. 30-day retention. |

#### 10.1.3 Group 9: Collaboration Module

| API | Operation | Key Notes |
|---|---|---|
| **API-0901** Add Comment | `POST /v1/tags/{tagId}/comments` | Permanent, immutable body. Scoped to English or language. Audit. |
| **API-0902** Get Comments | `GET /v1/tags/{tagId}/comments` | Filterable by scope. |
| **API-0903** Resolve Comment | `PATCH /v1/comments/{commentId}/resolve` | Set `resolved_at`. Cannot delete. |
| **API-0904** Get Audit Trail | `GET /v1/audit` | Cross-system search of `system_ops.audit_records`. Filterable by user, date, action, page, tag, language. |
| **API-0905** Export Tag Data | `POST /v1/exports` + `GET /v1/exports/{id}` + `GET /v1/exports/{id}/download` | Dispatch EXPORT_GENERATION job. Poll status. Download from Object Storage. |
| **API-0906** Get Notifications | `GET /v1/notifications` | Per-user. Ordered by recency. Polling endpoint (30s interval from SPA). |
| **API-0907** Mark Notification as Read | `PATCH /v1/notifications/read` | Batch mark-as-read. |

### 10.2 Dependencies
- Phases 2–5 complete (source data must be flowing: tags, translations, coverage metrics, audit records, notifications)

### 10.3 Definition of Done
- [ ] All 7 Group 6 APIs pass contract tests; coverage dashboard shows correct data
- [ ] All 5 Group 7 APIs pass contract tests; global search returns relevant results
- [ ] All 7 Group 9 APIs pass contract tests; comments permanent, export generates file, notifications display
- [ ] Coverage metrics match manual calculation
- [ ] Review queue is role-aware (SR sees EC items; LR sees translation items)
- [ ] Activity timeline shows chronological audit records
- [ ] Export generates downloadable file from Object Storage

---

## 11. Phase 8 — Migration

### 11.0 Objective
Build the Migration module (Group 10), enabling the one-time data import from the existing Language Services data.

### 11.1 Scope

| API | Operation | Key Implementation Notes |
|---|---|---|
| **API-1001** Upload Import File | `POST /v1/migrations` | Multipart upload. Store file in Object Storage. Create `import_events` (UPLOAD_READY). Partial unique index blocks concurrent migrations. |
| **API-1002** Execute Migration Import | `POST /v1/migrations/{id}/execute` + `GET /v1/migrations/{id}` | Background job (MIGRATION_EXECUTION). Process page-by-page in SERIALIZABLE transactions. Per page: upsert pages/tags, insert EC+ECV (APPROVED, MIGRATED), insert Trans+TV (APPROVED, MIGRATED), insert Releases (MIGRATION, SUCCESSFUL across DEV/QA/PROD). Log skipped/failed rows in `migration_row_events`. |
| **API-1003** Get Migration Validation Report | `GET /v1/migrations/{id}/report` | Query `migration_row_events`. Assemble discrepancy report: pages/tags/translations imported, any mismatches. |

**Critical implementation notes:**
- Migration uses the DEFERRABLE INITIALLY DEFERRED FK on `translation_versions.source_english_version` (P1-03) to allow EC and TV to be inserted in the same transaction without ordering concerns.
- Migration creates Releases across all 3 environments (DEV, QA, PRODUCTION) with `trigger_source=MIGRATION`, reflecting that this content is already live.
- Estimated duration: ~25–30 minutes for 89 pages in single-threaded mode (DB-AUDIT P3-01).
- The `SYSTEM_NOT_EMPTY` guard prevents migration from being re-run if pages already exist.

### 11.2 Dependencies
- Phases 1–6 complete (all target schemas and entity initialization logic must exist)
- Source data file from current Language Services export available

### 11.3 Definition of Done
- [ ] Upload → Execute → Report flow works end-to-end
- [ ] Per-page transactional rollback verified (one page failure does not corrupt others)
- [ ] Migration creates correct entity states (EC APPROVED, Trans APPROVED, Releases SUCCESSFUL)
- [ ] Discrepancy report shows zero mismatches on clean data
- [ ] Staging dry-run completes successfully
- [ ] Partial unique index blocks concurrent migration attempts

---

## 12. Phase 9 — Frontend Implementation

### 12.0 Objective
Build the complete SPA enabling all 19 User Flows defined in the approved UX Flows and IA.

### 12.1 Implementation Strategy

Frontend work is **not a single phase at the end**. It begins incrementally from Phase 2 onwards:

| Phase | Frontend Increment | IA Surfaces |
|---|---|---|
| Phase 2 | SPA shell, routing, auth integration, Page List, Page Detail, Tag Detail, English Copy authoring | C1 (Page List), C2 (Page Detail), C3 (Tag Detail — partial) |
| Phase 3 | Translation management within Tag Detail, Review Queue | C3 (Tag Detail — translations), C4 (Review Queue) |
| Phase 4 | Publishing surfaces, Deployment Overview, Rollback | C5 (Publishing), C6 (Deployment Overview) |
| Phase 5 | No new surfaces (background worker has no UI) | — |
| Phase 6 | Administration: Users, Roles, Languages, Config | C9 (Settings) |
| Phase 7 | Dashboard, Search, Comments, Activity, Notifications, Export | C6 (Dashboard/Reports), C7 (Activity), C8 (Search), Notification Inbox |
| Phase 8 | Migration: Upload, Execute, Report | C10 (Migration — Settings sub-page) |
| Phase 9 | Polish: loading/error/empty states, responsive behavior, notification polling, end-to-end UX testing | All surfaces |

### 12.2 SPA Module Details

| SPA Module | APIs Consumed | State Management | Key UX Patterns |
|---|---|---|---|
| **Pages & Tags Browser** | API-0103, 0104, 0105, 0106, 0107, 0108 | Server state (fetch on navigate). Filter/sort state local. | Paginated list, drill-down, filters, status badges |
| **English Copy Management** | API-0201, 0202, 0203, 0204 | Draft autosave. ETag stored per entity. | Inline editor, version history, review actions |
| **Translation Management** | API-0301–0309 | Per-language tabs. ETag per translation. | Side-by-side English/Translation/Back-translation, confidence badges, bulk approve |
| **Publishing** | API-0401–0407 | Environment status matrix. Publishing wizard. | Pre-publish diff, approval flow, progress indicator, rollback confirmation |
| **Dashboard & Reports** | API-0601–0607 | Dashboard data cached with TTL. | Coverage matrix (heat map), stale priority list, environment status grid |
| **Search** | API-0701, 0702, 0703, 0704, 0705 | Search debounced (300ms). Bookmarks cached. | Global search bar (always visible), recent items, bookmark toggle |
| **Administration** | API-0801–0807 | Admin forms with validation. | User/role management table, language add wizard, config editor |
| **Comments & Activity** | API-0901–0903, 0605 | Comment list per tag. Activity feed. | Inline comment thread, resolve toggle, timeline |
| **Notifications** | API-0906, 0907 | Poll every 30 seconds. Badge counter. | Notification inbox, mark-as-read, click-to-navigate |
| **Migration** | API-1001–1003 | Upload progress. Poll execution status. | File upload, progress bar, discrepancy report table |
| **Export** | API-0905 (sub-endpoints) | Poll export status. | Generate button, status indicator, download link |

### 12.3 Optimistic Concurrency in Frontend

All mutation operations must:
1. Read `ETag` from GET response headers.
2. Send `If-Match: <etag>` on PUT/PATCH/POST mutations.
3. On `409 Conflict`: display "This item was modified by another user. Refresh to see the latest version." with a Refresh button.

### 12.4 Definition of Done
- [ ] All 19 User Flows executable end-to-end through the UI
- [ ] All IA surfaces (C1–C10) implemented
- [ ] Optimistic concurrency (ETag/If-Match) working on all mutation forms
- [ ] Loading, error, and empty states implemented on all surfaces
- [ ] Notification polling (30s) with badge counter
- [ ] Responsive layout for desktop browsers
- [ ] All acceptance criteria from FRD features F-01–F-21 verified in the UI

---

## 13. Phase 10 — Production Hardening & Release

### 13.0 Objective
Complete observability, security audit, staging validation, production migration, and operational readiness.

### 13.1 Scope

| Deliverable | Details | Reference |
|---|---|---|
| **Metrics instrumentation** | All 10 metrics from SYS-01 §14.2 emitting to metrics backend (Prometheus/CloudWatch). | SYS-01 §14.2 |
| **Alerting rules** | All 8 alert conditions from SYS-01 §14.4 configured with notification channels. | SYS-01 §14.4 |
| **Security audit** | HTTPS enforcement, CORS configuration, input validation review, SQL injection scan, RBAC penetration test. | SYS-01 §17 |
| **Staging deployment** | Full deployment to staging environment with staging PostgreSQL, PgBouncer, Object Storage. | SYS-01 §12 |
| **Staging migration dry-run** | Execute migration against staging Language Services QA endpoint with production-equivalent data. | DB-AUDIT P3-01 |
| **Language Services verification** | Verify DEV, QA, PRODUCTION endpoints are configured and reachable. Verify domain configuration. | API List §4.1 |
| **Production deployment** | Deploy API Server (×2), Worker (×1), PostgreSQL Primary + Replica, PgBouncer, Object Storage. | SYS-01 §12.2 |
| **Production migration** | Execute one-time migration (API-1001 → 1002 → 1003) against production data. | Phase 8 |
| **Post-migration validation** | Run migration validation report (API-1003). Verify zero discrepancies. | — |
| **Operational runbook** | Documented procedures for: manual job retry, dead letter investigation, rollback, database backup/restore. | — |
| **Load/smoke test** | Simulate 15 concurrent users performing typical workflows. Verify p99 < 2s. | SYS-01 §18.1 |

### 13.2 Definition of Done
- [ ] All metrics emitting; dashboards visible
- [ ] All alerts configured and tested
- [ ] Security audit passes with no critical findings
- [ ] Staging deployment and migration dry-run successful
- [ ] Language Services endpoints verified across all 3 environments
- [ ] Production deployed with HA (2 API instances)
- [ ] Production migration completed with zero discrepancies
- [ ] Operational runbook documented and reviewed
- [ ] Load test: p99 < 2s for API requests under 15 concurrent users

---

## 14. Critical Workflow Validation Matrix

Every critical end-to-end workflow must be validated. This matrix identifies the earliest phase at which each workflow becomes testable and the APIs/modules involved.

| # | Workflow | APIs Involved | Earliest Testable Phase | E2E Test Required |
|---|---|---|---|---|
| 1 | **Page creation** | API-0101 | Phase 2 | ✓ |
| 2 | **Tag creation** (with EC init + Translation slots) | API-0102 | Phase 2 | ✓ |
| 3 | **English authoring** (Draft → Submit) | API-0201, 0202 | Phase 2 | ✓ |
| 4 | **English approval** | API-0203 | Phase 2 | ✓ |
| 5 | **Automatic stale flagging** | API-0203 → API-0501 (async) | Phase 5 | ✓ |
| 6 | **Translation generation** (AI single) | API-0301 | Phase 3 | ✓ |
| 7 | **Translation review/approval** | API-0304 | Phase 3 | ✓ |
| 8 | **Automatic Dev publishing** | API-0203/0304 → API-0502 → API-0405 (async) | Phase 5 | ✓ |
| 9 | **QA publishing** | API-0403, 0404, 0405 | Phase 4 | ✓ |
| 10 | **Production publishing approval + execution** | API-0403, 0404, 0405 | Phase 4 | ✓ |
| 11 | **Rollback** | API-0407 | Phase 4 | ✓ |
| 12 | **Language administration** (add + slot creation) | API-0802 → API-0506 (async) | Phase 6 | ✓ |
| 13 | **Comments** | API-0901, 0902, 0903 | Phase 7 | ✓ |
| 14 | **Notifications** | API-0504 (async) → API-0906, 0907 | Phase 7 | ✓ |
| 15 | **Audit trail** | API-0505 (cross-cutting) → API-0904 | Phase 7 | ✓ |
| 16 | **Search** | API-0701 | Phase 7 | ✓ |
| 17 | **Reporting** (coverage dashboard) | API-0601, 0602, 0603, 0604 | Phase 7 | ✓ |
| 18 | **Initial migration** | API-1001, 1002, 1003 | Phase 8 | ✓ |
| 19 | **Export** | API-0905 (sub-endpoints) | Phase 7 | ✓ |

---

## 15. Async Job Implementation Plan

### 15.1 Job Queue Table Schema

```sql
-- Part of Phase 1 migrations (V007 or dedicated V017)
CREATE TABLE system_ops.job_queue (
    job_id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    job_type       VARCHAR(50) NOT NULL,
    payload        JSONB NOT NULL,
    status         VARCHAR(20) NOT NULL DEFAULT 'PENDING'
                   CHECK (status IN ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED', 'DEAD')),
    retry_count    INTEGER NOT NULL DEFAULT 0,
    max_retries    INTEGER NOT NULL DEFAULT 3,
    scheduled_for  TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    completed_at   TIMESTAMPTZ,
    error_message  TEXT,
    correlation_id VARCHAR(100)
);

CREATE INDEX idx_job_queue_pending ON system_ops.job_queue (scheduled_for)
    WHERE status = 'PENDING';
```

### 15.2 Implementation Details Per Job Type

| Job Type | Payload | Processing Logic | Retry | Idempotency Guarantee |
|---|---|---|---|---|
| **STALE_CASCADE** | `{ tagId, newEnglishVersion, correlationId }` | Read translations WHERE tag_id AND status NOT IN (NO_TRANSLATION, STALE). Per-row: read etag → UPDATE SET status=STALE → if etag mismatch, retry row. Insert audit per language. Dispatch COVERAGE_RECALC + NOTIFICATION per affected language. | 3× row-level (100ms, 200ms, 400ms) + 3× job-level | Natural: WHERE clause excludes already-STALE |
| **IMPLICIT_DEV_PUBLISH** | `{ tagId, scope, triggerSource, correlationId }` | Determine (page_id, language) pairs. Per pair: compute hash → compare with last SUCCESSFUL DEV release → if different AND no in-flight release: create release + 3-Phase Commit. | 3× (1s, 5s, 15s) | Hash comparison prevents duplicate pushes |
| **COVERAGE_RECALC** | `{ pageId, languageCode }` | COUNT active tags. COUNT approved+deployed translations. Compute percentage. UPSERT `reporting.coverage_metrics`. | 3× (30s delay) | Full cell recompute = same result |
| **NOTIFICATION_DISPATCH** | `{ eventType, subjectType, subjectId, targetRoles, contextData, correlationId }` | Resolve target users by role. INSERT notification per user. ON CONFLICT DO NOTHING on dedup key. | 3× (no backoff) | Dedup key prevents duplicates |
| **EXPORT_GENERATION** | `{ exportJobId, pageId, languageCode }` | Query tags + EC + translations. Generate CSV. Upload to Object Storage. Update `export_jobs` with download URL + status. | 3× exponential | Regenerates file (overwrite) |
| **MIGRATION_EXECUTION** | `{ importEventId }` | Read file from Object Storage. Parse. Process page-by-page in SERIALIZABLE transactions. Log events in `migration_row_events`. | No retry (manual) | Partial unique index blocks concurrent |

### 15.3 Observability

| Metric | Source |
|---|---|
| `job_queue_depth` (gauge) | `SELECT COUNT(*) FROM job_queue WHERE status = 'PENDING'` |
| `job_execution_duration_ms` (histogram) | Measured in worker per job execution |
| `job_failure_count` (counter) | Incremented on each job failure |
| Dead job alert | `WHERE status = 'DEAD'` count > 0 |

---

## 16. External Integration Implementation Plan

### 16.1 Language Services Integration

| Aspect | Implementation |
|---|---|
| **Client interface** | `LanguageServicesClient.publish(environment, pageId, pageName, tags)` → `PublishResult` |
| **Endpoint resolution** | Read from `admin.system_configuration` by environment key. Endpoints mutable via API-0806. |
| **Payload construction** | Build `{ domain, pageId, pageName, tags: [{ tagName, values: { lang: text } }] }` per AF-1–AF-10. One language per `values` object per publish scope. |
| **Response parsing** | Parse per-language status from response (AF-10). Language succeeded → SUCCESSFUL. Language failed (AF-9) → FAILED with details. |
| **Partial failure handling** | Any language failure → entire Release status FAILED. Full re-push on retry (AF-6 upsert semantics make this safe). |
| **Response storage** | Full raw response stored as JSONB in `releases.api_response_payload`. |
| **Timeout** | Connect: 30s, Read: 60s. |
| **Circuit breaker** | 5 failures/60s → open 30s → half-open probe. |
| **Testing** | Integration tests against Language Services DEV endpoint. Mock for unit tests. |

### 16.2 AI Translation Service Integration

| Aspect | Implementation |
|---|---|
| **Client interface** | `AiTranslationClient.translate(sourceText, targetLanguage, context)` → `TranslationResult` |
| **Context provided** | `{ sourceText, targetLanguage, pageId, pageName, module, copyType, industryTerms: ["salon", "spa"] }` |
| **Response mapping** | `{ translatedText, backTranslation, confidenceScore, variableIntegrityStatus }` |
| **Placeholder validation** | Compare variables/placeholders in source vs. translated text. Flag discrepancies. |
| **Timeout** | Connect: 30s, Read: 120s (bulk translation may be slow). |
| **Circuit breaker** | Same as Language Services. |
| **Mock strategy** | Until contract finalized: implement behind interface with in-memory mock that returns canned data with realistic confidence scores (85–99%), back-translations, and variable integrity results. |
| **Testing** | Unit tests with mock. Integration tests when contract finalized. |

### 16.3 Transaction Boundary Enforcement (GP-02)

Every method that calls an external service must follow this pattern:

```
// WRONG — external call inside transaction
@Transactional
void publish() {
    release.setStatus(PENDING);
    httpClient.post(languageServices);  // ← VIOLATION of GP-02
    release.setStatus(SUCCESSFUL);
}

// CORRECT — 3-Phase Commit
void publish() {
    // Phase 1: DB transaction
    transactionTemplate.execute(() -> {
        release.setStatus(IN_PROGRESS);
    });
    
    // Phase 2: External call (NO transaction)
    result = httpClient.post(languageServices);
    
    // Phase 3: DB transaction
    transactionTemplate.execute(() -> {
        release.setStatus(result.isSuccess() ? SUCCESSFUL : FAILED);
        release.setApiResponsePayload(result.rawResponse());
        auditService.record(...);
    });
}
```

---

## 17. Testing Strategy

### 17.1 Testing Pyramid

```
                    ┌─────────┐
                    │  E2E    │  19 User Flow tests
                    │  Tests  │  (browser automation)
                    ├─────────┤
                    │  API    │  63 API contract tests
                    │ Contract│  (HTTP-level, DB-backed)
                    │  Tests  │
                    ├─────────┤
                    │ Service │  Domain logic tests
                    │  Tests  │  (mocked repository)
                    ├─────────┤
                    │  Repo/  │  DB integration tests
                    │  DB     │  (real PostgreSQL)
                    │  Tests  │
                    ├─────────┤
                    │  Unit   │  Pure logic, utilities,
                    │  Tests  │  formatters, validators
                    └─────────┘
```

### 17.2 Test Categories

| Category | Scope | Infrastructure | Count Estimate |
|---|---|---|---|
| **Unit tests** | Pure business logic: validation, formatting, hash computation, payload construction, ETag comparison | None (mocks only) | ~200 |
| **Repository/DB integration tests** | Each repository method against real PostgreSQL (via Testcontainers or Docker). Verify SQL correctness, constraint enforcement, trigger behavior. | PostgreSQL | ~150 |
| **Service/domain tests** | Service-layer logic with mocked repositories. State machine transitions, authorization checks, cascade logic. | Mocks | ~200 |
| **API contract tests** | Full HTTP request → response for each of the 63 APIs. Verify status codes, response schemas, error formats, ETag headers, audit record creation. | PostgreSQL + HTTP server | ~200 |
| **Background worker tests** | Each job type executed in isolation. Verify: processing, retry, idempotency, failure handling, job lifecycle. | PostgreSQL + Worker | ~40 |
| **External integration tests** | Language Services and AI Translation clients against mocks/stubs. Verify: 3-Phase Commit, timeout, circuit breaker, response parsing. | Mock HTTP server | ~30 |
| **Concurrency tests** | ETag conflicts, deployment version race, stale cascade collision, PAR duplicate prevention. | PostgreSQL + concurrent threads | ~20 |
| **Authorization tests** | Every endpoint × every role combination from FRD §8 permission matrix. | PostgreSQL + HTTP server | ~150 |
| **Migration tests** | Upload, execute, validate on test data. Per-page rollback. Concurrent execution prevention. | PostgreSQL + Object Storage | ~15 |
| **E2E tests** | 19 User Flow end-to-end scenarios through the complete system (API or browser). | Full stack | ~25 |

### 17.3 Audit-Specific Tests

Every P0/P1 finding from DB-AUDIT-FINAL must have an explicit test:

| Finding | Test |
|---|---|
| **P0-01** Stale cascade ETag retry | Concurrent translation edit during stale cascade → worker retries and succeeds |
| **P0-02** 409 Conflict on Group 3 | Concurrent translation mutations → second returns 409 with latest snapshot |
| **P0-03** External boundary enforcement | Verify HTTP call is NOT inside a DB transaction (inspect connection state or use test spy) |
| **P1-01** GIN index on pages search | Full-text search on pages returns results (index exists) |
| **P1-02** Deployment version race | Concurrent release creation → both succeed with sequential versions |
| **P1-03** Deferred FK | Migration inserts EC and TV in same transaction without FK failure |

### 17.4 Rollback Tests

| Test | Scenario |
|---|---|
| Rollback to prior version | Verify prior content snapshot re-pushed, new release created, prior release ROLLED_BACK |
| Rollback when no prior exists | Verify 422 error returned |
| Rollback Language Services failure | Verify Release status FAILED, content unchanged, manual retry available |
| Application rollback | Deploy new version, rollback deployment, verify previous version serves correctly |
| Database rollback | `flyway repair` + `flyway migrate` after a failed migration |

---

## 18. Migration & Deployment Plan

### 18.1 Flyway Migration Sequence (Summary)

| Script | Purpose | Phase |
|---|---|---|
| V001–V016 | Complete schema creation, triggers, indexes, constraints, seed data | Phase 1 |
| V017 | Job queue table (if not in V007) | Phase 1/5 |

### 18.2 Deployment Sequence

| Step | Action | Validate |
|---|---|---|
| 1 | Provision PostgreSQL Primary + Replica in production | Replication lag < 1s |
| 2 | Configure PgBouncer | Connection test from application |
| 3 | Run Flyway migrations on primary | `flyway info` shows all migrations applied |
| 4 | Provision Object Storage bucket | Upload/download test file |
| 5 | Deploy API Server (instance 1) | `GET /health` → 200 |
| 6 | Deploy API Server (instance 2) | `GET /health` → 200, load balancer health check green |
| 7 | Deploy Background Worker | Worker connects, polls job queue |
| 8 | Configure Language Services endpoints (via API-0806) | Verify DEV/QA/PROD URLs |
| 9 | Execute one-time migration (API-1001 → 1002) | `import_events.status = COMPLETED` |
| 10 | Run migration validation (API-1003) | Zero discrepancies |
| 11 | Verify DEV publishing | Approve a test translation → auto-published to DEV |
| 12 | Verify PRODUCTION publishing | Full approval pipeline → successful publish |
| 13 | Enable alerting | All alerts configured |
| 14 | Announce production readiness | — |

### 18.3 Rollback Plan

| Level | Procedure |
|---|---|
| **Application rollback** | Deploy previous container image. Stateless API servers — zero-downtime rollback via load balancer. Worker: drain current job, deploy previous image. |
| **Database rollback** | Flyway does not support down migrations by default. For critical failures: point-in-time recovery from WAL archive. For minor issues: apply corrective migration (V_next). |
| **Migration data rollback** | If initial data migration produces unacceptable results: TRUNCATE all data tables (single-use system, no user data yet), re-run Flyway from clean state, re-execute migration. |

---

## 19. Parallelization Matrix

### 19.1 What Can Run in Parallel

| Track A | Track B | Constraint |
|---|---|---|
| **Phase 0** (Backend foundation) | **Phase 0** (Frontend SPA shell, routing, auth) | Independent — shared repository |
| **Phase 2** (Group 1+2 APIs) | **Phase 2** (Frontend: Page List, Page Detail, Tag Detail, EC authoring) | Frontend consumes API as it becomes available |
| **Phase 3** (Group 3 APIs) | **Phase 6** (Group 8 Admin APIs) | Both depend on Phase 2 only; no cross-dependency |
| **Phase 3** (Group 3 frontend) | **Phase 6** (Admin frontend) | Independent UI surfaces |
| **Phase 4** (Publishing APIs) | **Phase 7** (Reporting/Search APIs — read-only, can stub data) | Phase 7 can start with seed data before Phase 5 completes |
| **Phase 5** (Background Worker) | **Phase 9** (Frontend polish) | Worker is backend-only; frontend polish is UI-only |
| Test infrastructure setup | Any development phase | Test infrastructure can be built incrementally alongside features |

### 19.2 What CANNOT Run in Parallel

| Item | Reason |
|---|---|
| Phase 1 must complete before Phase 2 | Database schemas must exist before domain modules |
| Phase 2 must complete before Phase 3 | EC approval is prerequisite for translation |
| Phase 3 must complete before Phase 4 | Translations must exist to publish |
| Phases 2–4 must complete before Phase 5 | Worker orchestrates side-effects across all domains |
| Phase 5 must complete before Phase 7 (fully) | Coverage metrics require COVERAGE_RECALC worker; notifications require NOTIFICATION_DISPATCH worker |
| Phases 1–6 must complete before Phase 8 | Migration writes to all schemas |

### 19.3 Recommended Team Allocation (2-Track)

| Track | Owner Focus | Phases |
|---|---|---|
| **Backend Track** | API Server, domain modules, worker, integrations | Phases 0 → 1 → 2 → 3 → 4 → 5 → 8 → 10 |
| **Frontend Track** | SPA, UI components, API consumption | Phase 0 (shell) → 2 (pages/tags/EC) → 3 (translations) → 4 (publishing) → 6 (admin) → 7 (dashboard/search) → 9 (polish) |

Backend and Frontend tracks synchronize at the API contract boundary. Frontend work for each domain starts as soon as the corresponding backend APIs are available.

---

## 20. Delivery Dependencies

### 20.1 Engineering Dependencies

| Dependency | Required By | Impact if Missing | Mitigation |
|---|---|---|---|
| **Technology stack decision** (language/framework for backend) | Phase 0 | Cannot begin implementation | Decision required before IMP-01 execution begins |
| **Frontend framework decision** (React, Vue, etc.) | Phase 0 | Cannot begin frontend | Decision required before IMP-01 execution begins |
| **Database migration tool** (Flyway recommended) | Phase 1 | Cannot create schemas | Flyway assumed; confirm or substitute |

### 20.2 External Service Dependencies

| Dependency | Required By | Impact if Missing | Mitigation |
|---|---|---|---|
| **AI Translation Service API contract** | Phase 3 | Cannot implement real AI integration | Mock interface (Phase 3 can proceed with mock; swap when contract available) |
| **Language Services DEV endpoint access** | Phase 4 | Cannot test publishing | Request access before Phase 4 begins |
| **Language Services QA endpoint access** | Phase 10 | Cannot test staging publishing | Request before staging deployment |
| **Language Services PRODUCTION endpoint access** | Phase 10 | Cannot execute production publishing | Request before production deployment |
| **ED-3 confirmation** (per-language value preservation) | Phase 4 | Publishing model may need adjustment | Confirm with engineering before Phase 4 |

### 20.3 Environment Dependencies

| Dependency | Required By | Impact if Missing |
|---|---|---|
| **Production PostgreSQL instance** | Phase 10 | Cannot deploy to production |
| **Production Object Storage bucket** | Phase 10 | Cannot store migration/export files |
| **Load balancer / reverse proxy** | Phase 10 | Cannot deploy HA API servers |
| **Staging environment** | Phase 10 | Cannot validate before production |

### 20.4 Access & Credentials

| Item | Required By |
|---|---|
| Auth provider (OIDC) credentials and configuration | Phase 2 |
| Language Services API credentials (all 3 environments) | Phase 4 / Phase 10 |
| AI Translation Service API credentials | Phase 3 |
| Object Storage credentials | Phase 1 (dev), Phase 10 (production) |
| Monitoring/alerting platform access | Phase 10 |

### 20.5 Source Data Dependencies

| Item | Required By |
|---|---|
| Export of current Language Services data (CSV/JSON) for migration | Phase 8 |
| Current Language Services domain name (for API payload) | Phase 4 |

---

## 21. Risk Register

| Risk ID | Category | Description | Probability | Impact | Mitigation | Validation |
|---|---|---|---|---|---|---|
| **R-01** | External Integration | AI Translation Service contract not finalized | High | Medium | Mock interface; swap when ready | Integration tests pass with both mock and real service |
| **R-02** | External Integration | Language Services endpoints unreachable or behaving unexpectedly | Medium | High | Circuit breaker, 3-Phase Commit, FAILED status with manual retry | Retry tests, circuit breaker tests, staging validation |
| **R-03** | Concurrency | Stale cascade colliding with concurrent manual translation edits | High | High | Automated retry loop with exponential backoff (P0-01) | Concurrent test simulating collision scenario |
| **R-04** | Concurrency | Deployment version race on concurrent publishes | Medium | Medium | Automated retry on unique constraint violation (P1-02) | Concurrent publish test |
| **R-05** | Data Quality | Migration source data contains duplicates, missing fields, or encoding issues | Medium | High | Validation report (API-1003), staging dry-run, per-page transactional rollback | Staging migration dry-run with production-equivalent data |
| **R-06** | External Integration | ED-3 unconfirmed: per-language value preservation in Language Services | Medium | Critical | Confirm with engineering before Phase 4. If not confirmed, adjust payload to include all languages per tag. | Integration test verifying value preservation |
| **R-07** | Authentication | Auth provider integration complexity or delayed access | Medium | High | Begin auth integration in Phase 2; use local JWT issuer for development | Auth middleware tests with real and mock providers |
| **R-08** | Performance | N+1 queries on Page Detail (100+ tags) | Medium | Medium | Mandate batch JOIN queries (P2-05), repository code review | Load test with 100+ tag pages |
| **R-09** | Operations | Background Worker job queue depth growing faster than consumption | Low | Medium | Monitor `job_queue_depth` metric; alert at > 100; scale to 2 workers | Load test with burst of async jobs |
| **R-10** | Environment | Production environment provisioning delayed | Low | High | Request provisioning early (Phase 0); use staging as fallback | Environment readiness checklist |

---

## 22. Release Milestones

| Milestone | Completion Criteria | Phases Included | Significance |
|---|---|---|---|
| **M0: Foundation Ready** | Repository, CI/CD, dev environment, health checks working | Phase 0 | Engineers can start coding |
| **M1: Database Ready** | All schemas created, triggers verified, seed data loaded | Phase 1 | Data layer ready for application code |
| **M2: Core Content Workflow** | Page → Tag → EC Draft → Submit → Approve works end-to-end (API + basic UI) | Phase 2 | First vertical slice of the product |
| **M3: Translation Workflow** | Generate AI Translation → Review → Approve works end-to-end | Phase 3 | Core translation capability functional |
| **M4: Publishing Pipeline** | Request → Approve → Execute (Language Services) → Record works; Rollback works | Phase 4 | Content can reach Language Services |
| **M5: Async Architecture Complete** | Stale cascade, implicit DEV publish, coverage, notifications all working | Phase 5 | System-triggered behaviours operational |
| **M6: Admin Complete** | User/Role management, Language add/deactivate, Config management | Phase 6 | Administrative capabilities functional |
| **M7: Full Feature Complete** | Dashboard, Search, Comments, Export, Notifications, Audit Trail UI | Phase 7 | All features implemented |
| **M8: Migration Ready** | Upload → Execute → Report works; staging dry-run passes | Phase 8 | Ready to migrate existing data |
| **M9: UI Complete** | All 19 User Flows executable end-to-end in the browser | Phase 9 | Product fully usable |
| **M10: Production Ready** | Staging validated, production deployed, migration executed, operational | Phase 10 | System live for the team |

---

## 23. Final Traceability Matrix

This matrix proves that every approved requirement has an explicit place in the implementation plan.

### 23.1 FRD Feature → Implementation Traceability

| FRD Feature | APIs | Entity | DB Schema | Backend Module | Frontend Surface | Test Category | Milestone |
|---|---|---|---|---|---|---|---|
| **F-01** Page & Tag Browsing | 0103, 0104, 0105 | Page, Tag | `registry` | `registry` | Page List, Page Detail, Tag Detail | API contract, E2E | M2 |
| **F-02** Create Page & Tag | 0101, 0102, 0106, 0108 | Page, Tag, EC, Translation | `registry`, `content`, `translation` | `registry` | Page creation form, Tag creation | API contract, DB integration | M2 |
| **F-04** Author English Copy | 0201, 0202, 0108 | EC, ECV | `content` | `content` | EC editor in Tag Detail | API contract, E2E | M2 |
| **F-05** Edit English Copy | 0201, 0202, 0501 | EC, ECV, Translation | `content`, `translation` | `content`, `system` | EC editor (re-edit flow) | API contract, worker test | M2 (edit), M5 (stale) |
| **F-06** AI-Assisted Translation | 0301 | Translation, TV | `translation` | `translation` | AI translate button in Tag Detail | API contract, integration | M3 |
| **F-07** Translate All (Bulk) | 0302 | Translation, TV | `translation` | `translation` | Bulk translate button on Page Detail | API contract, integration | M3 |
| **F-08** Review Translation | 0304, 0303, 0309 | Translation, TV | `translation` | `translation` | Review actions in Tag Detail | API contract, E2E | M3 |
| **F-09** Bulk Approve | 0305 | Translation | `translation`, `admin` | `translation` | Bulk approve in Page Detail | API contract, threshold test | M3 |
| **F-10** Resolve Stale | 0306, 0307 | Translation, TV | `translation` | `translation` | Stale resolution in Tag Detail | API contract, worker test | M3 (resolve), M5 (flagging) |
| **F-11** Publish Page Bundle | 0401–0405 | PAR, Release, RCS | `publishing` | `publishing` | Publishing wizard | API contract, integration, E2E | M4 |
| **F-12** Rollback | 0406, 0407 | Release, RCS | `publishing` | `publishing` | Rollback confirmation | API contract, integration | M4 |
| **F-13** Version History | 0204, 0308 | ECV, TV | `content`, `translation` | `content`, `translation` | Version history panel | API contract | M2 (EC), M3 (Trans) |
| **F-14** Search | 0701 | Page, Tag, EC | `registry`, `content`, `search` | `search` | Global search bar | API contract, FTS test | M7 |
| **F-15** Filter by State | 0103, 0104 | Page, Tag, Translation | `registry`, `translation` | `registry` | Filter controls on Page List/Detail | API contract | M2 |
| **F-16** Coverage Dashboard | 0601, 0602, 0503 | Coverage Metrics | `reporting` | `reporting` | Coverage dashboard | API contract, data accuracy | M7 |
| **F-17** Audit Trail | 0505, 0904 | Audit Record | `system_ops` | `shared/audit`, `collaboration` | Audit search, Activity Timeline | Cross-cutting, API contract | M2 (write), M7 (read) |
| **F-18** Comments | 0901–0903 | Comment | `collaboration` | `collaboration` | Comment thread in Tag Detail | API contract | M7 |
| **F-19** Export | 0905 | Export Job | `collaboration` | `collaboration` | Export button + download | API contract, worker test | M7 |
| **F-20** Activity Timeline | 0605 | Audit Record | `system_ops` | `reporting` | Activity feed | API contract | M7 |
| **F-21** Migration | 1001–1003 | Import Event, all entities | All schemas | `migration` | Migration page in Settings | API contract, E2E | M8 |

### 23.2 User Flow → Milestone Traceability

| User Flow | APIs | Earliest Complete Milestone |
|---|---|---|
| **UF-01** Register Page & Tags | 0101, 0102, 0106, 0108, 0505, 0504 | M2 (API), M5 (notifications) |
| **UF-02** Initial Migration | 1001, 1002, 1003, 0505 | M8 |
| **UF-03** Author & Approve English | 0201, 0202, 0203, 0204, 0105, 0901, 0505, 0504, 0501, 0502 | M2 (core), M5 (cascades) |
| **UF-04** Translate Single Tag | 0301, 0309, 0304, 0308, 0105, 0505, 0504 | M3 (core), M5 (notifications) |
| **UF-05** Bulk Translate Page | 0302, 0309, 0304, 0305, 0505, 0504 | M3 |
| **UF-06** Review Translations | 0304, 0303, 0308, 0606, 0505, 0504 | M3 (review), M7 (queue) |
| **UF-07** Bulk Approve | 0305, 0606, 0505, 0504 | M3 |
| **UF-08** Resolve Stale | 0306, 0307, 0603, 0308, 0505, 0504 | M3 (resolve), M7 (report) |
| **UF-09** Founder Escalation | 0203, 0606, 0505, 0504 | M2 (escalation), M7 (queue) |
| **UF-10** Publish | 0401–0405, 0502, 0505, 0504 | M4 (manual), M5 (implicit) |
| **UF-11** Rollback | 0406, 0407, 0505, 0504 | M4 |
| **UF-12** Correct Production Translation | 0303, 0304, 0401, 0403, 0404, 0405, 0505, 0504 | M4 |
| **UF-13** Find & Inspect | 0701, 0103, 0104, 0105, 0702–0705, 0902 | M2 (browse), M7 (search) |
| **UF-14** Monitor Coverage | 0601–0605, 0607, 0807 | M7 |
| **UF-15** Investigate History | 0701, 0105, 0204, 0308, 0904, 0406, 0605, 0902 | M7 |
| **UF-16** Deprecate Tag | 0107, 0505, 0504 | M2 |
| **UF-17** Add Language | 0802, 0803, 0807, 0506, 0505, 0504 | M6 |
| **UF-18** System Configuration | 0801, 0804, 0805, 0806, 0505 | M6 |
| **UF-19** Export | 0905 | M7 |

### 23.3 DB Audit Finding → Implementation Traceability

| Finding | Severity | Implementation Phase | Test Phase | Verified In |
|---|---|---|---|---|
| **P0-01** Stale ETag retry | P0 | Phase 5 (Worker) | Phase 5 | Concurrent stale cascade test |
| **P0-02** 409 Conflict handling | P0 | Phase 3 (Group 3 APIs) | Phase 3 | Concurrency test per mutation endpoint |
| **P0-03** External boundary enforcement | P0 | Phase 3 (AI), Phase 4 (LS) | Phase 3, Phase 4 | 3-Phase Commit verification test |
| **P1-01** GIN index on pages | P1 | Phase 1 (Migration V013) | Phase 7 | FTS search test |
| **P1-02** Deployment version race | P1 | Phase 4 (Release creation) | Phase 4 | Concurrent publish test |
| **P1-03** Deferred FK | P1 | Phase 1 (Migration V005) | Phase 8 | Migration E2E test |
| **P2-01** FTS version scope | P2 | Phase 7 (Search queries) | Phase 7 | Search accuracy test |
| **P2-02** Coverage language index | P2 | Phase 1 (Migration V013) | Phase 6 | Language deactivation test |
| **P2-03** Recently-edited index | P2 | Phase 1 (Migration V013) | Phase 7 | Cleanup job test |
| **P2-04** trigger_source CHECK | P2 | Phase 1 (Migration V015) | Phase 4 | Invalid trigger_source test |
| **P2-05** N+1 query prevention | P2 | Phase 2 (Page Detail repo) | Phase 2 | Load test with 100+ tag page |

---

## 24. Implementation Start Checklist

Everything that must be ready before the first engineer starts implementation.

### 24.1 Decisions Required

| # | Decision | Owner | Impact |
|---|---|---|---|
| D-01 | **Backend technology stack** (language + framework: e.g., Java/Spring Boot, TypeScript/NestJS, Go/Gin) | Engineering Lead | Phase 0 — cannot create project without this |
| D-02 | **Frontend framework** (e.g., React, Vue, Angular) | Engineering Lead | Phase 0 — cannot create SPA without this |
| D-03 | **Authentication provider** (OIDC issuer: MioSalon's existing auth or standalone) | Architecture + DevOps | Phase 2 — auth middleware depends on this |
| D-04 | **Hosting environment** (cloud provider: AWS/GCP/Azure, or on-premise) | DevOps | Phase 0 — affects Docker Compose, CI/CD, infrastructure provisioning |
| D-05 | **ED-3 confirmation** (per-language value preservation in Language Services bulkImportPages) | Engineering (Language Services team) | Phase 4 — publishing payload construction depends on this |

### 24.2 Access Required

| # | Item | Required For |
|---|---|---|
| A-01 | Source code repository (GitHub/GitLab) | Phase 0 |
| A-02 | CI/CD platform (GitHub Actions, Jenkins, etc.) | Phase 0 |
| A-03 | Container registry (Docker Hub, ECR, etc.) | Phase 0 |
| A-04 | Auth provider credentials (OIDC client ID/secret, issuer URL) | Phase 2 |
| A-05 | Language Services DEV endpoint URL + credentials | Phase 4 |
| A-06 | Language Services QA endpoint URL + credentials | Phase 10 |
| A-07 | Language Services PRODUCTION endpoint URL + credentials | Phase 10 |
| A-08 | AI Translation Service endpoint + credentials (or confirmation of mock strategy) | Phase 3 |
| A-09 | Current Language Services data export file (for migration) | Phase 8 |
| A-10 | Language Services domain name (for API payload construction, AF-3) | Phase 4 |
| A-11 | Production infrastructure provisioning approval | Phase 10 |
| A-12 | Monitoring/alerting platform (Prometheus, Grafana, CloudWatch, etc.) | Phase 10 |

### 24.3 Documents to Distribute to Engineering

| Document | Purpose |
|---|---|
| **IMP-01** (this document) | Implementation sequence and dependencies |
| **SYS-01** | System architecture, module structure, transaction patterns |
| **API Design Groups 1–10** | API contracts (endpoints, request/response schemas, error codes) |
| **DB-01** | Database standards and conventions |
| **DB-02–06** | Physical schema definitions |
| **DB-AUDIT-FINAL** | Required corrections and P0/P1 implementation contracts |
| **ED-01 v1.1** | Canonical entity model |
| **ED-02 v1.0** | Entity relationships and state machines |
| **FRD** | Feature requirements (for acceptance criteria) |
| **IA** | Information Architecture (for frontend structure) |
| **UX Flows** | UX flow specifications (for frontend behaviour) |

### 24.4 Pre-Flight Verification

Before writing the first line of code, verify:

- [ ] D-01 through D-05 decisions are made and documented
- [ ] A-01 through A-12 access items are confirmed or have a confirmed timeline
- [ ] All governing documents (listed in §24.3) are accessible to the engineering team
- [ ] Development environment requirements are understood (PostgreSQL 16+, PgBouncer, Object Storage)
- [ ] The engineering team has read: IMP-01, SYS-01, DB-01, DB-AUDIT-FINAL, and the API Design Group(s) relevant to their assigned phase
- [ ] The engineering team understands the three cardinal rules:
  1. Audit records are written synchronously within the primary DB transaction (GP-05)
  2. External HTTP calls never occur inside a DB transaction (GP-02)
  3. Notifications are dispatched asynchronously after transaction commit (GP-06)

---

*End of MioTranslate — IMP-01: Engineering Implementation Plan — v1.0*

*This document converts the locked MioTranslate architecture into an actionable implementation sequence. It governs phase ordering, dependency management, validation strategy, and release milestones. All implementation work must be validated against this plan and against the governing baseline documents it references.*

*No architectural decisions are reopened. No features are added. No schemas are redesigned. The plan is derived from the locked baseline — not used to change it.*
