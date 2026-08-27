# MioTranslate API List

**Product:** MioTranslate
**Document Type:** API Inventory (Pre-Design)
**Source Documents:** Approved BRD, FRD, User Flow Document, UX Flow Document, IA + Page Hierarchy, ASCII Wireframes, bulkImportPages API Document
**Audience:** Product, Engineering (Backend Architect), QA
**Date:** August 2026

---

## 1. Purpose

This document is the **complete inventory of backend API capabilities** MioTranslate requires to make every approved user flow and system behaviour work end to end.

It answers: *For every approved user goal, system capability, and derived behaviour in MioTranslate, what backend API capability is required?*

This document **does not**:
- Design request/response schemas
- Define database tables or technology choices
- Prescribe HTTP methods, URL conventions, or authentication
- Make architectural decisions

Those belong in the subsequent **API Design** and **Entity/DB Design** documents.

### 1.1 Terminology

| Term | Meaning |
|---|---|
| **MioTranslate-owned** | API built and operated by the MioTranslate backend |
| **External** | API provided by another service (e.g., Language Services, AI Translation Service) |
| **System-triggered** | Operation initiated automatically by the system, not by a user action |
| **AF-n** | API Fact — confirmed behaviour from the bulkImportPages API document |
| **PD-n** | Product Decision — approved product design choice |
| **ED-n** | Engineering Dependency — behaviour requiring engineering confirmation or new capability |

### 1.2 How APIs Were Derived

```
BRD Capability → FRD Feature → User Flow → UX Flow → User/System Action → Required Backend Capability → API
```

Multiple UI actions may use one API. One user flow may require several APIs. APIs are also derived from system-triggered behaviours (stale flagging, notifications, coverage recalculation, audit recording, implicit Dev publishing) that have no direct user action but require backend support.

---

## 2. API Inventory

### Domain 1: Pages & Tags (Registry)

> Foundation of the product. All other domains operate on data created here.
> FRD §5.1, Features F-01, F-02. User Flows UF-01, UF-13, UF-16.

---

#### API-0101: Create Page

| Field | Value |
|---|---|
| **API ID** | API-0101 |
| **API Name** | Create Page |
| **Business Purpose** | Register a new MioSalon page in MioTranslate using the developer-provided Page ID |
| **FRD Feature** | F-02 (Create Page & Tag) |
| **User Flow(s)** | UF-01 (Register a New Page and Create Tags) |
| **Primary Actor** | PM, Founder |
| **Operation** | Creates a new page record with Page ID (required), Page Name (required), and Module (optional) |
| **Ownership** | MioTranslate-owned |
| **Entity/Resource** | Page |
| **Scope** | Page |
| **Success Outcome** | Page created in MioTranslate with Active status. Audit record created. |
| **Failure/Edge Cases** | Page ID already exists → validation error. Page ID empty → validation error. User lacks create permission → authorization error. |
| **Dependencies** | None. Foundation API. |

---

#### API-0102: Create Tag(s)

| Field | Value |
|---|---|
| **API ID** | API-0102 |
| **API Name** | Create Tag(s) |
| **Business Purpose** | Create one or more tags within a registered page |
| **FRD Feature** | F-02 |
| **User Flow(s)** | UF-01 |
| **Primary Actor** | PM, Founder |
| **Operation** | Creates tag records with Tag ID (required) and optional Copy Type. Tags enter "Needs English copy" state. Supports creating multiple tags in one operation for efficiency (UX-01 Steps 4–6 describe iterative creation). |
| **Ownership** | MioTranslate-owned |
| **Entity/Resource** | Tag |
| **Scope** | Tag (within a page) |
| **Success Outcome** | Tag(s) created in MioTranslate. Each tag has no English copy and no translations. Audit record created per tag. Notification sent to PM/QA (FRD §12). |
| **Failure/Edge Cases** | Tag ID already exists → validation error. Tag ID does not follow naming convention → validation error. Parent page does not exist → validation error. |
| **Dependencies** | API-0101 (page must exist) |

---

#### API-0103: List Pages

| Field | Value |
|---|---|
| **API ID** | API-0103 |
| **API Name** | List Pages |
| **Business Purpose** | Provide the browsable page list — the primary landing experience of MioTranslate |
| **FRD Feature** | F-01 (Page & Tag Browsing) |
| **User Flow(s)** | UF-13 (Find and Inspect UX Copy) |
| **Primary Actor** | All roles |
| **Operation** | Returns paginated list of all pages with: Page Name, Page ID, Module (where set), total tag count, status (Active/Deprecated), and per-language translation summary. Supports filtering by module (where set), translation completeness, and status. Supports sorting by name, module, tag count, and translation coverage for a selected language. |
| **Ownership** | MioTranslate-owned |
| **Entity/Resource** | Page (aggregate) |
| **Scope** | All pages |
| **Success Outcome** | Paginated page list with computed per-language summaries returned. |
| **Failure/Edge Cases** | Zero pages exist → empty result with guidance. 100+ pages → pagination required. |
| **Dependencies** | None |

---

#### API-0104: Get Page Detail

| Field | Value |
|---|---|
| **API ID** | API-0104 |
| **API Name** | Get Page Detail |
| **Business Purpose** | Show all tags within a page with their English copy status and translation status per language |
| **FRD Feature** | F-01 |
| **User Flow(s)** | UF-13 |
| **Primary Actor** | All roles |
| **Operation** | Returns page header (Page Name, Page ID, Module if set, status, tag count, per-language coverage summary, deployment status per language per environment) and paginated tag list with each tag's English copy status and per-language translation status. Supports filtering by translation state, language, and copy type (where set). Supports sorting. |
| **Ownership** | MioTranslate-owned |
| **Entity/Resource** | Page, Tags |
| **Scope** | Single page |
| **Success Outcome** | Page detail with all tags and their statuses returned. |
| **Failure/Edge Cases** | Page has 100+ tags → paginated tag list with search and filter. Page ID not found → 404. |
| **Dependencies** | None |

---

#### API-0105: Get Tag Detail

| Field | Value |
|---|---|
| **API ID** | API-0105 |
| **API Name** | Get Tag Detail |
| **Business Purpose** | Show complete tag information — the central detail view from which all content operations are initiated |
| **FRD Feature** | F-01, F-13 (View Version History), F-18 (Comments) |
| **User Flow(s)** | UF-13, UF-15 (Investigate History) |
| **Primary Actor** | All roles |
| **Operation** | Returns: Tag ID, Page Name (with link), Module (if set), Copy Type (if set), status, English copy (current approved text, status, author, approval date), Draft English (if exists), per-language translation status (text, status, confidence score per language), version history link, comment count, deployment status per-language per-environment. |
| **Ownership** | MioTranslate-owned |
| **Entity/Resource** | Tag, English Copy, Translations |
| **Scope** | Single tag |
| **Success Outcome** | Complete tag detail returned. |
| **Failure/Edge Cases** | Tag not found → 404. |
| **Dependencies** | None |

---

#### API-0106: Update Page Metadata

| Field | Value |
|---|---|
| **API ID** | API-0106 |
| **API Name** | Update Page Metadata |
| **Business Purpose** | Update mutable page attributes (Page Name, Module) |
| **FRD Feature** | F-02 (implied — Module is optional and can be set after creation) |
| **User Flow(s)** | UF-01 (implicit, post-creation) |
| **Primary Actor** | PM, Founder |
| **Operation** | Updates Page Name or Module. Page ID is immutable. Module is MioTranslate-internal metadata (PD-3). Audit record created. |
| **Ownership** | MioTranslate-owned |
| **Entity/Resource** | Page |
| **Scope** | Single page |
| **Success Outcome** | Page metadata updated. Audit record created. |
| **Failure/Edge Cases** | Attempt to change Page ID → rejected (immutable). Page not found → 404. |
| **Dependencies** | API-0101 |

---

#### API-0107: Deprecate Tag

| Field | Value |
|---|---|
| **API ID** | API-0107 |
| **API Name** | Deprecate Tag |
| **Business Purpose** | Mark a tag as no longer needed. Excludes it from active workflows. |
| **FRD Feature** | F-02 (business rule: "Tags cannot be deleted. They can only be marked Deprecated."), WF-11 |
| **User Flow(s)** | UF-16 (Deprecate a Tag) |
| **Primary Actor** | PM, Founder |
| **Operation** | Sets tag status to Deprecated. Tag is excluded from translation, review, and publishing workflows. Tag and all history are retained. If all tags on the page are deprecated, the page is also marked Deprecated. Audit record created. |
| **Ownership** | MioTranslate-owned |
| **Entity/Resource** | Tag (and potentially Page) |
| **Scope** | Single tag |
| **Success Outcome** | Tag status → Deprecated. Audit recorded. Page status evaluated. |
| **Failure/Edge Cases** | Tag already deprecated → no-op or advisory. Tag not found → 404. |
| **Dependencies** | None |

> [!IMPORTANT]
> **ED-1 (Engineering Dependency):** Deprecation in MioTranslate excludes the tag from future publishing bundles, but the bulkImportPages API preserves unsupplied tags. The deprecated tag continues to exist in Language Services. A separate Language Services capability to remove deprecated tags from target environments is required but does not currently exist. See §4.1.

---

#### API-0108: Update Tag Metadata

| Field | Value |
|---|---|
| **API ID** | API-0108 |
| **API Name** | Update Tag Metadata |
| **Business Purpose** | Update mutable tag attributes (Copy Type) |
| **FRD Feature** | F-04 (Copy Type is optionally set during authoring) |
| **User Flow(s)** | UF-03 (Author English Copy — includes optional Copy Type selection) |
| **Primary Actor** | PM, QA |
| **Operation** | Updates Copy Type. Tag ID is immutable. Copy Type is MioTranslate-internal metadata (PD-4). Audit record created. |
| **Ownership** | MioTranslate-owned |
| **Entity/Resource** | Tag |
| **Scope** | Single tag |
| **Success Outcome** | Tag metadata updated. Audit recorded. |
| **Failure/Edge Cases** | Tag not found → 404. |
| **Dependencies** | API-0102 |

---

### Domain 2: English Copy Management

> Authoring, editing, versioning, and review submission of English UX copy.
> FRD §5.2, Features F-04, F-05. User Flow UF-03.

---

#### API-0201: Save English Copy Draft

| Field | Value |
|---|---|
| **API ID** | API-0201 |
| **API Name** | Save English Copy Draft |
| **Business Purpose** | Save authored English copy as a Draft without submitting for review |
| **FRD Feature** | F-04 (Author English Copy), F-05 (Edit English Copy) |
| **User Flow(s)** | UF-03 (Author and Approve English UX Copy) |
| **Primary Actor** | PM, QA |
| **Operation** | Creates or updates a Draft version of English copy for a tag. If this is the first copy, tag moves from "No Copy" to "Draft". If editing existing approved copy, a new version is created as Draft (previous approved version remains active). Optional change reason captured. |
| **Ownership** | MioTranslate-owned |
| **Entity/Resource** | English Copy, Version |
| **Scope** | Single tag |
| **Success Outcome** | Draft version saved. Version history updated. Audit record created. |
| **Failure/Edge Cases** | Empty text → validation error (English copy text is mandatory). Concurrent edit conflict → conflict notification (FRD §F-04 edge case). Tag not found → 404. |
| **Dependencies** | API-0102 (tag must exist) |

---

#### API-0202: Submit English Copy for Review

| Field | Value |
|---|---|
| **API ID** | API-0202 |
| **API Name** | Submit English Copy for Review |
| **Business Purpose** | Submit a Draft English copy for reviewer action |
| **FRD Feature** | F-04, F-05 |
| **User Flow(s)** | UF-03 |
| **Primary Actor** | PM, QA |
| **Operation** | Transitions English copy status from Draft to Pending Review. Notification sent to assigned Reviewer (FRD §12). Audit record created. |
| **Ownership** | MioTranslate-owned |
| **Entity/Resource** | English Copy |
| **Scope** | Single tag |
| **Success Outcome** | Status → Pending Review. Reviewer notified. |
| **Failure/Edge Cases** | No draft exists → validation error. Already in Pending Review → validation error. |
| **Dependencies** | API-0201 (draft must exist) |

---

#### API-0203: Review English Copy

| Field | Value |
|---|---|
| **API ID** | API-0203 |
| **API Name** | Review English Copy |
| **Business Purpose** | Reviewer takes action on submitted English copy: Approve, Reject, Return for Revision, or Escalate |
| **FRD Feature** | F-04, F-05, §5.4 (Review & Approval) |
| **User Flow(s)** | UF-03, UF-09 (if escalated) |
| **Primary Actor** | Support Reviewer, Founder |
| **Operation** | Performs one of four actions: **Approve** (status → Approved; triggers stale flagging of all translations if this is an edit; triggers implicit Dev publishing), **Reject** (status remains; rejection reason recorded), **Return for Revision** (status → Draft; reviewer comment attached), **Escalate** (item added to Founder's queue; notification sent to Founder). Each action creates a Review record and an Audit record. |
| **Ownership** | MioTranslate-owned |
| **Entity/Resource** | English Copy, Review, Audit Record |
| **Scope** | Single tag |
| **Success Outcome** | Review action recorded. Status transitions applied. Downstream system behaviours triggered (stale flagging, notifications, implicit Dev publish). |
| **Failure/Edge Cases** | Item not in Pending Review → validation error. Reviewer lacks permission → authorization error. |
| **Dependencies** | API-0202 (item must be in Pending Review). Triggers API-0501 (stale flagging) on approval if English changed. Triggers API-0502 (implicit Dev publish) on approval. |

---

#### API-0204: Get English Copy Version History

| Field | Value |
|---|---|
| **API ID** | API-0204 |
| **API Name** | Get English Copy Version History |
| **Business Purpose** | Show complete chronological history of all English copy versions for a tag |
| **FRD Feature** | F-13 (View Version History), §9.4 (Version Comparison) |
| **User Flow(s)** | UF-15 (Investigate a Label Issue) |
| **Primary Actor** | All roles |
| **Operation** | Returns chronological list of all English copy versions: version number, text, author, date, reviewer, approval date, change reason, action (created/edited/approved/rejected). Supports comparing two versions side by side. |
| **Ownership** | MioTranslate-owned |
| **Entity/Resource** | English Copy versions |
| **Scope** | Single tag |
| **Success Outcome** | Complete version history returned. |
| **Failure/Edge Cases** | Tag has no English copy history → empty list. |
| **Dependencies** | None |

---

### Domain 3: Translation Management

> AI-assisted and manual translation creation, stale resolution, and translation versioning.
> FRD §5.3, Features F-06, F-07, F-08, F-10. User Flows UF-04, UF-05, UF-06, UF-08, UF-12.

---

#### API-0301: Generate AI Translation (Single Tag)

| Field | Value |
|---|---|
| **API ID** | API-0301 |
| **API Name** | Generate AI Translation (Single Tag) |
| **Business Purpose** | Generate an AI translation for a single tag in a selected language, with business context |
| **FRD Feature** | F-06 (AI-Assisted Translation) |
| **User Flow(s)** | UF-04 (Translate a Single Tag) |
| **Primary Actor** | PM, Localization Reviewer |
| **Operation** | Sends approved English copy to the AI Translation Service with business context (page, module, copy type, salon/spa terminology, translation rules when defined). Returns: translated text, back-translation, confidence score, variable integrity check result. Translation enters as Draft. Audit record created. |
| **Ownership** | MioTranslate-owned (calls External AI Translation Service) |
| **Entity/Resource** | Translation |
| **Scope** | Single tag, single language |
| **Success Outcome** | Draft translation created with back-translation, confidence score, and variable integrity status. |
| **Failure/Edge Cases** | Tag has no approved English copy → validation error. Translation already exists (Draft/Approved) → validation error (UX-04 prevents overwrite). AI service unavailable → error; translation remains "No Translation" (F-06 edge case). Multiple users trigger for same tag/language → only one created (F-06 edge case). Variable integrity failure → translation flagged for manual review. |
| **Dependencies** | API-0203 (English copy must be approved). External: AI Translation Service. |

---

#### API-0302: Generate AI Translations (Bulk — Translate All)

| Field | Value |
|---|---|
| **API ID** | API-0302 |
| **API Name** | Generate AI Translations (Bulk — Translate All) |
| **Business Purpose** | AI-translate all untranslated tags on a page for a selected language in one operation |
| **FRD Feature** | F-07 (Translate All) |
| **User Flow(s)** | UF-05 (Bulk Translate a Page for a Language) |
| **Primary Actor** | PM, Localization Reviewer |
| **Operation** | Identifies all eligible tags on the page for the selected language (has approved English, no existing Draft/Approved translation). Generates AI translations for all eligible tags. Each translation includes back-translation, confidence score, and variable integrity check. All enter as Draft. Progress indication for large pages (100+ tags). Audit record created per tag. |
| **Ownership** | MioTranslate-owned (calls External AI Translation Service per tag) |
| **Entity/Resource** | Translation (batch) |
| **Scope** | All eligible tags on a page, single language |
| **Success Outcome** | Draft translations created for all eligible tags. Count of translated, skipped (already translated), and skipped (no English) returned. |
| **Failure/Edge Cases** | All tags already have translations → "All tags already have translations for [language]." (F-07 edge case). Some tags lack approved English → skipped with count. 100+ tags → long-running operation with progress. Stale translations are not retranslated (require explicit stale resolution). |
| **Dependencies** | API-0203 (English must be approved per tag). External: AI Translation Service. |

---

#### API-0303: Edit Translation Manually

| Field | Value |
|---|---|
| **API ID** | API-0303 |
| **API Name** | Edit Translation Manually |
| **Business Purpose** | Allow a reviewer to manually correct or create a translation |
| **FRD Feature** | F-08 (Review Translation — "Edit and Approve" action) |
| **User Flow(s)** | UF-06 (Review and Approve Translations), UF-12 (Correct a Translation Reported in Production) |
| **Primary Actor** | Localization Reviewer, Founder |
| **Operation** | Creates or updates a translation with manually entered text. Marks creation method as "Manual". Creates a new version in translation history. If performed during review, can be combined with approval (API-0304). |
| **Ownership** | MioTranslate-owned |
| **Entity/Resource** | Translation, Version |
| **Scope** | Single tag, single language |
| **Success Outcome** | Translation created/updated. Version history records manual correction. Audit recorded. |
| **Failure/Edge Cases** | Empty text → validation error. Tag has no approved English copy → validation error. User is not Localization Reviewer or above → authorization error. |
| **Dependencies** | API-0203 (English must be approved) |

---

#### API-0304: Review Translation

| Field | Value |
|---|---|
| **API ID** | API-0304 |
| **API Name** | Review Translation |
| **Business Purpose** | Reviewer evaluates and takes action on a translation: Approve, Edit and Approve, Request Retranslation, or Reject |
| **FRD Feature** | F-08 (Review Translation) |
| **User Flow(s)** | UF-06 (Review and Approve Translations) |
| **Primary Actor** | Localization Reviewer, Founder |
| **Operation** | Performs one of four actions: **Approve** (status → Approved; eligible for publishing), **Edit and Approve** (reviewer corrects text, then approves; manual correction recorded in version history), **Request Retranslation** (triggers new AI translation; returns to Draft), **Reject** (rejection reason recorded; remains in Draft or returns to No Translation). Review record and audit record created. |
| **Ownership** | MioTranslate-owned |
| **Entity/Resource** | Translation, Review |
| **Scope** | Single tag, single language |
| **Success Outcome** | Review action recorded. Status transition applied. |
| **Failure/Edge Cases** | English copy changed during review → translation flagged Stale; reviewer must re-evaluate (F-08 edge case). Reviewer approves with failing variable integrity → system warns; reviewer can override with acknowledgement (F-08 edge case). Item not in reviewable state → validation error. |
| **Dependencies** | API-0301 or API-0303 (translation must exist). May trigger API-0301 (if retranslation requested). |

---

#### API-0305: Bulk Approve Translations

| Field | Value |
|---|---|
| **API ID** | API-0305 |
| **API Name** | Bulk Approve Translations |
| **Business Purpose** | Efficiently approve multiple high-confidence translations at once |
| **FRD Feature** | F-09 (Bulk Approve Translations) |
| **User Flow(s)** | UF-07 (Bulk Approve High-Confidence Translations) |
| **Primary Actor** | Localization Reviewer, Founder |
| **Operation** | Accepts a set of translation IDs (tag+language pairs). Validates each meets the configurable confidence threshold. Approves all eligible translations. Each individual approval is recorded separately in the audit trail. Translations with variable integrity failures are excluded and reported. |
| **Ownership** | MioTranslate-owned |
| **Entity/Resource** | Translation (batch), Review (batch) |
| **Scope** | Multiple tags, single language (typically scoped to a page) |
| **Success Outcome** | All eligible translations → Approved. Individual audit records created. Count of approved and excluded returned. |
| **Failure/Edge Cases** | All translations below threshold → bulk approve not available (F-09 edge case). Translation with variable integrity failure → excluded with notification (F-09 edge case). |
| **Dependencies** | API-0301 or API-0302 (translations must exist). API-0805 (reads confidence threshold configuration). |

---

#### API-0306: Resolve Stale Translation — Confirm

| Field | Value |
|---|---|
| **API ID** | API-0306 |
| **API Name** | Resolve Stale Translation — Confirm |
| **Business Purpose** | Reviewer determines existing translation is still correct despite English source change |
| **FRD Feature** | F-10 (Resolve Stale Translation) |
| **User Flow(s)** | UF-08 (Resolve Stale Translations) |
| **Primary Actor** | Localization Reviewer, Founder |
| **Operation** | Returns translation from Stale to Approved. Records which English version the translation was confirmed against. Audit record created. |
| **Ownership** | MioTranslate-owned |
| **Entity/Resource** | Translation |
| **Scope** | Single tag, single language |
| **Success Outcome** | Translation status → Approved. Confirmation recorded. |
| **Failure/Edge Cases** | Translation not in Stale state → validation error. English changed again since stale was triggered → translation must be re-evaluated against newest English (F-10 edge case). |
| **Dependencies** | None |

---

#### API-0307: Resolve Stale Translation — Retranslate

| Field | Value |
|---|---|
| **API ID** | API-0307 |
| **API Name** | Resolve Stale Translation — Retranslate |
| **Business Purpose** | Generate a new AI translation based on the updated English copy |
| **FRD Feature** | F-10 (Resolve Stale Translation) |
| **User Flow(s)** | UF-08 |
| **Primary Actor** | Localization Reviewer, Founder |
| **Operation** | Triggers a new AI translation based on the current approved English copy. The stale version is preserved in history. New translation enters as Draft. Goes through the normal review cycle. |
| **Ownership** | MioTranslate-owned (calls External AI Translation Service) |
| **Entity/Resource** | Translation |
| **Scope** | Single tag, single language |
| **Success Outcome** | New Draft translation created. Stale version preserved. Audit recorded. |
| **Failure/Edge Cases** | AI service unavailable → error; stale translation remains. |
| **Dependencies** | External: AI Translation Service. |

---

#### API-0308: Get Translation Version History

| Field | Value |
|---|---|
| **API ID** | API-0308 |
| **API Name** | Get Translation Version History |
| **Business Purpose** | Show complete chronological history of all translation versions for a tag in a specific language |
| **FRD Feature** | F-13 (View Version History) |
| **User Flow(s)** | UF-15 |
| **Primary Actor** | All roles |
| **Operation** | Returns chronological list of all translation versions: version number, text, creation method (AI/Manual), confidence score, back-translation, author/generator, reviewer, approval date, source English version, action type. Supports comparing two versions. |
| **Ownership** | MioTranslate-owned |
| **Entity/Resource** | Translation versions |
| **Scope** | Single tag, single language |
| **Success Outcome** | Complete version history returned. |
| **Failure/Edge Cases** | No translation history → empty list. |
| **Dependencies** | None |

---

#### API-0309: Submit Translation for Review

| Field | Value |
|---|---|
| **API ID** | API-0309 |
| **API Name** | Submit Translation for Review |
| **Business Purpose** | Submit a Draft translation for reviewer action |
| **FRD Feature** | F-08 |
| **User Flow(s)** | UF-04, UF-06 |
| **Primary Actor** | PM, Localization Reviewer |
| **Operation** | Transitions translation status from Draft to Pending Review. Notification sent to Localization Reviewer (FRD §12). |
| **Ownership** | MioTranslate-owned |
| **Entity/Resource** | Translation |
| **Scope** | Single tag, single language |
| **Success Outcome** | Status → Pending Review. Reviewer notified. |
| **Failure/Edge Cases** | Not in Draft → validation error. |
| **Dependencies** | API-0301 or API-0303 (translation must exist in Draft) |

---

### Domain 4: Publishing & Deployment

> Environment management, publishing execution, rollback, and deployment history.
> FRD §5.5, Features F-11, F-12. User Flows UF-10, UF-11.

---

#### API-0401: Get Environment Status

| Field | Value |
|---|---|
| **API ID** | API-0401 |
| **API Name** | Get Environment Status |
| **Business Purpose** | Show what version is currently published in each environment for a page and language |
| **FRD Feature** | F-11, F-12, §5.5 |
| **User Flow(s)** | UF-10 (Publish) |
| **Primary Actor** | All roles |
| **Operation** | Returns per-environment status for a given page and language: current published version, publishing date, published by, tag count. Also used by the environment status matrix (IA C7). Can be queried per-page-per-language or aggregated. |
| **Ownership** | MioTranslate-owned |
| **Entity/Resource** | Release, Environment |
| **Scope** | Single page, single language, all environments |
| **Success Outcome** | Environment status matrix returned. |
| **Failure/Edge Cases** | Page never published to any environment → empty status. |
| **Dependencies** | None |

---

#### API-0402: Get Pre-Publishing Summary

| Field | Value |
|---|---|
| **API ID** | API-0402 |
| **API Name** | Get Pre-Publishing Summary |
| **Business Purpose** | Show what will change if the user publishes to the target environment |
| **FRD Feature** | F-11 ("user sees a pre-publishing summary") |
| **User Flow(s)** | UF-10 |
| **Primary Actor** | Reviewer, Support Reviewer, Founder |
| **Operation** | Compares the current approved content in MioTranslate against what is currently published in the target environment. Returns: tags to be added, tags with changed values, tags excluded (Draft/Pending Review), count of changes, version that would be created. |
| **Ownership** | MioTranslate-owned |
| **Entity/Resource** | Tag, Version (comparison) |
| **Scope** | Single page, single language, single target environment |
| **Success Outcome** | Diff summary returned showing what would change. |
| **Failure/Edge Cases** | No approved content exists → "No approved content to publish." All tags in Draft → publishing cannot proceed. |
| **Dependencies** | API-0401 (needs current environment state) |

---

#### API-0403: Request Publishing Approval

| Field | Value |
|---|---|
| **API ID** | API-0403 |
| **API Name** | Request Publishing Approval |
| **Business Purpose** | Initiate the publishing approval workflow for a target environment |
| **FRD Feature** | F-11 (publishing requires approval per environment) |
| **User Flow(s)** | UF-10 |
| **Primary Actor** | PM (Dev), Localization Reviewer (QA), Support Reviewer / Founder (Production) |
| **Operation** | Creates a publishing approval request for a specific page + language + target environment. Routes to the required approver based on the target environment: Dev (Author/Reviewer), QA (Reviewer), Production (Support Reviewer/Founder). Notification sent to required approver. |
| **Ownership** | MioTranslate-owned |
| **Entity/Resource** | Publishing Approval Request |
| **Scope** | Single page, single language, single environment |
| **Success Outcome** | Approval request created. Approver notified. |
| **Failure/Edge Cases** | No approved content → validation error. Same version already deployed → duplicate prevention (FRD §11 validation). |
| **Dependencies** | API-0402 (pre-publishing summary should be reviewed first) |

---

#### API-0404: Approve or Reject Publishing

| Field | Value |
|---|---|
| **API ID** | API-0404 |
| **API Name** | Approve or Reject Publishing |
| **Business Purpose** | Required approver approves or rejects a publishing request |
| **FRD Feature** | F-11 |
| **User Flow(s)** | UF-10 |
| **Primary Actor** | Author/Reviewer (Dev), Reviewer (QA), Support Reviewer / Founder (Production) |
| **Operation** | **Approve**: triggers API-0405 (Execute Publishing). **Reject**: rejection reason recorded; publishing does not proceed. Audit record created. |
| **Ownership** | MioTranslate-owned |
| **Entity/Resource** | Publishing Approval, Audit Record |
| **Scope** | Single publishing request |
| **Success Outcome** | Approval or rejection recorded. If approved, publishing execution triggered. |
| **Failure/Edge Cases** | Approver lacks required authority for target environment → authorization error. |
| **Dependencies** | API-0403 (request must exist) |

---

#### API-0405: Execute Publishing

| Field | Value |
|---|---|
| **API ID** | API-0405 |
| **API Name** | Execute Publishing |
| **Business Purpose** | Push approved page bundle to the target environment's Language Services API |
| **FRD Feature** | F-11 |
| **User Flow(s)** | UF-10 |
| **Primary Actor** | System (triggered by API-0404 approval or API-0502 implicit Dev publishing) |
| **Operation** | Constructs a POST /multilingual/bulkImportPages request with: tenant domain, pageId, pageName, and a tags array where each tag contains tagName and a values object with the target language code mapped to the approved translation text (AF-3, AF-4). Sends request to the target environment's Language Services API endpoint. Evaluates the API response: checks the target language's status in the per-language details array (AF-10). Creates a version snapshot. Creates a deployment record. Creates an audit record. Records per-language API response details. |
| **Ownership** | MioTranslate-owned (calls External Language Services API) |
| **Entity/Resource** | Release, Version, Audit Record |
| **Scope** | Single page, single language, single environment |
| **Success Outcome** | Content pushed to Language Services. Target language succeeded → deployment status = Successful. Version snapshot created. Deployment record created. Notifications sent (FRD §12). |
| **Failure/Edge Cases** | Target endpoint unreachable → deployment status = Failed; content remains in MioTranslate; user can retry (F-11 edge case). Domain validation failure (AF-8) → entire request rejected; deployment status = Failed; specific error message displayed; PM and ADMIN notified (F-11 edge case). Target language failed in response (AF-9) → deployment status = Failed for that language. |
| **Dependencies** | External: POST /multilingual/bulkImportPages (per environment endpoint). ED-3: per-language publishing model assumes supplying one language preserves other languages' values within the same tag — to be confirmed with engineering. |

---

#### API-0406: Get Deployment History

| Field | Value |
|---|---|
| **API ID** | API-0406 |
| **API Name** | Get Deployment History |
| **Business Purpose** | Show chronological list of all publishing actions and rollbacks for a page and language |
| **FRD Feature** | F-12, §13.6 (Deployment History Report) |
| **User Flow(s)** | UF-10, UF-11, UF-15 |
| **Primary Actor** | All roles |
| **Operation** | Returns chronological list of all deployment records for a page + language: version, target environment, publishing date, published by, approved by, tag count, status (Successful/Failed/Rolled Back), per-language API response details, and whether the record is a rollback. |
| **Ownership** | MioTranslate-owned |
| **Entity/Resource** | Release (history) |
| **Scope** | Single page, single language |
| **Success Outcome** | Complete deployment history returned. |
| **Failure/Edge Cases** | No deployment history → empty list (rollback not available). |
| **Dependencies** | None |

---

#### API-0407: Execute Rollback

| Field | Value |
|---|---|
| **API ID** | API-0407 |
| **API Name** | Execute Rollback |
| **Business Purpose** | Revert a page bundle to a previous version in a target environment |
| **FRD Feature** | F-12 (Rollback) |
| **User Flow(s)** | UF-11 (Roll Back Published Content) |
| **Primary Actor** | Support Reviewer, Founder |
| **Operation** | Re-publishes the selected previous version's content to the target environment via POST /multilingual/bulkImportPages. Creates a new deployment record noting it is a rollback. The rolled-back (bad) version is preserved. Audit record created. Notifications sent (FRD §12). |
| **Ownership** | MioTranslate-owned (calls External Language Services API) |
| **Entity/Resource** | Release, Version |
| **Scope** | Single page, single language, single environment |
| **Success Outcome** | Previous version re-published. Deployment record created (type: rollback). |
| **Failure/Edge Cases** | No previous version exists → rollback not available (F-12 edge case). Rollback to version with deprecated tags → proceeds (safety measure). Tags added between rollback target and current version are preserved in Language Services due to upsert model (ED-2). |
| **Dependencies** | External: POST /multilingual/bulkImportPages. API-0406 (deployment history must show previous versions). |

---

### Domain 5: System-Triggered Behaviours

> Automatic operations triggered by system events, not by direct user actions.
> These require backend implementation but are not user-initiated APIs.

---

#### API-0501: Flag Translations as Stale

| Field | Value |
|---|---|
| **API ID** | API-0501 |
| **API Name** | Flag Translations as Stale |
| **Business Purpose** | Automatically flag all translations of a tag across all languages as Stale when the English copy changes |
| **FRD Feature** | F-05 ("All existing translations across all languages are automatically flagged Stale"), §5.2, Business Rule 5 |
| **User Flow(s)** | UF-03 (system behaviour after English copy approval), UF-08 (creates the stale items that UF-08 resolves) |
| **Primary Actor** | System (triggered by API-0203 English copy approval when English changed) |
| **Operation** | When a new English copy version is approved (and the text changed from the previous approved version), the system finds all existing translations (in any state except No Translation) for that tag across all active languages and sets their status to Stale. Notification sent to all Localization Reviewers for affected languages (FRD §12). Each stale flag references the new English version. |
| **Ownership** | MioTranslate-owned |
| **Entity/Resource** | Translation (batch — all languages for one tag) |
| **Scope** | Single tag, all languages |
| **Success Outcome** | All affected translations → Stale. Notifications sent. |
| **Failure/Edge Cases** | Tag has no translations in any language → no-op. |
| **Dependencies** | Triggered by API-0203 |

---

#### API-0502: Implicit Dev Publishing

| Field | Value |
|---|---|
| **API ID** | API-0502 |
| **API Name** | Implicit Dev Publishing |
| **Business Purpose** | Automatically publish approved content to the Dev environment without manual initiation |
| **FRD Feature** | FRD §17 resolved question: "Once the required content and approval conditions are met, approved content is automatically published to Dev through the Dev API endpoint." |
| **User Flow(s)** | UF-10 (ALT-A: Publishing to Dev Is Implicit) |
| **Primary Actor** | System (triggered by content approval) |
| **Operation** | When content (English copy or translation) is approved and meets publishing conditions, the system automatically constructs and executes a publishing action to the Dev environment using API-0405. The automatic action is recorded in the audit trail and deployment history. Advisory feedback shown to user. |
| **Ownership** | MioTranslate-owned |
| **Entity/Resource** | Release |
| **Scope** | Single page, single language, Dev environment |
| **Success Outcome** | Content published to Dev. Deployment record created (auto-publish). Audit recorded. User informed. |
| **Failure/Edge Cases** | Dev endpoint unreachable → failure recorded; can be retried. |
| **Dependencies** | API-0405 (Execute Publishing). Triggered by API-0203 (English approval) and API-0304 (Translation approval). |

---

#### API-0503: Recalculate Coverage

| Field | Value |
|---|---|
| **API ID** | API-0503 |
| **API Name** | Recalculate Coverage |
| **Business Purpose** | Update translation coverage metrics when the underlying data changes |
| **FRD Feature** | F-16 (Coverage Dashboard), §5.6 (Visibility & Reporting), §13.1 |
| **User Flow(s)** | UF-14 (Monitor Translation Coverage and Readiness) |
| **Primary Actor** | System (triggered by state changes) |
| **Operation** | Recalculates coverage percentage per page per language when relevant events occur: translation approved, translation goes stale, tag created, tag deprecated, page published, language added. Coverage = (tags with approved translation deployed to Production) / (total active tags on the page) x 100 (FRD §5.6). |
| **Ownership** | MioTranslate-owned |
| **Entity/Resource** | Coverage metrics (derived/computed) |
| **Scope** | Per page, per language (affected scope) |
| **Success Outcome** | Coverage metrics updated and available for dashboard queries. |
| **Failure/Edge Cases** | Page with 0 active tags → no coverage calculation. |
| **Dependencies** | Triggered by multiple APIs: API-0102, API-0107, API-0304, API-0305, API-0306, API-0405, API-0501, API-0802. |

---

#### API-0504: Dispatch Notification

| Field | Value |
|---|---|
| **API ID** | API-0504 |
| **API Name** | Dispatch Notification |
| **Business Purpose** | Send notifications to appropriate users when events occur |
| **FRD Feature** | FRD §12 (Notifications & Alerts — 13 notification events defined) |
| **User Flow(s)** | All flows (cross-cutting) |
| **Primary Actor** | System (triggered by events in other APIs) |
| **Operation** | Creates and delivers notifications based on event type. FRD §12 defines 13 notification events (new page/tag created, English copy submitted/approved/rejected, translation ready/approved, stale trigger, escalation, publishing to Production, rollback initiated, publishing failed). Each notification targets the appropriate role(s). |
| **Ownership** | MioTranslate-owned |
| **Entity/Resource** | Notification |
| **Scope** | Per event |
| **Success Outcome** | Notification created and delivered to target user(s). |
| **Failure/Edge Cases** | Notification delivery failure → retry or log. |
| **Dependencies** | Triggered by most write APIs across all domains. |

---

#### API-0505: Create Audit Record

| Field | Value |
|---|---|
| **API ID** | API-0505 |
| **API Name** | Create Audit Record |
| **Business Purpose** | Record an immutable log entry for every action taken in MioTranslate |
| **FRD Feature** | F-17 (Audit Trail), §4.11 |
| **User Flow(s)** | All flows (cross-cutting — every action creates an audit record) |
| **Primary Actor** | System (cross-cutting concern on every write operation) |
| **Operation** | Creates an immutable audit record with: action, subject, performed by, timestamp, details, before value, after value. FRD §F-17 defines 13 action categories. Audit records cannot be edited, deleted, or archived. |
| **Ownership** | MioTranslate-owned |
| **Entity/Resource** | Audit Record |
| **Scope** | Per action |
| **Success Outcome** | Immutable audit record persisted. |
| **Failure/Edge Cases** | Audit recording failure must not silently fail — this is a core integrity requirement. |
| **Dependencies** | Called by every write API as a cross-cutting concern. |

---

#### API-0506: Create Empty Translation Slots

| Field | Value |
|---|---|
| **API ID** | API-0506 |
| **API Name** | Create Empty Translation Slots |
| **Business Purpose** | When a new language is added, create empty translation slots for all existing active tags |
| **FRD Feature** | §5.7 ("Adding a new language creates empty translation slots for all active tags across all pages"), WF-04 |
| **User Flow(s)** | UF-17 (Add a New Language) |
| **Primary Actor** | System (triggered by API-0802 Add Language) |
| **Operation** | For every active tag across every active page, creates a "No Translation" slot for the newly added language. This may be a large batch operation. |
| **Ownership** | MioTranslate-owned |
| **Entity/Resource** | Translation (batch — all active tags) |
| **Scope** | All active tags, single language |
| **Success Outcome** | All active tags have a "No Translation" entry for the new language. |
| **Failure/Edge Cases** | Large number of tags → batch processing required. Partial failure → must be retryable. |
| **Dependencies** | Triggered by API-0802 |

---

### Domain 6: Visibility & Reporting

> Coverage dashboards, stale tracking, pending work, activity timeline, review queue.
> FRD §5.6, Features F-16, F-20, §13. User Flows UF-14, UF-15.

---

#### API-0601: Get Coverage Dashboard

| Field | Value |
|---|---|
| **API ID** | API-0601 |
| **API Name** | Get Coverage Dashboard |
| **Business Purpose** | Provide the matrix view of translation readiness across all pages and languages |
| **FRD Feature** | F-16 (Coverage Dashboard), §13.1 |
| **User Flow(s)** | UF-14 (Monitor Translation Coverage and Readiness) |
| **Primary Actor** | Founder, PM, Localization Reviewer |
| **Operation** | Returns a matrix: pages (rows) x languages (columns). Each cell shows coverage percentage and environment status. Summary row per language, summary column per page. Coverage = (tags approved and deployed to Production) / (total active tags) x 100. Stale translations counted as "approved but needs attention." Pages with zero active tags excluded. |
| **Ownership** | MioTranslate-owned |
| **Entity/Resource** | Coverage (computed/aggregate) |
| **Scope** | All pages, all languages |
| **Success Outcome** | Coverage matrix returned with drill-down capability. |
| **Failure/Edge Cases** | No pages → empty dashboard. |
| **Dependencies** | API-0503 (coverage must be up to date) |

---

#### API-0602: Get Language Readiness

| Field | Value |
|---|---|
| **API ID** | API-0602 |
| **API Name** | Get Language Readiness |
| **Business Purpose** | For a selected language, show all pages ranked by coverage |
| **FRD Feature** | F-16, §13.2 (Translation Readiness Report) |
| **User Flow(s)** | UF-14 |
| **Primary Actor** | PM, Founder, Localization Reviewer |
| **Operation** | Returns all pages ranked by translation coverage for the selected language. Shows: page name, coverage %, tags needing translation, tags in Draft, tags Stale. Enables prioritization of translation work. |
| **Ownership** | MioTranslate-owned |
| **Entity/Resource** | Coverage (per page for one language) |
| **Scope** | All pages, single language |
| **Success Outcome** | Ranked page list with per-page translation metrics returned. |
| **Failure/Edge Cases** | Language not configured → 404. |
| **Dependencies** | API-0503 |

---

#### API-0603: Get Stale Translations Report

| Field | Value |
|---|---|
| **API ID** | API-0603 |
| **API Name** | Get Stale Translations Report |
| **Business Purpose** | List all stale translations for prioritization and resolution |
| **FRD Feature** | §13.4 (Stale Translations Report), F-10 |
| **User Flow(s)** | UF-08, UF-14 |
| **Primary Actor** | Localization Reviewer, PM |
| **Operation** | Returns all translations in Stale state, grouped by language and page, sorted by age (oldest first). Shows: tag ID, page name, language, stale since date, previous English version, new English version. |
| **Ownership** | MioTranslate-owned |
| **Entity/Resource** | Translation (filtered) |
| **Scope** | All stale translations |
| **Success Outcome** | Stale translations list returned, prioritized by age. |
| **Failure/Edge Cases** | No stale translations → empty list. |
| **Dependencies** | None |

---

#### API-0604: Get Pending Work Summary

| Field | Value |
|---|---|
| **API ID** | API-0604 |
| **API Name** | Get Pending Work Summary |
| **Business Purpose** | Show how many items are waiting for action across the system |
| **FRD Feature** | §13.3 (Pending Work Report), §5.6 |
| **User Flow(s)** | UF-14 |
| **Primary Actor** | PM, Founder |
| **Operation** | Returns aggregated counts: tags needing English copy, tags needing translation (per language), items pending review (English + translations), stale translations (per language), items pending publishing approval. |
| **Ownership** | MioTranslate-owned |
| **Entity/Resource** | Aggregate counts (computed) |
| **Scope** | System-wide |
| **Success Outcome** | Work summary with actionable counts returned. |
| **Failure/Edge Cases** | None. |
| **Dependencies** | None |

---

#### API-0605: Get Activity Timeline

| Field | Value |
|---|---|
| **API ID** | API-0605 |
| **API Name** | Get Activity Timeline |
| **Business Purpose** | Show recent actions across the system for awareness and coordination |
| **FRD Feature** | F-20 (Activity Timeline), §9.6, §13.7 |
| **User Flow(s)** | UF-14, UF-15 |
| **Primary Actor** | All roles |
| **Operation** | Returns chronological list of recent actions: creations, edits, approvals, promotions, rollbacks. Filterable by user, page, language, action type. Shows 50 most recent by default. Supports date range filtering. |
| **Ownership** | MioTranslate-owned |
| **Entity/Resource** | Audit Record (formatted for display) |
| **Scope** | System-wide (filterable) |
| **Success Outcome** | Recent activity feed returned. |
| **Failure/Edge Cases** | No activity → empty timeline. |
| **Dependencies** | API-0505 (reads audit records) |

---

#### API-0606: Get Review Queue

| Field | Value |
|---|---|
| **API ID** | API-0606 |
| **API Name** | Get Review Queue |
| **Business Purpose** | Show all items pending review for the current user's role |
| **FRD Feature** | §5.4 (Review & Approval), §13.5 (Approval Queue Report) |
| **User Flow(s)** | UF-03, UF-06, UF-09, UF-10 |
| **Primary Actor** | Support Reviewer (English), Localization Reviewer (Translations), Founder (Escalated) |
| **Operation** | Returns items pending review, filterable by type (English copy / Translation / Publishing), language, page, priority. Items sorted by submission date. Count of pending items visible. Escalated items show escalator and reason. |
| **Ownership** | MioTranslate-owned |
| **Entity/Resource** | English Copy (Pending Review), Translation (Pending Review), Publishing Requests |
| **Scope** | Per reviewer role |
| **Success Outcome** | Filterable review queue returned. |
| **Failure/Edge Cases** | No pending items → empty queue. |
| **Dependencies** | None |

---

#### API-0607: Get Environment Status Matrix

| Field | Value |
|---|---|
| **API ID** | API-0607 |
| **API Name** | Get Environment Status Matrix |
| **Business Purpose** | Show the deployment status across all pages, languages, and environments in a single view |
| **FRD Feature** | §5.5, IA C7 (Deployment Overview) |
| **User Flow(s)** | UF-10, UF-14 |
| **Primary Actor** | PM, Support Reviewer, Founder |
| **Operation** | Returns a matrix of pages x languages x environments showing current published version, publishing date, and whether content is up to date or behind. Filterable by module (where set) and sortable by deployment date. |
| **Ownership** | MioTranslate-owned |
| **Entity/Resource** | Release (aggregate) |
| **Scope** | All pages, all languages, all environments |
| **Success Outcome** | Environment status matrix returned. |
| **Failure/Edge Cases** | Large number of pages → pagination/filtering essential. |
| **Dependencies** | None |

---

### Domain 7: Search & Navigation

> Global search, filtering, bookmarks, and recently edited.
> FRD Features F-14, F-15, §9.1, §9.2, §9.7, §9.8. User Flow UF-13.

---

#### API-0701: Global Search

| Field | Value |
|---|---|
| **API ID** | API-0701 |
| **API Name** | Global Search |
| **Business Purpose** | Find any label in MioTranslate by English text, tag ID, or page name |
| **FRD Feature** | F-14 (Search), §9.1 |
| **User Flow(s)** | UF-13 (Find and Inspect UX Copy) |
| **Primary Actor** | All roles |
| **Operation** | Accepts a search query. Matches against: tag ID, English copy text (approved and fallback), page name, page ID. Returns matching tags (Tag ID, Page Name, English copy snippet, status) and matching pages (Page Name, Page ID, Module where set, tag count). Case-insensitive. Results sortable by page, status, relevance. Results link to Tag Detail or Page Detail. |
| **Ownership** | MioTranslate-owned |
| **Entity/Resource** | Tag, Page, English Copy |
| **Scope** | All pages and tags |
| **Success Outcome** | Relevant search results returned, grouped by type. |
| **Failure/Edge Cases** | Zero results → "No results found." Hundreds of results → paginated. |
| **Dependencies** | None |

---

#### API-0702: Save Bookmark

| Field | Value |
|---|---|
| **API ID** | API-0702 |
| **API Name** | Save Bookmark |
| **Business Purpose** | Allow a user to bookmark pages or tags for quick access |
| **FRD Feature** | §9.7 (Bookmarks) |
| **User Flow(s)** | UF-13 |
| **Primary Actor** | All roles |
| **Operation** | Creates a personal bookmark for a page or tag. Bookmarks are per-user. |
| **Ownership** | MioTranslate-owned |
| **Entity/Resource** | Bookmark (user-specific) |
| **Scope** | Single page or tag |
| **Success Outcome** | Bookmark saved. |
| **Failure/Edge Cases** | Already bookmarked → toggle (remove). |
| **Dependencies** | None |

---

#### API-0703: Get Bookmarks

| Field | Value |
|---|---|
| **API ID** | API-0703 |
| **API Name** | Get Bookmarks |
| **Business Purpose** | Retrieve the current user's bookmarked pages and tags |
| **FRD Feature** | §9.7 |
| **User Flow(s)** | UF-13 |
| **Primary Actor** | All roles |
| **Operation** | Returns the user's bookmarked pages and tags with current status information. |
| **Ownership** | MioTranslate-owned |
| **Entity/Resource** | Bookmark (user-specific) |
| **Scope** | Per user |
| **Success Outcome** | List of bookmarks returned. |
| **Failure/Edge Cases** | No bookmarks → empty list. |
| **Dependencies** | None |

---

#### API-0704: Remove Bookmark

| Field | Value |
|---|---|
| **API ID** | API-0704 |
| **API Name** | Remove Bookmark |
| **Business Purpose** | Remove a previously saved bookmark |
| **FRD Feature** | §9.7 |
| **User Flow(s)** | UF-13 |
| **Primary Actor** | All roles |
| **Operation** | Deletes a personal bookmark. |
| **Ownership** | MioTranslate-owned |
| **Entity/Resource** | Bookmark |
| **Scope** | Single bookmark |
| **Success Outcome** | Bookmark removed. |
| **Failure/Edge Cases** | Bookmark not found → no-op. |
| **Dependencies** | None |

---

#### API-0705: Get Recently Edited

| Field | Value |
|---|---|
| **API ID** | API-0705 |
| **API Name** | Get Recently Edited |
| **Business Purpose** | Show the user's recently viewed and edited tags |
| **FRD Feature** | §9.8 (Recently Edited) |
| **User Flow(s)** | UF-13 |
| **Primary Actor** | All roles |
| **Operation** | Returns the current user's recently viewed and edited tags, ordered by recency. Personal view. |
| **Ownership** | MioTranslate-owned |
| **Entity/Resource** | User activity tracking |
| **Scope** | Per user |
| **Success Outcome** | Recent items list returned. |
| **Failure/Edge Cases** | No recent activity → empty list. |
| **Dependencies** | None |

---

### Domain 8: Administration

> User role management, language management, system configuration.
> FRD §5.7. User Flows UF-17, UF-18.

---

#### API-0801: List Users and Roles

| Field | Value |
|---|---|
| **API ID** | API-0801 |
| **API Name** | List Users and Roles |
| **Business Purpose** | Show all users and their assigned roles |
| **FRD Feature** | §5.7 (Administration) |
| **User Flow(s)** | UF-18 (Manage User Roles and System Configuration) |
| **Primary Actor** | Administrator, Founder |
| **Operation** | Returns list of all users with their roles, assignment dates, and current status. |
| **Ownership** | MioTranslate-owned |
| **Entity/Resource** | User, Role |
| **Scope** | All users |
| **Success Outcome** | User list with roles returned. |
| **Failure/Edge Cases** | None. |
| **Dependencies** | None |

---

#### API-0802: Add Language

| Field | Value |
|---|---|
| **API ID** | API-0802 |
| **API Name** | Add Language |
| **Business Purpose** | Add a new supported language to MioTranslate |
| **FRD Feature** | §5.7 |
| **User Flow(s)** | UF-17 (Add a New Language) |
| **Primary Actor** | Administrator, Founder |
| **Operation** | Creates a new language record with: language code, language name, direction (LTR/RTL), status (Active). Triggers API-0506 (Create Empty Translation Slots) to create "No Translation" entries for all active tags. Audit record created. |
| **Ownership** | MioTranslate-owned |
| **Entity/Resource** | Language |
| **Scope** | System-wide |
| **Success Outcome** | Language added. Empty translation slots created for all active tags. Audit recorded. |
| **Failure/Edge Cases** | Language code already exists → validation error. |
| **Dependencies** | Triggers API-0506 |

---

#### API-0803: Deactivate Language

| Field | Value |
|---|---|
| **API ID** | API-0803 |
| **API Name** | Deactivate Language |
| **Business Purpose** | Deactivate a language — no new translations or publishing, but existing data preserved |
| **FRD Feature** | §5.7, Business Rule 24 |
| **User Flow(s)** | UF-17 |
| **Primary Actor** | Administrator, Founder |
| **Operation** | Sets language status to Inactive. All existing translations and history are preserved. No new translations or promotions occur for this language. Audit record created. |
| **Ownership** | MioTranslate-owned |
| **Entity/Resource** | Language |
| **Scope** | Single language |
| **Success Outcome** | Language deactivated. Existing data preserved. |
| **Failure/Edge Cases** | Language has content deployed to Production → advisory warning but deactivation proceeds. |
| **Dependencies** | None |

---

#### API-0804: Assign or Update User Role

| Field | Value |
|---|---|
| **API ID** | API-0804 |
| **API Name** | Assign or Update User Role |
| **Business Purpose** | Assign or modify user roles (PM, QA, LR, SR, Founder, Developer, Administrator) |
| **FRD Feature** | §5.7, FRD §8 (Permissions & Access Control) |
| **User Flow(s)** | UF-18 |
| **Primary Actor** | Administrator, Founder |
| **Operation** | Assigns one or more roles to a user. A user can hold multiple roles. Permissions are immediately enforced. Audit record created. |
| **Ownership** | MioTranslate-owned |
| **Entity/Resource** | User, Role |
| **Scope** | Single user |
| **Success Outcome** | Role assigned. Permissions effective immediately. Audit recorded. |
| **Failure/Edge Cases** | User not found → 404. Actor lacks admin/founder permission → authorization error. |
| **Dependencies** | None |

---

#### API-0805: Get System Configuration

| Field | Value |
|---|---|
| **API ID** | API-0805 |
| **API Name** | Get System Configuration |
| **Business Purpose** | Retrieve current system configuration settings |
| **FRD Feature** | §5.7 |
| **User Flow(s)** | UF-18 |
| **Primary Actor** | Administrator, Founder |
| **Operation** | Returns current configuration values: confidence threshold for bulk approval, environment endpoints, domain configuration, other system parameters. |
| **Ownership** | MioTranslate-owned |
| **Entity/Resource** | System Configuration |
| **Scope** | System-wide |
| **Success Outcome** | Configuration returned. |
| **Failure/Edge Cases** | None. |
| **Dependencies** | None |

---

#### API-0806: Update System Configuration

| Field | Value |
|---|---|
| **API ID** | API-0806 |
| **API Name** | Update System Configuration |
| **Business Purpose** | Modify system configuration settings |
| **FRD Feature** | §5.7, F-09 ("configurable confidence threshold") |
| **User Flow(s)** | UF-18 |
| **Primary Actor** | Administrator, Founder |
| **Operation** | Updates configuration values. Examples: confidence threshold for bulk approval (default 95%), environment endpoint URLs, domain. Audit record created with before and after values. |
| **Ownership** | MioTranslate-owned |
| **Entity/Resource** | System Configuration |
| **Scope** | System-wide |
| **Success Outcome** | Configuration updated. Audit recorded. |
| **Failure/Edge Cases** | Invalid value → validation error. |
| **Dependencies** | None |

---

#### API-0807: List Languages

| Field | Value |
|---|---|
| **API ID** | API-0807 |
| **API Name** | List Languages |
| **Business Purpose** | Retrieve all configured languages with their status |
| **FRD Feature** | §5.7 |
| **User Flow(s)** | UF-17, UF-14 (language selector across the product) |
| **Primary Actor** | All roles |
| **Operation** | Returns all languages with: code, name, direction, status (Active/Inactive), date added, coverage summary. |
| **Ownership** | MioTranslate-owned |
| **Entity/Resource** | Language |
| **Scope** | All languages |
| **Success Outcome** | Language list returned. |
| **Failure/Edge Cases** | None. |
| **Dependencies** | None |

---

### Domain 9: Comments, Audit, & Export

> Collaboration, traceability, and data export.
> FRD Features F-17, F-18, F-19. User Flows UF-15, UF-19.

---

#### API-0901: Add Comment

| Field | Value |
|---|---|
| **API ID** | API-0901 |
| **API Name** | Add Comment |
| **Business Purpose** | Enable team discussion on specific tags, English copy, or translations |
| **FRD Feature** | F-18 (Comments), §9.5 |
| **User Flow(s)** | UF-03, UF-06, UF-09 (comments are cross-cutting) |
| **Primary Actor** | All roles (including Developer — view access or above) |
| **Operation** | Creates a comment attached to a tag, scoped to English copy or a specific language. Comment includes author, text, date. Comments are visible to all users. |
| **Ownership** | MioTranslate-owned |
| **Entity/Resource** | Comment |
| **Scope** | Single tag (scoped to English or a language) |
| **Success Outcome** | Comment created. Visible in tag detail and activity timeline. |
| **Failure/Edge Cases** | Empty comment text → validation error. |
| **Dependencies** | None |

---

#### API-0902: Get Comments

| Field | Value |
|---|---|
| **API ID** | API-0902 |
| **API Name** | Get Comments |
| **Business Purpose** | Retrieve all comments for a tag (optionally scoped to English or a language) |
| **FRD Feature** | F-18 |
| **User Flow(s)** | UF-13, UF-15 |
| **Primary Actor** | All roles |
| **Operation** | Returns all comments for a tag, optionally filtered by scope (English or language). Shows author, text, date, resolved status. |
| **Ownership** | MioTranslate-owned |
| **Entity/Resource** | Comment |
| **Scope** | Single tag |
| **Success Outcome** | Comments list returned. |
| **Failure/Edge Cases** | No comments → empty list. |
| **Dependencies** | None |

---

#### API-0903: Resolve Comment

| Field | Value |
|---|---|
| **API ID** | API-0903 |
| **API Name** | Resolve Comment |
| **Business Purpose** | Mark a comment as resolved |
| **FRD Feature** | F-18 ("Comments can be marked as resolved but not deleted") |
| **User Flow(s)** | UF-03, UF-06 |
| **Primary Actor** | All roles |
| **Operation** | Sets the resolved flag on a comment. Comment is not deleted. |
| **Ownership** | MioTranslate-owned |
| **Entity/Resource** | Comment |
| **Scope** | Single comment |
| **Success Outcome** | Comment marked resolved. |
| **Failure/Edge Cases** | Already resolved → no-op. |
| **Dependencies** | None |

---

#### API-0904: Get Audit Trail

| Field | Value |
|---|---|
| **API ID** | API-0904 |
| **API Name** | Get Audit Trail |
| **Business Purpose** | Search and retrieve audit records for investigation and accountability |
| **FRD Feature** | F-17 (Audit Trail), §13.7 (Activity Report) |
| **User Flow(s)** | UF-15 (Investigate a Label Issue Using History and Audit Trail) |
| **Primary Actor** | All roles |
| **Operation** | Returns audit records matching search criteria. Searchable by: user, date range, action type, page, tag, language. Each record shows: action, subject, performed by, timestamp, details, before value, after value. Audit records are immutable and permanent. |
| **Ownership** | MioTranslate-owned |
| **Entity/Resource** | Audit Record |
| **Scope** | System-wide (filterable) |
| **Success Outcome** | Matching audit records returned. |
| **Failure/Edge Cases** | No matching records → empty result. |
| **Dependencies** | API-0505 (reads records created by this API) |

---

#### API-0905: Export Tag Data

| Field | Value |
|---|---|
| **API ID** | API-0905 |
| **API Name** | Export Tag Data |
| **Business Purpose** | Export tag data for a page and language for external review or reporting |
| **FRD Feature** | F-19 (Export), §9.9 |
| **User Flow(s)** | UF-19 (Export Tag Data for External Review) |
| **Primary Actor** | PM, Localization Reviewer, Administrator |
| **Operation** | Generates an export file (CSV or Excel) for a selected page and language. Contains: tag ID, English copy, translation, status, confidence score. Exported data reflects current state at time of export. Read-only snapshot — cannot be re-imported. |
| **Ownership** | MioTranslate-owned |
| **Entity/Resource** | Tag, English Copy, Translation |
| **Scope** | Single page, single language |
| **Success Outcome** | Export file generated and available for download. |
| **Failure/Edge Cases** | No tags on page → empty export. |
| **Dependencies** | None |
| **Sub-Endpoints** | This API includes two public sub-endpoints that are part of its approved contract: `GET /v1/exports/{exportId}` — check export generation status (§3.5.4 of Group 9 API Design); `GET /v1/exports/{exportId}/download` — download the generated export file (§3.5.5 of Group 9 API Design). Both carry the same authorization restriction as the POST (DEV role excluded: PM, LR, SR, FN, ADMIN). These are not separate Domain 9 API List entries. |

---

#### API-0906: Get Notifications

| Field | Value |
|---|---|
| **API ID** | API-0906 |
| **API Name** | Get Notifications |
| **Business Purpose** | Retrieve notifications for the current user |
| **FRD Feature** | FRD §12 (Notifications & Alerts) |
| **User Flow(s)** | All flows (cross-cutting) |
| **Primary Actor** | All roles |
| **Operation** | Returns pending and recent notifications for the current user, ordered by recency. Supports marking as read. |
| **Ownership** | MioTranslate-owned |
| **Entity/Resource** | Notification |
| **Scope** | Per user |
| **Success Outcome** | Notification list returned. |
| **Failure/Edge Cases** | No notifications → empty list. |
| **Dependencies** | API-0504 (reads notifications created by the dispatch system) |

---

#### API-0907: Mark Notification as Read

| Field | Value |
|---|---|
| **API ID** | API-0907 |
| **API Name** | Mark Notification as Read |
| **Business Purpose** | Allow user to dismiss or acknowledge a notification |
| **FRD Feature** | FRD §12 (implied — notifications require a read/dismiss mechanism) |
| **User Flow(s)** | All flows |
| **Primary Actor** | All roles |
| **Operation** | Marks one or more notifications as read. |
| **Ownership** | MioTranslate-owned |
| **Entity/Resource** | Notification |
| **Scope** | Single or batch notifications |
| **Success Outcome** | Notification(s) marked as read. |
| **Failure/Edge Cases** | None. |
| **Dependencies** | None |

---

### Domain 10: Migration

> One-time initial data import.
> FRD Feature F-21. User Flow UF-02.

---

#### API-1001: Upload Import File

| Field | Value |
|---|---|
| **API ID** | API-1001 |
| **API Name** | Upload Import File |
| **Business Purpose** | Upload the exported data file from the current system for migration |
| **FRD Feature** | F-21 (Initial Migration) |
| **User Flow(s)** | UF-02 (Initial One-Time Migration) |
| **Primary Actor** | Founder, Administrator |
| **Operation** | Accepts a data file (format TBD — CSV, Excel, JSON) containing the exported pages, tags, English copy, and per-language translation values from the current system. Validates file format and structure. Stores for processing. |
| **Ownership** | MioTranslate-owned |
| **Entity/Resource** | Import Event |
| **Scope** | System-wide (one-time) |
| **Success Outcome** | File uploaded and validated for structure. Import Event created. |
| **Failure/Edge Cases** | Invalid file format → validation error. File too large → size limit error. |
| **Dependencies** | None |

---

#### API-1002: Execute Migration Import

| Field | Value |
|---|---|
| **API ID** | API-1002 |
| **API Name** | Execute Migration Import |
| **Business Purpose** | Process the uploaded file and populate MioTranslate with existing UX copy and translations |
| **FRD Feature** | F-21 |
| **User Flow(s)** | UF-02 |
| **Primary Actor** | Founder (`FN`), Administrator (`ADMIN`) |
| **Operation** | Processes the uploaded file: creates pages, creates tags, creates English copy records, creates translation records. All imported content enters as "Published in Production" (it is already live). Module and Copy Type are not populated during migration (not present in imported data). Import Event record updated with counts and status. Audit record created. |
| **Ownership** | MioTranslate-owned |
| **Entity/Resource** | Page, Tag, English Copy, Translation, Import Event |
| **Scope** | System-wide (one-time) |
| **Success Outcome** | All pages, tags, English copy, and translations from the file are registered in MioTranslate. Import Event → Completed. |
| **Failure/Edge Cases** | Duplicate Page/Tag IDs → validation report generated. Partial failure → rollback to pre-migration state possible (F-21 acceptance criteria). Data corruption → Import Event → Failed. |
| **Dependencies** | API-1001 (file must be uploaded) |
| **Sub-Endpoints** | This API includes one public sub-endpoint that is part of its approved contract: `GET /v1/migrations/{migrationId}` — poll for migration execution status (§3.2.4 of Group 10 API Design). This sub-endpoint carries the same authorization restriction as the POST (`FN`, `ADMIN` only). It is not a separate Domain 10 API List entry. |

---

#### API-1003: Get Migration Validation Report

| Field | Value |
|---|---|
| **API ID** | API-1003 |
| **API Name** | Get Migration Validation Report |
| **Business Purpose** | Generate a report comparing MioTranslate's registry against the imported data |
| **FRD Feature** | F-21 ("After import, a validation report is generated") |
| **User Flow(s)** | UF-02 |
| **Primary Actor** | Founder, Administrator |
| **Operation** | Compares MioTranslate's post-import state against the source data. Reports: pages imported, tags imported, translations imported, any discrepancies (missing items, duplicate IDs, data mismatches). Zero discrepancies = successful migration. |
| **Ownership** | MioTranslate-owned |
| **Entity/Resource** | Import Event, validation results |
| **Scope** | System-wide |
| **Success Outcome** | Validation report generated showing zero discrepancies. |
| **Failure/Edge Cases** | Discrepancies found → report highlights them for investigation. |
| **Dependencies** | API-1002 (import must be completed) |

---

## 3. User Flow / FRD → API Traceability Matrix

### 3.1 User Flow → API Mapping

| User Flow | APIs Required |
|---|---|
| **UF-01** Register Page & Tags | API-0101, API-0102, API-0106, API-0108, API-0505, API-0504 |
| **UF-02** Initial Migration | API-1001, API-1002, API-1003, API-0505 |
| **UF-03** Author & Approve English Copy | API-0201, API-0202, API-0203, API-0204, API-0105, API-0108, API-0901, API-0505, API-0504, API-0501, API-0502 |
| **UF-04** Translate Single Tag | API-0301, API-0309, API-0304, API-0308, API-0105, API-0505, API-0504 |
| **UF-05** Bulk Translate Page | API-0302, API-0309, API-0304, API-0305, API-0505, API-0504 |
| **UF-06** Review Translations | API-0304, API-0303, API-0308, API-0606, API-0505, API-0504 |
| **UF-07** Bulk Approve | API-0305, API-0606, API-0505, API-0504 |
| **UF-08** Resolve Stale | API-0306, API-0307, API-0603, API-0308, API-0505, API-0504 |
| **UF-09** Founder Escalation | API-0203 (escalation action), API-0606, API-0505, API-0504 |
| **UF-10** Publish | API-0401, API-0402, API-0403, API-0404, API-0405, API-0406, API-0502, API-0505, API-0504 |
| **UF-11** Rollback | API-0406, API-0407, API-0505, API-0504 |
| **UF-12** Correct Production Translation | API-0303, API-0304, API-0401, API-0403, API-0404, API-0405, API-0505, API-0504 |
| **UF-13** Find & Inspect | API-0701, API-0103, API-0104, API-0105, API-0702, API-0703, API-0704, API-0705, API-0902 |
| **UF-14** Monitor Coverage | API-0601, API-0602, API-0603, API-0604, API-0605, API-0607, API-0807 |
| **UF-15** Investigate History | API-0701, API-0105, API-0204, API-0308, API-0904, API-0406, API-0605, API-0902 |
| **UF-16** Deprecate Tag | API-0107, API-0505, API-0504 |
| **UF-17** Add Language | API-0802, API-0803, API-0807, API-0506, API-0505, API-0504 |
| **UF-18** System Configuration | API-0801, API-0804, API-0805, API-0806, API-0505 |
| **UF-19** Export | API-0905 |

### 3.2 FRD Feature → API Mapping

| FRD Feature | APIs Required |
|---|---|
| F-01 Page & Tag Browsing | API-0103, API-0104, API-0105 |
| F-02 Create Page & Tag | API-0101, API-0102, API-0106, API-0108 |
| F-04 Author English Copy | API-0201, API-0202, API-0108 |
| F-05 Edit English Copy | API-0201, API-0202, API-0501 |
| F-06 AI-Assisted Translation | API-0301 |
| F-07 Translate All (Bulk) | API-0302 |
| F-08 Review Translation | API-0304, API-0303, API-0309 |
| F-09 Bulk Approve | API-0305 |
| F-10 Resolve Stale | API-0306, API-0307 |
| F-11 Publish Page Bundle | API-0401, API-0402, API-0403, API-0404, API-0405 |
| F-12 Rollback | API-0406, API-0407 |
| F-13 View Version History | API-0204, API-0308 |
| F-14 Search | API-0701 |
| F-15 Filter by Translation State | Filtering is a query parameter on API-0103, API-0104 (not a separate API) |
| F-16 Coverage Dashboard | API-0601, API-0602, API-0503 |
| F-17 Audit Trail | API-0505 (write), API-0904 (read) |
| F-18 Comments | API-0901, API-0902, API-0903 |
| F-19 Export | API-0905 |
| F-20 Activity Timeline | API-0605 |
| F-21 Initial Migration | API-1001, API-1002, API-1003 |
| §9.4 Version Comparison | Supported by API-0204, API-0308 (comparison is a query mode) |
| §9.7 Bookmarks | API-0702, API-0703, API-0704 |
| §9.8 Recently Edited | API-0705 |
| §12 Notifications | API-0504 (dispatch), API-0906, API-0907 |

---

## 4. External API Dependencies

### 4.1 Confirmed External API

| External API | Status | Used By |
|---|---|---|
| **POST /multilingual/bulkImportPages** | Confirmed. Official API document available. | API-0405 (Execute Publishing), API-0407 (Execute Rollback), API-0502 (Implicit Dev Publishing) |

**Confirmed behaviours (AF — API Facts):**

| Fact | Description |
|---|---|
| AF-1 | Single page scope per request (one pageId) |
| AF-2 | Multi-language aggregation supported |
| AF-3 | Request payload: domain (required), pageId (required), pageName (optional), tags array |
| AF-4 | Tag object: tagName (required), values object mapping language codes to strings |
| AF-5 | Only domain, pageId, pageName, tagName, and language-value pairs in payload. No MioTranslate metadata. |
| AF-6 | Upsert semantics — supplied tags created/updated; unsupplied tags preserved |
| AF-7 | Sparse/asymmetric translations supported (different language sets per tag) |
| AF-8 | Invalid domain → entire request rejected (global error) |
| AF-9 | Invalid language code → that language fails, valid languages succeed (partial execution) |
| AF-10 | Response includes per-language status with processed/failed counts and details array |

### 4.2 External AI Translation Service

| External API | Status | Used By |
|---|---|---|
| **AI Translation Service** | Required but not yet specified. | API-0301, API-0302, API-0307 |

The AI Translation Service must support:
- Receiving source text (English) with business context (page, module, copy type, industry terminology)
- Returning: translated text, back-translation, confidence score
- Variable/placeholder integrity verification
- Multiple language targets

> [!NOTE]
> The AI Translation Service API specification is a prerequisite for the API Design phase of APIs 0301, 0302, and 0307.

### 4.3 Required External Capabilities (Not Currently Available)

| ID | Capability Needed | Why | Status |
|---|---|---|---|
| **ED-1** | **Tag deprecation/removal in Language Services** | When a tag is deprecated in MioTranslate and excluded from future publishing bundles, the tag continues to exist in Language Services due to the upsert model's preservation of unsupplied tags. There is currently no API to remove individual tags from a page in Language Services. | **Not available — requires engineering request** |
| **ED-2** | **Rollback tag removal** | When rolling back to a previous version, tags that were added between the rollback target and the current version are preserved in Language Services (consequence of AF-6). MioTranslate cannot remove them via the current API. This is a consequence of ED-1. | **Blocked by ED-1** |
| **ED-3** | **Value-level language preservation** | MioTranslate's per-language publishing model (PD-2) assumes that sending a tag with values for only one language preserves the tag's existing values for other languages. The API document confirms tag-level upsert and unsupplied-tag preservation, but does not explicitly confirm value-level language preservation within a supplied tag. | **Requires engineering confirmation** |

---

## 5. Missing / Unresolved API Capabilities

### 5.1 Identified Gaps

| # | Gap | Impact | Recommendation |
|---|---|---|---|
| 1 | **Tag removal from Language Services (ED-1)** | Deprecated tags remain in Language Services indefinitely. Not user-visible (developer removes code reference), but accumulates technical debt. | Request engineering to build a tag-removal API or confirm an alternative mechanism. |
| 2 | **Value-level language preservation (ED-3)** | If not confirmed, the per-language publishing model breaks — publishing Arabic could overwrite English values within the same tag. | **Must be confirmed before API Design proceeds.** |
| 3 | **AI Translation Service API specification** | APIs 0301, 0302, 0307 depend on the AI service's interface. | Obtain or define the AI service contract as part of API Design. |
| 4 | **Authentication / Authorization mechanism** | Every API requires permission enforcement (FRD §8), but the auth mechanism is not specified. | Define auth mechanism in API Design phase. |
| 5 | **Concurrency control** | FRD §F-04 mentions concurrent edit conflict for English copy. The strategy (optimistic locking, last-write-wins, etc.) is not specified. | Define concurrency strategy in API Design phase. |
| 6 | **Webhook or event system for implicit Dev publishing** | API-0502 needs a reliable event-driven trigger mechanism when content is approved. | Architectural decision for API Design phase. |

### 5.2 Use Cases That Work Without a Dedicated API

| Use Case | How It Works |
|---|---|
| **F-15: Filter by Translation State** | Filtering is a query parameter on API-0103 (List Pages) and API-0104 (Get Page Detail), not a separate API. |
| **§9.4: Version Comparison** | Comparing two versions is a query mode on API-0204 (English Version History) and API-0308 (Translation Version History), not a separate API. |
| **WF-10: Investigate a Wrong Label** | This workflow uses API-0701 (search), API-0105 (tag detail), API-0308 (translation history), and API-0904 (audit trail). No dedicated investigation API needed. |
| **UF-14: Page Readiness** | Supported by API-0601 (Coverage Dashboard) with a page-level view. No separate API needed. |

### 5.3 APIs That Could Potentially Be Consolidated

| Candidates | Rationale | Recommendation |
|---|---|---|
| API-0201 (Save Draft) and API-0202 (Submit for Review) | Could be a single "save" API with a `submitForReview` flag. | **Keep separate.** They represent distinct user intents with different state transitions and notifications. |
| API-0702 (Save Bookmark) and API-0704 (Remove Bookmark) | Could be a toggle API. | **Decision for API Design phase.** |
| API-0306 (Confirm Stale) and API-0307 (Retranslate Stale) | Could be a single "resolve stale" API with an action parameter. | **Acceptable to consolidate in API Design if the actions are mutually exclusive.** |

---

## 6. Completeness Assessment

### 6.1 Coverage by Domain

| Domain | API Count | Coverage Assessment |
|---|---|---|
| Pages & Tags | 8 | Complete. Create, read, update, deprecate. All F-01, F-02, UF-01, UF-13, UF-16 supported. |
| English Copy | 4 | Complete. Author, submit, review, history. All F-04, F-05, UF-03 supported. |
| Translation | 9 | Complete. AI single, AI bulk, manual edit, review (4 actions), bulk approve, confirm stale, retranslate stale, submit, history. All F-06 through F-10, UF-04 through UF-08 supported. |
| Publishing & Deployment | 7 | Complete. Environment status, pre-publish summary, request/approve publishing, execute, history, rollback. All F-11, F-12, UF-10, UF-11 supported. |
| System-Triggered | 6 | Complete. Stale flagging, implicit Dev publish, coverage recalculation, notification dispatch, audit recording, empty translation slot creation. |
| Visibility & Reporting | 7 | Complete. Coverage dashboard, language readiness, stale report, pending work, activity timeline, review queue, environment matrix. All F-16, F-20, §13, UF-14 supported. |
| Search & Navigation | 5 | Complete. Search, bookmarks (save/get/remove), recently edited. All F-14, §9.7, §9.8 supported. |
| Administration | 7 | Complete. Users, roles, languages (add/deactivate/list), config (get/update). All UF-17, UF-18 supported. |
| Comments, Audit, Export | 7 | Complete. Comments (add/get/resolve), audit trail, export, notifications (get/read). All F-17, F-18, F-19, UF-15, UF-19 supported. |
| Migration | 3 | Complete. Upload, execute, validate. F-21, UF-02 supported. |

### 6.2 Final Self-Challenge

> *"Can MioTranslate actually perform every approved user flow and every important system action with the APIs listed here?"*

| Check | Result |
|---|---|
| Can a PM register a page, create tags, author English, get it approved, trigger AI translation, have it reviewed, and publish to Production? | Yes — APIs 0101 → 0102 → 0201 → 0202 → 0203 → 0301 → 0304 → 0403 → 0404 → 0405 |
| Can a new language be added and systematically translated? | Yes — APIs 0802 → 0506 → 0302 → 0305 → 0403 → 0404 → 0405 |
| Can a stale translation be detected, investigated, and resolved? | Yes — APIs 0501 (auto) → 0603 → 0306 or 0307 → 0304 |
| Can a production issue be reported, investigated, rolled back, and corrected? | Yes — APIs 0701 → 0105 → 0308 → 0904 → 0407 → 0303 → 0304 → 0403 → 0404 → 0405 |
| Can the Founder review escalated copy? | Yes — APIs 0203 (escalation) → 0606 → 0203 (Founder review action) |
| Can coverage be monitored across all languages? | Yes — APIs 0601, 0602, 0604, 0607 |
| Can every action be audited and traced? | Yes — API-0505 (cross-cutting write) + API-0904 (query) |
| Does the migration flow work without treating bulkImportPages as a read/extraction API? | Yes — APIs 1001, 1002, 1003 use file upload; bulkImportPages is only the post-migration write mechanism |
| Are the three engineering dependencies (ED-1, ED-2, ED-3) properly documented without inventing solutions? | Yes — documented in §4.3, not represented as available APIs |

### 6.3 API Summary

| Metric | Count |
|---|---|
| Total MioTranslate-owned APIs | **63** |
| System-triggered behaviours (internal APIs) | **6** |
| External API dependencies | **2** (Language Services bulkImportPages + AI Translation Service) |
| Required external capabilities not yet available | **3** (ED-1, ED-2, ED-3) |
| Unresolved items for API Design phase | **6** (see §5.1) |

---

*This API List is the complete inventory. It is ready to serve as the input to the API Design document, where request/response schemas, HTTP conventions, error handling patterns, authentication, and architectural decisions will be defined.*

*End of MioTranslate API List.*
