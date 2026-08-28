import type { Page, Tag, TranslationValue, Environment } from "../types";

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

  static async createPage(page: { pageId: string; pageName: string; module: string }) {
    const res = await fetch(`${API_BASE}/pages`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        pageId: page.pageId,
        pageName: page.pageName,
        module: page.module,
        status: "ACTIVE"
      })
    });
    if (!res.ok) throw new Error("Failed to create page");
    return await res.json();
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

  static async createTag(pageId: string, tag: { id: string; type: string; english?: string }) {
    const res = await fetch(`${API_BASE}/pages/${pageId}/tags`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        tagId: tag.id,
        copyType: tag.type.toUpperCase(),
        status: "ACTIVE"
      })
    });
    if (!res.ok) throw new Error("Failed to create tag");

    if (tag.english && tag.english.trim()) {
      await this.updateEnglishCopy(tag.id, tag.english, "Initial copy");
    }
    return await res.json();
  }

  static async deprecateTag(tagId: string) {
    const res = await fetch(`${API_BASE}/tags/${tagId}/deprecate`, {
      method: "POST"
    });
    if (!res.ok) throw new Error("Failed to deprecate tag");
    return await res.json();
  }

  static async updateEnglishCopy(tagId: string, text: string, changeReason: string) {
    const res = await fetch(`${API_BASE}/tags/${tagId}/english-copy/draft`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text, changeReason })
    });
    if (!res.ok) throw new Error("Failed to update English copy draft");
    
    // Automatically approve master copy update
    await fetch(`${API_BASE}/tags/${tagId}/english-copy/review`, {
      method: "POST"
    });
  }

  static async updateTranslation(
    tagId: string, 
    langCode: string, 
    text: string, 
    targetStatus: "Approved" | "Pending Review" | "Draft" = "Approved"
  ) {
    const res = await fetch(`${API_BASE}/tags/${tagId}/translations/${langCode}/draft`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ translatedText: text })
    });
    if (!res.ok) throw new Error("Failed to update translation draft");
    
    if (targetStatus === "Approved") {
      await fetch(`${API_BASE}/tags/${tagId}/translations/${langCode}/review`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "APPROVE" })
      });
    } else if (targetStatus === "Pending Review") {
      await fetch(`${API_BASE}/tags/${tagId}/translations/${langCode}/submit`, {
        method: "POST"
      });
    }
  }

  static async generateAiTranslationsBulk(pageId: string, langCode: string) {
    const res = await fetch(`${API_BASE}/pages/${pageId}/translations/${langCode}/generate-all`, {
      method: "POST"
    });
    if (!res.ok) throw new Error("Failed to generate bulk AI translations");
    return await res.json();
  }

  static async bulkApproveTranslations(pageId: string, langCode: string) {
    const res = await fetch(`${API_BASE}/pages/${pageId}/translations/${langCode}/bulk-approve`, {
      method: "POST"
    });
    if (!res.ok) throw new Error("Failed to bulk approve translations");
    return await res.json();
  }

  static async publish(pageId: string, languageCode: string, environment: Environment) {
    const res = await fetch(`${API_BASE}/pages/${pageId}/languages/${languageCode}/environments/${environment}/publish`, {
      method: "POST",
      headers: { "Content-Type": "application/json" }
    });
    if (!res.ok) {
      throw new Error(`Failed to publish to ${environment}`);
    }
    return await res.json();
  }

  static async getDeploymentHistory(pageId: string, languageCode: string) {
    const res = await fetch(`${API_BASE}/pages/${pageId}/languages/${languageCode}/deployments`);
    if (!res.ok) throw new Error("Failed to fetch deployment history");
    return await res.json();
  }

  static async rollback(pageId: string, languageCode: string, environment: Environment, targetReleaseId: string) {
    const res = await fetch(`${API_BASE}/pages/${pageId}/languages/${languageCode}/environments/${environment}/rollback`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ targetReleaseId })
    });
    if (!res.ok) throw new Error("Failed to execute rollback");
    return await res.json();
  }
}
