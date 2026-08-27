# MioTranslate API Design — Group 9: Comments, Audit & Export

**Product:** MioTranslate  
**Document Type:** API Design Specification  
**Scope:** Group 9 — Comments, Audit & Export (API-0901 through API-0907)  
**Source Documents:** Approved API List (Domain 9), FRD §4.12 (Comment entity)/F-17 (Audit Trail)/F-18 (Comments)/F-19 (Export)/§7 (Business Rules 20–22)/§8 (Permissions)/§9.5/§9.9/§12 (Notifications)/§13.7 (Activity Report), User Flows UF-15 (Investigate History)/UF-19 (Export), Group 5 (Audit record model, API-0505)  
**Audience:** Backend Engineering, Frontend Engineering, QA  
**Prerequisites:** Group 1 (locked baseline conventions, Page/Tag registry), Group 5 (Audit record model — API-0505 is the write path; API-0904 is the read path)

---

## Document Status & Revision History

| Version | Date | Author | Status | Summary of Changes |
|---|---|---|---|---|
| **v1.0** | Aug 2026 | API Design | Draft | Initial specification — all 7 APIs authored. |
| **v1.1** | Aug 2026 | API Design | Final — Locked | Targeted correction pass: (1) API-0903 audit contradiction removed — one deterministic rule: `COMMENT_RESOLVED` is audited only on `false→true` transition; no-op idempotent calls produce no audit record. (2) Export sub-endpoints reclassified as public sub-endpoints of API-0905 with explicit authorization, error catalogue, and expiry contracts in §3.5.4/§3.5.5 and endpoint summary. (3) Snapshot boundary tightened: export data is captured at the dataset-capture moment; the generated file is internally consistent to that single snapshot; partial reads during concurrent writes are not permitted. (4) Comment scope version-independence made explicit in the Comment model, request body, and cross-group check: comments are scoped to the content surface (not a specific version) and are preserved when new versions are created. (5) API-0902 no-pagination v1 assumption made explicit with its basis and the condition that would require a future API List revision. |
| **v1.2** | Aug 2026 | API Design | Locked | Audit finding resolution pass: (1) EN-G9-05 added — shared enum implementation requirement for audit action catalogue (CG-G9-01) and notification event type catalogue (CG-G9-02) hardened from design observations to explicit implementation obligations: a single shared enum definition must be the single source of truth for both read (Group 9) and write (Group 5) paths; no duplication permitted. (2) FINDING-009 closed — export sub-endpoints were already correctly classified as public sub-endpoints in §3.5.4/§3.5.5 and the endpoint summary; CG-G9-05 documents this explicitly. No API List change is needed at the Group 9 level. |

> **Lock Status:** Group 9 is **locked**. No further changes may be made without a documented revision entry above and traceability to an approved source document.

---

## 1. Group 9 Context

### 1.1 What Group 9 Covers

Group 9 defines the **collaboration, traceability, and data extraction** APIs — the surfaces that let every role discuss content within context (Comments), trace the complete lifecycle of every action (Audit Trail), extract data for external use (Export), and receive and acknowledge system notifications (Notifications).

| API ID | Name | HTTP | URL | Primary Purpose |
|---|---|---|---|---|
| **API-0901** | Add Comment | POST | `/v1/tags/{tagId}/comments` | Attach a discussion comment to a tag |
| **API-0902** | Get Comments | GET | `/v1/tags/{tagId}/comments` | Retrieve all comments for a tag |
| **API-0903** | Resolve Comment | PATCH | `/v1/tags/{tagId}/comments/{commentId}/resolve` | Mark a comment as resolved |
| **API-0904** | Get Audit Trail | GET | `/v1/audit` | Search and retrieve immutable audit records |
| **API-0905** | Export Tag Data | POST | `/v1/exports` | Generate a CSV or Excel export for a page + language |
| **API-0906** | Get Notifications | GET | `/v1/notifications` | Retrieve the current user's pending and recent notifications |
| **API-0907** | Mark Notification as Read | PATCH | `/v1/notifications/read` | Mark one or more notifications as read |

**Critical design properties for all Group 9 APIs:**
- **Cross-cutting read access.** Comments, audit records, and notifications are viewable by all roles. The collaboration and traceability surfaces are not privilege-restricted (FRD §8: "View audit trail — Yes for all roles").
- **Immutability.** Comments cannot be deleted (FRD §7 Rule 22). Audit records cannot be edited, deleted, or archived (FRD §7 Rule 20). These are hard constraints, not soft defaults.
- **No Group 9 writes to audit.** API-0901 (Add Comment) and API-0903 (Resolve Comment) are write operations. They must each produce an audit record via Group 5 API-0505. API-0904 is a read-only consumer of records written by API-0505 — it never writes.
- **Export is a read-only snapshot.** Exported data reflects state at time of export and cannot be re-imported to modify data (FRD F-19).
- **Notifications are per-user.** API-0906 and API-0907 operate on the current authenticated user's notification set only — never another user's.

---

### 1.2 Domain Position and Dependencies

| Data / Service | Owned By | Group 9 Relationship |
|---|---|---|
| Comment records | Group 9 API-0901/API-0902/API-0903 | Group 9 owns the Comment entity. |
| Audit records (write) | Group 5 API-0505 | API-0901 and API-0903 trigger API-0505 to create audit records. |
| Audit records (read) | **Group 9 API-0904** | API-0904 is the only user-facing read path for records created by API-0505. |
| Notification records (dispatch) | Group 5 API-0504 | API-0504 creates notification records. Group 9 API-0906/API-0907 read and acknowledge them. |
| Tag/Page/Translation data (read) | Groups 1, 2, 3 | API-0905 reads from all three to assemble the export payload. |
| Activity timeline (read) | Group 6 API-0605 | API-0904's `activity` query mode provides the underlying data for the activity timeline view (UF-15 ALT-A). API-0605 is a specialized aggregated view, not a conflict. |

---

### 1.3 Baseline Conventions Inheritance

Group 9 inherits all conventions from Group 1 §1 without modification:
- URL base and versioning: `https://{host}/api/v1/...`
- JSON casing: `camelCase` for fields, `SCREAMING_SNAKE_CASE` for enums and error codes
- Response envelopes per Group 1 §1.5
- HTTP status codes per Group 1 §1.6
- Cursor-based pagination (Group 1 §1.7)
- Error model: RFC 9457-inspired `{ "error": { "code", "status", "message", "target", "details" } }`
- Authorization: RBAC per FRD §8

**URL pattern note:** Comments are sub-resources of a tag — `/v1/tags/{tagId}/comments`. The audit trail is a system-wide resource at `/v1/audit`. Exports are created via `/v1/exports`. Notifications are a per-user resource at `/v1/notifications`.

---

### 1.4 RBAC Summary for Group 9

| API | Authorized Roles | Notes |
|---|---|---|
| API-0901 Add Comment | All roles (including DEV) | FRD §8: "Comment — Yes for all roles." |
| API-0902 Get Comments | All roles | FRD §8: read access to comments is universal. |
| API-0903 Resolve Comment | All roles | FRD §8 does not restrict comment resolution. Any user may resolve. |
| API-0904 Get Audit Trail | All roles | FRD §8: "View audit trail — Yes for all roles." |
| API-0905 Export Tag Data | PM, LR, SR, FN, ADMIN | FRD §8: "Export — No for Developer. Yes for PM, LR, SR, FN, ADMIN." |
| API-0906 Get Notifications | All roles | Notifications are per-user and role-agnostic. |
| API-0907 Mark Notification as Read | All roles | All users can manage their own notifications. |

---

## 2. Resource Models

### 2.1 Comment Record

```json
{
  "commentId": "cmt_20260821_143500_abc123",
  "tagId": "QUICK_1",
  "scope": {
    "type": "LANGUAGE",
    "languageCode": "ar"
  },
  "author": {
    "userId": "user:pm-arjun",
    "displayName": "Arjun Mehta"
  },
  "text": "The Arabic word here feels too formal for a dashboard label. Please consider a colloquial form.",
  "resolved": false,
  "resolvedBy": null,
  "resolvedAt": null,
  "createdAt": "2026-08-21T14:35:00Z"
}
```

| Field | Type | Description |
|---|---|---|
| `commentId` | string | Unique comment identifier. |
| `tagId` | string | The tag this comment is attached to. |
| `scope` | object | What the comment is scoped to within the tag. |
| `scope.type` | enum | `ENGLISH` (comment on the tag's English content surface) or `LANGUAGE` (comment on the tag's translation surface for a specific language). Scope is at the surface level, not at the version level — see version independence note below. |
| `scope.languageCode` | string \| null | Present when `scope.type` is `LANGUAGE`. The language the comment is scoped to (e.g., `ar`). Null when `scope.type` is `ENGLISH`. |
| `author.userId` | string | User ID of the comment author. |
| `author.displayName` | string | Display name at time of comment creation. |
| `text` | string | The comment body. Non-empty. Max 2,000 chars. |
| `resolved` | boolean | `false` = open; `true` = resolved. |
| `resolvedBy` | object \| null | `{ userId, displayName }` of the user who resolved the comment. Null if not resolved. |
| `resolvedAt` | string (ISO 8601) \| null | Timestamp of resolution. Null if not resolved. |
| `createdAt` | string (ISO 8601) | When the comment was created. |

> **No deletion.** Comments are permanent records (FRD §7 Rule 22: "Comments cannot be deleted"). Once created, a comment exists forever. Resolved comments remain visible with `resolved: true`.

> **Version independence.** Comments are scoped to the Tag's English content surface (`ENGLISH`) or the Tag+Language translation surface (`LANGUAGE`) — not to a specific English copy version or Translation version. When a new English version or Translation version is created, all existing comments on that surface are preserved unchanged and remain visible in the discussion history. The FRD §4.12 Comment entity has no version attribute and no approved source document requires version binding.

---

### 2.2 Audit Record (Read Model — API-0904)

This is the read projection of the audit record created by Group 5 API-0505. The full write model is defined in Group 5 §2.1. API-0904 returns the same structure.

```json
{
  "auditRecordId": "aud_20260821_143500_abc123",
  "action": "TRANSLATION_APPROVED",
  "subject": {
    "type": "TRANSLATION",
    "tagId": "QUICK_1",
    "pageId": "QUICK",
    "language": "ar",
    "translationVersion": 2
  },
  "performedBy": {
    "userId": "user:lr-ahmed",
    "displayName": "Ahmed Al-Rashidi"
  },
  "performedAt": "2026-08-21T14:35:00Z",
  "details": "Translation approved after manual edit.",
  "beforeValue": "بيع",
  "afterValue": "بيع سريع",
  "correlationId": "req_abc123xyz"
}
```

See Group 5 §2.1.1 for the complete audit action catalogue. API-0904 reads but never modifies these records.

---

### 2.3 Notification Record

```json
{
  "notificationId": "ntf_20260821_150000_xyz789",
  "eventType": "TRANSLATION_READY_FOR_REVIEW",
  "targetUserId": "user:lr-ahmed",
  "message": "A new Arabic translation for QUICK_1 is ready for your review.",
  "contextLink": {
    "tagId": "QUICK_1",
    "pageId": "QUICK",
    "language": "ar"
  },
  "read": false,
  "createdAt": "2026-08-21T15:00:00Z",
  "readAt": null
}
```

| Field | Type | Description |
|---|---|---|
| `notificationId` | string | Unique notification identifier. |
| `eventType` | enum | The event that triggered this notification. See §2.3.1 for the full event catalogue. |
| `targetUserId` | string | The user this notification is addressed to. API-0906 only returns notifications for the authenticated user. |
| `message` | string | Human-readable notification text. |
| `contextLink` | object | Optional deep-link context. May include `tagId`, `pageId`, `language`, `environment` depending on event type. Null for system-level events. |
| `read` | boolean | `false` = unread; `true` = acknowledged via API-0907. |
| `createdAt` | string (ISO 8601) | When the notification was dispatched by API-0504. |
| `readAt` | string (ISO 8601) \| null | When the user acknowledged it. Null if unread. |

---

#### 2.3.1 Notification Event Catalogue

Sourced from FRD §12. These event types correspond to notifications dispatched by Group 5 API-0504.

| Event Type | Who Is Notified | Trigger |
|---|---|---|
| `PAGE_OR_TAG_CREATED` | PM, QA | New page or tag registered |
| `ENGLISH_COPY_SUBMITTED` | Assigned Reviewer | English copy submitted for review |
| `ENGLISH_COPY_APPROVED` | Author (PM/QA) | English copy approved |
| `ENGLISH_COPY_REJECTED` | Author (PM/QA) | English copy rejected or returned |
| `TRANSLATION_READY_FOR_REVIEW` | Localization Reviewer | AI translation completed; ready for review |
| `TRANSLATION_APPROVED` | PM | Translation approved; ready for publishing |
| `TRANSLATION_STALE_FLAGGED` | All LRs for affected languages | English copy changed; translations may need updating |
| `ITEM_ESCALATED_TO_FOUNDER` | Founder | Copy escalated for Founder review |
| `PAGE_BUNDLE_PUBLISHED_PRODUCTION` | PM, Support Reviewer | Page bundle published to Production |
| `ROLLBACK_INITIATED` | PM, QA, Support Reviewer | A previous version has been restored |
| `PUBLISHING_FAILED` | PM, Administrator | Publishing attempt failed; investigation required |

---

### 2.4 Export Record

The export is returned as a file download — the API response carries a file reference for retrieval. The export itself is not a persisted MioTranslate entity; it is generated on demand and is not stored.

```json
{
  "exportId": "exp_20260821_160000_xyz999",
  "pageId": "QUICK",
  "languageCode": "ar",
  "format": "CSV",
  "status": "READY",
  "rowCount": 42,
  "generatedAt": "2026-08-21T16:00:05Z",
  "downloadUrl": "/v1/exports/exp_20260821_160000_xyz999/download",
  "expiresAt": "2026-08-21T17:00:05Z"
}
```

| Field | Type | Description |
|---|---|---|
| `exportId` | string | Unique export job identifier. |
| `pageId` | string | The page exported. |
| `languageCode` | string | The language exported. |
| `format` | enum | `CSV` or `EXCEL`. |
| `status` | enum | `GENERATING` (async, large page), `READY` (download available), `FAILED`. |
| `rowCount` | integer | Number of tag rows in the export. |
| `generatedAt` | string (ISO 8601) | When the export file was completed. |
| `downloadUrl` | string | Relative URL to retrieve the file. |
| `expiresAt` | string (ISO 8601) | When the download link expires. Default: 1 hour after generation. |

---

## 3. API Specifications

### API-0901: Add Comment

> **Source:** FRD §4.12, F-18, §7 Rule 22, §8, IA §6.1 (tag detail), API List API-0901. User Flows UF-03, UF-06, UF-09 (cross-cutting).

**Endpoint:**
```
POST /v1/tags/{tagId}/comments
```

**Purpose:** Attach a discussion comment to a tag, scoped to either the English copy or a specific language's translation. Comments are the in-product collaboration mechanism — they let any team member flag concerns, leave context, or ask questions directly on the content being reviewed. Comments are permanent and visible to all users. They cannot be deleted.

**Authorization:** All roles.

---

#### 3.1.1 Path Parameters

| Parameter | Type | Description |
|---|---|---|
| `tagId` | string | The tag to attach the comment to. |

#### 3.1.2 Request Body

```json
{
  "scope": {
    "type": "LANGUAGE",
    "languageCode": "ar"
  },
  "text": "The Arabic word here feels too formal for a dashboard label. Please consider a colloquial form."
}
```

| Field | Type | Required | Description |
|---|---|---|---|
| `scope.type` | enum | Yes | `ENGLISH` — comment on the tag's English content surface (not version-specific; applies to all English versions of this tag). `LANGUAGE` — comment on the tag's translation surface for a specific language (not version-specific; applies to all Translation versions for this language). |
| `scope.languageCode` | string | Conditional | Required when `scope.type` is `LANGUAGE`. Must be a valid, existing language code (ACTIVE or INACTIVE). |
| `text` | string | Yes | Comment body. Min 1 char, max 2,000 chars. Whitespace-only text is rejected. |

---

#### 3.1.3 Response — 201 Created

```json
{
  "data": {
    "commentId": "cmt_20260821_143500_abc123",
    "tagId": "QUICK_1",
    "scope": {
      "type": "LANGUAGE",
      "languageCode": "ar"
    },
    "author": {
      "userId": "user:pm-arjun",
      "displayName": "Arjun Mehta"
    },
    "text": "The Arabic word here feels too formal for a dashboard label. Please consider a colloquial form.",
    "resolved": false,
    "resolvedBy": null,
    "resolvedAt": null,
    "createdAt": "2026-08-21T14:35:00Z"
  }
}
```

---

#### 3.1.4 Business Rules

| Rule | Source | Enforcement |
|---|---|---|
| All roles may add comments, including DEV | FRD §8: "Comment — Yes for all roles" | No role restriction. |
| `text` must not be empty or whitespace-only | API List: "Empty comment text → validation error" | Returns 400 `REQUIRED` on `text`. |
| `scope.languageCode` must be a known language | API Design | If `scope.type` is `LANGUAGE` and the code is unknown, return 422 `INVALID_VALUE`. Accepts INACTIVE language codes — commenting on historical content for a deactivated language is valid. |
| Tag must exist | API Design | If `tagId` not found, return 404 `TAG_NOT_FOUND`. |
| Tag may be Deprecated | API Design | Comments on deprecated tags are permitted — useful for investigation and historical review. |
| Comments are permanent — no deletion | FRD §7 Rule 22 | No DELETE endpoint exists for comments. |
| Audit record created | FRD §7 Rule 20, F-17 | `COMMENT_ADDED` audit record via Group 5 API-0505. |
| Comments are included in the activity timeline | FRD F-18 | API-0503 / API-0504 are not triggered — comments appear in the timeline via the audit record. API-0605 (Activity Timeline in Group 6) reads from the audit log. |

---

#### 3.1.5 Error Catalogue

| HTTP | Code | Condition |
|---|---|---|
| 400 | `REQUIRED` on `text` | Text field is missing or empty/whitespace. |
| 400 | `REQUIRED` on `scope.type` | Scope type not provided. |
| 400 | `REQUIRED` on `scope.languageCode` | `scope.type` is `LANGUAGE` but `languageCode` is missing. |
| 404 | `TAG_NOT_FOUND` | `tagId` does not exist in MioTranslate. |
| 422 | `INVALID_VALUE` on `scope.type` | Not `ENGLISH` or `LANGUAGE`. |
| 422 | `INVALID_VALUE` on `scope.languageCode` | Not a known language code in MioTranslate. |

---

### API-0902: Get Comments

> **Source:** FRD §4.12, F-18, §8, API List API-0902. User Flows UF-13, UF-15.

**Endpoint:**
```
GET /v1/tags/{tagId}/comments
```

**Purpose:** Return all comments for a tag, optionally filtered by scope. Used in the tag detail view to show the full discussion history for a piece of content. Both open and resolved comments are returned — resolved comments are part of the permanent record.

**Authorization:** All roles.

---

#### 3.2.1 Path Parameters

| Parameter | Type | Description |
|---|---|---|
| `tagId` | string | The tag whose comments to retrieve. |

#### 3.2.2 Query Parameters

| Parameter | Type | Default | Description |
|---|---|---|---|
| `scope` | enum | (all) | Filter by comment scope: `ENGLISH` (only English copy comments) or `LANGUAGE` (only language-scoped comments). Omit to return all scopes. |
| `languageCode` | string | (all) | Filter by specific language. Only applies when `scope=LANGUAGE`. Returns only comments scoped to that language. |
| `resolved` | boolean | (all) | `true` — return only resolved comments. `false` — return only open comments. Omit to return both. |
| `sortBy` | enum | `createdAtAsc` | `createdAtAsc` (chronological, default — most natural for conversation reading), `createdAtDesc`. |

---

#### 3.2.3 Response — 200 OK

```json
{
  "data": {
    "tagId": "QUICK_1",
    "totalComments": 3,
    "items": [
      {
        "commentId": "cmt_20260819_093000_aaa111",
        "tagId": "QUICK_1",
        "scope": {
          "type": "ENGLISH",
          "languageCode": null
        },
        "author": {
          "userId": "user:qa-priya",
          "displayName": "Priya Nair"
        },
        "text": "Should this say 'Sale' or 'Quick Sale'? The product copy seems inconsistent.",
        "resolved": true,
        "resolvedBy": {
          "userId": "user:pm-arjun",
          "displayName": "Arjun Mehta"
        },
        "resolvedAt": "2026-08-19T11:00:00Z",
        "createdAt": "2026-08-19T09:30:00Z"
      },
      {
        "commentId": "cmt_20260821_143500_abc123",
        "tagId": "QUICK_1",
        "scope": {
          "type": "LANGUAGE",
          "languageCode": "ar"
        },
        "author": {
          "userId": "user:pm-arjun",
          "displayName": "Arjun Mehta"
        },
        "text": "The Arabic word here feels too formal for a dashboard label.",
        "resolved": false,
        "resolvedBy": null,
        "resolvedAt": null,
        "createdAt": "2026-08-21T14:35:00Z"
      }
    ]
  }
}
```

> **Note:** `totalComments` reflects the count matching the applied filters, not the total for the tag if filters are used.

---

#### 3.2.4 Business Rules

| Rule | Source | Enforcement |
|---|---|---|
| All roles may retrieve comments | FRD §8 | No role restriction. |
| Both open and resolved comments returned by default | API Design | Resolution is a flag — resolved comments are not hidden. They remain part of the record. |
| No pagination in v1 | API Design (v1 assumption) | Comments are scoped to a single tag. Per-tag comment volume is inherently bounded: a tag represents one piece of UI copy and team discussion on a single copy item is a finite, human-scale thread. On this basis, v1 returns all comments in a single response with no `pageToken`. **This assumption must be revisited if the product introduces threaded sub-comments, external imports that could bulk-create comments, or if operational data shows per-tag volumes exceeding ~500 items.** Adding pagination is a breaking contract change and requires a new API List revision — it cannot be added silently. |
| Empty list is not an error | API List: "No comments → empty list" | `totalComments: 0`, `items: []`. |
| Deprecated tag comments available | API Design | Comments on deprecated tags remain accessible for investigation. |

---

#### 3.2.5 Error Catalogue

| HTTP | Code | Condition |
|---|---|---|
| 404 | `TAG_NOT_FOUND` | `tagId` does not exist in MioTranslate. |
| 422 | `INVALID_VALUE` on `scope` | Not `ENGLISH` or `LANGUAGE`. |
| 422 | `INVALID_VALUE` on `resolved` | Not a valid boolean. |

---

### API-0903: Resolve Comment

> **Source:** FRD §4.12, F-18 ("Comments can be marked as resolved but not deleted"), §8, API List API-0903. User Flows UF-03, UF-06.

**Endpoint:**
```
PATCH /v1/tags/{tagId}/comments/{commentId}/resolve
```

**Purpose:** Mark a comment as resolved. Resolution signals that the discussion thread has been addressed. The comment remains visible and permanent — it is never deleted. Idempotent: resolving an already-resolved comment returns 200 with no change.

**Authorization:** All roles.

---

#### 3.3.1 Path Parameters

| Parameter | Type | Description |
|---|---|---|
| `tagId` | string | The tag the comment belongs to. |
| `commentId` | string | The comment to resolve. |

#### 3.3.2 Request Body

None required. The action is fully determined by the path.

---

#### 3.3.3 Response — 200 OK

```json
{
  "data": {
    "commentId": "cmt_20260821_143500_abc123",
    "tagId": "QUICK_1",
    "resolved": true,
    "resolvedBy": {
      "userId": "user:lr-ahmed",
      "displayName": "Ahmed Al-Rashidi"
    },
    "resolvedAt": "2026-08-22T09:00:00Z"
  }
}
```

---

#### 3.3.4 Business Rules

| Rule | Source | Enforcement |
|---|---|---|
| All roles may resolve comments | FRD §8: "Comment — Yes for all roles" | No role restriction on who resolves a comment. Any user may resolve any open comment. |
| Resolution is permanent — no un-resolve | FRD F-18 | Once resolved, a comment cannot be reopened. There is no un-resolve endpoint in the approved API List. |
| Idempotent — already-resolved comment returns 200 | API List: "Already resolved → no-op" | Returns 200 with the current resolved state. Not an error. No state change occurs. |
| Comment is not deleted | FRD §7 Rule 22 | The comment record is preserved. `resolved: true` is the only change. |
| `COMMENT_RESOLVED` audit record — on state transition only | FRD §7 Rule 20 | A `COMMENT_RESOLVED` audit record is created via Group 5 API-0505 **if and only if** the comment transitions from `resolved=false` to `resolved=true` in this call. **If the comment is already resolved, this is a no-op and no audit record is created** — there is no state change to record. `beforeValue: { resolved: false }`, `afterValue: { resolved: true }`. |

---

#### 3.3.5 Error Catalogue

| HTTP | Code | Condition |
|---|---|---|
| 404 | `TAG_NOT_FOUND` | `tagId` does not exist in MioTranslate. |
| 404 | `COMMENT_NOT_FOUND` | `commentId` does not exist or does not belong to the specified `tagId`. |

---

### API-0904: Get Audit Trail

> **Source:** FRD F-17, §7 Rules 20–21, §13.7 (Activity Report), §8, API List API-0904. User Flow UF-15 (Investigate History, including ALT-A and ALT-B).

**Endpoint:**
```
GET /v1/audit
```

**Purpose:** Search and retrieve immutable audit records for investigation, accountability, and compliance. The audit trail is the complete chronological record of every action taken in MioTranslate. It serves multiple UF-15 investigation modes: single-tag investigation, cross-tag audit search, per-user activity reports (§13.7), and deployment history queries.

**Authorization:** All roles (FRD §8: "View audit trail — Yes for all roles").

---

#### 3.4.1 Query Parameters

| Parameter | Type | Default | Description |
|---|---|---|---|
| `tagId` | string | (all) | Filter to a specific tag. |
| `pageId` | string | (all) | Filter to all records for a page. |
| `languageCode` | string | (all) | Filter to records for a specific language. |
| `performedBy` | string | (all) | Filter by user ID. Supports ALT-B (per-user activity report, FRD §13.7). |
| `action` | enum | (all) | Filter by audit action type. See Group 5 §2.1.1 for the full action catalogue. Multiple values supported as comma-separated list. |
| `dateFrom` | string (ISO 8601) | (none) | Start of date range (inclusive). |
| `dateTo` | string (ISO 8601) | (none) | End of date range (inclusive). |
| `pageSize` | integer | 50 | Max 200. |
| `pageToken` | string | (none) | Cursor for pagination. |
| `sortBy` | enum | `performedAtDesc` | `performedAtDesc` (most recent first — default for investigation), `performedAtAsc` (chronological). |

---

#### 3.4.2 Response — 200 OK

```json
{
  "data": {
    "totalMatchingRecords": 142,
    "items": [
      {
        "auditRecordId": "aud_20260821_143500_abc123",
        "action": "TRANSLATION_APPROVED",
        "subject": {
          "type": "TRANSLATION",
          "tagId": "QUICK_1",
          "pageId": "QUICK",
          "language": "ar",
          "translationVersion": 2
        },
        "performedBy": {
          "userId": "user:lr-ahmed",
          "displayName": "Ahmed Al-Rashidi"
        },
        "performedAt": "2026-08-21T14:35:00Z",
        "details": "Translation approved after manual edit.",
        "beforeValue": "بيع",
        "afterValue": "بيع سريع",
        "correlationId": "req_abc123xyz"
      }
    ]
  },
  "pagination": {
    "nextPageToken": "eyJsYXN0SWQiOiJhdWRfMjAyNjA4MjFfMTQzNTAwX2FiYzEyMyJ9",
    "pageSize": 50
  }
}
```

---

#### 3.4.3 Business Rules

| Rule | Source | Enforcement |
|---|---|---|
| All roles may query the audit trail | FRD §8 | No role restriction. |
| Audit records are immutable — read only | FRD §7 Rule 20: "Audit records cannot be edited, deleted, or archived" | GET only. No write path exists in this API. |
| All filters are optional and combinable | API List: "Searchable by: user, date range, action type, page, tag, language" | Any combination of filters is valid. No filter returns all records. |
| No matching records → empty result, not error | API List: "No matching records → empty result" | `totalMatchingRecords: 0`, `items: []`. |
| Results are paginated | API Design | Audit trail can be large. Cursor pagination applies. `pageSize` max 200. |
| `totalMatchingRecords` is a best-effort estimate | API Design | For large result sets, the count is a server-determined estimate. Exact counts are not guaranteed for performance reasons. |
| `performedBy` filter enables Activity Report | FRD §13.7 | Filtering by `performedBy` + `dateFrom`/`dateTo` produces the per-user activity report described in UF-15 ALT-B and FRD §13.7. No separate API needed. |
| Multiple `action` values via comma-separated string | API Design | `action=TRANSLATION_APPROVED,TRANSLATION_REJECTED` filters to either action type. |

---

#### 3.4.4 Error Catalogue

| HTTP | Code | Condition |
|---|---|---|
| 422 | `INVALID_VALUE` on `action` | One or more action values in the list are not valid audit action types. |
| 422 | `INVALID_VALUE` on `dateFrom` or `dateTo` | Not a valid ISO 8601 date. |
| 422 | `INVALID_RANGE` on date range | `dateTo` is before `dateFrom`. |

---

### API-0905: Export Tag Data

> **Source:** FRD F-19, §9.9, §8, API List API-0905. User Flow UF-19.

**Endpoint:**
```
POST /v1/exports
```

**Purpose:** Generate a read-only export file (CSV or Excel) for a selected page and language. The export represents the data state at the moment the export dataset is actually captured (the point at which data is read from the database to generate the file). For synchronous exports this is effectively the POST request time. For async exports this capture moment may be seconds to minutes after the POST request. The generated file is internally consistent to that single captured snapshot — no row will reflect a state from before or after the capture moment. The file cannot be re-imported to modify data. Large exports are generated asynchronously and made available via a download URL.

**Authorization:** PM, LR, SR, FN, ADMIN. Developer role is excluded (FRD §8: "Export — No for Developer").

---

#### 3.5.1 Request Body

```json
{
  "pageId": "QUICK",
  "languageCode": "ar",
  "format": "CSV"
}
```

| Field | Type | Required | Description |
|---|---|---|---|
| `pageId` | string | Yes | The page to export. Must be an existing page (Active or Deprecated). |
| `languageCode` | string | Yes | The language to export translations for. Must be an existing language code (ACTIVE or INACTIVE). |
| `format` | enum | Yes | `CSV` or `EXCEL`. |

---

#### 3.5.2 Response — 202 Accepted (Generating) or 200 OK (Ready)

For small pages (≤ 100 tags): may return 200 with the export ready immediately.  
For large pages: returns 202 with the export `status: GENERATING`.

**202 Accepted:**
```json
{
  "data": {
    "exportId": "exp_20260821_160000_xyz999",
    "pageId": "QUICK",
    "languageCode": "ar",
    "format": "CSV",
    "status": "GENERATING",
    "rowCount": null,
    "generatedAt": null,
    "downloadUrl": null,
    "expiresAt": null
  }
}
```

**200 OK (when generated synchronously):**
```json
{
  "data": {
    "exportId": "exp_20260821_160000_xyz999",
    "pageId": "QUICK",
    "languageCode": "ar",
    "format": "CSV",
    "status": "READY",
    "rowCount": 42,
    "generatedAt": "2026-08-21T16:00:05Z",
    "downloadUrl": "/v1/exports/exp_20260821_160000_xyz999/download",
    "expiresAt": "2026-08-21T17:00:05Z"
  }
}
```

---

#### 3.5.3 Export File Schema

Each row in the export represents one tag. Columns:

| Column | Content | Source |
|---|---|---|
| `Tag ID` | Tag ID (e.g., `QUICK_1`) | Group 1 Tag entity |
| `English Copy` | The current approved English copy text | Group 2 English copy (approved version) |
| `Translation` | The current approved translation text for the selected language | Group 3 Translation (approved version) |
| `Translation Status` | The current translation state: `NO_TRANSLATION`, `DRAFT`, `PENDING_REVIEW`, `APPROVED`, `STALE` | Group 3 Translation state |
| `Confidence Score` | AI confidence score (0–100). Empty if no AI translation was generated (manual entry or no translation). | Group 3 Translation |

> **Tags without a translation:** A row is still included with an empty `Translation` column and `Status: NO_TRANSLATION`. The export is a complete picture of the page's tag inventory for the language.  
> **Tags with no approved English copy:** The `English Copy` column reflects the latest approved version. If no approved English version exists, the column is empty (tag is in authoring state).

---

#### 3.5.4 Export Status Check — Public Sub-Endpoint of API-0905

```
GET /v1/exports/{exportId}
```

**Classification:** Public sub-endpoint of API-0905. Part of API-0905's approved contract. Required for the async export polling flow. Must be documented in OpenAPI/API documentation alongside the POST.

**Authorization:** PM, LR, SR, FN, ADMIN. DEV role excluded (same as POST).

Returns the Export Record (same schema as the POST response). The client polls this endpoint after receiving a 202 until `status` transitions to `READY` or `FAILED`.

**Error Catalogue:**

| HTTP | Code | Condition |
|---|---|---|
| 403 | `FORBIDDEN` | Caller holds only DEV role. |
| 404 | `EXPORT_NOT_FOUND` | `exportId` does not exist or the export has expired and been deleted. The client must initiate a new export. |

---

#### 3.5.5 Export Download — Public Sub-Endpoint of API-0905

```
GET /v1/exports/{exportId}/download
```

**Classification:** Public sub-endpoint of API-0905. Part of API-0905's approved contract. Must be documented in OpenAPI/API documentation alongside the POST.

**Authorization:** PM, LR, SR, FN, ADMIN. DEV role excluded (same as POST).

Returns the file as a binary download with appropriate `Content-Type` headers:
- CSV: `Content-Type: text/csv; charset=utf-8`
- Excel: `Content-Type: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`

The download link is valid for 1 hour from `generatedAt` (`expiresAt`). After expiry, the generated file is deleted and a new export must be initiated via `POST /v1/exports`.

**Error Catalogue:**

| HTTP | Code | Condition |
|---|---|---|
| 403 | `FORBIDDEN` | Caller holds only DEV role. |
| 404 | `EXPORT_NOT_FOUND` | `exportId` does not exist. |
| 409 | `EXPORT_NOT_READY` | The export exists but `status` is still `GENERATING`. Poll `GET /v1/exports/{exportId}` until `READY`. |
| 410 | `EXPORT_EXPIRED` | The export existed but `expiresAt` has passed and the file has been deleted. Initiate a new export. |

---

#### 3.5.6 Business Rules

| Rule | Source | Enforcement |
|---|---|---|
| Restricted to PM, LR, SR, FN, ADMIN | FRD §8: "Export — No for Developer" | 403 for DEV role. Applies to POST and all sub-endpoints. |
| Snapshot boundary: dataset-capture moment | FRD F-19: "Exported data reflects the current state at the time of export" | The export reflects the data state at the moment the export job reads the data from the database (the dataset-capture moment). For sync exports this is the POST request time. For async exports it may be seconds to minutes later. **The generated file must be internally consistent to that single captured moment** — no row may reflect a state from a different point in time. The export job must use a consistent read (e.g., a database snapshot, read transaction, or equivalent isolation) to prevent partial reads during concurrent writes. |
| Export is read-only | FRD F-19: "Read-only snapshots — cannot be re-imported" | No import endpoint exists. No re-import path is supported. |
| Empty export (no tags on page) is valid | API List: "No tags on page → empty export" | `rowCount: 0`. An empty CSV or Excel file with only the header row is returned. |
| Exports are ephemeral | API Design | Export files are available for 1 hour after generation, then deleted. They are not persisted MioTranslate entities and are not audit-relevant. |
| No audit record for export | API Design | Export is a read-equivalent operation. Per Group 5 audit rules, read-equivalent operations do not produce audit records. |
| `pageId` and `languageCode` must be valid | API Design | `pageId` not found → 404 `PAGE_NOT_FOUND`. Unknown `languageCode` → 422 `INVALID_VALUE`. Deprecated pages and inactive languages are acceptable — exporting historical data is a valid use case. |

---

#### 3.5.7 Error Catalogue

| HTTP | Code | Condition |
|---|---|---|
| 400 | `REQUIRED` on `pageId` | Field missing. |
| 400 | `REQUIRED` on `languageCode` | Field missing. |
| 400 | `REQUIRED` on `format` | Field missing. |
| 400 | `INVALID_VALUE` on `format` | Not `CSV` or `EXCEL`. |
| 403 | `FORBIDDEN` | Caller holds only DEV role. |
| 404 | `PAGE_NOT_FOUND` | `pageId` does not exist. |
| 422 | `INVALID_VALUE` on `languageCode` | Not a known language code in MioTranslate. |

---

### API-0906: Get Notifications

> **Source:** FRD §12, API List API-0906. Cross-cutting (all flows). Notifications dispatched by Group 5 API-0504.

**Endpoint:**
```
GET /v1/notifications
```

**Purpose:** Retrieve pending and recent notifications for the current authenticated user. Notifications are dispatched by Group 5 API-0504 in response to significant events (FRD §12). This API provides the read surface — the notification bell/tray in the product UI. Supports filtering by read status so the UI can surface unread notifications prominently.

**Authorization:** All roles.

---

#### 3.6.1 Query Parameters

| Parameter | Type | Default | Description |
|---|---|---|---|
| `read` | boolean | (all) | `false` — return only unread notifications. `true` — return only read notifications. Omit to return all. |
| `eventType` | enum | (all) | Filter by event type. See §2.3.1 for the catalogue. |
| `sortBy` | enum | `createdAtDesc` | `createdAtDesc` (most recent first — default). |
| `pageSize` | integer | 20 | Max 100. |
| `pageToken` | string | (none) | Cursor for pagination. |

---

#### 3.6.2 Response — 200 OK

```json
{
  "data": {
    "unreadCount": 3,
    "items": [
      {
        "notificationId": "ntf_20260821_150000_xyz789",
        "eventType": "TRANSLATION_READY_FOR_REVIEW",
        "message": "A new Arabic translation for QUICK_1 is ready for your review.",
        "contextLink": {
          "tagId": "QUICK_1",
          "pageId": "QUICK",
          "language": "ar"
        },
        "read": false,
        "createdAt": "2026-08-21T15:00:00Z",
        "readAt": null
      }
    ]
  },
  "pagination": {
    "nextPageToken": null,
    "pageSize": 20
  }
}
```

| Field | Description |
|---|---|
| `unreadCount` | Total count of unread notifications for this user — regardless of pagination or filters. Always reflects the live unread count. Useful for the notification badge. |
| `items` | The page of notifications matching the query. |

---

#### 3.6.3 Business Rules

| Rule | Source | Enforcement |
|---|---|---|
| Returns only the current user's notifications | API Design | Determined by the authenticated user's identity. Cannot query another user's notifications. |
| No notifications → empty list | API List: "No notifications → empty list" | `unreadCount: 0`, `items: []`. |
| `unreadCount` always reflects total unread | API Design | Even when `read=true` filter is applied (showing only read items), `unreadCount` still shows the total unread count for the badge. |
| Notifications are not deleted by reading | API Design | Marking as read (API-0907) sets `read: true`; the record is preserved. |

---

#### 3.6.4 Error Catalogue

| HTTP | Code | Condition |
|---|---|---|
| 422 | `INVALID_VALUE` on `eventType` | Not a valid event type from the catalogue. |
| 422 | `INVALID_VALUE` on `read` | Not a valid boolean. |

---

### API-0907: Mark Notification as Read

> **Source:** FRD §12 (implied — notifications require an acknowledgement mechanism), API List API-0907.

**Endpoint:**
```
PATCH /v1/notifications/read
```

**Purpose:** Mark one or more notifications as read. Supports batch acknowledgement so the user can clear multiple notifications (e.g., "Mark all as read") in a single call. The notification records are preserved after being marked read — they are not deleted. Idempotent: marking an already-read notification as read has no effect.

**Authorization:** All roles.

---

#### 3.7.1 Request Body

```json
{
  "notificationIds": ["ntf_20260821_150000_xyz789", "ntf_20260821_160000_abc111"],
  "markAll": false
}
```

| Field | Type | Required | Description |
|---|---|---|---|
| `notificationIds` | array\<string\> | Conditional | List of notification IDs to mark as read. Required unless `markAll` is `true`. |
| `markAll` | boolean | No | If `true`, marks all unread notifications for the current user as read. Overrides `notificationIds`. Default: `false`. |

---

#### 3.7.2 Response — 200 OK

```json
{
  "data": {
    "markedCount": 2,
    "remainingUnreadCount": 1
  }
}
```

| Field | Description |
|---|---|
| `markedCount` | Number of notifications transitioned from unread to read in this call. Notifications already read are not counted. |
| `remainingUnreadCount` | Total unread notifications for this user after this call. |

---

#### 3.7.3 Business Rules

| Rule | Source | Enforcement |
|---|---|---|
| Operates only on the current user's notifications | API Design | Cannot mark another user's notifications as read. |
| Idempotent | API List: edge cases state "None" | Marking an already-read notification has no effect. `markedCount` reflects only newly-transitioned notifications. |
| `markAll: true` marks all unread for the current user | API Design | A convenience for "clear all notifications". Operates on the authenticated user's unread set only. |
| Neither `notificationIds` nor `markAll` provided — error | API Design | Returns 400 `REQUIRED`. |
| Unknown notification IDs in `notificationIds` | API Design | Unknown or other-user IDs are silently ignored — not an error. Only the caller's own notifications are updated. |
| No audit record | API Design | Notification reads are user-preference actions, not governance-relevant write operations. Per Group 5 rules, user-preference operations are not audited. |

---

#### 3.7.4 Error Catalogue

| HTTP | Code | Condition |
|---|---|---|
| 400 | `REQUIRED` | Neither `notificationIds` nor `markAll: true` was provided. |
| 400 | `INVALID_VALUE` on `notificationIds` | Provided array is empty (must have at least one ID if `markAll` is false). |

---

## 4. System Relationships

### 4.1 API-0901/0903 → API-0505 (Audit Record)

Both write operations in Group 9 produce immutable audit records:

| Source API | Audit Action | Condition | Before/After |
|---|---|---|---|
| API-0901 (Add Comment) | `COMMENT_ADDED` | Always — every new comment creates an audit record. | `beforeValue: null`, `afterValue: comment text (truncated to 200 chars in audit for readability)` |
| API-0903 (Resolve Comment) | `COMMENT_RESOLVED` | **Only on state transition from `resolved=false` to `resolved=true`.** No-op idempotent calls (already-resolved comment) produce no audit record. | `beforeValue: { resolved: false }`, `afterValue: { resolved: true }` |

---

### 4.2 API-0904 ↔ API-0505 (Read/Write Split)

```
API-0505 (Group 5) ──── writes ────► Audit Record Store
                                              │
API-0904 (Group 9) ──── reads ────◄──────────┘
```

API-0904 is the **only user-facing read path** for audit records. The audit record store is write-through from API-0505 and read-only from API-0904.

---

### 4.3 API-0906/0907 ↔ API-0504 (Read/Acknowledge Split)

```
API-0504 (Group 5) ──── dispatches ────► Notification Store
                                                │
API-0906 (Group 9) ──── reads ─────◄───────────┘
API-0907 (Group 9) ──── updates read flag ─────┘
```

---

### 4.4 API-0905 Data Sources

The export assembles data from three domains in a single consistent read at the dataset-capture moment:

```
API-0905 Export Request → dataset-capture moment (consistent read)
         │
         ├── Group 1 API-0103/0104 → tag list for the page
         ├── Group 2 API-0204      → approved English copy per tag
         └── Group 3 API-0308      → approved translation per tag (selected language)
                                     + translation status + confidence score
```

No data is modified. The data read must be consistent — all rows in the export file must reflect the same point-in-time state. The export job must use an appropriate isolation mechanism (e.g., a read transaction or snapshot isolation) to ensure no row reflects a state from before or after the capture moment.

---

## 5. Cross-Group Consistency Audit

### 5.1 Group 1 (Page & Tag Registry) — Consistency

| Concern | Check Result |
|---|---|
| Comments on deprecated tags | ✅ API-0901 allows comments on deprecated tags. Deprecated tags are not removed. Investigation requires commenting on historical content. |
| Export for deprecated pages | ✅ API-0905 accepts deprecated pages for export — exporting historical data is valid. |
| Tag not found on comment creation | ✅ API-0901 returns `TAG_NOT_FOUND` if the tag does not exist. Consistent with Group 1 error vocabulary. |

---

### 5.2 Group 2 (English Copy) — Consistency

| Concern | Check Result |
|---|---|
| Comments scoped to ENGLISH — version independence | ✅ Comments with `scope.type: ENGLISH` attach to the tag's English content surface, not to a specific English version. When a new English version is authored via Group 2 API-0201, all existing comments on the English surface remain visible and unchanged. This is consistent with FRD §4.12 (no version attribute on Comment entity) and with the investigative purpose of UF-15, where discussion history across all versions is informative. |
| Export English copy column | ✅ Uses the current approved English copy version at the dataset-capture moment. If no approved English version exists (tag in authoring state), the column is empty — consistent with the Group 2 English Copy state model. |

---

### 5.3 Group 3 (Translation) — Consistency

| Concern | Check Result |
|---|---|
| Comments on INACTIVE language | ✅ API-0901 accepts INACTIVE language codes for comment scope. Reviewing historical/deprecated language content is valid. |
| Export translation column | ✅ Uses the current approved translation. Status reflects the current translation state (`NO_TRANSLATION`, `DRAFT`, `PENDING_REVIEW`, `APPROVED`, `STALE`). Consistent with Group 3 state model. |
| Export for INACTIVE language | ✅ API-0905 accepts INACTIVE language codes — exporting historical translation data is valid. |

---

### 5.4 Group 5 (System-Triggered) — Consistency

| Concern | Check Result |
|---|---|
| API-0904 vs API-0505 write model | ✅ API-0904 returns the exact same schema as the audit record written by API-0505 (Group 5 §2.1). No competing model. |
| API-0906/0907 vs API-0504 | ✅ Notifications created by API-0504 are the records read by API-0906. `eventType` values in §2.3.1 match the FRD §12 event catalogue used by API-0504. No independent notification schema. |
| API-0901/0903 write audit records | ✅ Both trigger API-0505 with `COMMENT_ADDED` / `COMMENT_RESOLVED`. Group 5 §2.1.1 audit action catalogue includes comment actions. |
| API-0905 does not create audit records | ✅ Export is a read operation. Group 5 rule: GET-equivalent operations do not produce audit records. Consistent. |

---

### 5.5 Group 6 (Visibility & Reporting) — Consistency

| Concern | Check Result |
|---|---|
| Activity timeline vs audit trail | ✅ Group 6 API-0605 (Activity Timeline) is a paginated activity feed. Group 9 API-0904 is a searchable, filterable audit archive. They read from the same audit record source but serve different UX surfaces. No conflict. API-0605 is optimized for recency display; API-0904 is optimized for investigation and search. |
| Comments in activity timeline | ✅ FRD F-18: "Comments are included in the activity timeline." Comments appear in the timeline because they create `COMMENT_ADDED` audit records (API-0505), which API-0605 reads. No separate feed is needed — the audit record is the single source. |

---

### 5.6 Group 7 (Search & Navigation) — Consistency

| Concern | Check Result |
|---|---|
| UF-13 → UF-15 handoff to audit/comments | ✅ UF-13 (Find & Inspect) navigates to a tag. UF-15 (Investigate) then uses API-0902 (Get Comments) and API-0904 (Get Audit Trail) on that tag. No API overlap or conflict. |
| Comment data in search | ✅ Comment text is not indexed by API-0701 (Global Search). Search is scoped to tag IDs, English copy, page names, and page IDs (Group 7 §1.1). Comments are tag-contextual data — not search targets. |

---

### 5.7 Cross-Group Issues Found

| Issue ID | Classification | Description |
|---|---|---|
| **CG-G9-01** | Read/Write Symmetry | API-0904 reads audit records written exclusively by API-0505 (Group 5). The action catalogue in API-0904 §3.4.1 must remain exactly synchronized with the Group 5 §2.1.1 action catalogue. Any new audit action added to Group 5 is automatically surfaceable via API-0904 — no Group 9 change required. Engineering must ensure no action codes are added to Group 5 without updating the shared enum definition used by both groups. |
| **CG-G9-02** | Notification Event Symmetry | The `eventType` catalogue in §2.3.1 must remain synchronized with the notification events dispatched by Group 5 API-0504. Any new FRD §12 event added to API-0504 is automatically readable via API-0906. Same synchronization dependency as CG-G9-01 — shared enum definition is the engineering solution. |
| **CG-G9-03** | Export Snapshot Consistency | The export dataset is captured at the moment the export job reads the data (the dataset-capture moment), not at POST request time. For async exports this may be seconds to minutes later. The generated file must be internally consistent to that single captured moment — no row may reflect a state from before or after the capture. This is correct per FRD F-19 ("current state at time of export") as long as the file is internally consistent to one moment. Engineering must use consistent-read isolation for the export data read phase. |
| **CG-G9-04** | Comment Version Independence | Comments are scoped to the Tag's content surface, not to a specific English or Translation version. This is consistent with Group 2 versioning (API-0201/API-0202 create new English versions) and Group 3 versioning (API-0301/API-0303 create new Translation versions) — neither Group defines version-scoped comments in the approved FRD. Comments authored before a new version is created continue to appear when reviewing the tag's history. This is the intended behaviour for the UF-15 investigative use case. |
| **CG-G9-05** | Export Sub-Endpoint Public Classification | `GET /v1/exports/{exportId}` (§3.5.4) and `GET /v1/exports/{exportId}/download` (§3.5.5) are public sub-endpoints of API-0905. They are not implementation details. They must appear in OpenAPI/API documentation alongside the POST, carry the same authorization restriction (DEV excluded), and return the error codes defined in §3.5.4 and §3.5.5. |

---

## 6. RBAC Summary

| API | Write? | Authorization |
|---|---|---|
| API-0901 Add Comment | Yes | **All roles** |
| API-0902 Get Comments | No | **All roles** |
| API-0903 Resolve Comment | Yes | **All roles** |
| API-0904 Get Audit Trail | No | **All roles** |
| API-0905 Export Tag Data | No (generates file) | PM, LR, SR, FN, ADMIN (DEV excluded) |
| API-0906 Get Notifications | No | **All roles** |
| API-0907 Mark Notification as Read | Yes (preference) | **All roles** |

---

## 7. Engineering Notes

| ID | Note | Impact if Not Met |
|---|---|---|
| **EN-G9-01** | API-0904 `totalMatchingRecords` should be a best-effort estimate for large datasets, not an exact count requiring a full table scan. Engineering must decide on an implementation strategy (e.g., approximate count, last-page detection) that keeps response time acceptable as the audit log grows over time. | Performance degradation on large audit trail queries. |
| **EN-G9-02** | The `action` filter for API-0904 uses a comma-separated list. Engineering must define the URL encoding and maximum filter list size (recommendation: max 20 action types per query). | Malformed queries or unexpectedly large filter lists could cause server-side errors. |
| **EN-G9-03** | Export file generation for large pages may be CPU/memory-intensive. Engineering must define the synchronous/asynchronous threshold (recommendation: ≤ 100 tags → synchronous 200; > 100 tags → async 202). The `GET /v1/exports/{exportId}` polling endpoint must be implemented alongside the POST. | Synchronous generation for large pages blocks the request thread; async without a status endpoint leaves the UI unable to surface the download. |
| **EN-G9-04** | Export download links expire after 1 hour. Engineering must implement link expiry and return an appropriate error (410 Gone or 404) for expired export IDs. | Stale download URLs silently failing would confuse the user. |
| **EN-G9-05** | **Shared Enum Implementation Requirement (FINDING-014 / FINDING-015 resolution).** The audit action catalogue (used by both API-0505 write path and API-0904 `action` filter) and the notification event type catalogue (used by both API-0504 dispatch and API-0906 `eventType` filter) must each be implemented as a **single shared enum definition** — not duplicated across Group 5 and Group 9 code. Acceptable implementations: (a) shared constant file/module imported by both service layers, (b) shared OpenAPI `$ref` components, (c) shared database lookup table with a single maintenance path. The CG-G9-01 and CG-G9-02 cross-group consistency checks describe the design intent; this engineering note makes the implementation obligation explicit. Adding a new audit action to Group 5 without updating the shared enum automatically breaks the API-0904 `action` filter validation — this must be caught in the same commit/PR, not discovered in production. | API-0904 rejects valid action filter values; API-0906 filters return 0 results for valid but unrecognized event types. Silent filtering failures are hard to detect and confuse audit investigators. |

---

## 8. Endpoint Summary

| API ID | Method | URL | Purpose | Auth |
|---|---|---|---|---|
| **API-0901** | `POST` | `/v1/tags/{tagId}/comments` | Add a comment to a tag | All roles |
| **API-0902** | `GET` | `/v1/tags/{tagId}/comments` | Get all comments for a tag | All roles |
| **API-0903** | `PATCH` | `/v1/tags/{tagId}/comments/{commentId}/resolve` | Mark a comment as resolved | All roles |
| **API-0904** | `GET` | `/v1/audit` | Search and retrieve audit records | All roles |
| **API-0905** | `POST` | `/v1/exports` | Generate a CSV or Excel export for a page + language | PM, LR, SR, FN, ADMIN |
| **API-0905** (sub) | `GET` | `/v1/exports/{exportId}` | Check export generation status (§3.5.4) | PM, LR, SR, FN, ADMIN |
| **API-0905** (sub) | `GET` | `/v1/exports/{exportId}/download` | Download the generated export file (§3.5.5) | PM, LR, SR, FN, ADMIN |
| **API-0906** | `GET` | `/v1/notifications` | Get current user's notifications | All roles |
| **API-0907** | `PATCH` | `/v1/notifications/read` | Mark notifications as read | All roles |

> **Export sub-endpoints:** `GET /v1/exports/{exportId}` (§3.5.4) and `GET /v1/exports/{exportId}/download` (§3.5.5) are **public sub-endpoints** of API-0905. They are part of API-0905's approved contract and must be documented in OpenAPI/API documentation alongside the POST. They are not separate Domain 9 API List entries. Both carry the same authorization restriction as the POST (DEV excluded). See §3.5.4 and §3.5.5 for their individual error catalogues.

---

*End of Group 9 API Design Specification — v1.1 (Locked).*
