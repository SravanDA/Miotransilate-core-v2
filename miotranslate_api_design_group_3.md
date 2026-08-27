# MioTranslate API Design — Group 3: Translation

**Product:** MioTranslate  
**Document Type:** API Design Specification  
**Scope:** Group 3 — Translation Management (API-0301 through API-0309)  
**Source Documents:** Approved API List, FRD §4.4/§5.3/§5.4/§7/§8/§11/§12, Features F-06 through F-10, User Flows (UF-04, UF-05, UF-06, UF-07, UF-08, UF-12), UX Flows (UX-04 through UX-08), IA/Page Hierarchy (C2, C3, C4), Group 1 Conventions Baseline, Group 2 Working Contract  
**Audience:** Backend Engineering, API Architecture, Frontend Engineering, QA, Localization Teams  
**Date:** August 2026  
**Prerequisites:** Group 1 API Design (locked baseline conventions), Group 2 API Design (English copy source of truth)  

---

## 1. Group 3 Context & Architectural Model

### 1.1 What Group 3 Covers

Group 3 defines the complete API contract for all non-English translation operations in MioTranslate. In accordance with BRD §10/§11 and FRD §5.3, English copy is always the source language; all translations are derived from an approved English version (FRD §7, Rule 1).

Group 3 governs:
1. **AI-Assisted Translation Generation:** Single-tag and page-level bulk generation with business context (page name, module, copy type, salon/spa industry terminology).
2. **Translation Quality Checks:** AI confidence scoring, back-translation generation, and dynamic variable/placeholder integrity verification.
3. **Review & Approval Workflows:** Human verification gate before publishing, supporting direct approval from Draft or Pending Review, inline manual correction with atomic approval (`EDIT_AND_APPROVE`), retranslation requests, and rejections.
4. **Bulk Approval:** Accelerated review for high-confidence AI translations meeting the configurable 95% threshold.
5. **Stale Translation Lifecycle & Resolution:** Automatic staleness detection when source English copy changes, supporting independent per-language resolution via confirmation or retranslation with strict version immutability.
6. **Translation Versioning & History:** Permanent, immutable version tracking linked deterministically to source English versions.

---

### 1.2 Translation State Machine

The translation lifecycle follows a five-state model defined in FRD §4.4:

```
                  ┌─────────────────┐
                  │ NO_TRANSLATION  │
                  └────────┬────────┘
                           │
             ┌─────────────┼─────────────┐
             │ API-0301    │ API-0302    │ API-0303
             │ (Single AI) │ (Bulk AI)   │ (Manual Edit)
             ▼             ▼             ▼
                  ┌─────────────────┐
                  │      DRAFT      │◄─────────────────────────┐
                  └────────┬────────┘                          │
                           │                                   │ API-0304
             ┌─────────────┼─────────────┐                     │ (Request
             │ API-0309    │ API-0304    │ API-0304            │  Retranslate)
             │ (Submit)    │ (Approve)   │ (Edit & Approve)    │
             ▼             │             │                     │
      ┌──────────────┐     │             │                     │
      │PENDING_REVIEW│     │             │                     │
      └──────┬───────┘     │             │                     │
             │             │             │                     │
             ├─────────────┴─────────────┤                     │
             │ API-0304 / API-0305       │                     │
             │ (Approve / Bulk Approve)  │                     │
             ▼                           ▼                     │
                  ┌─────────────────┐                          │
                  │    APPROVED     │                          │
                  └────────┬────────┘                          │
                           │                                   │
                           │ Group 2 API-11 (English Edited)   │
                           │ triggers OP-01 (Flag Stale)       │
                           ▼                                   │
                  ┌─────────────────┐                          │
                  │      STALE      │                          │
                  └────────┬────────┘                          │
                           │                                   │
             ┌─────────────┼───────────────────────────────────┤
             │ API-0306    │ API-0307                          │ API-0303
             │ (Confirm)   │ (Retranslate)                     │ (Manual Edit)
             ▼             └───────────────────────────────────┘
      ┌──────────────┐
      │   APPROVED   │
      └──────────────┘
```

#### State Definitions

| State | Definition & Operational Meaning |
|---|---|
| `NO_TRANSLATION` | Tag exists in this language, but no translation content has ever been authored or generated. Initial state upon tag creation or language activation (API-0506). |
| `DRAFT` | Translation text exists (AI-generated or manually written) but has not yet been approved. Cannot be published to any environment (FRD §4.4). Can be reviewed and approved directly by a Localization Reviewer or submitted for queue review. |
| `PENDING_REVIEW` | Translation has been formally submitted for reviewer action via API-0309. Visible in Localization Reviewer queues (IA C4). |
| `APPROVED` | Translation has undergone formal human review and approval by a Localization Reviewer or Founder. Eligible for packaging into page bundles and publishing to target environments (FRD §7, Rule 8). |
| `STALE` | The source English copy changed after this translation was approved (or while in draft/review). Translation text and existing production deployments remain live; the stale flag signals that human re-evaluation against the updated English copy is required (FRD §7, Rule 6). |

---

### 1.3 Baseline Conventions Inheritance

Group 3 inherits all shared API conventions established in **Group 1 §1**:
- **URL Base & Versioning:** `https://{host}/api/v1/...` (Group 1 §1.1)
- **JSON Casing:** `camelCase` for fields, `SCREAMING_SNAKE_CASE` for status enums and error codes, ISO 8601 UTC for timestamps (Group 1 §1.2)
- **HTTP Semantics:** `GET` for reads, `POST` for creation/custom actions, `PATCH` for partial manual updates (Group 1 §1.3)
- **Response Envelope:** `{ "data": ... }` for single resources, `{ "data": [ ... ], "pagination": { ... } }` for collections, `{ "data": { "results": [ ... ] }, "meta": { ... } }` for batch operations (Group 1 §1.5)
- **Error Model:** RFC 9457-inspired envelope `{ "error": { "code", "status", "message", "target", "details" } }` (Group 1 §1.6)
- **Pagination:** Cursor-based pagination with opaque `pageToken` and `pageSize` (default 50, max 200) (Group 1 §1.7)
- **Concurrency Control:** ETag-based optimistic locking via `If-Match` headers on mutable operations (Group 1 §1.8)
- **Idempotency:** Client-generated `Idempotency-Key` headers on retry-sensitive creation/generation operations (Group 1 §1.9)
- **Authorization:** Role-Based Access Control enforcing permissions defined in FRD §8 (Group 1 §1.10)
- **Audit:** Immutable, permanent logging of all mutations via OP-03 (Group 1 §1.11)

---

### 1.4 Resource Identity & Sub-Resource Structure

A Translation is uniquely identified by the natural compound key:
$$\text{Translation Identity} = (\text{tagId}, \text{language})$$

There is no surrogate `translationId`. Every translation belongs to exactly one tag and exactly one language (FRD §4.4, §7 Rule 7).

#### URL Design

- **Singular Operations:** `/v1/tags/{tagId}/translations/{language}`
- **Custom Methods (State Transitions):** `/v1/tags/{tagId}/translations/{language}:{customMethod}`
- **Page-Level Batch Operations:** `/v1/pages/{pageId}/translations:{batchMethod}`
- **Cross-Tag Batch Operations:** `/v1/translations:{batchMethod}`
- **Version History Sub-Collection:** `/v1/tags/{tagId}/translations/{language}/versions`

---

### 1.5 Versioning & Lineage Semantics

1. **Sequential Version Numbers:** Version numbers are sequential integers starting at 1 per `(tagId, language)`. Versions are permanent and strictly immutable (FRD §7, Rule 21). Historical version snapshots are never mutated in place.
2. **Deterministic English Lineage:** Every translation version explicitly records `sourceEnglishVersion` (integer), referencing the exact English copy version number from Group 2 (`API-14`) that was approved at the time the translation version was generated, manually authored, or confirmed.
3. **Freshness Invariant:**
   - Fresh: `translation.sourceEnglishVersion == currentApprovedEnglishVersion`
   - Stale: `translation.sourceEnglishVersion < currentApprovedEnglishVersion` (triggered when Group 2 approves a new English version via `API-11`)
4. **Version Creation & Immutability Rules:**

| Operation | Version Effect | Immutability Guarantee |
|---|---|---|
| First AI generation (`API-0301` / `API-0302`) from `NO_TRANSLATION` | Version 1 created (`creationMethod: AI_GENERATED`) | Initial version snapshot recorded. |
| First manual edit (`API-0303`) from `NO_TRANSLATION` | Version 1 created (`creationMethod: MANUAL`) | Initial version snapshot recorded. |
| Submit for review (`API-0309`) | No version bump. Status on current draft becomes `PENDING_REVIEW`. | Current draft snapshot updated. |
| Direct approval (`API-0304` / `API-0305`) | No version bump. Current draft approved; `approvedBy`/`approvedAt` populated. | Draft snapshot finalized as `APPROVED`. |
| Edit and Approve (`API-0304`) | Version N+1 created (`creationMethod: MANUAL`), approved immediately. | Old Version N remains immutable in history as `SUPERSEDED`. |
| Request Retranslation (`API-0304`) | Version N+1 created (`creationMethod: AI_GENERATED`). | Old Version N remains immutable in history. |
| Confirm Stale (`API-0306`) | Version N+1 created (`creationMethod: MANUAL`), linked to new English version; status moves to `APPROVED`. | Old stale Version N remains **100% immutable** in history as `SUPERSEDED` with original `sourceEnglishVersion`. |
| Retranslate Stale (`API-0307`) | Version N+1 created (`creationMethod: AI_GENERATED`); linked to new English version. | Old stale Version N remains immutable in history as `SUPERSEDED`. |
| Manual edit on Stale (`API-0303`) | Version N+1 created (`creationMethod: MANUAL`); linked to new English version. | Old stale Version N remains immutable in history as `SUPERSEDED`. |

---

### 1.6 Concurrency & ETag Model for Translations

Every translation resource returned by `GET` (e.g., via `API-06` Tag Detail or `API-0308` Version History) carries an `ETag` header representing the hash of the translation's text, status, version, and review state.

Mutable translation operations (`API-0303`, `API-0304`, `API-0306`, `API-0307`, `API-0309`) require an `If-Match` header. If the translation was modified by another reviewer or invalidated by an English copy change since the client's last read, the server responds with `412 Precondition Failed`.

---

### 1.7 Language Isolation Guarantee

MioTranslate guarantees strict language isolation (FRD §7, Rule 7):
- Updating a translation for Arabic (`ar`) modifies only the `(tagId, 'ar')` record.
- Spanish (`es`), Italian (`it`), Turkish (`tr`), and English source copy remain entirely untouched.
- Bulk operations require explicit language targeting (`language` parameter in request body). No API can cross-contaminate multiple languages in a single execution.

---

## 2. Resource Model — Translation

### 2.1 Canonical Translation Resource

```json
{
  "tagId": "QUICK_1",
  "language": "ar",
  "status": "APPROVED",
  "text": "بيع سريع",
  "version": 2,
  "sourceEnglishVersion": 3,
  "creationMethod": "AI_GENERATED",
  "confidenceScore": 0.97,
  "backTranslation": "Quick Sale",
  "variableIntegrityStatus": "PASS",
  "author": "system:ai-translation",
  "authoredAt": "2026-08-17T10:00:00Z",
  "reviewedBy": "user:lr-ahmed",
  "reviewedAt": "2026-08-17T11:00:00Z",
  "approvedBy": "user:lr-ahmed",
  "approvedAt": "2026-08-17T11:00:00Z",
  "staleInfo": null,
  "createdAt": "2026-08-15T10:00:00Z",
  "updatedAt": "2026-08-17T11:00:00Z"
}
```

#### Field Specifications

| Field | Type | Mutability | Presence Condition | Description |
|---|---|---|---|---|
| `tagId` | string | Immutable | Always | Globally unique Tag identifier from Group 1. |
| `language` | string | Immutable | Always | ISO 639-1 language code (e.g., `ar`, `es`, `it`). |
| `status` | enum | System-managed | Always | `NO_TRANSLATION`, `DRAFT`, `PENDING_REVIEW`, `APPROVED`, `STALE`. |
| `text` | string \| null | Mutable | Null when `status == NO_TRANSLATION` | The translated copy in the target language. Max 5000 chars. |
| `version` | integer \| null | System-managed | Null when `status == NO_TRANSLATION` | Sequential version number for this `(tagId, language)`. |
| `sourceEnglishVersion` | integer \| null | System-managed | Null when `status == NO_TRANSLATION` | Approved English copy version number this translation was derived from or confirmed against. |
| `creationMethod` | enum \| null | System-managed | Null when `status == NO_TRANSLATION` | `AI_GENERATED` or `MANUAL`. |
| `confidenceScore` | number \| null | System-managed | Present only when `creationMethod == AI_GENERATED` | AI confidence score (0.00 to 1.00). Used for bulk approval threshold checks. |
| `backTranslation` | string \| null | System-managed | Present when `creationMethod == AI_GENERATED` | AI back-translation of the translated text into English for reviewer reference. |
| `variableIntegrityStatus` | enum \| null | System-managed | Present when English source contains variables `{...}` | `PASS` or `FAIL`. Verifies dynamic placeholders are preserved. |
| `author` | string \| null | System-managed | Null when `status == NO_TRANSLATION` | User ID of the author or `"system:ai-translation"`. |
| `authoredAt` | string (ISO 8601) \| null | System-managed | Null when `status == NO_TRANSLATION` | Timestamp when current version text was created. |
| `reviewedBy` | string \| null | System-managed | Populated upon review | User ID of the Localization Reviewer or Founder. |
| `reviewedAt` | string (ISO 8601) \| null | System-managed | Populated upon review | Timestamp of review action. |
| `approvedBy` | string \| null | System-managed | Populated only when `status == APPROVED` (or previously approved in `STALE`) | User ID of formal approver. |
| `approvedAt` | string (ISO 8601) \| null | System-managed | Populated only when `status == APPROVED` (or previously approved in `STALE`) | Timestamp of approval. |
| `staleInfo` | object \| null | System-managed | Populated **only** when `status == STALE` | Diff context describing the source English change. Null otherwise. |
| `createdAt` | string (ISO 8601) | Immutable | Always | Timestamp when translation slot was first created in MioTranslate. |
| `updatedAt` | string (ISO 8601) | System-managed | Always | Timestamp of most recent mutation. |

---

### 2.2 Stale Translation Representation (`staleInfo`)

When `status == "STALE"`, the translation resource includes a populated `staleInfo` object:

```json
{
  "tagId": "QUICK_1",
  "language": "ar",
  "status": "STALE",
  "text": "بيع سريع",
  "version": 2,
  "sourceEnglishVersion": 2,
  "creationMethod": "AI_GENERATED",
  "confidenceScore": 0.97,
  "backTranslation": "Quick Sale",
  "variableIntegrityStatus": "PASS",
  "author": "system:ai-translation",
  "authoredAt": "2026-08-15T10:00:00Z",
  "reviewedBy": "user:lr-ahmed",
  "reviewedAt": "2026-08-15T11:00:00Z",
  "approvedBy": "user:lr-ahmed",
  "approvedAt": "2026-08-15T11:00:00Z",
  "staleInfo": {
    "previousStatus": "APPROVED",
    "staleSince": "2026-08-21T11:00:00Z",
    "previousEnglishVersion": 2,
    "previousEnglishText": "Quick Sale",
    "currentEnglishVersion": 3,
    "currentEnglishText": "Quick Checkout"
  },
  "createdAt": "2026-08-15T10:00:00Z",
  "updatedAt": "2026-08-21T11:00:00Z"
}
```

| Field | Type | Description |
|---|---|---|
| `previousStatus` | enum | State prior to becoming stale: `APPROVED`, `PENDING_REVIEW`, or `DRAFT`. |
| `staleSince` | string (ISO 8601) | Timestamp when OP-01 marked this translation as stale. |
| `previousEnglishVersion` | integer | English version number this translation was based on. |
| `previousEnglishText` | string | English copy text at `previousEnglishVersion`. |
| `currentEnglishVersion` | integer | Newly approved English version number that triggered staleness. |
| `currentEnglishText` | string | Newly approved English copy text at `currentEnglishVersion`. |

---

## 3. API Specifications

### API-0301: Generate AI Translation (Single Tag)

> **Source:** UF-04 Steps 1–4, UX-04 Steps 1–2, F-06, FRD §5.3, API List API-0301.

**Endpoint:**
```
POST /v1/tags/{tagId}/translations/{language}:generateAI
```

**Purpose:** Generate an AI-assisted translation for a single tag in a selected language using full business context (parent page name, module, copy type, salon/spa industry terminology). The translation enters as `DRAFT`.

**Authorization:** PM, LR, FN (FRD §8: "Create AI translations").

**Path Parameters:**
| Parameter | Type | Description |
|---|---|---|
| `tagId` | string | Globally unique Tag identifier. Must exist and be ACTIVE. |
| `language` | string | Target language code. Must be an ACTIVE language in MioTranslate. |

**Request Headers:**
| Header | Required | Description |
|---|---|---|
| `Authorization` | Yes | Bearer token / session credential. |
| `Content-Type` | Yes | `application/json` |
| `Idempotency-Key` | Optional | Client-generated UUID for safe network retries. |

**Request Body:** Empty `{}`. (The server pulls source English copy, parent page, module, and copy type context automatically).

**Response — 201 Created:**
```json
{
  "data": {
    "tagId": "QUICK_1",
    "language": "ar",
    "status": "DRAFT",
    "text": "بيع سريع",
    "version": 1,
    "sourceEnglishVersion": 3,
    "creationMethod": "AI_GENERATED",
    "confidenceScore": 0.97,
    "backTranslation": "Quick Sale",
    "variableIntegrityStatus": "PASS",
    "author": "system:ai-translation",
    "authoredAt": "2026-08-21T14:00:00Z",
    "reviewedBy": null,
    "reviewedAt": null,
    "approvedBy": null,
    "approvedAt": null,
    "staleInfo": null,
    "createdAt": "2026-08-21T14:00:00Z",
    "updatedAt": "2026-08-21T14:00:00Z"
  }
}
```
*Response includes `ETag` header.*

**Business Rules:**
| Rule | Source | Enforcement |
|---|---|---|
| Tag must exist and be ACTIVE | FRD §4.2 | Server validates. Returns 404 or 422. |
| Tag must have APPROVED English copy | FRD §7 Rule 2, F-06 | Server validates `englishCopyStatus == APPROVED`. |
| Target language must be ACTIVE | FRD §4.5 | Server validates against active language registry. |
| Translation enters as DRAFT | FRD F-06 | Set by server. Human approval is strictly required before publishing. |
| Business context is injected into AI prompt | FRD §5.3, F-06 | Server injects `pageName`, `module`, `copyType`, and terminology rules. |
| Back-translation and confidence score generated | FRD F-06 | Server computes and stores alongside translation. |
| Variable integrity verified | FRD F-06 | If English copy contains `{...}`, server validates presence in translation. Sets `PASS` or `FAIL`. |
| Duplicate prevention across all existing states | FRD F-06 edge case | If a translation already exists in `DRAFT`, `PENDING_REVIEW`, `APPROVED`, or `STALE`, returns 409 `TRANSLATION_ALREADY_EXISTS`. For STALE items, client is directed to use `POST :retranslate` (API-0307) or `POST :confirmStale` (API-0306). |
| Audit logged | FRD §7 Rule 10 | OP-03 records generation event. |

**Error Catalogue:**
| HTTP | Code | Condition |
|---|---|---|
| 404 | `TAG_NOT_FOUND` | Tag does not exist. |
| 422 | `TAG_DEPRECATED` | Tag is Deprecated. Cannot generate translations for deprecated tags. |
| 422 | `ENGLISH_COPY_NOT_APPROVED` | Tag has no approved English copy (status is `NO_COPY`, `DRAFT`, or `PENDING_REVIEW`). |
| 422 | `LANGUAGE_NOT_ACTIVE` | Target language is inactive or not registered. |
| 409 | `TRANSLATION_ALREADY_EXISTS` | A translation already exists in `DRAFT`, `PENDING_REVIEW`, `APPROVED`, or `STALE` status. Use retranslate (API-0307), confirm stale (API-0306), or manual edit (API-0303) to update. |
| 503 | `AI_SERVICE_UNAVAILABLE` | External AI translation service unreachable or failed. Translation slot remains in `NO_TRANSLATION`. |
| 403 | `FORBIDDEN` | User lacks translation creation permission. |

---

### API-0302: Generate AI Translations (Bulk / Translate All)

> **Source:** UF-05 Steps 1–5, UX-05 Steps 1–2, F-07, FRD §5.3, API List API-0302.

**Endpoint:**
```
POST /v1/pages/{pageId}/translations:bulkGenerateAI
```

**Purpose:** AI-translate all eligible tags on a page for a target language in a single batch operation. Tags are eligible if they are ACTIVE, have APPROVED English copy, and currently have `NO_TRANSLATION` status in the target language.

**Authorization:** PM, LR, FN (FRD §8: "Create AI translations").

**Path Parameters:**
| Parameter | Type | Description |
|---|---|---|
| `pageId` | string | Page identifier. Must exist and be ACTIVE. |

**Request Headers:**
| Header | Required | Description |
|---|---|---|
| `Authorization` | Yes | Bearer token / session credential. |
| `Content-Type` | Yes | `application/json` |
| `Idempotency-Key` | Optional | Client-generated UUID for safe retries. |

**Request Body:**
```json
{
  "language": "ar"
}
```
| Field | Type | Required | Description |
|---|---|---|---|
| `language` | string | Yes | Target language code. Must be an ACTIVE language in MioTranslate. |

**Response — 200 OK:**
```json
{
  "data": {
    "results": [
      {
        "tagId": "QUICK_1",
        "status": "SUCCESS",
        "translation": {
          "tagId": "QUICK_1",
          "language": "ar",
          "status": "DRAFT",
          "text": "بيع سريع",
          "version": 1,
          "sourceEnglishVersion": 3,
          "creationMethod": "AI_GENERATED",
          "confidenceScore": 0.97,
          "backTranslation": "Quick Sale",
          "variableIntegrityStatus": "PASS",
          "author": "system:ai-translation",
          "authoredAt": "2026-08-21T14:05:00Z"
        }
      },
      {
        "tagId": "QUICK_2",
        "status": "SKIPPED",
        "skipReason": "ALREADY_TRANSLATED"
      },
      {
        "tagId": "QUICK_3",
        "status": "SKIPPED",
        "skipReason": "ENGLISH_COPY_NOT_APPROVED"
      },
      {
        "tagId": "QUICK_4",
        "status": "ERROR",
        "error": {
          "code": "AI_GENERATION_FAILED",
          "message": "AI translation provider timed out for this item."
        }
      }
    ]
  },
  "meta": {
    "pageId": "QUICK",
    "language": "ar",
    "totalTagsOnPage": 38,
    "eligible": 35,
    "generated": 32,
    "failed": 1,
    "skippedAlreadyTranslated": 2,
    "skippedNoEnglish": 1
  }
}
```

**Business Rules:**
| Rule | Source | Enforcement |
|---|---|---|
| Page must exist and be ACTIVE | FRD §4.1 | Server validates. Returns 404 or 422. |
| Scoped strictly to target language | FRD §7 Rule 7 | Only translations for the specified language are created. |
| Automatic eligibility filtering | FRD F-07, UF-05 Step 3 | Only tags with approved English copy and `NO_TRANSLATION` state are processed. |
| Existing translations skipped | FRD F-07 | Tags in `DRAFT`, `PENDING_REVIEW`, `APPROVED`, or `STALE` are skipped without overwrite (reported in `skippedAlreadyTranslated`). |
| Tags lacking approved English skipped | FRD F-07 | Reported in `meta.skippedNoEnglish`. |
| Partial success supported | FRD F-07, UF-05 EXCEPTION-1 | Successful items enter as `DRAFT`; failed items are reported with reasons. |
| Audit logged per tag | FRD §7 Rule 10, §9.3 | OP-03 creates one audit record per successfully generated translation. |

**Error Catalogue (Page-Level Pre-Validation):**
| HTTP | Code | Condition |
|---|---|---|
| 404 | `PAGE_NOT_FOUND` | Page does not exist. |
| 422 | `PAGE_DEPRECATED` | Page is Deprecated. |
| 422 | `LANGUAGE_NOT_ACTIVE` | Target language is inactive or not registered. |
| 422 | `VALIDATION_FAILED` | `language` field missing or malformed. |
| 403 | `FORBIDDEN` | User lacks translation creation permission. |

---

### API-0303: Edit Translation Manually

> **Source:** UF-06 ALT-A, UF-12 Step 4, F-08, FRD §5.3, API List API-0303.

**Endpoint:**
```
PATCH /v1/tags/{tagId}/translations/{language}
```

**Purpose:** Manually create or update a translation text without performing an immediate approval. Used when an author or reviewer drafts a custom translation, corrects an existing draft, or updates a stale translation.

**Authorization:** LR, FN (FRD §8: "Edit translations manually").

**Path Parameters:**
| Parameter | Type | Description |
|---|---|---|
| `tagId` | string | Globally unique Tag identifier. |
| `language` | string | Target language code. |

**Request Headers:**
| Header | Required | Description |
|---|---|---|
| `Authorization` | Yes | Bearer token / session credential. |
| `Content-Type` | Yes | `application/json` |
| `If-Match` | Conditional | Required when updating an existing translation. Not required when authoring the first manual translation from `NO_TRANSLATION`. |

**Request Body:**
```json
{
  "text": "بيع سريع ومباشر",
  "changeReason": "Corrected dialect terminology for salon checkout"
}
```
| Field | Type | Required | Description |
|---|---|---|---|
| `text` | string | Yes | The manually entered translation text. Must not be empty. Max 5000 chars. |
| `changeReason` | string \| null | No | Optional note explaining the correction. Max 1000 chars. |

**Response — 200 OK:**
```json
{
  "data": {
    "tagId": "QUICK_1",
    "language": "ar",
    "status": "DRAFT",
    "text": "بيع سريع ومباشر",
    "version": 2,
    "sourceEnglishVersion": 3,
    "creationMethod": "MANUAL",
    "confidenceScore": null,
    "backTranslation": null,
    "variableIntegrityStatus": "PASS",
    "author": "user:lr-ahmed",
    "authoredAt": "2026-08-21T14:15:00Z",
    "reviewedBy": null,
    "reviewedAt": null,
    "approvedBy": null,
    "approvedAt": null,
    "staleInfo": null,
    "createdAt": "2026-08-15T10:00:00Z",
    "updatedAt": "2026-08-21T14:15:00Z"
  }
}
```
*Response includes updated `ETag` header.*

**Business Rules:**
| Rule | Source | Enforcement |
|---|---|---|
| Tag must have APPROVED English copy | FRD §7 Rule 2 | Server validates English status before accepting manual translation. |
| Text is mandatory and non-empty | FRD §11 | Empty string or whitespace rejected (422). |
| Creation method set to MANUAL | FRD §4.4 | `creationMethod` becomes `MANUAL`; `confidenceScore` and `backTranslation` set to null. |
| Editing a STALE translation | FRD §4.4, §7 Rules 19/21 | Creates Version N+1 with `status: DRAFT` linked to current approved English version. Old stale Version N remains **100% immutable** in history as `SUPERSEDED` and remains deployed in Language Services. Active status moves to `DRAFT`. |
| Editing an APPROVED translation | FRD §4.4 | Creates Version N+1 with `status: DRAFT`. Old approved version preserved in history. |
| Variable integrity checked on manual input | FRD §11 | If English contains `{...}`, server checks if placeholders exist in manual text. Sets `variableIntegrityStatus`. |
| Concurrency via ETag | Group 1 §1.8 | `If-Match` prevents conflicting overwrites. |

**Error Catalogue:**
| HTTP | Code | Condition |
|---|---|---|
| 404 | `TAG_NOT_FOUND` | Tag does not exist. |
| 422 | `TAG_DEPRECATED` | Tag is Deprecated. |
| 422 | `ENGLISH_COPY_NOT_APPROVED` | Tag lacks approved English copy. |
| 422 | `VALIDATION_FAILED` | `text` is empty or exceeds max length. |
| 412 | `PRECONDITION_FAILED` | ETag mismatch — translation was modified since client last read. |
| 428 | `PRECONDITION_REQUIRED` | `If-Match` header missing on existing translation update. |
| 403 | `FORBIDDEN` | User lacks manual translation editing permission (PM/QA cannot edit translations). |

---

### API-0304: Review Translation

> **Source:** UF-04 Steps 6–9, UF-06 Steps 2–6, UX-04 Steps 3–4, UX-06 Steps 2–4, F-08, FRD §5.4, API List API-0304.

**Endpoint:**
```
POST /v1/tags/{tagId}/translations/{language}:review
```

**Purpose:** Human review decision on a translation. Executes one of four explicit review actions: `APPROVE`, `EDIT_AND_APPROVE`, `REQUEST_RETRANSLATION`, or `REJECT`.

**Authorization:** LR, FN (FRD §8: "Approve translations" — LR: Yes, FN: Yes).

**Path Parameters:**
| Parameter | Type | Description |
|---|---|---|
| `tagId` | string | Globally unique Tag identifier. |
| `language` | string | Target language code. |

**Request Headers:**
| Header | Required | Description |
|---|---|---|
| `Authorization` | Yes | Bearer token / session credential. |
| `Content-Type` | Yes | `application/json` |
| `If-Match` | Yes | ETag from most recent read. Ensures reviewer acts on the exact draft viewed. |

**Request Body (Action: APPROVE):**
```json
{
  "action": "APPROVE",
  "comment": "Accurate salon terminology confirmed."
}
```

**Request Body (Action: EDIT_AND_APPROVE):**
```json
{
  "action": "EDIT_AND_APPROVE",
  "editedText": "بيع فوري",
  "comment": "Corrected to standard POS button label.",
  "overrideVariableIntegrityWarning": false
}
```

**Request Body (Action: REQUEST_RETRANSLATION):**
```json
{
  "action": "REQUEST_RETRANSLATION",
  "comment": "Grammar is incorrect for imperative button context."
}
```

**Request Body (Action: REJECT):**
```json
{
  "action": "REJECT",
  "comment": "Completely inappropriate translation for this module context."
}
```

| Field | Type | Required | Description |
|---|---|---|---|
| `action` | enum | Yes | `APPROVE`, `EDIT_AND_APPROVE`, `REQUEST_RETRANSLATION`, or `REJECT`. |
| `editedText` | string | Conditional | Mandatory when `action == EDIT_AND_APPROVE`. Forbidden for other actions. Max 5000 chars. |
| `comment` | string | Conditional | Mandatory when `action == REJECT` (FRD §11). Optional for other actions. Max 2000 chars. |
| `overrideVariableIntegrityWarning` | boolean | Optional | Default `false`. Set to `true` to approve despite a failing variable integrity check (FRD F-08). |

**Response — 200 OK (Action: APPROVE or EDIT_AND_APPROVE):**
```json
{
  "data": {
    "tagId": "QUICK_1",
    "language": "ar",
    "status": "APPROVED",
    "text": "بيع سريع",
    "version": 1,
    "sourceEnglishVersion": 3,
    "creationMethod": "AI_GENERATED",
    "confidenceScore": 0.97,
    "backTranslation": "Quick Sale",
    "variableIntegrityStatus": "PASS",
    "author": "system:ai-translation",
    "authoredAt": "2026-08-21T14:00:00Z",
    "reviewedBy": "user:lr-ahmed",
    "reviewedAt": "2026-08-21T14:30:00Z",
    "approvedBy": "user:lr-ahmed",
    "approvedAt": "2026-08-21T14:30:00Z",
    "staleInfo": null,
    "createdAt": "2026-08-21T14:00:00Z",
    "updatedAt": "2026-08-21T14:30:00Z"
  },
  "meta": {
    "actionTaken": "APPROVE",
    "devPublishTriggered": true
  }
}
```

**Business Rules & Action Matrix:**

| Action | State Transition | Version Effect | Review & Audit Record |
|---|---|---|---|
| `APPROVE` | `DRAFT` / `PENDING_REVIEW` → `APPROVED` | No version bump. Current draft approved; `approvedBy`/`approvedAt` populated. | Review recorded. Triggers OP-02 (Dev publish) and OP-05 (Coverage recalc). Represents formal human verification. |
| `EDIT_AND_APPROVE` | `DRAFT` / `PENDING_REVIEW` → `APPROVED` | Version N+1 created (`creationMethod: MANUAL`), approved immediately. | Review recorded noting manual correction. Triggers OP-02 and OP-05. Old version preserved as `SUPERSEDED`. |
| `REQUEST_RETRANSLATION` | `DRAFT` / `PENDING_REVIEW` → `DRAFT` | Version N+1 created (`creationMethod: AI_GENERATED`). | Review recorded. AI generates fresh translation against current English. |
| `REJECT` | Initial draft: → `NO_TRANSLATION`. Revision of approved: → `APPROVED` (restores prior approved version). | Rejected draft closed as `REJECTED` in version history. | Rejection recorded with mandatory comment. Restored approved version is **100% immutable** (all original metadata untouched). |

**Direct DRAFT → APPROVED Product Meaning:**
In accordance with UF-04 (Translate Single Tag, Steps 4–8), UX-04 (Steps 2–4), and FRD F-08, when a Localization Reviewer or Founder operates on a tag, they can review and approve a `DRAFT` translation directly without an intermediate `PENDING_REVIEW` submission. `API-0309` (`:submitForReview`) is an optional queue handoff used when a PM/QA authors a draft and submits it to the LR review queue (IA C4). In all cases, `API-0304` represents formal human verification before content becomes eligible for publishing.

**Variable Integrity Validation Rules for `APPROVE` and `EDIT_AND_APPROVE`:**
1. **For `APPROVE`:** Evaluates current `variableIntegrityStatus`. If `FAIL` and `overrideVariableIntegrityWarning == false`: rejects with `422 VARIABLE_INTEGRITY_WARNING`. If `overrideVariableIntegrityWarning == true`: approval proceeds with warning logged.
2. **For `EDIT_AND_APPROVE`:** Server immediately re-validates `editedText` against dynamic placeholders `{...}` in the current approved English copy:
   - If placeholders are missing or altered: `variableIntegrityStatus` is computed as `FAIL`. If `overrideVariableIntegrityWarning == false`, rejects with `422 VARIABLE_INTEGRITY_WARNING`. If `overrideVariableIntegrityWarning == true`, approval proceeds and records `variableIntegrityStatus: "FAIL"` with explicit override logged in the review record.
   - If placeholders are intact: `variableIntegrityStatus` is computed as `PASS`, and approval proceeds normally.

**Error Catalogue:**
| HTTP | Code | Condition |
|---|---|---|
| 404 | `TAG_NOT_FOUND` | Tag does not exist. |
| 409 | `INVALID_STATE_TRANSITION` | Translation is in `NO_TRANSLATION` or `STALE` (stale items must use stale resolution APIs). |
| 422 | `COMMENT_REQUIRED_ON_REJECT` | Rejection attempted without a comment. |
| 422 | `EDITED_TEXT_REQUIRED` | `EDIT_AND_APPROVE` called without `editedText`. |
| 422 | `VARIABLE_INTEGRITY_WARNING` | Attempted approval on failing variable integrity without override flag. |
| 412 | `PRECONDITION_FAILED` | ETag mismatch — translation or English copy changed during review. |
| 428 | `PRECONDITION_REQUIRED` | `If-Match` header missing. |
| 403 | `FORBIDDEN` | User lacks reviewer permissions. |

---

### API-0305: Bulk Approve Translations

> **Source:** UF-07 Steps 1–7, UX-07 Steps 1–5, F-09, FRD §5.4, §7 Rule 11, API List API-0305.

**Endpoint:**
```
POST /v1/translations:bulkApprove
```

**Purpose:** Efficiently approve multiple high-confidence AI translations in a single batch. Enforces the configurable 95% confidence threshold and excludes translations with variable integrity failures.

**Authorization:** LR, FN (FRD §8: "Bulk approve translations").

**Request Headers:**
| Header | Required | Description |
|---|---|---|
| `Authorization` | Yes | Bearer token / session credential. |
| `Content-Type` | Yes | `application/json` |
| `Idempotency-Key` | Optional | Client-generated UUID. |

**Request Body:**
```json
{
  "pageId": "QUICK",
  "language": "ar",
  "tagIds": ["QUICK_1", "QUICK_2", "QUICK_5", "QUICK_7"],
  "confidenceThreshold": 0.95
}
```
| Field | Type | Required | Description |
|---|---|---|---|
| `pageId` | string | Yes | Parent page identifier. |
| `language` | string | Yes | Target language code. |
| `tagIds` | array of strings | Yes | List of Tag IDs to approve (1 to 100 items). |
| `confidenceThreshold` | number | No | Default `0.95`. Cannot be lower than system configured minimum (FRD §7 Rule 11). |

**Response — 200 OK:**
```json
{
  "data": {
    "results": [
      {
        "tagId": "QUICK_1",
        "status": "APPROVED",
        "confidenceScore": 0.97,
        "variableIntegrityStatus": "PASS"
      },
      {
        "tagId": "QUICK_2",
        "status": "APPROVED",
        "confidenceScore": 0.96,
        "variableIntegrityStatus": "PASS"
      },
      {
        "tagId": "QUICK_5",
        "status": "EXCLUDED",
        "reason": "BELOW_CONFIDENCE_THRESHOLD",
        "confidenceScore": 0.91
      },
      {
        "tagId": "QUICK_7",
        "status": "EXCLUDED",
        "reason": "VARIABLE_INTEGRITY_FAILURE",
        "confidenceScore": 0.98
      }
    ]
  },
  "meta": {
    "totalRequested": 4,
    "approvedCount": 2,
    "excludedCount": 2,
    "confidenceThresholdApplied": 0.95
  }
}
```

**Business Rules:**
| Rule | Source | Enforcement |
|---|---|---|
| 95% Confidence Threshold Gate | FRD §7 Rule 11, §17 | Translations with `confidenceScore < threshold` are excluded from bulk approval. |
| Variable Integrity Gate | FRD F-09, UX-07 Step 4 | Translations with `variableIntegrityStatus == FAIL` are excluded and reported. |
| State Requirement | FRD F-09 | Only translations in `DRAFT` or `PENDING_REVIEW` are eligible. |
| Individual Audit Trail | FRD §7 Rule 10, §9.3 | Each approved item generates an individual, attributable audit log entry. |
| Downstream Publishing Trigger | FRD §17 | Triggered approvals initiate OP-02 (Dev publish) and OP-05 (Coverage recalc). |

---

### API-0306: Resolve Stale Translation — Confirm

> **Source:** UF-08 Steps 1–5, UX-08 Steps 1–3 Path A, F-10, FRD §5.3, API List API-0306.

**Endpoint:**
```
POST /v1/tags/{tagId}/translations/{language}:confirmStale
```

**Purpose:** Reviewer confirms that the existing translation text remains 100% accurate despite the English source copy change. Resolves the stale state and creates a new immutable version (Version N+1) linked to the latest English version, leaving the prior historical version snapshot completely untouched.

**Authorization:** LR, FN (FRD §8: "Resolve stale flags").

**Path Parameters:**
| Parameter | Type | Description |
|---|---|---|
| `tagId` | string | Globally unique Tag identifier. |
| `language` | string | Target language code. |

**Request Headers:**
| Header | Required | Description |
|---|---|---|
| `Authorization` | Yes | Bearer token / session credential. |
| `Content-Type` | Yes | `application/json` |
| `If-Match` | Yes | ETag from read. Ensures confirmation acts on current stale state. |

**Request Body:**
```json
{
  "comment": "Confirmed translation remains accurate for updated English phrasing."
}
```
| Field | Type | Required | Description |
|---|---|---|---|
| `comment` | string \| null | No | Optional confirmation note. Max 1000 chars. |

**Response — 200 OK:**
```json
{
  "data": {
    "tagId": "QUICK_1",
    "language": "ar",
    "status": "APPROVED",
    "text": "بيع سريع",
    "version": 3,
    "sourceEnglishVersion": 3,
    "creationMethod": "MANUAL",
    "confidenceScore": null,
    "backTranslation": null,
    "variableIntegrityStatus": "PASS",
    "author": "user:lr-ahmed",
    "authoredAt": "2026-08-21T15:00:00Z",
    "reviewedBy": "user:lr-ahmed",
    "reviewedAt": "2026-08-21T15:00:00Z",
    "approvedBy": "user:lr-ahmed",
    "approvedAt": "2026-08-21T15:00:00Z",
    "staleInfo": null,
    "createdAt": "2026-08-15T10:00:00Z",
    "updatedAt": "2026-08-21T15:00:00Z"
  },
  "meta": {
    "confirmedAgainstEnglishVersion": 3,
    "previousEnglishVersion": 2,
    "previousStaleVersion": 2,
    "newVersionCreated": 3
  }
}
```

**Business Rules:**
| Rule | Source | Enforcement |
|---|---|---|
| Translation must be in STALE state | FRD §5.3, F-10 | Returns 409 `INVALID_STATE_TRANSITION` if not STALE. |
| Strict Version Immutability | FRD §7 Rule 21 | Creates Version N+1 with the confirmed text, `sourceEnglishVersion = currentApprovedEnglishVersion`, and `creationMethod: MANUAL`. The historical Version N snapshot is **never mutated** and remains in history with its original `sourceEnglishVersion` and status `SUPERSEDED`. |
| State resolution logic | Stabilized Plan §2.2 | If `previousStatus == APPROVED`, the new version status becomes `APPROVED`. If `previousStatus == PENDING_REVIEW`, returns to `PENDING_REVIEW` as a new draft version linked to current English. |
| Text preserved | FRD F-10 | Text is preserved intact. |
| Audit logged | FRD §7 Rule 10 | OP-03 records stale confirmation event. |
| Coverage recalculated | FRD §5.6 | OP-05 recalculates coverage (tag moves from 'needs attention' to fully fresh). |

---

### API-0307: Resolve Stale Translation — Retranslate

> **Source:** UF-08 Step 3 Path B, UX-08 Step 3 Path B, F-10, FRD §5.3, API List API-0307.

**Endpoint:**
```
POST /v1/tags/{tagId}/translations/{language}:retranslate
```

**Purpose:** Triggers a new AI translation based on the newly approved English copy. Preserves the stale translation version in history and creates a new Version N+1 in `DRAFT` status.

**Authorization:** LR, FN (FRD §8: "Resolve stale flags").

**Path Parameters:**
| Parameter | Type | Description |
|---|---|---|
| `tagId` | string | Globally unique Tag identifier. |
| `language` | string | Target language code. |

**Request Headers:**
| Header | Required | Description |
|---|---|---|
| `Authorization` | Yes | Bearer token / session credential. |
| `Content-Type` | Yes | `application/json` |
| `If-Match` | Yes | ETag from read. |

**Request Body:** Empty `{}`.

**Response — 200 OK:**
```json
{
  "data": {
    "tagId": "QUICK_1",
    "language": "ar",
    "status": "DRAFT",
    "text": "الدفع السريع",
    "version": 3,
    "sourceEnglishVersion": 3,
    "creationMethod": "AI_GENERATED",
    "confidenceScore": 0.98,
    "backTranslation": "Quick Checkout",
    "variableIntegrityStatus": "PASS",
    "author": "system:ai-translation",
    "authoredAt": "2026-08-21T15:10:00Z",
    "reviewedBy": null,
    "reviewedAt": null,
    "approvedBy": null,
    "approvedAt": null,
    "staleInfo": null,
    "createdAt": "2026-08-15T10:00:00Z",
    "updatedAt": "2026-08-21T15:10:00Z"
  },
  "meta": {
    "previousStaleVersion": 2,
    "generatedAgainstEnglishVersion": 3
  }
}
```

**Business Rules:**
| Rule | Source | Enforcement |
|---|---|---|
| Translation must be in STALE state | FRD §5.3, F-10 | Returns 409 `INVALID_STATE_TRANSITION` if not STALE. |
| New draft version created | FRD F-10 | Creates Version N+1 with `status: DRAFT` and `creationMethod: AI_GENERATED`. |
| Previous stale version preserved | FRD §7 Rules 19/21 | Version N remains in version history with status `SUPERSEDED`. |
| Deployed content invariant | FRD §7 Rule 6 | Deployed translation in production remains live until the new draft is approved and published. |
| Ready for standard review | FRD F-10 | New draft enters reviewer queue (UF-06). |

---

### API-0308: Get Translation Version History

> **Source:** UF-15, UX-15, F-13, FRD §9.4, API List API-0308.

**Endpoint:**
```
GET /v1/tags/{tagId}/translations/{language}/versions
```

**Purpose:** Return the complete chronological history of all translation versions for a tag in a specific language, including author, creation method, confidence score, source English version, review decisions, and comments.

**Authorization:** All roles (FRD §8: "View version history").

**Path Parameters:**
| Parameter | Type | Description |
|---|---|---|
| `tagId` | string | Globally unique Tag identifier. |
| `language` | string | Target language code. |

**Query Parameters:**
| Parameter | Type | Default | Description |
|---|---|---|---|
| `pageSize` | integer | 50 | Items per page (max 200). |
| `pageToken` | string | — | Opaque pagination cursor. |

**Response — 200 OK:**
```json
{
  "data": [
    {
      "version": 3,
      "text": "الدفع السريع",
      "status": "DRAFT",
      "sourceEnglishVersion": 3,
      "creationMethod": "AI_GENERATED",
      "confidenceScore": 0.98,
      "backTranslation": "Quick Checkout",
      "variableIntegrityStatus": "PASS",
      "author": "system:ai-translation",
      "authoredAt": "2026-08-21T15:10:00Z",
      "reviewActions": []
    },
    {
      "version": 2,
      "text": "بيع سريع",
      "status": "SUPERSEDED",
      "sourceEnglishVersion": 2,
      "creationMethod": "AI_GENERATED",
      "confidenceScore": 0.97,
      "backTranslation": "Quick Sale",
      "variableIntegrityStatus": "PASS",
      "author": "system:ai-translation",
      "authoredAt": "2026-08-15T10:00:00Z",
      "reviewActions": [
        {
          "action": "APPROVED",
          "reviewedBy": "user:lr-ahmed",
          "reviewedAt": "2026-08-15T11:00:00Z",
          "comment": "Accurate."
        }
      ]
    },
    {
      "version": 1,
      "text": "بيع قديم",
      "status": "REJECTED",
      "sourceEnglishVersion": 1,
      "creationMethod": "AI_GENERATED",
      "confidenceScore": 0.82,
      "backTranslation": "Old Sale",
      "variableIntegrityStatus": "PASS",
      "author": "system:ai-translation",
      "authoredAt": "2026-08-01T09:00:00Z",
      "reviewActions": [
        {
          "action": "REJECT",
          "reviewedBy": "user:lr-ahmed",
          "reviewedAt": "2026-08-01T09:30:00Z",
          "comment": "Mistranslated term."
        }
      ]
    }
  ],
  "pagination": {
    "nextPageToken": null,
    "pageSize": 50
  }
}
```

**Business Rules:**
| Rule | Source | Enforcement |
|---|---|---|
| Immutable history | FRD §7 Rule 21 | Versions are never edited, overwritten, or deleted. |
| Reverse chronological order | FRD §9.4 | Latest version returned first. |
| Version comparison support | FRD §9.4 | Clients compare `text` across any two version entries. |

---

### API-0309: Submit Translation for Review

> **Source:** UF-04 Step 5, UX-04 Step 2, F-08, FRD §5.3, API List API-0309.

**Endpoint:**
```
POST /v1/tags/{tagId}/translations/{language}:submitForReview
```

**Purpose:** Transition a translation from `DRAFT` to `PENDING_REVIEW`, signaling to Localization Reviewers that manual authoring or AI translation is complete and ready for formal review.

**Authorization:** PM, LR, FN (FRD §8: "Submit for review").

**Path Parameters:**
| Parameter | Type | Description |
|---|---|---|
| `tagId` | string | Globally unique Tag identifier. |
| `language` | string | Target language code. |

**Request Headers:**
| Header | Required | Description |
|---|---|---|
| `Authorization` | Yes | Bearer token / session credential. |
| `If-Match` | Yes | ETag from read. |

**Request Body:** Empty `{}`.

**Response — 200 OK:**
```json
{
  "data": {
    "tagId": "QUICK_1",
    "language": "ar",
    "status": "PENDING_REVIEW",
    "text": "بيع سريع",
    "version": 1,
    "sourceEnglishVersion": 3,
    "creationMethod": "AI_GENERATED",
    "confidenceScore": 0.97,
    "backTranslation": "Quick Sale",
    "variableIntegrityStatus": "PASS",
    "author": "system:ai-translation",
    "authoredAt": "2026-08-21T14:00:00Z",
    "reviewedBy": null,
    "reviewedAt": null,
    "approvedBy": null,
    "approvedAt": null,
    "staleInfo": null,
    "createdAt": "2026-08-21T14:00:00Z",
    "updatedAt": "2026-08-21T15:20:00Z"
  }
}
```

**Business Rules:**
| Rule | Source | Enforcement |
|---|---|---|
| State requirement | FRD §5.3 | Translation must currently be in `DRAFT` state. |
| Notification dispatched | FRD §12, OP-04 | OP-04 notifies Localization Reviewer queue of pending item. |

---

## 4. Internal Operations & System Boundaries

Group 3 interacts with internal backend system operations:

```
┌────────────────────────────────────────────────────────────────────────┐
│                      MioTranslate Internal Operations                  │
├────────────────────────────────────────────────────────────────────────┤
│  OP-01: Auto-Flag Stale                                                │
│  - Trigger: Group 2 API-11 approval when previousApprovedVersion != null│
│  - Action: Sets status: STALE on all translations for tag across all   │
│            active languages; populates staleInfo.                      │
├────────────────────────────────────────────────────────────────────────┤
│  OP-02: Implicit Dev Publishing                                        │
│  - Trigger: Group 3 API-0304 (Approve / Edit & Approve) & API-0305    │
│  - Action: Automatically constructs page bundle and dispatches to Dev  │
│            Language Services API endpoint.                             │
├────────────────────────────────────────────────────────────────────────┤
│  OP-03: Immutable Audit Record                                         │
│  - Trigger: All Group 3 mutating APIs                                  │
│  - Action: Writes permanent audit log entry (who, when, action, diff). │
├────────────────────────────────────────────────────────────────────────┤
│  OP-04: Dispatch Notification                                          │
│  - Trigger: Submission, approval, rejection, stale flag                │
│  - Action: Dispatches in-app alerts to PMs and LRs.                    │
├────────────────────────────────────────────────────────────────────────┤
│  OP-05: Recalculate Coverage                                           │
│  - Trigger: Translation approval, stale flag, stale resolution         │
│  - Action: Recalculates coverage metrics per page and language.        │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 5. Cross-Cutting Concerns

### 5.1 RBAC Permission Matrix

| API | Action | DEV | PM/QA | LR | SR | FN | ADMIN |
|---|---|---|---|---|---|---|---|
| API-0301 | Generate AI Translation | ✗ | ✓ | ✓ | ✗ | ✓ | ✗ |
| API-0302 | Bulk Generate AI Translations | ✗ | ✓ | ✓ | ✗ | ✓ | ✗ |
| API-0303 | Edit Translation Manually | ✗ | ✗ | ✓ | ✗ | ✓ | ✗ |
| API-0304 | Review Translation | ✗ | ✗ | ✓ | ✗ | ✓ | ✗ |
| API-0305 | Bulk Approve Translations | ✗ | ✗ | ✓ | ✗ | ✓ | ✗ |
| API-0306 | Resolve Stale — Confirm | ✗ | ✗ | ✓ | ✗ | ✓ | ✗ |
| API-0307 | Resolve Stale — Retranslate | ✗ | ✗ | ✓ | ✗ | ✓ | ✗ |
| API-0308 | Get Translation Version History | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| API-0309 | Submit for Review | ✗ | ✓ | ✓ | ✗ | ✓ | ✗ |

> **Source:** FRD §8. Developers have view-only access. PM/QA can generate and submit. LR and FN hold full review, manual edit, and approval authority.

---

### 5.2 Variable / Placeholder Integrity Guard

When the approved English copy contains dynamic variables (e.g., `Hello {customerName}`, `Total: {amount}`):
1. **AI Check:** The AI translation pipeline detects variable patterns and verifies exact presence in the translated output.
2. **Status Setting:**
   - If all placeholders are preserved intact: `variableIntegrityStatus = "PASS"`.
   - If any placeholder is altered, missing, or mistranslated: `variableIntegrityStatus = "FAIL"`.
3. **Review & Edit Enforcement:**
   - Single Review / Approval (`API-0304`): Reviewer receives a warning. Approval requires explicit `overrideVariableIntegrityWarning: true`.
   - Edit & Approve (`API-0304`): Server re-validates `editedText`. If placeholders are missing/altered, requires `overrideVariableIntegrityWarning: true` or returns 422.
   - Bulk Approval (`API-0305`): Items with `variableIntegrityStatus == "FAIL"` are automatically excluded from bulk approval.

---

### 5.3 AI Translation Business Context Engine

AI generation (`API-0301`, `API-0302`, `API-0307`) automatically compiles and injects prompt context:
- **Parent Page Context:** `pageId` and `pageName` (e.g., `QUICK` / `Quick Sale`).
- **Module Context:** `module` (e.g., `POS`, `Calendar`, `CRM`).
- **Copy Type Context:** `copyType` (e.g., `button`, `error_message`, `header`).
- **Industry Vocabulary:** Standardized salon, spa, and wellness domain glossaries.

---

## 6. Design Decision Log

| # | Decision | Classification | Rationale & Source Tracing |
|---|---|---|---|
| **G3-D01** | Compound natural key `(tagId, language)` with no surrogate ID | Approved Product Rule | FRD §4.4, §7 Rule 7. A translation is always scoped to a tag in a language. |
| **G3-D02** | `STALE` as a first-class state enum with `staleInfo.previousStatus` | Approved Product Rule & API Design Recommendation | FRD §4.4 lists `STALE` as a lifecycle state. `previousStatus` enables deterministic resolution back to the originating stage without losing context. |
| **G3-D03** | Stale marking applies across `APPROVED`, `PENDING_REVIEW`, and `DRAFT` | Approved Product Rule | FRD F-05, F-08 edge cases, API-0501, Group 2 OP-01. |
| **G3-D04** | Rejection requires comment; transitions to `NO_TRANSLATION` or reverts to immutable `APPROVED` | Approved Product Rule & API Design Recommendation | FRD F-08, UF-06 ALT-C, Group 2 alignment. Restores prior approved version snapshot with 100% field immutability. |
| **G3-D05** | `EDIT_AND_APPROVE` as an atomic review action with inline placeholder revalidation | Approved Product Rule & API Design Recommendation | FRD F-08, UF-06 ALT-A, UX-06 Path B. Version creation and approval succeed/fail together; placeholders re-validated. |
| **G3-D06** | Synchronous batch model for API-0302 bulk AI translation | API Design Recommendation | Aligns with Group 1 API-03 pattern and MioSalon page scale (30–80 tags). |
| **G3-D07** | Manual edit on STALE creates Version N+1 linked to new English | Approved Product Rule | FRD §4.4, §7 Rules 19/21. Old deployed version remains untouched. |
| **G3-D08** | ETag optimistic locking on mutable translation operations | API Design Recommendation | Group 1 §1.8 convention. Prevents concurrent reviewer/editor overwrites. |
| **G3-D09** | 95% confidence threshold default for bulk approval | Approved Product Rule | FRD §17 resolved question, FRD §7 Rule 11. |
| **G3-D10** | Variable integrity failure blocks bulk approval | Approved Product Rule | FRD §5.3, F-06, F-09, UF-07 ALT-B. |
| **G3-D11** | Language isolation strictly enforced per URL and payload | Approved Product Rule | FRD §7 Rule 7: "Each language is managed independently." |
| **G3-D12** | System operations (OP-01 through OP-05) remain external triggers/dependencies | Cross-Group Dependency | API List Domain 5, Group 2 §3. Translation triggers/consumes them without owning Publishing or Coverage. |
| **G3-D13** | Confirm Stale (API-0306) creates Version N+1 to guarantee version immutability | API Design Recommendation & Approved Product Rule | FRD §7 Rule 21 ("Versions are immutable once created"). Confirm Stale creates Version N+1 linked to the new English version, leaving Version N snapshot completely untouched. |
| **G3-D14** | Direct DRAFT → APPROVED review transition | Approved Product Rule | UF-04 Steps 4–8, UX-04 Steps 2–4, FRD F-08. Reviewers can approve drafts directly from the Tag view. |

---

## 7. Endpoint Summary

| API ID | Method | Endpoint | Purpose | Authorization |
|---|---|---|---|---|
| **API-0301** | `POST` | `/v1/tags/{tagId}/translations/{language}:generateAI` | Generate AI Translation (Single Tag) | PM, LR, FN |
| **API-0302** | `POST` | `/v1/pages/{pageId}/translations:bulkGenerateAI` | Generate AI Translations (Bulk / Translate All) | PM, LR, FN |
| **API-0303** | `PATCH` | `/v1/tags/{tagId}/translations/{language}` | Edit Translation Manually | LR, FN |
| **API-0304** | `POST` | `/v1/tags/{tagId}/translations/{language}:review` | Review Translation (`APPROVE`, `EDIT_AND_APPROVE`, `REQUEST_RETRANSLATION`, `REJECT`) | LR, FN |
| **API-0305** | `POST` | `/v1/translations:bulkApprove` | Bulk Approve High-Confidence Translations | LR, FN |
| **API-0306** | `POST` | `/v1/tags/{tagId}/translations/{language}:confirmStale` | Resolve Stale Translation — Confirm | LR, FN |
| **API-0307** | `POST` | `/v1/tags/{tagId}/translations/{language}:retranslate` | Resolve Stale Translation — Retranslate | LR, FN |
| **API-0308** | `GET` | `/v1/tags/{tagId}/translations/{language}/versions` | Get Translation Version History | All roles |
| **API-0309** | `POST` | `/v1/tags/{tagId}/translations/{language}:submitForReview` | Submit Translation for Review | PM, LR, FN |

---

*End of Group 3 API Design Specification.*
