# MioTranslate — Language Services Integration Behavior Requirements

**Document Type:** Integration Behavior Contract  
**Audience:** Founder/Product, MioTranslate Engineering, Language Services Engineering, MioSalon Engineering Lead  
**Author:** Principal Integration Architect  
**Date:** August 2026  
**Status:** FINAL — READY TO SEND TO LANGUAGE SERVICES ENGINEERING  
**Replaces:** *MioTranslate — Language Services API Endpoint Requirements*

---

> **One question governs this document:**
>
> *"What behaviors must Language Services guarantee so MioTranslate can work correctly and MioSalon can never be disrupted?"*
>
> This document does **not** design endpoints, prescribe URL structures, dictate HTTP methods, recommend payload shapes, or specify Language Services' internal storage model. Every requirement is expressed as a **behavior**. Language Services engineering decides how to satisfy it.

---

## 1. The Integration in One Diagram

```
                       Publishes approved
                       translations
 ┌──────────────┐      (one page, one      ┌────────────────────┐
 │              │      language at a time)  │                    │
 │ MioTranslate │ ─────────────────────►   │ Language Services  │
 │              │                           │                    │
 └──────────────┘                           └────────┬───────────┘
                                                     │
                                            Serves translations
                                            (pageId + tagName +
                                             languageCode)
                                                     │
                                                     ▼
                                            ┌────────────────────┐
                                            │     MioSalon       │
                                            │  (end-user app)    │
                                            └────────────────────┘
```

### Who Owns What

| Responsibility | Owner |
|---|---|
| Source English content, translation workflow, approval, versioning, stale state, publishing decisions, audit, rollback decisions, **tag lifecycle** | **MioTranslate** |
| Receiving published content, storing multilingual values, exposing content to MioSalon | **Language Services** |
| Reading and displaying translations at runtime (no awareness of MioTranslate) | **MioSalon** |

MioSalon consumes Language Services **independently** of MioTranslate. A tag's value in Language Services is what salon teams see — until MioTranslate publishes a new value for it.

### Tag Lifecycle Ownership

Tag lifecycle is owned by MioTranslate. When a tag becomes **DEPRECATED** in MioTranslate:

- MioTranslate stops treating the tag as active.
- MioTranslate stops generating or reviewing new translations for it.
- MioTranslate excludes it from future publishing operations.
- MioTranslate does **not** request Language Services to delete the tag.
- Previously published values may remain stored in Language Services.

This is an intentional design decision, not a temporary limitation. Language Services does not need a tag deletion or removal capability for MioTranslate integration.

### Rollback and Tag Persistence

MioTranslate rollback works by re-publishing the historical approved content snapshot that MioTranslate owns. Tags that exist in Language Services but are absent from the rollback snapshot may remain stored. MioTranslate does not require Language Services to remove them. This is acceptable because MioTranslate's lifecycle and source-of-truth govern what is actively managed and published — rollback restores the managed content, and any residual tags from a later version remain inert unless MioSalon's codebase still references them.

### Content Schema (Shared, Stable, Unchanged)

```
domain → pageId → pageName → tags[] → tagName → values { languageCode → translatedString }
```

This is the existing schema used by `bulkImportPages` today. Nothing in this document changes it.

---

## 2. Central Integration Principle — MioSalon Protection

Every requirement below ultimately answers:

> *"Could this behavior break what MioSalon serves to users?"*

If a Language Services behavior could cause MioSalon to display missing content, corrupted content, wrong-language content, or content from the wrong environment — that behavior is a defect in the integration, regardless of whose system causes it.

---

## 3. Minimum Behavioral Contract

These are the **seven behaviors** Language Services must guarantee for v1. For each, the document classifies the current status as one of:

| Symbol | Meaning |
|---|---|
| ✅ | **Already works** — confirmed from existing API documentation |
| ❓ | **Confirmation required** — likely works but documentation is ambiguous |

---

### B-1. Content Upsert

**Behavior:** MioTranslate must be able to create or update the approved translation for a page + language without affecting unrelated content on that page.

**What this means concretely:**
- Sending a subset of tags for a page creates or updates only those tags.
- Tags not included in the request are preserved exactly.
- Sending updated text for an existing tag overwrites that tag's value for the supplied language.

**Why MioSalon cares:** If upsert destroyed unsupplied tags, publishing Arabic would delete every other language's content for that page.

**Status:** ✅ Already works

The existing `bulkImportPages` API confirms tag-level smart upsert (merge). Supplied tags are created or updated; unsupplied tags are preserved. This is documented and confirmed through API examples.

**No action required.**

---

### B-2. Language-Value Preservation

**Behavior:** When MioTranslate sends a tag with values for only one language (e.g., only `"arabic"`), all other languages' values for that same tag (e.g., `"eng"`, `"spanish"`, `"italian"`) must be preserved exactly — not deleted, not emptied, not modified.

**What this means concretely:**

```
BEFORE:
  tag "QUICK_1" → values: { "eng": "Quick Sale", "arabic": "بيع", "spanish": "Venta Rápida" }

MioTranslate sends:
  tag "QUICK_1" → values: { "arabic": "البيع السريع" }

REQUIRED result:
  tag "QUICK_1" → values: { "eng": "Quick Sale", "arabic": "البيع السريع", "spanish": "Venta Rápida" }
                                                   ↑ updated              ↑ preserved            ↑ preserved
```

| When this happens | Required outcome |
|---|---|
| Supplied language key exists | Value updated (overwritten with new text) |
| Unsupplied language keys exist | Values preserved exactly |
| New language key not previously stored | Created as a new entry |

**Why MioSalon cares:** MioTranslate publishes one language at a time. If Language Services replaces the entire `values` object instead of merging per-language, publishing Arabic would destroy English, Spanish, Italian, and German values. MioSalon users in those languages would see empty strings.

**Why there is no workaround:** Sending all languages in every request would require MioTranslate to first read back the current state of all languages from Language Services — an endpoint that does not exist, a dependency that should not be created, and a pattern that violates MioTranslate's publish-only integration model.

**Status:** ❓ Confirmation required — **blocks production**

The API documentation confirms tag-level merge ("merge the new tags with the existing tags, updating only the provided keys") but does not explicitly state whether `values` *within* a supplied tag are merged or replaced. The wording is ambiguous.

**Required action:** Language Services engineering confirms that updating one language within a tag's values does not affect other languages. If this is not the current behavior, it must be implemented before MioTranslate publishes to production.

---

### B-3. Environment Isolation

**Behavior:** DEV, QA, and PRODUCTION content must be completely isolated. Publishing to one environment must not affect content in any other environment.

**What this means concretely:**
- A tag may have different translation text in DEV vs. PRODUCTION (e.g., DEV has version 5, PRODUCTION still has version 3).
- Publishing Arabic to DEV does not alter the Arabic value in PRODUCTION.
- No automatic content promotion occurs between environments.

**Why MioSalon cares:** If environments are not isolated, a DEV publish could silently alter what production salon users see.

**How MioTranslate uses this:** MioTranslate stores per-environment endpoint URLs in its system configuration. The assumption is that each endpoint resolves to an independent content store:

```
DEV  → Language Services DEV endpoint
QA   → Language Services QA endpoint
PROD → Language Services PRODUCTION endpoint
```

**Status:** ❓ Confirmation required — **blocks production**

MioTranslate assumes separate endpoints mean separate content stores. This has not been explicitly confirmed.

**Required action:** Language Services confirms that the three environment endpoints serve independent content and that publishing to one has no effect on the others.

---

### B-4. Safe Repeated Submission

**Behavior:** Repeated submission of the same content must be safe and produce the same effective stored content as a single successful submission. No duplicate records, no data corruption, no unintended state changes.

The HTTP response on a repeated submission does not need to be byte-for-byte identical to the first — what matters is that the stored content in Language Services is the same regardless of how many times the same payload is submitted.

**Why MioTranslate needs this:** MioTranslate uses a 3-Phase Commit pattern where the HTTP call to Language Services occurs outside MioTranslate's database transaction. In timeout, crash, or rollback scenarios, MioTranslate will re-submit the same content:

| Scenario | What happens |
|---|---|
| Network timeout after Language Services processed the request | MioTranslate doesn't know it succeeded. User retries. Same content sent again. |
| MioTranslate crash between Phase 2 and Phase 3 | Language Services received the data, but MioTranslate has no record. Manual retry. Same content. |
| Rollback re-publishes historical content | Prior version's tags may already have these exact values in Language Services. Same content. |

**Why MioSalon cares:** If re-submission creates duplicates or corrupts state, MioSalon could serve garbled content.

**Status:** ❓ Confirmation required (likely already satisfied by upsert semantics)

The upsert model naturally handles this — re-upserting the same tag name + value is effectively a no-op update. But this should be explicitly confirmed.

**Required action:** Language Services confirms that submitting the same content multiple times results in the same stored state as a single successful submission.

---

### B-5. Unambiguous Publish Result

**Behavior:** MioTranslate must be able to determine from the API response whether its requested publish operation succeeded or failed for the target language.

**What MioTranslate checks:**

```
if target language status == "success" → Release SUCCESSFUL
if target language status == "failed"  → Release FAILED
if target language missing from response → Release FAILED
```

**Specific sub-behaviors:**
- The response must include per-language status for every language included in the request.
- The `language` value in the response must match the language code sent in the request (e.g., if `"arabic"` was sent, the response must say `"arabic"`, not `"ar"` or `"Arabic"`).
- A failure reason should be included when status is `"failed"`.

**Why MioSalon cares:** If MioTranslate cannot determine publish outcome, it cannot reliably record whether content reached Language Services. Stale or missing records lead to re-publishes, confusion, or — worse — false confidence that content is live when it is not.

**Status:** ❓ Partially confirmed — the per-language response structure (`processed`, `failed`, `details` array) is documented and confirmed. However, whether the `language` field in the response always preserves the exact language code string sent in the request has not been explicitly confirmed. This sub-behavior is material to MioTranslate's response parsing.

**Required action:** Language Services confirms response language code matches the request language code exactly.

---

### B-6. Language Compatibility

**Behavior:** MioTranslate and Language Services must share an agreed, exact language-code vocabulary. MioTranslate must know which language code strings Language Services accepts so it can construct valid payloads.

#### Required for v1 launch (P0)

| What MioTranslate needs | Why it matters |
|---|---|
| The exact list of language codes currently configured in Language Services | MioTranslate must map its internal ISO 639-1 codes to Language Services codes |
| The exact spelling and casing of each code (`"arabic"` vs `"Arabic"` vs `"ar"`) | A mismatch causes a silent publish failure for that language |
| An agreed mapping between MioTranslate codes and Language Services codes for the initial 8 languages | MioTranslate cannot construct valid payloads without this |

**MioTranslate's initial language set:**

| Language | MioTranslate Internal Code | Language Services Code (to be confirmed) |
|---|---|---|
| English | `en` | `eng` ? |
| Arabic | `ar` | `arabic` ? |
| Bulgarian | `bg` | ? |
| Italian | `it` | ? |
| French (Canada) | `fr-CA` | ? |
| Spanish | `es` | `spanish` ? |
| German | `de` | ? |
| Turkish | `tr` | ? |

#### Future operational coordination (not a v1 requirement)

MioTranslate will add languages over time. The process for adding a new language to Language Services (whether it requires a manual configuration change, an admin action, or whether Language Services accepts any language code without pre-configuration) should be documented as an operational procedure between the two teams. MioTranslate is **not** requesting a language-management API.

**Why MioSalon cares:** If MioTranslate sends a language code that Language Services doesn't recognize, that language fails silently (the publish reports failure for that language, but other languages succeed). MioSalon users in the failed language see no new content.

**Status:** ❓ Confirmation required — the initial 8-language mapping must be documented before MioTranslate can construct payloads

**Required action:**
1. Language Services provides the complete list of currently configured language codes with exact spelling and casing.
2. Both teams agree on the mapping from MioTranslate codes to Language Services codes for the initial 8 languages.

---

### B-7. Read Consistency During Publishing

MioTranslate has two hard requirements and one documentation request. MioTranslate does not prescribe a specific transaction or atomicity implementation — what matters is the observable behavior MioSalon experiences.

#### A. Availability (required)

**Behavior:** Existing MioSalon content must remain readable while a `bulkImportPages` write is being processed. A write operation must not block, lock, or degrade MioSalon reads.

**Why this matters:** MioTranslate publishes frequently to DEV (automatically on approval). If writes cause read interruptions, salon users or QA testers experience outages during routine operations.

#### B. Data Integrity (required)

**Behavior:** MioSalon must never receive corrupted, unusable, or partially written individual tag values as a result of a publish operation. For any given tag + language, MioSalon should see either the previous complete value or the new complete value — never a truncated, empty, or garbled string.

#### C. Visibility Ordering Across Tags (document, do not prescribe)

MioTranslate does **not** require whole-page atomic visibility (all tags flipping at once). What MioTranslate requires is A (uninterrupted reads) and B (no corrupted individual values). Whether a multi-tag publish becomes visible to MioSalon atomically or progressively (tag by tag) is an implementation detail that Language Services should document so both teams understand the observable behavior during a publish window.

**Status:** ❓ Confirmation required

**Required action:** Language Services describes the observable behavior MioSalon experiences during a `bulkImportPages` write:
- Does MioSalon continue serving existing content uninterrupted during a write? (Availability)
- Can MioSalon ever see a corrupted or partial individual tag value mid-write? (Data integrity)
- Do updated tags become visible to MioSalon all at once or progressively? (Visibility semantics)

---

## 4. What MioTranslate Is NOT Requesting

Language Services remains the downstream multilingual content store, not MioTranslate's translation intelligence or governance system. MioTranslate explicitly does **not** need Language Services to provide:

| Not requested | Why |
|---|---|
| Tag deletion or removal in Language Services | MioTranslate owns tag lifecycle. Deprecated tags are excluded from future publishing; previously published values may remain stored in Language Services. This is intentional — no deletion request is required. |
| Translation generation or AI translation | MioTranslate manages this independently via its AI Translation Service |
| Review or approval workflow | MioTranslate's internal workflow; never touches Language Services |
| Stale state management | MioTranslate owns staleness; stale translations continue to be served by Language Services (this is the intended behavior) |
| Versioning | MioTranslate owns version numbers; Language Services stores only the latest approved value |
| Audit trail or audit workflow | MioTranslate records all audit events in its own database |
| RBAC or user permissions | MioTranslate controls who can publish; Language Services receives the result |
| MioTranslate metadata (module, copy type, confidence, back-translation, reviewer info) | These are MioTranslate-internal governance concepts; they must not appear in Language Services |
| Content read-back endpoint | Not required for v1. MioTranslate's content snapshot records serve as the source of truth for what was sent. |
| Language administration API | MioTranslate needs to *know* which language codes work; it does not need to *manage* languages in Language Services via API |
| Domain administration API | MioTranslate assumes `"miosalon"` unless told otherwise |

---

## 5. Existing API Assessment — `bulkImportPages`

The existing `bulkImportPages` endpoint already satisfies most of what MioTranslate needs. MioTranslate is **not** asking Language Services to build a new publishing API. The current integration path is:

```
MioTranslate → existing bulkImportPages → Language Services → MioSalon
```

This remains the integration path unless Language Services identifies that an existing behavior does not satisfy one of the behavioral requirements above.

### Already Confirmed (no action needed)

| Capability | Evidence |
|---|---|
| Single page scope per request | API doc: one `pageId` per request |
| Multi-language aggregation per tag | API doc: multiple language codes in `values` |
| Tag-level smart upsert (merge) | API doc: "merge the new tags with the existing tags, updating only the provided keys" + Example 5 |
| Sparse/asymmetric translations | API doc: Example 4 — different tags have different language sets |
| Incremental update (partial tag set) | API doc: Example 5 — only supplied tags are modified |
| Invalid domain → global rejection | API doc: error response shown |
| Invalid language → per-language failure only | API doc: partial failure response shown |
| Per-language response with status, reason, processed/failed counts | API doc: success and error responses shown |

### Confirmation Required (probably works, but ambiguous)

| Behavior | What the documentation says | What is ambiguous | Action |
|---|---|---|---|
| **Per-language value preservation within a tag** (B-2) | "merge the new tags…updating only the provided keys" | "Keys" could mean tag keys (tag-level merge) or language keys within values (value-level merge). The distinction is critical. | **Must confirm** |
| **Environment isolation** (B-3) | Not explicitly documented in the API doc | MioTranslate assumes separate endpoints = separate stores | **Must confirm** |
| **Idempotent re-submission** (B-4) | Upsert semantics imply this | Not explicitly stated | **Must confirm** |
| **Response language code matches request** (B-5) | Response examples show same codes | Not explicitly guaranteed | **Should confirm** |

---

## 6. Handoff Summary

### Core v1 Behaviors — Must Work Before Production Publishing

| # | Behavior | Why MioTranslate Needs It | Current Status | Required Action |
|---|---|---|---|---|
| **B-1** | Content upsert | Publish approved translations without destroying unrelated tags | ✅ Already works | None |
| **B-2** | Language-value preservation | Publishing one language must not delete other languages | ❓ Ambiguous in docs | **Confirm behavior** |
| **B-3** | Environment isolation | DEV publish must not alter PROD content | ❓ Assumed but unconfirmed | **Confirm isolation** |
| **B-4** | Safe repeated submission | Retries and rollbacks must not corrupt stored content | ❓ Likely works (upsert) | **Confirm safety** |
| **B-5** | Unambiguous publish result | MioTranslate must know if publish succeeded | ❓ Structure confirmed; response code matching unconfirmed | **Confirm response code matching** |
| **B-6** | Language-code compatibility | MioTranslate must construct valid payloads for initial 8 languages | ❓ Mapping not documented | **Provide language code list + mapping** |

### Behavior to Confirm — Required Understanding Before Production

| # | Behavior | Why It Matters | Required Action |
|---|---|---|---|
| **B-7** | Read availability, data integrity, and visibility semantics during publishing | MioSalon must not experience outages, corrupted values, or unexpected partial state during writes | **Describe observable behavior** |

### Coordination Items — Not API Requirements

| # | Item | When Needed |
|---|---|---|
| — | Process for adding future languages to Language Services | Before MioTranslate adds its 9th language |
| — | Environment endpoint URLs for DEV, QA, PRODUCTION | Before integration testing |
| — | Domain value confirmation (`"miosalon"`) per environment | Before payload construction |
| — | Maximum payload size / tag count per request | Before publishing largest pages (~450 tags) |

---

## 7. Language Services Team — Final Required Actions

### Confirm (before MioTranslate production publishing)

| # | Question | If YES | If NO |
|---|---|---|---|
| **C-1** | When a tag is supplied with only one language in `values`, are the other languages' existing values for that tag preserved? | ✅ Proceed | ❌ Must be fixed — blocks production |
| **C-2** | Are the three environment endpoints (DEV, QA, PROD) independent content stores with no cross-contamination? | ✅ Proceed | ❌ Must be separated — blocks production |
| **C-3** | Is re-submitting the exact same content safe? (No duplicates, no corruption, same stored state) | ✅ Proceed | ⚠️ Both teams must jointly redesign the retry strategy — MioTranslate will not introduce a read-before-retry dependency to compensate for unsafe writes |
| **C-4** | Does the `language` field in the response always match the language code string sent in the request? | ✅ Proceed | ⚠️ MioTranslate needs a mapping strategy |
| **C-5** | Is `"miosalon"` the correct domain value for all three environments? | ✅ Hardcode | ⚠️ MioTranslate will parameterize per environment |
| **C-6** | What does MioSalon experience during a `bulkImportPages` write? (availability, data integrity, visibility semantics — see B-7) | Document the observable behavior | ⚠️ Must understand before production scale |

### Provide (before integration begins)

| # | Item |
|---|---|
| **D-1** | Complete list of currently configured language codes with exact spelling and casing |
| **D-2** | Agreed mapping: MioTranslate ISO 639-1 codes → Language Services codes for the initial 8 languages |
| **D-3** | Environment endpoint URLs for DEV, QA, PRODUCTION |
| **D-4** | Maximum payload size / tag count per request (largest MioTranslate page has ~450 tags) |

### Coordinate (operational, not blocking v1)

| # | Item | When needed |
|---|---|---|
| **O-1** | Process for adding a new language to Language Services | Before MioTranslate adds its 9th language |

---

### What You Do NOT Need To Do

- Understand MioTranslate's internal workflows, approval process, or entity model.
- Add MioTranslate metadata to your content schema.
- Build translation, review, versioning, or audit capabilities.
- Build a language-management API for MioTranslate.
- Build a tag deletion or removal API — MioTranslate manages tag lifecycle and does not request deletion of deprecated content.
- Build a content read-back API — not required for v1.
- Change the existing `bulkImportPages` payload schema.

**B-2 (per-language value preservation) is the most critical behavioral confirmation because MioTranslate's publish-only model has no safe workaround if updating one language destroys other language values. B-3, B-4, B-5, and B-6 are also required integration prerequisites before production publishing.**

---

*End of MioTranslate — Language Services Integration Behavior Requirements*

*This document is derived from the locked MioTranslate architecture baseline (BRD, FRD, API List, API Design Groups 1–10, ED-01/02/03, DB-01–06, SYS-01, IMP-01, bulkImportPages API specification). No MioTranslate product decisions have been changed. No Language Services implementation details have been prescribed.*
