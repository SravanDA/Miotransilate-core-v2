import type { ITranslationProvider, TranslationRequest, TranslationResult } from "./types";

export class MockProvider implements ITranslationProvider {
  async translate(request: TranslationRequest): Promise<TranslationResult> {
    // Simulate network delay
    await new Promise(resolve => setTimeout(resolve, 800));

    // Simple mock logic
    const mockConfidence = Math.floor(Math.random() * 20) + 75; // 75-95
    const prefix = request.targetLanguage.toUpperCase();
    
    // Simulate validator/risk gate flags randomly for testing
    const isNeedsAttention = Math.random() > 0.8;
    const isBlocked = Math.random() > 0.95;
    
    let stateCause: string | undefined;
    let status = "Draft";
    
    if (isBlocked) {
      stateCause = "blocked_placeholder";
      status = "No Trans";
    } else if (isNeedsAttention) {
      stateCause = "needs_attention_length";
      status = "Pending Review";
    } else {
      status = "Pending Review"; // Usually draft, but let's say it's pending review in UI
    }
    
    return {
      translatedText: `[${prefix}] ${request.english}`,
      confidence: mockConfidence,
      backTranslation: `(Back-translated) ${request.english}`,
      stateCause,
      status,
      modelUsed: "Mock Engine v1"
    };
  }

  async translateBatch(requests: TranslationRequest[]): Promise<TranslationResult[]> {
    return Promise.all(requests.map(req => this.translate(req)));
  }
}
