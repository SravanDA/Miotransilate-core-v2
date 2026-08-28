package com.miotranslate.modules.admin.service;

import com.miotranslate.modules.admin.model.User;
import com.miotranslate.modules.admin.repository.UserRepository;
import com.miotranslate.modules.admin.repository.UserRoleAssignmentRepository;
import com.miotranslate.shared.audit.AuditService;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Isolation;
import org.springframework.transaction.annotation.Transactional;

import java.util.UUID;

@Service
public class UserService {

    private final UserRepository userRepository;
    private final UserRoleAssignmentRepository roleRepository;
    private final PasswordEncoder passwordEncoder;
    private final AuditService auditService;

    public UserService(UserRepository userRepository, UserRoleAssignmentRepository roleRepository, PasswordEncoder passwordEncoder, AuditService auditService) {
        this.userRepository = userRepository;
        this.roleRepository = roleRepository;
        this.passwordEncoder = passwordEncoder;
        this.auditService = auditService;
    }

    @Transactional(isolation = Isolation.READ_COMMITTED)
    public User createUser(String displayName, String email, String initialPassword, String externalAuthId) {
        if (userRepository.findByEmail(email).isPresent()) {
            throw new IllegalArgumentException("User with email already exists");
        }
        
        User user = new User();
        user.setDisplayName(displayName);
        user.setEmail(email);
        user.setExternalAuthId(externalAuthId);
        user.setIsActive(true);
        
        if (initialPassword != null && !initialPassword.isEmpty()) {
            user.setPasswordHash(passwordEncoder.encode(initialPassword));
            user.setMustChangePassword(true);
        } else {
            user.setMustChangePassword(false);
        }
        
        User savedUser = userRepository.save(user);
        auditService.record("USER_CREATED", "USER", savedUser.getUserId().toString(), "User created");
        return savedUser;
    }

    @Transactional(isolation = Isolation.READ_COMMITTED)
    public User updateUserStatus(UUID targetUserId, boolean isActive, UUID updatedBy) {
        User user = userRepository.findById(targetUserId)
                .orElseThrow(() -> new IllegalArgumentException("User not found"));
                
        if (targetUserId.equals(updatedBy)) {
            throw new IllegalStateException("Cannot change your own active status");
        }
                
        if (!isActive && user.getIsActive()) {
            long activeAdmins = roleRepository.countActiveAdminsAndFounders();
            long userAdminRoles = roleRepository.countActiveAdminRolesForUser(targetUserId);
            
            if (activeAdmins <= 1 || (activeAdmins == userAdminRoles && userAdminRoles > 0)) {
                throw new IllegalStateException("Cannot deactivate the last active ADMIN or FN user. Total lockout prevention.");
            }
        }
                
        user.setIsActive(isActive);
        User savedUser = userRepository.save(user);
        auditService.record("USER_STATUS_UPDATED", "USER", targetUserId.toString(), "User status set to " + isActive + " by " + updatedBy);
        return savedUser;
    }

    @Transactional(isolation = Isolation.READ_COMMITTED)
    public User updateDisplayName(UUID targetUserId, String newDisplayName) {
        User user = userRepository.findById(targetUserId)
                .orElseThrow(() -> new IllegalArgumentException("User not found"));
        user.setDisplayName(newDisplayName);
        return userRepository.save(user);
    }

    @Transactional(isolation = Isolation.READ_COMMITTED)
    public void changePassword(UUID targetUserId, String oldPassword, String newPassword, boolean isAdminReset) {
        User user = userRepository.findById(targetUserId)
                .orElseThrow(() -> new IllegalArgumentException("User not found"));
                
        if (!isAdminReset) {
            // Standard user changing own password
            if (user.getPasswordHash() != null) {
                if (oldPassword == null || !passwordEncoder.matches(oldPassword, user.getPasswordHash())) {
                    throw new IllegalArgumentException("Invalid current password");
                }
            }
        }
        
        user.setPasswordHash(passwordEncoder.encode(newPassword));
        user.setMustChangePassword(false);
        userRepository.save(user);
        
        auditService.record("USER_PASSWORD_CHANGED", "USER", targetUserId.toString(), isAdminReset ? "Admin reset password" : "User changed password");
    }
}
