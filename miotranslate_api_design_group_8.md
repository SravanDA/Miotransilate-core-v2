# MioTranslate API Design — Group 8: Administration

**Product:** MioTranslate  
**Document Type:** API Design Specification  
**Scope:** Group 8 — Administration (API-0801 through API-0807)  
**Source Documents:** Approved API List (Domain 8), FRD §5.7/§8 (Permissions & Access Control)/§7 (Business Rules 11, 13, 19–24)/F-21 (Administration)/F-17 (Audit Trail), IA §6.5 (Settings Area: S1–S4), User Flows UF-17/UF-18, Group 1 API Design (locked baseline conventions), Group 5 (Audit model)  
**Audience:** Backend Engineering, Frontend Engineering, QA  
**Prerequisites:** Group 1 (locked baseline conventions, Language entity, Page/Tag registry), Group 5 (Audit record model, API-0505, API-0506)

---

## Document Status & Revision History

| Version | Date | Author | Status | Summary of Changes |
|---|---|---|---|---|
| **v1.0** | Aug 2026 | API Design | Draft | Initial specification — all 7 APIs authored. |
| **v1.1** | Aug 2026 | API Design | Final — Locked | Targeted correction pass: (1) Initialization window defined: language is ACTIVE immediately after API-0802 returns 201; Group 3 APIs treat a missing slot as equivalent to NO_TRANSLATION during the API-0506 batch window — no undefined state. (2) Language reactivation explicitly documented as unsupported in v1; `languageCode` uniqueness check correctly covers both ACTIVE and INACTIVE codes per API List. (3) `languageName` corrected to immutable — the v1.0 "mutable" claim was erroneous; no approved API provides a name-update path. (4) Admin-lockout guard broadened: API-0804 must reject any role change that would leave zero users holding ADMIN or FN authority system-wide (not just self-ADMIN removal). (5) RBAC note added clarifying that authorization is enforced by the system-wide authorization model dynamically, not by hardcoded role literals per API. (6) Impact preview de-specified as a new endpoint: the active-tag count is available via existing Group 1 API-0101; no eighth public API is introduced. (7) Initialization window cross-group check added to §5.2 (Group 3 consistency). |
| **v1.2** | Aug 2026 | API Design | Locked | Audit finding resolution pass: (1) User auto-provisioning model documented in §2.1 — users are auto-provisioned on first authenticated request; no separate Create User API exists; roles must be assigned by ADMIN/FN before access is effective. (2) `addedBy` and `addedAt` field visibility in API-0807 hardened from an advisory note to a definitive API contract: these fields are omitted from the response for callers without ADMIN or FN role. (3) Cache staleness bounds in Engineering Dependencies §7 upgraded from recommendations to engineering requirements: role status TTL ≤ 30s, language status TTL ≤ 30s, `bulkApprovalConfidenceThreshold` TTL ≤ 30s — these are governance invariants, not performance suggestions. |

> **Lock Status:** Group 8 is **locked**. No further changes may be made without a documented revision entry above and traceability to an approved source document.

---

## 1. Group 8 Context

### 1.1 What Group 8 Covers

Group 8 defines the **Administration capabilities** of MioTranslate — the infrequently used but governance-critical configuration layer. These APIs manage the three operational surfaces in the Settings area (IA §6.5):

- **User & Role Management** — who can do what in MioTranslate
- **Language Management** — which languages MioTranslate operates in
- **System Configuration** — operational parameters that affect how governance rules are applied

| API ID | Name | HTTP | URL | IA Location |
|---|---|---|---|---|
| **API-0801** | List Users and Roles | GET | `/v1/admin/users` | Settings → Users & Roles (S1) |
| **API-0802** | Add Language | POST | `/v1/admin/languages` | Settings → Languages (S2) |
| **API-0803** | Deactivate Language | PATCH | `/v1/admin/languages/{languageCode}/deactivate` | Settings → Languages (S2) |
| **API-0804** | Assign or Update User Role | PUT | `/v1/admin/users/{userId}/roles` | Settings → Users & Roles (S1) |
| **API-0805** | Get System Configuration | GET | `/v1/admin/config` | Settings → Configuration (S3) |
| **API-0806** | Update System Configuration | PATCH | `/v1/admin/config` | Settings → Configuration (S3) |
| **API-0807** | List Languages | GET | `/v1/languages` | Product-wide (language selectors, UF-17, UF-14) |

**Critical design properties for all Group 8 APIs:**
- **Narrow authorization.** All write APIs (API-0802, API-0803, API-0804, API-0806) are restricted to ADMIN and FN roles only (FRD §8, IA S1–S3). Authorization is enforced by the system-wide authorization model at request time, reading from the role assignment store managed by API-0804. This is a dynamic check — not a hardcoded role literal per endpoint.
- **Every write is audited.** API-0802, API-0803, API-0804, API-0806 each produce an immutable audit record via Group 5 API-0505. This is a Group 8 design invariant — not optional.
- **No deletes.** Languages cannot be deleted, only deactivated. Users cannot be removed, only their roles changed. Historical data is always preserved (FRD §7 Rules 19–21, Rule 24).
- **Immediate permission enforcement.** Role changes (API-0804) are effective immediately — not on next login (FRD §5.7, UF-18 Step 4).
- **API-0807 is a read-only, all-roles API.** It is listed in Domain 8 because it reads from the Language entity managed by API-0802/API-0803, but it is accessible to all roles as a lookup resource used across the product.

---

### 1.2 Domain Position and Dependencies

Group 8 manages foundational configuration that all other groups depend on at runtime, but Group 8 APIs themselves are operationally infrequent.

| Data | Owned By | Key Dependencies |
|---|---|---|
| Language registry (codes, names, directions, status) | Group 8 API-0802/API-0803 | API-0807 reads from it; Group 3/4/5/6 check language status before operating on a language |
| User role assignments | Group 8 API-0804 | All groups enforce RBAC at runtime based on the assignments stored here |
| System configuration (confidence threshold, endpoints) | Group 8 API-0806 | Group 3 API-0305 (Bulk Approve) reads the confidence threshold from here |
| Empty translation slots (new language) | **Group 5 API-0506** triggered by API-0802 | Not owned by Group 8 — triggered as a side-effect |
| Audit records for admin actions | **Group 5 API-0505** | API-0802, API-0803, API-0804, API-0806 all write audit records |

---

### 1.3 Baseline Conventions Inheritance

Group 8 inherits all conventions from Group 1 §1 without modification:
- URL base and versioning: `https://{host}/api/v1/...`
- JSON casing: `camelCase` for fields, `SCREAMING_SNAKE_CASE` for enums and error codes
- Response envelopes per Group 1 §1.5
- HTTP status codes per Group 1 §1.6
- Cursor-based pagination (Group 1 §1.7) where applicable
- Error model: RFC 9457-inspired `{ "error": { "code", "status", "message", "target", "details" } }`
- Authorization: RBAC per FRD §8

**URL prefix note:** Administration APIs use the `/v1/admin/` prefix to signal their elevated authorization requirement. `API-0807` (List Languages) is an exception — it uses `/v1/languages` because it is a product-wide read resource, not an admin-restricted operation.

---

### 1.4 RBAC Summary for Group 8

| API | Authorized Roles | Notes |
|---|---|---|
| API-0801 List Users and Roles | ADMIN, FN | Viewing the user roster and role assignments is restricted. Other roles see their own permissions at a product-UI level. |
| API-0802 Add Language | ADMIN, FN | FRD §8: only Admin/Founder can add languages. |
| API-0803 Deactivate Language | ADMIN, FN | FRD §8: only Admin/Founder can deactivate languages. |
| API-0804 Assign or Update User Role | ADMIN, FN | FRD §8: only Admin/Founder can manage roles. |
| API-0805 Get System Configuration | ADMIN, FN | Configuration details (including endpoint URLs) should not be exposed to operational roles. |
| API-0806 Update System Configuration | ADMIN, FN | FRD §8: only Admin/Founder can configure system settings. |
| API-0807 List Languages | **All roles** | Language selectors are used across the product by every role. Read-only. |

---

## 2. Resource Models

### 2.1 User Record

```json
{
  "userId": "user:pm-arjun",
  "displayName": "Arjun Mehta",
  "email": "arjun@miosalonsoftware.com",
  "roles": ["PM"],
  "roleAssignments": [
    {
      "role": "PM",
      "assignedAt": "2026-07-10T09:00:00Z",
      "assignedBy": "user:admin-deepa"
    }
  ],
  "status": "ACTIVE",
  "lastActiveAt": "2026-08-24T14:35:00Z",
  "createdAt": "2026-07-10T09:00:00Z"
}
```

| Field | Type | Description |
|---|---|---|
| `userId` | string | Unique user identifier. Derived from the authentication token (e.g., identity provider subject claim). |
| `displayName` | string | Full name. Sourced from the identity provider. |
| `email` | string | User email address. Sourced from the identity provider. |
| `roles` | array\<enum\> | Current active roles: `PM`, `QA`, `LR`, `SR`, `FN`, `DEV`, `ADMIN`. A user may hold multiple roles simultaneously. Empty array means no roles assigned — user can authenticate but cannot perform any role-restricted operations. |
| `roleAssignments` | array | Audit trail of each role assignment: `role`, `assignedAt`, `assignedBy`. |
| `status` | enum | `ACTIVE`. (Users cannot be deactivated in v1 — roles are removed to revoke access.) |
| `lastActiveAt` | string (ISO 8601) \| null | Timestamp of the user's most recent authenticated action. Null for users who have never logged in. |
| `createdAt` | string (ISO 8601) | When this user was added to MioTranslate. |

> **User Auto-Provisioning Model:** There is no separate "Create User" API in MioTranslate. User records are created automatically on the user's **first authenticated request** to any MioTranslate API endpoint. The system reads the user identity (userId, displayName, email) from the authentication token and provisions a user record with `roles: []` (no roles assigned). An ADMIN or FN must then assign roles via API-0804 before the user can perform any role-restricted operation. Until roles are assigned, the user can authenticate successfully but all RBAC-restricted endpoints return `403 FORBIDDEN`. This model eliminates a separate user-invitation or user-creation workflow and ensures the user registry is always consistent with the identity provider. Users who have valid credentials but have never made a request do not appear in the MioTranslate user registry (they appear after their first request).

---

### 2.2 Language Record

```json
{
  "languageCode": "ar",
  "languageName": "Arabic",
  "direction": "RTL",
  "status": "ACTIVE",
  "addedAt": "2026-07-01T08:00:00Z",
  "addedBy": "user:admin-deepa",
  "coverageSummary": {
    "totalActiveTags": 4200,
    "approvedCount": 3864,
    "coveragePercentage": 92.0
  }
}
```

| Field | Type | Description |
|---|---|---|
| `languageCode` | string | Standard BCP 47 language code (e.g., `ar`, `hi`, `es`, `tr`, `fr-CA`). **Immutable after creation.** Cannot be renamed or reused. |
| `languageName` | string | Human-readable name (e.g., `Arabic`). **Immutable in v1** — no approved API provides a name-update path. Set at creation; cannot be changed thereafter. |
| `direction` | enum | `LTR` or `RTL`. **Immutable after creation.** Cannot be changed. |
| `status` | enum | `ACTIVE` or `INACTIVE`. Changed only via API-0803 (deactivate). Reactivation is not supported in v1 (see §3.2 lifecycle note). |
| `addedAt` | string (ISO 8601) | When this language was added to MioTranslate. |
| `addedBy` | string | User ID of the Admin/Founder who added the language. |
| `coverageSummary` | object \| null | Lightweight coverage snapshot sourced from the Group 5 precomputed coverage table (API-0503). `totalActiveTags`, `approvedCount`, `coveragePercentage` are system-wide aggregates. Null while API-0506 slot creation is still in progress for a newly added language. |

---

### 2.3 System Configuration

```json
{
  "bulkApprovalConfidenceThreshold": 95,
  "environments": {
    "dev": {
      "languageServicesEndpoint": "https://dev-api.miosalonsoftware.com/multilingual",
      "tenantDomain": "dev.miosalonsoftware.com"
    },
    "qa": {
      "languageServicesEndpoint": "https://qa-api.miosalonsoftware.com/multilingual",
      "tenantDomain": "qa.miosalonsoftware.com"
    },
    "production": {
      "languageServicesEndpoint": "https://api.miosalonsoftware.com/multilingual",
      "tenantDomain": "miosalonsoftware.com"
    }
  },
  "lastUpdatedAt": "2026-08-10T11:00:00Z",
  "lastUpdatedBy": "user:admin-deepa"
}
```

| Field | Type | Description |
|---|---|---|
| `bulkApprovalConfidenceThreshold` | integer | Minimum confidence score (0–100) required for a translation to be eligible for bulk approval (FRD §7 Rule 11, F-09). Default: 95. |
| `environments` | object | Per-environment configuration. Keys: `dev`, `qa`, `production`. Each environment has a `languageServicesEndpoint` (the URL used by API-0405/API-0407 to push content) and `tenantDomain` (the MioSalon domain identifier sent in Language Services API calls). |
| `lastUpdatedAt` | string (ISO 8601) | Timestamp of the most recent configuration change. |
| `lastUpdatedBy` | string | User ID who made the last change. |

> **Security note:** `languageServicesEndpoint` values are sensitive configuration. Only ADMIN and FN may read them via API-0805. Operational roles (PM, LR, SR, etc.) are never exposed to endpoint URLs.

---

## 3. API Specifications

### API-0801: List Users and Roles

> **Source:** FRD §5.7, §8, IA §6.5 S1 (User & Role Management), UF-18, API List API-0801.

**Endpoint:**
```
GET /v1/admin/users
```

**Purpose:** Return the complete list of MioTranslate users with their current role assignments. Serves the Users & Roles management screen (IA S1), enabling Administrators and Founders to see who has access and what each person can do. Also used as the lookup list when assigning roles via API-0804.

**Authorization:** ADMIN, FN.

---

#### 3.1.1 Query Parameters

| Parameter | Type | Default | Description |
|---|---|---|---|
| `role` | enum | (all) | Filter by role: `PM`, `QA`, `LR`, `SR`, `FN`, `DEV`, `ADMIN`. Returns only users who currently hold the specified role. |
| `status` | enum | `ACTIVE` | Filter by user status. Currently only `ACTIVE` is supported. |
| `sortBy` | enum | `displayNameAsc` | `displayNameAsc` (alphabetical, default), `lastActiveAtDesc` (most recently active first), `createdAtDesc`. |
| `pageSize` | integer | 50 | Max 200. |
| `pageToken` | string | (none) | Cursor. |

---

#### 3.1.2 Response — 200 OK

```json
{
  "data": {
    "totalUsers": 12,
    "items": [
      {
        "userId": "user:pm-arjun",
        "displayName": "Arjun Mehta",
        "email": "arjun@miosalonsoftware.com",
        "roles": ["PM", "LR"],
        "roleAssignments": [
          {
            "role": "PM",
            "assignedAt": "2026-07-10T09:00:00Z",
            "assignedBy": "user:admin-deepa"
          },
          {
            "role": "LR",
            "assignedAt": "2026-08-01T10:00:00Z",
            "assignedBy": "user:admin-deepa"
          }
        ],
        "status": "ACTIVE",
        "lastActiveAt": "2026-08-24T14:35:00Z",
        "createdAt": "2026-07-10T09:00:00Z"
      }
    ]
  },
  "pagination": {
    "nextPageToken": null,
    "pageSize": 50
  }
}
```

---

#### 3.1.3 Business Rules

| Rule | Source | Enforcement |
|---|---|---|
| Restricted to ADMIN and FN | FRD §8 | Non-ADMIN/FN requests return 403. |
| Returns all users — no self-exclusion | API Design | The administrator's own record is included. |
| `roles` is the current live set | API Design | Reflects the user's roles at request time. `roleAssignments` provides the history. |
| Multi-role users returned as single record | FRD §5.7: "A user can hold multiple roles" | `roles` is an array; one user record covers all their roles. |
| Empty list is not an error | API Design | `totalUsers: 0`, `items: []`. Appropriate for a freshly initialized system. |

---

#### 3.1.4 Error Catalogue

| HTTP | Code | Condition |
|---|---|---|
| 403 | `FORBIDDEN` | Caller does not hold ADMIN or FN role. |
| 422 | `INVALID_VALUE` on `role` | Not a valid role enum value. |

---

### API-0802: Add Language

> **Source:** FRD §5.7, §7 Rule 24, F-21, IA §6.5 S2, UF-17, API List API-0802. Side-effect triggers Group 5 API-0506.

**Endpoint:**
```
POST /v1/admin/languages
```

**Purpose:** Add a new supported language to MioTranslate. Once added, the language is immediately active. Group 5 API-0506 runs as a background batch to create a `NO_TRANSLATION` slot for every active tag. The coverage dashboard shows 0% for the new language as soon as coverage is computed. No translated content is created — only empty slots signalling where translation work needs to happen. Audit record created.

**Authorization:** ADMIN, FN.

---

#### 3.2.0 Language Lifecycle

**v1 lifecycle: ACTIVE only, with one optional terminal transition to INACTIVE.**

```
[API-0802] → ACTIVE
                 │
           [API-0803]
                 ↓
              INACTIVE  (terminal in v1 — no reactivation)
```

| Lifecycle event | Operation | Notes |
|---|---|---|
| Add language | API-0802 POST | Creates as ACTIVE. Code is unique across ACTIVE and INACTIVE. |
| Deactivate language | API-0803 PATCH | Moves to INACTIVE. All data preserved. |
| Reactivate language | **Not supported in v1** | The approved API List contains no reactivation API. An INACTIVE language cannot be returned to ACTIVE. A previously deactivated language code cannot be reused via API-0802 (uniqueness check covers ACTIVE and INACTIVE). If reactivation is needed in a future version, it requires a new approved API entry and a revision to this document. |
| Delete language | Not supported — ever | Languages cannot be deleted. FRD §7 Rule 24 and §4.5: data is always preserved. |

---

#### 3.2.1 Request Body

```json
{
  "languageCode": "tr",
  "languageName": "Turkish",
  "direction": "LTR"
}
```

| Field | Type | Required | Description |
|---|---|---|---|
| `languageCode` | string | Yes | Standard BCP 47 code (e.g., `tr`, `ar`, `hi`, `fr-CA`). Must be unique across all existing language codes regardless of their status (ACTIVE or INACTIVE). Case-insensitive on input; stored in lowercase. Immutable after creation. |
| `languageName` | string | Yes | Human-readable name (e.g., `Turkish`). Min 1 char, max 100 chars. **Immutable in v1** — cannot be changed after creation. No approved API provides a name-update path. |
| `direction` | enum | Yes | `LTR` or `RTL`. Immutable after creation. |

---

#### 3.2.2 Response — 201 Created

```json
{
  "data": {
    "languageCode": "tr",
    "languageName": "Turkish",
    "direction": "LTR",
    "status": "ACTIVE",
    "addedAt": "2026-08-25T10:00:00Z",
    "addedBy": "user:admin-deepa",
    "slotCreation": {
      "status": "IN_PROGRESS",
      "totalActiveTags": 4200,
      "message": "Creating empty translation slots for all active tags. This may take a few minutes."
    }
  }
}
```

| Field | Description |
|---|---|
| `languageCode` | The created language code. |
| `languageName` | The created language name. Immutable. |
| `direction` | LTR or RTL as provided. Immutable. |
| `status` | Always `ACTIVE` on creation. |
| `addedAt` | Timestamp of creation. |
| `addedBy` | User ID of the creator. |
| `slotCreation.status` | Advisory status of the API-0506 background batch: `IN_PROGRESS`. |
| `slotCreation.totalActiveTags` | Total active tags that will receive `NO_TRANSLATION` slots. Communicates the scale of the translation effort (UF-17: "immediately visible and plannable"). |
| `slotCreation.message` | User-facing message for the admin UI. |

---

#### 3.2.3 Initialization Window Behaviour

API-0802 returns 201 synchronously once the language record is persisted as ACTIVE. API-0506 then runs as a background batch that may take seconds to minutes depending on system size (4,000+ tags). During this window the language is ACTIVE but not all `NO_TRANSLATION` slots exist yet.

**Defined behaviour during the initialization window:**

| Scenario | Behaviour |
|---|---|
| `GET /v1/languages` called | Language returned with `status: ACTIVE`, `coverageSummary: null` (coverage not yet computed). No error. |
| Group 3 API-0301 (Generate Translation) called for the new language | API-0301 checks for an approved English copy slot, then for a `NO_TRANSLATION` slot for the target language. If the slot does not yet exist (still being created by API-0506), the behaviour is the same as `NO_TRANSLATION` — the translation is generated and a slot is created. No undefined state: the language is ACTIVE and translation may proceed. |
| Group 3 API-0302 (Bulk Translate) called | Targets all tags with `NO_TRANSLATION` for the new language. During the batch window, only the slots already created by API-0506 are visible. API-0302 operates on whatever slots are present; API-0506 will create the remainder. No error — the operation is safe and idempotent. |
| Group 4 API-0405 (Publish) called for the new language | No approved translations exist yet (all are `NO_TRANSLATION`). Returns a pre-publishing summary showing 0 approved tags and the user cannot proceed. Normal behaviour — not an initialization error. |
| Coverage dashboard (Group 6) called | Returns 0% coverage for the new language. `coverageSummary: null` in API-0807 while API-0503 has not yet run. Not an error. |

**Design principle:** The ACTIVE status is correct from the moment the language record is created. There is no intermediate initialization state added to the product model. The API-0506 batch produces `NO_TRANSLATION` slots, which is the normal starting point for any language-tag pair. APIs across Groups 3, 4, and 6 already handle `NO_TRANSLATION` as a defined, expected state.

---

#### 3.2.4 Business Rules

| Rule | Source | Enforcement |
|---|---|---|
| Restricted to ADMIN and FN | FRD §8 | 403 for other roles. |
| `languageCode` must be unique across all statuses | API List: "Language code already exists → validation error" | Case-insensitive uniqueness check across all existing language codes, ACTIVE and INACTIVE. Returns 409. Covers the reactivation-via-reuse scenario — an INACTIVE code cannot be reused as a new language. |
| All three fields (`languageCode`, `languageName`, `direction`) are immutable after creation | FRD §4.5, API Design | No approved API provides an update path for any of these fields. |
| Triggers API-0506 as a background batch | API List: "Triggers API-0506 (Create Empty Translation Slots)" | The language record is created synchronously. Slot creation (API-0506) runs in the background. The 201 response is returned once the language record is persisted. See §3.2.3 for initialization window behaviour. |
| Audit record created | FRD §7 Rule 20, F-17 | `LANGUAGE_ADDED` audit record created by Group 5 API-0505 at the time of language creation (not when API-0506 completes). |
| Coverage shows 0% after API-0503 runs | UF-17 Step 3 | Coverage precomputed table initialised at 0% for all `(pageId, new language)` pairs once API-0506 batch completes and API-0503 is triggered. `coverageSummary` is null until then. |

---

#### 3.2.5 Error Catalogue

| HTTP | Code | Condition |
|---|---|---|
| 400 | `REQUIRED` on `languageCode` | Field missing. |
| 400 | `REQUIRED` on `languageName` | Field missing. |
| 400 | `REQUIRED` on `direction` | Field missing. |
| 400 | `INVALID_VALUE` on `direction` | Not `LTR` or `RTL`. |
| 403 | `FORBIDDEN` | Caller does not hold ADMIN or FN role. |
| 409 | `LANGUAGE_CODE_ALREADY_EXISTS` | The provided `languageCode` already exists (ACTIVE or INACTIVE). Reuse of a deactivated language code is not permitted. |

---

#### 3.2.6 Impact Preview — UX Dependency (Not a New API)

The IA (§6.5 S2) specifies an *"impact preview when adding a language: 'This will create [N] empty translation slots across [N] active pages.'"* This information is already available from existing approved APIs:

- **Active tag count:** Group 1 API-0101 (List Pages) returns `totalActiveTags` per page and the total tag count is derivable. Alternatively, engineering may expose a count from Group 1 directly.
- **Active page count:** Derivable from Group 1 API-0101 by filtering for `status: ACTIVE`.

The preview is a **frontend UX pattern** — the UI calls Group 1 APIs to read the current active-tag/page counts and displays the impact message before the administrator submits the Add Language form. This does not require a new API endpoint. No eighth public API is introduced from Group 8. If a dedicated preview query is needed and not derivable from existing APIs, it must be submitted for API List approval as a new entry before it may be added to this document.

---

### API-0803: Deactivate Language

> **Source:** FRD §5.7, §7 Rule 24, UF-17 ALT-A, IA §6.5 S2, API List API-0803.

**Endpoint:**
```
PATCH /v1/admin/languages/{languageCode}/deactivate
```

**Purpose:** Deactivate an existing language. After deactivation, no new translations can be created for this language and no content can be published. All existing translations, version history, and audit records for this language are fully preserved (FRD §7 Rule 24: "A deactivated language retains all existing translations and history"). Languages cannot be deleted.

**Authorization:** ADMIN, FN.

---

#### 3.3.1 Path Parameters

| Parameter | Type | Description |
|---|---|---|
| `languageCode` | string | The language code to deactivate (e.g., `tr`). |

#### 3.3.2 Request Body

```json
{
  "reason": "MioSalon has exited the Turkish market."
}
```

| Field | Type | Required | Description |
|---|---|---|---|
| `reason` | string | No | Optional justification for the deactivation. Stored in the audit record `details` field. Max 500 chars. |

---

#### 3.3.3 Response — 200 OK

```json
{
  "data": {
    "languageCode": "tr",
    "languageName": "Turkish",
    "status": "INACTIVE",
    "deactivatedAt": "2026-08-25T11:00:00Z",
    "deactivatedBy": "user:admin-deepa",
    "warning": {
      "hasProductionContent": true,
      "message": "Turkish has content currently deployed to Production. Deactivation is advisory — existing Production content is unaffected. No new translations or publishing will occur for this language."
    }
  }
}
```

| Field | Description |
|---|---|
| `status` | `INACTIVE` on success. |
| `deactivatedAt` | Timestamp. |
| `deactivatedBy` | User ID. |
| `warning` | Present when the language has content deployed to Production. Advisory only — deactivation proceeds. Based on API List: "Language has content deployed to Production → advisory warning but deactivation proceeds." |

---

#### 3.3.4 Business Rules

| Rule | Source | Enforcement |
|---|---|---|
| Restricted to ADMIN and FN | FRD §8 | 403 for other roles. |
| All existing data preserved on deactivation | FRD §7 Rule 24 | Translations, version history, audit records, and deployment records for the language are retained in full. |
| Deactivation is not deletion | FRD §7 Rule 24 | Languages cannot be deleted. Status moves to `INACTIVE`. The `languageCode` record remains. |
| Deactivated language excluded from active workflows | FRD §7 Rule 24 | No new AI translation (API-0301/0302), no bulk translate (API-0302), no publishing (API-0405) for an INACTIVE language. These APIs return `LANGUAGE_INACTIVE` error if called for this language after deactivation. |
| Advisory warning does not block deactivation | API List: "advisory warning but deactivation proceeds" | The presence of Production-deployed content generates a `warning` in the response but does not prevent deactivation. |
| Already-inactive language — idempotent | API Design | PATCH /deactivate on an already-INACTIVE language returns 200 with current state. Not an error. |
| Audit record created | FRD §7 Rule 20, F-17 | `LANGUAGE_DEACTIVATED` audit record created by Group 5 API-0505. |

---

#### 3.3.5 Error Catalogue

| HTTP | Code | Condition |
|---|---|---|
| 403 | `FORBIDDEN` | Caller does not hold ADMIN or FN role. |
| 404 | `LANGUAGE_NOT_FOUND` | `languageCode` does not exist in MioTranslate. |

---

### API-0804: Assign or Update User Role

> **Source:** FRD §5.7, §8, IA §6.5 S1, UF-18, API List API-0804.

**Endpoint:**
```
PUT /v1/admin/users/{userId}/roles
```

**Purpose:** Set the complete list of roles for a user. Uses PUT semantics — the provided `roles` array replaces the user's current role set. To add a role, provide the current roles plus the new one. To remove a role, provide the current roles minus the one to remove. Permissions are enforced immediately — no logout/login required. Audit record created.

**Authorization:** ADMIN, FN.

---

#### 3.4.1 Path Parameters

| Parameter | Type | Description |
|---|---|---|
| `userId` | string | The user ID to update (e.g., `user:pm-arjun`). |

#### 3.4.2 Request Body

```json
{
  "roles": ["PM", "LR"],
  "reason": "Arjun is now also handling Tamil translation review."
}
```

| Field | Type | Required | Description |
|---|---|---|---|
| `roles` | array\<enum\> | Yes | The complete desired role set. Valid values: `PM`, `QA`, `LR`, `SR`, `FN`, `DEV`, `ADMIN`. May be empty array `[]` to remove all roles (effectively revoking all access). |
| `reason` | string | No | Optional justification for the change. Stored in the audit record. Max 500 chars. |

---

#### 3.4.3 Response — 200 OK

```json
{
  "data": {
    "userId": "user:pm-arjun",
    "displayName": "Arjun Mehta",
    "previousRoles": ["PM"],
    "currentRoles": ["PM", "LR"],
    "rolesAdded": ["LR"],
    "rolesRemoved": [],
    "updatedAt": "2026-08-25T10:30:00Z",
    "updatedBy": "user:admin-deepa"
  }
}
```

| Field | Description |
|---|---|
| `previousRoles` | Roles the user held before this call. |
| `currentRoles` | Roles the user holds after this call. |
| `rolesAdded` | Computed diff: roles in `currentRoles` not in `previousRoles`. |
| `rolesRemoved` | Computed diff: roles in `previousRoles` not in `currentRoles`. |
| `updatedAt` | Timestamp of the role change. |
| `updatedBy` | User ID of the Admin/Founder who made the change. |

---

#### 3.4.4 Business Rules

| Rule | Source | Enforcement |
|---|---|---|
| Restricted to ADMIN and FN | FRD §8 | 403 for other roles. Authorization is enforced dynamically by the system-wide authorization model at request time. |
| PUT semantics — full replacement | API Design | The provided `roles` array is the new complete set. Previous roles not in the new set are removed. |
| Permissions effective immediately | FRD §5.7, UF-18 Step 4 | No cache invalidation delay. Enforced on the next API call the affected user makes. |
| Multi-role assignment in one call | FRD §5.7: "A user can hold multiple roles" | `roles` is an array. Multiple roles may be set simultaneously. |
| Empty `roles` array removes all access | API Design | Equivalent to revoking all permissions. The user record is preserved (no deletion). |
| Cannot create a zero-authority state | API Design (governance safety guard) | Before applying the role change, the system counts the number of users who will hold ADMIN or FN role after the change. If that count would be zero, the call is rejected with 422 `WOULD_REMOVE_LAST_AUTHORITY`. This prevents accidental total administrative lockout regardless of which user's roles are being changed. **Basis:** FRD §2.7 states the Founder role always exists in the organization and currently holds all admin responsibilities — the system must not permit a state where no user retains the authority to manage roles, add languages, or change configuration. |
| Cannot remove own ADMIN role when doing so would leave zero-authority | API Design (governance safety guard) | Covered by the zero-authority check above. A user attempting to remove their own last ADMIN or FN role is rejected if no other user holds ADMIN or FN. If other admin-authority users exist, self-removal is permitted — there is no self-specific restriction beyond the zero-authority guard. |
| Audit record created | FRD §7 Rule 20, F-17 | `USER_ROLE_ASSIGNED` (if new roles added) or `USER_ROLE_MODIFIED` (if existing roles changed). Includes `beforeValue` (old roles) and `afterValue` (new roles). |

---

#### 3.4.5 Error Catalogue

| HTTP | Code | Condition |
|---|---|---|
| 400 | `REQUIRED` on `roles` | Field missing (not provided at all). Note: empty array `[]` is valid — it is not an error. |
| 400 | `INVALID_VALUE` on `roles` | An entry in the `roles` array is not a valid role enum value. |
| 403 | `FORBIDDEN` | Caller does not hold ADMIN or FN role. |
| 404 | `USER_NOT_FOUND` | `userId` does not exist in MioTranslate. |
| 422 | `WOULD_REMOVE_LAST_AUTHORITY` | The requested role change would result in zero users holding ADMIN or FN role system-wide. The call is rejected to prevent total administrative lockout. The caller must first assign ADMIN or FN to another user, then retry. |

---

### API-0805: Get System Configuration

> **Source:** FRD §5.7, F-09 (confidence threshold), IA §6.5 S3, UF-18 ALT-A, API List API-0805.

**Endpoint:**
```
GET /v1/admin/config
```

**Purpose:** Retrieve the current system configuration. This is the single authoritative source for operational parameters that govern how MioTranslate's rules are applied — most notably the confidence threshold for bulk approval (FRD §7 Rule 11) and the Language Services API endpoint URLs per environment (used by Group 4 API-0405 and API-0407). Also serves the System Configuration screen (IA S3) and the configuration change log (audit trail for configuration changes).

**Authorization:** ADMIN, FN.

---

#### 3.5.1 Response — 200 OK

```json
{
  "data": {
    "bulkApprovalConfidenceThreshold": 95,
    "environments": {
      "dev": {
        "languageServicesEndpoint": "https://dev-api.miosalonsoftware.com/multilingual",
        "tenantDomain": "dev.miosalonsoftware.com"
      },
      "qa": {
        "languageServicesEndpoint": "https://qa-api.miosalonsoftware.com/multilingual",
        "tenantDomain": "qa.miosalonsoftware.com"
      },
      "production": {
        "languageServicesEndpoint": "https://api.miosalonsoftware.com/multilingual",
        "tenantDomain": "miosalonsoftware.com"
      }
    },
    "lastUpdatedAt": "2026-08-10T11:00:00Z",
    "lastUpdatedBy": "user:admin-deepa"
  }
}
```

---

#### 3.5.2 Business Rules

| Rule | Source | Enforcement |
|---|---|---|
| Restricted to ADMIN and FN | IA S3: "Roles: ADMIN, FN only" | 403 for other roles. Endpoint URLs in particular are sensitive. |
| Read-only — no write | API Design | GET only. Updates handled by API-0806. |
| `bulkApprovalConfidenceThreshold` default is 95 | FRD §7 Rule 11, UF-18 ALT-A | If never explicitly set, returns 95. |
| Always returns a non-null configuration object | API Design | Configuration is initialised on system setup. This endpoint never returns 404 or an empty data object. |

---

#### 3.5.3 Error Catalogue

| HTTP | Code | Condition |
|---|---|---|
| 403 | `FORBIDDEN` | Caller does not hold ADMIN or FN role. |

---

### API-0806: Update System Configuration

> **Source:** FRD §5.7, F-09 ("configurable confidence threshold"), IA §6.5 S3, UF-18 ALT-A, API List API-0806.

**Endpoint:**
```
PATCH /v1/admin/config
```

**Purpose:** Update one or more system configuration values. Uses PATCH semantics — only the fields included in the request body are updated. Fields not included are unchanged. Audit record created with before/after values for every changed field.

**Authorization:** ADMIN, FN.

---

#### 3.6.1 Request Body

```json
{
  "bulkApprovalConfidenceThreshold": 90,
  "environments": {
    "qa": {
      "languageServicesEndpoint": "https://qa-v2-api.miosalonsoftware.com/multilingual",
      "tenantDomain": "qa-v2.miosalonsoftware.com"
    }
  }
}
```

All fields are optional. Only provided fields are updated.

| Field | Type | Constraints | Description |
|---|---|---|---|
| `bulkApprovalConfidenceThreshold` | integer | Min 0, max 100 | New confidence threshold for bulk approval eligibility. |
| `environments.dev.languageServicesEndpoint` | string | Valid HTTPS URL | Dev environment Language Services API URL. |
| `environments.dev.tenantDomain` | string | Non-empty | Dev tenant domain identifier. |
| `environments.qa.languageServicesEndpoint` | string | Valid HTTPS URL | QA endpoint URL. |
| `environments.qa.tenantDomain` | string | Non-empty | QA tenant domain. |
| `environments.production.languageServicesEndpoint` | string | Valid HTTPS URL | Production endpoint URL. |
| `environments.production.tenantDomain` | string | Non-empty | Production tenant domain. |

---

#### 3.6.2 Response — 200 OK

```json
{
  "data": {
    "updatedFields": ["bulkApprovalConfidenceThreshold"],
    "bulkApprovalConfidenceThreshold": 90,
    "environments": {
      "dev": {
        "languageServicesEndpoint": "https://dev-api.miosalonsoftware.com/multilingual",
        "tenantDomain": "dev.miosalonsoftware.com"
      },
      "qa": {
        "languageServicesEndpoint": "https://qa-v2-api.miosalonsoftware.com/multilingual",
        "tenantDomain": "qa-v2.miosalonsoftware.com"
      },
      "production": {
        "languageServicesEndpoint": "https://api.miosalonsoftware.com/multilingual",
        "tenantDomain": "miosalonsoftware.com"
      }
    },
    "updatedAt": "2026-08-25T10:45:00Z",
    "updatedBy": "user:admin-deepa"
  }
}
```

| Field | Description |
|---|---|
| `updatedFields` | Array of field names that were changed in this call. Useful for the audit display and for confirming which fields were affected. |
| *(all config fields)* | The complete configuration after the update. Same shape as API-0805 response. |

---

#### 3.6.3 Business Rules

| Rule | Source | Enforcement |
|---|---|---|
| Restricted to ADMIN and FN | FRD §8 | 403 for other roles. |
| PATCH semantics — partial update | API Design | Only provided fields updated. Omitted fields unchanged. |
| `bulkApprovalConfidenceThreshold` must be 0–100 | FRD F-09 | Returns 422 `INVALID_VALUE` for values outside this range. |
| Endpoint URLs must be valid HTTPS URLs | API Design | Returns 422 `INVALID_VALUE` for non-HTTPS or malformed URLs. |
| Audit record with before/after values created | FRD §7 Rule 20, F-17, API List: "Audit record created with before and after values" | `SYSTEM_CONFIG_CHANGED` record per Group 5 API-0505. `beforeValue` and `afterValue` capture the old and new values of each changed field. |
| Immediate enforcement | API Design | New `bulkApprovalConfidenceThreshold` applies to the next call to API-0305 (Bulk Approve). New endpoint URLs apply to the next Group 4 publishing call. No restart required. |

---

#### 3.6.4 Error Catalogue

| HTTP | Code | Condition |
|---|---|---|
| 400 | `NO_FIELDS_TO_UPDATE` | Request body is empty or contains no recognised configuration fields. |
| 403 | `FORBIDDEN` | Caller does not hold ADMIN or FN role. |
| 422 | `INVALID_VALUE` on `bulkApprovalConfidenceThreshold` | Value is outside the 0–100 range. |
| 422 | `INVALID_VALUE` on endpoint URL | Not a valid HTTPS URL. |

---

### API-0807: List Languages

> **Source:** FRD §5.7, §4.5 (Language entity), IA §6.5 S2, UF-17, UF-14 (language selectors), API List API-0807.

**Endpoint:**
```
GET /v1/languages
```

**Purpose:** Return all languages configured in MioTranslate with their current status and coverage summary. Used by every language selector across the product (Group 3 translation creation, Group 4 publishing, Group 6 coverage reports, Group 7 search filters). Also serves the Language Management screen (IA S2). This is a product-wide read resource available to all roles.

**Authorization:** All roles.

---

#### 3.7.1 Query Parameters

| Parameter | Type | Default | Description |
|---|---|---|---|
| `status` | enum | `ACTIVE` | `ACTIVE` (default — operational roles should see only active languages), `INACTIVE`, `ALL` (for admin views). |
| `sortBy` | enum | `languageNameAsc` | `languageNameAsc` (default — alphabetical), `addedAtDesc` (most recently added first), `coverageDesc` (highest coverage first). |
| `includeCoverage` | boolean | `true` | Include `coverageSummary` in each language record. Set to `false` for lightweight lookups (e.g., language code/name dropdowns). |

---

#### 3.7.2 Response — 200 OK

```json
{
  "data": {
    "totalLanguages": 8,
    "items": [
      {
        "languageCode": "ar",
        "languageName": "Arabic",
        "direction": "RTL",
        "status": "ACTIVE",
        "addedAt": "2026-07-01T08:00:00Z",
        "addedBy": "user:admin-deepa",
        "coverageSummary": {
          "totalActiveTags": 4200,
          "approvedCount": 3864,
          "coveragePercentage": 92.0
        }
      },
      {
        "languageCode": "hi",
        "languageName": "Hindi",
        "direction": "LTR",
        "status": "ACTIVE",
        "addedAt": "2026-07-01T08:00:00Z",
        "addedBy": "user:admin-deepa",
        "coverageSummary": {
          "totalActiveTags": 4200,
          "approvedCount": 4032,
          "coveragePercentage": 96.0
        }
      }
    ]
  },
  "pagination": {
    "nextPageToken": null,
    "pageSize": 50
  }
}
```

---

#### 3.7.3 Business Rules

| Rule | Source | Enforcement |
|---|---|---|
| Available to all roles | API List: "Primary Actor: All roles" | No role restriction. Any authenticated user may call this endpoint. |
| Default `status: ACTIVE` | API Design | Operational roles only need active languages. Admin views use `status: ALL`. |
| `coverageSummary` sourced from Group 5 precomputed coverage table | API Design | Same source as API-0601/API-0602 (Group 6). Aggregate `coveragePercentage` is a system-wide average. `computedAt` is not surfaced here — freshness is not a concern at the language-list level. |
| `coverageSummary: null` when coverage not yet computed | API Design | Language was just added; API-0506 slot creation in progress; API-0503 has not yet run. Not an error. |
| Deactivated language excluded by default | API Design | `status: ACTIVE` default means INACTIVE languages are hidden from operational selectors. |
| `addedBy` and `addedAt` omitted for non-ADMIN/FN callers | API Design (FINDING-011 resolution) | `addedBy` and `addedAt` are internal governance fields. They are included in the API-0807 response **only when the caller holds ADMIN or FN role**. For all other roles (PM, QA, LR, SR, DEV), these two fields are omitted from each language object in the response. This is enforced at the API layer, not at the UI layer. The language list (languageCode, languageName, direction, status, coverageSummary) is the same for all roles. |
| Empty list is not an error | API Design | `totalLanguages: 0`, `items: []`. Appropriate on a freshly initialized system before any language is configured. |

---

#### 3.7.4 Error Catalogue

| HTTP | Code | Condition |
|---|---|---|
| 422 | `INVALID_VALUE` on `status` | Not `ACTIVE`, `INACTIVE`, or `ALL`. |
| 422 | `INVALID_VALUE` on `sortBy` | Not a valid sort option. |

---

## 4. System Side-Effects

### 4.1 API-0802 → API-0506 (Create Empty Translation Slots)

When `POST /v1/admin/languages` succeeds, the system immediately triggers Group 5 API-0506. This side-effect is asynchronous and potentially large (thousands of new translation slots across all active tags). The response body's `slotCreation.status: IN_PROGRESS` field signals this. See Group 5 §3.6 for the complete API-0506 contract.

**Downstream effects of API-0506:**
- Each active tag gets a `NO_TRANSLATION` slot for the new language.
- API-0503 (Recalculate Coverage) is triggered for all `(pageId, new language)` pairs.
- Coverage dashboard immediately shows 0% for the new language.

### 4.2 All Write APIs → API-0505 (Create Audit Record)

Every write operation in Group 8 produces an immutable audit record per Group 5 API-0505. The mapping:

| Source API | Audit Action | Before/After |
|---|---|---|
| API-0802 (Add Language) | `LANGUAGE_ADDED` | `beforeValue: null`, `afterValue: languageCode` |
| API-0803 (Deactivate Language) | `LANGUAGE_DEACTIVATED` | `beforeValue: ACTIVE`, `afterValue: INACTIVE` |
| API-0804 (Assign/Update Role) | `USER_ROLE_ASSIGNED` or `USER_ROLE_MODIFIED` | `beforeValue: [previous roles]`, `afterValue: [new roles]` |
| API-0806 (Update Config) | `SYSTEM_CONFIG_CHANGED` | `beforeValue: {old values}`, `afterValue: {new values}` per changed field |

---

## 5. Cross-Group Consistency Audit

### 5.1 Group 1 (Page & Tag Registry) — Consistency

| Concern | Check Result |
|---|---|
| Language status check in tag creation | ✅ Group 1 API-0102 does not need to check language status — it creates tag records independently. Translation slots for inactive languages are not created (API-0506 skips INACTIVE languages). |
| `totalActiveTags` used in slotCreation response | ✅ Same definition as Group 1: count of tags where `status != DEPRECATED`. |
| No Group 1 mutations from Group 8 | ✅ Group 8 does not modify any Page or Tag records. |

---

### 5.2 Group 3 (Translation) — Consistency

| Concern | Check Result |
|---|---|
| `bulkApprovalConfidenceThreshold` read by API-0305 | ✅ API-0305 (Bulk Approve) reads the threshold from the configuration store updated by API-0806. If API-0806 changes the threshold, the next API-0305 call uses the new value. No caching inconsistency is introduced — API-0805/0806 is the single source. |
| INACTIVE language blocks translation creation | ✅ API-0301, API-0302, API-0303 must check language status before processing. INACTIVE language returns `LANGUAGE_INACTIVE` error. This is a Group 3 enforcement concern, consistent with FRD §7 Rule 24. |
| Group 3 behaviour during API-0506 initialization window | ✅ Defined in §3.2.3. During the window between API-0802 returning 201 and API-0506 completing the `NO_TRANSLATION` slot batch: if API-0301 (Generate Translation) is called for a tag that does not yet have a slot for the new language, the behaviour is equivalent to `NO_TRANSLATION` — the operation may proceed and the slot is created as a side-effect. API-0302 (Bulk Translate) operates on whichever slots already exist; the remainder are filled by the ongoing API-0506 batch. No undefined state. The language being ACTIVE is the correct gate — slot existence is not an additional gate. |

---

### 5.3 Group 4 (Publishing & Deployment) — Consistency

| Concern | Check Result |
|---|---|
| Environment endpoint URLs updated by API-0806 | ✅ Group 4 API-0405 and API-0407 read endpoint URLs from the configuration store. API-0806 updates take immediate effect. No restart is required. This is the designed mechanism. |
| INACTIVE language blocks publishing | ✅ API-0405 must check language status. Publishing to an INACTIVE language returns `LANGUAGE_INACTIVE`. Consistent with FRD §7 Rule 24. |

---

### 5.4 Group 5 (Audit & System-Triggered) — Consistency

| Concern | Check Result |
|---|---|
| API-0802 triggers API-0506 | ✅ Exactly as documented in Group 5 §3.6. API-0506 creates `NO_TRANSLATION` slots for all active tags × new language. This is the authoritative side-effect chain. |
| All write APIs produce audit records | ✅ API-0802, API-0803, API-0804, API-0806 each trigger API-0505 with the appropriate action and before/after values. Audit actions (`LANGUAGE_ADDED`, `LANGUAGE_DEACTIVATED`, `USER_ROLE_ASSIGNED`, `USER_ROLE_MODIFIED`, `SYSTEM_CONFIG_CHANGED`) match the Group 5 §2.1.1 audit action catalogue exactly. |
| API-0801, API-0805, API-0807 are read-only — no audit records | ✅ Group 5 §3.5.2: "Read-only operations (GET) do not produce audit records." All three are GET only. |

---

### 5.5 Group 6 (Visibility & Reporting) — Consistency

| Concern | Check Result |
|---|---|
| `coverageSummary` in API-0807 | ✅ Sourced from the same Group 5 precomputed coverage table (API-0503) as Group 6 API-0601/API-0602. No competing coverage metric. |
| New language appearing in Coverage Dashboard | ✅ After API-0802 + API-0506 + API-0503, the new language appears in API-0601 coverage matrix at 0%. No special handling needed in Group 6; it reads from the same coverage table. |

---

### 5.6 Group 7 (Search & Navigation) — Consistency

| Concern | Check Result |
|---|---|
| Language status affects search filters | ✅ API-0701 Global Search `module` filter is independent of language. Language-scoped filters in other UIs should use API-0807 `status: ACTIVE` to populate the dropdown. No conflict. |
| No Group 7 mutations from Group 8 | ✅ Group 8 does not modify search indexes, bookmarks, or recently-edited records. |

---

### 5.7 Cross-Group Issues Found

| Issue ID | Classification | Description |
|---|---|---|
| **CG-G8-01** | Runtime Dependency | Group 3 (API-0301, API-0302, API-0303, API-0305) and Group 4 (API-0405, API-0407) must perform live language status checks at request time using the Group 8 language registry. This check must not be cached indefinitely — a deactivation via API-0803 must be observable within a short window (e.g., seconds, not minutes). Engineering must define the acceptable staleness bound for language status reads. The initialization window (§3.2.3) is distinct from this: during initialization the language IS ACTIVE, which is the correct gate for Group 3/4 operations. |
| **CG-G8-02** | Configuration Dependency | Group 3 API-0305 (Bulk Approve) reads `bulkApprovalConfidenceThreshold` from the Group 8 configuration store. If this value is cached at the Group 3 service level, a change via API-0806 may not take effect immediately. Engineering should treat this as a read-through value with no caching or a very short TTL (< 30 seconds). |
| **CG-G8-03** | No New Source of Truth | Group 8 is the authoritative source for: (a) language registry, (b) user role assignments, (c) system configuration. No other group maintains a separate copy of any of these. These three stores are exclusively Group 8 property and are consumed by other groups via read. This is correct and intentional — one source, many consumers. |
| **CG-G8-04** | Language Name Immutability | `languageName` is immutable in v1 (§3.2.1, §2.2). No Group 1–7 API stores or indexes `languageName` independently — all display the name by reading from the Group 8 language registry at display time. No cascading update problem exists because there is no mutation path. If `languageName` mutability is required in a future version, a new API entry must be approved and cross-group impact assessed. |
| **CG-G8-05** | Governance Safety (Role Management) | API-0804 enforces a system-wide zero-authority guard (§3.4.4): no role change is permitted that would result in zero users holding ADMIN or FN authority. This guard is enforced at the API layer. The authorization enforcement layer (ED-G8-01) reads from the same role store, so the guard and the enforcement are consistent by design. |

---

## 6. RBAC Summary

| API | Write? | Authorization |
|---|---|---|
| API-0801 List Users and Roles | No | ADMIN, FN |
| API-0802 Add Language | Yes | ADMIN, FN |
| API-0803 Deactivate Language | Yes | ADMIN, FN |
| API-0804 Assign or Update User Role | Yes | ADMIN, FN |
| API-0805 Get System Configuration | No | ADMIN, FN |
| API-0806 Update System Configuration | Yes | ADMIN, FN |
| API-0807 List Languages | No | **All roles** |

---

## 7. Engineering Dependencies

| ID | Dependency | Impact if Not Met |
|---|---|---|
| **ED-G8-01** | **Requirement:** Role enforcement must be applied at request time on every API call across all groups, reading from the Group 8 role assignment store. Role reads must have a TTL ≤ 30 seconds or no caching. A role removal via API-0804 must be observable by the authorization layer within 30 seconds. This is a governance requirement (FRD §5.7: "permissions effective immediately"), not a performance suggestion. | A revoked user retains permissions beyond the deactivation event. Security and governance risk. |
| **ED-G8-02** | **Requirement:** Language status must be checked at request time by Group 3 and Group 4 APIs before operating on a language. Language status reads must have a TTL ≤ 30 seconds or no caching. A deactivation via API-0803 must be observable by Group 3/4 within 30 seconds (see CG-G8-01). This is a governance requirement, not a performance suggestion. | A deactivated language continues to accept new translations or publishing — violating FRD §7 Rule 24. |
| **ED-G8-03** | **Requirement:** API-0806 `bulkApprovalConfidenceThreshold` must be read by API-0305 (Bulk Approve) with a TTL ≤ 30 seconds or no caching (see CG-G8-02). A threshold change via API-0806 must take effect within 30 seconds. This is a governance requirement — the threshold controls whether AI-generated translations can bypass human review at scale. | Bulk approval continues to use a stale threshold after an admin changes it — undermining the governance model. |

---

## 8. Endpoint Summary

| API ID | Method | URL | Purpose | Auth |
|---|---|---|---|---|
| **API-0801** | `GET` | `/v1/admin/users` | List all users and their role assignments | ADMIN, FN |
| **API-0802** | `POST` | `/v1/admin/languages` | Add a new language | ADMIN, FN |
| **API-0803** | `PATCH` | `/v1/admin/languages/{languageCode}/deactivate` | Deactivate a language | ADMIN, FN |
| **API-0804** | `PUT` | `/v1/admin/users/{userId}/roles` | Assign or update a user's complete role set | ADMIN, FN |
| **API-0805** | `GET` | `/v1/admin/config` | Get current system configuration | ADMIN, FN |
| **API-0806** | `PATCH` | `/v1/admin/config` | Update system configuration settings | ADMIN, FN |
| **API-0807** | `GET` | `/v1/languages` | List all configured languages (product-wide lookup) | All roles |

---

*End of Group 8 API Design Specification — v1.0 (Locked).*
