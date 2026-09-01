import type { Page, Tag, LanguageConfig, DeploymentRecord, TranslationValue, Environment } from "../types";
import { ApiService } from "../services/ApiService";

// ── localStorage key for persisting translations across refreshes ──
const TRANSLATIONS_STORAGE_KEY = "miotranslate_translations_v1";

const TAGS_STORAGE_KEY = "miotranslate_local_tags_v1";
const PAGE_NAMES_STORAGE_KEY = "miotranslate_custom_page_names_v1";

type PersistedTranslations = Record<string, Record<string, Record<string, TranslationValue>>>;
// Shape: { [pageId]: { [tagId]: { [langCode]: TranslationValue } } }

function loadCustomPageNames(): Record<string, string> {
  try {
    const raw = localStorage.getItem(PAGE_NAMES_STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function saveCustomPageName(pageId: string, name: string) {
  try {
    const all = loadCustomPageNames();
    all[pageId] = name;
    localStorage.setItem(PAGE_NAMES_STORAGE_KEY, JSON.stringify(all));
  } catch (e) {
    console.warn("Failed to persist custom page name:", e);
  }
}

function loadPersistedTranslations(): PersistedTranslations {
  try {
    const raw = localStorage.getItem(TRANSLATIONS_STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function savePersistedTranslations(data: PersistedTranslations) {
  try {
    localStorage.setItem(TRANSLATIONS_STORAGE_KEY, JSON.stringify(data));
  } catch (e) {
    console.warn("Failed to persist translations to localStorage:", e);
  }
}

function loadPersistedTags(pageId: string): Tag[] {
  try {
    const raw = localStorage.getItem(`${TAGS_STORAGE_KEY}_${pageId}`);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function savePersistedTags(pageId: string, tags: Tag[]) {
  try {
    localStorage.setItem(`${TAGS_STORAGE_KEY}_${pageId}`, JSON.stringify(tags));
  } catch (e) {
    console.warn("Failed to persist tags to localStorage:", e);
  }
}

function persistTranslation(pageId: string, tagId: string, langCode: string, value: TranslationValue) {
  const all = loadPersistedTranslations();
  if (!all[pageId]) all[pageId] = {};
  if (!all[pageId][tagId]) all[pageId][tagId] = {};
  all[pageId][tagId][langCode] = value;
  savePersistedTranslations(all);
}

function mergePersistedTranslationsIntoTags(pageId: string, apiTags: Tag[]): Tag[] {
  const localTags = loadPersistedTags(pageId);
  const persistedTrans = loadPersistedTranslations()[pageId] || {};

  const map = new Map<string, Tag>();

  // 1. Seed from local persisted tags
  for (const lt of localTags) {
    map.set(lt.id, { ...lt });
  }

  // 2. Overlay API tags
  for (const at of apiTags) {
    if (map.has(at.id)) {
      const existing = map.get(at.id)!;
      map.set(at.id, {
        ...existing,
        ...at,
        // Only overwrite English if API has non-empty English copy
        english: at.english && at.english.trim() ? at.english : existing.english,
        type: at.type || existing.type || "General",
        englishStatus: (at.english && at.english.trim()) || existing.english ? "Approved" : (existing.englishStatus || "Draft"),
        values: { ...existing.values, ...at.values }
      });
    } else {
      map.set(at.id, at);
    }
  }

  // 3. Overlay translations from translation store
  return Array.from(map.values()).map(tag => {
    const tagPersisted = persistedTrans[tag.id];
    if (!tagPersisted) return tag;

    const mergedValues = { ...tag.values };
    for (const [langCode, persistedVal] of Object.entries(tagPersisted)) {
      const existing = mergedValues[langCode];
      if (
        !existing ||
        !existing.text ||
        existing.status === "No Trans" ||
        existing.status === "No Eng" ||
        (persistedVal.lastUpdated && existing.lastUpdated && persistedVal.lastUpdated > existing.lastUpdated)
      ) {
        mergedValues[langCode] = persistedVal;
      }
    }
    return { ...tag, values: mergedValues };
  });
}

// ─────────────────────────────────────────────────
// Default empty initial state for a fresh environment
const DEFAULT_PAGES: Page[] = [];
const DEFAULT_TAGS: Record<string, Tag[]> = {};

export interface LengthConflictConfig {
  enabled: boolean;
  thresholdPercentage: number; // e.g. 25
  severeThresholdPercentage: number; // e.g. 50
  targetScope: "ALL" | "BUTTONS_TITLES" | "SHORT_STRINGS";
  preventAutoApprove: boolean;
}

export const DEFAULT_LENGTH_CONFLICT_CONFIG: LengthConflictConfig = {
  enabled: true,
  thresholdPercentage: 25,
  severeThresholdPercentage: 50,
  targetScope: "ALL",
  preventAutoApprove: false,
};

export class StoreService {
  private static readonly STORAGE_KEYS = {
    LANGUAGES: "miotranslate_languages_v2",
    DEPLOYMENTS: "miotranslate_deployments_v2",
    APPROVAL_REQUESTS: "miotranslate_approval_requests_v1",
    BOOKMARKS: "miotranslate_bookmarks_v1",
    CONFIDENCE_THRESHOLD: "AI_CONFIDENCE_THRESHOLD",
    LENGTH_CONFLICT_CONFIG: "miotranslate_length_conflict_config_v1"
  };

  private static listeners = new Set<() => void>();
  
  private static cache = {
    pages: [...DEFAULT_PAGES] as Page[],
    tags: { ...DEFAULT_TAGS } as Record<string, Tag[]>,
    pageDetails: {} as Record<string, { page: Page; tags: Tag[] }>
  };

  static subscribe(listener: () => void) {
    this.listeners.add(listener);
    return () => { this.listeners.delete(listener); };
  }

  private static emit() {
    this.listeners.forEach(l => l());
  }

  // --- PAGES ---
  static async refreshPages() {
    try {
      const res = await ApiService.getPages();
      if (res && res.length > 0) {
        this.cache.pages = res;
      }
      this.emit();
      // Fetch details in background for each page to populate tags & coverage cache
      Promise.all(this.cache.pages.map(p => this.refreshPageDetail(p.pageId))).then(() => {
        this.emit();
      });
    } catch (e) {
      if (this.cache.pages.length === 0) {
        this.cache.pages = [...DEFAULT_PAGES];
      }
      this.emit();
      console.warn("ApiService.getPages offline, using local cache");
    }
  }

  static getPages(): Page[] {
    const customNames = loadCustomPageNames();
    const pages = this.cache.pages.length > 0 ? this.cache.pages : [...DEFAULT_PAGES];
    return pages.map(p => ({
      ...p,
      name: customNames[p.pageId] || p.name
    }));
  }

  static getPage(pageId: string): Page | undefined {
    const customNames = loadCustomPageNames();
    const found = this.getPages().find(p => p.pageId === pageId) || this.cache.pageDetails[pageId]?.page || DEFAULT_PAGES.find(p => p.pageId === pageId);
    if (found) {
      return {
        ...found,
        name: customNames[pageId] || found.name
      };
    }
    return undefined;
  }

  static async updatePageName(pageId: string, newName: string) {
    const cleanName = newName.trim();
    if (!cleanName) return;

    saveCustomPageName(pageId, cleanName);

    this.cache.pages = this.cache.pages.map(p => 
      p.pageId === pageId ? { ...p, name: cleanName } : p
    );

    if (this.cache.pageDetails[pageId]) {
      this.cache.pageDetails[pageId].page = {
        ...this.cache.pageDetails[pageId].page,
        name: cleanName
      };
    }

    this.emit();

    try {
      await ApiService.updatePage(pageId, cleanName);
    } catch (e) {
      console.warn("Backend update page name error (kept local update):", e);
    }
  }

  static async createPage(page: Page) {
    this.cache.pages = [...this.cache.pages, page];
    this.emit();
    try {
      await ApiService.createPage({
        pageId: page.pageId,
        pageName: page.name,
        module: page.module
      });
      await this.refreshPages();
    } catch (e) {
      console.warn("Backend create page error (kept local update):", e);
    }
  }

  // --- PAGE DETAILS & TAGS ---
  static async refreshPageDetail(pageId: string) {
    try {
      const detail = await ApiService.getPageDetail(pageId);
      // Merge persisted translations on top of API data
      detail.tags = mergePersistedTranslationsIntoTags(pageId, detail.tags);
      this.cache.pageDetails[pageId] = detail;
      this.cache.tags[pageId] = detail.tags;
      this.emit();
    } catch (e) {
      if (!this.cache.tags[pageId]) {
        this.cache.tags[pageId] = DEFAULT_TAGS[pageId] || [];
      }
      this.cache.tags[pageId] = mergePersistedTranslationsIntoTags(pageId, this.cache.tags[pageId]);
      this.emit();
      console.warn(`ApiService.getPageDetail(${pageId}) offline, using local cache`);
    }
  }

  static getTags(pageId: string): Tag[] {
    if (!this.cache.tags[pageId] || this.cache.tags[pageId].length === 0) {
      const localTags = loadPersistedTags(pageId);
      if (localTags.length > 0) {
        this.cache.tags[pageId] = localTags;
      }
    }
    return this.cache.tags[pageId] || DEFAULT_TAGS[pageId] || [];
  }

  static getTag(pageId: string, tagId: string): Tag | undefined {
    return this.getTags(pageId).find(t => t.id === tagId);
  }

  static async createTag(pageId: string, tag: Tag) {
    const tags = this.getTags(pageId);
    const existingIdx = tags.findIndex(t => t.id === tag.id);
    let updatedTags: Tag[];

    if (existingIdx === -1) {
      updatedTags = [...tags, tag];
    } else {
      const existing = tags[existingIdx];
      tags[existingIdx] = {
        ...existing,
        ...tag,
        english: tag.english || existing.english,
        type: tag.type || existing.type || "General",
        englishStatus: (tag.english || existing.english) ? "Approved" : "Draft",
        values: { ...existing.values, ...(tag.values || {}) },
        updatedAt: new Date().toISOString()
      };
      updatedTags = [...tags];
    }

    this.cache.tags[pageId] = updatedTags;
    savePersistedTags(pageId, updatedTags);
    this.emit();

    try {
      await ApiService.createTag(pageId, {
        id: tag.id,
        type: tag.type || "General",
        english: tag.english
      });
    } catch (e) {
      console.warn("Backend create tag error (kept local update):", e);
    }
  }

  static async seedEnglishCopiesForPage(pageId: string) {
    const tags = this.getTags(pageId);
    const updatedTags: Tag[] = tags.map((t, idx) => {
      if (t.english && t.english.trim().length > 0) return t;

      let generatedEnglish = "";
      const idClean = t.id.replace(/^[A-Z0-9]+_/, "").replace(/_/g, " ");

      if (t.id.includes("37") || t.id.toLowerCase().includes("client")) {
        generatedEnglish = `Confirm appointment for {client_name} at {time}`;
      } else if (t.id.toLowerCase().includes("churn")) {
        generatedEnglish = "Predictive client churn risk analysis & retention alerts";
      } else if (t.id.toLowerCase().includes("total") || t.id.toLowerCase().includes("revenue")) {
        generatedEnglish = "Total salon revenue & appointment analytics breakdown";
      } else if (t.id.toLowerCase().includes("service")) {
        generatedEnglish = "Manage salon & spa service categories and pricing";
      } else if (t.id.toLowerCase().includes("staff") || t.id.toLowerCase().includes("stylist")) {
        generatedEnglish = "Stylist schedule, commissions, and staff roster";
      } else if (t.id.toLowerCase().includes("book") || t.id.toLowerCase().includes("appt")) {
        generatedEnglish = "Book new salon appointment for {client_name}";
      } else if (t.id.toLowerCase().includes("discount") || t.id.toLowerCase().includes("reward")) {
        generatedEnglish = "Apply loyalty reward discount {discount_percent}%";
      } else if (t.id.toLowerCase().includes("cancel")) {
        generatedEnglish = "Cancel scheduled booking and notify client";
      } else if (t.id.toLowerCase().includes("save") || t.id.toLowerCase().includes("submit")) {
        generatedEnglish = "Save changes and update client profile";
      } else {
        generatedEnglish = idClean.length > 2
          ? idClean.charAt(0).toUpperCase() + idClean.slice(1)
          : `Salon setting option ${idx + 1}`;
      }

      return {
        ...t,
        english: generatedEnglish,
        englishStatus: "Approved" as const,
        englishVersion: t.englishVersion || 1,
        updatedAt: new Date().toISOString()
      };
    });

    this.cache.tags[pageId] = updatedTags;
    savePersistedTags(pageId, updatedTags);
    this.emit();
  }

  static async updateTagType(pageId: string, tagId: string, newType: string) {
    const tags = this.getTags(pageId);
    const tag = tags.find(t => t.id === tagId);
    if (tag) {
      tag.type = newType || "General";
      tag.updatedAt = new Date().toISOString();
      this.emit();
    }
    try {
      await ApiService.updateTagType(tagId, newType || "General");
      await this.refreshPageDetail(pageId);
    } catch (e) {
      console.warn("Backend update tag type error (kept local update):", e);
    }
  }

  static async updateEnglish(pageId: string, tagId: string, newEnglish: string, changeReason?: string) {
    const tags = this.getTags(pageId);
    const idx = tags.findIndex(t => t.id === tagId);
    if (idx === -1) return;

    const tag = tags[idx];
    if (tag.english !== newEnglish) {
      tag.english = newEnglish;
      tag.englishStatus = "Pending Review";
      tag.englishChangeReason = changeReason || "Updated copy";
      tag.updatedAt = new Date().toISOString();
      this.emit();

      try {
        await ApiService.saveEnglishCopyDraft(tagId, newEnglish, changeReason);
      } catch (e) {
        console.warn("Backend update english error (kept local update):", e);
      }
    }
  }

  static async approveEnglish(pageId: string, tagId: string) {
    const tags = this.getTags(pageId);
    const tag = tags.find(t => t.id === tagId);
    if (!tag) return;

    tag.englishStatus = "Approved";
    tag.englishVersion = (tag.englishVersion || 1) + 1;
    tag.updatedAt = new Date().toISOString();

    // Mark existing approved translations as stale
    if (tag.values) {
      Object.keys(tag.values).forEach(lang => {
        if (tag.values[lang].status === "Approved") {
          tag.values[lang].status = "Stale";
          persistTranslation(pageId, tagId, lang, tag.values[lang]);
        }
      });
    }
    this.emit();

    try {
      await ApiService.approveEnglishCopy(tagId);
      await this.refreshPageDetail(pageId);
    } catch (e) {
      console.warn("Backend approve english error (kept local update):", e);
    }
  }

  static async updateTranslation(pageId: string, tagId: string, langCode: string, newValue: Partial<TranslationValue>) {
    const tags = this.getTags(pageId);
    const tag = tags.find(t => t.id === tagId);
    if (tag) {
      if (!tag.values) tag.values = {};
      const merged: TranslationValue = {
        ...(tag.values[langCode] || { text: "", status: "No Trans", confidence: 0, translatedAtEnglishVersion: 1 }),
        ...newValue,
        lastUpdated: new Date().toISOString()
      };
      tag.values[langCode] = merged;
      tag.updatedAt = new Date().toISOString();

      // Persist to localStorage so translations survive page refresh
      persistTranslation(pageId, tagId, langCode, merged);

      this.emit();
    }

    if (newValue.text !== undefined || newValue.status !== undefined) {
      try {
        const text = newValue.text !== undefined ? newValue.text : tag?.values[langCode]?.text || "";
        const status = newValue.status === "Approved" ? "Approved" : newValue.status === "Draft" ? "Draft" : "Pending Review";
        await ApiService.updateTranslation(tagId, langCode, text, status);
      } catch (e) {
        console.warn("Backend translation update error (kept local update):", e);
      }
    }
  }

  static async batchUpdateTranslations(
    pageId: string,
    langCode: string,
    updates: { tagId: string; value: Partial<TranslationValue> }[]
  ) {
    const tags = this.getTags(pageId);
    const allPersisted = loadPersistedTranslations();
    if (!allPersisted[pageId]) allPersisted[pageId] = {};

    const now = new Date().toISOString();
    updates.forEach(({ tagId, value }) => {
      const tag = tags.find(t => t.id === tagId);
      if (tag) {
        if (!tag.values) tag.values = {};
        const merged: TranslationValue = {
          ...(tag.values[langCode] || { text: "", status: "No Trans", confidence: 0, translatedAtEnglishVersion: 1 }),
          ...value,
          lastUpdated: now
        };
        tag.values[langCode] = merged;
        tag.updatedAt = now;

        if (!allPersisted[pageId][tagId]) allPersisted[pageId][tagId] = {};
        allPersisted[pageId][tagId][langCode] = merged;
      }
    });

    savePersistedTranslations(allPersisted);
    this.emit();
  }

  static async rejectTranslation(pageId: string, tagId: string, langCode: string, reason: string) {
    await this.updateTranslation(pageId, tagId, langCode, {
      status: "Draft",
      stateCause: `Rejected: ${reason}`
    });
    try {
      await ApiService.rejectTranslation(tagId, langCode, reason);
    } catch (e) {
      console.warn("Backend reject translation error (kept local update):", e);
    }
  }

  static async returnTranslationForRevision(pageId: string, tagId: string, langCode: string, comment: string) {
    await this.updateTranslation(pageId, tagId, langCode, {
      status: "Draft",
      stateCause: `Revision Requested: ${comment}`
    });
    try {
      await ApiService.returnTranslationForRevision(tagId, langCode, comment);
    } catch (e) {
      console.warn("Backend return for revision error (kept local update):", e);
    }
  }

  static async confirmStaleTranslation(pageId: string, tagId: string, langCode: string) {
    const tag = this.getTag(pageId, tagId);
    const currentVal = tag?.values?.[langCode];
    if (tag && currentVal) {
      await this.updateTranslation(pageId, tagId, langCode, {
        status: "Approved",
        translatedAtEnglishVersion: tag.englishVersion
      });
      try {
        await ApiService.confirmStaleTranslation(tagId, langCode);
      } catch (e) {
        console.warn("Backend confirm stale error (kept local update):", e);
      }
    }
  }

  static initEmptyValuesForTag(tag: Tag) {
    const activeLangs = this.getActiveLanguages();
    if (!tag.values) tag.values = {};
    if (!tag.englishStatus) tag.englishStatus = tag.english ? "Approved" : "Draft";
    activeLangs.forEach(l => {
      if (!tag.values[l.code]) {
        tag.values[l.code] = {
          text: "",
          status: tag.english ? "No Trans" : "No Eng",
          confidence: 0,
          translatedAtEnglishVersion: tag.englishVersion,
          lastUpdated: new Date().toISOString()
        };
      }
    });
  }

  // --- LANGUAGES ---
  static getLanguages(): LanguageConfig[] {
    try {
      const data = localStorage.getItem(this.STORAGE_KEYS.LANGUAGES);
      if (data) {
        const parsed: LanguageConfig[] = JSON.parse(data);
        return parsed.map(l => {
          if (l.code === "fr" || l.code === "fr-CA" || l.code === "fr-ca") {
            return {
              ...l,
              name: "French (Canada)",
              nativeName: l.nativeName.includes("Canada") ? l.nativeName : "Français (Canada)"
            };
          }
          return l;
        });
      }
    } catch {}

    return [
      { code: "ar", name: "Arabic", nativeName: "العربية", direction: "RTL", active: true, langServiceCode: "arabic" },
      { code: "es", name: "Spanish", nativeName: "Español", direction: "LTR", active: true, langServiceCode: "spanish" },
      { code: "tr", name: "Turkish", nativeName: "Türkçe", direction: "LTR", active: true, langServiceCode: "turkish" },
      { code: "bg", name: "Bulgarian", nativeName: "Български", direction: "LTR", active: true, langServiceCode: "bulgarian" },
      { code: "it", name: "Italian", nativeName: "Italiano", direction: "LTR", active: true, langServiceCode: "italian" },
      { code: "fr", name: "French (Canada)", nativeName: "Français (Canada)", direction: "LTR", active: true, langServiceCode: "french" },
      { code: "de", name: "German", nativeName: "Deutsch", direction: "LTR", active: true, langServiceCode: "german" }
    ];
  }

  static getActiveLanguages(): LanguageConfig[] {
    return this.getLanguages().filter(l => l.active);
  }

  static saveLanguages(languages: LanguageConfig[]) {
    localStorage.setItem(this.STORAGE_KEYS.LANGUAGES, JSON.stringify(languages));
    this.emit();
  }

  // --- QUEUES ---
  static getEnglishPendingReviews() {
    const pages = this.getPages();
    const result: Array<{
      tagId: string;
      pageId: string;
      pageName: string;
      module: string;
      english: string;
      englishVersion: number;
      changeReason?: string;
      updatedAt: string;
    }> = [];

    for (const page of pages) {
      const tags = this.getTags(page.pageId);
      for (const tag of tags) {
        if (tag.englishStatus === "Pending Review" && tag.english) {
          result.push({
            tagId: tag.id,
            pageId: page.pageId,
            pageName: page.name,
            module: page.module,
            english: tag.english,
            englishVersion: tag.englishVersion || 1,
            changeReason: tag.englishChangeReason,
            updatedAt: tag.updatedAt || new Date().toISOString()
          });
        }
      }
    }
    return result;
  }

  static getPendingReviews(langCode?: string) {
    const pages = this.getPages();
    const result = [];
    for (const page of pages) {
      const tags = this.getTags(page.pageId);
      for (const tag of tags) {
        for (const [code, val] of Object.entries(tag.values)) {
          if ((!langCode || code === langCode) && val.status === "Pending Review") {
            const langName = this.getLanguages().find(l => l.code === code)?.name || code;
            result.push({
              tag: tag.id,
              page: page.name,
              pageId: page.pageId,
              english: tag.english,
              translatedText: val.text,
              langCode: code,
              langName: langName,
              conf: val.confidence,
              varsOk: true
            });
          }
        }
      }
    }
    return result;
  }

  static getStaleTranslations(langCode?: string) {
    const pages = this.getPages();
    const result = [];
    for (const page of pages) {
      const tags = this.getTags(page.pageId);
      for (const tag of tags) {
        for (const [code, val] of Object.entries(tag.values)) {
          if ((!langCode || code === langCode) && val.status === "Stale") {
            const langName = this.getLanguages().find(l => l.code === code)?.name || code;
            const diffDays = val.lastUpdated 
              ? Math.max(1, Math.floor((new Date().getTime() - new Date(val.lastUpdated).getTime()) / (1000 * 3600 * 24)))
              : 1;
            result.push({
              tag: tag.id,
              page: page.name,
              pageId: page.pageId,
              langName: langName,
              langCode: code,
              age: `${diffDays}d`,
              staleDays: diffDays,
              masterVersion: tag.englishVersion || 1,
              delta: Math.max(1, (tag.englishVersion || 1) - (val.translatedAtEnglishVersion || 1)),
              change: `v${val.translatedAtEnglishVersion || 1} -> v${tag.englishVersion || 1}`
            });
          }
        }
      }
    }
    return result;
  }

  static getConfidenceThreshold(): number {
    try {
      const val = localStorage.getItem(this.STORAGE_KEYS.CONFIDENCE_THRESHOLD);
      if (val) return parseInt(val, 10);
    } catch {}
    return 95;
  }

  static setConfidenceThreshold(threshold: number) {
    localStorage.setItem(this.STORAGE_KEYS.CONFIDENCE_THRESHOLD, threshold.toString());
    this.emit();
  }

  static getLengthConflictConfig(): LengthConflictConfig {
    try {
      const val = localStorage.getItem(this.STORAGE_KEYS.LENGTH_CONFLICT_CONFIG);
      if (val) {
        return { ...DEFAULT_LENGTH_CONFLICT_CONFIG, ...JSON.parse(val) };
      }
    } catch {}
    return { ...DEFAULT_LENGTH_CONFLICT_CONFIG };
  }

  static setLengthConflictConfig(config: Partial<LengthConflictConfig>) {
    const current = this.getLengthConflictConfig();
    const updated = { ...current, ...config };
    localStorage.setItem(this.STORAGE_KEYS.LENGTH_CONFLICT_CONFIG, JSON.stringify(updated));
    this.emit();
  }

  static getLengthConflicts() {
    const config = this.getLengthConflictConfig();
    if (!config.enabled) {
      return [];
    }

    const pages = this.getPages();
    const result = [];
    const thresholdFactor = 1 + (config.thresholdPercentage || 25) / 100;
    
    for (const page of pages) {
      const tags = this.getTags(page.pageId);
      for (const tag of tags) {
        if (!tag.english) continue;
        const engLen = tag.english.length;
        if (engLen === 0) continue;

        // Apply targetScope filter
        if (config.targetScope === "BUTTONS_TITLES") {
          const type = (tag.type || "").toLowerCase();
          if (!type.includes("button") && !type.includes("title") && !type.includes("label") && !type.includes("header")) {
            continue;
          }
        } else if (config.targetScope === "SHORT_STRINGS") {
          if (engLen > 40) {
            continue;
          }
        }

        for (const [code, val] of Object.entries(tag.values)) {
          if (!val.text) continue;
          const transLen = val.text.length;
          const ratio = transLen / engLen;
          
          if (ratio > thresholdFactor) {
            const langName = this.getLanguages().find(l => l.code === code)?.name || code;
            const diffPct = Math.round((ratio - 1) * 100);
            result.push({
              tagId: tag.id,
              pageId: page.pageId,
              pageName: page.name,
              languageName: langName,
              languageCode: code,
              englishText: tag.english,
              translatedText: val.text,
              diffPercentage: diffPct,
              isSevere: diffPct >= (config.severeThresholdPercentage || 50),
              status: val.status
            });
          }
        }
      }
    }
    return result;
  }

  // --- DEPLOYMENTS & RELEASES ---
  static getDeployments(): DeploymentRecord[] {
    try {
      const data = localStorage.getItem(this.STORAGE_KEYS.DEPLOYMENTS);
      return data ? JSON.parse(data) : [];
    } catch {
      return [];
    }
  }

  static saveDeployments(records: DeploymentRecord[]) {
    localStorage.setItem(this.STORAGE_KEYS.DEPLOYMENTS, JSON.stringify(records));
    this.emit();
  }

  static recordDeployment(record: DeploymentRecord) {
    const existing = this.getDeployments();
    this.saveDeployments([record, ...existing]);
  }

  static getNextVersion(pageId: string, language: string, environment: Environment): number {
    const deps = this.getDeployments().filter(
      d => d.pageId === pageId && d.language === language && d.environment === environment
    );
    if (deps.length === 0) return 1;
    const maxVer = Math.max(...deps.map(d => d.version || 1));
    return maxVer + 1;
  }

  static getPublishDiffSummary(pageId: string, language: string, environment: Environment) {
    const tags = this.getTags(pageId);
    const isEng = language === "eng" || language === "en";
    const approvedTags = isEng 
      ? tags.filter(t => t.english && t.english.trim().length > 0)
      : tags.filter(t => t.values?.[language]?.status === "Approved");

    const latest = this.getDeployments()
      .filter(d => d.pageId === pageId && d.language === language && d.environment === environment)
      .sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime())[0];

    const prevCount = latest ? latest.tagCount : 0;
    const newCount = Math.max(0, approvedTags.length - prevCount);
    const updatedCount = latest ? Math.min(approvedTags.length, prevCount) : approvedTags.length;

    return {
      totalCount: approvedTags.length,
      newCount,
      updatedCount,
      previousVersion: latest ? latest.version : null
    };
  }

  static async publish(
    pageId: string, 
    pageName: string, 
    language: string, 
    environment: Environment, 
    approvedCount: number,
    publishedBy: string = "System User"
  ): Promise<{ success: boolean; isDuplicate: boolean; version: number; message: string }> {
    const existingDeps = this.getDeployments().filter(
      d => d.pageId === pageId && d.language === language && d.environment === environment
    );

    const latest = existingDeps.sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime())[0];

    // Duplicate publish guard: if approved count is identical to last release on that environment
    if (latest && latest.tagCount === approvedCount && approvedCount > 0) {
      // Check if any tag updated since last publish
      const lastPubDate = new Date(latest.publishedAt).getTime();
      const tags = this.getTags(pageId);
      const hasRecentUpdates = tags.some(t => new Date(t.updatedAt).getTime() > lastPubDate);

      if (!hasRecentUpdates) {
        return {
          success: true,
          isDuplicate: true,
          version: latest.version,
          message: `Bundle is already up-to-date on ${environment} (v${latest.version} with ${approvedCount} strings)`
        };
      }
    }

    const nextVer = this.getNextVersion(pageId, language, environment);

    const record: DeploymentRecord = {
      id: `dep-${Date.now()}`,
      pageId,
      pageName,
      language,
      environment,
      tagCount: approvedCount,
      version: nextVer,
      publishedAt: new Date().toISOString(),
      publishedBy,
      status: "SUCCESSFUL"
    };

    this.recordDeployment(record);

    try {
      await ApiService.publish(pageId, language, environment);
    } catch (err) {
      console.warn("Backend publish API warning:", err);
    }

    return {
      success: true,
      isDuplicate: false,
      version: nextVer,
      message: `Published v${nextVer} to ${environment} successfully`
    };
  }

  // --- PUBLISH APPROVAL REQUESTS ---
  static getPublishApprovalRequests(): import("../types").PublishApprovalRequest[] {
    try {
      const data = localStorage.getItem(this.STORAGE_KEYS.APPROVAL_REQUESTS);
      return data ? JSON.parse(data) : [];
    } catch {
      return [];
    }
  }

  static savePublishApprovalRequests(requests: import("../types").PublishApprovalRequest[]) {
    localStorage.setItem(this.STORAGE_KEYS.APPROVAL_REQUESTS, JSON.stringify(requests));
    this.emit();
  }

  static async requestPublishApproval(
    pageId: string,
    pageName: string,
    language: string,
    environment: Environment,
    tagCount: number,
    requestedBy: string
  ) {
    const newReq: import("../types").PublishApprovalRequest = {
      id: `req-${Date.now()}`,
      pageId,
      pageName,
      language,
      environment,
      tagCount,
      requestedBy,
      requestedAt: new Date().toISOString(),
      status: "PENDING"
    };

    const requests = this.getPublishApprovalRequests();
    this.savePublishApprovalRequests([newReq, ...requests]);

    try {
      await ApiService.requestPublishingApproval(pageId, language, environment);
    } catch (e) {
      console.warn("Backend requestPublishingApproval warning:", e);
    }

    return newReq;
  }

  static async reviewPublishApproval(
    requestId: string,
    action: "APPROVE" | "REJECT",
    reviewedBy: string
  ) {
    const requests = this.getPublishApprovalRequests();
    const req = requests.find(r => r.id === requestId);
    if (!req) return;

    req.status = action === "APPROVE" ? "APPROVED" : "REJECTED";
    req.reviewedBy = reviewedBy;
    req.reviewedAt = new Date().toISOString();
    this.savePublishApprovalRequests([...requests]);

    if (action === "APPROVE") {
      await this.publish(
        req.pageId,
        req.pageName,
        req.language,
        req.environment,
        req.tagCount,
        reviewedBy
      );
    }

    try {
      await ApiService.reviewPublishingApproval(requestId, action);
    } catch (e) {
      console.warn("Backend reviewPublishingApproval warning:", e);
    }
  }

  // --- HELPERS ---
  static getPageCoverage(pageId: string) {
    const tags = this.getTags(pageId);
    const activeLangs = this.getActiveLanguages();
    const coverage: Record<string, { approved: number, total: number }> = {};
    
    activeLangs.forEach(lang => {
      coverage[lang.code] = { approved: 0, total: tags.length };
    });

    tags.forEach(tag => {
      activeLangs.forEach(lang => {
        if (tag.values[lang.code]?.status === "Approved") {
          coverage[lang.code].approved++;
        }
      });
    });

    return coverage;
  }

  static getPageProductionCoverage(pageId: string) {
    const tags = this.getTags(pageId);
    const activeLangs = this.getActiveLanguages();
    const deployments = this.getDeployments().filter(d => d.pageId === pageId && d.environment === "PRODUCTION");
    const coverage: Record<string, { deployed: number, approved: number, total: number }> = {};
    
    activeLangs.forEach(lang => {
      const hasProdDep = deployments.some(d => d.language === lang.code);
      let approvedCount = 0;
      tags.forEach(tag => {
        if (tag.values[lang.code]?.status === "Approved") {
          approvedCount++;
        }
      });

      coverage[lang.code] = {
        deployed: hasProdDep ? approvedCount : 0,
        approved: approvedCount,
        total: tags.length
      };
    });

    return coverage;
  }

  /**
   * Completely resets all local storage caches, translations, deployments, approvals, and in-memory data.
   */
  static async resetAll(): Promise<void> {
    try {
      localStorage.removeItem(this.STORAGE_KEYS.LANGUAGES);
      localStorage.removeItem(this.STORAGE_KEYS.DEPLOYMENTS);
      localStorage.removeItem(this.STORAGE_KEYS.APPROVAL_REQUESTS);
      localStorage.removeItem(this.STORAGE_KEYS.BOOKMARKS);
      localStorage.removeItem(this.STORAGE_KEYS.LENGTH_CONFLICT_CONFIG);
      localStorage.removeItem(TRANSLATIONS_STORAGE_KEY);
      localStorage.removeItem("miotranslate_recent_edits");
      localStorage.removeItem("miotranslate_pages_cache");
      localStorage.removeItem("miotranslate_user_v1");

      const allKeys = Object.keys(localStorage);
      for (const k of allKeys) {
        if (k.startsWith(TAGS_STORAGE_KEY) || k.startsWith("miotranslate_")) {
          localStorage.removeItem(k);
        }
      }
    } catch (e) {
      console.warn("Error clearing localStorage:", e);
    }

    this.cache.pages = [];
    this.cache.tags = {};
    this.cache.pageDetails = {};

    await this.refreshPages();
    this.emit();
  }
}
