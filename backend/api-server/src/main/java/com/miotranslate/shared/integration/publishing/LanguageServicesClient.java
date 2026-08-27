package com.miotranslate.shared.integration.publishing;

import java.util.List;
import java.util.Map;

public interface LanguageServicesClient {
    
    /**
     * Pushes a bundle of approved translations to the external MioSalon Language Services.
     * GP-02 compliant: This MUST NOT be called within a database transaction.
     * 
     * @param pageId The page identifier
     * @param languageCode The language code (e.g., 'es', 'fr')
     * @param environment The target environment ('DEV', 'QA', 'PRODUCTION')
     * @param tags Key-value map of tag_id -> translated_text
     * @param removeTags List of tag_ids to remove from the page
     * @return PushResult indicating success and raw response payload
     */
    PushResult pushBundle(String pageId, String languageCode, String environment, Map<String, String> tags, List<String> removeTags);
}
