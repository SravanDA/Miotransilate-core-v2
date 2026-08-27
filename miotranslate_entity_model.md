# MioTranslate — Canonical Entity Model

**Product:** MioTranslate  
**Document Type:** Entity Design Specification  
**Version:** 1.1 — Final (Corrected and Audited)  
**Author:** Principal Product Data Architect + Principal API Architect + Senior Domain Modeler  
**Date:** August 2026  

**Source Documents (Sources of Truth):**  
BRD, FRD (all sections), API List (Domains 1–10), API Design Groups 1–10 (locked), Post-Audit Resolution Walkthrough

---

## Revision History

| Version | Date | Changes |
|---|---|---|
| **v1.0** | Aug 2026 | Initial draft. |
| **v1.1** | Aug 2026 | Targeted correction pass (10 issues) + full entity-level consistency audit against all locked API Groups 1–10. See §11 for audit findings. |

---

> **Purpose of this document.**  
> This document defines the canonical, technology-independent entity model for MioTranslate. It is not a database design, a table schema, or an ORM mapping. It defines what business entities exist, what they are, how they are identified, who owns their lifecycle, what state they carry, and how they relate to one another.  
>  
> Every technology decision — relational schema, document store, indexes, query patterns — is downstream of this model. This document is the source of truth from which all persistence and query designs must be derived.

---

## 0. Entity Classification Framework

Before documenting individual entities, every candidate entity is classified by its domain role. This prevents collapsing fundamentally different concepts into tables prematurely.

| Classification | Definition | Examples in MioTranslate |
|---|---|---|
| **Core business entity** | A first-class concept with an independent identity, lifecycle, and state; the primary subject of business operations | Page, Tag, English Copy, Translation, Language |
| **Child entity** | An entity that only exists within the context of a parent entity; its lifecycle is governed by the parent | English Copy Version, Translation Version |
| **Value object / metadata** | A cluster of attributes that describes a core entity but has no independent identity or lifecycle | Copy Type, Module, staleInfo block, bundleSnapshotHash |
| **Version / history entity** | An immutable snapshot of a mutable entity at a point in time; permanently retained; never deleted | English Copy Version, Translation Version |
| **System event / operation record** | A record created by the system to trace that something happened; immutable and permanent | Audit Record |
| **Derived / read model** | A pre-computed or aggregated view computed from one or more source entities; not itself a source of truth | Coverage Metrics, Pending Work Summary, Environment Status Matrix, Recently-Edited |
| **User-personal record** | A record that is owned by and scoped to a single user; its lifecycle is tied to user activity, not content | Bookmark |
| **External reference** | An entity that exists outside MioTranslate's domain boundary; MioTranslate references it but does not own or define it | Language Services Endpoint, AI Translation Service |
| **Infrastructure record** | A platform-level record produced by MioTranslate's governance machinery, not by direct user intent | Notification, Import Event (bootstrap only), Export Job (transient) |

---

## 1. Entity Inventory

The following entities constitute the MioTranslate domain model. Each is placed in a classification from §0.

| # | Entity Name | Classification | Owner |
|---|---|---|---|
| 1 | Page | Core business entity | MioTranslate |
| 2 | Tag | Core business entity | MioTranslate |
| 3 | English Copy | Core business entity | MioTranslate |
| 4 | English Copy Version | Version / history entity | MioTranslate |
| 5 | Translation | Core business entity | MioTranslate |
| 6 | Translation Version | Version / history entity | MioTranslate |
| 7 | Language | Core business entity | MioTranslate |
| 8 | Release (Deployment Record) | Core business entity | MioTranslate |
| 9 | Publishing Approval Request | Independent governance record | MioTranslate |
| 10 | Audit Record | System event record | MioTranslate |
| 11 | Notification | Infrastructure record | MioTranslate |
| 12 | Coverage Metrics | Derived / read model | MioTranslate |
| 13 | Comment | Core business entity | MioTranslate |
| 14 | User | Core business entity | MioTranslate |
| 15 | User Role Assignment | Child entity of User | MioTranslate |
| 16 | System Configuration | Singleton configuration entity | MioTranslate |
| 17 | Bookmark | User-personal record | MioTranslate |
| 18 | Recently-Edited | User-personal projection / read model | MioTranslate |
| 19 | Import Event | Infrastructure record (bootstrap only) | MioTranslate |
| 20 | Export Job | Transient infrastructure record | MioTranslate |

---

## 2. Core Business Entities

---

### 2.1 Entity: Page

**Classification:** Core business entity

**What it is.**  
A Page is the top-level organizational unit in MioTranslate. It represents one named screen or view in the MioSalon application. Every piece of UX copy (every Tag) belongs to exactly one Page. Pages are registered by a Product Manager using the Page ID that the developer has assigned to that screen in the MioSalon codebase.

**Identity.**  
A Page is identified by its `pageId` — an uppercase alphanumeric string provided by the developer and registered immutably in MioTranslate. The `pageId` is the canonical, external identifier. It is the value used in Language Services API calls, in developer code references, and as a URL path segment.

> **Identity rule:** `pageId` is globally unique across all pages in MioTranslate. It is immutable after creation. No API exists to change it.

**Ownership and creation.**  
Pages are created by PM or Founder roles in MioTranslate. No external system creates or syncs pages; MioTranslate is the single entry point after the initial migration. The developer provides the Page ID; the PM registers it.

**Attributes.**

| Attribute | Type | Mutability | Notes |
|---|---|---|---|
| `pageId` | String | Immutable | Developer-provided. Uppercase alphanumeric + underscore. |
| `pageName` | String | Mutable | Human-readable. Required. |
| `module` | String (nullable) | Mutable | MioTranslate-internal label for the MioSalon product module (e.g., "POS", "Calendar"). A controlled vocabulary, not a Language Services concept. |
| `status` | Enum | System-managed | `ACTIVE` or `DEPRECATED`. |
| `createdAt` | Timestamp | Immutable | |
| `createdBy` | User reference | Immutable | |
| `updatedAt` | Timestamp | System-managed | Reflects most recent metadata change. |
| `updatedBy` | User reference | System-managed | |

**State machine.**

```
Created → ACTIVE → DEPRECATED
```

- A page is `ACTIVE` from the moment of creation.
- A page transitions to `DEPRECATED` only when all of its Tags have been individually deprecated (system-triggered cascade — not a direct user action on the page itself).
- Deprecation is one-directional and irreversible. There is no reactivation.

**Lifecycle rules.**
- A Page cannot be deleted. It can only be deprecated.
- A deprecated Page is excluded from active publishing workflows but remains visible in version history and audit.

**Relationships.**
- A Page **contains** one or more Tags (1:N, Page is the parent).
- A Page is the unit of **publishing** (one page + one language = one publishing action).
- A Page is referenced by Coverage Metrics (derived).

---

### 2.2 Entity: Tag

**Classification:** Core business entity

**What it is.**  
A Tag is the atomic unit of content in MioTranslate. It represents a single piece of UX text within a Page — a button label, a form field placeholder, an error message, or a section heading. Every tag is registered by the PM and referenced by the developer in MioSalon code via the Tag ID.

**Identity.**  
A Tag is identified by its `tagId` — a globally unique identifier that must begin with the parent Page ID as a prefix (format: `PAGE_ID_SUFFIX`). The `tagId` is immutable after creation.

> **Identity rule:** `tagId` is globally unique across all tags in MioTranslate. It is immutable. No API exists to change it.

**Attributes.**

| Attribute | Type | Mutability | Notes |
|---|---|---|---|
| `tagId` | String | Immutable | Must begin with `pageId_`. Globally unique. |
| `pageId` | Reference → Page | Immutable | Parent page. Set at creation, never changes. |
| `copyType` | String (nullable) | Mutable | Type of UX element (e.g., "button", "label", "error message"). A controlled vocabulary. |
| `status` | Enum | System-managed | `ACTIVE` or `DEPRECATED`. |
| `englishCopyStatus` | Enum | System-managed projection | The current English copy state for this tag: `NO_COPY`, `DRAFT`, `PENDING_REVIEW`, `APPROVED`. Set to `NO_COPY` at tag creation. Managed by the English Copy entity; surfaced here as a computed projection for query efficiency. The English Copy entity is authoritative. |
| `createdAt` | Timestamp | Immutable | |
| `createdBy` | User reference | Immutable | |
| `deprecatedAt` | Timestamp (nullable) | System-managed | Null if active. |
| `deprecatedBy` | User reference (nullable) | System-managed | Null if active. |

**State machine.**

```
Created → ACTIVE → DEPRECATED (one-directional, irreversible)
```

**When a Tag is created, two things happen simultaneously:**

1. The English Copy entity for this tag is created in `NO_COPY` state. The English Copy entity exists from the moment the Tag exists — it is not deferred until text is authored. (Correction §C1.)
2. One `NO_TRANSLATION` slot (Translation entity) is created for every currently active Language.

These are system-triggered side-effects of tag creation, not separate user actions.

**Lifecycle rules.**
- Tags are never deleted. Deprecation is the only removal mechanism.
- Tags belong to exactly one Page. Tags cannot be moved between pages.
- A deprecated tag is excluded from translation, review, and publishing workflows. Its complete history is fully preserved.

**Relationships.**
- A Tag **belongs to** exactly one Page (N:1).
- A Tag **has** exactly one English Copy entity (1:1, unconditional, established at tag creation).
- A Tag **has** zero or more Translation entities (one per Language — active and inactive — that existed when the tag or language was created).
- A Tag **receives** Comments (1:N).
- A Tag is referenced by Bookmarks.

---

### 2.3 Entity: English Copy

**Classification:** Core business entity

**What it is.**  
English Copy is the source-language content entity for a Tag. It holds the canonical English text that serves as the source for all translations. English Copy has its own lifecycle, approval workflow, and version history.

> **Important distinction:** The English Copy entity is not a text string. It is the entity that governs the versioned history of all English text values ever authored for a Tag, the approval state of each version, and the review workflow. It exists from the moment the Tag is created — initially in `NO_COPY` state — not from the moment text is first authored. The `NO_COPY` state is a valid state of the English Copy entity, not an absence of the entity. (Correction §C1.)

**Identity.**  
The English Copy entity is uniquely identified by its parent `tagId`. There is exactly one English Copy entity per Tag — the relationship is 1:1 and unconditional. The entity has no surrogate ID; it is accessed through its parent Tag.

**Attributes (entity-level, governing the current version state).**

| Attribute | Type | Mutability | Notes |
|---|---|---|---|
| `tagId` | Reference → Tag | Immutable | Parent tag. The natural key. |
| `currentStatus` | Enum | System-managed | `NO_COPY`, `DRAFT`, `PENDING_REVIEW`, `APPROVED`. Set to `NO_COPY` at Tag creation. |
| `currentApprovedVersionNumber` | Integer (nullable) | System-managed | The version number of the currently approved English text. Null if no version has ever been approved. |
| `currentApprovedText` | String (nullable) | System-managed | The text of the currently approved version. This is the source text for AI translation. Null in `NO_COPY` state. |
| `currentDraftVersionNumber` | Integer (nullable) | System-managed | Version number of any in-progress draft. Null if no draft is open. |

**State machine.**

```
NO_COPY → DRAFT → PENDING_REVIEW → APPROVED
                       ↑
          REJECTED / RETURNED → DRAFT
```

- `NO_COPY`: Entity exists; no English text has ever been written. This is the initial state at Tag creation.
- `DRAFT`: An English text has been authored but not yet submitted for review.
- `PENDING_REVIEW`: The draft has been submitted to a reviewer.
- `APPROVED`: A reviewer has formally approved the English text. Only approved English copy can trigger AI translation.
- When an already-approved tag is edited, a new draft version is created. The previously approved version remains active until the new version is also approved.

**Lifecycle rules.**
- English Copy exists from Tag creation. It does not require text to be authored before it exists.
- Every authoring or edit to the English text creates a new, immutable English Copy Version.
- The previously approved version is never modified in place; it is superseded by the new version upon approval.
- Upon approval of a new English version (when the text changed), the system automatically flags all Translation entities for that Tag across all active Languages as `STALE`. This is a system-triggered cascade.

**Relationships.**
- English Copy **belongs to** exactly one Tag (1:1).
- English Copy **has** zero or more English Copy Versions (1:N history; 0 when in NO_COPY state, 1+ once text is first authored).
- English Copy **is the source for** Translation entities (one per Language).

---

### 2.4 Entity: English Copy Version

**Classification:** Version / history entity

**What it is.**  
An English Copy Version is an immutable record of the English text of a Tag at a specific point in time. Every time English text is authored (first time) or edited (subsequent times), a new version is created. Versions are permanent and can never be modified or deleted.

**Identity.**  
An English Copy Version is uniquely identified by `(tagId, versionNumber)`. Version numbers are sequential integers starting at 1 per Tag.

**On immutability: snapshot content vs. review lifecycle fields.** (Correction §C2.)

An English Copy Version record has two conceptually distinct parts:

- **Snapshot content** — set at creation, truly immutable, never written again:  
  `text`, `authoredBy`, `authoredAt`, `changeReason`.

- **Review lifecycle fields** — each field is written at most once, at the moment the corresponding review event occurs (submit, approve, reject, return). These are not freely mutable; they follow a strict one-directional progression. Once `APPROVED`, a version's review state cannot regress. Conceptually, these fields are "append-once":  
  `status`, `submittedForReviewAt`, `submittedForReviewBy`, `reviewedBy`, `reviewedAt`, `approvedBy`, `approvedAt`, `escalatedToFounder`.

This document does not prescribe whether the implementation writes these fields in-place or records them as separate review-event rows. Either approach is valid at the database design phase. The canonical model requires only that (a) each field is set at most once, (b) the value is permanent once set, and (c) the version's terminal status (`APPROVED`, `REJECTED`, `SUPERSEDED`) is reached without reversal.

**Attributes.**

| Attribute | Part | Notes |
|---|---|---|
| `tagId` | Snapshot | Immutable reference to parent Tag. |
| `versionNumber` | Snapshot | Sequential integer, starting at 1 per Tag. |
| `text` | Snapshot | The exact English copy text at this version. |
| `authoredBy` | Snapshot | User who authored this version. |
| `authoredAt` | Snapshot | When this version was created. |
| `changeReason` | Snapshot | Optional reason for the edit. |
| `status` | Review lifecycle | `DRAFT → PENDING_REVIEW → APPROVED / REJECTED / SUPERSEDED`. Terminal; never reversed. |
| `submittedForReviewAt` | Review lifecycle | Set once when submitted. |
| `submittedForReviewBy` | Review lifecycle | Set once when submitted. |
| `reviewedBy` | Review lifecycle | Set once on any review decision. |
| `reviewedAt` | Review lifecycle | Set once on any review decision. |
| `approvedBy` | Review lifecycle | Set once on approval. Null otherwise. |
| `approvedAt` | Review lifecycle | Set once on approval. Null otherwise. |
| `escalatedToFounder` | Review lifecycle | Set to true if escalated. Set once. |

**Lifecycle rules.**
- When a version is superseded by a newer approval, its status becomes `SUPERSEDED`. The text is permanently preserved.
- Only one version per Tag can be `APPROVED` at any given time. All prior approved versions carry status `SUPERSEDED`.
- There is no deletion. No retention limit.

**Relationships.**
- An English Copy Version **belongs to** one Tag's English Copy (N:1).
- An English Copy Version **is referenced by** Translation Versions (via `sourceEnglishVersion`).

---

### 2.5 Entity: Translation

**Classification:** Core business entity

**What it is.**  
A Translation is the per-language content entity for a Tag. For every Language that has ever been configured in MioTranslate (active or inactive) and every active Tag that existed when that language was configured, there is exactly one Translation entity. The Translation entity manages the lifecycle, current state, and version history of the translated text for that (Tag, Language) pair.

**Identity.**  
A Translation is uniquely identified by its natural compound key: `(tagId, languageCode)`. There is no surrogate translation ID.

**Cardinality and language status.** (Correction §C4.)  
Translation entities are created when a Tag is created (one per active Language) or when a Language is added (one per active Tag). A Language's `status` transitioning from `ACTIVE` to `INACTIVE` does **not** delete or nullify the Translation entities for that language. Those entities and their full version history persist. The Language's inactive status controls operational availability only:

- **INACTIVE language — blocked operations:** generating new AI translations, submitting or approving translations, publishing.
- **INACTIVE language — preserved data:** Translation entity record, all Translation Versions, all Release records, all Audit Records, Coverage history.

No new Translation entities are created for an inactive language (e.g., new tags do not get slots for inactive languages). Reactivation (not supported in v1) would require explicitly creating the missing slots.

**Attributes (entity-level, governing the current active version).**

| Attribute | Type | Mutability | Notes |
|---|---|---|---|
| `tagId` | Reference → Tag | Immutable | |
| `languageCode` | Reference → Language | Immutable | |
| `status` | Enum | System-managed | `NO_TRANSLATION`, `DRAFT`, `PENDING_REVIEW`, `APPROVED`, `STALE`. |
| `currentVersionNumber` | Integer (nullable) | System-managed | Most recent version number. Null in `NO_TRANSLATION`. |
| `currentApprovedVersionNumber` | Integer (nullable) | System-managed | Most recent approved version. Null if none approved. |
| `sourceEnglishVersion` | Integer (nullable) | System-managed | English Copy version number the current translation is based on. Null in `NO_TRANSLATION`. |
| `staleInfo` | Object (nullable) | System-managed | Populated only when `status == STALE`. Contains diff context (previousEnglishVersion, newEnglishVersion, staleSince). Null otherwise. |
| `createdAt` | Timestamp | Immutable | When this slot was created. |

**State machine.**

```
NO_TRANSLATION → DRAFT → PENDING_REVIEW → APPROVED
                    ↑                         ↓ (English Copy changes)
           REJECTED/RETRANSLATE          STALE
                                             ↓ (Confirm / Retranslate)
                                         APPROVED / DRAFT
```

| State | Meaning |
|---|---|
| `NO_TRANSLATION` | Tag exists in this language; no translation text has ever been authored or generated. |
| `DRAFT` | Translation text exists (AI-generated or manual) but has not been approved. Cannot be published. |
| `PENDING_REVIEW` | Translation formally submitted to the Localization Reviewer queue. |
| `APPROVED` | Human reviewer formally approved. Eligible for inclusion in published page bundles. |
| `STALE` | The source English copy changed after this translation was approved. Existing deployed translation remains live. Stale is advisory, not blocking. |

**Lifecycle rules.**
- Translation entities are never deleted. Their history is permanent regardless of language status.
- Each language resolves staleness independently. Resolving Arabic staleness has no effect on Hindi.

**Relationships.**
- A Translation **belongs to** exactly one Tag (N:1).
- A Translation **is associated with** exactly one Language (N:1).
- A Translation **has** one or more Translation Versions (1:N).
- A Translation **is derived from** an English Copy Version (via `sourceEnglishVersion`).
- A Translation **is included in** Releases when in `APPROVED` state.

---

### 2.6 Entity: Translation Version

**Classification:** Version / history entity

**What it is.**  
A Translation Version is an immutable record of a translated text at a specific point in time. Every creation, AI generation, manual edit, approval, stale confirmation, or retranslation creates a new version. Versions are permanent and can never be modified or deleted.

**Identity.**  
A Translation Version is uniquely identified by `(tagId, languageCode, versionNumber)`. Version numbers are sequential integers starting at 1 per `(tagId, languageCode)`.

**On immutability: snapshot content vs. review lifecycle fields.** (Correction §C2.)  
The same two-part model applies as English Copy Version:

- **Snapshot content** — truly immutable, set at creation:  
  `text`, `creationMethod`, `sourceEnglishVersion`, `confidenceScore`, `backTranslation`, `variableIntegrityStatus`, `author`, `authoredAt`, `changeReason`, `staleInfo` (when set at creation).

- **Review lifecycle fields** — each written at most once, append-once:  
  `status`, `reviewedBy`, `reviewedAt`, `approvedBy`, `approvedAt`.

**`creationMethod` values:** `AI_GENERATED`, `MANUAL`, `MIGRATED`. (Correction §C3 — `MIGRATED` is a distinct creation method for migration-origin translations.)

**Attributes.**

| Attribute | Part | Notes |
|---|---|---|
| `tagId` | Snapshot | |
| `languageCode` | Snapshot | |
| `versionNumber` | Snapshot | Sequential, starting at 1 per (tagId, languageCode). |
| `text` | Snapshot | Translated text. Null only in NO_TRANSLATION initial slot. |
| `creationMethod` | Snapshot | `AI_GENERATED`, `MANUAL`, or `MIGRATED`. Null for NO_TRANSLATION slots. |
| `sourceEnglishVersion` | Snapshot | English Copy version this translation was generated from or confirmed against. See §C3 for migration lineage. |
| `confidenceScore` | Snapshot | AI confidence (0.00–1.00). Present only when `creationMethod == AI_GENERATED`. Null for MANUAL and MIGRATED. |
| `backTranslation` | Snapshot | AI back-translation. Present only when `creationMethod == AI_GENERATED`. |
| `variableIntegrityStatus` | Snapshot | `PASS` or `FAIL`. Present when English source contains dynamic placeholder variables. |
| `author` | Snapshot | User ID or `system:ai-translation` or `system:migration`. |
| `authoredAt` | Snapshot | |
| `changeReason` | Snapshot | Optional reason for manual edits. |
| `staleInfo` | Snapshot | Populated (immutably) if this version was in STALE state. |
| `status` | Review lifecycle | `DRAFT`, `PENDING_REVIEW`, `APPROVED`, `REJECTED`, `STALE`, `SUPERSEDED`. Terminal; never reversed. |
| `reviewedBy` | Review lifecycle | Set once on any review decision. |
| `reviewedAt` | Review lifecycle | Set once. |
| `approvedBy` | Review lifecycle | Set once on approval. |
| `approvedAt` | Review lifecycle | Set once on approval. |

**Freshness invariant for staleness detection:**
- A translation is **fresh** when its `sourceEnglishVersion` equals the current approved English Copy version number.
- A translation is **stale** when its `sourceEnglishVersion` is less than the current approved English Copy version number.

**Migration lineage.** (Correction §C3.)  
Translations created via migration have `creationMethod: MIGRATED`, `confidenceScore: null`, `backTranslation: null`. Their `sourceEnglishVersion` is always `1` — the English Copy Version 1 that was created alongside them during the same migration step. The freshness invariant holds for migrated content: since both the English copy (version 1) and the translation are created simultaneously, `sourceEnglishVersion = 1 = currentApprovedEnglishVersion`, so the translation starts as fresh and not stale.

**Lifecycle rules.**
- No version record is ever deleted. No retention limit.
- When a reviewer edits and approves (`EDIT_AND_APPROVE`), a new version N+1 is created as `APPROVED`. Version N is marked `SUPERSEDED`.

---

### 2.7 Entity: Language

**Classification:** Core business entity

**What it is.**  
A Language is a configured target language in MioTranslate. It represents a language that the product supports for translation and publishing. Languages are system-wide; they are not page-specific or tag-specific.

**Identity.**  
A Language is uniquely identified by its `languageCode` — a standard BCP 47 code (e.g., `ar`, `hi`, `es`, `tr`, `fr-CA`). The code is immutable after creation. The language name is also immutable in v1.

> **Identity rule:** `languageCode` is unique across all Languages, including inactive ones. A deactivated language code cannot be reused.

**Attributes.**

| Attribute | Type | Mutability | Notes |
|---|---|---|---|
| `languageCode` | String | Immutable | BCP 47 standard. Immutable after creation. |
| `languageName` | String | Immutable | Human-readable name. Immutable in v1. |
| `direction` | Enum | Immutable | `LTR` or `RTL`. Immutable after creation. |
| `status` | Enum | System-managed | `ACTIVE` or `INACTIVE`. Changed only via Deactivate Language. |
| `addedAt` | Timestamp | Immutable | |
| `addedBy` | User reference | Immutable | Administrator or Founder who added the language. |

**State machine.**

```
Created → ACTIVE → INACTIVE
```

Reactivation is not supported in v1. Deactivation is effectively one-directional. An `INACTIVE` language retains all its existing Translation entities, version history, and Release records.

**Lifecycle rules.**
- A Language cannot be deleted. Deactivation is the only removal mechanism.
- When deactivated: no new translations can be generated or approved; no publishing can target this language; all data is preserved.
- When a new Language is added: the system creates `NO_TRANSLATION` slots for all currently active Tags across all pages. Tags deprecated before the language was added do not receive slots.

---

### 2.8 Entity: Release (Deployment Record)

**Classification:** Core business entity

**What it is.**  
A Release is the immutable record of a publishing or rollback action. It captures what content was deployed to which environment, at what time, by whom, and what the result was. The Release is created at the moment publishing execution begins (API-0405), not when the approval request is submitted (API-0403). (Correction §C5.)

The unit of a Release is: **one Page × one Language × one Environment**.

**Identity.**  
A Release is identified by a surrogate `releaseId`. It is also uniquely described by `(pageId, languageCode, environment, deploymentVersion)`, where `deploymentVersion` is a sequential integer per `(pageId, languageCode, environment)`.

**Attributes.**

| Attribute | Type | Mutability | Notes |
|---|---|---|---|
| `releaseId` | String | Immutable | System-generated. |
| `pageId` | Reference → Page | Immutable | |
| `languageCode` | Reference → Language | Immutable | |
| `environment` | Enum | Immutable | `DEV`, `QA`, `PRODUCTION`. |
| `deploymentVersion` | Integer | Immutable | Sequential per (pageId, languageCode, environment). |
| `type` | Enum | Immutable | `PUBLISH` or `ROLLBACK`. |
| `triggerSource` | Enum | Immutable | `USER_INITIATED`, `SYSTEM_AUTO_DEV` (implicit Dev publish), or `MIGRATION`. |
| `status` | Enum | System-managed | `PENDING`, `IN_PROGRESS`, `SUCCESSFUL`, `FAILED`, `ROLLED_BACK`. |
| `approvalRequestId` | Reference → Publishing Approval Request (nullable) | Immutable | The governing approval request, if one exists. Null for `SYSTEM_AUTO_DEV` and `MIGRATION` releases. |
| `publishedBy` | User or system reference | Immutable | User ID or system identity. |
| `approvedBy` | User reference (nullable) | Immutable | Null for `SYSTEM_AUTO_DEV` and `MIGRATION` releases. |
| `publishedAt` | Timestamp | Immutable | When execution was initiated. |
| `approvedAt` | Timestamp (nullable) | Immutable | Null for `SYSTEM_AUTO_DEV` and `MIGRATION` releases. |
| `tagCount` | Integer | Immutable | Tags included in the bundle. |
| `excludedTagCount` | Integer | Immutable | Tags excluded (not APPROVED at publishing time). |
| `contentSnapshot` | Object | Immutable | Complete per-tag snapshot of what was published: tag ID, translation version, source English version, translation text. Permanent basis for rollback. |
| `bundleSnapshotHash` | String | Immutable | Hash of the content snapshot. |
| `isRollback` | Boolean | Immutable | Whether this record represents a rollback. |
| `rolledBackFromDeploymentVersion` | Integer (nullable) | Immutable | Present when `isRollback == true`. The version being restored. |
| `failureReason` | String (nullable) | System-managed | Populated when `status == FAILED`. |

**Release Status Lifecycle.**

```
PENDING → IN_PROGRESS → SUCCESSFUL → ROLLED_BACK (when a later rollback succeeds for this scope)
                      ↘ FAILED
```

- `ROLLED_BACK` is set on a prior `SUCCESSFUL` release when a newer rollback deployment completes successfully for the same (pageId, languageCode, environment). This is the only mutation permitted on a historical release record (Group 4 §2.3). All other fields are immutable.

**Lifecycle rules.**
- A Release record is created at execution time (API-0405), not at approval request creation time (API-0403).
- Even a failed publishing attempt produces a permanent Release record.
- Rollback creates a new Release record (type `ROLLBACK`) — it does not modify or delete the prior record.
- The `contentSnapshot` field is the permanent, audit-defensible record of what was deployed.

**Relationships.**
- A Release **references** one Page and one Language.
- A Release **references** its governing Publishing Approval Request (via `approvalRequestId`), when one exists.
- A Release **may reference** another Release (as the rollback source via `rolledBackFromDeploymentVersion`).

---

### 2.9 Entity: Publishing Approval Request

**Classification:** Independent governance record

**What it is.**  
A Publishing Approval Request is the governance record that captures a user's intent to publish a specific page bundle, along with the content snapshot hash at the time of that request. It is created before publishing execution begins. Upon approval (API-0404), publishing execution is triggered (API-0405), which creates the Release. Upon rejection, no Release is created.

**Lifecycle relationship with Release.** (Correction §C5.)

The correct chronological sequence is:

```
API-0402: Get Pre-Publishing Summary (read — no records created)
    ↓
API-0403: Request Publishing Approval → creates: Publishing Approval Request (status: PENDING)
    ↓
API-0404: Approve or Reject → updates Approval Request status
    ↓ (on APPROVE only)
API-0405: Execute Publishing → creates: Release (referencing the Approval Request)
```

The Publishing Approval Request is an **independent governance record**. It precedes Release creation; the Release references it. The Approval Request is not a child of the Release — it has no dependency on the Release. The Release has a reference to the Approval Request (`approvalRequestId`). This is a directional reference: Release → Approval Request.

**Identity.**  
A Publishing Approval Request is identified by a surrogate `approvalRequestId`.

**Attributes.**

| Attribute | Type | Mutability | Notes |
|---|---|---|---|
| `approvalRequestId` | String | Immutable | System-generated. |
| `pageId` | Reference → Page | Immutable | |
| `languageCode` | Reference → Language | Immutable | |
| `environment` | Enum | Immutable | `DEV`, `QA`, `PRODUCTION`. |
| `bundleSnapshotHash` | String | Immutable | The content snapshot hash at request creation. |
| `bundleContentSummary` | Object | Immutable | Tag counts, included tag IDs, excluded tag IDs at request creation time. |
| `requiredApproverRole` | String | Immutable | The minimum role required to approve for this environment. |
| `status` | Enum | System-managed | `PENDING`, `APPROVED`, `REJECTED`, `EXPIRED`, `CANCELLED`. |
| `requestedBy` | User reference | Immutable | |
| `requestedAt` | Timestamp | Immutable | |
| `approvedBy` | User reference (nullable) | Immutable | |
| `approvedAt` | Timestamp (nullable) | Immutable | |
| `rejectedBy` | User reference (nullable) | Immutable | |
| `rejectedAt` | Timestamp (nullable) | Immutable | |
| `rejectionReason` | String (nullable) | Immutable | Mandatory when rejected. |
| `expiresAt` | Timestamp | Immutable | 24 hours after creation. |

**Lifecycle rules.**
- An approval request becomes `CANCELLED` (not `EXPIRED`) if the bundle content changes after the request was created — the server detects a hash mismatch at approval time (API-0404). A new request must be created.
- An approval request becomes `EXPIRED` if the 24-hour expiry window passes before a decision is made.
- Self-approval is permitted if the requester holds the required approver role for the target environment.
- Only one `PENDING` approval request may exist per `(pageId, languageCode, environment)` at a time.

---

### 2.10 Entity: Comment

**Classification:** Core business entity

**What it is.**  
A Comment is a team discussion note attached to a specific Tag, scoped to either the English content surface or a specific translation language surface. Comments are permanent — they cannot be deleted, only resolved.

**Identity.**  
A Comment is identified by a surrogate `commentId`.

**Attributes.**

| Attribute | Type | Mutability | Notes |
|---|---|---|---|
| `commentId` | String | Immutable | |
| `tagId` | Reference → Tag | Immutable | The tag this comment is attached to. |
| `scopeType` | Enum | Immutable | `ENGLISH` or `LANGUAGE`. |
| `scopeLanguageCode` | Reference → Language (nullable) | Immutable | Present when `scopeType == LANGUAGE`. |
| `author` | User reference | Immutable | |
| `text` | String | Immutable | Comment body. Non-empty. Max 2,000 chars. |
| `resolved` | Boolean | Mutable | The only mutable field. `false` (open) or `true` (resolved). |
| `resolvedBy` | User reference (nullable) | System-managed | Set once on resolution. |
| `resolvedAt` | Timestamp (nullable) | System-managed | Set once on resolution. |
| `createdAt` | Timestamp | Immutable | |

**Scope semantics:**  
A comment is scoped to a content surface, not to a specific version. When new English or translation versions are created, all existing comments on that surface remain visible. Comments are part of the permanent editorial record.

**Lifecycle rules.**
- Comments are never deleted (FRD §7 Rule 22).
- Any user may resolve a comment. Resolution is not role-restricted.
- Resolving a comment creates an Audit Record.

---

### 2.11 Entity: User

**Classification:** Core business entity

**What it is.**  
A User is an authenticated individual who has access to MioTranslate. Users are auto-provisioned on their first authenticated request. Users hold one or more Roles that govern what they can do.

**Identity.**  
A User is identified by `userId` — derived from the authentication token's identity provider subject claim. Unique and immutable.

**Attributes.**

| Attribute | Type | Mutability | Notes |
|---|---|---|---|
| `userId` | String | Immutable | Identity provider subject claim. |
| `displayName` | String | External-managed | Sourced from the identity provider. |
| `email` | String | External-managed | Sourced from the identity provider. |
| `roles` | Array of enum | Managed by ADMIN/FN | Current active roles: `DEV`, `PM`, `QA`, `LR`, `SR`, `FN`, `ADMIN`. A user may hold multiple roles simultaneously. Empty array = authenticated but no privileges. |
| `status` | Enum | System-managed | `ACTIVE` in v1. |
| `lastActiveAt` | Timestamp (nullable) | System-managed | |
| `createdAt` | Timestamp | Immutable | When first provisioned. |

**Lifecycle rules.**
- Created on first authenticated request with `roles: []`.
- An ADMIN or FN must assign roles before the user can perform role-restricted operations.
- Users cannot be deleted in v1. Revoking all roles is the access-revocation mechanism.
- The system must reject any role change that would leave zero users holding ADMIN or FN authority system-wide (admin-lockout guard — Group 8 §3.4.1 v1.1).

---

### 2.12 Entity: User Role Assignment

**Classification:** Child entity of User

**What it is.**  
A User Role Assignment is the history record of role grants and role removals for a User. It enables the system to show the full lifecycle of each user's role — when it was granted, by whom, and when it was revoked if applicable. A user's current active roles are the set of Role Assignments that have been granted but not yet revoked. (Correction §C6.)

**Identity.**  
Identified by a surrogate key, or logically by `(userId, role, assignedAt)`.

**Attributes.**

| Attribute | Type | Mutability | Notes |
|---|---|---|---|
| `userId` | Reference → User | Immutable | |
| `role` | Enum | Immutable | `DEV`, `PM`, `QA`, `LR`, `SR`, `FN`, `ADMIN`. |
| `assignedAt` | Timestamp | Immutable | When the role was granted. |
| `assignedBy` | User reference | Immutable | The ADMIN or FN who granted the role. |
| `revokedAt` | Timestamp (nullable) | Immutable when set | When the role was removed. Null while the role is active. Set once; never changed. |
| `revokedBy` | User reference (nullable) | Immutable when set | The ADMIN or FN who removed the role. Null while active. |

**Derivation rule:**  
A User's current active roles = all Role Assignment records for that user where `revokedAt IS NULL`.

**When an ADMIN replaces a user's full role set** (API-0804 `PUT` semantics), the implementation may record the prior roles as revoked (setting `revokedAt`, `revokedBy`) and the new roles as new grant records. This maintains a complete, auditable history of every role state change.

---

### 2.13 Entity: System Configuration

**Classification:** Singleton configuration entity

**What it is.**  
System Configuration is the single system-wide configuration record holding operational parameters.

**Identity.**  
Singleton. Accessed as a single resource at `/v1/admin/config`.

**Attributes.**

| Attribute | Type | Mutability | Notes |
|---|---|---|---|
| `bulkApprovalConfidenceThreshold` | Integer (0–100) | Mutable | Minimum AI confidence score for bulk approval eligibility. Default: 95. FRD §7 Rule 11. |
| `environments` | Object | Mutable | Per-environment map. Keys: `DEV`, `QA`, `PRODUCTION`. Each: `languageServicesEndpoint` and `tenantDomain`. |
| `lastUpdatedAt` | Timestamp | System-managed | |
| `lastUpdatedBy` | User reference | System-managed | |

**Lifecycle rules.**
- Every update creates an Audit Record with before and after values.
- Confidence threshold is read at bulk-approval execution time.
- Endpoint URLs are read at publishing execution time.
- Only ADMIN and FN may read or update.

---

## 3. Infrastructure and Platform Entities

---

### 3.1 Entity: Audit Record

**Classification:** System event record

**What it is.**  
An Audit Record is an immutable, permanent log entry created for every write operation in MioTranslate. Created by the system as a mandatory, synchronous side-effect of every mutating action.

**Identity.**  
Identified by a system-generated `auditRecordId`.

**Attributes.**

| Attribute | Type | Mutability | Notes |
|---|---|---|---|
| `auditRecordId` | String | Immutable | |
| `action` | Enum | Immutable | The action taken (see catalogue below). |
| `subject` | Object | Immutable | `type` + entity identity fields. Type values: `ENGLISH_COPY`, `TRANSLATION`, `PAGE`, `TAG`, `RELEASE`, `LANGUAGE`, `USER_ROLE`, `SYSTEM_CONFIG`, `IMPORT_EVENT`, `COMMENT`. |
| `performedBy` | String | Immutable | User ID or `system:{operation}`. |
| `performedAt` | Timestamp | Immutable | |
| `details` | String | Immutable | Human-readable event description. |
| `beforeValue` | String (nullable) | Immutable | Value before the action. Null for creation events. |
| `afterValue` | String (nullable) | Immutable | Value after the action. |
| `correlationId` | String (nullable) | Immutable | Request ID that triggered this record. |

**Lifecycle rules.**
- Immutable and permanent. Cannot be edited, deleted, or archived. No retention limit.
- Read-only GET operations do not produce Audit Records. No exceptions.
- Audit Records are written synchronously with the primary mutation — not async.
- Every item in a bulk operation produces an individual Audit Record.

**Audit action catalogue:**

| Category | Actions |
|---|---|
| Page | `PAGE_CREATED`, `PAGE_METADATA_UPDATED`, `PAGE_DEPRECATED` |
| Tag | `TAG_CREATED`, `TAG_METADATA_UPDATED`, `TAG_DEPRECATED` |
| English Copy | `ENGLISH_COPY_CREATED`, `ENGLISH_COPY_EDITED`, `ENGLISH_COPY_SUBMITTED_FOR_REVIEW`, `ENGLISH_COPY_APPROVED`, `ENGLISH_COPY_REJECTED`, `ENGLISH_COPY_RETURNED_FOR_REVISION`, `ENGLISH_COPY_ESCALATED` |
| Translation | `TRANSLATION_CREATED`, `TRANSLATION_EDITED`, `TRANSLATION_SUBMITTED_FOR_REVIEW`, `TRANSLATION_APPROVED`, `TRANSLATION_REJECTED`, `TRANSLATION_RETURNED_FOR_REVISION`, `TRANSLATION_STALE_FLAGGED`, `TRANSLATION_STALE_CONFIRMED`, `TRANSLATION_STALE_RETRANSLATED`, `TRANSLATION_SLOT_CREATED` |
| Publishing | `PAGE_BUNDLE_PUBLISHED`, `PAGE_BUNDLE_PUBLISH_FAILED`, `PAGE_BUNDLE_ROLLED_BACK`, `PAGE_BUNDLE_AUTO_PUBLISHED` |
| Publishing Approval | `PUBLISHING_APPROVAL_REQUESTED`, `PUBLISHING_APPROVAL_GRANTED`, `PUBLISHING_APPROVAL_REJECTED`, `PUBLISHING_APPROVAL_EXPIRED`, `PUBLISHING_APPROVAL_CANCELLED` |
| Administration | `LANGUAGE_ADDED`, `LANGUAGE_DEACTIVATED`, `USER_ROLE_ASSIGNED`, `USER_ROLE_MODIFIED`, `SYSTEM_CONFIG_CHANGED` |
| Migration | `MIGRATION_STARTED`, `MIGRATION_COMPLETED`, `MIGRATION_FAILED` |
| Comments | `COMMENT_ADDED`, `COMMENT_RESOLVED` |

---

### 3.2 Entity: Notification

**Classification:** Infrastructure record

**What it is.**  
A per-user message dispatched by the system when a significant event occurs (FRD §12). Created automatically, dispatched asynchronously, non-blocking.

**Identity.**  
Identified by a surrogate `notificationId`.

**Attributes.**

| Attribute | Type | Mutability | Notes |
|---|---|---|---|
| `notificationId` | String | Immutable | |
| `eventType` | Enum | Immutable | Notification event (see catalogue below). |
| `recipientUserId` | Reference → User | Immutable | |
| `subject` | Object | Immutable | Context (tagId, pageId, language, environment as applicable). |
| `message` | String | Immutable | Human-readable notification text. |
| `actionUrl` | String (nullable) | Immutable | Deep link into MioTranslate. |
| `status` | Enum | Mutable | `UNREAD` or `READ`. The only mutable field. |
| `createdAt` | Timestamp | Immutable | |
| `readAt` | Timestamp (nullable) | Set once | Set when user marks as read. |

**Notification event catalogue:**

| Event | Who Is Notified | Trigger |
|---|---|---|
| `PAGE_OR_TAG_CREATED` | PM, QA | New page or tag registered |
| `ENGLISH_COPY_SUBMITTED` | Assigned Reviewer | English copy submitted for review |
| `ENGLISH_COPY_APPROVED` | Author (PM/QA) | English copy approved |
| `ENGLISH_COPY_REJECTED` | Author (PM/QA) | English copy rejected or returned |
| `TRANSLATION_READY_FOR_REVIEW` | Localization Reviewer | AI translation completed |
| `TRANSLATION_APPROVED` | PM | Translation approved |
| `TRANSLATION_STALE_FLAGGED` | All LRs for affected languages | English copy changed |
| `ITEM_ESCALATED_TO_FOUNDER` | Founder | Copy escalated |
| `PAGE_BUNDLE_PUBLISHED_PRODUCTION` | PM, Support Reviewer | Published to Production |
| `ROLLBACK_INITIATED` | PM, QA, Support Reviewer | Rollback initiated |
| `PUBLISHING_FAILED` | PM, Administrator | Publishing attempt failed |

---

### 3.3 Entity: Import Event

**Classification:** Infrastructure record (bootstrap only)

**What it is.**  
An Import Event is the record of a one-time initial data migration attempt. It tracks the migration lifecycle from file upload through entity creation and validation report generation. This entity is used exclusively during the bootstrap phase. After migration completes and is confirmed, no new Import Events are expected.

**Identity.**  
Identified by a system-generated `migrationId`.

**Attributes.**

| Attribute | Type | Mutability | Notes |
|---|---|---|---|
| `migrationId` | String | Immutable | |
| `status` | Enum | System-managed | See state machine below. |
| `uploadedBy` | User reference | Immutable | |
| `uploadedAt` | Timestamp | Immutable | |
| `fileName` | String | Immutable | |
| `fileFormat` | Enum | Immutable | `CSV` (only format in v1). |
| `fileSizeBytes` | Integer | Immutable | |
| `executedBy` | User reference (nullable) | Immutable when set | Set when execution begins. |
| `executionStartedAt` | Timestamp (nullable) | Immutable when set | |
| `executionCompletedAt` | Timestamp (nullable) | Immutable when set | |
| `counts` | Object | Immutable when set | Set on COMPLETED. Contains: `pagesCreated`, `tagsCreated`, `englishCopyCreated`, `translationsCreated`, `rowsSkipped`, `rowsFailed`. |
| `failureReason` | String (nullable) | Immutable when set | Set on FAILED. |

**State machine.** (Correction §C7 — aligned exactly with locked Group 10.)

```
UPLOAD_READY → PROCESSING → COMPLETED → REPORT_AVAILABLE
                          ↘ FAILED
```

| State | When entered |
|---|---|
| `UPLOAD_READY` | API-1001 returns 201. File stored, structure valid. |
| `PROCESSING` | API-1002 execution begins. Returns 202. |
| `COMPLETED` | All entities created, coverage recalculation triggered, `counts` populated. |
| `FAILED` | Any critical step fails. Full transactional rollback applied. `failureReason` populated. |
| `REPORT_AVAILABLE` | API-1003 first called after `COMPLETED`. Report generated and cached. |

> **There is no `COMPLETED_WITH_SKIPS` state.** Skipped rows (tags without IDs, empty English copy, unrecognized languages) are reflected in the `rowsSkipped` count field and detailed in the Validation Report's `skippedRows` array. They do not produce a separate Import Event status. The `COMPLETED` state covers both fully-clean and partially-skipped migrations. (Correction §C7.)

> **Validation Report summary status** (`PASS`, `PASS_WITH_WARNINGS`, `FAIL`) is a property of the **Validation Report record**, not of the Import Event. These are distinct concepts. The Import Event tracks execution lifecycle; the Validation Report tracks data integrity findings.

> **Coverage recalculation** is triggered once after all entity creation (Step 8 of API-1002), before the status is set to `COMPLETED`. It is not a separate Import Event state. If coverage recalculation fails, this may be reported as a post-migration engineering concern (EN-G10-06) but does not create a `RECALCULATION_FAILED` status on the Import Event itself. (Correction §C7.)

**Lifecycle rules.**
- Only one Import Event may be in `PROCESSING` state at a time.
- A `FAILED` Import Event does not block a new `UPLOAD_READY` Import Event.
- `FAILED` migrations apply a full transactional rollback — MioTranslate returns to pre-migration state.
- The system rejects a new execution if MioTranslate already contains pages (`SYSTEM_NOT_EMPTY` guard).

---

### 3.4 Entity: Export Job

**Classification:** Transient infrastructure record (Correction §C10.)

**What it is.**  
An Export Job is a temporary operational record created when a user requests a data export. It tracks the file generation lifecycle and provides a short-lived download URL. Export Jobs are operational artifacts with a defined expiry, not domain entities with persistent business significance.

**Identity.**  
An Export Job is identified by a surrogate `exportId`.

**Attributes.**

| Attribute | Type | Notes |
|---|---|---|
| `exportId` | String | System-generated. |
| `pageId` | Reference → Page | The page being exported. |
| `languageCode` | Reference → Language | The language being exported. |
| `format` | Enum | `CSV` or `EXCEL`. |
| `status` | Enum | `GENERATING`, `READY`, `FAILED`. |
| `rowCount` | Integer (nullable) | Number of tag rows. Set on `READY`. |
| `generatedAt` | Timestamp (nullable) | When file generation completed. |
| `downloadUrl` | String (nullable) | Relative URL to retrieve the file. Set on `READY`. |
| `expiresAt` | Timestamp | When the download link expires. Default: 1 hour after `generatedAt`. |
| `requestedBy` | User reference | The user who initiated the export. |
| `requestedAt` | Timestamp | When the export was requested. |

**Lifecycle rules.**
- Export data reflects a consistent snapshot captured at the moment the export was generated. The file is internally consistent to that single snapshot; partial reads during concurrent writes are not permitted.
- Exported data is read-only. It cannot be re-imported to modify data.
- The Export Job record's lifecycle is bounded by `expiresAt`. The physical storage and cleanup mechanism for expired Export Jobs is a database design decision — this document does not prescribe it.

---

## 4. Derived / Read Models

These are not business entities. They are computed views derived from core entities. They are never the source of truth. No business rule should be validated against a derived model — always validate against the source entities.

---

### 4.1 Derived Model: Coverage Metrics

**Derived from:** Tag (count of active tags), Release (contentSnapshot of SUCCESSFUL PRODUCTION releases), Translation (current status, for counts).

**What it provides:** A pre-computed per-(Page, Language) aggregate of translation readiness.

**Numerator definition.** (Correction §C8.)

The `coveragePercentage` numerator (`approvedAndDeployedToProduction`) counts tags for which there exists at least one `SUCCESSFUL` Release record targeting the `PRODUCTION` environment whose `contentSnapshot` includes that tag. Whether the Translation entity's current status is `APPROVED` or `STALE` is irrelevant to the numerator — what matters is that the content has been successfully deployed to Production and is actively being served.

This is the correct business logic: a stale-but-deployed translation is still live content. It counts as covered (with advisory flag) per FRD F-16.

The Translation entity's current `status` field is the source of truth for the `staleCount`, `pendingReviewCount`, `draftCount`, and `noTranslationCount` breakdown fields — not for the numerator.

**Fields computed:**
- `totalActiveTags` — count of non-deprecated tags on the page (denominator)
- `approvedAndDeployedToProduction` — tags with a SUCCESSFUL Production Release in their history (numerator)
- `coveragePercentage` — `(approvedAndDeployedToProduction / totalActiveTags) × 100`
- `approvedNotYetDeployedToProduction` — tags with `APPROVED` Translation entity status but no matching PRODUCTION Release
- `pendingReviewCount`, `draftCount`, `staleCount`, `noTranslationCount` — from Translation entity current status

**Update triggers:** Recalculated asynchronously when: tag created/deprecated, translation state changes, publishing event (success or rollback).

---

### 4.2 Derived Model: Pending Work Summary

**Derived from:** Tag (NO_COPY count), English Copy (DRAFT/PENDING_REVIEW count), Translation (DRAFT/PENDING_REVIEW/STALE count per language), Publishing Approval Request (PENDING count).

**What it provides:** System-wide aggregate counts of work awaiting action, for the dashboard overview.

---

### 4.3 Derived Model: Environment Status Matrix

**Derived from:** Release (most recent SUCCESSFUL deployment per page + language + environment), Tag (active count).

**What it provides:** A matrix showing the currently deployed version per (page, language, environment), the deployment date, and whether content is behind the latest approved bundle.

---

### 4.4 Derived Model: Review Queue

**Derived from:** English Copy Versions (PENDING_REVIEW status, for SR view), Translation entities (PENDING_REVIEW status, for LR view), Publishing Approval Requests (PENDING, for approver view).

**What it provides:** A role-scoped view of items awaiting the current user's review action.

---

### 4.5 Derived Model: Activity Timeline

**Derived from:** Audit Records (filtered and formatted for display).

**What it provides:** A chronological feed of recent actions. Filterable by user, page, language, and action type. This is a projection over Audit Records, not a separately persisted model.

---

### 4.6 Derived / User-Personal Projection: Recently-Edited

**Classification: User-personal projection / read model.** (Correction §C9.)

**What it is.**  
Recently-Edited is a per-user, computed view of a user's recent interactions with Tags. It has no independent write path — it is computed from two external sources:

- **Write/edit events:** A filtered projection over the Audit Record store (actions by this user on tags).
- **View/access events:** A projection over a dedicated access-event store (since GET requests do not produce Audit Records per Group 5 §2.1.1).

Because Recently-Edited is derived from two sources with no single independent write path, it is correctly classified as a user-personal projection / read model, not as a user-personal entity. The access-event store itself is an infrastructure tracking mechanism, not a domain entity.

**Scoped to:** `(userId, tagId)` — updated (not created anew) on each interaction.

**Fields:**

| Field | Source | Notes |
|---|---|---|
| `userId` | — | The user. |
| `tagId` | — | The tag interacted with. |
| `lastAccessedAt` | Access-event store | Most recent view event. |
| `lastAction` | Audit Records | Most recent write action by this user on this tag. Null for tags only viewed. |
| `lastActionAt` | Audit Records | Timestamp of most recent write event. |

---

## 5. User-Personal Records

---

### 5.1 Entity: Bookmark

**Classification:** User-personal record

**What it is.**  
A personal marker allowing a user to quickly return to a specific Page or Tag. Per-user and private.

**Identity.**  
Identified by a surrogate `bookmarkId`, scoped to `(userId, targetType, targetId)`.

**Attributes.**

| Attribute | Type | Notes |
|---|---|---|
| `bookmarkId` | String | System-generated. |
| `userId` | Reference → User | The owner. |
| `targetType` | Enum | `PAGE` or `TAG`. |
| `targetId` | String | The `pageId` or `tagId`. |
| `bookmarkedAt` | Timestamp | When created. |

**Lifecycle rules.**
- Re-bookmarking the same target toggles (removes) the existing bookmark.
- Bookmarks can be explicitly removed.

---

## 6. Entity Relationships — Summary Diagram

```
                 ┌───────────────────────────────┐
                 │            LANGUAGE           │
                 │  languageCode · direction     │
                 │  status (ACTIVE / INACTIVE)   │
                 └──────────────┬────────────────┘
                                │
                                │ N (one Translation per (Tag × Language ever configured))
                                │
┌──────────┐  1      N  ┌───────┴─────┐  1   1  ┌────────────────────────┐
│  PAGE    ├────────────┤     TAG     ├──────────┤      ENGLISH COPY      │
│ pageId   │            │  tagId      │          │  (1:1 with Tag,        │
│ pageName │            │  pageId     │          │   created at Tag       │
│ module   │            │  copyType   │          │   creation in NO_COPY) │
│ status   │            │  status     │          └───────────┬────────────┘
└──────────┘            └──────┬──────┘                     │ 1
                               │ 1                          │ N (0 in NO_COPY, 1+ once authored)
                               │                            ▼
                               │               ┌──────────────────────────────┐
                               │               │     ENGLISH COPY VERSION     │
                               │               │  (tagId, versionNumber)      │
                               │               │  text [snapshot]             │
                               │               │  status [append-once]        │
                               │               └──────────────────────────────┘
                               │ N
                    ┌──────────┴───────────┐
                    │     TRANSLATION      │
                    │  (tagId, langCode)   │
                    │  status · staleInfo  │
                    │  sourceEngVersion    │
                    └──────────┬───────────┘
                               │ 1
                               │ N
                               ▼
                    ┌────────────────────────────┐
                    │    TRANSLATION VERSION     │
                    │  (tagId, lang, versionNo)  │
                    │  text · creationMethod     │
                    │  confidenceScore           │
                    │  sourceEnglishVersion      │
                    │  status [append-once]      │
                    └────────────────────────────┘

TAG  ──────────────────────────────────── N  COMMENT
PAGE + LANGUAGE + ENV ─────────────────  N  RELEASE

        ┌──────────────────────────────────────────────┐
        │         PUBLISHING APPROVAL REQUEST          │
        │  (independent governance record)             │
        │  Created before Release.                     │
        │  Release references it via approvalRequestId │
        └──────────────────────────────────────────────┘
                    ↑ referenced by (not parent of)
        ┌──────────────────────────────┐
        │            RELEASE           │
        │  (pageId, lang, env)         │
        │  type: PUBLISH/ROLLBACK      │
        │  contentSnapshot (immutable) │
        │  status: …→ ROLLED_BACK      │
        │  approvalRequestId (ref)     │
        └──────────────────────────────┘

        ┌──────────┐  ──N  USER ROLE ASSIGNMENT (grant + revoke history)
        │   USER   │  ──N  BOOKMARK (personal)
        └──────────┘  ──   Recently-Edited (derived projection)

        ┌───────────────────┐
        │   AUDIT RECORD    │  ← immutable, synchronous, every write
        └───────────────────┘

        ┌───────────────────┐
        │   NOTIFICATION    │  ← per-user, async, dispatch-only
        └───────────────────┘

        ┌───────────────────┐
        │ SYSTEM CONFIG     │  ← singleton
        └───────────────────┘
```

---

## 7. Key Domain Rules and Invariants

### 7.1 Immutability Rules

| Rule | Source |
|---|---|
| `pageId` is immutable after creation | FRD §4.1, Group 1 |
| `tagId` is immutable after creation | FRD §4.2, Group 1 |
| English Copy Version snapshot content is immutable at creation | FRD §7 Rule 21 |
| Translation Version snapshot content is immutable at creation | FRD §7 Rule 21 |
| Review lifecycle fields on versions are append-once (set at most once per field, never overwritten) | §C2, this document |
| `languageCode` is immutable after creation | Group 8 |
| `languageName` is immutable in v1 | Group 8 |
| `language.direction` is immutable after creation | Group 8 |
| Audit Records are immutable and permanent. No editing, deletion, or archival | FRD §7 Rule 20 |
| Comments cannot be deleted | FRD §7 Rule 22 |
| Release records are immutable once created (except the `ROLLED_BACK` status transition) | FRD §7 Rule 19, Group 4 §2.3 |

### 7.2 No-Deletion Rules

| Entity | Removal Mechanism |
|---|---|
| Page | Deprecation. Never deleted. |
| Tag | Deprecation. Never deleted. |
| Language | Deactivation. Never deleted. |
| English Copy Version | No removal. Permanent. |
| Translation Version | No removal. Permanent. |
| Audit Record | No removal. Permanent. No retention limit. |
| Comment | No removal. Only resolvable. |
| Release | No removal. Permanent (including failed deployments). |
| User | No removal in v1. |

### 7.3 System-Triggered Cascade Rules

| Trigger | Cascade |
|---|---|
| New Tag created | (1) English Copy entity created in NO_COPY state; (2) NO_TRANSLATION slots created for all currently active Languages |
| New Language added | NO_TRANSLATION slots created for all currently active Tags |
| New English Copy version approved (text changed) | All Translation entities for that Tag across all active Languages flagged as STALE |
| All Tags on a Page deprecated | Page transitions to DEPRECATED |
| Translation approved | Implicit Dev publishing triggered for that (Page, Language) pair |
| English Copy approved | Implicit Dev publishing triggered for all active Languages with an approved translation on that Page |

### 7.4 Language Isolation Guarantee

Operations on one language's translation must never affect another language's translation entity. Arabic, Hindi, Spanish, and Turkish are fully independent data sets. This is a hard domain invariant.

### 7.5 Source Language Invariant

English is always the source language. A translation cannot exist for a tag that lacks an approved English Copy version — **except during migration**, where the English copy (version 1) and translations are created simultaneously as part of the same atomic step. In this case, the translation's `sourceEnglishVersion` = 1, which equals the English Copy version 1 just created, so the freshness invariant holds from the moment of creation. This is the only approved exception. There is no operational path for creating a translation without an approved English Copy version. (§C3.)

### 7.6 Publishing Scope Invariant

The unit of publishing is exactly: **1 Page + 1 Language + 1 Environment.** No multi-page or multi-language publishing bundle exists. (FRD §7 Rules 14 and 16.)

### 7.7 Stale Is Advisory, Not Blocking

A Stale translation remains deployed and actively serving content in production. The stale flag signals re-evaluation is needed but does not remove the content or prevent it from being counted in the coverage numerator.

### 7.8 History Version Retention

Version history for both English Copy and Translations is permanent. Every version ever created is retained indefinitely. No archival, summarization, or compaction. (FRD §7 Rule 21.)

---

## 8. What is NOT an Entity

| Concept | Correct Classification | Reason |
|---|---|---|
| Coverage percentage | Derived / read model | Computed from Tags, Releases, and Translation states. Not independently authoritative. |
| Pending work counts | Derived / read model | Aggregated from English Copy and Translation states. |
| Environment Status Matrix | Derived / read model | Computed from Releases. |
| Review Queue | Derived / read model | Filtered projection over English Copy, Translation, Publishing Approval Requests. |
| Activity Timeline | Derived / read model | Filtered projection over Audit Records. |
| Recently-Edited | User-personal projection / read model | Derived from Audit Records + access-event store. No independent write path. |
| Copy Type | Controlled vocabulary / value object | Tag attribute. |
| Module | Controlled vocabulary / value object | Page attribute. |
| Back-translation | Attribute of Translation Version | An immutable snapshot field. |
| Confidence score | Attribute of Translation Version | An immutable snapshot field. |
| Variable integrity status | Attribute of Translation Version | An immutable snapshot field. |
| `staleInfo` block | Value object on Translation entity | A structured attribute. Not a separate entity. |
| `bundleSnapshotHash` | Attribute of Release / Approval Request | A computed integrity check value. |
| `contentSnapshot` | Attribute of Release | An embedded immutable bundle record. |
| Language Services endpoint | External reference | Owned by Language Services; referenced in System Configuration. |
| AI Translation Service | External dependency | Not a MioTranslate-owned entity. |
| Search index | Infrastructure concern | A technology artifact. |
| Access event (view tracking) | Infrastructure tracking mechanism | Powers the Recently-Edited projection. Not a named business entity. |
| Validation Report | Infrastructure read record | A Validation Report is generated and cached by API-1003. It is a report artifact associated with an Import Event, not an independent business entity. |
| Translation rule / glossary | Out of scope (v1) | FRD §18 future consideration. |

---

## 9. Open Questions for Database Design Phase

| # | Question | Entity | Notes |
|---|---|---|---|
| 1 | Should `englishCopyStatus` on the Tag be maintained as a denormalized column or always computed on read? | Tag, English Copy | Trade-off between write complexity and query performance. |
| 2 | Should `currentApprovedText` and `currentApprovedVersionNumber` on English Copy be stored directly or always joined from the version table? | English Copy | Relevant for AI translation context-building query performance. |
| 3 | Should `coveragePercentage` be stored as a precomputed materialized row or recomputed on demand? | Coverage Metrics | High read frequency; source data changes frequently. |
| 4 | Should Translation and English Copy share a generic versioned-content table or have separate tables? | Version entities | Depends on how much the schemas diverge in future iterations. |
| 5 | How should `contentSnapshot` (the full tag bundle embedded in a Release) be stored? | Release | JSON blob, normalized snapshot table, or archive store. |
| 6 | What is the access-event store technology for view tracking? | Recently-Edited | High-write, short-retention pattern — different from the long-retention Audit Record. |
| 7 | What is the indexing strategy for Audit Records given append-only, permanent, high-cardinality? | Audit Record | Critical for audit search and Activity Timeline queries. |

---

## 10. Summary of Corrections (v1.0 → v1.1)

| # | Issue | Correction Applied |
|---|---|---|
| **C1** | English Copy existence contradiction | English Copy entity is created simultaneously with Tag creation, in NO_COPY state. The 1:1 relationship is unconditional, holds from Tag creation, and has no "lazy creation" semantics. NO_COPY is a state of the entity, not an absence of the entity. |
| **C2** | Version immutability vs. mutable review metadata | Separated into two logical parts per version: (a) snapshot content — truly immutable at creation; (b) review lifecycle fields — append-once, set at most once per field as the version progresses through review. No prescription on DB implementation. |
| **C3** | Migration translation exception | `creationMethod: MIGRATED` added as distinct enum value. Migrated translations have `sourceEnglishVersion: 1` matching the English Copy Version 1 created simultaneously. Freshness invariant holds from creation. The source-language invariant is not violated — migration is an atomic step where English copy and translations are created together. |
| **C4** | Translation cardinality for inactive languages | Language `status` (ACTIVE/INACTIVE) controls operational availability only. Translation entities and their full history persist regardless of language status. No Translation entities are deleted or nullified on language deactivation. |
| **C5** | Publishing Approval Request ↔ Release lifecycle | API-0403 creates the Approval Request (no Release yet). API-0404 approval triggers API-0405. API-0405 creates the Release, which references the Approval Request via `approvalRequestId`. Approval Request is an independent governance record; Release references it. The `CANCELLED` status (not `EXPIRED`) is used for hash-mismatch invalidation. |
| **C6** | User Role Assignment history | Added `revokedAt` and `revokedBy` fields to represent role removals. Active roles = grants without revocation. Full grant-and-revoke history is preserved for audit. |
| **C7** | Import Event lifecycle alignment with Group 10 | State machine confirmed as `UPLOAD_READY → PROCESSING → COMPLETED → REPORT_AVAILABLE / FAILED`. There is no `COMPLETED_WITH_SKIPS` state — skips are in the `rowsSkipped` count and the Validation Report's `skippedRows` array. `PASS/PASS_WITH_WARNINGS/FAIL` are Validation Report summary statuses, not Import Event statuses. Coverage recalculation is Step 8 of execution, not a separate state. |
| **C8** | Coverage Metrics numerator | Numerator (`approvedAndDeployedToProduction`) is based on SUCCESSFUL Production Release records (contentSnapshot), not on the Translation entity's current `status`. A stale-but-deployed translation is live content and counts in the numerator per FRD F-16. |
| **C9** | Recently-Edited classification | Reclassified from "user-personal record" (entity) to "user-personal projection / read model." It is derived from two external sources (Audit Records + access-event store) with no independent write path. |
| **C10** | Export Job lifecycle | Clarified as a temporary operational record with defined expiry. Physical storage and cleanup mechanism deferred to DB design. The snapshot boundary (internally consistent at generation time, no partial reads) explicitly stated. |

---

## 11. Entity-Level Consistency Audit — All Locked API Groups 1–10

This section records the findings of a complete entity-level consistency check. Each check covers: identity, cardinality, lifecycle, state, versioning, lineage, immutability, ownership, and derived-vs-source-of-truth boundaries.

---

### 11.1 Group 1 — Pages & Tags

| Finding | Status | Notes |
|---|---|---|
| `pageId` and `tagId` immutability | ✅ Consistent | Group 1 §3.1.6, §3.2.6 enforce no-rename rule. Entity model aligns. |
| `englishCopyStatus` on Tag as denormalized projection | ✅ Consistent | Group 1 §2.2 line 374: "Set to NO_COPY on tag creation. Managed by Group 2 APIs." Entity model now correctly uses "projection" language. |
| NO_TRANSLATION slots created at tag creation | ✅ Consistent | Group 1 §3.2.5 states slot creation as side-effect. Entity model documents this in §2.2 and §7.3. |
| English Copy entity created at tag creation | ✅ Consistent | Group 1 line 612: "English copy status starts at NO_COPY — Set by server." Confirms entity exists from creation. Correction C1 resolves the v1.0 contradiction. |
| Module and Copy Type as controlled vocabularies (not entities) | ✅ Consistent | Group 1 §2.3 documents them as server-managed vocabulary lists. Entity model correctly classifies them as value objects in §8. |
| Page deprecation is system-triggered when all tags deprecated | ✅ Consistent | Group 1 §3.1.7 `:deprecate` custom method references cascade. Entity model §7.3 documents this. |

---

### 11.2 Group 2 — English Copy

| Finding | Status | Notes |
|---|---|---|
| English Copy state machine | ✅ Consistent | `NO_COPY → DRAFT → PENDING_REVIEW → APPROVED` with return loops. Entity model §2.3 aligns. |
| Versioning: each edit creates a new version | ✅ Consistent | Group 2 documents version increment on every text change. Entity model §2.4 aligns. |
| Stale cascade: approval of new English version triggers STALE on translations | ✅ Consistent | Group 2 API-0203 triggers Group 5 API-0501 on text-changed approval. Entity model §7.3 documents this. |
| `SUPERSEDED` status for prior approved versions | ✅ Consistent | Group 2 §2.4 documents version lifecycle. Entity model §2.4 lifecycle rules align. |
| Escalation as an attribute on English Copy Version, not a separate entity | ✅ Consistent | `escalatedToFounder` is a boolean field on the version record. Entity model §8 explicitly classifies escalation as a state flag. |

---

### 11.3 Group 3 — Translation

| Finding | Status | Notes |
|---|---|---|
| Translation identity as compound key (tagId, languageCode) | ✅ Consistent | Group 3 §2.1 uses compound identity throughout. Entity model §2.5 aligns. |
| `STALE` is advisory, not blocking | ✅ Consistent | Group 3 §3.4 documents stale resolution. Group 5 §1.3 cascade model. Entity model §7.7 aligns. |
| `creationMethod` values | ⚠️ Corrected | v1.0 entity model omitted `MIGRATED`. Correction C3 adds `MIGRATED` as a distinct enum value alongside `AI_GENERATED` and `MANUAL`. |
| `sourceEnglishVersion` lineage for migrated translations | ⚠️ Corrected | v1.0 was silent on migration lineage. Correction C3 specifies `sourceEnglishVersion: 1` for all migrated translations. |
| `confidenceScore`, `backTranslation`, `variableIntegrityStatus` as version attributes, not entities | ✅ Consistent | Group 3 §2.2 documents these as fields on the Translation Version. Entity model §8 correctly classifies them. |
| Translation entities persist for inactive languages | ⚠️ Corrected | v1.0 was ambiguous. Correction C4 makes explicit: inactive language status controls operational availability only; Translation entities and history are preserved. |

---

### 11.4 Group 4 — Publishing & Deployment

| Finding | Status | Notes |
|---|---|---|
| Release unit = 1 Page × 1 Language × 1 Environment | ✅ Consistent | Group 4 §1.2 defines the unit. Entity model §7.6 aligns. |
| Release created at execution time (API-0405), not at request time (API-0403) | ⚠️ Corrected | v1.0 described Approval Request as "child of Release" which implied Release precedes Approval Request. Correction C5 establishes: API-0403 creates Approval Request, API-0405 creates Release referencing the Approval Request. |
| `ROLLED_BACK` as a Release status | ⚠️ Corrected | v1.0 entity model omitted `ROLLED_BACK` from the Release state machine. Group 4 §2.3 explicitly documents it. Added in §2.8. |
| `triggerSource` enum values | ⚠️ Corrected | Group 4 §2.2 uses `USER_INITIATED`, `SYSTEM_AUTO_DEV`, `MIGRATION`. v1.0 used `SYSTEM_TRIGGERED`. Corrected to match locked Group 4. |
| `CANCELLED` vs `EXPIRED` for Approval Request invalidation | ⚠️ Corrected | Group 4 §3.4 (API-0404) states: if bundle hash mismatches at approval time, approval request becomes `CANCELLED`. `EXPIRED` = 24-hour timeout. v1.0 incorrectly used `EXPIRED` for hash mismatch. Corrected in §2.9. |
| Self-approval is permitted | ✅ Consistent | Group 4 §3.3 `canSelfApprove` field documents this. Entity model §2.9 aligns. |
| contentSnapshot is the basis for rollback | ✅ Consistent | Group 4 §2.2 documents contentSnapshot as immutable per-tag snapshot. Entity model §2.8 aligns. |
| Approval Request expiry is 24 hours | ✅ Consistent | Group 4 §3.3 `expiresAt` = 24 hours after creation. Entity model §2.9 aligns. |

---

### 11.5 Group 5 — System-Triggered Behaviours

| Finding | Status | Notes |
|---|---|---|
| Audit Records written synchronously with primary mutation | ✅ Consistent | Group 5 §1.1: "must never silently fail" and §3.5 API-0505 design. Entity model §3.1 aligns. |
| GET operations do not produce Audit Records | ✅ Consistent | Group 5 §3.5.2: "Read-only operations (GET) do not produce audit records. No exceptions." Entity model §3.1 aligns. |
| Coverage Metrics is a derived model updated asynchronously | ✅ Consistent | Group 5 API-0503 is triggered by events but runs async. Entity model §4.1 aligns. |
| NO_TRANSLATION slots for new tag created by Group 1 (not Group 5 API-0506) | ✅ Consistent | Group 5 §1.3 note explicitly distinguishes: API-0506 is for "new language → all existing active tags"; tag creation slot creation is a Group 1 side-effect. Entity model §7.3 aligns. |
| `system:{operation}` as performedBy for system-triggered audit records | ✅ Consistent | Group 5 §2.1 documents `system:` prefix. Entity model §3.1 aligns. |

---

### 11.6 Group 6 — Visibility & Reporting

| Finding | Status | Notes |
|---|---|---|
| Coverage Metrics is a derived read model, not a source-of-truth entity | ✅ Consistent | Group 6 API-0601 reads from precomputed coverage table. Entity model §4.1 aligns. |
| Environment Status Matrix is a derived read model | ✅ Consistent | Group 6 API-0607 computes from Release records. Entity model §4.3 aligns. |
| Activity Timeline is a projection over Audit Records | ✅ Consistent | Group 6 API-0605 and Group 9 API-0904 are related: API-0904 is the primary audit read API; API-0605 is a specialized aggregated view. Entity model §4.5 notes both. |

---

### 11.7 Group 7 — Search & Navigation

| Finding | Status | Notes |
|---|---|---|
| Bookmark identity: (userId, targetType, targetId) | ✅ Consistent | Group 7 §2.3 Bookmark resource model. Entity model §5.1 aligns. |
| Bookmark toggle semantics (re-bookmark = remove) | ✅ Consistent | Group 7 §3.2 API-0702 and §3.4 API-0704 define toggle vs. explicit remove. Entity model §5.1 lifecycle rules align. |
| Recently-Edited sources: Audit Records (writes) + access-event store (views) | ✅ Consistent | Group 7 §1.2 table explicitly documents two distinct sources. Entity model §4.6 aligns. Correction C9 reclassifies as projection. |
| Search does not create any new data | ✅ Consistent | Group 7 §1.1: "Search does not add new data." Entity model has no Search entity. |

---

### 11.8 Group 8 — Administration

| Finding | Status | Notes |
|---|---|---|
| User auto-provisioned on first request, no Create User API | ✅ Consistent | Group 8 §2.1 auto-provisioning model. Entity model §2.11 aligns. |
| `languageName` is immutable in v1 | ✅ Consistent | Group 8 §2.2 v1.1 correction: "Immutable in v1." Entity model §2.7 aligns. |
| Language reactivation not supported in v1 | ✅ Consistent | Group 8 §2.2 lifecycle note. Entity model §2.7 aligns. |
| Admin-lockout guard: zero ADMIN/FN users rejected | ✅ Consistent | Group 8 §3.4.1 v1.1 broadened guard. Entity model §2.11 lifecycle rules document this. |
| User Role Assignment must represent revocation | ⚠️ Corrected | v1.0 only modeled grants. Correction C6 adds `revokedAt`/`revokedBy`. Active roles = grants without revocation. |
| System Configuration as singleton | ✅ Consistent | Group 8 §2.3. Entity model §2.13 aligns. |
| Cache staleness bounds (TTL ≤ 30s for roles, languages, config) | ✅ Noted | Group 8 §7 upgrades these to governance invariants. This is an engineering requirement, not an entity model concern. Not addressed in entity model. |

---

### 11.9 Group 9 — Comments, Audit & Export

| Finding | Status | Notes |
|---|---|---|
| Comment scope is at surface level, not version level | ✅ Consistent | Group 9 §2.1 version-independence note. Entity model §2.10 scope semantics align. |
| Comments are permanent, no deletion | ✅ Consistent | Group 9 §2.1 "No deletion" note. Entity model §7.2 aligns. |
| API-0904 is the read path for Audit Records; API-0505 is the write path | ✅ Consistent | Group 9 §1.2 dependency table. Entity model §3.1 notes both. |
| Notification event type catalogue must be a single shared enum (Group 9 = read, Group 5 = write) | ✅ Consistent | Group 9 §2.3.1 EN-G9-05 constraint. Entity model §3.2 uses a single catalogue covering both read and write. |
| Export Job is a transient record, not a domain entity | ⚠️ Corrected | Group 9 §2.4 states: "The export itself is not a persisted MioTranslate entity; it is generated on demand and is not stored." v1.0 was ambiguous about persistence. Correction C10 clarifies lifecycle and defers storage mechanism to DB design. |

---

### 11.10 Group 10 — Migration

| Finding | Status | Notes |
|---|---|---|
| Import Event state machine: UPLOAD_READY → PROCESSING → COMPLETED → REPORT_AVAILABLE / FAILED | ✅ Consistent | Group 10 §3.2.5 Steps 1–9 and §3.3.4 rules. Correction C7 aligns entity model exactly. |
| No COMPLETED_WITH_SKIPS state | ✅ Confirmed | Group 10 has no such state. Skips are in counts.rowsSkipped and report.skippedRows. Entity model §3.3 now explicitly states this. |
| PASS / PASS_WITH_WARNINGS / FAIL are Validation Report summary statuses | ✅ Confirmed | Group 10 §2.3 defines summary.status on the Validation Report Record, not on the Import Event. Entity model §3.3 now explicitly separates these. |
| Coverage recalculation is Step 8 of execution, not a separate Import Event state | ✅ Confirmed | Group 10 §3.2.5 Step 8. EN-G10-05/06 are engineering notes, not entity lifecycle states. Entity model §3.3 aligns. |
| Migrated translations: creationMethod = MIGRATED, confidenceScore = null | ✅ Consistent | Group 10 §3.2.5 Step 6. Entity model §2.6 now documents MIGRATED as a distinct creationMethod value. |
| Migrated content enters as APPROVED + Production-deployed | ✅ Consistent | Group 10 §3.2.6 rule 3. Entity model §7.5 source-language invariant exception documents this. |
| Release records created by migration use triggerSource = MIGRATION | ✅ Consistent | Group 4 §2.2 `triggerSource` and Group 10 §4.2. Entity model §2.8 aligns. |
| Transactional rollback on FAILED: full pre-migration state restored | ✅ Consistent | Group 10 §3.2.5 "On failure" and EN-G10-02. Entity model §3.3 documents this. |

---

*End of MioTranslate Canonical Entity Model — v1.1 (Final, Corrected and Audited).*

*This document is the technology-independent foundation for the MioTranslate Database Design. No database schema, ORM model, or persistence technology decision should be finalized without being validated against this entity model first.*
