# MioTranslate — Cross-Domain Entity Contract & Traceability

**Product:** MioTranslate  
**Document Type:** Entity Architecture — Layer 3 (Final)  
**Document ID:** ED-03  
**Version:** 1.0  
**Author:** Principal Product Data Architect + Principal API Architect + Domain Systems Architect  
**Date:** August 2026  
**Predecessors:** ED-01 v1.1 (Canonical Entity Model), ED-02 v1.0 (Entity Relationships, Lifecycle & Versioning Model)

**Source Documents (all studied before authoring):**  
BRD, FRD (all sections), API List (Domains 1–10), API Design Groups 1–10 (locked), Post-Audit Resolution Walkthrough, ED-01 v1.1, ED-02 v1.0

---

> **Purpose of this document.**  
> ED-03 establishes a single, traceable contract between product concepts, entities, API Groups, system behaviours, and derived models. Where ED-01 defines *what* entities exist, and ED-02 defines *how* they relate and evolve, ED-03 answers *who owns each entity across domain boundaries, who is allowed to change it, who consumes it, and what contract must remain consistent.*  
>  
> This document is the **final Entity Design baseline** and the direct input to the Database Design phase.

---

## Table of Contents

1. Source-of-Truth Classification
2. Entity Domain Contracts (Full Traceability per Entity)
3. Cross-Domain Flow Traces
4. Domain Ownership Validation
5. Cross-Domain Invariants
6. Potential Duplication and Conflicting Source-of-Truth Risks
7. External Dependencies and Boundary Contracts
8. Final Consistency Audit — ED-01 + ED-02 + Groups 1–10 + BRD + FRD

---

## 1. Source-of-Truth Classification

Every entity or model in MioTranslate falls into exactly one of six categories. This classification is the foundation for the DB design: each category has different persistence, mutability, and query requirements.

| Category | Definition | Examples |
|---|---|---|
| **Source of Truth (ST)** | Canonical entity. Owned exclusively by one API Group. Authoritative for all reads and joins. Never duplicated in another domain. | Page, Tag, English Copy, Translation, Language, User, System Configuration |
| **Immutable History (IH)** | Append-only record owned by a parent Source-of-Truth entity. Never mutated after creation (except the single permitted SUPERSEDED/ROLLED_BACK transition). | English Copy Version, Translation Version, Release, Audit Record |
| **Mutable Governance Record (MG)** | Owned by a specific domain. Has lifecycle transitions. Not a version. Not derived. | Publishing Approval Request, User Role Assignment, Comment (with resolve), Notification, Import Event |
| **System Event (SE)** | Triggered and written by the system, not by user action. Immutable once written. | Audit Record (also IH — dual-categorised), Notification |
| **Derived / Read Model (DR)** | Computed from one or more Source-of-Truth entities. Has no independent write path. Never used as authoritative input to business rule validation. | Coverage Metrics, Environment Status Matrix, Review Queue, Activity Timeline, Pending Work Summary, Recently-Edited |
| **User-Personal Record (UP)** | Owned by a specific user. Not shared business state. Not used in business rules. | Bookmark, Recently-Edited |
| **External Reference (EX)** | An entity whose lifecycle is owned by an external system. MioTranslate holds only an identifier or a snapshot of it. | Language Services content (what was pushed), AI Translation Service output (captured as fields in Translation Version) |

### 1.1 Complete Classification Table

| Entity / Model | Category | Owning Domain |
|---|---|---|
| Page | ST | Group 1 — Page & Tag Registry |
| Tag | ST | Group 1 — Page & Tag Registry |
| English Copy | ST | Group 2 — English Copy Management |
| English Copy Version | IH | Group 2 — English Copy Management |
| Translation | ST | Group 3 — Translation Management |
| Translation Version | IH | Group 3 — Translation Management |
| Language | ST | Group 8 — Administration |
| Publishing Approval Request | MG | Group 4 — Publishing & Deployment |
| Release | IH + MG | Group 4 — Publishing & Deployment |
| Import Event | MG | Group 10 — Migration |
| User | ST | Group 8 — Administration |
| User Role Assignment | MG + IH | Group 8 — Administration |
| Comment | MG | Group 9 — Comments, Audit & Export |
| Audit Record | IH + SE | Group 5 — System-Triggered Behaviours |
| Notification | MG + SE | Group 5 — System-Triggered Behaviours |
| Export Job | MG | Group 9 — Comments, Audit & Export |
| Bookmark | UP | Group 7 — Search & Navigation |
| Coverage Metrics | DR | Group 5 — System-Triggered Behaviours (computed by API-0503) |
| Environment Status Matrix | DR | Group 4 → consumed by Group 6 |
| Review Queue | DR | Composite: Groups 2, 3, 4 → consumed by Group 6 |
| Activity Timeline | DR | Group 5 → consumed by Group 6 |
| Pending Work Summary | DR | Composite: Groups 1, 2, 3, 4 → consumed by Group 6 |
| Recently-Edited | UP + DR | Group 7 (user-personal projection) |
| System Configuration | ST | Group 8 — Administration |
| Language Services State | EX | External (Language Services per-environment) |
| AI Translation Output | EX | External (AI Translation Service; captured as TV fields) |

---

## 2. Entity Domain Contracts

### 2.1 Page

| Attribute | Value |
|---|---|
| **Canonical Identity** | `pageId` — system-assigned slug. Globally unique, immutable after creation. |
| **Owning Domain** | Page & Tag Registry |
| **Owning API Group** | Group 1 |
| **FRD Source** | §5.1, F-01, F-02 |
| **APIs That Create It** | API-0101 (Create Page) |
| **APIs That Read It** | API-0103 (List Pages), API-0104 (Get Page Detail), API-0105 (Get Tag Detail — reads parent page), API-0701 (Global Search — returns pages) |
| **APIs That Mutate It** | API-0106 (Update Page Metadata — Page Name, Module); system cascade from API-0107 (Page deprecation when last tag deprecated) |
| **APIs That Consume pageId as Reference** | API-0302, API-0402, API-0403, API-0404, API-0405, API-0406, API-0407, API-0503, API-0601, API-0602, API-0603, API-0607, API-1002 |
| **Lifecycle Owner** | Group 1 exclusively |
| **Version/History Owner** | None. Pages have no version history. Page Name and Module changes are in-place mutations recorded in Audit Records. |
| **Source-of-Truth Status** | Yes — Page is the authoritative source for page identity, name, module, and status |
| **Derived-Model Consumers** | Coverage Metrics (denominator is per-page active-tag count); Environment Status Matrix (per-page rows); Pending Work Summary (page-scoped counts) |
| **External Dependencies** | None |
| **Cross-Domain Read Contract** | Groups 3, 4, 5, 6, 10 read `pageId` and `pageName` from Group 1's page records. No other group may create or deprecate a Page. |

---

### 2.2 Tag

| Attribute | Value |
|---|---|
| **Canonical Identity** | `tagId` — globally unique, must begin with `pageId_` prefix. Immutable after creation. |
| **Owning Domain** | Page & Tag Registry |
| **Owning API Group** | Group 1 |
| **FRD Source** | §5.1, F-02, §4.2 |
| **APIs That Create It** | API-0102 (Create Tag) |
| **APIs That Read It** | API-0105 (Get Tag Detail), API-0104 (Get Page Detail — returns tag list), API-0402 (Pre-Publishing Summary — reads tag statuses), API-0701 (Global Search — returns tags), API-0308 (Translation Version History — references tagId) |
| **APIs That Mutate It** | API-0108 (Update Tag Metadata — Copy Type); API-0107 (Deprecate Tag — status transition) |
| **APIs That Consume tagId as Reference** | API-0201, API-0202, API-0203, API-0204 (English Copy), API-0301–API-0309 (Translations), API-0901–API-0903 (Comments), API-0905 (Export), API-0501, API-0506, API-0503 (system ops) |
| **Critical Side-Effect on Creation** | (a) English Copy entity created simultaneously in NO_COPY state; (b) NO_TRANSLATION slots created for all currently active Languages |
| **Critical Side-Effect on Deprecation** | (a) Coverage recalculated for all active languages — denominator decreases; (b) If last active tag on page: Page status → DEPRECATED |
| **Lifecycle Owner** | Group 1 exclusively |
| **Version/History Owner** | None. Tag has no version history. The `tagName` (used in Language Services) and `copyType` changes are in-place mutations. |
| **Source-of-Truth Status** | Yes — Tag is authoritative for `tagId`, `pageId`, `tagName`, `copyType`, `status`, and `englishCopyStatus` (denormalized projection from EC) |
| **Derived-Model Consumers** | Coverage Metrics (totalActiveTags denominator); Review Queue (tag context in review items); Pending Work Summary (tags needing English copy count) |
| **External Dependencies** | `tagId` maps to `tagName` in Language Services. Language Services does not know about `pageId`, `copyType`, or `status`. The mapping is maintained by MioTranslate. |
| **Cross-Domain Read Contract** | Group 3 (Translation) reads Tag to validate ACTIVE status and get `englishCopyStatus` before accepting translation operations. Group 4 reads Tag during bundle construction. Groups 6/7 read Tag for display. No other group creates or deprecates Tags. |

---

### 2.3 English Copy

| Attribute | Value |
|---|---|
| **Canonical Identity** | `tagId` (1:1 with Tag — no separate EC ID). Uniquely identified by its owner Tag. |
| **Owning Domain** | English Copy Management |
| **Owning API Group** | Group 2 |
| **FRD Source** | §5.2, F-04, F-05, §4.3 |
| **APIs That Create It** | Implicitly by API-0102 (Tag creation creates the EC entity in NO_COPY state). No direct "Create EC" API exists — the entity always exists. |
| **APIs That Initialize It (NO_COPY → DRAFT)** | API-0201 (Save English Copy Draft — first text authored) |
| **APIs That Read It** | API-0105 (Get Tag Detail), API-0204 (Get English Copy Version History), API-0402 (Pre-Publishing Summary reads current approved text), API-0606 (Review Queue shows PENDING_REVIEW EC), API-0701 (Search searches English copy text) |
| **APIs That Mutate Status** | API-0201 (→ DRAFT), API-0202 (→ PENDING_REVIEW), API-0203 (→ APPROVED or back to DRAFT; or PENDING_REVIEW for escalation) |
| **APIs That Consume English Copy** | API-0301, API-0302, API-0307 (AI Translation — reads approved English text + context). API-0501 (Stale Flagging — triggered when approved English changes). API-0502 (Implicit Dev Publish — triggered on English approval). |
| **Lifecycle Owner** | Group 2 exclusively. Status transitions are owned here. |
| **Version/History Owner** | Group 2. English Copy Versions are owned by English Copy (→ Group 2). Reads via API-0204. |
| **Source-of-Truth Status** | Yes — Group 2 is the authoritative source for English copy status, approved text, and version history |
| **Derived-Model Consumers** | Review Queue (PENDING_REVIEW English Copies); Pending Work Summary (EC counts by status); Activity Timeline (EC approval events via Audit Records) |
| **External Dependencies** | Approved English text is passed to the AI Translation Service (external) as the source string. The AI Translation Service output is captured in Translation Versions. |
| **Cross-Domain Read Contract** | Group 3 (Translation) requires `englishCopyStatus == APPROVED` before any translation operation (Rules I-28, I-30). This is validated by reading the EC entity. Group 2 is the only source of this truth. Group 4 reads approved English copy text for bundle construction. |

> **`englishCopyStatus` Denormalization Warning:** The Tag entity (Group 1) holds a `Tag.englishCopyStatus` field as a denormalized projection of `EnglishCopy.status`. This is a performance optimization. Group 1 does not own this field — it is a read-through from Group 2. At DB design time, a decision must be made: (a) trust the denormalized `Tag.englishCopyStatus` for fast reads, or (b) always join to English Copy. If denormalized, the DB must guarantee consistency between `Tag.englishCopyStatus` and `EnglishCopy.status` on every state transition in Group 2.

---

### 2.4 English Copy Version

| Attribute | Value |
|---|---|
| **Canonical Identity** | `(tagId, versionNumber)` — compound. Sequential integers starting at 1 per Tag, no gaps. |
| **Owning Domain** | English Copy Management |
| **Owning API Group** | Group 2 |
| **FRD Source** | §4.3, F-04, F-05, §7 Rule 21 |
| **APIs That Create It** | API-0201 (first text authored → Version 1; new edit after approval → Version N+1) |
| **APIs That Read It** | API-0204 (Get English Copy Version History); API-0105 (Tag Detail shows current approved version); API-0301/0302/0307 (AI translation reads approved version text) |
| **APIs That Mutate Status Fields** | API-0202 (status field: DRAFT → PENDING_REVIEW); API-0203 (status field: PENDING_REVIEW → APPROVED/DRAFT; prior approved → SUPERSEDED); API-0203 escalation (sets `escalatedToFounder: true` — once only) |
| **Immutable Snapshot Content** | `text`, `authoredBy`, `authoredAt`, `changeReason` — written at creation, never overwritten |
| **Append-Once Review Fields** | `submittedForReviewAt/By`, `reviewedBy/At`, `approvedBy/At`, `escalatedToFounder` — each written at most once |
| **APIs That Consume as Reference** | Translation Versions reference English Copy Version via `sourceEnglishVersion` integer. |
| **Lifecycle Owner** | Group 2. Status progression is owned here. |
| **Source-of-Truth Status** | Immutable History — each version is a permanent, authoritative record once created. The only permitted post-creation change is status → SUPERSEDED. |
| **External Dependencies** | None |
| **Cross-Domain Read Contract** | Group 3 (Translation Version) stores `sourceEnglishVersion` as a reference to this entity's `versionNumber`. The value is set at Translation Version creation time and never changed. The referenced English Copy Version's `text` provides the snapshot context for the freshness invariant. |

---

### 2.5 Translation

| Attribute | Value |
|---|---|
| **Canonical Identity** | `(tagId, languageCode)` — natural compound key. No surrogate `translationId`. Unique per Tag × Language pair. |
| **Owning Domain** | Translation Management |
| **Owning API Group** | Group 3 |
| **FRD Source** | §5.3, F-06–F-10, §4.4 |
| **APIs That Create Slots** | Automatically: API-0102 (Tag creation creates NO_TRANSLATION slots for all active Languages); API-0506 (Language addition creates NO_TRANSLATION slots for all active Tags) |
| **APIs That Initialize Content** | API-0301 (AI single — NO_TRANSLATION → DRAFT), API-0302 (AI bulk — NO_TRANSLATION → DRAFT), API-0303 (Manual edit from NO_TRANSLATION → DRAFT) |
| **APIs That Read It** | API-0105 (Tag Detail shows per-language translation status), API-0308 (Version History), API-0603 (Stale Report), API-0606 (Review Queue — PENDING_REVIEW items) |
| **APIs That Mutate Status** | API-0303 (→ DRAFT), API-0304 (→ APPROVED, or new version + DRAFT, or → REJECTED, or → NO_TRANSLATION), API-0305 (→ APPROVED), API-0306 (→ APPROVED), API-0307 (new AI version → DRAFT), API-0309 (→ PENDING_REVIEW); API-0501 (→ STALE, system-triggered) |
| **APIs That Consume Translation** | API-0405 (Publishing — reads APPROVED translations to build bundle), API-0407 (Rollback — reads historical contentSnapshot), API-0503 (Coverage — reads status distribution), API-0602 (Language Readiness — reads per-language status) |
| **staleInfo Field Ownership** | Owned by Group 3 (canonical model defined in Group 3 §2.2). Populated by API-0501 (Group 5). No other group touches staleInfo. |
| **Lifecycle Owner** | Group 3. All status transitions (except STALE flagging) are Group 3 operations. |
| **Version/History Owner** | Group 3. Translation Versions are owned by Translation (→ Group 3). Reads via API-0308. |
| **Source-of-Truth Status** | Yes — Translation is the authoritative source for translation text, status, staleInfo, and version |
| **Derived-Model Consumers** | Coverage Metrics (status counts); Stale Report (STALE translations); Review Queue (PENDING_REVIEW translations); Pending Work Summary (status-distribution counts) |
| **External Dependencies** | (a) AI Translation Service: generates text, confidenceScore, backTranslation for AI-created versions. (b) Language Services: receives APPROVED translation text via API-0405. MioTranslate does not read back from Language Services after publish — the contentSnapshot is the authoritative record of what was sent. |
| **Cross-Domain Read Contract** | Group 4 (Publishing) reads APPROVED translations to construct publishing bundles. Group 4 must never read DRAFT, PENDING_REVIEW, or STALE translations into a bundle. Group 5 (API-0501) writes staleInfo as a side-effect of Group 2 (English Copy) approval — this is the only cross-domain write on a Group 3 entity, and it is tightly specified (Group 5 §3.1). |

---

### 2.6 Translation Version

| Attribute | Value |
|---|---|
| **Canonical Identity** | `(tagId, languageCode, versionNumber)` — compound. Sequential integers starting at 1 per (Tag, Language), no gaps. |
| **Owning Domain** | Translation Management |
| **Owning API Group** | Group 3 |
| **FRD Source** | §4.4, §7 Rule 21, F-06–F-10 |
| **APIs That Create It** | API-0301 (→ V1, AI_GENERATED), API-0302 (→ V1, AI_GENERATED), API-0303 (→ V1 or VN+1, MANUAL), API-0304 EDIT_AND_APPROVE (→ VN+1, MANUAL), API-0304 REQUEST_RETRANSLATION (→ VN+1, AI_GENERATED), API-0306 CONFIRM_STALE (→ VN+1, MANUAL), API-0307 (→ VN+1, AI_GENERATED), API-1002 MIGRATION (→ V1, MIGRATED) |
| **APIs That Do NOT Create a Version** | API-0309 (Submit for Review — no version bump), API-0304 APPROVE (no version bump), API-0305 BULK_APPROVE (no version bump) |
| **APIs That Read It** | API-0308 (Get Translation Version History) |
| **Immutable Snapshot Content** | `text`, `creationMethod`, `sourceEnglishVersion`, `confidenceScore`, `backTranslation`, `variableIntegrityStatus`, `author`, `authoredAt`, `changeReason` — written at creation, never overwritten |
| **Append-Once Review Fields** | `submittedForReviewAt/By`, `reviewedBy/At`, `approvedBy/At`, `rejectionReason` — each written at most once |
| **Key Lineage Field** | `sourceEnglishVersion` — integer referencing the English Copy versionNumber that was current-approved when this TV was created. Set at creation, never changed. |
| **Lifecycle Owner** | Group 3 |
| **Source-of-Truth Status** | Immutable History |
| **External Dependencies** | AI Translation Service output (text, confidenceScore, backTranslation) captured at creation. Language Services receives text at publish time. |
| **Cross-Domain Contract** | Release (Group 4) contentSnapshot stores `translationVersion` (integer) and `translationText` per tag. The Group 4 contentSnapshot is a point-in-time copy, not a live reference. The Translation Version remains the authoritative source for what text existed at a given version number. |

---

### 2.7 Language

| Attribute | Value |
|---|---|
| **Canonical Identity** | `languageCode` — ISO 639-1 code. Globally unique, including inactive languages. Immutable after creation. |
| **Owning Domain** | Administration |
| **Owning API Group** | Group 8 |
| **FRD Source** | §5.7, §4.5 |
| **APIs That Create It** | API-0802 (Add Language) |
| **APIs That Read It** | API-0807 (List Languages); consumed as reference by all translation APIs (Group 3), all publishing APIs (Group 4), and all reporting APIs (Group 6) |
| **APIs That Mutate It** | API-0803 (Deactivate Language — ACTIVE → INACTIVE) |
| **APIs That Consume Language as Reference** | API-0301–0309 (language must be ACTIVE), API-0403, API-0405, API-0601, API-0602, API-0603, API-0607, API-0506 |
| **Critical Side-Effect on Creation** | API-0506 (Create Empty Translation Slots) — creates NO_TRANSLATION for every active Tag. This is a Group 5 operation triggered by Group 8. |
| **Critical Side-Effect on Deactivation** | None on Translation entities. The Language's INACTIVE status prevents new Translation operations; existing Translations, Versions, and Releases are preserved. |
| **Lifecycle Owner** | Group 8 exclusively |
| **Version/History Owner** | None. Language has no version history. |
| **Source-of-Truth Status** | Yes — Language is the authoritative source for language configuration, direction (RTL/LTR), and status |
| **Derived-Model Consumers** | Coverage Metrics (per-language coverage cells); Environment Status Matrix (per-language columns) |
| **External Dependencies** | Language names used in Language Services payloads (e.g., `"arabic"` as a key in `values`). The mapping from MioTranslate `languageCode` to Language Services language name is a system configuration concern. |

---

### 2.8 Publishing Approval Request (PAR)

| Attribute | Value |
|---|---|
| **Canonical Identity** | `approvalRequestId` — system-generated UUID. Globally unique. |
| **Owning Domain** | Publishing & Deployment |
| **Owning API Group** | Group 4 |
| **FRD Source** | §5.5, F-11 |
| **APIs That Create It** | API-0403 (Request Publishing Approval) |
| **APIs That Read It** | API-0404 (Approve or Reject — reads PAR to take decision); API-0606 (Review Queue — shows PENDING PARs as PUBLISHING_APPROVAL items) |
| **APIs That Mutate Status** | API-0404 (→ APPROVED, REJECTED, or CANCELLED); system timer (→ EXPIRED after 24 hours) |
| **Lifecycle Owner** | Group 4 exclusively |
| **Version/History Owner** | None. PAR is a single governance record; no version history. |
| **Source-of-Truth Status** | Mutable Governance Record |
| **Cross-Domain Contract** | PAR is created before the Release. When the PAR is APPROVED, API-0404 creates the Release and sets `Release.approvalRequestId`. The Release references the PAR; the PAR does not reference the Release. This ownership direction means: if you have a Release, you can find its PAR; if you have a PAR, you cannot directly find its Release without querying Release by approvalRequestId. |
| **System Auto-Dev Exception** | Implicit Dev Publishing (API-0502) does NOT create a PAR. It creates an internal approval record (`approvedBy: system:auto-publish`) and passes directly to API-0405. DEV environment publishing does not require a human approval PAR. |
| **Migration Exception** | Migration-created Releases (API-1002) also do NOT create a PAR. These are bootstrapped historical records with `triggerSource: MIGRATION`. |

---

### 2.9 Release

| Attribute | Value |
|---|---|
| **Canonical Identity** | `releaseId` (system-generated) + deployment identity: `(pageId, languageCode, environment, deploymentVersion)`. The compound identity must be unique. `deploymentVersion` is a sequential integer per `(pageId, languageCode, environment)`. |
| **Owning Domain** | Publishing & Deployment |
| **Owning API Group** | Group 4 |
| **FRD Source** | §5.5, §4.9, F-11, F-12 |
| **APIs That Create It** | API-0404 (Approve — creates Release with status PENDING, then triggers API-0405); API-0502 (Implicit Dev Publish — creates Release with `publishedBy: system:auto-publish`); API-1002 (Migration — creates Release with `triggerSource: MIGRATION`, `status: SUCCESSFUL`) |
| **APIs That Read It** | API-0406 (Get Deployment History — reads all Releases for a scope); API-0401 (Environment Status — reads most recent SUCCESSFUL Release per scope); API-0607 (Environment Matrix — reads Releases); API-0407 (Rollback — reads prior SUCCESSFUL Release to get contentSnapshot) |
| **APIs That Mutate It** | API-0405 (Execute Publishing — transitions status: PENDING → IN_PROGRESS → SUCCESSFUL/FAILED). The only additional post-creation mutation: prior SUCCESSFUL Release → ROLLED_BACK (set when a later Rollback Release succeeds). |
| **Immutable Snapshot** | `contentSnapshot` — the set of tags, their translationVersion, sourceEnglishVersion, and translationText that were pushed to Language Services. Written at API-0405 success. Never mutated. |
| **Lifecycle Owner** | Group 4 |
| **Source-of-Truth Status** | Immutable History (content snapshot fields) + Mutable Governance (status can transition to ROLLED_BACK) |
| **Derived-Model Consumers** | Coverage Metrics (numerator: tags in PRODUCTION SUCCESSFUL contentSnapshots); Environment Status Matrix (current status per scope); Deployment History (ordered Release records) |
| **External Dependencies** | Language Services: the actual publishing target. Release records what was sent and what Language Services responded. MioTranslate does not read back from Language Services after publish. |
| **Rollback Lineage** | `rolledBackFromDeploymentVersion` on the new Rollback Release points to the `deploymentVersion` of the Release being reverted from. The target (restored) version's contentSnapshot is copied verbatim into the Rollback Release. |
| **Cross-Domain Contract** | Coverage Metrics (Group 5/6) reads from Release records to determine what is actually deployed in Production. The Release contentSnapshot is the authoritative record of what Language Services received — not the current Translation.status. |

---

### 2.10 Import Event

| Attribute | Value |
|---|---|
| **Canonical Identity** | `migrationId` — system-generated. |
| **Owning Domain** | Migration |
| **Owning API Group** | Group 10 |
| **FRD Source** | F-21, §4.12 |
| **APIs That Create It** | API-1001 (Upload Import File — creates Import Event in UPLOAD_READY state) |
| **APIs That Read It** | API-1002 sub-endpoint `GET /v1/migrations/{migrationId}` (status polling); API-1003 (Get Validation Report) |
| **APIs That Mutate Status** | API-1002 (→ PROCESSING → COMPLETED / FAILED); API-1003 (triggers → REPORT_AVAILABLE on first call after COMPLETED) |
| **Lifecycle Owner** | Group 10 exclusively |
| **Source-of-Truth Status** | Mutable Governance Record — owns the status and counts of the migration operation |
| **Entities Created by Import Event** | Pages, Tags, English Copies, English Copy Versions, Translations, Translation Versions, Releases. The Import Event is the causal record; the created entities become source-of-truth entities in their respective domains. |
| **Cross-Domain Contract** | Migration-created entities are indistinguishable from normally-created entities in all domains except: (a) `Translation.creationMethod == MIGRATED`; (b) `Release.triggerSource == MIGRATION`. All other entity fields conform to the same schema as normal entities. |

---

### 2.11 User

| Attribute | Value |
|---|---|
| **Canonical Identity** | `userId` — system-assigned. Globally unique. |
| **Owning Domain** | Administration |
| **Owning API Group** | Group 8 |
| **FRD Source** | §2, §5.7, §8 |
| **APIs That Create It** | Implicit: User record auto-created on first authenticated request. No explicit "Create User" API. |
| **APIs That Read It** | API-0801 (List Users and Roles) |
| **APIs That Mutate It** | User has no content mutations. Role changes are handled via User Role Assignment (see §2.12). |
| **Source-of-Truth Status** | Source of Truth |
| **Cross-Domain Contract** | `userId` appears in Audit Records (`performedBy`), in Translation review fields (`approvedBy`, `reviewedBy`), in English Copy review fields, in Comments (`authorId`), in Notifications (`recipientUserId`), in User Role Assignments. Group 8 is the authoritative source for user identity; all other domains hold `userId` references only. |

---

### 2.12 User Role Assignment

| Attribute | Value |
|---|---|
| **Canonical Identity** | `(userId, role, assignedAt)` — compound. A user can hold multiple roles; each is a separate assignment record. |
| **Owning Domain** | Administration |
| **Owning API Group** | Group 8 |
| **FRD Source** | §5.7, §8 (RBAC) |
| **APIs That Create It** | API-0804 (Assign or Update User Role — creates grant record for each new role) |
| **APIs That Mutate It** | API-0804 (Revoke: sets `revokedAt/revokedBy` — append-once) |
| **APIs That Read It** | API-0801 (List Users and Roles — current active assignments); every API that enforces RBAC reads the active role set |
| **Source-of-Truth Status** | Mutable Governance Record + Immutable History (grant records are permanent; revocation writes once to `revokedAt/revokedBy`) |
| **Cross-Domain Contract** | RBAC enforcement is implemented by every API Group reading active User Role Assignments (where `revokedAt IS NULL`). Group 8 is the only group that writes to User Role Assignments. |

---

### 2.13 Comment

| Attribute | Value |
|---|---|
| **Canonical Identity** | `commentId` — system-generated. |
| **Owning Domain** | Comments, Audit & Export |
| **Owning API Group** | Group 9 |
| **FRD Source** | F-18, §9.5 |
| **APIs That Create It** | API-0901 (Add Comment) |
| **APIs That Read It** | API-0902 (Get Comments); API-0105 (Tag Detail — shows comment count) |
| **APIs That Mutate It** | API-0903 (Resolve Comment — sets `resolved: true`, once only) |
| **Source-of-Truth Status** | Mutable Governance Record (resolved state is mutable; content is immutable) |
| **Surface Scope Rule** | Comments are owned by Tags, not by English Copy Versions or Translation Versions. A comment posted on a tag remains visible regardless of which version the tag is currently on. This is an explicit product decision. |
| **Cross-Domain Contract** | Group 9 is the only group that creates Comments. No other group reads Comments for business rule purposes — they are editorial context, not business state. |

---

### 2.14 Audit Record

| Attribute | Value |
|---|---|
| **Canonical Identity** | `auditRecordId` — system-generated. Globally unique. |
| **Owning Domain** | System-Triggered Behaviours (write path); Comments, Audit & Export (read path) |
| **Owning API Group** | Group 5 (API-0505 — write); Group 9 (API-0904 — read) |
| **FRD Source** | F-17, §4.11 |
| **APIs That Create It** | API-0505 (Create Audit Record — triggered by every write API across all domains) |
| **APIs That Read It** | API-0904 (Get Audit Trail); API-0605 (Activity Timeline — reads Audit Records for display) |
| **Source-of-Truth Status** | Immutable History + System Event |
| **Ownership Model** | Audit Records have no parent entity in the domain model. They are orthogonal records that reference any subject entity. Reference is one-way: Audit Record → Subject Entity. Subject entities do not store references to their Audit Records. |
| **Completeness Guarantee** | Every completed write operation across all 10 groups produces an Audit Record. A write that completes without producing an Audit Record is a system integrity fault. |
| **Cross-Domain Contract** | API-0505 is a cross-cutting concern invoked by all write APIs. Group 9's API-0904 is the query interface. No other group may directly write Audit Records — all writes go through API-0505. Group 6's API-0605 (Activity Timeline) reads Audit Records via API-0904 or directly from the Audit store. |

---

### 2.15 Notification

| Attribute | Value |
|---|---|
| **Canonical Identity** | `notificationId` — system-generated. |
| **Owning Domain** | System-Triggered Behaviours (write path); Comments, Audit & Export (user-read path) |
| **Owning API Group** | Group 5 (API-0504 — write); Group 9 (API-0906, API-0907 — user read/mark-read) |
| **FRD Source** | §12 (11 notification events) |
| **APIs That Create It** | API-0504 (Dispatch Notification — triggered by significant write events across all groups) |
| **APIs That Read It** | API-0906 (Get Notifications — per user) |
| **APIs That Mutate It** | API-0907 (Mark as Read — `status: UNREAD → READ`, `readAt` written once) |
| **Source-of-Truth Status** | Mutable Governance Record + System Event |
| **Delivery Contract** | Notification records are persisted regardless of delivery outcome. A `DELIVERY_FAILED` record is still a valid, readable Notification. |
| **Cross-Domain Contract** | API-0504 is async and non-blocking. Delivery failures do not roll back or block the primary operation that triggered them. Group 9 provides the user-facing read API. |

---

### 2.16 Export Job

| Attribute | Value |
|---|---|
| **Canonical Identity** | `exportId` — system-generated. |
| **Owning Domain** | Comments, Audit & Export |
| **Owning API Group** | Group 9 |
| **FRD Source** | F-19, §9.9 |
| **APIs That Create It** | API-0905 (Export Tag Data) |
| **APIs That Read It** | `GET /v1/exports/{exportId}` (status check — sub-endpoint of API-0905); `GET /v1/exports/{exportId}/download` (download — sub-endpoint of API-0905) |
| **Source-of-Truth Status** | Mutable Governance Record (transient — expires after download or configured TTL) |
| **Snapshot Model** | Export captures the state of Tags, English Copy, and Translations at export time. It is read-only and cannot be re-imported. Not a source of truth for any entity. |
| **Cross-Domain Contract** | Export reads from Groups 1, 2, and 3 (Tag, English Copy, Translation). It has no write side-effects on any entity. |

---

### 2.17 Coverage Metrics

| Attribute | Value |
|---|---|
| **Canonical Identity** | `(pageId, languageCode)` — compound. One coverage record per page × language. |
| **Owning Domain** | System-Triggered Behaviours (compute); Visibility & Reporting (consume) |
| **Owning API Group** | Group 5 (API-0503 — compute and write); Group 6 (API-0601, API-0602 — consume) |
| **FRD Source** | F-16, §5.6, §13.1 |
| **APIs That Compute It** | API-0503 (Recalculate Coverage — 9 trigger events) |
| **APIs That Read It** | API-0601 (Coverage Dashboard), API-0602 (Language Readiness) |
| **Source-of-Truth Status** | Derived / Read Model — precomputed materialized values. Never used as authoritative input to business rule validation. `computedAt` timestamp indicates freshness. |
| **Formula** | `coveragePercentage = (tags with APPROVED translation in most recent SUCCESSFUL Production Release contentSnapshot) / (total active tags on page) × 100` |
| **Source Entities** | Denominator: Tag (active count per page). Numerator: Release contentSnapshot (PRODUCTION, SUCCESSFUL — which tags were deployed). Status distribution: Translation current status. |
| **Cross-Domain Contract** | Coverage Metrics must never be used to determine whether a specific translation is publishable — the Translation entity's own status is authoritative for that. Coverage is a retrospective reporting metric only. |

---

### 2.18 System Configuration

| Attribute | Value |
|---|---|
| **Canonical Identity** | Singleton (system-wide). No compound key. |
| **Owning Domain** | Administration |
| **Owning API Group** | Group 8 |
| **FRD Source** | §5.7 |
| **APIs That Read It** | API-0805 (Get System Configuration); API-0305 reads `bulkApprovalConfidenceThreshold` during Bulk Approve |
| **APIs That Mutate It** | API-0806 (Update System Configuration) |
| **Key Fields** | `bulkApprovalConfidenceThreshold` (default 95%), environment endpoint URLs (DEV/QA/PROD), domain name (`miosalon`), PAR expiry duration (default 24h) |
| **Source-of-Truth Status** | Source of Truth — singleton entity |
| **Cross-Domain Contract** | Groups 3 (API-0305) and 4 (PAR expiry, environment endpoints) read System Configuration values. Changes to System Configuration take effect immediately for subsequent operations. |

---

## 3. Cross-Domain Flow Traces

### 3.1 The Primary Content Production Flow

`Page → Tag → English Copy → Translation → Release → Coverage`

```
BRD Objective 1, 2, 3, 4, 5
FRD §5.1 → §5.2 → §5.3 → §5.5 → §5.6

STEP 1: Page registered
  API-0101 (Group 1)
  Entity created: Page (ST, Group 1)
  Side-effects: AUDIT (Group 5, API-0505)
  Constraint: pageId must be unique

STEP 2: Tag created
  API-0102 (Group 1)
  Entity created: Tag (ST, Group 1)
  Entities created simultaneously:
    → English Copy (ST, Group 2) in NO_COPY state
    → Translation entities (ST, Group 3) in NO_TRANSLATION state per active Language
  Side-effects:
    → AUDIT per tag + per translation slot (Group 5, API-0505)
    → NOTIFICATION: NEW_PAGE_OR_TAG_CREATED → PM, QA (Group 5, API-0504)
    → Coverage recalculated (Group 5, API-0503): denominator increases

STEP 3: English copy authored and approved
  API-0201 → API-0202 → API-0203 (all Group 2)
  Entity created: English Copy Version N (IH, Group 2)
  Status transitions: NO_COPY → DRAFT → PENDING_REVIEW → APPROVED
  Side-effects on approval (text changed):
    → AUDIT (Group 5, API-0505)
    → NOTIFICATION: ENGLISH_COPY_APPROVED → author (Group 5, API-0504)
    → API-0501: Translations flagged STALE if any existed (Group 5)
    → API-0502: Implicit DEV publish check (Group 5) — no-op on first approval (no translations yet)

STEP 4: Translation generated and approved
  API-0301/0302 (Group 3) → API-0304/0305 (Group 3)
  Entity created: Translation Version 1 (IH, Group 3)
    sourceEnglishVersion = current approved English version number
  Status transitions: NO_TRANSLATION → DRAFT → APPROVED
  Side-effects on approval:
    → AUDIT (Group 5, API-0505)
    → NOTIFICATION: TRANSLATION_APPROVED → PM (Group 5, API-0504)
    → API-0502: Implicit DEV publish (Group 5) triggered:
        → Release created (IH, Group 4) for (pageId, language, DEV)
        → contentSnapshot persisted (Group 4)
        → AUDIT: PAGE_BUNDLE_AUTO_PUBLISHED (Group 5)
        → Coverage recalculated (Group 5, API-0503)

STEP 5: Production publishing
  API-0402 → API-0403 → API-0404 → API-0405 (all Group 4)
  Entity created: Publishing Approval Request (MG, Group 4) → APPROVED
  Entity created: Release (IH, Group 4) for (pageId, language, PRODUCTION)
    contentSnapshot: snapshot of APPROVED translation versions at publish time
  Side-effects:
    → AUDIT: PAGE_BUNDLE_PUBLISHED (Group 5)
    → NOTIFICATION: PAGE_BUNDLE_PUBLISHED_TO_PRODUCTION → PM, SR (Group 5)
    → Coverage Metrics updated (Group 5, API-0503):
        → approvedAndDeployedToProduction increases
        → coveragePercentage increases

STEP 6: Coverage visible
  API-0601 / API-0602 (Group 6)
  Reads Coverage Metrics (DR, Group 5/6) — precomputed values
  Source: Release contentSnapshot (Group 4) + Tag active count (Group 1)
  
Domain Hand-offs in this flow:
  Group 1 → Group 2: English Copy created by Group 1 action, owned by Group 2
  Group 1 → Group 3: Translation slots created by Group 1 action, owned by Group 3
  Group 2 → Group 5: English approval triggers Group 5 cascade
  Group 3 → Group 5: Translation approval triggers Group 5 cascade
  Group 5 → Group 4: API-0502 invokes Group 4 publishing
  Group 4 → Group 5: Publishing success triggers Group 5 coverage recalculation
  Group 5 → Group 6: Coverage Metrics computed by Group 5, consumed by Group 6
```

---

### 3.2 English Approval → Stale Triggering → Translation → Publishing

`English Copy approved (text changed) → STALE flagging → Translation resolution → DEV publish`

```
FRD §5.2, F-05, F-10, Business Rule 5

TRIGGER: API-0203 (Group 2) approves English version, newText ≠ previousText

Group 2 → Group 5 (API-0501):
  For each active Language for this Tag:
    NO_TRANSLATION → skip
    DRAFT / PENDING_REVIEW / APPROVED → STALE
    Already STALE → update staleInfo.currentEnglishVersion only
  Side-effects per language:
    → AUDIT: TRANSLATION_STALE_FLAGGED (Group 5)
    → NOTIFICATION: ENGLISH_COPY_CHANGED_STALE_TRIGGER → LRs (Group 5)
    → Coverage recalculated (stale counts change, deployed count unchanged)

Note on DEV publishing after English change:
  Group 5 (API-0502) checks for APPROVED translations to auto-publish to DEV.
  Translations just flagged STALE are no longer APPROVED.
  If all translations are now STALE: no DEV publish triggered.
  If some languages had APPROVED translations (e.g., a language not yet flagged): those may trigger DEV publish.

STALE Resolution (later, by LR/FN):
  Path A — Confirm Stale (API-0306, Group 3):
    → New TV N+1 created (MANUAL, sourceEnglishVersion: new version)
    → Translation: STALE → APPROVED
    → API-0502 triggered (Group 5 → Group 4): DEV publish
    → AUDIT: TRANSLATION_STALE_CONFIRMED (Group 5)
    
  Path B — Retranslate Stale (API-0307, Group 3):
    → New TV N+1 created (AI_GENERATED) → DRAFT
    → Requires LR approval (API-0304) → then API-0502 triggers DEV publish
    
  Path C — Manual Edit (API-0303, Group 3):
    → New TV N+1 created (MANUAL) → DRAFT
    → Requires LR approval → then DEV publish

In all resolution paths:
  Old STALE version preserved as SUPERSEDED in Translation Version history (IH, Group 3)
  staleInfo cleared from live Translation record after resolution
```

---

### 3.3 Translation Approval → Dev Publishing → Release

`Translation approved → implicit DEV publish → Release → Coverage`

```
FRD §17 Resolved, API-0304/0305 (Group 3), API-0502 (Group 5), API-0405 (Group 4)

Group 3 (API-0304 APPROVE or API-0305 BULK_APPROVE):
  → Translation: DRAFT/PENDING_REVIEW → APPROVED (no new TV for direct approve)
  → AUDIT: TRANSLATION_APPROVED (Group 5)
  → NOTIFICATION: TRANSLATION_APPROVED → PM (Group 5)

Group 5 (API-0502) triggers:
  For (pageId, language) of the approved translation:
    Condition 1: At least one APPROVED translation exists on this page for this language ✓
    Condition 2: No IN_PROGRESS publish for (pageId, language, DEV)
    Condition 3: Current approved bundle hash ≠ last successful DEV bundle hash
    Condition 4: Language is ACTIVE
    Condition 5: Page is ACTIVE
    If all 5 pass:
      → Bundle constructed: APPROVED translations only, STALE excluded
      → Release created (PENDING → IN_PROGRESS) by Group 5, owned by Group 4
      → API-0405 executed (Group 5 → Group 4):
          Language Services called
          On success: Release → SUCCESSFUL, contentSnapshot written
          On failure: Release → FAILED, PM/ADMIN notified

Group 5 (API-0503) triggers:
  → Coverage recalculated for (pageId, language)
  → If this is a PRODUCTION release: approvedAndDeployedToProduction updates

Advisory notification (API-0504):
  → "Content automatically published to Dev." → triggering user

Cross-domain note: The Release entity is created and owned by Group 4.
API-0502 (Group 5) acts as the orchestrator that calls Group 4's publishing execution.
The Release's lifecycle (PENDING → SUCCESSFUL/FAILED) is owned by Group 4.
Group 5 is the trigger, not the owner.
```

---

### 3.4 Publishing Approval Request → Release → Environment Status

`Manual publish flow: PAR creation → approval → Release → Environment Status Matrix`

```
FRD §5.5, F-11, UF-10

API-0402 (Group 4) — read only:
  Computes diff between current approved content and last deployment
  Returns bundleSnapshotHash
  No entities created

API-0403 (Group 4) — creates PAR:
  PAR created: status PENDING
    bundleSnapshotHash locked at this moment
    expiresAt: now + 24h (from System Configuration)
    requiredApproverRole: per target environment
  AUDIT: PUBLISHING_APPROVAL_REQUESTED (Group 5)
  NOTIFICATION: [if approver is different from requester] (Group 5)

API-0404 (Group 4) — PAR decision:
  Server recomputes bundleSnapshotHash at decision time
  If hash mismatch: PAR → CANCELLED; returns 409 (no Release created)
  If REJECT: PAR → REJECTED; requester notified; no Release created
  If APPROVE:
    PAR → APPROVED
    Release created (status: PENDING)
    Release.approvalRequestId = PAR.approvalRequestId
    API-0405 triggered
  AUDIT: PUBLISHING_APPROVAL_GRANTED or PUBLISHING_APPROVAL_REJECTED (Group 5)

API-0405 (Group 4) — execution:
  Release: PENDING → IN_PROGRESS
  Language Services called with APPROVED bundle (STALE/DRAFT excluded)
  On success: Release → SUCCESSFUL, contentSnapshot persisted
    → AUDIT: PAGE_BUNDLE_PUBLISHED (Group 5)
    → Coverage recalculated (Group 5, API-0503)
    → If PRODUCTION: NOTIFICATION: PAGE_BUNDLE_PUBLISHED_TO_PRODUCTION (Group 5)
  On failure: Release → FAILED
    → AUDIT: PAGE_BUNDLE_PUBLISH_FAILED (Group 5)
    → NOTIFICATION: PUBLISHING_FAILED → PM, ADMIN (Group 5)

API-0607 / API-0401 (Group 6/4) — read:
  Environment Status Matrix reads most recent Release per (pageId, language, environment)
  Status computed from Release records — never from Translation.status
  
Key contract: Environment Status reflects what Language Services was told, not what
MioTranslate thinks is approved. The Release contentSnapshot is the source of truth
for what is actually deployed.
```

---

### 3.5 Release → Rollback → New Release

`Successful Release → Rollback → new Release replacing it`

```
FRD F-12, UF-11, Group 4 §3.7

Current state: Release v6 (SUCCESSFUL) is current for (QUICK, ar, PRODUCTION)
User (SR/FN) selects v4's contentSnapshot as rollback target.

API-0407 (Group 4):
  Reads Release v4's contentSnapshot
  Creates new Release (Rollback type):
    type: ROLLBACK
    triggerSource: USER_INITIATED
    rolledBackFromDeploymentVersion: 6
    deploymentVersion: 7 (next sequential for this scope)
    contentSnapshot: copy of v4's contentSnapshot
    status: PENDING → IN_PROGRESS
  API-0405 called with v4's content

On success (Language Services accepts rollback content):
  New Release v7: IN_PROGRESS → SUCCESSFUL
  Prior Release v6: SUCCESSFUL → ROLLED_BACK
    [This is the ONLY post-creation status mutation permitted on a historical Release]
  AUDIT: PAGE_BUNDLE_ROLLED_BACK (Group 5)
  NOTIFICATION: ROLLBACK_INITIATED → PM, QA, SR (Group 5)
  Coverage recalculated (Group 5, API-0503):
    → Numerator re-derived from v7's contentSnapshot (copy of v4)
    → Coverage may decrease if newer tags were in v6 but not v4

On failure:
  New Release v7: IN_PROGRESS → FAILED
  Prior Release v6 remains SUCCESSFUL (rollback did not complete)
  PM and ADMIN notified (PUBLISHING_FAILED)

Immutability guarantee: Release v1 through v5 are unchanged. Release v6 gets its single
permitted mutation (→ ROLLED_BACK). Release v7 is the new SUCCESSFUL record.
No historical content is destroyed.
```

---

### 3.6 Language Addition → Translation Slots → Translation Lifecycle

`New Language → slots created → Translation workflow begins`

```
FRD §5.7, §4.5, UF-17

API-0802 (Group 8):
  Language record created: ACTIVE
  AUDIT: LANGUAGE_ADDED (Group 5)
  Triggers API-0506 (Group 5)

API-0506 (Group 5):
  For every ACTIVE Tag across ALL pages:
    Translation entity created: NO_TRANSLATION state
    AUDIT: TRANSLATION_SLOT_CREATED per tag (Group 5)
  Coverage recalculated for (all active pages, new language):
    → 0% for all pages (all slots in NO_TRANSLATION)

From this point, the new language follows normal Translation lifecycle (Group 3):
  PM/LR generates AI translations (API-0302 bulk per page)
  LR reviews and approves (API-0304/0305)
  Publishing cycle (Group 4): PAR → Release → Production
  Coverage grows as publishing progresses

Deactivation (API-0803, Group 8):
  Language status: ACTIVE → INACTIVE
  No Translation entities modified or deleted
  Translation entity slots (NO_TRANSLATION, DRAFT, APPROVED, etc.) all preserved
  INACTIVE language is excluded from:
    - New AI translation generation (Group 3 validates ACTIVE)
    - Publishing bundles (Group 4 checks ACTIVE language before including)
    - New slot creation (Group 5 API-0506 only runs for ACTIVE language)
  INACTIVE language is still visible in:
    - API-0807 (List Languages — shows inactive)
    - Coverage history (historical Release records preserved)
    - Audit trail (historical events preserved)
```

---

### 3.7 Migration → Imported Entities → Production Release → Coverage

`File upload → execution → entities bootstrapped → Production baseline → Coverage`

```
FRD F-21, UF-02, Group 10

API-1001 (Group 10):
  Import Event created: UPLOAD_READY
  File validated for structure only

API-1002 (Group 10) — async execution:
  Import Event: UPLOAD_READY → PROCESSING

  Step 3: Pages created (ACTIVE) — same schema as API-0101
  Step 4: Tags created (ACTIVE) — same schema as API-0102
    English Copy entities created (NO_COPY, then filled at Step 5)
    [Note: NO_TRANSLATION slots NOT created here — translations created directly at Step 6]
  Step 5: English Copy records set directly to APPROVED
    English Copy Version 1 created: APPROVED (skipping DRAFT/PENDING_REVIEW lifecycle)
    Tag.englishCopyStatus → APPROVED
  Step 6: Translation records set directly to APPROVED
    Translation Version 1 created: creationMethod: MIGRATED
    sourceEnglishVersion: 1 (pointing to the EC Version 1 created in Step 5)
    Freshness invariant holds from creation (sourceEnglishVersion 1 == current approved 1)
  Step 7: Release records created for each (page × language):
    type: PUBLISH, triggerSource: MIGRATION, environment: PRODUCTION, status: SUCCESSFUL
    contentSnapshot: built from the imported translation data
    [These are bootstrapped historical records — no PAR, no Language Services call]
  Step 8: Coverage recalculated for all (pageId, language) pairs

  Import Event: PROCESSING → COMPLETED

API-1003 (Group 10):
  On first call: Validation Report generated and cached
  Import Event: COMPLETED → REPORT_AVAILABLE
  
Post-migration coverage expectation:
  For a fully migrated language: 100% (all active tags have MIGRATED translations deployed)
  For tags with empty english_copy: excluded (NO_COPY → NO_TRANSLATION slots, not in Release)

Cross-domain contract for migrated entities:
  The created entities (Page, Tag, EC, ECVersion, Translation, TVVersion, Release) are
  indistinguishable from normally-created entities in their owning domains EXCEPT:
  - Translation Version: creationMethod = MIGRATED
  - Release: triggerSource = MIGRATION
  All domain contracts (Group 3 stale rules, Group 4 rollback rules, Group 6 coverage rules)
  apply identically to migrated entities from the moment of creation.
```

---

### 3.8 Audit / Notification / Comments / Search / Recently-Edited

`Cross-cutting governance and navigation`

```
AUDIT (Group 5 write / Group 9 read):
  Every write operation in Groups 1–4, 8, 9, 10 triggers API-0505.
  API-0505 is the ONLY entry point for creating Audit Records.
  API-0904 is the ONLY user-facing query interface for Audit Records.
  The Audit store is the source for Activity Timeline (API-0605, Group 6).
  No Audit Record is ever modified or deleted after creation.

NOTIFICATION (Group 5 write / Group 9 read):
  API-0504 dispatched async after significant write events.
  11 defined notification events (FRD §12).
  API-0504 persists the Notification record regardless of delivery outcome.
  API-0906 (Group 9) queries Notifications per user.
  API-0907 (Group 9) marks read (once-write: readAt timestamp).

COMMENTS (Group 9):
  API-0901 creates Comments on Tags.
  Surface-scoped: Comment references tagId only, not a specific English Copy Version or TV.
  API-0903 resolves (soft-close): resolved flag set once.
  Comments are editorial context, not business state.
  No other group reads Comments for business rule decisions.

SEARCH (Group 7 / Group 1 data):
  API-0701 searches across Tag records (tagId, tagName) and English Copy text.
  Global Search is a read facade over Group 1 (Tags, Pages) and Group 2 (English Copy text).
  Search does not create or modify any entity.
  Search index is derived from Group 1 and Group 2 source records.

BOOKMARKS (Group 7, user-personal):
  API-0702/0703/0704 create/read/delete Bookmarks.
  Bookmark references (userId, targetType, targetId — Page or Tag).
  User-personal records. Not business state. No side-effects on referenced entities.
  Bookmark deletion does not affect the bookmarked Page or Tag.

RECENTLY-EDITED (Group 7, user-personal projection):
  API-0705 returns a user's recently viewed/edited tags.
  Source 1: Audit Records (write events performed by this user on tags)
  Source 2: Access-event store (view events by this user — GETs produce no Audit Records)
  Not a domain entity. No independent write path.
  Has two distinct data sources — different retention and query requirements.
```

---

## 4. Domain Ownership Validation

This section validates that no API Group accidentally owns another domain's entity lifecycle.

### 4.1 Validated Boundaries

| Entity | Owning Group | Groups That Read | Groups That Write Side-Effects | Validation |
|---|---|---|---|---|
| Page | Group 1 | Groups 3, 4, 5, 6, 10 | Group 1 only (deprecation cascade is Group 1 self-triggered) | ✅ No other group creates or deprecates Pages |
| Tag | Group 1 | Groups 2, 3, 4, 5, 6, 7, 10 | Group 1 only (Tag creation creates EC and Translation slots as Group 1 side-effect) | ✅ No other group creates or deprecates Tags |
| English Copy | Group 2 | Groups 3, 4, 6, 7 | Group 2 only (status mutations). Group 1 creates EC entity simultaneously with Tag — this is creation, not a Group 1 mutation of EC state | ✅ Only Group 2 manages EC status transitions |
| English Copy Version | Group 2 | Groups 3, 6 | Group 2 only | ✅ |
| Translation | Group 3 | Groups 4, 5, 6 | Group 3 for status transitions. Group 5 (API-0501) writes `staleInfo` and status → STALE only — this is a tightly specified cross-domain write | ⚠️ **One permitted cross-domain write:** API-0501 (Group 5) writes `status: STALE` and `staleInfo` on Group 3 entities. This is explicitly designed and locked in Group 5 §3.1. It is not a violation — it is a documented system trigger. No other group may write to Translation entities. |
| Translation Version | Group 3 | Groups 4, 6 | Group 3 only | ✅ |
| Language | Group 8 | Groups 3, 4, 5, 6 | Group 8 only | ✅ |
| Publishing Approval Request | Group 4 | Group 6 (Review Queue) | Group 4 only | ✅ |
| Release | Group 4 | Groups 5, 6 | Group 4 (creation, status transitions). Group 5 (API-0502, API-0405) creates Releases during implicit Dev publishing — but API-0405 is Group 4's own API, invoked by Group 5. The Release ownership remains Group 4. | ✅ No other group creates Releases directly. Group 5 acts as orchestrator using Group 4's own execution API. |
| Audit Record | Group 5 (write) / Group 9 (read) | Group 6 (read) | Group 5 only via API-0505 | ✅ No group writes Audit Records directly; all go through API-0505 |
| Coverage Metrics | Group 5 (compute) / Group 6 (consume) | Group 6 only | Group 5 only via API-0503 | ✅ Group 6 never writes to Coverage Metrics |
| Comment | Group 9 | Group 6 (not for business rules) | Group 9 only | ✅ |
| Notification | Group 5 (dispatch) / Group 9 (user-read) | Group 9 only | Group 5 only via API-0504 | ✅ |
| User / Role Assignment | Group 8 | All groups (RBAC checks) | Group 8 only | ✅ |

---

### 4.2 The One Accepted Cross-Domain Write

The only cross-domain write in MioTranslate's design is **Group 5 (API-0501) writing `status: STALE` and `staleInfo` on Group 3 Translation entities**.

This is accepted because:
1. It is fully specified in both Group 3 (canonical staleInfo model, §2.2) and Group 5 (API-0501 §3.1).
2. Group 3 defines the `staleInfo` data structure and field semantics. Group 5 populates it.
3. The write is strictly scoped: only `status` (→ STALE) and `staleInfo` fields are touched. No version is created. No other Translation fields are modified.
4. It is a system-triggered event, not a user-initiated operation. The triggering authority is Group 2's English approval, mediated through Group 5.
5. Resolution of the STALE state is exclusively owned by Group 3 (API-0306, API-0307, API-0303).

**DB Design implication:** The Translation live-state record must be writable by both Group 3 (all normal operations) and Group 5 (stale flagging). If RBAC is implemented at the DB level, both services must have write access to the Translation table's `status` and `staleInfo` fields.

---

## 5. Cross-Domain Invariants

### 5.1 Identity Invariants

| # | Invariant | Domains Involved |
|---|---|---|
| XI-01 | `pageId` is unique across all Pages (active and deprecated) | Group 1 |
| XI-02 | `tagId` is unique across all Tags; begins with `pageId_` prefix | Group 1 |
| XI-03 | `languageCode` is unique across all Languages (active and inactive) | Group 8 |
| XI-04 | `(tagId, languageCode)` is unique across all Translations | Groups 1, 3, 8 |
| XI-05 | `(tagId, versionNumber)` is unique across all English Copy Versions per tag | Group 2 |
| XI-06 | `(tagId, languageCode, versionNumber)` is unique across all Translation Versions | Group 3 |
| XI-07 | `(pageId, languageCode, environment, deploymentVersion)` is unique across all Releases | Group 4 |
| XI-08 | `approvalRequestId` is globally unique | Group 4 |
| XI-09 | `auditRecordId` is globally unique | Group 5 |
| XI-10 | `userId` is globally unique | Group 8 |

---

### 5.2 Language Isolation Invariants

| # | Invariant | Domains Involved |
|---|---|---|
| XI-11 | Any write on a `(tagId, languageCode)` Translation affects only that entity. No operation cross-contaminates another language's Translation. | Group 3, Group 5 |
| XI-12 | Stale flagging (API-0501) processes each language independently. A failure for one language does not block processing of other languages. | Group 5 |
| XI-13 | Publishing (API-0405) is scoped to exactly one language per execution. One Language Services call per `(pageId, language)`. | Group 4 |
| XI-14 | Language deactivation does not delete or modify Translation entities for that language. | Groups 3, 8 |

---

### 5.3 English-to-Translation Lineage Invariants

| # | Invariant | Domains Involved |
|---|---|---|
| XI-15 | Every Translation Version must have `sourceEnglishVersion` set to the English Copy version number that was current-approved when the TV was created or confirmed — except for MIGRATED TVs (where both are created simultaneously in the same atomic step) | Groups 2, 3, 10 |
| XI-16 | No Translation entity may enter DRAFT or APPROVED state without an existing, approved English Copy for that tag — except during the migration atomic step | Groups 2, 3, 10 |
| XI-17 | `sourceEnglishVersion` is immutable once set on a Translation Version. It never changes regardless of what happens to the English Copy afterwards. | Groups 2, 3 |
| XI-18 | The freshness invariant is derived, never stored: `isFresh = (translation.sourceEnglishVersion == currentApprovedEnglishVersion)`. Stale flagging is the operational enforcement of this invariant. | Groups 2, 3, 5 |

---

### 5.4 Approval and Version Consistency Invariants

| # | Invariant | Domains Involved |
|---|---|---|
| XI-19 | At most one `APPROVED` English Copy Version may exist per Tag at any time. All others are `SUPERSEDED`, `DRAFT`, `PENDING_REVIEW`, or `REJECTED`. | Group 2 |
| XI-20 | At most one `PENDING` Publishing Approval Request may exist per `(pageId, languageCode, environment)` at any time. | Group 4 |
| XI-21 | A Release may only be created when a corresponding `APPROVED` Publishing Approval Request exists — except for implicit DEV releases (`triggerSource: SYSTEM_AUTO_DEV`) and migration releases (`triggerSource: MIGRATION`). | Groups 4, 5, 10 |
| XI-22 | `bundleSnapshotHash` computed at API-0403 time must match the hash at API-0404 time. If not: PAR → CANCELLED, no Release created, new request required. | Group 4 |

---

### 5.5 Release and Content Snapshot Consistency Invariants

| # | Invariant | Domains Involved |
|---|---|---|
| XI-23 | A Release's `contentSnapshot` is written once at API-0405 success and never modified. It is the authoritative record of what was sent to Language Services. | Group 4 |
| XI-24 | A Rollback Release's `contentSnapshot` is an exact copy of the target prior Release's `contentSnapshot`. It is not reconstructed from current Translation states. | Group 4 |
| XI-25 | Coverage Metrics numerator is based on `contentSnapshot` of the most recent SUCCESSFUL Production Release, not on Translation.status. A STALE translation that is deployed counts in the numerator. | Groups 4, 5, 6 |
| XI-26 | Only APPROVED translations are included in publishing bundles. DRAFT, PENDING_REVIEW, STALE, and NO_TRANSLATION are excluded. | Groups 3, 4 |
| XI-27 | A Release is immutable after creation, except the `SUCCESSFUL → ROLLED_BACK` transition on a prior Release when a newer Rollback Release succeeds for the same scope. | Group 4 |

---

### 5.6 Migration Exception Invariants

| # | Invariant | Domains Involved |
|---|---|---|
| XI-28 | Migration-created Translation Versions have `creationMethod: MIGRATED`. This is the only value not available in the normal translation workflow. | Groups 3, 10 |
| XI-29 | Migration-created Releases have `triggerSource: MIGRATION` and require no PAR. This is the only Release type created without a PAR (alongside `SYSTEM_AUTO_DEV`). | Groups 4, 10 |
| XI-30 | After migration, the freshness invariant holds immediately: migrated TV's `sourceEnglishVersion = 1` equals the simultaneously-created EC Version 1. No stale flagging is triggered at migration time. | Groups 2, 3, 10 |

---

### 5.7 Audit Ownership Invariants

| # | Invariant | Domains Involved |
|---|---|---|
| XI-31 | Every write operation across all 10 domains produces an Audit Record via API-0505. No write completes with permanently missing audit history. | All groups → Group 5 |
| XI-32 | Audit Records are immutable and permanent. No domain may delete, archive, or modify an Audit Record after creation. | Group 5 |

---

### 5.8 Derived-Model Dependency Invariants

| # | Invariant | Domains Involved |
|---|---|---|
| XI-33 | Derived models (Coverage Metrics, Environment Status Matrix, Review Queue, Activity Timeline, Pending Work Summary, Recently-Edited) must never be used as inputs to business rule validation. Source-of-Truth entities are always the authoritative input. | Groups 5, 6, 7 |
| XI-34 | Coverage Metrics are precomputed by API-0503 and carry a `computedAt` timestamp. A coverage value with a stale `computedAt` is still returned (with `coverageFreshness: STALE` indicator) rather than blocking the response. | Groups 5, 6 |

---

## 6. Potential Duplication and Conflicting Source-of-Truth Risks

The following are areas where the DB design must be especially careful to avoid duplication or inconsistency.

### 6.1 `Tag.englishCopyStatus` — Denormalization Risk

**Risk:** `Tag.englishCopyStatus` is a field on the Tag entity (Group 1) that mirrors `EnglishCopy.status` (Group 2). If these two values can diverge, business rules enforced by Group 3 (which reads `Tag.englishCopyStatus` to validate that English is APPROVED before translation) may yield incorrect results.

**Contract:** `Tag.englishCopyStatus` must be updated atomically with every `EnglishCopy.status` transition. If the DB design implements these as separate rows/tables, the update must be within the same transaction or guaranteed-consistent write.

**Alternative:** Remove `Tag.englishCopyStatus` from the Tag entity and always join to English Copy for status checks. Slower on reads; consistent without extra synchronization.

**Status:** Open design decision (OQ-1 from ED-02 Appendix). Must be resolved at DB design time.

---

### 6.2 `contentSnapshot` — Release vs. Translation Version

**Risk:** A Release's `contentSnapshot` stores `translationText` per tag — the same string that exists in the Translation Version record. If the snapshot is stored separately from the Translation Version record, the DB holds two copies of the same string.

**Contract:** The snapshot is intentionally duplicated. The Translation Version is the content entity (what was authored). The Release snapshot is the deployment record (what was sent). They must not be collapsed — the Release snapshot must remain readable even if the Translation Version store is archived or sharded differently. The `translationVersion` foreign key in the snapshot serves as the traceability link.

**Status:** Explicit design decision. Not a risk — intentional and correctly specified.

---

### 6.3 Coverage Metrics — Precomputed vs. Live Computation

**Risk:** If Coverage Metrics are precomputed (as specified) but the underlying source data (Translation.status, Release contentSnapshot) changes faster than the precompute job runs, dashboards may show stale values that are inconsistent with the live Translation and Release states.

**Contract:** This is explicitly accepted: `coverageFreshness: STALE` is returned when the precomputed value is older than a system threshold. Coverage Metrics must never be used for business decisions (XI-33) — only for human-readable reporting. The DB design must include the `computedAt` timestamp and the `coverageFreshness` indicator per cell.

**Status:** Explicit product decision (FRD F-16: "near-real-time"). Not a contradiction — the trade-off is documented.

---

### 6.4 Translation `staleInfo` — Live State vs. Version History

**Risk:** The `staleInfo` object is part of the Translation's live state record (mutable). Version Versions' content fields are immutable. If the DB design collapses Translation live state with Translation Version history into a single record structure, the stale update (which modifies live state without creating a version) becomes ambiguous.

**Contract:** The Translation entity has two distinct conceptual layers:
1. **Live state record** — mutable: `status`, `staleInfo`, `updatedAt`, current version pointer.
2. **Version history** — immutable: each Translation Version row with all content and review fields.

The DB design must model these separately (or use a clear distinction) to satisfy both the immutability guarantee for versions and the mutability requirement for live state metadata.

**Status:** Open design decision (OQ-2 from ED-02 Appendix). Must be resolved at DB design time.

---

### 6.5 `Recently-Edited` — Two-Source Projection

**Risk:** Recently-Edited is computed from two sources: Audit Records (write events) and an access-event store (view events). If these two stores have different retention policies, schemas, or query characteristics, the Recently-Edited view may be inconsistent or unavailable when one source is degraded.

**Contract:** The access-event store is explicitly not an Audit Record store — GET operations do not create Audit Records. The implementation must decide on a separate write path for view events. This store is high-write, low-retention, user-scoped.

**Status:** Open engineering dependency (OQ-5 from ED-02 Appendix). Must be defined before the DB design includes this feature.

---

## 7. External Dependencies and Boundary Contracts

### 7.1 Language Services — `POST /multilingual/bulkImportPages`

**External owner:** Language Services team  
**Used by:** API-0405 (Execute Publishing), API-0407 (Rollback), API-0502 (Implicit Dev Publishing)

**Contract MioTranslate holds:**

| Fact | Value |
|---|---|
| Endpoint | Per-environment (DEV/QA/PROD endpoints configured in System Configuration) |
| Payload | `{ domain: "miosalon", pageId, pageName, tags: [{ tagName, values: { [languageCode]: text } }] }` |
| Single-language per call | Yes — MioTranslate sends one language per execution |
| Upsert semantics | Unsupplied tags preserved; supplied tags created/updated |
| Language-level result | Per-language `status: success/failed` in response `details` array |
| MioTranslate evaluation | Only the target language's result determines deployment status |

**What MioTranslate does NOT do:**
- Read back from Language Services after publishing (contentSnapshot is the record)
- Remove tags from Language Services (ED-1: this capability does not exist)
- Guarantee cross-language value preservation within a tag (ED-3: must be confirmed by engineering)

**Engineering Dependencies still open:**

| ID | Dependency | Impact |
|---|---|---|
| ED-1 | Tag removal from Language Services | Deprecated tags accumulate in LS; cannot be cleaned up |
| ED-2 | Rollback tag removal | Tags added after rollback target persist in LS |
| ED-3 | Value-level language preservation within a tag | Must be confirmed; blocks production of single-language publish model |

---

### 7.2 AI Translation Service

**External owner:** AI Translation Service (specification not yet finalized)  
**Used by:** API-0301, API-0302, API-0307

**Contract MioTranslate holds:**
- Input: approved English text + business context (pageName, module, copyType, industry terminology)
- Output: translated text, back-translation, confidence score (0.00–1.00)
- Variable integrity: MioTranslate checks `{...}` placeholder presence (may or may not be delegated to AI service)

**What is captured from AI output:**
- `text`: stored as Translation Version snapshot field (immutable)
- `confidenceScore`: stored as Translation Version field (immutable)
- `backTranslation`: stored as Translation Version field (immutable)
- `variableIntegrityStatus`: computed and stored (PASS/FAIL)

**What is NOT captured:**
- The AI service's internal model version or prompt
- Raw API request/response (only the output fields are captured)

**Engineering Dependency open:**  
AI Translation Service API specification must be obtained before API-0301, API-0302, and API-0307 can be fully implemented. The `confidenceScore` scale and `backTranslation` format must be confirmed.

---

## 8. Final Consistency Audit — ED-01 + ED-02 + Groups 1–10 + BRD + FRD

### 8.1 Audit Against BRD Objectives

| BRD Objective | Entity Architecture Coverage | Status |
|---|---|---|
| Objective 1: Single source of truth for UX copy | Tag (Group 1) is the registry. English Copy (Group 2) is the source for English. Translation (Group 3) is the source for non-English. No duplicate stores. | ✅ |
| Objective 2: Remove engineering dependency | MioTranslate's entity model has no dependency on engineering for copy authoring, translation, or publishing. ED-1/ED-3 are Language Services gaps, not MioTranslate architecture gaps. | ✅ |
| Objective 3: Introduce governance before production | English Copy review lifecycle (Group 2), Translation review lifecycle (Group 3), and Publishing Approval Request (Group 4) all enforce governance gates. | ✅ |
| Objective 4: Enable translation quality assurance | AI confidence scoring, back-translation, variable integrity — all captured in Translation Version (IH, Group 3). Human review required before APPROVED. | ✅ |
| Objective 5: Provide visibility | Coverage Metrics, Environment Status Matrix, Stale Report, Review Queue, Activity Timeline — all derived models in Group 6. | ✅ |
| Objective 6: Make language expansion plannable | Language entity (Group 8) + API-0506 slot creation + Coverage Metrics per language — all support language-at-a-time expansion. | ✅ |
| Objective 7: Accountability through audit trail | Audit Record (IH + SE, Group 5) for every write. All 63 APIs covered by API-0505. | ✅ |

---

### 8.2 Audit Against FRD §7 Business Rules

| Key FRD Rule | ED-01/02/03 Representation | Status |
|---|---|---|
| Rule 1: English is always source | `sourceEnglishVersion` on every TV. AI translation requires APPROVED English (XI-16). | ✅ |
| Rule 5: English change → all translations stale | API-0501 cascade in §3.2 / Group 5. Text-change trigger condition (§8.1 ED-02). | ✅ |
| Rule 6: Stale translation remains live | `status: STALE` does not remove content from Language Services. contentSnapshot remains unchanged. | ✅ |
| Rule 7: Language isolation | XI-11 through XI-14. Group 3 language isolation §1.7. | ✅ |
| Rule 8: Only APPROVED can be published | XI-26. Group 4 bundle construction rules. | ✅ |
| Rule 10: Audit all mutations | XI-31. API-0505 is cross-cutting. | ✅ |
| Rule 14: Single-language publishing scope | XIII-13. Group 4 API-0405 design. | ✅ |
| Rule 21: Immutable version history | XI-27 (Release). EC Version and TV immutable content fields. | ✅ |
| Rule 23: Deprecated tag excluded from bundle | Group 4 bundle rules. Tag.status checked. contentSnapshot omits DEPRECATED tags. | ✅ |
| §5.6: Coverage formula | XI-25. Coverage Metrics §2.17. | ✅ |
| F-16: Stale-but-deployed counts in numerator | XI-25. Coverage formula definition. | ✅ |

---

### 8.3 Audit Against API Groups 1–10

| Group | Cross-Domain Ownership Finding | Status |
|---|---|---|
| Group 1 | Creates Page, Tag entities. Side-effect: creates EC entity and Translation slots. These are creation events, not lifecycle ownership transfers. Groups 2 and 3 own the ongoing lifecycle of EC and Translation. | ✅ |
| Group 2 | Owns English Copy and EC Version lifecycle. Triggers Group 5 cascades on approval. Does not own Translation. | ✅ |
| Group 3 | Owns Translation and TV lifecycle. Has staleInfo model definition. Accepts Group 5's stale flag as a system event. | ✅ ⚠️ (one accepted cross-domain write, §4.2) |
| Group 4 | Owns PAR and Release. Invoked by Group 5 (API-0502 → API-0405) for implicit DEV publishing. Release ownership remains Group 4. | ✅ |
| Group 5 | System orchestrator. Writes to Translation (stale flag) and creates Releases (via API-0405). Neither write violates ownership — both are tightly specified cross-domain system events. | ✅ |
| Group 6 | Read-only facade. Never writes to any source-of-truth entity. Reads from Groups 1, 2, 3, 4, 5. | ✅ |
| Group 7 | Reads Group 1 (search) and Group 5 (recently-edited from audit store). Writes Bookmarks (user-personal, no business state impact). | ✅ |
| Group 8 | Owns Language, User, User Role Assignment, System Configuration. Side-effect: triggers API-0506 (Group 5) on Language addition. | ✅ |
| Group 9 | Owns Comments, Export Jobs, Notification reads. Writes Audit Records? No — Audit Records are written by Group 5 (API-0505). Group 9 (API-0904) is the query interface only. | ✅ |
| Group 10 | Migration creates entities across Groups 1, 2, 3, 4. These are bootstrap creation events that do not violate domain ownership — migrated entities immediately become the ownership of their respective domains post-creation. | ✅ |

---

### 8.4 Remaining Open Items for DB Design

These are the confirmed open decisions that must be resolved before the Database Design phase begins. They are derived from ED-02 Appendix (OQ-1 through OQ-7) and the analyses in §6 above.

| # | Open Item | What Must Be Decided |
|---|---|---|
| OQ-1 | `Tag.englishCopyStatus` denormalization | Store denormalized (requires guaranteed-sync update) vs. always join to EC table. Performance vs. consistency trade-off. |
| OQ-2 | Translation live state vs. version history separation | Single mutable row for live state + separate immutable rows for version history, OR a single row model where version rows serve as both. Impacts stale update pattern. |
| OQ-3 | Append-once review fields on Version records | In-place write (mutable row, fields written once) vs. separate review-event rows per action. Audit coverage vs. schema simplicity. |
| OQ-4 | Coverage Metrics materialization strategy | Precomputed table with 9 update triggers vs. event-driven vs. read-through cache. Freshness SLA vs. query performance. |
| OQ-5 | Access-event store for Recently-Edited | Separate write path from Audit Records. High-write, short-retention, user-scoped. Must be architected separately from the long-retention Audit store. |
| OQ-6 | `contentSnapshot` storage format | JSON blob (single field) vs. normalized snapshot table (per-tag rows). Impacts rollback query patterns, pre-publish summary diff queries, and coverage numerator computation. |
| OQ-7 | Audit Record index strategy | Timeline queries (by `performedAt`), entity queries (by `subject.tagId/pageId`), user queries (by `performedBy`). A single append-only table may need composite indexes or partitioning. |

---

### 8.5 Confirmed Resolved Items (no open decisions)

| Area | Resolution |
|---|---|
| English Copy entity existence | Always exists from Tag creation (NO_COPY). Unconditional 1:1. |
| Version immutability | Snapshot content immutable at creation. Review lifecycle fields append-once. These are conceptually distinct and must both be preserved. |
| STALE lifecycle | Text-change-only trigger. staleInfo is live state, not version history. Double-change updates currentEnglishVersion only. |
| PAR → Release ordering | PAR created first (API-0403). Release created at API-0404 approval. PAR does not reference Release. Release references PAR. |
| CANCELLED vs EXPIRED PAR | CANCELLED: hash mismatch at API-0404 time. EXPIRED: 24-hour timeout. Two distinct states, two distinct causes. |
| Import Event state machine | UPLOAD_READY → PROCESSING → COMPLETED → REPORT_AVAILABLE / FAILED. No COMPLETED_WITH_SKIPS state. |
| Coverage numerator | Based on Release contentSnapshot (PRODUCTION SUCCESSFUL), not Translation.status. Stale-but-deployed translations count. |
| Admin-lockout guard | Enforced at API-0804 time: must not allow the last ADMIN/FN role to be removed. |
| Audit write path | API-0505 exclusively. No direct writes from any other group. |
| DEV publish — no PAR required | Implicit DEV publishing uses `approvedBy: system:auto-publish`. No PAR entity created. |
| Migration Release — no PAR required | `triggerSource: MIGRATION`. Historical bootstrapping records. No PAR entity created. |

---

*End of MioTranslate Cross-Domain Entity Contract & Traceability — ED-03 v1.0*

*ED-01 (Canonical Entity Model v1.1) + ED-02 (Entity Relationships, Lifecycle & Versioning Model v1.0) + ED-03 (Cross-Domain Entity Contract & Traceability v1.0) constitute the complete, locked Entity Architecture for MioTranslate.*  
*The Database Design phase begins after OQ-1 through OQ-7 are resolved.*
