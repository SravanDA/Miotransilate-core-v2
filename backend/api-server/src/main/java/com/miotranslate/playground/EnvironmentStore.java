package com.miotranslate.playground;

import lombok.Data;

import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

@Data
public class EnvironmentStore {
    // pageId -> PageStore
    private Map<String, PageStore> pages = new ConcurrentHashMap<>();

    // Deep copy constructor
    public EnvironmentStore(EnvironmentStore other) {
        if (other != null && other.pages != null) {
            other.pages.forEach((pageId, pageStore) -> {
                this.pages.put(pageId, new PageStore(pageStore));
            });
        }
    }

    public EnvironmentStore() {}
}
