import { StoreService } from "../store/StoreService";
import { MockProvider } from "./MockProvider";
import type { ITranslationProvider, TranslationRequest } from "./types";

export class TranslationEngine {
  
  async translateTag(pageId: string, tagId: string, targetLanguage: string) {
    // Single tag translation
    try {
      const response = await fetch(`/api/translation/tags/${tagId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ languageCode: targetLanguage })
      });
      if (!response.ok) throw new Error('API Error');
      const data = await response.json();
      
      StoreService.updateTranslation(pageId, tagId, targetLanguage, {
        text: data.translatedText || "",
        status: data.status === "NEEDS_ATTENTION" ? "Pending Review" : "Draft",
        confidence: data.confidenceScore || 0.9,
        stateCause: data.stateCause,
        backTranslation: data.backTranslation
      });
    } catch (e) {
      console.error("Translation Engine failed", e);
    }
  }

  async translatePageBatch(pageId: string, targetLanguage: string) {
    try {
      const response = await fetch('/api/translation/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pageId, languageCode: targetLanguage })
      });
      
      if (!response.ok) {
        throw new Error('API Error');
      }
      
      const data = await response.json();
      
      // We expect the backend to return { status: 'COMPLETE', processed: 10, remainingTagIds: [] }
      // Then we can refetch the page data to update the UI
      // For now, we simulate refetching by just returning the status
      
      return data.status || 'COMPLETE';
      
    } catch (e) {
      console.error("Batch translation failed", e);
      return 'FAILED';
    }
  }
}

// Global singleton
export const engine = new TranslationEngine();
