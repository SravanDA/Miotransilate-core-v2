package com.miotranslate.modules.translation.engine;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.miotranslate.modules.translation.engine.model.TranslationChunk;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

@Component
@RequiredArgsConstructor
public class PromptBuilder {

    private final ObjectMapper objectMapper;

    public String build(TranslationChunk chunk) {
        Map<String, Object> promptData = new HashMap<>();
        promptData.put("instructions", "You are localizing the UI of MioSalon. Translate the requested strings to the target language.");
        promptData.put("sourceLanguage", chunk.getSourceLanguage());
        promptData.put("targetLanguage", chunk.getTargetLanguage());
        promptData.put("pageName", chunk.getPageName());
        promptData.put("domain", chunk.getDomain());
        
        List<Map<String, String>> tagsToTranslate = chunk.getTagsToTranslate().stream().map(ctx -> {
            Map<String, String> tag = new HashMap<>();
            tag.put("tagId", ctx.getTagId());
            tag.put("englishText", ctx.getEnglishText());
            return tag;
        }).toList();
        
        promptData.put("tagsToTranslate", tagsToTranslate);
        
        if (chunk.getTermLocks() != null && !chunk.getTermLocks().isEmpty()) {
            promptData.put("termLocks", chunk.getTermLocks());
        }

        try {
            return objectMapper.writeValueAsString(promptData);
        } catch (JsonProcessingException e) {
            throw new RuntimeException("Failed to build prompt", e);
        }
    }

    /**
     * Builds the prompt for Layer-3 semantic audit verification of flagged strings.
     */
    public String buildAuditPrompt(TranslationChunk chunk, List<com.miotranslate.shared.integration.ai.model.ScreenTranslationResult> flaggedResults) {
        Map<String, String> tagToEnglish = new HashMap<>();
        if (chunk.getTagsToTranslate() != null) {
            for (com.miotranslate.modules.translation.engine.model.TagContext ctx : chunk.getTagsToTranslate()) {
                tagToEnglish.put(ctx.getTagId(), ctx.getEnglishText());
            }
        }

        Map<String, Object> promptData = new HashMap<>();
        promptData.put("instructions", "You are an expert bilingual localization reviewer for MioSalon salon & spa management software. "
                + "Verify whether each translated string, in the context of this screen, accurately expresses the stated intended meaning. "
                + "Return a verdict (correct, wrong_sense, wrong_register, awkward, or unsure), an English reading of how a native user understands the target text, and an improved translation if needed.");
        promptData.put("pageName", chunk.getPageName());
        promptData.put("domain", chunk.getDomain());
        promptData.put("targetLanguage", chunk.getTargetLanguage());

        List<Map<String, String>> items = flaggedResults.stream().map(res -> {
            Map<String, String> item = new HashMap<>();
            item.put("tag", res.getTag());
            item.put("english", tagToEnglish.getOrDefault(res.getTag(), ""));
            item.put("intendedMeaning", res.getSense() != null ? res.getSense() : "");
            item.put("translation", res.getTranslation());
            return item;
        }).toList();

        promptData.put("itemsToAudit", items);

        try {
            return objectMapper.writeValueAsString(promptData);
        } catch (JsonProcessingException e) {
            throw new RuntimeException("Failed to build audit prompt", e);
        }
    }
}
