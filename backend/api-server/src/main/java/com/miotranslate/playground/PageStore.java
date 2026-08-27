package com.miotranslate.playground;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class PageStore {
    private String pageId;
    private String pageName;
    // tagName -> (languageCode -> translatedText)
    @Builder.Default
    private Map<String, Map<String, String>> tags = new ConcurrentHashMap<>();
    
    // Copy constructor for deep copy
    public PageStore(PageStore other) {
        this.pageId = other.pageId;
        this.pageName = other.pageName;
        this.tags = new ConcurrentHashMap<>();
        other.tags.forEach((tagId, translations) -> {
            this.tags.put(tagId, new ConcurrentHashMap<>(translations));
        });
    }
}
