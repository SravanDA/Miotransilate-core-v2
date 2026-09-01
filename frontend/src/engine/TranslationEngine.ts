import { StoreService } from "../store/StoreService";
import { GeminiProvider } from "./GeminiProvider";
import { ApiService } from "../services/ApiService";
import type { ITranslationProvider, TranslationRequest } from "./types";
import type { TranslationValue } from "../types";

export class TranslationEngine {
  private provider: ITranslationProvider;

  constructor() {
    this.provider = new GeminiProvider();
  }
  
  async translateTag(pageId: string, tagId: string, targetLanguage: string) {
    const tag = StoreService.getTag(pageId, tagId);
    if (!tag || !tag.english) return;

    const request: TranslationRequest = {
      english: tag.english,
      targetLanguage,
      copyType: tag.type,
      context: `Page: ${StoreService.getPage(pageId)?.name}`
    };

    try {
      const result = await this.provider.translate(request);
      StoreService.updateTranslation(pageId, tagId, targetLanguage, {
        text: result.translatedText,
        status: (result.status as any) || "Pending Review",
        confidence: result.confidence,
        stateCause: result.stateCause,
        backTranslation: result.backTranslation
      });
    } catch (e) {
      console.error("Translation failed for tag", tagId, e);
    }
  }

  async translatePageBatch(pageId: string, targetLanguage: string): Promise<{
    status: "COMPLETE" | "PARTIAL_SUCCESS" | "NO_ELIGIBLE_TAGS" | "FAILED";
    total: number;
    translated: number;
    needsAttention: number;
    blocked: number;
    remainingTagIds: string[];
    blockedTagIds: string[];
    error?: string;
  }> {
    try {
      // 🚀 PRODUCTION PATH: Try backend API first if configured and running
      console.log("Attempting production backend translation API...");
      const backendResult = await ApiService.generateAiTranslationsBulk(pageId, targetLanguage);
      if (backendResult && backendResult.processed > 0) {
        await StoreService.refreshPageDetail(pageId);
        const backendStatus = backendResult.status || "COMPLETE";
        return {
          status: backendStatus === "PARTIAL_SUCCESS" ? "PARTIAL_SUCCESS" : "COMPLETE",
          total: backendResult.total || backendResult.processed,
          translated: backendResult.processed,
          needsAttention: backendResult.needsAttention || 0,
          blocked: backendResult.blocked || 0,
          remainingTagIds: backendResult.remainingTagIds || [],
          blockedTagIds: backendResult.blockedTagIds || []
        };
      }
      console.log("Backend returned 0 processed tags or unavailable. Executing with GeminiProvider engine...");
    } catch (apiError: any) {
      console.warn("Backend API unavailable. Using browser GeminiProvider...", apiError?.message || "");
    }
      
    // 🚧 FRONTEND / DEVKIT ENGINE: Run GeminiProvider with full telemetry
    const tags = StoreService.getTags(pageId);
    const requests: { tagId: string; req: TranslationRequest }[] = [];

    tags.forEach((tag) => {
      const val = tag.values?.[targetLanguage];
      // Only translate tags with non-empty English that are not already Approved
      if (tag.english && tag.english.trim().length > 0 && (!val || val.status !== "Approved")) {
        requests.push({
          tagId: tag.id,
          req: {
            english: tag.english,
            targetLanguage,
            copyType: tag.type,
            context: `Page: ${StoreService.getPage(pageId)?.name || pageId}`,
          },
        });
      }
    });

    if (requests.length === 0) {
      return {
        status: "NO_ELIGIBLE_TAGS",
        total: tags.length,
        translated: 0,
        needsAttention: 0,
        blocked: 0,
        remainingTagIds: [],
        blockedTagIds: []
      };
    }

    try {
      const results = await this.provider.translateBatch(
        requests.map((r) => r.req)
      );

      let needsAttentionCount = 0;
      const updates: { tagId: string; value: Partial<TranslationValue> }[] = [];

      results.forEach((result, idx) => {
        if (!requests[idx]) return;
        const tagId = requests[idx].tagId;
        const isLowConfidence = result.confidence !== undefined && result.confidence < 70;
        if (isLowConfidence) {
          needsAttentionCount++;
        }

        updates.push({
          tagId,
          value: {
            text: result.translatedText,
            status: (result.status as any) || (isLowConfidence ? "Needs Attention" : "Pending Review"),
            confidence: result.confidence,
            stateCause: result.stateCause,
            backTranslation: result.backTranslation,
          }
        });
      });

      // Batch persistence to store & localStorage in 1 atomic pass
      await StoreService.batchUpdateTranslations(pageId, targetLanguage, updates);

      return {
        status: needsAttentionCount > 0 ? "PARTIAL_SUCCESS" : "COMPLETE",
        total: requests.length,
        translated: updates.length,
        needsAttention: needsAttentionCount,
        blocked: 0,
        remainingTagIds: [],
        blockedTagIds: []
      };
    } catch (e: any) {
      console.error("Batch translation engine error:", e);
      return {
        status: "FAILED",
        total: requests.length,
        translated: 0,
        needsAttention: 0,
        blocked: 0,
        remainingTagIds: [],
        blockedTagIds: [],
        error: e?.message || "Translation provider error. Please check API key in LLM DevKit."
      };
    }
  }
}

// Global singleton
export const engine = new TranslationEngine();
