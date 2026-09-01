# Translation Engine — Complete Technical Requirements & Architecture

**Product:** MioTranslate  
**Document Type:** Translation Engine Technical Requirements  
**Document ID:** TE-COMPLETE  
**Version:** 1.1 (Critical Review Corrections Applied)  
**Date:** August 2026  

**Locked Design Reference:** [miotranslate-context-engine-design.md](file:///Users/srvns/Desktop/miotransilate/miotranslate-context-engine-design.md) — Founder-approved, immutable.

**Governing Baseline:** BRD, FRD, API List (63 APIs), API Groups 1–10, ED-01 v1.1, ED-02, ED-03, DB-01–06, SYS-01, IMP-01

---

## Table of Contents

1. [TE-01: Architectural Overview & Design Alignment](#te-01-architectural-overview--design-alignment)
2. [TE-02: Data Contracts & Schema Impact](#te-02-data-contracts--schema-impact)
3. [TE-03: API Impact Analysis](#te-03-api-impact-analysis)
4. [TE-04: Validation & Verification Pipeline](#te-04-validation--verification-pipeline)
5. [TE-05: Failure Handling & Recovery](#te-05-failure-handling--recovery)
6. [TE-06: Implementation Plan & Build Sequence](#te-06-implementation-plan--build-sequence)
7. [Traceability Matrix](#traceability-matrix)
8. [Guardrail Contract](#guardrail-contract)

---

# TE-01: Architectural Overview & Design Alignment

## 1.1 The Three Locked Mechanisms

The approved Translation Engine design is built on exactly three mechanisms. None may be replaced, reinterpreted, or supplemented with infrastructure the design explicitly rejected.

| # | Mechanism | What it replaces | Design §ref |
|---|-----------|------------------|-------------|
| **M1** | **Screen is the translation unit.** The page is the semantic context boundary. All sibling tags on a page provide context for every translation. Pages larger than ~30 strings are split into technical chunks — each chunk still sees the full page as context. | Per-string calls with authored context docs | §2.2 |
| **M2** | **Tag ID is contextual documentation.** The raw `tagId` string is passed verbatim to the model — no parsing, no ontology, no embedding. | Separate context/description files | §2.3 |
| **M3** | **Inline sense declaration.** The `sense` field is generated in the same JSON response, before the `translation` field. No separate understanding stage. | Separate semantic understanding call | §2.4 |

> [!CAUTION]
> **Absolutely NO** RAG, embeddings, vector databases, translation memory, knowledge graphs, ontologies, multi-agent pipelines, per-tag description files, rule engines, or fine-tuning in V1. Each is explicitly rejected in the design (§9, §10).

## 1.1.1 Page vs Chunk — Locked Conceptual Model

> [!IMPORTANT]
> Production data shows pages with up to **362 tags** (POTSALESET). The ~30-string chunk size is a **technical AI request boundary**, not a semantic boundary. The page is always the semantic boundary.

```
LOCKED CONCEPTUAL MODEL:

  PAGE   = semantic/context boundary (all tags on a MioTranslate page)
  CHUNK  = technical AI request boundary (~30 strings per Gemini call)

  1 PAGE  → 1 or more CHUNKS
  1 CHUNK → exactly 1 AI call (translate) + optionally 1 AI call (audit)
```

**Real page sizes (from production baseline data):**

| Page | Tags | Chunks at size=30 |
|------|------|-------------------|
| POTSALESET | 362 | 13 |
| STAFFSET | 274 | 10 |
| SERSET | 72 | 3 |
| CUSINS | 71 | 3 |
| CAMREW | 28 | 1 |
| CUSWISH | 27 | 1 |

**Chunk assembly for large pages:**
- Each chunk contains ~30 tags to **translate**
- Each chunk ALSO receives **ALL other tags on the page as read-only sibling context**
- This ensures a tag in chunk 5 can still see the GENDER group from chunk 1 to disambiguate "Female"
- Input tokens are cheap; the instruction+context is amortised across ~30 output translations
- Only the ~30 tags in the chunk are translated; the rest are passed as context only

## 1.2 Where the Engine Lives in the System

Per SYS-01 §3.1 and the design (§9.1), the Translation Engine is a **library/module inside the MioTranslate monolith** — not a microservice. It sits within the existing `modules/translation/` package and the `shared/integration/ai/` shared layer.

```
miotranslate-backend/
├── modules/
│   └── translation/
│       ├── api/                          ← Existing controllers (unchanged routes)
│       ├── service/
│       │   └── TranslationService.java   ← Orchestrator: calls engine for AI ops
│       ├── engine/                       ← [NEW] Translation Engine module
│       │   ├── ContextAssembler.java     ← Groups tags by page, attaches siblings + locks
│       │   ├── PromptBuilder.java        ← One versioned template, builds structured prompt
│       │   ├── Validator.java            ← Placeholders, length, markup, coverage
│       │   ├── RiskGate.java             ← Routing rules: clean → review, flagged → audit
│       │   ├── BatchRunner.java          ← Chunking, concurrency, retries, idempotency
│       │   └── model/                    ← Engine-specific DTOs
│       │       ├── ScreenBatch.java
│       │       ├── TranslationChunk.java
│       │       ├── EngineResult.java
│       │       ├── SenseDeclaration.java
│       │       └── ValidationOutcome.java
│       ├── repository/
│       └── model/
├── shared/
│   └── integration/
│       └── ai/
│           ├── AiTranslationClient.java       ← [MODIFY] Interface changes
│           ├── GeminiTranslationClient.java    ← [NEW] Real Gemini implementation
│           ├── MockAiTranslationClient.java    ← [MODIFY] Update to new interface
│           ├── TranslationResult.java          ← [MODIFY] New fields
│           └── model/                          ← [NEW] Gemini-specific models
│               ├── GeminiRequest.java
│               ├── GeminiResponse.java
│               └── GeminiConfig.java
```

### 1.2.1 Component Responsibilities

| Component | Type | Responsibility | Design §ref |
|-----------|------|----------------|-------------|
| `ContextAssembler` | Deterministic | Builds a `PageJob` for a page: collects ALL non-deprecated tags, splits into ordered chunks of ~30, attaches full page context (ALL sibling tags, not just chunk siblings) to each chunk. Attaches: domain (from `Page.module`), `pageName`, term locks. Tracks `allTagIds` for completeness verification. | §3.1 step 1 |
| `PromptBuilder` | Deterministic | One versioned instruction template (~250 tokens). Builds structured JSON prompt with `propertyOrdering` for Gemini. Version-controlled in git. | §3.3 |
| `ModelClient` (via `AiTranslationClient`) | Thin | `translateScreen()` and `auditScreen()` — two methods. JSON schema enforced output. | §9.1 |
| `Validator` | Deterministic | Placeholder set equality, length ratio, untranslated-copy check, markup/entity preservation, coverage check. | §4.2 |
| `RiskGate` | Deterministic | Routes based on: `risk=high`, `resolved_by=guessed`, ≤2 words on ambiguous list, Layer-1 soft flags, high-blast-radius actions. | §4.3 |
| `BatchRunner` | Deterministic | Runs chunks in parallel (configurable concurrency). Chunk-level isolation. After all chunks complete, runs **completeness reconciliation loop**: identifies missing tags, re-requests them in follow-up chunks, repeats until `requested == translated + blocked` or max retries exhausted. Idempotency keyed by `(page, target_language, source_version_hash, engine_version)`. | §5.2 |

### 1.2.2 Data Flow — Bulk Page Translation

```
API-0302 (Bulk Translate)
    │
    ▼
TranslationService.translateBulk(pageId, languageCode)
    │
    ├──► Phase 1: READ (inside transaction, then commit)
    │     ContextAssembler.assemble(pageId) → PageJob
    │       Reads: registry.tags (by pageId, excludes DEPRECATED)
    │       Reads: content.english_copies + english_copy_versions (approved text)
    │       Reads: admin.system_configuration (term_locks, engine config)
    │       Reads: registry.pages (pageName, module)
    │       Returns PageJob:
    │         allTagIds:   Set<String>  (e.g. 362 tags)
    │         chunks:      List<TranslationChunk> (e.g. 13 chunks of ~30)
    │         pageContext:  pageName, domain, ALL sibling tag IDs + text
    │       Compute contextHash_before = SHA-256(source snapshot)
    │
    ├──► Phase 2: AI CALLS (NO transaction, no DB connection held)
    │     │
    │     ├──► BatchRunner.translatePage(pageJob):
    │     │     │
    │     │     ├──► FOR EACH chunk (parallel, configurable concurrency):
    │     │     │     │  PromptBuilder.build(chunk + pageContext) → prompt
    │     │     │     │  AiTranslationClient.translateScreen(prompt) → results
    │     │     │     │  Validator.validateModelOutput(results) → reject bad fields
    │     │     │     │  Validator.postValidate(results) → placeholder/length/markup
    │     │     │     │  RiskGate.triage(results) → clean + flagged
    │     │     │     │  IF flagged.nonEmpty:
    │     │     │     │    AiTranslationClient.auditScreen(flagged) → AuditResult
    │     │     │     └──► Collect EngineResults, track translated tag IDs
    │     │     │
    │     │     ├──► COMPLETENESS RECONCILIATION LOOP:
    │     │     │     remainingTags = allTagIds - translatedTagIds - blockedTagIds
    │     │     │     attempt = 0
    │     │     │     WHILE remainingTags.nonEmpty AND attempt < maxRetries:
    │     │     │       attempt++
    │     │     │       followUpChunk = buildChunk(remainingTags, pageContext)
    │     │     │       results = translateChunk(followUpChunk)
    │     │     │       update translatedTagIds, remainingTags
    │     │     │       IF no progress → BREAK
    │     │     │
    │     │     └──► Return PageTranslationResult:
    │     │           requested:  allTagIds.size() (e.g. 362)
    │     │           succeeded:  translatedTagIds.size()
    │     │           blocked:    blockedTagIds.size()
    │     │           remaining:  remainingTags.size()
    │     │           isComplete: remainingTags.isEmpty()
    │     │           status:     COMPLETE | PARTIAL_SUCCESS | FAILED
    │
    ├──► Phase 3: PERSIST (new transaction, SERIALIZABLE)
    │     Re-read English copy versions → compute contextHash_after
    │     IF contextHash_before != contextHash_after:
    │       DISCARD results for affected tags (source changed during flight)
    │     FOR EACH EngineResult where context still valid:
    │       SELECT translation FOR UPDATE (pessimistic lock)
    │       Validate ETag
    │       INSERT translation_version (sense, translation, resolved_by, risk, ...)
    │       UPDATE translations (status = DRAFT, current_version_number)
    │       AuditService.record(...)
    │
    └──► Phase 4: Post-commit side effects (fire-and-forget)
           JobDispatcher.dispatch(NOTIFICATION_DISPATCH, ...)
           Return PageTranslationResult to API caller
```

**Invariant:** A bulk translation job MUST NOT report `status: COMPLETE` unless `requested == succeeded + blocked`. `blocked` = tags that failed deterministic validation (placeholder mismatch). `remaining` = tags the engine could not translate after all retries.


### 1.2.3 Relationship to Existing API Surface

The Translation Engine does **NOT** create new HTTP endpoints. It changes the **internal implementation** of existing APIs:

| Existing API | Current Implementation | After Engine Integration |
|---|---|---|
| **API-0301** (Single Tag AI Translation) | `TranslationService` → `AiTranslationClient.translate(text, lang, context)` | `TranslationService` → `engine.translateSingle(tagId, lang)` — internally assembles screen context, validates, triages |
| **API-0302** (Bulk Translate All) | Loop calling `AiTranslationClient.translate()` per tag | `TranslationService` → `engine.translateBatch(pageId, lang)` — screen-batch with parallelism |
| **API-0307** (Retranslate Stale) | `AiTranslationClient.translate()` per tag | `TranslationService` → `engine.retranslateStale(tagId, lang)` — includes in screen batch for context |

---

## 1.3 Model Provider

**Gemini 2.5 Flash** — free tier initially, standard tier for production.

The abstraction is deliberately thin:
```
TranslationEngine → AiTranslationClient (interface) → GeminiTranslationClient (implementation)
```

No provider-abstraction layer. No plugin system. The "abstraction" is a standard Java interface with two methods. Swapping providers means writing a new implementation of that interface.

The **real provider abstraction** is the 300-string golden set regression suite (§11.1 of the design) — it tells you whether a new model actually works, which an abstraction layer cannot.

---

# TE-02: Data Contracts & Schema Impact

## 2.1 Schema Changes Summary

> [!IMPORTANT]
> The DB architecture (DB-01 through DB-06) is locked (SYS-01 GP-03). All changes below are **additive columns** and **new configuration rows** — no table restructuring, no dropped columns, no changed constraints.

### 2.1.1 `translation.translation_versions` — New Columns

The design stores `sense`, `resolved_by`, `risk`, validation results, audit verdict, and engine metadata on the translation version (§9.2). These are **engine output fields** that become part of the immutable version history.

```sql
-- New columns on translation.translation_versions
ALTER TABLE translation.translation_versions
  ADD COLUMN sense                TEXT        NULL,
  ADD COLUMN resolved_by          VARCHAR(30) NULL,
  ADD COLUMN risk                 VARCHAR(10) NULL,
  ADD COLUMN engine_version       VARCHAR(50) NULL,
  ADD COLUMN prompt_version       VARCHAR(50) NULL,
  ADD COLUMN source_version_hash  VARCHAR(64) NULL,
  ADD COLUMN validation_status    VARCHAR(30) NULL DEFAULT 'NOT_VALIDATED',
  ADD COLUMN validation_details   JSONB       NULL,
  ADD COLUMN audit_verdict        VARCHAR(30) NULL,
  ADD COLUMN audit_reading        TEXT        NULL,
  ADD COLUMN audit_suggestion     TEXT        NULL,
  ADD COLUMN state_cause          VARCHAR(50) NULL;
```

**Column specifications:**

| Column | Type | Mutability | Constraint | Design §ref |
|--------|------|-----------|------------|-------------|
| `sense` | TEXT | Immutable after INSERT | NULL for MANUAL/MIGRATED; NOT NULL for AI_GENERATED | §2.4 — "declare the sense inside the same call" |
| `resolved_by` | VARCHAR(30) | Immutable | CHECK IN (`siblings`, `tag_id`, `page`, `domain`, `unambiguous`, `guessed`). NULL for non-AI. | §3.4 — provenance enum |
| `risk` | VARCHAR(10) | Immutable | CHECK IN (`low`, `medium`, `high`). NULL for non-AI. | §2.4 |
| `engine_version` | VARCHAR(50) | Immutable | e.g. `v1.0.0`. NULL for non-AI. | §9.2 — "store engine/prompt version" |
| `prompt_version` | VARCHAR(50) | Immutable | e.g. `prompt-v1`. NULL for non-AI. | §9.2 |
| `source_version_hash` | VARCHAR(64) | Immutable | SHA-256 of assembled context. For idempotency (§5.2). NULL for non-AI. | §5.2 |
| `validation_status` | VARCHAR(30) | Append-once | CHECK IN (`NOT_VALIDATED`, `PASSED`, `FAILED_PLACEHOLDER`, `FAILED_LENGTH`, `FAILED_MARKUP`, `FLAGGED`). | §4.2 |
| `validation_details` | JSONB | Immutable | Structured record of each validation check result. | §4.2 |
| `audit_verdict` | VARCHAR(30) | Append-once | CHECK IN (`correct`, `wrong_sense`, `wrong_register`, `awkward`, `unsure`). NULL if Layer 3 not triggered. | §4.4 |
| `audit_reading` | TEXT | Append-once | "How a native user would read this string in context." NULL if not audited. | §4.4 |
| `audit_suggestion` | TEXT | Append-once | Improved string suggestion. NULL if not applicable. | §4.4 |
| `state_cause` | VARCHAR(50) | Append-once | CHECK IN (`verified`, `needs_attention_ambiguous`, `needs_attention_disputed`, `blocked_placeholder`, `needs_attention_length`). Replaces numeric confidence for reviewer display. | §4.5 |

### 2.1.2 `admin.system_configuration` — New Configuration Keys

Term locks and engine configuration are stored as system configuration (singleton entity, ED-01 §16).

```sql
-- Term locks: flat JSON map per language
INSERT INTO admin.system_configuration (config_key, config_value, description, updated_by)
VALUES 
  ('engine.term_locks', '{}', 'Per-language term lock map. Format: {"fr": {"appointment": "rendez-vous"}, "es": {...}}', (SELECT user_id FROM admin.users LIMIT 1)),
  ('engine.version', '"v1.0.0"', 'Current engine version identifier', (SELECT user_id FROM admin.users LIMIT 1)),
  ('engine.prompt_version', '"prompt-v1"', 'Current prompt template version', (SELECT user_id FROM admin.users LIMIT 1)),
  ('engine.chunk_size', '30', 'Target strings per translation chunk', (SELECT user_id FROM admin.users LIMIT 1)),
  ('engine.max_parallelism', '5', 'Max concurrent translation chunks', (SELECT user_id FROM admin.users LIMIT 1)),
  ('engine.max_retries', '2', 'Max retry attempts per failed chunk', (SELECT user_id FROM admin.users LIMIT 1)),
  ('engine.length_ratio_min', '0.5', 'Minimum target/source character ratio', (SELECT user_id FROM admin.users LIMIT 1)),
  ('engine.length_ratio_max', '2.5', 'Maximum target/source character ratio', (SELECT user_id FROM admin.users LIMIT 1)),
  ('engine.ambiguous_word_list', '["Charge","Current","Save","Open","Close","Active","Draft","Female","Staff","Service","Walk-in","Balance","Due","Return","Apply","Void","Cancel"]', 'Known-ambiguous short words for risk escalation', (SELECT user_id FROM admin.users LIMIT 1)),
  ('engine.high_blast_radius_actions', '["Void","Refund","Delete","Charge","Cancel","Remove"]', 'Financial/irreversible action words for mandatory audit', (SELECT user_id FROM admin.users LIMIT 1));
```

### 2.1.3 No Changes to These Tables

The following tables are **NOT modified** by the Translation Engine:

| Table | Reason |
|-------|--------|
| `registry.pages` | Engine reads `pageName` and `module` — no writes |
| `registry.tags` | Engine reads `tagId`, `pageId`, `copyType` — no writes |
| `content.english_copies` | Engine reads status — no writes |
| `content.english_copy_versions` | Engine reads approved text — no writes |
| `translation.translations` | Existing columns sufficient (status, current_version_number, staleInfo). Engine writes via existing `TranslationService` paths. |
| `admin.users` | No changes |
| `admin.languages` | No changes |
| `admin.roles` / `admin.role_permissions` | New permission rows added (see §TE-03) |

## 2.2 Entity Model Impact

### 2.2.1 `TranslationVersion` Entity — New Fields

The existing [TranslationVersion.java](file:///Users/srvns/Desktop/miotransilate/backend/api-server/src/main/java/com/miotranslate/modules/translation/model/TranslationVersion.java) gains new fields corresponding to the schema changes above:

```java
// === ENGINE OUTPUT FIELDS (immutable after INSERT for AI_GENERATED) ===
@Column(name = "sense")
private String sense;

@Column(name = "resolved_by", length = 30)
private String resolvedBy;

@Column(name = "risk", length = 10)
private String risk;

@Column(name = "engine_version", length = 50)
private String engineVersion;

@Column(name = "prompt_version", length = 50)
private String promptVersion;

@Column(name = "source_version_hash", length = 64)
private String sourceVersionHash;

// === VALIDATION FIELDS (append-once) ===
@Column(name = "validation_status", length = 30)
private String validationStatus = "NOT_VALIDATED";

@Column(name = "validation_details", columnDefinition = "jsonb")
private String validationDetails;

// === AUDIT FIELDS (append-once, NULL if Layer 3 not triggered) ===
@Column(name = "audit_verdict", length = 30)
private String auditVerdict;

@Column(name = "audit_reading")
private String auditReading;

@Column(name = "audit_suggestion")
private String auditSuggestion;

// === REVIEWER STATE (replaces numeric confidence for display) ===
@Column(name = "state_cause", length = 50)
private String stateCause;
```

### 2.2.2 `TranslationResult` DTO — New Fields

The existing [TranslationResult.java](file:///Users/srvns/Desktop/miotransilate/backend/api-server/src/main/java/com/miotranslate/shared/integration/ai/TranslationResult.java) is replaced by a richer `EngineResult`:

```java
// shared/integration/ai/TranslationResult.java stays for backward compat
// New DTO for engine output:

@Data @Builder
public class EngineResult {
    private String tagId;
    private String translatedText;
    private String sense;                    // "Gender option for a customer record"
    private String resolvedBy;               // siblings | tag_id | page | domain | unambiguous | guessed
    private String risk;                     // low | medium | high
    private String backTranslation;          // Optional reading aid — NOT a gate
    private BigDecimal confidenceScore;      // Preserved for backward compat; NOT shown to reviewer
    private String variableIntegrityStatus;  // PASS | FAIL | NOT_CHECKED
    private String validationStatus;         // PASSED | FAILED_PLACEHOLDER | FLAGGED | ...
    private Map<String, Object> validationDetails;
    private String auditVerdict;             // correct | wrong_sense | ... (null if not audited)
    private String auditReading;             // null if not audited
    private String auditSuggestion;          // null if not applicable
    private String stateCause;               // verified | needs_attention_ambiguous | ...
    private String engineVersion;
    private String promptVersion;
    private String sourceVersionHash;
}
```

## 2.3 `AiTranslationClient` Interface Change

The existing per-string interface:

```java
// CURRENT (per-string, context-free)
TranslationResult translate(String englishText, String targetLanguageCode, String context);
```

Must be replaced with a screen-batch interface:

```java
// NEW (screen-batch, context-rich)
public interface AiTranslationClient {

    /**
     * Translates a screen-batch of strings with full sibling context.
     * One AI call per chunk (~30 strings).
     */
    List<ScreenTranslationResult> translateScreen(ScreenTranslationRequest request);

    /**
     * Audits flagged translations with context-aware semantic verification.
     * One AI call per screen, only for flagged items.
     */
    List<AuditResult> auditScreen(ScreenAuditRequest request);
}
```

**New request/response DTOs:**

```java
@Data @Builder
public class ScreenTranslationRequest {
    private String targetLanguage;           // e.g. "fr-FR"
    private String domain;                   // from Page.module
    private String pageId;                   // e.g. "CUSTOMER_PROFILE"
    private String pageName;                 // e.g. "Customer Profile"
    private Map<String, String> termLocks;   // e.g. {"appointment": "rendez-vous"}
    private List<StringEntry> strings;       // tag + english text pairs
    private String engineVersion;
    private String promptVersion;

    @Data @Builder
    public static class StringEntry {
        private String tag;    // raw tagId — M2
        private String text;   // approved English copy
    }
}

@Data @Builder
public class ScreenTranslationResult {
    private String tag;
    private String sense;          // M3 — generated BEFORE translation
    private String translation;
    private String resolvedBy;     // siblings | tag_id | page | domain | unambiguous | guessed
    private String risk;           // low | medium | high
}

@Data @Builder
public class ScreenAuditRequest {
    private String targetLanguage;
    private String domain;
    private String pageId;
    private String pageName;
    private List<AuditEntry> items;

    @Data @Builder
    public static class AuditEntry {
        private String tag;
        private String intendedMeaning;    // the `sense` from translation step
        private String targetString;        // the translation to audit
    }
}

@Data @Builder
public class AuditResult {
    private String tag;
    private String verdict;    // correct | wrong_sense | wrong_register | awkward | unsure
    private String reading;    // how a native user would read this in context
    private String better;     // improved string, or null
}
```

---

# TE-03: API Impact Analysis

## 3.1 APIs Modified (Internal Implementation Only)

These APIs keep their existing HTTP contracts (URL, method, request/response shape) but their **internal service logic** changes to use the Translation Engine.

### 3.1.1 API-0301: Generate AI Translation (Single Tag)

**Current path:** `TranslationService.generateAiTranslation()` → `AiTranslationClient.translate(text, lang, context)`

**New path:** `TranslationService.generateAiTranslation()` → `TranslationEngine.translateSingle(tagId, languageCode)`

**Internal change:** Even for a single tag, the engine assembles the full screen context (all sibling tags on the same page). The model sees the complete screen. This is M1 — the screen is the unit, even for "single" translation.

**Semantic context scope vs result persistence scope:**
- Semantic context scope: entire page (all sibling tags sent as context)
- Result persistence scope: single requested tag only
- The engine translates all siblings but extracts and persists ONLY the requested tag's result
- All other sibling results are DISCARDED

**Response enrichment:** The API response gains new optional fields (backward-compatible additions):

```json
{
  "translatedText": "Femme",
  "backTranslation": "[FR] Female",
  "confidenceScore": 0.95,
  "variableIntegrityStatus": "PASS",
  // NEW — engine output
  "sense": "Gender option for a customer record",
  "resolvedBy": "siblings",
  "risk": "low",
  "stateCause": "verified",
  "validationStatus": "PASSED"
}
```

### 3.1.2 API-0302: Generate AI Translations (Bulk — Translate All)

**Current path:** Loop calling `AiTranslationClient.translate()` per tag.

**New path:** `TranslationService.translateBulk()` → `TranslationEngine.translateBatch(pageId, languageCode)` → `BatchRunner` builds `PageJob`, splits into chunks, translates in parallel, runs completeness reconciliation loop.

**Key behavioral changes:**
- Tags grouped by page (natural grouping since this API is already page-scoped)
- Chunked to ~30 strings per AI call instead of 1 call per tag
- Chunk-level isolation: one failed chunk doesn’t block others
- **Completeness reconciliation loop: after all chunks, missing tags are re-requested until `requested == succeeded + blocked`**
- Tag-level retry for missing/malformed items
- Idempotency: re-running translates only missing or stale tags

**Response enrichment (with completeness data):**

```json
{
  "pageId": "POTSALESET",
  "languageCode": "fr",
  "status": "PARTIAL_SUCCESS",
  "requested": 362,
  "succeeded": 358,
  "blocked": 2,
  "remaining": 2,
  "remainingTagIds": ["POTSALESET_107", "POTSALESET_Error"],
  "chunks": {
    "total": 13,
    "succeeded": 12,
    "retried": 1,
    "reconciliationRuns": 1
  }
}
```

**Job status values:**
- `COMPLETE` — `requested == succeeded + blocked`. All tags accounted for.
- `PARTIAL_SUCCESS` — `remaining > 0 AND remaining < 10%` of requested.
- `FAILED` — `remaining >= 10%` of requested.

### 3.1.3 API-0307: Resolve Stale — Retranslate

**Current path:** `AiTranslationClient.translate()` for the single stale tag.

**New path:** `TranslationEngine.retranslateStale(tagId, languageCode)` — assembles screen context including the stale tag, uses updated English copy.

### 3.1.4 API-0304: Review Translation

**Current path:** Approve/Reject/Edit-and-Approve/Request-Retranslation actions.

**New consideration:** The review modal now displays `sense`, `stateCause`, sibling context, and audit results. The API response for `GET /v1/tags/{tagId}/translations/{lang}` (part of API-0105 Tag Detail) must include these new fields.

**No change to write contract** — review actions (approve, reject, edit-and-approve, retranslate) use the same status transitions.

### 3.1.5 API-0105: Get Tag Detail

**Response enrichment:** When returning translation data per language, include engine output fields:

```json
{
  "translations": {
    "fr": {
      "text": "Femme",
      "status": "DRAFT",
      "confidenceScore": 0.95,
      "creationMethod": "AI_GENERATED",
      // NEW
      "sense": "Gender option for a customer record",
      "resolvedBy": "siblings",
      "risk": "low",
      "stateCause": "verified",
      "validationStatus": "PASSED",
      "auditVerdict": null,
      "auditReading": null,
      "siblingContext": [
        {"tag": "CUSTOMER_GENDER_MALE", "text": "Male", "translation": "Homme"},
        {"tag": "CUSTOMER_GENDER_OTHER", "text": "Other", "translation": "Autre"}
      ]
    }
  }
}
```

## 3.2 APIs NOT Modified

All other APIs are unaffected. The engine is purely an internal implementation change for AI translation generation.

| API | Status | Reason |
|-----|--------|--------|
| API-0101 through API-0108 (Group 1) | No change | Registry — engine reads, never writes |
| API-0201 through API-0204 (Group 2) | No change | English Copy — engine reads approved text only |
| API-0303 (Manual Edit) | No change | Human-authored, bypasses engine |
| API-0305 (Bulk Approve) | No change | Approval logic unchanged; may use `stateCause` for UI display |
| API-0306 (Confirm Stale) | No change | Human decision, no AI |
| API-0308 (Version History) | Minor enrichment | Include `sense`, `resolvedBy`, `risk` in version records |
| API-0309 (Submit for Review) | No change | Status transition only |
| API-04xx (Publishing) | No change | Works on approved translations regardless of creation method |
| API-05xx (System-Triggered) | No change | Stale cascade, coverage — independent of engine |
| API-06xx (Reporting) | Minor enrichment | Dashboard may show `resolvedBy` distribution, `guessed` rate |
| API-07xx (Search) | No change | Searches text, not engine metadata |
| API-08xx (Admin) | Minor addition | Term lock management UI |
| API-09xx (Collaboration) | No change | Comments, audit, export unaffected |
| API-10xx (Migration) | No change | Migrated translations use `creation_method=MIGRATED`, bypass engine |

## 3.3 New Admin API: Term Lock Management

One new API endpoint is needed for managing term locks (§6.2):

```
PUT /v1/config/term-locks
```

This maps to the existing `admin.system_configuration` update pattern (API-0805 style). It updates the `engine.term_locks` configuration key.

**Permission:** `MANAGE_SYSTEM_CONFIG` (existing permission).

## 3.4 Permission Requirements

No new permissions needed. The engine operates within existing translation permissions:

| Action | Required Permission | Existing? |
|--------|-------------------|-----------|
| Trigger single AI translation (API-0301) | `CREATE_TRANSLATION` | ✅ Yes |
| Trigger bulk AI translation (API-0302) | `CREATE_TRANSLATION` | ✅ Yes |
| Review translation (API-0304) | `REVIEW_TRANSLATION` | ✅ Yes |
| Manage term locks | `MANAGE_SYSTEM_CONFIG` | ✅ Yes |

---

# TE-04: Validation & Verification Pipeline

## 4.1 Layer 1 — Deterministic Validation (All Strings, Zero AI)

Per design §4.2. Runs on **every** AI-generated translation. Sub-millisecond per string.

| Check | Rule | Implementation | Action on Fail |
|-------|------|----------------|----------------|
| **Placeholder integrity** | Multiset of `{...}` / `%s` / `%1$s` in source == target | Regex extraction + set comparison | **Hard fail.** Never show to reviewer. Auto-retry once (with the same chunk, re-requesting only this tag). On second failure, mark `validation_status = FAILED_PLACEHOLDER`, `state_cause = blocked_placeholder`. |
| **Length sanity** | Target/source char ratio outside language-specific band | Configurable per language: default 0.5–2.5, wider for DE/FI, narrower for ZH/JA | Flag `state_cause = needs_attention_length`. Reviewer sees "check truncation" note. |
| **Untranslated copy** | Target identical to source, and source is not a proper noun/brand/symbol | String equality check + allowlist (SMS, POS, Email, WhatsApp, etc.) | Flag for review unless on allowlist. |
| **Markup/entity** | HTML tags, `&nbsp;`, newlines preserved | Tag extraction + comparison | **Hard fail** — same handling as placeholder. |
| **Leading/trailing space** | Preserved exactly | Trim comparison | **Auto-fix silently** — trim to match source pattern. |
| **Coverage** | Every requested tag present exactly once in response | Set comparison against request | Re-request missing subset as a small follow-up chunk. |

**Placeholder regex is configurable** and initially covers:
- `{name}`, `{0}`, `{1}` — Java MessageFormat style
- `%s`, `%d` — printf style
- `%1$s`, `%2$d` — positional printf
- `{{variable}}` — double-brace (Handlebars-like)

**Implementation class:** `Validator.java`

```java
public class Validator {

    public PreValidationResult preValidate(TranslationChunk chunk) {
        // Extract placeholders per string using configurable regex
        // Record expected placeholder multisets
        // Skip empty/numeric/pure-symbol strings
        // Return PreValidationResult with skipList and placeholderMap
    }

    /**
     * Validates model output BEFORE deterministic checks.
     * Rejects malformed semantic output.
     */
    public ModelOutputValidation validateModelOutput(
        List<ScreenTranslationResult> results,
        Set<String> requestedTagIds
    ) {
        List<ScreenTranslationResult> valid = new ArrayList<>();
        Set<String> rejected = new HashSet<>();
        Set<String> seen = new HashSet<>();

        for (var result : results) {
            // 1. Tag identity: must be in request set
            if (!requestedTagIds.contains(result.getTag())) {
                log.warn("Unexpected tag in response: {}", result.getTag());
                continue; // discard, do not count
            }
            // 2. Duplicate detection
            if (!seen.add(result.getTag())) {
                log.warn("Duplicate tag in response: {}", result.getTag());
                continue; // keep first, discard duplicate
            }
            // 3. Required fields
            if (isBlank(result.getSense()) || isBlank(result.getTranslation())) {
                rejected.add(result.getTag());
                continue;
            }
            // 4. Enum validation
            if (!VALID_RESOLVED_BY.contains(result.getResolvedBy())
                || !VALID_RISK.contains(result.getRisk())) {
                rejected.add(result.getTag());
                continue;
            }
            valid.add(result);
        }

        Set<String> missing = new HashSet<>(requestedTagIds);
        missing.removeAll(seen);
        // Rejected + missing tags enter the completeness reconciliation loop
        return new ModelOutputValidation(valid, rejected, missing);
    }

    public ValidationOutcome postValidate(
        List<ScreenTranslationResult> results,
        TranslationChunk chunk,
        PreValidationResult preResult
    ) {
        // For each validated result:
        //   1. Placeholder integrity check (multiset equality)
        //   2. Length ratio check (per target language, configurable bands)
        //   3. Untranslated copy check (allowlist for proper nouns/brands)
        //   4. Markup preservation check (HTML tags, &nbsp;, newlines)
        //   5. Leading/trailing space auto-fix (trim to match source)
        // Return ValidationOutcome with per-tag status and details
    }
}
```

## 4.2 Layer 2 — Risk Gate (Deterministic Routing, Zero AI)

Per design §4.3. Escalates to Layer 3 only if **any** of the following are true:

| Condition | Source | Expected Impact |
|-----------|--------|----------------|
| `risk = high` | Model self-report in JSON output | Model's own signal — cheapest/best predictor |
| `resolved_by = guessed` | Model self-report | Model couldn't determine meaning from context |
| Source is ≤ 2 words AND on the ambiguous word list | Configurable list (~40 entries in `engine.ambiguous_word_list` config) | Catches "Female", "Save", "Charge", etc. |
| Any Layer-1 soft flag fired | Validator output | Length ratio, untranslated copy |
| High-blast-radius: financial or irreversible action | Configurable list in `engine.high_blast_radius_actions` config | "Void", "Refund", "Delete", "Charge" |

**Expected escalation rate:** 10–20% of strings (§4.3).

**Implementation class:** `RiskGate.java`

```java
public class RiskGate {

    public TriageResult triage(
        List<ScreenTranslationResult> results,
        ValidationOutcome validation,
        EngineConfig config
    ) {
        List<ScreenTranslationResult> clean = new ArrayList<>();
        List<ScreenTranslationResult> flagged = new ArrayList<>();

        for (var result : results) {
            boolean escalate = false;
            if ("high".equals(result.getRisk())) escalate = true;
            if ("guessed".equals(result.getResolvedBy())) escalate = true;
            if (isShortAmbiguous(result, config)) escalate = true;
            if (validation.hasSoftFlag(result.getTag())) escalate = true;
            if (isHighBlastRadius(result, config)) escalate = true;

            if (escalate) flagged.add(result);
            else clean.add(result);
        }
        return new TriageResult(clean, flagged);
    }
}
```

## 4.3 Layer 3 — Audit Call (Only Flagged Strings, Batched Per Screen)

Per design §4.4. Replaces blind back-translation. Gives the auditor **the same context the translator had**, plus the declared sense.

**Input:** All flagged strings from one screen, batched into ONE audit call.

**Prompt structure:**
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

**Output mapping to `state_cause`:**

| Audit Verdict | Layer-1 Status | → `state_cause` |
|---|---|---|
| `correct` | PASSED | `verified` |
| `wrong_sense` | any | `needs_attention_ambiguous` |
| `wrong_register` | any | `needs_attention_disputed` |
| `awkward` | any | `needs_attention_disputed` |
| `unsure` | any | `needs_attention_ambiguous` |
| (not audited) | PASSED, no flags | `verified` |
| (not audited) | FAILED_PLACEHOLDER | `blocked_placeholder` |
| (not audited) | FLAGGED (length) | `needs_attention_length` |

## 4.4 Back-Translation — Demoted to Reading Aid

Per design §4.4:

> Back-translation is not deleted. It is demoted from quality gate to optional reviewer reading aid, and when shown it must be produced with context and clearly labelled as an aid, not a verdict.

**Implementation (contradiction resolved as compatibility exception):**

The existing schema ([TranslationVersion.java](file:///Users/srvns/Desktop/miotransilate/backend/api-server/src/main/java/com/miotranslate/modules/translation/model/TranslationVersion.java) line 43–44) already has a `back_translation` column. The existing [MockAiTranslationClient](file:///Users/srvns/Desktop/miotransilate/backend/api-server/src/main/java/com/miotranslate/shared/integration/ai/MockAiTranslationClient.java) already persists it. Removing the column would break the existing API contract.

- ✅ **PERSISTED** in `translation_versions.back_translation` (existing column, compatibility exception to design §9.2)
- ✅ **RETURNED** in API responses (existing contract)
- ✅ **DISPLAYED** in review UI — **collapsed by default**, labelled "Reading aid — not a correctness check"
- ❌ **NEVER** used in `Validator` logic
- ❌ **NEVER** used in `RiskGate` triage/routing
- ❌ **NEVER** compared against source English for correctness
- ❌ **NEVER** used as a quality gate

---

# TE-05: Failure Handling & Recovery

## 5.1 Failure Modes and Responses

| Failure Mode | Scope | Detection | Response | Design §ref |
|---|---|---|---|---|
| **Gemini API timeout/5xx** | Per chunk | HTTP client timeout or 5xx status | Retry with jittered backoff (2 attempts). On second failure, mark affected tags `needs_retry`. Continue with other chunks. | §5.2 |
| **Gemini rate limit (429)** | Per chunk | 429 status | Backoff per Retry-After header. Reduce parallelism. Retry. | §5.2 |
| **Malformed JSON response** | Per chunk | JSON parse failure | Retry once. On second failure, mark tags `needs_retry`. | §5.2 |
| **Partial response (missing tags)** | Per tag within chunk | Coverage check in Validator | Re-request only missing tags as a small follow-up chunk. | §4.2, §5.2 |
| **Placeholder integrity failure** | Per tag | Deterministic Validator check | Auto-retry once (same chunk, only failing tag). On second failure, `state_cause = blocked_placeholder`. Tag **cannot** be approved until fixed. | §4.2 |
| **Model returns `risk=high` / `guessed`** | Per tag | Model self-report | Route to Layer 3 audit. Not a failure — designed behavior. | §4.3 |
| **Audit call failure** | Per screen | HTTP/JSON failure of audit call | Tags keep their `risk` flag but skip audit. `state_cause = needs_attention_ambiguous`. Reviewer manually evaluates. | §4.4 |
| **Concurrent translation request for same page+lang** | Per batch | Idempotency key check | Reject duplicate. Return "translation in progress" status. | §5.2 |
| **English copy changes during translation** | Per tag | `source_version_hash` mismatch | Discard result. Tag remains untranslated. Next run will pick up new English. | §5.2 |
| **Tag deprecated during translation** | Per tag | Status check before persist | Skip deprecated tags. Do not persist. | — |

## 5.2 Idempotency & Source/Context Snapshot Integrity

Every translation chunk is keyed by: `(pageId, targetLanguage, sourceVersionHash, engineVersion)`

- `sourceVersionHash` = SHA-256 of the assembled context (all English texts + tag IDs + page metadata for this chunk).
- Re-running "Translate All" after a partial failure re-translates only tags where:
  - No translation exists, OR
  - Existing translation's `source_version_hash` differs from current (English changed), OR
  - Tag status is `STALE`

## 5.3 Transaction Boundaries

Per SYS-01 GP-02: **External network calls MUST NOT occur inside PostgreSQL transactions.**

```
Phase 1: READ (inside transaction, then commit + release connection)
  Read page, tags (exclude DEPRECATED), English copies, config
  Compute contextHash_before = SHA-256(source snapshot)
  Commit → release DB connection

Phase 2: AI CALLS (NO transaction, no DB connection held)
  For each chunk: build prompt → call Gemini → validate model output →
    validate placeholders/length/markup → triage → audit flagged
  Run completeness reconciliation loop for missing tags
  All external HTTP calls happen here.

Phase 3: PERSIST (new transaction, SERIALIZABLE)
  Re-read English copy versions → compute contextHash_after
  IF contextHash_before != contextHash_after:
    DISCARD results for affected tags
  FOR EACH valid EngineResult:
    SELECT translation FOR UPDATE (pessimistic lock)
    Re-check tag not DEPRECATED
    Validate ETag
    INSERT translation_version
    UPDATE translation (status = DRAFT, current_version_number)
    AuditService.record(...)
  Commit

Phase 4: Post-commit side effects (fire-and-forget)
  JobDispatcher.dispatch(NOTIFICATION_DISPATCH, ...)
```

## 5.4 Retry Policy

```
All values configurable via system_configuration. Defaults:
  engine.max_retries          = 2
  engine.backoff_base_ms      = 1000
  engine.backoff_max_ms       = 60000
  engine.request_timeout_ms   = 30000
  engine.max_parallelism      = 1 (free tier) / 5 (production)

Retry by failure type:
  429 (rate limit)            → read Retry-After header if present,
                                else jittered exponential backoff (base 2s, max 60s)
                                REDUCE active concurrency by 50% (min 1)
                                Repeated 429 (3+ consecutive): pause 30s, resume at concurrency=1
                                Rate-limited chunk DOES NOT fail unrelated chunks
  5xx / timeout               → retry full chunk with jittered backoff
  Malformed JSON              → retry full chunk once (if schema wrong twice, won't self-correct)
  Partial response            → retry ONLY missing subset (enters reconciliation loop)
  Placeholder mismatch        → retry ONLY failing tag with same context (max 1)
  risk=high / guessed         → NOT a failure. Route to Layer 3 audit.
  Duplicate tag in response   → keep first, discard duplicate, log warning
  Unexpected tag              → discard, log warning, does NOT count toward completeness

After all retries exhausted:  mark tag `needs_retry`, continue other chunks
INVARIANT: Successful tags are NEVER re-translated by retry logic.
           Retry operates ONLY on the missing/failed subset.
Never fail the entire job. One chunk's failure is isolated.
```

---

# TE-06: Implementation Plan & Build Sequence

## 6.0 Pre-Requisite: E0 Diagnostic (1 day)

Per design §1.5 — **mandatory before any code is written.**

> [!IMPORTANT]
> Take 100 real reported bad translations. For each, have a native reviewer classify into exactly one bucket: A (wrong sense), B (wrong register), C (back-translation misled), D (no clean equivalent), E (placeholder/length/markup). The distribution determines build order.

**Predicted outcome (§1.5):** C + E together will be 30–60%. If confirmed, ship deterministic validators first (Steps 1 + 5) — they eliminate half the pain for near-zero cost.

## 6.1 Build Sequence

| Step | Work | Days | Dependencies | Deliverable |
|---|---|---|---|---|
| **0** | **E0 Diagnostic** — 100 defects classified by native reviewer | 1 | Native reviewer availability | Classification distribution |
| **1** | **Deterministic validators + placeholder hard gate** — `Validator.java` with all Layer 1 checks | 2 | None | Placeholder, length, markup, coverage checks wired into existing `TranslationService` |
| **2** | **Context assembler + prompt + structured output** — `ContextAssembler.java`, `PromptBuilder.java`, schema changes, `GeminiTranslationClient.java` | 3 | Step 1 | Screen-batch translation with M1+M2+M3 |
| **3** | **Batch runner** — `BatchRunner.java` with chunking, parallelism, retries, idempotency | 3 | Step 2 | Bulk Translate All wired through engine |
| **4** | **Risk gate + audit call** — `RiskGate.java`, audit prompt, `auditScreen()` method | 2 | Step 2 | Flagged strings routed to Layer 3 |
| **5** | **Reviewer UI enrichment** — sense, state+cause, siblings; collapse back-translation | 3 | Step 2, Step 4 | Frontend displays engine output |
| **6** | **Golden-set harness** — 300-string stratified test suite | 2 | Step 2 | Regression suite for prompt/model changes |

**Total: ~3 weeks for one or two engineers.**

> [!TIP]
> Steps 1 and 5 alone may resolve a large share of complaints. Ship them first and re-measure before building Steps 2–4.

## 6.2 Mapping to IMP-01 Phases

The Translation Engine build slots into **IMP-01 Phase 3** (Translation Domain):

| IMP-01 Reference | Translation Engine Step |
|---|---|
| Phase 3, Module 3.1: AI Translation Client | Step 2 (GeminiTranslationClient + ContextAssembler + PromptBuilder) |
| Phase 3, Module 3.2: Bulk Translation | Step 3 (BatchRunner) |
| Phase 3, Module 3.3: Translation Validation | Step 1 (Validator) + Step 4 (RiskGate + Audit) |
| Phase 5, Module 5.3: Stale Cascade Integration | Retranslate-stale path already uses engine |
| Phase 9, Module 9.3: Translation Review UI | Step 5 (Reviewer UI enrichment) |

## 6.3 Frontend Changes

### 6.3.1 `TranslationEngine.ts` — Replace with Engine-Backed API Calls

The existing frontend [TranslationEngine.ts](file:///Users/srvns/Desktop/miotransilate/frontend/src/engine/TranslationEngine.ts) currently calls a `MockProvider` on the client side. After engine integration, it becomes a thin wrapper around backend API calls:

```typescript
// TranslationEngine.ts — post-integration
export class TranslationEngine {
  
  async translateTag(pageId: string, tagId: string, targetLanguage: string) {
    // Calls backend API-0301, which internally uses the engine
    await ApiService.generateAiTranslation(tagId, targetLanguage);
    await StoreService.refreshPageDetail(pageId);
  }

  async translatePageBatch(pageId: string, targetLanguage: string) {
    // Calls backend API-0302, which internally uses the engine
    await ApiService.generateBulkTranslations(pageId, targetLanguage);
    await StoreService.refreshPageDetail(pageId);
  }
}
```

### 6.3.2 `types.ts` — Add Engine Fields to `TranslationValue`

```typescript
export interface TranslationValue {
  text: string;
  status: TranslationStatus;
  confidence: number;
  translatedAtEnglishVersion: number;
  lastUpdated: string;
  // NEW — engine output
  sense?: string;
  resolvedBy?: string;
  risk?: string;
  stateCause?: string;
  validationStatus?: string;
  auditVerdict?: string;
  auditReading?: string;
  auditSuggestion?: string;
  backTranslation?: string;
}
```

### 6.3.3 `TranslationReviewModal.tsx` — Enriched Review UI

Per design §7, the review modal displays (in priority order):

1. **English source** + tag ID
2. **Target translation** (editable)
3. **"Understood as:"** — `sense` field (highest-value addition)
4. **State + cause** — `stateCause` enum, not a number
5. **Screen context:** sibling strings
6. Audit `reading` + suggested alternative (when Layer 3 ran)
7. Placeholder/length check results (when relevant)
8. Back-translation — **collapsed by default**, labelled "Reading aid, not a correctness check"

### 6.3.4 `ITranslationProvider` / `MockProvider` — Deprecate

The frontend `ITranslationProvider` interface and `MockProvider` are deprecated. All translation calls go through the backend API. The `MockProvider` stays for local development when the backend is unavailable.

---

# Traceability Matrix

## Design → BRD/FRD → API → Entity → DB → Component

| Design Mechanism | BRD Ref | FRD Ref | API(s) Affected | Entity Fields | DB Columns | Engine Component |
|---|---|---|---|---|---|---|
| **M1: Screen is the unit** | BRD §4.4 (translation invisible), BRD Obj-4 | FRD F-06, F-07 | API-0301, API-0302, API-0307 | — (batching is internal) | — | `ContextAssembler`, `BatchRunner` |
| **M2: Tag ID is context** | BRD §1.1 (tags structure) | FRD F-06 (business context) | API-0301, API-0302 | — (tagId already exists) | — | `ContextAssembler` (passes tagId verbatim) |
| **M3: Inline sense declaration** | BRD Obj-4 (translation QA) | FRD F-08 (review) | API-0301, API-0302, API-0105 | `TranslationVersion.sense` | `translation_versions.sense` | `PromptBuilder` (schema ordering), `ModelClient` |
| **Deterministic validation** | BRD §4.5 (unstructured workflow) | FRD F-06 (variable integrity) | API-0301, API-0302 | `TranslationVersion.validationStatus` | `translation_versions.validation_status`, `validation_details` | `Validator` |
| **Risk-based triage** | BRD Obj-4 | FRD F-08 (review) | API-0301, API-0302 | `TranslationVersion.risk`, `resolvedBy` | `translation_versions.risk`, `resolved_by` | `RiskGate` |
| **Context-aware audit (Layer 3)** | BRD Obj-4 | FRD F-08 (review) | API-0301, API-0302 | `TranslationVersion.auditVerdict`, `auditReading` | `translation_versions.audit_verdict`, `audit_reading`, `audit_suggestion` | `ModelClient.auditScreen()` |
| **State+cause replaces confidence** | BRD Obj-4 | FRD F-08 (review actions) | API-0105, API-0304 | `TranslationVersion.stateCause` | `translation_versions.state_cause` | `RiskGate` (assigns), UI (displays) |
| **Back-translation demoted** | BRD Obj-4 | FRD F-08 | API-0105 | `TranslationVersion.backTranslation` (existing) | `translation_versions.back_translation` (existing) | UI: collapsed, labelled "reading aid" |
| **Term locks** | BRD Obj-4 (terminology) | FRD (future: translation rules) | New: PUT /v1/config/term-locks | `SystemConfiguration` | `admin.system_configuration` | `ContextAssembler` (reads), Admin UI (manages) |
| **Idempotency** | — | FRD F-07 (Translate All) | API-0302 | `TranslationVersion.sourceVersionHash` | `translation_versions.source_version_hash` | `BatchRunner` |

---

# Guardrail Contract

## What the Engine MUST Do

1. **Batch by screen.** Every AI translation call includes all sibling tags of the page as context (chunked to ~30 for translation). No per-string calls.
2. **Pass raw tag ID.** The `tagId` string is included verbatim in the prompt. No parsing, no ontology.
3. **Generate sense before translation.** The structured JSON schema enforces `sense` appears before `translation` in property ordering.
4. **Hard-fail on placeholder mismatch.** Placeholder-broken translations NEVER reach a reviewer.
5. **Store engine outputs.** `sense`, `resolved_by`, `risk`, `engine_version`, `prompt_version`, `source_version_hash` are stored on every AI-generated `TranslationVersion`.
6. **External calls outside transactions.** All Gemini API calls happen with no DB connection held.
7. **Chunk-level isolation.** One failed chunk never blocks others.
8. **Idempotent re-runs.** Re-running Translate All only processes missing or stale tags.
9. **Completeness reconciliation loop.** After all chunks complete, verify `requested == succeeded + blocked`. Re-request missing tags. NEVER report COMPLETE with remaining > 0.
10. **Validate model output per field.** Tag in request set, no duplicates, sense present, enums valid. Rejected results enter the reconciliation loop, not silent success.
11. **Source snapshot integrity.** Compute context hash before AI call; re-verify before persist. Discard results if source changed during flight.
12. **Exclude deprecated tags.** Filter DEPRECATED tags before assembly. Re-check before persist.
13. **Language isolation.** One engine call = one target language. EN→AR never touches EN→FR data.

## What the Engine MUST NOT Do

1. **No RAG, embeddings, or vector databases.** Context is structural (page/tag), not semantic.
2. **No translation memory.** Screen batching provides consistency.
3. **No per-tag description files.** Tag ID and siblings are the context.
4. **No multi-agent pipelines.** Two AI calls maximum per screen (translate + audit).
5. **No separate understanding stage.** Sense is a JSON field, not a separate call.
6. **No numeric confidence as a reviewer signal.** Use `state_cause` enum.
7. **No blind back-translation as a quality gate.** Demoted to collapsed reading aid (persisted for compatibility, never used in validation).
8. **No fine-tuning.** Prompt + context first.
9. **No separate microservice.** Library module inside the monolith.
10. **No knowledge graphs or ontologies.** Not this problem.
11. **No hardcoded provider rate limits.** All concurrency/retry/backoff values are configurable.
12. **No overwriting approved translations.** AI creates DRAFT versions only. Never modifies APPROVED.

## Open Questions

> [!IMPORTANT]
> **OQ-1: E0 Diagnostic Scheduling.** When can we schedule the 1-day diagnostic with a native reviewer? This determines build order — if C+E are 30–60%, we ship validators first.

> [!NOTE]
> **OQ-2: Gemini API Key / Tier.** Free tier for testing (engine.max_parallelism = 1). Production uses higher tier (confirmed by founder). No hardcoded tier assumptions in code.

> [!IMPORTANT]
> **OQ-3: Golden Set Reviewer.** Who will produce the 300-string approved reference translations for the regression suite? Requires native reviewers for each target language.

> [!WARNING]
> **OQ-4: Term Locks Initial Content.** The design says "ship with an empty list" and populate reactively. Confirm this is acceptable — no pre-seeded glossary.

> [!NOTE]
> **OQ-5: Language-Specific Length Ratios.** Default is 0.5–2.5. Need confirmation from native reviewers on per-language adjustments (German tends longer, CJK tends shorter).

---

# Appendix: Document Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | Aug 2026 | Initial TE-COMPLETE |
| 1.1 | Aug 2026 | Critical review corrections: page/chunk semantics, completeness reconciliation loop, model output validation, source snapshot integrity, back-translation compatibility resolution, configurable rate limits, retry semantics by failure type |

