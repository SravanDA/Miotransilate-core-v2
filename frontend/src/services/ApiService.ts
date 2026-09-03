import type { Page, Tag, TranslationValue, Environment } from "../types";
import { apiClient } from "../api/client";

const API_BASE = '/v1';

export class ApiService {
  static async getPages(): Promise<Page[]> {
    const res = await apiClient.get(`${API_BASE}/pages`);
    const pages = res.data;
    return pages.map((p: any) => ({
      pageId: p.pageId,
      name: p.pageName,
      module: p.module,
      status: p.status === 'ACTIVE' ? 'Active' : 'Deprecated',
      createdAt: p.createdAt
    }));
  }

  static async createPage(page: { pageId: string; pageName: string; module: string }) {
    const res = await apiClient.post(`${API_BASE}/pages`, {
      pageId: page.pageId,
      pageName: page.pageName,
      module: page.module,
      status: "ACTIVE"
    });
    return res.data;
  }

  static async getPageDetail(pageId: string): Promise<{ page: Page, tags: Tag[] }> {
    const res = await apiClient.get(`${API_BASE}/pages/${pageId}/detail`);
    const data = res.data;
    
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
        else if (trans.status === "NEEDS_ATTENTION") status = "Pending Review";
        else if (trans.status === "BLOCKED") status = "Draft";
        else if (trans.status === "NO_TRANSLATION") status = "No Trans";

        // Also detect stale from English version disparity
        const engVer = t.englishVersion || 1;
        const transEngVer = trans.translatedAtEnglishVersion || 0;
        if (trans.status === "STALE" || (trans.text && engVer > 1 && transEngVer > 0 && transEngVer < engVer && trans.status !== "APPROVED")) {
          status = "Stale";
        }

        const rawConf = trans.confidence !== undefined && trans.confidence !== null ? Number(trans.confidence) : 0;
        const normalizedConfidence = (rawConf > 0 && rawConf <= 1.0) ? Math.round(rawConf * 100) : Math.round(rawConf);

        values[lang] = {
          text: trans.text || "",
          status: status as any,
          confidence: normalizedConfidence,
          translatedAtEnglishVersion: trans.translatedAtEnglishVersion || 0,
          lastUpdated: trans.lastUpdated || new Date().toISOString()
        };
      });

      // Map englishStatus from backend (APPROVED, DRAFT, PENDING_REVIEW, NO_COPY)
      let englishStatus: string | undefined;
      if (t.englishStatus === "APPROVED") englishStatus = "Approved";
      else if (t.englishStatus === "DRAFT") englishStatus = "Draft";
      else if (t.englishStatus === "PENDING_REVIEW") englishStatus = "Pending Review";
      else englishStatus = t.english ? "Approved" : "Draft";

      return {
        id: t.id,
        pageId: t.pageId,
        type: t.type,
        english: t.english || "",
        englishVersion: t.englishVersion || 0,
        englishStatus,
        values: values,
        comments: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
    });

    return { page, tags };
  }

  static async createTag(pageId: string, tag: { id: string; type?: string; english?: string }) {
    let resData = null;
    try {
      const res = await apiClient.post(`${API_BASE}/pages/${pageId}/tags`, {
        tagId: tag.id,
        copyType: tag.type || "General",
        status: "ACTIVE"
      });
      resData = res.data;
    } catch {
      // Tag may already exist in database, proceed with English copy update
    }

    if (tag.english && tag.english.trim()) {
      await this.saveEnglishCopyDraft(tag.id, tag.english, "Initial copy");
      // Auto-approve so the page detail returns the English text
      try {
        await this.approveEnglishCopy(tag.id);
      } catch {
        // Approval may fail if workflow requires review — English is still saved as draft
      }
    }
    return resData;
  }

  static async batchImportTags(pageId: string, tags: Array<{
    id: string;
    type?: string;
    english?: string;
    values?: Record<string, { text: string; status?: string; confidence?: number }>;
  }>) {
    const res = await apiClient.post(`${API_BASE}/pages/${pageId}/tags/batch-import`, tags);
    return res.data;
  }

  static async updateTagType(tagId: string, copyType: string) {
    const res = await apiClient.patch(`${API_BASE}/tags/${tagId}`, {
      copyType: copyType || "General"
    });
    return res.data;
  }

  static async deprecateTag(tagId: string) {
    const res = await apiClient.patch(`${API_BASE}/tags/${tagId}/deprecate`);
    return res.data;
  }

  static async updatePage(pageId: string, pageName: string, module?: string) {
    const res = await apiClient.patch(`${API_BASE}/pages/${pageId}`, {
      pageName,
      module
    });
    return res.data;
  }

  static async deprecatePage(pageId: string) {
    const res = await apiClient.patch(`${API_BASE}/pages/${pageId}/deprecate`);
    return res.data;
  }

  static async saveEnglishCopyDraft(tagId: string, text: string, changeReason?: string) {
    const res = await apiClient.put(`${API_BASE}/tags/${tagId}/english-copy/draft`, { 
      text, 
      changeReason: changeReason || "Updated copy" 
    });
    return res.data;
  }

  static async submitEnglishCopyForReview(tagId: string) {
    const res = await apiClient.post(`${API_BASE}/tags/${tagId}/english-copy/submit`);
    return res.data;
  }

  static async approveEnglishCopy(tagId: string) {
    const res = await apiClient.post(`${API_BASE}/tags/${tagId}/english-copy/review`);
    return res.data;
  }

  static async getEnglishCopyVersions(tagId: string) {
    const res = await apiClient.get(`${API_BASE}/tags/${tagId}/english-copy/versions`);
    return res.data;
  }

  static async updateEnglishCopy(tagId: string, text: string, changeReason?: string) {
    return this.saveEnglishCopyDraft(tagId, text, changeReason);
  }

  static async updateTranslation(
    tagId: string, 
    langCode: string, 
    text: string, 
    targetStatus: "Approved" | "Pending Review" | "Draft" = "Approved",
    confidence?: number
  ) {
    const payload: Record<string, any> = { translatedText: text };
    if (confidence !== undefined && confidence !== null) {
      payload.confidence = confidence > 1 ? confidence / 100 : confidence;
    }
    await apiClient.put(`${API_BASE}/tags/${tagId}/translations/${langCode}/draft`, payload);
    
    if (targetStatus === "Approved") {
      await apiClient.post(`${API_BASE}/tags/${tagId}/translations/${langCode}/review`, { action: "APPROVE" });
    } else if (targetStatus === "Pending Review") {
      await apiClient.post(`${API_BASE}/tags/${tagId}/translations/${langCode}/submit`);
    }
  }

  static async approveTranslation(tagId: string, langCode: string) {
    const res = await apiClient.post(`${API_BASE}/tags/${tagId}/translations/${langCode}/review`, { 
      action: "APPROVE" 
    });
    return res.data;
  }

  static async rejectTranslation(tagId: string, langCode: string, reason: string) {
    const res = await apiClient.post(`${API_BASE}/tags/${tagId}/translations/${langCode}/review`, { 
      action: "REJECT", 
      reason 
    });
    return res.data;
  }

  static async returnTranslationForRevision(tagId: string, langCode: string, comment: string) {
    const res = await apiClient.post(`${API_BASE}/tags/${tagId}/translations/${langCode}/review`, { 
      action: "RETURN_FOR_REVISION", 
      comment 
    });
    return res.data;
  }

  static async confirmStaleTranslation(tagId: string, langCode: string) {
    const res = await apiClient.post(`${API_BASE}/tags/${tagId}/translations/${langCode}/confirm-stale`);
    return res.data;
  }

  static async getTranslationVersions(tagId: string, langCode: string) {
    const res = await apiClient.get(`${API_BASE}/tags/${tagId}/translations/${langCode}/versions`);
    return res.data;
  }

  static async generateAiTranslationsBulk(pageId: string, langCode: string) {
    const res = await apiClient.post(`${API_BASE}/pages/${pageId}/translations/${langCode}/generate-all`);
    return res.data;
  }

  static async bulkApproveTranslations(pageId: string, langCode: string) {
    const res = await apiClient.post(`${API_BASE}/pages/${pageId}/translations/${langCode}/bulk-approve`);
    return res.data;
  }

  static async getPrePublishingSummary(pageId: string, languageCode: string, environment: Environment) {
    const res = await apiClient.get(`${API_BASE}/pages/${pageId}/languages/${languageCode}/environments/${environment}/preview`);
    return res.data;
  }

  static async publish(pageId: string, languageCode: string, environment: Environment) {
    const res = await apiClient.post(`${API_BASE}/pages/${pageId}/languages/${languageCode}/environments/${environment}/publish`);
    return res.data;
  }

  static async requestPublishingApproval(pageId: string, languageCode: string, environment: Environment) {
    const res = await apiClient.post(`${API_BASE}/pages/${pageId}/languages/${languageCode}/environments/${environment}/approval-requests`);
    return res.data;
  }

  static async reviewPublishingApproval(parId: string, action: "APPROVE" | "REJECT") {
    const res = await apiClient.post(`${API_BASE}/approval-requests/${parId}/review`, { action });
    return res.data;
  }

  static async getDeploymentHistory(pageId: string, languageCode: string) {
    const res = await apiClient.get(`${API_BASE}/pages/${pageId}/languages/${languageCode}/deployments`);
    return res.data;
  }

  static async rollback(pageId: string, languageCode: string, environment: Environment, targetReleaseId: string) {
    const res = await apiClient.post(`${API_BASE}/pages/${pageId}/languages/${languageCode}/environments/${environment}/rollback`, { targetReleaseId });
    return res.data;
  }

  static async getComments(tagId: string): Promise<import("../types").Comment[]> {
    const res = await apiClient.get(`${API_BASE}/tags/${tagId}/comments`);
    return res.data;
  }

  static async addComment(tagId: string, payload: {
    text: string;
    scope: { type: string; languageCode?: string | null };
    isEscalation?: boolean;
    escalationReason?: string | null;
    parentCommentId?: string | null;
  }): Promise<import("../types").Comment> {
    const res = await apiClient.post(`${API_BASE}/tags/${tagId}/comments`, payload);
    return res.data;
  }

  static async resolveComment(tagId: string, commentId: string): Promise<import("../types").Comment> {
    const res = await apiClient.patch(`${API_BASE}/tags/${tagId}/comments/${commentId}/resolve`);
    return res.data;
  }

  static async unresolveComment(tagId: string, commentId: string): Promise<import("../types").Comment> {
    const res = await apiClient.patch(`${API_BASE}/tags/${tagId}/comments/${commentId}/unresolve`);
    return res.data;
  }

  static async getEscalatedItems(): Promise<import("../types").EscalatedItem[]> {
    const res = await apiClient.get(`${API_BASE}/escalations`);
    return res.data;
  }
}
