# MioTranslate API Design — Group 4: Publishing & Deployment

**Product:** MioTranslate  
**Document Type:** API Design Specification  
**Scope:** Group 4 — Publishing & Deployment (API-0401 through API-0407; API-0502 intersection)  
**Source Documents:** Approved API List (Domain 4, Domain 5), FRD §4.9/§4.10/§5.5/§7/§8/§11/§12/§13.6/§14, Features F-11, F-12, User Flows UF-10, UF-11, UF-12, UF-14, UF-15, UX Flows UX-10, UX-11, IA/Page Hierarchy (D1, D2), Group 1 Conventions (locked), Group 2 Working Contract, Group 3 Working Contract, bulkImportPages API Document  
**Audience:** Backend Engineering, API Architecture, Frontend Engineering, QA, Operations  
**Date:** August 2026  
**Prerequisites:** Group 1 API Design (locked baseline conventions), Group 2 API Design (English copy source of truth), Group 3 API Design (translation approval, version, and stale semantics)

---

## 1. Group 4 Context & Architectural Model

### 1.1 What Group 4 Covers

Group 4 defines the complete API contract governing the movement of approved MioTranslate content from MioTranslate's internal state to external Language Services endpoints. It represents the boundary between MioTranslate's governance layer (authoring, translation, review, approval) and each environment's content delivery layer (Dev, QA, Production).

Group 4 governs:
1. **Environment Status:** Per-page-per-language readout of what is currently live in each environment.
2. **Pre-Publishing Summary:** Comparison of what would change in a target environment relative to current approved content.
3. **Publishing Approval Lifecycle:** Request → Approve/Reject, with environment-specific approval authority and snapshot-locking semantics.
4. **Publishing Execution:** Integration with the external Language Services `POST /multilingual/bulkImportPages` API, including the complete contract for single-language publishing, atomicity, retry, and version snapshot.
5. **Deployment History:** Immutable chronological record of all publishing events and rollbacks.
6. **Rollback:** Re-publishing a previous approved version as a first-class publishing action.

Group 4 also documents the **system-triggered API-0502 (Implicit Dev Publishing)** where it directly interacts with the publishing subsystem.

---

### 1.2 Core Product Model — Publishing Scope

The fundamental product publishing scope is:

$$\text{One Publishing Action} = \text{1 Page} + \text{1 Language} + \text{1 Environment}$$

This scope is **non-negotiable** (FRD §7 Rules 14 and 16):
- Publishing one language does not affect other languages for the same page.
- Publishing one page does not affect other pages.
- Each environment (Dev, QA, Production) is a distinct target with its own Language Services API endpoint.

> **Approved Product Rule (FRD §7 Rule 14):** The unit of publishing is a page bundle: one page + one language. This is not an API design choice. It is a product rule that determines every field in every API in this group.

---

### 1.3 Environment Model

Three fixed environments exist (FRD §4.10, §15 Assumption 6):

| Environment | Purpose | Approval Authority | Publishing Model |
|---|---|---|---|
| `DEV` | Development testing by QA and engineering | PM/QA or Reviewer (LR, SR) | Implicit upon content approval (FRD §17 resolved). Can also be manually initiated. |
| `QA` | Quality verification and support review | Reviewer (LR or SR) | Manual. Follows Dev publishing. |
| `PRODUCTION` | Live for salon teams | Support Reviewer (SR) or Founder (FN) | Manual. Follows QA publishing. |

Environments are **fixed infrastructure**. They are not created, modified, or deleted through any MioTranslate API. Environment identity must appear consistently in: approval requests, publishing records, deployment history, and rollback records.

---

### 1.4 Baseline Conventions Inheritance

Group 4 inherits all shared API conventions from **Group 1 §1** without modification:
- **URL Base & Versioning:** `https://{host}/api/v1/...` (Group 1 §1.1)
- **Naming:** `camelCase` for fields, `SCREAMING_SNAKE_CASE` for enums and error codes, ISO 8601 UTC for timestamps (Group 1 §1.2)
- **HTTP Semantics:** `GET` for reads, `POST` for creation/custom actions, `PATCH` for partial updates (Group 1 §1.3)
- **Response Envelope:** `{ "data": ... }`, `{ "data": [ ... ], "pagination": { ... } }`, `{ "data": { "results": ... }, "meta": { ... } }` (Group 1 §1.5)
- **Error Model:** RFC 9457-inspired `{ "error": { "code", "status", "message", "target", "details" } }` (Group 1 §1.6)
- **Pagination:** Cursor-based with opaque `pageToken` and `pageSize` (default 50, max 200) (Group 1 §1.7)
- **Concurrency Control:** ETag-based optimistic locking via `If-Match` (Group 1 §1.8)
- **Idempotency:** Client-generated `Idempotency-Key` on creation/execution operations (Group 1 §1.9)
- **Authorization:** RBAC per FRD §8 (Group 1 §1.10)
- **Audit:** Immutable records via OP-05 (Group 1 §1.11)

---

### 1.5 Publishing Approval Authority Matrix

The required approver depends exclusively on the target environment (FRD §8, §5.5 Business Rules):

| Target Environment | Requester (who initiates) | Required Approver |
|---|---|---|
| `DEV` | PM/QA, LR, SR, FN | PM/QA or LR (Author or Reviewer) |
| `QA` | LR, SR, FN | LR or SR (Reviewer) |
| `PRODUCTION` | SR, FN | SR or FN (Support Reviewer or Founder) |

> **Approved Product Rule (FRD §8):** Publishing to Production requires SR or FN authority. A PM/QA cannot approve production publishing. An LR cannot approve production publishing.

Self-approval is permitted: if the publisher holds the required approver authority for the target environment, they can approve their own publishing request without a separate approval step. This is explicitly called out in UX-10 Step 3.

---

### 1.6 Publishing Version Model

Before publishing, the following version-level identities must be deterministically established and locked:

| Identity | Source | Definition |
|---|---|---|
| `approvedEnglishVersion` | Group 2 English Copy | The integer version number of the approved English copy for each tag at the time of publishing. Each tag has its own `approvedEnglishVersion`. |
| `approvedTranslationVersion` | Group 3 Translation | The integer version number of the approved translation for each tag+language at the time of publishing. |
| `bundleSnapshotHash` | MioTranslate server | A hash or deterministic identifier representing the complete set of (tag, approvedTranslationVersion, translationText) tuples included in this publish action. This becomes the approval-request's version lock. |
| `deploymentVersion` | MioTranslate server | A sequential integer incrementing per `(pageId, language, environment)` deployment record. Represents "which deployment this is in history." |
| `contentSnapshot` | MioTranslate server | The complete immutable record of every tag's text, translation version, and source English version included in a given deployment record. |

An approval issued against `bundleSnapshotHash = X` must only trigger publishing if the bundle at execution time still matches `bundleSnapshotHash = X`. If new translations have been approved after the approval request was created, the approval request is **stale** and must be re-created (see API-0403 and API-0404).

---

### 1.7 Language Services Integration Boundary

The external Language Services API (`POST /multilingual/bulkImportPages`) is a content upsert mechanism. MioTranslate uses it as a delivery channel only. The following boundary is explicit and non-negotiable:

| Concern | Owned By |
|---|---|
| Content approval, version, stale state | MioTranslate |
| Environment-level approval authority | MioTranslate |
| Deployment records, release history, audit | MioTranslate |
| Rollback intent and semantics | MioTranslate |
| Content storage and delivery to salon teams | Language Services |
| Tag content upsert at target endpoint | Language Services |

MioTranslate must never be redesigned to fit Language Services API limitations. Engineering Dependencies that require Language Services capability enhancements are documented separately.

---

### 1.8 Single-Language Publishing Preservation

MioTranslate publishes **one language per action**. However, the Language Services `bulkImportPages` API supports multi-language payloads per tag and operates as a **smart upsert/merge**: it updates only the provided language keys and preserves existing language values.

> **Engineering Dependency (ED-LS-01):** MioTranslate's single-language publish relies on the Language Services upsert/merge behaviour preserving all other language values for tags in the same page. This must be explicitly confirmed with the Language Services team before production deployment. If Language Services performs a full overwrite of all language values per tag (rather than a per-language merge), sending only one language will corrupt other languages' data. The current API documentation describes merge behaviour (see `bulkImportPages` doc §"Smart Upsert (Merge)"), but this must be confirmed at the database level for production reliability.

MioTranslate's contract with its own API consumers is clear: publishing Arabic for `QUICK` page does not affect the Spanish, Italian, or Turkish values for `QUICK` in Language Services. That isolation guarantee depends on ED-LS-01 being met.

---

## 2. Resource Model — Release (Deployment Record)

### 2.1 Canonical Release Resource

```json
{
  "releaseId": "rel_QUICK_ar_QA_00007",
  "pageId": "QUICK",
  "pageName": "Quick Sale",
  "language": "ar",
  "environment": "QA",
  "deploymentVersion": 7,
  "type": "PUBLISH",
  "triggerSource": "USER_INITIATED",
  "status": "SUCCESSFUL",
  "tagCount": 36,
  "excludedTagCount": 2,
  "publishedBy": "user:lr-ahmed",
  "approvedBy": "user:sr-sara",
  "publishedAt": "2026-08-21T14:30:00Z",
  "approvedAt": "2026-08-21T14:25:00Z",
  "bundleSnapshotHash": "sha256:a1b2c3d4...",
  "contentSnapshot": {
    "tags": [
      {
        "tagId": "QUICK_1",
        "tagName": "quick_btn_sale",
        "translationVersion": 2,
        "sourceEnglishVersion": 3,
        "translationText": "بيع سريع"
      }
    ]
  },
  "isRollback": false,
  "rolledBackFromDeploymentVersion": null,
  "externalApiResult": {
    "pageId": "QUICK",
    "processed": 1,
    "failed": 0,
    "targetLanguageStatus": "success",
    "details": [
      { "language": "arabic", "status": "success" }
    ]
  },
  "notes": null,
  "createdAt": "2026-08-21T14:30:00Z"
}
```

### 2.2 Release Resource — Field Specifications

| Field | Type | Mutability | Description |
|---|---|---|---|
| `releaseId` | string | Immutable | System-generated unique identifier. |
| `pageId` | string | Immutable | The MioTranslate page being published. |
| `pageName` | string | Immutable | Page display name at the time of publishing. |
| `language` | string | Immutable | ISO 639-1 target language code. |
| `environment` | enum | Immutable | `DEV`, `QA`, `PRODUCTION`. |
| `deploymentVersion` | integer | Immutable | Sequential per `(pageId, language, environment)`. Starts at 1 for the first deployment. |
| `type` | enum | Immutable | `PUBLISH` or `ROLLBACK`. |
| `triggerSource` | enum | Immutable | What initiated this release. Values: `USER_INITIATED` (user manually triggered via API-0403 → API-0404 → API-0405 approval flow), `SYSTEM_AUTO_DEV` (system-triggered by API-0502 Implicit Dev Publishing, no human approval step), `MIGRATION` (created during initial data migration via Group 10 API-1002, bootstrapping the deployment history with pre-existing Language Services state). Used in deployment history display and audit reporting to distinguish automated system events from deliberate human publishing actions from migration bootstrapping. |
| `status` | enum | System-managed | `PENDING`, `IN_PROGRESS`, `SUCCESSFUL`, `FAILED`, `ROLLED_BACK`. |
| `tagCount` | integer | Immutable | Number of tags included in the published bundle. |
| `excludedTagCount` | integer | Immutable | Number of tags excluded because they were not `APPROVED` at publish time. |
| `publishedBy` | string | Immutable | User ID of the initiator. For `SYSTEM_AUTO_DEV` releases, this is a system service identity (e.g., `system:auto-dev-publisher`). For `MIGRATION` releases, this is the migration service identity (e.g., `system:migration`). |
| `approvedBy` | string \| null | Immutable | User ID of the publishing approver. Null for `SYSTEM_AUTO_DEV` and `MIGRATION` releases (no human approval step). |
| `publishedAt` | string (ISO 8601) | Immutable | Timestamp of execution. |
| `approvedAt` | string (ISO 8601) \| null | Immutable | Timestamp of approval. Null for `SYSTEM_AUTO_DEV` and `MIGRATION` releases. |
| `bundleSnapshotHash` | string | Immutable | Hash of the full approved content bundle at the time of publish. Used for version-lock validation. |
| `contentSnapshot` | object | Immutable | Complete per-tag snapshot of what was published. Includes tag ID, tag name, translation version, source English version, and translation text. |
| `isRollback` | boolean | Immutable | Whether this deployment record represents a rollback. |
| `rolledBackFromDeploymentVersion` | integer \| null | Immutable | If `isRollback == true`, the `deploymentVersion` that was rolled back from. |
| `externalApiResult` | object \| null | Immutable | Raw Language Services API response details for the publish action. Null if not yet executed. For `MIGRATION` releases this may be null if the migration bootstraps history without re-calling Language Services. |
| `notes` | string \| null | Immutable | Optional free-text notes provided at publishing time. |
| `createdAt` | string (ISO 8601) | Immutable | Timestamp when this release record was created. |

### 2.3 Release Status Lifecycle

```
PENDING → IN_PROGRESS → SUCCESSFUL
                     ↘ FAILED
SUCCESSFUL → ROLLED_BACK (when a subsequent rollback deployment covers this release)
```

A `FAILED` record is always preserved as-is. It is never mutated to `SUCCESSFUL` on retry. A retry creates a new release record.

A `ROLLED_BACK` status is set on a prior `SUCCESSFUL` release when a newer rollback deployment for the same `(pageId, language, environment)` completes successfully. This is the only mutation permitted on a historical release record.

---

### 2.4 Publishing Approval Request Resource

```json
{
  "approvalRequestId": "apr_QUICK_ar_QA_20260821",
  "pageId": "QUICK",
  "language": "ar",
  "environment": "QA",
  "requestedBy": "user:lr-ahmed",
  "requestedAt": "2026-08-21T14:00:00Z",
  "status": "PENDING",
  "bundleSnapshotHash": "sha256:a1b2c3d4...",
  "bundleContentSummary": {
    "tagCount": 36,
    "excludedTagCount": 2,
    "approvedTags": [ "QUICK_1", "QUICK_2" ],
    "excludedTags": [ "QUICK_37", "QUICK_38" ]
  },
  "requiredApproverRole": "REVIEWER",
  "approvedBy": null,
  "approvedAt": null,
  "rejectedBy": null,
  "rejectedAt": null,
  "rejectionReason": null,
  "expiresAt": "2026-08-22T14:00:00Z"
}
```

| Field | Type | Description |
|---|---|---|
| `approvalRequestId` | string | System-generated unique identifier. |
| `pageId` | string | Target page. |
| `language` | string | Target language. |
| `environment` | enum | Target environment (`DEV`, `QA`, `PRODUCTION`). |
| `requestedBy` | string | User who created the approval request. |
| `requestedAt` | string (ISO 8601) | Timestamp of creation. |
| `status` | enum | `PENDING`, `APPROVED`, `REJECTED`, `EXPIRED`, `CANCELLED`. |
| `bundleSnapshotHash` | string | Hash of the content bundle at request creation time. Approval is locked to this hash. If approved content changes after this, the hash changes and this request becomes stale. |
| `bundleContentSummary` | object | Summary of what is in the bundle — tag counts, included tag IDs, excluded tag IDs. |
| `requiredApproverRole` | string | The minimum role required to approve for this environment. |
| `approvedBy` | string \| null | User who approved (if approved). |
| `approvedAt` | string (ISO 8601) \| null | Timestamp of approval. |
| `rejectedBy` | string \| null | User who rejected (if rejected). |
| `rejectedAt` | string (ISO 8601) \| null | Timestamp of rejection. |
| `rejectionReason` | string \| null | Mandatory rejection reason text. |
| `expiresAt` | string (ISO 8601) \| null | System-set expiry (24 hours after creation). An expired approval request must not be used to trigger publishing. |

---

## 3. API Specifications

### API-0401: Get Environment Status

> **Source:** UF-10 Steps 1–2, UX-10 Step 1, F-11 §"Functional behaviour", FRD §4.10, IA D1 (Deployment Overview), API List API-0401.

**Endpoint:**
```
GET /v1/pages/{pageId}/languages/{language}/environments
```

**Purpose:** Return the current published status for a specific page+language combination across all three environments (Dev, QA, Production). This drives the environment status matrix in the Deployment Overview (IA D1) and the publishing context shown before selecting a target environment (UX-10 Step 1).

**Authorization:** All roles (FRD §8: "View pages, tags, statuses").

**Path Parameters:**
| Parameter | Type | Description |
|---|---|---|
| `pageId` | string | MioTranslate page identifier. Must exist. |
| `language` | string | ISO 639-1 language code. Must be an active language. |

**Query Parameters:**
| Parameter | Type | Default | Description |
|---|---|---|---|
| `includeContentSnapshot` | boolean | `false` | If `true`, include `currentContentSnapshot` in each environment record. Useful for diff comparisons. |

**Response — 200 OK:**
```json
{
  "data": {
    "pageId": "QUICK",
    "pageName": "Quick Sale",
    "language": "ar",
    "currentApprovedBundleHash": "sha256:a1b2c3d4...",
    "hasUnpublishedApprovedContent": true,
    "environments": {
      "DEV": {
        "status": "PUBLISHED",
        "deploymentVersion": 6,
        "publishedAt": "2026-08-20T10:00:00Z",
        "publishedBy": "system:auto-publish",
        "tagCount": 36,
        "isBehind": false,
        "isRolledBack": false
      },
      "QA": {
        "status": "BEHIND",
        "deploymentVersion": 5,
        "publishedAt": "2026-08-15T09:00:00Z",
        "publishedBy": "user:lr-ahmed",
        "tagCount": 35,
        "isBehind": true,
        "isRolledBack": false
      },
      "PRODUCTION": {
        "status": "NEVER_PUBLISHED",
        "deploymentVersion": null,
        "publishedAt": null,
        "publishedBy": null,
        "tagCount": null,
        "isBehind": null,
        "isRolledBack": false
      }
    }
  }
}
```

**Environment Status Taxonomy:**

| `status` | Meaning |
|---|---|
| `NEVER_PUBLISHED` | No version of this page+language has ever been published to this environment. No deployment record exists. Rollback is not available. |
| `PUBLISHED` | The currently deployed version matches the latest successful deployment record. |
| `BEHIND` | A more recent successful deployment exists in another environment or a new approved bundle exists that has not been published here. |
| `PUBLISHING` | A publishing action is currently in progress for this environment (status: `IN_PROGRESS`). |
| `FAILED` | The most recent publishing attempt for this environment resulted in a failure. The previously successful deployment (if any) remains live in Language Services. |
| `ROLLED_BACK` | The current live version in this environment is the result of a rollback, not the most recent publish. |

**Business Rules:**
| Rule | Source | Enforcement |
|---|---|---|
| Returns all three environments always | FRD §4.10 | All three environment keys present in response even if `NEVER_PUBLISHED`. |
| `hasUnpublishedApprovedContent` flag | UX-10 Step 1 | True if the current `approvedBundleHash` differs from any environment's deployed bundle hash. |
| `isBehind` | IA D1 | True when a newer approved bundle exists that has not been published to this environment. |
| Language isolation | FRD §7 Rule 7 | Status returned is scoped strictly to the specified language. |

**Error Catalogue:**
| HTTP | Code | Condition |
|---|---|---|
| 404 | `PAGE_NOT_FOUND` | Page does not exist. |
| 422 | `LANGUAGE_NOT_ACTIVE` | Language is inactive or not registered. |
| 403 | `FORBIDDEN` | User lacks view permission. |

---

### API-0402: Get Pre-Publishing Summary

> **Source:** UF-10 Steps 3–4, UX-10 Step 2, F-11 §"User sees a pre-publishing summary", FRD §11 Publishing Validations, API List API-0402.

**Endpoint:**
```
GET /v1/pages/{pageId}/languages/{language}/environments/{environment}/publishing-summary
```

**Purpose:** Return a detailed comparison of what will change if the publisher proceeds with publishing to the target environment. The caller reviews this before initiating a publishing approval request (API-0403). The response shows: tags to be added, tags with changed translation, unchanged tags, excluded tags (non-approved), and deprecated tags.

**Authorization:** LR, SR, FN (FRD §8: "Promote to QA/Production"). PM/QA for `DEV`.

**Path Parameters:**
| Parameter | Type | Description |
|---|---|---|
| `pageId` | string | MioTranslate page identifier. |
| `language` | string | ISO 639-1 language code. |
| `environment` | enum | `DEV`, `QA`, or `PRODUCTION`. |

**Response — 200 OK (Content available to publish):**
```json
{
  "data": {
    "pageId": "QUICK",
    "pageName": "Quick Sale",
    "language": "ar",
    "environment": "QA",
    "canProceed": true,
    "reason": null,
    "bundleSnapshotHash": "sha256:a1b2c3d4...",
    "currentEnvironmentDeploymentVersion": 5,
    "proposedDeploymentVersion": 6,
    "summary": {
      "totalApprovedTagsToPublish": 36,
      "newTags": 1,
      "changedTags": 3,
      "unchangedTags": 32,
      "excludedTagCount": 2,
      "deprecatedTagsOmitted": 0
    },
    "changes": {
      "newTags": [
        {
          "tagId": "QUICK_38",
          "tagName": "quick_lbl_new_feature",
          "translationText": "ميزة جديدة",
          "translationVersion": 1,
          "sourceEnglishVersion": 1
        }
      ],
      "changedTags": [
        {
          "tagId": "QUICK_1",
          "tagName": "quick_btn_sale",
          "previousTranslationText": "بيع",
          "currentTranslationText": "بيع سريع",
          "previousTranslationVersion": 1,
          "currentTranslationVersion": 2,
          "previousSourceEnglishVersion": 1,
          "currentSourceEnglishVersion": 3
        }
      ],
      "excludedTags": [
        {
          "tagId": "QUICK_37",
          "tagName": "quick_wip_feature",
          "translationStatus": "DRAFT",
          "exclusionReason": "NOT_APPROVED"
        }
      ],
      "deprecatedTagsOmitted": []
    },
    "requiredApproverRole": "REVIEWER",
    "canSelfApprove": true
  }
}
```

**Response — 200 OK (No approved content):**
```json
{
  "data": {
    "pageId": "QUICK",
    "language": "ar",
    "environment": "QA",
    "canProceed": false,
    "reason": "NO_APPROVED_CONTENT",
    "bundleSnapshotHash": null,
    "summary": {
      "totalApprovedTagsToPublish": 0,
      "newTags": 0,
      "changedTags": 0,
      "unchangedTags": 0,
      "excludedTagCount": 5,
      "deprecatedTagsOmitted": 0
    },
    "changes": null,
    "requiredApproverRole": "REVIEWER",
    "canSelfApprove": false
  }
}
```

**Response — 200 OK (No changes — same version already deployed):**
```json
{
  "data": {
    "pageId": "QUICK",
    "language": "ar",
    "environment": "DEV",
    "canProceed": false,
    "reason": "ALREADY_DEPLOYED",
    "bundleSnapshotHash": "sha256:a1b2c3d4...",
    "currentEnvironmentDeploymentVersion": 6,
    "proposedDeploymentVersion": null,
    "summary": {
      "totalApprovedTagsToPublish": 36,
      "newTags": 0,
      "changedTags": 0,
      "unchangedTags": 36,
      "excludedTagCount": 0,
      "deprecatedTagsOmitted": 0
    },
    "changes": null,
    "requiredApproverRole": "AUTHOR_OR_REVIEWER",
    "canSelfApprove": true
  }
}
```

**Business Rules:**
| Rule | Source | Enforcement |
|---|---|---|
| Only APPROVED translations included | FRD §5.5, §7 Rule 15, §11 | Tags with `DRAFT`, `PENDING_REVIEW`, or `STALE` status excluded from the bundle. |
| Stale translations explicitly excluded | FRD §11 Validation "Stale acknowledgement" | A `STALE` translation cannot be published as if it were fresh. It appears in `excludedTags` with reason `STALE_NOT_RESOLVED`. |
| Deprecated tags omitted | FRD §7 Rule 23 | Deprecated tags are excluded from the active publishing bundle. The `deprecatedTagsOmitted` list shows them explicitly to make clear their omission is intentional. |
| "Deprecated tags omitted" ≠ "deleted in Language Services" | ED-LS-02 | Because Language Services uses smart upsert/merge, omitting a deprecated tag from the new payload does NOT remove its previously published value from Language Services storage. This is an Engineering Dependency. See §7. |
| Comparison against target environment | FRD F-11, API-0401 | The "changed" and "new" calculation compares against the `contentSnapshot` of the most recent SUCCESSFUL deployment in the specific target environment. |
| `canProceed: false` when no approved content | FRD §11, UX-10 ERROR | Publishing cannot proceed when zero tags are in APPROVED state. |
| `canProceed: false` when already deployed | UF-10 ALT-C, FRD §11 Duplicate Prevention | Same `bundleSnapshotHash` already deployed to this environment. |
| `canSelfApprove` | FRD §8, UX-10 Step 3 | True when the current user holds the required approver role for the target environment. |

**Error Catalogue:**
| HTTP | Code | Condition |
|---|---|---|
| 404 | `PAGE_NOT_FOUND` | Page does not exist. |
| 422 | `INVALID_ENVIRONMENT` | Environment value not one of `DEV`, `QA`, `PRODUCTION`. |
| 422 | `LANGUAGE_NOT_ACTIVE` | Language is inactive. |
| 403 | `FORBIDDEN` | User lacks view permission for this scope. |

---

### API-0403: Request Publishing Approval

> **Source:** UF-10 Steps 3–5, UX-10 Step 3, F-11 §"Required approver for the target environment approves the publishing action", API List API-0403.

**Endpoint:**
```
POST /v1/pages/{pageId}/languages/{language}/environments/{environment}/publishing-approvals
```

**Purpose:** Create a formal publishing approval request for a specific page + language + environment. Locks the content bundle at the point of request creation (`bundleSnapshotHash`). Routes to the required approver. Triggers a notification.

**Authorization:** The requester must have permission to publish to the target environment. (FRD §8: PM/QA for DEV, LR/SR for QA, SR/FN for PRODUCTION.)

**Path Parameters:**
| Parameter | Type | Description |
|---|---|---|
| `pageId` | string | MioTranslate page identifier. |
| `language` | string | ISO 639-1 language code. |
| `environment` | enum | `DEV`, `QA`, or `PRODUCTION`. |

**Request Headers:**
| Header | Required | Description |
|---|---|---|
| `Authorization` | Yes | Bearer token. |
| `Content-Type` | Yes | `application/json` |
| `Idempotency-Key` | Optional | Client-generated UUID. If the same key is replayed, the same approval request is returned without creating a duplicate. |

**Request Body:**
```json
{
  "bundleSnapshotHash": "sha256:a1b2c3d4...",
  "notes": "Publishing Arabic for Quick Sale page to QA for support verification."
}
```

| Field | Type | Required | Description |
|---|---|---|---|
| `bundleSnapshotHash` | string | Yes | The hash from `API-0402` response. This is the version lock. The server validates that the current approved bundle still matches this hash before creating the approval request. |
| `notes` | string \| null | No | Optional context for the approver. Max 1000 chars. |

**Response — 201 Created:**
```json
{
  "data": {
    "approvalRequestId": "apr_QUICK_ar_QA_20260821",
    "pageId": "QUICK",
    "language": "ar",
    "environment": "QA",
    "requestedBy": "user:lr-ahmed",
    "requestedAt": "2026-08-21T14:00:00Z",
    "status": "PENDING",
    "bundleSnapshotHash": "sha256:a1b2c3d4...",
    "bundleContentSummary": {
      "tagCount": 36,
      "excludedTagCount": 2,
      "approvedTags": [ "QUICK_1", "QUICK_2", "..." ],
      "excludedTags": [ "QUICK_37", "QUICK_38" ]
    },
    "requiredApproverRole": "REVIEWER",
    "approvedBy": null,
    "approvedAt": null,
    "rejectedBy": null,
    "rejectedAt": null,
    "rejectionReason": null,
    "expiresAt": "2026-08-22T14:00:00Z"
  }
}
```

**Business Rules:**
| Rule | Source | Enforcement |
|---|---|---|
| Content must exist to publish | FRD §11 | Server validates at least one APPROVED tag exists for this page+language. Returns 422 `NO_APPROVED_CONTENT` if zero. |
| Duplicate prevention | FRD §11 Publishing Validations | If an active `PENDING` approval request already exists for the same `(pageId, language, environment)`, returns 409 `APPROVAL_REQUEST_ALREADY_PENDING`. |
| Bundle hash validation | §1.6 of this spec | Server recomputes the bundle hash at request time and validates it matches the client-provided `bundleSnapshotHash`. If the approved content changed since the summary was fetched (new translation approved), returns 409 `BUNDLE_HASH_MISMATCH`. |
| Already deployed prevention | FRD §11 | If the current bundle is already deployed to the target environment (same hash, `SUCCESSFUL` status), returns 409 `ALREADY_DEPLOYED`. |
| Approval expiry | API Design Recommendation | Approval requests expire 24 hours after creation. An expired approval request cannot be approved or used to trigger publishing. |
| Notification dispatched | FRD §12 | If the approver is different from the requester, OP-04 dispatches a notification to the required approver. If self-approving, no separate notification is needed. |
| Audit logged | FRD §7 Rule 19 | OP-05 records the approval request creation. |

**Error Catalogue:**
| HTTP | Code | Condition |
|---|---|---|
| 404 | `PAGE_NOT_FOUND` | Page does not exist. |
| 409 | `APPROVAL_REQUEST_ALREADY_PENDING` | An active `PENDING` approval request already exists for this page+language+environment. |
| 409 | `ALREADY_DEPLOYED` | This bundle version is already the current successful deployment in this environment. |
| 409 | `BUNDLE_HASH_MISMATCH` | The provided `bundleSnapshotHash` no longer matches the current approved bundle (content changed after summary was fetched). |
| 422 | `NO_APPROVED_CONTENT` | No approved tags exist for this page+language. |
| 422 | `INVALID_ENVIRONMENT` | Unknown environment value. |
| 403 | `FORBIDDEN` | User lacks publishing initiation permission for this environment. |

---

### API-0404: Approve or Reject Publishing

> **Source:** UF-10 Steps 6–7, UX-10 Step 4, F-11 §"Required approver for the target environment approves", API List API-0404.

**Endpoint:**
```
POST /v1/publishing-approvals/{approvalRequestId}:decide
```

**Purpose:** The required approver reviews and approves or rejects a publishing approval request. Approval triggers publishing execution (API-0405). Rejection records the reason and terminates the publishing action without execution.

**Authorization:** The deciding user must hold the required approver role for the target environment (validated server-side). A requester with sufficient authority can self-approve.

**Path Parameters:**
| Parameter | Type | Description |
|---|---|---|
| `approvalRequestId` | string | The approval request ID from API-0403. |

**Request Headers:**
| Header | Required | Description |
|---|---|---|
| `Authorization` | Yes | Bearer token. |
| `Content-Type` | Yes | `application/json` |
| `If-Match` | Yes | ETag of the approval request from read. Prevents concurrent double-approval. |

**Request Body (Approve):**
```json
{
  "decision": "APPROVE",
  "comment": "Bundle verified. Arabic content accurate for QA environment."
}
```

**Request Body (Reject):**
```json
{
  "decision": "REJECT",
  "rejectionReason": "Translation for QUICK_12 is outdated. Stale flag was not resolved before publishing."
}
```

| Field | Type | Required | Description |
|---|---|---|---|
| `decision` | enum | Yes | `APPROVE` or `REJECT`. |
| `comment` | string \| null | No | Optional comment for approvals. Max 2000 chars. |
| `rejectionReason` | string | Conditional | Mandatory when `decision == REJECT`. Max 2000 chars. |

**Version-Lock Validation at Approval:**
Before executing approval, the server:
1. Retrieves the approval request's `bundleSnapshotHash`.
2. Recomputes the current bundle hash for `(pageId, language)`.
3. If the two hashes differ: **returns 409 `BUNDLE_CHANGED_SINCE_APPROVAL_REQUEST`**. The approval request is marked `CANCELLED` (not expired). A new approval request must be created against the updated bundle.
4. If the hashes match: approval proceeds and publishing is triggered.

This ensures: **a reviewer who approved Version 5 never accidentally publishes Version 6 because Version 6 appeared after approval was granted.**

**Response — 200 OK (Approved — publishing triggered):**
```json
{
  "data": {
    "approvalRequestId": "apr_QUICK_ar_QA_20260821",
    "decision": "APPROVE",
    "approvedBy": "user:sr-sara",
    "approvedAt": "2026-08-21T14:25:00Z",
    "status": "APPROVED",
    "publishingTriggered": true,
    "releaseId": "rel_QUICK_ar_QA_00006"
  }
}
```

**Response — 200 OK (Rejected):**
```json
{
  "data": {
    "approvalRequestId": "apr_QUICK_ar_QA_20260821",
    "decision": "REJECT",
    "rejectedBy": "user:sr-sara",
    "rejectedAt": "2026-08-21T14:25:00Z",
    "rejectionReason": "Translation for QUICK_12 is outdated.",
    "status": "REJECTED",
    "publishingTriggered": false
  }
}
```

**Business Rules:**
| Rule | Source | Enforcement |
|---|---|---|
| Approver must hold required role | FRD §8 | Server validates the deciding user's role against `requiredApproverRole` on the approval request. |
| Rejection requires reason | API Design Recommendation (consistent with Group 3 review contract) | `rejectionReason` is mandatory when `decision == REJECT`. Returns 422 `REJECTION_REASON_REQUIRED` if missing. |
| Duplicate approval prevention | Group 1 §1.8 ETag | `If-Match` header required. If the request is already `APPROVED` or `REJECTED`, returns 412 `PRECONDITION_FAILED`. |
| Expired request cannot be approved | §2.4 of this spec | Returns 409 `APPROVAL_REQUEST_EXPIRED`. |
| Cancelled request cannot be approved | §3.3 of this spec | Returns 409 `APPROVAL_REQUEST_CANCELLED`. |
| Version-lock validation | §1.6, §2.4 of this spec | Bundle hash recomputed at decision time. |
| Approval triggers publishing | FRD §5.5, API List API-0404 | On successful `APPROVE`: server creates a release record (status `PENDING`) and triggers API-0405 execution. |
| Audit logged | FRD §7 Rule 19 | OP-05 records approve or reject action with reason. |
| Notification on rejection | FRD §12 | OP-04 notifies the requester of rejection with the rejection reason. |

**Error Catalogue:**
| HTTP | Code | Condition |
|---|---|---|
| 404 | `APPROVAL_REQUEST_NOT_FOUND` | Approval request does not exist. |
| 409 | `BUNDLE_CHANGED_SINCE_APPROVAL_REQUEST` | The current approved bundle hash no longer matches the hash locked at request creation time. Request cancelled. Re-initiate from API-0402. |
| 409 | `APPROVAL_REQUEST_EXPIRED` | Approval request has expired (> 24h since creation). |
| 409 | `APPROVAL_REQUEST_CANCELLED` | Approval request was cancelled due to a bundle hash mismatch. |
| 409 | `APPROVAL_REQUEST_ALREADY_DECIDED` | Request is already in `APPROVED` or `REJECTED` state. |
| 422 | `REJECTION_REASON_REQUIRED` | Rejection attempted without `rejectionReason`. |
| 412 | `PRECONDITION_FAILED` | ETag mismatch. |
| 428 | `PRECONDITION_REQUIRED` | `If-Match` header missing. |
| 403 | `FORBIDDEN` | User does not hold the required approver role for this environment. |

---

### API-0405: Execute Publishing

> **Source:** UF-10 Steps 8–9, UX-10 Step 5, F-11 §"MioTranslate pushes the approved content to the target environment's Language Services API endpoint", API List API-0405, bulkImportPages API Document.

**Endpoint:**
```
POST /v1/releases/{releaseId}:execute
```

> **Note:** This API is **primarily system-triggered** by API-0404 (on approval) and API-0502 (implicit Dev publishing). It is exposed as an addressable endpoint to support retries on failed releases (see Retry Behaviour §3.5.6). It must not be callable to bypass the approval lifecycle — the server validates that the `releaseId` has a corresponding `APPROVED` approval request.

**Purpose:** Construct the Language Services payload for the approved page+language bundle and execute the `POST /multilingual/bulkImportPages` call to the target environment's endpoint. Update the release record and deployment history with the result.

**Authorization:** System-triggered. If called via retry, SR or FN required for `PRODUCTION`; LR or SR for `QA`; PM/QA or LR for `DEV`.

**Path Parameters:**
| Parameter | Type | Description |
|---|---|---|
| `releaseId` | string | The release record ID created by API-0404 approval. |

**Request Headers:**
| Header | Required | Description |
|---|---|---|
| `Authorization` | Yes | Bearer token or system service credential. |
| `Idempotency-Key` | Optional | Client-generated UUID. Prevents duplicate publishing on retries. |

**Request Body:** Empty `{}`.

---

#### 3.5.1 Language Services Payload Construction

For a single-language publish action, MioTranslate constructs the following payload:

```json
{
  "domain": "miosalon",
  "pageId": "QUICK",
  "pageName": "Quick Sale",
  "tags": [
    {
      "tagName": "quick_btn_sale",
      "values": {
        "arabic": "بيع سريع"
      }
    },
    {
      "tagName": "quick_lbl_total",
      "values": {
        "arabic": "المجموع"
      }
    }
  ]
}
```

**Payload Construction Rules:**
| Rule | Rationale |
|---|---|
| Only the target language code is included in `values` per tag | Single-language publishing. Language Services' smart upsert preserves other language values (ED-LS-01). |
| Only APPROVED translations included | FRD §5.5, §7 Rule 15. DRAFT, PENDING_REVIEW, and STALE tags are excluded. |
| Tags with `NO_TRANSLATION` excluded | No translated value to publish. |
| Deprecated tags excluded | FRD §7 Rule 23. Their previously published values in Language Services are not deleted (upsert/merge model). |
| `tagName` derived from tag record | The `tagName` field in Language Services maps to the Tag ID in MioTranslate's registry (Group 1 convention). |
| `pageName` is the page display name | From the MioTranslate page record at time of publishing. |
| `domain` is always `"miosalon"` | Confirmed from Language Services API doc. |
| Module and Copy Type NOT included | Language Services schema does not include these fields. They are MioTranslate governance metadata, not content delivery metadata. |

---

#### 3.5.2 Atomicity Model

MioTranslate's atomicity requirement for publishing:

**Product-Level Atomicity (Required):**
> The MioTranslate deployment record, content snapshot, and audit entry for a publish action must reflect the exact same outcome as the Language Services API execution — success or failure — with no ambiguity.

**Mechanics:**
1. Release record created with `status: IN_PROGRESS` before Language Services call.
2. Language Services API called.
3. On Language Services `SUCCESSFUL` response for the **target language**: Release record updated to `SUCCESSFUL`. Content snapshot persisted. Audit record created.
4. On Language Services failure for the **target language**: Release record updated to `FAILED`. External API result recorded. Audit record created. No retry is automatic — the user initiates a retry.
5. On network timeout or no response received: Release record updated to `FAILED` with reason `EXTERNAL_TIMEOUT`. A retry attempt (using the same `Idempotency-Key`) will recheck Language Services state before re-executing. See §3.5.6.

> **This is product-level atomicity, not distributed transaction atomicity.** MioTranslate does not implement two-phase commit or distributed locking with Language Services. The atomicity guarantee means: MioTranslate will never record a `SUCCESSFUL` deployment while Language Services actually failed, and will never record `FAILED` while Language Services actually succeeded (with idempotency handling to cover the ambiguous case).

---

#### 3.5.3 Evaluating Language Services Response

The Language Services API returns a `details` array with per-language results. MioTranslate evaluates **only the target language's entry** in this array:

```json
{
  "pageId": "QUICK",
  "processed": 1,
  "failed": 0,
  "details": [
    { "language": "arabic", "status": "success" }
  ]
}
```

**Evaluation Logic:**
```
if (details.find(d => d.language == targetLanguageCode && d.status == "success")) {
    → deployment status = SUCCESSFUL
}
if (details.find(d => d.language == targetLanguageCode && d.status == "failed")) {
    → deployment status = FAILED (reason: TARGET_LANGUAGE_FAILED)
}
if (targetLanguageCode not found in details) {
    → deployment status = FAILED (reason: TARGET_LANGUAGE_MISSING_FROM_RESPONSE)
}
```

A success for another language in the `details` array (e.g., `"hindi": "success"`) does **not** constitute success for this publish action. The target language result is the authoritative signal.

---

#### 3.5.4 Domain Validation Failure

The Language Services API rejects the entire request with a global error when the `domain` value is invalid (from `bulkImportPages` doc §"Global Error: Invalid Domain"):

```json
{
  "status": "error",
  "reason": "Invalid domain. Only 'miosalon' is permitted."
}
```

MioTranslate treats this as a **distinct failure class: `DOMAIN_CONFIGURATION_ERROR`**, not as an endpoint-unreachable failure. The distinction matters:
- `EXTERNAL_ENDPOINT_UNREACHABLE`: transient network issue → user can retry.
- `DOMAIN_CONFIGURATION_ERROR`: the Language Services environment endpoint is misconfigured → engineering investigation required; retrying will not help.

Release record `status` in both cases: `FAILED`. But `externalApiResult.failureClass` is set to either `ENDPOINT_UNREACHABLE` or `DOMAIN_CONFIGURATION_ERROR` so the user and admin see the correct diagnostic.

Notifications:
- On any `FAILED` publishing: PM and ADMIN are notified (FRD §12).
- On `DOMAIN_CONFIGURATION_ERROR` specifically: ADMIN is additionally flagged for infrastructure investigation.

---

#### 3.5.5 Deployment Version Snapshot

When publishing succeeds, the following snapshot is recorded and made immutable:

| Snapshot Field | What It Records |
|---|---|
| `deploymentVersion` | Sequential integer per `(pageId, language, environment)`. Distinguishes this deployment event from prior ones. |
| `contentSnapshot.tags[].translationVersion` | The Group 3 translation version number for each published tag. |
| `contentSnapshot.tags[].sourceEnglishVersion` | The Group 2 English copy version number the translation was derived from. |
| `contentSnapshot.tags[].translationText` | The exact translated string that was pushed to Language Services. |
| `bundleSnapshotHash` | The hash of the full bundle. Enables future comparisons and rollback targeting. |
| `tagCount` | Number of approved tags included. |
| `excludedTagCount` | Number of tags excluded due to non-APPROVED status. |

These four version identities are never collapsed:
- `deploymentVersion`: "which deployment number this is in the environment history."
- `translationVersion`: "which translation version of this tag was published" (Group 3 integer).
- `sourceEnglishVersion`: "which English copy this translation was based on" (Group 2 integer).
- `contentSnapshot.tags[].translationText`: "the exact string that was sent to Language Services."

---

#### 3.5.6 Retry Behaviour and Idempotency

| Scenario | Handling |
|---|---|
| Network timeout before Language Services responds | Release record is `FAILED` with `failureClass: EXTERNAL_TIMEOUT`. A retry using the same `Idempotency-Key` causes the server to recheck Language Services state (via a query if available) or re-execute. A new `FAILED` release record is NOT created for the same `Idempotency-Key` — the existing record is updated. |
| Language Services responded but MioTranslate didn't receive it | Same handling as timeout above. Idempotency key prevents duplicate push. If Language Services already applied the content (smart upsert is naturally idempotent for the same content), the re-execute is safe. |
| Retry after confirmed failure | A new `Idempotency-Key` initiates a new release attempt. A new release record is created. The previous `FAILED` record is preserved. |
| Retry of an already SUCCESSFUL release | Returns 409 `RELEASE_ALREADY_SUCCESSFUL`. The existing successful record is returned. |
| Multiple concurrent publish attempts for the same `(pageId, language, environment)` | Server maintains a `PUBLISHING` status on the environment status. Second concurrent attempt returns 409 `PUBLISHING_IN_PROGRESS`. |

---

**Response — 200 OK (Successful):**
```json
{
  "data": {
    "releaseId": "rel_QUICK_ar_QA_00006",
    "pageId": "QUICK",
    "language": "ar",
    "environment": "QA",
    "status": "SUCCESSFUL",
    "deploymentVersion": 6,
    "tagCount": 36,
    "excludedTagCount": 2,
    "publishedAt": "2026-08-21T14:30:00Z",
    "externalApiResult": {
      "pageId": "QUICK",
      "processed": 1,
      "failed": 0,
      "targetLanguageStatus": "success",
      "details": [
        { "language": "arabic", "status": "success" }
      ]
    }
  }
}
```

**Response — 200 OK (Failed):**
```json
{
  "data": {
    "releaseId": "rel_QUICK_ar_QA_00006",
    "pageId": "QUICK",
    "language": "ar",
    "environment": "QA",
    "status": "FAILED",
    "deploymentVersion": 6,
    "failureClass": "TARGET_LANGUAGE_FAILED",
    "failureDetail": "Language Services returned status 'failed' for language 'arabic'.",
    "externalApiResult": {
      "pageId": "QUICK",
      "processed": 0,
      "failed": 1,
      "targetLanguageStatus": "failed",
      "details": [
        { "language": "arabic", "status": "failed", "reason": "An error occurred while processing language 'arabic'." }
      ]
    }
  }
}
```

**Business Rules:**
| Rule | Source | Enforcement |
|---|---|---|
| Must have APPROVED approval request | FRD §12 Approval gate | Server validates the `releaseId` has a corresponding `APPROVED` approval request. Returns 403 `PUBLISHING_APPROVAL_REQUIRED` if not. |
| Single-language payload | FRD §7 Rule 14, §1.8 of this spec | Only target language in `values` per tag. |
| Approved content only | FRD §11 | DRAFT, PENDING_REVIEW, STALE tags excluded from payload. |
| Target language response evaluation | §3.5.3 of this spec | Only the target language result is used to determine deployment status. |
| Deployment record created | FRD §4.9 | Release record created with all required attributes. |
| Content snapshot persisted | §3.5.5 of this spec | Immutable per-tag snapshot stored. |
| Audit recorded | FRD §7 Rule 19 | OP-05 records the publishing event. |
| Notification dispatched | FRD §12 | OP-04 notifies PM and SR on Production publish. OP-04 notifies PM and ADMIN on failure. |

**Failure Classes:**
| `failureClass` | Meaning |
|---|---|
| `ENDPOINT_UNREACHABLE` | Language Services endpoint did not respond (network error). |
| `EXTERNAL_TIMEOUT` | Language Services call timed out before a response was received. |
| `DOMAIN_CONFIGURATION_ERROR` | Language Services rejected the request due to invalid domain configuration. |
| `TARGET_LANGUAGE_FAILED` | Language Services processed the request but the target language entry returned `status: failed`. |
| `TARGET_LANGUAGE_MISSING_FROM_RESPONSE` | Target language not found in the Language Services `details` array. |

**Error Catalogue:**
| HTTP | Code | Condition |
|---|---|---|
| 404 | `RELEASE_NOT_FOUND` | Release record does not exist. |
| 409 | `RELEASE_ALREADY_SUCCESSFUL` | Release record is already `SUCCESSFUL`. |
| 409 | `PUBLISHING_IN_PROGRESS` | Another publish is currently in progress for this page+language+environment. |
| 403 | `PUBLISHING_APPROVAL_REQUIRED` | No APPROVED approval request exists for this release. |

---

### API-0406: Get Deployment History

> **Source:** UF-10 Step 9, UF-11 Steps 2–3, UF-15, UX-11 Step 1, F-12, FRD §13.6 (Deployment History Report), IA D2 (Deployment History), API List API-0406.

**Endpoint:**
```
GET /v1/pages/{pageId}/languages/{language}/environments/{environment}/releases
```

**Purpose:** Return the complete, immutable, chronological deployment history for a specific page + language + environment. Supports rollback selection (UX-11), investigation (UF-15), and the D2 Deployment History page.

**Authorization:** All roles (FRD §8: "View pages, tags, statuses").

**Path Parameters:**
| Parameter | Type | Description |
|---|---|---|
| `pageId` | string | MioTranslate page identifier. |
| `language` | string | ISO 639-1 language code. |
| `environment` | enum | `DEV`, `QA`, or `PRODUCTION`. |

**Query Parameters:**
| Parameter | Type | Default | Description |
|---|---|---|---|
| `pageSize` | integer | 50 | Items per page (max 200). |
| `pageToken` | string | — | Opaque cursor. |
| `includeContentSnapshot` | boolean | `false` | If true, include `contentSnapshot` per record. |
| `status` | enum | — | Filter by `SUCCESSFUL`, `FAILED`, or `ROLLED_BACK`. |

**Response — 200 OK:**
```json
{
  "data": [
    {
      "releaseId": "rel_QUICK_ar_QA_00006",
      "deploymentVersion": 6,
      "type": "PUBLISH",
      "status": "SUCCESSFUL",
      "tagCount": 36,
      "excludedTagCount": 2,
      "publishedBy": "user:lr-ahmed",
      "approvedBy": "user:sr-sara",
      "publishedAt": "2026-08-21T14:30:00Z",
      "approvedAt": "2026-08-21T14:25:00Z",
      "isRollback": false,
      "rolledBackFromDeploymentVersion": null,
      "bundleSnapshotHash": "sha256:a1b2c3d4...",
      "isCurrentlyActive": true,
      "notes": null,
      "externalApiResult": {
        "targetLanguageStatus": "success"
      }
    },
    {
      "releaseId": "rel_QUICK_ar_QA_00005",
      "deploymentVersion": 5,
      "type": "PUBLISH",
      "status": "ROLLED_BACK",
      "tagCount": 35,
      "excludedTagCount": 3,
      "publishedBy": "user:lr-ahmed",
      "approvedBy": "user:sr-sara",
      "publishedAt": "2026-08-15T09:00:00Z",
      "approvedAt": "2026-08-15T08:55:00Z",
      "isRollback": false,
      "rolledBackFromDeploymentVersion": null,
      "bundleSnapshotHash": "sha256:b2c3d4e5...",
      "isCurrentlyActive": false,
      "notes": null
    },
    {
      "releaseId": "rel_QUICK_ar_QA_00004",
      "deploymentVersion": 4,
      "type": "ROLLBACK",
      "status": "SUCCESSFUL",
      "tagCount": 34,
      "excludedTagCount": 0,
      "publishedBy": "user:sr-sara",
      "approvedBy": "user:sr-sara",
      "publishedAt": "2026-08-10T16:00:00Z",
      "approvedAt": "2026-08-10T16:00:00Z",
      "isRollback": true,
      "rolledBackFromDeploymentVersion": 3,
      "bundleSnapshotHash": "sha256:c3d4e5f6...",
      "isCurrentlyActive": false,
      "notes": "Rolled back QUICK_12 bad translation."
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
| Immutable history | FRD §7 Rule 21 | Records are never edited, overwritten, or deleted. |
| Rollback appears as a new record | FRD §7 Rule 18 | A rollback creates a new `type: ROLLBACK` release record. It does not overwrite the rolled-back release. |
| Reverse chronological order | FRD §13.6, IA D2 | Latest deployment first. |
| `isCurrentlyActive` flag | IA D2 | True for the release record that represents the currently live version in Language Services for this environment. |
| `ROLLED_BACK` status | §2.3 of this spec | Set on a prior `SUCCESSFUL` release when a subsequent rollback deployment succeeds. This is the only mutation on historical records. |
| Failed records preserved | FRD §7 Rule 18 | Failed deployment records remain visible in history for investigation. |

---

### API-0407: Execute Rollback

> **Source:** UF-11 Steps 1–6, UX-11 Steps 1–3, F-12 §"Functional behaviour", FRD §7 Rule 18, API List API-0407.

**Endpoint:**
```
POST /v1/pages/{pageId}/languages/{language}/environments/{environment}/releases/{targetDeploymentVersion}:rollback
```

**Purpose:** Re-publish a specific previous deployment version of a page+language bundle to the target environment. Rollback is a first-class re-publish action, not a deletion of the current version. Creates a new `type: ROLLBACK` release record. The "bad" version is preserved in history.

**Authorization:** SR, FN for all environments (FRD §8: "Rollback (any environment)").

**Path Parameters:**
| Parameter | Type | Description |
|---|---|---|
| `pageId` | string | MioTranslate page identifier. |
| `language` | string | ISO 639-1 language code. |
| `environment` | enum | `DEV`, `QA`, or `PRODUCTION`. |
| `targetDeploymentVersion` | integer | The `deploymentVersion` of the historical release to roll back to. Must have `status: SUCCESSFUL`. |

**Request Headers:**
| Header | Required | Description |
|---|---|---|
| `Authorization` | Yes | Bearer token. |
| `Content-Type` | Yes | `application/json` |
| `Idempotency-Key` | Optional | Client-generated UUID. |

**Request Body:**
```json
{
  "rollbackReason": "QUICK_12 contained incorrect Arabic translation in latest deploy.",
  "notes": "Initiating immediate rollback. Fix will follow through normal pipeline."
}
```

| Field | Type | Required | Description |
|---|---|---|---|
| `rollbackReason` | string | Yes | Mandatory reason for the rollback action. Max 2000 chars. |
| `notes` | string \| null | No | Optional supplementary context. Max 1000 chars. |

**Response — 201 Created (Rollback initiated and completed):**
```json
{
  "data": {
    "releaseId": "rel_QUICK_ar_QA_00007",
    "type": "ROLLBACK",
    "status": "SUCCESSFUL",
    "pageId": "QUICK",
    "language": "ar",
    "environment": "QA",
    "deploymentVersion": 7,
    "rolledBackFromDeploymentVersion": 6,
    "targetDeploymentVersion": 5,
    "tagCount": 35,
    "publishedBy": "user:sr-sara",
    "approvedBy": "user:sr-sara",
    "publishedAt": "2026-08-21T15:00:00Z",
    "rollbackReason": "QUICK_12 contained incorrect Arabic translation in latest deploy.",
    "containsDeprecatedTags": false,
    "deprecatedTagsInBundle": [],
    "externalApiResult": {
      "targetLanguageStatus": "success"
    }
  }
}
```

**Business Rules:**
| Rule | Source | Enforcement |
|---|---|---|
| Target version must exist and be SUCCESSFUL | FRD §11 Lifecycle Validations | Returns 404 `DEPLOYMENT_VERSION_NOT_FOUND` if the target `deploymentVersion` does not exist for this `(pageId, language, environment)`. Returns 422 `ROLLBACK_TARGET_NOT_SUCCESSFUL` if found but `status != SUCCESSFUL`. |
| Rollback not available for first deployment | FRD §F-12, UF-11 EXCEPTION-1 | If no prior SUCCESSFUL deployment exists (this is the only deployment), returns 422 `NO_PREVIOUS_VERSION_FOR_ROLLBACK`. |
| Cannot rollback to the currently active version | API Design Recommendation | If `targetDeploymentVersion` is already the currently active version, returns 409 `ALREADY_DEPLOYED`. |
| Deprecated tags in rollback bundle proceed | FRD §F-12 ALT-A, UF-11 ALT-A | If the target version's `contentSnapshot` includes tags that have since been deprecated, the rollback proceeds. `containsDeprecatedTags: true` with list provided. This is a safety measure. |
| Rollback uses target version's `contentSnapshot` | §3.5.5 of this spec | The content pushed to Language Services is taken from the target release record's immutable `contentSnapshot`, not recomputed from current MioTranslate state. |
| Rollback creates a new release record | FRD §7 Rule 18 | A new `type: ROLLBACK` deployment record is created. The previously active deployment record (`rolledBackFromDeploymentVersion`) has its `status` set to `ROLLED_BACK`. |
| No approval required for rollback | FRD §8, UF-11 | Rollback is initiated directly by SR/FN without a separate approval request lifecycle. Authorization is enforced at the endpoint level. |
| Rollback reason is mandatory | API Design Recommendation | `rollbackReason` is required. Returns 422 `ROLLBACK_REASON_REQUIRED` if missing. |
| Stale content in rollback | §3.7 of this spec | The rollback target version's content may reference translations that are currently `STALE` in MioTranslate. The rollback still proceeds — it uses the historical snapshot, not the current translation state. |
| Concurrent rollback prevention | Group 1 §1.8 | If a rollback or publish is already `IN_PROGRESS` for this `(pageId, language, environment)`, returns 409 `PUBLISHING_IN_PROGRESS`. |
| Audit logged | FRD §7 Rule 19 | OP-05 records the rollback with who, when, which version, and reason. |
| Notification dispatched | FRD §12 | OP-04 notifies PM, QA, and SR that a rollback has occurred. |

**Rollback Edge Cases:**
| Scenario | Handling |
|---|---|
| Rollback to an older (non-immediately-previous) version | Supported. `targetDeploymentVersion` can reference any `SUCCESSFUL` historical deployment. |
| Rollback to Version N when Version N's `contentSnapshot` references content now marked STALE | Rollback proceeds using the immutable historical snapshot. Advisory flag returned: `contentSnapshot.tags[].isCurrentlyStale` may be `true` per tag. This is informational only — the rollback restores the exact previously-deployed state. |
| Language Services fails during rollback | New rollback release record is created with `status: FAILED`. The current live deployment in the environment is unchanged. User can retry the rollback or initiate a new publish. |
| No previous SUCCESSFUL deployment at all | Returns 422 `NO_PREVIOUS_VERSION_FOR_ROLLBACK`. The team must fix and re-publish through the normal pipeline. |
| Rollback while another publish is in progress for same `(pageId, language, environment)` | Returns 409 `PUBLISHING_IN_PROGRESS`. |

**Error Catalogue:**
| HTTP | Code | Condition |
|---|---|---|
| 404 | `PAGE_NOT_FOUND` | Page does not exist. |
| 404 | `DEPLOYMENT_VERSION_NOT_FOUND` | The specified `targetDeploymentVersion` does not exist for this scope. |
| 409 | `ALREADY_DEPLOYED` | The target deployment version is already the currently active version. |
| 409 | `PUBLISHING_IN_PROGRESS` | A publish or rollback is currently in progress for this scope. |
| 422 | `NO_PREVIOUS_VERSION_FOR_ROLLBACK` | No successful prior deployment exists. |
| 422 | `ROLLBACK_TARGET_NOT_SUCCESSFUL` | Target release record exists but has `status != SUCCESSFUL`. |
| 422 | `ROLLBACK_REASON_REQUIRED` | `rollbackReason` is missing. |
| 403 | `FORBIDDEN` | User lacks rollback authority. |

---

## 4. API-0502: Implicit Dev Publishing (Publishing Domain Intersection)

> **Source:** UF-10 ALT-A, UX-10 EDGE CASE (Publishing to Dev Is Implicit), FRD §17 Resolved Questions, API List API-0502.

**Trigger:** System-triggered when content is approved and publishing conditions are met.  
**Ownership:** MioTranslate-owned system operation.  
**Triggering APIs:** API-0203 (English copy approval, Group 2) and API-0304 (Translation approval, Group 3).

**Behaviour as it Relates to Group 4:**

API-0502 is the mechanism for Implicit Dev Publishing. When triggered, it uses the same execution path as manual publishing through API-0405. The distinction is:

| Aspect | Manual Publishing (API-0403 → API-0404 → API-0405) | Implicit Dev Publishing (API-0502 → API-0405) |
|---|---|---|
| Initiation | User-initiated via API-0403 | System-triggered on approval event |
| Approval Request | Created via API-0403 | System creates an internal approval record automatically |
| Required Approver | PM/QA or LR for DEV | System acts as the approver (self-approval for DEV level) |
| Approval Lifecycle | Full PENDING → APPROVE flow | Bypassed for DEV environment only |
| Publishing Execution | API-0405 with `Idempotency-Key` | API-0405 with system-generated `Idempotency-Key` |
| Deployment Record | Same schema as manual publish | Same schema; `publishedBy: "system:auto-publish"`, `approvedBy: "system:auto-publish"` |
| Audit Record | Same as manual | Same; action noted as `IMPLICIT_DEV_PUBLISH` |
| User Feedback | None (not user-initiated) | Advisory notification: "Content automatically published to Dev." (UX-10 EDGE CASE) |

**Implicit Dev Publishing Conditions (all must be met):**
1. At least one tag on the page in the target language is in `APPROVED` state.
2. No `IN_PROGRESS` publishing action is currently running for this `(pageId, language, DEV)` scope.
3. The current approved bundle hash differs from the last successful DEV deployment hash for this scope (i.e., there is new content to publish).

If conditions are met and an implicit publish is triggered but Language Services fails:
- Release record `status: FAILED` with `type: PUBLISH`, `publishedBy: "system:auto-publish"`.
- PM and ADMIN notified (FRD §12 "Publishing failed").
- No automatic retry. The user can manually initiate a DEV publish through API-0403 → API-0404 → API-0405.

---

## 5. RBAC Permission Matrix

| API | Action | DEV | PM/QA | LR | SR | FN | ADMIN |
|---|---|---|---|---|---|---|---|
| API-0401 | Get Environment Status | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| API-0402 | Get Pre-Publishing Summary | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| API-0403 | Request Publishing Approval (DEV) | ✗ | ✓ | ✓ | ✓ | ✓ | ✗ |
| API-0403 | Request Publishing Approval (QA) | ✗ | ✗ | ✓ | ✓ | ✓ | ✗ |
| API-0403 | Request Publishing Approval (PRODUCTION) | ✗ | ✗ | ✗ | ✓ | ✓ | ✗ |
| API-0404 | Approve Publishing (DEV approver role) | ✗ | ✓ | ✓ | ✓ | ✓ | ✗ |
| API-0404 | Approve Publishing (QA approver role) | ✗ | ✗ | ✓ | ✓ | ✓ | ✗ |
| API-0404 | Approve Publishing (PRODUCTION approver role) | ✗ | ✗ | ✗ | ✓ | ✓ | ✗ |
| API-0404 | Reject Publishing (any environment) | ✗ | ✗ | See note | ✓ | ✓ | ✗ |
| API-0405 | Execute Publishing (system-triggered) | System | System | System | System | System | System |
| API-0405 | Execute Publishing (manual retry) | ✗ | ✗ | ✓ (DEV/QA) | ✓ | ✓ | ✗ |
| API-0406 | Get Deployment History | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| API-0407 | Execute Rollback (any environment) | ✗ | ✗ | ✗ | ✓ | ✓ | ✗ |

> **Note on API-0404 Reject:** An LR can reject a QA publishing approval request they created (if they have not yet found an SR-level approver). An LR cannot reject a PRODUCTION publishing approval request because they cannot approve it. The reject authority follows the requester's authority for their own requests, or the approver's authority for requests requiring their level.

---

## 6. Cross-Group Consistency Audit

### 6.1 Group 1 (Pages & Tags) — Consistency Check

| Concern | Check Result |
|---|---|
| Tag identity (Tag ID, Page ID) | ✅ Group 4 uses Tag ID and Page ID from Group 1 registry without modification. |
| Deprecated Tag behaviour | ✅ Deprecated tags excluded from publishing bundles (§3.5.1). Their previously published values remain in Language Services (documented as ED-LS-02). |
| Response/error conventions | ✅ All Group 4 APIs use Group 1 §1.5/§1.6 envelope and error model. |
| ETag / If-Match concurrency | ✅ Used on API-0404 (approval decision) and on rollback API-0407 via `PUBLISHING_IN_PROGRESS` guard. |
| Idempotency-Key | ✅ Used on API-0403 (request approval) and API-0405/API-0407 (execute publishing/rollback). |
| Immutable history | ✅ Deployment records never deleted. Rollback creates a new record, not an overwrite. |

### 6.2 Group 2 (English Copy) — Consistency Check

| Concern | Check Result |
|---|---|
| Approved English version | ✅ `sourceEnglishVersion` tracked per tag in the deployment content snapshot, referencing Group 2 version integers. |
| English version immutability | ✅ Snapshot records `sourceEnglishVersion` at publish time and never mutates it. |
| OP-01 stale trigger | ✅ When Group 2 approves a new English version, Group 3 translations become STALE. Group 4 explicitly excludes STALE translations from publishing bundles (§3.5.1). No modification of Group 2 occurs from Group 4. |
| Source version lineage | ✅ Preserved in `contentSnapshot.tags[].sourceEnglishVersion`. |

### 6.3 Group 3 (Translation) — Consistency Check

| Concern | Check Result |
|---|---|
| Translation approval prerequisite | ✅ Group 4 only includes APPROVED translations (FRD §5.5 / §11). DRAFT and PENDING_REVIEW explicitly excluded. |
| Translation version | ✅ `contentSnapshot.tags[].translationVersion` references Group 3 sequential version integers. |
| STALE translation exclusion | ✅ STALE translations explicitly excluded from publishing bundles (§3.5.1, API-0402 `exclusionReason: STALE_NOT_RESOLVED`). |
| Language isolation | ✅ Each publish action is scoped to one language. Single-language Language Services payload. Other languages unaffected. |
| Translation version lineage | ✅ Preserved in `contentSnapshot.tags[].translationVersion` alongside `sourceEnglishVersion`. |
| Stale status after rollback | ✅ Rollback uses historical content snapshot regardless of current STALE state. Advisory flag per tag if tag is currently STALE. No cross-group mutation. |

### 6.4 Cross-Group Issues Found

| Issue ID | Classification | Description |
|---|---|---|
| **CG-G4-01** | Cross-Group Dependency | Group 4 API-0502 (Implicit Dev Publishing) is triggered by Group 2 API-0203 (English copy approval) and Group 3 API-0304 (Translation approval). The triggering conditions must be verified in Group 2 and Group 3 implementation. Currently, Group 4 treats this as an internal system event without changing Group 2 or Group 3 API contracts. |
| **CG-G4-02** | Engineering Dependency | Deprecated tags excluded from MioTranslate publishing bundles may still have their Language Services values preserved via the smart upsert model (ED-LS-01 prerequisite). If Language Services is changed in future to a full-overwrite model, deprecated tag values would be deleted from Language Services. This is a future risk dependency, not a current design conflict. |

---

## 7. Engineering Dependencies

| ID | Dependency | Impact if Not Met | Mitigating Recommendation |
|---|---|---|---|
| **ED-LS-01** | Language Services `bulkImportPages` must perform per-language upsert/merge (not full-overwrite). Sending one language in `values` must preserve all other languages for the same tags. | If full-overwrite: publishing Arabic will corrupt Spanish, Italian, and Turkish values for the same page in Language Services. | Confirm with Language Services team before production. Document in integration contract. Test explicitly with multi-language page state. |
| **ED-LS-02** | **Known Limitation — Deprecated Tag Removal from Language Services.** `bulkImportPages` uses Smart Upsert (Merge) semantics: sending a new bundle for a page adds or overwrites the provided tags but **never removes** tags that are absent from the payload. This means: when a tag is deprecated in MioTranslate and excluded from subsequent publishing bundles, its translated value persists in Language Services indefinitely. Salon teams will continue to be served the deprecated tag's value as long as the MioSalon codebase references it. **This does not block MioTranslate v1 launch** — tag deprecation is rare at launch, and MioTranslate's product model correctly excludes deprecated tags from publishing bundles (FRD §7 Rule 23). MioTranslate's own behaviour is correct and unchanged. **Resolution path:** Engineering must coordinate with the Language Services team to implement a tag-removal or explicit-delete capability in `bulkImportPages` before tag deprecation is used at scale. Options include: (a) a new `removeTags` array parameter in `bulkImportPages`, (b) a separate Language Services delete endpoint, or (c) a full-replace mode. This is an integration requirement — MioTranslate does not redesign its deprecation model to compensate for a Language Services limitation. | Track in integration backlog. Add an ADMIN-visible warning in MioTranslate when tags are deprecated: "Deprecated tags will no longer be included in future Language Services publishes but their previously-published values remain in Language Services until the Language Services team implements a removal mechanism." |
| **ED-LS-03** | **Known Limitation — Rollback Does Not Remove Tags Added After the Target Version.** When a rollback re-publishes a historical content snapshot, `bulkImportPages` re-sends only the tags present in that historical bundle. Tags that were added and published to Language Services after the rollback target version are **not removed** by the rollback — they persist in Language Services storage (same merge semantics as ED-LS-02). For example, if a page had 30 tags at rollback-target version 3, and 5 new tags were added and published in versions 4–6, a rollback to version 3 will re-publish 30 tags but the 5 newer tags remain in Language Services. **This does not block v1 launch.** Resolution depends on the same Language Services removal capability as ED-LS-02. The Deployment History display (API-0406) should note this limitation when a rollback is executed. | Document in the Rollback API (API-0407) response. Consider adding a `rollbackCaveat` field in the API-0407 response when rolled-back bundle count is less than the current published tag count. |
| **ED-LS-04** | **Content Served During Stale Window.** Language Services serves the last successfully published translation value until a new `bulkImportPages` call overwrites it. A translation being flagged `STALE` in MioTranslate does NOT affect Language Services — the previously-published value continues to be served to salon teams throughout the stale review window. No MioTranslate API call is needed to "keep serving" stale content; Language Services serves it by default. This is the correct and expected behaviour per FRD §7 Rule 6. This dependency entry documents the confirmed integration behaviour explicitly to prevent engineering from implementing any Language Services "hold" call during stale flagging. |
| **ED-LS-05** | Language Services API must support idempotent re-submission of the same `pageId` + `tagName` + language content. | Without idempotency: retried publishes may create duplicate records or produce unexpected database state. | Language Services' own upsert model implies natural idempotency for the same content. Confirm explicitly. |
| **ED-LS-06** | The Language Services `domain` value is confirmed to be `"miosalon"` across all three environment endpoints. | If different environments use different domain names, the publishing payload must be parameterized per environment, not hardcoded. | Confirm with Language Services team whether Dev/QA/Production endpoints all accept the same `domain` value. |
| **ED-LS-07** | Each environment (Dev, QA, Production) has its own dedicated Language Services endpoint URL configured in MioTranslate. | If endpoints are misconfigured, `DOMAIN_CONFIGURATION_ERROR` or `ENDPOINT_UNREACHABLE` failures will occur. | Validate all three endpoint configurations during initial deployment. Include endpoint health-check in MioTranslate system settings / ADMIN view. |

---

## 8. Design Decision Log

| # | Decision | Classification | Rationale & Source Tracing |
|---|---|---|---|
| **G4-D01** | Publishing scope locked to 1 Page + 1 Language + 1 Environment per action | Approved Product Rule | FRD §7 Rules 14, 16; FRD §4.9. Fundamental product model — not an API choice. |
| **G4-D02** | `bundleSnapshotHash` as approval-request version lock | API Design Recommendation | Prevents approving one bundle and publishing a newer one. Resolves the reviewer consent / version identity problem explicitly stated in the requirements. |
| **G4-D03** | Approval expiry (24h) | API Design Recommendation | Prevents stale approval requests accumulating in PENDING state indefinitely. Triggers re-evaluation of the bundle if content has changed. |
| **G4-D04** | Self-approval allowed when publisher holds required approver role | Approved Product Rule | UX-10 Step 3 explicitly calls this out. FRD §8 is a role-permission matrix, not an anti-self-approval rule. |
| **G4-D05** | Rollback does not require a separate approval request lifecycle | Approved Product Rule | FRD §8 "Rollback (any environment): SR, FN." UF-11 and UX-11 show SR/FN initiating rollback directly. No separate approval step is documented. Authorization enforced at endpoint level. |
| **G4-D06** | Rollback uses historical `contentSnapshot`, not recomputed from current state | Approved Product Rule | F-12: "Rollback directly restores the selected version." The whole value of rollback is restoring an exact previous state, not recomputing a bundle from current translations. |
| **G4-D07** | STALE translations excluded from publishing bundles | Approved Product Rule | FRD §11 "Stale acknowledgement: A stale translation cannot be promoted as a new version without being resolved." |
| **G4-D08** | Domain validation failure is a distinct `failureClass` from endpoint unreachable | API Design Recommendation | Different recovery path: timeout → retry; domain misconfiguration → engineering investigation. Important operational distinction. |
| **G4-D09** | Evaluation of only the target language in Language Services response | API Design Recommendation | Single-language publishing model requires single-language success evaluation. Another language succeeding is not this action's success. |
| **G4-D10** | Rollback to version containing deprecated tags proceeds with advisory flag | Approved Product Rule | FRD §F-12: "Rollback to a version that contains tags that have since been deprecated: the rollback proceeds. This is a safety measure." |
| **G4-D11** | `ROLLED_BACK` status mutation on prior SUCCESSFUL record | API Design Recommendation | The only permitted mutation on a historical record. Provides accurate operational status visibility in deployment history without deleting or overwriting historical records. |
| **G4-D12** | Implicit Dev Publishing (API-0502) uses same execution path as manual publishing | Approved Product Rule | FRD §17 resolved: "approved content is automatically published to Dev." Same audit trail, same release record, same Language Services call. |

---

## 9. Endpoint Summary

| API ID | Method | Endpoint | Purpose | Authorization |
|---|---|---|---|---|
| **API-0401** | `GET` | `/v1/pages/{pageId}/languages/{language}/environments` | Get Environment Status (all 3 environments) | All roles |
| **API-0402** | `GET` | `/v1/pages/{pageId}/languages/{language}/environments/{environment}/publishing-summary` | Get Pre-Publishing Summary (diff against target env) | All roles |
| **API-0403** | `POST` | `/v1/pages/{pageId}/languages/{language}/environments/{environment}/publishing-approvals` | Request Publishing Approval | Varies by environment |
| **API-0404** | `POST` | `/v1/publishing-approvals/{approvalRequestId}:decide` | Approve or Reject Publishing | Required approver role for target env |
| **API-0405** | `POST` | `/v1/releases/{releaseId}:execute` | Execute Publishing (system-triggered / retry) | System / SR, FN for retry |
| **API-0406** | `GET` | `/v1/pages/{pageId}/languages/{language}/environments/{environment}/releases` | Get Deployment History | All roles |
| **API-0407** | `POST` | `/v1/pages/{pageId}/languages/{language}/environments/{environment}/releases/{targetDeploymentVersion}:rollback` | Execute Rollback | SR, FN |

---

*End of Group 4 API Design Specification.*
