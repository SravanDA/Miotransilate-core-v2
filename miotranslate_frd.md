# MioTranslate
## Functional Requirements Document

---

**Product:** MioTranslate  
**Document Type:** Functional Requirements Document (FRD)  
**Source Document:** MioTranslate Business Requirement Document (Approved)  
**Audience:** Product, Engineering, QA, Design  
**Date:** August 2026  

---

## 1. Product Overview

### 1.1 Purpose

MioTranslate is an internal platform that centralizes the management of all UX copy in MioSalon, across every page, every tag, and every language. It replaces the current manual, developer-dependent, untracked process with a governed, transparent, and auditable system.

### 1.2 Product Vision

Product, QA, and localization teams manage every label in MioSalon independently. English copy is authored, reviewed, and approved by the people who own product quality. Translations are created with business context, verified by humans with AI assistance, and published through a tracked pipeline. Every change is recorded. The state of the product's UX copy is visible at any time.

### 1.3 Product Boundaries

**What MioTranslate owns:**

- Creation and management of all pages and tags (MioTranslate is the only entry point for managed UX copy)
- All English UX copy for MioSalon (authoring, editing, versioning)
- All translations across all currently supported languages and any languages added in the future (the system is designed to scale as new languages are introduced)
- Review and approval workflows for copy and translations
- The publishing pipeline from authoring to any target environment: Dev, QA, or Production
- Version history and audit trail for every label
- Translation coverage and readiness visibility
- Pushing approved content to the Language Services API for each target environment

**What MioTranslate does not own:**

- The MioSalon codebase (developers reference tags created in MioTranslate within their code)
- The existing content delivery system that serves tags to MioSalon's UI (MioTranslate pushes approved content to it, but the delivery mechanism itself is outside MioTranslate's scope)
- MioSalon's rendering behaviour (how MioSalon displays tags to salon teams is unchanged)
- Content outside MioSalon's product UI (marketing copy, help articles, email templates, SMS/WhatsApp templates)
- Translation rules and terminology standards (a subsequent deliverable)

### 1.4 Primary Users

MioTranslate is used exclusively by MioSalon's internal teams. Salon teams (owners, staff, receptionists) are unaware of its existence.

### 1.5 Relationship to BRD

Every functional requirement in this document traces back to one or more of the following from the approved BRD:

| BRD Reference | Description |
|---|---|
| Problem 4.1 | Every copy change requires a developer |
| Problem 4.2 | The path to production is manual and untracked |
| Problem 4.3 | There is no ownership or accountability |
| Problem 4.4 | Translation status is invisible |
| Problem 4.5 | The workflow is unstructured |
| Objective 1 | Establish a single source of truth for UX copy |
| Objective 2 | Remove the engineering dependency |
| Objective 3 | Introduce governance before production |
| Objective 4 | Enable translation quality assurance |
| Objective 5 | Provide visibility into translation status |
| Objective 6 | Make language expansion plannable |
| Objective 7 | Create accountability through a complete audit trail |
| Capability 11.1 | English UX Copy Management |
| Capability 11.2 | Translation Management |
| Capability 11.3 | Review & Approval |
| Capability 11.4 | Publishing & Release Management |
| Capability 11.5 | Translation Visibility |
| Capability 11.6 | Version History & Audit Trail |
| Capability 11.7 | Page & Tag Creation (Single Entry Point) |

---

## 2. User Personas & Roles

### 2.1 Product Manager

**Responsibilities.** Authors and manages English UX copy. Ensures labels are clear, consistent, and appropriate for salon teams. Coordinates translation efforts.

**Goals.** Improve English copy quality independently. Iterate on labels without developer involvement. Maintain consistency across screens.

**Primary workflows.** Author English copy for new tags. Edit existing English copy. Submit copy for review. Monitor translation coverage. Prioritize translation work.

**Permissions.** Create and edit English copy. Create translations. Submit for review. View all pages, tags, and history. Comment. Assign work.

---

### 2.2 QA

**Responsibilities.** Validates UX copy in context. Identifies copy issues during testing. Authors or corrects English copy when needed.

**Goals.** Verify labels appear correctly on the right screen, in the right language, with the right formatting. Catch copy errors before production.

**Primary workflows.** Review copy in pre-production environments. Flag copy issues. Update English copy directly. Submit corrections for review.

**Permissions.** Same as Product Manager. Create and edit English copy. Create translations. Submit for review. View all pages, tags, and history. Comment.

---

### 2.3 Localization Reviewer

**Current state.** The organization does not currently have a dedicated Localization Reviewer. This role is performed by the Product Manager. As the number of languages and translation volume grows, a dedicated Localization Reviewer may be assigned. The system should support both scenarios: PM performing translation review, or a dedicated reviewer.

**Responsibilities.** Reviews AI-generated translations. Approves, corrects, or requests retranslation. Ensures translations are semantically accurate and contextually appropriate.

**Goals.** Ensure no translation reaches salon teams without human review. Maintain translation quality across all languages.

**Primary workflows.** Review pending translations. Compare translations against English source. Approve or correct. Resolve stale translations. Bulk-approve high-confidence translations.

**Permissions.** View all pages and tags. Edit translations. Approve translations. Request retranslation. Resolve stale flags. Bulk-approve.

---

### 2.4 Support Reviewer

**Responsibilities.** Approves UX copy for production promotion. Provides the final checkpoint before labels reach salon teams, because the support team gives product demos and has direct awareness of how labels appear in practice.

**Goals.** Ensure labels that reach production are correct and appropriate for salon teams. Maintain demo-ready quality.

**Primary workflows.** Review copy pending promotion to production. Approve or reject promotion. Review rollback requests.

**Permissions.** Approve promotion to Production. Reject promotion. Initiate rollback. View all pages, tags, and history. Comment.

---

### 2.5 Founder

**Responsibilities.** Final approval authority for sensitive or high-impact UX copy decisions. Reviews copy when escalated.

**Goals.** Ensure critical labels align with the product's direction. Provide final sign-off when required.

**Primary workflows.** Review escalated labels. Approve or request revision. Monitor overall translation readiness.

**Permissions.** All permissions. Approve any copy or translation. Approve promotion to any environment. Override decisions. Configure system settings.

---

### 2.6 Developer

**Responsibilities.** References tags created in MioTranslate within the MioSalon codebase. Writes the code that displays tags. Does not create, manage, or modify UX copy.

**Goals.** See the status of tags. Understand whether tags have been authored and translated. Know which tag IDs to reference in code.

**Primary workflows.** View pages and tags. Check tag status. Look up tag IDs for use in code.

**Permissions.** View-only. View all pages, tags, statuses, and history. Cannot author, edit, translate, approve, or publish.

---

### 2.7 Administrator

**Current state.** Administrative duties are currently handled by the Founder. There is no separate Administrator role in the organization today. As the team grows, the Founder may delegate administrative responsibilities to a dedicated person. The system should support both scenarios.

**Responsibilities.** Manages MioTranslate configuration. Assigns roles. Manages languages. Configures approval workflows.

**Goals.** Ensure the system is properly configured for the team's operational needs.

**Primary workflows.** Assign and modify user roles. Add or deactivate languages. Configure approval requirements. Manage system settings.

**Permissions.** All administrative permissions. Role management. Language configuration. System settings. Audit log access.

---

## 3. Product Information Architecture

MioTranslate is organized into seven primary areas.

### 3.1 Pages & Tags

The foundation of the product. Browse, search, and manage all pages and tags registered in MioTranslate. Every other area operates on the data in this area.

### 3.2 English Copy

Author, edit, review, and manage the official English UX copy for every tag. Track the developer's fallback text alongside the approved English copy.

### 3.3 Translations

Create, review, approve, and manage translations for every tag across every language. Filter by language, state (Draft, Approved, Stale), and page.

### 3.4 Review & Approval

Manage the review queue. See what is pending review, what has been approved, what has been rejected. Process approvals for English copy and translations.

### 3.5 Publishing

Manage the promotion pipeline from Dev through QA to Production. View what is deployed in each environment. Promote or rollback page bundles.

### 3.6 Visibility & Reporting

Coverage dashboards, stale translation tracking, activity timelines, audit history, and operational metrics.

### 3.7 Administration

Role management, language configuration, approval workflow settings, and system configuration.

---

## 4. Core Business Objects

### 4.1 Page

**Purpose.** Represents a screen or view in MioSalon. The top-level organizational unit in MioTranslate.

**Attributes.**

| Attribute | Description |
|---|---|
| Page ID | Unique identifier matching the MioSalon codebase (e.g., QUICK, INVOICE, CUSWISH) |
| Page Name | Human-readable name (e.g., Quick Sale, Invoice Management, Upcoming Wishes) |
| Module | The MioSalon module this page belongs to (POS, CRM, Calendar, Reporting, Settings, Staff). Optional. MioTranslate-internal metadata only — not present in the Language Services schema and not part of the Language Services data model. Set manually in MioTranslate when creating or editing a page. A page may exist without a Module value (especially migrated pages). |
| Tag Count | Total number of tags on this page |
| Status | Active or Deprecated |
| Created Date | When this page was first registered in MioTranslate |
| Created Date | When this page was first created in MioTranslate |

**Lifecycle.** A page is created by an authorized user in MioTranslate (or imported during the initial migration). It remains Active while in use. If all tags on a page are deprecated, the page is marked Deprecated. A deprecated page is not deleted; it remains for historical reference.

**Relationships.** A page contains one or more tags. A page has environment status per language. A page has version history per language.

---

### 4.2 Tag

**Purpose.** Represents a single piece of UX text within a page. The atomic unit of content in MioTranslate.

**Attributes.**

| Attribute | Description |
|---|---|
| Tag ID | Unique identifier following the naming convention (e.g., QUICK_1, QUICK_42, CUSWISH_FEMALE) |
| Page ID | The page this tag belongs to |
| Copy Type | The type of UX element (button, label, error message, header, placeholder, helper text, status badge, filter option, table header, validation message). Optional. MioTranslate-internal metadata only — not present in the Language Services schema and not part of the Language Services data model. Set manually by the author when creating or editing a tag. A tag may exist without a Copy Type value (especially migrated tags). Used for human understanding, filtering, review context, and AI translation context. |
| Status | Active or Deprecated |
| Created Date | When this tag was first created in MioTranslate |

**Lifecycle.** A tag is created by an authorized user in MioTranslate (or imported during the initial migration). The tag is a MioTranslate governance object. Tag content (the tag's approved English copy and translations) reaches Language Services only when approved content is published via the Language Services API. A tag can be marked Deprecated when it is no longer needed. Deprecated tags are excluded from active workflows but retained for historical reference.

**Relationships.** A tag belongs to exactly one page. A tag has one English copy record. A tag has zero or one translation per language.

---

### 4.3 English Copy

**Purpose.** The official English text for a tag. This is the source from which all translations are created.

**Attributes.**

| Attribute | Description |
|---|---|
| Tag ID | The tag this copy belongs to |
| Approved Text | The current approved English text |
| Version | The current version number |
| Status | Draft, Pending Review, Approved |
| Author | Who wrote this version |
| Author Date | When this version was written |
| Reviewer | Who reviewed this version |
| Review Date | When this version was reviewed |
| Approver | Who approved this version |
| Approval Date | When this version was approved |
| Change Reason | Optional note explaining why the text was changed |

**Lifecycle.**

1. **No Copy** : Tag exists but no English copy has been authored yet in MioTranslate.
2. **Draft** : English copy has been written but not yet submitted for review.
3. **Pending Review** : Submitted for review. Awaiting reviewer action.
4. **Approved** : Reviewed and approved. Eligible for publishing.

When approved English copy is edited, the new version starts as Draft. The previous approved version remains in the version history.

**Relationships.** One English copy record per tag. English copy is the source for all translations.

---

### 4.4 Translation

**Purpose.** The text for a tag in a specific non-English language.

**Attributes.**

| Attribute | Description |
|---|---|
| Tag ID | The tag this translation belongs to |
| Language | The target language (e.g., Arabic, Spanish, Italian) |
| Translated Text | The current translation |
| Version | The current version number |
| Status | Draft, Pending Review, Approved, Stale |
| Source English Version | The version of the English copy this translation was based on |
| Creation Method | AI-generated or Manual |
| Confidence Score | AI confidence score (only for AI-generated translations) |
| Back-translation | The translated text translated back to English (for reviewer reference) |
| Author/Generator | Who created or which process generated this translation |
| Reviewer | Who reviewed this translation |
| Review Date | When reviewed |
| Approver | Who approved |
| Approval Date | When approved |

**Lifecycle.**

1. **No Translation** : Tag exists in this language but no translation has been created yet.
2. **Draft** : Translation has been created (by AI or manually) but not yet reviewed. Cannot be published to any environment.
3. **Pending Review** : Submitted for reviewer action.
4. **Approved** : Reviewed and approved by a human. Eligible for publishing through the environment pipeline.
5. **Stale** : The English source copy changed after this translation was approved. The existing published translation remains live. The stale flag signals that verification is needed.

Stale can be resolved in two ways:
- **Confirmed**: Reviewer determines the existing translation is still correct. Returns to Approved.
- **Retranslated**: A new translation is generated or written. Enters as Draft and follows the review cycle.

**Relationships.** One translation per tag per language. Every translation is based on a specific version of the English copy.

---

### 4.5 Language

**Purpose.** A supported language in MioTranslate.

**Attributes.**

| Attribute | Description |
|---|---|
| Language Code | Standard identifier (e.g., ar, bg, it, fr-CA, es, de, tr) |
| Language Name | Human-readable name (e.g., Arabic, Bulgarian, Italian) |
| Status | Active or Inactive |
| Direction | LTR or RTL |
| Added Date | When this language was added to MioTranslate |

**Lifecycle.** A language is added by an administrator. It can be deactivated but not deleted (existing translations and history are preserved). When a new language is added, all existing tags receive an empty translation slot in that language.

**Relationships.** A language has zero or one translation per tag across all pages.

---

### 4.6 Version

**Purpose.** A snapshot of the state of a page in a specific language at a point in time.

**Attributes.**

| Attribute | Description |
|---|---|
| Page ID | The page |
| Language | The language (including English) |
| Version Number | Sequential integer |
| Tag Snapshot | The set of all approved tag values at the time of versioning |
| Created By | Who triggered the version creation |
| Created Date | When |
| Change Summary | What changed from the previous version |

**Lifecycle.** A new version is created whenever an approved change is made to any tag within a page for a specific language. Versions are immutable once created. They are never deleted.

**Relationships.** A version belongs to one page and one language. A version is referenced by environment deployment records.

---

### 4.7 Review

**Purpose.** A review action taken on English copy or a translation.

**Attributes.**

| Attribute | Description |
|---|---|
| Subject | The English copy or translation being reviewed |
| Reviewer | Who performed the review |
| Action | Approved, Rejected, Returned for Revision, Escalated |
| Comment | Optional reviewer note |
| Date | When the review occurred |

**Lifecycle.** A review is created when a reviewer takes action. Reviews are immutable and permanent.

---

### 4.8 Approval

**Purpose.** A formal sign-off on English copy or a translation.

**Attributes.**

| Attribute | Description |
|---|---|
| Subject | What was approved |
| Approver | Who approved |
| Date | When |
| Scope | Whether this is a content approval or a publishing approval |

**Lifecycle.** Approvals are immutable. An approval can be superseded by a new version requiring a new approval.

---

### 4.9 Release (Publishing)

**Purpose.** The act of publishing a page bundle (one page + one language) from MioTranslate to a target environment's endpoint. MioTranslate is always the source. Environments are sequential targets.

**How publishing works.** Each environment (Dev, QA, Production) has its own dedicated Language Services API endpoint. When MioTranslate publishes content, it pushes the approved page bundle to the appropriate environment's endpoint. MioTranslate has no direct access to the underlying databases; it operates entirely through the Language Services API.

**Attributes.**

| Attribute | Description |
|---|---|
| Page ID | The page being published |
| Language | The language being published |
| Version | The version being published |
| Target Environment | The environment being published to (Dev, QA, or Production) |
| Published By | Who initiated the publishing |
| Approved By | Who approved the publishing |
| Publishing Date | When |
| Tag Count | Number of tags in the published bundle |
| Status | Successful, Failed, Rolled Back |
| Notes | Any additional context (e.g., reason for selecting this target environment) |

**Lifecycle.** A release is created when a publishing action is initiated. It is marked Successful when the content is confirmed at the target environment's endpoint. It can be marked Rolled Back if a subsequent rollback occurs.

---

### 4.10 Environment

**Purpose.** Represents a stage in the publishing pipeline. Each environment is a target that MioTranslate publishes to.

**Attributes.**

| Attribute | Description |
|---|---|
| Name | Dev, QA, Production |
| Purpose | Dev: development testing. QA: quality verification. Production: live for salon teams. |
| Endpoint | Each environment has its own dedicated Language Services API endpoint |
| Current State | Per page per language: which version is currently published |

**Lifecycle.** Environments are fixed. They are not created or removed by users.

**Business rule.** Once content is approved, it can be published to any target environment (Dev, QA, or Production). The required approver depends on the target environment. Every publishing action is recorded in the audit trail.

---

### 4.11 Audit Record

**Purpose.** An immutable log entry recording an action taken in MioTranslate.

**Attributes.**

| Attribute | Description |
|---|---|
| Action | What happened (created, edited, approved, rejected, published, rolled back, etc.) |
| Subject | What was acted upon (tag, page, translation, release) |
| Performed By | Who performed the action |
| Timestamp | When |
| Details | Specific information (e.g., "English copy changed from 'Quick Sale' to 'Quick Checkout'") |
| Before Value | The value before the action (if applicable) |
| After Value | The value after the action (if applicable) |

**Lifecycle.** Audit records are immutable. They cannot be edited, deleted, or archived. They are permanent.

---

### 4.12 Comment

**Purpose.** A note attached to a tag, English copy, or translation, enabling team discussion within context.

**Attributes.**

| Attribute | Description |
|---|---|
| Subject | What the comment is attached to |
| Author | Who wrote the comment |
| Text | The comment content |
| Date | When |
| Resolved | Whether the comment has been marked resolved |

**Lifecycle.** Comments can be created by any user with view access or above. Comments can be marked as resolved but not deleted.

---

### 4.13 Import Event

**Purpose.** A record of a data import into MioTranslate (used during the initial migration).

**Attributes.**

| Attribute | Description |
|---|---|
| Initiated By | Who performed the import |
| Date | When |
| Pages Imported | Count |
| Tags Imported | Count |
| Translations Imported | Count |
| Status | Completed, Failed |

**Lifecycle.** An import event is created when an import is initiated and completed when processing finishes. For the initial migration, this records the one-time data load.

---

## 5. Functional Modules

### 5.1 Page & Tag Registry

**Purpose.** The foundation of MioTranslate. The authoritative registry where all pages and tags are created and managed. MioTranslate is the only entry point for creating managed UX copy.

**Business context.** Traces to Capability 11.7 (Page & Tag Creation) and Objective 1 (single source of truth). All managed UX copy originates in MioTranslate.

**Responsibilities.**

- Create and manage pages and tags
- Push approved content to the Language Services API for target environments
- Provide browsing and search across all pages and tags
- Manage page and tag lifecycle (Active, Deprecated)

**Primary features.**

- Create a new page with a Page ID, name, and module
- Create new tags within a page with a Tag ID
- Page listing with tag counts, module, and status
- Tag listing within a page with copy status and translation status per language
- Page detail view showing all tags and their status across languages

**Business rules.**

- A tag belongs to exactly one page
- A tag's Page ID is determined by the tag naming convention (the prefix before the underscore)
- Deprecated tags are excluded from active workflows but retained in the registry
- Tags are created and managed in MioTranslate. Tag content reaches Language Services only when approved content is published. Developers reference these tag IDs in code.

**Dependencies.** None. This module is the foundation for all others.

---

### 5.2 English Copy Management

**Purpose.** Enables Product and QA teams to author, edit, and manage the official English UX copy for every tag.

**Business context.** Traces to Capability 11.1 (English UX Copy Management), Problem 4.1 (every change requires a developer), Objective 2 (remove engineering dependency).

**Responsibilities.**

- Provide an authoring interface for English copy
- Version every change to English copy
- Flag all translations as Stale when English copy changes

**Primary features.**

- Author English copy for a tag
- Edit existing English copy
- View English copy version history
- Submit English copy for review
- Change reason capture (optional)

**Business rules.**

- When approved English copy changes, every existing translation of that tag across all languages is automatically flagged Stale.
- English copy must be approved before the tag can be translated.

**Dependencies.** Page & Tag Registry (tags must be created in MioTranslate before English copy can be authored).

---

### 5.3 Translation Management

**Purpose.** Enables translations to be created with AI assistance, reviewed by humans, and managed independently per language.

**Business context.** Traces to Capability 11.2 (Translation Management), Problem 4.2 (untracked path to production), Problem 4.5 (unstructured workflow), Objective 4 (translation quality assurance).

**Responsibilities.**

- Create translations (AI-assisted or manual entry by reviewer)
- Provide business context to AI translation (page, module, copy type, salon/spa terminology)
- Generate back-translations for reviewer reference
- Calculate confidence scores for AI-generated translations
- Verify variable/placeholder integrity
- Manage translation states (Draft, Pending Review, Approved, Stale)
- Manage stale resolution (confirm or retranslate)
- Support bulk translation operations

**Primary features.**

- AI-translate a single tag for a selected language
- AI-translate all untranslated tags on a page for a selected language (Translate All)
- View translation alongside English source, back-translation, and confidence score
- Edit a translation manually (reviewer only)
- Submit translation for review
- Resolve stale translation (confirm as still correct, or retranslate)
- Filter translations by state (Draft, Pending Review, Approved, Stale, No Translation)
- View translation version history

**Business rules.**

- A tag must have approved English copy before it can be translated
- AI generates translations; only reviewers make manual changes
- Every translation requires human approval before it can be published to any environment
- Each language is managed independently. Operations on one language do not affect any other language.
- When English copy changes, all translations of that tag are flagged Stale. The existing published translation remains live.
- A stale translation can be confirmed (returned to Approved) or retranslated (enters as Draft)
- Translation rules (yet to be defined) will govern how translations are created

**Dependencies.** English Copy Management (approved English must exist). Page & Tag Registry.

---

### 5.4 Review & Approval

**Purpose.** Governs who can approve what, and ensures no copy reaches salon teams without passing through the appropriate people.

**Business context.** Traces to Capability 11.3 (Review & Approval), Problem 4.3 (no ownership), Problem 4.5 (unstructured workflow), Objective 3 (governance before production).

**Responsibilities.**

- Manage the review queue for English copy and translations
- Enforce the approval chain
- Support escalation to Founder for sensitive labels
- Record every review and approval action

**Primary features.**

- Review queue: all items pending review, filterable by type (English/Translation), language, page, priority
- Review action: Approve, Reject, Return for Revision, Escalate
- Reviewer comment on approval or rejection
- Bulk approve: approve multiple translations at once (with configurable confidence threshold)
- Escalation: flag specific labels for Founder review
- Review history: who reviewed what, when, and what action they took

**Business rules.**

- English copy review chain: Author (PM/QA) submits, Reviewer (Manager/Support Lead) reviews, Founder reviews if escalated
- Translation review chain: AI generates or reviewer creates, Reviewer (Localization Reviewer) approves
- Bulk approval is available only for translations that meet the configurable confidence threshold
- Low-confidence translations require individual review
- Every review action is recorded and becomes part of the audit trail
- An item returned for revision goes back to Draft with the reviewer's comment attached
- Rejected items remain in the system with the rejection reason recorded

**Dependencies.** English Copy Management. Translation Management.

---

### 5.5 Publishing & Release Management

**Purpose.** Formalizes and tracks the movement of UX copy through environments from Dev through QA to Production.

**Business context.** Traces to Capability 11.4 (Publishing & Release Management), Problem 4.2 (manual, untracked pipeline), Objective 3 (governance before production), Objective 7 (audit trail).

**Responsibilities.**

- Manage publishing to Dev, QA, and Production target environments
- Publish page bundles (one page + one language) through the target environment's Language Services API endpoint
- Track what is published where
- Support rollback to a previous version
- Record every publishing action and rollback

**Primary features.**

- View environment status per page per language (what version is published where)
- Publish a page bundle to a selected target environment
- Approval gate at each publishing step (required approver depends on target environment)
- Rollback a page bundle to a previous version in any environment
- Publishing history per page per language
- Pre-publishing summary: what is changing compared to what is currently live in the target environment

**Business rules.**

- The unit of publishing is a page bundle: one page + one language
- MioTranslate is always the source. Each environment (Dev, QA, Production) is a target. Once content is approved, it can be published to any target environment.
- Publishing requires approval. The required approver depends on the target environment:
  - Dev: Author or Reviewer
  - QA: Reviewer
  - Production: Support Reviewer or Founder
- Only approved content can be published. Draft or Pending Review items cannot be included in a bundle.
- Publishing a page bundle pushes all approved tags for that page in that language to the target environment's Language Services API endpoint.
- Publishing one language does not affect other languages for the same page.
- Publishing one page does not affect other pages.
- Rollback re-publishes the previous version. The rolled-back version is not deleted; it remains for investigation.
- Every publishing action and rollback is recorded with who, when, what version, and target environment.

**Dependencies.** Review & Approval (content must be approved). Page & Tag Registry.

---

### 5.6 Visibility & Reporting

**Purpose.** Provides the organization with a clear, always-available view of translation status, coverage, and operational health.

**Business context.** Traces to Capability 11.5 (Translation Visibility), Problem 4.4 (translation status is invisible), Objective 5 (visibility), Objective 6 (plannable language expansion).

**Responsibilities.**

- Coverage dashboard per page per language
- Stale translation tracking
- Activity timeline
- Operational metrics

**Primary features.**

- Coverage dashboard: for each language, show per-page translation coverage (percentage of tags that are approved and deployed to production)
- Language readiness view: for a selected language, show all pages ranked by coverage
- Page readiness view: for a selected page, show all languages and their status
- Stale translations list: all translations flagged stale, grouped by language and page, sortable by age
- Activity timeline: recent actions across the system (edits, approvals, promotions)
- Pending work summary: how many tags need English copy, how many need translation, how many are pending review, how many are stale

**Business rules.**

- Coverage percentage = (tags with approved translation deployed to Production) / (total active tags on the page) x 100
- A page with 0 active tags has no coverage calculation
- Stale count is tracked per language independently
- Coverage is calculated per environment (a tag may be approved but not yet deployed to Production)

**Dependencies.** All other modules (aggregates data from across the system).

---

### 5.7 Administration

**Purpose.** System configuration, role management, and language management.

**Business context.** Traces to Capability 11.3 (Review & Approval, role definitions), Objective 3 (governance).

**Responsibilities.**

- User role management
- Language management (add, deactivate)
- Approval workflow configuration
- System settings

**Primary features.**

- Assign roles to users (PM, QA, Localization Reviewer, Support Reviewer, Founder, Developer, Administrator)
- Add a new language
- Deactivate a language (translations preserved but no new work)
- Configure confidence threshold for bulk approval
- Configure which pages or labels require Founder-level approval

**Business rules.**

- A user can hold multiple roles
- Deactivating a language does not delete existing translations or history
- Adding a new language creates empty translation slots for all active tags across all pages
- Only Administrators and Founders can modify system configuration

**Dependencies.** None. Provides configuration consumed by all other modules.

---

## 6. Feature Specifications

### F-01: Page & Tag Browsing

**Purpose.** Enable the Product Manager to browse and navigate all pages and tags in MioTranslate, understand their translation status at a glance, and drill down into any page to see its tags and their state.

**Problem solved.** MioSalon has a large and growing number of pages across modules. Without a dedicated browsing experience, finding the right page, understanding which pages have complete translations, and identifying where attention is needed requires manual effort and tribal knowledge. (Capability 11.5, Capability 11.7, Problem 4.4)

**Primary users.** Product Manager, QA, Localization Reviewer.

**Preconditions.** MioTranslate has been initialized (migration complete). At least one page exists.

**Functional behaviour.**

- User opens MioTranslate and sees a browsable list of all pages
- Each page shows: Page Name, Page ID, Module, total tag count, and a per-language translation summary (e.g., "Arabic: 36/38 approved, Spanish: 20/38, Turkish: not started")
- Pages can be filtered by: module, translation completeness (fully translated, partially translated, not started)
- Pages can be sorted by: name, module, tag count, translation coverage for a selected language
- User can search for a page by name or Page ID
- User selects a page and drills down to see all tags on that page with their English copy status and translation status per language
- From the tag list, user can navigate directly to author English copy, translate, review, or view history

**Business rules.**

- Page browsing is a read-only experience. No content is created or modified here; it serves as the navigation entry point into the content management features.
- Deprecated pages are visible but clearly marked and excluded from active counts
- The page list reflects the current state of MioTranslate's registry

**Edge cases.**

- MioTranslate has just been initialized with zero pages: display empty state with guidance to create the first page or run the initial migration
- A page has 100+ tags: tag list is paginated with search and filter within the page
- A page exists in MioTranslate but has been deprecated: shown with a "Deprecated" indicator, sortable to the bottom

**Acceptance criteria.**

- All pages are browsable from a single entry point
- Each page shows tag count, module, and per-language translation summary
- Filtering by module and coverage works correctly
- Drilling into a page shows all tags with their English and translation status
- Navigation from tag list to authoring, translation, and review features is seamless

---

### F-02: Create Page & Tag

**Purpose.** Enable authorized users to register pages and create tags in MioTranslate. The developer defines the page in the MioSalon codebase and provides the Page ID. The PM registers that page in MioTranslate using the developer-provided Page ID and creates the tags within it. Once a page is added, it appears in the Page & Tag Browsing view (F-01) for ongoing management. Developers reference the created tag IDs in their code. Tag content reaches Language Services only when approved content is published.

**Problem solved.** UX copy must originate from a governed, trackable system rather than being created ad hoc by developers in the codebase. (Capability 11.7, Problem 4.1, Objective 2)

**Primary users.** Product Manager, Founder.

**Preconditions.** User has permission to create pages and tags. Developer has provided the Page ID from the codebase.

**Functional behaviour.**

- User registers a new page by providing: Page ID (required, as defined by the developer in the codebase), Page Name (required), Module (optional)
- User creates new tags within that page by providing: Tag ID (following the naming convention)
- User optionally sets the copy type for each tag (button, label, error message, etc.)
- After creation, the tag enters "Needs English copy" state
- Tags are created in MioTranslate. Tag content reaches Language Services only when approved content is published (via the Language Services API)
- The newly registered page appears in the Page & Tag Browsing view (F-01)
- Once English copy is authored, reviewed, and approved, and translations are completed, the content is published to the target environment's Language Services API endpoint
- Developers reference the tag IDs in MioSalon's code

**Business rules.**

- The Page ID is provided by the developer from the codebase. The PM registers it in MioTranslate as-is.
- Tag IDs must follow the naming convention (PAGE_ID_TAG_NUMBER)
- Page IDs and Tag IDs must be unique across MioTranslate
- Once created, Page IDs and Tag IDs are immutable
- A page or tag creation is recorded in the audit trail
- Tags cannot be deleted. They can only be marked Deprecated.
- Tags are created and managed in MioTranslate. Tag content (approved English copy and translations) reaches Language Services only when approved content is published

**Edge cases.**

- User tries to create a tag with an ID that already exists: validation error. Display: "Tag ID already exists."
- User tries to register a page with an ID that already exists: validation error. Display: "Page ID already exists."
- User creates a tag but does not author English copy immediately: tag remains in "Needs English copy" state
- Developer has not yet provided a Page ID: PM cannot register the page until the developer defines it in the codebase

**Acceptance criteria.**

- PM can register pages using developer-provided Page IDs and create tags without further developer involvement
- Tag IDs and Page IDs follow the naming convention and are validated for uniqueness
- Created tags enter "Needs English copy" state
- Tags are created in MioTranslate; tag content reaches Language Services only when approved content is published
- Newly registered pages appear in the Page & Tag Browsing view (F-01)
- Every creation action is recorded in the audit trail
- After content is approved and published, it is available through the Language Services API for the target environment

---

*(F-03 removed. MioTranslate is the only entry point for creating pages and tags. There is no sync or developer notification mechanism.)*

---

### F-04: Author English Copy

**Purpose.** Enable the product team to write the official English text for a tag.

**Problem solved.** PM/QA cannot enter copy into the product today. (Problem 4.1, Capability 11.1)

**Primary users.** Product Manager, QA.

**Preconditions.** Tag exists in MioTranslate (created by an authorized user or imported during migration).

**Functional behaviour.**

- User navigates to a tag
- User sees the current approved English copy (if any) as reference
- User writes the official English copy
- User optionally selects the copy type (button, label, error message, etc.)
- User optionally adds a change reason
- User saves as Draft or submits for review

**Business rules.**

- If this is the first English copy for this tag, its status moves from "No Copy" to "Draft"
- If this is an edit of existing approved copy, a new version is created as Draft. The previous approved version remains active until the new version is approved.
- English copy must be approved before the tag can be translated

**Edge cases.**

- Author leaves the English copy field empty and tries to save: validation error. English copy text is mandatory.
- Two users attempt to edit the same tag's English copy simultaneously: the second save shows a conflict notification. The second user must refresh and resolve.

**Acceptance criteria.**

- PM/QA can author English copy without developer involvement
- The current approved value (if any) is visible as reference
- The copy enters Draft status and can be submitted for review
- Version history records the new version

---

### F-05: Edit English Copy

**Purpose.** Enable the product team to improve or correct existing approved English copy.

**Problem solved.** Once copy is entered today, improving it requires re-engaging a developer. (Problem 4.1)

**Primary users.** Product Manager, QA.

**Preconditions.** Approved English copy exists for the tag.

**Functional behaviour.**

- User navigates to a tag with approved English copy
- User edits the text
- User optionally adds a change reason
- User saves as Draft or submits for review

**System behaviour.**

- A new version is created
- All existing translations across all languages are automatically flagged Stale
- The previous approved version remains active until the new version is approved

**Business rules.**

- Editing English copy always creates a new version (never modifies the existing approved version in place)
- Stale flagging is automatic and applies to all languages simultaneously
- The change reason is optional but encouraged

**Edge cases.**

- English copy is edited while translations are pending review: translations continue their review process but are also flagged Stale once the new English version is approved
- English copy is edited multiple times before any translation is resolved: each edit creates a new version. Stale flags reference the latest approved English version.

**Acceptance criteria.**

- Editing creates a new version visible in version history
- All translations are flagged Stale immediately upon new English version approval
- Previous version is preserved and viewable

---

### F-06: AI-Assisted Translation

**Purpose.** Generate translations using AI with business context, for human review.

**Problem solved.** Translations are created without context today. (Capability 11.2, Objective 4)

**Primary users.** Product Manager, Localization Reviewer.

**Preconditions.** Tag has approved English copy.

**Functional behaviour.**

- User selects a tag and a target language
- User triggers AI translation
- AI generates a translation using business context: what page the tag appears on, what module, what copy type, salon/spa industry terminology, and translation rules (when defined)
- AI generates a back-translation (the translated text translated back to English)
- AI generates a confidence score
- AI verifies variable/placeholder integrity (if the English copy contains dynamic placeholders, they must be preserved in the translation)
- The translation enters as Draft

**Business rules.**

- AI generates translations; only reviewers make manual edits
- Every AI-generated translation must be reviewed and approved by a human before publishing
- The back-translation is displayed alongside the translation for reviewer reference
- The confidence score is displayed for reviewer prioritization
- If variable integrity check fails, the translation is flagged and requires manual review regardless of confidence score

**Edge cases.**

- English copy contains no text (only a placeholder variable): AI may produce an empty or variable-only translation. Flag for manual review.
- AI translation fails (service unavailable): display error. Translation remains as "No Translation." User can retry.
- Multiple users trigger AI translation for the same tag/language: only one translation is created. Second request sees the existing Draft.

**Acceptance criteria.**

- AI-generated translations include business context
- Back-translation is generated and displayed
- Confidence score is calculated and displayed
- Variable integrity is verified
- Translation enters as Draft requiring human approval

---

### F-07: Translate All (Bulk AI Translation)

**Purpose.** AI-translate all untranslated tags on a page for a selected language in one operation.

**Problem solved.** Translating a page with many tags one by one is impractical. (Capability 11.2)

**Primary users.** Product Manager, Localization Reviewer.

**Preconditions.** Page exists. At least one tag on the page has approved English copy and no translation in the selected language.

**Functional behaviour.**

- User selects a page and a language
- User triggers "Translate All"
- AI translates all untranslated tags on the page for that language
- Each translation includes back-translation and confidence score
- All translations enter as Draft

**Business rules.**

- Only tags with approved English copy and no existing translation (or no existing Draft/Approved) are translated
- Tags that already have a Draft or Approved translation are skipped
- Stale translations are not retranslated by "Translate All" (they require explicit stale resolution)

**Edge cases.**

- All tags on the page already have translations: "Translate All" has no effect. Display message: "All tags already have translations for [language]."
- Some tags lack approved English copy: those tags are skipped. The count of skipped tags is shown.
- Page has 100+ tags: operation may take time. Show progress indication.

**Acceptance criteria.**

- All eligible tags receive AI-generated translations in one operation
- Each translation has back-translation and confidence score
- Already-translated tags are not overwritten
- Skipped tags (no English copy) are reported

---

### F-08: Review Translation

**Purpose.** Enable a human reviewer to evaluate and approve or reject an AI-generated or manually created translation.

**Problem solved.** Translations go live without verification today. (Problem 4.2, Capability 11.3)

**Primary users.** Localization Reviewer.

**Preconditions.** Translation exists in Draft or Pending Review state.

**Functional behaviour.**

- Reviewer sees the translation alongside:
  - The English source copy
  - The back-translation
  - The confidence score
  - Variable integrity status
  - The page and copy type for context
- Reviewer takes one of the following actions:
  - **Approve**: Translation moves to Approved. Eligible for publishing.
  - **Edit and Approve**: Reviewer corrects the translation manually, then approves. Manual correction is recorded.
  - **Request Retranslation**: Translation is regenerated by AI with the same or improved context. Returns to Draft.
  - **Reject**: Translation is rejected with a reason. Remains in Draft or returns to "No Translation."

**Business rules.**

- Only users with Localization Reviewer role or above can approve translations
- Every review action is recorded in the audit trail
- Editing a translation during review creates a new entry in the version history noting the manual correction

**Edge cases.**

- The English copy changes while a translation is being reviewed: the translation is flagged Stale. The reviewer is notified and must re-evaluate.
- Reviewer approves a translation with a failing variable integrity check: system warns the reviewer. Reviewer can override with acknowledgement.

**Acceptance criteria.**

- Reviewer can see all relevant context (English, back-translation, confidence, copy type)
- All four review actions are available
- Every action is recorded in the audit trail
- Manual corrections are versioned

---

### F-09: Bulk Approve Translations

**Purpose.** Enable efficient approval of multiple high-confidence translations at once.

**Problem solved.** Reviewing 100+ tags individually causes reviewer fatigue. (Capability 11.2)

**Primary users.** Localization Reviewer.

**Preconditions.** Multiple translations in Pending Review or Draft state on a page for a language.

**Functional behaviour.**

- Reviewer filters translations by confidence score (e.g., confidence >= configurable threshold)
- Reviewer selects multiple translations
- Reviewer bulk-approves all selected translations

**Business rules.**

- Bulk approval is available only for translations that meet or exceed the configurable confidence threshold
- Translations below the threshold must be individually reviewed
- Each individually approved item in the bulk action is recorded in the audit trail
- Bulk approval does not bypass the human approval requirement; it streamlines it

**Edge cases.**

- All translations on the page are below the threshold: bulk approve is not available. All must be individually reviewed.
- A translation in the selection has a variable integrity failure: that translation is excluded from the bulk approval. The reviewer is notified.

**Acceptance criteria.**

- Reviewer can filter by confidence and select multiple translations
- Only translations meeting the threshold are eligible
- Each approval is individually recorded in the audit trail

---

### F-10: Resolve Stale Translation

**Purpose.** Enable reviewers to address translations flagged as stale because the English source changed.

**Problem solved.** Translations drift silently when English changes. (Capability 11.2)

**Primary users.** Localization Reviewer.

**Preconditions.** Translation is in Stale state.

**Functional behaviour.**

- Reviewer sees the stale translation alongside:
  - The previous English copy (what the translation was based on)
  - The new English copy (what changed)
  - The current translation
- Reviewer takes one of the following actions:
  - **Confirm**: The existing translation is still correct despite the English change. Translation returns to Approved.
  - **Retranslate**: A new AI translation is generated based on the new English copy. Enters as Draft and goes through the review cycle.

**Business rules.**

- A confirmed translation records which English version it was confirmed against
- A retranslation creates a new version; the stale version is preserved in history
- The currently deployed (stale) translation remains live in production until a new version is promoted
- Each language resolves staleness independently

**Edge cases.**

- English copy changes again while a stale translation is being resolved: the translation becomes stale against the newest English version. The reviewer must re-evaluate.
- A stale translation has already been deployed to production: it remains deployed. Stale is advisory, not blocking.

**Acceptance criteria.**

- Reviewer can see both the old and new English copy alongside the current translation
- Confirm and retranslate actions are available
- Stale resolution is recorded in the audit trail
- Deployed translations are not removed

---

### F-11: Publish Page Bundle

**Purpose.** Publish all approved tags for a page in a specific language to a selected target environment. MioTranslate is always the source; it pushes the approved bundle to the target environment's Language Services API endpoint.

**Problem solved.** The current pipeline is manual and untracked. (Problem 4.2, Capability 11.4)

**Primary users.** Reviewer, Support Reviewer, Founder.

**Preconditions.** Page bundle has approved content in MioTranslate. Required approver for the target environment has authority.

**Functional behaviour.**

- User selects a page and language
- User sees the current environment status (e.g., "QUICK Arabic: published to Dev, not yet in QA or Production")
- User selects the target environment (Dev, QA, or Production)
- User sees a pre-publishing summary: what tags are included, what changed since the last publishing to the target environment
- User initiates publishing to the target environment
- Required approver for the target environment approves the publishing action
- MioTranslate pushes the approved content to the target environment's Language Services API endpoint

**Business rules.**

- Once content is approved, it can be published to any target environment (Dev, QA, or Production)
- Publishing requires approval:
  - To Dev: Author or Reviewer
  - To QA: Reviewer
  - To Production: Support Reviewer or Founder
- Only approved content is included in the bundle. Draft or Pending Review items are excluded.
- Publishing one page+language does not affect other pages or other languages
- Every publishing action is recorded with who, when, what version, target environment, and a tag count

**Edge cases.**

- A tag on the page is still in Draft while publishing is initiated: that tag is excluded from the bundle. The user is shown the count of excluded tags.
- All tags on the page are in Draft: publishing cannot proceed. Display message: "No approved content to publish."
- Publishing fails (target endpoint unreachable): record the failure. Content remains in MioTranslate. User can retry.

**Acceptance criteria.**

- Publishing to any target environment is available once content is approved
- The required approver is enforced based on the target environment
- Approval is required at each step
- Pre-publishing summary shows what will change
- Every publishing action is recorded in deployment history
- Excluded tags are reported

---

### F-12: Rollback

**Purpose.** Revert a page bundle to its previous version in any environment.

**Problem solved.** If a promoted label is wrong, there is no way to undo it today. (Capability 11.4)

**Primary users.** Support Reviewer, Founder.

**Preconditions.** A previous version exists in the deployment history for the target environment.

**Functional behaviour.**

- User navigates to the deployment history for a page and language
- User sees all previous versions deployed to the environment
- User selects a version to rollback to
- User initiates rollback
- The previous version is re-deployed to the environment

**Business rules.**

- The rolled-back (bad) version is not deleted. It remains in MioTranslate for investigation.
- Rollback creates a new deployment record noting it is a rollback
- Rollback directly restores the selected version in the target environment.
- Only Support Reviewer or Founder can initiate rollback to Production

**Edge cases.**

- No previous version exists (first-ever deployment): rollback is not available
- Rollback to a version that contains tags that have since been deprecated: the rollback proceeds. Deprecated tags in the bundle still appear. This is a safety measure.

**Acceptance criteria.**

- Previous versions are listed in deployment history
- Rollback restores the selected version
- A rollback record is created in the audit trail
- The bad version is preserved

---

### F-13: View Version History

**Purpose.** See the complete history of every change to a tag's English copy or translation.

**Problem solved.** No one can answer "what did this label say before?" today. (Problem 4.3, Capability 11.6)

**Primary users.** All roles.

**Functional behaviour.**

- User navigates to a tag
- User selects English or a specific language
- User sees a chronological list of all versions: who changed it, when, what it said before, what it says now, the change reason

**Business rules.**

- Version history is immutable
- Every version is permanently retained
- Version history includes all actions: creation, edits, approvals, rejections, promotions, rollbacks

**Acceptance criteria.**

- Complete chronological history is available for every tag in every language
- Each entry shows who, when, before value, after value, and reason

---

### F-14: Search

**Purpose.** Find any label in MioTranslate by English text, tag ID, or page name.

**Primary users.** All roles.

**Functional behaviour.**

- User enters a search query
- Results show matching tags with their page, English copy, and status
- Search matches against: tag ID, English copy text (approved and fallback), page name, page ID

**Business rules.**

- Search is case-insensitive
- Search returns results across all pages
- Results are sortable by page, status, and relevance

**Edge cases.**

- Search query matches hundreds of results: paginate results
- Search query matches zero results: display "No results found"

---

### F-15: Filter by Translation State

**Purpose.** Focus review effort where it is needed by filtering tags by their translation state.

**Primary users.** Product Manager, Localization Reviewer.

**Functional behaviour.**

- On any page view, user can filter tags by: No Translation, Draft, Pending Review, Approved, Stale
- Filters can be combined with a language selector
- Filters are persistent within a session

**Acceptance criteria.**

- Filtering is available on all tag listing views
- Filters correctly count and display tags in each state

---

### F-16: Coverage Dashboard

**Purpose.** Provide a single view of translation readiness across all pages and languages.

**Problem solved.** Translation status is invisible today. (Problem 4.4, Capability 11.5)

**Primary users.** Founder, Product Manager, Localization Reviewer.

**Functional behaviour.**

- Dashboard shows a matrix: pages (rows) by languages (columns)
- Each cell shows coverage percentage and environment status
- User can drill into any cell to see per-tag status
- Summary row shows overall coverage per language
- Summary column shows overall coverage per page

**Business rules.**

- Coverage = (tags approved and deployed to Production) / (total active tags) x 100
- Pages with zero active tags are excluded from the dashboard
- Stale translations are counted as "approved but needs attention" (they are deployed and live but flagged)

**Acceptance criteria.**

- Coverage is accurate and updates in near-real-time as translations are approved and promoted
- Drill-down shows per-tag detail
- Dashboard is accessible to all roles

---

### F-17: Audit Trail

**Purpose.** Record every action taken in MioTranslate for traceability and accountability.

**Problem solved.** No one can trace who changed what, when. (Problem 4.3, Capability 11.6)

**Primary users.** All roles (view). System (write).

**Functional behaviour.**

- Every action in MioTranslate creates an audit record
- Audit records are searchable by user, date range, action type, page, tag, and language
- Audit records show before and after values for content changes

**Actions recorded.**

- English copy created, edited, submitted for review, approved, rejected
- Translation created, edited, approved, rejected, confirmed (stale resolution), retranslated
- Page bundle promoted, rolled back
- Page or tag created
- Initial migration imported
- Role assigned or modified
- Language added or deactivated
- System configuration changed

**Business rules.**

- Audit records are immutable. They cannot be edited, deleted, or archived.
- Audit records are permanent. No retention limit.
- Every audit record includes who performed it, the timestamp, action, subject, and details.

**Acceptance criteria.**

- Every action listed above creates an audit record
- Audit records are searchable and filterable
- No audit record can be modified or deleted

---

### F-18: Comments

**Purpose.** Enable team discussion on specific tags, copy, or translations within the product context.

**Primary users.** All roles.

**Functional behaviour.**

- User can add a comment to any tag (scoped to English copy or a specific language)
- Comments are visible to all users with access to the tag
- Comments can be marked as resolved

**Business rules.**

- Comments cannot be deleted (they are part of the collaboration record)
- Comments can be marked resolved
- Comments are included in the activity timeline

---

### F-19: Export

**Purpose.** Enable users to export tag data for external review, reporting, or offline work.

**Primary users.** Product Manager, Localization Reviewer, Administrator.

**Functional behaviour.**

- User selects a page and language
- User exports all tags with: tag ID, English copy, translation, status, confidence score
- Export format: CSV or Excel

**Business rules.**

- Exported data reflects the current state at the time of export
- Exports are read-only snapshots; they cannot be re-imported to modify data

---

### F-20: Activity Timeline

**Purpose.** Show recent actions across the system for awareness and coordination.

**Primary users.** All roles.

**Functional behaviour.**

- Chronological list of recent actions: creations, edits, approvals, promotions
- Filterable by user, page, language, action type
- Shows the most recent actions first

---

### F-21: Initial Migration (One-Time Import)

**Purpose.** A one-time manual migration to load existing UX copy into MioTranslate. The existing English copy and translations are downloaded/exported from the current multilingual module in the existing system and imported into MioTranslate as the starting production state. This is not an API-based sync. After this migration, MioTranslate becomes the only entry point for creating and managing new UX copy and translations, with Language Services receiving changes through its API.

**Problem solved.** MioTranslate must start with the current state of the product. (Objective 1)

**Primary users.** Founder, Administrator.

**Preconditions.** MioTranslate is deployed. The existing UX copy and translations have been downloaded/exported from the current multilingual module.

**Functional behaviour.**

- The existing UX copy and translations are exported from the current system (manual download)
- The exported data is imported into MioTranslate through a file upload or import tool
- Imported pages, tags, English copy, and translations are registered in MioTranslate
- Imported content enters MioTranslate as "Published in Production" (it is already live)
- After import, a validation report is generated comparing MioTranslate's registry against the imported data

**Post-migration actions.**

- Developer write access to the Language Services API is revoked
- All future UX copy changes go through MioTranslate
- MioTranslate becomes the only entry point for creating new pages, tags, English copy, and translations

**Business rules.**

- Content imported during migration is not treated as Draft. It is the current production state.
- Migration preserves all existing translations as-is
- A full snapshot of the source data is taken before the migration begins (safety)
- Post-migration validation confirms nothing was lost or corrupted
- This is a one-time process. After migration, all new pages and tags are created directly in MioTranslate.

**Acceptance criteria.**

- Every page, tag, and translation from the exported data is represented in MioTranslate after import
- Validation report shows zero discrepancies
- Rollback to pre-migration state is possible if discrepancies are found
- After migration, MioTranslate is the only system that creates and manages UX copy

---

## 7. Business Rules

### Content Rules

1. English is always the source language. All translations are derived from the approved English copy.
2. A tag must have approved English copy before it can be translated.
3. Every translation belongs to exactly one English source version.
4. MioTranslate is the only entry point for creating managed UX copy. Pages and tags are created in MioTranslate, English copy is authored and approved, and content is published to the Language Services API for target environments.
5. When English copy changes, all translations of that tag across all languages are automatically flagged Stale.
6. A Stale flag does not remove the existing published translation. It is advisory.
7. Each language is managed independently. No operation on one language affects any other language.

### Governance Rules

8. No UX copy (English or translation) reaches salon teams without human approval.
9. AI generates translations. Only reviewers make manual changes.
10. Every review and approval action is recorded and attributable to a specific user.
11. Bulk approval is available only for translations meeting the 95% confidence threshold (configurable).
12. Approval is required at every environment publishing step.
13. Publishing to Production requires Support Reviewer or Founder approval.

### Publishing Rules

14. The unit of publishing is a page bundle: one page + one language.
15. Once content is approved, it can be published to any target environment (Dev, QA, or Production). The required approver depends on the target environment.
16. MioTranslate is always the source. It publishes content through the Language Services API endpoint for each target environment. No environment acts as a source.
17. Only one version of a page bundle can be active in an environment at a time.
18. Rollback restores a previous version without deleting the rolled-back version.
19. Every publishing action and rollback is recorded.

### Data Integrity Rules

19. Deleted content is never removed from the system. It is marked Deprecated and retained for audit purposes.
20. Audit records are immutable. They cannot be edited, deleted, or archived.
21. Version history is permanent. No version is ever deleted.
22. Comments cannot be deleted. They can be marked resolved.

### Lifecycle Rules

23. A deprecated tag is excluded from active workflows (translation, review, publishing) but remains visible in history and audit.
24. A deactivated language retains all existing translations and history. No new translations or promotions occur.
25. A page is deprecated when all its tags are deprecated.

---

## 8. Permissions & Access Control

| Action | Developer | PM / QA | Localization Reviewer | Support Reviewer | Founder | Administrator |
|---|---|---|---|---|---|---|
| View pages, tags, statuses | Yes | Yes | Yes | Yes | Yes | Yes |
| View version history | Yes | Yes | Yes | Yes | Yes | Yes |
| View audit trail | Yes | Yes | Yes | Yes | Yes | Yes |
| Author/edit English copy | No | Yes | No | No | Yes | No |
| Create AI translations | No | Yes | Yes | No | Yes | No |
| Edit translations manually | No | No | Yes | No | Yes | No |
| Submit for review | No | Yes | Yes | No | Yes | No |
| Approve English copy | No | No | No | Yes | Yes | No |
| Approve translations | No | No | Yes | No | Yes | No |
| Bulk approve translations | No | No | Yes | No | Yes | No |
| Promote to Dev | No | Yes | Yes | Yes | Yes | No |
| Promote to QA | No | No | Yes | Yes | Yes | No |
| Promote to Production | No | No | No | Yes | Yes | No |
| Rollback (any environment) | No | No | No | Yes | Yes | No |
| Escalate to Founder | No | Yes | Yes | Yes | N/A | No |
| Comment | Yes | Yes | Yes | Yes | Yes | Yes |
| Export | No | Yes | Yes | Yes | Yes | Yes |
| Create pages and tags | No | Yes | No | No | Yes | Yes |
| Manage roles | No | No | No | No | Yes | Yes |
| Add/deactivate languages | No | No | No | No | Yes | Yes |
| Configure system settings | No | No | No | No | Yes | Yes |

---

## 9. Cross-Product Functionality

### 9.1 Search

Available globally. Searches across tag IDs, English copy, page names, page IDs. Results link directly to the matching tag.

### 9.2 Filtering

Available on all tag listing views. Filter by: translation state (No Translation, Draft, Pending Review, Approved, Stale), language, page, module, copy type. Filters are combinable.

### 9.3 Bulk Operations

- Translate All: AI-translate all untranslated tags on a page for a language
- Bulk Approve: approve multiple translations meeting the confidence threshold
- Bulk actions are logged as individual audit records per item

### 9.4 Version Comparison

On any tag, compare two versions side by side. Shows before and after text, who changed it, and when. Available for both English copy and translations.

### 9.5 Comments

Attachable to any tag, scoped to English or a specific language. Visible to all users. Cannot be deleted. Can be resolved.

### 9.6 Activity Timeline

System-wide chronological feed of recent actions. Filterable by user, page, language, action type. Shows the 50 most recent actions by default.

### 9.7 Bookmarks

Users can bookmark pages or tags for quick access. Bookmarks are personal (per user).

### 9.8 Recently Edited

Shows the user's recently viewed and edited tags. Personal view.

### 9.9 Exports

CSV and Excel export for any page+language combination. Includes tag ID, English copy, translation, status, and confidence score.

---

## 10. Functional Workflows

### WF-01: New Tag, Full Lifecycle

1. PM creates a new page and tag in MioTranslate
2. Tag is created. Status: Needs English copy.
3. PM/QA authors the official English copy
4. English copy is submitted for review
5. Reviewer approves the English copy
6. PM or Localization Reviewer triggers AI translation for selected languages
7. AI generates translations with back-translations and confidence scores
8. Localization Reviewer reviews each translation
9. Localization Reviewer approves (or edits and approves)
10. Approved content is published to Dev (MioTranslate pushes to the Dev endpoint)
11. QA verifies the labels in context on the Dev build. Developer references the tag ID in MioSalon code.
12. Content is published to QA (QA endpoint)
13. Support team verifies the labels
14. Content is published to Production (Production endpoint)
15. Salon teams see the labels in their language

### WF-02: Update Existing English Copy

1. PM/QA edits the English copy for an existing tag
2. A new English version is created (Draft)
3. PM submits for review
4. Reviewer approves the new English version
5. All translations of that tag across all languages are automatically flagged Stale
6. Each language team resolves staleness independently (confirm or retranslate)
7. Updated English and resolved translations are promoted through Dev, QA, Production

### WF-03: Resolve Stale Translation

1. English copy for a tag changes. Translation is flagged Stale.
2. Localization Reviewer sees the stale flag on the dashboard
3. Reviewer opens the tag and sees: old English, new English, current translation
4. If the translation is still correct: Confirm. Translation returns to Approved.
5. If the translation needs updating: Retranslate. AI generates a new translation. Reviewer approves. New version is promoted.

### WF-04: Translate a Page for a New Language

1. Administrator adds a new language
2. All existing tags across all pages receive empty translation slots for the new language
3. Localization lead uses the coverage dashboard to prioritize high-traffic pages
4. For each priority page, triggers "Translate All" for the new language
5. Reviews and approves translations (bulk and individual)
6. Promotes each completed page through Dev, QA, Production
7. Dashboard tracks progress: "New Language: Page A 100%, Page B 85%, Page C 0%..."

### WF-05: Translate a Single Tag

1. PM or Localization Reviewer selects a tag and a language
2. Triggers AI translation
3. AI generates translation with context, back-translation, and confidence score
4. Reviewer reviews: approves, edits, or requests retranslation
5. Approved translation is included in the next page bundle promotion

### WF-06: Correct a Translation in Production

1. A salon team reports a wrong label in Arabic
2. Support team looks up the tag in MioTranslate
3. Localization Reviewer identifies the error
4. Reviewer corrects the translation manually and approves
5. Updated Arabic is promoted through Dev, QA, Production
6. Alternatively, if urgent: Support Reviewer triggers rollback to previous version while the fix is prepared

### WF-07: Rollback a Bad Promotion

1. Support team discovers a wrong label after promoting to Production
2. Support Reviewer navigates to deployment history
3. Selects the previous version
4. Initiates rollback. Previous version is restored in Production.
5. The bad version remains in MioTranslate for investigation
6. Team fixes the issue, creates a new version, promotes through the pipeline

### WF-08: Bulk Translation Session

1. Localization lead opens a page with many untranslated tags for a language
2. Triggers "Translate All"
3. AI translates all eligible tags
4. Filters by confidence >= threshold. Bulk approves high-confidence translations.
5. Individually reviews low-confidence translations
6. All approved translations are promoted as a page bundle

### WF-09: Create New Page and Tags

1. PM identifies a new MioSalon page that needs UX copy
2. PM creates the page in MioTranslate with the appropriate Page ID, name, and module
3. PM creates tags within the page following the naming convention
4. PM authors English copy for each tag
5. English copy is submitted for review and approved
6. Translations are generated and approved
7. Content is published to the target environments

### WF-10: Investigate a Wrong Label

1. Support receives a report: "Invoice Total" is wrong in Italian
2. Searches "Invoice Total" in MioTranslate
3. Finds tag INVOICE_TOTAL. Views Italian translation history.
4. Sees: v1 translated July 15, approved July 16, deployed to Production July 18. English changed July 20. Italian flagged Stale but never resolved.
5. Root cause identified: stale translation was never re-verified
6. Localization Reviewer resolves the stale flag (retranslates or confirms)
7. New version is promoted through environments

### WF-11: Deprecate a Tag

1. PM or Founder identifies a tag that is no longer needed
2. Tag is marked Deprecated in MioTranslate
3. Developer removes the tag reference from MioSalon's codebase
4. Tag is excluded from active workflows (no further translation or publishing)
5. Tag and all its history remain in MioTranslate for reference

### WF-12: Founder Reviews Sensitive Copy

1. PM authors English copy for a new onboarding flow
2. PM escalates specific labels to Founder for review
3. Founder sees the escalated items in their review queue
4. Founder approves, requests revision, or edits directly
5. Once Founder-approved, the copy proceeds through the normal pipeline

---

## 11. Validation Rules

### Field Validations

| Field | Rule |
|---|---|
| English copy text | Mandatory. Cannot be empty. |
| Tag ID | Immutable after creation. Created in MioTranslate following the naming convention. |
| Page ID | Immutable after creation. Created in MioTranslate following the naming convention. |
| Translation text | Mandatory for approval. Cannot approve an empty translation. |
| Change reason | Optional for content edits. Encouraged but not enforced. |
| Review comment | Optional for approvals. Mandatory for rejections and returns for revision. |

### Lifecycle Validations

| Validation | Rule |
|---|---|
| Translation before English | Cannot create a translation for a tag that lacks approved English copy. |
| Promote before approval | Cannot promote content that is in Draft or Pending Review state. |
| Target environment | Once content is approved, it can be published to any target environment (Dev, QA, or Production). The required approver depends on the target environment. |
| Rollback availability | Cannot rollback if no previous version exists in the target environment. |

### Publishing Validations

| Validation | Rule |
|---|---|
| Bundle completeness | A page bundle can be promoted even if not all tags have translations. Only approved tags are included. |
| Authority | Cannot promote to Production without Support Reviewer or Founder approval. |
| Duplicate prevention | Cannot promote the same version to the same environment if it is already deployed there. |

### Translation Validations

| Validation | Rule |
|---|---|
| Variable integrity | If the English copy contains dynamic placeholders, the translation must preserve them. Failure flags the translation for manual review. |
| Stale acknowledgement | A stale translation cannot be promoted as a new version without being resolved (confirmed or retranslated). |

---

## 12. Notifications & Alerts

| Event | Who Is Notified | Why |
|---|---|---|
| New page or tag created | PM, QA | New tags need English copy |
| English copy submitted for review | Assigned Reviewer | Action required: review |
| English copy approved | Author (PM/QA) | Their submission was approved; translation can begin |
| English copy rejected/returned | Author (PM/QA) | Their submission needs revision |
| Translation ready for review | Localization Reviewer | Action required: review |
| Translation approved | PM | Translation is ready for publishing |
| English copy changed (stale trigger) | All Localization Reviewers for affected languages | Translations may need updating |
| Item escalated to Founder | Founder | Action required: review |
| Page bundle published to Production | PM, Support Reviewer | Labels are now live |
| Rollback initiated | PM, QA, Support Reviewer | A previous version has been restored |
| Publishing failed | PM, Administrator | Action required: investigate and retry |

---

## 13. Reporting & Visibility

### 13.1 Coverage Report

Per language, per page: percentage of tags that are approved and deployed to Production.

### 13.2 Translation Readiness Report

For a selected language: all pages ranked by coverage. Shows how many tags need translation, how many are in Draft, how many are Stale.

### 13.3 Pending Work Report

Across all languages: how many items are waiting for English copy authoring, translation, review, or promotion.

### 13.4 Stale Translations Report

All stale translations, grouped by language and page, sorted by age (oldest first). Helps prioritize stale resolution.

### 13.5 Approval Queue Report

All items pending approval, grouped by type (English copy, translation, promotion), sorted by submission date.

### 13.6 Deployment History Report

For any page and language: chronological list of all promotions and rollbacks with who, when, and what version.

### 13.7 Activity Report

All actions taken by a specific user within a date range. Useful for workload assessment and accountability.

---

## 14. Non-Functional Product Expectations

| Expectation | What It Means |
|---|---|
| **Scalability** | Must support the current number of pages, tags, and languages, and grow as MioSalon grows. Adding new pages, tags, or languages should not degrade performance. |
| **Reliability** | MioTranslate must be consistently available to the internal team during working hours. A failure in MioTranslate must not affect MioSalon's ability to serve UX copy to salon teams (the content delivery system continues to function independently). |
| **Usability** | The product must be usable by non-technical team members (PM, QA, Support). No command-line interaction. No JSON editing. No knowledge of the codebase required. |
| **Auditability** | Every action must be traceable. The audit trail must be permanent and immutable. |
| **Traceability** | Every label in production must be traceable back through its entire lifecycle: who authored it, who reviewed it, who approved it, when it was promoted, and what version is currently live. |
| **Governance** | The product must enforce the defined approval workflows. It must not be possible to bypass governance and push content directly to production. |
| **Data Safety** | No operation in MioTranslate should corrupt or overwrite data in the content delivery system. Content pushes should be atomic: either fully successful or not applied. |

---

## 15. Assumptions

1. The existing content delivery system will remain operational and continue to serve MioSalon's UI. MioTranslate depends on it as the delivery mechanism.
2. The tag naming convention (PAGE_ID_TAG_NUMBER) will be enforced by MioTranslate.
3. The team size will remain small enough that real-time collaborative editing is not required.
4. AI translation services will be available and performant.
5. The support team will continue to act as the production approval authority.
6. The number of environments is fixed at three: Dev, QA, Production. Each environment has its own dedicated Language Services API endpoint.
7. All MioTranslate users are internal team members. No external access is required.

---

## 16. Constraints

1. **No changes to MioSalon's rendering.** MioSalon's tag system, its content delivery mechanism, and how MioSalon displays UX copy remain unchanged.
2. **All translations require human approval.** No AI-generated translation can reach salon teams without human review.
3. **Translation rules are not defined yet.** The specific rules governing how translations should be created will be defined as a subsequent deliverable.
4. **Developer write access to the Language Services API will be revoked.** After migration, MioTranslate is the only system that writes to the Language Services API.
5. **English is always the source language.** All translations are derived from approved English copy.

---

## 17. Open Questions

### Resolved

| Question | Resolution |
|---|---|
| What is the exact confidence threshold for bulk approval? | **95%.** Translations with 95% or higher AI confidence are eligible for bulk approval. This is configurable. |
| Which pages or labels require Founder-level approval? | **Dynamic.** There is no fixed list of pages. Any copy that confuses the PM or the team, or where the team is not certain it would work, is escalated to the Founder for review. Escalation is a judgment call, not a system-enforced rule per page. |
| Should the Dev environment publishing be implicit or explicit? | **Implicit.** Once the required content and approval conditions are met, approved content is automatically published to Dev through the Dev API endpoint. |
| How should MioTranslate handle tags shared across multiple pages? | **Page-scoped.** Tags remain page-scoped. Each tag belongs to one page. Similar copy can be reused conceptually, but a tag is not shared across pages unless a future requirement explicitly introduces shared tags. |
| What is the expected response time for AI translation? | **Accuracy is P0, response time is P1.** The system should balance response time and accuracy, but accuracy must never be compromised for speed. |
| How will the support team's approval workflow integrate with their existing processes? | **MioTranslate becomes the formal approval layer.** MioTranslate becomes the formal approval layer for production promotion. Support receives a production review queue with the required context and can approve, reject, comment, and trigger the appropriate next step. |
| Are there any restrictions on which target environments can be selected for publishing? | **No restrictions. Best practice recommended.** Approved content can be published to any target environment. Dev, QA, and Production each have their own approval requirement; MioTranslate remains the source and the environments are targets. The recommended best practice is Dev, then QA, then Production. |

### Open

All open questions have been resolved.

---

## 18. Future Considerations

These items are explicitly out of scope for the current initiative but are anticipated as future enhancements.

1. **Translation memory** (reuse previously approved translations for identical or similar English copy across pages)
2. **Terminology glossary** (define standard translations for key terms like "appointment," "invoice," "walk-in" across all languages)
3. **Real-time collaborative editing** (if the team grows significantly)
4. **Translation rules engine** (formalized rules governing tone, terminology, and context for each language)
6. **Content analytics** (which labels are most frequently edited, which languages have the most stale translations, which pages require the most review effort)
6. **Integration with CI/CD pipeline** (automatically notify developers when new tags are available for reference in code)
8. **Multi-product support** (if MioTranslate is used for products beyond MioSalon in the future)
