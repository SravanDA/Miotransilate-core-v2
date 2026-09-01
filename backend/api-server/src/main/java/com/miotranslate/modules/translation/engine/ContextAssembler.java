package com.miotranslate.modules.translation.engine;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.miotranslate.modules.admin.model.SystemConfiguration;
import com.miotranslate.modules.admin.repository.SystemConfigurationRepository;
import com.miotranslate.modules.content.model.EnglishCopy;
import com.miotranslate.modules.content.repository.EnglishCopyRepository;
import com.miotranslate.modules.registry.model.Page;
import com.miotranslate.modules.registry.model.Tag;
import com.miotranslate.modules.registry.repository.PageRepository;
import com.miotranslate.modules.registry.repository.TagRepository;
import com.miotranslate.modules.translation.engine.model.PageJob;
import com.miotranslate.modules.translation.engine.model.TagContext;
import com.miotranslate.modules.translation.engine.model.TranslationChunk;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import java.util.*;
import java.util.stream.Collectors;

@Slf4j
@Component
@RequiredArgsConstructor
public class ContextAssembler {

    private final PageRepository pageRepository;
    private final TagRepository tagRepository;
    private final EnglishCopyRepository englishCopyRepository;
    private final SystemConfigurationRepository configRepository;
    private final ObjectMapper objectMapper;
    
    private static final int CHUNK_SIZE = 30;

    public PageJob assemble(String pageId, String targetLanguage, Set<String> specificTagIds) {
        Page page = pageRepository.findById(pageId)
                .orElseThrow(() -> new IllegalArgumentException("Page not found: " + pageId));

        List<Tag> allTags = tagRepository.findAll().stream()
                .filter(t -> pageId.equals(t.getPageId()))
                .filter(t -> !"DEPRECATED".equals(t.getStatus()))
                .collect(Collectors.toList());

        List<TagContext> allTagContexts = new ArrayList<>();
        Set<String> allValidTagIds = new HashSet<>();

        for (Tag tag : allTags) {
            EnglishCopy englishCopy = englishCopyRepository.findById(tag.getTagId()).orElse(null);
            if (englishCopy != null && "APPROVED".equals(englishCopy.getStatus())) {
                allTagContexts.add(new TagContext(tag.getTagId(), "", englishCopy.getEtagVersion()));
                allValidTagIds.add(tag.getTagId());
            }
        }

        // If specific tags are requested (for retry/single), filter the ones we want to translate
        List<TagContext> tagsToTranslate = new ArrayList<>();
        if (specificTagIds != null && !specificTagIds.isEmpty()) {
            for (TagContext ctx : allTagContexts) {
                if (specificTagIds.contains(ctx.getTagId())) {
                    tagsToTranslate.add(ctx);
                }
            }
        } else {
            tagsToTranslate = new ArrayList<>(allTagContexts);
        }

        Map<String, String> termLocks = getTermLocksForLanguage(targetLanguage);

        List<TranslationChunk> chunks = new ArrayList<>();
        for (int i = 0; i < tagsToTranslate.size(); i += CHUNK_SIZE) {
            int end = Math.min(i + CHUNK_SIZE, tagsToTranslate.size());
            List<TagContext> chunkTags = tagsToTranslate.subList(i, end);
            
            // Note: In a real implementation, we might pass ALL sibling contexts to the prompt builder.
            // For now, we attach all tag contexts to each chunk so the prompt builder can see the whole screen.
            
            TranslationChunk chunk = TranslationChunk.builder()
                    .chunkIndex(i / CHUNK_SIZE)
                    .tagsToTranslate(chunkTags)
                    .pageName(page.getPageName())
                    .domain(page.getModule())
                    .sourceLanguage("en")
                    .targetLanguage(targetLanguage)
                    .termLocks(termLocks)
                    .build();
            chunks.add(chunk);
        }

        return PageJob.builder()
                .pageId(pageId)
                .pageName(page.getPageName())
                .domain(page.getModule())
                .targetLanguage(targetLanguage)
                .allTagIds(allValidTagIds)
                .chunks(chunks)
                .build();
    }
    
    // For single tag or follow-up chunks
    public TranslationChunk buildChunk(Set<String> remainingTags, String targetLanguage, String pageId) {
        PageJob job = assemble(pageId, targetLanguage, remainingTags);
        if (job.getChunks().isEmpty()) return null;
        // Flatten into one chunk for follow-up
        List<TagContext> allRemaining = new ArrayList<>();
        for (TranslationChunk c : job.getChunks()) {
            allRemaining.addAll(c.getTagsToTranslate());
        }
        TranslationChunk merged = job.getChunks().get(0);
        merged.setTagsToTranslate(allRemaining);
        return merged;
    }

    private Map<String, String> getTermLocksForLanguage(String languageCode) {
        try {
            SystemConfiguration config = configRepository.findById("engine.term_locks").orElse(null);
            if (config != null && config.getConfigValue() != null) {
                Map<String, Map<String, String>> locks = objectMapper.readValue(
                        config.getConfigValue(),
                        new TypeReference<>() {}
                );
                return locks.getOrDefault(languageCode, new HashMap<>());
            }
        } catch (Exception e) {
            log.warn("Failed to parse term locks", e);
        }
        return new HashMap<>();
    }
}
