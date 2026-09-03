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
      let blockedCount = 0;
      const updates: { tagId: string; value: Partial<TranslationValue> }[] = [];

      results.forEach((result, idx) => {
        if (!requests[idx]) return;
        const tagId = requests[idx].tagId;
        const originalEnglish = requests[idx].req.english;

        // The provider now returns signal-derived confidence and status.
        // Enforce additional safety checks here as the last line of defense.
        let finalConfidence = result.confidence ?? 0;
        let finalStatus = result.status || "Pending Review";

        // Safety check: if translated text equals original English, force low confidence
        if (result.translatedText === originalEnglish && originalEnglish.trim().length > 2) {
          finalConfidence = Math.min(finalConfidence, 10);
          finalStatus = "Needs Attention";
        }

        // Safety check: confidence below 50 always means needs attention
        if (finalConfidence < 50 && finalStatus !== "Needs Attention" && finalStatus !== "Blocked" && finalStatus !== "No Trans") {
          finalStatus = "Needs Attention";
        }

        if (finalStatus === "Blocked" || result.stateCause?.startsWith("blocked")) {
          blockedCount++;
        } else if (finalStatus === "Needs Attention" || finalConfidence < 50) {
          needsAttentionCount++;
        }

        updates.push({
          tagId,
          value: {
            text: result.translatedText,
            status: finalStatus as any,
            confidence: finalConfidence,
            stateCause: result.stateCause,
            backTranslation: result.backTranslation,
          }
        });
      });

      // Batch persistence to store & localStorage in 1 atomic pass
      await StoreService.batchUpdateTranslations(pageId, targetLanguage, updates);

      return {
        status: (blockedCount > 0 || needsAttentionCount > 0) ? "PARTIAL_SUCCESS" : "COMPLETE",
        total: requests.length,
        translated: updates.length,
        needsAttention: needsAttentionCount,
        blocked: blockedCount,
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

  async translatePageAllLanguages(
    pageId: string,
    languages: string[],
    onProgress?: (progress: {
      currentLang: string;
      completedLangs: number;
      totalLangs: number;
      langResult?: {
        status: "COMPLETE" | "PARTIAL_SUCCESS" | "NO_ELIGIBLE_TAGS" | "FAILED";
        total: number;
        translated: number;
        needsAttention: number;
        blocked: number;
        error?: string;
      };
    }) => void
  ): Promise<{
    totalTranslated: number;
    results: Record<string, any>;
  }> {
    const results: Record<string, any> = {};
    let totalTranslated = 0;

    for (let i = 0; i < languages.length; i++) {
      const lang = languages[i];
      if (onProgress) {
        onProgress({
          currentLang: lang,
          completedLangs: i,
          totalLangs: languages.length
        });
      }

      try {
        const res = await this.translatePageBatch(pageId, lang);
        results[lang] = res;
        totalTranslated += res.translated;
      } catch (err: any) {
        results[lang] = {
          status: "FAILED",
          total: 0,
          translated: 0,
          needsAttention: 0,
          blocked: 0,
          remainingTagIds: [],
          blockedTagIds: [],
          error: err?.message || "Translation error"
        };
      }

      if (onProgress) {
        onProgress({
          currentLang: lang,
          completedLangs: i + 1,
          totalLangs: languages.length,
          langResult: results[lang]
        });
      }
    }

    await StoreService.refreshPageDetail(pageId);
    return { totalTranslated, results };
  }
}

// Global singleton
export const engine = new TranslationEngine();
