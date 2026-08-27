# MioTranslate
## Information Architecture & Page Hierarchy Document

---

**Product:** MioTranslate  
**Document Type:** Information Architecture & Page Hierarchy  
**Source Documents:** MioTranslate BRD (Approved), FRD (Approved), User Flow Document (Approved), UX Flow Document (Approved)  
**Audience:** Product, UX Design, Engineering, QA  
**Date:** August 2026  

---

## 1. Purpose

This document defines how MioTranslate is structured as a product — how its information is organized, how users navigate it, and how its pages relate to each other.

It answers: *If a user needs to do something in MioTranslate, where do they go? How do they get there? What do they find when they arrive? How do they get back?*

This document sits between the UX Flow Document (how each journey behaves) and the UI specification (how each screen is laid out). The UX Flows define experience; this document defines structure.

### What this document decides

- The primary areas of the product
- The pages that exist and what each page is for
- How pages relate to each other
- How users navigate between pages
- How content, workflow, and operational concerns are organized
- Where search, browsing, and work queues live
- How the structure supports all roles without fragmenting the product

### What this document does not decide

- Visual layout, components, or styling (UI specification)
- Detailed interaction behavior at each step (UX Flow Document)
- Feature-level functional behavior (FRD)
- Business rules or data model (FRD)

### Source-of-truth hierarchy

| Layer | Document | Decides |
|---|---|---|
| Why | BRD | Business problems, objectives, vision |
| What | FRD | Features, rules, states, data model |
| Accomplishment | User Flow Document | What users accomplish, end-to-end journeys |
| Experience | UX Flow Document | How each journey behaves step-by-step |
| **Structure** | **This Document** | **How the product is organized as a whole** |
| Interface | UI Specification (next) | How each page is laid out visually |

---

## 2. IA Principles

These principles govern every structural decision in this document. They were derived from analysis of MioTranslate's specific product characteristics — not from a generic IA checklist.

### P1. The Page is the anchor

MioTranslate manages UX copy organized by pages and tags. The MioSalon Page is the primary object users think about. Tags, English copy, and translations exist within pages. The IA should reflect this: page is the natural organizational unit, and navigating into a page should reveal everything about that page — its tags, their English copy, their translations across all languages, and their publishing status.

*Why:* The PM thinks "I need to work on the Quick Sale screen." The LR thinks "I need to review Arabic for the Invoice screen." The SR thinks "What is deployed for the Calendar page?" The page is the conceptual anchor in all of these.

### P2. Content and work are not separate products

MioTranslate manages both content (the copy and translations themselves) and work (reviews, stale resolution, publishing). These are deeply intertwined — reviewing a translation is done in the context of the tag, which is in the context of the page. The IA should not force users to choose between a "content view" and a "work view." Instead, work should surface where content lives, and content should be reachable from wherever work is presented.

### P3. Search is a first-class entry point

MioTranslate contains thousands of tags across hundreds of pages. Users frequently arrive with a specific tag ID, a piece of label text, or a page name in mind. Search must be globally accessible — always present, always fast, always returning results that lead directly to the relevant content. Search is not an auxiliary feature; it is a primary navigation mechanism.

### P4. Work queues are personal, not structural

Different roles have different work: the PM authors English copy, the LR reviews translations, the SR approves for Production, the FN reviews escalations. These should not become separate product areas in the navigation. Instead, MioTranslate should have a single, role-aware work surface where each user sees their actionable items. This prevents the navigation from fragmenting as roles are added or changed.

### P5. Visibility and content are the same product

The coverage dashboard, stale translation reports, and pending work summaries are not a separate "analytics" product. They are a way of looking at the same content from a different altitude. A user who sees "Arabic: 60% coverage on Invoice page" should be able to drill directly into the Invoice page → Arabic → the specific untranslated tags, without leaving the conceptual space. Coverage is a lens on content, not a separate area that duplicates the content registry.

### P6. Publishing is an operational layer, not a content layer

Publishing, environments, deployments, and rollbacks are operational concerns. They govern how approved content reaches salon teams. This is important but conceptually distinct from the content lifecycle (authoring, translating, reviewing). The IA should separate operational management from content management to prevent the content registry from becoming cluttered with deployment machinery, while still making publishing easily reachable from content context.

### P7. Administration is infrequent and protected

Role management, language management, and system configuration are infrequent, high-impact actions performed by Administrators and Founders. These belong in a clearly separated area that does not compete for space in the primary navigation used daily by PMs, LRs, and SRs.

### P8. Structure must scale without restructuring

The IA must work for today's product (hundreds of pages, eight languages) and tomorrow's product (thousands of pages, dozens of languages, larger teams, more reviewers). Adding a new language, adding hundreds of pages, or adding new roles should not require reorganizing the navigation or creating new product areas.

---

## 3. Object Analysis

Before defining pages, every object in MioTranslate needs to be classified by how users relate to it. Not every object deserves its own page. Some are best shown in context, some belong to workflow or operational views, and some are administrative.

The classification below uses five categories:

| Category | Meaning |
|---|---|
| **Canonical content destination** | A content object that users navigate to directly. It needs its own page in the content hierarchy. |
| **Contextual (within a parent)** | An object that exists within a parent object and is shown inside the parent's detail view, not as a standalone page. |
| **Workflow view** | Not a content object, but a recurring user job that benefits from a dedicated view (e.g., a review queue or stale resolution list). |
| **Operational view** | An operational record or process that benefits from a dedicated view (e.g., deployment history), distinct from the content itself. |
| **Administrative** | An object managed infrequently in a protected area, not part of the daily content or workflow experience. |

### 3.1 Object Classification

| Object | Category | Reasoning |
|---|---|---|
| **Page** | **Canonical content destination** | The primary organizational unit. Users navigate to pages to browse, author, translate, and publish. A page needs its own detail view. |
| **Tag** | **Canonical content destination (within Page)** | The atomic unit of content. A tag needs its own detail view, reached through its parent page — not through a separate "Tags" area in the nav. |
| **English Copy** | **Contextual (within Tag)** | English copy is an attribute of a tag. Users author and review it within the tag detail view. |
| **Translation** | **Contextual (within Tag)** | A translation is the value of a tag in a specific language. Users review and manage translations within the tag detail view, scoped by language. |
| **Language** | **Filter / lens** | A language is a dimension through which content is viewed, not a destination. Users filter by language; they do not "open Arabic" as a page. Languages are configured in Settings and used as filters everywhere else. |
| **Version** | **Contextual (within Tag)** | Versions are the history of a tag's English copy or translation. They are viewed within the tag detail view. |
| **Review** | **Workflow view** | Reviews are actions taken on content. They surface as items in a personal work queue (My Work) and are performed within the content context (Tag Detail). The work queue is a dedicated view, but reviews themselves are not standalone objects. |
| **Stale Translation** | **Workflow view** | Stale translations surface in My Work (for the LR) and in the Stale Overview (for PM/FN assessment). Resolution happens in Tag Detail. |
| **Comment** | **Contextual (within Tag)** | Comments are attached to tags and viewed within the tag detail context. |
| **Environment** | **Operational context** | Environments (Dev, QA, Production) are fixed targets. They are referenced in publishing and deployment views but are not navigable destinations themselves. |
| **Deployment** | **Operational view** | Deployments are records of publishing events. They are viewed within a deployment history view, reachable from content context and from a dedicated operational area. |
| **Audit Record** | **Contextual + cross-cutting** | Audit records are viewed within a tag's history, but also need to be searchable across the system for investigations. This requires both contextual access and cross-cutting search (via the Activity Timeline). |
| **User** | **Administrative** | Users are managed in Settings. They do not appear in the content navigation. |
| **Role** | **Administrative** | Roles are assigned in Settings. They affect permissions throughout the product but are not navigable content. |
| **Import Event** | **Administrative (one-time)** | The migration import is a one-time event. It has a reference page in Settings for auditability, but does not warrant an ongoing navigational element. |

### 3.2 Key Insight: Content destinations vs. dedicated views

In the content hierarchy, only two objects deserve their own navigable pages:

1. **Page** (the MioSalon page) — the primary content container
2. **Tag** (within a page) — the atomic content unit, reached through its parent page

However, not all product destinations are content objects. Some recurring user jobs require dedicated views that are not part of the content hierarchy but are still legitimate navigable destinations:

- **My Work** — a dedicated workflow view where users find their actionable items
- **Coverage Dashboard** — a dedicated visibility view for assessing translation readiness
- **Stale Overview** — a dedicated workflow view for prioritizing stale resolution
- **Deployment Overview / History** — dedicated operational views for managing what has been published

These are not content objects, and they do not duplicate the content registry. They provide different perspectives on the same underlying content, or they surface work that originates from the content lifecycle.

Everything else is either:
- Shown **in context** within the Page or Tag detail views (English copy, translations, versions, comments, audit records)
- Accessible as a **filter or lens** applied across content (language, status, copy type)
- Managed in a **protected administrative area** (users, roles, languages, configuration)

This classification prevents the navigation from becoming a flat list of every FRD feature, while still giving legitimate user jobs their own space.

---

## 4. The Four Hierarchies

MioTranslate has four distinct hierarchies that overlap but are not identical. The IA must support all four without forcing one to dominate.

### 4.1 Content Hierarchy

How managed UX content relates to one another.

```
MioTranslate Registry
  └── Module (metadata grouping, not a structural level)
        └── Page (the MioSalon screen)
              └── Tag (one piece of UX text)
                    ├── English Copy (the source text, with version history)
                    └── Translation [per language] (the localized text, with version history)
```

**Key properties:**
- Module is metadata on a Page, not a navigational container. Users filter by module; they do not "open the POS module."
- Page is the browsable container. Tags live within pages.
- Tag is the atomic unit. English copy and translations are attributes of a tag.
- Languages are a dimension, not a structural level. A tag has at most one translation per language.

### 4.2 Workflow Hierarchy

How work moves through the system.

```
Work arrives → User's personal queue (My Work — primary entry point)
  ├── English copy pending review (for SR)
  ├── Translations pending review (for LR)
  ├── Escalated items (for FN)
  ├── Stale translations needing resolution (for LR)
  ├── Publishing approvals pending (for SR / FN)
  └── Items assigned / recently touched (for PM)

Work is also accessible through cross-product views:
  ├── Coverage → Stale Overview (stale translations across the product)
  ├── Deployments → Pending publishing (bundles awaiting approval)
  └── Content → Page Detail (filtered by status to surface work within a page)
```

**Key properties:**
- **My Work is the primary task entry point**, but not the exclusive location for actionable work. Users can also discover and act on work through Coverage (stale resolution), Deployments (publishing approvals), and Content (status-filtered page views).
- Work items are pointers into the content registry. Clicking a review item takes you to the tag in its page context.
- Work queues do not duplicate content. They surface content that needs action.

### 4.3 Operational Hierarchy

How approved content reaches salon teams.

```
Publishing Pipeline
  ├── Environment: Dev (automatic publishing for approved content)
  ├── Environment: QA (requires reviewer approval)
  └── Environment: Production (requires SR or FN approval)

Per Page + Language:
  └── Deployment History (all versions deployed, rollbacks)
```

**Key properties:**
- Publishing is page-bundle scoped (one page + one language).
- Deployment history is per page per language per environment.
- Rollback operates within this scope.
- This hierarchy is operational — it tracks what has been published, not what content says.

### 4.4 Visibility Hierarchy

How the organization understands the state of content.

```
Coverage Dashboard
  ├── Coverage Matrix: Pages × Languages (coverage percentages)
  │     ├── Drill into: Page → Language → Per-tag status
  │     └── Summary: Per-language totals, per-page totals
  ├── Stale Translations: grouped by language and page, sorted by age
  ├── Pending Work Summary: tags needing English, translation, review
  └── Language Readiness: all pages ranked by coverage for a language
```

**Key properties:**
- Coverage is a read-only lens on the content registry. No content is created here.
- Drilling into any cell leads to the content registry (Page detail, filtered by language and status).
- This hierarchy shares data with the content hierarchy but presents it at a different altitude.

---

## 5. Recommended Product Structure

### 5.1 Five Primary Areas

Based on analysis of the approved User Flows (UF-01 through UF-19), UX Flows, role frequency, and scale scenarios, the recommended structure uses five primary navigation areas.

**Validation against User Flows:**
- **Content** is required by 13 of 19 flows (UF-01, UF-03–08, UF-12–16, UF-19). It is the product's core.
- **My Work** is the primary entry point for 5 flows involving handoffs and role-based action (UF-03 returned items, UF-06, UF-08, UF-09, UF-10 approvals). Every operational role uses it daily.
- **Coverage** is required by UF-14 and supports prioritization for UF-05, UF-08, and UF-17. The PM and FN reference it regularly for strategic decisions.
- **Deployments** is required by UF-10, UF-11, and UF-12. While used less frequently than Content, publishing and rollback are operationally critical and involve distinct approval workflows that would clutter the content context.
- **Settings** is required by UF-02, UF-17, and UF-18. It is used infrequently but contains high-impact administrative actions.

| Area | Purpose | Primary Users | Frequency |
|---|---|---|---|
| **Content** | The registry of all pages, tags, English copy, and translations. The canonical home of all managed UX content. | All roles | Daily — the core workspace |
| **My Work** | A personal, role-aware surface showing items that need the current user's action. | PM, LR, SR, FN | Daily — the starting point for task-based work |
| **Coverage** | Translation coverage, readiness, and stale tracking across all pages and languages. | PM, FN, LR | Regularly — for planning and prioritization |
| **Deployments** | Publishing actions, environment status, deployment history, and rollback. | SR, FN, PM, LR | Per release cycle — for operational management |
| **Settings** | User roles, language management, system configuration, and data import. | ADMIN, FN | Infrequently — for administrative changes |

Plus two cross-cutting capabilities that are always present but are not navigation areas:

| Capability | Purpose |
|---|---|
| **Global Search** | Accessible from every page. Searches tag IDs, English copy text, page names, page IDs. Results link directly to content. |
| **Activity Timeline** | A cross-cutting awareness feed of recent actions. Accessible globally for coordination and investigation. |

### 5.2 Why Five Areas, Not Fewer or More

The five-area structure is a recommendation based on the current approved workflows and anticipated scale. It is not presented as the only viable approach — it is the structure best supported by the evidence. The rationale for each grouping decision follows.

**Why not three (collapsing My Work into Content, and Deployments into Content)?**
The User Flows show that the PM browsing pages to assess completeness (UF-13) is in a fundamentally different mode than the LR working through a review queue (UF-06). Combining these into one area would force two distinct mental models — exploring and executing — into the same space. Similarly, UF-10 and UF-11 involve operational approval workflows and environment selection that would add clutter to the content experience if embedded there.

**Why not seven or more (adding separate areas for Audit, Reports, Languages, or Reviews)?**
None of these objects support enough standalone user jobs to justify their own navigation area. Audit records are accessed contextually within tags (UF-15). Reports are views of coverage data. Languages are configured in Settings. Reviews surface in My Work and are performed in Content. Adding more areas would fragment the product without serving a recurring user need.

**Why "Content"?** It communicates what MioTranslate manages — UX copy content. "Pages" is too narrow (it excludes tags). "Registry" is too technical.

**Why "My Work"?** It is role-neutral and scales across all operational roles. "Review Queue" excludes authoring and publishing work. "Tasks" implies task management. "Inbox" implies messaging.

**Why "Coverage"?** It answers the specific question this area serves: "What is our translation coverage?" "Dashboard" is vague. "Reports" implies static documents.

**Why "Deployments"?** Publishing is the action; deployment is the result — what has been published where. This area manages both current state and history, including rollbacks. "Environments" would suggest the environments themselves are manageable, when they are fixed infrastructure.

---

## 6. Page Hierarchy

This section defines every page in MioTranslate, organized by area. For each page, I specify: what the page is for, what it contains, how users arrive, and what they can do.

### 6.1 Content Area

The content area is the core of MioTranslate. It contains two levels: the **Page List** and the **Page Detail** (which includes the **Tag Detail** view).

---

#### C1. Page List

**What it is:** The browsable registry of all MioSalon pages registered in MioTranslate. This is the primary landing experience for the Content area and the most common entry point into the product.

**What it contains:**
- All registered pages, each showing: Page Name, Page ID, Module, total tag count, Active/Deprecated status
- Per-language translation summary for each page (e.g., "Arabic: 36/38 approved")
- Filters: by Module, by translation completeness (fully translated, partially translated, not started), by status (Active, Deprecated)
- Sort: by name, module, tag count, translation coverage for a selected language
- Page-level search (complementing the global search)
- Action: Create a new page (for PM, FN roles)

**How users arrive:**
- Primary navigation → Content
- Direct link / bookmark
- Completing a page creation flow (returns here with the new page visible)

**Where users go from here:**
- Select a page → **Page Detail (C2)**
- Create a new page → Page creation flow (UX-01)
- Global search → **Tag Detail (within C2)**

**Scale considerations:**
- At 100+ pages, filtering by Module becomes essential to reduce scan area
- At 1000+ pages, the combination of search, module filter, and coverage-based sort must remain performant
- Deprecated pages are visible but clearly marked and sortable to the bottom

**Empty state:**
- If MioTranslate has zero pages: guidance to create the first page (→ UX-01) or run the initial migration (→ UX-02)

**Roles:** All roles can view. PM and FN can create pages.

**Supports User Flows:** UF-01 (Register Page), UF-13 (Find and Inspect), UF-14 (Monitor Coverage — page-level view)

---

#### C2. Page Detail

**What it is:** The complete view of a single MioSalon page — all its tags, their English copy, and their translations across all languages. This is the workhorse page of MioTranslate. Most content work happens here.

**What it contains:**

**Page header:**
- Page Name, Page ID, Module, status (Active/Deprecated), tag count
- Per-language coverage summary (at a glance: which languages are complete, partial, or empty)
- Deployment status per language per environment (which version is deployed where)

**Tag list:**
- All tags on this page, each showing: Tag ID, Copy Type, English copy text (current approved), English copy status (No Copy, Draft, Pending Review, Approved)
- Per-language translation status indicators for each tag (allowing the user to see at a glance which tags are translated, pending, stale, or missing for any language)
- Language selector / filter: the user selects a language to see translation details for that language alongside the English copy
- Status filter: filter tags by English copy status or translation status for the selected language (No Translation, Draft, Pending Review, Approved, Stale)
- Sort: by Tag ID, status, copy type
- Search within page: find a specific tag on this page
- Bulk actions (for authorized roles): Translate All (for a selected language), Bulk Approve (for high-confidence translations above threshold)

**Contextual navigation:**
- From any tag in the list: navigate to **Tag Detail (C3)** for full detail
- Publishing action: initiate publishing for this page + selected language (→ Deployments area for confirmation)
- Page-level actions: Deprecate page (if authorized), Export tags

**How users arrive:**
- Page List → Select a page
- Global search result (tag result shows its page, linking here)
- My Work → Select a work item (opens in tag detail within this page context)
- Coverage → Drill into a cell (opens this page filtered by the relevant language)
- Deployments → "View content" link from a deployment record
- Direct link / bookmark

**Where users go from here:**
- Select a tag → **Tag Detail (C3)**
- Translate All → Bulk translation flow (UX-05)
- Bulk Approve → Bulk approval flow (UX-07)
- Publish → **Deployments area** (publishing flow, UX-10)
- Export → Download (UX-19)
- Back → **Page List (C1)**

**Scale considerations:**
- At 100+ tags per page: tag list requires pagination or virtual scrolling, combined with search-within-page and status filtering
- With 8+ languages: the per-language indicators must be compact. The language selector/filter allows the user to focus on one language at a time without losing the others.
- The page detail must support two primary work modes: **browsing** (PM assessing completeness) and **executing** (LR reviewing translations for a specific language). The language filter + status filter combination enables both.

**Roles:**
- All roles can view
- PM / QA: author English copy, trigger translations
- LR: review translations, bulk approve, resolve stale
- SR / FN: initiate publishing
- FN: escalate, deprecate

**Supports User Flows:** UF-01 (Create Tags — within page), UF-03 (Author English — tag selection), UF-04 (Translate — tag and language selection), UF-05 (Bulk Translate — page-level action), UF-06 (Review — tag selection), UF-07 (Bulk Approve — page-level action), UF-08 (Resolve Stale — filtered view), UF-13 (Find and Inspect), UF-16 (Deprecate — tag selection), UF-19 (Export)

---

#### C3. Tag Detail

**What it is:** The complete view of a single tag — its English copy, translations across all languages, version history, comments, and audit trail. This is the deepest level of the content hierarchy and where most individual content actions happen.

**Structural note:** Tag Detail is not a separate page in the navigation hierarchy. It is a detail view reached from within the Page Detail (C2). The user navigates Content → Page → Tag. However, it is a distinct, focused experience with its own information and actions, which is why it is documented as a separate page in this hierarchy.

**What it contains:**

**Tag header:**
- Tag ID, Page Name (with link back to Page Detail), Module, Copy Type, status (Active/Deprecated)
- Breadcrumb: Content → [Page Name] → [Tag ID]

**English copy section:**
- Current approved English text (if any)
- English copy status (No Copy, Draft, Pending Review, Approved)
- Author and approval information (who, when)
- Change reason (if provided)
- Actions (for authorized roles):
  - Author / Edit English copy (UX-03)
  - Submit for review
  - Save as Draft
- If Pending Review: review actions visible to authorized reviewers (Approve, Return, Escalate, Reject)

**Translations section:**
- Per-language translation display:
  - For each active language: translation text, status (No Translation, Draft, Pending Review, Approved, Stale), confidence score (for AI-generated), back-translation, variable integrity status
  - Language selector or compact multi-language view
- Actions (for authorized roles):
  - Trigger AI translation for a selected language (UX-04)
  - Review translation: Approve, Edit and Approve, Request Retranslation, Reject (UX-06)
  - Resolve stale: Confirm or Retranslate (UX-08)

**Version history section:**
- Chronological list of all versions for English copy and for translations (per selected language)
- Each entry: who changed it, when, before value, after value, change reason
- Side-by-side version comparison (UX-15)

**Audit trail section:**
- All actions on this tag: creation, edits, approvals, rejections, promotions, rollbacks
- Each entry: who, when, action, details

**Comments section:**
- Comments scoped to English or to a specific language
- Add comment, mark as resolved

**Deployment status section:**
- For each language: which version is deployed in each environment (Dev, QA, Production)
- Link to deployment history for this tag's page + language

**How users arrive:**
- Page Detail → Select a tag
- Global search → Select a tag result
- My Work → Select a work item (review, stale resolution, escalation)
- Coverage → Drill into a cell → Select a tag
- Activity Timeline → Select an action → Opens the affected tag

**Where users go from here:**
- Back to Page Detail (breadcrumb or back navigation)
- To another tag on the same page (contextual navigation within Page Detail)
- To the deployment history (link within deployment status section)

**Scale considerations:**
- A tag with many language translations (8+ languages): the translation section must handle this without becoming overwhelming. A language selector or collapsible per-language sections are needed.
- A tag with a long version history: the version history must be paginated or expandable.
- A tag with many comments: comments must be scrollable and filterable (open vs. resolved).

**Roles:**
- All roles can view (including version history, audit trail, and comments)
- PM / QA: author/edit English copy, trigger translation
- LR: review translations, resolve stale, edit translations
- SR: review English copy, approve/reject
- FN: all actions including escalation resolution

**Supports User Flows:** UF-03 (Author English), UF-04 (Translate Single Tag), UF-06 (Review Translation), UF-08 (Resolve Stale), UF-09 (Founder Escalation — review context), UF-13 (Find and Inspect — tag detail), UF-15 (Investigate History)

---

### 6.2 My Work Area

The My Work area is the primary personal task surface. It shows the current user what needs their action, based on their role(s). Work also surfaces in other areas — Coverage shows stale items that need resolution, Deployments shows bundles awaiting publishing approval, and Content can be filtered by status to reveal work within a page — but My Work is where users go first to find what is waiting for them.

---

#### W1. My Work

**What it is:** A single, role-aware page that surfaces the current user's actionable items across MioTranslate.

**What it contains (varies by role):**

**For Product Manager (PM):**
- Tags I recently authored (quick access to continue work)
- English copy returned for revision (with reviewer comments)
- Tags needing English copy on pages I manage
- Translations approved and ready for publishing action

**For QA:**
- Items requiring English copy authoring or correction
- Tags flagged during testing

**For Localization Reviewer (LR):**
- Translations pending review: filterable by language, page, confidence score
- Stale translations needing resolution: grouped by language and page, sorted by age (oldest first)
- Items I recently reviewed (quick access to continue a review session)
- Count of pending items per language

**For Support Reviewer (SR):**
- English copy pending review: items submitted for SR approval
- Publishing approvals pending: page bundles awaiting Production approval
- Recent production deployments (awareness)

**For Founder (FN):**
- Escalated items requiring Founder review
- Publishing approvals pending (all environments)
- Coverage summary (high-level awareness)

**For Administrator (ADMIN):**
- System alerts (publishing failures, if any)
- Recent administrative actions

**Note on Developers:** The Developer role in MioTranslate is primarily a consumer of Tag IDs, not an active workflow participant. MioTranslate has no codebase awareness (established direction) and developers do not author, review, or approve content. Developers access MioTranslate to look up Page IDs and Tag IDs via Content and Global Search. My Work does not surface artificial developer-specific tasks. If a developer also holds another role (e.g., PM), their My Work reflects that role's items.

**Cross-role:**
- Personal bookmarks (pages and tags bookmarked for quick access)
- Recently viewed/edited items

**How users arrive:**
- Primary navigation → My Work
- This is the recommended default landing page for operational roles (see §10 and IA Decision 7)

**Where users go from here:**
- Select any work item → Opens the **Tag Detail (C3)** within its **Page Detail (C2)** context
- Work items are pointers into the content registry, not copies of content

**Scale considerations:**
- At high volume (hundreds of pending reviews), items must be filterable and sortable. The LR needs to filter by language and sort by confidence score or age.
- At high stale volume, the stale resolution queue must support sequential processing without requiring the LR to navigate to each tag individually.
- Multiple roles per user: if a user holds PM + LR roles, their My Work shows both authoring and review items, clearly separated.

**Supports User Flows:** UF-03 (Author English — finding returned items), UF-06 (Review Translations — finding pending reviews), UF-07 (Bulk Approve — finding high-confidence items), UF-08 (Resolve Stale — finding stale items), UF-09 (Founder Escalation — finding escalated items), UF-10 (Publish — finding publishing approvals)

---

### 6.3 Coverage Area

The Coverage area provides visibility into the state of translation across the entire product.

---

#### V1. Coverage Dashboard

**What it is:** The strategic view of translation readiness across all pages and all languages. This is where the PM, FN, and LR understand the overall state of the product's UX copy.

**What it contains:**

**Coverage matrix:**
- Pages (rows) × Languages (columns)
- Each cell: coverage percentage = (tags approved and deployed to Production) / (total active tags) × 100
- Summary row: overall coverage per language
- Summary column: overall coverage per page
- Completeness levels must be clearly distinguishable across cells (the specific visual encoding is a UI-stage decision)

**Filters and views:**
- Filter pages by Module
- Sort pages by coverage for a selected language (lowest first to prioritize)
- Toggle to show/hide deprecated pages

**Key metrics (visible at top):**
- Total active pages and tags
- Overall coverage per language
- Total stale translations
- Total pending review items

**How users arrive:**
- Primary navigation → Coverage

**Where users go from here:**
- Click a cell → **Page Detail (C2)** filtered by the selected language and showing only the relevant status
- Click a language column header → **Language Readiness (V2)**
- Click the stale count → **Stale Overview (V3)**
- Click pending work count → **My Work (W1)** or stay in coverage for a summary view

**Scale considerations:**
- At 1000+ pages and 12+ languages, the full matrix becomes impractical to display at once. The matrix should support pagination/filtering by module, and the summary row/column should be always visible.
- Coverage percentage must update in near-real-time as translations are approved and deployed.

**Roles:** All roles can view. PM and FN are the primary users.

**Supports User Flows:** UF-14 (Monitor Coverage — main dashboard), UF-17 (Add Language — new language appears at 0%)

---

#### V2. Language Readiness

**What it is:** A focused view of a single language's translation status across all pages. Answers: "How ready are we for Arabic?"

**What it contains:**
- Selected language name and overall coverage percentage
- All pages ranked by coverage for this language (lowest first for prioritization)
- Per-page: tag count, translated count, pending count, stale count, coverage percentage
- Filter by Module
- Action shortcuts: navigate to page detail filtered for this language

**How users arrive:**
- Coverage Dashboard → Select a language
- Direct link (e.g., from a stakeholder report)

**Where users go from here:**
- Select a page → **Page Detail (C2)** filtered by this language
- Back to Coverage Dashboard

**Structural note:** Language Readiness is a sub-view within the Coverage area, not a separate primary navigation item. It is reached by drilling into the Coverage Dashboard.

**Supports User Flows:** UF-14 (Monitor Coverage — language readiness view), UF-17 (Add Language — assessing effort for a new language)

---

#### V3. Stale Overview

**What it is:** A focused view of all stale translations across the product, helping the LR and PM prioritize stale resolution work.

**What it contains:**
- All stale translations grouped by language and page, sorted by age (oldest first)
- Per item: Tag ID, Page Name, language, age of staleness, previous English copy, new English copy
- Filter by language, page, Module
- Count of stale translations per language
- Action: navigate to the tag for stale resolution (→ Tag Detail, UX-08)

**How users arrive:**
- Coverage Dashboard → Click stale count
- My Work → Stale section (for LR)
- Direct navigation within Coverage area

**Where users go from here:**
- Select a stale item → **Tag Detail (C3)** in stale resolution context

**Structural note:** Stale Overview is a sub-view within the Coverage area. Stale items also appear in My Work for the LR, but the Stale Overview provides a cross-product view that is useful for PM/FN assessment.

**Supports User Flows:** UF-08 (Resolve Stale — finding and prioritizing stale items), UF-14 (Monitor Coverage — stale status)

---

### 6.4 Deployments Area

The Deployments area manages the operational record of what has been published where. Publishing is the action (initiated from Content or from this area); a deployment is the result — the versioned record of what is currently live in each environment. This area also supports rollback and deployment history investigation.

---

#### D1. Deployment Overview

**What it is:** The operational command center. Shows the current deployment state across all pages, languages, and environments. This is where the SR and FN see what is deployed, what is pending publishing, and where rollbacks have occurred.

**What it contains:**

**Environment status matrix:**
- Pages (rows) × Environments (columns: Dev, QA, Production)
- Scoped by a selected language (language selector at top)
- Each cell: which version is currently deployed, when it was last published, by whom
- Indicators for: content approved but not yet published to this environment (publishable), content identical to what is already deployed (up to date), rollback has occurred (flagged)

**Pending publishing actions:**
- Page bundles that have approved content not yet published to the next environment
- Items awaiting publishing approval (for SR / FN)

**Recent deployment activity:**
- Recent publishing events and rollbacks across the product

**How users arrive:**
- Primary navigation → Deployments
- Content → Page Detail → Publish action (redirects here with context)

**Where users go from here:**
- Select a cell → **Deployment History (D2)** for that page + language + environment
- Initiate publishing → Publishing flow (UX-10) with page + language + environment pre-selected
- Select "View content" → **Page Detail (C2)** for the relevant page
- Initiate rollback → Rollback flow (UX-11) with context

**Scale considerations:**
- With many pages and three environments, the matrix must be filterable by Module and sortable by deployment date.
- The language selector at top controls the view — the user examines one language at a time to avoid a three-dimensional matrix.

**Roles:** SR and FN are the primary users. PM and LR can view.

**Supports User Flows:** UF-10 (Publish — initiating and tracking), UF-11 (Rollback — finding the deployment to roll back), UF-12 (Correct Production — finding the deployed version)

---

#### D2. Deployment History

**What it is:** The chronological record of all deployments (publishing events and rollbacks) for a specific page + language + environment combination.

**What it contains:**
- Page Name, Language, Environment (shown in header)
- Chronological list of all deployment events:
  - Version deployed
  - Who published / who approved
  - When
  - Tag count
  - Whether it was a rollback
  - Status (Successful, Failed, Rolled Back)
- Action: Rollback to a selected version (for authorized roles, UX-11)
- Comparison: select two versions to see what changed

**How users arrive:**
- Deployment Overview → Select a cell
- Page Detail → Deployment status section → Click
- Tag Detail → Deployment status → Click
- Investigation flow (UX-15) → Deployment history link

**Where users go from here:**
- Rollback → Rollback confirmation flow (UX-11)
- View version content → Shows the tag snapshot for that version
- Back to Deployment Overview

**Supports User Flows:** UF-10 (Publish — deployment record), UF-11 (Rollback — selecting version), UF-15 (Investigate — deployment history)

---

### 6.5 Settings Area

The Settings area handles infrequent administrative and configuration tasks.

---

#### S1. User & Role Management

**What it is:** Manage user role assignments in MioTranslate.

**What it contains:**
- List of all MioTranslate users
- Each user: name, current role(s), role assignment date
- Action: Assign or modify roles (PM, QA, LR, SR, FN, DEV, ADMIN)
- A user can hold multiple roles

**How users arrive:**
- Primary navigation → Settings → Users & Roles

**Roles:** ADMIN, FN only.

**Supports User Flows:** UF-18 (Manage Roles)

---

#### S2. Language Management

**What it is:** Add, view, and deactivate languages in MioTranslate.

**What it contains:**
- List of all languages: language code, language name, direction (LTR/RTL), status (Active/Inactive), date added
- Action: Add a new language (UX-17)
- Action: Deactivate a language
- Impact preview when adding a language: "This will create [N] empty translation slots across [N] active pages"

**How users arrive:**
- Primary navigation → Settings → Languages

**Roles:** ADMIN, FN only.

**Supports User Flows:** UF-17 (Add Language), UF-18 (System Configuration)

---

#### S3. System Configuration

**What it is:** Configure operational parameters that affect how MioTranslate behaves.

**What it contains:**
- Confidence threshold for bulk approval (default: 95%, configurable)
- Other system-wide settings as defined
- Configuration change log (audit trail for configuration changes)

**How users arrive:**
- Primary navigation → Settings → Configuration

**Roles:** ADMIN, FN only.

**Supports User Flows:** UF-18 (System Configuration)

---

#### S4. Data Import

**What it is:** The one-time migration interface and its results.

**What it contains:**
- Import history: record of the initial migration event (date, who initiated, counts, status)
- Validation report from the migration
- This page exists primarily for reference and auditability after the migration is complete

**How users arrive:**
- Primary navigation → Settings → Data Import

**Structural note:** After the one-time migration, this page becomes a historical reference. It does not need prominent placement in Settings — it can be the last item.

**Roles:** ADMIN, FN only.

**Supports User Flows:** UF-02 (Initial Migration)

---

### 6.6 Cross-Cutting: Global Search

**What it is:** A globally accessible search function, always present in the product shell.

**What it searches:**
- Tag IDs
- English copy text (approved and draft)
- Page names
- Page IDs

**What it returns:**
- Matching tags with: Tag ID, Page Name, English copy (snippet), status
- Matching pages with: Page Name, Page ID, Module, tag count
- Results are sortable by page, status, relevance
- Search is case-insensitive
- Results link directly to **Tag Detail (C3)** or **Page Detail (C2)**

**How users access it:**
- Persistent search input in the product shell, accessible from every page
- Keyboard shortcut for power users

**Scale considerations:**
- At 10,000+ tags, search must return results quickly and handle partial matches
- Results must be paginated if they exceed a reasonable threshold

**Supports User Flows:** UF-13 (Find and Inspect — primary search path), UF-12 (Correct Production — finding the reported tag), UF-15 (Investigate — finding the tag)

---

### 6.7 Cross-Cutting: Activity Timeline

**What it is:** A chronological feed of recent actions across MioTranslate.

**What it contains:**
- Recent actions: creations, edits, approvals, promotions, rollbacks
- Filterable by: user, page, language, action type
- Shows the most recent actions first
- Each entry links to the relevant tag or page

**How users access it:**
- Available globally — either as a persistent element in the product shell or as a dedicated view accessible from any page
- Not a primary navigation destination; it is a secondary awareness tool

**Supports User Flows:** UF-15 (Investigate — activity search), UF-14 (Monitor Coverage — recent actions)

---

### 6.8 Cross-Cutting: Audit Trail Search

**What it is:** A cross-cutting search capability for audit records, used during investigations.

**What it searches:**
- Audit records by: user, date range, action type, page, tag, language

**How users access it:**
- From **Tag Detail (C3)** — tag-scoped audit trail is shown in context
- From **Activity Timeline** — broader system-level searching
- From **Settings** (for ADMIN/FN) — user-specific activity reports

**Structural note:** The audit trail is not a standalone navigation destination. Audit records are accessed contextually (within a tag's detail view) or through the activity timeline's filtering capabilities. Creating a separate "Audit" navigation area would duplicate what is already available in context and would rarely be used independently.

**Supports User Flows:** UF-15 (Investigate History — audit trail search)

---

## 7. Complete Page Hierarchy

```
MioTranslate
│
├── [Global Search] ─────────── Always accessible. Returns tags and pages.
├── [Activity Timeline] ─────── Always accessible. Recent system activity.
│
├── Content
│   ├── C1. Page List ─────────── All pages. Browse, filter, search, create.
│   └── C2. Page Detail ──────── One page, all tags, all languages.
│       └── C3. Tag Detail ────── One tag. English, translations, history, audit.
│
├── My Work
│   └── W1. My Work ──────────── Personal, role-aware work queue.
│
├── Coverage
│   ├── V1. Coverage Dashboard ── Pages × Languages coverage matrix.
│   ├── V2. Language Readiness ── One language, all pages ranked.
│   └── V3. Stale Overview ────── All stale translations, prioritized.
│
├── Deployments
│   ├── D1. Deployment Overview ── Environment status matrix.
│   └── D2. Deployment History ─── One page + language + environment history.
│
└── Settings
    ├── S1. User & Role Management
    ├── S2. Language Management
    ├── S3. System Configuration
    └── S4. Data Import
```

**Total unique pages: 13**  
**Maximum depth: 3 levels** (Content → Page Detail → Tag Detail)

---

## 8. Navigation Model

### 8.1 Primary Navigation

The five primary areas (Content, My Work, Coverage, Deployments, Settings) form the persistent primary navigation. This navigation is always visible and always accessible regardless of where the user is in the product.

**Behavior:**
- The primary navigation indicates which area the user is currently in
- Selecting a primary nav item takes the user to the area's default page (e.g., Content → Page List, Coverage → Coverage Dashboard)
- The primary navigation does not expand or collapse — it is a flat list of five items

**Role-based visibility:**
- Content, My Work, Coverage: visible to all roles
- Deployments: visible to all roles (view-only for non-publishing roles)
- Settings: visible only to ADMIN and FN

### 8.2 Contextual Navigation

Within each area, contextual navigation provides additional structure. The specific patterns (breadcrumbs, sub-navigation, drill-down affordances) are UI-stage decisions. This section defines only the structural relationships.

**Content area:**
- Hierarchical path: Content → [Page Name] → [Tag ID]
- Back navigation within the hierarchy
- Cross-links from tag detail to related contexts (e.g., deployment history for this page + language)

**Coverage area:**
- Drill-down navigation from the coverage matrix into specific pages and tags
- Contextual navigation between the Coverage Dashboard, Language Readiness (when a language is selected), and Stale Overview

**Deployments area:**
- Language selector scopes the view
- Drill-down from the overview into per-page deployment history

**Settings area:**
- Sub-navigation across Users & Roles, Languages, Configuration, and Data Import

### 8.3 Global Search

Always accessible from the product shell. Not part of the primary navigation. Operates as a parallel entry path into the content hierarchy.

### 8.4 Notifications

Notifications are a cross-cutting mechanism that links users directly into the relevant product context when something requires their attention (FRD §12). Each notification is a deep link — typically into Tag Detail or Deployment History.

Events that generate notifications include: English copy submitted for review, English copy approved or rejected, translation ready for review, translation approved, stale translations triggered, items escalated to Founder, page bundle published to Production, rollback initiated, and publishing failures.

Notification presentation and management (how they are displayed, grouped, or dismissed) are UI-stage decisions. The IA requirement is that notifications exist as entry points into the product and do not require their own dedicated page.

---

## 9. Content Hierarchy vs. Navigation Hierarchy

These are related but not identical.

### Content hierarchy (how information is structured):

```
Page → Tag → English Copy
                └── Translation [per language]
                       └── Version History
                              └── Audit Records
```

### Navigation hierarchy (how users traverse the product):

```
Primary Nav → Content → Page List → Page Detail → Tag Detail
Primary Nav → My Work → Work Item → (opens Tag Detail in content context)
Primary Nav → Coverage → Dashboard → (drill into Page Detail)
Primary Nav → Deployments → Overview → Deployment History
Primary Nav → Settings → Configuration pages
```

### The connection:

- The content hierarchy determines what is **inside** each page (the Page Detail contains tags; the Tag Detail contains English copy, translations, versions, audit records)
- The navigation hierarchy determines how users **reach** each page
- Content can be reached through multiple navigation paths:
  - A tag can be reached via Content → Page → Tag
  - The same tag can be reached via My Work → Review item
  - The same tag can be reached via Coverage → Drill into cell → Tag
  - The same tag can be reached via Global Search → Tag result
  - The same tag can be reached via Activity Timeline → Action → Tag
- These are not duplicate structures. They are different lenses into the same underlying content.

---

## 10. Workflow Entry Points by Role

Different roles have different dominant starting points when they open MioTranslate. This section describes the common entry patterns observed across the approved User Flows. The actual default landing page is a UI-stage decision; this section provides the behavioral evidence to inform that choice.

| Role | Why they open MioTranslate | Common first destination | Key pages |
|---|---|---|---|
| **PM** | Author or edit English copy, assess coverage, plan translation sprints | **My Work** (to find returned items or continue authoring) or **Content** (to find a page/tag) or **Coverage** (to assess readiness) | C1, C2, C3, W1, V1 |
| **QA** | Verify or correct English copy | **My Work** (to find items to correct) or **Content** (to search for a specific tag) | C1, C2, C3, W1 |
| **LR** | Review translations, resolve stale translations | **My Work** (review queue filtered by language) or **Coverage → Stale Overview** (to prioritize stale resolution) | W1, C2, C3, V3 |
| **SR** | Review English copy, approve publishing to Production | **My Work** (pending reviews and publishing approvals) or **Deployments** (for production status) | W1, C3, D1 |
| **FN** | Review escalated items, assess overall readiness, approve sensitive publishing | **My Work** (escalated items) or **Coverage** (strategic view) | W1, V1, C3, D1 |
| **DEV** | Look up Page IDs and Tag IDs for code reference | **Content** (search for a page/tag) or **Global Search** | C1, C2, C3 |
| **ADMIN** | Manage users, roles, languages, or system configuration | **Settings** | S1, S2, S3 |

**Recommended default landing page:** My Work for operational roles (PM, QA, LR, SR, FN). Content for the Developer role. Settings for the Administrator role. See IA Decision 7 for rationale.

---

## 11. How User Flows Map to Pages

Every approved User Flow (UF-01 through UF-19) is supported by the proposed IA. The table below shows which pages each flow uses and how the user enters the flow. Pages listed are existing pages in the IA — no pages were created specifically to satisfy a single flow.

**Reading the table:** The "Where it happens" column shows the pages the user visits during the flow. The "How the user enters" column shows the most common path into the flow.

| # | Flow | Where it happens | How the user enters |
|---|---|---|---|
| 01 | Register Page & Tags | Page List → Page Detail | Content → Create Page action |
| 02 | Initial Migration | Data Import (in Settings) | Settings → Data Import |
| 03 | Author English Copy | Page Detail → Tag Detail | Content → select Page → select Tag, *or* My Work → returned item |
| 04 | Translate Single Tag | Tag Detail | Content → select Page → select Tag → select language |
| 05 | Bulk Translate Page | Page Detail | Content → select Page → Translate All action |
| 06 | Review Translations | Tag Detail (via My Work) | My Work → select review item → Tag Detail |
| 07 | Bulk Approve | Page Detail | Content → select Page → Bulk Approve action |
| 08 | Resolve Stale | Tag Detail (via My Work or Stale Overview) | My Work → stale item, *or* Coverage → Stale Overview → select tag |
| 09 | Founder Escalation | Tag Detail (via My Work) | My Work → escalated item → Tag Detail |
| 10 | Publish to Environment | Deployment Overview (via Page Detail) | Content → Page → Publish action, *or* Deployments → Initiate |
| 11 | Rollback | Deployment History (via Deployment Overview) | Deployments → select page + language → History → Rollback |
| 12 | Correct Production Issue | Tag Detail → Deployment Overview | Global Search → Tag → correct translation → Publish via Deployments |
| 13 | Find & Inspect Copy | Page List, Page Detail, Tag Detail, Search | Content (browse) *or* Global Search (direct lookup) |
| 14 | Monitor Coverage | Coverage Dashboard, Language Readiness, Stale Overview | Coverage area |
| 15 | Investigate History | Tag Detail | Content → Page → Tag → Version History / Audit Trail |
| 16 | Deprecate Tag | Tag Detail | Content → Page → Tag → Deprecate action |
| 17 | Add Language | Language Management (Settings) → Coverage Dashboard | Settings → Languages → Add, then Coverage shows 0% |
| 18 | Manage Roles/Config | Settings pages | Settings |
| 19 | Export Tag Data | Page Detail | Content → Page → Export action |

---

## 12. Scenario Validation

The following scenarios test whether the proposed IA remains coherent under real conditions. Each scenario is drawn from one or more approved User Flows or UX Flows.

### Scenario 1: A PM authors English copy for a new feature

**Journey:** PM receives Tag IDs from a developer → Content → Page List → finds the page (or creates it via UF-01) → Page Detail → selects a tag → Tag Detail → authors English copy → saves as Draft → submits for review → returns to Page Detail to continue with the next tag.

**Result:** The journey follows the natural content hierarchy: Content → Page → Tag. The PM stays within one page context while working through multiple tags. No area-switching required.

### Scenario 2: An LR reviews 50 Arabic translations

**Journey:** LR → My Work → sees 50 Arabic translations pending review → selects the first item → Tag Detail opens in context → reviews (approve/edit/reject) → returns to the queue → selects next item → repeats.

**Result:** My Work provides the queue. Each item links to Tag Detail. The sequential workflow is supported without forcing the LR to navigate through Content → Page → Tag for each item.

### Scenario 3: The Founder checks overall readiness before a release

**Journey:** FN → Coverage → Coverage Dashboard → scans the matrix → notices Invoice page is 70% for Turkish → clicks the cell → Page Detail opens filtered for Turkish → sees which tags are missing translations → assesses effort → returns to Coverage Dashboard.

**Result:** The drill-down from Coverage into Content is seamless. The FN can move between strategic view and detail view without losing context.

### Scenario 4: The support team reports a wrong Arabic label in production

**Journey:** SR receives the report → Global Search → searches for the label text → finds the tag → Tag Detail → confirms the error → checks version history → determines root cause → LR corrects the translation in Tag Detail → publishing initiated via Page Detail → Deployments area → publishes through Dev → QA → Production.

**Result:** Search is the entry point. Tag Detail provides the investigation context (UF-15). The correction flow (UF-12) stays within content context. The publishing flow (UF-10) transitions naturally to Deployments.

### Scenario 5: An urgent rollback in production

**Journey:** SR → Deployments → Deployment Overview → finds the page + language → clicks into Deployment History → selects the previous version → initiates rollback → rollback confirmed.

**Result:** Deployments is the right entry point for operational recovery. The SR does not need to navigate through Content first.

### Scenario 6: A new language (Portuguese) is added

**Journey:** ADMIN → Settings → Language Management → adds Portuguese → system creates translation slots → PM opens Coverage → Coverage Dashboard → new "Portuguese" column appears at 0% → PM sees the total effort → plans the translation sprint → LR begins bulk translation via Content → Page Detail → Translate All for Portuguese.

**Result:** The Settings → Coverage → Content flow naturally supports the new language rollout without structural changes.

### Scenario 7: 1,000 pages exist in the system

**Stress test:** The Page List (C1) now has 1,000 pages.
- Module filter reduces the visible set to the relevant module (e.g., POS: ~80 pages)
- Coverage-based sort surfaces the pages that need the most attention
- Global Search bypasses browsing entirely when the user knows what they want

**Result:** Search, module filter, and sort prevent the flat page list from becoming unmanageable without introducing unnecessary nesting.

### Scenario 8: A reviewer working through hundreds of stale translations

**Journey:** LR → My Work → Stale section → 200 stale Arabic translations → filters by language: Arabic → sorts by age → selects the oldest → Tag Detail → reviews English change → confirms or retranslates → returns to the stale list → next item.

**Result:** The stale queue in My Work (and also in Coverage → Stale Overview) supports sequential processing. Each item links into Tag Detail. High volume is managed through filtering and sorting.

### Scenario 9: A user with PM + LR roles

**Test:** This user needs to see both authoring work (English copy to write) and review work (translations to approve) in My Work.

**Result:** My Work surfaces items based on all roles the user holds. Items from different roles are clearly grouped. The user does not need to switch between role views.

### Scenario 10: An investigator tracing a label's full lifecycle

**Journey:** SR → Global Search → finds tag INVOICE_TOTAL → Tag Detail → Version History → sees all changes → Audit Trail → sees all actions → compares two versions → determines root cause → navigates to Deployment History (link in Tag Detail) → sees when the problematic version was published.

**Result:** Tag Detail contains all investigation material (versions, audit trail, deployment status) in one place. The investigator does not need to visit multiple areas to piece together the story.

### Scenario 11: A brand-new empty MioTranslate instance

**Test:** No pages, no tags. A user opens MioTranslate for the first time.

**Result:** Content → Page List shows the empty state with guidance to create the first page (UX-01) or run the initial migration (UX-02). My Work is empty but coherent. Coverage shows nothing. Settings is where the migration is initiated.

### Scenario 12: Deprecated content and inactive languages

**Test:** A page has all tags deprecated. A language has been deactivated.

**Result:** Deprecated pages and tags remain visible in Content with a clear "Deprecated" indicator, sorted to the bottom. They are excluded from Coverage active counts. Inactive languages are shown in Settings → Languages with an "Inactive" status. They do not appear as options in language selectors elsewhere.

### Scenario 13: An LR managing a large multi-language translation workload

**Test:** The LR is responsible for Arabic and Turkish. Arabic has 80 pending reviews and 30 stale translations. Turkish has 120 pending reviews and 5 stale translations. The LR must efficiently work across both languages without losing track of progress.

**Journey:** LR → My Work → sees combined counts: 200 pending reviews, 35 stale items → filters by language: Arabic → works through the Arabic review queue → switches filter to Turkish → continues with Turkish reviews → switches to the stale section → filters by Arabic → resolves the 30 stale items in sequence → switches to Turkish stale items → done.

**Result:** My Work's language filter allows the LR to focus on one language at a time within a single page. The LR does not need to navigate to separate language-specific areas. Count indicators per language provide awareness of remaining work. The same stale items also appear in Coverage → Stale Overview, which the PM can use for oversight without interfering with the LR's My Work experience.

### Scenario 14: A new language rollout from zero coverage to production readiness

**Test:** The team adds Malay as a new language. Malay has 0% coverage across 150 active pages with 2,000 active tags. The team must take Malay from zero to production-ready for the highest-traffic pages.

**Journey:**
1. ADMIN → Settings → Languages → adds Malay → system creates 2,000 empty translation slots
2. PM → Coverage → Coverage Dashboard → sees Malay column at 0% across all pages → sorts by page traffic or tag count to prioritize → identifies top 20 pages
3. LR → Content → selects the first priority page → Page Detail → selects Malay in the language filter → sees all tags at "No Translation" → triggers Translate All → AI generates translations → all enter as Draft
4. LR → My Work → 200+ Arabic translations are also pending, but LR filters by Malay → reviews the Malay translations for the first page → bulk approves high-confidence items (UF-07) → individually reviews low-confidence items (UF-06)
5. SR → Deployments or My Work → approves publishing of the first page's Malay bundle to Dev → QA → Production
6. PM → Coverage → Malay column now shows the first pages moving from 0% to 100% → prioritizes the next batch
7. Repeat steps 3–6 for the remaining pages.

**Result:** The IA supports the full new-language lifecycle across all five areas without structural changes: Settings for language creation, Coverage for planning and tracking, Content for translation work, My Work for review task management, and Deployments for publishing. The language filter in My Work prevents Malay work from being drowned out by existing Arabic/Turkish review queues. The Coverage Dashboard provides ongoing progress visibility throughout the rollout.

---

## 13. Major IA Decisions and Rationale

### Decision 1: Page (MioSalon screen) is the primary browsable object, not Tag

**Chose:** Users browse pages and drill into tags.
**Rejected:** A flat, searchable list of all tags with no page grouping.
**Rationale:** Tags are meaningful only in the context of their page. A PM thinks "I need to work on the Quick Sale screen" — not "I need to work on QUICK_42." Tags numbered in the thousands without page grouping would be unnavigable. The page provides natural partitioning that scales. Search provides the escape hatch for users who know the exact tag.
**Source:** FRD §3.1, §4.1 (Page is the top-level organizational unit). BRD §1.1 (UX copy is organized by pages).

### Decision 2: Module is a filter on pages, not a navigation level

**Chose:** Module is metadata on a Page, used as a filter in the Page List.
**Rejected:** A navigation hierarchy of Module → Page → Tag (three levels of nesting).
**Rationale:** MioSalon has ~7 modules. Making each module a navigation destination would create a level of nesting that adds clicks without adding value. The user's mental model is "the Invoice page" not "the POS module's Invoice page." Module as a filter keeps the Page List flat while still enabling the user to scope by module when needed.
**Source:** FRD §4.1 (Module is "metadata only, not an organizational layer").

### Decision 3: Language is a filter/lens, not a destination

**Chose:** Language selectors and filters are applied within the content and coverage contexts.
**Rejected:** A navigation area per language (e.g., "Arabic" as a primary nav item containing all Arabic translations).
**Rationale:** A per-language navigation structure would create 8+ parallel content trees, duplicating the page/tag hierarchy for every language. This violates the principle that content should exist in one place. Instead, language is a dimension that the user selects within the existing content structure: on Page Detail, they select a language to see translations; on Coverage Dashboard, they select a language to see readiness.
**Source:** FRD §7, Business Rule 7 (each language is managed independently — but this is about workflow independence, not structural separation).

### Decision 4: English copy and translations live inside Tag Detail, not in separate areas

**Chose:** The Tag Detail page shows English copy, all translations, version history, and audit trail in one view.
**Rejected:** Separate "English Copy Management" and "Translation Management" areas in the nav.
**Rationale:** English copy and translations are attributes of a tag. They are reviewed in context (the reviewer needs to see the English source alongside the translation). Separating them would force users to navigate between two areas to perform a single review action. The FRD's functional modules (§5.2 English Copy Management, §5.3 Translation Management) are organizing principles for the FRD, not navigation areas for the product.
**Source:** UX Flow UX-04, UX-06 (review context includes English source + translation + back-translation side by side).

### Decision 5: A single "My Work" page replaces separate review queues

**Chose:** One role-aware My Work page that surfaces all actionable items for the current user.
**Rejected:** Separate "English Review Queue," "Translation Review Queue," "Publishing Approval Queue," "Escalation Queue" in the navigation.
**Rationale:** Separate queues would create 4+ navigation items that each role uses only partially. The SR would use only the English review and publishing queue; the LR would use only the translation review queue. A role-aware My Work page shows each user only what they need to act on. It also gracefully handles users with multiple roles (they see all their work in one place) and scales as new work types are added without requiring new navigation items.
**Source:** UX Flow UX-03 through UX-10 (each defines a handoff to a specific role's queue).

### Decision 6: Coverage is a separate primary nav area, not embedded in Content

**Chose:** Coverage is one of five primary navigation areas.
**Rejected:** Coverage dashboard embedded as a tab within the Content area.
**Rationale:** Coverage serves a fundamentally different purpose than content browsing. The PM browsing the Page List is looking for a specific page to work on. The PM opening the Coverage Dashboard is assessing strategic readiness across the entire product. These are different mental modes with different information needs. Embedding coverage within Content would either bury it (if it's a secondary tab) or overload the Content area (if it shares the same entry point). A separate area gives coverage the prominence it deserves as a core business need (BRD §11.5, Problem 4.4).
**Source:** BRD §11.5 (Translation Visibility as a standalone business capability). FRD §5.6 (Visibility & Reporting as a separate functional module).

### Decision 7: The recommended default landing page is My Work for operational roles

**Chose:** Operational roles (PM, QA, LR, SR, FN) land on My Work. The Developer role lands on Content.
**Rejected:** A single default landing page for all roles.
**Why:** The approved User Flows show that most operational users open MioTranslate to act on something — review translations, check returned items, approve publishing. My Work surfaces these items immediately. The Developer role, however, is a consumer of Tag IDs who primarily uses Search and Content. Landing them on an empty My Work would create friction.
**Note:** The exact landing page behavior is a UI-stage decision. This recommendation is based on the entry-point patterns observed in the approved flows (see §10).

### Decision 8: Audit trail access is contextual, not a standalone destination

**Chose:** Audit records are shown within Tag Detail and accessible through the Activity Timeline. No standalone "Audit Trail" page in the nav.
**Rejected:** A top-level "Audit" navigation area with cross-system audit search.
**Rationale:** In 95% of cases, audit trail access is scoped to a specific tag (UF-15: "What happened to tag INVOICE_TOTAL?"). The Tag Detail page shows this directly. For broader investigations ("What did reviewer X approve last week?"), the Activity Timeline's filtering capabilities serve this need. A standalone Audit page would be rarely visited by most roles and would duplicate the functionality already available in context. If future requirements demand heavier cross-system audit analytics, it can be added as a sub-view within Coverage without restructuring the IA.
**Source:** FRD §F-17 (Audit records are searchable by user, date, action type — this search is provided through the Activity Timeline, not a separate page).

---

## 14. Scalability Analysis

| Growth Dimension | Current Scale | Future Scale | How the IA handles it |
|---|---|---|---|
| Pages | ~100 | 1,000+ | Page List uses Module filter, sort, and search to manage volume. No structural change needed under tested scenarios. |
| Tags | ~1,000 | 10,000+ | Tags are scoped to pages, keeping individual Page Detail views manageable. Global Search handles cross-page tag lookup. |
| Languages | 8 | 12-20+ | Language selectors and filters scale naturally. The Coverage Dashboard may need column management at 12+ languages (a UI concern, not an IA change). |
| Translations | ~8,000 | 100,000+ | Translations are scoped to tags within pages. Review queues in My Work handle volume through filtering and sorting. |
| Review queue depth | ~50 | 500+ | My Work uses filtering (by language, page, confidence) and sorting (by age, priority). Sequential processing is supported. |
| Stale backlog | ~20 | 200+ | Stale Overview and My Work stale section both support filtering, sorting, and sequential processing. |
| Team size | ~5 | 15-20+ | My Work is role-aware and handles multiple roles per user. Adding new users or roles does not require IA changes. |
| Deployment frequency | Weekly | Daily | Deployment Overview handles frequent publishing. History is scoped per page+language+environment. |
| New modules | 7 | 15+ | Module remains a filter, not a navigation level. Adding modules is a metadata change, not an IA change. |

**Assessment:** The IA is designed to scale without structural changes under the scenarios tested above. The key architectural choices that support this are: Page as the browsable unit (natural partitioning), Module as a filter (not a nesting level), Language as a dimension (not a structural level), and My Work as a role-aware queue (not per-role navigation items). If MioTranslate grows significantly beyond these scenarios — for example, multi-product support, real-time collaboration, or advanced analytics — the IA should be re-evaluated. The current structure provides a stable foundation for the product's anticipated evolution.

---

## 15. Open Questions

### OQ-1: Activity Timeline presentation

The Activity Timeline needs to be globally accessible but is not a primary navigation destination. The IA defines it as a cross-cutting awareness and investigation tool. How it is presented — as a persistent element, an on-demand view, or an overlay — is a UI-stage decision.

**IA recommendation:** The Activity Timeline should be reachable from any page without requiring navigation away from the current context. It should not compete with the five primary navigation areas. Start with an on-demand approach and revisit based on user feedback.

### OQ-2: Export placement

Export (UF-19) is a simple extraction: page + language → CSV/Excel. The IA places this as a contextual action on Page Detail (C2), since the user is already in the context of the page and has selected a language. A standalone export page is not recommended. This is noted as an open question only to confirm with the UI stage that a contextual action is sufficient.

---

## 16. What This Document Does Not Cover

This IA document provides the structural foundation. The following are explicitly out of scope and will be addressed in subsequent documents:

- **Page layout and component design:** How each page is visually arranged (the UI specification).
- **Responsive behavior:** How the product adapts to different screen sizes.
- **Keyboard navigation and accessibility:** Interaction-level accessibility concerns.
- **Notification design:** How notifications are visually presented and managed.
- **Empty state design:** The visual design of empty states (the IA defines when they occur, but not their visual treatment).
- **Loading and error states:** Visual treatment of loading and error conditions.
- **Exact filter and sort behaviors:** The specific UI patterns for filtering and sorting.
- **Onboarding and first-run experience:** How new users are introduced to MioTranslate.

---

*End of Information Architecture & Page Hierarchy Document.*
