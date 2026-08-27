package com.miotranslate.modules.translation.api;

import com.miotranslate.modules.translation.service.TranslationService;
import com.miotranslate.shared.auth.SecurityUtils;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/v1/pages/{pageId}/translations/{languageCode}")
public class TranslationBulkController {

    private final TranslationService translationService;

    public TranslationBulkController(TranslationService translationService) {
        this.translationService = translationService;
    }

    @PostMapping("/generate-all")
    public ResponseEntity<Map<String, Object>> generateAiTranslationsBulk(
            @PathVariable String pageId,
            @PathVariable String languageCode) {
            
        UUID userId = SecurityUtils.getCurrentUserId();
        Map<String, Object> result = translationService.generateAiTranslationsBulk(pageId, languageCode, userId);
        return ResponseEntity.ok(result);
    }

    @PostMapping("/bulk-approve")
    public ResponseEntity<Map<String, Object>> bulkApproveTranslations(
            @PathVariable String pageId,
            @PathVariable String languageCode) {
            
        UUID userId = SecurityUtils.getCurrentUserId();
        Map<String, Object> result = translationService.bulkApproveTranslations(pageId, languageCode, userId);
        return ResponseEntity.ok(result);
    }
}
