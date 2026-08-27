# MioTranslate
## UX Flow Document

---

**Product:** MioTranslate  
**Document Type:** UX Flow Document  
**Source Documents:** MioTranslate Business Requirement Document (Approved), MioTranslate Functional Requirements Document (Approved), MioTranslate User Flow Document (Approved)  
**Audience:** UX Design, Product, Engineering, QA  
**Date:** August 2026  

---

## 1. Purpose and Scope

This document defines **what the user experiences at every meaningful step** of the approved User Flows. It is the interaction-level specification that bridges the User Flow Document (what the user accomplishes) to the UI/IA stage (how the interface is laid out).

This document answers: *At each step, what does the user see? What can the user do? What does the system communicate back? What state does the system move into? Where does the user go next?*

This document is:

- The UX behavior specification for every flow in the approved User Flow Document (UF-01 through UF-19)
- A guide for how the system should respond to user actions — states, feedback, transitions, decisions, handoffs, and edge cases
- The foundation from which a UX Designer will create wireframes, prototypes, and detailed UI specifications
- A QA reference for expected behavior across all interaction paths

This document is not:

- A UI specification. No layouts, component choices, colors, typography, or visual hierarchy are prescribed.
- A wireframe or prototype. No screen arrangements are defined.
- An architecture or API document. No implementation decisions are made.
- A replacement for the BRD, FRD, or User Flow Document. Those remain authoritative for their respective scopes.

### 1.1 Source-of-Truth Hierarchy

| Layer | Document | Defines |
|---|---|---|
| Why | BRD | Business problems, objectives, vision |
| What | FRD | Functional capabilities, business rules, data model |
| Accomplishment | User Flow Document | What the user accomplishes, step sequences, decision points |
| **Experience** | **This Document** | **How the system is experienced at each step** |
| Interface | UI/IA (next stage) | How the interface is laid out, visual design |

### 1.2 Governing Rules

1. **No invention.** Every UX behavior described here traces to an approved behavior in the BRD, FRD, or User Flow Document. No new product capabilities are introduced.
2. **No UI decisions.** This document describes *what the user experiences*, not *what the interface looks like*. Terms like "the user sees," "the system communicates," and "the user is informed" are used instead of "a modal appears," "a toast notification shows," or "a sidebar opens."
3. **Conflict flagging.** If a conflict is discovered between the BRD, FRD, and User Flow Document, it is flagged as an **OPEN DECISION** rather than silently resolved.
4. **Established direction preserved.** The following product decisions are settled and not reopened: MioTranslate is the single entry point and source of truth; English is the source language; all translations require human approval; publishing is environment-aware (Dev, QA, Production); auditability is core.

### 1.3 How to Read This Document

**Structure per UX Flow:**

Each UX Flow corresponds to one approved User Flow (UF-01 through UF-19). Within each flow, the experience is documented step-by-step using these elements:

| Element | Meaning |
|---|---|
| **STEP n** | A discrete interaction moment in the flow |
| **User Intent** | What the user is trying to do at this step |
| **System State (Before)** | What state the system is in when the user arrives at this step |
| **User Action** | What the user does |
| **System Response** | What the system does in response — validation, state change, feedback |
| **System State (After)** | What state the system moves to after this step |
| **Feedback to User** | What the system communicates back to the user |
| **Next Step** | Where the user goes next — the next step in the flow, a decision branch, or a handoff |
| **DECISION** | A branching point where the experience diverges based on a condition |
| **EDGE CASE** | A non-obvious scenario that requires specific behavior |
| **ERROR** | A failure condition and what the user experiences when it occurs |
| **HANDOFF** | A moment where responsibility transfers to a different role |
| **STATE TRANSITION** | An explicit change in the underlying data state that the user should be aware of |

**Notation for system feedback:**

- **Confirmation feedback** — The system acknowledges a successful action
- **Validation feedback** — The system prevents an invalid action and explains why
- **Advisory feedback** — The system surfaces information the user should be aware of but does not block progress
- **Progress feedback** — The system communicates that a long-running operation is in progress
- **Conflict feedback** — The system alerts the user to a conflict requiring resolution

**Roles referenced:** Same abbreviations as the User Flow Document (PM, QA, LR, SR, FN, DEV, ADMIN).

---

## 2. State Model Summary

Before documenting individual flows, this section summarizes the state models that govern the UX experience. These are drawn directly from the FRD (§4.3, §4.4, §4.5, §4.6, §4.9) and are not modified.

### 2.1 English Copy States

```
[No Copy] → [Draft] → [Pending Review] → [Approved]
                ↑            |                  |
                |            |                  |
                +--- Returned for Revision -----+
                |                               |
                +-------- Edit creates new -----+
                         version as Draft
```

| State | Meaning to User | User Can... |
|---|---|---|
| No Copy | Tag exists but no English text has been written | Author new English copy |
| Draft | Text has been written but not submitted for review | Edit, submit for review, or discard changes |
| Pending Review | Text has been submitted and is awaiting a reviewer's action | View (author); Approve, reject, return, or escalate (reviewer) |
| Approved | Text has been reviewed and approved; eligible for translation and publishing | Edit (creates new Draft version); translate; publish |

### 2.2 Translation States

```
[No Translation] → [Draft] → [Pending Review] → [Approved] → [Stale]
                      ↑            |                              |
                      |            |                              |
                      +--- Rejected / Retranslated -----+---------+
                      |                                           |
                      +------ Retranslated (new Draft) ----------+
                                                                  |
                                                    Confirmed → [Approved]
```

| State | Meaning to User | User Can... |
|---|---|---|
| No Translation | No translation exists for this tag in this language | Create AI translation; manually enter (reviewer only) |
| Draft | Translation exists but has not been reviewed | Review, edit, approve, reject, or request retranslation |
| Pending Review | Translation has been submitted for reviewer action | Approve, reject, return, or request retranslation (reviewer) |
| Approved | Translation has been human-approved; eligible for publishing | Publish; will become Stale if English source changes |
| Stale | English source changed after this translation was approved; accuracy is uncertain | Confirm as still correct (returns to Approved); retranslate (creates new Draft) |

### 2.3 Publishing States (Per Page Bundle: One Page + One Language + One Environment)

| State | Meaning to User |
|---|---|
| Never Published | No version of this page bundle has been published to this environment |
| Published (Version N) | Version N is currently live in this environment |
| Rolled Back (to Version N-1) | A rollback has occurred; a previous version is now live |

### 2.4 Tag and Page Lifecycle

| State | Meaning to User |
|---|---|
| Active | Tag/page is in use; eligible for all workflows |
| Deprecated | Tag/page has been marked as no longer needed; excluded from active workflows; history preserved |

### 2.5 Language Lifecycle

| State | Meaning to User |
|---|---|
| Active | Language is accepting new translations and promotions |
| Inactive | Language retains all history and translations but no new work can be done |

---

## 3. Foundation Flows

---

### UX-01: Register a New Page and Create Tags

**Source:** UF-01  
**Primary Actor:** PM  
**Core Question:** What does the PM experience when establishing a new page and its tags in MioTranslate?

---

**STEP 1 — Initiate Page Registration**

- **User Intent:** Create a new page in MioTranslate for a MioSalon screen
- **System State (Before):** The user is anywhere in MioTranslate with access to the page creation action
- **User Action:** The PM initiates the "create page" action
- **System Response:** The system presents the page creation context, requesting: Page ID (required), Page Name (required), and Module (optional)
- **Feedback to User:** The input context is ready. If MioTranslate has zero pages, the system surfaces an empty-state message guiding the user to create the first page or initiate migration (→ UX-02)
- **Next Step:** Step 2

**STEP 2 — Provide Page Details**

- **User Intent:** Enter the Page ID (received from the developer), a human-readable name, and the module
- **User Action:** The PM enters the Page ID and Page Name. The PM optionally selects a Module from the defined list (POS, CRM, Calendar, Reporting, Settings, Staff).
- **System Response:** The system validates in real time:
  - Page ID is unique across MioTranslate
  - Page ID is not empty
- **Feedback to User:**
  - **Validation feedback** (if duplicate): "Page ID already exists." The PM must verify the correct Page ID with the developer (FRD §F-02).
  - **Validation feedback** (if empty): Page ID is mandatory.
- **Next Step:** Step 3 (if valid)

**STEP 3 — Confirm Page Registration**

- **User Intent:** Confirm that the page details are correct
- **User Action:** The PM confirms the page creation
- **System Response:** The system creates the page. Records the creation in the audit trail (who, when, Page ID, Page Name, Module if set).
- **State Transition:** Page status → Active
- **Feedback to User:** **Confirmation feedback** — Page has been registered. The page now appears in the page browsing context.
- **Next Step:** Step 4

**STEP 4 — Create Tags Within the Page**

- **User Intent:** Create one or more tags for the newly registered page
- **User Action:** For each tag, the PM provides:
  - Tag ID (following the PAGE_ID prefix naming convention)
  - Copy Type (optional: button, label, error message, header, placeholder, helper text, status badge, filter option, table header, validation message)
- **System Response:** For each tag, the system validates:
  - Tag ID is unique across MioTranslate
  - Tag ID follows the naming convention (PAGE_ID prefix)
  - Tag ID is not empty
- **System Response (on valid tag):** Creates the tag in MioTranslate. Records the creation in the audit trail. The tag is not created in the Language Services API at this point — tag content (approved English copy and translations) reaches Language Services only when approved content is published via the Language Services API.
- **State Transition:** Tag status → Active. English copy status → No Copy ("Needs English copy")
- **Feedback to User:**
  - **Confirmation feedback** (per tag): Tag created successfully.
  - **Validation feedback** (duplicate Tag ID): "Tag ID already exists." (FRD §F-02)
  - **Validation feedback** (naming convention violation): Tag ID must follow the naming convention.
- **Next Step:** The PM can create additional tags (repeat Step 4) or proceed to review

**STEP 5 — Review the Registered Page and Tags**

- **User Intent:** Confirm that the page and all its tags are correct and complete
- **System State (After):** The page appears in the page browsing context. All tags are listed within the page with "Needs English copy" status. No translations exist.
- **Feedback to User:** The page detail context shows all created tags with their Tag ID, Copy Type (if set), and status ("Needs English copy").
- **Next Step:** Tags are ready for English copy authoring (→ UX-03). The developer references the created Tag IDs in the MioSalon codebase (external handoff, not tracked in MioTranslate).

**DECISION: Alternate Paths**

- **ALT-A: PM creates additional tags later.** The PM can return to any existing active page and create additional tags at any time. The experience is identical to Step 4. This is common when a developer adds new labels to an existing page.
- **ALT-B: PM does not author English copy immediately.** Tags remain in "Needs English copy" state indefinitely. This is a valid holding state. The coverage dashboard will reflect these as tags without English copy.
- **ALT-C: Founder creates the page.** The Founder has the same permissions and follows the identical experience.

**EDGE CASE: Developer has not provided the Page ID.** The PM cannot proceed. The system does not block this scenario — it simply requires a Page ID to be entered. The PM must coordinate offline with the developer. MioTranslate does not discover or suggest Page IDs (established direction: no codebase discovery).

---

### UX-02: Initial One-Time Migration

**Source:** UF-02  
**Primary Actor:** FN / ADMIN  
**Core Question:** What does the Founder/Administrator experience when loading all existing UX copy into MioTranslate for the first time?

---

**STEP 1 — Prepare for Migration**

- **User Intent:** Begin the migration process to load existing UX copy into MioTranslate
- **System State (Before):** MioTranslate is deployed and operational, with zero pages and zero tags (or the empty state from UX-01)
- **Precondition (external):** The FN/ADMIN has exported/downloaded the existing UX copy and translations from the current multilingual module. A full backup snapshot of the source data has been taken.
- **User Action:** The FN/ADMIN initiates the import process
- **System Response:** The system presents the import context, requesting the exported data file
- **Next Step:** Step 2

**STEP 2 — Import the Data**

- **User Intent:** Load all pages, tags, English copy, and translations from the exported file
- **User Action:** The FN/ADMIN provides the exported data to MioTranslate through the import mechanism
- **System Response:** The system processes the import:
  - Registers all pages
  - Creates all tags
  - Loads English copy
  - Loads translations across all languages
  - Imported content enters as "Published in Production" (since it is already live in the current system) (FRD §F-21)
  - Records the import event in the audit trail
- **Feedback to User:**
  - **Progress feedback:** The system communicates import progress (pages processed, tags created, translations loaded)
  - **Confirmation feedback (on success):** Import completed. Summary: [N] pages, [N] tags, [N] translations across [N] languages imported.
- **State Transition:** All imported content → Published in Production status
- **Next Step:** Step 3

**ERROR: Import fails.**
- The import process encounters an error and cannot complete
- **System Response:** No data is partially loaded. Data safety requires atomicity (FRD §14). The failed import event is recorded in the audit trail.
- **Feedback to User:** **Validation feedback** — Import failed. No data has been modified. The FN/ADMIN can investigate the issue and retry.

**STEP 3 — Review the Validation Report**

- **User Intent:** Confirm that the import was complete and accurate
- **System Response:** The system generates a validation report comparing MioTranslate's registry against the imported source data
- **Feedback to User:** The validation report shows:
  - Total pages imported vs. expected
  - Total tags imported vs. expected
  - Total translations imported vs. expected (per language)
  - Any discrepancies (missing pages, missing tags, missing translations, mismatched values)
- **Next Step:** Step 4 (if zero discrepancies) or DECISION-A (if discrepancies found)

**DECISION-A: Validation report shows discrepancies.**
- **Option A:** Fix the discrepancies manually in MioTranslate and re-validate. The FN/ADMIN uses the standard flows (UX-01, UX-03) to add missing content.
- **Option B:** Roll back to the pre-migration state using the backup snapshot and re-attempt the migration from Step 1.
- **Feedback to User:** **Advisory feedback** — Discrepancies found. The report itemizes each discrepancy. The FN/ADMIN must resolve all discrepancies before proceeding to Step 4.

**STEP 4 — Revoke Developer Write Access**

- **User Intent:** Ensure MioTranslate is the only system that writes to the Language Services API going forward
- **User Action:** The FN/ADMIN revokes developer write access to the Language Services API (this is an external administrative action, not performed within MioTranslate)
- **System State (After):** MioTranslate is the authoritative entry point for all UX copy management. All future UX copy changes go through MioTranslate exclusively.
- **Feedback to User:** **Confirmation feedback** — Migration complete. MioTranslate is now the single source of truth.
- **Next Step:** The system is ready for normal operations. The PM can browse content (→ UX-13), assess coverage (→ UX-14), and begin managing content through the standard flows.

---

## 4. Content Lifecycle Flows

---

### UX-03: Author and Approve English UX Copy

**Source:** UF-03  
**Primary Actor:** PM (author), SR (reviewer/approver)  
**Core Question:** What does the PM experience when writing English copy, and what does the reviewer experience when approving or returning it?

---

**STEP 1 — Navigate to the Tag**

- **User Intent:** Find the tag that needs English copy
- **User Action:** The PM navigates to a tag via page browsing (→ UX-13) or search
- **System Response:** The system displays the tag in context:
  - Tag ID, Page Name, Module, Copy Type (if set)
  - Current English copy status (No Copy, Draft, Pending Review, or Approved)
  - If approved English copy exists: the current approved text is visible as reference
  - If a Draft version exists: the draft text is visible with its last-edited timestamp and author
- **Next Step:** Step 2

**STEP 2 — Write the English Copy**

- **User Intent:** Author the official English text for this tag
- **User Action:** The PM writes the English text. Optionally selects or changes the Copy Type. Optionally adds a change reason explaining why this text was chosen or what changed.
- **System Response:** The system holds the text as an unsaved draft in the current session
- **Feedback to User:** The system indicates unsaved changes are present
- **Next Step:** Step 3 (save as Draft) or Step 4 (submit for review)

**STEP 3 — Save as Draft (ALT-C from UF-03)**

- **User Intent:** Save work without submitting for review
- **User Action:** The PM saves the English copy as Draft
- **System Response:** The system saves the text. Records the action in the audit trail.
- **State Transition:** English copy status → Draft
- **Feedback to User:** **Confirmation feedback** — Saved as Draft. The reviewer is not notified.
- **Next Step:** The PM can return later to edit further or submit for review

**STEP 4 — Submit for Review**

- **User Intent:** Send the English copy to a reviewer for approval
- **User Action:** The PM submits the English copy for review
- **System Response:** The system validates:
  - English copy text is not empty (FRD §11). **ERROR:** If empty → **Validation feedback** — "English copy text is mandatory."
- **System Response (on valid submission):** English copy status → Pending Review. Version is recorded. The assigned reviewer (SR) is notified (FRD §12).
- **State Transition:** English copy status → Pending Review
- **Feedback to User:** **Confirmation feedback** — Submitted for review. The PM can see the status has changed to Pending Review.
- **Next Step:** HANDOFF → Support Reviewer (Step 5)

**HANDOFF → Support Reviewer**

**STEP 5 — Reviewer Receives the Submission**

- **User Intent (SR):** Review submitted English copy
- **System State (Before):** The item appears in the SR's review queue, marked as English copy pending review
- **System Response:** The system presents the submission in review context:
  - The submitted English text
  - Tag ID, Page Name, Module, Copy Type
  - Previous approved version (if this is an edit, not first authoring)
  - The author and submission timestamp
  - The change reason (if provided)
  - Any comments on this tag
- **Next Step:** DECISION (Step 6)

**STEP 6 — DECISION: Review Outcome**

The reviewer evaluates the copy and takes one of four actions:

**Path A — Approve (Main Success)**

- **User Action (SR):** Approves the English copy. Optionally adds a reviewer comment.
- **System Response:** English copy status → Approved. Approval is recorded in the audit trail (who approved, when). The author (PM) is notified (FRD §12).
- **State Transition:** English copy status → Approved
- **System Response (if this is an edit of existing approved copy):** All existing translations of this tag across all languages are automatically flagged Stale (FRD §5.2). The system generates advisory feedback for the approver indicating how many translations were flagged Stale and in which languages.
- **Feedback to User (SR):** **Confirmation feedback** — Approved. [If stale was triggered: "N translations across N languages have been flagged Stale."]
- **Feedback to User (PM, asynchronous):** Notification — English copy approved.
- **Next Step:** The tag is now eligible for translation (→ UX-04, UX-05) and publishing (→ UX-10).

**Path B — Return for Revision (ALT-A from UF-03)**

- **User Action (SR):** Returns the English copy to Draft with a mandatory comment explaining what needs to change
- **System Response:** The system validates that a comment is provided (FRD §11, Review comment mandatory for rejections/returns). English copy status → Draft. The rejection and comment are recorded in the audit trail. The author (PM) is notified with the reviewer's comment.
- **Feedback to User (SR):** **Confirmation feedback** — Returned for revision.
- **Feedback to User (PM, asynchronous):** Notification — English copy returned for revision with reviewer's comment.
- **Next Step:** The PM revises the text and resubmits (returns to Step 2)

**Path C — Escalate to Founder (ALT-B from UF-03)**

- **User Action (SR):** Flags the English copy for Founder review. Adds a comment explaining why escalation is needed.
- **System Response:** The item moves to the Founder's review queue. The Founder is notified (FRD §12). Escalation is recorded in the audit trail.
- **Feedback to User (SR):** **Confirmation feedback** — Escalated to Founder.
- **Next Step:** → UX-09 (Founder Reviews Escalated Copy)

**Path D — Reject (EXCEPTION-3 from UF-03)**

- **User Action (SR):** Rejects the copy with a mandatory reason
- **System Response:** The rejection and reason are recorded. English copy remains in Draft or returns to its previous state.
- **Feedback to User (SR):** **Confirmation feedback** — Rejected.
- **Feedback to User (PM, asynchronous):** Notification — English copy rejected with reason.
- **Next Step:** The PM may revise and resubmit, or abandon

**ERROR: Concurrent Editing Conflict (EXCEPTION-2 from UF-03)**
- **Trigger:** Two users attempt to edit the same tag's English copy simultaneously
- **System Response:** The second save encounters a conflict
- **Feedback to User (second editor):** **Conflict feedback** — "This tag's English copy has been modified by [user] since you started editing. Please refresh to see the latest version and re-apply your changes."
- **Resolution:** The second user must refresh and resolve the conflict manually

**EDGE CASE: QA Authors English Copy (ALT-D from UF-03)**
- QA has the same authoring permissions as PM (FRD §8). The experience is identical. This is common when QA identifies a misleading label during testing.

**EDGE CASE: Multiple Tags Authored in Sequence (ALT-E from UF-03)**
- The PM authors English copy for multiple tags on the same page in a single working session. Each tag follows the same lifecycle independently. The system does not batch submissions — each tag is an independent unit.

---

### UX-04: Translate a Single Tag

**Source:** UF-04  
**Primary Actor:** PM or LR (triggers translation) / LR (reviews and approves)  
**Core Question:** What does the user experience when creating, reviewing, and approving a translation for one tag in one language?

---

**STEP 1 — Select the Tag and Language**

- **User Intent:** Translate a specific tag into a specific language
- **User Action:** The PM or LR selects a tag and a target language
- **System Response:** The system displays the tag in translation context:
  - English source copy (approved version)
  - Current translation state for the selected language (No Translation, Draft, Approved, or Stale)
  - If a translation already exists: the current translation text, its status, and the English version it was based on
- **Next Step:** Step 2

**ERROR: Tag Lacks Approved English Copy (EXCEPTION-2 from UF-04)**
- **System Response:** The system prevents translation. The translate action is not available.
- **Feedback to User:** **Validation feedback** — "This tag must have approved English copy before it can be translated." The user is guided to UX-03.

**STEP 2 — Trigger AI Translation**

- **User Intent:** Generate an AI-assisted translation
- **User Action:** The PM or LR triggers AI translation
- **System Response:** AI generates a translation using business context:
  - The page the tag appears on
  - The module
  - The copy type
  - Salon/spa industry terminology
  - Translation rules (when defined)
- AI also generates:
  - A back-translation (the translated text rendered back into English)
  - A confidence score
  - Variable/placeholder integrity verification
- **State Transition:** Translation status → Draft
- **Feedback to User:**
  - **Confirmation feedback** — Translation generated. The system displays the AI-generated translation alongside the English source, back-translation, confidence score, and variable integrity status.
  - **Progress feedback** (if the translation takes more than a moment) — Translation in progress.
- **Next Step:** HANDOFF → Localization Reviewer (Step 3)

**ERROR: AI Translation Service Unavailable (EXCEPTION-1 from UF-04)**
- **Feedback to User:** **Validation feedback** — "Translation service is currently unavailable. Please try again later." The translation remains as "No Translation." The user can retry.

**HANDOFF → Localization Reviewer**

**STEP 3 — Review the Translation**

- **User Intent (LR):** Evaluate whether the AI-generated translation is accurate and contextually appropriate
- **System Response:** The system presents the translation in review context:
  - The English source copy
  - The AI-generated translation
  - The back-translation
  - The confidence score
  - Variable integrity status (pass/fail, with specific details if fail)
  - Page Name, Module, Copy Type — for business context
  - Any comments on this tag
- **Next Step:** DECISION (Step 4)

**STEP 4 — DECISION: Review Outcome**

**Path A — Approve (Main Success)**
- **User Action (LR):** Approves the translation
- **System Response:** Translation status → Approved. The approval is recorded in the audit trail (who, when, which English version it was based on). The PM is notified.
- **Feedback to User (LR):** **Confirmation feedback** — Translation approved. Eligible for publishing.
- **Next Step:** → UX-10 (Publish)

**Path B — Edit and Approve (ALT-A from UF-04)**
- **User Action (LR):** Corrects the translation manually, then approves
- **System Response:** The manual correction is recorded as a new entry in the version history, noting it was a reviewer edit. Translation status → Approved.
- **Feedback to User (LR):** **Confirmation feedback** — Corrected and approved.

**Path C — Request Retranslation (ALT-B from UF-04)**
- **User Action (LR):** Requests the AI to regenerate the translation
- **System Response:** AI regenerates the translation. The new translation enters as Draft. The review cycle restarts at Step 3.
- **Feedback to User (LR):** **Confirmation feedback** — Retranslation requested. New draft generated.

**Path D — Reject (ALT-C from UF-04)**
- **User Action (LR):** Rejects the translation with a mandatory reason
- **System Response:** Translation remains in Draft or returns to "No Translation." The rejection is recorded.
- **Feedback to User (LR):** **Confirmation feedback** — Rejected.

**EDGE CASE: Variable Integrity Check Fails (ALT-D from UF-04)**
- The system flags the translation because a dynamic placeholder from the English copy was not preserved
- **Feedback to User (LR):** **Advisory feedback** — "Variable integrity issue: [specific placeholder] from the English copy is missing or modified in the translation." The reviewer must correct the placeholder issue before approving, or override with explicit acknowledgment.
- The translation requires manual review regardless of confidence score (FRD §F-06)

**EDGE CASE: English Copy Changes During Review (ALT-E from UF-04)**
- If the English copy is updated while the translation is being reviewed, the translation is flagged Stale
- **Feedback to User (LR):** **Advisory feedback** — "The English source for this tag has changed since this translation was generated. Please re-evaluate against the new English copy." The reviewer is directed to UX-08 (Resolve Stale Translations).

---

### UX-05: Bulk Translate a Page for a Language

**Source:** UF-05  
**Primary Actor:** PM or LR  
**Core Question:** What does the user experience when generating AI translations for all untranslated tags on a page at once?

---

**STEP 1 — Select the Page and Language**

- **User Intent:** Translate all untranslated tags on a page for a specific language in one operation
- **User Action:** The PM or LR selects a page and a target language
- **System Response:** The system displays the page in bulk translation context:
  - Total tags on the page
  - Tags eligible for translation (have approved English copy and no existing Draft or Approved translation for the selected language)
  - Tags that will be skipped (already have a translation, or lack approved English copy, or are Stale)
  - Clear counts for each category
- **Next Step:** Step 2

**EDGE CASE: All Tags Already Have Translations (ALT-A from UF-05)**
- **Feedback to User:** **Advisory feedback** — "All tags already have translations for [language]." The "Translate All" action is not available or is inactive.

**STEP 2 — Trigger Bulk Translation**

- **User Intent:** Generate translations for all eligible tags
- **User Action:** The PM or LR triggers "Translate All"
- **System Response:** The system identifies all eligible tags and begins AI translation for each:
  - Each tag receives a translation with business context, back-translation, confidence score, and variable integrity check
  - All translations enter as Draft
- **Feedback to User:**
  - **Progress feedback** — Translation in progress. [N of M tags translated.] (Especially important for pages with 100+ tags — ALT-C from UF-05)
  - **Confirmation feedback (on completion):** Bulk translation complete. Summary:
    - [N] translations generated
    - [N] tags skipped (already translated)
    - [N] tags skipped (no approved English copy)
- **State Transition:** Each translated tag's translation status → Draft
- **Next Step:** Translations are ready for review (→ UX-06 for individual review, → UX-07 for bulk approval of high-confidence translations)

**ERROR: AI Service Partially Fails (EXCEPTION-1 from UF-05)**
- Some translations succeed, some fail
- **Feedback to User:** **Advisory feedback** — "Translation completed with errors. [N] translations generated successfully. [N] tags failed — [reason]. Failed tags can be retried individually or through another bulk operation."
- Successfully generated translations remain as Draft. The user can see which specific tags failed.

**EDGE CASE: Some Tags Lack Approved English Copy (ALT-B from UF-05)**
- Those tags are skipped. The count of skipped tags is included in the completion summary. The user is informed that English copy must be authored first (→ UX-03).

---

### UX-06: Review and Approve Translations

**Source:** UF-06  
**Primary Actor:** LR  
**Core Question:** What does the Localization Reviewer experience when working through a queue of translations requiring review?

---

**STEP 1 — Access the Review Queue**

- **User Intent:** Find translations that need review
- **User Action:** The LR opens the review queue or navigates to a page and filters by translations in Draft or Pending Review state for a specific language
- **System Response:** The system presents the reviewable translations:
  - Each item shows: Tag ID, Page Name, English source text, translated text (preview), confidence score, variable integrity status
  - Items are sortable and filterable by: page, language, confidence score, submission date
  - The total count of items pending review is visible
- **Next Step:** Step 2

**STEP 2 — Select a Translation to Review**

- **User Intent:** Review an individual translation
- **User Action:** The LR selects a translation from the queue
- **System Response:** The system presents the full review context (identical to UX-04, Step 3):
  - English source copy
  - Translation text
  - Back-translation
  - Confidence score
  - Variable integrity status
  - Page Name, Module, Copy Type
  - Comments
- **Next Step:** DECISION (Step 3)

**STEP 3 — DECISION: Review Outcome**

The four paths (Approve, Edit and Approve, Request Retranslation, Reject) are identical to those defined in UX-04, Step 4. The system responses, state transitions, and feedback are the same.

**After each review action:**

**STEP 4 — Proceed to Next Item**

- **User Intent:** Continue reviewing the queue
- **System Response:** The system advances to the next translation in the queue. The reviewed item is removed from the pending list. The remaining count is updated.
- **Feedback to User:** The queue count decreases. The next item is presented.
- **Next Step:** Repeat from Step 2 until the queue is empty or the reviewer stops

**EDGE CASE: Variable Integrity Failure (ALT-D from UF-06)**
- The system warns the reviewer that the translation has a variable integrity issue
- **Feedback to User:** **Advisory feedback** — "Variable integrity issue detected." The reviewer can override with acknowledgement, or correct the translation before approving (FRD §F-08)

**EDGE CASE: English Copy Changes During Review (EXCEPTION-1 from UF-06)**
- The translation is flagged Stale
- **Feedback to User:** **Advisory feedback** — "The English source for this tag has changed. This translation is now Stale." The reviewer is informed that the review is paused for this item until the stale flag is resolved (→ UX-08). The item may remain in the queue with a Stale indicator, or be moved to the stale resolution queue.

---

### UX-07: Bulk Approve High-Confidence Translations

**Source:** UF-07  
**Primary Actor:** LR  
**Core Question:** What does the Localization Reviewer experience when efficiently approving multiple high-confidence translations at once?

---

**STEP 1 — Navigate to Translations for a Page and Language**

- **User Intent:** Find high-confidence translations eligible for bulk approval
- **User Action:** The LR navigates to translations for a specific page and language
- **System Response:** The system displays all translations for the page/language with their confidence scores and statuses

**STEP 2 — Filter by Confidence Threshold**

- **User Intent:** Focus on translations meeting the bulk approval threshold
- **User Action:** The LR filters translations by confidence score at or above the configurable threshold (default: 95%, FRD §17)
- **System Response:** The filtered set is displayed. Each item shows: Tag ID, English source, translated text, back-translation (summary), confidence score, variable integrity status
- **Feedback to User:** "[N] translations meet the confidence threshold and are eligible for bulk approval."
- **Next Step:** Step 3

**EDGE CASE: All Translations Below Threshold (ALT-A from UF-07)**
- **Feedback to User:** **Advisory feedback** — "No translations meet the confidence threshold for bulk approval. All translations must be individually reviewed." The user is directed to UX-06.

**STEP 3 — Review at Summary Level**

- **User Intent:** Spot-check the filtered set for general quality before bulk approving
- **System Response:** The system presents the filtered set in a summary view. The LR can scan the English source alongside the translations. The LR can select individual items to drill into full review context if needed.

**STEP 4 — Select and Initiate Bulk Approval**

- **User Intent:** Approve all selected high-confidence translations at once
- **User Action:** The LR selects multiple translations and initiates bulk approval
- **System Response:** The system validates each selected translation:
  - Meets the confidence threshold
  - No variable integrity failure
  - Translations with variable integrity failures are excluded and the reviewer is notified (ALT-B from UF-07)
- **Feedback to User:** **Advisory feedback** (if exclusions): "[N] translation(s) excluded from bulk approval due to variable integrity issues. These require individual review."

**STEP 5 — Confirm Bulk Approval**

- **User Intent:** Confirm the bulk action
- **User Action:** The LR confirms the bulk approval
- **System Response:** Each individual translation in the selection is approved and recorded as a separate audit trail entry (FRD §F-09). All approved translations move to "Approved" status.
- **Feedback to User:** **Confirmation feedback** — "[N] translations approved. Each approval recorded individually."
- **State Transition:** Each selected translation status → Approved
- **Next Step:** The LR turns attention to the remaining low-confidence translations for individual review (→ UX-06)

---

### UX-08: Resolve Stale Translations

**Source:** UF-08  
**Primary Actor:** LR  
**Core Question:** What does the Localization Reviewer experience when evaluating and resolving translations flagged as stale?

---

**STEP 1 — Identify Stale Translations**

- **User Intent:** Find stale translations that need resolution
- **User Action:** The LR accesses stale translations through one of three paths:
  - The stale translations list (grouped by language and page, sorted by age — oldest first)
  - The coverage dashboard
  - A notification that English copy changed for tags they manage
- **System Response:** The system presents all stale translations with:
  - Tag ID, Page Name
  - Language
  - Age of staleness (how long since the English copy changed)
  - Total count of stale translations
- **Next Step:** Step 2

**STEP 2 — Open a Stale Translation**

- **User Intent:** Evaluate whether the English change affects this translation
- **User Action:** The LR selects a stale translation
- **System Response:** The system presents the stale resolution context:
  - **Previous English copy** (what the translation was originally based on)
  - **New English copy** (what the English text now says)
  - A visual or textual indication of what changed between the two English versions
  - **Current translation** (the existing translation, which is still deployed)
  - Back-translation of the current translation
  - The translation's approval date and the reviewer who approved it
- **Next Step:** DECISION (Step 3)

**STEP 3 — DECISION: Does the English Change Affect the Translation?**

**Path A — Confirm (Translation Is Still Correct)**
- **User Action (LR):** Confirms the existing translation is still accurate despite the English change
- **System Response:** Translation status returns to Approved. The system records which English version the translation was confirmed against. The confirmation is recorded in the audit trail.
- **Feedback to User (LR):** **Confirmation feedback** — Translation confirmed as still correct.
- **State Transition:** Translation status → Approved (no longer Stale)

**Path B — Retranslate (Translation Needs Updating)**
- **User Action (LR):** Triggers retranslation
- **System Response:** AI generates a new translation based on the new English copy. The new translation enters as Draft, replacing the stale version in the workflow (the stale version is preserved in version history). The currently deployed (stale) translation remains live in production until a new version is published.
- **Feedback to User (LR):** **Confirmation feedback** — Retranslation generated. New draft ready for review.
- **State Transition:** New translation → Draft (old stale version preserved in history)
- **Next Step:** The new Draft goes through the standard review cycle (→ UX-06)

**EDGE CASE: English Copy Changes Again During Resolution (ALT-B from UF-08)**
- If the English copy changes a second time while the LR is resolving a stale translation, the translation becomes stale against the newest English version
- **Feedback to User (LR):** **Advisory feedback** — "The English source has changed again. Please re-evaluate against the latest version." The stale resolution context is refreshed with the newest English copy.

**EDGE CASE: Stale Translation Already Deployed to Production (EXCEPTION-1 from UF-08)**
- This is not an error. The deployed translation remains live. Stale is advisory, not blocking (FRD §F-10).
- **Feedback to User:** **Advisory feedback** — "This translation is currently deployed to Production. It will remain live until a new version is published." The system does not remove or modify the deployed version during resolution.

---

### UX-09: Founder Reviews Escalated Copy

**Source:** UF-09  
**Primary Actor:** FN  
**Core Question:** What does the Founder experience when reviewing copy that has been escalated for their attention?

---

**STEP 1 — Founder Sees Escalated Items**

- **User Intent (FN):** Review copy that requires Founder-level attention
- **System Response:** The system presents the Founder's review queue containing all escalated items:
  - Each item shows: Tag ID, Page Name, Copy Type, the submitted text, the escalator (PM/SR/LR), the reason for escalation
  - Items are sorted by escalation date (oldest first)
  - Count of pending escalated items is visible
- **Next Step:** Step 2

**STEP 2 — Review Escalated Copy**

- **User Intent (FN):** Evaluate the copy in business context
- **User Action (FN):** The Founder selects an escalated item and reviews it in context (page, copy type, business implications, any reviewer comments)
- **System Response:** The system presents the full review context including:
  - The submitted English copy (or translation)
  - Previous versions (if this is an edit)
  - Comments from the escalator
  - The page and module context
- **Next Step:** DECISION (Step 3)

**STEP 3 — DECISION: Founder's Verdict**

**Path A — Approve**
- **User Action (FN):** Approves the copy. Optionally adds a comment.
- **System Response:** Copy status → Approved. The Founder's approval is recorded in the audit trail. The copy proceeds through the normal pipeline (translation and/or publishing). The original author and escalator are notified.
- **Feedback to User (FN):** **Confirmation feedback** — Approved by Founder.

**Path B — Request Revision (ALT-A from UF-09)**
- **User Action (FN):** Returns the copy with feedback explaining what should change
- **System Response:** Copy returns to Draft. The original author (PM/QA) is notified with the Founder's feedback.
- **Feedback to User (FN):** **Confirmation feedback** — Returned for revision with feedback.
- **Next Step:** The original author revises and resubmits (→ UX-03, Step 2)

**Path C — Founder Edits Directly (ALT-B from UF-09)**
- **User Action (FN):** The Founder edits the English copy directly
- **System Response:** The edited version is recorded as a new version authored by the Founder. The Founder can self-approve or submit through the approval chain.
- **Feedback to User (FN):** **Confirmation feedback** — Copy edited by Founder.

---

## 5. Publishing and Recovery Flows

---

### UX-10: Publish Approved Content to a Target Environment

**Source:** UF-10  
**Primary Actor:** Varies by target environment  
**Core Question:** What does the publisher experience when pushing approved content from MioTranslate to an environment?

---

**STEP 1 — Select the Page and Language**

- **User Intent:** Publish approved content for a specific page and language
- **User Action:** The publisher selects a page and language
- **System Response:** The system displays the publishing context:
  - Current environment status: which version is currently published in each environment (Dev, QA, Production) for this page and language
  - Whether newer approved content exists that has not been published
- **Next Step:** Step 2

**STEP 2 — Select the Target Environment**

- **User Intent:** Choose where to publish (Dev, QA, or Production)
- **User Action:** The publisher selects the target environment
- **System Response:** The system presents the pre-publishing summary:
  - Which tags are included in the bundle (only Approved tags)
  - What has changed compared to what is currently live in the target environment
  - Tags in Draft or Pending Review that are excluded, with the excluded count
  - The required approver for the selected environment:
    - Dev: Author (PM/QA) or Reviewer
    - QA: Reviewer (LR or SR)
    - Production: Support Reviewer or Founder
- **Next Step:** Step 3

**ERROR: No Approved Content to Publish (EXCEPTION-1 from UF-10)**
- All tags are in Draft or Pending Review
- **Feedback to User:** **Validation feedback** — "No approved content to publish for [page] in [language]."

**EDGE CASE: Same Version Already Deployed (ALT-C from UF-10)**
- **Feedback to User:** **Validation feedback** — "This version is already deployed to [environment]. No changes to publish." Duplicate publishing is prevented (FRD §11).

**STEP 3 — Initiate Publishing**

- **User Intent:** Start the publishing process
- **User Action:** The publisher reviews the summary and initiates publishing
- **System Response:**
  - If the publisher has the required approval authority for this environment, the publish proceeds directly
  - If a separate approver is needed (e.g., SR/FN for Production), the action is queued for the approver
- **Next Step:** Step 4 (approval) or Step 5 (if self-approved)

**STEP 4 — Approver Reviews and Approves Publishing**

- **User Intent (Approver):** Approve the publishing action for the target environment
- **System Response:** The approver sees the same pre-publishing summary (which tags, what changed)
- **User Action:** The approver approves or rejects the publishing action

**If rejected (EXCEPTION-3 from UF-10):**
- The publishing action is not executed. The rejection reason is recorded.
- **Feedback to User:** **Confirmation feedback** — "Publishing to [environment] rejected. Reason: [reason]."

**If approved:**
- **Next Step:** Step 5

**STEP 5 — Publishing Execution**

- **System Response:** MioTranslate pushes the approved page bundle to the target environment's Language Services API endpoint. Creates a new version snapshot. Records the publishing action in the audit trail and deployment history (who published, when, what version, which target environment, tag count).
- **Feedback to User:**
  - **Progress feedback** (during push) — Publishing in progress.
  - **Confirmation feedback** (on success) — "Published to [environment]. [N] tags. Version [V]."
- **State Transition:** The page bundle is now Published (Version V) in the target environment. The previous version in that environment is superseded.

**ERROR: Target Endpoint Unreachable (EXCEPTION-2 from UF-10)**
- Publishing fails. The system records the failure. Content remains in MioTranslate.
- **Feedback to User:** **Validation feedback** — "Publishing failed. The [environment] endpoint is unreachable. Please contact the administrator and retry." The PM and ADMIN are notified.

**STEP 6 — Post-Publishing Notifications**

- **System Response (for Production publishing — ALT-D from UF-10):** The PM and SR are notified that labels are now live for salon teams.
- **Feedback to User:** **Confirmation feedback** — "Labels for [page] in [language] are now live in Production."

**EDGE CASE: Publishing to Dev Is Implicit (ALT-A from UF-10)**
- Per FRD §17 resolved question: Once approval conditions are met, approved content is automatically published to Dev. The user does not need to manually initiate Dev publishing. The automatic action is still recorded in the audit trail and deployment history.
- **Feedback to User:** **Advisory feedback** — "Content automatically published to Dev."

**EDGE CASE: Not All Tags Have Approved Content (ALT-B from UF-10)**
- A page bundle can be published even if not all tags have translations (FRD §11). Only approved tags are included.
- **Feedback to User:** **Advisory feedback** — "[N] tags included. [N] tags excluded (Draft or Pending Review)." The system does not block publishing for partial bundles.

---

### UX-11: Roll Back Published Content

**Source:** UF-11  
**Primary Actor:** SR (Production) / FN  
**Core Question:** What does the user experience when reverting a page bundle to a previous version?

---

**STEP 1 — Identify the Problem**

- **User Intent:** A wrong label or translation has been discovered in an environment (typically Production)
- **User Action:** The SR or FN navigates to the deployment history for the affected page and language
- **System Response:** The system presents the deployment history:
  - All previous versions deployed to the environment
  - For each version: timestamp, publisher, version details, tag count, whether it was a rollback
  - The currently active version is indicated
- **Next Step:** Step 2

**STEP 2 — Select the Version to Roll Back To**

- **User Intent:** Choose a known-good previous version
- **User Action:** The SR or FN selects the version to roll back to (typically the immediately previous version)
- **System Response:** The system shows a comparison: what is currently deployed vs. what will be restored. Tags that differ between the two versions are highlighted.
- **Next Step:** Step 3

**ERROR: No Previous Version Exists (EXCEPTION-1 from UF-11)**
- This is the first-ever deployment for this page, language, and environment
- **Feedback to User:** **Validation feedback** — "No previous version exists. Rollback is not available. A corrected version must be created and published through the normal pipeline."

**STEP 3 — Initiate Rollback**

- **User Intent:** Restore the selected version
- **User Action:** The SR or FN initiates rollback
- **System Response:** The system re-publishes the selected previous version to the target environment. Creates a new deployment record noting it is a rollback. The bad version is not deleted — it remains in MioTranslate for investigation. PM, QA, and SR are notified (FRD §12).
- **Feedback to User:** **Confirmation feedback** — "Rolled back to Version [V]. The previous (bad) version is preserved for investigation."
- **State Transition:** The target environment now runs the selected previous version

**EDGE CASE: Rollback Contains Deprecated Tags (ALT-A from UF-11)**
- If the previous version includes tags that have since been deprecated, the rollback proceeds anyway. Deprecated tags in the bundle still appear. This is a safety measure (FRD §F-12).
- **Feedback to User:** **Advisory feedback** — "This version contains [N] tag(s) that have since been deprecated. They will be restored as part of the rollback."

**STEP 4 — Post-Rollback**

- The team investigates and corrects the issue, creating a new version that proceeds through the normal pipeline (→ UX-03 for English corrections, → UX-12 for translation corrections)

---

### UX-12: Correct a Translation Reported in Production

**Source:** UF-12  
**Primary Actor:** LR  
**Core Question:** What does the team experience when a salon team reports a wrong label and the team must fix it end-to-end?

---

**STEP 1 — Receive the Report and Find the Tag**

- **User Intent (SR):** Identify the reported label in MioTranslate
- **User Action:** The SR or support team searches for the tag using label text, tag ID, or page name (→ UX-13)
- **System Response:** The system returns the matching tag with its current status, translations, and deployment history
- **Next Step:** DECISION (Step 2)

**ERROR: Tag Not Found (EXCEPTION-1 from UF-12)**
- The reported label does not match any tag in MioTranslate
- **Feedback to User:** **Advisory feedback** — "No matching tag found. This label may be a developer hardcoded fallback that was never managed in MioTranslate." Investigation must continue outside MioTranslate.

**STEP 2 — DECISION: Urgency**

**Path A — Urgent: Rollback First, Then Fix**
- The SR or FN initiates a rollback to the previous version in Production (→ UX-11) to immediately remove the wrong label
- The fix is prepared in parallel and published through the normal pipeline
- **Next Step:** Step 3 (in parallel with the rollback)

**Path B — Normal Fix: Proceed Without Rollback**
- The issue is not urgent enough for an immediate rollback
- **Next Step:** Step 3

**HANDOFF → Localization Reviewer**

**STEP 3 — Identify and Correct the Error**

- **User Intent (LR):** Determine what went wrong and fix it
- **User Action:** The LR reviews the current translation alongside the English source and translation history
- **System Response:** The system presents the correction context:
  - Current (wrong) translation
  - English source copy
  - Translation version history (when was it created, who approved it, which English version it was based on)
  - Back-translation of the current version

**STEP 4 — Correct and Approve**

- **User Action (LR):** Corrects the translation manually and approves the corrected version
- **System Response:** The corrected translation enters as "Approved." The manual correction is recorded in the version history and audit trail (who corrected, when, what changed, why).
- **State Transition:** Translation status → Approved (new corrected version)
- **Next Step:** The corrected translation is published through the environment pipeline (→ UX-10): Dev → QA → Production. The SR or FN approves the Production publishing.

**STEP 5 — Publish the Correction**

- The corrected translation proceeds through the publishing pipeline (→ UX-10)
- **End State:** Salon teams see the corrected label. The correction is fully traceable: the original error, who reported it, who corrected it, who approved it, and when it was published. If a rollback was performed, that is also recorded.

---

## 6. Operational and Administrative Flows

---

### UX-13: Find and Inspect UX Copy

**Source:** UF-13  
**Primary Actor:** All Roles  
**Core Question:** What does any user experience when finding and examining content in MioTranslate?

---

**STEP 1 — Enter MioTranslate**

- **User Intent:** Find specific content or explore the registry
- **System Response:** The system presents the primary navigation context. Two primary modes of finding content are available: Search (for users who know what they want) and Browse (for users who are exploring).
- **Next Step:** DECISION (Step 2)

**STEP 2 — DECISION: Search or Browse**

**Path A — Search (User Knows What They Want)**

- **User Action:** The user enters a search query (tag ID, English copy text, page name, or page ID)
- **System Response:** Search is case-insensitive and returns results across all pages (FRD §F-14). Results show: matching tags with their page, English copy, and status. Results are sortable by page, status, and relevance.
- **Next Step:** Step 3

**ERROR: Search Returns Zero Results**
- **Feedback to User:** **Advisory feedback** — "No results found for '[query]'." The user can refine the search.

**Path B — Browse (User Is Exploring)**

- **User Action:** The user browses the page list
- **System Response:** Each page shows: Page Name, Page ID, Module, total tag count, and per-language translation summary. Pages can be filtered by module and translation completeness. Pages can be sorted by name, module, tag count, or translation coverage for a selected language (FRD §F-01).
- **Next Step:** The user selects a page to view its tags

**EDGE CASE: MioTranslate Has Zero Pages (EXCEPTION-2 from UF-13)**
- **Feedback to User:** **Advisory feedback** — Empty state with guidance to create the first page (→ UX-01) or run the initial migration (→ UX-02).

**STEP 3 — View Tag Detail**

- **User Intent:** Understand the current state of a specific tag
- **User Action:** The user selects a search result or a tag from the page view
- **System Response:** The system presents the tag detail context:
  - Tag ID, Page Name, Module, Copy Type
  - English copy: current approved text, status, author, approval date
  - Translation status per language: for each active language, the current translation text, status (No Translation, Draft, Pending Review, Approved, Stale), and confidence score
  - Version history link
  - Comments
- **Next Step:** From the tag detail, the user can navigate directly to:
  - Author English copy (→ UX-03)
  - Translate (→ UX-04)
  - Review (→ UX-06)
  - View history (→ UX-15)
  - Add a comment

**EDGE CASE: Filter by Translation State (ALT-B from UF-13)**
- Within any page view, the user can filter tags by: No Translation, Draft, Pending Review, Approved, or Stale. Filters can be combined with a language selector. This is especially useful for the LR finding work and the PM assessing readiness (FRD §F-15).

**EDGE CASE: Bookmark for Quick Access (ALT-C from UF-13)**
- The user can bookmark pages or tags for future quick access. Bookmarks are personal (per user). The system stores bookmarks and presents them in a personal quick-access context.

---

### UX-14: Monitor Translation Coverage and Readiness

**Source:** UF-14  
**Primary Actor:** PM / FN  
**Core Question:** What does the PM or Founder experience when assessing the state of translation across the product?

---

**STEP 1 — Open the Coverage Dashboard**

- **User Intent:** Understand translation readiness across all pages and languages
- **User Action:** The PM or FN opens the coverage dashboard
- **System Response:** The system presents the coverage matrix:
  - Pages (rows) by languages (columns)
  - Each cell shows the coverage percentage: (tags approved and deployed to Production) / (total active tags) × 100 (FRD §F-16)
  - Summary rows show overall coverage per language
  - Summary columns show overall coverage per page
  - Stale translations are counted as "approved but needs attention" (they are deployed and live but flagged)
  - Pages with zero active tags are excluded
- **Next Step:** DECISION (Step 2)

**STEP 2 — DECISION: What Does the User Need?**

**Path A — Language Readiness**
- **User Action:** Selects a language
- **System Response:** All pages ranked by coverage for that language. Identifies which pages have the most gaps and require priority attention.
- **Next Step:** The user can drill into a specific cell to see per-tag status for that page and language

**Path B — Page Readiness (ALT-A from UF-14)**
- **User Action:** Selects a page
- **System Response:** All languages and their status for that page. Answers: "Is this page ready across all languages?" Useful before a feature release.

**Path C — Stale Translation Status (ALT-B from UF-14)**
- **User Action:** Views the stale translations list
- **System Response:** All stale translations grouped by language and page, sorted by age (oldest first). Identifies which translations have been out of sync the longest and need priority resolution (→ UX-08).

**Path D — Pending Work Volume (ALT-C from UF-14)**
- **User Action:** Views the pending work summary
- **System Response:** A snapshot of outstanding work: how many tags need English copy, how many need translation, how many are pending review, how many are stale.

**Path E — New Language Assessment (ALT-D from UF-14)**
- **User Intent:** Assess the effort required to add a new language
- **System Response:** The total volume of active tags across all pages that would need translation for a hypothetical new language. Answers: "How much effort is required?"

**STEP 3 — Act on Findings**

- Based on findings, the PM or FN prioritizes work: directs the LR to focus on specific pages or languages, plans translation sprints, or reports readiness to leadership
- The dashboard is a read-only, informational experience. No content is created or modified here.

---

### UX-15: Investigate a Label Issue Using History and Audit Trail

**Source:** UF-15  
**Primary Actor:** Any role (typically SR, PM, or FN)  
**Core Question:** What does the investigator experience when tracing the lifecycle of a label to determine what went wrong?

---

**STEP 1 — Find the Tag**

- **User Intent:** Locate the tag that is being investigated
- **User Action:** The investigator searches for the tag (→ UX-13)
- **Next Step:** Step 2

**STEP 2 — View Version History**

- **User Intent:** See the complete history of changes
- **User Action:** The investigator selects the relevant language (English or a specific translation)
- **System Response:** The system presents the version history: a chronological list of all versions showing:
  - Who changed it
  - When
  - What it said before
  - What it says now
  - The change reason (if provided)
  - The creation method (AI-generated or manual, for translations)
  - The English version it was based on (for translations)
- **Next Step:** Step 3

**STEP 3 — Compare Versions (Optional)**

- **User Intent:** See the exact differences between two versions
- **User Action:** The investigator compares two specific versions side by side
- **System Response:** The system presents a comparison showing the exact textual differences, with who changed each version and when (FRD §9.4).

**STEP 4 — View Audit Trail**

- **User Intent:** See every action taken on this tag
- **User Action:** The investigator views the audit trail for this tag
- **System Response:** The system presents every action: creation, edits, approvals, rejections, promotions, rollbacks — with who, when, and details (FRD §F-17).
- **Feedback to User:** The investigator can see the complete lifecycle. Example narrative the system enables: "The English copy was updated on July 20, but the Italian translation was approved on July 16 based on the previous English version. The translation was flagged Stale on July 20 but never re-verified. Root cause: unresolved stale translation."

**STEP 5 — Initiate Corrective Action**

- Based on findings, the investigator navigates to the appropriate corrective flow:
  - → UX-08 for stale resolution
  - → UX-12 for production correction
  - → UX-11 for rollback

**EDGE CASE: Tag Was Imported During Migration (EXCEPTION-1 from UF-15)**
- The version history begins with the imported state. Pre-migration history does not exist in MioTranslate.
- **Feedback to User:** **Advisory feedback** — "This tag was imported during the initial migration. History prior to [migration date] is not available in MioTranslate."

**EDGE CASE: Investigation Across Multiple Tags (ALT-A from UF-15)**
- The investigator searches the audit trail by user, date range, action type, page, or language to understand broader patterns (e.g., "What did this reviewer approve last week?").

**EDGE CASE: Activity Report for a User (ALT-B from UF-15)**
- An administrator or founder views all actions taken by a specific user within a date range for workload assessment or accountability (FRD §13.7).

**EDGE CASE: Deployment History Investigation (ALT-C from UF-15)**
- The investigator views the deployment history for a page and language: all promotions and rollbacks with who, when, and what version. Answers: "When did this version reach Production?" (FRD §13.6).

---

### UX-16: Deprecate a Tag

**Source:** UF-16  
**Primary Actor:** PM / FN  
**Core Question:** What does the PM experience when marking a tag as no longer needed?

---

**STEP 1 — Identify the Tag**

- **User Intent:** Mark a tag as deprecated
- **User Action:** The PM or FN navigates to the tag
- **System Response:** The system displays the tag with its current status, English copy, and translations
- **Next Step:** Step 2

**STEP 2 — Mark as Deprecated**

- **User Intent:** Remove the tag from active workflows while preserving its history
- **User Action:** The PM or FN marks the tag as Deprecated
- **System Response:** The system updates the tag's lifecycle:
  - The tag is excluded from active workflows: no further translation, review, or publishing actions are initiated for it
  - The tag remains visible in the registry with a "Deprecated" indicator
  - All history and audit records are preserved
  - The deprecation is recorded in the audit trail
- **State Transition:** Tag status → Deprecated
- **Feedback to User:** **Confirmation feedback** — "Tag [Tag ID] has been deprecated. It is excluded from active workflows. All history is preserved."

**STEP 3 — System Checks Page Status**

- **System Response (if all tags on the page are now deprecated):** The page is automatically marked Deprecated. It remains in the registry for historical reference but is excluded from active counts on the coverage dashboard (FRD §7, Lifecycle Rule 25).
- **Feedback to User:** **Advisory feedback** — "All tags on [Page Name] are now deprecated. The page has been marked Deprecated."

**STEP 4 — Developer Handoff**

- **HANDOFF → Developer** — The developer removes the tag reference from MioSalon's codebase (external action, not tracked in MioTranslate)

**Note:** Deprecation is one-directional. There is no "un-deprecate" flow defined in the FRD.

---

### UX-17: Add a New Language

**Source:** UF-17  
**Primary Actor:** ADMIN / FN  
**Core Question:** What does the Administrator/Founder experience when adding a new language to enable a new market?

---

**STEP 1 — Initiate Language Addition**

- **User Intent:** Add a new language to MioTranslate
- **User Action:** The ADMIN or FN navigates to the administration area and initiates language addition
- **System Response:** The system presents the language creation context, requesting: language code, language name, status (Active), and direction (LTR or RTL)

**STEP 2 — Provide Language Details**

- **User Action:** The ADMIN or FN enters the language details
- **System Response:** The system creates the language. All existing active tags across all pages receive an empty translation slot for the new language. The language addition is recorded in the audit trail.
- **State Transition:** Language → Active. All tags receive a new "No Translation" entry for this language.
- **Feedback to User:** **Confirmation feedback** — "Language [name] added. [N] tags across [N] pages now have empty translation slots for [language]. The coverage dashboard shows 0% coverage."
- **Next Step:** Step 3

**STEP 3 — Coverage Dashboard Reflects New Language**

- The coverage dashboard immediately shows the new language with 0% coverage across all pages, making the total translation effort immediately visible and plannable.
- **HANDOFF → PM and LR** — The PM uses the coverage dashboard (→ UX-14) to prioritize which pages should be translated first. The LR begins translation work (→ UX-05, UX-04) followed by review (→ UX-06, UX-07) and publishing (→ UX-10).

**EDGE CASE: Deactivate a Language (ALT-A from UF-17)**
- **User Action:** The ADMIN or FN deactivates an existing language
- **System Response:** Existing translations and history are preserved. No new translations or promotions occur for the deactivated language. The language cannot be deleted (FRD §5.7).
- **State Transition:** Language → Inactive
- **Feedback to User:** **Confirmation feedback** — "Language [name] deactivated. Existing translations and history are preserved. No new work will be allowed for this language."

---

### UX-18: Manage User Roles and System Configuration

**Source:** UF-18  
**Primary Actor:** ADMIN / FN  
**Core Question:** What does the Administrator experience when assigning roles or configuring system settings?

---

**STEP 1 — Navigate to Administration**

- **User Intent:** Configure MioTranslate's operational parameters
- **User Action:** The ADMIN or FN navigates to the administration area
- **System Response:** The system presents the administration context with two primary areas:
  - User role management
  - System configuration
- **Next Step:** DECISION (Step 2)

**STEP 2 — DECISION: Role Assignment or Configuration**

**Path A — Assign or Modify a User Role**

- **User Action:** The ADMIN or FN selects a user and assigns a role (PM, QA, Localization Reviewer, Support Reviewer, Developer, Administrator). A user can hold multiple roles (FRD §5.7).
- **System Response:** The role assignment is recorded in the audit trail. The user's permissions are updated immediately.
- **Feedback to User:** **Confirmation feedback** — "[User] has been assigned the [role] role. Permissions are now active."

**Path B — Configure System Settings (ALT-A from UF-18)**

- **User Action:** The ADMIN or FN adjusts system settings:
  - Confidence threshold for bulk approval (default 95%, configurable per FRD §17)
  - Other configuration parameters as defined
- **System Response:** All configuration changes are recorded in the audit trail.
- **Feedback to User:** **Confirmation feedback** — "Configuration updated. [Setting] changed from [old value] to [new value]."

---

### UX-19: Export Tag Data for External Review

**Source:** UF-19  
**Primary Actor:** PM / LR / ADMIN  
**Core Question:** What does the user experience when exporting data for offline use?

---

**STEP 1 — Select Export Parameters**

- **User Intent:** Get a snapshot of tag data for external sharing or analysis
- **User Action:** The PM or LR selects a page and language for export
- **System Response:** The system indicates the scope of the export (page name, language, tag count)
- **Next Step:** Step 2

**STEP 2 — Initiate Export**

- **User Action:** The user initiates the export and selects format (CSV or Excel)
- **System Response:** The system generates the export file containing: tag ID, English copy, translation, status, and confidence score for each tag (FRD §F-19).
- **Feedback to User:** **Confirmation feedback** — "Export ready. [N] tags exported for [page] in [language]."
- The user downloads the file

**Note:** Exports are read-only snapshots reflecting the current state at the time of export. They cannot be re-imported to modify data (FRD §F-19). The export does not create or modify any content in MioTranslate.

---

## 7. Cross-Flow State Transitions

This section documents the critical state transitions that span multiple flows. These are moments where an action in one flow causes a state change that affects other flows.

### 7.1 The Stale Cascade

**Trigger:** Approved English copy is edited and the new version is approved (UX-03, Step 6, Path A).

**Cascade:**
1. All existing translations of that tag across all languages are automatically flagged Stale
2. Each stale translation appears on the coverage dashboard (UX-14) and in the stale translations list
3. Each language resolves staleness independently (UX-08) — confirm or retranslate
4. Retranslated items enter the review queue (UX-06)
5. Approved retranslations become eligible for publishing (UX-10)

**User experience:** The PM who edits English copy sees confirmation that stale flags were triggered. The LR sees the stale items appear. The coverage dashboard reflects the change. No action is blocked by staleness — existing published translations remain live (FRD §7, Business Rule 6).

### 7.2 The Publishing Pipeline

**Trigger:** Content is approved (English copy via UX-03 or translation via UX-04/UX-06/UX-07).

**Pipeline:**
1. Approved content is automatically published to Dev (UX-10, ALT-A — implicit per FRD §17)
2. QA verifies in Dev
3. Content is explicitly published to QA (UX-10)
4. Support team verifies
5. Content is explicitly published to Production (UX-10, requires SR or FN approval)

**User experience:** The PM sees content move through environments via the environment status display. Each promotion is explicit (except Dev). Each environment shows which version is currently active.

### 7.3 The Deprecation Impact

**Trigger:** A tag is deprecated (UX-16).

**Impact:**
1. The tag is excluded from the coverage dashboard's active counts
2. The tag cannot be translated, reviewed, or published
3. If all tags on a page are deprecated, the page is deprecated
4. Rollbacks that include the deprecated tag will still contain it (safety measure)

**User experience:** The PM sees the tag marked as Deprecated. The coverage percentages may change (the denominator decreases). The tag remains visible in the registry with all history preserved.

### 7.4 The New Language Expansion

**Trigger:** A new language is added (UX-17).

**Impact:**
1. Every active tag across every page receives an empty translation slot
2. The coverage dashboard shows 0% for the new language
3. The pending work summary increases by the total number of active tags
4. Bulk translation (UX-05) becomes available for each page

**User experience:** The PM sees the new language appear on the dashboard at 0%. The scope of work is immediately visible. The LR can begin translation work using bulk operations.

---

## 8. Feedback Patterns Summary

This section consolidates the types of feedback the system provides across all flows, ensuring consistency.

| Feedback Type | When Used | Urgency |
|---|---|---|
| **Confirmation** | Action completed successfully (save, approve, publish, create) | Immediate, non-blocking |
| **Validation** | Action prevented because a rule was violated (empty field, duplicate ID, missing prerequisite) | Immediate, blocking |
| **Advisory** | Information the user should be aware of but that does not block progress (stale flagging, partial success, deprecated tags in rollback) | Immediate, non-blocking |
| **Progress** | A long-running operation is in progress (bulk translation, import, publishing) | Persistent until operation completes |
| **Conflict** | Two users are acting on the same content simultaneously | Immediate, blocking for second user |
| **Notification** | An asynchronous event the user should know about (approval, rejection, escalation, publishing, rollback) | Asynchronous, delivered when user next engages |

### Feedback Consistency Rules

1. Every user-initiated action that changes state must produce confirmation or validation feedback
2. Every system-initiated state change that affects the user's current context must produce advisory feedback
3. Every long-running operation must produce progress feedback
4. Every asynchronous event relevant to the user must produce a notification
5. Feedback language must be specific: "Tag ID already exists" not "An error occurred"
6. Feedback must reference the specific entity acted upon: "[Tag ID] approved" not "Item approved"

---

## 9. Validation Checklist

### 9.1 User Flow Coverage

Every approved User Flow (UF-01 through UF-19) has a corresponding UX Flow (UX-01 through UX-19) in this document.

| User Flow | UX Flow | Status |
|---|---|---|
| UF-01 Register a New Page and Create Tags | UX-01 | ✓ Documented |
| UF-02 Initial One-Time Migration | UX-02 | ✓ Documented |
| UF-03 Author and Approve English UX Copy | UX-03 | ✓ Documented |
| UF-04 Translate a Single Tag | UX-04 | ✓ Documented |
| UF-05 Bulk Translate a Page for a Language | UX-05 | ✓ Documented |
| UF-06 Review and Approve Translations | UX-06 | ✓ Documented |
| UF-07 Bulk Approve High-Confidence Translations | UX-07 | ✓ Documented |
| UF-08 Resolve Stale Translations | UX-08 | ✓ Documented |
| UF-09 Founder Reviews Escalated Copy | UX-09 | ✓ Documented |
| UF-10 Publish Approved Content to a Target Environment | UX-10 | ✓ Documented |
| UF-11 Roll Back Published Content | UX-11 | ✓ Documented |
| UF-12 Correct a Translation Reported in Production | UX-12 | ✓ Documented |
| UF-13 Find and Inspect UX Copy | UX-13 | ✓ Documented |
| UF-14 Monitor Translation Coverage and Readiness | UX-14 | ✓ Documented |
| UF-15 Investigate a Label Issue Using History and Audit Trail | UX-15 | ✓ Documented |
| UF-16 Deprecate a Tag | UX-16 | ✓ Documented |
| UF-17 Add a New Language | UX-17 | ✓ Documented |
| UF-18 Manage User Roles and System Configuration | UX-18 | ✓ Documented |
| UF-19 Export Tag Data for External Review | UX-19 | ✓ Documented |

### 9.2 State Model Coverage

Every state from the FRD data model is accounted for in the UX flows.

| FRD State | Where Documented |
|---|---|
| English Copy: No Copy → Draft → Pending Review → Approved | §2.1, UX-03 |
| Translation: No Translation → Draft → Pending Review → Approved → Stale | §2.2, UX-04, UX-06, UX-07, UX-08 |
| Tag: Active → Deprecated | §2.4, UX-16 |
| Page: Active → Deprecated | §2.4, UX-16 |
| Language: Active → Inactive | §2.5, UX-17 |
| Publishing: Never Published → Published → Rolled Back | §2.3, UX-10, UX-11 |

### 9.3 Error and Edge Case Coverage

Every exception and alternate path from the User Flow Document has been addressed.

| Criterion | Status |
|---|---|
| Every main success path documented with step-by-step interaction detail | ✓ All 19 flows |
| Every ALT path from the User Flow Document addressed | ✓ Each addressed as a DECISION path or EDGE CASE |
| Every EXCEPTION from the User Flow Document addressed | ✓ Each addressed as an ERROR with specific feedback |
| Every HANDOFF from the User Flow Document addressed | ✓ Each includes what the receiving role experiences |
| No UI components specified (no modals, drawers, tabs, buttons, forms) | ✓ Verified |
| No new product capabilities invented beyond the approved documents | ✓ Verified |
| All feedback follows the established feedback taxonomy | ✓ Verified |

### 9.4 Conflicts and Open Decisions

No conflicts were identified between the BRD, FRD, and User Flow Document during the creation of this document. All UX behaviors described here are faithful elaborations of the approved source documents.

> **Note on Escalation:** The FRD (§17, Resolved Questions) establishes that escalation to the Founder is "a judgment call, not a system-enforced rule per page." This document reflects that — the system supports escalation as a user-initiated action, but does not enforce which items must be escalated. The UX Designer should consider whether to provide any lightweight affordance for the user to identify escalation-worthy items, without making it a system-enforced gate.

---

*End of UX Flow Document.*
