package com.miotranslate.modules.admin.api;

import com.miotranslate.modules.admin.model.User;
import com.miotranslate.modules.admin.service.UserService;
import com.miotranslate.shared.auth.RequiresPermission;
import com.miotranslate.shared.auth.SecurityUtils;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/v1/users")
public class UserController {

    private final UserService userService;

    public UserController(UserService userService) {
        this.userService = userService;
    }

    @PostMapping
    @RequiresPermission("ADMIN_USERS")
    public ResponseEntity<User> createUser(@RequestBody Map<String, String> payload) {
        String displayName = payload.get("displayName");
        String email = payload.get("email");
        String initialPassword = payload.get("initialPassword");
        String externalAuthId = payload.get("externalAuthId");
        
        return ResponseEntity.ok(userService.createUser(displayName, email, initialPassword, externalAuthId));
    }

    @PatchMapping("/{userId}/status")
    @RequiresPermission("ADMIN_USERS")
    public ResponseEntity<User> updateStatus(
            @PathVariable UUID userId, 
            @RequestBody Map<String, Boolean> payload) {
        Boolean isActive = payload.get("isActive");
        UUID updatedBy = SecurityUtils.getCurrentUserId();
        return ResponseEntity.ok(userService.updateUserStatus(userId, isActive, updatedBy));
    }

    @PatchMapping("/{userId}/display-name")
    // Let's assume ADMIN_USERS can do this, but ideally current user can update their own profile.
    // The plan specifies "User Administration", so this is likely an admin action or self action.
    // For simplicity, we just protect it with ADMIN_USERS for now, or don't restrict it if it's the current user.
    // Let's use custom logic or just limit to ADMIN_USERS.
    @RequiresPermission("ADMIN_USERS")
    public ResponseEntity<User> updateDisplayName(
            @PathVariable UUID userId, 
            @RequestBody Map<String, String> payload) {
        return ResponseEntity.ok(userService.updateDisplayName(userId, payload.get("displayName")));
    }

    @PostMapping("/{userId}/password")
    // Handled by custom logic inside because users can change their own password
    public ResponseEntity<Void> changePassword(
            @PathVariable UUID userId,
            @RequestBody Map<String, String> payload) {
        
        UUID currentUserId = SecurityUtils.getCurrentUserId();
        boolean isAdmin = SecurityUtils.hasPermission("ADMIN_USERS");
        
        if (!currentUserId.equals(userId) && !isAdmin) {
            throw new org.springframework.security.access.AccessDeniedException("Cannot change password for other user");
        }

        String oldPassword = payload.get("oldPassword");
        String newPassword = payload.get("newPassword");
        boolean isAdminReset = isAdmin && !currentUserId.equals(userId);
        
        userService.changePassword(userId, oldPassword, newPassword, isAdminReset);
        return ResponseEntity.noContent().build();
    }
}
