# MioTranslate — ASCII Wireframes

All pages from the approved IA, drawn as low-fidelity wireframes.

---

## Product Shell

Every page sits inside this shell. Primary nav, global search, user identity, and
activity timeline access are always present.

```
┌──────────────────────────────────────────────────────────────────────────────┐
│  MioTranslate                    🔍 Search tags, pages...      User ▾ (PM)  │
├───────────┬───────────┬───────────┬──────────────┬──────────────┬───────────┤
│  Content  │  My Work  │  Coverage │  Deployments │  Settings*   │  🔔 (3)  │
│   ▔▔▔▔▔   │           │           │              │              │          │
├───────────┴───────────┴───────────┴──────────────┴──────────────┴───────────┤
│                                                                             │
│                        ┌────────────────────┐                               │
│                        │                    │                               │
│                        │   [ PAGE CONTENT ] │                               │
│                        │                    │                               │
│                        └────────────────────┘                               │
│                                                                             │
└──────────────────────────────────────────────────────────────────────────────┘

* Settings visible only to ADMIN / FN
  ▔▔▔▔▔ = active area indicator
  🔔 (3) = notification badge with pending count
```

---

## C1. Page List

The browsable registry of all MioSalon pages. Front door to content.

**Use Cases:**
- Browse all registered pages and assess translation coverage at a glance (UF-01)
- Filter and search pages by module, status, or name to find a specific page
- Create a new page in MioTranslate (UF-13)
- Identify pages with low coverage or incomplete translations to prioritize work (UF-14)
- Spot deprecated pages and distinguish them from active content
- Assess per-language readiness across the page registry

```
┌──────────────────────────────────────────────────────────────────────────────┐
│  MioTranslate                    🔍 Search tags, pages...      User ▾ (PM)  │
├──────────────────────────────────────────────────────────────────────────────┤
│  Content    My Work    Coverage    Deployments    Settings            🔔 (3) │
│   ▔▔▔▔▔                                                                     │
├──────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  Page List                                                    [+ Create Page]│
│                                                                              │
│  ┌──────────────────────────────────────────────────────────────────────────┐│
│  │ Search pages...          Module ▾    Status ▾    Sort: Coverage ▾       ││
│  └──────────────────────────────────────────────────────────────────────────┘│
│                                                                              │
│  ┌────────────┬────────┬──────┬──────────┬──────────┬──────────┬──────────┐ │
│  │ Page       │ Module │ Tags │ Arabic   │ Spanish  │ Turkish  │ Status   │ │
│  ├────────────┼────────┼──────┼──────────┼──────────┼──────────┼──────────┤ │
│  │ Quick Sale │ POS    │  38  │ 36 / 38  │ 38 / 38  │ 20 / 38 │ Active   │ │
│  │ Invoice    │ POS    │  52  │ 52 / 52  │ 50 / 52  │  0 / 52 │ Active   │ │
│  │ Calendar   │ Cal    │  91  │ 88 / 91  │ 70 / 91  │ 45 / 91 │ Active   │ │
│  │ Staff Mgmt │ Staff  │  24  │ 24 / 24  │ 24 / 24  │ 24 / 24 │ Active   │ │
│  │ Cust Wish  │ CRM    │  15  │ 10 / 15  │ 15 / 15  │  0 / 15 │ Active   │ │
│  │ Old Report │ Rpt    │  30  │ 30 / 30  │ 30 / 30  │ 30 / 30 │ Depr.    │ │
│  │            │        │      │          │          │          │          │ │
│  │ ...        │        │      │          │          │          │          │ │
│  └────────────┴────────┴──────┴──────────┴──────────┴──────────┴──────────┘ │
│                                                                              │
│  Showing 1–25 of 142 pages                              ◀ 1  2  3  4  5 ▶  │
│                                                                              │
└──────────────────────────────────────────────────────────────────────────────┘
```

**Regions:** Search/filter bar scopes the list. Table is the core — one row per page, language
columns show approved / total tag counts. Deprecated pages sort to the bottom and are visually
dimmed. Pagination handles 100+ pages.

**State: Empty (pre-migration)**

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                                                                              │
│  Page List                                                    [+ Create Page]│
│                                                                              │
│  ┌──────────────────────────────────────────────────────────────────────────┐│
│  │                                                                          ││
│  │                      No pages registered yet.                            ││
│  │                                                                          ││
│  │            Create your first page  ·  Run initial migration              ││
│  │                                                                          ││
│  └──────────────────────────────────────────────────────────────────────────┘│
│                                                                              │
└──────────────────────────────────────────────────────────────────────────────┘
```

---

## C2. Page Detail

All tags on one page. English copy and translations visible. The workhorse page.

**Use Cases:**
- View all tags on a page with their English copy and translation status (UF-01)
- Author or edit English copy for a tag (UF-03)
- Trigger AI translation for a single tag or all untranslated tags on a page (UF-04, UF-05)
- Review translation status per language and identify gaps, stale, or pending items
- Bulk approve high-confidence translations for a language (UF-07)
- Initiate publishing of a page bundle for a language (UF-10)
- Create new tags within the page (UF-13)
- Filter tags by status, copy type, or language to scope work
- DEV: look up Tag IDs for use in code (UF-16)

```
┌──────────────────────────────────────────────────────────────────────────────┐
│  MioTranslate                    🔍 Search tags, pages...      User ▾ (LR)  │
├──────────────────────────────────────────────────────────────────────────────┤
│  Content    My Work    Coverage    Deployments    Settings            🔔 (3) │
│   ▔▔▔▔▔                                                                     │
├──────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  Content ▸ Quick Sale                                                        │
│                                                                              │
│  ┌──────────────────────────────────────────────────────────────────────────┐│
│  │  Quick Sale                                           QUICK   ·  Active  ││
│  │  Module: POS   ·   Tags: 38                                              ││
│  │                                                                          ││
│  │  Coverage     Arabic 36/38   Spanish 38/38   Turkish 20/38               ││
│  │  Deployed     Dev: v12  ·  QA: v11  ·  Prod: v10                        ││
│  └──────────────────────────────────────────────────────────────────────────┘│
│                                                                              │
│  ┌──────────────────────────────────────────────────────────────────────────┐│
│  │ Language: Arabic ▾     Status ▾     Copy Type ▾     Search tags...       ││
│  │                                                                          ││
│  │ [Translate All]   [Bulk Approve]   [Export ▾]   [Publish ▸]   [+ Tag]   ││
│  └──────────────────────────────────────────────────────────────────────────┘│
│                                                                              │
│  ┌──────────┬──────────┬───────────────────┬───────────────────┬───────────┐│
│  │ Tag ID   │ Type     │ English           │ Arabic            │ Status    ││
│  ├──────────┼──────────┼───────────────────┼───────────────────┼───────────┤│
│  │ QUICK_1  │ Header   │ "Quick Sale"      │ "بيع سريع"         │ Approved  ││
│  │ QUICK_2  │ Button   │ "Checkout"        │ "الدفع"             │ Approved  ││
│  │ QUICK_3  │ Label    │ "Walk-in"         │ "عميل بدون موعد"    │ ⚠ Stale   ││
│  │ QUICK_4  │ Error    │ "Payment failed"  │ —                  │ No Trans  ││
│  │ QUICK_5  │ Placeholder│ "Search..."     │ "بحث..."           │ Draft     ││
│  │ QUICK_6  │ Label    │ (Draft)           │ —                  │ No Eng    ││
│  │ ...      │          │                   │                    │           ││
│  └──────────┴──────────┴───────────────────┴───────────────────┴───────────┘│
│                                                                              │
│  Showing 1–25 of 38 tags                                    ◀ 1  2 ▶        │
│                                                                              │
└──────────────────────────────────────────────────────────────────────────────┘
```

**Regions:** Page header (name, metadata, coverage, deployment status). Filter/action bar
(language selector scopes the translation column, status/type filters, bulk actions, tag
creation). Tag table (one row per tag, English + selected-language columns side-by-side).

**Note:** Module and Copy Type (shown as "Type") are optional MioTranslate metadata, not
Language Services schema fields. Migrated records may display "—" for either field.
MioTranslate functions normally regardless of whether these fields are populated.

**State: No language selected (browsing mode)**

When no language is selected, the translation column becomes compact per-language indicators:

```
│ Tag ID   │ Type   │ English          │ ar  es  tr  bg  it  fr  de │ Eng Status │
├──────────┼────────┼──────────────────┼────────────────────────────┼────────────┤
│ QUICK_1  │ Header │ "Quick Sale"     │ ✓   ✓   ◐   ✓   ✓   ✓  ✓ │ Approved   │
│ QUICK_2  │ Button │ "Checkout"       │ ✓   ✓   ·   ✓   ✓   ✓  ✓ │ Approved   │
│ QUICK_3  │ Label  │ "Walk-in"        │ ⚠   ✓   ·   ⚠   ✓   ✓  ✓ │ Approved   │

  ✓ Approved   ◐ Draft/Pending   · No translation   ⚠ Stale
```

**State: Deprecated page**

```
│  ┌──────────────────────────────────────────────────────────────────┐│
│  │  Old Report Screen                     OLD_RPT  ·  ⊘ Deprecated ││
│  │  Module: Reporting   ·   Tags: 30   ·   All tags deprecated     ││
│  │  This page is deprecated. Content is read-only.                  ││
│  └──────────────────────────────────────────────────────────────────┘│
```

---

## C3. Tag Detail

Everything about one tag: English, translations, history, comments, audit, deployment.
Deepest level of the content hierarchy. Reached from Page Detail.

**Use Cases:**
- PM/QA: Author, edit, save draft, and submit English copy for review (UF-03)
- SR: Review, approve, return, escalate, or reject English copy (UF-03)
- PM/LR: Trigger AI translation for a specific language (UF-04)
- LR: Review a translation with back-translation, confidence score, and variable integrity (UF-06)
- LR: Approve, edit & approve, request retranslation, or reject a translation (UF-06)
- LR: Resolve a stale translation — confirm still correct or retranslate (UF-08)
- FN: Review and act on escalated copy (UF-09)
- View version history for English copy or any language's translation (UF-15)
- View and participate in tag-level comments and discussions (UF-12)
- Check deployment status per language per environment for this tag
- DEV: Look up Tag ID, copy type, and current approved text (UF-16)

```
┌──────────────────────────────────────────────────────────────────────────────┐
│  Content ▸ Quick Sale ▸ QUICK_3                                              │
├──────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  QUICK_3                                                          [Active]   │
│  Page: Quick Sale  ·  Module: POS  ·  Copy Type: Label                       │
│                                                                              │
├──────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ENGLISH                                                                     │
│  ┌──────────────────────────────────────────────────────────────────────────┐│
│  │                                                                          ││
│  │  "Walk-in Customer"                                                      ││
│  │                                                                          ││
│  │  Status: Approved   ·   v3   ·   Authored: PM, Aug 15                    ││
│  │  Approved by: SR, Aug 16   ·   Change reason: "Clarified from Walk-in"   ││
│  │                                                                          ││
│  │  ┌──────────────────────────────────────────────────────────────────┐    ││
│  │  │ (Draft) "Walk-in Guest"                              [Discard] │    ││
│  │  │ Unsaved draft by PM · Started Aug 18                            │    ││
│  │  └──────────────────────────────────────────────────────────────────┘    ││
│  │                                                                          ││
│  │  [Edit]   [Submit for Review]   [Save Draft]                    PM, QA   ││
│  │  [Approve]  [Return]  [Escalate]  [Reject]                     SR only   ││
│  └──────────────────────────────────────────────────────────────────────────┘│
│                                                                              │
├──────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  TRANSLATIONS                                          Language: Arabic ▾    │
│  ┌──────────────────────────────────────────────────────────────────────────┐│
│  │                                                                          ││
│  │  ┌───────────────────────────────┐  ┌───────────────────────────────┐    ││
│  │  │ Source English                │  │ Arabic Translation            │    ││
│  │  │                               │  │                               │    ││
│  │  │ "Walk-in Customer"            │  │ "عميل بدون موعد"               │    ││
│  │  │                               │  │                               │    ││
│  │  └───────────────────────────────┘  └───────────────────────────────┘    ││
│  │                                                                          ││
│  │  Back-translation: "Customer without appointment"                        ││
│  │  Confidence: 92%   ·   Variables: ✓ OK                                   ││
│  │  Status: ⚠ Stale   ·   Based on English v2 (current is v3)              ││
│  │                                                                          ││
│  │  ┌──────────────────────────────────────────────────────────────┐        ││
│  │  │ English changed:  v2 "Walk-in"  →  v3 "Walk-in Customer"   │        ││
│  │  └──────────────────────────────────────────────────────────────┘        ││
│  │                                                                          ││
│  │  [Confirm Still Correct]   [Retranslate]   [Edit & Approve]     LR, FN   ││
│  │                                                                          ││
│  ├──────────────────────────────────────────────────────────────────────────┤│
│  │  All Languages Summary                                                   ││
│  │  Arabic ⚠Stale  · Spanish ✓  · Turkish ·  · Bulgarian ⚠Stale            ││
│  │  Italian ✓  · French ✓  · German ✓                                       ││
│  └──────────────────────────────────────────────────────────────────────────┘│
│                                                                              │
├──────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  VERSION HISTORY                     English ▾    ◀ Older   Newer ▶          │
│  ┌──────┬────────────┬───────────────────────────────────────┬──────────────┐│
│  │ Ver  │ Date       │ Change                                │ By           ││
│  ├──────┼────────────┼───────────────────────────────────────┼──────────────┤│
│  │ v3   │ Aug 15     │ "Walk-in" → "Walk-in Customer"       │ PM  (Edit)   ││
│  │ v2   │ Aug 10     │ "Walk In" → "Walk-in"                │ PM  (Edit)   ││
│  │ v1   │ Jul 28     │ Created: "Walk In"                    │ PM  (Create) ││
│  └──────┴────────────┴───────────────────────────────────────┴──────────────┘│
│  [Compare Versions]                                                          │
│                                                                              │
├──────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  COMMENTS                                                         [+ Add]    │
│  ┌──────────────────────────────────────────────────────────────────────────┐│
│  │  LR · Aug 16 · Arabic                                                    ││
│  │  "Should this be gender-neutral? 'عميل' is masculine."       [Resolve]  ││
│  │                                                                          ││
│  │  PM · Aug 16 · Reply                                                     ││
│  │  "Yes, use 'عميل' as default, it's standard in business context."       ││
│  └──────────────────────────────────────────────────────────────────────────┘│
│                                                                              │
├──────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  DEPLOYMENT STATUS                                                           │
│  ┌──────────┬──────────────┬──────────────┬──────────────┐                   │
│  │ Language │ Dev          │ QA           │ Production   │                   │
│  ├──────────┼──────────────┼──────────────┼──────────────┤                   │
│  │ Arabic   │ v10 (Aug 14) │ v10 (Aug 14) │ v9  (Aug 10) │                   │
│  │ Spanish  │ v10 (Aug 14) │ v10 (Aug 14) │ v10 (Aug 14) │                   │
│  │ Turkish  │ —            │ —            │ —            │                   │
│  └──────────┴──────────────┴──────────────┴──────────────┘                   │
│  View full deployment history ▸                                              │
│                                                                              │
└──────────────────────────────────────────────────────────────────────────────┘
```

**Regions:** Breadcrumb (Content ▸ Page ▸ Tag). Tag header (ID, metadata, status). English
section (approved text, draft if exists, role-specific actions). Translation section (source/
translation side-by-side, review context, stale diff, all-languages summary). Version history
(chronological, filterable by English or per-language). Comments (scoped, threaded). Deployment
status (per-language per-environment).

**State: New tag, no English copy**

```
│  ENGLISH                                                                     │
│  ┌──────────────────────────────────────────────────────────────────────────┐│
│  │                                                                          ││
│  │  No English copy authored                                                ││
│  │                                                                          ││
│  │  [Author English Copy]                                          PM, QA   ││
│  └──────────────────────────────────────────────────────────────────────────┘│
│                                                                              │
│  TRANSLATIONS                                                                │
│  ┌──────────────────────────────────────────────────────────────────────────┐│
│  │  Translation unavailable. English copy must be approved first.           ││
│  └──────────────────────────────────────────────────────────────────────────┘│
```

**State: English Pending Review (SR view)**

```
│  ENGLISH                                                     Status: Pending │
│  ┌──────────────────────────────────────────────────────────────────────────┐│
│  │                                                                          ││
│  │  Submitted: "Walk-in Guest"                                              ││
│  │  By: PM  ·  Aug 18  ·  Reason: "Updated for clarity"                    ││
│  │                                                                          ││
│  │  Previous approved: "Walk-in Customer" (v3)                              ││
│  │                                                                          ││
│  │  [Approve]   [Return for Revision]   [Escalate to Founder]   [Reject]    ││
│  │                                                        Comment required ▾ ││
│  └──────────────────────────────────────────────────────────────────────────┘│
```

**State: Translation review (LR view, non-stale)**

```
│  TRANSLATIONS                                          Language: Arabic ▾    │
│  ┌──────────────────────────────────────────────────────────────────────────┐│
│  │  ┌───────────────────────────────┐  ┌───────────────────────────────┐    ││
│  │  │ Source English                │  │ Arabic Translation            │    ││
│  │  │ "Checkout"                    │  │ "الدفع"                        │    ││
│  │  └───────────────────────────────┘  └───────────────────────────────┘    ││
│  │                                                                          ││
│  │  Back-translation: "Payment"                                             ││
│  │  Confidence: 97%   ·   Variables: ✓ OK   ·   Status: Draft              ││
│  │                                                                          ││
│  │  [Approve]   [Edit & Approve]   [Retranslate]   [Reject]       LR, FN   ││
│  └──────────────────────────────────────────────────────────────────────────┘│
```

---

## W1. My Work

Personal, role-aware work queue. Items link into Tag Detail / Deployments.

**Use Cases:**
- LR: Find translations pending review, sorted/filtered by language, page, or confidence (UF-06, UF-07)
- LR: Find stale translations requiring resolution, prioritized by age (UF-08)
- SR: Find English copy pending review and publishing approvals pending sign-off (UF-03, UF-10)
- FN: Find escalated items requiring Founder-level attention (UF-09)
- FN: View overall coverage and pending publishing approvals (UF-10)
- PM: Track recently touched items and bookmarked pages/tags
- All roles: Quick-access recently viewed content to resume work

```
┌──────────────────────────────────────────────────────────────────────────────┐
│  MioTranslate                    🔍 Search tags, pages...      User ▾ (LR)  │
├──────────────────────────────────────────────────────────────────────────────┤
│  Content    My Work    Coverage    Deployments    Settings            🔔 (3) │
│              ▔▔▔▔▔                                                           │
├──────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  My Work                                                                     │
│                                                                              │
│  ┌──────────────────────────────────────────────────────────────────────────┐│
│  │  Pending Review: 80        Stale: 30        Recently Reviewed: 14       ││
│  │                                                                          ││
│  │  Arabic: 50 pending, 12 stale   ·   Turkish: 30 pending, 18 stale       ││
│  └──────────────────────────────────────────────────────────────────────────┘│
│                                                                              │
│  ┌─ TRANSLATIONS PENDING REVIEW ────────────────────────────────────────────┐│
│  │                                                                          ││
│  │  Language ▾   Page ▾   Sort: Confidence ▾                                ││
│  │                                                                          ││
│  │  ┌────────────┬───────────┬───────────────┬──────────┬─────────┬───────┐││
│  │  │ Tag        │ Page      │ English       │ Arabic   │ Conf.   │ Vars  │││
│  │  ├────────────┼───────────┼───────────────┼──────────┼─────────┼───────┤││
│  │  │ QUICK_4    │ Quick Sale│ "Payment..."  │ "الدفع..."│ 72%     │ ⚠     │││
│  │  │ INV_12     │ Invoice   │ "Total"       │ "المجموع" │ 88%     │ ✓     │││
│  │  │ INV_13     │ Invoice   │ "Subtotal"    │ "المجموع" │ 91%     │ ✓     │││
│  │  │ CAL_5      │ Calendar  │ "Book Now"    │ "احجز..."│ 96%     │ ✓     │││
│  │  │ ...        │           │               │          │         │       │││
│  │  └────────────┴───────────┴───────────────┴──────────┴─────────┴───────┘││
│  │  Showing 1–25 of 80                                     ◀ 1  2  3  4 ▶  ││
│  └──────────────────────────────────────────────────────────────────────────┘│
│                                                                              │
│  ┌─ STALE TRANSLATIONS ─────────────────────────────────────────────────────┐│
│  │                                                                          ││
│  │  Language ▾   Sort: Age (oldest first) ▾                                 ││
│  │                                                                          ││
│  │  ┌────────────┬───────────┬──────────┬───────┬──────────────────────────┐││
│  │  │ Tag        │ Page      │ Language │ Age   │ English Change            │││
│  │  ├────────────┼───────────┼──────────┼───────┼──────────────────────────┤││
│  │  │ QUICK_3    │ Quick Sale│ Arabic   │ 3 d   │ "Walk-in" → "Walk-in.." │││
│  │  │ QUICK_3    │ Quick Sale│ Bulgarian│ 3 d   │ "Walk-in" → "Walk-in.." │││
│  │  │ INV_8      │ Invoice   │ Arabic   │ 7 d   │ "Amt Due" → "Amount.."  │││
│  │  │ ...        │           │          │       │                          │││
│  │  └────────────┴───────────┴──────────┴───────┴──────────────────────────┘││
│  │  Showing 1–25 of 30                                          ◀ 1  2 ▶   ││
│  └──────────────────────────────────────────────────────────────────────────┘│
│                                                                              │
│  ┌─ BOOKMARKS & RECENT ─────────────────────────────────────────────────────┐│
│  │  ★ Quick Sale (page)  ·  ★ INV_TOTAL (tag)  ·  Recent: QUICK_4, CAL_5  ││
│  └──────────────────────────────────────────────────────────────────────────┘│
│                                                                              │
└──────────────────────────────────────────────────────────────────────────────┘
```

**Regions:** Summary bar (counts per work type, per language). Pending review queue (table with
filters — language, page, sort by confidence). Stale queue (table sorted by age). Bookmarks
and recently viewed (quick access). Every row links to Tag Detail.

**State: My Work for SR (Support Reviewer)**

```
│  My Work                                                                     │
│                                                                              │
│  ┌──────────────────────────────────────────────────────────────────────────┐│
│  │  English Review: 5         Publishing Approvals: 2                       ││
│  └──────────────────────────────────────────────────────────────────────────┘│
│                                                                              │
│  ┌─ ENGLISH COPY PENDING REVIEW ────────────────────────────────────────────┐│
│  │  ┌────────────┬───────────┬───────────────────────┬──────────┬──────────┐││
│  │  │ Tag        │ Page      │ Submitted Text        │ Author   │ Date     │││
│  │  ├────────────┼───────────┼───────────────────────┼──────────┼──────────┤││
│  │  │ QUICK_7    │ Quick Sale│ "Complete Payment"    │ PM       │ Aug 17   │││
│  │  │ INV_22     │ Invoice   │ "Invoice Generated"   │ QA       │ Aug 16   │││
│  │  │ ...        │           │                       │          │          │││
│  │  └────────────┴───────────┴───────────────────────┴──────────┴──────────┘││
│  └──────────────────────────────────────────────────────────────────────────┘│
│                                                                              │
│  ┌─ PUBLISHING APPROVALS PENDING ───────────────────────────────────────────┐│
│  │  ┌───────────┬──────────┬──────────────┬──────────────┬──────────┐       ││
│  │  │ Page      │ Language │ Environment  │ Changes      │ Requested│       ││
│  │  ├───────────┼──────────┼──────────────┼──────────────┼──────────┤       ││
│  │  │ Invoice   │ Arabic   │ Production   │ 3 tags upd.  │ PM, Aug 17│      ││
│  │  │ Calendar  │ Spanish  │ Production   │ 8 tags upd.  │ PM, Aug 16│      ││
│  │  └───────────┴──────────┴──────────────┴──────────────┴──────────┘       ││
│  └──────────────────────────────────────────────────────────────────────────┘│
│                                                                              │
│  ┌─ RECENT PRODUCTION DEPLOYMENTS ──────────────────────────────────────────┐│
│  │  Quick Sale / Arabic → Prod v10 · Aug 14 · by SR                         ││
│  │  Staff Mgmt / Spanish → Prod v5  · Aug 12 · by FN                        ││
│  └──────────────────────────────────────────────────────────────────────────┘│
```

**State: My Work for FN (Founder)**

```
│  My Work                                                                     │
│                                                                              │
│  ┌──────────────────────────────────────────────────────────────────────────┐│
│  │  Escalated: 2         Publishing Approvals: 3                            ││
│  └──────────────────────────────────────────────────────────────────────────┘│
│                                                                              │
│  ┌─ ESCALATED ITEMS ────────────────────────────────────────────────────────┐│
│  │  ┌────────────┬───────────┬─────────────────┬───────────┬──────────────┐ ││
│  │  │ Tag        │ Page      │ Text            │ Escalated │ Reason       │ ││
│  │  ├────────────┼───────────┼─────────────────┼───────────┼──────────────┤ ││
│  │  │ QUICK_9    │ Quick Sale│ "No Show Fee"   │ SR, Aug 16│ "Sensitive.."│ ││
│  │  │ CRM_14     │ CRM Home  │ "Loyalty Pts"   │ PM, Aug 15│ "Brand..."   │ ││
│  │  └────────────┴───────────┴─────────────────┴───────────┴──────────────┘ ││
│  └──────────────────────────────────────────────────────────────────────────┘│
│                                                                              │
│  ┌─ COVERAGE OVERVIEW ──────────────────────────────────────────────────────┐│
│  │  Arabic: 92%  ·  Spanish: 78%  ·  Turkish: 45%   ·   14 stale total     ││
│  │  View full coverage ▸                                                     ││
│  └──────────────────────────────────────────────────────────────────────────┘│
```

**State: Empty queue**

```
│  My Work                                                                     │
│                                                                              │
│  ┌──────────────────────────────────────────────────────────────────────────┐│
│  │                                                                          ││
│  │                 All caught up. No items need your attention.              ││
│  │                                                                          ││
│  └──────────────────────────────────────────────────────────────────────────┘│
│                                                                              │
│  ┌─ BOOKMARKS & RECENT ─────────────────────────────────────────────────────┐│
│  │  ★ Quick Sale (page)  ·  Recent: QUICK_4, CAL_5                          ││
│  └──────────────────────────────────────────────────────────────────────────┘│
```

---

## V1. Coverage Dashboard

Strategic matrix view. Pages × Languages. Where leadership asks "Are we ready?"

**Use Cases:**
- Assess overall translation readiness across all pages and languages (UF-14)
- Identify pages with the lowest coverage for a specific language to prioritize translation work
- Spot stale translation counts per page per language
- Drill into a specific page + language cell to view/resolve gaps
- Navigate to Language Readiness for a single-language deep-dive (UF-17)
- Navigate to Stale Overview for cross-product stale resolution planning (UF-08)
- Filter by module to assess readiness for a specific product area

```
┌──────────────────────────────────────────────────────────────────────────────┐
│  MioTranslate                    🔍 Search tags, pages...      User ▾ (PM)  │
├──────────────────────────────────────────────────────────────────────────────┤
│  Content    My Work    Coverage    Deployments    Settings            🔔 (3) │
│                         ▔▔▔▔▔                                                │
├──────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  Coverage Dashboard                                                          │
│                                                                              │
│  ┌──────────────────────────────────────────────────────────────────────────┐│
│  │  Active Pages: 142     Active Tags: 4,218     Stale: 47                  ││
│  │  Pending Review: 110                                                     ││
│  │                                                                          ││
│  │  Arabic 92%  ·  Spanish 78%  ·  Turkish 45%  ·  Bulgarian 88%           ││
│  │  Italian 95%  ·  French 91%  ·  German 82%  ·  Portuguese 0%            ││
│  └──────────────────────────────────────────────────────────────────────────┘│
│                                                                              │
│  Module ▾     Sort: Coverage ▾     [Hide deprecated]                         │
│                                                                              │
│  ┌─────────────┬──────┬───────┬───────┬───────┬───────┬───────┬───────┬────┐│
│  │ Page        │ Tags │ ar    │ es    │ tr    │ bg    │ it    │ fr    │ de ││
│  ├─────────────┼──────┼───────┼───────┼───────┼───────┼───────┼───────┼────┤│
│  │ Quick Sale  │  38  │  95%  │ 100%  │  53%  │  95%  │ 100%  │ 100%  │100%││
│  │             │      │ 2 stl │       │       │ 2 stl │       │       │    ││
│  │ Invoice     │  52  │ 100%  │  96%  │   0%  │ 100%  │ 100%  │  96%  │ 96%││
│  │ Calendar    │  91  │  97%  │  77%  │  49%  │  90%  │  93%  │  85%  │ 82%││
│  │             │      │       │       │       │ 5 stl │       │       │    ││
│  │ Staff Mgmt  │  24  │ 100%  │ 100%  │ 100%  │ 100%  │ 100%  │ 100%  │100%││
│  │ Cust Wishes │  15  │  67%  │ 100%  │   0%  │  67%  │  80%  │ 100%  │ 80%││
│  │ Reports     │  45  │  91%  │  82%  │  40%  │  89%  │  91%  │  87%  │ 82%││
│  │ ...         │      │       │       │       │       │       │       │    ││
│  ├─────────────┼──────┼───────┼───────┼───────┼───────┼───────┼───────┼────┤│
│  │ OVERALL     │ 4218 │  92%  │  78%  │  45%  │  88%  │  95%  │  91%  │ 82%││
│  └─────────────┴──────┴───────┴───────┴───────┴───────┴───────┴───────┴────┘│
│                                                                              │
│  Showing 1–25 of 142 pages                                  ◀ 1  2  3  4 ▶  │
│                                                                              │
│  Stale: 47 total  ▸ View Stale Overview                                      │
│                                                                              │
└──────────────────────────────────────────────────────────────────────────────┘

  Click cell → Page Detail filtered by that language
  Click language column → Language Readiness
  Click stale count → Stale Overview
  "stl" = stale count shown below percentage
```

**Regions:** Key metrics bar (counts, per-language overall coverage). Filters and sort. Coverage
matrix (pages × languages, percentage cells with stale annotations, pinned summary row). Stale
shortcut at bottom.

**State: New language at 0%**

The Portuguese column appears showing 0% for every page. The key metrics bar shows `Portuguese 0%`.

---

## V2. Language Readiness

One language, all pages ranked by coverage.

**Use Cases:**
- Assess one language's readiness across all pages, ranked by coverage gap (UF-14, UF-17)
- Identify which pages need the most translation work for this language
- Plan language expansion by seeing where a newly added language stands
- Drill into a specific page to start translating or reviewing for this language

```
┌──────────────────────────────────────────────────────────────────────────────┐
│  Content    My Work    Coverage    Deployments    Settings            🔔 (3) │
│                         ▔▔▔▔▔                                                │
├──────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  Coverage ▸ Turkish                                                          │
│                                                                              │
│  ┌──────────────────────────────────────────────────────────────────────────┐│
│  │  Turkish                                             Overall: 45%        ││
│  │  Pages complete: 1 / 142  ·  Stale: 18  ·  Untranslated tags: 2,320    ││
│  └──────────────────────────────────────────────────────────────────────────┘│
│                                                                              │
│  Module ▾     Sort: Coverage (lowest first) ▾                                │
│                                                                              │
│  ┌─────────────┬────────┬──────┬─────────────┬──────────┬───────┬──────────┐│
│  │ Page        │ Module │ Tags │ Translated  │ Pending  │ Stale │ Coverage ││
│  ├─────────────┼────────┼──────┼─────────────┼──────────┼───────┼──────────┤│
│  │ Invoice     │ POS    │  52  │    0        │   0      │   0   │    0%    ││
│  │ Cust Wishes │ CRM    │  15  │    0        │   0      │   0   │    0%    ││
│  │ Reports     │ Rpt    │  45  │   18        │   5      │   2   │   40%    ││
│  │ Calendar    │ Cal    │  91  │   45        │  10      │   8   │   49%    ││
│  │ Quick Sale  │ POS    │  38  │   20        │   5      │   8   │   53%    ││
│  │ Staff Mgmt  │ Staff  │  24  │   24        │   0      │   0   │  100%    ││
│  │ ...         │        │      │             │          │       │          ││
│  └─────────────┴────────┴──────┴─────────────┴──────────┴───────┴──────────┘│
│                                                                              │
│  Showing 1–25 of 142 pages                                  ◀ 1  2  3  4 ▶  │
│                                                                              │
└──────────────────────────────────────────────────────────────────────────────┘

  Click page → Page Detail filtered by Turkish
```

**Regions:** Language header (name, overall %, key counts). Filter and sort. Table ranked by
coverage gap — lowest first so the PM sees where to focus.

---

## V3. Stale Overview

All stale translations across the product.

**Use Cases:**
- View all stale translations across the product, prioritized by age (UF-08, UF-14)
- Filter stale items by language, module, or page to scope resolution work
- Understand the English change that caused each stale flag
- Drill into a specific stale tag to confirm or retranslate (UF-08)
- Identify long-overdue stale items (>90 days) that require urgent attention

```
┌──────────────────────────────────────────────────────────────────────────────┐
│  Content    My Work    Coverage    Deployments    Settings            🔔 (3) │
│                         ▔▔▔▔▔                                                │
├──────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  Coverage ▸ Stale Overview                                                   │
│                                                                              │
│  ┌──────────────────────────────────────────────────────────────────────────┐│
│  │  Total stale: 47                                                         ││
│  │  Arabic: 12  ·  Turkish: 18  ·  Bulgarian: 7  ·  Spanish: 5  ·  Other: 5││
│  │                                                                          ││
│  │  > 90 days: 3    30–90 days: 12    7–30 days: 20    < 7 days: 12         ││
│  └──────────────────────────────────────────────────────────────────────────┘│
│                                                                              │
│  Language ▾    Module ▾    Page ▾    Sort: Age (oldest first) ▾               │
│                                                                              │
│  ┌────────────┬───────────┬──────────┬───────┬──────────────────────────────┐│
│  │ Tag        │ Page      │ Language │ Age   │ English Change               ││
│  ├────────────┼───────────┼──────────┼───────┼──────────────────────────────┤│
│  │ RPT_12     │ Reports   │ Bulgarian│ 94 d  │ "Weekly Rev." → "Weekly..."  ││
│  │ RPT_15     │ Reports   │ Turkish  │ 91 d  │ "Monthly.." → "Monthly..."   ││
│  │ RPT_15     │ Reports   │ Bulgarian│ 91 d  │ "Monthly.." → "Monthly..."   ││
│  │ CAL_22     │ Calendar  │ Arabic   │ 45 d  │ "Rebook" → "Rebook App..."   ││
│  │ QUICK_3    │ Quick Sale│ Arabic   │  3 d  │ "Walk-in" → "Walk-in Cust."  ││
│  │ QUICK_3    │ Quick Sale│ Bulgarian│  3 d  │ "Walk-in" → "Walk-in Cust."  ││
│  │ ...        │           │          │       │                              ││
│  └────────────┴───────────┴──────────┴───────┴──────────────────────────────┘│
│                                                                              │
│  Showing 1–25 of 47                                             ◀ 1  2 ▶    │
│                                                                              │
└──────────────────────────────────────────────────────────────────────────────┘

  Click row → Tag Detail in stale resolution context
```

**Regions:** Stale summary (total, per-language counts, age distribution). Filters and sort.
Item list showing the English before/after diff that caused staleness. Each row links to
Tag Detail for resolution.

**State: No stale translations**

```
│  ┌──────────────────────────────────────────────────────────────────────────┐│
│  │                                                                          ││
│  │          No stale translations. All translations are up to date.         ││
│  │                                                                          ││
│  └──────────────────────────────────────────────────────────────────────────┘│
```

---

## D1. Deployment Overview

Operational command center. What's deployed where, what's pending.

**Use Cases:**
- View what version is currently deployed per page per environment for a language (UF-10, UF-11)
- Identify pages with newer approved content not yet published (publishable indicator)
- Approve and initiate publishing to Dev, QA, or Production (UF-10)
- View pending publishing actions awaiting approval
- Track recent publishing activity across the product
- Filter to see only pages with actionable deployment states (publishable, rolled back)

```
┌──────────────────────────────────────────────────────────────────────────────┐
│  MioTranslate                    🔍 Search tags, pages...      User ▾ (SR)  │
├──────────────────────────────────────────────────────────────────────────────┤
│  Content    My Work    Coverage    Deployments    Settings            🔔 (3) │
│                                     ▔▔▔▔▔▔▔▔                                 │
├──────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  Deployment Overview                             Language: Arabic ▾          │
│                                                                              │
│  ┌─ ENVIRONMENT STATUS ─────────────────────────────────────────────────────┐│
│  │                                                                          ││
│  │  ┌─────────────┬─────────────────┬─────────────────┬───────────────────┐ ││
│  │  │ Page        │ Dev             │ QA              │ Production        │ ││
│  │  ├─────────────┼─────────────────┼─────────────────┼───────────────────┤ ││
│  │  │ Quick Sale  │ v12 · Aug 17   │ v11 · Aug 14    │ v10 · Aug 10     │ ││
│  │  │             │   ✓ up to date  │  ▲ publishable  │  ▲ publishable    │ ││
│  │  │ Invoice     │ v10 · Aug 14   │ v10 · Aug 14    │ v10 · Aug 14     │ ││
│  │  │             │   ✓ up to date  │   ✓ up to date  │   ✓ up to date   │ ││
│  │  │ Calendar    │ v8  · Aug 12   │ v7  · Aug 10    │ v6  · Aug 5      │ ││
│  │  │             │   ✓ up to date  │  ▲ publishable  │  ▲ publishable    │ ││
│  │  │ Staff Mgmt  │ v5  · Aug 10   │ v5  · Aug 10    │ v5  · Aug 10     │ ││
│  │  │             │   ✓ up to date  │   ✓ up to date  │   ✓ up to date   │ ││
│  │  │ Cust Wishes │ —              │ —               │ —                │ ││
│  │  │             │   · never pub.  │   · never pub.  │   · never pub.   │ ││
│  │  │ ...         │                 │                 │                   │ ││
│  │  └─────────────┴─────────────────┴─────────────────┴───────────────────┘ ││
│  │                                                                          ││
│  │  Module ▾    Show only: ▾ (Publishable / Rollback / All)                 ││
│  │  Showing 1–25 of 142 pages                            ◀ 1  2  3  4 ▶    ││
│  └──────────────────────────────────────────────────────────────────────────┘│
│                                                                              │
│  ┌─ PENDING PUBLISHING ACTIONS ─────────────────────────────────────────────┐│
│  │                                                                          ││
│  │  ┌───────────┬──────────┬──────────────┬──────────────┬──────────┬──────┐││
│  │  │ Page      │ Language │ Target       │ Changes      │ Requested│Action│││
│  │  ├───────────┼──────────┼──────────────┼──────────────┼──────────┼──────┤││
│  │  │ Quick Sale│ Arabic   │ QA           │ 3 tags upd.  │ PM, Aug17│[Pub] │││
│  │  │ Calendar  │ Arabic   │ QA           │ 8 tags upd.  │ PM, Aug16│[Pub] │││
│  │  │ Quick Sale│ Arabic   │ Production   │ 5 tags upd.  │ PM, Aug17│[Pub] │││
│  │  └───────────┴──────────┴──────────────┴──────────────┴──────────┴──────┘││
│  └──────────────────────────────────────────────────────────────────────────┘│
│                                                                              │
│  ┌─ RECENT ACTIVITY ────────────────────────────────────────────────────────┐│
│  │  Aug 17 · Staff Mgmt / Arabic → Prod v5 · Published by SR                ││
│  │  Aug 14 · Invoice / Arabic → Prod v10 · Published by SR                  ││
│  │  Aug 14 · Quick Sale / Arabic → QA v11 · Published by LR                 ││
│  └──────────────────────────────────────────────────────────────────────────┘│
│                                                                              │
└──────────────────────────────────────────────────────────────────────────────┘

  ✓ up to date     ▲ publishable     ⊘ rolled back     · never published
  Click cell → Deployment History
  Click [Pub] → Publishing confirmation flow
```

**Regions:** Language selector (scopes entire view to one language). Environment status matrix
(pages × 3 environments, version/date/indicator per cell). Pending actions (what's ready to
publish). Recent activity feed. Each cell links to Deployment History.

---

## D2. Deployment History

All deployments for one page + one language + one environment.

**Use Cases:**
- View the full chronological deployment history for a specific page + language + environment (UF-15)
- See what version is currently live and who published it
- Compare what changed between deployed versions
- Initiate a rollback to a previous version (UF-11)
- Investigate a deployment failure or rollback event

```
┌──────────────────────────────────────────────────────────────────────────────┐
│  Content    My Work    Coverage    Deployments    Settings            🔔 (3) │
│                                     ▔▔▔▔▔▔▔▔                                 │
├──────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  Deployments ▸ Quick Sale · Arabic · Production                              │
│                                                                              │
│  ┌──────────────────────────────────────────────────────────────────────────┐│
│  │  Currently Deployed: Version 10                                          ││
│  │  Published Aug 10 by SR   ·   38 tags   ·   Status: ✓ Successful         ││
│  └──────────────────────────────────────────────────────────────────────────┘│
│                                                                              │
│  ┌─ DEPLOYMENT TIMELINE ────────────────────────────────────────────────────┐│
│  │                                                                          ││
│  │  ┌──────┬──────────┬────────────┬─────────┬──────┬──────────┬──────────┐ ││
│  │  │ Ver  │ Action   │ Date       │ By      │ Appr │ Tags     │ Status   │ ││
│  │  ├──────┼──────────┼────────────┼─────────┼──────┼──────────┼──────────┤ ││
│  │  │ v10  │ Publish  │ Aug 10     │ PM      │ SR   │ 38       │ ✓ Live   │ ││
│  │  │ v9   │ Rollback │ Aug 8      │ SR      │ FN   │ 38       │ ⊘ R.back │ ││
│  │  │ v9   │ Publish  │ Aug 5      │ PM      │ SR   │ 38       │ Replaced │ ││
│  │  │ v8   │ Publish  │ Jul 28     │ PM      │ SR   │ 36       │ Replaced │ ││
│  │  │ v7   │ Publish  │ Jul 15     │ PM      │ SR   │ 36       │ Replaced │ ││
│  │  │ ...  │          │            │         │      │          │          │ ││
│  │  └──────┴──────────┴────────────┴─────────┴──────┴──────────┴──────────┘ ││
│  │                                                                          ││
│  │  [Compare Versions]    [View Version Content]                             ││
│  │                                                                          ││
│  │  Select a version to roll back to:                                        ││
│  │  ┌──────────────────────────────────────────────────────────┐             ││
│  │  │  ○ v9  (38 tags, Aug 5)                                  │             ││
│  │  │  ○ v8  (36 tags, Jul 28)                                 │             ││
│  │  │  ○ v7  (36 tags, Jul 15)                                 │             ││
│  │  │                                    [Rollback to Selected]│             ││
│  │  └──────────────────────────────────────────────────────────┘             ││
│  └──────────────────────────────────────────────────────────────────────────┘│
│                                                                              │
└──────────────────────────────────────────────────────────────────────────────┘
```

**Regions:** Context header (page, language, environment, current live version). Deployment
timeline (chronological event list, newest first). Rollback selector (pick a previous version).
Compare and view content actions.

---

## S1. User & Role Management

Manage who has access and what they can do.

**Use Cases:**
- View all users and their assigned roles (UF-18)
- Assign or modify roles for a user
- Search and filter the user list by role
- View a user's last active date to assess account usage
- Navigate to a user's activity in the Activity Timeline

```
┌──────────────────────────────────────────────────────────────────────────────┐
│  Content    My Work    Coverage    Deployments    Settings            🔔     │
│                                                    ▔▔▔▔▔▔                    │
├──────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  Settings                                                                    │
│  ┌──────────────┬──────────────┬──────────────┬──────────────┐               │
│  │ Users & Roles│  Languages   │ Configuration│ Data Import  │               │
│  │    ▔▔▔▔▔▔    │              │              │              │               │
│  └──────────────┴──────────────┴──────────────┴──────────────┘               │
│                                                                              │
│  User & Role Management                                     [+ Assign Role]  │
│                                                                              │
│  Search users...       Role ▾                                                │
│                                                                              │
│  ┌───────────────┬──────────────────┬─────────────┬───────────┬────────────┐ │
│  │ Name          │ Email            │ Role(s)     │ Assigned  │ Last Active│ │
│  ├───────────────┼──────────────────┼─────────────┼───────────┼────────────┤ │
│  │ Sravan        │ sravan@mio.com   │ PM, ADMIN   │ Jul 2026  │ Today      │ │
│  │ Aisha K.      │ aisha@mio.com    │ LR          │ Jul 2026  │ Today      │ │
│  │ Priya R.      │ priya@mio.com    │ SR          │ Aug 2026  │ Yesterday  │ │
│  │ Ravi M.       │ ravi@mio.com     │ DEV         │ Jul 2026  │ Aug 12     │ │
│  │ Founder       │ founder@mio.com  │ FN          │ Jul 2026  │ Today      │ │
│  │ ...           │                  │             │           │            │ │
│  └───────────────┴──────────────────┴─────────────┴───────────┴────────────┘ │
│                                                                              │
│  Click user → Edit roles    ·    View activity ▸ (links to Activity Timeline)│
│                                                                              │
└──────────────────────────────────────────────────────────────────────────────┘
```

**Regions:** Settings sub-navigation (tabs across the area). User table with roles, assignment
date, last active. Role filter.

---

## S2. Language Management

Add, view, and deactivate languages.

**Use Cases:**
- View all supported languages, their status, direction, and current coverage (UF-17, UF-18)
- Add a new language, with preview of the impact (empty translation slots created) (UF-17)
- Deactivate a language while preserving existing translations and history
- Navigate to Coverage for a language to assess readiness

```
│  Settings                                                                    │
│  ┌──────────────┬──────────────┬──────────────┬──────────────┐               │
│  │ Users & Roles│  Languages   │ Configuration│ Data Import  │               │
│  │              │    ▔▔▔▔▔▔    │              │              │               │
│  └──────────────┴──────────────┴──────────────┴──────────────┘               │
│                                                                              │
│  Language Management                                       [+ Add Language]  │
│                                                                              │
│  ┌──────────────┬────────┬───────┬──────────┬────────────┬──────────────────┐│
│  │ Language     │ Code   │ Dir   │ Status   │ Added      │ Coverage         ││
│  ├──────────────┼────────┼───────┼──────────┼────────────┼──────────────────┤│
│  │ Arabic       │ ar     │ RTL   │ Active   │ Jul 2026   │ 92%              ││
│  │ Spanish      │ es     │ LTR   │ Active   │ Jul 2026   │ 78%              ││
│  │ Turkish      │ tr     │ LTR   │ Active   │ Jul 2026   │ 45%              ││
│  │ Bulgarian    │ bg     │ LTR   │ Active   │ Jul 2026   │ 88%              ││
│  │ Italian      │ it     │ LTR   │ Active   │ Jul 2026   │ 95%              ││
│  │ French (CA)  │ fr-CA  │ LTR   │ Active   │ Jul 2026   │ 91%              ││
│  │ German       │ de     │ LTR   │ Active   │ Jul 2026   │ 82%              ││
│  │ Portuguese   │ pt     │ LTR   │ Active   │ Aug 2026   │  0%              ││
│  │ Mandarin     │ zh     │ LTR   │ Inactive │ Jul 2026   │ 60% (frozen)     ││
│  └──────────────┴────────┴───────┴──────────┴────────────┴──────────────────┘│
│                                                                              │
│  Click language → [Deactivate] / View in Coverage ▸                          │
│                                                                              │

  Add Language confirmation:
  ┌──────────────────────────────────────────────────────────────────┐
  │  Add Language: Portuguese (pt)                                   │
  │                                                                  │
  │  This will create 4,218 empty translation slots                  │
  │  across 142 active pages.                                        │
  │                                                                  │
  │  [Confirm]   [Cancel]                                            │
  └──────────────────────────────────────────────────────────────────┘
```

**Regions:** Language table (name, code, direction, status, date, coverage %). Add action with
impact preview. Inactive languages are visually distinct.

---

## S3. System Configuration

Operational parameters.

**Use Cases:**
- View and edit the bulk approval confidence threshold (UF-18)
- View the configuration change log for audit purposes

```
│  Settings                                                                    │
│  ┌──────────────┬──────────────┬──────────────┬──────────────┐               │
│  │ Users & Roles│  Languages   │ Configuration│ Data Import  │               │
│  │              │              │    ▔▔▔▔▔▔    │              │               │
│  └──────────────┴──────────────┴──────────────┴──────────────┘               │
│                                                                              │
│  System Configuration                                                        │
│                                                                              │
│  ┌──────────────────────────────────────────────────────────────────────────┐│
│  │  Bulk Approval Confidence Threshold                                      ││
│  │                                                                          ││
│  │  Current value: 95%                                           [Edit]     ││
│  │                                                                          ││
│  │  Translations at or above this AI confidence score                       ││
│  │  are eligible for bulk approval by reviewers.                            ││
│  └──────────────────────────────────────────────────────────────────────────┘│
│                                                                              │
│  ┌─ CONFIGURATION CHANGE LOG ───────────────────────────────────────────────┐│
│  │                                                                          ││
│  │  ┌────────────┬──────────────────────────────────────┬──────────┐        ││
│  │  │ Date       │ Change                                │ By       │        ││
│  │  ├────────────┼──────────────────────────────────────┼──────────┤        ││
│  │  │ Aug 5      │ Threshold: 90% → 95%                 │ ADMIN    │        ││
│  │  │ Jul 15     │ Threshold: set to 90% (initial)       │ FN       │        ││
│  │  └────────────┴──────────────────────────────────────┴──────────┘        ││
│  └──────────────────────────────────────────────────────────────────────────┘│
│                                                                              │
```

**Regions:** Parameter card (current value, description, edit action). Change log (audit trail
for config changes).

---

## S4. Data Import

One-time migration interface. Becomes a reference after migration.

**Use Cases:**
- Pre-migration: Upload exported data and initiate the one-time import of existing UX copy (UF-02)
- Post-migration: View the completed migration record for audit reference (pages, tags, translations imported, validation status)

**State: Pre-migration**

```
│  Settings                                                                    │
│  ┌──────────────┬──────────────┬──────────────┬──────────────┐               │
│  │ Users & Roles│  Languages   │ Configuration│ Data Import  │               │
│  │              │              │              │    ▔▔▔▔▔▔    │               │
│  └──────────────┴──────────────┴──────────────┴──────────────┘               │
│                                                                              │
│  Data Import                                                                 │
│                                                                              │
│  ┌──────────────────────────────────────────────────────────────────────────┐│
│  │                                                                          ││
│  │  Initial Migration                                                       ││
│  │                                                                          ││
│  │  Import all existing UX copy from the current multilingual module        ││
│  │  into MioTranslate. This is a one-time operation.                        ││
│  │                                                                          ││
│  │  Prerequisites:                                                          ││
│  │  ☐ Exported data from current system                                     ││
│  │  ☐ Full backup snapshot taken                                            ││
│  │                                                                          ││
│  │  ┌──────────────────────────────────────────────────────┐                ││
│  │  │  Upload exported data file                    [Browse]│                ││
│  │  └──────────────────────────────────────────────────────┘                ││
│  │                                                                          ││
│  │  [Start Import]                                                          ││
│  │                                                                          ││
│  └──────────────────────────────────────────────────────────────────────────┘│
│                                                                              │
```

**State: Post-migration (reference)**

```
│  Data Import                                                                 │
│                                                                              │
│  ┌──────────────────────────────────────────────────────────────────────────┐│
│  │                                                                          ││
│  │  Migration Completed                                                     ││
│  │                                                                          ││
│  │  Date: July 20, 2026   ·   Initiated by: Founder                        ││
│  │  Status: ✓ Completed   ·   Duration: 4 min 12 sec                        ││
│  │                                                                          ││
│  │  ┌──────────────────────────────────────────────────┐                    ││
│  │  │  Pages imported:         142                      │                    ││
│  │  │  Tags imported:        4,218                      │                    ││
│  │  │  Translations imported:                           │                    ││
│  │  │    Arabic:     3,880  ·  Spanish:   3,290         │                    ││
│  │  │    Turkish:    1,898  ·  Bulgarian: 3,714         │                    ││
│  │  │    Italian:    4,007  ·  French:    3,836         │                    ││
│  │  │    German:     3,459                              │                    ││
│  │  │  Total translations: 24,084                       │                    ││
│  │  └──────────────────────────────────────────────────┘                    ││
│  │                                                                          ││
│  │  Validation: ✓ Zero discrepancies                                        ││
│  │  View full validation report ▸                                            ││
│  │                                                                          ││
│  └──────────────────────────────────────────────────────────────────────────┘│
│                                                                              │
```

---

## Cross-Cutting: Global Search

Accessible from the product shell. Results overlay the current page.

**Use Cases:**
- Find a specific tag by Tag ID (exact match) from anywhere in the product (UF-12, UF-13)
- Search for tags by English text content (UF-12)
- Search for pages by name or Page ID
- DEV: Look up a Tag ID to check its status or copy (UF-16)
- Navigate directly to Tag Detail or Page Detail from search results

```
┌──────────────────────────────────────────────────────────────────────────────┐
│  MioTranslate             🔍 walk-in customer                  User ▾ (SR)  │
├──────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌── SEARCH RESULTS ─── "walk-in customer" ──────────────────── 7 results ──┐│
│  │                                                                          ││
│  │  TAGS                                                                     ││
│  │  ┌──────────────┬───────────┬───────────────────────┬───────────────────┐ ││
│  │  │ Tag ID       │ Page      │ English               │ Status            │ ││
│  │  ├──────────────┼───────────┼───────────────────────┼───────────────────┤ ││
│  │  │ QUICK_3      │ Quick Sale│ "Walk-in Customer"    │ Eng: Approved     │ ││
│  │  │ CRM_WALK_1   │ CRM Home  │ "Walk-in Customers"   │ Eng: Approved     │ ││
│  │  │ CAL_WALK_5   │ Calendar  │ "Walk-in Appointment" │ Eng: Draft        │ ││
│  │  │ RPT_WALK_2   │ Reports   │ "Walk-in Report"      │ Eng: Approved     │ ││
│  │  └──────────────┴───────────┴───────────────────────┴───────────────────┘ ││
│  │                                                                          ││
│  │  PAGES                                                                    ││
│  │  ┌──────────────┬──────────┬──────────────────────────────┐              ││
│  │  │ Page Name    │ Module   │ Page ID                       │              ││
│  │  ├──────────────┼──────────┼──────────────────────────────┤              ││
│  │  │ Walk-in Mgmt │ CRM      │ WALKIN                        │              ││
│  │  └──────────────┴──────────┴──────────────────────────────┘              ││
│  │                                                                          ││
│  └──────────────────────────────────────────────────────────────────────────┘│
│                                                                              │
│  ┌──────────────────────────────────────────────────────────────────────────┐│
│  │                        [ Current page content ]                          ││
│  │                        [ visible behind results ]                        ││
│  └──────────────────────────────────────────────────────────────────────────┘│
│                                                                              │
└──────────────────────────────────────────────────────────────────────────────┘

  Click tag → Tag Detail (C3)
  Click page → Page Detail (C2)
  Results: exact Tag ID matches first, then English text matches, then pages
```

**Regions:** Inline search results grouped by type (Tags first, then Pages). Tag results show
enough context to identify the right tag without opening it (Tag ID, page, English text, status).
Results overlay the current context — user doesn't navigate away until they select a result.

---

## Cross-Cutting: Activity Timeline

Chronological feed of recent actions. Globally accessible.

**Use Cases:**
- View a chronological audit trail of all actions across MioTranslate (UF-14, UF-15)
- Filter activity by user, page, action type, or language to investigate specific events
- FN: Monitor overall product activity and team output
- Trace the history of a specific change — who did what, when, and to which tag/page
- Navigate from an activity entry to the relevant Tag Detail or Page Detail

```
  ┌─ ACTIVITY TIMELINE ──────────────────────────────────────────── ✕ Close ──┐
  │                                                                            │
  │  Filter: All users ▾    All pages ▾    All actions ▾    All languages ▾    │
  │                                                                            │
  │  ┌─ Today ────────────────────────────────────────────────────────────────┐│
  │  │                                                                        ││
  │  │  10:32  PM authored English for QUICK_42           Quick Sale          ││
  │  │  10:15  LR approved Arabic translation for INV_12  Invoice            ││
  │  │  10:08  LR approved Arabic translation for INV_13  Invoice            ││
  │  │  09:45  SR approved English for QUICK_7             Quick Sale         ││
  │  │  09:30  PM submitted English for review: QUICK_7    Quick Sale         ││
  │  │  09:12  SR published Quick Sale / Arabic → QA v11   Quick Sale         ││
  │  │                                                                        ││
  │  ├─ Yesterday ────────────────────────────────────────────────────────────┤│
  │  │                                                                        ││
  │  │  17:45  LR confirmed stale: QUICK_3 / Spanish      Quick Sale         ││
  │  │  16:30  PM edited English: CAL_22                   Calendar           ││
  │  │         "Rebook" → "Rebook Appointment"                                ││
  │  │         ⚠ 5 translations flagged stale                                 ││
  │  │  15:20  FN approved escalated: QUICK_9              Quick Sale         ││
  │  │  14:00  SR published Invoice / Arabic → Prod v10    Invoice            ││
  │  │  ...                                                                   ││
  │  │                                                                        ││
  │  └────────────────────────────────────────────────────────────────────────┘│
  │                                                                            │
  │  Load older activity ▸                                                     │
  │                                                                            │
  └────────────────────────────────────────────────────────────────────────────┘

  Click any entry → opens the relevant Tag Detail or Page Detail
  Shown here as a side panel / overlay — exact presentation is a UI decision
```

**Regions:** Filters (by user, page, action type, language). Chronological list grouped by day.
Each entry shows: time, who, action, what, context. Entries link to the relevant content page.

---

## Validation Summary

| IA Page | Wireframe | All flows supported |
|---|---|---|
| C1. Page List | ✓ | UF-01, UF-13, UF-14 |
| C2. Page Detail | ✓ | UF-01, 03, 04, 05, 06, 07, 08, 13, 16, 19 |
| C3. Tag Detail | ✓ | UF-03, 04, 06, 08, 09, 12, 13, 15 |
| W1. My Work | ✓ (LR, SR, FN, PM variants) | UF-03, 06, 07, 08, 09, 10 |
| V1. Coverage Dashboard | ✓ | UF-14, 17 |
| V2. Language Readiness | ✓ | UF-14, 17 |
| V3. Stale Overview | ✓ | UF-08, 14 |
| D1. Deployment Overview | ✓ | UF-10, 11, 12 |
| D2. Deployment History | ✓ | UF-10, 11, 15 |
| S1. Users & Roles | ✓ | UF-18 |
| S2. Languages | ✓ | UF-17, 18 |
| S3. Configuration | ✓ | UF-18 |
| S4. Data Import | ✓ (pre and post states) | UF-02 |
| Global Search | ✓ | UF-12, 13, 15 |
| Activity Timeline | ✓ | UF-14, 15 |

All 13 pages + 2 cross-cutting capabilities wireframed. All 19 user flows have a home.
