# MioTranslate — SYS-01: Technical / System Architecture

**Product:** MioTranslate  
**Document Type:** System Architecture — Production Technical Architecture  
**Document ID:** SYS-01  
**Version:** 1.0  
**Author:** Principal Software Architect + Principal Backend Architect + Platform Architect  
**Date:** August 2026  

**Governing Baseline (all locked and studied before authoring):**  
BRD, FRD (all sections), User Flows (UF-01–UF-19), UX Flows, IA / Page Hierarchy, API List (63 APIs, 10 domains), API Design Groups 1–10 (locked), Full API Architecture Audit + Post-Audit Resolutions, ED-01 v1.1, ED-02 v1.0, ED-03 v1.0, DB-01 through DB-06, Final DB Architecture Audit (DB-AUDIT-FINAL v1.1), System Design v3

---

> **Purpose of this document.**  
> SYS-01 defines the production technical architecture for MioTranslate: how the system is structured, how its components relate, how data flows through them, how background work is processed, how external systems are integrated, how failures are handled, and how the system is deployed and observed.
>
> **This document does not:**  
> - Redesign any approved product behaviour, API contract, entity model, or database schema.  
> - Produce code, implementation scripts, deployment manifests, or CI/CD pipeline definitions.  
> - Assume that 10 API groups = 10 services. The architecture is derived from requirements, not from document boundaries.

---

## Table of Contents

1. [Guiding Principles](#1-guiding-principles)
2. [System Context](#2-system-context)
3. [Architecture Style Decision](#3-architecture-style-decision)
4. [Application Topology](#4-application-topology)
5. [Frontend Architecture](#5-frontend-architecture)
6. [Backend Application Structure](#6-backend-application-structure)
7. [API Architecture](#7-api-architecture)
8. [Database Interaction Architecture](#8-database-interaction-architecture)
9. [Background Processing & Async Workflows](#9-background-processing--async-workflows)
10. [External Integration Architecture](#10-external-integration-architecture)
11. [Authentication & Authorization Architecture](#11-authentication--authorization-architecture)
12. [Environment & Deployment Topology](#12-environment--deployment-topology)
13. [Failure Handling & Retry Architecture](#13-failure-handling--retry-architecture)
14. [Observability Architecture](#14-observability-architecture)
15. [API Group → Component Traceability](#15-api-group--component-traceability)
16. [Concurrency Architecture](#16-concurrency-architecture)
17. [Security Architecture](#17-security-architecture)
18. [Capacity & Scale Envelope](#18-capacity--scale-envelope)
19. [Consistency Audit — Baseline Documents](#19-consistency-audit--baseline-documents)

---

## 1. Guiding Principles

These principles govern every decision in this document. They are derived from the locked baseline and from the user's explicit architectural constraints.

| # | Principle | Source |
|---|---|---|
| GP-01 | **Prefer the simplest architecture that safely satisfies the approved requirements.** | User directive |
| GP-02 | **External network calls must not occur inside PostgreSQL transactions.** | DB-01 §12.3, DB-AUDIT-FINAL P0-03 |
| GP-03 | **Do not redesign the database unless a genuine system-level dependency makes it necessary.** The DB architecture (DB-01–06) is locked. | User directive |
| GP-04 | **10 API groups ≠ 10 microservices.** Service boundaries are derived from operational requirements, not from API design document boundaries. | User directive |
| GP-05 | **Audit records are written synchronously within the same DB transaction as the primary operation.** Audit failure rolls back the primary operation. | DB-01 §12.3, Group 5 §3.5 |
| GP-06 | **Notifications are dispatched asynchronously after the primary transaction commits.** A failed notification does not roll back the primary operation. | DB-01 §12.3, Group 5 §3.4 |
| GP-07 | **The database is the single source of truth for all entity state.** No external cache, queue, or service is authoritative for entity lifecycle. | DB-01 §18.2, ED-01 §4 |
| GP-08 | **Language isolation is a hard domain invariant.** Operations on one language must never affect another language's data. | ED-01 §7.4, FRD Rule 7 |

---

## 2. System Context

MioTranslate operates within a defined ecosystem of three systems. This boundary was established in System Design v3 and is immutable.

```
┌────────────────────────────────────────────────────────────────────────┐
│                        MioTranslate Ecosystem                         │
│                                                                       │
│  ┌─────────────────────┐                                              │
│  │   MioSalon Codebase │  Developers add tags + fallback English      │
│  │   (PHP)             │  in code. No runtime dependency on           │
│  │                     │  MioTranslate. Tags referenced by ID.        │
│  └──────────┬──────────┘                                              │
│             │ Human coordination (tag IDs)                             │
│             ▼                                                         │
│  ┌─────────────────────────────────────────────────────────────┐      │
│  │           MioTranslate (THIS SYSTEM)                        │      │
│  │                                                             │      │
│  │  Source of truth for all UX copy.                           │      │
│  │  Manages: pages, tags, English copy, translations,          │      │
│  │  review workflows, publishing pipeline, audit trail.        │      │
│  │                                                             │      │
│  │  Team of ~15 concurrent users.                              │      │
│  │  Internal platform — not customer-facing.                   │      │
│  └──────────┬──────────────────────────┬───────────────────────┘      │
│             │ Pushes approved bundles   │ Sends English text           │
│             │ (POST bulkImportPages)    │ for translation              │
│             ▼                          ▼                              │
│  ┌─────────────────────┐   ┌─────────────────────┐                   │
│  │  Language Services   │   │  AI Translation     │                   │
│  │  (External)          │   │  Service (External) │                   │
│  │                      │   │                     │                   │
│  │  Receives published  │   │  Receives English   │                   │
│  │  bundles per env.    │   │  text + context.     │                   │
│  │  Serves tags to      │   │  Returns: translated │                   │
│  │  MioSalon UI.        │   │  text, back-trans,   │                   │
│  │  Read-only after     │   │  confidence score.   │                   │
│  │  migration.          │   │                     │                   │
│  └─────────────────────┘   └─────────────────────┘                   │
│                                                                       │
│  ┌─────────────────────┐                                              │
│  │  MioSalon UI        │  Reads tags from Language Services.          │
│  │  (End-user app)     │  Never communicates with MioTranslate.       │
│  └─────────────────────┘                                              │
└────────────────────────────────────────────────────────────────────────┘
```

### 2.1 System Boundary Summary

| System | Relationship to MioTranslate | Integration Type |
|---|---|---|
| **MioSalon Codebase** | Tag IDs are created in code and manually registered in MioTranslate. No runtime integration. | Human coordination |
| **Language Services** | MioTranslate pushes approved bundles via `POST /multilingual/bulkImportPages`. Three endpoints (DEV, QA, PRODUCTION). | Outbound HTTP (push) |
| **AI Translation Service** | MioTranslate sends English text with context and receives translations. | Outbound HTTP (request/response) |
| **MioSalon UI** | No direct relationship. Salon teams never interact with MioTranslate. | None |

### 2.2 External API Facts (Locked)

Per API List §4.1 and §4.2:

**Language Services API — `POST /multilingual/bulkImportPages`:**
- Single page scope per request (AF-1)
- Multi-language aggregation supported (AF-2)
- Upsert semantics — supplied tags updated; unsupplied tags preserved (AF-6)
- Invalid domain → entire request rejected (AF-8)
- Invalid language code → that language fails, valid languages succeed (AF-9)
- Per-language status in response with processed/failed counts (AF-10)

**AI Translation Service:**
- Specification not yet finalized (API List §4.2)
- Must support: English text + business context in → translated text + back-translation + confidence score out
- Variable/placeholder integrity verification required

---

## 3. Architecture Style Decision

### 3.1 Evaluation

| Architecture Style | Evaluation | Verdict |
|---|---|---|
| **Microservices (10 services)** | 10 API groups are logical domain boundaries for specification, not operational boundaries. The data model requires cross-domain transactional integrity (English approval → stale cascade → audit record spans Groups 2, 3, 5). Splitting into microservices creates distributed transaction complexity with zero operational benefit at ~15 users. | ❌ Rejected |
| **Microservices (3–4 services)** | Better than 10, but still introduces network boundaries between operations that must be ACID-atomic (approval + stale flagging + audit). The saga complexity is not justified at this scale. | ❌ Rejected |
| **Modular Monolith** | Single deployable unit with clear internal module boundaries. Cross-domain transactions are local function calls within a single database connection. Module boundaries enforce separation of concerns without network overhead. Matches the single-database architecture (DB-01 §2.1). Simplest architecture that satisfies all requirements. | ✅ **Chosen** |
| **Service-Oriented (2 services: API + Worker)** | Splitting the synchronous API server from the asynchronous background worker is operationally justified. They have different scaling, failure, and lifecycle characteristics. This is not a microservice split — it is a deployment topology split within the same codebase. | ✅ **Chosen (for deployment)** |

### 3.2 Decision: Modular Monolith with Separate Worker Process

**Architecture:** MioTranslate is a **modular monolith** — a single codebase organized into internal modules aligned to the 10 API domain groups, deployed as **two process types** sharing the same database:

1. **API Server** — handles all synchronous HTTP requests (Groups 1–4, 6–10 user-facing endpoints).
2. **Background Worker** — handles all asynchronous operations (Group 5 system-triggered behaviours that run outside the request/response cycle).

Both processes share:
- The same codebase and module structure
- The same PostgreSQL database (DB-01 §2.1)
- The same entity models and domain logic
- The same configuration

They differ in:
- Process lifecycle (API server handles HTTP; Worker processes job queue)
- Scaling characteristics (API scales by request volume; Worker scales by job throughput)
- Failure handling (API returns HTTP errors; Worker retries with backoff)

### 3.3 Rationale

This architecture is the simplest that satisfies the approved requirements because:

1. **Cross-domain transactional integrity** — English approval (Group 2) must atomically cascade stale flags (Group 3), write audit records (Group 5), and optionally trigger implicit DEV publishing (Group 4). In a modular monolith, this is a single database transaction with local function calls. No distributed transactions, no saga coordination.

2. **Single database** — DB-01 §2.1 chose a single PostgreSQL database with schema-based separation. A modular monolith aligns directly — one application connects to one database. No cross-service data access patterns needed.

3. **Operational simplicity** — ~15 concurrent users. A single API server instance (or 2 for availability) handles all traffic trivially. The operational overhead of service mesh, service discovery, inter-service auth, and distributed tracing infrastructure is not justified.

4. **Background worker separation** — The only justified process split. Async operations (notification dispatch, implicit DEV publishing, coverage recalculation) must not block API response times, and they have different retry and failure semantics. This is a deployment concern, not a domain boundary.

---

## 4. Application Topology

```
                    ┌──────────────────────────────────────────┐
                    │            LOAD BALANCER / REVERSE PROXY │
                    │            (nginx / ALB)                 │
                    └──────────┬───────────────────────────────┘
                               │ HTTPS
                               ▼
                    ┌──────────────────────────────────────────┐
                    │         API SERVER (Process Type 1)       │
                    │                                          │
                    │  ┌────────────┐ ┌────────────┐           │
                    │  │ Module:    │ │ Module:    │           │
                    │  │ Registry   │ │ Content    │  ...      │
                    │  │ (Group 1)  │ │ (Group 2)  │           │
                    │  └────────────┘ └────────────┘           │
                    │  ┌────────────┐ ┌────────────┐           │
                    │  │ Module:    │ │ Module:    │           │
                    │  │ Translation│ │ Publishing │  ...      │
                    │  │ (Group 3)  │ │ (Group 4)  │           │
                    │  └────────────┘ └────────────┘           │
                    │                                          │
                    │  Cross-cutting: Auth, Audit, ETag,       │
                    │  Error Handling, Request Correlation      │
                    │                                          │
                    │  Produces jobs ──────────────────────┐    │
                    └──────────┬───────────────────────────┼────┘
                               │ SQL (PgBouncer)          │ Job Queue
                               ▼                          ▼
                    ┌──────────────────────┐  ┌────────────────────────┐
                    │  PostgreSQL Primary   │  │  BACKGROUND WORKER     │
                    │  (Single Database)    │  │  (Process Type 2)      │
                    │                      │  │                        │
                    │  Schemas:            │  │  Consumers:            │
                    │  registry, content,  │  │  • NotificationWorker  │
                    │  translation,        │  │  • ImplicitDevPublish  │
                    │  publishing,         │  │  • CoverageRecalc      │
                    │  system_ops,         │  │  • StaleCascadeRetry   │
                    │  reporting, search,  │  │  • ExportGenerator     │
                    │  admin, collab,      │  │  • MigrationExecutor   │
                    │  migration           │  │                        │
                    │                      │  │  Same codebase as API  │
                    └──────────┬───────────┘  └────────────┬───────────┘
                               │                           │ SQL (PgBouncer)
                    ┌──────────▼───────────┐               │
                    │  PostgreSQL Replica   │◄──────────────┘
                    │  (Hot Standby)        │  (reads for reporting,
                    │                      │   audit, search)
                    └──────────────────────┘
                    
                    ┌──────────────────────┐
                    │  Object Storage      │  Migration files,
                    │  (S3-compatible)     │  export files
                    └──────────────────────┘
```

### 4.1 Component Inventory

| Component | Type | Purpose | Count (Production) |
|---|---|---|---|
| **Load Balancer** | Infrastructure | TLS termination, request routing to API server | 1 |
| **API Server** | Application process | Handles all synchronous HTTP API requests | 2 (HA) |
| **Background Worker** | Application process | Processes async jobs (notifications, publishing, coverage, exports, migration) | 1–2 |
| **PostgreSQL Primary** | Database | Single source of truth for all entity state | 1 |
| **PostgreSQL Replica** | Database | Hot standby for reporting reads and failover | 1 |
| **PgBouncer** | Connection pool | Transaction-mode connection pooling for both API and Worker | 1 |
| **Object Storage** | Storage | Migration upload files, export download files | 1 (S3-compatible) |
| **Job Queue** | Infrastructure | Async job dispatch from API to Worker | See §9.1 |

---

## 5. Frontend Architecture

### 5.1 Application Type

MioTranslate is an **internal single-page application (SPA)** accessed by ~15 team members via web browser. It is not customer-facing.

### 5.2 Frontend–Backend Relationship

| Aspect | Decision |
|---|---|
| **Rendering model** | Client-side SPA. The backend serves a static SPA bundle and exposes a REST API. No server-side rendering. |
| **API communication** | RESTful JSON over HTTPS. All 63 APIs (Groups 1–10) are consumed by the SPA via standard `fetch`/XHR. |
| **Authentication** | The SPA obtains an authentication token (see §11) and sends it as a `Bearer` token in the `Authorization` header on every API request. |
| **Real-time updates** | Not required (FRD §8.2 Out of Scope: no real-time collaborative editing). The SPA polls or refreshes on user action. |
| **Optimistic concurrency** | The SPA reads `ETag` response headers and sends `If-Match` headers on mutation requests. On `409 Conflict`, the SPA prompts the user to refresh. |
| **File upload** | Migration file upload (API-1001) and export download (API-0905 sub-endpoints) use standard multipart upload / download URLs respectively. |
| **Notifications** | The SPA polls `GET /v1/notifications` (API-0906) on a periodic interval (e.g., 30 seconds) to display in-app notification badges. No WebSocket. |

### 5.3 SPA Module Structure

The SPA's internal structure mirrors the IA (Information Architecture) hierarchy, not the API groups:

| SPA Module | IA Section | Primary API Groups Consumed |
|---|---|---|
| Pages & Tags Browser | C1–C3 | Group 1 |
| English Copy Management | C3 (Tag Detail) | Group 2 |
| Translation Management | C3 (Tag Detail) | Group 3 |
| Publishing & Deployment | C5–C7 | Group 4 |
| Dashboard & Reports | C6–C7 | Group 6 |
| Search & Navigation | C8 | Group 7 |
| Administration | C9 | Group 8 |
| Comments & Activity | C3, C7 | Group 9 |
| Migration | C10 | Group 10 |
| Notification Inbox | Global | Group 9 (API-0906, API-0907) |

---

## 6. Backend Application Structure

### 6.1 Module Organization

The backend is a single application organized into **domain modules**. Each module owns its business logic, service layer, and repository layer. Modules communicate via **direct in-process method calls**, not via HTTP or message queues.

```
miotranslate-backend/
├── modules/
│   ├── registry/           ← Group 1: Pages & Tags
│   │   ├── api/            ← HTTP controllers (REST endpoints)
│   │   ├── service/        ← Business logic, orchestration
│   │   ├── repository/     ← Database access (registry schema)
│   │   └── model/          ← Domain entities, DTOs
│   │
│   ├── content/            ← Group 2: English Copy
│   │   ├── api/
│   │   ├── service/
│   │   ├── repository/     ← content schema
│   │   └── model/
│   │
│   ├── translation/        ← Group 3: Translation Management
│   │   ├── api/
│   │   ├── service/
│   │   ├── repository/     ← translation schema
│   │   └── model/
│   │
│   ├── publishing/         ← Group 4: Publishing & Deployment
│   │   ├── api/
│   │   ├── service/
│   │   ├── repository/     ← publishing schema
│   │   └── model/
│   │
│   ├── system/             ← Group 5: System-Triggered Behaviours
│   │   ├── service/        ← Stale cascade, implicit publish, coverage, audit, notification, slot creation
│   │   ├── repository/     ← system_ops schema (audit, notifications, coverage)
│   │   ├── worker/         ← Background job handlers
│   │   └── model/
│   │
│   ├── reporting/          ← Group 6: Visibility & Reporting
│   │   ├── api/
│   │   ├── service/
│   │   ├── repository/     ← reporting schema (reads from source tables + coverage_metrics)
│   │   └── model/
│   │
│   ├── search/             ← Group 7: Search & Navigation
│   │   ├── api/
│   │   ├── service/
│   │   ├── repository/     ← search schema (bookmarks, recently_edited_events, tsvector queries)
│   │   └── model/
│   │
│   ├── admin/              ← Group 8: Administration
│   │   ├── api/
│   │   ├── service/
│   │   ├── repository/     ← admin schema (users, roles, languages, config)
│   │   └── model/
│   │
│   ├── collaboration/      ← Group 9: Comments, Audit & Export
│   │   ├── api/
│   │   ├── service/
│   │   ├── repository/     ← collaboration schema (comments, export_jobs)
│   │   └── model/
│   │
│   └── migration/          ← Group 10: Migration
│       ├── api/
│       ├── service/
│       ├── repository/     ← migration schema (import_events)
│       └── model/
│
├── shared/
│   ├── auth/               ← Authentication & authorization middleware
│   ├── audit/              ← Cross-cutting audit record creation (Group 5 API-0505)
│   ├── concurrency/        ← ETag validation, optimistic lock exception handling
│   ├── error/              ← Standardized error response formatting
│   ├── correlation/        ← Request ID generation and propagation
│   ├── pagination/         ← Cursor/offset pagination utilities
│   └── integration/        ← External HTTP clients (Language Services, AI Translation)
│
├── config/                 ← Environment-specific configuration
└── worker/                 ← Background worker entry point (same modules, different main)
```

### 6.2 Module Dependency Rules

| Rule | Rationale |
|---|---|
| **Modules may depend on other modules via their service interfaces only.** No module directly accesses another module's repository layer. | Preserves encapsulation. A module owns its data access. |
| **Cross-module dependencies must be unidirectional where possible.** Circular dependencies are resolved through the `shared` layer or through event dispatch (post-commit hooks). | Prevents coupling knots. |
| **The `shared/audit` module is the sole path for audit record creation.** Every module calls `AuditService.record(...)` within its transaction. | Enforces GP-05: guaranteed audit. |
| **The `shared/integration` module is the sole path for external HTTP calls.** No module directly constructs HTTP clients to Language Services or AI Translation. | Enforces GP-02: external calls outside DB transactions. Centralizes retry, timeout, and circuit-breaker logic. |

### 6.3 Known Cross-Module Dependencies

These cross-module calls are architecturally required by the locked API contracts:

| Calling Module | Called Module | Trigger | Reason |
|---|---|---|---|
| `content` (Group 2) | `system` (Group 5) | API-0203: English Copy Approved | Triggers stale cascade (API-0501), implicit DEV publish dispatch (API-0502), audit |
| `translation` (Group 3) | `system` (Group 5) | API-0304: Translation Approved | Triggers implicit DEV publish dispatch (API-0502), audit |
| `registry` (Group 1) | `content` + `translation` + `system` | API-0102: Tag Created | Creates English Copy entity (NO_COPY), creates Translation slots (NO_TRANSLATION), audit |
| `publishing` (Group 4) | `shared/integration` | API-0405, API-0407 | Calls Language Services (external, outside DB transaction) |
| `translation` (Group 3) | `shared/integration` | API-0301, API-0302, API-0307 | Calls AI Translation Service (external, outside DB transaction) |
| `admin` (Group 8) | `system` (Group 5) | API-0802: Add Language | Triggers empty translation slot creation (API-0506) |
| All modules | `shared/audit` | Every write operation | Audit record creation (GP-05) |

---

## 7. API Architecture

### 7.1 API Conventions (Inherited from Locked API Design)

All API conventions are inherited from the locked API Design Groups 1–10. SYS-01 does not redefine them. Key architectural conventions:

| Convention | Specification |
|---|---|
| **Protocol** | HTTPS (TLS 1.2+) |
| **Format** | JSON request/response bodies |
| **Base path** | `/v1/` (version prefix on all endpoints) |
| **Authentication** | `Authorization: Bearer <token>` on every request (see §11) |
| **Concurrency control** | `ETag` / `If-Match` headers for optimistic locking (DB-01 §11) |
| **Error format** | Standardized error envelope: `{ "error": { "code": "...", "message": "...", "details": [...] } }` |
| **Pagination** | Cursor-based for large collections; offset for bounded collections |
| **Request correlation** | `X-Request-Id` header generated by API server; propagated to audit records and logs |
| **Rate limiting** | Not required at v1 (~15 users). Infrastructure-level rate limiting available via load balancer. |

### 7.2 API Routing

All 63 APIs are served by the single API Server process. The API server routes requests to the appropriate module's controller layer based on URL path prefix:

| URL Path Prefix | Module | API Group |
|---|---|---|
| `/v1/pages`, `/v1/tags` | `registry` | Group 1 |
| `/v1/tags/{tagId}/english-copy` | `content` | Group 2 |
| `/v1/tags/{tagId}/translations` | `translation` | Group 3 |
| `/v1/pages/{pageId}/publishing`, `/v1/releases` | `publishing` | Group 4 |
| *(internal only — no HTTP endpoint)* | `system` | Group 5 |
| `/v1/dashboard`, `/v1/reports` | `reporting` | Group 6 |
| `/v1/search`, `/v1/bookmarks`, `/v1/recently-edited` | `search` | Group 7 |
| `/v1/users`, `/v1/languages`, `/v1/config` | `admin` | Group 8 |
| `/v1/comments`, `/v1/audit`, `/v1/exports`, `/v1/notifications` | `collaboration` | Group 9 |
| `/v1/migrations` | `migration` | Group 10 |

### 7.3 API Request Lifecycle

Every API request follows this standardized lifecycle:

```
HTTP Request
     │
     ▼
┌─────────────────────────────────────────────────────────────────┐
│  1. Request Correlation                                         │
│     Generate X-Request-Id if not present. Attach to MDC/context.│
├─────────────────────────────────────────────────────────────────┤
│  2. Authentication                                              │
│     Validate Bearer token. Extract user identity.               │
│     Reject with 401 if invalid.                                 │
├─────────────────────────────────────────────────────────────────┤
│  3. Authorization                                               │
│     Check user roles against endpoint permission matrix (FRD §8)│
│     Reject with 403 if insufficient.                            │
├─────────────────────────────────────────────────────────────────┤
│  4. Request Validation                                          │
│     Validate path params, query params, request body.           │
│     Reject with 400 if invalid.                                 │
├─────────────────────────────────────────────────────────────────┤
│  5. ETag Validation (mutations only)                            │
│     Parse If-Match header. Pass to service layer.               │
├─────────────────────────────────────────────────────────────────┤
│  6. Business Logic Execution                                    │
│     Module service method executes.                             │
│     DB transaction opened → business logic → audit → commit.    │
│     If external call needed: commit first → call → new tx.      │
├─────────────────────────────────────────────────────────────────┤
│  7. Post-Commit Side Effects                                    │
│     Dispatch async jobs (notifications, implicit publish,       │
│     coverage recalculation) to job queue. Fire-and-forget.      │
├─────────────────────────────────────────────────────────────────┤
│  8. Response Construction                                       │
│     Serialize response. Set ETag header. Set status code.       │
└─────────────────────────────────────────────────────────────────┘
     │
     ▼
HTTP Response
```

---

## 8. Database Interaction Architecture

### 8.1 Connection Topology

```
┌──────────────┐      ┌───────────┐      ┌─────────────────────┐
│  API Server   │─────►│ PgBouncer │─────►│ PostgreSQL Primary   │
│  (read/write) │      │ (txn mode)│      │ (all writes,         │
└──────────────┘      │           │      │  read-your-writes)   │
                      │           │      └──────────┬────────────┘
┌──────────────┐      │           │                  │ Streaming
│  Background   │─────►│           │                  │ Replication
│  Worker       │      └───────────┘                  ▼
│  (read/write) │                        ┌─────────────────────┐
└──────────────┘                         │ PostgreSQL Replica    │
                                         │ (reporting reads,     │
┌──────────────┐                         │  audit queries,       │
│  API Server   │───────────────────────►│  global search)       │
│  (read-only   │   Direct read connection│                     │
│   queries)    │                         └─────────────────────┘
└──────────────┘
```

### 8.2 Connection Configuration

| Parameter | API Server | Background Worker |
|---|---|---|
| **Pool size** | 10–20 connections (via PgBouncer) | 5–10 connections (via PgBouncer) |
| **Pooling mode** | Transaction | Transaction |
| **Statement timeout** | 10 seconds (API queries) | 60 seconds (background jobs) |
| **Target** | Primary (writes + read-your-writes), Replica (reporting reads) | Primary (all operations) |

### 8.3 Transaction Model

The following transaction patterns are mandated by DB-01 §12 and enforced in the application:

#### Pattern 1: Simple Read (GET endpoints)
```
BEGIN READ ONLY
  → SELECT with JOINs
COMMIT
```
No locks acquired. May use read replica for reporting endpoints (Group 6 APIs, API-0904, API-0701).

#### Pattern 2: Simple Mutation (most POST/PUT/PATCH endpoints)
```
BEGIN (READ COMMITTED)
  → SELECT FOR UPDATE on target entity (acquire row lock)
  → Validate ETag (etag_version check)
  → Business logic mutations
  → INSERT audit_record (within same transaction — GP-05)
  → etag_version = etag_version + 1
COMMIT
→ Post-commit: dispatch async jobs (notifications, coverage recalc)
```

#### Pattern 3: Multi-Entity Cascade (SERIALIZABLE)
```
BEGIN SERIALIZABLE
  → SELECT FOR UPDATE on primary entity
  → Primary entity mutation (e.g., English Copy → APPROVED)
  → Cascade mutations (e.g., all Translations → STALE)
  → INSERT audit_records (one per cascaded entity)
COMMIT
→ Post-commit: dispatch async jobs
```

Used by: English Copy approval (API-0203), Tag deprecation with page cascade (API-0107), PAR approval → Release creation (API-0404).

#### Pattern 4: External Call (3-Phase Commit)
```
Phase 1: BEGIN → UPDATE status to PENDING/IN_PROGRESS → COMMIT
Phase 2: HTTP call to external service (NO DB TRANSACTION)
Phase 3: BEGIN → Record result → UPDATE status to SUCCESSFUL/FAILED → INSERT audit → COMMIT
```

Used by: Publishing execution (API-0405), Rollback execution (API-0407), AI Translation (API-0301, API-0302, API-0307).

This pattern enforces GP-02 (no external calls inside DB transactions).

### 8.4 Schema Access Rules

Each module's repository layer accesses only its assigned database schema (DB-01 §2.2). Cross-schema reads are permitted (e.g., Group 3 reads `content.english_copies` to validate English copy status). Cross-schema writes are restricted to the documented exceptions:

| Cross-Schema Write | Source Module | Target Schema | Justification |
|---|---|---|---|
| Stale flagging | `system` (Group 5) | `translation.translations` | API-0501: English approval cascades stale flags. This is the single approved cross-domain write (DB-01 §2.3). |
| Tag creation side-effects | `registry` (Group 1) | `content.english_copies`, `translation.translations` | API-0102: Tag creation atomically creates EC (NO_COPY) + Translation slots (NO_TRANSLATION). Same transaction. |
| Language addition side-effects | `admin` (Group 8) → `system` (Group 5) | `translation.translations` | API-0506: New language creates translation slots for all active tags. |

---

## 9. Background Processing & Async Workflows

### 9.1 Job Queue Architecture

**Technology Decision:** Database-backed job queue (PostgreSQL table).

**Rationale:** At ~15 users and modest throughput, a separate message broker (RabbitMQ, Redis Streams, SQS) adds operational complexity without proportional benefit. A PostgreSQL-backed job queue (e.g., using the `SKIP LOCKED` advisory lock pattern, or a library like `pgboss` for Node.js / `Quartz` with JDBC store for Java) provides reliable, transactional job dispatch with zero additional infrastructure.

**Key property:** Job dispatch is **transactional with the primary operation**. When API-0203 approves English copy, the API server inserts the primary data mutations AND the async job record in the same transaction. If the transaction rolls back, the job is never dispatched. This prevents ghost jobs.

### 9.2 Async Job Types

| Job Type | Triggered By | Execution Location | Idempotency | Retry Policy |
|---|---|---|---|---|
| **STALE_CASCADE** | API-0203 (EC approved, text changed) | Worker | Yes — `UPDATE WHERE status NOT IN ('NO_TRANSLATION', 'STALE')` is naturally idempotent | 3 retries, exponential backoff (P0-01 from DB-AUDIT) |
| **IMPLICIT_DEV_PUBLISH** | API-0203 (EC approved) or API-0304 (Translation approved) | Worker | Yes — bundle hash comparison prevents duplicate publishes | 3 retries, exponential backoff |
| **COVERAGE_RECALC** | Translation approved/stale, tag created/deprecated, page published, language added | Worker | Yes — full cell recompute produces same result regardless of execution count | 3 retries, 30-second delay |
| **NOTIFICATION_DISPATCH** | Every significant write event (FRD §12) | Worker | Yes — `INSERT ON CONFLICT DO NOTHING` on `(recipient_user_id, event_type, subject_entity_id)` | 3 retries, no backoff |
| **EXPORT_GENERATION** | API-0905 (Export Tag Data) | Worker | Yes — generates file, updates export_job record | 3 retries |
| **MIGRATION_EXECUTION** | API-1002 (Execute Migration) | Worker | No — but guarded by partial unique index (`import_events_active_unique`); at most one runs | No retry — failure → FAILED status, manual re-trigger |

### 9.3 Job Lifecycle

```
API Request Handler (in DB transaction):
  1. Execute primary business logic
  2. INSERT INTO job_queue (job_type, payload, status='PENDING', ...) 
  3. INSERT audit_record
  4. COMMIT

Background Worker (polling loop):
  1. SELECT job FROM job_queue WHERE status='PENDING' ORDER BY created_at FOR UPDATE SKIP LOCKED LIMIT 1
  2. UPDATE job SET status='PROCESSING'
  3. Execute job logic
     → For external calls: use 3-Phase Commit pattern (§8.3 Pattern 4)
  4. On success: UPDATE job SET status='COMPLETED'
     On failure: UPDATE job SET status='FAILED', retry_count++, next_retry_at=...
  5. If retry_count < max_retries AND job is retriable: UPDATE job SET status='PENDING', scheduled_for=next_retry_at
```

### 9.4 Async Workflow: English Copy Approval Cascade

This is the most complex async workflow in MioTranslate, involving cascading side-effects across multiple domains:

```
User: API-0203 APPROVE (English Copy)
  │
  │ ← Synchronous (within DB transaction, SERIALIZABLE) ─────────────────────┐
  │                                                                           │
  ▼                                                                           │
┌──────────────────────────────────────────────────────────────────────────┐   │
│ Phase 1: Primary Transaction                                            │   │
│                                                                          │   │
│ 1. SELECT FOR UPDATE english_copies WHERE tag_id = $1                    │   │
│ 2. Validate ETag                                                         │   │
│ 3. Check text changed (compare new version text vs prior approved text)  │   │
│ 4. Update english_copy_versions: new version → APPROVED                  │   │
│ 5. Update english_copy_versions: prior version → SUPERSEDED              │   │
│ 6. Update english_copies: status=APPROVED, current_version_number=new    │   │
│ 7. INSERT audit_record (ENGLISH_COPY_APPROVED)                           │   │
│ 8. IF text changed:                                                      │   │
│    a. INSERT job: STALE_CASCADE (tag_id)                                 │   │
│    b. INSERT job: IMPLICIT_DEV_PUBLISH (tag_id, scope=ALL_LANGUAGES)     │   │
│ 9. INSERT job: NOTIFICATION_DISPATCH (EC_APPROVED, tag_id)               │   │
│                                                                          │   │
│ COMMIT                                                                   │   │
└──────────────────────────────────────────────────────────────────────────┘   │
                                                                              │
  ← Asynchronous (Background Worker) ────────────────────────────────────────┘
  │
  ▼
┌──────────────────────────────────────────────────────────────────────────┐
│ Job: STALE_CASCADE                                                       │
│                                                                          │
│ 1. BEGIN                                                                 │
│ 2. SELECT tag_id, language_code, etag_version                            │
│    FROM translation.translations                                         │
│    WHERE tag_id = $1 AND status NOT IN ('NO_TRANSLATION', 'STALE')       │
│ 3. For each row:                                                         │
│    UPDATE translations SET status='STALE', stale_triggered_at=now(),     │
│    stale_current_english_version=..., etag_version=etag_version+1        │
│    WHERE tag_id=$1 AND language_code=$lc AND etag_version=$ev            │
│    → If 0 rows affected (ETag conflict): RETRY this row (up to 3x)      │
│ 4. INSERT audit_records (TRANSLATION_STALE_FLAGGED per language)         │
│ 5. COMMIT                                                                │
│ 6. INSERT jobs: COVERAGE_RECALC per affected (page_id, language_code)    │
│ 7. INSERT jobs: NOTIFICATION_DISPATCH per affected language               │
└──────────────────────────────────────────────────────────────────────────┘
  │
  ▼
┌──────────────────────────────────────────────────────────────────────────┐
│ Job: IMPLICIT_DEV_PUBLISH (per eligible language)                        │
│                                                                          │
│ 1. BEGIN                                                                 │
│    Evaluate: does this (page, language) have APPROVED translations?       │
│    Compute bundle hash. Compare with last SUCCESSFUL DEV release hash.   │
│    If same → skip (no-op). If different → proceed.                       │
│    Check: no in-flight release for this (page, lang, DEV).               │
│    INSERT releases (environment=DEV, trigger_source=SYSTEM_AUTO_DEV,     │
│                     status=PENDING)                                       │
│    COMMIT                                                                │
│ 2. HTTP POST to Language Services DEV endpoint (OUTSIDE DB TX)           │
│ 3. BEGIN                                                                 │
│    On success: INSERT release_content_snapshots, UPDATE release          │
│                status=SUCCESSFUL                                         │
│    On failure: UPDATE release status=FAILED                              │
│    INSERT audit_record                                                   │
│    COMMIT                                                                │
│ 4. INSERT job: COVERAGE_RECALC (page_id, language_code)                  │
└──────────────────────────────────────────────────────────────────────────┘
```

### 9.5 Async Workflow: Production Publishing

```
User: API-0403 → API-0404 → API-0405

Step 1: API-0403 (Request Publishing)
  BEGIN
    Compute bundle hash from approved translations
    INSERT publishing_approval_requests (status=PENDING, bundle_snapshot_hash)
    INSERT audit_record
  COMMIT

Step 2: API-0404 (Approve Publishing)
  BEGIN SERIALIZABLE
    SELECT FOR UPDATE publishing_approval_requests
    Validate PAR is PENDING and not expired
    Recompute bundle hash → if mismatch, SET status=CANCELLED, return 409
    SET status=APPROVED
    INSERT releases (status=PENDING, trigger_source=USER_INITIATED)
    INSERT audit_record
  COMMIT
  → Dispatch job: EXECUTE_PUBLISH

Step 3: EXECUTE_PUBLISH (Background Worker — 3-Phase Commit)
  Phase 1: BEGIN → UPDATE releases SET status=IN_PROGRESS → COMMIT
  Phase 2: HTTP POST to Language Services endpoint (OUTSIDE DB TX)
  Phase 3: BEGIN
    On success: INSERT release_content_snapshots, UPDATE releases status=SUCCESSFUL
    On failure: UPDATE releases status=FAILED, store api_response_payload
    INSERT audit_record
  COMMIT
  → Dispatch job: COVERAGE_RECALC
  → Dispatch job: NOTIFICATION_DISPATCH
```

---

## 10. External Integration Architecture

### 10.1 Integration Principles

| Principle | Implementation |
|---|---|
| **All external calls are fire-from-outside-transaction.** | 3-Phase Commit pattern (§8.3 Pattern 4). No HTTP call inside `@Transactional`. |
| **External call results are persisted as MioTranslate-owned records.** | Release records, contentSnapshot, api_response_payload. MioTranslate does not rely on external state. |
| **External failures are recoverable.** | FAILED status → manual retry available. MioTranslate state is consistent regardless of external outcome. |
| **Timeouts are explicit.** | Language Services: 30-second connect, 60-second read timeout. AI Translation: 30-second connect, 120-second read timeout (bulk translation may be slow). |

### 10.2 Language Services Integration

```
┌──────────────┐                    ┌──────────────────────┐
│ MioTranslate │                    │  Language Services    │
│ Publishing   │                    │  API                  │
│ Module       │                    │                      │
│              │  POST /multilingual│                      │
│              │  /bulkImportPages  │                      │
│              │──────────────────►│  DEV endpoint         │
│              │                    │  QA endpoint          │
│              │◄──────────────────│  PROD endpoint        │
│              │  Response:         │                      │
│              │  per-language      │                      │
│              │  status            │                      │
└──────────────┘                    └──────────────────────┘
```

**Endpoint Configuration:**
- DEV, QA, and PRODUCTION endpoints are stored in `admin.system_configuration` (API-0805/0806).
- The domain parameter (AF-3) is a system-level configuration value.
- Endpoints are environment-specific — MioTranslate knows which Language Services instance to target for each environment.

**Payload Construction:**
Per the locked API facts (AF-1 through AF-10):
```json
{
  "domain": "{from system_config}",
  "pageId": "QUICK",
  "pageName": "Quick Sale",
  "tags": [
    {
      "tagName": "QUICK_1",
      "values": {
        "ar": "البيع السريع",
        "es": "Venta Rápida"
      }
    }
  ]
}
```

**Response Handling:**
- Full raw response stored as JSONB in `releases.api_response_payload` (DB-01 §19.1).
- Per-language success/failure extracted and used to set Release status.
- Partial failure (AF-9: invalid language code → that language fails) results in Release status `FAILED` with details in the response payload. The entire bundle is re-attempted on retry.

### 10.3 AI Translation Service Integration

```
┌──────────────┐                    ┌──────────────────────┐
│ MioTranslate │                    │  AI Translation      │
│ Translation  │                    │  Service             │
│ Module       │                    │                      │
│              │  Request:          │                      │
│              │  source_text,      │                      │
│              │  target_language,  │                      │
│              │  context (page,    │                      │
│              │  module, copy_type,│                      │
│              │  industry terms)   │                      │
│              │──────────────────►│                      │
│              │                    │                      │
│              │◄──────────────────│                      │
│              │  Response:         │                      │
│              │  translated_text,  │                      │
│              │  back_translation, │                      │
│              │  confidence_score, │                      │
│              │  variable_check    │                      │
└──────────────┘                    └──────────────────────┘
```

**Context provided to AI service:**
- `sourceText`: Approved English copy
- `targetLanguage`: Language code
- `pageId` and `pageName`: For page-level context
- `module`: For domain context (e.g., POS, CRM)
- `copyType`: For tone/style context (e.g., button, error message)
- Industry terminology markers (salon/spa domain)

**Results captured (per DB-01 §19.2):**
- `translation_versions.text` — the translated text
- `translation_versions.confidence_score` — AI confidence
- `translation_versions.back_translation` — back-translation for reviewer
- `translation_versions.variable_integrity_status` — placeholder check result
- `translation_versions.creation_method` = `AI_GENERATED`

---

## 11. Authentication & Authorization Architecture

### 11.1 Authentication

| Aspect | Decision |
|---|---|
| **Mechanism** | Token-based authentication. The SPA authenticates via an identity provider (e.g., OAuth2/OIDC with MioSalon's existing identity system) and receives a JWT or opaque token. |
| **Token transport** | `Authorization: Bearer <token>` header on every API request. |
| **Token validation** | The API server validates the token on every request. For JWT: verify signature, check expiry, extract `user_id` claim. For opaque tokens: validate against the identity provider's introspection endpoint (cacheable). |
| **User provisioning** | Users are auto-provisioned in MioTranslate on first authenticated request (Group 8 §2.1). No separate Create User API. |
| **Session management** | Stateless. No server-side session. Token expiry governs session lifetime. |

### 11.2 Authorization

Authorization is **role-based** (RBAC) per FRD §8. The complete permission matrix is defined in the FRD and enforced at two layers:

**Layer 1: API Middleware (Coarse-grained)**
Before reaching the module's business logic, the authorization middleware checks:
- Does the authenticated user have at least one role that is permitted to call this endpoint?
- If not, return `403 Forbidden`.

**Layer 2: Service Logic (Fine-grained)**
Within the module's service layer, business rules enforce finer permissions:
- Publishing to Production requires `SR` or `FN` role specifically (not just any role).
- Rollback requires `SR` or `FN`.
- Escalation to Founder requires the actor to have PM, LR, QA, or SR role.
- Admin lockout guard: cannot remove the last `ADMIN` or `FN` role.

**Role resolution:**
Active roles are read from `admin.user_role_assignments` where `revoked_at IS NULL`. Per Group 8 §7, roles are cached with a TTL ≤ 30 seconds to balance performance with permission freshness.

### 11.3 Permission Matrix (from FRD §8)

| Action | DEV | PM/QA | LR | SR | FN | ADMIN |
|---|---|---|---|---|---|---|
| View pages, tags, statuses | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Author/edit English copy | — | ✓ | — | — | ✓ | — |
| Create AI translations | — | ✓ | ✓ | — | ✓ | — |
| Approve English copy | — | — | — | ✓ | ✓ | — |
| Approve translations | — | — | ✓ | — | ✓ | — |
| Publish to Dev | — | ✓ | ✓ | ✓ | ✓ | — |
| Publish to QA | — | — | ✓ | ✓ | ✓ | — |
| Publish to Production | — | — | — | ✓ | ✓ | — |
| Rollback | — | — | — | ✓ | ✓ | — |
| Manage roles/languages/config | — | — | — | — | ✓ | ✓ |

---

## 12. Environment & Deployment Topology

### 12.1 MioTranslate Deployment Environments

MioTranslate itself is deployed in standard software delivery environments. These are **MioTranslate's own environments**, distinct from the Language Services environments (DEV/QA/PRODUCTION) that MioTranslate publishes to.

| MioTranslate Environment | Purpose | Language Services Targets |
|---|---|---|
| **MioTranslate Development** | Engineer development and testing | Language Services DEV endpoint |
| **MioTranslate Staging** | Pre-production validation | Language Services QA endpoint (or a dedicated staging LS) |
| **MioTranslate Production** | Live system used by the team | Language Services DEV, QA, and PRODUCTION endpoints (all three — user selects target when publishing) |

### 12.2 Production Deployment

```
┌──────────────────────────────────────────────────────────────────┐
│                    MioTranslate Production                        │
│                                                                  │
│  ┌────────────────┐                                              │
│  │ Load Balancer   │  TLS termination, health checks             │
│  └───────┬────────┘                                              │
│          │                                                       │
│  ┌───────▼────────┐  ┌────────────────┐                          │
│  │ API Server (1)  │  │ API Server (2)  │  Stateless, behind LB  │
│  └───────┬────────┘  └───────┬────────┘                          │
│          │                   │                                    │
│  ┌───────▼───────────────────▼────────┐                          │
│  │          PgBouncer                  │                          │
│  └───────┬─────────────────┬──────────┘                          │
│          │                 │                                      │
│  ┌───────▼────────┐  ┌────▼───────────┐                          │
│  │ PostgreSQL      │  │ PostgreSQL     │                          │
│  │ Primary         │──│ Replica        │  Streaming replication   │
│  └────────────────┘  └────────────────┘                          │
│                                                                  │
│  ┌────────────────┐  ┌────────────────┐                          │
│  │ Worker (1)      │  │ Object Storage │  S3-compatible           │
│  └────────────────┘  └────────────────┘                          │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘
```

### 12.3 Deployment Configuration

| Setting | Value | Source |
|---|---|---|
| **API Server instances** | 2 (for availability; not for throughput) | ~15 users |
| **Worker instances** | 1 (scale to 2 if job backlog exceeds threshold) | Modest async workload |
| **PostgreSQL Primary** | 1 (managed instance, e.g., RDS, Cloud SQL) | DB-01 |
| **PostgreSQL Replica** | 1 (hot standby, same AZ or cross-AZ) | DB-01 §21.1 |
| **PgBouncer** | 1 (co-located or sidecar) | DB-01 §2.4 |
| **Object Storage** | 1 bucket (prefixed: `migrations/`, `exports/`) | DB-01 §16 |
| **Health check** | `/health` endpoint on API server. Returns 200 if DB connection is healthy. | Standard |
| **Graceful shutdown** | API server drains in-flight requests (30s). Worker finishes current job before shutdown. | Standard |

### 12.4 Configuration Management

Environment-specific configuration is externalized (environment variables or config files, never hardcoded):

| Configuration | Where Stored | Notes |
|---|---|---|
| Database connection (primary) | Environment variable | `DATABASE_URL` |
| Database connection (replica) | Environment variable | `DATABASE_REPLICA_URL` |
| Language Services endpoints (DEV/QA/PROD) | `admin.system_configuration` table | Managed via API-0805/0806 |
| AI Translation Service endpoint | Environment variable | Until contract finalized |
| Auth provider configuration | Environment variable | OIDC issuer URL, client ID |
| Object storage credentials | Environment variable | S3 access key, bucket name |
| Domain for Language Services | `admin.system_configuration` table | AF-3 |

---

## 13. Failure Handling & Retry Architecture

### 13.1 Failure Classification

| Category | HTTP Status | Handling |
|---|---|---|
| **Client error** (bad input) | 400 | Immediate reject. No retry. |
| **Authentication failure** | 401 | Immediate reject. Client re-authenticates. |
| **Authorization failure** | 403 | Immediate reject. No retry. |
| **Not found** | 404 | Immediate response. No retry. |
| **Optimistic locking conflict** | 409 | Client receives latest entity state. Client refreshes and retries. |
| **Validation failure** (business rule) | 422 | Immediate reject with details. No retry. |
| **Internal server error** | 500 | Log, alert. Client may retry. |
| **External service failure** | (internal) | 3-Phase Commit: entity status → FAILED. Manual or automated retry. |

### 13.2 Retry Policies

| Operation | Retry Actor | Max Retries | Backoff | Idempotency |
|---|---|---|---|---|
| **Stale cascade ETag conflict** | Worker (automated) | 3 | Exponential (100ms, 200ms, 400ms) | Yes (per-row re-read-modify-write) |
| **Deployment version race** | API Server (automated) | 3 | Immediate retry | Yes (INSERT with unique constraint catch) |
| **Language Services publish** | Worker (automated) | 3 | Exponential (1s, 5s, 15s) | Yes (upsert semantics AF-6) |
| **AI Translation** | User (manual retry via UI) | — | — | Yes (new Translation Version created) |
| **Migration execution** | User (manual re-trigger) | — | — | Guarded by `SYSTEM_NOT_EMPTY` check |
| **Notification dispatch** | Worker (automated) | 3 | None | Yes (INSERT ON CONFLICT DO NOTHING) |
| **Coverage recalculation** | Worker (automated) | 3 | 30-second delay | Yes (full cell recompute) |
| **Export generation** | Worker (automated) | 3 | Exponential | Yes (regenerates file) |

### 13.3 External Service Circuit Breaker

For Language Services and AI Translation Service integrations:

| Parameter | Value |
|---|---|
| **Failure threshold** | 5 consecutive failures within 60 seconds |
| **Circuit open duration** | 30 seconds |
| **Half-open behavior** | Allow 1 probe request; if successful, close circuit |
| **Fallback** | Entity status remains PENDING/FAILED. User can retry manually. |

### 13.4 Dead Letter / Poison Job Handling

After exhausting all retries, a failed job transitions to `status = 'DEAD'`. Dead jobs:
- Are visible via operational monitoring (§14).
- Do not block subsequent jobs.
- Require manual investigation and re-dispatch.
- The associated entity (Release, Translation, etc.) remains in its intermediate status (PENDING, FAILED) — providing a clear indicator that attention is needed.

---

## 14. Observability Architecture

### 14.1 Logging

| Aspect | Standard |
|---|---|
| **Format** | Structured JSON (one JSON object per log line) |
| **Fields** | `timestamp`, `level`, `requestId` (X-Request-Id), `userId`, `module`, `action`, `message`, `error` (if any), `duration_ms` |
| **Levels** | `ERROR` (failures), `WARN` (recoverable issues, ETag conflicts), `INFO` (API calls, job execution), `DEBUG` (SQL queries, external call details — dev only) |
| **Correlation** | `requestId` propagated from HTTP request through all service calls, async job dispatch, and audit records. Enables end-to-end trace from user action to background completion. |
| **Retention** | 30 days (application logs), 90 days (error logs) |

### 14.2 Metrics

| Metric | Type | Purpose |
|---|---|---|
| `api_request_duration_ms` | Histogram (per endpoint) | Response time SLO tracking |
| `api_request_count` | Counter (per endpoint, status code) | Throughput and error rate |
| `db_connection_pool_active` | Gauge | Connection pool saturation |
| `db_query_duration_ms` | Histogram | Slow query detection |
| `job_queue_depth` | Gauge | Worker backlog monitoring |
| `job_execution_duration_ms` | Histogram (per job type) | Worker performance |
| `job_failure_count` | Counter (per job type) | Failure rate trending |
| `external_call_duration_ms` | Histogram (per target) | Language Services / AI latency |
| `external_call_failure_count` | Counter (per target) | External service reliability |
| `etag_conflict_count` | Counter | Concurrency conflict frequency |

### 14.3 Health Checks

| Endpoint | Checks | Used By |
|---|---|---|
| `GET /health` | DB primary connectivity, PgBouncer pool health | Load balancer |
| `GET /health/ready` | DB primary + replica connectivity, job queue accessible | Deployment readiness |
| `GET /health/live` | Process is running | Container orchestrator liveness |

### 14.4 Alerting

| Alert | Condition | Severity |
|---|---|---|
| API error rate > 5% | 5xx responses / total responses > 5% over 5 minutes | Critical |
| API p99 latency > 5s | 99th percentile response time exceeds 5 seconds | Warning |
| Job queue depth > 100 | Background jobs accumulating faster than processed | Warning |
| Dead jobs > 0 | Any job enters DEAD state | Critical |
| External service circuit open | Language Services or AI circuit breaker open | Critical |
| DB connection pool > 80% | Connection pool utilization exceeds threshold | Warning |
| DB replica lag > 30s | Replication lag exceeds acceptable threshold | Warning |
| Disk space < 20% | Database storage approaching capacity | Warning |

### 14.5 Audit Trail as Observability

The audit trail (`system_ops.audit_records`) is not just a business feature — it is a first-class observability mechanism. Every write operation produces a permanent, searchable audit record with:
- Who performed it (`performed_by`)
- When (`performed_at`)
- What changed (`before_value`, `after_value`)
- Which API triggered it (`api_id`)
- Request correlation (`correlation_id` → `request_id`)

This makes the audit table the definitive record for investigating any data question — not application logs.

---

## 15. API Group → Component Traceability

This section maps every API Group to its backend module, database schema, async job dependencies, and external integrations.

### 15.1 Complete Traceability Matrix

| API Group | API IDs | Backend Module | DB Schema(s) Read | DB Schema(s) Write | Async Jobs Produced | External Calls |
|---|---|---|---|---|---|---|
| **Group 1: Pages & Tags** | API-0101–0108 | `registry` | `registry`, `admin` (languages for slot creation) | `registry`, `content` (EC init), `translation` (slots) | `COVERAGE_RECALC` (tag create/deprecate), `NOTIFICATION_DISPATCH` | None |
| **Group 2: English Copy** | API-0201–0204 | `content` | `content`, `registry` (tag validation) | `content` | `STALE_CASCADE` (on approval with text change), `IMPLICIT_DEV_PUBLISH`, `NOTIFICATION_DISPATCH`, `COVERAGE_RECALC` | None |
| **Group 3: Translation** | API-0301–0309 | `translation` | `translation`, `content` (EC status/text), `registry` | `translation` | `IMPLICIT_DEV_PUBLISH` (on approval), `NOTIFICATION_DISPATCH`, `COVERAGE_RECALC` | AI Translation Service (API-0301, 0302, 0307) |
| **Group 4: Publishing** | API-0401–0407 | `publishing` | `publishing`, `translation`, `content`, `registry`, `admin` (config for endpoints) | `publishing` | `COVERAGE_RECALC` (on publish success/rollback), `NOTIFICATION_DISPATCH` | Language Services (API-0405 execute, API-0407 rollback) |
| **Group 5: System-Triggered** | API-0501–0506 | `system` | All schemas (cross-cutting) | `translation` (stale flags, slots), `system_ops` (audit, notifications, coverage), `publishing` (implicit releases) | (These ARE the async jobs) | Language Services (implicit DEV publish) |
| **Group 6: Reporting** | API-0601–0607 | `reporting` | `reporting` (coverage_metrics), `translation`, `publishing`, `registry`, `system_ops` (audit for timeline) | None (read-only) | None | None |
| **Group 7: Search** | API-0701–0705 | `search` | `registry`, `content`, `search` (bookmarks, recently_edited) | `search` (bookmarks, recently_edited_events) | None | None |
| **Group 8: Administration** | API-0801–0807 | `admin` | `admin` | `admin` | `NOTIFICATION_DISPATCH` (role changes), slot creation dispatch (API-0506) | None |
| **Group 9: Comments, Audit, Export** | API-0901–0907 | `collaboration` | `collaboration`, `system_ops` (audit reads), `registry` | `collaboration` (comments, export_jobs), `system_ops` (notifications read/update) | `EXPORT_GENERATION` | None |
| **Group 10: Migration** | API-1001–1003 | `migration` | All schemas (validation) | All schemas (bootstrap creation) | `MIGRATION_EXECUTION`, `COVERAGE_RECALC` | Object Storage (file upload/read) |

### 15.2 Shared Cross-Cutting Concerns

| Concern | Module | Applied To |
|---|---|---|
| **Audit record creation** | `shared/audit` | Every write endpoint across all groups |
| **ETag validation** | `shared/concurrency` | Every mutation endpoint on mutable entities |
| **Authentication** | `shared/auth` | Every endpoint |
| **Authorization** | `shared/auth` | Every endpoint |
| **Request correlation** | `shared/correlation` | Every request |
| **Error formatting** | `shared/error` | Every error response |
| **Pagination** | `shared/pagination` | All list endpoints |

---

## 16. Concurrency Architecture

### 16.1 Concurrency Control Strategy

MioTranslate uses **optimistic concurrency control** (OCC) as the primary concurrency mechanism, supplemented by **pessimistic locking** (`SELECT FOR UPDATE`) for critical decision points.

| Scenario | Mechanism | Resolution |
|---|---|---|
| Two users editing same English Copy simultaneously | ETag (`etag_version`) on `english_copies` | Second save returns 409; user refreshes and re-applies |
| Two reviewers approving same Translation | ETag on `translations` | Second approval returns 409 |
| Stale cascade colliding with manual Translation edit | ETag conflict in Worker → automated retry (3x, exponential backoff) | Worker re-reads, re-modifies, re-writes |
| Two users creating PAR for same (page, lang, env) | Partial unique index `par_pending_unique` | Second INSERT fails → 409 |
| Concurrent implicit DEV publishes for same scope | Partial unique index on in-flight releases | Second attempt blocked → no-op |
| Concurrent deployment version assignment | Unique constraint on `(page_id, language_code, environment, deployment_version)` | Automated retry computes `MAX + 1` again |
| Two concurrent migration executions | Partial unique index on `PROCESSING` import events | Second attempt blocked → error |

### 16.2 Lock Ordering

To prevent deadlocks in multi-entity transactions:

| Transaction Type | Lock Acquisition Order |
|---|---|
| English Copy Approval + Stale Cascade | 1. `english_copies` (by tag_id) → 2. `english_copy_versions` → 3. `translations` (by tag_id, sorted by language_code ASC) |
| Tag Deprecation + Page Cascade | 1. `tags` (by tag_id) → 2. `pages` (by page_id) |
| PAR Approval + Release Creation | 1. `publishing_approval_requests` (by approval_request_id) → 2. `releases` (INSERT) |
| Role Assignment | 1. `user_role_assignments` (by user_id, role — sorted) |

---

## 17. Security Architecture

### 17.1 Security Layers

| Layer | Mechanism | Purpose |
|---|---|---|
| **Network** | HTTPS (TLS 1.2+) for all communication. Internal services communicate within VPC/private network. | Encryption in transit |
| **Authentication** | Token-based (JWT or opaque). Token validated on every request. | Identity verification |
| **Authorization** | RBAC (7 roles, permission matrix per FRD §8). Checked at middleware + service layer. | Access control |
| **Data at rest** | Disk-level encryption (EBS/volume encryption). Standard for managed database services. | Encryption at rest |
| **Immutability enforcement** | DB triggers (`raise_on_update`, `raise_on_delete`) on all permanent tables. | Tamper prevention |
| **Audit** | Every write operation produces an immutable, permanent audit record. | Accountability |
| **Input validation** | All request inputs validated before reaching business logic. Parameterized SQL (no string concatenation). | Injection prevention |
| **CORS** | API server returns `Access-Control-Allow-Origin` for the SPA domain only. | Cross-origin protection |

### 17.2 Sensitive Data

Per DB-01 §20.6, MioTranslate does not store sensitive PII in the current scope. User records contain `user_id`, `display_name`, and `email` for internal team members. No encryption beyond disk-level is required.

---

## 18. Capacity & Scale Envelope

### 18.1 Current Scale Profile

| Dimension | Value | Source |
|---|---|---|
| **Concurrent users** | ~15 | BRD |
| **Pages** | ~89 | System Design v3, current Language Services data |
| **Tags per page** | 10–100+ (avg ~50) | System Design v3 |
| **Total tags** | ~4,500 | DB-01 §1.1 |
| **Languages** | 8 active | BRD §1 |
| **Translation entities** | ~36,000 (4,500 tags × 8 languages) | DB-01 §1.1 |
| **API requests/minute (peak)** | ~50–100 | Estimated from 15 users |
| **Background jobs/hour** | ~200 (stale cascades, coverage, notifications) | Estimated |

### 18.2 Scale Headroom

The chosen architecture comfortably handles:

| Dimension | Current | Supported Without Architectural Change |
|---|---|---|
| Concurrent users | 15 | 100+ |
| Pages | 89 | 1,000+ |
| Tags | 4,500 | 50,000+ |
| Languages | 8 | 30+ |
| API requests/minute | 100 | 5,000+ |
| Audit records (Year 1) | ~220,000 | 10,000,000+ (with partition by `performed_at`) |

### 18.3 Scaling Triggers

| Trigger | Action |
|---|---|
| **Users > 50** | Enable read-replica routing for reporting queries (DB-01 §21.5, DB-AUDIT P3-04) |
| **Audit records > 5GB** | Partition `audit_records` by `performed_at` (DB-AUDIT P3-02) |
| **Background job backlog consistently > 100** | Add second Worker instance |
| **API p99 > 2 seconds** | Add third API Server instance behind load balancer |
| **Tags > 50,000** | Consider separate full-text search service (Elasticsearch) |

---

## 19. Consistency Audit — Baseline Documents

This audit verifies that SYS-01 is consistent with all locked baseline documents and does not contradict, redesign, or omit any approved requirement.

### 19.1 BRD Alignment

| BRD Requirement | SYS-01 Coverage | Status |
|---|---|---|
| Internal platform for ~15 users | Single-tenant modular monolith, 2 API instances | ✅ |
| Remove engineering dependency | SPA + REST API — Product/QA directly interact with MioTranslate | ✅ |
| Governance before production | Publishing workflow (§9.5), approval cascade, role-based authorization (§11) | ✅ |
| Complete audit trail | Synchronous audit within every write transaction (GP-05, §7.3, §8.3) | ✅ |
| Translation visibility | Derived read models served by reporting module, coverage metrics (§15.1 Group 6) | ✅ |

### 19.2 FRD Alignment

| FRD Requirement | SYS-01 Coverage | Status |
|---|---|---|
| 21 features (F-01–F-21) | All features served by the 10 backend modules | ✅ |
| 7 roles, permission matrix (§8) | RBAC architecture (§11.2, §11.3) | ✅ |
| Stale flagging is automatic (F-10, Rule 5) | Async STALE_CASCADE job (§9.2, §9.4) | ✅ |
| Bulk operations (F-07, F-09) | Same API server, batch DB operations | ✅ |
| Publishing pipeline (Dev → QA → Prod) (F-11) | 3-Phase Commit for external push (§8.3 Pattern 4, §9.5) | ✅ |
| Rollback (F-12) | Same 3-Phase Commit pattern, contentSnapshot as source | ✅ |
| Comments permanent, resolvable (F-18) | DB immutability triggers (inherited from DB-01 §13.3) | ✅ |
| Export read-only snapshot (F-19) | Background EXPORT_GENERATION job (§9.2) | ✅ |
| Migration one-time (F-21) | MIGRATION_EXECUTION job with transactional rollback (§9.2) | ✅ |

### 19.3 Entity Model (ED-01/02/03) Alignment

| Entity Model Requirement | SYS-01 Coverage | Status |
|---|---|---|
| 20 canonical entities mapped to physical tables | All entities served by the 10 backend modules via their repository layers (§6.1) | ✅ |
| Language isolation invariant (ED-01 §7.4) | GP-08, enforced by per-language operations throughout all modules | ✅ |
| Publishing scope invariant: 1 Page + 1 Language + 1 Environment (ED-01 §7.6) | Language Services call scoped per this invariant (§10.2) | ✅ |
| Derived models are non-authoritative (ED-01 §4) | Read models never used for business validation (GP-07, §8.4) | ✅ |

### 19.4 Database Architecture (DB-01–06) Alignment

| DB Architecture Requirement | SYS-01 Coverage | Status |
|---|---|---|
| Single PostgreSQL database (DB-01 §1.1) | Single DB accessed by both API Server and Worker (§4.1, §8.1) | ✅ |
| PgBouncer transaction pooling (DB-01 §2.4) | PgBouncer between all processes and PostgreSQL (§8.1) | ✅ |
| External calls outside DB transactions (DB-01 §12.3) | 3-Phase Commit pattern (§8.3 Pattern 4), GP-02 | ✅ |
| SERIALIZABLE isolation for multi-entity cascades (DB-01 §12.2) | Pattern 3 (§8.3) used for approval cascades | ✅ |
| Audit within same transaction (DB-01 §12.3) | GP-05, §7.3 step 6, §8.3 Pattern 2 | ✅ |
| Notifications outside transaction (DB-01 §12.3) | GP-06, async job dispatch post-commit (§9.1) | ✅ |
| Optimistic locking via etag_version (DB-01 §11) | ETag middleware, §16.1 | ✅ |
| Read replica for reporting (DB-01 §2.4) | Replica in deployment topology (§4.1, §8.1) | ✅ |
| Object storage for files (DB-01 §16) | Object Storage in topology (§4.1) | ✅ |

### 19.5 DB Audit Findings (DB-AUDIT-FINAL) Alignment

| Audit Finding | SYS-01 Coverage | Status |
|---|---|---|
| P0-01: Stale cascade ETag retry | Worker retry policy (§13.2), §9.4 | ✅ |
| P0-02: 409 Conflict contract for Group 3 | Concurrency handling (§16.1), error classification (§13.1) | ✅ |
| P0-03: External boundary enforcement | 3-Phase Commit (§8.3 Pattern 4), GP-02 | ✅ |
| P1-02: Deployment version race | Automated retry (§13.2, §16.1) | ✅ |
| P2-05: N+1 query prevention | Batch JOIN queries mandated in repository layer (§6.2 dependency rules) | ✅ |
| P3-04: Read-replica deferred to user count > 50 | §18.3 scaling triggers | ✅ |

### 19.6 API Architecture Alignment

| API Requirement | SYS-01 Coverage | Status |
|---|---|---|
| 63 MioTranslate-owned APIs across 10 domains | All served by single API Server (§7.2) | ✅ |
| 6 system-triggered behaviours (Group 5) | Background Worker (§9.2) | ✅ |
| 2 external API dependencies | Integration architecture (§10.2, §10.3) | ✅ |
| Group 5 APIs are internal (no HTTP endpoint) | System module has no `api/` layer; invoked via in-process calls and async jobs (§6.1) | ✅ |

---

*End of MioTranslate — SYS-01: Technical / System Architecture — v1.0*

*This document is the production technical architecture for MioTranslate. It governs the application structure, service topology, integration patterns, and operational architecture. All implementation, deployment, and operational decisions must be validated against this document.*

*No code, migration scripts, or deployment manifests are produced by this document. Those are downstream deliverables that consume this architecture as their governing input.*
