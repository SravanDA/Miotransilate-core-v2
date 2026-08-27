import type { Page, Tag, TranslationValue } from "../types";

const API_BASE = '/v1';

export class ApiService {
  static async getPages(): Promise<Page[]> {
    const res = await fetch(`${API_BASE}/pages`);
    if (!res.ok) throw new Error("Failed to fetch pages");
    const pages = await res.json();
    return pages.map((p: any) => ({
      pageId: p.pageId,
      name: p.pageName,
      module: p.module,
      status: p.status === 'ACTIVE' ? 'Active' : 'Deprecated',
      createdAt: p.createdAt
    }));
  }

  static async getPageDetail(pageId: string): Promise<{ page: Page, tags: Tag[] }> {
    const res = await fetch(`${API_BASE}/pages/${pageId}/detail`);
    if (!res.ok) throw new Error("Failed to fetch page detail");
    const data = await res.json();
    
    const page: Page = {
      pageId: data.page.pageId,
      name: data.page.pageName,
      module: data.page.module,
      status: data.page.status === 'ACTIVE' ? 'Active' : 'Deprecated',
      createdAt: data.page.createdAt
    };

    const tags: Tag[] = data.tags.map((t: any) => {
      const values: Record<string, TranslationValue> = {};
      Object.keys(t.values || {}).forEach(lang => {
        const trans = t.values[lang];
        
        let status = "No Trans";
        if (trans.status === "APPROVED") status = "Approved";
        else if (trans.status === "DRAFT") status = "Draft";
        else if (trans.status === "PENDING_REVIEW") status = "Pending Review";
        else if (trans.status === "STALE") status = "Stale";

        values[lang] = {
          text: trans.text || "",
          status: status as any,
          confidence: trans.confidence || 0,
          translatedAtEnglishVersion: trans.translatedAtEnglishVersion || 0,
          lastUpdated: trans.lastUpdated || new Date().toISOString()
        };
      });

      return {
        id: t.id,
        pageId: t.pageId,
        type: t.type,
        english: t.english || "",
        englishVersion: t.englishVersion || 0,
        values: values,
        comments: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
    });

    return { page, tags };
  }

  static async updateEnglishCopy(tagId: string, text: string, changeReason: string) {
    const res = await fetch(`${API_BASE}/tags/${tagId}/english-copy/draft`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text, changeReason })
    });
    if (!res.ok) throw new Error("Failed to update English copy");
    
    // Also approve it right away for simplification in this UI flow
    await fetch(`${API_BASE}/tags/${tagId}/english-copy/review`, {
      method: "POST"
    });
  }

  static async updateTranslation(tagId: string, langCode: string, text: string) {
    const res = await fetch(`${API_BASE}/tags/${tagId}/translations/${langCode}/draft`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ translatedText: text })
    });
    if (!res.ok) throw new Error("Failed to update translation");
    
    // And auto-approve
    await fetch(`${API_BASE}/tags/${tagId}/translations/${langCode}/review`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "APPROVE" })
    });
  }
}
