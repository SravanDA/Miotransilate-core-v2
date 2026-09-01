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
}
