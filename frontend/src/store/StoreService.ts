import type { Page, Tag, LanguageConfig, DeploymentRecord, TranslationValue, Environment, UnpublishedPageSummary, PageLanguageReadiness, PageReleasePipelineItem, EnvironmentReleaseStatus } from "../types";
import { ApiService } from "../services/ApiService";
import { formatPageName } from "../utils/fileParser";

// ─────────────────────────────────────────────────
// Pure API-first StoreService — no localStorage for data.
// In-memory cache only for performance within a session.
// ─────────────────────────────────────────────────

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

const LENGTH_CONFLICT_STORAGE_KEY = "miotranslate_length_conflict_config";

function getStoredLengthConflictConfig(): LengthConflictConfig {
  try {
    if (typeof window !== "undefined" && window.localStorage) {
      const saved = localStorage.getItem(LENGTH_CONFLICT_STORAGE_KEY);
      if (saved) {
        return { ...DEFAULT_LENGTH_CONFLICT_CONFIG, ...JSON.parse(saved) };
      }
    }
  } catch (e) {
    console.warn("Failed to load length conflict config from localStorage", e);
  }
  return { ...DEFAULT_LENGTH_CONFLICT_CONFIG };
}

export class StoreService {
  private static listeners = new Set<() => void>();
  
  private static cache = {
    pages: [] as Page[],
    tags: {} as Record<string, Tag[]>,
    pageDetails: {} as Record<string, { page: Page; tags: Tag[] }>,
    deployments: [] as DeploymentRecord[],
    approvalRequests: [] as import("../types").PublishApprovalRequest[],
    confidenceThreshold: 95,
    lengthConflictConfig: getStoredLengthConflictConfig(),
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
      this.cache.pages = res || [];
      this.emit();
      // Fetch details in background for each page to populate tags & coverage cache
      Promise.all(this.cache.pages.map(p => this.refreshPageDetail(p.pageId))).then(() => {
        this.emit();
      });
    } catch (e) {
      console.warn("ApiService.getPages failed:", e);
    }
  }

  static getPages(): Page[] {
    return this.cache.pages;
  }

  static getPage(pageId: string): Page | undefined {
    return this.cache.pages.find(p => p.pageId === pageId)
      || this.cache.pageDetails[pageId]?.page;
  }

  static async updatePageName(pageId: string, newName: string) {
    const cleanName = newName.trim();
    if (!cleanName) return;

    // Optimistic update
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
      console.warn("Backend update page name error:", e);
    }
  }

  static async createPage(page: Page) {
    // Optimistic update
    const existingIdx = this.cache.pages.findIndex(p => p.pageId === page.pageId);
    if (existingIdx >= 0) {
      this.cache.pages[existingIdx] = { ...this.cache.pages[existingIdx], ...page };
    } else {
      this.cache.pages = [...this.cache.pages, page];
    }
    this.emit();

    try {
      await ApiService.createPage({
        pageId: page.pageId,
        pageName: page.name,
        module: page.module
      });
      await this.refreshPages();
    } catch (e) {
      console.warn("Backend create page error:", e);
    }
  }

  static async bulkImportPages(pagesToUpload: Array<{
    pageId: string;
    name: string;
    module: string;
    status?: string;
    tags: Array<{
      id: string;
      type?: string;
      english: string;
      values?: Record<string, { text: string; status?: string; confidence?: number }>;
    }>;
  }>): Promise<{ totalPages: number; totalTags: number }> {
    let totalTagsCount = 0;

    // Sync with backend API
    for (const p of pagesToUpload) {
      const pageId = p.pageId.trim().toUpperCase();
      const pageName = p.name?.trim() || formatPageName(pageId);
      const pageModule = p.module?.trim() || "General";

      try {
        await ApiService.createPage({
          pageId,
          pageName,
          module: pageModule
        });
      } catch (e) {
        // Page may already exist, continue
      }

      if (p.tags && p.tags.length > 0) {
        // Sync tags in small batches
        const chunks = [];
        for (let i = 0; i < p.tags.length; i += 10) {
          chunks.push(p.tags.slice(i, i + 10));
        }
        for (const chunk of chunks) {
          await Promise.allSettled(
            chunk.map(t => {
              totalTagsCount++;
              return ApiService.createTag(pageId, {
                id: t.id,
                type: t.type || "General",
                english: t.english
              });
            })
          );
        }

        // Sync translations for tags that have translation values
        for (const t of p.tags) {
          if (t.values) {
            for (const [lang, val] of Object.entries(t.values)) {
              if (val && val.text) {
                try {
                  const targetStatus = (val.status === "Approved" || !val.status) ? "Approved" : 
                                       val.status === "Draft" ? "Draft" : "Pending Review";
                  await ApiService.updateTranslation(t.id, lang, val.text, targetStatus as any);
                } catch {
                  // Safe to ignore per-translation errors
                }
              }
            }
          }
        }
      }
    }

    // Refresh everything from DB
    await this.refreshPages();

    return {
      totalPages: pagesToUpload.length,
      totalTags: totalTagsCount
    };
  }

  // --- PAGE DETAILS & TAGS ---
  static async refreshPageDetail(pageId: string) {
    try {
      const detail = await ApiService.getPageDetail(pageId);
      this.cache.pageDetails[pageId] = detail;
      this.cache.tags[pageId] = detail.tags;
      this.emit();
    } catch {
      if (!this.cache.tags[pageId]) {
        this.cache.tags[pageId] = [];
      }
      console.warn(`ApiService.getPageDetail(${pageId}) failed`);
    }
  }

  static getTags(pageId: string): Tag[] {
    return this.cache.tags[pageId] || [];
  }

  static getTag(pageId: string, tagId: string): Tag | undefined {
    return this.getTags(pageId).find(t => t.id === tagId);
  }

  static async createTag(pageId: string, tag: Tag) {
    // Optimistic update
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
    this.emit();

    try {
      await ApiService.createTag(pageId, {
        id: tag.id,
        type: tag.type || "General",
        english: tag.english
      });
      await this.refreshPageDetail(pageId);
    } catch (e) {
      console.warn("Backend create tag error:", e);
    }
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
      console.warn("Backend update tag type error:", e);
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
        console.warn("Backend update english error:", e);
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

    // Mark existing translations with text as stale
    if (tag.values) {
      Object.keys(tag.values).forEach(lang => {
        const v = tag.values[lang];
        if (v && (v.status === "Approved" || v.status === "Pending Review" || v.status === "Draft" || (v.text && v.text.trim().length > 0))) {
          v.status = "Stale";
          v.lastUpdated = new Date().toISOString();
        }
      });
    }
    this.emit();

    try {
      await ApiService.approveEnglishCopy(tagId);
      await this.refreshPageDetail(pageId);
    } catch (e) {
      console.warn("Backend approve english error:", e);
    }
  }

  static async saveEnglishAndApprove(pageId: string, tagId: string, newEnglish: string, changeReason?: string) {
    await this.updateEnglish(pageId, tagId, newEnglish, changeReason);
    await this.approveEnglish(pageId, tagId);
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
      this.emit();
    }

    if (newValue.text !== undefined || newValue.status !== undefined) {
      try {
        const text = newValue.text !== undefined ? newValue.text : tag?.values[langCode]?.text || "";
        const status = newValue.status === "Approved" ? "Approved" : newValue.status === "Draft" ? "Draft" : "Pending Review";
        const confidence = newValue.confidence !== undefined ? newValue.confidence : tag?.values[langCode]?.confidence;
        await ApiService.updateTranslation(tagId, langCode, text, status, confidence);
      } catch (e) {
        console.warn("Backend translation update error:", e);
      }
    }
  }

  static async approveTranslation(pageId: string, tagId: string, langCode: string) {
    const tags = this.getTags(pageId);
    const tag = tags.find(t => t.id === tagId);
    if (tag) {
      if (!tag.values) tag.values = {};
      const current = tag.values[langCode] || { text: "", status: "Pending Review", confidence: 95, translatedAtEnglishVersion: 1 };
      const merged: TranslationValue = {
        ...current,
        status: "Approved",
        lastUpdated: new Date().toISOString()
      };
      tag.values[langCode] = merged;
      tag.updatedAt = new Date().toISOString();
      this.emit();
    }

    try {
      await ApiService.approveTranslation(tagId, langCode);
    } catch (e) {
      console.warn("Backend approve translation error:", e);
    }
  }

  static async batchUpdateTranslations(
    pageId: string,
    langCode: string,
    updates: { tagId: string; value: Partial<TranslationValue> }[]
  ) {
    const tags = this.getTags(pageId);
    const now = new Date().toISOString();
    
    // 1. Optimistic in-memory update
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
      }
    });

    this.emit();

    // 2. Persist to backend database in parallel chunks
    const chunks = [];
    for (let i = 0; i < updates.length; i += 10) {
      chunks.push(updates.slice(i, i + 10));
    }

    for (const chunk of chunks) {
      await Promise.allSettled(
        chunk.map(async ({ tagId, value }) => {
          if (value.text !== undefined && value.text.trim() !== "") {
            const targetStatus = (value.status === "Approved")
              ? "Approved" 
              : (value.status === "Draft")
              ? "Draft"
              : "Pending Review";
            try {
              await ApiService.updateTranslation(tagId, langCode, value.text, targetStatus as any, value.confidence);
            } catch (err) {
              console.warn(`Failed to persist translation for tag ${tagId} (${langCode}):`, err);
            }
          }
        })
      );
    }

    // 3. Refresh page detail from DB so store remains in sync with the database
    await this.refreshPageDetail(pageId);
  }

  static async rejectTranslation(pageId: string, tagId: string, langCode: string, reason: string) {
    await this.updateTranslation(pageId, tagId, langCode, {
      status: "Draft",
      stateCause: `Rejected: ${reason}`
    });
    try {
      await ApiService.rejectTranslation(tagId, langCode, reason);
    } catch (e) {
      console.warn("Backend reject translation error:", e);
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
      console.warn("Backend return for revision error:", e);
    }
  }

  static async confirmStaleTranslation(pageId: string, tagId: string, langCode: string) {
    const tag = this.getTag(pageId, tagId);
    const currentVal = tag?.values?.[langCode];
    if (tag && currentVal) {
      tag.values[langCode] = {
        ...currentVal,
        status: "Approved",
        translatedAtEnglishVersion: tag.englishVersion || 1,
        lastUpdated: new Date().toISOString()
      };
      tag.updatedAt = new Date().toISOString();
      this.emit();

      try {
        await ApiService.confirmStaleTranslation(tagId, langCode);
        await this.refreshPageDetail(pageId);
      } catch (e) {
        console.warn("Backend confirm stale error:", e);
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

  static saveLanguages(_languages: LanguageConfig[]) {
    // No-op — languages are managed via admin API, not client storage
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
          const isStale = val.status === "Stale" || (Boolean(val.text) && (tag.englishVersion || 1) > 1 && (val.translatedAtEnglishVersion || 0) > 0 && (val.translatedAtEnglishVersion || 0) < (tag.englishVersion || 1) && val.status !== "Approved");
          if ((!langCode || code === langCode) && isStale) {
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
    return this.cache.confidenceThreshold;
  }

  static setConfidenceThreshold(threshold: number) {
    this.cache.confidenceThreshold = threshold;
    this.emit();
  }

  static getLengthConflictConfig(): LengthConflictConfig {
    return { ...this.cache.lengthConflictConfig };
  }

  static setLengthConflictConfig(config: Partial<LengthConflictConfig>) {
    this.cache.lengthConflictConfig = { ...this.cache.lengthConflictConfig, ...config };
    try {
      if (typeof window !== "undefined" && window.localStorage) {
        localStorage.setItem(LENGTH_CONFLICT_STORAGE_KEY, JSON.stringify(this.cache.lengthConflictConfig));
      }
    } catch (e) {
      console.warn("Failed to save length conflict config to localStorage", e);
    }
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

  static getLengthConflictTagIds(pageId: string, langCode?: string): Set<string> {
    const config = this.getLengthConflictConfig();
    if (!config.enabled) {
      return new Set();
    }
    const conflicts = this.getLengthConflicts();
    const matching = conflicts.filter(c => c.pageId === pageId && (!langCode || c.languageCode === langCode));
    return new Set(matching.map(c => c.tagId));
  }

  // --- DEPLOYMENTS & RELEASES ---
  static getDeployments(): DeploymentRecord[] {
    return this.cache.deployments;
  }

  static saveDeployments(records: DeploymentRecord[]) {
    this.cache.deployments = records;
    this.emit();
  }

  static recordDeployment(record: DeploymentRecord) {
    this.cache.deployments = [record, ...this.cache.deployments];
    this.emit();
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

    // Check variable placeholder integrity
    const varRegex = /(?:\{[^}]+\}|%[0-9]*\$?[a-zA-Z])/g;
    let variableErrorsCount = 0;
    if (!isEng) {
      approvedTags.forEach(tag => {
        const engVars: string[] = Array.from((tag.english || "").match(varRegex) || []);
        const transText = tag.values?.[language]?.text || "";
        const transVars: string[] = Array.from(transText.match(varRegex) || []);
        if (engVars.length > 0) {
          const hasAll = engVars.every(v => transVars.includes(v));
          if (!hasAll) variableErrorsCount++;
        }
      });
    }

    const lastPubDate = latest ? new Date(latest.publishedAt).getTime() : 0;
    const hasRecentUpdates = Boolean(
      latest &&
      approvedTags.length > 0 &&
      tags.some(t => {
        if (isEng) {
          const engTime = t.updatedAt ? new Date(t.updatedAt).getTime() : 0;
          return engTime > lastPubDate + 2000;
        }
        const val = t.values?.[language];
        if (!val || val.status !== "Approved") return false;
        const valTime = val.lastUpdated ? new Date(val.lastUpdated).getTime() : 0;
        return valTime > lastPubDate + 2000;
      })
    );
    const isDuplicate = Boolean(latest && latest.tagCount === approvedTags.length && approvedTags.length > 0 && !hasRecentUpdates);

    return {
      totalCount: approvedTags.length,
      totalTagsCount: tags.length,
      newCount,
      updatedCount,
      previousVersion: latest ? latest.version : null,
      nextVersion: this.getNextVersion(pageId, language, environment),
      isDuplicate,
      variableErrorsCount,
      approvedTags
    };
  }

  static getMultiLanguagePublishSummary(pageId: string, environment: Environment) {
    const activeLangs = this.getActiveLanguages();
    const tags = this.getTags(pageId);
    const totalTags = tags.length;

    const summaries = activeLangs.map(lang => {
      const diff = this.getPublishDiffSummary(pageId, lang.code, environment);
      const approvedCount = diff.totalCount;
      const excludedCount = Math.max(0, totalTags - approvedCount);
      const coveragePercent = totalTags > 0 ? Math.round((approvedCount / totalTags) * 100) : 0;

      return {
        code: lang.code,
        name: lang.name,
        nativeName: lang.nativeName,
        totalTags,
        approvedCount,
        excludedCount,
        coveragePercent,
        isReady: approvedCount > 0 && coveragePercent === 100,
        newCount: diff.newCount,
        updatedCount: diff.updatedCount,
        previousVersion: diff.previousVersion,
        nextVersion: diff.nextVersion,
        isDuplicate: diff.isDuplicate,
        variableErrorsCount: diff.variableErrorsCount,
        approvedTags: diff.approvedTags
      };
    });

    const totalApprovedAcrossAll = summaries.reduce((acc, s) => acc + s.approvedCount, 0);
    const totalExcludedAcrossAll = summaries.reduce((acc, s) => acc + s.excludedCount, 0);
    const totalVariableErrors = summaries.reduce((acc, s) => acc + s.variableErrorsCount, 0);
    const fullyReadyLanguagesCount = summaries.filter(s => s.isReady).length;
    const incompleteLanguages = summaries.filter(s => s.approvedCount < s.totalTags && s.totalTags > 0);

    return {
      summaries,
      totalTags,
      totalApprovedAcrossAll,
      totalExcludedAcrossAll,
      totalVariableErrors,
      fullyReadyLanguagesCount,
      totalLanguagesCount: activeLangs.length,
      incompleteLanguages
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

    // Duplicate publish guard
    if (latest && latest.tagCount === approvedCount && approvedCount > 0) {
      const lastPubDate = new Date(latest.publishedAt).getTime();
      const tags = this.getTags(pageId);
      const isEng = language === "eng" || language === "en";
      const hasRecentUpdates = tags.some(t => {
        if (isEng) {
          const engTime = t.updatedAt ? new Date(t.updatedAt).getTime() : 0;
          return engTime > lastPubDate + 2000;
        }
        const val = t.values?.[language];
        if (!val || val.status !== "Approved") return false;
        const valTime = val.lastUpdated ? new Date(val.lastUpdated).getTime() : 0;
        return valTime > lastPubDate + 2000;
      });

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
      id: `dep-${Date.now()}-${language}`,
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

  static async publishMultiLanguage(
    pageId: string,
    pageName: string,
    languages: string[],
    environment: Environment,
    publishedBy: string = "System User"
  ): Promise<{
    success: boolean;
    results: { language: string; version: number; count: number; isDuplicate: boolean }[];
    totalStringsDeployed: number;
    timestamp: string;
  }> {
    const results: { language: string; version: number; count: number; isDuplicate: boolean }[] = [];
    let totalStringsDeployed = 0;
    const langsToProcess = languages.includes("eng") ? [...languages] : ["eng", ...languages];

    for (const langCode of langsToProcess) {
      const isEng = langCode === "eng" || langCode === "en";
      const tags = this.getTags(pageId);
      const approvedCount = isEng 
        ? tags.filter(t => t.english && t.english.trim().length > 0).length
        : tags.filter(t => t.values?.[langCode]?.status === "Approved").length;

      if (approvedCount === 0) continue;

      const res = await this.publish(pageId, pageName, langCode, environment, approvedCount, publishedBy);
      results.push({
        language: langCode,
        version: res.version,
        count: approvedCount,
        isDuplicate: res.isDuplicate
      });
      totalStringsDeployed += approvedCount;
    }

    return {
      success: true,
      results,
      totalStringsDeployed,
      timestamp: new Date().toISOString()
    };
  }

  // --- PUBLISH APPROVAL REQUESTS ---
  static getPublishApprovalRequests(): import("../types").PublishApprovalRequest[] {
    return this.cache.approvalRequests;
  }

  static savePublishApprovalRequests(requests: import("../types").PublishApprovalRequest[]) {
    this.cache.approvalRequests = requests;
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

    this.cache.approvalRequests = [newReq, ...this.cache.approvalRequests];
    this.emit();

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
    this.cache.approvalRequests = [...requests];
    this.emit();

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

  static getRecentPublishHistory(limit: number = 10): DeploymentRecord[] {
    return [...this.getDeployments()]
      .sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime())
      .slice(0, limit);
  }

  static getUnpublishedPages(environment: Environment = "PRODUCTION"): UnpublishedPageSummary[] {
    const pages = this.getPages().filter(p => p.status !== "Deprecated");
    const activeLangs = this.getActiveLanguages();
    const deployments = this.getDeployments();
    const pendingApprovals = this.getPublishApprovalRequests().filter(r => r.status === "PENDING" && r.environment === environment);

    return pages.map(page => {
      const tags = this.getTags(page.pageId);
      const totalTags = tags.length;

      const languages: PageLanguageReadiness[] = activeLangs.map(lang => {
        const isEng = lang.code === "eng" || lang.code === "en";
        const approvedTags = isEng 
          ? tags.filter(t => t.english && t.english.trim().length > 0)
          : tags.filter(t => t.values?.[lang.code]?.status === "Approved");
        
        const approvedCount = approvedTags.length;
        const coveragePercent = totalTags > 0 ? Math.round((approvedCount / totalTags) * 100) : 0;
        
        const envDeps = deployments.filter(d => d.pageId === page.pageId && d.language === lang.code && d.environment === environment);
        const latest = envDeps.sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime())[0];

        const lastPubDate = latest ? new Date(latest.publishedAt).getTime() : 0;
        const hasRecentUpdates = Boolean(
          latest &&
          approvedCount > 0 &&
          tags.some(t => {
            if (isEng) {
              const engTime = t.updatedAt ? new Date(t.updatedAt).getTime() : 0;
              return engTime > lastPubDate + 2000;
            }
            const val = t.values?.[lang.code];
            if (!val || val.status !== "Approved") return false;
            const valTime = val.lastUpdated ? new Date(val.lastUpdated).getTime() : 0;
            return valTime > lastPubDate + 2000;
          })
        );
        
        const hasChanges = latest 
          ? (latest.tagCount !== approvedCount || hasRecentUpdates)
          : (approvedCount > 0);

        const staleCount = tags.filter(t => t.values?.[lang.code]?.status === "Stale").length;
        const isPending = pendingApprovals.some(r => r.pageId === page.pageId && r.language === lang.code);

        // Variable check
        const varRegex = /(?:\{[^}]+\}|%[0-9]*\$?[a-zA-Z])/g;
        let variableErrorsCount = 0;
        if (!isEng) {
          approvedTags.forEach(tag => {
            const engVars = Array.from((tag.english || "").match(varRegex) || []);
            const transText = tag.values?.[lang.code]?.text || "";
            const transVars = Array.from(transText.match(varRegex) || []);
            if (engVars.length > 0 && !engVars.every(v => transVars.includes(v))) {
              variableErrorsCount++;
            }
          });
        }

        return {
          code: lang.code,
          name: lang.name,
          nativeName: lang.nativeName,
          approvedCount,
          totalTags,
          coveragePercent,
          lastPublishedVersion: latest ? latest.version : null,
          lastPublishedAt: latest ? latest.publishedAt : null,
          hasChanges,
          staleCount,
          isPending,
          variableErrorsCount
        };
      });

      const hasUnpublishedChanges = languages.some(l => l.hasChanges);
      const totalVarErrors = languages.reduce((acc, l) => acc + l.variableErrorsCount, 0);

      let overallReadiness: "ready" | "partial" | "blocked" | "up-to-date" = "up-to-date";
      if (totalVarErrors > 0) {
        overallReadiness = "blocked";
      } else if (hasUnpublishedChanges) {
        const allReady = languages.length > 0 && languages.every(l => l.coveragePercent === 100);
        overallReadiness = allReady ? "ready" : "partial";
      } else {
        overallReadiness = "up-to-date";
      }

      return {
        pageId: page.pageId,
        pageName: page.name,
        module: page.module,
        totalTags,
        languages,
        hasUnpublishedChanges,
        overallReadiness
      };
    });
  }

  static getUnpublishedCount(environment: Environment = "PRODUCTION"): number {
    return this.getUnpublishedPages(environment).filter(p => p.hasUnpublishedChanges).length;
  }

  static getPageReleasePipeline(): PageReleasePipelineItem[] {
    const pages = this.getPages().filter(p => p.status !== "Deprecated");
    const deployments = this.getDeployments();
    const pendingApprovals = this.getPublishApprovalRequests().filter(r => r.status === "PENDING");

    const unpublishedDev = this.getUnpublishedPages("DEV");
    const unpublishedQa = this.getUnpublishedPages("QA");
    const unpublishedProd = this.getUnpublishedPages("PRODUCTION");

    return pages.map(page => {
      const pDev = unpublishedDev.find(p => p.pageId === page.pageId);
      const pQa = unpublishedQa.find(p => p.pageId === page.pageId);
      const pProd = unpublishedProd.find(p => p.pageId === page.pageId);

      const devDeps = deployments.filter(d => d.pageId === page.pageId && d.environment === "DEV");
      const qaDeps = deployments.filter(d => d.pageId === page.pageId && d.environment === "QA");
      const prodDeps = deployments.filter(d => d.pageId === page.pageId && d.environment === "PRODUCTION");

      const latestDev = devDeps.sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime())[0];
      const latestQa = qaDeps.sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime())[0];
      const latestProd = prodDeps.sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime())[0];

      const devStatus: EnvironmentReleaseStatus = {
        version: latestDev?.version ?? null,
        lastPublishedAt: latestDev?.publishedAt ?? null,
        hasUnpublishedChanges: pDev?.hasUnpublishedChanges ?? false,
        deployedLanguagesCount: new Set(devDeps.map(d => d.language)).size
      };

      const qaStatus: EnvironmentReleaseStatus = {
        version: latestQa?.version ?? null,
        lastPublishedAt: latestQa?.publishedAt ?? null,
        hasUnpublishedChanges: pQa?.hasUnpublishedChanges ?? false,
        deployedLanguagesCount: new Set(qaDeps.map(d => d.language)).size
      };

      const prodStatus: EnvironmentReleaseStatus = {
        version: latestProd?.version ?? null,
        lastPublishedAt: latestProd?.publishedAt ?? null,
        hasUnpublishedChanges: pProd?.hasUnpublishedChanges ?? false,
        deployedLanguagesCount: new Set(prodDeps.map(d => d.language)).size
      };

      const hasGate = pendingApprovals.some(r => r.pageId === page.pageId);
      const totalTags = this.getTags(page.pageId).length || (pProd?.totalTags ?? 0);

      let pipelineState: "IN_SYNC" | "NEEDS_RELEASE" | "NEEDS_QA" | "APPROVAL_PENDING" | "UNRELEASED" = "UNRELEASED";
      let pendingChangesSummary = "Draft";

      if (hasGate) {
        pipelineState = "APPROVAL_PENDING";
        pendingChangesSummary = "Production gate awaiting sign-off";
      } else if (prodStatus.version !== null && !prodStatus.hasUnpublishedChanges) {
        pipelineState = "IN_SYNC";
        pendingChangesSummary = "All copy live and synced on Production";
      } else if (prodStatus.hasUnpublishedChanges) {
        pipelineState = "NEEDS_RELEASE";
        const changedLangs = pProd?.languages.filter(l => l.hasChanges).length || 0;
        pendingChangesSummary = prodStatus.version 
          ? `${changedLangs} language${changedLangs === 1 ? '' : 's'} updated since v${prodStatus.version}`
          : `${changedLangs} language${changedLangs === 1 ? '' : 's'} pending release to Production`;
      } else if (qaStatus.version !== null && prodStatus.version === null) {
        pipelineState = "NEEDS_RELEASE";
        pendingChangesSummary = `On QA (v${qaStatus.version}), ready for Production`;
      } else if (devStatus.version !== null && qaStatus.version === null) {
        pipelineState = "NEEDS_QA";
        pendingChangesSummary = `On Dev (v${devStatus.version}), needs QA promotion`;
      } else {
        pipelineState = "UNRELEASED";
        pendingChangesSummary = "Unreleased draft";
      }

      return {
        pageId: page.pageId,
        pageName: page.name,
        module: page.module,
        totalTags,
        dev: devStatus,
        qa: qaStatus,
        production: prodStatus,
        pipelineState,
        pendingChangesSummary,
        hasProductionChanges: prodStatus.hasUnpublishedChanges,
        languages: pProd?.languages || []
      };
    });
  }
}

