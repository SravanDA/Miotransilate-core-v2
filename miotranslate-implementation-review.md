# MioTranslate Translation Engine — Implementation Review

**Reviewed against:** the v1 design intent (context-aware, deterministic-first, low-maintenance)
**Date:** 2026-09-01
**Verdict:** the skeleton is right; the nervous system is disconnected in several places.

---

## 0. Executive verdict

You built the right *shape*. Screen-scoped chunking, deterministic-first validation, model-output structural validation, and a completeness reconciliation loop are all present and several are implemented with real craft.

But there is a recurring pattern that shows up **five separate times**, and it is the single most important thing in this review:

> **The engine computes high-quality signals and then throws them away before anyone can use them.**

- `RiskGate.triage()` runs, returns a `TriageResult`, and the variable is **never read again**.
- `sense` and `resolved_by` are requested, validated against an enum, and **never persisted**.
- The model's actual `risk` value is available and is **replaced with a hardcoded `0.90`** confidence.
- The backend returns `remainingTagIds`, and the frontend **discards it** while reporting `COMPLETE`.
- Blocked tags are removed from `remaining`, **skipped at save**, and counted toward `COMPLETE`.

Every one of these is a few lines to fix. Together they mean the system currently delivers **roughly the quality of a plain batch translate call**, while carrying the cost and complexity of a context engine. The good news: the expensive part (the pipeline) is built. The cheap part (wiring the outputs through) is missing.

Second structural issue: **you have two divergent engines**, and the fallback one is materially worse and writes to a different datastore.

Below: what's good (specific), then P0 → P2, then the fix order.

---

## 1. What is genuinely good

I want to be specific here, because these are real engineering decisions that most teams get wrong.

### 1.1 Deterministic-first validation is correctly built

`Validator.postValidate` does hard-fail on placeholder mismatch and markup mismatch, with `continue` so a hard failure short-circuits the remaining checks. That ordering is correct and often botched.

**Multiset comparison** (`compareMultisets`) rather than set comparison is the detail that impresses me. `"{count} of {count}"` → `"{count}"` is a real defect that set-based comparison silently passes. Someone thought about this.

### 1.2 Pre-validation extracts expectations *before* the AI call

`preValidate` computes expected placeholders per tag before generation, rather than re-deriving them from the source at compare time. That's the right sequencing and makes the post-check authoritative.

### 1.3 `validateModelOutput` is the check most teams skip

Hallucinated-tag rejection, duplicate detection, non-empty `sense`/`translation`, and **enum validation on `resolved_by` and `risk`** is exactly the structural completeness gate the design called for. Rejecting a tag not in the requested set prevents the nastiest LLM batch failure mode (silent tag invention/renaming).

### 1.4 The reconciliation loop retries at tag level, not chunk level

`BatchRunner` Phase B rebuilds a follow-up chunk containing **only the still-missing tags**. This is correct and non-obvious — the naive implementation re-runs the whole chunk and re-pays for 29 successful strings to recover 1.

### 1.5 Skip list for empty / punctuation-only strings

`text.matches("^[0-9\\p{Punct}]+$")` → skip. Free token savings and avoids nonsense translations of `"—"` and `"%"`.

### 1.6 Untranslated allowlist

`{"SMS", "POS", "Email", "WhatsApp", "MioSalon", "OK", "ID"}` — pragmatic, correct, avoids the classic false positive where a correct passthrough is flagged as a failure.

### 1.7 Frontend telemetry service

The trace lifecycle (`startCall` / `completeCall` / `failCall`), rolling session metrics, tokens-per-second, and the `estimateTokens` fallback when `usageMetadata` is absent — this is better instrumentation than most production LLM systems have. It is also, ironically, on the wrong tier (see §4.6).

### 1.8 Correct handling of thinking parts

`parts.filter(p => p.text && !p.thought)` — many implementations concatenate thought content into the payload and then fail to parse. You got this right.

### 1.9 Version history + audit trail

`translation_versions` with `sourceEnglishVersion`, `creationMethod`, `authoredBySource`, plus `auditService.record(...)` gives you a real provenance chain. The staleness model is properly grounded because you store which English version produced each translation.

### 1.10 Batched store write

Single `localStorage` read, single write, single `emit()` for N updates. Correct instinct — avoids N re-renders.

---

## 2. P0 — Fix before this goes anywhere near production

### P0-1 · Your Gemini API key is shipped to every browser

```
VITE_GEMINI_API_KEY  →  import.meta.env.VITE_GEMINI_API_KEY
```

Per [Vite's documentation](https://vite.dev/guide/env-and-mode), **variables prefixed with `VITE_` are embedded into the client bundle at build time**. This key is extractable from your JS assets by anyone who loads the app. It is not obscured, it is not scoped, and it is billable to you.

This is an unmetered, unauthenticated proxy to your Google billing account. A scraper that finds it can burn your quota, and because the model cascade escalates to Pro models (P2-4), the damage rate is higher than flash pricing suggests.

**Fix:** remove `VITE_GEMINI_API_KEY` entirely. The key belongs only on the Spring server. Rotate the current key — assume it is compromised if the app has ever been deployed. The user-supplied `localStorage` key (LLM Inspector) is acceptable to keep, because that is the user's own key, knowingly entered — but gate it clearly as a dev/BYO-key affordance.

### P0-2 · `@Transactional` on `saveEngineResult` is silently doing nothing

```java
// TranslationService
public Map<String,Object> generateAiTranslationsBulk(...) {
    ...
    saveEngineResult(result, languageCode, userId);   // ← self-invocation
}

@Transactional(isolation = Isolation.READ_COMMITTED)
protected void saveEngineResult(...) { ... }          // ← protected
```

Two independent proxy-defeating mistakes stacked:

1. **Self-invocation** — the call goes through `this`, not the Spring proxy, so the interceptor never runs.
2. **`protected` visibility** — Spring's proxy-based transaction support applies to public methods; annotations on protected methods are not honoured in proxy mode.

Spring's own docs warn this fails *silently*: ["your transaction annotations may be silently ignored… your code might appear to work until you test a rollback scenario."](https://docs.spring.io/spring-framework/reference/data-access/transaction/declarative/annotations.html)

Concrete consequences right now:

- `findByIdForUpdate` (`SELECT … FOR UPDATE`) runs in **auto-commit**. The row lock is taken and released by that single statement, so it provides **no protection at all** for the read-modify-write that follows. Your pessimistic lock is decorative.
- `versionRepository.save(draft)` and `translationRepository.save(translation)` are **two separate transactions**. A crash or constraint error between them leaves the head row disagreeing with the version table.
- The `etagVersion` bump is not atomic with the version insert, so concurrent writers can interleave and lose an increment.

**Fix:** move `saveEngineResult` into a separate `@Service` (e.g. `TranslationPersistenceService`) and inject it, so the call crosses a proxy boundary. Make it `public`. Keep the per-result transaction granularity — that part of the design is right, it just isn't in effect.

### P0-3 · Every translation is saved as `NEEDS_ATTENTION`

```java
.stateCause(isBlocked ? "blocked_placeholder" : "verified")   // never null
...
draft.setStatus(result.getStateCause() != null ? "NEEDS_ATTENTION" : "DRAFT");
```

`stateCause` is assigned on **every** path, so it is never null, so the ternary always takes the `NEEDS_ATTENTION` branch. And blocked results never reach this code (`if (result.isBlocked()) continue;`), so in practice **100% of persisted translations are `"verified"` → saved as `NEEDS_ATTENTION`**.

The entire point of triage is to let reviewers skim clean strings and focus on risky ones. Right now the attention queue is the full corpus — which is functionally identical to having no triage, and it trains reviewers to ignore the flag.

**Fix:** derive status from the triage outcome, not from null-ness:

```java
draft.setStatus(triage.isFlagged(tagId) ? "NEEDS_ATTENTION" : "DRAFT");
```

### P0-4 · `RiskGate` is dead code

```java
TriageResult triage = riskGate.triage(modelOutput.getValidResults(), outcome, config, chunk);
// `triage` is never referenced again
```

You built the five-signal escalation gate — self-reported high risk, `guessed`, short-ambiguous, soft flags, high blast radius — and then discarded the result. Nothing downstream consumes it. There is also **no Layer-3 audit call anywhere in the pipeline**, so even if triage were wired up, flagged strings have nowhere to go.

This means the ambiguity problem the whole system exists to solve currently has **no active mitigation** beyond the base prompt.

**Fix:** carry `triage` into `EngineResult` (drives P0-3's status), and add the audit call for flagged items only (§5).

### P0-5 · Frontend reports `COMPLETE` when the backend partially failed

```typescript
if (backendResult && backendResult.processed > 0) {
  return { status: "COMPLETE", total: backendResult.total,
           translated: backendResult.processed, needsAttention: 0 };
}
```

Three defects in five lines:

- `status` is **hardcoded** `"COMPLETE"`, ignoring the backend's own `status` field which may be `PARTIAL_SUCCESS` or `FAILED`.
- `needsAttention` is **hardcoded `0`**, so backend-flagged items are invisible in the UI.
- `remainingTagIds` — which the backend carefully computes and returns — is **silently dropped**.

Backend translates 5 of 71 tags → user sees "Complete". 66 tags are missing and nothing in the UI says so.

Worse: `processed === 0` is treated as failure and falls through to Tier 2. But `processed === 0` is also the legitimate result when **every tag is already translated**. So a fully-completed page triggers a full browser-side re-translation on every click.

**Fix:** propagate the backend's `status`, `remainingTagIds`, and flagged count verbatim. Distinguish "backend unavailable" (network error / 5xx / explicit `AI_NOT_CONFIGURED`) from "backend ran and had nothing to do". Only the former should fail over.

### P0-6 · Blocked tags vanish silently and still report `COMPLETE`

In `processChunk`:

```java
if (isBlocked) { blocked.add(res.getTag()); }
else          { completed.put(res.getTag(), er); }
remaining.remove(res.getTag());     // ← removed even when blocked
```

Then in `BatchRunner` Phase C:

```java
if (remainingTags.isEmpty()) status = "COMPLETE";   // blocked not considered
```

And in persistence:

```java
if (result.isBlocked()) continue;                   // never saved
```

So a tag that fails the placeholder hard gate is: removed from `remaining`, never retried, never written to the database, and **counted as a successful COMPLETE**. It just quietly does not exist. The user is told the page is fully translated.

This is the most dangerous bug in the system, because it is invisible — placeholder failures are exactly the strings that would break the UI at runtime.

**Fix:** blocked tags must either stay in `remaining` for a regeneration attempt, or be persisted with `variableIntegrityStatus = FAILED` and status `BLOCKED` so a human sees them. Status determination must account for `blocked.size()` — `COMPLETE` should require `remaining.isEmpty() && blocked.isEmpty()`.

### P0-7 · Re-running "Auto-Translate" downgrades APPROVED translations

The backend eligibility filter selects tags whose **English copy** is `APPROVED`. It does **not** check whether a target-language translation already exists or is approved.

Combined with P0-3 (`status` always `NEEDS_ATTENTION`):

```java
translation.setStatus(draft.getStatus());   // APPROVED → NEEDS_ATTENTION
```

One accidental double-click on a fully reviewed Arabic page reverts **every approved string** to `NEEDS_ATTENTION`, discards the review state, and bills you for the privilege. There is no guard and no confirmation.

Note the frontend Tier 2 *does* filter on `status !== "Approved"` — so the two tiers disagree about the fundamental question of what is eligible.

**Fix:** backend eligibility must skip tags whose translation is `APPROVED` and not `STALE`, unless an explicit `force` flag is passed. Never let an AI draft overwrite the head status of an approved row.

### P0-8 · `currentVersionNumber` is never updated

The schema defines `translations.currentVersionNumber`, and `saveEngineResult` writes a new `TranslationVersion` with `versionNumber = nextVersion` — but never sets `currentVersionNumber` on the head row. It only bumps `etagVersion`.

The head record therefore never points at the version it should. Anything that resolves "current text" via `currentVersionNumber` reads a stale or null pointer.

**Fix:** `translation.setCurrentVersionNumber(nextVersion);` in the same write.

---

## 3. P1 — Architectural problems that will compound

### P1-1 · Two engines that disagree about everything

This is the biggest *structural* problem in the implementation. You have two independent translation engines with different behaviour, and which one runs depends on server configuration at runtime.

| Dimension | Backend (Tier 1) | Frontend (Tier 2) |
|---|---|---|
| Chunk size | 30 | 25 |
| Prompt | JSON context object | English prose |
| Requests `sense` | Yes | **No** |
| Requests `resolved_by` | Yes | **No** |
| Requests `risk` | Yes | **No** |
| Requests numeric confidence | No | Yes (0–100) |
| Page/domain context | `pageName` + `module` | `"Page: {name}"` string only |
| Term locks | Yes | **No** |
| Placeholder hard gate | Yes (blocks) | **No** (advisory only) |
| Markup hard gate | Yes | **No** |
| Tag ID in prompt | Yes | **No** — sends `copyType` instead |
| Hallucinated-tag rejection | Yes | **No** — positional `index` |
| Retry / reconciliation | Yes | **No** |
| Eligibility rule | English APPROVED | target not Approved |
| Persistence | PostgreSQL + versions + audit | **localStorage** |

Tier 2 is not a fallback — it is a **different product** that writes to a different database. Consequences:

- **Silent quality cliff.** If the server key is unset, users get materially worse translations with no indication. Nothing in the UI says "degraded mode".
- **Split-brain data.** Tier 2 writes to `localStorage`. Those translations exist only in one person's browser, are invisible to reviewers, never enter the version history, never get audited, and are destroyed by a cache clear. A user could "translate" a whole page and have zero of it persist server-side.
- **Double maintenance.** Every prompt improvement, validator rule, and term lock must be implemented twice, in two languages. It will drift immediately — it already has.
- **Positional index fragility.** Tier 2 matches results by array `index`. If the model returns 24 items for a 25-item chunk, **every result after the gap is silently assigned to the wrong string.** Arabic text lands on the wrong tag with no error. The backend's tag-ID matching is immune to this; Tier 2 is wide open to it.

**Recommendation: delete Tier 2.** If the backend is unavailable, show "AI translation unavailable — contact your administrator" and stop.

This is the single highest-leverage simplification available to you. It removes ~40% of the surface area, eliminates the API key exposure (P0-1), kills the positional-index bug, and ends the drift. A fallback that produces unreviewable data in the wrong datastore is worse than a clear error message.

If you must keep a browser path for demos, make it explicitly non-persistent: render results in a preview panel, never write them into the store, and label them "preview only, not saved".

### P1-2 · `sense` and `resolved_by` are requested, validated, then thrown away

The backend asks for `sense` and `resolved_by`, and `validateModelOutput` enforces that `sense` is non-empty and `resolved_by` is a valid enum member. Then neither is written to the database. There is no column for either.

You are paying tokens for both fields and discarding the two most valuable outputs in the system:

- **`sense` is the reviewer's single most useful artifact.** "Understood as: gender option for a customer record" lets a non-linguist approve in one second. Without it, the reviewer must reconstruct intent from a bare string — the exact problem the engine was built to solve. You generate the answer and hide it.
- **`resolved_by` is your improvement telemetry.** Aggregated, it tells you which context sources actually pay and which pages keep confusing the model. It is the mechanism that lets context authoring stay reactive and bounded instead of growing to thousands of files. Discarded, the system cannot self-diagnose and you are back to guessing.

**Fix:** add `sense`, `resolved_by`, and `risk` columns to `translation_versions`. Surface `sense` in the review UI directly under the translation. Build one aggregate query over `resolved_by`. This is a migration plus a few field assignments, and it converts the system from "batch translator" to the design's intent.

### P1-3 · Hardcoded `0.90` confidence is actively misleading

```java
draft.setConfidenceScore(new BigDecimal("0.90"));
```

Every AI translation gets 0.90. Always. Regardless of the model's own `risk`, regardless of soft flags, regardless of whether `resolved_by` was `guessed`.

This is worse than storing nothing. A reviewer who sees "90% confidence" on a string the model explicitly flagged as `high` risk and `guessed` has been **actively misinformed by their tooling**. It is a fabricated number in the shape of a measurement — exactly the fake precision the design warned against.

**Fix:** drop the column from the AI path, or populate it from the actual signals. Prefer storing the `risk` enum and the triage cause. A reviewer needs *why*, not a decimal.

Note the frontend has the mirror-image problem: it stores a real model-reported confidence (0–100) and thresholds on `< 70`, but that number is self-reported and uncalibrated. Neither tier has a trustworthy confidence signal; the difference is that the backend's is fake and the frontend's is unreliable.

### P1-4 · `maxOutputTokens` is unset on the backend, and 8192 may be too low on the frontend

The backend `generationConfig` sets only `temperature` and `topP` — **no `maxOutputTokens`**. The frontend sets 8192.

This matters more than it looks, because `gemini-2.5-flash` has **thinking enabled by default, and thinking tokens are billed against `maxOutputTokens`**. This is a well-documented failure mode that produces [empty or truncated responses at typical token values](https://github.com/valentinfrlch/ha-llmvision/issues/609), and Google's docs note you can [set the thinking budget to 0 to suppress it](https://docs.cloud.google.com/gemini-enterprise-agent-platform/models/thinking).

Consequences:
- Backend: unbounded output, unpredictable latency and cost, and truncation risk that surfaces as a JSON parse failure → full chunk retry → 3× cost.
- Frontend: 30 tags × (translation + back-translation + sense) plus an invisible thinking budget can exceed 8192, truncating mid-array. Your parser will then either fail or — worse — regex-extract a **partial** array and silently drop the tail.

**Fix:** set an explicit `thinkingConfig: { thinkingBudget: 0 }` (translation of short UI strings does not benefit from extended reasoning), set `maxOutputTokens` explicitly on both paths, and **detect `finishReason === "MAX_TOKENS"`** rather than letting the parser paper over truncation.

### P1-5 · No structured output enforcement — you built a 5-strategy parser instead

The frontend has five layers of JSON recovery: fence stripping, direct parse, regex substring extraction, wrapped-key unwrapping, and field-name normalization that will accept `translated`, `translation`, `arabic`, `ar`, or *"the first string field that isn't English."*

That last fallback is genuinely risky — it can silently select `sense` or any other string field as the translation and write it to the database as the user-facing string.

The parser is well-engineered. It is also **treating a symptom**. Gemini supports `responseMimeType: "application/json"` with a `responseSchema`, which makes the model emit conforming JSON structurally — no fences, no wrapper keys, no field-name roulette. Per [Google's structured output docs](https://ai.google.dev/gemini-api/docs/structured-output) the API also preserves schema key ordering, which additionally lets you **guarantee `sense` is generated before `translation`** — the ordering that makes the sense field actually improve the translation rather than rationalize it after the fact.

**Fix:** add `responseSchema` on both paths. Then delete Strategies 3–5 and let a parse failure be a real, retryable error instead of a silent mis-mapping. Less code, more reliability.

### P1-6 · Back-translation is still the context-free instrument

Both tiers request a `back_translation` in the same call that produced the translation. The frontend then grades it with word overlap:

```typescript
const overlap = matches / engWords.size;   // > 50% → MATCHES_INTENT
```

Two problems.

**First, self-generated back-translation is near-worthless as a check.** The model that just chose an interpretation is asked to translate back within the same context window. It will faithfully round-trip its own reading — including a wrong one. This is why it produces false clears.

**Second, bag-of-words overlap is not a semantic check.** It has no notion of meaning, negation, or word order:
- `"Save"` → back `"Save"` → 100% overlap → passes, even if the target is the noun *savings* on a button.
- `"Do not cancel"` → back `"Cancel"` → the negation is inverted, a catastrophic error, and overlap is high.
- Short strings dominate the corpus and are exactly where `engWords.size` is 1–2, making the ratio a coin flip. Note the filter drops words ≤ 2 chars, so `"Due"`, `"POS"`, `"Tip"` produce an empty set → `overlap` defaults to `1` → **automatic pass for the shortest, most ambiguous strings in the system.**

That last one is worth restating: the check is structurally guaranteed to pass on the exact population it was built to protect.

**Fix:** stop treating back-translation as a gate. Keep it as a labelled reviewer reading aid. Replace the check with a targeted audit call on *flagged strings only* (§5), asking whether the target expresses the declared `sense` — a directed question with a real answer.

### P1-7 · `maxParallelism = 1` makes bulk translation serial

`EngineConfig` defaults to `maxParallelism = 1`, so the fixed thread pool executes one chunk at a time. You built the executor, futures, and `ConcurrentHashMap` machinery for parallelism you are not using.

A 300-tag page = 10 chunks × ~3–5 s = **30–50 s of serial wall time**, inside a synchronous HTTP request. Add the 3-attempt retry with 1 s backoff and a bad run can approach or exceed typical gateway timeouts. The user watches a spinner with no progress feedback.

**Fix:** raise to 4–8 (tune to your Gemini rate limit) — the concurrency-safe structures are already in place. Separately, make bulk translation **asynchronous**: return a job ID immediately, process in the background, and let the UI poll. A multi-minute synchronous POST is fragile regardless of parallelism.

### P1-8 · Retry treats all failures identically

```java
catch (Exception e) {
  if (attempt > config.getMaxRetries()) return;
  Thread.sleep(config.getBackoffBaseMs());   // flat 1000ms
}
```

- **Fixed backoff, no jitter.** Concurrent chunks hitting a 429 retry in lockstep and re-collide.
- **No error classification.** A malformed API key (401) or invalid request (400) is retried 3 times with sleeps, guaranteed to fail identically, wasting ~3 s per chunk. Meanwhile a 429 deserves a *longer* wait than 1 s, ideally honouring `Retry-After`.
- **`Thread.sleep` inside the pool thread** blocks a worker; once parallelism is raised this throttles throughput.
- **`return` on exhaustion** leaves tags in `remaining` with no recorded reason — the reconciliation loop retries blindly without knowing why it failed.

**Fix:** classify errors — retry 429/5xx/timeouts with exponential backoff + jitter; fail fast on 400/401/403. Record a failure cause per chunk.

### P1-9 · Model cascade escalates to expensive models silently

```
gemini-2.5-flash → gemini-3.6-flash → gemini-3.1-pro-preview → gemini-2.5-pro
```

On 429 or 404 the cascade advances. Two issues:

- **Cost.** Per [current Gemini pricing](https://ai.google.dev/gemini-api/docs/pricing), Pro-tier input/output is several times Flash. A sustained rate-limit episode silently migrates your entire workload onto the most expensive model in the list. There is no cost ceiling and no alert.
- **Quality inconsistency.** Different models produce different terminology and register. A single page can end up translated by three different models, so "Appointment" renders differently across chunks — undermining the intra-screen consistency that screen-batching exists to provide.

Also, **404 should not trigger a silent cascade**. A 404 means a misconfigured model name — a config bug you want surfaced loudly, not routed around.

**Fix:** cascade only within the same tier and capability class (flash → flash). Treat 404 as a hard config error. Log every cascade event and record which model produced each translation (you already have `modelUsed` on the frontend — persist it server-side too).

### P1-10 · Term locks are matched as a flat map with no morphology

```json
"termLocks": { "Appointment": "موعد", "MioSalon": "MioSalon" }
```

Passed into the prompt as a raw map. Nothing enforces application, and nothing handles `"Appointments"`, `"appointment"`, or `"Re-appointment"`. There is no post-check that a locked term actually appears in the output.

This is acceptable for v1 — prompt-level guidance genuinely does most of the work, and I would *not* build a morphology engine. But be aware the locks are advisory. If a term matters (legal/financial), add a cheap post-check: if the source contains a locked term and the target does not contain its lock, add a soft flag. That is a `contains` check, not an NLP problem.

### P1-11 · `tagRepository.findAll()` loads every tag in the database

```java
List<Tag> allTags = tagRepository.findAll().stream()
    .filter(t -> pageId.equals(t.getPageId()))
```

Full table scan into memory, filtered in Java, on every translate request. Then `englishCopyRepository.findById()` **once per tag** — a classic N+1.

At a few thousand tags this is merely wasteful. It will become the bottleneck well before the AI calls do.

**Fix:** `findByPageIdAndStatusNot(pageId, "DEPRECATED")` and a single batched `findAllById(tagIds)` for English copy. Straightforward, and removes a scaling cliff.

---

## 4. P2 — Worth fixing, not urgent

**P2-1 · `topP: 0.8` is not "deterministic sampling."** The spec comments call it that; it is nucleus sampling with a restricted candidate set. With `temperature: 0.1` you are already near-greedy. Harmless, but the comment misleads whoever tunes it next. For maximum reproducibility use `temperature: 0` and leave `topP` at default.

**P2-2 · `estimateTokens` uses `length / 3.8` but the comment says "~4 chars per token".** Minor, but the heuristic is badly wrong for Arabic, Japanese, Chinese, and Korean — the languages you actually target. Non-Latin scripts tokenize far less efficiently. Your session cost metrics will understate real usage, sometimes by 2–3×. Prefer `usageMetadata` and treat the estimate as a last resort clearly labelled "approximate".

**P2-3 · Language map is incomplete relative to supported languages.** `LANGUAGE_MAP` covers 13 codes and falls back to the raw code. `"Translate to fr-CA"` degrades to the model interpreting a raw locale string. The `isCanadianFrench` check uses `startsWith("fr")` — so metropolitan French `fr` would also receive Québec terminology instructions. Probably not intended.

**P2-4 · No cost or volume guardrail.** Nothing caps how many strings a single click can translate, and nothing tracks spend server-side. A user clicking "Translate All" across 50 pages × 13 languages issues thousands of calls with no ceiling. Add a per-request tag cap and a daily budget check.

**P2-5 · The frontend `analyzeSemanticSense` quality report is computed but its fate is unclear.** It produces a genuinely good structured report (variable integrity, HTML preservation, length delta, sense check) — but only `confidence`, `stateCause`, and `backTranslation` are written into the store. If the report is not surfaced in the UI, it is another computed-then-discarded signal.

**P2-6 · No handling for `promptFeedback` / safety blocks.** If Gemini returns a safety block or an empty `candidates` array, the code path assumes `candidates[0].content.parts` exists. Salon content is unlikely to trip filters, but a malformed or blocked response will throw a `TypeError` deep in parsing rather than a clean, retryable error.

**P2-7 · Chunk sizes differ (30 vs 25) for no stated reason.** Unify. Any divergence between tiers should be deliberate and documented.

**P2-8 · `PARTIAL_SUCCESS` threshold of `< 10%` missing is arbitrary and generous.** On a 300-tag page, 29 missing tags reports as partial success. Combined with P0-5 (frontend hardcodes `COMPLETE`), users have no idea. Report exact counts rather than bucketing into a status string.

**P2-9 · No idempotency key on bulk translation.** Two rapid clicks issue two full translation runs, doubling cost and racing on writes. Key runs by `(pageId, language, englishVersionHash)` and de-duplicate in-flight jobs.

---

## 5. The one thing that is missing entirely: the audit step

There is no Layer-3 verification anywhere in either tier. The pipeline is:

```
generate → deterministic validate → (triage, discarded) → save as NEEDS_ATTENTION
```

The deterministic validators catch **structural** damage (placeholders, markup, length, untranslated) — these are well built and catch real bugs. But nothing catches **semantic** error, which is the problem the system was created to solve. Nothing re-examines "Female" to confirm it was read as a gender option rather than a scarcity adjective.

So the current defence against wrong-sense translation is: the prompt, and a bag-of-words back-translation check that automatically passes on short strings (P1-6).

**The minimum addition** — one call per screen, only for flagged strings:

```
Screen: Customer Insights (CRM). Target: Arabic.
For each item: does the Arabic string, as read by a salon receptionist on this
screen, express the stated intended meaning?

1. tag: cust.gender.female
   intended meaning: "Gender option for a customer record"
   target: "أنثى"

Return per item: verdict (correct|wrong_sense|wrong_register|awkward|unsure),
reading (how a native user reads it, in English), better (improved string|null).
```

With triage flagging ~10–20% of strings, this is roughly **one extra call per screen** — a marginal cost increase over the base translate call, and it targets exactly the failure class nothing currently addresses. `RiskGate` already computes the input; it just needs a consumer.

---

## 6. Recommended fix order

| # | Fix | Effort | Why this order |
|---|---|---|---|
| 1 | Remove `VITE_GEMINI_API_KEY`, rotate key | 1 h | Active credential exposure |
| 2 | Fix `@Transactional` (separate service, public) | 2 h | Data integrity; everything else writes through this |
| 3 | Stop blocked tags counting as `COMPLETE`; persist them | 3 h | Silent data loss |
| 4 | Guard approved translations from re-translation | 2 h | Destroys human review work |
| 5 | Wire `RiskGate` → status; fix the always-`NEEDS_ATTENTION` ternary | 3 h | Makes triage real |
| 6 | Propagate real backend status / `remainingTagIds` to UI | 2 h | Users are being told a false story |
| 7 | Set `currentVersionNumber` | 15 m | Trivial, corrupting |
| 8 | Persist + surface `sense`, `resolved_by`, `risk`; drop fake 0.90 | 1 d | Converts it into the intended system |
| 9 | Delete Tier 2 (or make it preview-only) | 1 d | Removes ~40% of surface area |
| 10 | `responseSchema` + `thinkingBudget: 0` + explicit `maxOutputTokens`; delete parser strategies 3–5 | 1 d | Reliability, then less code |
| 11 | Add the flagged-only audit call | 1 d | The actual accuracy win |
| 12 | Parallelism 4–8 + async job + error-classified retry | 1–2 d | Performance and robustness |
| 13 | Repository query fixes (N+1, `findAll`) | 3 h | Scaling cliff |

Items 1–7 are **under two days total** and fix everything that is silently wrong. Do those before adding any capability.

---

## 7. Summary judgement

**What you got right:** the pipeline shape, deterministic-first validation with correct short-circuiting, multiset placeholder comparison, model-output structural validation with hallucinated-tag rejection, tag-level reconciliation, and genuinely strong telemetry. These are the parts that are hard to retrofit, and they are built.

**What is wrong** is concentrated in a single, very fixable pattern: **signals are computed and then not consumed.** Triage, `sense`, `resolved_by`, and the real `risk` value all exist at runtime and none reach the database or the reviewer. Fix the wiring and the system becomes what it was designed to be — without new architecture.

**What is dangerous:** the exposed API key, the non-functional transaction boundary, blocked tags disappearing while reporting success, and approved translations being silently downgraded. None are design flaws; all are small defects with large blast radius.

**What should be deleted:** Tier 2. A fallback that is less accurate, writes to a different datastore, mis-assigns translations via positional indexing, and doubles maintenance is a liability, not resilience.

You are closer than the defect count suggests. The expensive engineering is done; most of what remains is connecting outputs to consumers and removing a redundant engine.
