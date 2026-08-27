package com.miotranslate.shared.integration.ai;

public interface AiTranslationClient {
    
    /**
     * Translates the given English text to the target language contextually.
     * 
     * @param englishText The source English text
     * @param targetLanguageCode The target language code (e.g., 'es', 'fr')
     * @param context Additional business context if any
     * @return TranslationResult containing translated text, back translation, and confidence
     */
    TranslationResult translate(String englishText, String targetLanguageCode, String context);
}
