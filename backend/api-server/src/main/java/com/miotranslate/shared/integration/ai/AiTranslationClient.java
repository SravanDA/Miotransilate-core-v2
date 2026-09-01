package com.miotranslate.shared.integration.ai;

import java.util.List;

public interface AiTranslationClient {
    
    /**
     * Translates a batch of strings for a given screen context.
     * 
     * @param prompt The structured JSON prompt for Gemini
     * @return List of ScreenTranslationResult
     */
    List<com.miotranslate.shared.integration.ai.model.ScreenTranslationResult> translateScreen(String prompt);

    /**
     * Audits a batch of flagged strings using Layer-3 semantic sense verification.
     * 
     * @param prompt The structured prompt for Gemini Audit
     * @return List of AuditResultItem
     */
    List<com.miotranslate.shared.integration.ai.model.AuditResultItem> auditScreen(String prompt);
}
