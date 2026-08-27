package com.miotranslate.playground;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.RequiredArgsConstructor;
import org.springframework.context.annotation.Profile;
import org.springframework.web.bind.annotation.*;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/playground")
@Profile("mock")
@RequiredArgsConstructor
public class PlaygroundController {

    private final MockLsDataStore mockLsDataStore;
    private final CsvImporter csvImporter;

    @GetMapping("/pages")
    public List<PageSummary> getPages() {
        EnvironmentStore baseline = mockLsDataStore.getBaseline();
        List<PageSummary> summaries = new ArrayList<>();
        baseline.getPages().forEach((pageId, pageStore) -> {
            summaries.add(new PageSummary(pageId, pageStore.getPageName(), pageStore.getTags().size()));
        });
        return summaries;
    }

    @GetMapping("/pages/{pageId}/render")
    public RenderResult renderPage(@PathVariable String pageId, 
                                   @RequestParam(defaultValue = "eng") String lang, 
                                   @RequestParam(defaultValue = "DEV") String env) {
        EnvironmentStore envStore = mockLsDataStore.getEnvironment(env);
        PageStore pageStore = envStore.getPages().get(pageId);
        
        if (pageStore == null) {
            return new RenderResult(pageId, "Unknown", env, lang, List.of());
        }

        List<ResolvedTag> resolvedTags = new ArrayList<>();
        pageStore.getTags().forEach((tagName, values) -> {
            String value = values.get(lang);
            boolean fallbackUsed = false;
            String fallbackLang = null;
            if (value == null) {
                value = values.get("eng");
                fallbackUsed = true;
                fallbackLang = "eng";
            }
            resolvedTags.add(new ResolvedTag(tagName, value, fallbackUsed, fallbackLang));
        });

        return new RenderResult(pageId, pageStore.getPageName(), env, lang, resolvedTags);
    }

    @GetMapping("/changes/{pageId}")
    public ChangeResult getChanges(@PathVariable String pageId,
                                   @RequestParam(defaultValue = "DEV") String env,
                                   @RequestParam String lang) {
        EnvironmentStore envStore = mockLsDataStore.getEnvironment(env);
        EnvironmentStore baseline = mockLsDataStore.getBaseline();

        PageStore envPage = envStore.getPages().get(pageId);
        PageStore basePage = baseline.getPages().get(pageId);

        if (envPage == null) {
            return new ChangeResult(pageId, env, lang, List.of(), 0, 0);
        }

        List<TagChange> changes = new ArrayList<>();
        java.util.concurrent.atomic.AtomicInteger unchanged = new java.util.concurrent.atomic.AtomicInteger(0);
        int total = envPage.getTags().size();

        envPage.getTags().forEach((tagName, values) -> {
            String after = values.get(lang);
            String before = null;
            if (basePage != null && basePage.getTags().containsKey(tagName)) {
                before = basePage.getTags().get(tagName).get(lang);
            }

            if (after == null && before == null) {
                unchanged.incrementAndGet();
            } else if (after != null && after.equals(before)) {
                unchanged.incrementAndGet();
            } else {
                String type = before == null ? "ADDED" : "UPDATED";
                changes.add(new TagChange(tagName, before, after, type));
            }
        });

        return new ChangeResult(pageId, env, lang, changes, unchanged.get(), total);
    }

    @PostMapping("/reset")
    public void reset(@RequestParam(required = false) String env, 
                      @RequestParam(required = false) String pageId) {
        if (env != null && pageId != null) {
            mockLsDataStore.resetPage(env, pageId);
        } else if (env != null) {
            mockLsDataStore.resetEnvironment(env);
        } else {
            mockLsDataStore.resetEnvironment("DEV");
            mockLsDataStore.resetEnvironment("QA");
            mockLsDataStore.resetEnvironment("PRODUCTION");
        }
    }

    @PostMapping("/seed")
    public void seed() {
        csvImporter.importTags();
    }

    @Data @AllArgsConstructor
    public static class PageSummary {
        private String pageId;
        private String pageName;
        private int tagCount;
    }

    @Data @AllArgsConstructor
    public static class RenderResult {
        private String pageId;
        private String pageName;
        private String environment;
        private String language;
        private List<ResolvedTag> resolvedTags;
    }

    @Data @AllArgsConstructor
    public static class ResolvedTag {
        private String tagName;
        private String value;
        private boolean fallbackUsed;
        private String fallbackLang;
    }

    @Data @AllArgsConstructor
    public static class ChangeResult {
        private String pageId;
        private String environment;
        private String language;
        private List<TagChange> changes;
        private int unchanged;
        private int total;
    }

    @Data @AllArgsConstructor
    public static class TagChange {
        private String tagName;
        private String before;
        private String after;
        private String type;
    }
}
