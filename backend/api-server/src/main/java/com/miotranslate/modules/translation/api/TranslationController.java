package com.miotranslate.modules.translation.api;

import com.miotranslate.modules.translation.model.Translation;
import com.miotranslate.modules.translation.model.TranslationVersion;
import com.miotranslate.modules.translation.service.TranslationService;
import com.miotranslate.shared.auth.SecurityUtils;
import com.miotranslate.shared.auth.RequiresPermission;
import org.springframework.http.HttpHeaders;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/v1/tags/{tagId}/translations/{languageCode}")
public class TranslationController {

    private final TranslationService translationService;

    public TranslationController(TranslationService translationService) {
        this.translationService = translationService;
    }

    @PostMapping("/generate")
    @RequiresPermission("TRANSLATION_CREATE")
    public ResponseEntity<TranslationVersion> generateAiTranslation(
            @PathVariable String tagId,
            @PathVariable String languageCode,
            @RequestHeader(value = HttpHeaders.IF_MATCH, required = false) String ifMatch) {
            
        UUID userId = SecurityUtils.getCurrentUserId();
        TranslationVersion draft = translationService.generateAiTranslation(tagId, languageCode, ifMatch, userId);
        return ResponseEntity.ok().body(draft);
    }

    @PutMapping("/draft")
    @RequiresPermission("TRANSLATION_EDIT")
    public ResponseEntity<TranslationVersion> editTranslationManually(
            @PathVariable String tagId,
            @PathVariable String languageCode,
            @RequestHeader(value = HttpHeaders.IF_MATCH, required = false) String ifMatch,
            @RequestBody Map<String, String> payload) {
            
        UUID userId = SecurityUtils.getCurrentUserId();
        TranslationVersion draft = translationService.editTranslationManually(
                tagId, languageCode, ifMatch, payload.get("translatedText"), userId);
        return ResponseEntity.ok().body(draft);
    }

    @PostMapping("/submit")
    @RequiresPermission("SUBMIT_FOR_REVIEW")
    public ResponseEntity<Translation> submitForReview(
            @PathVariable String tagId,
            @PathVariable String languageCode,
            @RequestHeader(value = HttpHeaders.IF_MATCH, required = false) String ifMatch) {
            
        UUID userId = SecurityUtils.getCurrentUserId();
        Translation submitted = translationService.submitForReview(tagId, languageCode, ifMatch, userId);
        return ResponseEntity.ok().eTag(String.valueOf(submitted.getEtagVersion())).body(submitted);
    }

    @PostMapping("/review")
    @RequiresPermission("TRANSLATION_APPROVE")
    public ResponseEntity<Translation> reviewTranslation(
            @PathVariable String tagId,
            @PathVariable String languageCode,
            @RequestHeader(value = HttpHeaders.IF_MATCH, required = false) String ifMatch,
            @RequestBody Map<String, String> payload) {
            
        UUID userId = SecurityUtils.getCurrentUserId();
        String action = payload.getOrDefault("action", "APPROVE");
        
        Translation reviewed = translationService.reviewTranslation(tagId, languageCode, ifMatch, action, userId);
        return ResponseEntity.ok().eTag(String.valueOf(reviewed.getEtagVersion())).body(reviewed);
    }

    @PostMapping("/confirm-stale")
    @RequiresPermission("SUBMIT_FOR_REVIEW")
    public ResponseEntity<Translation> confirmStale(
            @PathVariable String tagId,
            @PathVariable String languageCode,
            @RequestHeader(value = HttpHeaders.IF_MATCH, required = false) String ifMatch) {
            
        UUID userId = SecurityUtils.getCurrentUserId();
        Translation confirmed = translationService.confirmStale(tagId, languageCode, ifMatch, userId);
        return ResponseEntity.ok().eTag(String.valueOf(confirmed.getEtagVersion())).body(confirmed);
    }

    @PostMapping("/retranslate")
    @RequiresPermission("TRANSLATION_CREATE")
    public ResponseEntity<TranslationVersion> retranslate(
            @PathVariable String tagId,
            @PathVariable String languageCode,
            @RequestHeader(value = HttpHeaders.IF_MATCH, required = false) String ifMatch) {
            
        UUID userId = SecurityUtils.getCurrentUserId();
        TranslationVersion draft = translationService.retranslate(tagId, languageCode, ifMatch, userId);
        return ResponseEntity.ok().body(draft);
    }

    @GetMapping("/versions")
    @RequiresPermission("HISTORY_VIEW")
    public ResponseEntity<List<TranslationVersion>> getVersions(
            @PathVariable String tagId,
            @PathVariable String languageCode) {
            
        return ResponseEntity.ok(translationService.getVersions(tagId, languageCode));
    }
}
