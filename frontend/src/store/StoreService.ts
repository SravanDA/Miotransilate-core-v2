import type { Page, Tag, LanguageConfig, DeploymentRecord, TranslationValue, Environment } from "../types";
import { ApiService } from "../services/ApiService";

export class StoreService {
  private static readonly STORAGE_KEYS = {
    LANGUAGES: "miotranslate_languages_v2",
    DEPLOYMENTS: "miotranslate_deployments_v2"
  };

  private static listeners = new Set<() => void>();
  
  private static cache = {
    pages: [] as Page[],
    tags: {} as Record<string, Tag[]>,
    pageDetails: {} as Record<string, { page: Page, tags: Tag[] }>
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
      this.cache.pages = await ApiService.getPages();
      this.emit();
      // Fetch details in background for each page to populate tags & coverage cache
      Promise.all(this.cache.pages.map(p => this.refreshPageDetail(p.pageId))).then(() => {
        this.emit();
      });
    } catch (e) {
      console.error(e);
    }
  }

  static getPages(): Page[] {
    return this.cache.pages;
  }

  static getPage(pageId: string): Page | undefined {
    return this.getPages().find(p => p.pageId === pageId) || this.cache.pageDetails[pageId]?.page;
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
      this.cache.pageDetails[pageId] = detail;
      this.cache.tags[pageId] = detail.tags;
      this.emit();
    } catch (e) {
      console.error(e);
    }
  }

  static getTags(pageId: string): Tag[] {
    return this.cache.tags[pageId] || [];
  }

  static getTag(pageId: string, tagId: string): Tag | undefined {
    return this.getTags(pageId).find(t => t.id === tagId);
  }

  static async createTag(pageId: string, tag: Tag) {
    const tags = this.getTags(pageId);
    if (!tags.find(t => t.id === tag.id)) {
      this.cache.tags[pageId] = [tag, ...tags];
      this.emit();
    }
    try {
      await ApiService.createTag(pageId, {
        id: tag.id,
        type: tag.type,
        english: tag.english
      });
      await this.refreshPageDetail(pageId);
    } catch (e) {
      console.warn("Backend create tag error (kept local update):", e);
    }
  }

  static async updateEnglish(pageId: string, tagId: string, newEnglish: string) {
    const tags = this.getTags(pageId);
    const idx = tags.findIndex(t => t.id === tagId);
    if (idx === -1) return;

    const tag = tags[idx];
    if (tag.english !== newEnglish) {
      tag.english = newEnglish;
      tag.englishVersion = (tag.englishVersion || 1) + 1;
      tag.updatedAt = new Date().toISOString();
      
      // Mark existing translations as stale
      if (tag.values) {
        Object.keys(tag.values).forEach(lang => {
          if (tag.values[lang].status === "Approved") {
            tag.values[lang].status = "Stale";
          }
        });
      }
      this.emit();

      try {
        await ApiService.updateEnglishCopy(tagId, newEnglish, "Manual update");
        await this.refreshPageDetail(pageId);
      } catch (e) {
        console.warn("Backend update error (kept local update):", e);
      }
    }
  }

  static async updateTranslation(pageId: string, tagId: string, langCode: string, newValue: Partial<TranslationValue>) {
    const tags = this.getTags(pageId);
    const tag = tags.find(t => t.id === tagId);
    if (tag) {
      if (!tag.values) tag.values = {};
      tag.values[langCode] = {
        ...(tag.values[langCode] || { text: "", status: "No Trans", confidence: 0, translatedAtEnglishVersion: 1 }),
        ...newValue,
        lastUpdated: new Date().toISOString()
      };
      tag.updatedAt = new Date().toISOString();
      this.emit();
    }

    if (newValue.text !== undefined) {
      try {
        await ApiService.updateTranslation(tagId, langCode, newValue.text);
        await this.refreshPageDetail(pageId);
      } catch (e) {
        console.warn("Backend translation update error (kept local update):", e);
      }
    }
  }

  static initEmptyValuesForTag(tag: Tag) {
    const activeLangs = this.getActiveLanguages();
    if (!tag.values) tag.values = {};
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
      if (data) return JSON.parse(data);
    } catch {}

    return [
      { code: "ar", name: "Arabic", nativeName: "العربية", direction: "RTL", active: true, langServiceCode: "arabic" },
      { code: "es", name: "Spanish", nativeName: "Español", direction: "LTR", active: true, langServiceCode: "spanish" },
      { code: "tr", name: "Turkish", nativeName: "Türkçe", direction: "LTR", active: true, langServiceCode: "turkish" },
      { code: "bg", name: "Bulgarian", nativeName: "Български", direction: "LTR", active: true, langServiceCode: "bulgarian" },
      { code: "it", name: "Italian", nativeName: "Italiano", direction: "LTR", active: true, langServiceCode: "italian" },
      { code: "fr", name: "French", nativeName: "Français", direction: "LTR", active: true, langServiceCode: "french" },
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
            result.push({
              tag: tag.id,
              page: page.name,
              pageId: page.pageId,
              langName: langName,
              langCode: code,
              age: val.lastUpdated ? Math.max(1, Math.floor((new Date().getTime() - new Date(val.lastUpdated).getTime()) / (1000 * 3600 * 24))) + "d" : "1d",
              change: `v${val.translatedAtEnglishVersion} -> v${tag.englishVersion}`
            });
          }
        }
      }
    }
    return result;
  }

  // --- DEPLOYMENTS ---
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

  static async publish(pageId: string, pageName: string, language: string, environment: Environment, approvedCount: number) {
    const record: DeploymentRecord = {
      id: `dep-${Date.now()}`,
      pageId,
      pageName,
      language,
      environment,
      tagCount: approvedCount,
      version: 1,
      publishedAt: new Date().toISOString(),
      publishedBy: "System User",
      status: "SUCCESSFUL"
    };

    this.recordDeployment(record);

    try {
      await ApiService.publish(pageId, language, environment);
    } catch (err) {
      console.warn("Backend publish API warning:", err);
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
}
