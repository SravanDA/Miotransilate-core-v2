package com.miotranslate.shared.integration.ai;

public interface AiTranslationClient {
    
    /**
     * Translates a batch of strings for a given screen context.
     * 
     * @param prompt The structured JSON prompt for Gemini
     * @return List of ScreenTranslationResult
     */
    List<com.miotranslate.shared.integration.ai.model.ScreenTranslationResult> translateScreen(String prompt);

    /**
     * Audits a batch of flagged strings.
     * 
     * @param prompt The structured JSON prompt for Gemini Audit
     * @return Audit outcome (To be defined)
     */
    String auditScreen(String prompt);
}
