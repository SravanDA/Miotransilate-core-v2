# MioTranslate API Design — Group 5: System-Triggered Behaviours

**Product:** MioTranslate  
**Document Type:** API Design Specification — **LOCKED**  
**Scope:** Group 5 — System-Triggered Behaviours (API-0501 through API-0506)  
**Source Documents:** Approved API List (Domain 5), FRD §4.4/§4.11/§5.2/§5.5/§5.6/§5.7/§7/§8/§12/§13, Features F-05/F-10/F-16/F-17/F-20/F-21, User Flows UF-03/UF-08/UF-10/UF-14/UF-17, Group 1 (locked), Group 2 (working), Group 3 (working), Group 4 (working)  
**Audience:** Backend Engineering, API Architecture, QA  
**Date:** August 2026  
**Prerequisites:** Group 1 locked baseline conventions; Group 2 English copy state model and API-0203; Group 3 Translation resource, staleInfo canonical model, and API-0304; Group 4 release record and API-0405

---

## 1. Group 5 Context

### 1.1 What Group 5 Covers

Group 5 defines the complete specification for **system-initiated operations** — behaviours triggered automatically by events in other domains, not by direct user action. These are internal service operations that execute as side-effects of user-initiated API calls.

| API ID | Name | Trigger | Scope |
|---|---|---|---|
| **API-0501** | Flag Translations as Stale | API-0203 (English copy approved, text changed) | One tag, all active languages |
| **API-0502** | Implicit Dev Publishing | API-0203 or API-0304 approval — per-trigger scope defined in §3.2 | One page, one language, DEV environment (per execution) |
| **API-0503** | Recalculate Coverage | Nine events across five domains | Per page, per language (affected scope) |
| **API-0504** | Dispatch Notification | Every significant write event | Per event, per target role |
| **API-0505** | Create Audit Record | Every write operation (cross-cutting) | Per action |
| **API-0506** | Create Empty Translation Slots | API-0802 (Add Language) | All currently active tags, new language only |

These operations:
- Run server-side as internal service calls, not client-initiated HTTP requests.
- Are documented here as full API contracts to give engineering, QA, and architecture a complete behaviour specification.
- Must **never silently fail** where they affect data integrity — particularly API-0505 (audit records) and the state transitions in API-0501.

---

### 1.2 Baseline Conventions Inheritance

Group 5 inherits all conventions from Group 1 §1 without modification. Internal service calls use the same data models, enum vocabularies, audit patterns, and error classification rules as user-facing APIs.

---

### 1.3 System Event Cascade Model

```
User Action
   │
   ├── API-0203: English Copy Approved (text changed)
   │       ├── API-0501: Flag Translations as Stale  ──► API-0504: Notify LRs (TRANSLATION_STALE_FLAGGED)
   │       │                                              API-0505: Audit per language (TRANSLATION_STALE_FLAGGED)
   │       │                                              API-0503: Recalculate Coverage (stale counts change)
   │       └── API-0502: Implicit Dev Publishing     ──► API-0405: Execute Publishing (for each eligible language)
   │               (for each active language that           API-0503: Recalculate Coverage (on success)
   │                has APPROVED translation for this       API-0504: Notify advisory (PAGE_BUNDLE_AUTO_PUBLISHED)
   │                page — see §3.2.2)                      API-0505: Audit (PAGE_BUNDLE_AUTO_PUBLISHED)
   │
   ├── API-0304: Translation Approved
   │       └── API-0502: Implicit Dev Publishing     ──► API-0405: Execute Publishing (for the approved language)
   │               (for the specific language just           API-0503, API-0504, API-0505 (same as above)
   │                approved — see §3.2.3)
   │
   ├── Any write operation (create/update/approve/reject/publish/rollback/deprecate)
   │       └── API-0505: Create Audit Record (mandatory, synchronous with primary write)
   │
   ├── Any significant event per FRD §12
   │       └── API-0504: Dispatch Notification (async, non-blocking)
   │
   ├── Translation approved / stale / tag created / deprecated / page published / language added
   │       └── API-0503: Recalculate Coverage (async, triggered per affected scope)
   │
   └── API-0802: Add Language
           └── API-0506: Create Empty Translation Slots ──► API-0505: Audit (TRANSLATION_SLOT_CREATED batch)
                                                            API-0503: Recalculate Coverage (new language, all pages)
```

> **Note on new tag slot creation (Group 1 side-effect):** When API-0102 creates a new tag, NO_TRANSLATION slots for all currently active languages are created as part of the tag creation operation itself (a Group 1 internal side-effect), not through API-0506. API-0506 is exclusively for the "new language → all existing active tags" direction. See §3.6 and CG-G5-03.

---

## 2. Resource Models

### 2.1 Audit Record Resource

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
  "performedBy": "user:lr-ahmed",
  "performedAt": "2026-08-21T14:35:00Z",
  "details": "Translation approved after manual edit. Confidence: 97%.",
  "beforeValue": "بيع",
  "afterValue": "بيع سريع",
  "correlationId": "req_abc123xyz"
}
```

| Field | Type | Description |
|---|---|---|
| `auditRecordId` | string | System-generated unique identifier. Immutable. |
| `action` | enum | The action taken. See §2.1.1 for full catalogue. |
| `subject` | object | What was acted upon. Includes `type` (`ENGLISH_COPY`, `TRANSLATION`, `PAGE`, `TAG`, `RELEASE`, `LANGUAGE`, `USER_ROLE`, `SYSTEM_CONFIG`, `IMPORT_EVENT`, `COMMENT`) plus the relevant identity fields for that type. |
| `performedBy` | string | User ID, or `system:{operation}` for system-triggered actions. |
| `performedAt` | string (ISO 8601) | Timestamp of the action. Immutable. |
| `details` | string | Human-readable description of the specific event. |
| `beforeValue` | string \| null | The value before the action (for content changes). Null for creation events. |
| `afterValue` | string \| null | The value after the action. |
| `correlationId` | string \| null | The request ID that triggered this audit record. Enables end-to-end tracing from user action to system side-effects. |

#### 2.1.1 Audit Action Catalogue

All values are SCREAMING_SNAKE_CASE per Group 1 §1.2. Defined by FRD F-17:

| Category | Action Values |
|---|---|
| **Page** | `PAGE_CREATED`, `PAGE_METADATA_UPDATED`, `PAGE_DEPRECATED` |
| **Tag** | `TAG_CREATED`, `TAG_METADATA_UPDATED`, `TAG_DEPRECATED` |
| **English Copy** | `ENGLISH_COPY_CREATED`, `ENGLISH_COPY_EDITED`, `ENGLISH_COPY_SUBMITTED_FOR_REVIEW`, `ENGLISH_COPY_APPROVED`, `ENGLISH_COPY_REJECTED`, `ENGLISH_COPY_RETURNED_FOR_REVISION`, `ENGLISH_COPY_ESCALATED` |
| **Translation** | `TRANSLATION_CREATED`, `TRANSLATION_EDITED`, `TRANSLATION_SUBMITTED_FOR_REVIEW`, `TRANSLATION_APPROVED`, `TRANSLATION_REJECTED`, `TRANSLATION_RETURNED_FOR_REVISION`, `TRANSLATION_STALE_FLAGGED`, `TRANSLATION_STALE_CONFIRMED`, `TRANSLATION_STALE_RETRANSLATED`, `TRANSLATION_SLOT_CREATED` |
| **Publishing** | `PAGE_BUNDLE_PUBLISHED`, `PAGE_BUNDLE_PUBLISH_FAILED`, `PAGE_BUNDLE_ROLLED_BACK`, `PAGE_BUNDLE_AUTO_PUBLISHED` |
| **Publishing Approval** | `PUBLISHING_APPROVAL_REQUESTED`, `PUBLISHING_APPROVAL_GRANTED`, `PUBLISHING_APPROVAL_REJECTED`, `PUBLISHING_APPROVAL_EXPIRED`, `PUBLISHING_APPROVAL_CANCELLED` |
| **Administration** | `LANGUAGE_ADDED`, `LANGUAGE_DEACTIVATED`, `USER_ROLE_ASSIGNED`, `USER_ROLE_MODIFIED`, `SYSTEM_CONFIG_CHANGED` |
| **Migration** | `MIGRATION_STARTED`, `MIGRATION_COMPLETED`, `MIGRATION_FAILED` |

---

### 2.2 Notification Resource

```json
{
  "notificationId": "notif_20260821_143500_xyz789",
  "event": "TRANSLATION_STALE_FLAGGED",
  "recipientUserId": "user:lr-ahmed",
  "recipientRole": "LR",
  "subject": {
    "tagId": "QUICK_1",
    "pageId": "QUICK",
    "language": "ar"
  },
  "message": "Translation for QUICK_1 (Quick Sale, Arabic) has been flagged Stale. The English copy was updated.",
  "actionUrl": "/pages/QUICK/tags/QUICK_1?language=ar",
  "status": "UNREAD",
  "createdAt": "2026-08-21T14:35:00Z",
  "readAt": null
}
```

| Field | Type | Description |
|---|---|---|
| `notificationId` | string | System-generated unique identifier. |
| `event` | enum | The notification event type. See §4.2 for full catalogue. |
| `recipientUserId` | string | The specific user this notification is addressed to. |
| `recipientRole` | string | The role under which this user was notified. |
| `subject` | object | Context of the notification (tag, page, language as applicable). |
| `message` | string | Human-readable notification message. |
| `actionUrl` | string \| null | Deep link to the relevant screen in MioTranslate. |
| `status` | enum | `UNREAD`, `READ`. |
| `createdAt` | string (ISO 8601) | When the notification was created. |
| `readAt` | string (ISO 8601) \| null | When the user marked it read. |

---

### 2.3 Coverage Metrics Resource

```json
{
  "pageId": "QUICK",
  "language": "ar",
  "computedAt": "2026-08-21T14:35:00Z",
  "totalActiveTags": 38,
  "approvedAndDeployedToProduction": 35,
  "coveragePercentage": 92.1,
  "approvedNotYetDeployedToProduction": 1,
  "pendingReviewCount": 1,
  "draftCount": 0,
  "staleCount": 1,
  "noTranslationCount": 1
}
```

| Field | Type | Description |
|---|---|---|
| `pageId` | string | Page identifier. |
| `language` | string | Language code. |
| `computedAt` | string (ISO 8601) | Timestamp of last successful coverage computation. |
| `totalActiveTags` | integer | Count of non-deprecated active tags on the page. Denominator for coverage %. |
| `approvedAndDeployedToProduction` | integer | Tags with APPROVED translation deployed to Production (including STALE but deployed — FRD F-16). Numerator for coverage %. |
| `coveragePercentage` | float | `(approvedAndDeployedToProduction / totalActiveTags) × 100`. Rounded to 1 decimal. Zero when `totalActiveTags == 0` (not computed — FRD §5.6). |
| `approvedNotYetDeployedToProduction` | integer | Tags APPROVED in MioTranslate but not yet published to Production. |
| `pendingReviewCount` | integer | Tags in PENDING_REVIEW state for this language. |
| `draftCount` | integer | Tags in DRAFT state for this language. |
| `staleCount` | integer | Tags in STALE state for this language. Counted in numerator as deployed-but-needs-attention (FRD F-16). |
| `noTranslationCount` | integer | Tags with NO_TRANSLATION for this language. |

---

## 3. API Specifications

### API-0501: Flag Translations as Stale

> **Source:** FRD §5.2, §7 Rule 5, F-05, F-10, Business Rule 5, UF-03 system behaviour, UF-08, API List API-0501.

**Trigger:** Executed by the system immediately after **API-0203 (Review English Copy)** successfully approves a new English copy version — but **only when the newly approved text differs from the previously approved text**.

---

#### 3.1.1 Critical Triggering Condition

Stale flagging is triggered by **text change**, not by every approval event:

```
if (newApprovedText == previousApprovedText) → skip stale flagging (no-op)
if (newApprovedText != previousApprovedText) → proceed with stale flagging
```

If English copy was rejected, returned, and re-approved at the same text (no substantive change), translations must not be flagged stale. This prevents unnecessary reviewer interruption.

**Edge case — English changes a second time while stale is unresolved:** If API-0203 approves yet another new English version while translations are already `STALE`, stale flagging is triggered again. The existing `staleInfo` on the live state record is updated to reference the newest English version (`currentEnglishVersion`, `currentEnglishText`). **This update touches only the live state record's `staleInfo` metadata — it never mutates any historical version snapshot.** See §3.1.5.

---

#### 3.1.2 Per-Translation State Transition Rules

| Prior Translation State | Action | Resulting State | Stale `previousStatus` |
|---|---|---|---|
| `NO_TRANSLATION` | Skip | Unchanged | N/A |
| `DRAFT` | Flag stale | `STALE` | `DRAFT` |
| `PENDING_REVIEW` | Flag stale | `STALE` | `PENDING_REVIEW` |
| `APPROVED` | Flag stale | `STALE` | `APPROVED` |
| `STALE` (already stale) | Update `staleInfo.currentEnglishVersion` and `staleInfo.currentEnglishText` only | `STALE` (unchanged) | Preserved from original flagging |

For the already-`STALE` case: Only the live state record's `staleInfo.currentEnglishVersion` and `staleInfo.currentEnglishText` are updated to point to the newest English version. The `staleInfo.previousEnglishVersion`, `staleInfo.previousEnglishText`, `staleInfo.staleSince`, and `staleInfo.previousStatus` remain as they were from the original flagging. No new version snapshot is created. No duplicate audit record is created.

---

#### 3.1.3 Stale State Representation — Group 3 Canonical Model

API-0501 populates the `staleInfo` object on the translation's live state record as defined by the **Group 3 canonical translation resource** (Group 3 §2.2). Group 5 uses this model without modification:

```json
{
  "status": "STALE",
  "staleInfo": {
    "previousStatus": "APPROVED",
    "staleSince": "2026-08-21T11:00:00Z",
    "previousEnglishVersion": 2,
    "previousEnglishText": "Quick Sale",
    "currentEnglishVersion": 3,
    "currentEnglishText": "Quick Checkout"
  }
}
```

| `staleInfo` Field | Meaning |
|---|---|
| `previousStatus` | State before becoming stale: `APPROVED`, `PENDING_REVIEW`, or `DRAFT`. Used by Group 3 stale resolution (API-0306 Confirm Stale) to restore the correct prior state on resolution. |
| `staleSince` | Timestamp when this translation was flagged stale by API-0501. |
| `previousEnglishVersion` | English version the translation was based on when it was flagged. |
| `previousEnglishText` | English copy text at `previousEnglishVersion`. Provides diff context for the reviewer. |
| `currentEnglishVersion` | The newest approved English version that triggered staleness. |
| `currentEnglishText` | The newest approved English copy text. |

> **Model alignment:** Group 5 uses `staleInfo.previousStatus` (Group 3 canonical field) for prior workflow state, not any separate `priorWorkflowState` or `stalenessReferencedEnglishVersion` field. There is one stale model, defined in Group 3 §2.2, populated by API-0501.

---

#### 3.1.4 Batch Operation Semantics

- Processed across all active languages for the affected tag.
- Languages are processed independently (FRD §7 Rule 7).
- If one language fails, the system logs and continues for remaining languages.
- A partial failure is observable: the language record includes `staleFlagStatus` tracking.
- Failed languages must be retried.

**Idempotency:** If API-0501 is re-triggered for the same approval event (retry after partial failure), translations already in `STALE` state are updated for the newer English version if they reference an older version. No duplicate audit records are created for already-STALE translations.

---

#### 3.1.5 Version Immutability — Explicit Clarification

When the stale flagging update occurs:

1. **The live state record** (the mutable current state of the translation) has its `status` set to `STALE` and its `staleInfo` object populated.
2. **No historical version snapshot is touched.** The translation's version history (immutable snapshots in the version log) is never modified by API-0501. Historical version N remains 100% immutable with its original `sourceEnglishVersion`, `text`, `status` as `SUPERSEDED`, and all other fields unchanged (Group 3 §1.5).
3. **The "already STALE" update** — when a second English change occurs while a translation is already stale — updates only `staleInfo.currentEnglishVersion` and `staleInfo.currentEnglishText` on the live state record. This is a metadata update to the live state record, not a version bump. No new historical version snapshot is created, and the existing historical version N remains untouched.

This is the correct interpretation: `staleInfo` is live state context (on the mutable current-state record), not a historical version entry.

---

#### 3.1.6 Side Effects

| Side Effect | API | Condition |
|---|---|---|
| Audit record per language | API-0505 | One `TRANSLATION_STALE_FLAGGED` record per affected language (skipped for NO_TRANSLATION). For already-STALE updates, no new audit record — the existing stale flag was already recorded. |
| Notification to LRs | API-0504 | One notification per Localization Reviewer for each affected language. Event: `TRANSLATION_STALE_FLAGGED`. |
| Coverage recalculation | API-0503 | One recalculation per affected language (stale count changes). |

---

#### 3.1.7 Outcome Record (Internal)

```json
{
  "triggeredBy": "api-0203",
  "correlationId": "req_abc123xyz",
  "tagId": "QUICK_1",
  "pageId": "QUICK",
  "newEnglishVersion": 4,
  "textChanged": true,
  "languagesProcessed": 5,
  "languagesFailed": 0,
  "results": [
    { "language": "ar", "priorStatus": "APPROVED",       "outcome": "FLAGGED_STALE" },
    { "language": "hi", "priorStatus": "PENDING_REVIEW", "outcome": "FLAGGED_STALE" },
    { "language": "ta", "priorStatus": "DRAFT",          "outcome": "FLAGGED_STALE" },
    { "language": "es", "priorStatus": "NO_TRANSLATION", "outcome": "SKIPPED" },
    { "language": "tr", "priorStatus": "STALE",          "outcome": "STALE_INFO_UPDATED" }
  ]
}
```

**Business Rules:**

| Rule | Source | Enforcement |
|---|---|---|
| Only text changes trigger stale | FRD §5.2 | Text comparison mandatory before flagging. |
| All active languages processed simultaneously | FRD §7 Rule 5, F-05 | Batch across all active languages. |
| Deployed stale translation remains live | FRD §7 Rule 6 | No Language Services call from API-0501. |
| `staleInfo` uses Group 3 canonical model | Group 3 §2.2 | One stale model, no competing fields. |
| `previousStatus` stored for resolution routing | Group 3 §2.2, API-0306 | Required for confirm-stale to return to correct prior state. |
| Version immutability preserved | FRD §7 Rule 21, Group 3 §1.5 | Live state record updated; historical version snapshots never mutated. |
| Language independence | FRD §7 Rule 7 | Per-language failure does not block other languages. |

---

### API-0502: Implicit Dev Publishing

> **Source:** FRD §17 Resolved ("approved content is automatically published to Dev"), UF-10 ALT-A, UX-10 EDGE CASE, API List API-0502. Full integration with Group 4 documented in Group 4 §4.

**Trigger:** Two distinct trigger sources. The scope of each invocation differs by trigger.

---

#### 3.2.1 Trigger Source and Scope Disambiguation

The fundamental product publishing scope is always 1 Page + 1 Language + 1 Environment (FRD §7 Rule 14). Implicit Dev Publishing respects this exactly — each invocation publishes one page + one language to DEV.

The two triggers differ in **which language(s) trigger a DEV publish attempt**:

| Trigger Source | What Changed | Which Language(s) Attempt DEV Publish |
|---|---|---|
| **API-0203** (English Copy Approved) | The English copy for a tag changed. All translations are now stale or will be stale (via API-0501). But some languages may **already have APPROVED translations** from before the English change. Those approved translations remain publishable — stale flagging is advisory. | **All active languages** that have at least one APPROVED translation for this page. Each language is evaluated independently. One separate DEV publish execution per eligible language. |
| **API-0304** (Translation Approved) | A single translation (one tag, one language) is now APPROVED. | **Only the specific language** just approved in API-0304. One DEV publish execution for that language. |

> **Why API-0203 triggers multi-language publishing:** English copy approval may not itself produce any new publishable translation. But it is the event after which the system must check whether any approved translations exist that should be pushed to DEV. If Arabic was already approved and deployed, and the English copy changes but Arabic is not yet stale (because API-0501 just ran), the DEV state may still be current. The eligibility check (condition 3 below) handles this — if the DEV state already matches, no publish is triggered.

---

#### 3.2.2 Publishing Conditions Checklist

For each candidate `(pageId, language)` derived from the trigger source, all of the following must be true before an Implicit DEV publishing execution begins:

| # | Condition | If False |
|---|---|---|
| 1 | At least one tag on the page has an `APPROVED` translation for this language | Skip — no publishable content |
| 2 | No publishing action (`IN_PROGRESS`) currently running for `(pageId, language, DEV)` | Skip — concurrent publish guard |
| 3 | Current approved bundle hash differs from last successful DEV deployment hash for this scope | Skip — already current, no-op |
| 4 | The language is active | Skip |
| 5 | The page is active (not deprecated) | Skip |

All five conditions failing is a deliberate no-op, not an error. DEV publishing proceeds only when content to publish actually exists and differs from what's already deployed.

> **Note on STALE translations in the DEV bundle:** Stale translations are excluded from publishing bundles (Group 4 §3.5.1, FRD §11). An APPROVED translation that has been flagged STALE is no longer in APPROVED state — it is in STALE state. It is therefore excluded from the DEV bundle. Only translations currently in APPROVED state are included. This is consistent and intentional.

---

#### 3.2.3 Execution (Per Eligible Language)

When all conditions are met for a `(pageId, language)` pair:
1. System computes the current approved bundle — same bundle construction as Group 4 API-0402/API-0405.
2. System creates an internal approval record: `approvedBy: "system:auto-publish"`.
3. Calls Group 4 API-0405 (`Execute Publishing`) with system-generated `Idempotency-Key`.
4. Release record created: `type: PUBLISH`, `publishedBy: "system:auto-publish"`.

The DEV-level approval authority is satisfied by the system acting as approver (FRD §17 resolved: DEV publishing is implicit). No separate human approval step for DEV.

**Idempotency for concurrent triggers:** If both API-0203 and API-0304 fire simultaneously for the same `(pageId, language)`, the `Idempotency-Key` derived from `(pageId, language, bundleSnapshotHash)` ensures only one DEV publish executes.

---

#### 3.2.4 Success and Failure Handling

**On success:**
- Release record: `type: PUBLISH`, `status: SUCCESSFUL`, `publishedBy: "system:auto-publish"`.
- Audit record: `PAGE_BUNDLE_AUTO_PUBLISHED` (API-0505).
- Advisory notification to the user whose action triggered this: "Content automatically published to Dev." (UX-10 advisory feedback — API-0504 event `PAGE_BUNDLE_AUTO_PUBLISHED`).
- Coverage recalculation triggered (API-0503).

**On failure (Language Services unreachable or failure response):**
- Release record: `type: PUBLISH`, `status: FAILED`, `publishedBy: "system:auto-publish"`.
- Audit record: `PAGE_BUNDLE_PUBLISH_FAILED`.
- PM and ADMIN notified (FRD §12 "Publishing failed" — API-0504 event `PUBLISHING_FAILED`).
- **No automatic retry.** User can manually initiate DEV publish via API-0403 → API-0404 → API-0405.

**Business Rules:**

| Rule | Source | Enforcement |
|---|---|---|
| DEV publishing is implicit upon approval conditions | FRD §17 Resolved | System acts as approver for DEV only. |
| Publishing scope is always 1 page + 1 language per execution | FRD §7 Rule 14 | Multi-language trigger from API-0203 results in separate per-language executions. |
| STALE translations excluded from DEV bundle | FRD §11, Group 4 §3.5.1 | Only APPROVED-state translations included. |
| Same release schema as manual publishing | Group 4 §2.1 | Identical release record format. |
| Advisory feedback shown to triggering user | UX-10 EDGE CASE | API-0504 notification or inline feedback. |
| Failure is PM/ADMIN alert, no auto-retry | FRD §12 | User initiates retry via manual publishing flow. |

---

### API-0503: Recalculate Coverage

> **Source:** FRD §5.6, F-16, §13.1/§13.2, API List API-0503.

**Trigger:** System-triggered by the following events:

| Trigger Event | Triggering API | Coverage Impact |
|---|---|---|
| Translation approved | API-0304 | Approved count may increase |
| Translation goes stale | API-0501 | Stale count changes; deployed count unchanged |
| Tag created | API-0102 | `totalActiveTags` increases; denominator changes |
| Tag deprecated | API-0107 | `totalActiveTags` decreases; denominator changes |
| Page bundle published to Production | API-0405 | `approvedAndDeployedToProduction` increases |
| Page bundle rolled back | API-0407 | `approvedAndDeployedToProduction` may decrease |
| Language added | API-0802 | New language coverage starts at 0% for all pages |
| Translation slot created (new tag → languages) | API-0102 side-effect | `noTranslationCount` increases |
| Translation slot created (new language → all tags) | API-0506 | New language coverage at 0% per page |

---

#### 3.3.1 Coverage Formula

From FRD §5.6 and F-16:

```
coveragePercentage = (tags with APPROVED translation deployed to Production) / (total active tags on page) × 100
```

**Operationally:**
- **Numerator:** Tags where the most recent successful Production release for `(pageId, language)` includes this tag in `contentSnapshot.tags[]` — i.e., it was in APPROVED state at publish time. STALE translations that are deployed to Production are explicitly included in the numerator (FRD F-16: "stale counted as approved but needs attention").
- **Denominator:** Count of tags where `status != DEPRECATED`.
- **Excluded:** Pages with zero active tags — no coverage record created (FRD §5.6).

---

#### 3.3.2 Coverage Scope Per Trigger

| Triggering Event | Recalculation Scope |
|---|---|
| Translation approved (API-0304) | `(pageId, language)` of the approved translation |
| Translation goes stale (API-0501) | `(pageId, language)` for each affected language |
| Tag created (API-0102) | `(pageId, all active languages)` — denominator changed |
| Tag deprecated (API-0107) | `(pageId, all active languages)` — denominator changed |
| Page published (API-0405) | `(pageId, language)` of the published release |
| Page rolled back (API-0407) | `(pageId, language)` of the rolled-back release |
| Language added (API-0802 + API-0506) | `(all active pages, new language)` — 0% for all pages |
| Translation slots created for new tag | `(pageId, all active languages)` — denominator changed |

---

#### 3.3.3 Computation Model

Coverage metrics are stored as **precomputed materialized values** per `(pageId, language)` — not computed on demand per request. Dashboard queries (API-0601, API-0602) aggregate across all pages × all languages and must be fast.

On trigger: system recomputes coverage for the affected `(pageId, language)` scope only. The `computedAt` timestamp is updated on success.

> **Engineering Dependency (ED-G5-01):** The coverage materialization strategy (precomputed table vs. event-driven update vs. read-through cache) is an implementation decision. This spec defines the triggering events and formula. The system must guarantee freshness within a reasonable window (FRD F-16: "near-real-time").

---

#### 3.3.4 Failure Handling

If coverage recalculation fails:
- Background retry scheduled.
- Previous coverage value remains visible (stale but not absent).
- `computedAt` reflects the last successful computation.
- No user-facing error — this is a background operation.

**Business Rules:**

| Rule | Source | Enforcement |
|---|---|---|
| Coverage formula exactly as FRD | FRD §5.6, F-16 | Denominator = active tags; numerator = approved and deployed to Production. |
| STALE deployed translations count in numerator | FRD F-16 | "Approved but needs attention." |
| Pages with 0 active tags excluded | FRD §5.6 | No coverage record for zero-tag pages. |
| Near-real-time update | FRD F-16 acceptance criteria | Coverage must update promptly after triggering events. |
| Language independence | FRD §7 Rule 7 | Each `(pageId, language)` computed independently. |

---

### API-0504: Dispatch Notification

> **Source:** FRD §12 (Notifications & Alerts — 11 defined events), API List API-0504.

**Trigger:** System-triggered by every significant write event across all domains.

---

#### 4.1 Notification Dispatch Model

**Delivery Mechanism:** Channel (email, in-app, push) is an infrastructure decision outside this spec. This spec defines the event, recipient role, and data contract. Notification records are always persisted to the notifications store (readable via API-0906).

**Failure Handling:**
- On delivery failure: system retries up to 3 times with exponential backoff.
- After 3 failures: notification record remains in store with `deliveryStatus: DELIVERY_FAILED`. User sees it on next login via API-0906.
- Delivery failure **must not block or roll back the primary operation** that triggered it. Notifications are dispatched asynchronously.

---

#### 4.2 Notification Event Catalogue

All 11 events from FRD §12:

| # | Event | Target Recipients | Triggering API | Purpose |
|---|---|---|---|---|
| 1 | `NEW_PAGE_OR_TAG_CREATED` | PM, QA | API-0101 / API-0102 | New tags need English copy. |
| 2 | `ENGLISH_COPY_SUBMITTED_FOR_REVIEW` | Assigned Reviewer (SR) | API-0202 | Action required: review English copy. |
| 3 | `ENGLISH_COPY_APPROVED` | Author (PM/QA who submitted) | API-0203 | Submission approved; translation can begin. |
| 4 | `ENGLISH_COPY_REJECTED_OR_RETURNED` | Author (PM/QA who submitted) | API-0203 / API-0203 (return) | Submission needs revision. |
| 5 | `TRANSLATION_READY_FOR_REVIEW` | Localization Reviewer(s) for the language | API-0309 | Action required: review translation. |
| 6 | `TRANSLATION_APPROVED` | PM | API-0304 | Translation ready for publishing. |
| 7 | `ENGLISH_COPY_CHANGED_STALE_TRIGGER` | All Localization Reviewers for affected languages | API-0501 (via API-0203) | Translations may need updating. |
| 8 | `ITEM_ESCALATED_TO_FOUNDER` | Founder | API-0203 (escalation action) | Action required: Founder review. |
| 9 | `PAGE_BUNDLE_PUBLISHED_TO_PRODUCTION` | PM, Support Reviewer | API-0405 (PRODUCTION environment) | Labels now live for salon teams. |
| 10 | `ROLLBACK_INITIATED` | PM, QA, Support Reviewer | API-0407 | Previous version restored. |
| 11 | `PUBLISHING_FAILED` | PM, Administrator | API-0405 (FAILED) / API-0502 (FAILED) | Action required: investigate and retry. |

---

#### 4.3 Recipient Resolution

| Target Role Description | Resolution |
|---|---|
| "PM" | All users with PM role |
| "QA" | All users with QA role |
| "Localization Reviewer(s) for affected language" | All users with LR role associated with the language (or all LRs if no language-specific assignment) |
| "Author (PM/QA who submitted)" | User ID stored on the English copy record as `submittedBy` |
| "Assigned Reviewer" | Reviewer in the review queue, or all SRs if no specific assignment |
| "Founder" | All users with FN role |
| "Support Reviewer" | All users with SR role |
| "Administrator" | All users with ADMIN role |

---

#### 4.4 Deduplication

If the same event would produce multiple notifications to the same user (e.g., user holds both PM and QA roles), only one notification is sent. Deduplication key: `(event, recipientUserId, subject.tagId|pageId)`.

**Business Rules:**

| Rule | Source | Enforcement |
|---|---|---|
| 11 events produce notifications | FRD §12 | Exhaustive for approved product. |
| Delivery failure does not block primary operation | API Design Requirement | Async dispatch; failure logged, not propagated. |
| Notification persisted even if delivery fails | API-0906 reads from store | Notification record always written. |
| Deduplication per user per event | API Design Recommendation | Prevents spam for multi-role users. |

---

### API-0505: Create Audit Record

> **Source:** FRD §4.11 (Audit Record entity), F-17 (Audit Trail), §7 Rules 19–21, API List API-0505.

**Trigger:** Executed by every write operation across all domains as a **mandatory, non-optional cross-cutting concern**. Audit record creation is the last step of every successful write operation.

---

#### 3.5.1 Product Guarantee vs Engineering Mechanism

**The Product Guarantee (absolute):** Every completed write operation in MioTranslate must produce an immutable, permanent audit record. A completed write with permanently missing audit history is a **system integrity fault**, not an acceptable outcome (FRD §7 Rules 19–21; FRD Non-Functional Requirement: Auditability).

**The Engineering Mechanism (implementation decision):** The product guarantee can be satisfied by either:
- **Synchronous in-transaction write:** Audit record is written within the same database transaction as the primary write. If audit write fails, the transaction rolls back — neither the primary data change nor the audit record is committed.
- **Guaranteed async retry with observable status:** The primary write commits. If audit record creation fails, the operation is marked with `auditStatus: PENDING_AUDIT`. A background process retries until the audit record is successfully written. The operation is not considered closed until the audit record exists. This path is acceptable only if the audit store failure is the sole failing component.

**What is not acceptable:** A write completes successfully, the audit record write fails, the failure is swallowed silently, and the audit record is permanently absent. This violates the product's auditability guarantee.

> **Engineering Dependency (ED-G5-02):** Engineering must choose one of the two above mechanisms. The choice has implications for consistency guarantees, transaction scope, and the audit store's reliability requirements. This spec mandates the outcome, not the implementation path.

---

#### 3.5.2 Complete Write API → Audit Action Mapping

Every mutating API in Groups 1–4 and Groups 6–8 triggers an audit record. The following is the complete, reconciled mapping:

**Group 1 — Pages & Tags:**

| Source API | Audit Action | Notes |
|---|---|---|
| API-0101 (Create Page) | `PAGE_CREATED` | |
| API-0102 (Create Tag) | `TAG_CREATED` | One record per tag. |
| API-0106 (Update Page Metadata) | `PAGE_METADATA_UPDATED` | Before/after values for updated fields. |
| API-0107 (Deprecate Tag) | `TAG_DEPRECATED` | If auto-deprecates page: also `PAGE_DEPRECATED`. |
| API-0108 (Update Tag Metadata) | `TAG_METADATA_UPDATED` | Before/after for Copy Type. |

**Group 2 — English Copy:**

| Source API | Audit Action | Notes |
|---|---|---|
| API-0201 (Save Draft) | `ENGLISH_COPY_CREATED` or `ENGLISH_COPY_EDITED` | Created on first save; Edited on subsequent saves. |
| API-0202 (Submit for Review) | `ENGLISH_COPY_SUBMITTED_FOR_REVIEW` | |
| API-0203 (Review — Approve) | `ENGLISH_COPY_APPROVED` | |
| API-0203 (Review — Reject) | `ENGLISH_COPY_REJECTED` | Rejection reason in details. |
| API-0203 (Review — Return) | `ENGLISH_COPY_RETURNED_FOR_REVISION` | Reviewer comment in details. |
| API-0203 (Review — Escalate) | `ENGLISH_COPY_ESCALATED` | |

**Group 3 — Translation:**

| Source API | Audit Action | Notes |
|---|---|---|
| API-0301 (Generate AI Single) | `TRANSLATION_CREATED` | `creationMethod: AI_GENERATED`. |
| API-0302 (Bulk AI Translate) | `TRANSLATION_CREATED` | One record per tag processed. |
| API-0303 (Manual Edit) | `TRANSLATION_EDITED` | Before/after translation text. |
| API-0304 (Review — Approve) | `TRANSLATION_APPROVED` | |
| API-0304 (Review — Edit & Approve) | `TRANSLATION_EDITED` + `TRANSLATION_APPROVED` | Two records for one API call: the edit, then the approval. |
| API-0304 (Review — Request Retranslation) | `TRANSLATION_CREATED` | New AI version creation. |
| API-0304 (Review — Reject) | `TRANSLATION_REJECTED` | Rejection reason in details. |
| API-0305 (Bulk Approve) | `TRANSLATION_APPROVED` × N | **One record per individually approved translation** (FRD F-09 acceptance criteria: "each approval is individually recorded"). |
| API-0306 (Confirm Stale) | `TRANSLATION_STALE_CONFIRMED` | Records which English version confirmed against. |
| API-0307 (Retranslate Stale) | `TRANSLATION_STALE_RETRANSLATED` | New AI version created. |
| API-0309 (Submit Translation for Review) | `TRANSLATION_SUBMITTED_FOR_REVIEW` | |

**Group 4 — Publishing & Deployment:**

| Source API | Audit Action | Notes |
|---|---|---|
| API-0403 (Request Approval) | `PUBLISHING_APPROVAL_REQUESTED` | |
| API-0404 (Approve) | `PUBLISHING_APPROVAL_GRANTED` | |
| API-0404 (Reject) | `PUBLISHING_APPROVAL_REJECTED` | Rejection reason in details. |
| API-0404 (Expired/Cancelled) | `PUBLISHING_APPROVAL_EXPIRED` or `PUBLISHING_APPROVAL_CANCELLED` | |
| API-0405 (Execute Publishing — success) | `PAGE_BUNDLE_PUBLISHED` | |
| API-0405 (Execute Publishing — failure) | `PAGE_BUNDLE_PUBLISH_FAILED` | Failure class and detail in record. |
| API-0407 (Execute Rollback) | `PAGE_BUNDLE_ROLLED_BACK` | Rollback reason, target version, rolled-back-from version. |

**Group 5 — System-Triggered:**

| Source API | Audit Action | Notes |
|---|---|---|
| API-0501 (Flag Stale) | `TRANSLATION_STALE_FLAGGED` | One per affected language. Not created for `NO_TRANSLATION` skips or already-STALE updates. |
| API-0502 (Implicit Dev Publish — success) | `PAGE_BUNDLE_AUTO_PUBLISHED` | |
| API-0502 (Implicit Dev Publish — failure) | `PAGE_BUNDLE_PUBLISH_FAILED` | |
| API-0506 (Create Empty Slots) | `TRANSLATION_SLOT_CREATED` | One batch-level record summarising how many slots were created for the new language (not one per slot). |

**Administration:**

| Source API | Audit Action | Notes |
|---|---|---|
| API-0802 (Add Language) | `LANGUAGE_ADDED` | |
| API-0803 (Deactivate Language) | `LANGUAGE_DEACTIVATED` | |
| API-0804 (Assign/Update Role) | `USER_ROLE_ASSIGNED` or `USER_ROLE_MODIFIED` | |
| API-0806 (Update System Config) | `SYSTEM_CONFIG_CHANGED` | Before/after values for changed settings. |

**Migration:**

| Source API | Audit Action | Notes |
|---|---|---|
| API-1002 (Execute Migration) | `MIGRATION_STARTED`, `MIGRATION_COMPLETED`, or `MIGRATION_FAILED` | |

> **Note on Comments (API-0901):** Comments are not audited via a separate `TRANSLATION_COMMENTED` action. Comments are themselves a permanent, non-deletable collaboration record (FRD F-18: "comments cannot be deleted"). The comment record is the audit. A redundant audit record would create duplicate history without additional information.

> **Note on Read-Only APIs:** Read-only operations (GET) do not produce audit records. No exceptions.

---

#### 3.5.3 Immutability Guarantee

Once written, an audit record has:
- No `DELETE` endpoint.
- No `PATCH` endpoint.
- No archival or expiry mechanism.
- No admin override capability.

The only permitted operation on audit records is **read** (via API-0904).

**Business Rules:**

| Rule | Source | Enforcement |
|---|---|---|
| Every write creates an audit record | FRD F-17 | Cross-cutting; enforced in each write API's execution path. |
| Audit records are permanent | FRD §7 Rule 21 | No delete, archive, or expiry. |
| A completed write with permanently missing audit is a system fault | FRD Auditability requirement | Must not be silently accepted. |
| Before/after values for content changes | FRD §4.11 | `beforeValue` and `afterValue` stored for every content mutation. |
| `performedBy` always attributable | FRD §7 Rule 10 | User ID or `system:{operation}`. |
| `correlationId` links to triggering request | API Design Recommendation | Enables end-to-end tracing. |
| Bulk approve = one record per translation | FRD F-09 acceptance criteria | Not one aggregate record. |
| Edit-and-Approve = two records | API Design Recommendation | Distinct events: TRANSLATION_EDITED, then TRANSLATION_APPROVED. |

---

### API-0506: Create Empty Translation Slots (New Language Direction)

> **Source:** FRD §5.7 Business Rule, WF-04, UF-17 (Add a New Language), API List API-0506.

**Trigger:** Executed immediately after **API-0802 (Add Language)** successfully creates a new language record.

**Scope:** This API covers only the **"new language → all existing active tags"** direction. The complementary **"new tag → all existing active languages"** direction is handled as an internal side-effect of Group 1 **API-0102 (Create Tag)**, not through API-0506. See CG-G5-03.

---

#### 3.6.1 Translation Slot Lifecycle — Both Directions Defined

The complete slot lifecycle is:

| Event | Direction | Owner |
|---|---|---|
| **New tag created** (API-0102) | One new tag → `NO_TRANSLATION` slots for all currently active languages | Group 1 API-0102 internal side-effect |
| **New language added** (API-0802) | One new language → `NO_TRANSLATION` slots for all currently active tags | Group 5 API-0506 |

Both directions produce slots in identical `NO_TRANSLATION` initial state. The mechanisms are complementary and non-overlapping. No tag should ever lack a translation slot for an active language; no language should ever lack a slot for an active tag.

> **Cross-Group Dependency (CG-G5-03):** Group 1 API-0102 must create `NO_TRANSLATION` translation slots for all currently active languages as part of tag creation. This is a Group 1 implementation requirement, not a separate Group 5 system API. Engineering must verify this side-effect is implemented in the API-0102 execution path. Coverage recalculation (API-0503) is triggered for `(pageId, all active languages)` when a tag is created.

---

#### 3.6.2 Created Slot Initial State

Each slot (both directions) is created with exactly:

```json
{
  "tagId": "QUICK_1",
  "pageId": "QUICK",
  "language": "ar",
  "status": "NO_TRANSLATION",
  "version": null,
  "text": null,
  "sourceEnglishVersion": null,
  "creationMethod": null,
  "confidenceScore": null,
  "backTranslation": null,
  "variableIntegrityStatus": null,
  "author": null,
  "authoredAt": null,
  "reviewedBy": null,
  "reviewedAt": null,
  "approvedBy": null,
  "approvedAt": null,
  "staleInfo": null,
  "createdAt": "2026-08-21T14:35:00Z",
  "createdBy": "system:language-add"
}
```

- Status is always `NO_TRANSLATION` on creation.
- All translation content fields are null — this is a placeholder that signals "this tag needs translation for this language."
- The slot is the unit that appears in coverage metrics as `noTranslationCount`.

---

#### 3.6.3 Scale and Batch Processing

This is potentially a large batch operation. The system must:
- Process in chunks (e.g., 500 tags per chunk).
- Track progress: the Language record's `slotCreationStatus` field: `PENDING`, `IN_PROGRESS`, `COMPLETED`, `PARTIAL_FAILURE`.
- Be retryable: re-execution creates only missing slots (idempotent).

---

#### 3.6.4 Idempotency

If API-0506 is re-executed after partial failure:
- For each tag: check if `(tagId, language)` slot already exists.
- If yes: skip (no-op).
- If no: create slot.

Re-execution is safe and does not produce duplicate slots.

---

#### 3.6.5 Partial Failure Handling

If slot creation fails for a subset of tags:
- Continue processing remaining tags.
- Record failed `tagId`s.
- Mark language `slotCreationStatus: PARTIAL_FAILURE` with list of failed IDs.
- Trigger background retry for failed slots.
- PM and ADMIN notified (advisory — language was still added successfully).

---

#### 3.6.6 Side Effects

| Side Effect | API | Condition |
|---|---|---|
| Audit record | API-0505 | `TRANSLATION_SLOT_CREATED` — one batch-level record, not one per slot |
| Coverage recalculation | API-0503 | For each `(pageId, new language)` after slots are created |
| No user notification | — | Slot creation is background infrastructure; no user action needed |

**Business Rules:**

| Rule | Source | Enforcement |
|---|---|---|
| Slots created for all active tags, all active pages | FRD §5.7 | Scope: `tag.status != DEPRECATED AND page.status != DEPRECATED`. |
| Initial state is NO_TRANSLATION | FRD §5.7, Group 3 state model | Empty placeholder, not DRAFT. |
| New tag → all-language slots is Group 1's responsibility | CG-G5-03 | API-0102 side-effect, not API-0506. |
| Large batch must be chunked and retryable | API List API-0506 | Batch processing required; partial failure retryable. |
| Idempotent | API Design Requirement | Re-execution must not create duplicate slots. |
| Deprecated tags excluded | FRD §7 Rule 23 | Active filter: `tag.status != DEPRECATED`. |

---

## 4. Cross-Group Consistency Audit

### 4.1 Group 3 (Translation) — Stale Model Consistency

| Concern | Check Result |
|---|---|
| `staleInfo` canonical model | ✅ Group 5 API-0501 uses Group 3 §2.2 `staleInfo` exactly. No competing fields. |
| `previousStatus` for resolution routing | ✅ `staleInfo.previousStatus` stored per Group 3 §2.2. API-0306 Confirm Stale uses it to restore correct prior state. |
| DRAFT → STALE preserves `previousStatus: DRAFT` | ✅ Handled in §3.1.2. |
| PENDING_REVIEW → STALE preserves `previousStatus: PENDING_REVIEW` | ✅ Handled in §3.1.2. |
| Already-STALE update changes only `staleInfo.currentEnglishVersion/Text` | ✅ §3.1.1 and §3.1.5 explicitly state no version snapshot is mutated. |
| Version immutability preserved | ✅ §3.1.5 explicitly separates live state record (mutable metadata) from historical version snapshots (immutable forever). |
| NO_TRANSLATION skipped | ✅ §3.1.2: explicitly skipped — no translation to flag. |

### 4.2 Group 4 (Publishing) — Publishing Consistency

| Concern | Check Result |
|---|---|
| Publishing scope = 1 page + 1 language per execution | ✅ §3.2.1 explicitly states one execution per eligible language. |
| STALE translations excluded from DEV bundle | ✅ §3.2.2 Note: STALE translations are not in APPROVED state; excluded per Group 4 §3.5.1. |
| Same release record schema | ✅ §3.2.3: identical release record format as Group 4 §2.1. |
| Failure = PM/ADMIN alert, no auto-retry | ✅ §3.2.4 consistent with Group 4 §4 (API-0502 intersection). |
| API-0502 trigger scope disambiguated | ✅ §3.2.1: API-0203 → all active languages with APPROVED translation for the page. API-0304 → only the approved language. |

### 4.3 Group 1 (Pages & Tags) — Registry Consistency

| Concern | Check Result |
|---|---|
| New tag → all-language slots (API-0102 side-effect) | ✅ §3.6.1 clarifies Group 1's responsibility. CG-G5-03 explicitly flags for engineering implementation. |
| Tag deprecation triggers coverage recalc | ✅ API-0107 → API-0503 for `(pageId, all active languages)`. |
| Page deprecation | ✅ Triggered when all tags deprecated via API-0107 auto-deprecate. Coverage calculation excluded for deprecated pages. |
| Audit completeness | ✅ API-0106 (`PAGE_METADATA_UPDATED`) and API-0108 (`TAG_METADATA_UPDATED`) added to §3.5.2. |

### 4.4 Group 2 (English Copy) — Consistency

| Concern | Check Result |
|---|---|
| English copy approval triggers API-0501 | ✅ Only on text change (§3.1.1). |
| English copy approval triggers API-0502 | ✅ For all active languages with APPROVED translation for the page (§3.2.2). |
| Audit for all English copy actions | ✅ §3.5.2 covers all API-0201/API-0202/API-0203 actions. |

### 4.5 Translation Slot Lifecycle — Complete Audit

| Scenario | Handler | Notes |
|---|---|---|
| New language added | API-0802 → API-0506 | All existing active tags get `NO_TRANSLATION` slots. |
| New tag created (languages already exist) | API-0102 internal side-effect | All active languages get `NO_TRANSLATION` slots. |
| Tag deprecated (existing slots) | Slots preserved in `DEPRECATED` visibility | Not deleted; excluded from active workflows. |
| Language deactivated (existing slots) | Slots preserved | History retained; no new slots created (FRD §7 Rule 24). |
| Re-execution of API-0506 (retry) | Idempotent: skip existing slots | §3.6.4. |

### 4.6 Coverage Calculation — Consistency Check

| Concern | Check Result |
|---|---|
| Formula matches FRD F-16 exactly | ✅ §3.3.1. |
| STALE deployed translations in numerator | ✅ §3.3.1 (FRD F-16: "approved but needs attention"). |
| New tag (both directions) triggers recalc | ✅ §3.3.2. |
| Rollback triggers recalc | ✅ §3.3.2. |

### 4.7 Audit Coverage — Complete Check

| Concern | Check Result |
|---|---|
| API-0106 (Update Page Metadata) | ✅ Added: `PAGE_METADATA_UPDATED`. |
| API-0108 (Update Tag Metadata) | ✅ Added: `TAG_METADATA_UPDATED`. |
| API-0309 (Submit Translation for Review) | ✅ Added: `TRANSLATION_SUBMITTED_FOR_REVIEW`. |
| API-0305 (Bulk Approve) — one record per translation | ✅ Explicitly stated: one `TRANSLATION_APPROVED` per translation, not one aggregate. |
| API-0304 (Edit and Approve) — two records | ✅ `TRANSLATION_EDITED` + `TRANSLATION_APPROVED`. |
| API-0901 (Comments) — no separate audit action | ✅ Justified in §3.5.2 Note: comments ARE the record (FRD F-18). |
| System-triggered actions | ✅ All API-0501/API-0502/API-0506 actions mapped. |
| Read-only APIs produce no audit records | ✅ Explicit note in §3.5.2. |

### 4.8 Cross-Group Issues Found

| Issue ID | Classification | Description |
|---|---|---|
| **CG-G5-01** | Schema Addition Required | Group 3 Translation resource §2.2 already defines `staleInfo.previousStatus`. Group 5 aligns to this. No modification to Group 3 needed — Group 5 was corrected to use Group 3's model. Confirmed: one model, zero competing fields. |
| **CG-G5-02** | Implementation Guidance | API-0505 audit guarantee requires engineering to choose synchronous-in-transaction or guaranteed-async-retry mechanism. Both preserve the product guarantee. Choice affects consistency and availability trade-offs. |
| **CG-G5-03** | Implementation Dependency on Group 1 | API-0102 (Create Tag) must include a side-effect that creates `NO_TRANSLATION` translation slots for all currently active languages as part of the tag creation execution. This is a Group 1 implementation requirement. It is not a new Group 5 API. Engineering must implement this in the API-0102 execution path and verify it in QA. |
| **CG-G5-04** | Documentation Gap in Group 3 | Group 3 §1.2 state definition for `NO_TRANSLATION` references "tag creation or language activation (API-0506)" but does not mention the API-0102 side-effect for new tags when languages exist. This is a documentation note, not a design conflict — behaviour is consistent, only the reference is incomplete in Group 3. |

---

## 5. RBAC — System-Triggered APIs

System-triggered APIs are executed as system service calls, not user-authenticated HTTP endpoints. No RBAC permission is required to trigger them — they are side-effects of permission-validated user actions.

Side-effects readable by users:
- Audit records (API-0904): all roles (FRD §8: "View audit trail: Yes for all roles").
- Notifications (API-0906): per-user only.
- Coverage metrics (API-0601/API-0602): PM, FN, LR per FRD §8.

---

## 6. Engineering Dependencies

| ID | Dependency | Impact if Not Met |
|---|---|---|
| **ED-G5-01** | Coverage precomputed materialized values must support near-real-time freshness (FRD F-16). Implementation strategy is an engineering decision. | Stale coverage values mislead planning decisions. |
| **ED-G5-02** | Audit record creation must satisfy the product guarantee: every completed write produces a permanent audit record. Engineering chooses synchronous-in-transaction or guaranteed async retry. Silent permanent audit gap is not acceptable. | Violates FRD auditability requirement and traceability guarantee. |
| **ED-G5-03** | API-0102 (Create Tag) must create `NO_TRANSLATION` translation slots for all currently active languages as a side-effect of tag creation. | New tags will have no translation representation for existing languages. Coverage calculations and language-filtered views will be incorrect. |

---

## 7. Endpoint Summary

Group 5 APIs are internal system operations. They do not have external user-facing URL paths.

| API ID | Operation | Trigger | Key Side Effects |
|---|---|---|---|
| **API-0501** | Flag Translations as Stale | API-0203 (text changed) | `staleInfo` set per language, Audit × N languages, Notification × LRs, Coverage recalc |
| **API-0502** | Implicit Dev Publishing | API-0203 (all languages with APPROVED translation) / API-0304 (specific language) | API-0405 per eligible language, Audit, Notification (advisory), Coverage recalc |
| **API-0503** | Recalculate Coverage | 9 triggering events | Updates precomputed coverage metrics for affected scope |
| **API-0504** | Dispatch Notification | Every significant write event per FRD §12 | Notification record persisted; delivery attempted async |
| **API-0505** | Create Audit Record | Every write operation | Immutable audit record persisted; must not silently fail |
| **API-0506** | Create Empty Translation Slots (new language direction) | API-0802 (Add Language) | NO_TRANSLATION slots for all active tags, Audit (batch), Coverage recalc |

---

*End of Group 5 API Design Specification — LOCKED.*
