# MioTranslate — Developer 5-Minute Technical Brief

> **Purpose:** A high-level overview for engineers reviewing the MioTranslate technical documentation (System Design, FRD, APIs, IA, and User Flows).

---

## 1. What is MioTranslate?

**MioTranslate** is the dedicated internal platform and single source of truth for managing all **UX copy and multilingual translations** across MioSalon (89+ screens, 8 supported languages).

It decouples product copy management from engineering by giving Product, QA, and Localization teams full control over authoring, translating, reviewing, and releasing UI text without requiring developer intervention.

---

## 2. The Core Architectural Shift

```
BEFORE (Developer-Bottlenecked & Risky):
Developer writes tag in code ──> Dev pastes raw JSON into Language DB (Prod) ──> MioSalon UI loads tags
(No approval, no versioning, direct DB write access, untracked changes)

AFTER (Governed Single Source of Truth):
Developer adds tag in code ──> MioTranslate syncs/discovers tag ──> PM/QA authors & AI translates
                                                                         │ (Dev ➔ QA ➔ Staging ➔ Prod)
                                                                         ▼
MioSalon UI loads tags <── Language Services (Read-Only Connector) <── MioTranslate pushes approved bundle
```

### The Shift in One Sentence:
> **Language Services stops being where UX copy is edited and becomes a read-only pass-through. MioTranslate owns 100% of UX copy authoring, translation, versioning, and publishing.**

---

## 3. Before vs. After Comparison

| Dimension | Previous State (Legacy) | New State (MioTranslate) |
|---|---|---|
| **English UX Copy** | Hardcoded by dev in PHP fallback or pasted as raw JSON | Authored, improved, and versioned in MioTranslate by PM/QA |
| **Translations** | Spreadsheets & manual JSON uploads into DB | AI-assisted (context-aware), verified, and approved in-tool |
| **Database Access** | Developers have direct Read/Write access to Language DB | **Language Services is Read-Only.** Only MioTranslate pushes approved data |
| **Pipeline & Release** | Paste once = immediately live in Production | Multi-environment promotion gates: `Dev` ➔ `QA` ➔ `Staging` ➔ `Prod` |
| **Versioning & Audit** | Hardcoded `@version: 0`, zero change history | Full semantic versioning, audit trail (who, when, what, why), & 1-click rollback |
| **Visibility** | Complete blind spot on translation completeness | Real-time coverage dashboard across all 89 pages & 8 languages |

---

## 4. The 3 Systems & Their Roles

1. **MioSalon Codebase (PHP)**:
   - **Developer's only role:** Add the tag reference and a temporary fallback string in code:
     ```php
     <span><?php print isset($tags['QUICK_42']) ? $tags['QUICK_42'] : "Split Payment"; ?></span>
     ```
   - Fallback is strictly a placeholder for local development.

2. **MioTranslate (Translation & Copy Management Platform)**:
   - Discovers new tags from the codebase / tag registry.
   - PM/QA authors final English copy (e.g., changes `"Split Payment"` to `"Split Bill"`).
   - Generates AI translations with salon business context and back-translation checks.
   - Enforces human review & environment promotion approvals.

3. **Language Services & DB (Read-Only Connector)**:
   - Receives approved page bundles from MioTranslate via `/multilingual/bulkImportPages`.
   - Stores tags in OrientDB / Language DB.
   - Serves tags to the MioSalon UI at runtime. Write access is disabled for individual developers.

---

## 5. Key Technical Concepts for Review

- **Page-First Hierarchy:** The `Page` (`pageId` like `QUICK`, `INVOICE`, `CUSWISH`) is the top-level anchor. Tags belong to pages.
- **Language & Version Isolation:** Each language is deployed and versioned independently (e.g., `QUICK` Arabic can be `v5` in Production while `QUICK` Spanish is `v3` in Dev).
- **Stale Detection:** If English copy is updated, all associated translations automatically transition to `Stale` until reviewed/retranslated, without taking down live production copy.
- **Controlled Ingestion:** MioTranslate pushes approved bundles per page using the batch upsert API (`/multilingual/bulkImportPages`), ensuring zero disruption to existing UI rendering logic.

---

## 6. Technical Document Roadmap

When reviewing the technical specs in this repository, follow this order:

1. [miotranslate_system_design_v3.md](file:///Users/srvns/Desktop/miotransilate/miotranslate_system_design_v3.md): Full end-to-end architecture, environment pipelines, data model, and risk analysis.
2. [miotranslate_brd.md](file:///Users/srvns/Desktop/miotransilate/miotranslate_brd.md) & [miotranslate_frd.md](file:///Users/srvns/Desktop/miotransilate/miotranslate_frd.md): Business background and functional specifications/rules.
3. [bulkImportPages_api_doc.md](file:///Users/srvns/Desktop/miotransilate/bulkImportPages_api_doc.md) & [miotranslate_api_list.md](file:///Users/srvns/Desktop/miotransilate/miotranslate_api_list.md): API contracts and payload structures for Language Services injection.
4. [miotranslate_ia.md](file:///Users/srvns/Desktop/miotransilate/miotranslate_ia.md) & [miotranslate_ux_flows.md](file:///Users/srvns/Desktop/miotransilate/miotranslate_ux_flows.md): Information architecture, user workflows, and state transitions.
