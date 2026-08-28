package com.miotranslate.modules.translation.engine.model;

import lombok.Builder;
import lombok.Data;

import java.util.List;
import java.util.Set;

@Data
@Builder
public class PageJob {
    private String pageId;
    private String pageName;
    private String domain;
    private String targetLanguage;
    private Set<String> allTagIds;
    private List<TranslationChunk> chunks;
}
