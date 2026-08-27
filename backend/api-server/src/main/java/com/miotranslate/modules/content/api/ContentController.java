package com.miotranslate.modules.content.api;

import com.miotranslate.modules.content.model.EnglishCopy;
import com.miotranslate.modules.content.model.EnglishCopyVersion;
import com.miotranslate.modules.content.service.ContentService;
import org.springframework.http.HttpHeaders;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import com.miotranslate.shared.auth.SecurityUtils;

import java.util.List;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/v1/tags/{tagId}/english-copy")
public class ContentController {

    private final ContentService contentService;

    public ContentController(ContentService contentService) {
        this.contentService = contentService;
    }

    @PutMapping("/draft")
    public ResponseEntity<EnglishCopyVersion> saveDraft(
            @PathVariable String tagId,
            @RequestHeader(value = HttpHeaders.IF_MATCH, required = false) String ifMatch,
            @RequestBody Map<String, String> payload) {
            
        UUID userId = SecurityUtils.getCurrentUserId();
        EnglishCopyVersion draft = contentService.saveDraft(
                tagId, ifMatch, payload.get("text"), payload.get("changeReason"), userId);
                
        // Ideally we fetch the EnglishCopy to get the new ETag to return in header
        return ResponseEntity.ok().body(draft);
    }

    @PostMapping("/review")
    public ResponseEntity<EnglishCopy> approve(
            @PathVariable String tagId,
            @RequestHeader(value = HttpHeaders.IF_MATCH, required = false) String ifMatch) {
            
        UUID userId = SecurityUtils.getCurrentUserId();
        EnglishCopy approved = contentService.approve(tagId, ifMatch, userId);
        
        return ResponseEntity.ok().eTag(String.valueOf(approved.getEtagVersion())).body(approved);
    }

    @PostMapping("/submit")
    public ResponseEntity<EnglishCopy> submitForReview(
            @PathVariable String tagId,
            @RequestHeader(value = HttpHeaders.IF_MATCH, required = false) String ifMatch) {
            
        UUID userId = SecurityUtils.getCurrentUserId();
        EnglishCopy submitted = contentService.submitForReview(tagId, ifMatch, userId);
        
        return ResponseEntity.ok().eTag(String.valueOf(submitted.getEtagVersion())).body(submitted);
    }

    @GetMapping("/versions")
    public ResponseEntity<List<EnglishCopyVersion>> getVersions(@PathVariable String tagId) {
        return ResponseEntity.ok(contentService.getVersions(tagId));
    }
}
