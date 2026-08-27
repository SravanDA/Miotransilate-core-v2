export interface TranslationRequest {
  english: string;
  targetLanguage: string; // ISO code
  copyType: string;
  context?: string;
}

export interface TranslationResult {
  translatedText: string;
  confidence: number;
  backTranslation?: string;
  modelUsed: string;
}

export interface ITranslationProvider {
  translate(request: TranslationRequest): Promise<TranslationResult>;
  translateBatch(requests: TranslationRequest[]): Promise<TranslationResult[]>;
}
