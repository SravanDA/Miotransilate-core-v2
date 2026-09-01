package com.miotranslate.modules.translation.engine.model;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;
import java.util.Map;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class TranslationChunk {
    private int chunkIndex;
    private List<TagContext> tagsToTranslate;
    private String pageName;
    private String domain;
    private String sourceLanguage;
    private String targetLanguage;
    private Map<String, String> termLocks;
}
