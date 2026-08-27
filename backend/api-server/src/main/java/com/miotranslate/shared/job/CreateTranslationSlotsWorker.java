package com.miotranslate.shared.job;

import com.miotranslate.modules.content.model.EnglishCopy;
import com.miotranslate.modules.content.repository.EnglishCopyRepository;
import com.miotranslate.modules.translation.model.Translation;
import com.miotranslate.modules.translation.repository.TranslationRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.time.OffsetDateTime;
import java.util.List;

@Component
public class CreateTranslationSlotsWorker {
    private static final Logger log = LoggerFactory.getLogger(CreateTranslationSlotsWorker.class);
    
    private final EnglishCopyRepository englishCopyRepository;
    private final TranslationRepository translationRepository;

    public CreateTranslationSlotsWorker(EnglishCopyRepository englishCopyRepository, TranslationRepository translationRepository) {
        this.englishCopyRepository = englishCopyRepository;
        this.translationRepository = translationRepository;
    }

    @Transactional
    public void process(Object payload) {
        String languageCode = (String) payload;
        log.info("Running CREATE_TRANSLATION_SLOTS for languageCode={}", languageCode);
        
        List<EnglishCopy> allTags = englishCopyRepository.findAll();
        
        int count = 0;
        for (EnglishCopy tag : allTags) {
            // Check if it already exists (idempotency)
            boolean exists = translationRepository.findAll().stream()
                    .anyMatch(t -> t.getTagId().equals(tag.getTagId()) && t.getLanguageCode().equals(languageCode));
                    
            if (!exists) {
                Translation t = new Translation();
                t.setTagId(tag.getTagId());
                t.setLanguageCode(languageCode);
                t.setStatus("NO_TRANSLATION");
                t.setEtagVersion(1);
                t.setCreatedAt(OffsetDateTime.now());
                t.setUpdatedAt(OffsetDateTime.now());
                translationRepository.save(t);
                count++;
            }
        }
        
        log.info("Successfully created {} empty translation slots for language {}", count, languageCode);
    }
}
