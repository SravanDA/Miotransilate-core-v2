package com.miotranslate.modules.translation.engine.model;

import lombok.Builder;
import lombok.Data;

import java.util.List;
import java.util.Map;

@Data
@Builder
public class TranslationChunk {
    private int chunkIndex;
    private List<TagContext> tagsToTranslate;
    private String pageName;
    private String domain;
    private String sourceLanguage;
    private String targetLanguage;
    private Map<String, String> termLocks;
}
