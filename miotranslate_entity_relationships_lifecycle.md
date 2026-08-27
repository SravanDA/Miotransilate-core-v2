# MioTranslate — Entity Relationships, Lifecycle & Versioning Model

**Product:** MioTranslate  
**Document Type:** Entity Architecture — Layer 2  
**Document ID:** ED-02  
**Version:** 1.0  
**Author:** Principal Domain Architect + Principal Product Data Architect + Senior Systems Analyst  
**Date:** August 2026  
**Predecessor:** ED-01 v1.1 — MioTranslate Canonical Entity Model (final, corrected and audited)

**Source Documents (all read before authoring):**  
BRD, FRD (all sections), API List (Domains 1–10), API Design Groups 1–10 (locked), Post-Audit Resolution Walkthrough, ED-01 v1.1

---

> **Purpose of this document.**  
> ED-02 makes the entity model's relationships and lifecycle behaviour completely deterministic before physical persistence is designed. Where ED-01 answers "What entities exist and what do they contain?", ED-02 answers "How do those entities relate, evolve, version, and retain history throughout the complete product lifecycle?"  
>  
> This document is the direct input to the Database Design phase. Every schema decision, index choice, and foreign-key constraint must be derivable from this document.

---

## Table of Contents

1. Entity Relationship Map
2. Ownership and Dependency Hierarchy
3. Complete State Machines
4. Lifecycle Sequences — Normal Paths
5. Lifecycle Sequences — Exception and Alternate Paths
6. System-Triggered Cascade Sequences
7. Versioning Rules and Lineage Semantics
8. Stale Lifecycle — Complete Model
9. Publishing and Deployment Lifecycle
10. Migration Lifecycle
11. User and Role Assignment Lifecycle
12. Audit and Notification Ownership
13. Derived Model Dependency Graph
14. Cross-Domain Invariants for Database Design
15. Consistency Audit — Groups 1–10 vs ED-02

---

## 1. Entity Relationship Map

### 1.1 Complete Directional Relationship Table

| From Entity | Relationship | To Entity | Cardinality | Dependency Direction | Notes |
|---|---|---|---|---|---|
| Page | contains | Tag | 1:N (1+) | Page → Tag | Tag cannot exist without Page |
| Tag | has exactly one | English Copy | 1:1 | Tag → English Copy | Created simultaneously. The EC entity is never absent. |
| English Copy | has | English Copy Version | 1:N (0+) | EC → EC Version | 0 versions in NO_COPY state; 1+ once text is first authored |
| Tag | has per Language | Translation | 1:N | Tag + Language → Translation | One Translation per (Tag, Language) ever configured |
| Language | participated in | Translation | 1:N | Language → Translation | Language deactivation does not remove these |
| Translation | has | Translation Version | 1:N (0+) | Translation → TV | 0 versions in NO_TRANSLATION; 1+ once text exists |
| Translation Version | references | English Copy Version | N:1 | TV → ECV | via `sourceEnglishVersion` integer |
| Page | is subject of | Release | 1:N | Page → Release | Page + Language + Environment scoped |
| Language | is target of | Release | 1:N | Language → Release | |
| Publishing Approval Request | governs | Release | 1:0 or 1 | PAR → Release | PAR created first; Release references it back |
| Release | references | Publishing Approval Request | N:1 (nullable) | Release → PAR | null for SYSTEM_AUTO_DEV and MIGRATION releases |
| Release | may reference | Release (prior) | N:1 (nullable) | Rollback → Prior | via `rolledBackFromDeploymentVersion`; rollback lineage |
| User | has | User Role Assignment | 1:N | User → URA | Grant + revoke history |
| Tag | receives | Comment | 1:N | Tag → Comment | Comments are surface-scoped, not version-scoped |
| Audit Record | subject is | Any mutated entity | N:1 | Audit → Subject | One-way: Audit references entity; entity has no direct pointer to Audit |
| Notification | addressed to | User | N:1 | Notif → User | One notification per user per event per subject |
| Coverage Metrics | computed from | Tag, Translation, Release | N:1 (derived) | Coverage ← Tag, Translation, Release | Read model; source entities are authoritative |
| Bookmark | owned by | User | N:1 | Bookmark → User | |
| Bookmark | targets | Page or Tag | N:1 (polymorphic) | Bookmark → Page/Tag | |
| Import Event | creates | Page, Tag, English Copy, Translation, Release | 1:N (bootstrap only) | Import Event → Entities | One-time causal relationship |
| Export Job | references | Page and Language | N:1 | Export → Page/Lang | Transient; scoped to one (Page, Language) |

---

### 1.2 Relationship Narrative — Content Domain

```
PAGE
  │
  │  1:N (1 or more tags per page)
  ▼
TAG ──────────────────── 1:1 ──────────────────── ENGLISH COPY
  │                       (simultaneous creation,       │
  │                        unconditional)               │  1:N (0 in NO_COPY,
  │                                                     │   1+ once text authored)
  │  N per active Language                              ▼
  │  at tag creation time              ENGLISH COPY VERSION (V1, V2, V3…)
  ▼                                    (immutable snapshot)
TRANSLATION (tagId, languageCode)
  │    └── references: sourceEnglishVersion → points to ECV.versionNumber
  │
  │  1:N (0 in NO_TRANSLATION, 1+ once text exists)
  ▼
TRANSLATION VERSION (V1, V2, V3…)
  (immutable snapshot)
```

---

### 1.3 Relationship Narrative — Publishing Domain

```
PUBLISHING APPROVAL REQUEST
  │
  │  created first (API-0403)
  │  independent governance record
  │
  ▼ (on APPROVE via API-0404)
RELEASE
  │   └── approvalRequestId: references back to PAR (nullable)
  │   └── rolledBackFromDeploymentVersion: references prior Release (nullable)
  │
  │  SUCCESSFUL → can transition to ROLLED_BACK (only when a later rollback succeeds)
  │  FAILED → permanent, preserved as-is
  ▼
LANGUAGE SERVICES (external; not a MioTranslate entity)
```

---

### 1.4 Relationship Narrative — Governance Domain

```
USER
  │
  │  1:N
  ▼
USER ROLE ASSIGNMENT
  (grant: assignedAt/assignedBy; revoke: revokedAt/revokedBy)

TAG
  │
  │  1:N (surface-scoped)
  ▼
COMMENT (permanent; only resolvable)

Any Write Operation
  │
  │  mandatory synchronous side-effect
  ▼
AUDIT RECORD (immutable, permanent)

Any Significant Event
  │
  │  async, non-blocking
  ▼
NOTIFICATION → USER
```

---

## 2. Ownership and Dependency Hierarchy

This hierarchy defines parent/child boundaries. A child entity cannot exist without its parent.

```
Level 0 (Root)
  ├── Page
  ├── Language
  ├── User
  └── System Configuration (singleton)

Level 1 (Owned by Level 0)
  ├── Tag           → owned by Page
  ├── English Copy  → owned by Tag (1:1, created simultaneously)
  ├── Translation   → owned by Tag × Language (compound parent)
  └── User Role Assignment → owned by User

Level 2 (History Records — owned by Level 1)
  ├── English Copy Version → owned by English Copy (→ Tag)
  └── Translation Version  → owned by Translation (→ Tag × Language)

Level 3 (Operations — reference Level 0/1)
  ├── Publishing Approval Request → references Page × Language × Environment
  ├── Release                     → references Page × Language × Environment
  ├── Comment                     → references Tag
  ├── Bookmark                    → references User × (Page or Tag)
  └── Export Job                  → references Page × Language

System Records (no domain parent; reference any entity)
  ├── Audit Record   → references any subject entity
  ├── Notification   → references User (recipient)
  └── Import Event   → standalone; causes entity creation at Level 0/1
  
Derived / Read Models (no owner; computed from sources)
  ├── Coverage Metrics         ← Tag, Translation, Release
  ├── Pending Work Summary     ← English Copy, Translation, PAR
  ├── Environment Status Matrix ← Release
  ├── Review Queue             ← English Copy Version, Translation, PAR
  ├── Activity Timeline        ← Audit Records
  └── Recently-Edited          ← Audit Records + access-event store
```

---

## 3. Complete State Machines

### 3.1 Page State Machine

```
              API-0101 (Create Page)
                    │
                    ▼
                [ACTIVE]
                    │
                    │ When all Tags deprecated (system-triggered cascade)
                    ▼
              [DEPRECATED]
```

**States:**
- `ACTIVE`: Fully operational. Tags can be created, translations authored, publishing initiated.
- `DEPRECATED`: All tags were deprecated. No new tags, no publishing. History preserved.

**Irreversibility:** One-directional. `DEPRECATED` → `ACTIVE` is not supported.  
**Trigger for DEPRECATED:** System-triggered cascade when API-0107 deprecates the last active tag on the page.  
**Owner:** Page Registry (Group 1).

---

### 3.2 Tag State Machine

```
          API-0102 (Create Tag)
                │
                ▼
           [ACTIVE]
                │
                │ API-0107 (:deprecate)
                ▼
          [DEPRECATED]
```

**States:**
- `ACTIVE`: Operational. Eligible for English copy, translation, and publishing.
- `DEPRECATED`: Excluded from all new operations. Translation history preserved.

**Side-effects on creation:** (1) English Copy entity created in NO_COPY state; (2) NO_TRANSLATION slots created for all currently active Languages.  
**Side-effects on deprecation:** Triggers coverage recalculation for all active languages (denominator decreases). If this was the last active tag, triggers Page deprecation.  
**Owner:** Page Registry (Group 1).

---

### 3.3 English Copy State Machine

```
          [Tag Creation]
                │  English Copy entity created simultaneously
                ▼
           [NO_COPY]
                │
                │ API-0201 (Create/Edit Draft)
                ▼
            [DRAFT]
                │                  ┌──────────────────────────────────┐
                │ API-0202 (Submit) │ API-0203 (Reject / Return)       │
                ▼                  │  → back to DRAFT                  │
        [PENDING_REVIEW] ──────────┘                                   │
                │                                                      │
                │ API-0203 (Approve, text changed)                     │
                │ API-0203 (Approve, text unchanged)                   │
                ▼                                                      │
           [APPROVED]                                                  │
                │                                                      │
                │ API-0201 (Edit new draft after approval)             │
                ▼                                                      │
            [DRAFT]  ─────────────────────────────────────────────────┘
            (v2 open)
```

**States:**
- `NO_COPY`: Entity exists; no text ever authored.
- `DRAFT`: Text exists; not yet submitted for review.
- `PENDING_REVIEW`: Submitted to reviewer queue.
- `APPROVED`: Formally approved. Source text for AI translation and publishing.

**Important distinctions:**
- `NO_COPY → DRAFT`: The first time any text is authored. English Copy Version 1 is created.
- `APPROVED → DRAFT`: New edit after an already-approved version. Version N+1 is created. The prior approved version remains accessible and deployed.
- There is no `REJECTED` state at the entity level; rejection returns to `DRAFT` state.

**Owner:** English Copy (Group 2).

---

### 3.4 English Copy Version State Machine

```
          [Created as DRAFT on API-0201]
                │
                │ API-0202 (Submit)
                ▼
         [PENDING_REVIEW]
                │              ┌─────────────────────────────────────────────┐
                │ API-0203     │ API-0203 (Reject / Return to Revision)      │
                │ (Approve)    │  → version back to DRAFT                    │
                ▼              └─────────────────────────────────────────────┘
           [APPROVED]
                │
                │ When a newer version is approved and text changed
                ▼
          [SUPERSEDED]
```

**Append-once rule for review lifecycle fields:**
- `submittedForReviewAt/By`: written once when submitted.
- `reviewedBy/At`: written once on any review decision.
- `approvedBy/At`: written once on approval.
- `escalatedToFounder`: set to true once on escalation; never reversed.

**Snapshot content fields** (`text`, `authoredBy`, `authoredAt`, `changeReason`): **strictly immutable** at creation. Never written again.

**SUPERSEDED:** Only the currently approved version is `APPROVED`. When a new version is approved, the prior `APPROVED` version becomes `SUPERSEDED`. Its text and all fields are preserved permanently. **`SUPERSEDED` is the only status transition permitted on a historical version after it is finalized.**

**Owner:** English Copy / Group 2.

---

### 3.5 Translation State Machine

```
          [Tag creation or Language addition]
                │  Slot created automatically
                ▼
        [NO_TRANSLATION]
                │
                ├── API-0301 (Single AI generate)
                ├── API-0302 (Bulk AI generate)
                └── API-0303 (Manual edit from NO_TRANSLATION)
                │
                ▼
            [DRAFT]
                │                   ┌────────────────────────────────────────────┐
                │ API-0309           │ API-0304 (Request Retranslation)           │
                │ (Submit)           │  → new version created (AI); state = DRAFT  │
                ▼                   │ API-0304 (Reject — initial draft)           │
       [PENDING_REVIEW] ────────────┘  → version closed as REJECTED; back to     │
                │                      NO_TRANSLATION if no prior approved version │
                │              OR  → APPROVED (prior) restored if one existed     │
                │ API-0304 / API-0305 (Approve / Bulk Approve)
                │ API-0304 (Edit and Approve — new version)
                ▼
           [APPROVED]
                │
                │ API-0501 (Flag Stale — triggered by API-0203 text change)
                ▼
            [STALE]
                │
                ├── API-0306 (Confirm Stale) → new version; → APPROVED
                ├── API-0307 (Retranslate Stale) → new AI version; → DRAFT
                └── API-0303 (Manual Edit on Stale) → new manual version; → DRAFT
```

**Important nuances:**
- `DRAFT` translations (not yet approved) can also be flagged STALE by API-0501 if English changes.
- `PENDING_REVIEW` translations can also be flagged STALE by API-0501.
- `NO_TRANSLATION` translations are never flagged STALE — they are simply skipped by API-0501.
- After REJECT of an initial draft (no prior approved version): Translation returns to `NO_TRANSLATION`. The rejected version is preserved in version history with status `REJECTED`.
- After REJECT of a revision when a prior approved version exists: The prior `APPROVED` version is restored as the active state. The rejected version is preserved with status `REJECTED`.
- `STALE` is not a blocking state. Content deployed in Language Services continues serving. `STALE` is advisory.

**Owner:** Translation / Group 3.

---

### 3.6 Translation Version State Machine

```
          [Created as DRAFT]
                │
                │ API-0309 (Submit for review)  — no version bump; status field updated
                ▼
         [PENDING_REVIEW]
                │
                ├── API-0304 (APPROVE)          — no version bump; approvedBy/At written
                │         ▼
                │    [APPROVED]
                │
                ├── API-0304 (EDIT_AND_APPROVE) — new version N+1 created; this version → SUPERSEDED
                │
                ├── API-0304 (REQUEST_RETRANSLATION) — new version N+1 created; this version → SUPERSEDED
                │
                └── API-0304 (REJECT)           — this version → REJECTED; prior approved restored
                
        [APPROVED]
                │
                │ New version approved (via any route above)
                ▼
         [SUPERSEDED]
         
        [STALE]  ← entered when English changes (API-0501 updates live state record)
                │   Note: This is a live state, not a version state.
                │   The historical version retains its original status (e.g., SUPERSEDED).
```

**Append-once rule for review lifecycle fields** applies exactly as in English Copy Version (§3.4).

**Snapshot content fields** (`text`, `creationMethod`, `sourceEnglishVersion`, `confidenceScore`, `backTranslation`, `variableIntegrityStatus`, `author`, `authoredAt`, `changeReason`): **strictly immutable** at creation.

**Owner:** Translation / Group 3.

---

### 3.7 Language State Machine

```
          API-0802 (Add Language)
                │
                ▼
           [ACTIVE]
                │
                │ API-0803 (Deactivate Language)
                ▼
          [INACTIVE]
```

**States:**
- `ACTIVE`: Fully operational. New translations can be created, approved, and published. Slots created for new tags.
- `INACTIVE`: No new translations. No publishing. All Translation entities, versions, and Release records preserved.

**Side-effect of ACTIVE → INACTIVE:** None on Translation entities. Language's inactive status prevents new operations only.  
**Side-effect of Language addition (INACTIVE → ACTIVE never happens; ACTIVE is initial):** API-0506 creates NO_TRANSLATION slots for all currently active tags across all pages.  
**Irreversibility:** Reactivation not supported in v1. One-directional.  
**Owner:** Administration / Group 8.

---

### 3.8 Release State Machine

```
          API-0404 (Approve) or API-0502 (Implicit Dev)
                │  Release created at execution time (API-0405)
                │  status: PENDING
                ▼
          [PENDING]
                │
                │ API-0405 begins Language Services call
                ▼
         [IN_PROGRESS]
                │
                ├─ Language Services success → [SUCCESSFUL]
                │                                    │
                │                                    │ Later rollback deployment succeeds
                │                                    ▼
                │                              [ROLLED_BACK]  ← only permitted post-creation mutation
                │
                └─ Language Services failure → [FAILED]
                                               (preserved permanently as-is;
                                                a retry creates a new Release record)
```

**States:**
- `PENDING`: Release record created; execution not yet started.
- `IN_PROGRESS`: Execution begun; Language Services call in-flight.
- `SUCCESSFUL`: Language Services confirmed success for the target language.
- `FAILED`: Language Services returned failure, timed out, or was unreachable. The Release record is permanent and immutable once FAILED.
- `ROLLED_BACK`: Set on a prior `SUCCESSFUL` release when a newer rollback deployment for the same (pageId, language, environment) completes successfully.

**Immutability:** All fields are immutable once the Release record is created. The only permitted post-creation mutation is the `SUCCESSFUL → ROLLED_BACK` transition.

**Retry semantics:** A retry after confirmed failure creates a **new Release record**. The prior `FAILED` record is preserved.

**Owner:** Publishing / Group 4.

---

### 3.9 Publishing Approval Request State Machine

```
          API-0403 (Request Publishing Approval)
                │
                ▼
           [PENDING]
                │
                ├── API-0404 (Approve)  ────────────────► [APPROVED]
                │                                              │ triggers Release creation + API-0405
                │
                ├── API-0404 (Reject)   ────────────────► [REJECTED]
                │
                ├── 24-hour timeout     ────────────────► [EXPIRED]
                │
                └── Bundle hash mismatch at API-0404    ► [CANCELLED]
                    (English content changed since request)
```

**States:**
- `PENDING`: Awaiting reviewer decision.
- `APPROVED`: Decision made; publishing execution triggered.
- `REJECTED`: Decision made; no Release created. Requester notified with rejection reason.
- `EXPIRED`: 24-hour expiry window elapsed. New request required.
- `CANCELLED`: The approved bundle content changed between request creation and the approval decision. Hash mismatch detected at API-0404 time. New request required.

**Owner:** Publishing / Group 4.

---

### 3.10 Import Event State Machine

```
          API-1001 (Upload Import File)
                │ Structural validation only
                ▼
         [UPLOAD_READY]
                │
                │ API-1002 (Execute Migration Import)
                │ Returns 202; execution is async
                ▼
          [PROCESSING]
                │
                ├── All steps succeed → [COMPLETED]
                │                             │
                │                             │ API-1003 (Get Migration Validation Report)
                │                             │ First call generates and caches report
                │                             ▼
                │                      [REPORT_AVAILABLE]
                │
                └── Any critical step fails → [FAILED]
                                              (full transactional rollback applied)
```

**States:**
- `UPLOAD_READY`: File stored, structure validated. Ready for execution.
- `PROCESSING`: Execution in progress. Async.
- `COMPLETED`: All entities created. Coverage recalculation triggered (Step 8). `counts` populated.
- `REPORT_AVAILABLE`: Validation report generated and cached by first API-1003 call.
- `FAILED`: Critical failure. Rollback applied. `failureReason` populated.

**There is no `COMPLETED_WITH_SKIPS` state.** Skipped rows are reflected in `counts.rowsSkipped` and the Validation Report's `skippedRows` array.

**Owner:** Migration / Group 10.

---

## 4. Lifecycle Sequences — Normal Paths

### 4.1 The Primary Production Sequence

*From Tag registration to content live in Production.*

```
Step 1: Page registered (API-0101)
          ↓ Side-effects: none
          
Step 2: Tag created (API-0102)
          ↓ Side-effects:
          │   (a) English Copy entity created in NO_COPY state (simultaneous)
          │   (b) NO_TRANSLATION slots created for all active Languages
          │   (c) TRANSLATION_SLOT_CREATED audit record per slot
          │   (d) Coverage recalculated: denominator increased for all active languages
          │   (e) Notification: NEW_PAGE_OR_TAG_CREATED → PM, QA
          
Step 3: English copy authored (API-0201 — Create/Edit Draft)
          ↓ English Copy Version 1 created (DRAFT)
          ↓ English Copy status: NO_COPY → DRAFT
          ↓ Side-effects: ENGLISH_COPY_CREATED audit record
          
Step 4: English copy submitted for review (API-0202)
          ↓ English Copy status: DRAFT → PENDING_REVIEW
          ↓ Side-effects:
          │   (a) ENGLISH_COPY_SUBMITTED_FOR_REVIEW audit record
          │   (b) Notification: ENGLISH_COPY_SUBMITTED_FOR_REVIEW → SR
          
Step 5: English copy approved (API-0203)
          ↓ English Copy Version 1: PENDING_REVIEW → APPROVED
          ↓ English Copy status: PENDING_REVIEW → APPROVED
          ↓ Tag.englishCopyStatus updated: → APPROVED (denormalized projection)
          ↓ Side-effects:
          │   (a) ENGLISH_COPY_APPROVED audit record
          │   (b) Notification: ENGLISH_COPY_APPROVED → author (PM/QA)
          │   (c) API-0501: Flag Stale — checks all active languages
          │       → All in NO_TRANSLATION: skip (no stale flagging for first approval)
          │       → No translations exist yet, so stale cascade is a no-op
          │   (d) API-0502: Implicit Dev Publish — checks all active languages
          │       → No APPROVED translations exist yet, all conditions fail → skip
          
Step 6: AI translation generated (API-0301 or API-0302)
          ↓ Translation Version 1 created:
          │   status: DRAFT
          │   creationMethod: AI_GENERATED
          │   sourceEnglishVersion: 1 (current approved English version)
          │   confidenceScore: 0.xx
          │   backTranslation: "[English back-translation]"
          │   variableIntegrityStatus: PASS or FAIL
          ↓ Translation status: NO_TRANSLATION → DRAFT
          ↓ Side-effects: TRANSLATION_CREATED audit record
          
Step 7a: Direct approval path — Reviewer approves draft (API-0304 APPROVE)
          ↓ Translation Version 1: DRAFT → APPROVED
          │   approvedBy/approvedAt written (once)
          ↓ Translation status: DRAFT → APPROVED
          ↓ Side-effects:
          │   (a) TRANSLATION_APPROVED audit record
          │   (b) Notification: TRANSLATION_APPROVED → PM
          │   (c) API-0502: Implicit Dev Publish triggered for (pageId, language, DEV)
          │       → Conditions checked: content exists, no IN_PROGRESS, hash differs
          │       → If all pass: Release created (PENDING → IN_PROGRESS → SUCCESSFUL/FAILED)
          │   (d) Coverage recalculated for (pageId, language)
          
Step 7b: Queue-based review path — Author submits, reviewer approves
          ↓ API-0309 (Submit for review): Translation status: DRAFT → PENDING_REVIEW
          │   No version bump.
          │   Side-effect: TRANSLATION_SUBMITTED_FOR_REVIEW audit record
          │   Notification: TRANSLATION_READY_FOR_REVIEW → LR
          ↓ API-0304 (Approve from PENDING_REVIEW): same as Step 7a above

Step 8: QA/Staging Publishing to QA (API-0402 → API-0403 → API-0404 → API-0405)
          ↓ API-0402: Read pre-publishing summary (no records created)
          ↓ API-0403: Publishing Approval Request created (status: PENDING)
          │   bundleSnapshotHash locked
          │   expiresAt: +24 hours
          │   Side-effect: PUBLISHING_APPROVAL_REQUESTED audit record
          │   Notification: [to required approver if different from requester]
          ↓ API-0404: Approval decision
          │   PAR status: PENDING → APPROVED
          │   Side-effect: PUBLISHING_APPROVAL_GRANTED audit record
          │   Release record created (status: PENDING)
          ↓ API-0405: Execution
          │   Release: PENDING → IN_PROGRESS
          │   Language Services called with approved bundle
          │   Release: IN_PROGRESS → SUCCESSFUL
          │   contentSnapshot persisted (immutable)
          │   bundleSnapshotHash stored on Release
          │   Side-effects:
          │     (a) PAGE_BUNDLE_PUBLISHED audit record
          │     (b) Coverage recalculated for (pageId, language)
          
Step 9: Production Publishing (same API sequence as Step 8)
          ↓ Same flow. SR or FN approval required for PRODUCTION.
          ↓ On success: Notification: PAGE_BUNDLE_PUBLISHED_TO_PRODUCTION → PM, SR
          ↓ Coverage numerator updated: approvedAndDeployedToProduction increases
          
Content is now live in Language Services for Production.
```

---

### 4.2 English Copy Review Paths

**Path A — Approved without escalation (normal):**
```
DRAFT → (API-0202 Submit) → PENDING_REVIEW → (API-0203 Approve) → APPROVED
```

**Path B — Rejected; revised and re-approved:**
```
DRAFT → PENDING_REVIEW → (API-0203 Reject) → DRAFT (v1, still open)
    → (author revises same draft) → PENDING_REVIEW → APPROVED
```
*Note: Rejection does not create a new version. The reviewer sends the draft back.*

**Path C — Returned for revision:**
```
DRAFT → PENDING_REVIEW → (API-0203 Return) → DRAFT
    → (author edits and creates new v1 or v2) → PENDING_REVIEW → APPROVED
```

**Path D — Escalated to Founder:**
```
DRAFT → PENDING_REVIEW → (SR escalates) → PENDING_REVIEW [escalatedToFounder: true]
    → (FN decides: Approve or Reject/Return)
    → APPROVED or DRAFT
Side-effect: ENGLISH_COPY_ESCALATED audit; ITEM_ESCALATED_TO_FOUNDER notification → FN
```

**Path E — Direct approval (no separate review step):**
For FN and SR who can approve their own submissions:
```
DRAFT → (API-0203 Approve directly) → APPROVED
```

---

### 4.3 Translation Review Paths

**Path A — Direct approval (Reviewer on AI draft):**
```
NO_TRANSLATION → [AI Generate] → DRAFT → (LR/FN API-0304 APPROVE) → APPROVED
No version bump. approvedBy/At filled once.
```

**Path B — Edit and Approve (inline correction):**
```
DRAFT → (LR API-0304 EDIT_AND_APPROVE, new text)
     → Version N+1 created (MANUAL), status: APPROVED immediately
     → Version N remains in history as SUPERSEDED
```

**Path C — Submit to queue, then approve:**
```
DRAFT → (API-0309 Submit) → PENDING_REVIEW → (LR API-0304 APPROVE) → APPROVED
```

**Path D — Request retranslation:**
```
DRAFT/PENDING_REVIEW → (LR API-0304 REQUEST_RETRANSLATION)
     → New Version N+1 created (AI_GENERATED), status: DRAFT
     → Old version N: SUPERSEDED in history
     → Translation status: → DRAFT (new)
```

**Path E — Bulk approval (high-confidence AI):**
```
DRAFT (multiple tags, AI_GENERATED, confidenceScore ≥ 0.95, variableIntegrity PASS)
     → (LR/FN API-0305 Bulk Approve, list of tagIds, language)
     → Each: DRAFT → APPROVED (no version bump per tag)
     → Each: TRANSLATION_APPROVED audit record
     → Each: API-0502 Implicit Dev Publish triggered per (pageId, language)
```

**Path F — Rejection (initial draft, no prior approved):**
```
DRAFT/PENDING_REVIEW → (LR API-0304 REJECT)
     → Version closed as REJECTED in history
     → Translation status: → NO_TRANSLATION
     → Rejection reason stored on version record
```

**Path G — Rejection (revision of existing approved):**
```
DRAFT/PENDING_REVIEW → (LR API-0304 REJECT)
     → Version closed as REJECTED in history
     → Translation status: → APPROVED (prior approved version restored as active)
     → Prior APPROVED version: all metadata immutable, not touched
```

---

## 5. Lifecycle Sequences — Exception and Alternate Paths

### 5.1 English Version Change → Stale → Resolution

*The stale lifecycle is fully described in §8. This section provides the sequence.*

**Trigger path:**
```
English copy edited (API-0201) → new v2 authored (DRAFT)
    → (API-0202 Submit) → PENDING_REVIEW
    → (API-0203 Approve, text changed from v1)
         │
         ├── API-0501: Flag Translations as Stale
         │       → All active Languages checked
         │       → APPROVED / DRAFT / PENDING_REVIEW → STALE
         │       → NO_TRANSLATION → Skip
         │       → Already STALE → Update staleInfo.currentEnglishVersion only
         │
         ├── API-0502: Implicit Dev Publish
         │       → For each active language with APPROVED translation for this page
         │       → Note: Translations just flagged STALE are no longer APPROVED
         │         → If all translations are now STALE, no DEV publish is triggered
         │         → If some languages still have APPROVED translations, those publish
         │
         └── Coverage recalculated (stale counts change; deployed count unchanged)
```

**Resolution path — Confirm Stale (translation is still good, just acknowledge):**
```
STALE → (LR/FN API-0306 :confirmStale)
     → New Translation Version N+1 created:
           creationMethod: MANUAL (the reviewer affirmed the existing text)
           sourceEnglishVersion: currentEnglishVersion (the new English version)
           text: same as the STALE translation's text
           status: APPROVED immediately
     → Translation status: STALE → APPROVED
     → Old STALE version (N): preserved in history as SUPERSEDED
     → Side-effects: TRANSLATION_STALE_CONFIRMED audit record
     → API-0502 Implicit Dev Publish triggered
```

**Resolution path — Retranslate Stale (AI retranslation against new English):**
```
STALE → (LR/FN/PM API-0307 :retranslateStale)
     → New Translation Version N+1 created:
           creationMethod: AI_GENERATED
           sourceEnglishVersion: currentEnglishVersion (new English version)
           text: AI-generated against the new English text
           status: DRAFT
     → Translation status: STALE → DRAFT
     → Old STALE version (N): preserved in history as SUPERSEDED
     → Requires LR approval before publishable
```

**Resolution path — Manual Edit on Stale:**
```
STALE → (LR API-0303 PATCH)
     → New Translation Version N+1 created:
           creationMethod: MANUAL
           sourceEnglishVersion: currentEnglishVersion (new English)
           text: manually entered
           status: DRAFT
     → Translation status: STALE → DRAFT
     → Old STALE version (N): preserved in history as SUPERSEDED
```

---

### 5.2 Failed Deployment → Retry

```
API-0403 → API-0404 (Approve) → API-0405 (Execute)
    → Release created (PENDING → IN_PROGRESS)
    → Language Services call fails (network / timeout / LS error)
    → Release: IN_PROGRESS → FAILED
    → failureReason / failureClass set on Release record
    → Audit: PAGE_BUNDLE_PUBLISH_FAILED
    → Notification: PUBLISHING_FAILED → PM, ADMIN

RETRY — Same bundle, same Idempotency-Key (network timeout retry):
    → Server rechecks Language Services state
    → Existing Release record updated (not a new record)
    → If LS confirms success: Release → SUCCESSFUL
    → If LS confirms failure: Release remains FAILED

RETRY — New attempt (confirmed failure, new try):
    → New Publishing Approval Request not required if content hasn't changed
    → API-0405 retry endpoint called with new Idempotency-Key
    → New Release record created (PENDING → IN_PROGRESS → SUCCESSFUL/FAILED)
    → Prior FAILED Release record: preserved permanently
    → deploymentVersion: N+1 (sequential)
    
Note: API-0405 is primarily system-triggered. Retry requires:
    SR or FN for PRODUCTION; LR or SR for QA; PM/QA or LR for DEV.
```

---

### 5.3 Successful Publish → Rollback → New Release

```
Current state: Release v6 (SUCCESSFUL) is the latest Production deployment for (QUICK, ar, PRODUCTION)
User decides to roll back to v4.

Step 1: API-0407 (Rollback Request)
    ↓ Identifies target rollback version (v4's contentSnapshot)
    ↓ Target version must be a prior SUCCESSFUL release for same (pageId, lang, env)
    ↓ Side-effect: Notification: ROLLBACK_INITIATED → PM, QA, SR
    
Step 2: New Release record created:
    type: ROLLBACK
    triggerSource: USER_INITIATED
    rolledBackFromDeploymentVersion: 6  (the version being reverted from)
    deploymentVersion: 7  (next sequential)
    contentSnapshot: copy of v4's contentSnapshot
    status: PENDING → IN_PROGRESS

Step 3: API-0405 executes with v4's contentSnapshot as the bundle
    ↓ Language Services called with v4's translated content
    ↓ On success: Release v7 → SUCCESSFUL
    │    Side-effect: Release v6 (prior SUCCESSFUL) → ROLLED_BACK
    │    Note: This is the ONLY post-creation mutation permitted on a historical Release
    │    Audit: PAGE_BUNDLE_ROLLED_BACK
    │    Coverage recalculated: numerator now reflects v4's content
    ↓ On failure: Release v7 → FAILED
         Prior Release v6 remains SUCCESSFUL (rollback did not succeed)
         PM and ADMIN notified

Invariant: A rollback Release always references a prior Release record via
           rolledBackFromDeploymentVersion. The prior Release is NEVER modified
           or deleted — only its status may transition to ROLLED_BACK on success.
```

---

### 5.4 English Version Approved with No Text Change (No-Op Stale Path)

```
Scenario: English copy is submitted and approved, but reviewer approved
          the same text that was already approved (e.g., typo fix that
          did not change the copy's meaning or wording).

API-0203 (Approve)
    → text comparison: newApprovedText == previousApprovedText
    → API-0501 stale flagging: SKIPPED (no-op)
    → No TRANSLATION_STALE_FLAGGED audit records
    → No stale notifications
    → Translations remain in their current state unchanged

This is an explicit rule in Group 5 §3.1.1 and §3.1.2.
```

---

### 5.5 Double English Change While Stale is Unresolved

```
State: Translation for (QUICK_1, ar) is STALE
       staleInfo.previousEnglishVersion: 2, staleInfo.currentEnglishVersion: 3

English changed again: API-0203 approves v4 with new text.

API-0501 triggered again:
    → Translation is already STALE
    → Update live state record only:
         staleInfo.currentEnglishVersion: 4 (updated)
         staleInfo.currentEnglishText: "[new v4 text]" (updated)
         staleInfo.previousEnglishVersion: 2 (PRESERVED — from original stale)
         staleInfo.previousEnglishText: "[v2 text]" (PRESERVED)
         staleInfo.staleSince: [original time] (PRESERVED)
         staleInfo.previousStatus: "APPROVED" (PRESERVED)
    → Translation status: STALE → STALE (unchanged)
    → No new version snapshot created
    → No duplicate audit record for already-STALE (audit only at first staling)

Historical version N: 100% immutable, original sourceEnglishVersion: 2 preserved.
```

---

## 6. System-Triggered Cascade Sequences

### 6.1 Cascade: Tag Creation → Slot and Entity Creation

**Trigger:** API-0102 (Create Tag) succeeds.  
**Owner:** Group 1 (side-effect of tag creation, not a separate API call).

```
API-0102 executes:
    1. Tag record created (ACTIVE)
    2. English Copy entity created (NO_COPY state) — simultaneous, same operation
    3. For each currently ACTIVE Language:
           Translation entity created (NO_TRANSLATION state)
    4. Audit record: TAG_CREATED
    5. Per-language: TRANSLATION_SLOT_CREATED audit record
    6. API-0503: Coverage recalculated for (pageId, all active languages)
          → totalActiveTags +1 for each language
          → noTranslationCount +1 for each language
    7. API-0504: Notification: NEW_PAGE_OR_TAG_CREATED → PM, QA
```

---

### 6.2 Cascade: Language Addition → Translation Slot Creation

**Trigger:** API-0802 (Add Language) succeeds.  
**Owner:** Administration / Group 8 → Group 5 API-0506.

```
API-0802 executes:
    1. Language record created (ACTIVE)
    2. Audit: LANGUAGE_ADDED
    
API-0506 (Create Empty Translation Slots) — triggered by API-0802:
    3. For each currently ACTIVE Tag across ALL pages:
           Translation entity created (NO_TRANSLATION state)
           TRANSLATION_SLOT_CREATED audit record per tag
    4. API-0503: Coverage recalculated for (all active pages, new language)
          → Coverage at 0% for all pages (all slots in NO_TRANSLATION)
```

*Distinction: New tag → uses Group 1 side-effect for slot creation. New language → uses API-0506.*

---

### 6.3 Cascade: English Approval → Stale Flagging

**Trigger:** API-0203 approves a new English version, AND the new text differs from the previously approved text.  
**Owner:** Group 5 API-0501.

```
API-0203 (Approve) succeeds with text changed:
    
    API-0501 (Flag Translations as Stale):
        For each active Language for this Tag:
            If Translation.status == NO_TRANSLATION: SKIP
            If Translation.status == STALE (already):
                → Update live state staleInfo.currentEnglishVersion and currentEnglishText only
                → No new version created; no audit record (already flagged)
            If Translation.status == DRAFT / PENDING_REVIEW / APPROVED:
                → Translation.status → STALE
                → staleInfo populated (previousStatus, staleSince, previousEnglishVersion/Text,
                                        currentEnglishVersion/Text)
                → TRANSLATION_STALE_FLAGGED audit record
                → Notification: ENGLISH_COPY_CHANGED_STALE_TRIGGER → LRs for this language
        
        API-0503: Coverage recalculated (staleCount changes)
```

---

### 6.4 Cascade: English Approval → Implicit Dev Publish

**Trigger:** API-0203 approves a new English version (any version, text changed or not).  
**Owner:** Group 5 API-0502.

```
API-0203 (Approve) succeeds:
    
    API-0502 (Implicit Dev Publishing):
        For each active Language:
            Check all 5 conditions (§ Group 5 §3.2.2):
                1. At least one APPROVED translation exists for (pageId, language)
                   NOTE: Translations just flagged STALE (above, from API-0501) are
                   no longer APPROVED. If all were APPROVED and now all STALE: condition 1 fails.
                2. No IN_PROGRESS publish for (pageId, language, DEV)
                3. Current approved bundle hash differs from last successful DEV deployment hash
                4. Language is ACTIVE
                5. Page is ACTIVE
            If all conditions met:
                → Bundle constructed (APPROVED translations only)
                → Release created (SYSTEM_AUTO_DEV, publishedBy: system:auto-publish)
                → API-0405 executed
                → On success: SUCCESSFUL, coverage recalculated, PAGE_BUNDLE_AUTO_PUBLISHED audit
                → On failure: FAILED, PM/ADMIN notified (PUBLISHING_FAILED)
```

---

### 6.5 Cascade: Translation Approval → Implicit Dev Publish

**Trigger:** API-0304 (Approve / Edit-and-Approve) or API-0305 (Bulk Approve) succeeds.  
**Owner:** Group 5 API-0502.

```
API-0304/API-0305 (Approve) succeeds for (tagId, language):
    
    API-0502 (Implicit Dev Publishing):
        For the specific language just approved:
            Check all 5 conditions (same as §6.4)
            If all conditions met:
                → Bundle for (pageId, language) constructed
                → Release created (SYSTEM_AUTO_DEV)
                → API-0405 executed
                → Same success/failure handling as §6.4
```

---

### 6.6 Cascade: Implicit Dev Publish — Side-Effects on Success

```
API-0502 → API-0405 (Execute Publishing) succeeds:
    1. Release status: IN_PROGRESS → SUCCESSFUL
    2. contentSnapshot: persisted (immutable)
    3. API-0505: Audit: PAGE_BUNDLE_AUTO_PUBLISHED
    4. API-0503: Coverage recalculated for (pageId, language)
          → approvedAndDeployedToProduction may increase
    5. API-0504: Advisory notification → triggering user (if UX shows advisory):
          "Content automatically published to Dev."
```

---

### 6.7 Cascade: Tag Deprecation → Page Cascade Check

**Trigger:** API-0107 (Deprecate Tag) succeeds.  
**Owner:** Group 1.

```
API-0107 (Deprecate Tag) executes:
    1. Tag status: ACTIVE → DEPRECATED
    2. TAG_DEPRECATED audit record
    3. API-0503: Coverage recalculated for (pageId, all active languages)
          → totalActiveTags -1 (denominator decreases)
    4. System checks: Are all remaining tags on this page DEPRECATED?
          → YES: Page status: ACTIVE → DEPRECATED; PAGE_DEPRECATED audit record
          → NO: No further cascade
```

---

### 6.8 Cascade: Production Publish → Coverage Update

**Trigger:** API-0405 (Execute Publishing) succeeds for PRODUCTION environment.  
**Owner:** Group 5 API-0503.

```
API-0405 (PRODUCTION, SUCCESSFUL):
    1. Release record finalized: contentSnapshot stored
    2. API-0503: Coverage recalculated for (pageId, language)
          → approvedAndDeployedToProduction updated:
            For each tag in contentSnapshot.tags[]:
                That tag now has a PRODUCTION deployment
                → counts in numerator
          → staleCount unchanged (stale translations that were deployed still count in numerator)
    3. API-0504: Notification: PAGE_BUNDLE_PUBLISHED_TO_PRODUCTION → PM, SR
```

---

### 6.9 Cascade: Rollback → Coverage Update

**Trigger:** API-0407 (Rollback) succeeds.  
**Owner:** Group 4 → Group 5 API-0503.

```
API-0407 + API-0405 (Rollback, SUCCESSFUL):
    1. Rollback Release (v7) finalized: SUCCESSFUL
    2. Prior Release (v6): SUCCESSFUL → ROLLED_BACK
    3. API-0503: Coverage recalculated for (pageId, language)
          → approvedAndDeployedToProduction re-derived from v7 contentSnapshot
             (which is a copy of v4's contentSnapshot — the rollback target)
          → Coverage may decrease if newer tags were in v6 but not in v4
```

---

## 7. Versioning Rules and Lineage Semantics

### 7.1 When English Copy Versions Are Created

| Situation | Version Effect | Created Version Status |
|---|---|---|
| First English text authored (NO_COPY → DRAFT) | Version 1 created | DRAFT |
| New draft submitted (DRAFT → PENDING_REVIEW) | No version bump | Status field updated to PENDING_REVIEW |
| English version rejected / returned | No new version | Status field updated back to DRAFT |
| English version approved | No new version | Status field updated to APPROVED |
| New edit after prior version approved (APPROVED → DRAFT) | Version N+1 created | DRAFT |
| Prior approved version superseded by new approval | No new version created | Prior version: status → SUPERSEDED |

**Version number rule:** Sequential integers starting at 1, per `tagId`. No gaps. Monotonically increasing.

---

### 7.2 When Translation Versions Are Created

| Operation | Version Effect | Created Version Status |
|---|---|---|
| First AI generation (from NO_TRANSLATION) | Version 1 created (AI_GENERATED) | DRAFT |
| First manual edit (from NO_TRANSLATION) | Version 1 created (MANUAL) | DRAFT |
| Submit for review (DRAFT → PENDING_REVIEW) | No version bump | Status field: → PENDING_REVIEW |
| Direct approve (DRAFT or PENDING_REVIEW → APPROVED) | No version bump | Status field: → APPROVED |
| Edit and Approve (reviewer correction) | Version N+1 created (MANUAL), approved immediately | APPROVED |
| Request Retranslation | Version N+1 created (AI_GENERATED) | DRAFT |
| Confirm Stale (stale → approved, same text) | Version N+1 created (MANUAL) | APPROVED immediately |
| Retranslate Stale (AI against new English) | Version N+1 created (AI_GENERATED) | DRAFT |
| Manual Edit on Stale | Version N+1 created (MANUAL) | DRAFT |
| Manual Edit on Approved | Version N+1 created (MANUAL) | DRAFT |
| Reject initial draft (no prior approved) | No version created. Draft version → REJECTED | N/A |
| Reject revision (prior approved exists) | No version created. Revision → REJECTED; prior APPROVED restored | N/A |
| Migration import | Version 1 created (MIGRATED) | APPROVED directly |

**Version number rule:** Sequential integers starting at 1, per `(tagId, languageCode)`. No gaps.

---

### 7.3 Version Lineage: `sourceEnglishVersion`

Every Translation Version carries a `sourceEnglishVersion` integer that points to the English Copy version number from which the translation was derived or confirmed.

**Lineage rules:**

| Creation Path | `sourceEnglishVersion` Set To |
|---|---|
| AI generation (API-0301/0302) | Current approved English Copy version at generation time |
| Manual creation (API-0303) | Current approved English Copy version at authoring time |
| Confirm Stale (API-0306) | `staleInfo.currentEnglishVersion` (the new English version, not the old one) |
| Retranslate Stale (API-0307) | `staleInfo.currentEnglishVersion` |
| Manual Edit on Stale (API-0303) | Current approved English Copy version at edit time |
| Edit and Approve (API-0304) | Current approved English Copy version at review time |
| Migration (API-1002) | `1` — the English Copy Version 1 created simultaneously |

**Freshness invariant (derived, not stored):**
- `isFresh = (translation.sourceEnglishVersion == currentApprovedEnglishCopyVersion)`
- `isStale = (translation.sourceEnglishVersion < currentApprovedEnglishCopyVersion)`

---

### 7.4 Release Deployment Versioning

**Deployment version:** Sequential integer per `(pageId, languageCode, environment)`. Starts at 1 for first deployment. Increments for every Release record (PUBLISH or ROLLBACK) created for that scope.

**Uniqueness guarantee:** At any point in time, `(pageId, languageCode, environment, deploymentVersion)` uniquely identifies exactly one Release record.

**Relationship to content versions:** A Release record stores, for each included tag:
- `translationVersion` (Translation Version number per Group 3)
- `sourceEnglishVersion` (English Copy Version number per Group 2)
- `translationText` (the exact string pushed to Language Services)

These four version identities are never collapsed:
1. `deploymentVersion` — which deployment event in the environment history
2. `translationVersion` — which translation version of this tag was published
3. `sourceEnglishVersion` — which English copy version the translation was derived from
4. `translationText` — the exact string sent to Language Services

---

## 8. Stale Lifecycle — Complete Model

### 8.1 Triggering Condition (Precise)

API-0501 (Flag Translations as Stale) is triggered by API-0203 (Review English Copy → APPROVE action) **if and only if** the newly approved English text is different from the previously approved English text.

```
if newApprovedText == previousApprovedText:
    → API-0501 NOT triggered (no-op; no audit records; no notifications)
    
if newApprovedText != previousApprovedText:
    → API-0501 triggered for all active languages
```

---

### 8.2 Per-Prior-State Transition Table

| Translation Prior State | API-0501 Action | Resulting State | `previousStatus` in staleInfo |
|---|---|---|---|
| `NO_TRANSLATION` | Skip — not flagged | `NO_TRANSLATION` (unchanged) | N/A |
| `DRAFT` | Flag stale | `STALE` | `DRAFT` |
| `PENDING_REVIEW` | Flag stale | `STALE` | `PENDING_REVIEW` |
| `APPROVED` | Flag stale | `STALE` | `APPROVED` |
| `STALE` (already) | Update `staleInfo.currentEnglishVersion` and `staleInfo.currentEnglishText` only | `STALE` (unchanged) | Preserved from original flagging |

---

### 8.3 Stale Update Semantics

**When flagging:** The live state record (mutable current state) is updated. No historical version snapshot is touched.

**When already stale and English changes again:** Only `staleInfo.currentEnglishVersion` and `staleInfo.currentEnglishText` are updated. The fields `previousEnglishVersion`, `previousEnglishText`, `staleSince`, and `previousStatus` are preserved from the original staling. No new version created. No audit record for already-STALE update.

**What is NOT affected by stale flagging:**
- Historical version snapshots (strictly immutable)
- Content in Language Services (the stale translation remains live and served)
- The numerator of the coverage calculation (stale-but-deployed counts)
- The Translation entity's `createdAt` timestamp

---

### 8.4 Stale Resolution Options — Comparison

| Path | API | New Version Created? | `sourceEnglishVersion` | Resulting Status | Requires Further Review? |
|---|---|---|---|---|---|
| Confirm Stale | API-0306 | Yes — N+1 (MANUAL) | currentEnglishVersion | APPROVED immediately | No — LR/FN can self-confirm |
| Retranslate Stale | API-0307 | Yes — N+1 (AI_GENERATED) | currentEnglishVersion | DRAFT | Yes — LR approval required |
| Manual Edit on Stale | API-0303 | Yes — N+1 (MANUAL) | currentEnglishVersion | DRAFT | Yes — LR approval required |

In all three resolution paths:
- Old STALE version (N) is preserved in version history as `SUPERSEDED`.
- `staleInfo` on the live state record is cleared (set to null).
- `previousStatus` from staleInfo is no longer needed after resolution (used during resolution only).

---

### 8.5 Language Independence

Each language's stale status is completely independent. Resolving Arabic staleness has no effect on Hindi's STALE status. This is a hard invariant (FRD §7 Rule 7, Group 3 §1.7).

---

## 9. Publishing and Deployment Lifecycle

### 9.1 The Three Publishing Paths

| Path | Trigger | Approval Model | Release `triggerSource` |
|---|---|---|---|
| Implicit Dev Publish | Translation approved OR English copy approved | System acts as approver (`system:auto-publish`) | `SYSTEM_AUTO_DEV` |
| Manual Publishing (all environments) | User initiates API-0403 → API-0404 → API-0405 | Human approver required (role varies by env) | `USER_INITIATED` |
| Migration Bootstrap | API-1002 completes | System creates record; no human approval | `MIGRATION` |

---

### 9.2 Content Bundle Construction Rules

For any publishing execution (manual or implicit):

| Rule | Source |
|---|---|
| Only APPROVED translations included | FRD §5.5, §11 |
| DRAFT, PENDING_REVIEW, STALE translations excluded | FRD §11 |
| NO_TRANSLATION slots excluded | No content to publish |
| DEPRECATED tags excluded from bundle | FRD §7 Rule 23 |
| Deprecated tags' prior values are NOT removed from Language Services | ED-LS-02 (smart upsert; omission ≠ deletion) |
| One language per execution (one payload to Language Services) | FRD §7 Rule 14 |
| Module and Copy Type NOT included in Language Services payload | Language Services schema does not carry these |
| `bundleSnapshotHash` computed before API-0403 (from API-0402 response) | Group 4 §1.6 |

---

### 9.3 Bundle Snapshot Hash Validity

The `bundleSnapshotHash` is computed from the content of APPROVED translations for the (pageId, language) at a specific moment. Two checks prevent stale-approval problems:

1. **At API-0403 (Request Approval):** Server recomputes hash; must match client-submitted hash. If mismatch: `409 BUNDLE_HASH_MISMATCH`.
2. **At API-0404 (Approve):** Server recomputes hash; must match hash locked at API-0403 time. If mismatch: `409 BUNDLE_CHANGED_SINCE_APPROVAL_REQUEST` → PAR transitions to `CANCELLED`.

If hash mismatch occurs, the user must call API-0402 again, get the updated hash, and submit a new API-0403.

---

### 9.4 Release Record and Approval Request Relationship

```
API-0403 creates: Publishing Approval Request (PENDING)
    └── bundleSnapshotHash locked at this moment
    └── expiresAt: +24 hours
    
API-0404 decision:
    ├── REJECT: PAR → REJECTED; no Release created
    ├── APPROVE: PAR → APPROVED
    │       Server creates Release record (status: PENDING)
    │       approvalRequestId on Release → points to PAR
    │       API-0405 triggered
    │
    └── Hash mismatch detected: PAR → CANCELLED; no Release created
    
Release references PAR: Release.approvalRequestId = PAR.approvalRequestId
PAR does NOT reference Release (PAR is created first and has no Release dependency)
Ownership direction: Release → PAR (Release knows about PAR; PAR is independent)
```

---

### 9.5 Rollback Lineage

```
rollbackRelease.rolledBackFromDeploymentVersion = priorSuccessfulRelease.deploymentVersion

For scope (pageId, language, env):
  deploymentVersion 1 → SUCCESSFUL
  deploymentVersion 2 → SUCCESSFUL
  deploymentVersion 3 → SUCCESSFUL → (on rollback success) → ROLLED_BACK
  deploymentVersion 4 → ROLLBACK (rolledBackFromDeploymentVersion: 3)
                         → SUCCESSFUL (new active deployment)

After rollback:
  v3 is ROLLED_BACK (single status mutation, no other field changes)
  v4 is SUCCESSFUL (content = copy of whatever version was targeted)
  v1, v2 are unchanged (SUCCESSFUL, no ROLLED_BACK since they weren't the one being reverted from)
```

---

## 10. Migration Lifecycle

### 10.1 What Migration Creates

API-1002 creates the following entities in this order:

```
Step 3: Pages (ACTIVE) — equivalent logic to API-0101
Step 4: Tags (ACTIVE) — equivalent logic to API-0102
         └── English Copy entities (in NO_COPY initially; filled at Step 5)
         └── NO_TRANSLATION slots NOT created here (migration creates translations directly)
Step 5: English Copy records (APPROVED state directly, no review cycle)
         └── English Copy Version 1 (APPROVED, authoredBy: executedBy user, status set directly)
         └── English Copy entity status → APPROVED
         └── Tag.englishCopyStatus → APPROVED
Step 6: Translations (APPROVED state directly, no review cycle)
         └── Translation Version 1 (APPROVED, creationMethod: MIGRATED, confidenceScore: null)
         └── Translation entity status → APPROVED
Step 7: Release records (one per page × language, PRODUCTION, triggerSource: MIGRATION)
         └── This reflects that migrated content is already live in Language Services
         └── contentSnapshot built from the imported data
         └── status: SUCCESSFUL (bootstrapped history record)
Step 8: Coverage recalculation triggered for all migrated (pageId, language) pairs
Step 9: Import Event status → COMPLETED
```

### 10.2 Migration Entity Characteristics

**English Copy Version created by migration:**
- `versionNumber`: 1
- `text`: the `english_copy` column value
- `status`: `APPROVED` (directly; no DRAFT or PENDING_REVIEW states)
- `authoredBy`: executing user
- `approvedBy`: executing user (acting as migration authority)

**Translation Version created by migration:**
- `versionNumber`: 1
- `creationMethod`: `MIGRATED`
- `sourceEnglishVersion`: `1` (the English Copy Version 1 created in Step 5)
- `status`: `APPROVED` (directly)
- `confidenceScore`: `null` (no AI)
- `backTranslation`: `null`
- `variableIntegrityStatus`: null or not computed

**Freshness invariant holds from creation:** `sourceEnglishVersion (1) == currentApprovedEnglishVersion (1)`. Migration-created content is fresh. Stale flagging begins only when the first post-migration English edit is approved with a text change.

**Source-language invariant holds:** Both English Copy (v1) and Translation (v1) are created in the same atomic step. There is no window where a translation exists without an approved English copy.

### 10.3 Tags With No English Copy (Migration Edge Case)

When a tag's `english_copy` column is empty in the import file:
- Tag is created (ACTIVE)
- English Copy entity is created (NO_COPY state)
- No English Copy Version is created
- No Translation records are created (no source text)
- Logged in `skippedRows` with reason `ENGLISH_COPY_EMPTY`
- Tag.englishCopyStatus: `NO_COPY`

These tags require normal post-migration English copy authoring and translation workflow.

### 10.4 Migration Release Records and Coverage

Migration Release records carry `triggerSource: MIGRATION`. They are part of the same Release entity store as all other releases. Coverage Metrics derived from these records:

- `approvedAndDeployedToProduction`: includes all tags present in migration Release records' contentSnapshots
- After migration: for a fully migrated language (every active tag has a translation), coverage should be 100%
- EN-G10-06: This 100% coverage validation is a go-live acceptance criterion.

---

## 11. User and Role Assignment Lifecycle

### 11.1 User Provisioning

```
User authenticates for the first time (any request)
    → User record auto-created: roles: [], status: ACTIVE
    → No audit record for provisioning (it is an identity event, not a write action)
    
User with roles: [] has authenticated access but cannot perform role-restricted operations.
An ADMIN or FN must grant roles before the user can act.
```

### 11.2 Role Grant

```
API-0804 (Assign/Update Roles) — ADMIN or FN only

For each role being granted:
    → User Role Assignment record created:
         role: [granted role]
         assignedAt: now
         assignedBy: [ADMIN/FN userId]
         revokedAt: null
         revokedBy: null
    → USER_ROLE_ASSIGNED audit record

User.roles (live projection): reflects all active assignments (revokedAt IS NULL)
```

### 11.3 Role Revoke (Implicit via Role Update)

```
When API-0804 replaces a user's full role set:
    For each role being removed:
        → Existing Role Assignment record updated:
             revokedAt: now
             revokedBy: [ADMIN/FN userId]
        → USER_ROLE_MODIFIED audit record
    For each new role being added:
        → New Role Assignment record created (as §11.2)
```

### 11.4 Admin-Lockout Guard

```
Before any role change that would remove ADMIN or FN role:
    System checks: after this change, will zero users hold ADMIN or FN?
    If yes: → 409 ADMIN_LOCKOUT_PREVENTION
    The change is rejected. Current role assignments unchanged.
    
Source: Group 8 §3.4.1 v1.1 (broadened lockout guard).
```

### 11.5 Role Assignment History Query

```
User's current roles: User Role Assignment records where revokedAt IS NULL
User's full role history: All User Role Assignment records for userId (granted + revoked)
Point-in-time role state: Records where assignedAt <= T AND (revokedAt IS NULL OR revokedAt > T)
```

---

## 12. Audit and Notification Ownership

### 12.1 Audit Record Ownership

Audit Records have no parent entity. They are system records that reference any subject entity. The reference is one-way: Audit Record → Subject Entity. Subject entities do not store references to their audit records.

**Production of Audit Records:**

| Record Type | Created by | Timing |
|---|---|---|
| Every write operation | API-0505 as synchronous side-effect of the primary write | Synchronous — either same transaction or guaranteed-retry async |
| Never for read operations | — | GET operations produce no audit records |
| Bulk operations | One Audit Record per affected entity | Not one record per batch |

**Immutability:** An Audit Record's fields are set at creation and never modified. No archival, deletion, or compaction is permitted.

### 12.2 Notification Ownership

Notifications are per-user, per-event records. They are infrastructure records, not domain entities.

**Delivery model:**
- Created and persisted synchronously (the record always exists)
- Dispatched asynchronously via channel (in-app, email, push)
- Delivery failures: up to 3 retries. After 3 failures: `deliveryStatus: DELIVERY_FAILED`. Record still visible in-app.
- Delivery failure does not block or roll back the primary operation.

**Status transitions:**
```
Created → UNREAD → READ (set once when user marks read; readAt timestamp written once)
```

**Deduplication:** If the same event produces multiple notifications to the same user (multi-role user), only one notification is sent. Key: `(event, recipientUserId, subject.tagId|pageId)`.

### 12.3 Comment Ownership

Comments are owned by Tags, not by English Copy or Translation Versions. They are surface-scoped, not version-scoped.

**Implications:**
- A comment posted on Tag X's Arabic surface remains visible even when Translation Version 1 is superseded by Version 2.
- Comments are part of the permanent editorial context for a Tag, not of any specific content version.
- Comments cannot be deleted. Resolution (`resolved: true`) is the only state change.
- `resolved` is the only mutable field on a Comment.

---

## 13. Derived Model Dependency Graph

The following read models have no independent write path. They are computed from source entities and must never be used as sources of truth for business rule validation.

### 13.1 Coverage Metrics

**Sources:**
- Tag entity: `totalActiveTags` (denominator)
- Release entity (SUCCESSFUL, PRODUCTION): `contentSnapshot.tags[]` (numerator — which tags are deployed)
- Translation entity: `status` field (for the breakdown counts: staleCount, draftCount, etc.)

**Update triggers (9 events):**

| Event | Triggering API | Coverage Scope Affected |
|---|---|---|
| Translation approved | API-0304 | (pageId, language) |
| Translation goes stale | API-0501 | (pageId, language) per affected language |
| Tag created | API-0102 | (pageId, all active languages) |
| Tag deprecated | API-0107 | (pageId, all active languages) |
| Page bundle published to Production | API-0405 | (pageId, language) |
| Page bundle rolled back | API-0407 | (pageId, language) |
| Language added | API-0802 + API-0506 | (all active pages, new language) |
| Translation slots created for new tag | API-0102 side-effect | (pageId, all active languages) |
| Translation slots created for new language | API-0506 | (all active pages, new language) |

**Materialization model:** Precomputed per (pageId, language). Not computed on demand. Updated asynchronously after each trigger. `computedAt` timestamp tracks freshness.

---

### 13.2 Environment Status Matrix

**Sources:**
- Release entity: most recent SUCCESSFUL deployment per (pageId, language, environment)
- Tag entity: current active tag count

**Derived fields:**
- `status`: `NEVER_PUBLISHED`, `PUBLISHED`, `BEHIND`, `PUBLISHING`, `FAILED`, `ROLLED_BACK`
- `hasUnpublishedApprovedContent`: current approvedBundleHash ≠ deployed bundleSnapshotHash

**Update triggers:** Any Release creation or status change for the relevant scope.

---

### 13.3 Review Queue

**Sources:**
- English Copy Versions in PENDING_REVIEW status (for SR queue)
- Translations in PENDING_REVIEW status (for LR queue)
- Publishing Approval Requests in PENDING status (for approver queue)
- Escalations (escalatedToFounder = true, for FN queue)

**No separate queue entity.** The queue is a live, filtered projection over these source entities.

---

### 13.4 Activity Timeline

**Source:** Audit Records, filtered by scope (page, tag, language, user, action type).

**Not a separate entity.** Read directly from the Audit Record store with time-ordered index.

---

### 13.5 Recently-Edited (User-Personal Projection)

**Sources:**
- Audit Records: write/edit events performed by this user on tags
- Access-event store: view events by this user (since GET operations produce no Audit Records)

**Not a domain entity.** Has no independent write path. Computed per user.

**Fields and their sources:**

| Field | Source |
|---|---|
| `userId` | Identity |
| `tagId` | Identity |
| `lastAccessedAt` | Access-event store |
| `lastAction` | Audit Record (most recent write action by this user on this tag) |
| `lastActionAt` | Audit Record timestamp |

---

### 13.6 Pending Work Summary

**Sources:** English Copy entity status counts, Translation entity status counts, Publishing Approval Request PENDING count.

**Not a separate entity.** Computed aggregate. May be precomputed for dashboard performance.

---

## 14. Cross-Domain Invariants for Database Design

These invariants must be enforced at the schema, constraint, or application level. They are derived from the locked API contracts, FRD, and this entity architecture.

### 14.1 Identity Uniqueness Invariants

| # | Invariant | Scope |
|---|---|---|
| I-01 | `pageId` is globally unique across all Pages (including deprecated) | Page |
| I-02 | `tagId` is globally unique across all Tags (including deprecated), and must begin with `pageId_` | Tag |
| I-03 | `languageCode` is globally unique across all Languages (including inactive) | Language |
| I-04 | `(tagId, languageCode)` is unique across all Translation entities | Translation |
| I-05 | `(tagId, versionNumber)` is unique across all English Copy Versions per Tag | EC Version |
| I-06 | `(tagId, languageCode, versionNumber)` is unique across all Translation Versions | TV |
| I-07 | `(pageId, languageCode, environment, deploymentVersion)` is unique across all Releases | Release |
| I-08 | `approvalRequestId` is globally unique | PAR |
| I-09 | `auditRecordId` is globally unique | Audit Record |
| I-10 | `userId` is globally unique | User |

---

### 14.2 Cardinality and Existence Invariants

| # | Invariant | Scope |
|---|---|---|
| I-11 | Every Tag has exactly one English Copy entity (1:1, created simultaneously with Tag) | Tag → EC |
| I-12 | Every (Tag, active Language at tag creation time) pair has exactly one Translation entity | Tag → Translation |
| I-13 | A Translation entity exists for a (Tag, Language) pair for every Language that was active when the Tag was created, or when the Language was added | Translation |
| I-14 | At most one PENDING Publishing Approval Request may exist per (pageId, languageCode, environment) at any time | PAR |
| I-15 | At most one APPROVED English Copy version may exist per Tag at any time | EC Version |
| I-16 | Version numbers for English Copy Versions are sequential integers starting at 1, with no gaps, per Tag | EC Version |
| I-17 | Version numbers for Translation Versions are sequential integers starting at 1, with no gaps, per (tagId, languageCode) | TV |

---

### 14.3 Lifecycle and State Invariants

| # | Invariant | Scope |
|---|---|---|
| I-18 | `pageId`, `tagId`, `languageCode`, `language.direction`, `language.languageName` (v1) are immutable after creation | Page, Tag, Language |
| I-19 | English Copy Version snapshot content fields are immutable at creation | EC Version |
| I-20 | Translation Version snapshot content fields are immutable at creation | TV |
| I-21 | Audit Records are immutable and permanent. No updates, deletions, or archival | Audit Record |
| I-22 | Release records are immutable once created, except the `ROLLED_BACK` status transition on a prior SUCCESSFUL release | Release |
| I-23 | No entity is ever physically deleted (Page, Tag, English Copy, Translation, EC Version, TV, Language, Release, PAR, Comment, Audit Record, User) | All entities |

---

### 14.4 Referential and Lineage Invariants

| # | Invariant | Scope |
|---|---|---|
| I-24 | `Translation.sourceEnglishVersion` must reference a valid English Copy Version number for the same `tagId` | Translation → EC Version |
| I-25 | A Translation in any state other than `NO_TRANSLATION` must have at least one Translation Version | Translation |
| I-26 | A Release's `approvalRequestId` (when non-null) must reference an existing, APPROVED Publishing Approval Request for the same (pageId, languageCode, environment) | Release → PAR |
| I-27 | A Rollback Release's `rolledBackFromDeploymentVersion` must reference an existing, SUCCESSFUL Release for the same (pageId, languageCode, environment) | Release → Release |

---

### 14.5 Source Language and Approval Invariants

| # | Invariant | Scope |
|---|---|---|
| I-28 | AI translation generation (API-0301/0302) may only proceed when `Tag.englishCopyStatus == APPROVED` | Translation |
| I-29 | A Translation Version's `sourceEnglishVersion` must always equal the English Copy version that was current-approved at the time of the translation's creation or confirmation — except for MIGRATED translations, where both are created simultaneously | TV → EC Version |
| I-30 | No Translation entity for a (Tag, Language) pair may enter DRAFT or APPROVED state without an approved English Copy version for that Tag — except during the migration atomic step | Translation |

---

### 14.6 Language Isolation Invariant

| # | Invariant | Scope |
|---|---|---|
| I-31 | Any write operation on a (tagId, languageCode) Translation entity affects only that specific entity. No write operation on a Translation may affect any Translation for a different languageCode for the same tag | Translation |

---

### 14.7 Coverage Invariant

| # | Invariant | Scope |
|---|---|---|
| I-32 | Coverage numerator counts tags present in the `contentSnapshot` of the most recent SUCCESSFUL Production Release for (pageId, language). A tag's Translation entity current status (APPROVED vs STALE) is irrelevant to the numerator — deployed is deployed | Coverage |

---

## 15. Consistency Audit — Groups 1–10 vs ED-02

### 15.1 Group 1 — Pages & Tags

| Check | Result | Notes |
|---|---|---|
| Tag creation side-effects (EC + Translation slots) | ✅ Consistent | §6.1 matches Group 1 §3.2.5 note and ED-01 §7.3 |
| Page deprecation cascade when last tag deprecated | ✅ Consistent | §6.7 matches Group 1 §3.1.7 |
| `pageId` / `tagId` immutability | ✅ Consistent | I-18 |
| `englishCopyStatus` as denormalized projection on Tag | ✅ Consistent | §3.3 notes this. Tag.englishCopyStatus is a projection; English Copy entity is authoritative |

---

### 15.2 Group 2 — English Copy

| Check | Result | Notes |
|---|---|---|
| English Copy entity exists from Tag creation | ✅ Consistent | §3.3 state machine starts at NO_COPY created with Tag |
| Stale cascade triggered by text change only | ✅ Consistent | §8.1 exactly matches Group 5 §3.1.1 |
| SUPERSEDED version status when new version approved | ✅ Consistent | §3.4, §7.1 |
| Escalation modeled as boolean attribute, not separate entity | ✅ Consistent | §12 notes this; §8 of ED-01 |

---

### 15.3 Group 3 — Translation

| Check | Result | Notes |
|---|---|---|
| Version creation table (7 operations, correct effects) | ✅ Consistent | §7.2 matches Group 3 §1.5 table exactly |
| Submit for review (API-0309) does NOT create new version | ✅ Consistent | §7.2 — "No version bump" |
| Direct approve (API-0304 APPROVE) does NOT create new version | ✅ Consistent | §7.2 — "No version bump; status field: → APPROVED" |
| REJECT of initial draft → NO_TRANSLATION | ✅ Consistent | §3.5 state machine, §4.3 Path F |
| REJECT of revision → restore prior APPROVED | ✅ Consistent | §3.5, §4.3 Path G. Group 3 §3.4 action matrix |
| staleInfo.previousStatus used to route resolution | ✅ Consistent | §8.4, Group 5 §3.1.3 |
| STALE item must use API-0306/0307/0303, not API-0304 | ✅ Consistent | §3.5; Group 3 §3.4 error 409 INVALID_STATE_TRANSITION |
| creationMethod: MIGRATED for migration-created translations | ✅ Consistent | §10.2, ED-01 §C3 |

---

### 15.4 Group 4 — Publishing & Deployment

| Check | Result | Notes |
|---|---|---|
| PAR created first (API-0403); Release created at API-0404/API-0405 execution | ✅ Consistent | §9.4 exactly matches Group 4 §3.4 line 711: "On successful APPROVE: server creates a release record (status PENDING) and triggers API-0405 execution" |
| Release is PENDING when created; progresses to IN_PROGRESS → SUCCESSFUL/FAILED | ✅ Consistent | §3.8 matches Group 4 §2.3 |
| ROLLED_BACK is the only post-creation mutation on historical releases | ✅ Consistent | §3.8, §9.5 matches Group 4 §2.3 |
| CANCELLED (not EXPIRED) for bundle hash mismatch at approval | ✅ Consistent | §3.9, §9.3 matches Group 4 §3.4 |
| Rollback creates new Release; does not modify prior Release content | ✅ Consistent | §5.3, §9.5 |
| DEV bundle excludes STALE translations | ✅ Consistent | §6.4 note matches Group 5 §3.2.2 note |
| `bundleSnapshotHash` checked twice (at API-0403 and API-0404) | ✅ Consistent | §9.3 |
| Retry after confirmed failure creates new Release record | ✅ Consistent | §5.2, Group 4 §3.5.6 |

---

### 15.5 Group 5 — System-Triggered Behaviours

| Check | Result | Notes |
|---|---|---|
| Coverage trigger table (9 events) | ✅ Consistent | §13.1 matches Group 5 §3.3.2 exactly |
| API-0506 only for new language → all active tags direction | ✅ Consistent | §6.2 note. Group 5 §1.3 note |
| API-0502 multi-language trigger from English approval | ✅ Consistent | §6.4 matches Group 5 §3.2.1/3.2.2 |
| API-0502 single-language trigger from translation approval | ✅ Consistent | §6.5 matches Group 5 §3.2.1/3.2.3 |
| 5 conditions for implicit dev publish | ✅ Consistent | §6.4 matches Group 5 §3.2.2 exactly |
| Notification event catalogue (11 events) | ✅ Consistent | §12.2 matches Group 5 §4.2 |
| Audit record guarantee — synchronous or guaranteed-retry | ✅ Consistent | §12.1 matches Group 5 §3.5.1 |
| staleInfo.currentEnglishVersion update for already-STALE (no audit record) | ✅ Consistent | §8.3 matches Group 5 §3.1.4 |

---

### 15.6 Group 6 — Visibility & Reporting

| Check | Result | Notes |
|---|---|---|
| Coverage numerator = PRODUCTION-deployed tags (from contentSnapshot) | ✅ Consistent | §13.1 / I-32 matches Group 6 §2.1.125 and Group 5 §3.3.1 |
| STALE-but-deployed counts in numerator | ✅ Consistent | FRD F-16, Group 5 §3.3.1, Group 6 §2.1 |
| Group 6 APIs are read-only facades; no source of truth | ✅ Consistent | §13 notes this explicitly |
| Coverage uses precomputed table; not computed on demand | ✅ Consistent | §13.1 matches Group 5 §3.3.3 |

---

### 15.7 Group 7 — Search & Navigation

| Check | Result | Notes |
|---|---|---|
| Bookmark identity (userId, targetType, targetId) | ✅ Consistent | §2 relationship table |
| Recently-Edited as user-personal projection from two sources | ✅ Consistent | §13.5 matches Group 7 §1.2 and ED-01 §C9 |
| No new entities created by search | ✅ Consistent | §2 contains no Search entity |

---

### 15.8 Group 8 — Administration

| Check | Result | Notes |
|---|---|---|
| User auto-provisioned on first request | ✅ Consistent | §11.1 |
| Admin-lockout guard | ✅ Consistent | §11.4 matches Group 8 §3.4.1 v1.1 |
| Language reactivation not supported in v1 | ✅ Consistent | §3.7 one-directional |
| Role revocation modeled as revokedAt/revokedBy on assignment record | ✅ Consistent | §11.3, ED-01 §C6 |

---

### 15.9 Group 9 — Comments, Audit & Export

| Check | Result | Notes |
|---|---|---|
| Comments are surface-scoped, not version-scoped | ✅ Consistent | §12.3 |
| Comments permanent; only resolvable | ✅ Consistent | §12.3, I-23 |
| Export Job is transient; storage mechanism deferred to DB design | ✅ Consistent | §2 / ED-01 §C10 |
| Audit read path (API-0904) is separate from write path (API-0505) | ✅ Consistent | §12.1 |

---

### 15.10 Group 10 — Migration

| Check | Result | Notes |
|---|---|---|
| Migration state machine: UPLOAD_READY → PROCESSING → COMPLETED → REPORT_AVAILABLE / FAILED | ✅ Consistent | §10 / §3.10 |
| No COMPLETED_WITH_SKIPS state | ✅ Consistent | §10 explicitly stated |
| Migration atomic: both EC Version and Translation Version created together | ✅ Consistent | §10.1 steps 5 and 6 |
| sourceEnglishVersion = 1 for all migrated translations | ✅ Consistent | §10.2 |
| Migration Release records: triggerSource = MIGRATION, PRODUCTION, SUCCESSFUL | ✅ Consistent | §10.4, §9.1 |
| Tags with empty english_copy: created in NO_COPY, no Translation slots created | ✅ Consistent | §10.3 matches Group 10 §3.2.5 |
| Coverage at 100% expected for fully migrated language (EN-G10-06) | ✅ Consistent | §10.4 |

---

## Appendix: Key Open Questions for Database Design

These remain from ED-01 §9 and are now enriched with lifecycle context:

| # | Question | Lifecycle Implication |
|---|---|---|
| OQ-1 | Should `englishCopyStatus` on Tag be denormalized or computed on read? | Updated by API-0201/0202/0203 and migration. 5 possible values. High-read field. |
| OQ-2 | Should Translation live state (status, staleInfo) be a single mutable row or split from immutable version history? | The staleInfo update for already-STALE case (§8.3) requires touching the live state without creating a version. This design pattern affects table structure. |
| OQ-3 | How to represent the "append-once" review lifecycle fields on Version records? | In-place write (mutable row, fields set once) vs. separate review-event rows. Both preserve the conceptual model. |
| OQ-4 | Coverage Metrics materialization strategy? | 9 update triggers; high read frequency. Precomputed table vs. event-driven vs. read-through cache. |
| OQ-5 | How is the access-event store implemented for Recently-Edited? | High-write, short-retention, per-user. Very different from the long-retention Audit Record store. |
| OQ-6 | contentSnapshot storage format? | JSON blob vs. normalized snapshot table. Affects rollback and pre-publishing summary query patterns. |
| OQ-7 | Audit Record index strategy for high-cardinality append-only store? | Timeline queries (by performedAt), entity queries (by subject.tagId/pageId), user queries (by performedBy). |

---

*End of MioTranslate Entity Relationships, Lifecycle & Versioning Model — ED-02 v1.0*

*This document, together with ED-01 (Canonical Entity Model v1.1), constitutes the complete entity architecture for MioTranslate. The Database Design phase must derive every schema decision from these two documents.*
