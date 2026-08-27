# MioTranslate API Design — Group 7: Search & Navigation

**Product:** MioTranslate  
**Document Type:** API Design Specification  
**Scope:** Group 7 — Search & Navigation (API-0701 through API-0705)  
**Source Documents:** Approved API List (Domain 7), FRD §F-14/§F-15/§9.1/§9.2/§9.7/§9.8, IA §6.6/§6.2(W1), User Flow UF-13, Group 1 API Design (locked baseline conventions)  
**Audience:** Backend Engineering, Frontend Engineering, QA  
**Prerequisites:** Group 1 (locked baseline conventions, Page and Tag data model), Group 2 (English Copy states), Group 3 (Translation states), Group 4 (Release records), Group 6 (Visibility & Reporting read-only patterns)

---

## Document Status & Revision History

| Version | Date | Author | Status | Summary of Changes |
|---|---|---|---|---|
| **v1.0** | Aug 2026 | API Design | Draft | Initial specification — all 5 APIs authored. |
| **v1.1** | Aug 2026 | API Design | Final — Locked | Targeted correction pass: (1) API-0705 activity source corrected — read-only view events cannot be derived from the audit log (Group 5 §3.5.2: "Read-only operations (GET) do not produce audit records. No exceptions."). View/access events are tracked via a dedicated access-event store; write/edit events are still sourced from the audit log. `lastAction` scope narrowed to write events only; view events supply `lastAccessedAt` only. (2) API-0701 pagination contract made deterministic: one flat `items` array (tags before pages), one `pageToken`, one `pageSize`; grouped UX preserved via `resultType` field. (3) API-0702 / API-0704 distinction made explicit: POST is the toggle interaction (bookmark button), DELETE is explicit resource-level removal (bookmark management); incorrect API List cross-citation on API-0704 idempotency rule corrected. Cross-group audit updated. |

> **Lock Status:** Group 7 is **locked**. No further changes may be made without a documented revision entry above and traceability to an approved source document.

---

## 1. Group 7 Context

### 1.1 What Group 7 Covers

Group 7 defines the **Search & Navigation capabilities** of MioTranslate — the cross-cutting infrastructure that allows any user to find content quickly, return to frequently accessed items, and pick up work where they left off.

| API ID | Name | HTTP | URL | Primary Users | IA Location |
|---|---|---|---|---|---|
| **API-0701** | Global Search | GET | `/v1/search` | All roles | Global Shell — always accessible |
| **API-0702** | Save Bookmark | POST | `/v1/bookmarks` | All roles | My Work W1 — personal bookmarks |
| **API-0703** | Get Bookmarks | GET | `/v1/bookmarks` | All roles | My Work W1 — personal bookmarks |
| **API-0704** | Remove Bookmark | DELETE | `/v1/bookmarks/{bookmarkId}` | All roles | My Work W1 — personal bookmarks |
| **API-0705** | Get Recently Edited | GET | `/v1/me/recently-edited` | All roles | My Work W1 — recently viewed/edited |

**Critical design properties for all Group 7 APIs:**
- **Search is read-only.** API-0701, API-0703, API-0705 never mutate state.
- **Bookmarks are strictly personal.** Bookmark data is scoped per user. No user can see another user's bookmarks.
- **Recently edited is inferred from user activity, not self-reported.** The recently-edited list is maintained by the system as users open and act on content.
- **Search must remain globally accessible.** API-0701 is the backend for the always-present search input in the product shell (IA §6.6).
- **Search does not add new data.** Results are projections over data owned by Groups 1 and 2. No new state is introduced.

---

### 1.2 Domain Position and Dependencies

Group 7 reads from data owned by Groups 1 and 2. It does not depend on Group 3, 4, 5, or 6 for search functionality, but enriches Bookmark responses with live status pulled from upstream domains.

| Data | Owned By | Group 7 Reads From |
|---|---|---|
| Page records (pageId, pageName, module, status, tag count) | Group 1 / Page Registry | Direct read — API-0701, API-0703 |
| Tag records (tagId, pageId, pageName, status, copy type) | Group 1 / Tag Registry | Direct read — API-0701, API-0703, API-0705 |
| English copy (text, approved status, version) | Group 2 / English Copy | Direct read for search indexing — API-0701 |
| Translation state (per language) | Group 3 / Translation | Status enrichment in bookmark/recent responses |
| **Write/edit events** (create, approve, edit, etc.) | Group 5 API-0505 (Audit Log) | Source for `lastAction` / `lastActionLabel` in API-0705 |
| **View/access events** (tag detail opened, page opened) | Dedicated access-event store (Group 7 — new) | Source for `lastAccessedAt` for purely-viewed items in API-0705 |

---

### 1.3 Baseline Conventions Inheritance

Group 7 inherits all conventions from Group 1 §1 without modification:
- URL base and versioning: `https://{host}/api/v1/...`
- JSON casing: `camelCase` for fields, `SCREAMING_SNAKE_CASE` for enums and error codes
- Response envelopes per Group 1 §1.5
- HTTP status codes per Group 1 §1.6
- Cursor-based pagination (Group 1 §1.7): `pageSize` default 50, max 200
- Error model: RFC 9457-inspired `{ "error": { "code", "status", "message", "target", "details" } }`
- Authorization: RBAC per FRD §8

---

### 1.4 RBAC Summary for Group 7

All Group 7 APIs are accessible to all authenticated roles. There is no content restriction by role for search (all roles have view access per FRD §8). Bookmark and Recently Edited data is personal — each user sees only their own records. No role distinction changes visibility within this domain.

| API | Authorized Roles | Data Scoping |
|---|---|---|
| API-0701 Global Search | All roles | Full system — no role-based content restriction |
| API-0702 Save Bookmark | All roles | Creates bookmark for the authenticated user only |
| API-0703 Get Bookmarks | All roles | Returns only the authenticated user's bookmarks |
| API-0704 Remove Bookmark | All roles | Removes only the authenticated user's bookmarks |
| API-0705 Get Recently Edited | All roles | Returns only the authenticated user's activity |

---

## 2. Shared Response Models

### 2.1 Tag Search Result

Used in API-0701 tag results.

```json
{
  "resultType": "TAG",
  "tagId": "QUICK_1",
  "pageId": "QUICK",
  "pageName": "Quick Sale",
  "module": "POS",
  "englishCopySnippet": "...Quick <mark>Checkout</mark>...",
  "englishCopyStatus": "APPROVED",
  "copyType": null,
  "translationSummary": {
    "approvedCount": 5,
    "draftCount": 1,
    "noTranslationCount": 1,
    "staleCount": 0,
    "activeLanguageCount": 7
  },
  "tagStatus": "ACTIVE",
  "matchedOn": ["ENGLISH_COPY", "TAG_ID"],
  "relevanceScore": 0.97,
  "detailUrl": "/pages/QUICK/tags/QUICK_1"
}
```

| Field | Type | Description |
|---|---|---|
| `resultType` | enum | Always `TAG` for tag results. |
| `tagId` | string | Tag identifier. |
| `pageId` | string | Parent page ID. |
| `pageName` | string | Human-readable parent page name. |
| `module` | string \| null | Module, if set. |
| `englishCopySnippet` | string \| null | Contextual snippet of the English copy with the matched term highlighted using `<mark>` tags. Null if matched on tag ID / page name only. |
| `englishCopyStatus` | enum | `NO_COPY`, `DRAFT`, `PENDING_REVIEW`, `APPROVED`. Status of the most recent English copy version. |
| `copyType` | string \| null | Copy type label, if set. |
| `translationSummary` | object | Aggregate counts of translation states across all active languages. |
| `tagStatus` | enum | `ACTIVE` or `DEPRECATED`. |
| `matchedOn` | array\<enum\> | Which fields this result matched: `TAG_ID`, `ENGLISH_COPY`, `PAGE_NAME`, `PAGE_ID`. |
| `relevanceScore` | float | Server-computed relevance score (0–1). Used for `relevance` sort. |
| `detailUrl` | string | Deep link to Tag Detail (C3). |

---

### 2.2 Page Search Result

Used in API-0701 page results.

```json
{
  "resultType": "PAGE",
  "pageId": "QUICK",
  "pageName": "Quick Sale",
  "module": "POS",
  "pageStatus": "ACTIVE",
  "totalActiveTags": 38,
  "translationSummary": {
    "byLanguage": [
      { "language": "ar", "coveragePercentage": 92.1 },
      { "language": "hi", "coveragePercentage": 88.4 }
    ]
  },
  "matchedOn": ["PAGE_NAME"],
  "relevanceScore": 0.85,
  "detailUrl": "/pages/QUICK"
}
```

| Field | Type | Description |
|---|---|---|
| `resultType` | enum | Always `PAGE` for page results. |
| `pageId` | string | Page identifier. |
| `pageName` | string | Human-readable page name. |
| `module` | string \| null | Module, if set. |
| `pageStatus` | enum | `ACTIVE` or `DEPRECATED`. |
| `totalActiveTags` | integer | Count of non-deprecated tags on this page. |
| `translationSummary.byLanguage` | array | Per-language coverage percentages. Derived from precomputed coverage table (API-0503). Limited to the top 3 active languages in the response for brevity; full detail available at Page Detail (C2). |
| `matchedOn` | array\<enum\> | `PAGE_NAME`, `PAGE_ID`. |
| `relevanceScore` | float | Server-computed relevance score. |
| `detailUrl` | string | Deep link to Page Detail (C2). |

---

### 2.3 Bookmark Item

Used in API-0702 and API-0703.

```json
{
  "bookmarkId": "bk_usr123_QUICK_1",
  "targetType": "TAG",
  "targetId": "QUICK_1",
  "pageId": "QUICK",
  "pageName": "Quick Sale",
  "module": "POS",
  "targetName": "QUICK_1",
  "targetStatus": "ACTIVE",
  "englishCopyStatus": "APPROVED",
  "translationSummary": {
    "approvedCount": 5,
    "staleCount": 0,
    "noTranslationCount": 1
  },
  "bookmarkedAt": "2026-08-20T09:00:00Z",
  "detailUrl": "/pages/QUICK/tags/QUICK_1"
}
```

| Field | Type | Description |
|---|---|---|
| `bookmarkId` | string | Unique identifier for this bookmark record. Used for removal (API-0704). |
| `targetType` | enum | `PAGE` or `TAG`. |
| `targetId` | string | The bookmarked page ID (if `PAGE`) or tag ID (if `TAG`). |
| `pageId` | string \| null | Parent page ID. Null when `targetType: PAGE` (same as `targetId`). |
| `pageName` | string | Page name. For PAGE bookmarks: the bookmarked page. For TAG bookmarks: the parent page. |
| `module` | string \| null | Module, if set. |
| `targetName` | string | Human-readable name. For TAG: tag ID displayed as the name. For PAGE: page name. |
| `targetStatus` | enum | `ACTIVE` or `DEPRECATED`. Live status of the bookmarked item. |
| `englishCopyStatus` | enum \| null | Current English copy status. Null for PAGE bookmarks. |
| `translationSummary` | object \| null | Brief translation health. Null for PAGE bookmarks (use Page Detail for that). |
| `bookmarkedAt` | string (ISO 8601) | When the bookmark was created. |
| `detailUrl` | string | Deep link to Tag Detail (C3) or Page Detail (C2). |

---

### 2.4 Recently Edited Item

Used in API-0705.

```json
{
  "itemType": "TAG",
  "tagId": "QUICK_1",
  "pageId": "QUICK",
  "pageName": "Quick Sale",
  "module": "POS",
  "lastAction": "TRANSLATION_APPROVED",
  "lastActionLabel": "Translation approved",
  "lastAccessedAt": "2026-08-24T14:35:00Z",
  "lastActionSource": "WRITE",
  "tagStatus": "ACTIVE",
  "englishCopyStatus": "APPROVED",
  "detailUrl": "/pages/QUICK/tags/QUICK_1"
}
```

| Field | Type | Description |
|---|---|---|
| `itemType` | enum | `TAG` or `PAGE`. |
| `tagId` | string \| null | Tag ID. Null when `itemType: PAGE`. |
| `pageId` | string | Page ID. |
| `pageName` | string | Page name. |
| `module` | string \| null | Module, if set. |
| `lastAction` | enum \| null | The most recent **write** action this user performed on this item. Sourced from the Group 5 audit log (§2.1.1). Null when the only recorded activity is a view event (the user opened the item but performed no write action). |
| `lastActionLabel` | string \| null | Server-rendered human-readable label for `lastAction`. Null when `lastAction` is null. |
| `lastAccessedAt` | string (ISO 8601) | Timestamp of the most recent access — whichever is latest between the user's last write action (from audit log) and last view event (from access-event store). Used for ordering. |
| `lastActionSource` | enum | `WRITE` (the last access was a write/edit action in the audit log) or `VIEW` (the last access was a read-only view event with no subsequent write action). |
| `tagStatus` | enum \| null | `ACTIVE` or `DEPRECATED`. Null for PAGE items. |
| `englishCopyStatus` | enum \| null | Current English copy status. Null for PAGE items. |
| `detailUrl` | string | Deep link to content. |

---

## 3. API Specifications

### API-0701: Global Search

> **Source:** FRD §F-14 (Search), §9.1, IA §6.6 (Cross-Cutting: Global Search), UF-13 Main Flow Steps 3–5, API List API-0701.

**Endpoint:**
```
GET /v1/search
```

**Purpose:** Find any tag or page in MioTranslate by English copy text, tag ID, page name, or page ID. Returns grouped results — tags first, then pages — with contextual snippets and status context sufficient to identify and navigate to the right item without clicking through. This is the backend for the always-present global search bar in the product shell (IA §6.6). Also serves direct look-ups in UF-12 (Correct Production — finding the reported tag) and UF-15 (Investigate History — finding the tag to investigate).

**Authorization:** All roles (FRD §8: all roles have view access).

---

#### 3.1.1 Query Parameters

| Parameter | Type | Default | Description |
|---|---|---|---|
| `q` | string | **Required** | The search query. Minimum 1 character. Case-insensitive. Matched against: tag ID, English copy text (approved and draft), page name, page ID. |
| `type` | enum | `ALL` | Scope results: `ALL` (both tags and pages), `TAGS` (tags only), `PAGES` (pages only). |
| `module` | string | (all) | Filter results to pages belonging to a specific module. |
| `includeDeprecated` | boolean | `false` | When false, deprecated pages and deprecated tags are excluded. |
| `sortBy` | enum | `relevance` | `relevance` (default — by relevance score descending), `pageNameAsc`, `statusAsc` (active first). |
| `pageSize` | integer | 50 | Max 200. Number of items in the `items` array per response page. When `type: ALL`, tag results appear before page results within the same `items` array; each item carries a `resultType` field. |
| `pageToken` | string | (none) | Opaque cursor for the next page of results. Null on the first call. |

---

#### 3.1.2 Pagination Contract

**Deterministic model:** Results are returned as a single flat `items` array. Tag results appear before page results within the same page of results. Each item carries a `resultType` field (`TAG` or `PAGE`) so the frontend can group them visually without needing separate arrays. A single `pageToken` advances through the unified result set. A single `pageSize` controls how many items (combined) appear per page.

**Why a flat array, not two separate arrays:** Two separate arrays with one shared cursor create an ambiguous pagination contract — it is not deterministic which array the cursor advances, and a frontend cannot know how many tags vs. pages are on the next page without fetching it. A flat array with `resultType` is deterministic: one cursor, one page size, one array, clear ordering.

**When `type: TAGS` or `type: PAGES`:** The `items` array contains only results of the requested type. No mixed `resultType` values appear.

---

#### 3.1.3 Response — 200 OK

```json
{
  "data": {
    "query": "checkout",
    "totalTagResults": 14,
    "totalPageResults": 2,
    "items": [
      {
        "resultType": "TAG",
        "tagId": "QUICK_1",
        "pageId": "QUICK",
        "pageName": "Quick Sale",
        "module": "POS",
        "englishCopySnippet": "...Quick <mark>Checkout</mark>...",
        "englishCopyStatus": "APPROVED",
        "copyType": null,
        "translationSummary": {
          "approvedCount": 5,
          "draftCount": 1,
          "noTranslationCount": 1,
          "staleCount": 0,
          "activeLanguageCount": 7
        },
        "tagStatus": "ACTIVE",
        "matchedOn": ["ENGLISH_COPY"],
        "relevanceScore": 0.97,
        "detailUrl": "/pages/QUICK/tags/QUICK_1"
      },
      {
        "resultType": "PAGE",
        "pageId": "CHECKOUT",
        "pageName": "Checkout",
        "module": "POS",
        "pageStatus": "ACTIVE",
        "totalActiveTags": 42,
        "translationSummary": {
          "byLanguage": [
            { "language": "ar", "coveragePercentage": 88.0 },
            { "language": "hi", "coveragePercentage": 72.5 }
          ]
        },
        "matchedOn": ["PAGE_NAME"],
        "relevanceScore": 0.85,
        "detailUrl": "/pages/CHECKOUT"
      }
    ]
  },
  "pagination": {
    "nextPageToken": "eyJpZCI6IlFVSUNLXzE0In0=",
    "pageSize": 50,
    "totalItems": 16
  }
}
```

**Response fields:**

| Field | Description |
|---|---|
| `query` | Echo of the search query as received. |
| `totalTagResults` | Total matching tag results across all pages. Present even when `type: PAGES`. Zero when no tag results. |
| `totalPageResults` | Total matching page results across all pages. Present even when `type: TAGS`. Zero when no page results. |
| `items` | Unified flat array of results. `resultType: TAG` items (§2.1) appear before `resultType: PAGE` items (§2.2) within each response page. Ordered by `sortBy` within each type group. |
| `pagination.nextPageToken` | Opaque cursor for the next page. Null when all results have been returned. |
| `pagination.pageSize` | Echo of the `pageSize` parameter applied. |
| `pagination.totalItems` | Total items across both types (= `totalTagResults + totalPageResults`). Useful for displaying "Showing N of M results". |

---

#### 3.1.3 Search Matching Rules

| Matched Field | Match Type | Source | Notes |
|---|---|---|---|
| Tag ID (`tagId`) | Exact substring, case-insensitive | Group 1 Tag Registry | Entering `QUICK_1` matches the tag exactly. Entering `QUICK` matches all tags whose ID contains that string. |
| English copy text (approved) | Full-text substring, case-insensitive | Group 2 English Copy (approved version) | Most frequent match. The snippet highlights the matched region. |
| English copy text (draft) | Full-text substring, case-insensitive | Group 2 English Copy (draft version) | Included as fallback per FRD F-14 ("approved and fallback"). The draft text is included so new copy under review is discoverable. |
| Page name (`pageName`) | Substring, case-insensitive | Group 1 Page Registry | |
| Page ID (`pageId`) | Exact substring, case-insensitive | Group 1 Page Registry | |

**Relevance scoring** (server-determined, not configurable):

| Condition | Signal |
|---|---|
| Query matches tag ID exactly | Highest relevance |
| Query matches approved English copy text | High relevance |
| Query matches beginning of approved English copy | Higher than mid-string match |
| Query matches draft English copy only | Lower than approved match |
| Query matches page name or page ID | Lower than tag-level match |

---

#### 3.1.4 Business Rules

| Rule | Source | Enforcement |
|---|---|---|
| `q` is required | FRD F-14 | Returns 400 if missing or empty. Minimum 1 character. |
| Case-insensitive matching | FRD F-14: "Search is case-insensitive" | Applied server-side to all matched fields. |
| Results span all pages | FRD F-14: "Search returns results across all pages" | No page-scope restriction unless `module` filter is set. |
| Deprecated items excluded by default | IA §6.6 | `includeDeprecated: false` default. Deprecated tags and deprecated pages hidden unless explicitly requested. |
| Snippet uses `<mark>` tags for highlighting | IA §6.6 | Server renders the snippet with `<mark>...</mark>` wrapping matched terms. Frontend renders this safely. |
| Results paginated as unified flat `items` array | FRD F-14, API Design §3.1.2 | One cursor advances through the unified result set. Tag results before page results within each page. `resultType` field allows frontend grouping. |
| `matchedOn` field indicates which fields triggered the result | API Design | Enables frontend to explain why a result appeared. |
| Tag-level results link to Tag Detail (C3) | IA §6.6, UF-13 Step 5 | `detailUrl` points to `/pages/{pageId}/tags/{tagId}`. |
| Page-level results link to Page Detail (C2) | IA §6.6, UF-13 ALT-A | `detailUrl` points to `/pages/{pageId}`. |

---

#### 3.1.5 Error Catalogue

| HTTP | Code | Condition |
|---|---|---|
| 400 | `REQUIRED` on `q` | Search query parameter missing or empty. |
| 422 | `INVALID_VALUE` on `type` | Not one of `ALL`, `TAGS`, `PAGES`. |
| 422 | `INVALID_VALUE` on `sortBy` | Not one of the valid sort options. |
| 422 | `INVALID_VALUE` on `module` | Module not in configured module vocabulary. |

---

#### 3.1.6 Edge Cases

| Scenario | Behaviour |
|---|---|
| Zero results | Returns `totalTagResults: 0`, `totalPageResults: 0`, `items: []`. Not a 404. Frontend shows "No results found" (FRD F-14). |
| Query matches hundreds of results | Paginated response. `nextPageToken` provided until results exhausted. |
| Tag has no approved or draft English copy | Tag is still searchable by tag ID and page name, but `englishCopySnippet: null` and `englishCopyStatus: NO_COPY`. |
| `type: PAGES` requested | `items` contains only `resultType: PAGE` entries. `totalTagResults` is still returned as 0 for completeness. |
| `type: TAGS` requested | `items` contains only `resultType: TAG` entries. `totalPageResults` is still returned as 0. |
| `includeDeprecated: true` | Deprecated tags and pages included. `tagStatus: DEPRECATED` and `pageStatus: DEPRECATED` visible in results. |
| Query is a single character (minimum) | Accepted. May return a very large result set — paginated. |
| Concurrent indexing (new tag just created) | Search results reflect the indexed state. Newly created tags may have a brief indexing delay. Not an error. |

---

#### 3.1.7 Engineering Dependency

| ID | Dependency | Impact if Not Met |
|---|---|---|
| **ED-G7-01** | Global search must maintain a search index over tag IDs, English copy text (approved + draft), page names, and page IDs. At 10,000+ tags (IA §6.6 scale consideration), results must be returned quickly and handle partial matches without a full table scan. Engineering must implement full-text indexing (e.g., database FTS, Elasticsearch, or equivalent). | Search is too slow to be usable at product scale. The always-present global search bar becomes a bottleneck. |

---

### API-0702: Save Bookmark

> **Source:** FRD §9.7 (Bookmarks), UF-13 ALT-C, IA W1 (personal bookmarks), API List API-0702.

**Endpoint:**
```
POST /v1/bookmarks
```

**Purpose:** Create a personal bookmark for a page or tag. Bookmarks are per-user — they appear in the user's My Work area (W1) for quick navigation back to frequently used pages and tags.

**Interaction model — toggle:** This API serves the **bookmark button interaction** in the product UI. When the user clicks a bookmark button (star, flag, etc.) on a tag or page, the frontend posts here. If the item is not yet bookmarked, it is created (`action: BOOKMARKED`, 201). If the item is already bookmarked, it is removed (`action: REMOVED`, 200). This toggle-on-POST design is the correct model for a single-button interaction that must be stateless on the frontend.

**Distinction from API-0704:** API-0702 (POST toggle) and API-0704 (DELETE by bookmarkId) are separate, intentional paths for different UI surfaces. API-0702 is for the inline bookmark button on a tag/page (the user does not need to know the `bookmarkId`). API-0704 is for explicit removal from the bookmarks management list (the user selects a bookmark by its ID and removes it). Both are specified as independent APIs in the approved API List (API-0702 and API-0704 are distinct entries).

**Authorization:** All roles.

---

#### 3.2.1 Request Body

```json
{
  "targetType": "TAG",
  "targetId": "QUICK_1",
  "pageId": "QUICK"
}
```

| Field | Type | Required | Description |
|---|---|---|---|
| `targetType` | enum | Yes | `PAGE` or `TAG`. |
| `targetId` | string | Yes | The page ID (if `PAGE`) or tag ID (if `TAG`) to bookmark. |
| `pageId` | string | Required when `targetType: TAG` | Parent page ID. Required for tag bookmarks to allow link resolution. Not required for page bookmarks (`targetId` is the page). |

---

#### 3.2.2 Response — 201 Created (new bookmark)

```json
{
  "data": {
    "bookmarkId": "bk_usr123_QUICK_1",
    "action": "BOOKMARKED",
    "targetType": "TAG",
    "targetId": "QUICK_1",
    "bookmarkedAt": "2026-08-24T10:00:00Z",
    "detailUrl": "/pages/QUICK/tags/QUICK_1"
  }
}
```

#### 3.2.3 Response — 200 OK (toggle — bookmark removed)

```json
{
  "data": {
    "bookmarkId": "bk_usr123_QUICK_1",
    "action": "REMOVED",
    "targetType": "TAG",
    "targetId": "QUICK_1"
  }
}
```

---

#### 3.2.4 Business Rules

| Rule | Source | Enforcement |
|---|---|---|
| Bookmarks are personal | FRD §9.7: "Bookmarks are personal (per user)" | `userId` from authentication token. No user sees another user's bookmarks. |
| Toggle semantics | UF-13 ALT-C, API List §5.3 ("Could be a toggle API") | If the item is already bookmarked by this user: remove and return `action: REMOVED`. If not: create and return `action: BOOKMARKED`. This is the inline-button interaction path; it requires only `targetType` and `targetId`, not the `bookmarkId`. |
| POST vs DELETE are complementary, not duplicate | API List (separate entries API-0702 and API-0704) | POST is the toggle path (bookmark button, no `bookmarkId` needed). DELETE is the explicit-removal path (bookmarks management list, requires `bookmarkId`). Both are intentional and serve different UI surfaces. |
| `pageId` required for `TAG` type | API Design | Tag bookmark URLs require the parent page ID for navigation. Missing `pageId` on a TAG bookmark returns 400. |
| No bookmark limit per user | FRD §9.7 | No maximum. Users may bookmark as many items as needed. |
| Target must exist | API Design | Cannot bookmark a non-existent page or tag. Returns 404 if the target is not found. |
| Deprecated items may be bookmarked | API Design | No restriction. The bookmark `targetStatus` reflects the current state of the target. |

---

#### 3.2.5 Error Catalogue

| HTTP | Code | Condition |
|---|---|---|
| 400 | `REQUIRED` on `targetType` | Field missing. |
| 400 | `REQUIRED` on `targetId` | Field missing. |
| 400 | `REQUIRED` on `pageId` | `pageId` missing when `targetType: TAG`. |
| 400 | `INVALID_VALUE` on `targetType` | Not `PAGE` or `TAG`. |
| 404 | `PAGE_NOT_FOUND` | Specified page does not exist. |
| 404 | `TAG_NOT_FOUND` | Specified tag does not exist. |

---

### API-0703: Get Bookmarks

> **Source:** FRD §9.7 (Bookmarks), UF-13 ALT-C, IA W1 (personal bookmarks), API List API-0703.

**Endpoint:**
```
GET /v1/bookmarks
```

**Purpose:** Retrieve the current user's personal bookmarks with live status enrichment. Each bookmark is enriched with the current state of the bookmarked item — so the user sees at a glance whether a bookmarked tag still needs attention without navigating away. Serves the My Work area (W1) personal bookmarks panel.

**Authorization:** All roles (returns only the authenticated user's bookmarks).

---

#### 3.3.1 Query Parameters

| Parameter | Type | Default | Description |
|---|---|---|---|
| `targetType` | enum | (all) | Filter by `PAGE` or `TAG`. |
| `sortBy` | enum | `bookmarkedAtDesc` | `bookmarkedAtDesc` (most recently bookmarked first, default), `bookmarkedAtAsc`, `targetNameAsc` (alphabetical by page/tag name). |
| `pageSize` | integer | 50 | Max 200. |
| `pageToken` | string | (none) | Cursor. |

---

#### 3.3.2 Response — 200 OK

```json
{
  "data": {
    "totalBookmarks": 6,
    "items": [
      {
        "bookmarkId": "bk_usr123_QUICK_1",
        "targetType": "TAG",
        "targetId": "QUICK_1",
        "pageId": "QUICK",
        "pageName": "Quick Sale",
        "module": "POS",
        "targetName": "QUICK_1",
        "targetStatus": "ACTIVE",
        "englishCopyStatus": "APPROVED",
        "translationSummary": {
          "approvedCount": 5,
          "staleCount": 1,
          "noTranslationCount": 1
        },
        "bookmarkedAt": "2026-08-20T09:00:00Z",
        "detailUrl": "/pages/QUICK/tags/QUICK_1"
      },
      {
        "bookmarkId": "bk_usr123_INV",
        "targetType": "PAGE",
        "targetId": "INV",
        "pageId": "INV",
        "pageName": "Invoice",
        "module": "Billing",
        "targetName": "Invoice",
        "targetStatus": "ACTIVE",
        "englishCopyStatus": null,
        "translationSummary": null,
        "bookmarkedAt": "2026-08-18T14:00:00Z",
        "detailUrl": "/pages/INV"
      }
    ]
  },
  "pagination": {
    "nextPageToken": null,
    "pageSize": 50
  }
}
```

---

#### 3.3.3 Business Rules

| Rule | Source | Enforcement |
|---|---|---|
| Returns only the authenticated user's bookmarks | FRD §9.7 | Scoped by `userId` from auth token. |
| Status enrichment is live, not cached | API Design | `targetStatus`, `englishCopyStatus`, `translationSummary` reflect current state at request time. Not precomputed. |
| Bookmarks for deprecated items remain visible | API Design | Bookmark is not automatically removed when a tag/page is deprecated. `targetStatus: DEPRECATED` is shown as a signal to the user. |
| Empty list is not an error | API List | `totalBookmarks: 0`, `items: []`. Not a 404. |
| `translationSummary` null for PAGE bookmarks | API Design | Page-level translation detail is at Page Detail; the bookmark summary shows only the bookmarked entity's direct attributes. |

---

#### 3.3.4 Error Catalogue

| HTTP | Code | Condition |
|---|---|---|
| 422 | `INVALID_VALUE` on `targetType` | Not `PAGE` or `TAG`. |
| 422 | `INVALID_VALUE` on `sortBy` | Not a valid sort option. |

---

### API-0704: Remove Bookmark

> **Source:** FRD §9.7 (Bookmarks), API List API-0704.

**Endpoint:**
```
DELETE /v1/bookmarks/{bookmarkId}
```

**Purpose:** Remove a specific personal bookmark by its `bookmarkId`. Idempotent: if the bookmark no longer exists, the call succeeds silently. The `bookmarkId` is obtained from the `GET /v1/bookmarks` (API-0703) response.

**Interaction model — explicit resource removal:** This API serves the **bookmark management list** surface (e.g., My Work W1 bookmark panel, a "Manage bookmarks" view). The user selects a specific bookmark they want to remove and deletes it by its `bookmarkId`. This is not the same as the POST toggle: the user has already navigated to a list of their bookmarks and is making an explicit removal decision.

**Distinction from API-0702:** API-0702 (POST toggle) does not require a `bookmarkId` — it takes `targetType` + `targetId` and is designed for inline bookmark buttons. API-0704 (DELETE by `bookmarkId`) requires the bookmark's resource ID and is designed for explicit list-based management. Both are independently specified in the approved API List and serve different UI surfaces.

**Authorization:** All roles (user may only remove their own bookmarks).

---

#### 3.4.1 Path Parameters

| Parameter | Type | Description |
|---|---|---|
| `bookmarkId` | string | The `bookmarkId` of the bookmark to remove. Returned by API-0703. |

---

#### 3.4.2 Response — 204 No Content

No response body on success.

---

#### 3.4.3 Business Rules

| Rule | Source | Enforcement |
|---|---|---|
| User may only remove their own bookmarks | FRD §9.7 | Ownership check: `bookmark.userId == authenticatedUserId`. |
| Idempotent — bookmark not found succeeds silently | API List API-0704: "Bookmark not found → no-op" | Returns 204 whether the bookmark existed or was already absent. This is the correct citation — the no-op rule is stated for API-0704 (the Remove Bookmark API), not carried over from the toggle semantics of API-0702. |
| `bookmarkId` scopes to the authenticated user | API Design | Even if another user's `bookmarkId` is provided, the ownership check prevents cross-user removal. |

---

#### 3.4.4 Error Catalogue

| HTTP | Code | Condition |
|---|---|---|
| 403 | `FORBIDDEN` | Attempting to delete another user's bookmark (ownership mismatch). |

> **Note:** Attempting to delete a `bookmarkId` that does not exist returns **204** (not 404), preserving idempotency per API List API-0704: "Bookmark not found → no-op."

---

### API-0705: Get Recently Edited

> **Source:** FRD §9.8 (Recently Edited), IA W1 (recently viewed/edited items), UF-13, API List API-0705.

**Endpoint:**
```
GET /v1/me/recently-edited
```

**Purpose:** Return the current user's recently accessed and edited tags and pages, ordered by recency (most recent first). Personal view — each user sees only their own history. Serves the My Work area (W1) "recently viewed/edited" panel, enabling users to quickly resume work without searching.

**Authorization:** All roles (returns only the authenticated user's history).

---

#### 3.5.0 Activity Source Model

FRD §9.8 approves *"recently viewed and edited"* items. These are two distinct activity types with different source mechanisms:

| Activity Type | Examples | Source Mechanism |
|---|---|---|
| **Write/edit events** | Translation approved, English copy saved, page created, tag deprecated | Group 5 Audit Log (API-0505). Every write operation produces an immutable audit record with `performedBy`, `action`, `performedAt`. These records are the authoritative source for all edit history. |
| **View events** | Tag Detail (C3) opened, Page Detail (C2) opened, search result clicked through | **Dedicated access-event store** (Group 7 infrastructure). Group 5 §3.5.2 is explicit: *"Read-only operations (GET) do not produce audit records. No exceptions."* View events cannot be derived from the audit log. Engineering must implement a lightweight per-user access log — separate from the immutable audit store — that records `(userId, targetType, targetId, accessedAt)` when a user opens a tag or page detail view. This store is not an audit record; it is mutable and may be capped to the last N items per user. |

**Key consequence for the API contract:**
- `lastAction` / `lastActionLabel` are always sourced from the Group 5 audit log and represent write events only.
- `lastAccessedAt` is the maximum of: (a) the most recent audit-log event timestamp for this user × item, and (b) the most recent access-event timestamp for this user × item. It reflects the true most-recent contact, whether the user just viewed the tag or last edited it.
- `lastActionSource` tells the client which event type was most recent: `WRITE` (most recent contact was a write action) or `VIEW` (most recent contact was a read-only view; `lastAction` may be older or null).

**No new source-of-truth is created:** The access-event store is a user-convenience store, not a system-of-record. It may be rebuilt from user session data and does not need to be immutable or permanent. Its loss degrades the view-tracking portion of "recently viewed" but does not affect audit integrity.

---

#### 3.5.1 Query Parameters

| Parameter | Type | Default | Description |
|---|---|---|---|
| `type` | enum | `ALL` | Filter by `ALL`, `TAGS`, or `PAGES`. |
| `pageSize` | integer | 20 | Number of items to return. Max 50. Lower default than other APIs because this is a quick-access list, not a reporting tool. |
| `pageToken` | string | (none) | Cursor for paginating into older history. |

---

#### 3.5.2 Response — 200 OK

```json
{
  "data": {
    "items": [
      {
        "itemType": "TAG",
        "tagId": "QUICK_1",
        "pageId": "QUICK",
        "pageName": "Quick Sale",
        "module": "POS",
        "lastAction": "TRANSLATION_APPROVED",
        "lastActionLabel": "Translation approved",
        "lastAccessedAt": "2026-08-24T14:35:00Z",
        "lastActionSource": "WRITE",
        "tagStatus": "ACTIVE",
        "englishCopyStatus": "APPROVED",
        "detailUrl": "/pages/QUICK/tags/QUICK_1"
      },
      {
        "itemType": "TAG",
        "tagId": "INV_3",
        "pageId": "INV",
        "pageName": "Invoice",
        "module": "Billing",
        "lastAction": null,
        "lastActionLabel": null,
        "lastAccessedAt": "2026-08-24T10:15:00Z",
        "lastActionSource": "VIEW",
        "tagStatus": "ACTIVE",
        "englishCopyStatus": "APPROVED",
        "detailUrl": "/pages/INV/tags/INV_3"
      },
      {
        "itemType": "PAGE",
        "tagId": null,
        "pageId": "INV",
        "pageName": "Invoice",
        "module": "Billing",
        "lastAction": "PAGE_METADATA_UPDATED",
        "lastActionLabel": "Page updated",
        "lastAccessedAt": "2026-08-24T10:00:00Z",
        "lastActionSource": "WRITE",
        "tagStatus": null,
        "englishCopyStatus": null,
        "detailUrl": "/pages/INV"
      }
    ]
  },
  "pagination": {
    "nextPageToken": null,
    "pageSize": 20
  }
}
```

---

#### 3.5.3 Business Rules

| Rule | Source | Enforcement |
|---|---|---|
| Returns only the authenticated user's history | FRD §9.8: "Personal view" | Scoped by `userId` from auth token. |
| Ordered by most recent activity first | FRD §9.8, IA W1 | `lastAccessedAt` descending. Combines write timestamps (audit log) and view timestamps (access-event store). |
| `lastAction` sourced from audit log only | Group 5 §3.5.2: "Read-only operations (GET) do not produce audit records. No exceptions." | Only write/edit actions appear in `lastAction`. Read-only views do not. The audit log is not extended with read events. |
| View events tracked via access-event store | API Design (§3.5.0) | A dedicated, lightweight per-user access log records view events. This is separate from the audit store and does not affect audit immutability or integrity. |
| Items are deduplicated per target | API Design | If a user acted on the same tag 5 times today, it appears once — with the most recent `lastAccessedAt` and the most recent write `lastAction` (if any). |
| `lastAction: null` for view-only items | Group 5 §3.5.2 | If a user only viewed a tag (no write action), `lastAction` and `lastActionLabel` are null. `lastActionSource: VIEW` is set. |
| Empty list is not an error | API List | `items: []`. Not a 404. Appropriate for a new user with no history. |
| No cross-user visibility | FRD §9.8 | Other users' activity is never included. |
| Access-event store is not an audit store | Group 5 §3.5.2, API Design | The access-event store is a user-convenience feature. It is not immutable, not permanent, and does not need to satisfy FRD §F-17 audit trail requirements. Its data loss does not constitute a system integrity fault. |

---

#### 3.5.4 Error Catalogue

| HTTP | Code | Condition |
|---|---|---|
| 422 | `INVALID_VALUE` on `type` | Not `ALL`, `TAGS`, or `PAGES`. |

---

#### 3.5.5 Edge Cases

| Scenario | Behaviour |
|---|---|
| New user with no activity of either type | Returns `items: []`. Not an error. |
| User viewed a tag but never performed any write action on it | Item included with `lastAction: null`, `lastActionLabel: null`, `lastActionSource: VIEW`. |
| User edited a tag, then just viewed it more recently | `lastAccessedAt` reflects the view (most recent), `lastAction` reflects the edit (most recent write action), `lastActionSource: VIEW`. |
| Access-event store unavailable | Items with write events (audit log) still appear; items with view-only history may be absent or stale. System degrades gracefully — no error returned. |
| User has 1,000+ items in history | Paginated. `nextPageToken` provided. Frontend shows the 20 most recent by default. |
| Same item accessed many times | Deduplicated — appears once with the most recent `lastAccessedAt`. |

---

#### 3.5.6 Engineering Dependencies

| ID | Dependency | Impact if Not Met |
|---|---|---|
| **ED-G7-02a** | Write/edit event tracking: A materialized per-user, per-item view over the audit log (Group 5 API-0505) indexed by `(userId, targetId, MAX(performedAt))`. Engineering must implement either a denormalized table updated on every audit write, or an efficient indexed query. | Edit history in the recently-edited panel is slow or empty. |
| **ED-G7-02b** | View/access event tracking: A dedicated lightweight access-event store that records `(userId, targetType, targetId, accessedAt)` whenever a user opens a Tag Detail (C3) or Page Detail (C2). This store is distinct from the audit log, does not need to be immutable, and may be capped (e.g., last 200 items per user). | The "recently viewed" portion of the approved product behaviour (FRD §9.8) cannot be satisfied. Items a user only viewed (never edited) will not appear in the list. |

---

## 4. Cross-Group Consistency Audit

### 4.1 Group 1 (Page & Tag Registry) — Consistency

| Concern | Check Result |
|---|---|
| Tag and page data sourced from Group 1 | ✅ API-0701 searches Group 1 tag and page records. Bookmark and recently-edited responses enrich with live Group 1 status. |
| `ACTIVE`/`DEPRECATED` status vocabulary | ✅ `tagStatus` and `pageStatus` use exact Group 1 vocabulary. |
| `totalActiveTags` field | ✅ Consistent with Group 1 definition: tags where `status != DEPRECATED`. |
| Module filter vocabulary | ✅ `module` filter in API-0701 sourced from Group 1 configured module vocabulary. |
| Read-only | ✅ API-0701, API-0703, API-0705 are all GET. API-0702 and API-0704 write only to the Bookmark store — no Group 1 mutations. |

---

### 4.2 Group 2 (English Copy) — Consistency

| Concern | Check Result |
|---|---|
| English copy search includes draft text | ✅ FRD F-14: "approved and fallback". The "fallback" is the draft text. Both are indexed for search. This is the approved specification. |
| `englishCopyStatus` vocabulary | ✅ `NO_COPY`, `DRAFT`, `PENDING_REVIEW`, `APPROVED` — exact Group 2 state vocabulary. |
| Snippet sourced from approved copy first | ✅ Relevance scoring prioritizes approved text; draft text is lower relevance. Snippet shows the matched text from whichever version triggered the match. |

---

### 4.3 Group 3 (Translation) — Consistency

| Concern | Check Result |
|---|---|
| `translationSummary` in bookmark response | ✅ Counts (`approvedCount`, `staleCount`, `noTranslationCount`) use exact Group 3 state vocabulary and counts per `(tagId, language)` pairs. |
| No translation state in search results | ✅ Search results show `translationSummary` as aggregate counts (approved, draft, no-translation, stale, active-language-count) — not individual language states. Detail is at Tag Detail (C3). |

---

### 4.4 Group 5 (Audit) — Consistency

| Concern | Check Result |
|---|---|
| `lastAction` enum values | ✅ API-0705 uses the same write-action catalogue as Group 5 §2.1.1. `lastActionLabel` uses the same label mapping defined in Group 6 §3.5.3. |
| `lastAction` sourced from audit records only (write events) | ✅ Group 5 §3.5.2 is explicit: "Read-only operations (GET) do not produce audit records. No exceptions." API-0705 correctly scopes `lastAction` to write events from the audit log. View events are tracked via a separate access-event store (§3.5.0). This is consistent with Group 5; the audit log is not extended with read-event entries. |
| Read-only use of audit store | ✅ Group 7 does not write to the Group 5 audit store. The access-event store introduced for view tracking is a separate, non-audit store. |
| Access-event store does not compromise audit integrity | ✅ The access-event store (§3.5.0) is explicitly scoped as a user-convenience feature, not a system-of-record. Its loss does not constitute an audit integrity fault (FRD §F-17). No blending of audit and access-event records occurs. |

---

### 4.5 Group 6 (Visibility & Reporting) — Consistency

| Concern | Check Result |
|---|---|
| `coveragePercentage` in page search result | ✅ Derived from Group 5 precomputed coverage table (API-0503) — same source as API-0601/API-0602. Limited to 3 languages in search results for response size; full detail at Page Detail. |
| Action label mapping | ✅ API-0705 `lastActionLabel` values match the Group 6 §3.5.3 action label catalogue, ensuring consistent human-readable labels across the product. |

---

### 4.6 Cross-Group Issues Found

| Issue ID | Classification | Description |
|---|---|---|
| **CG-G7-01** | Infrastructure Requirement | API-0705 write-event tracking requires a materialized per-user, per-item view over the audit log (Group 5 API-0505), indexed by `(userId, targetId, MAX(performedAt))`. API-0705 view-event tracking requires a separate lightweight access-event store. Both are engineering implementation choices — not design conflicts with Groups 1–6. See ED-G7-02a and ED-G7-02b. |
| **CG-G7-02** | Data Dependency | API-0703 bookmark status enrichment (`englishCopyStatus`, `translationSummary`) reads live from Group 2 and Group 3 at response time. At high bookmark count per user, this may require batched fetches or a shallow denormalized cache on bookmark write. Engineering should confirm the acceptable freshness boundary for these enrichment fields. |
| **CG-G7-03** | Design Clarification | API-0701 includes English draft text in search indexing per FRD F-14 ("approved and fallback"). The `matchedOn` field clearly indicates when a result matched only on draft text (`matchedOn: ["ENGLISH_COPY"]` with `englishCopyStatus: DRAFT`). This is an approved product decision — users can find content under review. Not a gap. |
| **CG-G7-04** | Design Note — No New Source of Truth | Group 7 introduces one new store (access-event store for API-0705 view tracking). This store does not become a source of truth for any data previously owned by Groups 1–6. It contains only per-user access timestamps, derived purely for the recently-viewed convenience feature. It does not affect coverage metrics, translation states, audit records, deployment history, or reporting. Groups 1–6 are unchanged. |

---

## 5. RBAC Summary

All Group 7 APIs require authentication but have no role-based content restriction for search. The only scoping is personal data scoping for bookmarks and recently edited:

| API | Write? | Personal Scope |
|---|---|---|
| API-0701 Global Search | No | No — searches all accessible content |
| API-0702 Save Bookmark | Yes (Bookmark store only) | Creates for authenticated user only |
| API-0703 Get Bookmarks | No | Returns authenticated user's bookmarks only |
| API-0704 Remove Bookmark | Yes (Bookmark store only) | Removes authenticated user's bookmarks only |
| API-0705 Get Recently Edited | No | Returns authenticated user's history only |

---

## 6. Engineering Dependencies

| ID | Dependency | Impact if Not Met |
|---|---|---|
| **ED-G7-01** | Full-text search index over tag IDs, English copy text (approved + draft), page names, page IDs. Must support partial-match, case-insensitive queries at 10,000+ tags (IA §6.6) with fast response. | Global search is too slow to serve as an always-present shell capability. |
| **ED-G7-02a** | Write/edit activity tracking for API-0705: A materialized per-user, per-item view over the Group 5 audit log, indexed by `(userId, targetId, MAX(performedAt))`. Engineering implements as a denormalized table updated on every audit write, or an efficient indexed query against the audit log. | Edit history in the recently-edited panel is slow or empty. |
| **ED-G7-02b** | View/access activity tracking for API-0705: A dedicated lightweight access-event store recording `(userId, targetType, targetId, accessedAt)` when a user opens Tag Detail (C3) or Page Detail (C2). Separate from the audit log. May be capped. Not required to be immutable. | The "recently viewed" portion of FRD §9.8 cannot be satisfied. View-only items do not appear in the list. |
| **ED-G7-03** | Bookmark storage requires a `(userId, targetType, targetId)` unique constraint to enforce toggle semantics at the data layer. | Duplicate bookmarks can be created if the toggle check is not atomic. |

---

## 7. Endpoint Summary

| API ID | Method | URL | Purpose | Auth |
|---|---|---|---|---|
| **API-0701** | `GET` | `/v1/search` | Global search — tags and pages by text, tag ID, page name | All roles |
| **API-0702** | `POST` | `/v1/bookmarks` | Save (or toggle-remove) a personal bookmark | All roles |
| **API-0703** | `GET` | `/v1/bookmarks` | List the authenticated user's bookmarks with live status | All roles |
| **API-0704** | `DELETE` | `/v1/bookmarks/{bookmarkId}` | Remove a specific personal bookmark | All roles |
| **API-0705** | `GET` | `/v1/me/recently-edited` | The authenticated user's recently viewed/edited items | All roles |

---

*End of Group 7 API Design Specification — v1.0 (Locked).*
