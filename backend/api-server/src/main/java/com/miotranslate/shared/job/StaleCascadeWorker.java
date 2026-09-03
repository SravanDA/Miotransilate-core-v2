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
        
        List<Translation> translations = translationRepository.findByTagId(tagId);

        for (Translation t : translations) {
            if (!"NO_TRANSLATION".equals(t.getStatus()) && !"DEPRECATED".equals(t.getStatus())) {
                t.setStatus("STALE");
                t.setStaleTriggeredAt(java.time.OffsetDateTime.now());
                t.setEtagVersion(t.getEtagVersion() + 1);
                translationRepository.save(t);
                auditService.record("TRANSLATION_MARKED_STALE", "TRANSLATION", t.getTagId() + "/" + t.getLanguageCode(), "Cascade from EC approval");
                
                // Dispatch coverage recalc for this page+lang combo
                jobDispatcher.dispatch("COVERAGE_RECALC", t.getLanguageCode());
            }
        }
        
        jobDispatcher.dispatch("NOTIFICATION_DISPATCH", "STALE_CASCADE_COMPLETED");
    }
}
