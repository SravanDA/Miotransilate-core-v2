package com.miotranslate.modules.admin.api;

import com.miotranslate.modules.admin.model.Language;
import com.miotranslate.modules.admin.model.SystemConfiguration;
import com.miotranslate.modules.admin.model.User;
import com.miotranslate.modules.admin.model.UserRoleAssignment;
import com.miotranslate.modules.admin.repository.LanguageRepository;
import com.miotranslate.modules.admin.repository.SystemConfigurationRepository;
import com.miotranslate.modules.admin.repository.UserRepository;
import com.miotranslate.modules.admin.service.AdminService;
import com.miotranslate.shared.auth.SecurityUtils;
import org.springframework.http.HttpHeaders;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/v1")
public class AdminController {

    private final AdminService adminService;
    private final UserRepository userRepository;
    private final LanguageRepository languageRepository;
    private final SystemConfigurationRepository configRepository;

    public AdminController(AdminService adminService,
                           UserRepository userRepository,
                           LanguageRepository languageRepository,
                           SystemConfigurationRepository configRepository) {
        this.adminService = adminService;
        this.userRepository = userRepository;
        this.languageRepository = languageRepository;
        this.configRepository = configRepository;
    }

    @GetMapping("/users")
    public ResponseEntity<List<User>> listUsers() {
        return ResponseEntity.ok(userRepository.findAll());
    }

    @PostMapping("/languages")
    public ResponseEntity<Language> addLanguage(@RequestBody Map<String, String> payload) {
        UUID userId = SecurityUtils.getCurrentUserId();
        String code = payload.get("languageCode");
        String name = payload.get("languageName");
        String dir = payload.getOrDefault("direction", "LTR");
        
        Language lang = adminService.addLanguage(code, name, dir, userId);
        return ResponseEntity.ok(lang);
    }
    
    @GetMapping("/languages")
    public ResponseEntity<List<Language>> listLanguages() {
        return ResponseEntity.ok(languageRepository.findAll());
    }

    @PatchMapping("/languages/{code}/deactivate")
    public ResponseEntity<Language> deactivateLanguage(@PathVariable String code) {
        Language lang = adminService.deactivateLanguage(code);
        return ResponseEntity.ok(lang);
    }

    @PostMapping("/users/{userId}/roles")
    public ResponseEntity<UserRoleAssignment> assignRole(@PathVariable UUID userId, @RequestBody Map<String, String> payload) {
        UUID assignedBy = SecurityUtils.getCurrentUserId();
        String role = payload.get("role");
        UserRoleAssignment assignment = adminService.assignRole(userId, role, assignedBy);
        return ResponseEntity.ok(assignment);
    }

    @DeleteMapping("/roles/{assignmentId}")
    public ResponseEntity<Void> revokeRole(@PathVariable UUID assignmentId) {
        UUID revokedBy = SecurityUtils.getCurrentUserId();
        adminService.revokeRole(assignmentId, revokedBy);
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/config")
    public ResponseEntity<List<SystemConfiguration>> listConfig() {
        return ResponseEntity.ok(configRepository.findAll());
    }

    @PatchMapping("/config/{key}")
    public ResponseEntity<SystemConfiguration> updateConfig(
            @PathVariable String key,
            @RequestHeader(value = HttpHeaders.IF_MATCH, required = false) String ifMatch,
            @RequestBody Map<String, Object> payload) {
            
        UUID updatedBy = SecurityUtils.getCurrentUserId();
        String value = (String) payload.get("configValue");
        
        SystemConfiguration config = adminService.updateConfig(key, value, ifMatch, updatedBy);
        return ResponseEntity.ok().eTag(String.valueOf(config.getEtagVersion())).body(config);
    }
}
