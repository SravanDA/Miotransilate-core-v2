package com.miotranslate.shared.auth;

import com.miotranslate.modules.admin.model.User;
import com.miotranslate.modules.admin.repository.UserRepository;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/v1/auth")
public class AuthController {

    private final UserRepository userRepository;
    private final JwtService jwtService;
    private final LoginRateLimiter rateLimiter;
    private final PermissionService permissionService;
    private final PasswordEncoder passwordEncoder = new BCryptPasswordEncoder(12);

    public AuthController(UserRepository userRepository, JwtService jwtService, 
                          LoginRateLimiter rateLimiter, PermissionService permissionService) {
        this.userRepository = userRepository;
        this.jwtService = jwtService;
        this.rateLimiter = rateLimiter;
        this.permissionService = permissionService;
    }

    @PostMapping("/login")
    public ResponseEntity<?> login(@RequestBody LoginRequest request) {
        if (!rateLimiter.isAllowed(request.getEmail())) {
            throw new ResponseStatusException(HttpStatus.TOO_MANY_REQUESTS, "TOO_MANY_ATTEMPTS");
        }

        User user = userRepository.findByEmail(request.getEmail())
                .orElseThrow(() -> {
                    rateLimiter.recordFailedAttempt(request.getEmail());
                    return new ResponseStatusException(HttpStatus.UNAUTHORIZED, "INVALID_CREDENTIALS");
                });

        if (!user.getIsActive()) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "ACCOUNT_SUSPENDED");
        }

        if (user.getPasswordHash() == null || !passwordEncoder.matches(request.getPassword(), user.getPasswordHash())) {
            rateLimiter.recordFailedAttempt(request.getEmail());
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "INVALID_CREDENTIALS");
        }

        rateLimiter.resetAttempts(request.getEmail());

        List<String> roles = permissionService.getRoles(user.getUserId());
        List<String> permissions = new java.util.ArrayList<>(permissionService.getEffectivePermissions(user.getUserId()));

        String token = jwtService.generateToken(
                user.getUserId(),
                user.getEmail(),
                user.getDisplayName(),
                roles,
                permissions,
                user.getMustChangePassword()
        );

        return ResponseEntity.ok(Map.of(
                "token", token,
                "user", Map.of(
                        "userId", user.getUserId(),
                        "displayName", user.getDisplayName(),
                        "email", user.getEmail(),
                        "roles", roles,
                        "permissions", permissions
                ),
                "mustChangePassword", user.getMustChangePassword()
        ));
    }

    @GetMapping("/me")
    public ResponseEntity<?> me() {
        UUID userId = SecurityUtils.getCurrentUserId();
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "User not found"));
                
        List<String> roles = permissionService.getRoles(user.getUserId());
        List<String> permissions = new java.util.ArrayList<>(permissionService.getEffectivePermissions(user.getUserId()));

        return ResponseEntity.ok(Map.of(
                "userId", user.getUserId(),
                "displayName", user.getDisplayName(),
                "email", user.getEmail(),
                "roles", roles,
                "permissions", permissions,
                "mustChangePassword", user.getMustChangePassword()
        ));
    }

    @RequestMapping(value = {"/password", "/change-password"}, method = {RequestMethod.PUT, RequestMethod.POST})
    public ResponseEntity<?> changePassword(@RequestBody ChangePasswordRequest request) {
        UUID userId = SecurityUtils.getCurrentUserId();
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "User not found"));

        String oldPass = request.getOldPassword();
        if (user.getPasswordHash() != null && (oldPass == null || !passwordEncoder.matches(oldPass, user.getPasswordHash()))) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "INVALID_OLD_PASSWORD");
        }

        if (request.getNewPassword() == null || request.getNewPassword().length() < 8) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Password must be at least 8 characters long");
        }

        user.setPasswordHash(passwordEncoder.encode(request.getNewPassword()));
        user.setMustChangePassword(false);
        userRepository.save(user);

        List<String> roles = permissionService.getRoles(user.getUserId());
        List<String> permissions = new java.util.ArrayList<>(permissionService.getEffectivePermissions(user.getUserId()));

        // Generate new token
        String token = jwtService.generateToken(
                user.getUserId(),
                user.getEmail(),
                user.getDisplayName(),
                roles,
                permissions,
                false
        );

        return ResponseEntity.ok(Map.of(
                "token", token,
                "user", Map.of(
                        "userId", user.getUserId(),
                        "displayName", user.getDisplayName(),
                        "email", user.getEmail(),
                        "roles", roles,
                        "permissions", permissions
                ),
                "mustChangePassword", false
        ));
    }
}

class LoginRequest {
    private String email;
    private String password;
    public String getEmail() { return email; }
    public void setEmail(String email) { this.email = email; }
    public String getPassword() { return password; }
    public void setPassword(String password) { this.password = password; }
}

class ChangePasswordRequest {
    private String oldPassword;
    private String currentPassword;
    private String newPassword;

    public String getOldPassword() { 
        return oldPassword != null ? oldPassword : currentPassword; 
    }
    public void setOldPassword(String oldPassword) { this.oldPassword = oldPassword; }

    public String getCurrentPassword() { 
        return currentPassword != null ? currentPassword : oldPassword; 
    }
    public void setCurrentPassword(String currentPassword) { this.currentPassword = currentPassword; }

    public String getNewPassword() { return newPassword; }
    public void setNewPassword(String newPassword) { this.newPassword = newPassword; }
}
