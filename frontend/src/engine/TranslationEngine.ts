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

    // TODO: A real backend would have a single-tag endpoint. 
    // For now, we use the fallback provider for single tags locally.
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
    error?: string;
  }> {
    try {
      // 🚀 PRODUCTION PATH: Try backend API first if configured
      console.log("Attempting production backend translation API...");
      const backendResult = await ApiService.generateAiTranslationsBulk(pageId, targetLanguage);
      if (backendResult && backendResult.processed > 0) {
        await StoreService.refreshPageDetail(pageId);
        const backendStatus = backendResult?.status || "COMPLETE";
        return {
          status: backendStatus === "PARTIAL_SUCCESS" ? "PARTIAL_SUCCESS" : "COMPLETE",
          total: backendResult?.total || 0,
          translated: backendResult?.processed || 0,
          needsAttention: 0
        };
      }
      console.log("Backend returned 0 processed tags. Executing with browser GeminiProvider engine...");
    } catch (apiError: any) {
      console.warn("Backend API unavailable. Using browser GeminiProvider...", apiError?.message || "");
    }
      
    // 🚧 FRONTEND ENGINE: Run direct GeminiProvider calls with telemetry
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
          needsAttention: 0
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
              status: (result.status as any) || "Pending Review",
              confidence: result.confidence,
              stateCause: result.stateCause,
              backTranslation: result.backTranslation,
            }
          });
        });

        // Fast batch persistence to store & localStorage in 1 pass
        await StoreService.batchUpdateTranslations(pageId, targetLanguage, updates);

        return {
          status: needsAttentionCount > 0 ? "PARTIAL_SUCCESS" : "COMPLETE",
          total: requests.length,
          translated: updates.length,
          needsAttention: needsAttentionCount
        };
      } catch (e: any) {
        console.error("Batch translation engine error:", e);
        return {
          status: "FAILED",
          total: requests.length,
          translated: 0,
          needsAttention: 0,
          error: e?.message || "Translation provider error"
        };
      }
    }
}

// Global singleton
export const engine = new TranslationEngine();
