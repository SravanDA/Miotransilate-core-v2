package com.miotranslate.modules.content.service;

import com.miotranslate.modules.content.model.EnglishCopy;
import com.miotranslate.modules.content.model.EnglishCopyVersion;
import com.miotranslate.modules.content.repository.EnglishCopyRepository;
import com.miotranslate.modules.content.repository.EnglishCopyVersionRepository;
import com.miotranslate.shared.audit.AuditService;
import com.miotranslate.shared.concurrency.ConcurrencyUtils;
import com.miotranslate.shared.job.JobDispatcher;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Isolation;
import org.springframework.transaction.annotation.Transactional;

import java.time.OffsetDateTime;
import java.util.UUID;

import com.miotranslate.modules.translation.model.Translation;
import com.miotranslate.modules.translation.repository.TranslationRepository;
import java.util.List;

@Service
public class ContentService {

    private final EnglishCopyRepository englishCopyRepository;
    private final EnglishCopyVersionRepository versionRepository;
    private final TranslationRepository translationRepository;
    private final AuditService auditService;
    private final JobDispatcher jobDispatcher;

    public ContentService(EnglishCopyRepository englishCopyRepository, 
                          EnglishCopyVersionRepository versionRepository,
                          TranslationRepository translationRepository,
                          AuditService auditService, 
                          JobDispatcher jobDispatcher) {
        this.englishCopyRepository = englishCopyRepository;
        this.versionRepository = versionRepository;
        this.translationRepository = translationRepository;
        this.auditService = auditService;
        this.jobDispatcher = jobDispatcher;
    }

    @Transactional(isolation = Isolation.READ_COMMITTED)
    public void initializeEnglishCopy(String tagId) {
        EnglishCopy ec = new EnglishCopy();
        ec.setTagId(tagId);
        ec.setStatus("NO_COPY");
        ec.setEtagVersion(1);
        englishCopyRepository.save(ec);
        auditService.record("ENGLISH_COPY_INITIALIZED", "ENGLISH_COPY", tagId, "Initialized NO_COPY for tag " + tagId);
    }

    @Transactional(isolation = Isolation.READ_COMMITTED)
    public EnglishCopyVersion saveDraft(String tagId, String ifMatchETag, String text, String changeReason, UUID userId) {
        EnglishCopy ec = englishCopyRepository.findByIdForUpdate(tagId)
                .orElseThrow(() -> new IllegalArgumentException("English Copy not found"));
        
        ConcurrencyUtils.validateETag(ifMatchETag, ec.getEtagVersion(), "ENGLISH_COPY", tagId);
        
        // Find existing draft or create new version
        EnglishCopyVersion latest = versionRepository.findTopByTagIdOrderByVersionNumberDesc(tagId).orElse(null);
        EnglishCopyVersion draft;
        
        if (latest != null && "DRAFT".equals(latest.getStatus())) {
            draft = latest;
            draft.setText(text);
            draft.setChangeReason(changeReason);
        } else {
            draft = new EnglishCopyVersion();
            draft.setTagId(tagId);
            draft.setVersionNumber(latest == null ? 1 : latest.getVersionNumber() + 1);
            draft.setText(text);
            draft.setChangeReason(changeReason);
            draft.setAuthoredBy(userId);
            draft.setStatus("DRAFT");
        }
        
        ec.setStatus("DRAFT");
        ec.setEtagVersion(ec.getEtagVersion() + 1);
        
        versionRepository.save(draft);
        englishCopyRepository.save(ec);
        
        auditService.record("ENGLISH_COPY_DRAFT_SAVED", "ENGLISH_COPY", tagId, "Draft saved for " + tagId);
        return draft;
    }

    @Transactional(isolation = Isolation.SERIALIZABLE)
    public EnglishCopy approve(String tagId, String ifMatchETag, UUID userId) {
        EnglishCopy ec = englishCopyRepository.findByIdForUpdate(tagId)
                .orElseThrow(() -> new IllegalArgumentException("English Copy not found"));
        
        ConcurrencyUtils.validateETag(ifMatchETag, ec.getEtagVersion(), "ENGLISH_COPY", tagId);
        
        EnglishCopyVersion latest = versionRepository.findTopByTagIdOrderByVersionNumberDesc(tagId)
                .orElseThrow(() -> new IllegalStateException("No versions found to approve"));
                
        if (!"IN_REVIEW".equals(latest.getStatus()) && !"DRAFT".equals(latest.getStatus())) {
            throw new IllegalStateException("Latest version must be DRAFT or IN_REVIEW to approve");
        }
        
        // Check if text changed from previous approved
        boolean textChanged = true;
        if (ec.getCurrentVersionNumber() != null) {
            // we could fetch the previous approved version and compare text
            textChanged = true; // Assume true for now
        }
        
        latest.setStatus("APPROVED");
        latest.setApprovedBy(userId);
        latest.setApprovedAt(OffsetDateTime.now());
        
        ec.setStatus("APPROVED");
        ec.setCurrentVersionNumber(latest.getVersionNumber());
        ec.setEtagVersion(ec.getEtagVersion() + 1);
        
        versionRepository.save(latest);
        englishCopyRepository.save(ec);
        
        auditService.record("ENGLISH_COPY_APPROVED", "ENGLISH_COPY", tagId, "Approved version " + latest.getVersionNumber());
        
        if (textChanged) {
            List<Translation> translations = translationRepository.findByTagId(tagId);
            for (Translation t : translations) {
                if (!"NO_TRANSLATION".equals(t.getStatus()) && !"DEPRECATED".equals(t.getStatus())) {
                    t.setStatus("STALE");
                    t.setStaleTriggeredAt(OffsetDateTime.now());
                    t.setEtagVersion(t.getEtagVersion() + 1);
                    translationRepository.save(t);
                    auditService.record("TRANSLATION_MARKED_STALE", "TRANSLATION", t.getTagId() + "/" + t.getLanguageCode(), "Cascade from EC approval");
                }
            }
            jobDispatcher.dispatch("STALE_CASCADE", tagId);
            jobDispatcher.dispatch("IMPLICIT_DEV_PUBLISH", tagId);
        }
        jobDispatcher.dispatch("NOTIFICATION_DISPATCH", "EC_APPROVED");
        
        return ec;
    }

    @Transactional(isolation = Isolation.READ_COMMITTED)
    public EnglishCopy submitForReview(String tagId, String ifMatchETag, UUID userId) {
        EnglishCopy ec = englishCopyRepository.findByIdForUpdate(tagId)
                .orElseThrow(() -> new IllegalArgumentException("English Copy not found"));
        
        ConcurrencyUtils.validateETag(ifMatchETag, ec.getEtagVersion(), "ENGLISH_COPY", tagId);
        
        EnglishCopyVersion latest = versionRepository.findTopByTagIdOrderByVersionNumberDesc(tagId)
                .orElseThrow(() -> new IllegalStateException("No versions found to submit"));
                
        if (!"DRAFT".equals(latest.getStatus())) {
            throw new IllegalStateException("Only DRAFT versions can be submitted");
        }
        
        latest.setStatus("IN_REVIEW");
        ec.setStatus("PENDING_REVIEW");
        ec.setEtagVersion(ec.getEtagVersion() + 1);
        
        versionRepository.save(latest);
        englishCopyRepository.save(ec);
        
        auditService.record("ENGLISH_COPY_SUBMITTED", "ENGLISH_COPY", tagId, "Submitted draft for review");
        jobDispatcher.dispatch("NOTIFICATION_DISPATCH", "EC_SUBMITTED");
        
        return ec;
    }

    @Transactional(readOnly = true)
    public java.util.List<EnglishCopyVersion> getVersions(String tagId) {
        return versionRepository.findByTagIdOrderByVersionNumberDesc(tagId);
    }
}
