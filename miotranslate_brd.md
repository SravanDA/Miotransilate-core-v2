# MioTranslate
## Business Requirement Document

---

**Product:** MioTranslate  
**Document Type:** Business Requirement Document  
**Audience:** Founder, Product, Engineering, QA, Support, Design  
**Date:** August 2026  

---

## 1. Background

MioSalon is a Salon & Spa Management Software used by salon and spa businesses across multiple countries. Salon owners, managers, staff, and receptionists use MioSalon daily to manage appointments, billing, customer relationships, inventory, staff schedules, and reporting.

Every piece of text that a salon team sees in MioSalon (page titles, button labels, error messages, helper text, table headers, status badges, filter options, placeholders) is **UX copy**. UX copy is the language of the product. It is how MioSalon communicates with the people who use it.

MioSalon currently operates in eight languages with active users: English (primary), Arabic, Bulgarian, Italian, French (Canada), Spanish, German, and Turkish.

### 1.1 How UX Copy Is Structured

UX copy in MioSalon is organized by **pages**. A page corresponds to a screen or view in the product, such as the Quick Sale screen, the Invoice screen, the Appointment Calendar, or the Customer Profile. MioSalon has a growing number of pages across its modules: POS, CRM, Calendar, Reporting, Settings, Staff Management, and others.

Each page contains **tags**. A tag is a unique identifier for a single piece of text, such as a button label, a column header, or a validation message. Each tag has a value for every language the product supports. When a salon team member opens a screen, MioSalon retrieves all tag values for their selected language from a system called **Language Services** and renders the page.

If a tag value exists for the selected language, the salon team member sees that value. If no value exists, a hardcoded English text (written by the developer when the feature was built) is shown instead. This fallback ensures that no screen ever displays a blank label.

---

## 2. How UX Copy Is Managed Today

### 2.1 The Current Workflow

The process for creating and updating UX copy involves three steps and two roles.

**Step 1: Developer creates the tag.** When building a new feature, the developer writes the tag in the code and assigns a default English text. This text is a development placeholder. It allows the feature to be tested before the final copy is written.

**Step 2: Product Manager or QA writes the final copy.** After the feature is built, the PM or QA writes the English UX copy that salon teams should see. If translations are needed, they are coordinated separately and prepared outside the product.

**Step 3: Developer enters the copy into the product.** A developer with multilingual tag edit access opens the tag editing interface within MioSalon, selects the relevant page, enters the tag values, and submits. The copy is immediately live in production.

Translations follow the same path. When translations for a language are ready, a developer with edit access enters them through the same interface.

### 2.2 Access

Only MioSalon accounts with **multilingual tag edit access** can enter or modify UX copy. In practice, this access is held by developers. The Product Manager, QA, Founder, and other non-engineering team members cannot enter, update, or correct UX copy in the product. They can decide what the copy should say, but they cannot put it into the product themselves.

### 2.3 How Copy Moves to Production

UX copy does move through environments (Dev, QA, and Live) before reaching salon teams. However, this process is entirely manual. A developer enters the copy into the Dev environment, it is reviewed in QA, and the **support team** approves it for production, because the support team is the group that gives product demos to salon businesses and therefore has direct awareness of how labels appear in practice.

There is no system managing this pipeline. There is no record of what was entered into each environment, when it was promoted, or who approved it. There is no tracking of what went live and what did not. The process exists, but it is untracked. It depends on verbal coordination and individual memory rather than a system of record.

---

## 3. What Is Working

The underlying system that delivers UX copy to salon teams is reliable and proven.

- **Language Services works.** Tags are served to MioSalon's UI consistently across all supported languages. The system has been in production for years.
- **The fallback mechanism works.** When a tag value is missing for a language, the English fallback appears. Salon teams never see a blank label.
- **Eight languages are live.** English, Arabic, Bulgarian, Italian, French (Canada), Spanish, German, and Turkish are in active use by real salon businesses.
- **The tag structure is sound.** Organizing copy by pages and tags mirrors how MioSalon is built. It is a natural and functional model.

The delivery infrastructure is not the problem. How content enters that infrastructure is the problem.

---

## 4. Where the Process Breaks

### 4.1 Every Copy Change Requires a Developer

No matter how small the change (fixing a typo in a button label, rewording a confusing error message, updating a single translation), a developer must be involved. The Product Manager writes the copy but cannot enter it. QA identifies a copy issue but cannot fix it. The Founder approves a revision but cannot apply it.

Once copy is handed to a developer and entered, it is final. Improving it, iterating on it, or correcting it requires re-engaging a developer, re-entering the values, and immediately pushing the change to production.

**Business impact.** Engineering time is spent on an activity that is not engineering work. Product and QA teams cannot independently manage or improve product content. Small copy improvements carry the same overhead as large changes, which discourages iterative refinement. Developer availability becomes a bottleneck for non-engineering work.

### 4.2 The Path to Production Is Manual and Untracked

UX copy does move through Dev, QA, and Live environments before reaching salon teams. The support team, who give demos and interact with salon businesses directly, acts as the approver before copy goes to production. This process exists and functions.

The problem is that it is entirely manual and produces no records. There is no system tracking what copy was entered into Dev, when it was promoted to QA, who approved it, when it went live, or whether it went live at all. QA cannot see the copy rendered on the actual screen in context. They work with raw tags and must assume the result will be correct.

**Business impact.** The organization has a process for moving copy to production, but no way to audit it. When a label is wrong in production, the team cannot determine whether the copy was reviewed, who approved it, or whether the correct version was entered. The manual nature of the process also means it scales poorly: as the volume of copy changes increases, the coordination effort increases with it, but the tracking capability remains zero.

### 4.3 There Is No Ownership or Accountability

When a salon team reports a wrong label or a mistranslation, the first questions are: *Who entered this? When? What did it say before? Was it reviewed?* Today, none of these questions can be answered. There is no record of who changed a tag, when it was changed, what the previous value was, or whether anyone reviewed it.

**Business impact.** Investigation is manual and often inconclusive. Root cause analysis requires finding the developer who last had edit access and hoping they remember the change. Resolution depends on institutional memory rather than a system of record. As the team grows and people rotate, this memory is lost.

### 4.4 Translation Status Is Invisible

No one in the organization can answer these questions today:

- Which pages have complete translations for Arabic? For Turkish? For any language?
- Which translations are outdated because the English copy changed after they were entered?
- Which pages have new tags that have never been translated?
- Are we ready to launch MioSalon in a new language?

The only way to assess translation status is to export tags page by page, compare them manually against expected values, and repeat across every language. This does not happen routinely because the effort is prohibitive.

**Business impact.** Leadership cannot make informed decisions about language expansion, translation investment, or market readiness. Translation gaps are discovered reactively (when a salon team reports a missing or wrong label) rather than proactively managed. The organization operates without visibility into the state of a core product asset.

### 4.5 The Workflow Is Unstructured

There is no defined process for how UX copy moves from initial creation to the product. There is no authoring standard. There is no review step. There is no approval authority except for occasional Founder involvement on specific, confusing labels. The workflow relies on informal coordination between individuals, and the efficiency of that coordination decreases as the number of pages, languages, and team members increases.

**Business impact.** The process that governs how the product communicates with its users is ad-hoc. Consistency across screens depends on individual diligence rather than a system. As the product grows, the effort required to maintain UX copy quality grows proportionally, with no mechanism to make it more efficient.

---

## 5. Why This Is Getting Worse

The current process was designed when MioSalon had fewer screens, fewer languages, and a smaller team. At that scale, informal coordination between the PM and a developer was sufficient. Changes were infrequent. The volume of copy was manageable. The risk of an error reaching production was low.

Three things have changed.

**The product has grown, and continues to grow rapidly.** MioSalon now spans multiple modules (POS, CRM, Calendar, Reporting, Settings, Staff Management, and more). Each module contains multiple screens. Each screen contains multiple tags. New features, new screens, and new labels are being added at an accelerating pace. The total volume of UX copy that must be managed is increasing faster than the team's manual process can absorb.

**The language footprint has grown.** Eight languages are in active use. Every English copy change potentially affects translations across all eight languages. Every new screen requires translation across all eight languages. Every new language the business considers adds a multiplier to the existing volume.

**The quality expectation has risen.** MioSalon is no longer an early-stage product where informal processes are tolerable. Salon teams across multiple countries depend on it daily. A wrong label, a mistranslation, or an inconsistent term directly affects their ability to use the product. The standard for UX copy quality has risen, but the process for managing it has not kept pace.

The current process was not broken. It was outgrown.

---

## 6. Vision

MioTranslate is an internal platform that gives MioSalon's product, QA, and localization teams a single place to manage every piece of UX copy in the product, across every language.

Product and QA teams author and manage English UX copy without depending on a developer to enter it. Translations are created with context and verified before they reach salon teams, moving through a defined pipeline from development to QA to production rather than going live immediately. Every change is recorded: who made it, when, and why. The state of UX copy across all pages and all languages is visible at any time, to any stakeholder.

MioTranslate does not change how MioSalon renders UX copy. The tag system and Language Services continue to work exactly as they do today. What changes is how content enters the system, replacing the current manual, ungoverned process with one that is structured, verifiable, and independent of engineering.

Salon teams are unaware that MioTranslate exists. They simply see correct, consistent copy in their language.

---

## 7. Business Objectives

| Objective | What It Means |
|---|---|
| **Establish a single source of truth for UX copy** | One system owns all UX copy (English and every translation) across every page and every language. |
| **Remove the engineering dependency** | Product and QA teams manage UX copy without requiring a developer to enter values into the product. |
| **Introduce governance before production** | UX copy and translations pass through a defined review and verification process before reaching salon teams. No copy goes directly to production. |
| **Enable translation quality assurance** | Translations are reviewed and verified before they go live, not after a salon team reports an error. |
| **Provide visibility into translation status** | Any stakeholder can see the state of every page, every language, and every label at any time. |
| **Make language expansion plannable** | Adding a new language becomes a trackable, scopeable effort, not a coordination exercise that depends on spreadsheets and developer availability. |
| **Create accountability through a complete audit trail** | Every change to UX copy is recorded. When something goes wrong, the organization can trace what happened, who was involved, and when. |

---

## 8. Scope

### 8.1 In Scope

- Centralized authoring and management of English UX copy
- Centralized management of translations for all supported languages
- Defined authoring, review, and approval workflows for both English copy and translations
- UX copy and translation verification before production, through a structured pipeline from development to QA to production
- Visibility into translation coverage, status, and readiness across pages and languages
- Complete audit trail for every copy change
- Independence from engineering for UX copy operations
- Support for all currently active languages: English, Arabic, Bulgarian, Italian, French (Canada), Spanish, German, and Turkish

### 8.2 Out of Scope

- Changes to how MioSalon renders UX copy (the tag system and Language Services remain unchanged)
- Customer-facing content outside the MioSalon product (marketing copy, help centre articles, email templates, SMS/WhatsApp notification templates)
- Automated translation without human review (all translations require human approval before reaching salon teams)
- Real-time collaborative editing
- Translation rules and terminology standards (these are a necessary subsequent deliverable, but defining them is not part of this initiative's scope)

---

## 9. Success Criteria

| Criteria | How We Know |
|---|---|
| **Product teams manage UX copy independently** | The PM and QA can author, review, and publish copy without developer involvement. Developer time spent entering UX copy drops to zero. |
| **No copy reaches salon teams without verification** | Every label (English and every translation) passes through a defined pipeline from development to QA to production before going live. |
| **Translation status is always visible** | Any stakeholder can determine the translation readiness of any page, in any language, at any time, without manual exports or investigation. |
| **Translation errors are caught before production** | Translations are reviewed and verified before they reach salon teams. Translation-related support issues decrease over time. |
| **Language expansion is plannable** | The effort required to add a new language can be scoped, tracked, and reported, not estimated through guesswork. |
| **Copy changes are traceable** | When a label is reported as incorrect, the team can determine within minutes what it says now, what it said before, who changed it, when, and whether it was approved. |

---

## 10. Decisions Made

1. **MioTranslate is an internal platform.** It is used by MioSalon's internal teams (Product, Engineering, QA, and Localization). Salon teams are unaware of its existence.

2. **English governance and translation governance are one initiative.** English is the source from which all translations are created. Governing English copy quality and governing translation quality are inseparable.

3. **All translations require human approval.** AI may assist in generating draft translations, but no translation reaches salon teams without being reviewed and approved by a person.

4. **Translation rules are a subsequent deliverable.** The specific rules governing how translations should be created (terminology standards, tone guidelines, context conventions) will be defined as part of the initiative. This BRD establishes the need for governed translation. The rules themselves come next.

5. **The rendering mechanism does not change.** MioSalon's tag system, Language Services, and the way MioSalon retrieves and displays UX copy are unchanged. MioTranslate governs how content enters the system. Not how the system serves it.

---

## 11. Required Business Capabilities (Features)

The business problems identified in Section 4 (where the process breaks), the objectives in Section 7 (business objectives), and the vision in Section 6 together define what MioTranslate must be capable of. This section identifies the business capabilities required, what the organization needs MioTranslate to do, without prescribing how those capabilities should be designed or built.

Each capability traces directly back to the business problems and objectives it addresses. If a capability cannot be traced to an identified problem, it does not belong.

---

### 11.1 English UX Copy Management

**Business goal.** Enable Product and QA teams to author, edit, and manage English UX copy directly, without engineering involvement.

Today, the Product Manager or QA writes the final English copy, but a developer must enter it into the product (Section 4.1: every copy change requires a developer). Once entered, improving or correcting it requires re-engaging a developer. MioTranslate must allow the people who decide what the copy should say to also be the people who manage it in the system.

**Business value.**

- Product and QA iterate on UX copy independently. A confusing button label can be improved without scheduling developer time.
- Engineering is freed from copy entry, an activity that is not engineering work.
- English copy quality improves because the barrier to refinement is removed. Small improvements become practical rather than cost-prohibitive.

**Business use cases.**

- A Product Manager writes the English UX copy for a new feature's screens and submits it for review, without involving a developer.
- QA identifies a misleading error message during testing and updates the English copy directly.
- The Founder reviews a set of labels for a sensitive workflow and requests a revision. The PM applies the revision immediately.
- A Product Manager corrects an inconsistency between two screens ("Cancel Appointment" on one screen and "Delete Appointment" on another) by updating the copy to use consistent terminology.

**Success outcome.** The people responsible for UX copy quality can manage it end-to-end. Developer involvement in copy entry drops to zero.

> *Addresses: Problem 4.1 (every copy change requires a developer), Objective: remove the engineering dependency.*

---

### 11.2 Translation Management

**Business goal.** Enable translations to be created with appropriate context, reviewed by a human with AI assistance, and managed independently per language, replacing the current process of entering translations through the tag editing interface without verification.

Today, translations are prepared externally and entered by a developer through the multilingual tag edit UI (Section 2.1: the current workflow). There is no verification of accuracy before they go live. There is no mechanism to flag translations that may be outdated when the English source changes.

**Business value.**

- Translations are created with awareness of what the label means in MioSalon's business context, not as isolated words without context.
- Every translation is reviewed and approved by a human with AI assistance before it reaches salon teams.
- Each language is managed independently. Progress on Arabic does not depend on or block progress on Turkish.
- When English copy changes, affected translations across all languages are identified, rather than silently drifting out of date.

**Business use cases.**

- A localization reviewer sees a set of newly created Arabic translations for the Invoice screen, reviews each against the English source, and approves or requests corrections, before any salon team sees them.
- The English label for "Walk-in Customer" is changed to "Drop-in Client." All existing translations of that label across eight languages are flagged as potentially affected. Each language team resolves the flag on their own schedule.
- MioSalon adds Turkish support. The team prioritizes high-traffic screens for translation first and works through remaining screens systematically, with clear tracking of what has been completed and what remains.
- A reviewer identifies that an AI-generated translation lost the meaning of a salon-specific term. The reviewer corrects it manually, and the corrected version is what reaches salon teams.

**Success outcome.** No translation reaches salon teams without human approval. Translation quality is verified before production, not after a support issue is raised. Languages are managed independently, and outdated translations are surfaced rather than hidden.

> *Addresses: Problem 4.2 (untracked path to production), Problem 4.5 (unstructured workflow), Objective: enable translation quality assurance.*

---

### 11.3 Review & Approval

**Business goal.** Establish a defined governance process for UX copy (who can author, who can review, who can approve, and who can publish) so that no copy reaches salon teams without passing through the appropriate people.

Today, there is no formal approval authority for UX copy (Section 4.5: the workflow is unstructured). The support team informally approves copy for production because they give demos, but this is not tracked. The Founder is involved only on specific confusing labels. There is no defined process that applies consistently across all copy.

**Business value.**

- The organization decides, once, who has the authority to author copy, review it, and approve it for production. This is applied consistently rather than ad-hoc.
- Copy quality is governed by a process, not by individual diligence.
- The Founder can participate in review when needed without being a bottleneck for every change.
- The support team's approval role is formalized and tracked rather than informal and unrecorded.

**Business use cases.**

- A Product Manager authors English copy for a new Settings screen. A reviewer (support team lead or manager) reviews the copy in context. Once approved, the copy is eligible to move toward production.
- QA submits a batch of copy corrections. The reviewer approves corrections that are straightforward and flags two labels for Founder review because they affect a core billing workflow.
- A localization reviewer approves Arabic translations for the Appointment screen. This approval is recorded: who approved, when, and for which labels.
- The Founder reviews and approves copy for a new onboarding flow that defines how MioSalon describes its own features to salon teams.

**Success outcome.** Every piece of UX copy (English and every translation) has a clear chain of authorship, review, and approval. The organization can always identify who was responsible for any label that reaches salon teams.

> *Addresses: Problem 4.3 (no ownership or accountability), Problem 4.5 (unstructured workflow), Objective: introduce governance before production.*

---

### 11.4 Publishing & Release Management

**Business goal.** Formalize and track the process of moving UX copy from authoring through Dev, QA, and production, replacing the current manual, untracked pipeline with one that produces records and enforces sequence.

Today, copy moves through Dev, QA, and Live, but the process is manual and produces no records (Section 4.2: the path to production is manual and untracked). There is no tracking of what was promoted, when, by whom, or whether it reached production at all. The support team approves for production, but this approval is not recorded.

**Business value.**

- The existing Dev to QA to Production pipeline is preserved but becomes tracked and auditable.
- QA can verify copy in a pre-production state before salon teams see it.
- Every promotion is recorded: what moved, to which environment, when, and who approved it.
- If a label is found to be wrong after reaching production, the organization can revert to the previous version without re-entering copy manually.

**Business use cases.**

- English copy for a new Reports screen is authored, approved, and made available in the Dev environment. QA verifies the labels appear correctly on the screen. After QA approval, the copy is promoted to production. Each step is recorded.
- A translation error is discovered in production for the Quick Sale screen in Arabic. The team reverts to the previously approved version while the correction is prepared and re-verified through the pipeline.
- Before a major release, a product lead reviews what copy changes are currently in QA and what has already reached production, to ensure all screens for the release are consistent.
- The support team, as the group that approves copy for production, can see exactly which labels they are approving and what changed since the last version.

**Success outcome.** Every label that reaches salon teams has a verifiable record of how it got there. The pipeline that already exists becomes tracked, auditable, and reversible.

> *Addresses: Problem 4.2 (manual, untracked path to production), Objective: introduce governance before production, create accountability through a complete audit trail.*

---

### 11.5 Translation Visibility

**Business goal.** Provide the organization with a clear, always-available view of translation status across all pages and all languages, replacing the current state where translation coverage is invisible (Section 4.4: translation status is invisible).

Today, no one can determine which pages are fully translated, which have gaps, which translations are potentially outdated, or whether the product is ready to operate in a new language. The only method is manual export and comparison, which is prohibitively time-consuming.

**Business value.**

- Leadership can make informed decisions about language expansion and translation investment based on data, not guesswork.
- Product and localization teams can prioritize work: translating high-traffic screens before low-traffic ones, resolving outdated translations before creating new ones.
- The organization can answer "Are we ready to launch in a new market?" with evidence.
- Translation gaps are discovered proactively rather than reactively, by the team, not by salon teams.

**Business use cases.**

- Leadership asks: "What is our translation readiness for Italian?" The answer is available immediately, showing which screens are complete, which have gaps, and which have labels that may need updating because the English source changed.
- A localization lead plans the quarter's translation work. They can see which pages have the most untranslated labels and which languages have the most outdated translations, and prioritize accordingly.
- MioSalon considers entering a new market that requires Portuguese. The team can assess the effort required by seeing the total volume of labels that need translation, before committing to a timeline.
- After a major product release that added three new screens, the localization lead sees that those screens have zero translations across all non-English languages and adds them to the next translation cycle.

**Success outcome.** Translation status is a known quantity, not a mystery. Any stakeholder can assess readiness at any time. Planning replaces guesswork.

> *Addresses: Problem 4.4 (translation status is invisible), Objective: provide visibility into translation status, make language expansion plannable.*

---

### 11.6 Version History & Audit Trail

**Business goal.** Record every change to every label (English and every translation) so that the organization can trace what happened, who was involved, and when.

Today, when a salon team reports a wrong label, the team cannot determine who entered it, when it was entered, what the previous value was, or whether it was reviewed (Section 4.3: there is no ownership or accountability). Investigation depends on finding the right developer and hoping they remember.

**Business value.**

- Root cause analysis becomes immediate rather than investigative. When something is wrong, the team traces the history, not the people.
- Accountability is structural, not personal. The system records who authored, who reviewed, and who approved every label.
- The organization retains institutional knowledge even as team members rotate. The history of any label is in the system, not in someone's memory.
- Compliance and quality audits become possible. The organization can demonstrate that its product content is governed and traceable.

**Business use cases.**

- A salon team in Dubai reports that the Arabic label for "Invoice Total" is incorrect. The team looks up the label's history and sees: it was translated on July 15, approved by a reviewer on July 16, and promoted to production on July 18. The English source was updated on July 20, but the Arabic translation was not re-verified. Root cause identified in minutes.
- The Founder asks: "Who approved the copy for the new onboarding flow?" The answer is available, with timestamps, the reviewer's name, and the exact version that was approved.
- A PM wants to understand how a label evolved. They see the full history: original developer fallback, the first approved English copy, a subsequent revision, and the current version, with the reason for each change.

**Success outcome.** The history of every label is a permanent, searchable record. Investigation takes minutes rather than days. Accountability is built into the process rather than dependent on memory.

> *Addresses: Problem 4.3 (no ownership or accountability), Problem 4.2 (manual, untracked process), Objective: create accountability through a complete audit trail.*

---

### 11.7 Codebase Awareness

**Business goal.** Ensure MioTranslate knows what UX copy exists in MioSalon, without requiring manual registration every time a developer adds a new screen or a new label.

Developers create tags in the MioSalon codebase as part of feature development. MioTranslate must be aware of these tags so that the product team can author English copy for them and the localization team can translate them. If MioTranslate does not know a tag exists, that tag will never be managed. It will show the developer's placeholder text in English indefinitely and will never be translated.

**Business value.**

- New tags created by developers are surfaced to the product and localization teams without requiring manual handoff or registration.
- The organization can identify when the codebase has grown (new pages, new tags) and take action before gaps accumulate.
- Tags that are removed from the codebase are identified, preventing the team from spending effort on labels that no longer exist in the product.

**Business use cases.**

- A developer ships a new Loyalty Program screen with fifteen new tags. The product team is made aware that fifteen labels need English copy and translation, without the developer needing to manually register each one.
- A developer adds three new tags to an existing Quick Sale screen as part of a feature enhancement. The product team sees these new tags and authors copy for them before the feature reaches salon teams.
- A developer removes an old screen during a product cleanup. The labels for that screen are identified as no longer in use, and the localization team does not waste effort translating them.
- Before starting a translation session, a localization lead confirms that MioTranslate's view of the product is current, that no new tags have appeared since the last check.

**Success outcome.** MioTranslate remains an accurate reflection of what UX copy exists in MioSalon. The product and localization teams always know what needs attention. No label falls through the gap between code and content management.

> *Addresses: Objective: establish a single source of truth for UX copy. Ensures the foundation on which all other capabilities depend remains accurate.*

---

### 11.8 Capability Traceability Summary

Every capability traces directly to the business problems and objectives established earlier in this document.

| Capability | Problems Addressed | Objectives Addressed |
|---|---|---|
| English UX Copy Management | 4.1 (every copy change requires a developer) | Remove engineering dependency |
| Translation Management | 4.2 (untracked path to production); 4.5 (unstructured workflow) | Enable translation quality assurance |
| Review & Approval | 4.3 (no ownership or accountability); 4.5 (unstructured workflow) | Introduce governance before production |
| Publishing & Release Management | 4.2 (manual, untracked pipeline) | Introduce governance; Create audit trail |
| Translation Visibility | 4.4 (translation status is invisible) | Provide visibility; Make language expansion plannable |
| Version History & Audit Trail | 4.3 (no ownership or accountability); 4.2 (manual, untracked process) | Create accountability through audit trail |
| Codebase Awareness | Foundation for all capabilities | Establish a single source of truth |
