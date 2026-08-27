# MioTranslate API Design — Group 6: Visibility & Reporting

**Product:** MioTranslate  
**Document Type:** API Design Specification  
**Scope:** Group 6 — Visibility & Reporting (API-0601 through API-0607)  
**Source Documents:** Approved API List (Domain 6), FRD §5.6/§9.6/§13, Features F-16/F-17/F-20, User Flows UF-14/UF-15, IA §4.4/§6.2/§6.3/§6.4, Group 1–5 API Designs (locked/working)  
**Audience:** Backend Engineering, Frontend Engineering, QA  
**Prerequisites:** Group 1 (locked baseline conventions), Group 3 (staleInfo canonical model, Translation state), Group 4 (Release record, environment model), Group 5 (Coverage metrics, Audit record, Notification event catalogue)

---

## Document Status & Revision History

| Version | Date | Author | Status | Summary of Changes |
|---|---|---|---|---|
| **v1.0** | Aug 2026 | API Design | Draft | Initial specification — all 7 APIs authored. |
| **v1.1** | Aug 2026 | API Design | Final — Locked | Targeted correction pass: (1) Removed `BEHIND` status from API-0607 — environments are independent per FRD §17 Resolved; (2) `status` filter vocabulary made consistent with response model (added `FAILED`, `ROLLED_BACK`); (3) Removed `pageOverallCoveragePercentage` — no cross-language average defined in approved documents; (4) Removed `coverageThreshold` filter — ambiguous matrix semantics, not in approved UX; (5) Corrected zero-active-tag page handling — distinguished from deprecated pages. JSON example updated: Production cell in API-0607 corrected from `BEHIND` to `PUBLISHABLE`. Cross-group audit updated. |

> **Lock Status:** Group 6 is **locked**. No further changes may be made without a documented revision entry above and traceability to an approved source document.

---

## 1. Group 6 Context

### 1.1 What Group 6 Covers

Group 6 defines all **read-only reporting and visibility APIs** that give stakeholders (PM, FN, LR, SR) a clear, always-available view of translation status, coverage, and operational health across the entire MioTranslate system.

| API ID | Name | Primary Users | IA Destination |
|---|---|---|---|
| **API-0601** | Get Coverage Dashboard | PM, FN, LR | Coverage Area → V1 Coverage Dashboard |
| **API-0602** | Get Language Readiness | PM, FN, LR | Coverage Area → V2 Language Readiness |
| **API-0603** | Get Stale Translations Report | LR, PM | Coverage Area → V3 Stale Overview |
| **API-0604** | Get Pending Work Summary | PM, FN | Coverage Dashboard header metrics |
| **API-0605** | Get Activity Timeline | All roles | Global / My Work cross-cutting feed |
| **API-0606** | Get Review Queue | LR, SR, FN, PM | My Work Area → W1 |
| **API-0607** | Get Environment Status Matrix | SR, FN, PM, LR | Deployments Area → D1 Deployment Overview |

**Critical design properties for all Group 6 APIs:**
- **All are read-only.** No write operations, no state mutations.
- **All are live snapshots.** Each response reflects the state of the system at the moment of the request (or as of `computedAt` for precomputed values).
- **All are non-destructive.** No caching instruction overrides may cause stale data to be presented as current without a freshness disclosure.
- **None block other work.** Reporting APIs must not lock records, block write operations, or hold transactions.

---

### 1.2 Source-of-Truth Boundaries

Group 6 APIs are **read facades** over data owned by other domains. Understanding source-of-truth boundaries prevents double-counting and ensures consistent values:

| Data | Owned By | Group 6 Reads From |
|---|---|---|
| Page list, Tag list, tag counts, active/deprecated status | Group 1 / Page & Tag Registry | Direct read |
| English copy status, version, approval | Group 2 / English Copy | Direct read |
| Translation state, staleInfo, version, sourceEnglishVersion | Group 3 / Translation | Direct read |
| Release records, deployment events, environment status | Group 4 / Publishing | Direct read |
| Coverage metrics (precomputed per pageId × language) | Group 5 / API-0503 Recalculate Coverage | Read precomputed coverage table |
| Audit records (source for activity timeline) | Group 5 / API-0505 Create Audit Record | Read audit log |

> **Coverage metric freshness:** Coverage values in API-0601 and API-0602 read from the precomputed coverage table maintained by API-0503 (Group 5). Each response includes a `computedAt` timestamp per cell so clients and users understand when coverage was last recomputed. If coverage data is stale (precomputed value older than a system-configurable threshold), the API returns a `coverageFreshness: STALE` indicator alongside the value — it does not return an error and it does not block the response.

---

### 1.3 Baseline Conventions Inheritance

Group 6 inherits all conventions from Group 1 §1 without modification:
- URL base and versioning: `https://{host}/api/v1/...`
- JSON casing: `camelCase` for fields, `SCREAMING_SNAKE_CASE` for enums and error codes
- Response envelope: `{ "data": ... }` for single resources, `{ "data": [...], "pagination": {...} }` for collections, `{ "data": { "summary": ..., "items": [...] }, ... }` for report responses
- HTTP status codes per Group 1 §1.6
- Cursor-based pagination (Group 1 §1.7): `pageSize` default 50, max 200
- Error model: RFC 9457-inspired `{ "error": { "code", "status", "message", "target", "details" } }`
- Authorization: RBAC per FRD §8

All Group 6 APIs use `GET`. No `If-Match` or `Idempotency-Key` headers are needed — these are read-only.

---

### 1.4 RBAC Summary for Group 6

| API | Authorized Roles | Source |
|---|---|---|
| API-0601 | All roles | FRD §8: "View pages, tags, statuses" |
| API-0602 | All roles | FRD §8 |
| API-0603 | All roles | FRD §8 |
| API-0604 | All roles | FRD §8 |
| API-0605 | All roles | FRD §8: "View audit trail" |
| API-0606 | Role-scoped (items shown based on caller's role) | FRD §8, §13.5 |
| API-0607 | All roles | FRD §8 |

---

## 2. Shared Response Models

### 2.1 Coverage Cell

Used in API-0601 and API-0602.

```json
{
  "pageId": "QUICK",
  "pageName": "Quick Sale",
  "module": "POS",
  "language": "ar",
  "totalActiveTags": 38,
  "approvedAndDeployedToProduction": 35,
  "coveragePercentage": 92.1,
  "approvedNotYetDeployedToProduction": 1,
  "staleCount": 1,
  "pendingReviewCount": 0,
  "draftCount": 0,
  "noTranslationCount": 1,
  "computedAt": "2026-08-24T09:00:00Z",
  "coverageFreshness": "CURRENT"
}
```

| Field | Type | Description |
|---|---|---|
| `pageId` | string | Page identifier. |
| `pageName` | string | Human-readable page name. |
| `module` | string \| null | Module this page belongs to. |
| `language` | string | Language code (`ar`, `hi`, `ta`, etc.). |
| `totalActiveTags` | integer | Tags where `status != DEPRECATED`. Denominator for coverage %. |
| `approvedAndDeployedToProduction` | integer | Tags approved and deployed to Production (including STALE-but-deployed, per FRD F-16). Numerator for coverage %. |
| `coveragePercentage` | float \| null | `(approvedAndDeployedToProduction / totalActiveTags) × 100`. Rounded to 1 decimal. **Null when `totalActiveTags == 0`** (FRD §5.6). |
| `approvedNotYetDeployedToProduction` | integer | Tags APPROVED in MioTranslate but not in the most recent Production release. |
| `staleCount` | integer | Tags in STALE state for this language. |
| `pendingReviewCount` | integer | Tags in PENDING_REVIEW state. |
| `draftCount` | integer | Tags in DRAFT state. |
| `noTranslationCount` | integer | Tags in NO_TRANSLATION state. |
| `computedAt` | string (ISO 8601) | When coverage was last recomputed for this cell by API-0503. |
| `coverageFreshness` | enum | `CURRENT` (within acceptable threshold) or `STALE` (coverage values may be behind). Never an error — always returns a value. |

---

### 2.2 Language Summary

Used in API-0601 (per-language column totals) and other APIs.

```json
{
  "language": "ar",
  "languageName": "Arabic",
  "direction": "RTL",
  "status": "ACTIVE",
  "overallCoveragePercentage": 87.3,
  "totalActiveTags": 420,
  "approvedAndDeployedToProduction": 366,
  "staleCount": 8,
  "noTranslationCount": 46
}
```

---

### 2.3 Stale Item

Used in API-0603.

```json
{
  "tagId": "QUICK_1",
  "tagPageId": "QUICK",
  "tagPageName": "Quick Sale",
  "tagModule": "POS",
  "language": "ar",
  "languageName": "Arabic",
  "translationText": "بيع سريع",
  "previousStatus": "APPROVED",
  "staleSince": "2026-08-10T09:00:00Z",
  "staleDurationDays": 14,
  "previousEnglishVersion": 2,
  "previousEnglishText": "Quick Sale",
  "currentEnglishVersion": 3,
  "currentEnglishText": "Quick Checkout",
  "actionUrl": "/pages/QUICK/tags/QUICK_1?language=ar&mode=stale-resolution"
}
```

| Field | Type | Description |
|---|---|---|
| `tagId` | string | Tag identifier. |
| `tagPageId` | string | Parent page ID. |
| `tagPageName` | string | Parent page name. |
| `tagModule` | string \| null | Module (for grouping and filtering). |
| `language` | string | Language code. |
| `languageName` | string | Human-readable language name. |
| `translationText` | string | Current translation text (the stale version, still live in Production). |
| `previousStatus` | enum | State before becoming stale: `APPROVED`, `PENDING_REVIEW`, or `DRAFT`. (From `staleInfo.previousStatus` per Group 3 §2.2.) |
| `staleSince` | string (ISO 8601) | When the translation was flagged stale. (From `staleInfo.staleSince`.) |
| `staleDurationDays` | integer | Days since stale was flagged. Used for age-based sorting. |
| `previousEnglishVersion` | integer | English version the translation was based on. |
| `previousEnglishText` | string | English copy at `previousEnglishVersion`. |
| `currentEnglishVersion` | integer | Current approved English version that triggered staleness. |
| `currentEnglishText` | string | Current approved English copy text. |
| `actionUrl` | string | Deep link to the tag in stale resolution context. |

---

### 2.4 Review Queue Item

Used in API-0606.

```json
{
  "itemType": "TRANSLATION",
  "tagId": "QUICK_1",
  "pageId": "QUICK",
  "pageName": "Quick Sale",
  "language": "ar",
  "languageName": "Arabic",
  "submittedBy": "user:pm-sravan",
  "submittedAt": "2026-08-24T08:00:00Z",
  "queueAge": 4,
  "status": "PENDING_REVIEW",
  "confidenceScore": 0.97,
  "variableIntegrityStatus": "PASS",
  "isEscalated": false,
  "escalationReason": null,
  "priority": "NORMAL",
  "actionUrl": "/pages/QUICK/tags/QUICK_1?language=ar&mode=review"
}
```

| Field | Type | Description |
|---|---|---|
| `itemType` | enum | `ENGLISH_COPY`, `TRANSLATION`, `PUBLISHING_APPROVAL`, `ESCALATION`. |
| `tagId` | string | Tag identifier. |
| `pageId` | string | Parent page ID. |
| `pageName` | string | Parent page name. |
| `language` | string \| null | Language code. Null for `ENGLISH_COPY` items. |
| `languageName` | string \| null | Human-readable language name. Null for `ENGLISH_COPY` items. |
| `submittedBy` | string | User ID of who submitted this for review. |
| `submittedAt` | string (ISO 8601) | When the item entered PENDING_REVIEW state. |
| `queueAge` | integer | Days in queue. Used for sorting and prioritization. |
| `status` | enum | Always `PENDING_REVIEW` for ENGLISH_COPY and TRANSLATION. For PUBLISHING_APPROVAL: `PENDING_APPROVAL`. For ESCALATION: `ESCALATED`. |
| `confidenceScore` | float \| null | AI confidence score. Null for manually authored items and ENGLISH_COPY. |
| `variableIntegrityStatus` | enum \| null | `PASS`, `FAIL`, or null. |
| `isEscalated` | boolean | Whether this item was escalated (for Founder queue items). |
| `escalationReason` | string \| null | The reason provided at escalation. |
| `priority` | enum | `NORMAL`, `HIGH` (failing variable integrity), `URGENT` (publication-blocking). |
| `actionUrl` | string | Deep link to the item in review context. |

---

### 2.5 Activity Timeline Entry

Used in API-0605.

```json
{
  "auditRecordId": "aud_20260821_143500_abc123",
  "action": "TRANSLATION_APPROVED",
  "actionLabel": "Translation approved",
  "subject": {
    "type": "TRANSLATION",
    "tagId": "QUICK_1",
    "tagPageId": "QUICK",
    "tagPageName": "Quick Sale",
    "language": "ar",
    "languageName": "Arabic"
  },
  "performedBy": "user:lr-ahmed",
  "performedByDisplayName": "Ahmed (Localization Reviewer)",
  "performedAt": "2026-08-21T14:35:00Z",
  "details": "Translation approved after manual edit. Confidence: 97%.",
  "actionUrl": "/pages/QUICK/tags/QUICK_1?language=ar"
}
```

| Field | Type | Description |
|---|---|---|
| `auditRecordId` | string | Reference to the underlying audit record (API-0505). |
| `action` | enum | Raw action value from the audit record (Group 5 §2.1.1). |
| `actionLabel` | string | Human-readable label derived from `action`. Server-rendered for consistent display. |
| `subject` | object | What was acted upon. Includes `type`, relevant IDs, and human-readable names. |
| `performedBy` | string | User ID. |
| `performedByDisplayName` | string | Name + role label for display. System actions shown as e.g. "System (Auto-publish)". |
| `performedAt` | string (ISO 8601) | When the action occurred. |
| `details` | string | Human-readable detail from the audit record. |
| `actionUrl` | string \| null | Deep link to the affected content. Null for system-wide actions. |

---

## 3. API Specifications

### API-0601: Get Coverage Dashboard

> **Source:** FRD §5.6, F-16, §13.1, UF-14 Main Flow, IA §4.4/§6.3 Coverage Area V1, API List API-0601.

**Endpoint:**
```
GET /v1/coverage
```

**Purpose:** Return the full coverage matrix (pages × languages) with per-cell coverage percentages, per-language column totals, and top-level system metrics. This is the strategic view of translation readiness across all pages and all languages.

**Authorization:** All roles (FRD §8: "View pages, tags, statuses").

---

#### 3.1.1 Query Parameters

| Parameter | Type | Default | Description |
|---|---|---|---|
| `module` | string | (all) | Filter pages by module. Must be a value from the configured module vocabulary. |
| `includeDeprecated` | boolean | `false` | When false, deprecated pages are excluded from the matrix. Active pages with zero active tags are always included (see §3.1.3). |
| `pageSize` | integer | 50 | Number of pages (rows) per page of results. Max 200. |
| `pageToken` | string | (none) | Cursor for paginating through pages. |

---

#### 3.1.2 Response — 200 OK

```json
{
  "data": {
    "summary": {
      "totalActivePages": 42,
      "totalActiveTags": 1840,
      "languages": [
        {
          "language": "ar",
          "languageName": "Arabic",
          "direction": "RTL",
          "status": "ACTIVE",
          "overallCoveragePercentage": 87.3,
          "totalApprovedAndDeployedToProduction": 1606,
          "totalActiveTags": 1840,
          "totalStaleCount": 8,
          "totalNoTranslationCount": 226
        }
      ],
      "totalSystemStaleCount": 47,
      "totalPendingReviewCount": 12,
      "requestedAt": "2026-08-24T10:00:00Z"
    },
    "rows": [
      {
        "pageId": "QUICK",
        "pageName": "Quick Sale",
        "module": "POS",
        "pageStatus": "ACTIVE",
        "totalActiveTags": 38,
        "cells": [
          {
            "language": "ar",
            "totalActiveTags": 38,
            "approvedAndDeployedToProduction": 35,
            "coveragePercentage": 92.1,
            "approvedNotYetDeployedToProduction": 1,
            "staleCount": 1,
            "pendingReviewCount": 0,
            "draftCount": 0,
            "noTranslationCount": 1,
            "computedAt": "2026-08-24T09:00:00Z",
            "coverageFreshness": "CURRENT"
          }
        ]
      }
    ]
  },
  "pagination": {
    "nextPageToken": "eyJpZCI6IklOVk9JQ0UifQ==",
    "pageSize": 50
  }
}
```

**Response fields:**

| Field | Description |
|---|---|
| `summary.totalActivePages` | Count of non-deprecated pages. |
| `summary.totalActiveTags` | Sum of active tags across all non-deprecated pages. |
| `summary.languages` | Array of per-language summary objects (§2.2). Column headers and totals for the matrix. Ordered by language name alphabetically. |
| `summary.totalSystemStaleCount` | Total STALE translations across all pages and all languages. |
| `summary.totalPendingReviewCount` | Total items in PENDING_REVIEW state across English copy and translations. |
| `summary.requestedAt` | Server timestamp when this response was computed. |
| `rows` | Paginated array of page rows. Each row contains `cells` — one per active language. |
| `rows[].cells` | Array of coverage cell objects (§2.1). One per active language. Cells are in the same language order as `summary.languages`. |

---

#### 3.1.3 Business Rules

| Rule | Source | Enforcement |
|---|---|---|
| Coverage formula: `(approvedAndDeployedToProduction / totalActiveTags) × 100` | FRD §5.6, F-16 | Read from precomputed coverage table (API-0503). |
| STALE-but-deployed counts in numerator | FRD F-16 | Included in `approvedAndDeployedToProduction`. |
| Active pages with 0 active tags: included in `rows`, `coveragePercentage: null` | FRD §5.6 | An active page with zero active tags (e.g., all tags deprecated) is distinct from a deprecated page. It is always included in the matrix as an active page row with `coveragePercentage: null`. It is not hidden by `includeDeprecated`. |
| Deprecated pages excluded by default | IA V1 | `includeDeprecated: false` by default. Deprecated pages are excluded regardless of their tag counts. |
| No cross-language page average | FRD §5.6, IA V1 | Coverage is always defined at the `(pageId, language)` cell level. The approved documents do not define an average of coverage percentages across languages for a single page. No `pageOverallCoveragePercentage` field is exposed. |
| Inactive languages excluded | Group 5 §3.3 | Only languages with `status: ACTIVE` appear as columns. |
| Coverage values read from precomputed table | Group 5 ED-G5-01 | `computedAt` per cell discloses freshness. `coverageFreshness` enum indicates currency. |
| Summary column totals | FRD §5.6, IA V1 | `summary.languages` = per-language totals across all pages (column summaries). Row-level summaries per page are at the individual cell level, not aggregated across languages. |

---

#### 3.1.4 Error Catalogue

| HTTP | Code | Condition |
|---|---|---|
| 422 | `INVALID_VALUE` on `module` | Module not in configured vocabulary. |
| 403 | `FORBIDDEN` | User lacks view access. |

---

#### 3.1.5 Edge Cases

| Scenario | Behaviour |
|---|---|
| Zero pages exist | Returns `summary` with counts of 0 and empty `rows: []`. Not a 404. |
| Active page with 0 active tags (all tags deprecated) | Row included with `totalActiveTags: 0` and `coveragePercentage: null` per cell (per FRD §5.6). Not hidden by `includeDeprecated`. |
| No active languages | Returns `summary.languages: []` and cells are empty arrays per row. |
| `coverageFreshness: STALE` on a cell | Response succeeds with current (stale) value and the stale indicator. Not an error. |
| Coverage computation in progress | Returns last successful value with `coverageFreshness: STALE`. |
| Single page | Returns 1 row, pagination complete. |

---

### API-0602: Get Language Readiness

> **Source:** FRD §5.6, §13.2 (Translation Readiness Report), UF-14 Step 4/ALT-D, IA V2 Language Readiness, API List API-0602.

**Endpoint:**
```
GET /v1/coverage/languages/{language}
```

**Purpose:** For a selected language, return all pages ranked by coverage (lowest first by default). Answers: "How ready is Arabic across all our pages?" Used for prioritizing translation work, evaluating new market expansion effort, and planning translation sprints.

**Authorization:** All roles.

---

#### 3.2.1 Path Parameters

| Parameter | Type | Description |
|---|---|---|
| `language` | string | Language code. Must be an active or inactive language in MioTranslate. |

---

#### 3.2.2 Query Parameters

| Parameter | Type | Default | Description |
|---|---|---|---|
| `module` | string | (all) | Filter pages by module. |
| `sortBy` | enum | `coverageAsc` | `coverageAsc` (lowest first, default for prioritization), `coverageDesc` (highest first), `pageNameAsc`, `staleCountDesc`, `pendingCountDesc`. |
| `includeDeprecated` | boolean | `false` | When false, deprecated pages excluded. |
| `pageSize` | integer | 50 | Max 200. |
| `pageToken` | string | (none) | Cursor. |

---

#### 3.2.3 Response — 200 OK

```json
{
  "data": {
    "language": "ar",
    "languageName": "Arabic",
    "direction": "RTL",
    "languageStatus": "ACTIVE",
    "summary": {
      "overallCoveragePercentage": 87.3,
      "totalActiveTags": 1840,
      "approvedAndDeployedToProduction": 1606,
      "approvedNotYetDeployedToProduction": 48,
      "staleCount": 8,
      "pendingReviewCount": 14,
      "draftCount": 22,
      "noTranslationCount": 142,
      "pageCount": 42,
      "pagesWithZeroTranslation": 3,
      "pagesFullyCovered": 18,
      "computedAt": "2026-08-24T09:00:00Z"
    },
    "pages": [
      {
        "pageId": "QUICK",
        "pageName": "Quick Sale",
        "module": "POS",
        "pageStatus": "ACTIVE",
        "totalActiveTags": 38,
        "approvedAndDeployedToProduction": 35,
        "coveragePercentage": 92.1,
        "approvedNotYetDeployedToProduction": 1,
        "staleCount": 1,
        "pendingReviewCount": 0,
        "draftCount": 0,
        "noTranslationCount": 1,
        "computedAt": "2026-08-24T09:00:00Z",
        "coverageFreshness": "CURRENT",
        "drillDownUrl": "/pages/QUICK?language=ar"
      }
    ]
  },
  "pagination": {
    "nextPageToken": "eyJpZCI6IklOVk9JQ0UifQ==",
    "pageSize": 50
  }
}
```

**Key response fields:**

| Field | Description |
|---|---|
| `summary.pagesWithZeroTranslation` | Pages where `noTranslationCount == totalActiveTags` — completely untranslated for this language. |
| `summary.pagesFullyCovered` | Pages where `coveragePercentage == 100`. |
| `pages[].drillDownUrl` | Deep link to Page Detail filtered by this language. |

---

#### 3.2.4 Business Rules

| Rule | Source | Enforcement |
|---|---|---|
| Inactive language supported for read | FRD §7 Rule 24 | Inactive languages retain history. Response includes `languageStatus: INACTIVE` advisory. |
| Coverage formula consistent with API-0601 | Group 5 §3.3.1 | Same formula, same precomputed table. |
| Default sort is lowest coverage first | IA V2 | Prioritization use case: surface the most incomplete pages. |
| New language expansion use case | UF-14 ALT-D | `summary.pagesWithZeroTranslation` and `summary.noTranslationCount` serve the "how much effort?" query. |

---

#### 3.2.5 Error Catalogue

| HTTP | Code | Condition |
|---|---|---|
| 404 | `LANGUAGE_NOT_FOUND` | Language code not configured in MioTranslate. |
| 422 | `INVALID_VALUE` on `sortBy` | Not a valid sort option. |

---

### API-0603: Get Stale Translations Report

> **Source:** FRD §13.4 (Stale Translations Report), F-10, §5.6, UF-14 ALT-B, UF-08 (entry point), IA V3 Stale Overview, API List API-0603.

**Endpoint:**
```
GET /v1/translations/stale
```

**Purpose:** Return all translations currently in STALE state across the entire product, with the English copy diff context needed to decide whether to confirm or retranslate. Sorted oldest-first by default (oldest staleness requires most urgent attention). Serves both the LR's stale resolution queue and the PM/FN's staleness health assessment.

**Authorization:** All roles.

---

#### 3.3.1 Query Parameters

| Parameter | Type | Default | Description |
|---|---|---|---|
| `language` | string | (all) | Filter by a specific language code. |
| `pageId` | string | (all) | Filter to stale translations for a specific page. |
| `module` | string | (all) | Filter pages by module. |
| `previousStatus` | enum | (all) | Filter by state before becoming stale: `APPROVED`, `PENDING_REVIEW`, `DRAFT`. |
| `sortBy` | enum | `staleAgeDesc` | `staleAgeDesc` (oldest first, default), `staleAgeAsc` (newest first), `languageAsc`, `pageNameAsc`. |
| `pageSize` | integer | 50 | Max 200. |
| `pageToken` | string | (none) | Cursor. |

---

#### 3.3.2 Response — 200 OK

```json
{
  "data": {
    "summary": {
      "totalStaleItems": 47,
      "byLanguage": [
        { "language": "ar", "languageName": "Arabic", "staleCount": 8 },
        { "language": "hi", "languageName": "Hindi", "staleCount": 14 }
      ],
      "oldestStaleSince": "2026-07-01T10:00:00Z",
      "mostRecentStaleSince": "2026-08-23T15:00:00Z"
    },
    "items": [
      {
        "tagId": "QUICK_1",
        "tagPageId": "QUICK",
        "tagPageName": "Quick Sale",
        "tagModule": "POS",
        "language": "ar",
        "languageName": "Arabic",
        "translationText": "بيع سريع",
        "previousStatus": "APPROVED",
        "staleSince": "2026-08-10T09:00:00Z",
        "staleDurationDays": 14,
        "previousEnglishVersion": 2,
        "previousEnglishText": "Quick Sale",
        "currentEnglishVersion": 3,
        "currentEnglishText": "Quick Checkout",
        "actionUrl": "/pages/QUICK/tags/QUICK_1?language=ar&mode=stale-resolution"
      }
    ]
  },
  "pagination": {
    "nextPageToken": "eyJpZCI6IlFVSUNLXzIifQ==",
    "pageSize": 50
  }
}
```

---

#### 3.3.3 Business Rules

| Rule | Source | Enforcement |
|---|---|---|
| Only STALE state translations returned | Group 3 §1.2 | Strict state filter: `translation.status == STALE`. |
| `staleInfo` fields map directly to response | Group 3 §2.2 (canonical staleInfo) | `previousStatus`, `staleSince`, `previousEnglishVersion/Text`, `currentEnglishVersion/Text` sourced from `staleInfo`. No derivation — direct read. |
| Sort by staleness age descending by default | FRD §13.4 | "sorted by age (oldest first)". `staleDurationDays = now - staleSince`. |
| `byLanguage` breakdown in summary | FRD §13.4, UF-14 | Stale count is tracked per language independently (FRD §5.6). |
| `previousStatus` filter supports resolution prioritization | Group 3 §2.2 | LR may prioritize stale APPROVED (deployed, needs attention) over stale DRAFT (not deployed). |
| Empty result when no stale translations | FRD API List | `totalStaleItems: 0`, `items: []`, `byLanguage: []`. Not an error. |

---

#### 3.3.4 Error Catalogue

| HTTP | Code | Condition |
|---|---|---|
| 404 | `LANGUAGE_NOT_FOUND` | Specified `language` not configured. |
| 404 | `PAGE_NOT_FOUND` | Specified `pageId` does not exist. |
| 422 | `INVALID_VALUE` on `previousStatus` | Not one of `APPROVED`, `PENDING_REVIEW`, `DRAFT`. |

---

### API-0604: Get Pending Work Summary

> **Source:** FRD §13.3 (Pending Work Report), §5.6, UF-14 ALT-C, IA V1 (header metrics), API List API-0604.

**Endpoint:**
```
GET /v1/work/summary
```

**Purpose:** Return a system-wide snapshot of outstanding work volumes across all categories. Answers: "How much work is sitting in the system right now?" Used for operational sprint planning, headcount assessment, and executive reporting. **Not a task queue** — that is API-0606. This is a pure aggregate count summary.

**Authorization:** All roles.

---

#### 3.4.1 Query Parameters

| Parameter | Type | Default | Description |
|---|---|---|---|
| `module` | string | (all) | Scope counts to pages in a specific module. |
| `language` | string | (all) | Scope translation counts to a specific language. |

---

#### 3.4.2 Response — 200 OK

```json
{
  "data": {
    "requestedAt": "2026-08-24T10:00:00Z",
    "englishCopy": {
      "tagsNeedingCopy": 23,
      "tagsInDraft": 7,
      "tagsInPendingReview": 4,
      "tagsWithApprovedCopy": 1806
    },
    "translations": {
      "byLanguage": [
        {
          "language": "ar",
          "languageName": "Arabic",
          "noTranslation": 142,
          "draft": 22,
          "pendingReview": 14,
          "approved": 1606,
          "stale": 8,
          "totalActiveTags": 1840
        }
      ],
      "systemWide": {
        "totalNoTranslation": 876,
        "totalDraft": 134,
        "totalPendingReview": 67,
        "totalApproved": 9870,
        "totalStale": 47
      }
    },
    "publishing": {
      "pendingPublishingApprovals": 3,
      "pagesPendingDevPublish": 8,
      "pagesPendingQaPublish": 4,
      "pagesPendingProductionPublish": 2
    },
    "filters": {
      "module": null,
      "language": null
    }
  }
}
```

**Response fields:**

| Section | Description |
|---|---|
| `englishCopy` | English copy state counts across all active tags. `tagsNeedingCopy` = tags with `englishCopyStatus == NO_COPY`. |
| `translations.byLanguage` | Per-language breakdown. Present for all active languages. Respects `language` filter if set. |
| `translations.systemWide` | Aggregate across all active languages. Present even when `language` filter is set (shows system-wide regardless). |
| `publishing` | Publishing work counts. `pendingPublishingApprovals` = publishing approval requests in `PENDING` state. `pagesPendingXxxPublish` = pages with approved content not yet published to that environment. |
| `filters` | Echo of applied filters for client verification. |

---

#### 3.4.3 Business Rules

| Rule | Source | Enforcement |
|---|---|---|
| `tagsNeedingCopy` = tags with NO_COPY English status | Group 1 §2.2 | Tag.`englishCopyStatus == NO_COPY`. |
| Translation counts are per-language, per-state | FRD §5.6, §13.3 | Each count corresponds to one state in Group 3 state model. |
| `translations.systemWide` counts each (tagId, language) pair independently | FRD §7 Rule 7 | Summed across all language-state combinations; one tag stale in 3 languages = 3 stale. |
| `publishing.pendingPublishingApprovals` | Group 4 / Release record | Publishing approval requests in PENDING state. |
| No user-scoped filtering | FRD §13.3 | This is a system-wide report, not a personal queue. API-0606 is the personal queue. |

---

#### 3.4.4 Edge Cases

| Scenario | Behaviour |
|---|---|
| No tags exist yet | All counts zero. Not an error. |
| No active languages | `translations.byLanguage: []`, `translations.systemWide` all zeros. |
| `module` filter with no pages | Returns all-zero counts for that module filter. |

---

### API-0605: Get Activity Timeline

> **Source:** FRD F-20, §9.6, §13.7 (Activity Report), UF-14/UF-15, IA §6.1 C3 Audit Trail, API List API-0605.

**Endpoint:**
```
GET /v1/activity
```

**Purpose:** Return a chronological feed of recent actions across MioTranslate — formatted for human display, filterable, and paged. Reads from the immutable audit log (API-0505 / Group 5). Serves two use cases: (1) coordination/awareness feed (who did what recently), and (2) investigation/accountability search (what did this user do between these dates?).

**Authorization:** All roles (FRD §8: "View audit trail").

---

#### 3.5.1 Query Parameters

| Parameter | Type | Default | Description |
|---|---|---|---|
| `userId` | string | (all) | Filter to actions performed by a specific user. |
| `pageId` | string | (all) | Filter to actions on a specific page. |
| `tagId` | string | (all) | Filter to actions on a specific tag. |
| `language` | string | (all) | Filter to actions scoped to a specific language. |
| `action` | string | (all) | Filter by action type. Must be a valid value from the audit action catalogue (Group 5 §2.1.1). Supports multiple values: `action=TRANSLATION_APPROVED&action=TRANSLATION_STALE_FLAGGED`. |
| `fromDate` | string (ISO 8601) | (none) | Include actions at or after this timestamp. |
| `toDate` | string (ISO 8601) | (none) | Include actions at or before this timestamp. |
| `pageSize` | integer | 50 | Max 200. FRD §9.6 specifies "50 most recent by default." |
| `pageToken` | string | (none) | Cursor for earlier pages. |

---

#### 3.5.2 Response — 200 OK

```json
{
  "data": {
    "items": [
      {
        "auditRecordId": "aud_20260821_143500_abc123",
        "action": "TRANSLATION_APPROVED",
        "actionLabel": "Translation approved",
        "subject": {
          "type": "TRANSLATION",
          "tagId": "QUICK_1",
          "tagPageId": "QUICK",
          "tagPageName": "Quick Sale",
          "language": "ar",
          "languageName": "Arabic"
        },
        "performedBy": "user:lr-ahmed",
        "performedByDisplayName": "Ahmed (Localization Reviewer)",
        "performedAt": "2026-08-21T14:35:00Z",
        "details": "Translation approved after manual edit. Confidence: 97%.",
        "actionUrl": "/pages/QUICK/tags/QUICK_1?language=ar"
      }
    ],
    "filters": {
      "userId": null,
      "pageId": null,
      "tagId": null,
      "language": null,
      "action": null,
      "fromDate": null,
      "toDate": null
    }
  },
  "pagination": {
    "nextPageToken": "eyJpZCI6ImF1ZF8yMDI2MDgyMV8xNDMwMDBfYWJjMTIyIn0=",
    "pageSize": 50
  }
}
```

---

#### 3.5.3 Action Label Mapping

The `actionLabel` field provides a human-readable label for each audit action. Server-rendered (not client-derived) to ensure consistency across all clients:

| Action | Action Label |
|---|---|
| `PAGE_CREATED` | "Page created" |
| `PAGE_METADATA_UPDATED` | "Page updated" |
| `PAGE_DEPRECATED` | "Page deprecated" |
| `TAG_CREATED` | "Tag created" |
| `TAG_METADATA_UPDATED` | "Tag updated" |
| `TAG_DEPRECATED` | "Tag deprecated" |
| `ENGLISH_COPY_CREATED` | "English copy authored" |
| `ENGLISH_COPY_EDITED` | "English copy edited" |
| `ENGLISH_COPY_SUBMITTED_FOR_REVIEW` | "English copy submitted for review" |
| `ENGLISH_COPY_APPROVED` | "English copy approved" |
| `ENGLISH_COPY_REJECTED` | "English copy rejected" |
| `ENGLISH_COPY_RETURNED_FOR_REVISION` | "English copy returned for revision" |
| `ENGLISH_COPY_ESCALATED` | "English copy escalated to Founder" |
| `TRANSLATION_CREATED` | "Translation generated" |
| `TRANSLATION_EDITED` | "Translation edited" |
| `TRANSLATION_SUBMITTED_FOR_REVIEW` | "Translation submitted for review" |
| `TRANSLATION_APPROVED` | "Translation approved" |
| `TRANSLATION_REJECTED` | "Translation rejected" |
| `TRANSLATION_RETURNED_FOR_REVISION` | "Translation returned for revision" |
| `TRANSLATION_STALE_FLAGGED` | "Translation flagged stale" |
| `TRANSLATION_STALE_CONFIRMED` | "Stale translation confirmed" |
| `TRANSLATION_STALE_RETRANSLATED` | "Stale translation retranslated" |
| `TRANSLATION_SLOT_CREATED` | "Translation slots created for new language" |
| `PAGE_BUNDLE_PUBLISHED` | "Page bundle published" |
| `PAGE_BUNDLE_PUBLISH_FAILED` | "Publishing failed" |
| `PAGE_BUNDLE_ROLLED_BACK` | "Rollback executed" |
| `PAGE_BUNDLE_AUTO_PUBLISHED` | "Page bundle auto-published to Dev" |
| `PUBLISHING_APPROVAL_REQUESTED` | "Publishing approval requested" |
| `PUBLISHING_APPROVAL_GRANTED` | "Publishing approved" |
| `PUBLISHING_APPROVAL_REJECTED` | "Publishing rejected" |
| `LANGUAGE_ADDED` | "Language added" |
| `LANGUAGE_DEACTIVATED` | "Language deactivated" |
| `USER_ROLE_ASSIGNED` | "User role assigned" |
| `USER_ROLE_MODIFIED` | "User role modified" |
| `SYSTEM_CONFIG_CHANGED` | "System configuration updated" |
| `MIGRATION_STARTED` | "Migration started" |
| `MIGRATION_COMPLETED` | "Migration completed" |
| `MIGRATION_FAILED` | "Migration failed" |

---

#### 3.5.4 Business Rules

| Rule | Source | Enforcement |
|---|---|---|
| Activity timeline reads from immutable audit log | Group 5 §3.5.3 | API-0605 has no write path. Audit records cannot be modified. |
| Default 50 most recent actions | FRD §9.6 | Default `pageSize: 50`, ordered by `performedAt` descending. |
| System-triggered actions visible | Group 5 §3.5.2 | `performedBy: "system:auto-publish"` etc. shown with `performedByDisplayName: "System (Auto-publish)"`. |
| `action` filter accepts multiple values | FRD §9.6 | Multiple `action` query params supported (OR semantics across action types). |
| Date range filtering | FRD §13.7 | `fromDate` and `toDate` supported. Both are optional and combinable. |
| No pagination limit for investigation | FRD §13.7 | Cursor pagination without a hard cap — investigators can page through as much history as needed. |
| `beforeValue`/`afterValue` not exposed in timeline | API Design Decision | Verbose field-level diffs belong in the version history APIs (Group 2 API-0204, Group 3 API-0308). The timeline shows what happened, not the full diff. |

---

#### 3.5.5 Error Catalogue

| HTTP | Code | Condition |
|---|---|---|
| 422 | `INVALID_VALUE` on `action` | Not a valid action code from the catalogue. |
| 422 | `INVALID_DATE_RANGE` | `fromDate` > `toDate`. |
| 404 | `PAGE_NOT_FOUND` | Specified `pageId` does not exist. |
| 404 | `TAG_NOT_FOUND` | Specified `tagId` does not exist. |

---

#### 3.5.6 Edge Cases

| Scenario | Behaviour |
|---|---|
| No activity yet (new system) | Returns `items: []`. Not an error. |
| `userId` for a non-existent user | Returns `items: []`. Not a 404 — the user may have been deactivated but their audit history is preserved. |
| Very large date range | Paginated response; caller pages through. |
| Filter combination returns zero results | Returns `items: []`. Not an error. |

---

### API-0606: Get Review Queue

> **Source:** FRD §5.4, §13.5 (Approval Queue Report), UF-03/UF-06/UF-07/UF-09/UF-10, IA W1 My Work, API List API-0606.

**Endpoint:**
```
GET /v1/work/queue
```

**Purpose:** Return the current user's actionable items in their role-based review queue. Unlike API-0604 (aggregate counts), this returns actual items with the detail needed to act on each one. The response is role-scoped: the same endpoint returns different content based on the caller's role(s).

**Authorization:** All roles (content shown is role-scoped).

---

#### 3.6.1 Query Parameters

| Parameter | Type | Default | Description |
|---|---|---|---|
| `itemType` | enum | (all applicable) | Filter by `ENGLISH_COPY`, `TRANSLATION`, `PUBLISHING_APPROVAL`, `ESCALATION`. |
| `language` | string | (all) | Filter translation items by language (for LR with multiple language assignments). |
| `pageId` | string | (all) | Filter to a specific page. |
| `module` | string | (all) | Filter by module. |
| `priority` | enum | (all) | `NORMAL`, `HIGH`, `URGENT`. |
| `sortBy` | enum | `submittedAtAsc` | `submittedAtAsc` (oldest first, default), `submittedAtDesc`, `confidenceAsc`, `priorityDesc`. |
| `pageSize` | integer | 50 | Max 200. |
| `pageToken` | string | (none) | Cursor. |

---

#### 3.6.2 Role-Based Item Visibility

What each caller sees is determined by their role(s) at the time of the request:

| Role | Items Shown |
|---|---|
| **PM / QA** | English copy returned for revision (their submissions returned by reviewers). Translations approved (ready for publishing action). |
| **LR (Localization Reviewer)** | Translations in PENDING_REVIEW for their language(s). Items they escalated to Founder (status tracking). |
| **SR (Support Reviewer)** | English copy in PENDING_REVIEW (submitted for SR approval). Publishing approval requests pending for any environment. |
| **FN (Founder)** | Escalated items (English copy and translations routed to Founder). Publishing approval requests for QA and Production. |
| **ADMIN** | System-level items: publishing failures requiring investigation. |
| **DEV (Developer)** | Empty queue (Developers do not participate in review or publishing workflows). |

> **Multi-role users:** If a user holds multiple roles (e.g., LR + PM), they see the union of items from all their roles. Items are de-duplicated by `(tagId, language, itemType)` where applicable.

---

#### 3.6.3 Response — 200 OK

```json
{
  "data": {
    "summary": {
      "totalItems": 18,
      "byType": {
        "ENGLISH_COPY": 4,
        "TRANSLATION": 12,
        "PUBLISHING_APPROVAL": 2,
        "ESCALATION": 0
      },
      "byLanguage": [
        { "language": "ar", "languageName": "Arabic", "count": 7 },
        { "language": "hi", "languageName": "Hindi", "count": 5 }
      ]
    },
    "items": [
      {
        "itemType": "TRANSLATION",
        "tagId": "QUICK_1",
        "pageId": "QUICK",
        "pageName": "Quick Sale",
        "language": "ar",
        "languageName": "Arabic",
        "submittedBy": "user:pm-sravan",
        "submittedAt": "2026-08-24T08:00:00Z",
        "queueAge": 4,
        "status": "PENDING_REVIEW",
        "confidenceScore": 0.97,
        "variableIntegrityStatus": "PASS",
        "isEscalated": false,
        "escalationReason": null,
        "priority": "NORMAL",
        "actionUrl": "/pages/QUICK/tags/QUICK_1?language=ar&mode=review"
      }
    ],
    "callerRoles": ["LR"]
  },
  "pagination": {
    "nextPageToken": "eyJpZCI6IlFVSUNLXzIifQ==",
    "pageSize": 50
  }
}
```

**Key response fields:**

| Field | Description |
|---|---|
| `summary.byType` | Count breakdown by item type. Only types applicable to the caller's role are shown. |
| `summary.byLanguage` | For LR callers: count of pending items per language they are assigned to. |
| `callerRoles` | The roles used to determine item visibility for this response. Useful for debugging multi-role users. |
| `items[].priority` | `NORMAL` = standard item. `HIGH` = variable integrity failure requiring attention. `URGENT` = publication-blocking (e.g., Production publishing approval overdue). |

---

#### 3.6.4 Priority Derivation

| Condition | Priority |
|---|---|
| Default | `NORMAL` |
| `variableIntegrityStatus == FAIL` | `HIGH` |
| Item is a PUBLISHING_APPROVAL for Production, age > 24 hours | `URGENT` |
| Escalation item (Founder only) | `HIGH` |

---

#### 3.6.5 Publishing Approval Items

For `itemType: PUBLISHING_APPROVAL`, the response extends the base item with:

```json
{
  "itemType": "PUBLISHING_APPROVAL",
  "releaseId": "rel_20260824_001",
  "pageId": "QUICK",
  "pageName": "Quick Sale",
  "language": "ar",
  "targetEnvironment": "PRODUCTION",
  "requestedBy": "user:pm-sravan",
  "requestedAt": "2026-08-24T08:00:00Z",
  "queueAge": 2,
  "tagCount": 38,
  "approvedTagCount": 35,
  "status": "PENDING_APPROVAL",
  "priority": "NORMAL",
  "actionUrl": "/deployments/releases/rel_20260824_001/review"
}
```

---

#### 3.6.6 Business Rules

| Rule | Source | Enforcement |
|---|---|---|
| Queue is role-scoped | FRD §13.5, IA W1 | Items shown are determined by the caller's role membership at request time. |
| Items are actionable pointers, not content copies | IA P4/P2 | Each item provides an `actionUrl` to the actual content in its editing context. |
| Sort by submission date ascending by default | FRD §13.5 | "sorted by submission date" — oldest first for fairness and urgency. |
| Escalated items visible only to Founder | FRD §8, UF-09 | `isEscalated: true` items appear only in FN queues. |
| Zero-item queue for Developer role | IA W1 | Developer role has no workflow participation in MioTranslate. |
| Multi-role union with deduplication | IA W1 | Deduplicated by `(tagId, language, itemType)`. |

---

#### 3.6.7 Error Catalogue

| HTTP | Code | Condition |
|---|---|---|
| 422 | `INVALID_VALUE` on `itemType` | Not a valid item type. |
| 422 | `INVALID_VALUE` on `language` | Not a configured language. |

---

### API-0607: Get Environment Status Matrix

> **Source:** FRD §5.5, §17 Resolved, IA D1 Deployment Overview, UF-10/UF-11/UF-14, API List API-0607.

**Endpoint:**
```
GET /v1/deployments/status
```

**Purpose:** Return the current deployment state across all pages for a selected language and all three environments (Dev, QA, Production). This is the operational command center view: which version is live where, what can be published, and where rollbacks have occurred.

**Authorization:** All roles.

---

#### 3.7.1 Query Parameters

| Parameter | Type | Default | Description |
|---|---|---|---|
| `language` | string | **Required** | Language to scope the matrix to. The matrix shows one language at a time (IA D1: "language selector at top"). |
| `module` | string | (all) | Filter pages by module. |
| `includeDeprecated` | boolean | `false` | Include deprecated pages. |
| `status` | enum | (all) | Filter cells by operational status. Valid values: `PUBLISHABLE`, `CURRENT`, `NEVER_PUBLISHED`, `FAILED`, `ROLLED_BACK`. When set, only rows where at least one environment (or the filtered environment) matches this status are returned. |
| `environment` | enum | (all) | Filter to show status for only one environment: `DEV`, `QA`, `PRODUCTION`. |
| `sortBy` | enum | `pageNameAsc` | `pageNameAsc`, `lastPublishedAtDesc` (most recently published first). |
| `pageSize` | integer | 50 | Max 200. |
| `pageToken` | string | (none) | Cursor. |

---

#### 3.7.2 Response — 200 OK

```json
{
  "data": {
    "language": "ar",
    "languageName": "Arabic",
    "summary": {
      "totalActivePages": 42,
      "pagesPublishedToProduction": 28,
      "pagesPublishable": 6,
      "pagesPendingApproval": 2,
      "pagesNeverPublished": 8
    },
    "rows": [
      {
        "pageId": "QUICK",
        "pageName": "Quick Sale",
        "module": "POS",
        "pageStatus": "ACTIVE",
        "environments": {
          "DEV": {
            "deploymentStatus": "CURRENT",
            "deployedVersion": "v4",
            "deployedAt": "2026-08-24T06:00:00Z",
            "deployedBy": "system:auto-publish",
            "tagCount": 35,
            "releaseId": "rel_20260824_dev_001",
            "isRollback": false
          },
          "QA": {
            "deploymentStatus": "PUBLISHABLE",
            "deployedVersion": "v3",
            "deployedAt": "2026-08-20T10:00:00Z",
            "deployedBy": "user:lr-ahmed",
            "tagCount": 34,
            "releaseId": "rel_20260820_qa_001",
            "isRollback": false
          },
          "PRODUCTION": {
            "deploymentStatus": "PUBLISHABLE",
            "deployedVersion": "v2",
            "deployedAt": "2026-08-15T14:00:00Z",
            "deployedBy": "user:sr-priya",
            "tagCount": 32,
            "releaseId": "rel_20260815_prod_001",
            "isRollback": false
          }
        },
        "approvedVersionSummary": {
          "latestApprovedVersion": "v4",
          "approvedTagCount": 35,
          "pendingPublishToQA": true,
          "pendingPublishToProduction": true
        }
      }
    ]
  },
  "pagination": {
    "nextPageToken": "eyJpZCI6IklOVk9JQ0UifQ==",
    "pageSize": 50
  }
}
```

**Environment status values:**

Each environment's status is determined **independently** relative to the current approved content in MioTranslate — not relative to the state of other environments. The FRD explicitly resolves that there is no enforced publishing order: approved content may be published to any target environment independently (FRD §17 Resolved: "No restrictions. Best practice recommended.").

| `deploymentStatus` | Meaning |
|---|---|
| `CURRENT` | The deployed version for this environment matches the current approved content. Nothing new to publish to this environment. |
| `PUBLISHABLE` | Approved content exists in MioTranslate that has not yet been published to this environment, and no prior deployment attempt is failing. This environment is a valid target. |
| `NEVER_PUBLISHED` | No successful deployment record exists for this page + language + environment. This environment has never received content for this page and language. |
| `FAILED` | The most recent publishing attempt to this environment failed. Content in this environment may be outdated or absent. Action required: investigate and retry. |
| `ROLLED_BACK` | The most recent deployment event for this environment was a rollback. The currently live version is a prior version; approved content that post-dates the rollback is publishable if desired. |

> **Design note — `BEHIND` status removed (v1.1):** An earlier draft included a `BEHIND` status defined as "a higher environment has a newer version." This was removed because: (1) MioTranslate does not enforce a Dev → QA → Production publishing order (FRD §17 Resolved); (2) each environment is an independent target; (3) the relationship between two environments' versions is context, not a status requiring action. `PUBLISHABLE` correctly signals that approved content is available for this environment regardless of what other environments contain. The `approvedVersionSummary` fields inform whether the environment is behind the latest approved content.

**`approvedVersionSummary`:**

| Field | Description |
|---|---|
| `latestApprovedVersion` | The version identifier that would be deployed if publishing were executed now (the current approved bundle). |
| `approvedTagCount` | Count of tags currently in APPROVED state for this language on this page. |
| `pendingPublishToQA` | True if `latestApprovedVersion` has not been successfully deployed to QA. Independent of DEV state. |
| `pendingPublishToProduction` | True if `latestApprovedVersion` has not been successfully deployed to Production. Independent of DEV and QA state. |

---

#### 3.7.3 Business Rules

| Rule | Source | Enforcement |
|---|---|---|
| Language is required — matrix is one language at a time | IA D1 | `language` is a required query parameter. |
| Each environment's status is independent | FRD §5.5, §7 Rule 7, §17 Resolved | No cross-environment comparison used for status derivation. Each environment's status is computed relative to the current approved content only. |
| No enforced publishing order | FRD §17 Resolved | "No restrictions. Best practice recommended." Approved content may be published to any target environment. `PUBLISHABLE` does not imply a prior environment must first be current. |
| Environment cell data sourced from Release records | Group 4 §2.1 | Reads from Group 4 Release records. `deployedVersion` = release `deploymentVersion`. |
| `CURRENT`: deployed bundle hash matches approved bundle hash | Group 4 §3.2.2 condition 3 | Compares current approved bundle hash against last successful deployment hash for this environment. |
| `PUBLISHABLE`: approved bundle hash differs from last successful deployment | Group 4 §3.2.2 condition 3 | No prior FAILED state; approved content exists that hasn't been pushed to this environment. |
| `FAILED`: last release record for this env has `status: FAILED` | Group 4 §2.1 | Read from Release record `status` field. |
| `ROLLED_BACK`: last release record for this env has `type: ROLLBACK` | Group 4 §2.1 | `isRollback: true` in the cell. |
| `status` filter vocabulary matches response status vocabulary | API Contract | Filter accepts all five status values: `PUBLISHABLE`, `CURRENT`, `NEVER_PUBLISHED`, `FAILED`, `ROLLED_BACK`. |
| `isRollback` flag | Group 4 §3.7 | True when the release record `type == ROLLBACK`. |
| Summary `pagesPublishable` count | API Design | Count of pages where at least one environment has `deploymentStatus: PUBLISHABLE`. |
| `deployedBy: "system:auto-publish"` for implicit DEV | Group 5 API-0502 | System-generated DEV deployments show system user. |
| Deprecated pages excluded by default | IA D1 | `includeDeprecated: false` by default. |
| Three fixed environments | FRD §15 Assumption 6 | `DEV`, `QA`, `PRODUCTION` are fixed. |

---

#### 3.7.4 Error Catalogue

| HTTP | Code | Condition |
|---|---|---|
| 400 | `REQUIRED` on `language` | `language` query parameter missing. |
| 404 | `LANGUAGE_NOT_FOUND` | Language code not configured. |
| 422 | `INVALID_VALUE` on `status` | Not one of the five valid deployment status values. |
| 422 | `INVALID_VALUE` on `environment` | Not `DEV`, `QA`, or `PRODUCTION`. |

---

#### 3.7.5 Edge Cases

| Scenario | Behaviour |
|---|---|
| Page never published in any environment | All three environments: `NEVER_PUBLISHED`. |
| All environments current | All three `deploymentStatus: CURRENT`. |
| DEV published (auto) but QA/Production not | DEV: `CURRENT`. QA: `PUBLISHABLE`. Production: `PUBLISHABLE`. Both independent of each other and of DEV. |
| Production published directly without QA (allowed per FRD §17) | Production: `CURRENT`. QA: `PUBLISHABLE` if approved content has not been published there. |
| Rollback occurred in Production | `environments.PRODUCTION.deploymentStatus: ROLLED_BACK`. `isRollback: true`. |
| Language has zero approved translations on a page | All environments `NEVER_PUBLISHED`. `approvedVersionSummary.approvedTagCount: 0`. |

---

## 4. Cross-Group Consistency Audit

### 4.1 Group 1 (Page & Tag Registry) — Consistency

| Concern | Check Result |
|---|---|
| Active vs. deprecated page distinction | ✅ Business rule explicitly separates active-with-zero-tags from deprecated pages. `includeDeprecated` controls only deprecated pages. |
| Tag active status in denominator | ✅ `totalActiveTags` = tags where `status != DEPRECATED` (Group 1 §2.2). |
| Module filter vocabulary | ✅ Module values sourced from Group 1 configured module vocabulary. Invalid value returns 422. |
| No write operations against Group 1 | ✅ All Group 6 reads are read-only. |

---

### 4.2 Group 2 (English Copy) — Consistency

| Concern | Check Result |
|---|---|
| English copy state vocabulary | ✅ API-0604 uses `NO_COPY`, `DRAFT`, `PENDING_REVIEW`, `APPROVED` — exact states from Group 2. |
| Review queue items for English copy | ✅ API-0606 surfaces `ENGLISH_COPY` items from Group 2 PENDING_REVIEW state. |
| Version history not duplicated | ✅ API-0605 does not expose `beforeValue`/`afterValue`. These are in Group 2 API-0204. |

---

### 4.3 Group 3 (Translation) — Consistency

| Concern | Check Result |
|---|---|
| staleInfo field mapping | ✅ API-0603 reads directly from Group 3 canonical `staleInfo` (§2.2): `previousStatus`, `staleSince`, `previousEnglishVersion/Text`, `currentEnglishVersion/Text`. Zero derivation. |
| Translation states | ✅ API-0604 and API-0606 use exactly Group 3's state vocabulary: `NO_TRANSLATION`, `DRAFT`, `PENDING_REVIEW`, `APPROVED`, `STALE`. |
| `previousStatus` filter in API-0603 | ✅ Values match Group 3 `staleInfo.previousStatus` enum: `APPROVED`, `PENDING_REVIEW`, `DRAFT`. |
| No write operations against Group 3 | ✅ All Group 6 reads are read-only. |

---

### 4.4 Group 4 (Publishing) — Consistency

| Concern | Check Result |
|---|---|
| Release record as source-of-truth | ✅ API-0607 reads from Group 4 Release records for deployment state. No independent deployment tracking. |
| Environment model | ✅ Three fixed environments: `DEV`, `QA`, `PRODUCTION` per FRD §15. |
| No enforced publishing order | ✅ FRD §17 Resolved: "No restrictions. Best practice recommended." `BEHIND` status removed in v1.1. Status derived per-environment vs. current approved content only. |
| `isRollback` flag | ✅ Sourced from `release.type == ROLLBACK` (Group 4 §2.1). |
| `PUBLISHABLE` vs `CURRENT` distinction | ✅ Based on bundle hash comparison logic from Group 5 API-0502 §3.2.2 condition 3. |
| `deployedBy: "system:auto-publish"` | ✅ Consistent with Group 5 API-0502 §3.2.3. |
| `status` filter consistent with response model | ✅ Filter vocabulary = `PUBLISHABLE`, `CURRENT`, `NEVER_PUBLISHED`, `FAILED`, `ROLLED_BACK`. Matches all status values returned in responses. |

---

### 4.5 Group 5 (Coverage & Audit) — Consistency

| Concern | Check Result |
|---|---|
| Coverage formula | ✅ API-0601/API-0602 use exact formula from Group 5 §3.3.1 and FRD §5.6: numerator = approved AND deployed to Production (including STALE-but-deployed). |
| Precomputed values | ✅ API-0601/API-0602 read from the coverage table maintained by API-0503. `computedAt` and `coverageFreshness` disclosed per cell. |
| Coverage freshness | ✅ `coverageFreshness: STALE` returned when values are behind, never an error. Consistent with Group 5 §3.3.4 failure handling. |
| Coverage recalculation triggers | ✅ Group 6 reads only — no writes. All recalculation responsibility remains with Group 5 API-0503. |
| Activity timeline reads from immutable audit store | ✅ API-0605 reads only from Group 5 API-0505 audit records. No direct writes to audit store from Group 6. |
| Action label catalogue | ✅ §3.5.3 action labels cover all actions from Group 5 §2.1.1 catalogue. |
| `performedBy: "system:*"` for system actions | ✅ Shown as `performedByDisplayName: "System (Auto-publish)"` etc. |
| Audit immutability not violated | ✅ API-0605 is GET only. |

---

### 4.6 Cross-Group Issues Found

| Issue ID | Classification | Description |
|---|---|---|
| **CG-G6-01** | Data Dependency | API-0604 `publishing.pagesPendingXxxPublish` counts require computing, for each `(page, language)` pair, whether approved content differs from what is deployed in each environment. This is the same bundle-hash comparison used by Group 5 API-0502 condition 3. Engineering must expose this as a queryable indicator (or derive it from Coverage + Release records). Not a design conflict — a shared infrastructure requirement. |
| **CG-G6-02** | Performance Guidance | API-0606 (Review Queue) must query across English copy PENDING_REVIEW state (Group 2), Translation PENDING_REVIEW state (Group 3), and Publishing approval PENDING state (Group 4) in a single response. Engineering must either materialize a combined work queue or issue parallel queries. This is an engineering implementation choice — the API contract is correct. |
| **CG-G6-03** | Documentation Note | API-0605 `beforeValue`/`afterValue` are explicitly NOT exposed in the timeline response. These are available in the version history APIs (Group 2 API-0204, Group 3 API-0308) for investigation-level detail. The timeline is a human-readable feed, not a diff API. This is an intentional design decision, not a gap. |

---

## 5. RBAC Summary

All Group 6 APIs are read-only. No Group 6 API mutates state, transitions workflow, or creates records. The only restriction is:
- **API-0606** shows role-scoped content: each role sees only the items relevant to their workflow participation. A caller's role is determined at request time.
- All other Group 6 APIs are accessible to all authenticated roles.

---

## 6. Engineering Dependencies

| ID | Dependency | Impact if Not Met |
|---|---|---|
| **ED-G6-01** | Coverage precomputed table (Group 5 ED-G5-01) must be queryable at the per `(pageId, language)` level by Group 6 APIs. API-0601 and API-0602 read from this table. Freshness must be disclosed via `computedAt`. | Dashboard shows stale values without a freshness indicator; PM/FN make planning decisions on incorrect data. |
| **ED-G6-02** | API-0603 stale item retrieval requires querying translations by `status == STALE` across all `(pageId, language)` combinations, joined with `staleInfo`. With large tag counts and many languages, this query must be indexed by `(status, staleInfo.staleSince)`. | Stale report is too slow to be usable at scale. |
| **ED-G6-03** | API-0606 Review Queue must efficiently query pending items across Group 2 (English copy), Group 3 (translation), and Group 4 (publishing approvals) for role-based routing. A materialized work queue table or indexed cross-domain join is required. | Review queue is slow or incomplete at operational scale. |
| **ED-G6-04** | API-0607 `PUBLISHABLE` status requires the bundle hash comparison introduced in Group 5 §3.2.2. Engineering must implement the bundle hash as a queryable field on the Release record, or derive it efficiently at query time. | Environment status matrix cannot correctly indicate what is publishable vs. current. |

---

## 7. Endpoint Summary

| API ID | Method | URL | Purpose | Auth |
|---|---|---|---|---|
| **API-0601** | `GET` | `/v1/coverage` | Coverage matrix (all pages × all languages) | All roles |
| **API-0602** | `GET` | `/v1/coverage/languages/{language}` | Language readiness (all pages for one language) | All roles |
| **API-0603** | `GET` | `/v1/translations/stale` | All stale translations with diff context | All roles |
| **API-0604** | `GET` | `/v1/work/summary` | System-wide pending work aggregate counts | All roles |
| **API-0605** | `GET` | `/v1/activity` | Activity timeline (filterable, paginated audit feed) | All roles |
| **API-0606** | `GET` | `/v1/work/queue` | Role-scoped review queue | All roles (role-scoped content) |
| **API-0607** | `GET` | `/v1/deployments/status` | Environment status matrix (one language × all pages × 3 environments) | All roles |

---

*End of Group 6 API Design Specification — v1.1 (Locked).*
