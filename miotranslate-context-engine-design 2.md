# MioTranslate — Context-Aware Translation Engine
## Design recommendation for v1

**Status:** proposal for build
**Scope:** the Translation Engine only (not MioTranslate workflows, not Language Services)
**Date:** 2026-08-27

---

## 0. TL;DR

The problem is **not** that the model lacks knowledge. It is that you are asking it the wrong question, in the wrong unit, and then grading it with a broken instrument.

Three changes solve most of it. None of them require new infrastructure.

| # | Move | What it replaces |
|---|------|------------------|
| **1** | **Translate a screen, not a string.** Send all sibling tags of a page in one request. | Per-string calls with authored context docs |
| **2** | **Make the model state the sense before it translates** — as a field in the same JSON response, not a second call. | A separate "semantic understanding" stage |
| **3** | **Stop using blind back-translation as the correctness test.** Verify against the declared sense, with context. Back-translation becomes a reading aid for humans, not a gate. | Back-translation as a quality signal |

Everything needed to do this **already exists in your schema** (`domain → page → pageName → tags → tagName → values`). No new context authoring. No RAG. No embeddings. No glossary. No translation memory. No second agent.

Computed cost: **~$0.00018 per string all-in** — roughly **10× cheaper** than the per-string + context-documents approach, because instructions and context are amortised across a screen instead of re-sent for every string (arithmetic in §8).

**Before you build any of it, run the 1-day diagnostic in §1.5.** There is a real chance that 30–60% of your reported defects are not translation defects at all.

---

# PART 1 — DIAGNOSIS

## 1.1 The stated problem, restated precisely

> Short UX copy + low context → ambiguous meaning → wrong translation.

This is true but incomplete, and the incompleteness is where the money is. Let me decompose the actual failure surface.

A translation goes wrong in one of five distinct ways. They have different causes and different fixes, and conflating them is why the initial design ballooned:

| # | Failure mode | Example | Real cause | Correct fix |
|---|---|---|---|---|
| **F1** | **Wrong sense selected** | "Female" → famine-adjacent word | Model had no way to know which sense | Context (siblings + tag ID) |
| **F2** | **Right sense, wrong part of speech** | "Save" translated as noun (*a saving*) instead of imperative button | Model doesn't know it's a button | UI element type — usually inferable from tag ID |
| **F3** | **Right meaning, wrong register/domain term** | "Service" → generic *help/assistance* instead of *salon treatment* | Domain terminology | Domain + page name; term lock for the top ~30 words |
| **F4** | **Structurally broken** | `{count}` dropped or renamed, string 4× too long for the button | Nothing to do with meaning | Deterministic validation, zero AI |
| **F5** | **Not actually broken** | Translation is correct; the *back-translation* made it look wrong | Broken review instrument | Fix the verifier, not the generator |

The initial thinking (big rules doc + domain doc + page doc + tag descriptions) is aimed almost entirely at F1 and F3, is very expensive per string, and does **nothing** for F2, F4, or F5.

## 1.2 Root cause #1 — the unit of work is wrong

You are translating **one tag at a time**. But a tag is not a natural semantic unit. The natural semantic unit of a user interface is **the screen**.

This single choice creates the context problem, and then forces you to solve it by hand:

```
Per-string translation
  → each string arrives naked
  → so you must supply context
  → context isn't in the request
  → so a human must author it
  → thousands of tags × authored context
  → unmaintainable
```

The entire manual-maintenance burden described in §3 of the brief is a **downstream consequence of the batching decision**, not an inherent property of the problem.

Flip the unit and the chain collapses:

```
Per-screen translation
  → every string arrives surrounded by its siblings
  → context is supplied by the other strings you were already going to translate
  → nobody authors anything
  → cost goes DOWN (shared instructions, shared context)
```

This is the whole insight. The context you need is not missing. **You are deleting it before you make the call.**

## 1.3 Root cause #2 — your verifier is dumber than your generator

This is the most important thing in this document and it is not in the brief.

The current pipeline does roughly this:

```
English + business context  → [AI] → Target        (context-rich)
Target alone                → [AI] → Back-English  (context-FREE)
compare English vs Back-English
```

Look at the asymmetry. You carefully give the generator context, then **strip all of it** and ask a second model to interpret a bare target-language word. Back-translation is therefore performed under *strictly worse* conditions than the translation it is auditing.

Consequences, both bad:

1. **False alarms.** The target word is often itself polysemous or a lower-frequency register word. Out of context, the back-translator picks that word's *most frequent standalone sense*, which may be unrelated to the UI meaning. The translation was right; the audit invented a defect. Reviewers then "fix" correct strings — actively degrading quality while feeling productive.
2. **False clears.** As the brief already notes (§15), a wrong translation can round-trip into fluent, plausible English. Back-translation misses real F1 errors.

So the instrument has both high false-positive and high false-negative rates. **A measurement you cannot trust is worse than no measurement**, because it consumes reviewer attention and misdirects engineering.

I strongly suspect the "Female → famine" report is this. Note the phrasing in the brief itself: *"→ back translation / interpretation → meaning is wrong."* The defect was **observed in the back-translation**, not in the product. It is entirely possible the target string was correct and shipping fine.

> **Do not build a bigger context system to fix a problem that may be a measurement artifact.** Measure first (§1.5).

## 1.4 Root cause #3 — ambiguity is a minority condition treated as a universal one

Of a typical salon/spa UI corpus, the large majority of strings are unambiguous in any reasonable context: "Appointment Date", "Customer Phone Number", "Enter a valid email address", "Total Amount". A minority — mostly 1–2 word strings — carry nearly all the ambiguity risk.

Designing a heavy pipeline (understanding stage + resolution + QA + reverse verification + drift detection) that runs on **every** string, to protect against a risk concentrated in a **small fraction** of strings, is the core over-engineering error in the earlier architectures.

The right shape is: **one cheap path for everything, one slightly stronger path for the risky minority**, where riskiness is detected almost for free.

## 1.5 Do this before writing any code (1 day, no build)

Take **100 real reported bad translations**. For each, have a native reviewer classify into exactly one bucket:

| Bucket | Meaning | Implied fix |
|---|---|---|
| **A** | Genuinely wrong sense in the app | Context (this design) |
| **B** | Right sense, wrong tone/register/term | Term locks + domain in prompt |
| **C** | Translation was actually fine — the back-translation misled us | Fix the verifier (§4.4). Nearly free. |
| **D** | Concept has no clean equivalent in target language | Human decision + term lock. No AI fix exists. |
| **E** | Placeholder / length / markup damage | Deterministic validation (§4.3). No AI needed. |

The distribution determines your build order and tells you what *not* to build.

My prediction, stated so you can hold me to it: **C and E together will be 30–60%.** Both are fixed this week, essentially free. If that's right, you'll have removed half the pain before touching the context system at all.

This costs one reviewer-day and can save weeks of building the wrong thing.

## 1.6 Assumptions I am rejecting

| Assumption in the brief | Verdict | Why |
|---|---|---|
| "We need better/more detailed context documents" | **Reject** | The context already exists as data. Authoring prose duplicates it and immediately goes stale. |
| "We need a semantic understanding *stage*" | **Partially reject** | The idea is right, a separate stage/call is wrong. Make it a *field* generated before the translation in one call (§4.2). |
| "Back-translation validates correctness" | **Reject** | It is a lower-context operation than the thing it audits. Demote to a human reading aid. |
| "A confidence score tells us reliability" | **Reject** | Self-reported scalar confidence from an LLM is not calibrated. Replace with a *cause* enum (§4.5). |
| "More context is better" | **Reject** | Irrelevant context dilutes attention and hurts consistency. Relevance beats volume. |
| "Bulk = one huge request with hundreds of strings" | **Reject** | Quality degrades and one failure poisons the batch. Screen-sized batches (~30) are the sweet spot. |
| "Retrieval implies embeddings/RAG" | **Reject** | Your retrieval key is *structural* (page ID, tag-ID prefix), not semantic. You have a direct index. Embeddings solve "find the needle in unstructured text" — you don't have that problem. |
| Ambiguity is the only problem | **Reject** | F2/F4/F5 are probably a bigger share of observed defects than F1. |

---

# PART 2 — THE RECOMMENDED SOLUTION

## 2.1 Name

**Sibling-context batch translation with an inline sense declaration.**

Three mechanisms. That is the entire engine.

## 2.2 Mechanism 1 — the screen is the unit

Translate all tags belonging to one `page` in a single request. Each string sees its neighbours.

Why this is not just "adding context":

- The sibling strings are **not extra payload** — they are the other items in the batch. You were going to send them anyway. Context is a **free by-product of batching**.
- It produces **intra-screen consistency** for free. "Cancel" on the same screen as "Cancel appointment" gets translated coherently because one model pass sees both.
- It is **cheaper** than per-string, because the instruction block is amortised over ~30 strings instead of repeated 30 times.

This is the rare change that improves accuracy, consistency, cost, and latency simultaneously — which is how you know it is addressing a real structural error rather than adding a feature.

## 2.3 Mechanism 2 — the tag ID is your free documentation

The brief lists "tag ID" as one context source among twenty. It deserves to be promoted to the top.

```
CUSTOMER_GENDER_FEMALE
```

That identifier already contains: the domain (`CUSTOMER`), the field (`GENDER`), and the value (`FEMALE`). A developer wrote it, for free, as part of normal work, and it stays accurate because the code depends on it. It is **self-maintaining documentation that already exists for every single string.**

Compare with the proposed `CUSTOMER_GENDER_FEMALE_DESCRIPTION.md`: a separate artifact, manually written, immediately stale, for thousands of tags.

`POS_BTN_CHARGE` tells you it is a **button** in **POS** → imperative verb, resolving F2 with zero extra input.
`INVOICE_STATUS_VOID` tells you it is a **status value** → adjective/noun, not a command.

**Pass the raw tag ID into the prompt verbatim.** Do not parse it, do not build an ontology from it. The model is extremely good at reading identifiers. This is one line of code and it is probably worth more than any context document you could write.

## 2.4 Mechanism 3 — declare the sense inside the same call

Ask for structured JSON where the `sense` field is generated **before** the `translation` field:

```json
{
  "tag": "CUSTOMER_GENDER_FEMALE",
  "sense": "Gender option for a customer record",
  "translation": "...",
  "resolved_by": "siblings",
  "risk": "low"
}
```

Because generation is autoregressive, tokens produced earlier condition everything after them. Writing the sense first makes the translation **causally dependent** on an explicit disambiguation step. This is the benefit people try to get from a separate "understanding" call — obtained here for roughly **10 output tokens and zero extra requests**.

Gemini's structured output preserves schema key order (and supports explicit `propertyOrdering`), so this ordering is enforceable, not hoped for. — [Gemini structured output docs](https://ai.google.dev/gemini-api/docs/structured-output)

Second benefit: `sense` is the single most useful thing you can show a human reviewer (§7). It converts review from *"is this word right?"* (requires the reviewer to reconstruct intent) to *"did the system understand what this is?"* (answerable in one second, in English, by a non-linguist).

**Answer to §12 of the brief: option C, hybrid — but the understanding step costs one field, not one stage.**

## 2.5 What this deliberately does NOT include

No knowledge graph. No ontology. No vector DB. No embeddings. No translation memory. No glossary authoring. No rule engine. No per-tag description files. No agent swarm. No separate microservice. No fine-tuning.

Each was considered and rejected in §9 with reasons.

---

# PART 3 — HOW IT WORKS END TO END

## 3.1 Pipeline

```
1. ASSEMBLE   (deterministic, no AI)
   Group requested tags by page. Build one job per page, chunked to ~30 tags.
   Attach: domain, pageName, sibling tags, term locks matched by substring.

2. PRE-VALIDATE (deterministic, no AI)
   Extract placeholders per string. Record expected set. Skip empty/numeric/pure-symbol strings.

3. TRANSLATE  (1 AI call per chunk)
   Structured JSON out: sense, translation, resolved_by, risk — in that order.

4. POST-VALIDATE (deterministic, no AI)
   Placeholder set equality. Length ratio. Untranslated-copy check. Schema/coverage check.

5. TRIAGE     (deterministic routing)
   clean → ready for review
   risk=high OR failed check OR model flagged → step 6
   
6. REPAIR/AUDIT (1 AI call per screen, only for flagged items)
   Batch all flagged strings of the screen into ONE audit call.

7. HAND OFF to MioTranslate review UI.
```

Steps 1, 2, 4, 5 are ordinary code. **Two AI calls per screen in the worst case, one in the common case.**

## 3.2 The request payload

Everything below is read directly from the existing content schema. Nothing is authored.

```json
{
  "target_language": "fr-FR",
  "domain": "Customer Management",
  "page": "CUSTOMER_PROFILE",
  "page_name": "Customer Profile",
  "term_locks": { "appointment": "rendez-vous", "walk-in": "sans rendez-vous" },
  "strings": [
    { "tag": "CUSTOMER_PROFILE_TITLE",   "text": "Customer Profile" },
    { "tag": "CUSTOMER_GENDER_LABEL",    "text": "Gender" },
    { "tag": "CUSTOMER_GENDER_MALE",     "text": "Male" },
    { "tag": "CUSTOMER_GENDER_FEMALE",   "text": "Female" },
    { "tag": "CUSTOMER_GENDER_OTHER",    "text": "Other" },
    { "tag": "CUSTOMER_BTN_SAVE",        "text": "Save" }
  ]
}
```

Note what is absent: no rules document, no domain essay, no page description, no per-tag description. The **structure is the context**.

## 3.3 The instruction block (stable, ~250 tokens, written once)

```
You are localizing the UI of MioSalon, salon & spa management software,
into {target_language}.

You will receive all strings from one screen together. They are siblings:
use them to disambiguate each other. A group like Male / Female / Other is a
gender field, not a description of a person.

Tag IDs are meaningful. Read them. Segments such as BTN, LBL, MSG, ERR,
STATUS, PLACEHOLDER, TITLE indicate the UI element type, which determines
grammar: BTN/ACTION => imperative verb. STATUS/LBL => noun or adjective.

For EACH string, in this exact order, output:
  sense       - 3-10 words of English describing what this means IN THIS APP
  translation - the {target_language} UI string
  resolved_by - siblings | tag_id | page | domain | unambiguous | guessed
  risk        - low | medium | high

Rules:
  - Preserve every {placeholder} exactly. Never translate or reorder them.
  - Match UI register: short, conventional platform wording.
  - Apply term_locks exactly where the concept appears.
  - Prefer the wording a native salon-software user expects over a literal
    rendering.
  - If you cannot determine the meaning, set risk=high and resolved_by=guessed.
    Do NOT invent confidence you do not have.
```

That is the complete prompt engineering. One block. Version it in git. It is not a "prompt stack".

## 3.4 `resolved_by` — the provenance field that earns its place

This one enum makes the system self-diagnosing, which is what keeps maintenance near zero.

- Aggregate it. If a page shows many `guessed`, **that page** needs help — not the whole corpus.
- It tells you empirically **which context sources actually pay** (the brief's §10 question). After one week of real data you will know whether siblings are carrying the load or whether the tag ID is doing the work. You stop guessing and start measuring.
- It is the trigger for the only human authoring the system ever asks for, and it asks **only where evidence shows it is needed** (§6.2).

This is how the system replaces "manually describe thousands of tags" with "occasionally describe the handful of screens that actually confused the model."

---

# PART 4 — VERIFICATION

## 4.1 Principle

Every check that can be deterministic **must** be deterministic. AI verification is reserved for semantic questions that code genuinely cannot answer, and is applied only to strings flagged as risky.

## 4.2 Layer 1 — deterministic (all strings, zero AI, sub-millisecond)

| Check | Rule | Action on fail |
|---|---|---|
| **Placeholder integrity** | Multiset of `{...}` / `%s` / `%1$s` in source == target | **Hard fail.** Never show to reviewer. Auto-retry once, then block. |
| **Length sanity** | Target/source char ratio outside language-specific band (e.g. 0.5–2.5; wider for de/fi, narrower for zh/ja) | Flag "check truncation" |
| **Untranslated** | Target identical to source, and source is not a proper noun/brand/symbol | Flag (legitimate for "SMS", "POS", "Email") |
| **Markup/entity** | HTML tags, `&nbsp;`, newlines preserved | Hard fail |
| **Leading/trailing space** | Preserved exactly | Auto-fix silently |
| **Coverage** | Every requested tag present exactly once in response | Re-request missing subset |

Answer to the brief's §20: **placeholder validation must be deterministic and must be a hard gate.** Never ask an LLM to check what a regex can prove. This single layer eliminates failure class F4 permanently.

## 4.3 Layer 2 — the risk gate (deterministic routing, zero AI)

Escalate to Layer 3 only if **any** of:

- `risk` = high, **or** `resolved_by` = guessed *(model's own signal — the cheapest and best predictor available)*
- Source is ≤ 2 words **and** on the known-ambiguous list *(the brief's own list: Charge, Current, Save, Open, Close, Active, Draft, Female, Staff, Service, Walk-in, Balance, Due, Return, Apply, Void, Cancel — ~40 entries, a flat file)*
- Any Layer-1 soft flag fired
- The string is high-blast-radius: irreversible or financial actions (Void, Refund, Delete, Charge)

Expected escalation rate: **10–20% of strings**. This is the adaptive processing the brief asks about in §18 — and the gate costs nothing because the model already told you where it struggled.

## 4.4 Layer 3 — the audit call (only flagged strings, batched per screen)

This replaces blind back-translation. Give the auditor **the same context the translator had**, plus the declared sense, and ask a directed question:

```
Screen: Customer Profile (Customer Management)
Target language: French

For each item: does the {target_language} string, as it would be read by a
salon receptionist ON THIS SCREEN, express the stated intended meaning?

1. tag: CUSTOMER_GENDER_FEMALE
   intended meaning: "Gender option for a customer record"
   target string: "Femme"
   
Return per item:
  verdict   - correct | wrong_sense | wrong_register | awkward | unsure
  reading   - how a native user would read this string in context (English)
  better    - improved string, or null
```

Why this is materially better than back-translation:

- It compares **target vs. intended meaning** — exactly what the brief asks for in §15 — rather than English vs. round-tripped English.
- It is context-symmetric: the auditor is not handicapped relative to the generator, so it stops generating false alarms on correct strings.
- `reading` gives the human reviewer the genuinely useful artifact — *how the string lands in context* — which is what people mistakenly hoped back-translation would provide.

**Back-translation is not deleted. It is demoted** from quality gate to optional reviewer reading aid, and when shown it must be produced *with* context and clearly labelled as an aid, not a verdict.

## 4.5 Replace the confidence score with a cause

A self-reported 0.0–1.0 float from an LLM is not calibrated probability. It looks precise and is not — exactly the "fake precision" the brief warns against in §14.

Show reviewers a **state with a cause**, which is actionable:

| State | Meaning | Reviewer action |
|---|---|---|
| **Verified** | Passed deterministic checks; not flagged, or audited `correct` | Skim and approve |
| **Needs attention — ambiguous source** | `resolved_by=guessed` | Confirm the intended meaning |
| **Needs attention — disputed** | Auditor disagreed; suggestion available | Choose between two options |
| **Blocked — placeholder mismatch** | Deterministic hard fail | Cannot approve until fixed |
| **Needs attention — may not fit** | Length ratio out of band | Visual check in the UI |

Every state names its cause and implies an action. That is what a confidence number never did.

---

# PART 5 — BULK TRANSLATION

## 5.1 Approach

**Screen-sized chunks of ~20–40 strings, run in parallel across screens.** Not one giant request, not per-string.

Rationale:
- Below ~10, context benefit and cost amortisation are both weak.
- Above ~50, instruction adherence degrades, output JSON gets truncated, and a single malformed response damages many strings.
- ~30 aligns with the natural screen boundary, which is also the semantic boundary. **The correct technical batch size and the correct semantic unit coincide** — a strong signal the design is aligned with the domain.

## 5.2 Concurrency and failure handling

- Parallelism 5–10 chunks; tune to your rate limit.
- **Chunk-level isolation.** One failed screen never blocks others. "Translate All" over 60 screens produces 60 independent outcomes.
- **Retry only what failed**, at the tag level. Missing/malformed items are re-requested as a small follow-up chunk, not by re-running the screen.
- Retry policy: 2 attempts with jittered backoff for transport/5xx/schema errors; on second failure mark those tags `needs_retry` and continue. Never fail the whole job.
- **Idempotency:** key each chunk by `(page, target_language, source_version_hash, engine_version)`. Re-running "Translate All" after a partial failure re-translates only what is missing or stale — critical, since staleness is already part of your product model.
- For very large migrations, use the **Batch API at 50% cost** (§8) since latency is irrelevant there.

---

# PART 6 — WHAT'S AUTOMATIC, WHAT'S HUMAN

## 6.1 Fully automatic (no human input, ever)

Context assembly · sibling grouping · tag-ID interpretation · sense inference · translation · all deterministic validation · risk triage · audit routing · retries · staleness detection.

**Adding a new screen with 40 new tags requires zero localization authoring.** This is the answer to the brief's §23 desired end state: the developer registers `CUSTOMER_GENDER_FEMALE / "Female" / Customer Profile` and the system infers "gender selection for a customer" from the tag ID and the siblings `Male`/`Other`. No `.md` file. Ever.

## 6.2 The one human input, and its strict budget

**Term locks.** A flat list of ~20–40 salon terms with approved translations per language:

```json
{ "appointment": "rendez-vous", "walk-in": "sans rendez-vous", "service": "prestation" }
```

Constraints that keep this from becoming the glossary the brief warns against:
- Capped at ~40 entries. If it wants to grow past that, the growth is a symptom — investigate the prompt instead.
- **Populated reactively, not upfront.** Ship with an empty list. Add a term only when a reviewer corrects the same word twice. Let real defects write it.
- It is a **consistency** device (same word everywhere), not a comprehension device. Comprehension is handled by context.

Optional, and only if `resolved_by` data proves it necessary: a **one-line page hint** for the handful of screens that keep producing `guessed`. Reactive, evidence-driven, and bounded to a few dozen lines total — not per-tag documentation.

## 6.3 Human review (unchanged — AI is not the authority in v1)

AI generation → AI/deterministic validation → **human review** → approval → publish. Reviewers approve, edit and approve, request retranslation, or reject, exactly as today.

The goal is not fewer reviewers. It is **changing what reviewers spend attention on** — from repairing basic semantic errors to confirming quality — and, just as importantly, no longer wasting their time on false alarms manufactured by context-free back-translation.

---

# PART 7 — WHAT THE REVIEWER SEES

Per string, in priority order:

1. **English source** + tag ID
2. **Target translation** (editable)
3. **Understood as:** *"Gender option for a customer record"* ← **the highest-value addition; put it directly under the translation**
4. **State + cause** (§4.5), not a number
5. **Screen context:** the sibling strings, so the reviewer sees `Male / Female / Other` together
6. Audit `reading` + suggested alternative, when Layer 3 ran
7. Placeholder/length check results, when relevant
8. Back-translation — **collapsed by default**, labelled "reading aid, not a correctness check"

Why #3 matters most: it turns review into a question a non-linguist can answer instantly. If "Understood as" is right, the translation is very likely right. If it is wrong, the reviewer knows *why* and can fix the cause rather than patching the symptom. It also makes the system **auditable** — the brief's requirement that a reviewer "see why the system produced the translation" is satisfied by a field that costs ~10 tokens.

---

# PART 8 — COST AND LATENCY

Grounded in current published Gemini pricing (Gemini 3.7 Flash standard tier: **$0.75 / 1M input, $3.75 / 1M output**; Batch API is 50% off; Flash-Lite is cheaper still). — [Gemini API pricing](https://ai.google.dev/gemini-api/docs/pricing)

### Per screen of 30 strings

| Item | Tokens | Cost |
|---|---|---|
| Instructions + schema | ~350 in | |
| 30 strings + tags + metadata | ~600 in | |
| Output (sense + translation + fields × 30) | ~900 out | |
| **Translate call** | 950 in / 900 out | **$0.00409** |
| **Audit call** (~5 flagged strings) | 300 in / 250 out | **$0.00116** |
| **Total per screen** | | **~$0.0053** |
| **Per string** | | **~$0.00018** |

### Comparison with the per-string + context-documents approach

Per string it would send instructions (~350) + rules doc (~800) + domain doc (~600) + page doc (~300) + tag desc (~100) ≈ 2,150 input, ~40 output:

**$0.00176 per string — about 10× more expensive** all-in (13× against the translate-only path), plus the unpriced human cost of authoring and maintaining those documents.

### Whole-application scale

**5,000 strings × 5 languages = 25,000 translations ≈ $4.40.** With the Batch API, ~$2.20.

The cost of this system is a **rounding error against one hour of reviewer time.** This has a strategic implication worth stating plainly:

> **Do not optimise this system for AI cost. Optimise it for reviewer attention.** A design that adds $2 of tokens to save 30 minutes of skilled review is overwhelmingly correct. This is precisely why per-string translation is the wrong default — it is *both* more expensive *and* less accurate, so there is no trade-off to weigh.

### Latency
- Single string (reviewer clicks retranslate): one call, ~1–2 s.
- One screen: ~2–4 s.
- Full app, parallelism 8: **5,000 strings ≈ 170 screens ≈ 1–2 minutes.**

---

# PART 9 — v1 ARCHITECTURE

## 9.1 Components (one deployable service)

```
TranslationEngine (a library/module inside MioTranslate — not a microservice)
├── ContextAssembler   deterministic  group by page, attach siblings + locks
├── PromptBuilder      deterministic  one versioned template
├── ModelClient        thin           translate() / audit(), JSON schema out
├── Validator          deterministic  placeholders, length, markup, coverage
├── RiskGate           deterministic  routing rules
└── BatchRunner        deterministic  chunking, concurrency, retries, idempotency
```

Six modules, one process. No new microservice — the brief's §24 boundary is about **responsibility**, not deployment topology, and a library respects it perfectly while being far simpler to run.

## 9.2 State

**Stored:** translation, sense, resolved_by, risk, validation results, audit verdict, state+cause, engine/prompt version, source version hash, plus your existing history/approval records.

**Generated dynamically, never stored:** the assembled context, the prompt, the back-translation.

The rule: **store outputs and decisions; regenerate inputs.** Storing assembled context would create a stale cache of something reconstructible in microseconds.

Why store `sense` and `resolved_by` even though they are model outputs? They are the **audit trail and the improvement telemetry** — they answer "why did the system say this?" and "where is it struggling?" Everything else regenerates.

## 9.3 Boundaries respected

MioTranslate owns workflow/approval/versioning/publishing · **Engine** owns context assembly, generation, validation · Provider generates language · Language Services stores and distributes · MioSalon consumes. The engine reads existing content-schema data; it does not extend that schema. Module and Copy Type stay MioTranslate metadata.

## 9.4 Build sequence

| Step | Work | Days |
|---|---|---|
| 0 | **Diagnostic on 100 defects (§1.5)** — decides everything below | 1 |
| 1 | Deterministic validators + placeholder hard gate | 2 |
| 2 | Context assembler + prompt + structured output | 3 |
| 3 | Batch runner: chunking, parallelism, retries, idempotency | 3 |
| 4 | Risk gate + audit call | 2 |
| 5 | Reviewer UI: sense, state+cause, siblings; collapse back-translation | 3 |
| 6 | Golden-set harness (§11) | 2 |

**~3 weeks for one or two engineers.** Steps 1 and 5 alone may resolve a large share of complaints; ship them first and re-measure before building 2–4.

---

# PART 10 — WHAT NOT TO BUILD IN v1

| Not building | Why | Reconsider when |
|---|---|---|
| Translation memory | Your corpus is small and screen batching already gives consistency. TM adds cache-invalidation complexity for little gain. | >20k strings **and** measured inconsistency |
| Large glossary | Term locks (~40) cover the real need. | Locks exceed ~100 entries organically |
| Embeddings / vector DB / RAG | Retrieval key is structural (page, tag prefix). You have a direct index; similarity search solves a problem you don't have. | Never, for this problem |
| Per-tag description files | Exactly the burden we are eliminating. | Never |
| Multi-agent pipelines | Two calls do the job; more agents multiply cost, latency, and failure modes. | Never, for this problem |
| Rule engine | Rules live as ~10 prompt lines. | Rules become conditional per language *and* measurably ignored |
| Separate understanding stage | It is a JSON field. | The field measurably fails to disambiguate |
| Confidence score as a number | Uncalibrated and misleading. | Never; use state+cause |
| Blind back-translation as a gate | Lower-context than the generator. | Never as a gate; fine as a labelled aid |
| Drift detection / learning loops | No baseline yet. Measure first. | After §11 has 3 months of data |
| Fine-tuning | Prompt + context is far from exhausted. | Only if a golden set proves a ceiling |
| Separate microservice | A library respects the boundary with less ops burden. | Independent scaling is genuinely needed |

---

# PART 11 — MEASURING WHETHER IT WORKED

Without this, you are guessing. This is the part teams skip and then argue about opinions for months.

## 11.1 The golden set (build once, ~1 day)

**300 strings**, deliberately stratified — not a random sample:
- 100 known-ambiguous short strings (the §2 list plus siblings)
- 100 ordinary labels/messages
- 50 with placeholders
- 50 heavy salon terminology

Have native reviewers produce approved reference translations **once**. This becomes your regression suite: re-run it on every prompt or model change. It is the only thing that lets you upgrade Gemini versions without fear — which is also the real, practical answer to provider abstraction (a regression suite, not an abstraction layer).

## 11.2 Primary metric

**Reviewer edit rate** — % of AI translations approved without modification.

It is the honest metric because it is what the humans actually do, it needs no extra labelling, and it directly tracks the goal ("reviewer verifies quality rather than fixing mistakes"). Segment it by short-string vs. long-string; the short-string edit rate is your true ambiguity KPI.

## 11.3 Supporting metrics

| Metric | Why | Target direction |
|---|---|---|
| Semantic error rate on golden set | Isolates F1, the stated problem | ↓ toward <2% |
| Placeholder defects reaching review | Should be structurally impossible | **0** |
| `resolved_by=guessed` rate | Where context genuinely fails | ↓; investigate top pages |
| Audit escalation rate | Gate calibration | 10–20%; if >30%, the prompt is weak |
| Post-publish defects reported | Ground truth | ↓ |
| Cost per 1k strings | Guard against creep | flat |

## 11.4 The one experiment worth running (half a day)

Take the 100 ambiguous golden strings and translate under four conditions:

| Condition | Tests |
|---|---|
| A | String alone (baseline) |
| B | String + page name + domain |
| C | String + tag ID + siblings |
| D | Everything + sense field |

This directly answers the brief's §10 and §11 questions — *which context sources actually pay* — with evidence instead of intuition. My prediction: **C captures most of the available gain, and the A→C jump is far larger than C→D.** If that holds, you can drop even more from the design. If it doesn't, you will know exactly which lever matters before committing to a build.

---

# PART 12 — WORKED EXAMPLES

## 12.1 "Female" (the stated case) — French

**Before:** input `"Female"` alone → model picks a standalone sense; the context-free back-translation then reads the target word out of context and reports something famine-adjacent → reviewer sees an alarming defect that may not exist in the product.

**After:**

```json
{ "page_name": "Customer Profile", "domain": "Customer Management",
  "strings": [
    {"tag":"CUSTOMER_GENDER_LABEL","text":"Gender"},
    {"tag":"CUSTOMER_GENDER_MALE","text":"Male"},
    {"tag":"CUSTOMER_GENDER_FEMALE","text":"Female"},
    {"tag":"CUSTOMER_GENDER_OTHER","text":"Other"}]}
```

```json
{ "tag":"CUSTOMER_GENDER_FEMALE",
  "sense":"Gender option for a customer record",
  "translation":"Femme",
  "resolved_by":"siblings",
  "risk":"low" }
```

**Why it cannot fail the same way:** the sense is fixed by three independent, automatic signals — the sibling set `Male/Female/Other`, the tag segment `GENDER`, and the label `Gender` on the same screen. The failure required the string to be alone; it is no longer alone. And because the model chose the *option-label* sense (`Femme`, not the adjective `Féminin`), it also got the register right — an F2 fix that came free.

Reviewer sees "Understood as: gender option for a customer record" and approves in one second.

## 12.2 "Charge" — POS — Spanish

Genuinely ambiguous in English: *to bill*, *a fee*, *to charge a battery*, *legal charge*.

```json
{"page_name":"Payment","domain":"POS",
 "strings":[{"tag":"POS_LBL_TOTAL","text":"Total"},
            {"tag":"POS_LBL_TIP","text":"Tip"},
            {"tag":"POS_BTN_CHARGE","text":"Charge"},
            {"tag":"POS_BTN_CANCEL","text":"Cancel"}]}
```

```json
{ "tag":"POS_BTN_CHARGE",
  "sense":"Button to take payment from the customer",
  "translation":"Cobrar",
  "resolved_by":"tag_id",
  "risk":"low" }
```

Two disambiguations happen at once: `BTN` forces the **imperative verb** (F2), and the POS/Total/Tip neighbourhood forces the **billing** sense (F1). A per-string call would plausibly have produced the noun *"Cargo"* — which in Spanish also means *a job position*, a doubly wrong result on a payment button.

## 12.3 "Void" — Invoice — German — *this one escalates*

```json
{ "tag":"INVOICE_BTN_VOID",
  "sense":"Action to cancel and invalidate an already-issued invoice",
  "translation":"Stornieren",
  "resolved_by":"tag_id",
  "risk":"high" }
```

`risk=high` (financial, irreversible, and *void* vs *cancel* vs *refund* are distinct accounting operations) → Layer 3 audit fires:

```json
{ "verdict":"correct",
  "reading":"Cancel/void the invoice — standard German accounting term",
  "better":null }
```

State: **Verified**. Note the audit was asked "does *Stornieren* express *cancel and invalidate an issued invoice* on an Invoice screen?" — a question with a real answer — rather than blind round-tripping. Had the screen also contained `Refund` and `Cancel`, sibling context would additionally have pushed the three toward distinct, non-overlapping German terms.

## 12.4 "Open" — Appointments — Japanese — *this one is genuinely under-determined*

```json
{ "tag":"APPT_STATUS_OPEN",
  "sense":"Appointment slot status - either unbooked, or salon business hours",
  "translation":"空き",
  "resolved_by":"guessed",
  "risk":"high" }
```

The model **correctly refuses to be confident** — `STATUS` narrows grammar but not meaning, and no sibling resolves whether this is *slot availability* or *business hours*.

This is the designed behaviour for the brief's §13 question, "what happens when context is insufficient": the system does **not** fabricate certainty. It surfaces a specific, answerable question to the reviewer, who confirms in seconds. If `APPT_STATUS_OPEN` keeps returning `guessed`, that is the evidence-driven trigger for the one-line page hint (§6.2) — context authored **only** where data proved it was needed, which is the difference between this design and the maintenance burden it replaces.

---

# PART 13 — DIRECT ANSWERS

| # | Question | Answer |
|---|---|---|
| 1 | What causes bad translations? | Per-string batching discards available context; plus a context-free back-translation that manufactures false defects |
| 2 | What is the AI missing? | Sibling strings, the tag ID, and the UI element type — all already in your data |
| 3 | Minimum context? | Sibling strings on the screen + tag ID + page name + domain + ~40 term locks |
| 4 | Where does it come from? | Directly from `domain → page → pageName → tags`. Nothing authored. |
| 5 | Separate understanding stage? | No — a `sense` **field** emitted before the translation in the same call |
| 6 | How to construct input? | One screen-scoped JSON request, ~30 strings, one stable instruction block |
| 7 | How to verify? | Deterministic first (placeholders, length, markup, coverage); AI audit against *intended meaning* only for flagged strings |
| 8 | When stronger verification? | risk=high / guessed / short+ambiguous-list / soft flag / financial-irreversible action |
| 9 | Bulk? | ~30-string screen chunks, parallel across screens, chunk isolation, tag-level retry, idempotent re-runs |
| 10 | Cheap and simple? | Context is a by-product of batching, so accuracy and cost improve together. ~$0.00018/string. Six modules, one service. |
| 11 | Deterministic vs AI? | Deterministic: placeholders, length, markup, coverage, chunking, routing, retries. AI: sense, translation, semantic audit. |
| 12 | Stored vs generated? | Store translation, sense, resolved_by, risk, validation, versions. Regenerate context, prompt, back-translation. |
| 13 | Insufficient context? | Model emits `guessed` + `risk=high`; reviewer answers a specific question; repeat offenders earn a one-line page hint |
| 14 | Suspicious translation? | Hard-fail placeholder breaks (never shown); semantic doubts get one batched audit call with a suggested alternative |
| 15 | Reviewer sees? | Source, translation, **"Understood as"**, state+cause, sibling context, audit reading; back-translation collapsed and labelled |
| 16 | Minimum architecture? | Assembler, PromptBuilder, ModelClient, Validator, RiskGate, BatchRunner — one library |
| 17 | Not in v1? | TM, glossary, embeddings/RAG, per-tag docs, multi-agent, rule engine, numeric confidence, blind back-translation gate, drift detection, fine-tuning, microservices |
| 18 | How to measure? | Reviewer edit rate (primary) + 300-string golden set + zero placeholder defects + `guessed` rate; plus the §11.4 ablation |

---

## Closing judgement

The instinct that produced the original design — *"the model lacks context, so we must supply it"* — was correct. The error was in the next step: assuming context must be **authored** rather than **assembled**.

Your application already emits context continuously and for free, in the form of screen structure and developer-written identifiers. The engine's job is to stop throwing that away.

Three changes: **batch by screen, pass the tag ID, declare the sense before translating.** Plus one correction that may matter more than all three: **stop trusting a context-free back-translation to grade a context-rich translation.**

Run the §1.5 diagnostic first. There is a real possibility that a meaningful share of your reported problem disappears the moment you fix the measurement instrument — and that is the cheapest quality win available to you.
