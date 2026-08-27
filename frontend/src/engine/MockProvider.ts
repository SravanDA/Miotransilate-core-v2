import type { ITranslationProvider, TranslationRequest, TranslationResult } from "./types";

export class MockProvider implements ITranslationProvider {
  async translate(request: TranslationRequest): Promise<TranslationResult> {
    // Simulate network delay
    await new Promise(resolve => setTimeout(resolve, 800));

    // Simple mock logic
    const mockConfidence = Math.floor(Math.random() * 20) + 75; // 75-95
    const prefix = request.targetLanguage.toUpperCase();
    
    return {
      translatedText: `[${prefix}] ${request.english}`,
      confidence: mockConfidence,
      modelUsed: "Mock Engine v1"
    };
  }

  async translateBatch(requests: TranslationRequest[]): Promise<TranslationResult[]> {
    return Promise.all(requests.map(req => this.translate(req)));
  }
}
