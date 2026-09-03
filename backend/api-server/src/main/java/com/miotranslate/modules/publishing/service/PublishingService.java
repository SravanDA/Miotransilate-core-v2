package com.miotranslate.modules.publishing.service;

import com.miotranslate.modules.content.model.EnglishCopy;
import com.miotranslate.modules.content.model.EnglishCopyVersion;
import com.miotranslate.modules.content.model.EnglishCopyVersionId;
import com.miotranslate.modules.content.repository.EnglishCopyRepository;
import com.miotranslate.modules.content.repository.EnglishCopyVersionRepository;
import com.miotranslate.modules.publishing.model.PublishingApprovalRequest;
import com.miotranslate.modules.publishing.model.Release;
import com.miotranslate.modules.publishing.repository.PublishingApprovalRequestRepository;
import com.miotranslate.modules.publishing.repository.ReleaseContentSnapshotRepository;
import com.miotranslate.modules.publishing.repository.ReleaseRepository;
import com.miotranslate.shared.audit.AuditService;
import com.miotranslate.shared.concurrency.ConcurrencyUtils;
import com.miotranslate.shared.integration.publishing.LanguageServicesClient;
import com.miotranslate.shared.integration.publishing.PushResult;
import com.miotranslate.modules.registry.model.Tag;
import com.miotranslate.modules.registry.repository.TagRepository;
import com.miotranslate.modules.translation.model.Translation;
import com.miotranslate.modules.translation.model.TranslationId;
import com.miotranslate.modules.translation.model.TranslationVersion;
import com.miotranslate.modules.translation.model.TranslationVersionId;
import com.miotranslate.modules.translation.repository.TranslationRepository;
import com.miotranslate.modules.translation.repository.TranslationVersionRepository;
import com.miotranslate.shared.job.JobDispatcher;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Isolation;
import org.springframework.transaction.annotation.Transactional;

import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@Service
public class PublishingService {

    private final PublishingApprovalRequestRepository parRepository;
    private final ReleaseRepository releaseRepository;
    private final ReleaseContentSnapshotRepository snapshotRepository;
    private final LanguageServicesClient languageServicesClient;
    private final AuditService auditService;
    private final JobDispatcher jobDispatcher;
    private final TagRepository tagRepository;
    private final TranslationRepository translationRepository;
    private final TranslationVersionRepository translationVersionRepository;
    private final EnglishCopyRepository englishCopyRepository;
    private final EnglishCopyVersionRepository englishCopyVersionRepository;
    private final com.miotranslate.shared.auth.PermissionService permissionService;

    public PublishingService(PublishingApprovalRequestRepository parRepository,
                             ReleaseRepository releaseRepository,
                             ReleaseContentSnapshotRepository snapshotRepository,
                             LanguageServicesClient languageServicesClient,
                             AuditService auditService,
                             JobDispatcher jobDispatcher,
                             TagRepository tagRepository,
                             TranslationRepository translationRepository,
                             TranslationVersionRepository translationVersionRepository,
                             EnglishCopyRepository englishCopyRepository,
                             EnglishCopyVersionRepository englishCopyVersionRepository,
                             com.miotranslate.shared.auth.PermissionService permissionService) {
        this.parRepository = parRepository;
        this.releaseRepository = releaseRepository;
        this.snapshotRepository = snapshotRepository;
        this.languageServicesClient = languageServicesClient;
        this.auditService = auditService;
        this.jobDispatcher = jobDispatcher;
        this.tagRepository = tagRepository;
        this.translationRepository = translationRepository;
        this.translationVersionRepository = translationVersionRepository;
        this.englishCopyRepository = englishCopyRepository;
        this.englishCopyVersionRepository = englishCopyVersionRepository;
        this.permissionService = permissionService;
    }

    @Transactional(readOnly = true)
    public Map<String, Object> getEnvironmentStatus(String pageId, String languageCode) {
        // Find latest release per environment
        Map<String, Object> status = new HashMap<>();
        status.put("MOCK", releaseRepository.findMaxDeploymentVersion(pageId, languageCode, "MOCK"));
        status.put("DEV", releaseRepository.findMaxDeploymentVersion(pageId, languageCode, "DEV"));
        status.put("QA", releaseRepository.findMaxDeploymentVersion(pageId, languageCode, "QA"));
        status.put("PRODUCTION", releaseRepository.findMaxDeploymentVersion(pageId, languageCode, "PRODUCTION"));
        return status;
    }

    @Transactional(readOnly = true)
    public Map<String, Object> getPrePublishingSummary(String pageId, String languageCode, String environment) {
        // Dummy implementation to compare tags
        Map<String, Object> summary = new HashMap<>();
        summary.put("status", "summary generated");
        return summary;
    }

    private void requirePublishPermission(UUID userId, String environment) {
        String reqPerm = "PUBLISH_" + environment.toUpperCase();
        if (!permissionService.hasPermission(userId, reqPerm)) {
            throw new org.springframework.security.access.AccessDeniedException("Missing permission: " + reqPerm);
        }
    }

    @Transactional(isolation = Isolation.SERIALIZABLE)
    public PublishingApprovalRequest requestPublishingApproval(String pageId, String languageCode, String environment, UUID requestedBy) {
        requirePublishPermission(requestedBy, environment);
        
        if (parRepository.existsByPageIdAndLanguageCodeAndEnvironmentAndStatus(pageId, languageCode, environment, "PENDING")) {
            throw new IllegalStateException("An active publishing request already exists");
        }

        PublishingApprovalRequest par = new PublishingApprovalRequest();
        par.setPageId(pageId);
        par.setLanguageCode(languageCode);
        par.setEnvironment(environment);
        par.setBundleSnapshotHash("MOCK_HASH_TODO"); // Hash of current APPROVED tags
        par.setRequiredApproverRole("ADMIN");
        par.setRequestedBy(requestedBy);
        par.setExpiresAt(OffsetDateTime.now().plusHours(72));

        parRepository.save(par);
        auditService.record("PUBLISHING_REQUESTED", "PUBLISHING_APPROVAL_REQUEST", par.getApprovalRequestId().toString(), "PAR created");
        jobDispatcher.dispatch("NOTIFICATION_DISPATCH", "PUBLISHING_REQUESTED");

        return par;
    }

    public PublishingApprovalRequest reviewPublishingApproval(UUID parId, String ifMatchETag, String action, UUID userId) {
        // Phase 1: validate and initialize Release
        Release release = null;
        PublishingApprovalRequest par = null;
        
        if ("APPROVE".equals(action)) {
            // Transactional block 1
            Object[] result = initializeRelease(parId, ifMatchETag, userId);
            par = (PublishingApprovalRequest) result[0];
            release = (Release) result[1];
            
            // Phase 2: Call Language Services
            Map<String, String> tagsToPublish = new HashMap<>();
            List<String> removeTags = new ArrayList<>();
            List<Tag> allTags = tagRepository.findByPageId(release.getPageId());

            boolean isEnglish = "eng".equalsIgnoreCase(release.getLanguageCode()) || "en".equalsIgnoreCase(release.getLanguageCode());
            String targetLang = isEnglish ? "eng" : release.getLanguageCode();

            for (Tag tag : allTags) {
                if ("DEPRECATED".equals(tag.getStatus())) {
                    removeTags.add(tag.getTagId());
                } else {
                    if (isEnglish) {
                        EnglishCopy ec = englishCopyRepository.findById(tag.getTagId()).orElse(null);
                        if (ec != null && ec.getCurrentVersionNumber() != null) {
                            EnglishCopyVersion ecv = englishCopyVersionRepository.findById(
                                new EnglishCopyVersionId(tag.getTagId(), ec.getCurrentVersionNumber())).orElse(null);
                            if (ecv != null && ecv.getText() != null) {
                                tagsToPublish.put(tag.getTagId(), ecv.getText());
                            }
                        }
                    } else {
                        Translation t = translationRepository.findById(new TranslationId(tag.getTagId(), release.getLanguageCode())).orElse(null);
                        if (t != null && "APPROVED".equals(t.getStatus()) && t.getCurrentVersionNumber() != null) {
                            TranslationVersion tv = translationVersionRepository.findById(new TranslationVersionId(tag.getTagId(), release.getLanguageCode(), t.getCurrentVersionNumber())).orElse(null);
                            if (tv != null && tv.getText() != null) {
                                tagsToPublish.put(tag.getTagId(), tv.getText());
                            }
                        }
                    }
                }
            }

            PushResult pushResult = languageServicesClient.pushBundle(
                    release.getPageId(), targetLang, release.getEnvironment(), tagsToPublish, removeTags);
                    
            // Phase 3: Finalize
            finalizeRelease(release.getReleaseId(), pushResult);
            
        } else if ("REJECT".equals(action)) {
            par = rejectPublishingApproval(parId, ifMatchETag, userId);
        }
        return par;
    }

    @Transactional(isolation = Isolation.SERIALIZABLE)
    protected Object[] initializeRelease(UUID parId, String ifMatchETag, UUID approvedBy) {
        PublishingApprovalRequest par = parRepository.findByIdForUpdate(parId)
                .orElseThrow(() -> new IllegalArgumentException("PAR not found"));

        requirePublishPermission(approvedBy, par.getEnvironment());

        ConcurrencyUtils.validateETag(ifMatchETag, par.getEtagVersion(), "PUBLISHING_APPROVAL_REQUEST", parId.toString());

        if (!"PENDING".equals(par.getStatus())) {
            throw new IllegalStateException("PAR is not in PENDING state");
        }
        
        if (par.getExpiresAt().isBefore(OffsetDateTime.now())) {
            par.setStatus("EXPIRED");
            parRepository.save(par);
            throw new IllegalStateException("PAR has expired");
        }

        par.setStatus("APPROVED");
        par.setDecidedBy(approvedBy);
        par.setDecidedAt(OffsetDateTime.now());
        par.setEtagVersion(par.getEtagVersion() + 1);
        parRepository.save(par);

        Release release = new Release();
        release.setPageId(par.getPageId());
        release.setLanguageCode(par.getLanguageCode());
        release.setEnvironment(par.getEnvironment());
        release.setApprovalRequestId(parId);
        release.setPublishedBy(approvedBy);
        release.setStatus("IN_PROGRESS");
        release.setTriggerSource("MANUAL_APPROVAL");
        
        // Loop to assign version and save (handle P1-02 Deployment Version Race)
        boolean saved = false;
        int retries = 3;
        while (!saved && retries > 0) {
            try {
                Integer maxVersion = releaseRepository.findMaxDeploymentVersion(par.getPageId(), par.getLanguageCode(), par.getEnvironment());
                release.setDeploymentVersion((maxVersion == null ? 0 : maxVersion) + 1);
                release = releaseRepository.save(release);
                // Flush is required to trigger DataIntegrityViolationException immediately
                releaseRepository.flush();
                saved = true;
            } catch (DataIntegrityViolationException e) {
                retries--;
                if (retries == 0) throw new IllegalStateException("Deployment version race condition could not be resolved");
            }
        }
        
        return new Object[]{par, release};
    }
    
    @Transactional(isolation = Isolation.SERIALIZABLE)
    protected PublishingApprovalRequest rejectPublishingApproval(UUID parId, String ifMatchETag, UUID rejectedBy) {
        PublishingApprovalRequest par = parRepository.findByIdForUpdate(parId)
                .orElseThrow(() -> new IllegalArgumentException("PAR not found"));
        
        requirePublishPermission(rejectedBy, par.getEnvironment());
        
        ConcurrencyUtils.validateETag(ifMatchETag, par.getEtagVersion(), "PUBLISHING_APPROVAL_REQUEST", parId.toString());
        par.setStatus("REJECTED");
        par.setDecidedBy(rejectedBy);
        par.setDecidedAt(OffsetDateTime.now());
        par.setEtagVersion(par.getEtagVersion() + 1);
        return parRepository.save(par);
    }

    @Transactional(isolation = Isolation.READ_COMMITTED)
    protected void finalizeRelease(UUID releaseId, PushResult result) {
        Release release = releaseRepository.findById(releaseId)
                .orElseThrow();
                
        release.setApiResponsePayload(result.getResponsePayload());
        release.setApiResponseSuccess(result.isSuccess());
        release.setStatus(result.isSuccess() ? "SUCCESSFUL" : "FAILED");
        release.setCompletedAt(OffsetDateTime.now());
        
        releaseRepository.save(release);
        auditService.record("RELEASE_EXECUTED", "RELEASE", releaseId.toString(), "Release " + release.getStatus());
        
        // If SUCCESSFUL, we would persist ReleaseContentSnapshots here.
    }

    @Transactional(readOnly = true)
    public List<Release> getDeploymentHistory(String pageId, String languageCode) {
        return releaseRepository.findAll().stream()
                .filter(r -> r.getPageId().equals(pageId) && r.getLanguageCode().equals(languageCode))
                .toList(); // Should paginate
    }

    public Release executeRollback(String pageId, String languageCode, String environment, UUID targetReleaseId, UUID userId) {
        // Phase 1: validate rollback target & init new Release
        Release newRelease = initializeRollbackRelease(pageId, languageCode, environment, targetReleaseId, userId);
        
        // Phase 2: Call Language Services (using snapshots from target release)
        List<com.miotranslate.modules.publishing.model.ReleaseContentSnapshot> snapshots = snapshotRepository.findByReleaseId(targetReleaseId);
        Map<String, String> tagsToPublish = new HashMap<>();
        for (com.miotranslate.modules.publishing.model.ReleaseContentSnapshot snapshot : snapshots) {
            tagsToPublish.put(snapshot.getTagId(), snapshot.getTranslationText());
        }

        List<Tag> allTags = tagRepository.findByPageId(pageId);
        List<String> removeTags = new ArrayList<>();
        for (Tag tag : allTags) {
            if (!tagsToPublish.containsKey(tag.getTagId())) {
                removeTags.add(tag.getTagId());
            }
        }

        PushResult pushResult = languageServicesClient.pushBundle(pageId, languageCode, environment, tagsToPublish, removeTags);
        
        // Phase 3: Finalize
        finalizeRelease(newRelease.getReleaseId(), pushResult);
        
        return newRelease;
    }
    
    @Transactional(isolation = Isolation.SERIALIZABLE)
    protected Release initializeRollbackRelease(String pageId, String languageCode, String environment, UUID targetReleaseId, UUID userId) {
        Release oldRelease = releaseRepository.findById(targetReleaseId).orElseThrow();
        if (!"SUCCESSFUL".equals(oldRelease.getStatus())) {
            throw new IllegalStateException("Can only rollback to a SUCCESSFUL release");
        }
        
        Release release = new Release();
        release.setPageId(pageId);
        release.setLanguageCode(languageCode);
        release.setEnvironment(environment);
        release.setPublishedBy(userId);
        release.setStatus("IN_PROGRESS");
        release.setTriggerSource("ROLLBACK");
        
        // Loop to assign version
        boolean saved = false;
        int retries = 3;
        while (!saved && retries > 0) {
            try {
                Integer maxVersion = releaseRepository.findMaxDeploymentVersion(pageId, languageCode, environment);
                release.setDeploymentVersion((maxVersion == null ? 0 : maxVersion) + 1);
                release = releaseRepository.save(release);
                releaseRepository.flush();
                saved = true;
            } catch (DataIntegrityViolationException e) {
                retries--;
                if (retries == 0) throw new IllegalStateException("Deployment version race condition could not be resolved");
            }
        }
        
        oldRelease.setStatus("ROLLED_BACK");
        releaseRepository.save(oldRelease);
        
        return release;
    }

    @Transactional(isolation = Isolation.SERIALIZABLE)
    public Release publishDirect(String pageId, String languageCode, String environment, UUID publishedBy) {
        requirePublishPermission(publishedBy, environment);
        
        Release release = new Release();
        release.setPageId(pageId);
        release.setLanguageCode(languageCode);
        release.setEnvironment(environment);
        release.setPublishedBy(publishedBy);
        release.setStatus("IN_PROGRESS");
        release.setTriggerSource("DIRECT_PUBLISH");

        Integer maxVersion = releaseRepository.findMaxDeploymentVersion(pageId, languageCode, environment);
        release.setDeploymentVersion((maxVersion == null ? 0 : maxVersion) + 1);
        release = releaseRepository.save(release);

        Map<String, String> tagsToPublish = new HashMap<>();
        List<String> removeTags = new ArrayList<>();
        List<Tag> allTags = tagRepository.findByPageId(pageId);

        boolean isEnglish = "eng".equalsIgnoreCase(languageCode) || "en".equalsIgnoreCase(languageCode);

        for (Tag tag : allTags) {
            if ("DEPRECATED".equals(tag.getStatus())) {
                removeTags.add(tag.getTagId());
            } else {
                if (isEnglish) {
                    EnglishCopy ec = englishCopyRepository.findById(tag.getTagId()).orElse(null);
                    if (ec != null && ec.getCurrentVersionNumber() != null) {
                        EnglishCopyVersion ecv = englishCopyVersionRepository.findById(
                            new EnglishCopyVersionId(tag.getTagId(), ec.getCurrentVersionNumber())).orElse(null);
                        if (ecv != null && ecv.getText() != null) {
                            tagsToPublish.put(tag.getTagId(), ecv.getText());
                        }
                    }
                } else {
                    Translation t = translationRepository.findById(new TranslationId(tag.getTagId(), languageCode)).orElse(null);
                    if (t != null && "APPROVED".equals(t.getStatus()) && t.getCurrentVersionNumber() != null) {
                        TranslationVersion tv = translationVersionRepository.findById(
                            new TranslationVersionId(tag.getTagId(), languageCode, t.getCurrentVersionNumber())).orElse(null);
                        if (tv != null && tv.getText() != null) {
                            tagsToPublish.put(tag.getTagId(), tv.getText());
                        }
                    }
                }
            }
        }

        String targetLang = isEnglish ? "eng" : languageCode;

        PushResult pushResult = languageServicesClient.pushBundle(
                pageId, targetLang, environment, tagsToPublish, removeTags);

        finalizeRelease(release.getReleaseId(), pushResult);
        return release;
    }
}
