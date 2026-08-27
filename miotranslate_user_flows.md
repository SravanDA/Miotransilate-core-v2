# MioTranslate
## User Flow Document

---

**Product:** MioTranslate  
**Document Type:** User Flow Document  
**Source Documents:** MioTranslate Business Requirement Document (Approved), MioTranslate Functional Requirements Document (Approved)  
**Audience:** Product, UX Design, Engineering, QA  
**Date:** August 2026  

---

## 1. Purpose and Scope

This document defines the complete set of user flows required for MioTranslate. Each flow describes the focused sequence a specific user follows to accomplish a meaningful goal inside MioTranslate, from trigger through completion.

This document is:

- The bridge between the approved FRD (what the system does) and the UX Flow stage (how the system is experienced)
- A goal-oriented description of user behaviour, not a screen inventory or UI specification
- The foundation from which a UX Designer will create interaction designs and from which QA will derive test scenarios

This document is not:

- A journey map, PRD, UX specification, UI specification, or architecture document
- A place to define modals, drawers, tabs, buttons, forms, or screen layouts
- A place to define APIs, databases, or implementation details

### 1.1 Source-of-Truth Rules

- The approved BRD and FRD are authoritative. No capabilities are invented beyond what they define.
- Business rules from the FRD are preserved exactly. No reinterpretation without evidence.
- Where the BRD and FRD contain a genuine conflict, it is flagged explicitly.
- No UI patterns are introduced. No implementation decisions are made.

### 1.2 How to Read This Document

**Notation conventions used throughout:**

| Element | Meaning |
|---|---|
| **→** | Indicates the next step in the main success flow |
| **Actor: [Role]** | The person performing the action at this point |
| **System:** | An automatic action performed by MioTranslate, not by a user |
| **DECISION** | A point where the flow branches based on a condition |
| **ALT** | An alternate path that diverges from the main flow |
| **EXCEPTION** | A failure or error condition that prevents normal progress |
| **HANDOFF →** | Responsibility transfers from one role to another |
| **END STATE** | The terminal condition that defines successful completion |

**Roles referenced:**

| Abbreviation | Role | Source |
|---|---|---|
| PM | Product Manager | FRD §2.1 |
| QA | QA | FRD §2.2 |
| LR | Localization Reviewer | FRD §2.3 |
| SR | Support Reviewer | FRD §2.4 |
| FN | Founder | FRD §2.5 |
| DEV | Developer | FRD §2.6 |
| ADMIN | Administrator | FRD §2.7 |

---

## 2. Flow Inventory

The flows are organized into four categories based on how they serve the overall MioTranslate mission.

### Foundation Flows
Flows that establish the structural foundation on which all content operations depend.

| Flow ID | Flow Name | Primary Role |
|---|---|---|
| UF-01 | Register a New Page and Create Tags | PM |
| UF-02 | Initial One-Time Migration | FN / ADMIN |

### Content Lifecycle Flows
Flows that move UX copy from authorship through review, translation, and approval to a publishable state.

| Flow ID | Flow Name | Primary Role |
|---|---|---|
| UF-03 | Author and Approve English UX Copy | PM |
| UF-04 | Translate a Single Tag | PM / LR |
| UF-05 | Bulk Translate a Page for a Language | PM / LR |
| UF-06 | Review and Approve Translations | LR |
| UF-07 | Bulk Approve High-Confidence Translations | LR |
| UF-08 | Resolve Stale Translations | LR |
| UF-09 | Founder Reviews Escalated Copy | FN |

### Publishing and Recovery Flows
Flows that govern how approved content reaches salon teams and how problems are corrected.

| Flow ID | Flow Name | Primary Role |
|---|---|---|
| UF-10 | Publish Approved Content to a Target Environment | SR / FN |
| UF-11 | Roll Back Published Content | SR / FN |
| UF-12 | Correct a Translation Reported in Production | LR |

### Operational and Administrative Flows
Flows that support ongoing system operation, visibility, and governance.

| Flow ID | Flow Name | Primary Role |
|---|---|---|
| UF-13 | Find and Inspect UX Copy | All Roles |
| UF-14 | Monitor Translation Coverage and Readiness | PM / FN |
| UF-15 | Investigate a Label Issue Using History and Audit Trail | All Roles |
| UF-16 | Deprecate a Tag | PM / FN |
| UF-17 | Add a New Language | ADMIN / FN |
| UF-18 | Manage User Roles and System Configuration | ADMIN / FN |
| UF-19 | Export Tag Data for External Review | PM / LR |

---

## 3. Foundation Flows

---

### UF-01: Register a New Page and Create Tags

**Flow ID:** UF-01  
**Flow Name:** Register a New Page and Create Tags  
**Primary Role:** Product Manager  
**Supporting Roles:** Developer (provides Page ID from codebase, references created Tag IDs in code), Founder (has create permission)  
**User Goal:** Register a new MioSalon page in MioTranslate and create all required tags so that English copy authoring and translation can begin for that page.  
**Business Context:** MioTranslate is the single entry point for managed UX copy (BRD §6, FRD §1.3). When a developer builds a new screen in MioSalon, the PM must register that page and its tags in MioTranslate before English copy can be authored, translations can be created, or content can be published. Without registration, tags show only the developer's hardcoded placeholder text and are never translated (BRD §11.7).  
**Trigger / Entry Point:** A developer communicates to the PM that a new MioSalon page has been created in the codebase and provides the Page ID.  
**Preconditions:**  
- The PM has permission to create pages and tags (FRD §8)  
- The developer has defined the Page ID in the MioSalon codebase and communicated it to the PM  

**Main Success Flow:**

1. **Actor: PM** — Registers a new page in MioTranslate by providing the Page ID (as defined by the developer), a human-readable Page Name, and the MioSalon module the page belongs to.
2. **System:** — Validates that the Page ID is unique across MioTranslate. Records the page creation in the audit trail.
3. **Actor: PM** — Creates tags within the newly registered page. For each tag, the PM provides a Tag ID following the naming convention (PAGE_ID prefix). The PM optionally sets the copy type for each tag (button, label, error message, header, placeholder, helper text, status badge, filter option, table header, validation message).
4. **System:** — Validates each Tag ID for uniqueness and naming convention compliance. Creates the tags in MioTranslate. Records each tag creation in the audit trail. Each tag enters "Needs English copy" state. Tag content reaches Language Services only when approved content is published.
5. **Actor: PM** — Reviews the registered page and its tags to confirm completeness.
6. The page now appears in the page browsing view. Tags are ready for English copy authoring (→ UF-03).
7. **HANDOFF → Developer** — The developer references the created Tag IDs in the MioSalon codebase.

**Decision Points / Alternate Paths:**

- **ALT-A: PM creates additional tags later.** At any point after the page exists, the PM can return and create additional tags within the page. Each follows the same validation and audit rules. This occurs when a developer adds new labels to an existing page.
- **ALT-B: PM does not author English copy immediately.** Tags remain in "Needs English copy" state indefinitely until the PM authors copy. This is a valid holding state.
- **ALT-C: Founder creates the page.** The Founder has the same create permissions and can register pages and tags directly.

**Failure / Exception Paths:**

- **EXCEPTION-1: Duplicate Page ID.** System rejects the creation with a validation error: "Page ID already exists." The PM must verify the correct Page ID with the developer.
- **EXCEPTION-2: Duplicate Tag ID.** System rejects the tag creation with a validation error: "Tag ID already exists." The PM must correct the Tag ID.
- **EXCEPTION-3: Developer has not provided the Page ID.** The PM cannot register the page. The flow is blocked until the developer defines the Page ID in the codebase.

**End State / Expected Outcome:** The page is registered in MioTranslate with all required tags. Each tag is in "Needs English copy" state. The page appears in the browsing view. The developer has Tag IDs to reference in code. All creation actions are recorded in the audit trail.

**Related FRD Features:** F-02 (Create Page & Tag), F-01 (Page & Tag Browsing), F-17 (Audit Trail)

---

### UF-02: Initial One-Time Migration

**Flow ID:** UF-02  
**Flow Name:** Initial One-Time Migration  
**Primary Role:** Founder / Administrator  
**Supporting Roles:** PM (post-migration validation), QA (post-migration verification)  
**User Goal:** Load all existing UX copy (pages, tags, English copy, and translations across all languages) from the current MioSalon multilingual module into MioTranslate, establishing MioTranslate as the single source of truth going forward.  
**Business Context:** MioTranslate must start with the current production state of all UX copy. Hundreds of pages, thousands of tags, and translations across eight languages already exist. Without migration, MioTranslate would start empty and the team would need to re-enter everything manually (BRD §6, FRD §F-21). This is a one-time operation. After migration, all new UX copy originates exclusively in MioTranslate.  
**Trigger / Entry Point:** MioTranslate has been deployed and is ready for production use. The organization decides to cut over from the legacy process.  
**Preconditions:**  
- MioTranslate is deployed and operational  
- The existing UX copy and translations have been exported/downloaded from the current multilingual module  
- A full snapshot of the source data has been taken as a safety backup  

**Main Success Flow:**

1. **Actor: FN / ADMIN** — Takes a complete backup snapshot of the source data from the existing multilingual module.
2. **Actor: FN / ADMIN** — Imports the exported data into MioTranslate through the import mechanism. The import includes all pages, tags, English copy, and translations across all languages.
3. **System:** — Processes the import. Registers all pages, creates all tags, loads English copy, and loads translations. Imported content enters MioTranslate as "Published in Production" (since it is already live in the current system). Records the import event in the audit trail.
4. **System:** — Generates a validation report comparing MioTranslate's registry against the imported source data.
5. **Actor: FN / ADMIN** — Reviews the validation report. Confirms that every page, tag, and translation from the source is represented in MioTranslate with zero discrepancies.
6. **Actor: FN / ADMIN** — Revokes developer write access to the Language Services API. From this point forward, MioTranslate is the only system that writes to the Language Services API.
7. **System:** — MioTranslate is now the authoritative entry point for all UX copy management.

**Decision Points / Alternate Paths:**

- **DECISION-A: Validation report shows discrepancies.** If the report shows missing or corrupted data, the FN/ADMIN has two options: (a) Fix the discrepancies manually in MioTranslate and re-validate, or (b) Roll back to the pre-migration state using the backup snapshot and re-attempt the migration.

**Failure / Exception Paths:**

- **EXCEPTION-1: Import fails.** The import process encounters an error and cannot complete. MioTranslate records the failed import event. No data is partially loaded (data safety requires atomicity per FRD §14). The FN/ADMIN investigates and retries.
- **EXCEPTION-2: Post-migration validation reveals missing data.** The FN/ADMIN must resolve discrepancies before revoking developer write access. The legacy process remains active until migration is confirmed successful.

**End State / Expected Outcome:** MioTranslate contains a complete, validated copy of all existing UX copy across all pages and languages. The data matches the current production state. Developer write access to Language Services is revoked. All future UX copy changes go through MioTranslate exclusively. The import event is recorded in the audit trail.

**Related FRD Features:** F-21 (Initial Migration), F-17 (Audit Trail)

---

## 4. Content Lifecycle Flows

---

### UF-03: Author and Approve English UX Copy

**Flow ID:** UF-03  
**Flow Name:** Author and Approve English UX Copy  
**Primary Role:** Product Manager (author), Support Reviewer (reviewer/approver)  
**Supporting Roles:** QA (can also author), Founder (can approve; receives escalated items)  
**User Goal:** Write the official English text for one or more tags and get it approved so that the tag is ready for translation and publishing.  
**Business Context:** English is the source from which all translations are created (BRD §10, Decision 2). Today, the PM writes copy but a developer must enter it (BRD §4.1). MioTranslate allows the PM and QA to author and iterate on English copy independently, without engineering involvement. No tag can be translated until its English copy is approved (FRD §7, Business Rule 2).  
**Trigger / Entry Point:** Tags exist in "Needs English copy" state (after UF-01 or UF-02), or a PM/QA identifies existing English copy that needs improvement or correction.  
**Preconditions:**  
- Tag exists in MioTranslate  
- The author (PM or QA) has English copy authoring permission (FRD §8)  

**Main Success Flow:**

1. **Actor: PM** — Navigates to a tag that needs English copy. If approved English copy already exists, it is visible as reference.
2. **Actor: PM** — Writes the official English text. Optionally selects the copy type. Optionally adds a change reason explaining why this text was chosen or what changed.
3. **Actor: PM** — Submits the English copy for review.
4. **System:** — English copy status moves to "Pending Review." The version is recorded. The assigned reviewer is notified.
5. **HANDOFF → Support Reviewer**
6. **Actor: SR** — Reviews the submitted English copy in context (page, copy type, tag purpose).
7. **DECISION: Does the copy meet quality standards?**
   - **Yes →** Step 8 (Approve)
   - **No, minor issues →** Step ALT-A (Return for revision)
   - **No, sensitive or uncertain →** Step ALT-B (Escalate to Founder)
8. **Actor: SR** — Approves the English copy. Optionally adds a reviewer comment.
9. **System:** — English copy status moves to "Approved." The approval is recorded in the audit trail (who approved, when). The author is notified. The tag is now eligible for translation (→ UF-04, UF-05) and publishing (→ UF-10).
10. **System (if this is an edit of existing approved copy):** — All existing translations of this tag across all languages are automatically flagged Stale (→ UF-08).

**Decision Points / Alternate Paths:**

- **ALT-A: Reviewer returns the copy for revision.** The SR returns the English copy to Draft with a mandatory comment explaining what needs to change. The author (PM) is notified. The PM revises the text and resubmits (returns to Step 3). The rejection and comment are recorded in the audit trail.
- **ALT-B: Reviewer escalates to Founder.** The SR (or PM during submission) flags specific labels for Founder review. The Founder sees the escalated items in a review queue. The Founder approves, requests revision, or edits directly. Once Founder-approved, the copy proceeds as in Step 9. Escalation is a judgment call, not a system-enforced rule per page (FRD §17, Resolved Questions).
- **ALT-C: PM saves as Draft without submitting.** The PM writes the text but saves it as Draft for further refinement. The copy remains in Draft state until the PM explicitly submits it for review. No reviewer is notified.
- **ALT-D: QA authors or corrects English copy.** QA has the same authoring permissions as PM. QA follows the identical flow. This is common when QA identifies a misleading label during testing and corrects it directly (BRD §11.1).
- **ALT-E: Multiple tags authored in sequence.** The PM authors English copy for multiple tags on the same page in a single working session. Each tag follows the same lifecycle independently.

**Failure / Exception Paths:**

- **EXCEPTION-1: Author submits empty English copy.** System rejects with validation error: English copy text is mandatory (FRD §11). The author must provide text.
- **EXCEPTION-2: Concurrent editing conflict.** Two users attempt to edit the same tag's English copy simultaneously. The second save shows a conflict notification. The second user must refresh and resolve the conflict (FRD §F-04).
- **EXCEPTION-3: Reviewer rejects the copy.** The copy is rejected with a mandatory reason. The rejection is recorded. The copy remains in Draft or returns to its previous state. The rejected item and reason remain in the system for reference.

**End State / Expected Outcome:** The tag has approved English copy. The approval is recorded with who authored it, who reviewed it, and when. The tag is eligible for translation. If this was an edit, all affected translations are flagged Stale. The version history records the complete lineage.

**Related FRD Features:** F-04 (Author English Copy), F-05 (Edit English Copy), F-13 (Version History), F-17 (Audit Trail), F-18 (Comments)

---

### UF-04: Translate a Single Tag

**Flow ID:** UF-04  
**Flow Name:** Translate a Single Tag  
**Primary Role:** Product Manager (triggers translation) / Localization Reviewer (reviews and approves)  
**Supporting Roles:** Founder (can trigger and approve)  
**User Goal:** Create, review, and approve a translation of a single tag for a specific language so that it is ready for publishing.  
**Business Context:** Translations must be created with business context and verified by a human before reaching salon teams (BRD §10, Decision 3). AI assists in generating translations, but every translation requires human approval (FRD §7, Business Rule 8). This flow is used for individual tag translations — when a specific tag needs attention, or when correcting a translation.  
**Trigger / Entry Point:** A tag has approved English copy and needs a translation for a specific language. The tag currently has no translation, or has a translation that needs replacement.  
**Preconditions:**  
- Tag exists with approved English copy (FRD §7, Business Rule 2)  
- Target language is active in MioTranslate  
- User has permission to create translations (PM, LR, or FN per FRD §8)  

**Main Success Flow:**

1. **Actor: PM or LR** — Selects a tag and a target language.
2. **Actor: PM or LR** — Triggers AI translation.
3. **System:** — AI generates a translation using business context: the page the tag appears on, the module, the copy type, salon/spa industry terminology, and translation rules (when defined). AI generates a back-translation (the translated text rendered back into English). AI calculates a confidence score. AI verifies variable/placeholder integrity.
4. **System:** — The translation enters as "Draft." The creation is recorded in the audit trail.
5. **HANDOFF → Localization Reviewer**
6. **Actor: LR** — Reviews the translation alongside: the English source copy, the back-translation, the confidence score, the variable integrity status, and the page and copy type for context.
7. **DECISION: Is the translation accurate and appropriate?**
   - **Yes →** Step 8 (Approve)
   - **Close but needs minor correction →** Step ALT-A (Edit and approve)
   - **No, fundamentally wrong →** Step ALT-B (Request retranslation)
8. **Actor: LR** — Approves the translation.
9. **System:** — Translation status moves to "Approved." The approval is recorded in the audit trail (who approved, when, which English version it was based on). The PM is notified. The translation is now eligible for publishing (→ UF-10).

**Decision Points / Alternate Paths:**

- **ALT-A: Reviewer edits and approves.** The LR corrects the translation manually, then approves. The manual correction is recorded in the version history, noting it was a reviewer edit. The corrected version is what reaches salon teams.
- **ALT-B: Reviewer requests retranslation.** The AI regenerates the translation with the same or improved context. The new translation enters as Draft and the review cycle restarts at Step 6.
- **ALT-C: Reviewer rejects.** The translation is rejected with a mandatory reason. It remains in Draft or returns to "No Translation." The rejection is recorded.
- **ALT-D: Variable integrity check fails.** The system flags the translation because a dynamic placeholder from the English copy was not preserved in the translation. The translation requires manual review regardless of confidence score (FRD §F-06). The reviewer must correct the placeholder issue before approving.
- **ALT-E: English copy changes during review.** The translation is flagged Stale while being reviewed. The reviewer is notified and must re-evaluate against the new English copy (→ UF-08).

**Failure / Exception Paths:**

- **EXCEPTION-1: AI translation service unavailable.** The system displays an error. The translation remains as "No Translation." The user can retry.
- **EXCEPTION-2: Tag lacks approved English copy.** The system prevents translation. The tag must go through UF-03 first.

**End State / Expected Outcome:** The tag has an approved translation for the target language. The approval is recorded with full traceability: who generated it, the method (AI or manual), who reviewed it, who approved it, and which English version it was based on. The translation is eligible for publishing.

**Related FRD Features:** F-06 (AI-Assisted Translation), F-08 (Review Translation), F-13 (Version History), F-17 (Audit Trail)

---

### UF-05: Bulk Translate a Page for a Language

**Flow ID:** UF-05  
**Flow Name:** Bulk Translate a Page for a Language  
**Primary Role:** Product Manager / Localization Reviewer  
**Supporting Roles:** Founder (can trigger)  
**User Goal:** Generate AI translations for all untranslated tags on a page for a specific language in a single operation, preparing them for review.  
**Business Context:** A single MioSalon page can contain dozens or hundreds of tags. Translating them one by one is impractical (FRD §F-07). Bulk translation allows a localization lead to efficiently process an entire page, then move to review. This is especially critical during new language rollouts (BRD §11.5) where every page needs translation from scratch.  
**Trigger / Entry Point:** A page has multiple tags with approved English copy but no translations for a specific language. Common triggers: a new language was added (→ UF-17), a new page was registered with many tags (→ UF-01), or translation gaps were identified through the coverage dashboard (→ UF-14).  
**Preconditions:**  
- Page exists with at least one tag that has approved English copy and no translation for the selected language  
- Target language is active  
- User has permission to create translations (FRD §8)  

**Main Success Flow:**

1. **Actor: PM or LR** — Selects a page and a target language.
2. **Actor: PM or LR** — Triggers "Translate All."
3. **System:** — Identifies all eligible tags: tags that have approved English copy and no existing Draft or Approved translation for the selected language. Tags that already have a translation (Draft or Approved) are skipped. Stale translations are not retranslated (they require explicit stale resolution via UF-08). Tags without approved English copy are skipped.
4. **System:** — AI translates all eligible tags. For each tag: generates a translation with business context, generates a back-translation, calculates a confidence score, verifies variable/placeholder integrity. All translations enter as Draft.
5. **System:** — Reports the results: count of translations generated, count of tags skipped (already translated), count of tags skipped (no approved English copy).
6. Translations are now ready for review (→ UF-06 for individual review, → UF-07 for bulk approval of high-confidence translations).

**Decision Points / Alternate Paths:**

- **ALT-A: All tags already have translations.** "Translate All" has no effect. System displays: "All tags already have translations for [language]." No action is taken.
- **ALT-B: Some tags lack approved English copy.** Those tags are skipped. The count of skipped tags is shown. The PM must author English copy for those tags first (→ UF-03).
- **ALT-C: Page has a large number of tags (100+).** The operation may take time. The system provides a progress indication.

**Failure / Exception Paths:**

- **EXCEPTION-1: AI service partially fails.** Some translations succeed, some fail. The system reports which tags failed. Successfully generated translations remain as Draft. Failed tags can be retried individually (→ UF-04) or through another bulk operation.

**End State / Expected Outcome:** All eligible tags on the page have Draft translations for the selected language, each with a back-translation and confidence score. The translations are queued for review. The PM or LR has a clear count of what was translated, what was skipped, and why.

**Related FRD Features:** F-07 (Translate All / Bulk AI Translation), F-06 (AI-Assisted Translation), F-17 (Audit Trail)

---

### UF-06: Review and Approve Translations

**Flow ID:** UF-06  
**Flow Name:** Review and Approve Translations  
**Primary Role:** Localization Reviewer  
**Supporting Roles:** Founder (can approve any translation)  
**User Goal:** Review pending translations and approve those that are accurate, correct those that are not, and ensure no translation reaches salon teams without human verification.  
**Business Context:** All translations require human approval (BRD §10, Decision 3). AI generates translations, but only reviewers make manual changes (FRD §7, Business Rule 9). The Localization Reviewer is the quality gate between AI-generated content and salon teams. This flow covers the individual review process — reviewing one translation at a time with full context. For high-volume approval, see UF-07.  
**Trigger / Entry Point:** One or more translations are in Draft or Pending Review state. The Localization Reviewer is notified that translations are ready for review, or discovers them in the review queue.  
**Preconditions:**  
- Translation exists in Draft or Pending Review state  
- User has Localization Reviewer role or above (FRD §8)  

**Main Success Flow:**

1. **Actor: LR** — Opens the review queue or navigates to a page and filters by translations in Draft or Pending Review state for a specific language.
2. **Actor: LR** — Selects a translation to review.
3. **Actor: LR** — Reviews the translation alongside: the English source copy, the back-translation, the confidence score, the variable integrity status, the page and copy type for context.
4. **DECISION: Is the translation accurate and contextually appropriate?**
   - **Yes →** Step 5 (Approve)
   - **Close but needs correction →** Step ALT-A (Edit and approve)
   - **Fundamentally incorrect →** Step ALT-B (Request retranslation)
   - **Reject entirely →** Step ALT-C (Reject)
5. **Actor: LR** — Approves the translation. Optionally adds a comment.
6. **System:** — Translation status moves to "Approved." The approval is recorded in the audit trail. The PM is notified. The translation is eligible for publishing (→ UF-10).
7. **Actor: LR** — Proceeds to the next translation in the queue. Repeats from Step 2.

**Decision Points / Alternate Paths:**

- **ALT-A: Edit and approve.** The LR corrects the translation manually, then approves. The manual correction is recorded as a new entry in the version history. The corrected version is what will reach salon teams.
- **ALT-B: Request retranslation.** The AI regenerates the translation. It returns to Draft and re-enters the review queue.
- **ALT-C: Reject.** The translation is rejected with a mandatory comment explaining the reason. The translation remains in Draft or returns to "No Translation." The rejection and reason are recorded in the audit trail.
- **ALT-D: Variable integrity failure.** The system warns the reviewer that the translation has a variable integrity issue. The reviewer can override with acknowledgement, or correct the translation before approving (FRD §F-08).

**Failure / Exception Paths:**

- **EXCEPTION-1: English copy changes during review.** The translation is flagged Stale. The reviewer is notified and must re-evaluate the translation against the new English copy. The review is paused until the stale flag is resolved (→ UF-08).

**End State / Expected Outcome:** The reviewed translation is either approved (eligible for publishing), corrected and approved, sent back for retranslation, or rejected with a recorded reason. Every review action is recorded in the audit trail with who, when, and what action was taken.

**Related FRD Features:** F-08 (Review Translation), F-17 (Audit Trail), F-18 (Comments)

---

### UF-07: Bulk Approve High-Confidence Translations

**Flow ID:** UF-07  
**Flow Name:** Bulk Approve High-Confidence Translations  
**Primary Role:** Localization Reviewer  
**Supporting Roles:** Founder (can bulk approve)  
**User Goal:** Efficiently approve multiple translations at once when AI confidence is high, reducing reviewer fatigue without compromising the human approval requirement.  
**Business Context:** When a page has many AI-generated translations with high confidence scores, reviewing each one individually creates unnecessary overhead. Bulk approval allows the reviewer to focus detailed attention on low-confidence translations while efficiently processing high-confidence ones (FRD §F-09). Bulk approval is only available above a configurable confidence threshold (default: 95%, FRD §17).  
**Trigger / Entry Point:** A page has multiple translations in Draft or Pending Review state for a language, typically after a bulk translation operation (→ UF-05).  
**Preconditions:**  
- Multiple translations exist in Draft or Pending Review state  
- User has Localization Reviewer role or above  
- At least some translations meet or exceed the configurable confidence threshold  

**Main Success Flow:**

1. **Actor: LR** — Navigates to translations for a page and language.
2. **Actor: LR** — Filters translations by confidence score at or above the configurable threshold.
3. **Actor: LR** — Reviews the filtered set at a summary level to confirm general quality.
4. **Actor: LR** — Selects multiple translations for bulk approval.
5. **System:** — Validates that all selected translations meet the confidence threshold. Excludes any translation with a variable integrity failure from the bulk action, notifying the reviewer.
6. **Actor: LR** — Confirms the bulk approval.
7. **System:** — Each individual translation in the selection is approved and recorded as a separate audit trail entry. All approved translations move to "Approved" status.
8. **Actor: LR** — Turns attention to the remaining low-confidence translations for individual review (→ UF-06).

**Decision Points / Alternate Paths:**

- **ALT-A: All translations are below the threshold.** Bulk approval is not available. All translations must be individually reviewed (→ UF-06).
- **ALT-B: A translation in the selection has a variable integrity failure.** That specific translation is excluded from the bulk approval. The reviewer is notified. The remaining translations in the selection proceed.

**Failure / Exception Paths:**

- **EXCEPTION-1: No translations meet the threshold.** Bulk approval cannot be initiated. The reviewer must individually review all translations.

**End State / Expected Outcome:** All high-confidence translations are approved efficiently. Each approval is individually recorded in the audit trail. Low-confidence translations remain for individual review. The human approval requirement is satisfied (bulk approval streamlines it, but does not bypass it).

**Related FRD Features:** F-09 (Bulk Approve Translations), F-17 (Audit Trail)

---

### UF-08: Resolve Stale Translations

**Flow ID:** UF-08  
**Flow Name:** Resolve Stale Translations  
**Primary Role:** Localization Reviewer  
**Supporting Roles:** Founder (can resolve)  
**User Goal:** Evaluate translations flagged as stale because the English source changed, and either confirm they are still correct or initiate a retranslation, so that translations remain aligned with the current English copy.  
**Business Context:** When English copy changes (UF-03), all existing translations of that tag are automatically flagged Stale across all languages (FRD §5.2). The stale flag is advisory — the existing published translation remains live in production (FRD §7, Business Rule 6). However, stale translations represent a potential accuracy gap that must be resolved by a human reviewer. Each language resolves staleness independently (FRD §7, Business Rule 7). This is a critical quality mechanism: without it, translations silently drift out of date as the English copy evolves (BRD §4.4).  
**Trigger / Entry Point:** The LR sees stale translations on the coverage dashboard, in the stale translations list, or is notified that English copy changed for tags they manage.  
**Preconditions:**  
- One or more translations are in Stale state  
- The LR has permission to resolve stale translations (FRD §8)  

**Main Success Flow:**

1. **Actor: LR** — Identifies stale translations. This can be through the stale translations list (grouped by language and page, sorted by age), the coverage dashboard, or a notification.
2. **Actor: LR** — Opens a stale translation and sees: the previous English copy (what the translation was originally based on), the new English copy (what changed), and the current translation.
3. **DECISION: Does the English change affect the meaning of the translation?**
   - **The existing translation is still correct →** Step 4 (Confirm)
   - **The translation needs updating →** Step ALT-A (Retranslate)
4. **Actor: LR** — Confirms the existing translation. The translation returns to "Approved" status.
5. **System:** — Records which English version the translation was confirmed against. The confirmation is recorded in the audit trail.

**Decision Points / Alternate Paths:**

- **ALT-A: Retranslate.** The LR triggers retranslation. AI generates a new translation based on the new English copy. The new translation enters as Draft, replacing the stale version in the workflow (the stale version is preserved in version history). The new Draft goes through the standard review cycle (→ UF-06). The currently deployed (stale) translation remains live in production until a new version is published.
- **ALT-B: English copy changes again during resolution.** If the English copy changes a second time while the LR is resolving a stale translation, the translation becomes stale against the newest English version. The LR must re-evaluate against the latest English copy.
- **ALT-C: Bulk stale resolution.** The LR works through multiple stale translations for the same language in sequence, confirming or retranslating each one. Each resolution is independent.

**Failure / Exception Paths:**

- **EXCEPTION-1: Stale translation has already been deployed to Production.** This is not an error. The deployed translation remains live. Stale is advisory, not blocking (FRD §F-10). The resolution process determines what happens next — either the current translation is confirmed as still correct, or a new version is created and promoted through the pipeline.

**End State / Expected Outcome:** Each stale translation is resolved: either confirmed as still correct (returns to Approved) or retranslated (enters Draft for review). The resolution is recorded in the audit trail. Currently deployed translations are not removed during resolution.

**Related FRD Features:** F-10 (Resolve Stale Translation), F-16 (Coverage Dashboard), F-17 (Audit Trail)

---

### UF-09: Founder Reviews Escalated Copy

**Flow ID:** UF-09  
**Flow Name:** Founder Reviews Escalated Copy  
**Primary Role:** Founder  
**Supporting Roles:** PM (escalates), SR (escalates), LR (escalates)  
**User Goal:** Review and provide final approval on UX copy that has been escalated as sensitive, high-impact, or uncertain, ensuring that critical labels align with the product's direction.  
**Business Context:** The Founder is the final approval authority for sensitive UX copy decisions (FRD §2.5). Escalation is a judgment call — the PM, SR, or LR escalates labels when they are not confident the copy is appropriate for salon teams, or when the copy involves a core billing workflow, onboarding, or language that defines how MioSalon describes its features (BRD §11.3). The Founder participates in review when needed without being a bottleneck for every change (BRD §11.3).  
**Trigger / Entry Point:** A PM, SR, or LR escalates specific labels to the Founder for review. The Founder sees the escalated items in a review queue.  
**Preconditions:**  
- English copy or translation has been explicitly escalated to the Founder  
- The Founder has all permissions (FRD §8)  

**Main Success Flow:**

1. **Actor: PM or SR or LR** — Escalates specific labels to the Founder during the review process, flagging them as requiring Founder attention.
2. **System:** — The Founder is notified. The escalated items appear in the Founder's review queue.
3. **Actor: FN** — Reviews the escalated copy in context (page, copy type, business implications).
4. **DECISION: Does the copy meet the Founder's standards?**
   - **Yes →** Step 5 (Approve)
   - **Needs revision →** Step ALT-A (Request revision)
5. **Actor: FN** — Approves the copy. Optionally adds a comment.
6. **System:** — The copy status moves to Approved. The Founder's approval is recorded in the audit trail. The copy proceeds through the normal pipeline (translation and/or publishing).

**Decision Points / Alternate Paths:**

- **ALT-A: Founder requests revision.** The Founder returns the copy with feedback explaining what should change. The copy returns to Draft. The original author (PM/QA) is notified and revises (returns to UF-03, Step 2).
- **ALT-B: Founder edits directly.** The Founder has permission to edit English copy directly. The Founder makes the change, and the edited version proceeds through the approval chain or is self-approved.

**Failure / Exception Paths:**

- None specific. This flow has no failure conditions beyond the standard review actions.

**End State / Expected Outcome:** The escalated copy is either Founder-approved (proceeds to translation/publishing) or returned for revision with the Founder's feedback. The Founder's action is recorded in the audit trail.

**Related FRD Features:** F-04 (Author English Copy), F-05 (Edit English Copy), F-08 (Review Translation), F-17 (Audit Trail)

---

## 5. Publishing and Recovery Flows

---

### UF-10: Publish Approved Content to a Target Environment

**Flow ID:** UF-10  
**Flow Name:** Publish Approved Content to a Target Environment  
**Primary Role:** Varies by target environment (see business rules below)  
**Supporting Roles:** PM (initiates to Dev), LR (initiates to Dev/QA), SR (approves to Production), FN (approves to any environment), QA (verifies in Dev and QA builds)  
**User Goal:** Publish all approved content for a specific page and language from MioTranslate to a target environment (Dev, QA, or Production), making the labels available in that environment.  
**Business Context:** MioTranslate formalizes and tracks the pipeline that already exists (Dev → QA → Production) but is currently manual and untracked (BRD §4.2). MioTranslate is always the source. Each environment is a target with its own Language Services API endpoint (FRD §4.10). The unit of publishing is a page bundle: one page + one language (FRD §7, Business Rule 14). Publishing one language does not affect other languages; publishing one page does not affect other pages.  
**Trigger / Entry Point:** A page has approved content (English copy and/or translations) that is ready for a target environment. This typically follows UF-03 (English copy approved), UF-06/UF-07 (translations approved), or UF-08 (stale translations resolved).  
**Preconditions:**  
- The page bundle has at least some approved content in MioTranslate  
- The user has the appropriate permission for the target environment (FRD §8)  

**Main Success Flow:**

1. **Actor: Publisher** — Selects a page and language.
2. **Actor: Publisher** — Views the current environment status: which version is currently published in each environment (Dev, QA, Production) for this page and language.
3. **Actor: Publisher** — Selects the target environment (Dev, QA, or Production).
4. **System:** — Displays a pre-publishing summary: which tags are included in the bundle, what has changed compared to what is currently live in the target environment. Tags in Draft or Pending Review are excluded from the bundle and the excluded count is shown.
5. **Actor: Publisher** — Reviews the summary and initiates publishing.
6. **DECISION: Who approves?** The required approver depends on the target environment:
   - **Dev:** Author (PM/QA) or Reviewer — publishing may be implicit once approval conditions are met (FRD §17, Resolved Questions)
   - **QA:** Reviewer (LR or SR)
   - **Production:** Support Reviewer or Founder
7. **Actor: Required Approver** — Approves the publishing action.
8. **System:** — Pushes the approved page bundle to the target environment's Language Services API endpoint. Creates a new version snapshot. Records the publishing action in the audit trail and deployment history (who published, when, what version, which target environment, tag count).
9. **System:** — Confirms successful publishing.

**Decision Points / Alternate Paths:**

- **ALT-A: Publishing to Dev is implicit.** Per resolved question (FRD §17), once approval conditions are met, approved content is automatically published to Dev. The user does not need to manually initiate Dev publishing. The automatic action is still recorded.
- **ALT-B: Not all tags have approved content.** A page bundle can be published even if not all tags have translations (FRD §11, Publishing Validations). Only approved tags are included. The system reports which tags were excluded.
- **ALT-C: Same version already deployed.** System prevents duplicate publishing — the same version cannot be re-published to an environment where it is already deployed (FRD §11, Duplicate Prevention).
- **ALT-D: Publishing to Production.** After publishing to Production, the PM and SR are notified that labels are now live for salon teams (FRD §12). The QA verifies in the Production environment.

**Failure / Exception Paths:**

- **EXCEPTION-1: No approved content to publish.** All tags on the page are in Draft or Pending Review. Publishing cannot proceed. System displays: "No approved content to publish."
- **EXCEPTION-2: Target endpoint unreachable.** Publishing fails. The system records the failure. Content remains in MioTranslate. The PM and ADMIN are notified to investigate. The user can retry.
- **EXCEPTION-3: Approver rejects the publishing action.** The approver reviews the pre-publishing summary and decides not to approve. The publishing action is not executed. The rejection reason is recorded.

**End State / Expected Outcome:** The approved page bundle is successfully published to the target environment. The deployment history shows the new entry. The previous version in that environment is superseded. All actions are recorded in the audit trail. For Production publishing: salon teams now see the published labels.

**Related FRD Features:** F-11 (Publish Page Bundle), F-17 (Audit Trail)

---

### UF-11: Roll Back Published Content

**Flow ID:** UF-11  
**Flow Name:** Roll Back Published Content  
**Primary Role:** Support Reviewer (Production) / Founder  
**Supporting Roles:** PM (notified), QA (notified), LR (prepares corrected version)  
**User Goal:** Revert a page bundle to a previous version in a target environment because the current version contains an error, restoring the last known good state while the team prepares a fix.  
**Business Context:** When a wrong label or mistranslation is discovered in production (or any environment), the team needs the ability to quickly restore the previous version. Today, there is no way to undo a promotion (BRD §11.4). Rollback is a safety mechanism that does not delete the bad version — it preserves it for investigation while restoring a known good version (FRD §F-12).  
**Trigger / Entry Point:** A wrong label or translation is discovered in an environment (typically Production, reported by a salon team, the support team, or QA). Alternatively, a QA verification in Dev or QA reveals a problem.  
**Preconditions:**  
- A previous version exists in the deployment history for the page, language, and target environment (FRD §11, Lifecycle Validations)  
- The user has rollback permission: Support Reviewer or Founder for Production (FRD §8)  

**Main Success Flow:**

1. **Actor: SR or FN** — Identifies that the currently deployed version of a page bundle contains an error.
2. **Actor: SR or FN** — Navigates to the deployment history for the affected page and language.
3. **Actor: SR or FN** — Sees all previous versions deployed to the environment with timestamps, publishers, and version details.
4. **Actor: SR or FN** — Selects the version to roll back to (typically the immediately previous version).
5. **Actor: SR or FN** — Initiates rollback.
6. **System:** — Re-publishes the selected previous version to the target environment. Creates a new deployment record noting it is a rollback. The bad version is not deleted — it remains in MioTranslate for investigation. PM, QA, and SR are notified that a rollback has occurred.
7. The team investigates and corrects the issue, creating a new version that proceeds through the normal pipeline (→ UF-03 for English corrections, → UF-12 for translation corrections).

**Decision Points / Alternate Paths:**

- **ALT-A: Rollback contains deprecated tags.** If the previous version includes tags that have since been deprecated, the rollback proceeds anyway. Deprecated tags in the bundle still appear. This is a safety measure (FRD §F-12).
- **ALT-B: Rollback in Dev or QA.** The same flow applies to any environment. The approval requirement depends on the environment's approver rules.

**Failure / Exception Paths:**

- **EXCEPTION-1: No previous version exists.** This is the first-ever deployment for this page, language, and environment. Rollback is not available. The team must create a corrected version and publish it through the normal pipeline.

**End State / Expected Outcome:** The target environment is restored to the selected previous version. Salon teams (for Production rollback) now see the restored labels. The rollback action is recorded in the audit trail and deployment history. The bad version is preserved for investigation. The team has a clear path to fix the issue and re-publish.

**Related FRD Features:** F-12 (Rollback), F-17 (Audit Trail)

---

### UF-12: Correct a Translation Reported in Production

**Flow ID:** UF-12  
**Flow Name:** Correct a Translation Reported in Production  
**Primary Role:** Localization Reviewer  
**Supporting Roles:** Support Reviewer (receives the report, may initiate rollback), PM (coordinates), Founder (approves Production publishing)  
**User Goal:** Correct a wrong translation that has been reported by a salon team or the support team, and publish the corrected version to Production so that salon teams see the accurate label.  
**Business Context:** When a salon team in a specific market reports an incorrect label (BRD §11.4, FRD §WF-06), the team must identify the error, correct it, and push the fix to Production. This flow combines investigation, correction, review, and publishing into a single end-to-end flow because the user's goal is not complete until the correct label is live.  
**Trigger / Entry Point:** A salon team or the support team reports that a label in a specific language is wrong or misleading in Production.  
**Preconditions:**  
- The reported tag exists in MioTranslate  
- The current translation is published to Production  

**Main Success Flow:**

1. **Actor: SR or Support Team** — Receives the report of a wrong label. Looks up the tag in MioTranslate by searching for the label text, tag ID, or page name (→ UF-13).
2. **DECISION: Is the issue urgent enough for an immediate rollback?**
   - **Yes, urgent →** Step ALT-A (Rollback first, then fix)
   - **No, can proceed with a normal fix →** Step 3
3. **HANDOFF → Localization Reviewer**
4. **Actor: LR** — Identifies the error by reviewing the current translation alongside the English source and translation history.
5. **Actor: LR** — Corrects the translation manually and approves the corrected version.
6. **System:** — The corrected translation enters as "Approved." The manual correction is recorded in the version history and audit trail.
7. The corrected translation is published through the environment pipeline (→ UF-10): Dev → QA → Production. The SR or FN approves the Production publishing.
8. Salon teams see the corrected label.

**Decision Points / Alternate Paths:**

- **ALT-A: Urgent rollback.** The SR or FN initiates a rollback to the previous version in Production (→ UF-11) to immediately remove the wrong label. The fix is then prepared in parallel and published through the normal pipeline. This path is used when the wrong label is causing active confusion or damage.

**Failure / Exception Paths:**

- **EXCEPTION-1: Tag not found.** The reported label does not match any tag in MioTranslate. This may indicate the label comes from a developer hardcoded fallback that was never managed in MioTranslate. The team must investigate outside MioTranslate.

**End State / Expected Outcome:** The correct translation is live in Production. Salon teams see the accurate label. The correction is fully traceable: the original error, who reported it, who corrected it, who approved it, and when it was published. If a rollback was performed, that is also recorded.

**Related FRD Features:** F-08 (Review Translation), F-11 (Publish Page Bundle), F-12 (Rollback), F-14 (Search), F-17 (Audit Trail)

---

## 6. Operational and Administrative Flows

---

### UF-13: Find and Inspect UX Copy

**Flow ID:** UF-13  
**Flow Name:** Find and Inspect UX Copy  
**Primary Role:** All Roles  
**Supporting Roles:** None  
**User Goal:** Find a specific tag, page, or label in MioTranslate and understand its current state: what it says, in which languages, what status it is in, and where it is deployed.  
**Business Context:** MioTranslate manages a large and growing volume of UX copy across many pages and languages. Every role needs to find specific content quickly — a PM looking for a tag to update, a developer looking up a tag ID for code, a support team member investigating a reported issue, a localization reviewer finding their next piece of work. Without efficient search and browsing, the system's value diminishes as volume grows (FRD §F-01, F-14, F-15).  
**Trigger / Entry Point:** The user needs to find specific content in MioTranslate. This may be triggered by a direct need (e.g., "What does the Invoice Total label say in Arabic?") or as a starting point for another flow.  
**Preconditions:**  
- MioTranslate has been initialized with at least one page  
- The user has view access (all roles have view access per FRD §8)  

**Main Success Flow:**

1. **Actor: Any user** — Enters MioTranslate and either browses the page list or uses search.
2. **DECISION: Does the user know what they are looking for?**
   - **Yes, specific tag or label →** Step 3 (Search)
   - **No, exploring →** Step ALT-A (Browse)
3. **Actor: Any user** — Enters a search query (tag ID, English copy text, page name, or page ID). Search is case-insensitive and returns results across all pages.
4. **System:** — Returns matching tags with their page, English copy, and status. Results are sortable by page, status, and relevance.
5. **Actor: Any user** — Selects a result to view the tag detail: English copy, translation status per language, copy type, version history.
6. From the tag detail, the user can navigate directly to author English copy (→ UF-03), translate (→ UF-04), review (→ UF-06), view history (→ UF-15), or add a comment.

**Decision Points / Alternate Paths:**

- **ALT-A: Browse by page.** The user browses the page list. Each page shows: Page Name, Page ID, Module, total tag count, and per-language translation summary. Pages can be filtered by module and translation completeness. Pages can be sorted by name, module, tag count, or translation coverage for a selected language.
- **ALT-B: Filter by translation state.** Within any page view, the user filters tags by: No Translation, Draft, Pending Review, Approved, or Stale. Filters can be combined with a language selector. This is especially useful for the LR finding work and the PM assessing readiness.
- **ALT-C: Bookmark for quick access.** The user bookmarks pages or tags for future quick access. Bookmarks are personal.

**Failure / Exception Paths:**

- **EXCEPTION-1: Search returns zero results.** System displays "No results found." The user refines the search query.
- **EXCEPTION-2: MioTranslate has zero pages.** System displays an empty state with guidance to create the first page or run the initial migration (→ UF-01 or UF-02).

**End State / Expected Outcome:** The user has located the content they need and understands its current state. They can proceed to any content management action from the tag detail view. No content is created or modified in this flow; it is a read-only navigation and discovery experience.

**Related FRD Features:** F-01 (Page & Tag Browsing), F-14 (Search), F-15 (Filter by Translation State), §9.7 (Bookmarks), §9.8 (Recently Edited)

---

### UF-14: Monitor Translation Coverage and Readiness

**Flow ID:** UF-14  
**Flow Name:** Monitor Translation Coverage and Readiness  
**Primary Role:** Product Manager / Founder  
**Supporting Roles:** Localization Reviewer (acts on findings), Administrator  
**User Goal:** Understand the current state of translation coverage across all pages and languages, identify gaps and priorities, and make informed decisions about translation investment and language expansion.  
**Business Context:** Today, translation status is invisible (BRD §4.4). No one can answer: "Which pages are fully translated for Arabic?" or "Are we ready to launch in a new market?" The coverage dashboard and reporting features make translation status a known quantity, enabling planning instead of guesswork (BRD §11.5).  
**Trigger / Entry Point:** A stakeholder needs to understand translation readiness — during quarterly planning, before a release, when evaluating a new market, or as a routine check.  
**Preconditions:**  
- MioTranslate has been initialized with pages, tags, and at least some translations  

**Main Success Flow:**

1. **Actor: PM or FN** — Opens the coverage dashboard.
2. **Actor: PM or FN** — Views the coverage matrix: pages (rows) by languages (columns). Each cell shows the coverage percentage (tags approved and deployed to Production / total active tags). Summary rows show overall coverage per language. Summary columns show overall coverage per page.
3. **DECISION: What does the user need to understand?**
   - **Language readiness →** Step 4
   - **Page readiness →** Step ALT-A
   - **Stale translation status →** Step ALT-B
   - **Pending work volume →** Step ALT-C
4. **Actor: PM or FN** — Selects a language to view language readiness: all pages ranked by coverage for that language. Identifies which pages have the most gaps and require priority attention.
5. **Actor: PM or FN** — Drills into a specific cell to see per-tag status for that page and language.
6. Based on findings, the PM or FN prioritizes work: directs the LR to focus on specific pages or languages, plans translation sprints, or reports readiness to leadership.

**Decision Points / Alternate Paths:**

- **ALT-A: Page readiness.** The PM selects a page to see all languages and their status for that page. This answers: "Is this page ready across all languages?" Useful before a feature release.
- **ALT-B: Stale translation status.** The PM views the stale translations list: all stale translations grouped by language and page, sorted by age (oldest first). This identifies which translations have been out of sync the longest and need priority resolution (→ UF-08).
- **ALT-C: Pending work volume.** The PM views the pending work summary: how many tags need English copy, how many need translation, how many are pending review, how many are stale. This provides a snapshot of outstanding work for operational planning.
- **ALT-D: New language assessment.** Leadership considers entering a new market (e.g., Portuguese). The PM or FN uses the dashboard to assess the total volume of active tags across all pages that would need translation for the new language, before committing to a timeline. This answers: "How much effort is required?"

**Failure / Exception Paths:**

- None specific. This is a read-only, informational flow.

**End State / Expected Outcome:** The stakeholder has a clear, data-driven understanding of translation coverage across all pages and languages. They can identify gaps, prioritize work, assess readiness for new markets, and report status to leadership — all without manual exports or investigation. Planning replaces guesswork.

**Related FRD Features:** F-16 (Coverage Dashboard), §13.1 (Coverage Report), §13.2 (Translation Readiness Report), §13.3 (Pending Work Report), §13.4 (Stale Translations Report)

---

### UF-15: Investigate a Label Issue Using History and Audit Trail

**Flow ID:** UF-15  
**Flow Name:** Investigate a Label Issue Using History and Audit Trail  
**Primary Role:** Any role (typically SR, PM, or FN)  
**Supporting Roles:** None  
**User Goal:** When a label is reported as incorrect, trace its complete history to determine what happened: who entered it, when, what it said before, whether it was reviewed, and whether the correct version was deployed.  
**Business Context:** Today, investigation depends on finding the right developer and hoping they remember (BRD §4.3). MioTranslate provides a complete, immutable audit trail for every action and version history for every tag. Root cause analysis becomes immediate rather than investigative (BRD §11.6).  
**Trigger / Entry Point:** A label is reported as incorrect, a stakeholder asks about the history of a specific label, or a compliance or quality audit requires traceability.  
**Preconditions:**  
- The tag exists in MioTranslate  
- The user has view access (all roles per FRD §8)  

**Main Success Flow:**

1. **Actor: Investigator** — Finds the tag in MioTranslate using search (→ UF-13).
2. **Actor: Investigator** — Selects the relevant language (English or a specific translation).
3. **Actor: Investigator** — Views the version history: a chronological list of all versions showing who changed it, when, what it said before, what it says now, and the change reason.
4. **Actor: Investigator** — If needed, compares two specific versions side by side to see the exact differences.
5. **Actor: Investigator** — Views the audit trail for this tag: every action taken (creation, edits, approvals, rejections, promotions, rollbacks) with who, when, and details.
6. **Actor: Investigator** — Determines root cause. For example: "The English copy was updated on July 20, but the Italian translation was approved on July 16 based on the previous English version. The translation was flagged Stale on July 20 but never re-verified. Root cause: unresolved stale translation."
7. Based on findings, the investigator initiates the appropriate corrective action (→ UF-08 for stale resolution, → UF-12 for production correction, → UF-11 for rollback).

**Decision Points / Alternate Paths:**

- **ALT-A: Investigation across multiple tags.** The investigator searches the audit trail by user, date range, action type, page, or language to understand broader patterns (e.g., "What did this reviewer approve last week?").
- **ALT-B: Activity report for a user.** An administrator or founder views all actions taken by a specific user within a date range for workload assessment or accountability.
- **ALT-C: Deployment history investigation.** The investigator views the deployment history for a page and language: all promotions and rollbacks with who, when, and what version. This answers: "When did this version reach Production?"

**Failure / Exception Paths:**

- **EXCEPTION-1: Tag was imported during migration.** The version history begins with the imported state. Pre-migration history does not exist in MioTranslate — it was part of the untracked legacy process.

**End State / Expected Outcome:** The investigator has a complete understanding of the label's lifecycle: who authored it, who reviewed it, who approved it, when it was promoted, and what version is currently live. Root cause is identified in minutes rather than days. Institutional knowledge is preserved in the system, not in individual memory.

**Related FRD Features:** F-13 (View Version History), F-17 (Audit Trail), §9.4 (Version Comparison), §13.6 (Deployment History Report), §13.7 (Activity Report)

---

### UF-16: Deprecate a Tag

**Flow ID:** UF-16  
**Flow Name:** Deprecate a Tag  
**Primary Role:** Product Manager / Founder  
**Supporting Roles:** Developer (removes the tag reference from MioSalon's codebase)  
**User Goal:** Mark a tag as deprecated when it is no longer needed in MioSalon, removing it from active workflows while preserving its complete history.  
**Business Context:** As MioSalon evolves, some screens are removed and some labels become obsolete. Tags cannot be deleted (FRD §F-02, Business Rule) — they are marked Deprecated and retained for historical reference. Deprecating a tag prevents the localization team from spending effort translating labels that no longer exist in the product (BRD §11.7). If all tags on a page are deprecated, the page itself is marked Deprecated (FRD §7, Lifecycle Rule 25).  
**Trigger / Entry Point:** A developer removes a screen or label from MioSalon's codebase, or the PM identifies a tag that is no longer needed.  
**Preconditions:**  
- The tag exists and is currently Active  
- The user has permission to deprecate tags (PM or FN per FRD §8)  

**Main Success Flow:**

1. **Actor: PM or FN** — Identifies the tag that is no longer needed.
2. **Actor: PM or FN** — Marks the tag as Deprecated in MioTranslate.
3. **System:** — The tag is excluded from active workflows: no further translation, review, or publishing actions are initiated for it. The tag remains visible in the registry with a "Deprecated" indicator. All history and audit records are preserved. The deprecation is recorded in the audit trail.
4. **System (if all tags on the page are now deprecated):** — The page is automatically marked Deprecated. It remains in the registry for historical reference but is excluded from active counts on the coverage dashboard.
5. **HANDOFF → Developer** — The developer removes the tag reference from MioSalon's codebase.

**Decision Points / Alternate Paths:**

- None. Deprecation is a one-directional action. There is no "un-deprecate" flow defined in the FRD.

**Failure / Exception Paths:**

- None specific. Deprecation is always possible for an active tag.

**End State / Expected Outcome:** The tag is Deprecated. It is excluded from active workflows. Its complete history is preserved. The developer removes it from the codebase. If the page is now fully deprecated, it is also marked accordingly.

**Related FRD Features:** F-02 (Create Page & Tag — lifecycle), F-17 (Audit Trail)

---

### UF-17: Add a New Language

**Flow ID:** UF-17  
**Flow Name:** Add a New Language  
**Primary Role:** Administrator / Founder  
**Supporting Roles:** PM (prioritizes translation work), LR (translates)  
**User Goal:** Add a new language to MioTranslate so that translations can be created and published for that language, enabling MioSalon to serve salon teams in a new market.  
**Business Context:** MioSalon currently operates in eight languages. As the business expands, new languages will be added. Adding a language must be a structured, plannable process — not a coordination exercise dependent on spreadsheets and developer availability (BRD §11.5, Objective 6). When a language is added, every active tag across every page receives an empty translation slot, making the total translation effort visible immediately.  
**Trigger / Entry Point:** Leadership decides to expand MioSalon to a new market/language.  
**Preconditions:**  
- The user has Administrator or Founder permissions (FRD §8)  

**Main Success Flow:**

1. **Actor: ADMIN or FN** — Adds a new language to MioTranslate by providing: language code, language name, status (Active), and direction (LTR or RTL).
2. **System:** — Creates the language. All existing active tags across all pages receive an empty translation slot for the new language. The language addition is recorded in the audit trail.
3. The coverage dashboard immediately shows the new language with 0% coverage across all pages.
4. **HANDOFF → PM and LR** — The PM uses the coverage dashboard (→ UF-14) to prioritize which pages should be translated first (high-traffic pages before low-traffic). The LR begins translation work using bulk translation (→ UF-05) and individual translation (→ UF-04), followed by review (→ UF-06, UF-07) and publishing (→ UF-10).
5. The coverage dashboard tracks progress as translations are completed and published: "New Language: Page A 100%, Page B 85%, Page C 0%..."

**Decision Points / Alternate Paths:**

- **ALT-A: Deactivate a language.** The ADMIN or FN deactivates an existing language. Existing translations and history are preserved. No new translations or promotions occur for the deactivated language. The language cannot be deleted (FRD §5.7). This is used when MioSalon exits a market.

**Failure / Exception Paths:**

- None specific. Adding a language is a configuration action with no failure conditions beyond permission checks.

**End State / Expected Outcome:** The new language is active in MioTranslate. Every active tag has an empty translation slot for the new language. The coverage dashboard shows 0% coverage across all pages, making the total translation effort immediately visible and plannable. The PM can begin prioritizing and directing translation work.

**Related FRD Features:** F-21 (Administration — language management), F-16 (Coverage Dashboard), F-17 (Audit Trail)

---

### UF-18: Manage User Roles and System Configuration

**Flow ID:** UF-18  
**Flow Name:** Manage User Roles and System Configuration  
**Primary Role:** Administrator / Founder  
**Supporting Roles:** None  
**User Goal:** Configure MioTranslate's operational parameters: assign roles to users, set the confidence threshold for bulk approval, and manage system settings to ensure the platform enforces the organization's governance policies.  
**Business Context:** MioTranslate enforces governance through role-based permissions (FRD §8). The right people must have the right access: PMs author copy, LRs approve translations, SRs approve Production publishing. The Administrator ensures these assignments are correct. System configuration (such as the confidence threshold for bulk approval) affects how governance rules are applied (FRD §5.7).  
**Trigger / Entry Point:** A new team member joins and needs a role, an existing member's responsibilities change, or the organization needs to adjust a configuration parameter (e.g., the bulk approval confidence threshold).  
**Preconditions:**  
- The user has Administrator or Founder permissions (FRD §8)  

**Main Success Flow:**

1. **Actor: ADMIN or FN** — Navigates to the administration area.
2. **DECISION: What does the administrator need to do?**
   - **Assign or modify a user role →** Step 3
   - **Configure system settings →** Step ALT-A
3. **Actor: ADMIN or FN** — Assigns a role to a user (PM, QA, Localization Reviewer, Support Reviewer, Developer, Administrator). A user can hold multiple roles (FRD §5.7).
4. **System:** — Records the role assignment in the audit trail. The user's permissions are updated immediately.

**Decision Points / Alternate Paths:**

- **ALT-A: Configure system settings.** The ADMIN or FN adjusts the confidence threshold for bulk approval (default 95%, configurable per FRD §17). Or configures which pages or labels require Founder-level approval (though per FRD §17, escalation is currently a judgment call rather than a system-enforced rule per page). All configuration changes are recorded in the audit trail.

**Failure / Exception Paths:**

- None specific. Configuration actions are straightforward with no failure conditions beyond permission checks.

**End State / Expected Outcome:** The user role is assigned or the system configuration is updated. The change is recorded in the audit trail. The system immediately enforces the new permissions or configuration.

**Related FRD Features:** F-21 (Administration), F-17 (Audit Trail)

---

### UF-19: Export Tag Data for External Review

**Flow ID:** UF-19  
**Flow Name:** Export Tag Data for External Review  
**Primary Role:** Product Manager / Localization Reviewer / Administrator  
**Supporting Roles:** None  
**User Goal:** Export tag data for a page and language in a format suitable for offline review, external reporting, or coordination outside MioTranslate.  
**Business Context:** While MioTranslate is the single source of truth, there are situations where the team needs data outside the platform: sharing translation status with external stakeholders, performing offline review, or creating reports for leadership. Exports are read-only snapshots; they cannot be re-imported to modify data (FRD §F-19).  
**Trigger / Entry Point:** The user needs to share or analyze tag data outside MioTranslate.  
**Preconditions:**  
- The user has export permission (PM, LR, SR, FN, or ADMIN per FRD §8)  
- At least one page exists  

**Main Success Flow:**

1. **Actor: PM or LR** — Selects a page and language for export.
2. **Actor: PM or LR** — Initiates the export.
3. **System:** — Generates an export file (CSV or Excel) containing: tag ID, English copy, translation, status, and confidence score for each tag.
4. **Actor: PM or LR** — Downloads the export file.

**Decision Points / Alternate Paths:**

- None. This is a straightforward data extraction flow.

**Failure / Exception Paths:**

- None specific.

**End State / Expected Outcome:** The user has a snapshot of tag data in CSV or Excel format reflecting the current state at the time of export. The data is read-only and cannot be re-imported.

**Related FRD Features:** F-19 (Export), §9.9 (Exports)

---

## 7. Cross-Flow Dependencies

The following shows how the user flows relate to each other. Arrows indicate which flows feed into or depend on other flows.

### Primary Dependency Chains

**Chain 1 — New content lifecycle (the most common path):**

> UF-01 (Register Page & Tags) → UF-03 (Author English Copy) → UF-04 or UF-05 (Translate) → UF-06 or UF-07 (Review/Approve Translations) → UF-10 (Publish)

**Chain 2 — English copy change cascade:**

> UF-03 (Edit English Copy) → System flags Stale → UF-08 (Resolve Stale) → UF-06 (Review retranslation) → UF-10 (Publish updated content)

**Chain 3 — New language rollout:**

> UF-17 (Add Language) → UF-14 (Assess volume via dashboard) → UF-05 (Bulk Translate priority pages) → UF-07 (Bulk Approve high-confidence) + UF-06 (Individually review low-confidence) → UF-10 (Publish per page)

**Chain 4 — Production issue resolution:**

> Report received → UF-13 (Find the tag) → UF-15 (Investigate history) → UF-11 (Rollback if urgent) + UF-12 (Correct translation) → UF-10 (Republish corrected version)

**Chain 5 — System initialization:**

> UF-02 (Migration) → UF-13 (Browse/verify) → UF-14 (Assess coverage) → Normal operations begin

### Supporting Flow Dependencies

| Flow | Feeds Into | Depends On |
|---|---|---|
| UF-01 | UF-03 | None (foundation) |
| UF-02 | All flows (initialization) | None (one-time) |
| UF-03 | UF-04, UF-05, UF-08, UF-10 | UF-01 or UF-02 |
| UF-04 | UF-06, UF-10 | UF-03 |
| UF-05 | UF-06, UF-07, UF-10 | UF-03 |
| UF-06 | UF-10 | UF-04 or UF-05 |
| UF-07 | UF-10 | UF-05 |
| UF-08 | UF-06, UF-10 | UF-03 (triggers stale) |
| UF-09 | UF-03, UF-10 | UF-03 (escalation) |
| UF-10 | None (terminal) | UF-03, UF-06, UF-07, UF-08 |
| UF-11 | UF-12 | UF-10 |
| UF-12 | UF-10 | UF-11 (optional) |
| UF-13 | All flows (entry point) | UF-01 or UF-02 |
| UF-14 | UF-05, UF-08 (prioritization) | All content flows |
| UF-15 | UF-08, UF-11, UF-12 | UF-13 |
| UF-16 | None | UF-01 |
| UF-17 | UF-05, UF-14 | None |
| UF-18 | All flows (governance) | None |
| UF-19 | None (standalone) | Content exists |

---

## 8. Role-Flow Responsibility Matrix

This matrix shows which role is the primary actor, a supporting actor, or not involved in each flow.

| Flow | PM | QA | LR | SR | FN | DEV | ADMIN |
|---|---|---|---|---|---|---|---|
| UF-01 Register Page & Tags | **Primary** | — | — | — | Can act | Support | — |
| UF-02 Initial Migration | — | Support | — | — | **Primary** | — | **Primary** |
| UF-03 Author English Copy | **Primary** | Can author | — | Reviews | Escalation | — | — |
| UF-04 Translate Single Tag | Triggers | — | **Primary** | — | Can act | — | — |
| UF-05 Bulk Translate Page | Triggers | — | **Primary** | — | Can act | — | — |
| UF-06 Review Translations | — | — | **Primary** | — | Can act | — | — |
| UF-07 Bulk Approve | — | — | **Primary** | — | Can act | — | — |
| UF-08 Resolve Stale | — | — | **Primary** | — | Can act | — | — |
| UF-09 Founder Escalation | Escalates | — | Escalates | Escalates | **Primary** | — | — |
| UF-10 Publish | To Dev | — | To QA | To Prod | To any | — | — |
| UF-11 Rollback | Notified | Notified | — | **Primary** | **Primary** | — | — |
| UF-12 Correct Production | Coordinates | — | **Primary** | Reports | Approves Prod | — | — |
| UF-13 Find & Inspect | Uses | Uses | Uses | Uses | Uses | Uses | Uses |
| UF-14 Monitor Coverage | **Primary** | — | Acts on | — | **Primary** | — | — |
| UF-15 Investigate History | Uses | Uses | Uses | **Primary** | Uses | Uses | Uses |
| UF-16 Deprecate Tag | **Primary** | — | — | — | Can act | Support | — |
| UF-17 Add Language | Support | — | Support | — | Can act | — | **Primary** |
| UF-18 System Configuration | — | — | — | — | Can act | — | **Primary** |
| UF-19 Export | Uses | — | Uses | Uses | Uses | — | Uses |

---

## 9. Validation Checklist

### 9.1 BRD Coverage

Every business problem and objective from the BRD is addressed by one or more user flows.

| BRD Reference | Addressed By |
|---|---|
| Problem 4.1: Every copy change requires a developer | UF-01, UF-03 |
| Problem 4.2: Path to production is manual and untracked | UF-10, UF-11, UF-15 |
| Problem 4.3: No ownership or accountability | UF-03, UF-06, UF-15 |
| Problem 4.4: Translation status is invisible | UF-14 |
| Problem 4.5: Workflow is unstructured | UF-03, UF-04, UF-05, UF-06, UF-07, UF-08 |
| Objective 1: Single source of truth | UF-01, UF-02 |
| Objective 2: Remove engineering dependency | UF-01, UF-03 |
| Objective 3: Governance before production | UF-03, UF-06, UF-09, UF-10 |
| Objective 4: Translation quality assurance | UF-04, UF-05, UF-06, UF-07, UF-08 |
| Objective 5: Visibility into translation status | UF-14 |
| Objective 6: Plannable language expansion | UF-14, UF-17 |
| Objective 7: Audit trail | UF-15 (and all flows record actions) |

### 9.2 FRD Feature Coverage

Every FRD feature specification is represented in the user flows.

| FRD Feature | Primary Flow(s) |
|---|---|
| F-01 Page & Tag Browsing | UF-13 |
| F-02 Create Page & Tag | UF-01 |
| F-04 Author English Copy | UF-03 |
| F-05 Edit English Copy | UF-03 |
| F-06 AI-Assisted Translation | UF-04 |
| F-07 Translate All (Bulk) | UF-05 |
| F-08 Review Translation | UF-06 |
| F-09 Bulk Approve | UF-07 |
| F-10 Resolve Stale | UF-08 |
| F-11 Publish Page Bundle | UF-10 |
| F-12 Rollback | UF-11 |
| F-13 View Version History | UF-15 |
| F-14 Search | UF-13 |
| F-15 Filter by Translation State | UF-13 |
| F-16 Coverage Dashboard | UF-14 |
| F-17 Audit Trail | UF-15 (and all flows) |
| F-18 Comments | Cross-cutting (UF-03, UF-06, UF-09) |
| F-19 Export | UF-19 |
| F-20 Activity Timeline | UF-14, UF-15 |
| F-21 Initial Migration | UF-02 |
| §9.4 Version Comparison | UF-15 |
| §9.7 Bookmarks | UF-13 |
| §9.8 Recently Edited | UF-13 |

### 9.3 Quality Verification

| Criterion | Status |
|---|---|
| Every flow has a clear user goal and end state | ✓ All 19 flows |
| Roles and ownership are explicit in every flow | ✓ Primary role, supporting roles, and handoffs identified |
| Necessary exception paths are included | ✓ Each flow includes relevant failure/exception conditions |
| No UI or technical implementation decisions in flows | ✓ No modals, drawers, tabs, buttons, forms, or layouts specified |
| Flows are not unnecessarily duplicated | ✓ Features are grouped into goal-oriented flows, not 1:1 feature-to-flow |
| Flows are logically consistent with MioTranslate as single entry point and source of truth | ✓ All content originates in MioTranslate; all publishing flows outward to environments |
| Document is detailed enough to be the direct foundation for UX Flow stage | ✓ Decision points, alternate paths, handoffs, and cross-flow dependencies documented |

### 9.4 Conflicts Between BRD and FRD

No genuine conflicts were identified between the approved BRD and FRD. The FRD is a faithful functional elaboration of the BRD's business requirements and decisions.

> **Note:** The BRD (§11.7) describes "Codebase Awareness" as a capability where MioTranslate is aware of tags created in the MioSalon codebase. The FRD resolves this by making MioTranslate the single entry point — pages and tags are created *in* MioTranslate, and developers reference those tag IDs in their code. The FRD explicitly notes that "F-03 removed. MioTranslate is the only entry point for creating pages and tags. There is no sync or developer notification mechanism." This is a design decision, not a conflict. The BRD's business goal (ensuring MioTranslate knows what UX copy exists) is achieved through the FRD's approach (MioTranslate is where it is created).

---

*End of User Flow Document.*
