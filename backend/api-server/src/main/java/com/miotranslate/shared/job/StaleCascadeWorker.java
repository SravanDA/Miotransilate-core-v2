package com.miotranslate.shared.job;

import com.miotranslate.modules.translation.model.Translation;
import com.miotranslate.modules.translation.repository.TranslationRepository;
import com.miotranslate.shared.audit.AuditService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Component
public class StaleCascadeWorker {
    private static final Logger log = LoggerFactory.getLogger(StaleCascadeWorker.class);
    
    private final TranslationRepository translationRepository;
    private final AuditService auditService;
    private final JobDispatcher jobDispatcher;

    public StaleCascadeWorker(TranslationRepository translationRepository, AuditService auditService, JobDispatcher jobDispatcher) {
        this.translationRepository = translationRepository;
        this.auditService = auditService;
        this.jobDispatcher = jobDispatcher;
    }

    @Transactional
    public void process(Object payload) {
        String tagId = (String) payload;
        log.info("Running STALE_CASCADE for tagId={}", tagId);
        
        // Find all translations for this tag that are APPROVED or IN_REVIEW and make them STALE
        List<Translation> translations = translationRepository.findAll().stream()
                .filter(t -> t.getTagId().equals(tagId))
                .filter(t -> "APPROVED".equals(t.getStatus()) || "IN_REVIEW".equals(t.getStatus()))
                .toList();

        for (Translation t : translations) {
            t.setStatus("STALE");
            t.setEtagVersion(t.getEtagVersion() + 1);
            translationRepository.save(t);
            auditService.record("TRANSLATION_MARKED_STALE", "TRANSLATION", t.getTagId() + "/" + t.getLanguageCode(), "Cascade from EC approval");
            
            // Dispatch coverage recalc for this page+lang combo
            jobDispatcher.dispatch("COVERAGE_RECALC", t.getLanguageCode());
        }
        
        jobDispatcher.dispatch("NOTIFICATION_DISPATCH", "STALE_CASCADE_COMPLETED");
    }
}
