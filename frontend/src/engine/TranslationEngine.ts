import { StoreService } from "../store/StoreService";
import { MockProvider } from "./MockProvider";
import type { ITranslationProvider, TranslationRequest } from "./types";

export class TranslationEngine {
  private provider: ITranslationProvider;

  constructor(provider?: ITranslationProvider) {
    // Default to mock for now until LLM is wired up
    this.provider = provider || new MockProvider();
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
        status: "Pending Review",
        confidence: result.confidence
      });
      
    } catch (e) {
      console.error("Translation Engine failed", e);
    }
  }

  async translatePageBatch(pageId: string, targetLanguage: string) {
    const tags = StoreService.getTags(pageId);
    const requests: { tagId: string, req: TranslationRequest }[] = [];

    tags.forEach(tag => {
      const val = tag.values[targetLanguage];
      if (tag.english && (!val || val.status === "No Trans" || val.status === "No Eng" || val.status === "Stale")) {
        requests.push({
          tagId: tag.id,
          req: {
            english: tag.english,
            targetLanguage,
            copyType: tag.type,
            context: `Page: ${StoreService.getPage(pageId)?.name}`
          }
        });
      }
    });

    if (requests.length === 0) return;

    try {
      const results = await this.provider.translateBatch(requests.map(r => r.req));
      
      results.forEach((result, idx) => {
        const tagId = requests[idx].tagId;
        StoreService.updateTranslation(pageId, tagId, targetLanguage, {
          text: result.translatedText,
          status: "Pending Review",
          confidence: result.confidence
        });
      });
      
    } catch (e) {
      console.error("Batch translation failed", e);
    }
  }
}

// Global singleton
export const engine = new TranslationEngine();
