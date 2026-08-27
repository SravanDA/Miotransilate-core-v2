package com.miotranslate.modules.admin.service;

import com.miotranslate.modules.admin.model.Language;
import com.miotranslate.modules.admin.model.SystemConfiguration;
import com.miotranslate.modules.admin.model.UserRoleAssignment;
import com.miotranslate.modules.admin.repository.LanguageRepository;
import com.miotranslate.modules.admin.repository.SystemConfigurationRepository;
import com.miotranslate.modules.admin.repository.UserRepository;
import com.miotranslate.modules.admin.repository.UserRoleAssignmentRepository;
import com.miotranslate.shared.concurrency.ConcurrencyUtils;
import com.miotranslate.shared.job.JobDispatcher;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Isolation;
import org.springframework.transaction.annotation.Transactional;

import java.time.OffsetDateTime;
import java.util.UUID;

@Service
public class AdminService {

    private final UserRepository userRepository;
    private final UserRoleAssignmentRepository roleRepository;
    private final LanguageRepository languageRepository;
    private final SystemConfigurationRepository configRepository;
    private final JobDispatcher jobDispatcher;

    public AdminService(UserRepository userRepository,
                        UserRoleAssignmentRepository roleRepository,
                        LanguageRepository languageRepository,
                        SystemConfigurationRepository configRepository,
                        JobDispatcher jobDispatcher) {
        this.userRepository = userRepository;
        this.roleRepository = roleRepository;
        this.languageRepository = languageRepository;
        this.configRepository = configRepository;
        this.jobDispatcher = jobDispatcher;
    }

    @Transactional(isolation = Isolation.READ_COMMITTED)
    public Language addLanguage(String languageCode, String languageName, String direction, UUID addedBy) {
        Language language = new Language();
        language.setLanguageCode(languageCode);
        language.setLanguageName(languageName);
        language.setDirection(direction);
        language.setAddedBy(addedBy);
        language = languageRepository.save(language);
        
        jobDispatcher.dispatch("CREATE_TRANSLATION_SLOTS", languageCode);

        return language;
    }

    @Transactional(isolation = Isolation.READ_COMMITTED)
    public Language deactivateLanguage(String languageCode) {
        Language language = languageRepository.findById(languageCode)
                .orElseThrow(() -> new IllegalArgumentException("Language not found"));
        language.setStatus("INACTIVE");
        return languageRepository.save(language);
    }

    @Transactional(isolation = Isolation.SERIALIZABLE)
    public UserRoleAssignment assignRole(UUID targetUserId, String role, UUID assignedBy) {
        UserRoleAssignment assignment = new UserRoleAssignment();
        assignment.setUserId(targetUserId);
        assignment.setRole(role);
        assignment.setAssignedBy(assignedBy);
        return roleRepository.save(assignment);
    }

    @Transactional(isolation = Isolation.SERIALIZABLE)
    public void revokeRole(UUID assignmentId, UUID revokedBy) {
        UserRoleAssignment assignment = roleRepository.findById(assignmentId)
                .orElseThrow(() -> new IllegalArgumentException("Assignment not found"));
        
        if (assignment.getRevokedAt() != null) {
            return; // Already revoked
        }

        // Lockout guard logic
        if ("ADMIN".equals(assignment.getRole()) || "FN".equals(assignment.getRole())) {
            long activeAdmins = roleRepository.countActiveAdminsAndFounders();
            long userAdminRoles = roleRepository.countActiveAdminRolesForUser(assignment.getUserId());
            
            if (activeAdmins <= 1 || (activeAdmins == userAdminRoles && userAdminRoles > 0)) {
                throw new IllegalStateException("Cannot revoke the last active ADMIN or FN role. Total lockout prevention.");
            }
        }

        assignment.setRevokedAt(OffsetDateTime.now());
        assignment.setRevokedBy(revokedBy);
        roleRepository.save(assignment);
    }

    @Transactional(isolation = Isolation.READ_COMMITTED)
    public SystemConfiguration updateConfig(String configKey, String configValue, String ifMatchETag, UUID updatedBy) {
        SystemConfiguration config = configRepository.findByIdForUpdate(configKey);
        if (config == null) {
            throw new IllegalArgumentException("Configuration key not found");
        }
        
        ConcurrencyUtils.validateETag(ifMatchETag, config.getEtagVersion(), "SYSTEM_CONFIGURATION", configKey);
        
        config.setConfigValue(configValue);
        config.setUpdatedBy(updatedBy);
        // ETag increments automatically via @Version
        return configRepository.save(config);
    }
}
