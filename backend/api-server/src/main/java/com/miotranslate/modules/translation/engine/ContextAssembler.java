package com.miotranslate.modules.translation.engine;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.miotranslate.modules.admin.model.SystemConfiguration;
import com.miotranslate.modules.admin.repository.SystemConfigurationRepository;
import com.miotranslate.modules.content.model.EnglishCopy;
import com.miotranslate.modules.content.model.EnglishCopyVersion;
import com.miotranslate.modules.content.repository.EnglishCopyRepository;
import com.miotranslate.modules.content.repository.EnglishCopyVersionRepository;
import com.miotranslate.modules.registry.model.Page;
import com.miotranslate.modules.registry.model.Tag;
import com.miotranslate.modules.registry.repository.PageRepository;
import com.miotranslate.modules.registry.repository.TagRepository;
import com.miotranslate.modules.translation.engine.model.PageJob;
import com.miotranslate.modules.translation.engine.model.TagContext;
import com.miotranslate.modules.translation.engine.model.TranslationChunk;
import com.miotranslate.modules.translation.model.Translation;
import com.miotranslate.modules.translation.repository.TranslationRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import java.util.*;
import java.util.function.Function;
import java.util.stream.Collectors;

/**
 * Assembles context for the translation engine.
 * 
 * Fixes applied:
 * - Fix 13 (P1-11): Replaced findAll() full table scan with findByPageIdAndStatusNot() and batched findAllById()
 * - Fix 4 (P0-7): Guards approved translations — skips tags whose translation is already APPROVED and not STALE
 * - Correct English copy version and text extraction (populates actual English text in TagContext)
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class ContextAssembler {

    private final PageRepository pageRepository;
    private final TagRepository tagRepository;
    private final EnglishCopyRepository englishCopyRepository;
    private final EnglishCopyVersionRepository englishCopyVersionRepository;
    private final TranslationRepository translationRepository;
    private final SystemConfigurationRepository configRepository;
    private final ObjectMapper objectMapper;
    
    private static final int CHUNK_SIZE = 30;

    public PageJob assemble(String pageId, String targetLanguage, Set<String> specificTagIds) {
        Page page = pageRepository.findById(pageId)
                .orElseThrow(() -> new IllegalArgumentException("Page not found: " + pageId));

        // P1-11 fix: Use targeted repository query instead of tagRepository.findAll().stream().filter(...)
        List<Tag> pageTags = tagRepository.findByPageIdAndStatusNot(pageId, "DEPRECATED");
        if (pageTags.isEmpty()) {
            return PageJob.builder()
                    .pageId(pageId)
                    .pageName(page.getPageName())
                    .domain(page.getModule())
                    .targetLanguage(targetLanguage)
                    .allTagIds(Collections.emptySet())
                    .chunks(Collections.emptyList())
                    .build();
        }

        List<String> pageTagIds = pageTags.stream().map(Tag::getTagId).collect(Collectors.toList());

        // Batch query for English copies (Fix 13: avoid N+1 queries)
        Map<String, EnglishCopy> englishCopyMap = englishCopyRepository.findAllById(pageTagIds).stream()
                .collect(Collectors.toMap(EnglishCopy::getTagId, Function.identity()));

        // Filter tags that have APPROVED English copy
        List<Tag> tagsWithApprovedEnglish = new ArrayList<>();
        Set<String> approvedEnglishTagIds = new LinkedHashSet<>();

        for (Tag tag : pageTags) {
            EnglishCopy ec = englishCopyMap.get(tag.getTagId());
            if (ec != null && "APPROVED".equals(ec.getStatus()) && ec.getCurrentVersionNumber() != null) {
                tagsWithApprovedEnglish.add(tag);
                approvedEnglishTagIds.add(tag.getTagId());
            }
        }

        if (approvedEnglishTagIds.isEmpty()) {
            return PageJob.builder()
                    .pageId(pageId)
                    .pageName(page.getPageName())
                    .domain(page.getModule())
                    .targetLanguage(targetLanguage)
                    .allTagIds(Collections.emptySet())
                    .chunks(Collections.emptyList())
                    .build();
        }

        // P0-7 fix: Guard approved translations from re-translation.
        // If specific tags were not explicitly requested, check existing translations and skip APPROVED non-stale ones.
        Map<String, Translation> existingTranslations = translationRepository
                .findByTagIdInAndLanguageCode(approvedEnglishTagIds, targetLanguage).stream()
                .collect(Collectors.toMap(Translation::getTagId, Function.identity()));

        Set<String> tagsToTranslateIds = new LinkedHashSet<>();
        for (String tagId : approvedEnglishTagIds) {
            if (specificTagIds != null && !specificTagIds.isEmpty()) {
                // If caller explicitly requested specific tags (e.g. forced retry), allow them
                if (specificTagIds.contains(tagId)) {
                    tagsToTranslateIds.add(tagId);
                }
            } else {
                Translation trans = existingTranslations.get(tagId);
                boolean isAlreadyApproved = trans != null && "APPROVED".equals(trans.getStatus()) && trans.getStaleTriggeredAt() == null;
                if (!isAlreadyApproved) {
                    tagsToTranslateIds.add(tagId);
                } else {
                    log.debug("Skipping tag {} because target translation is already APPROVED and not stale", tagId);
                }
            }
        }

        if (tagsToTranslateIds.isEmpty()) {
            return PageJob.builder()
                    .pageId(pageId)
                    .pageName(page.getPageName())
                    .domain(page.getModule())
                    .targetLanguage(targetLanguage)
                    .allTagIds(approvedEnglishTagIds)
                    .chunks(Collections.emptyList())
                    .build();
        }

        // Batch fetch English copy versions to get real English text for prompt building
        List<EnglishCopyVersion> copyVersions = englishCopyVersionRepository.findByTagIdIn(tagsToTranslateIds);
        Map<String, String> tagToEnglishText = new HashMap<>();
        for (EnglishCopyVersion ecv : copyVersions) {
            EnglishCopy ec = englishCopyMap.get(ecv.getTagId());
            if (ec != null && Objects.equals(ec.getCurrentVersionNumber(), ecv.getVersionNumber())) {
                tagToEnglishText.put(ecv.getTagId(), ecv.getText());
            }
        }

        List<TagContext> tagsToTranslate = new ArrayList<>();
        for (String tagId : tagsToTranslateIds) {
            EnglishCopy ec = englishCopyMap.get(tagId);
            String englishText = tagToEnglishText.getOrDefault(tagId, "");
            int ecVer = (ec != null && ec.getCurrentVersionNumber() != null) ? ec.getCurrentVersionNumber() : 1;
            tagsToTranslate.add(new TagContext(tagId, englishText, ecVer));
        }

        Map<String, String> termLocks = getTermLocksForLanguage(targetLanguage);

        List<TranslationChunk> chunks = new ArrayList<>();
        for (int i = 0; i < tagsToTranslate.size(); i += CHUNK_SIZE) {
            int end = Math.min(i + CHUNK_SIZE, tagsToTranslate.size());
            List<TagContext> chunkTags = tagsToTranslate.subList(i, end);
            
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
                .allTagIds(tagsToTranslateIds)
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
