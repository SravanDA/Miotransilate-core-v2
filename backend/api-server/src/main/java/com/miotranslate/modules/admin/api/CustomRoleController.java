package com.miotranslate.modules.admin.api;

import com.miotranslate.modules.admin.model.Role;
import com.miotranslate.modules.admin.service.CustomRoleService;
import com.miotranslate.shared.auth.RequiresPermission;
import com.miotranslate.shared.auth.SecurityUtils;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/v1/roles")
@RequiresPermission("ADMIN_USERS")
public class CustomRoleController {

    private final CustomRoleService customRoleService;

    public CustomRoleController(CustomRoleService customRoleService) {
        this.customRoleService = customRoleService;
    }

    @PostMapping
    public ResponseEntity<Role> createRole(@RequestBody Map<String, Object> payload) {
        UUID createdBy = SecurityUtils.getCurrentUserId();
        String roleCode = (String) payload.get("roleCode");
        String roleName = (String) payload.get("roleName");
        String description = (String) payload.get("description");
        @SuppressWarnings("unchecked")
        List<String> permissions = (List<String>) payload.get("permissions");
        
        return ResponseEntity.ok(customRoleService.createCustomRole(roleCode, roleName, description, permissions, createdBy));
    }

    @PutMapping("/{roleCode}")
    public ResponseEntity<Role> updateRole(
            @PathVariable String roleCode,
            @RequestBody Map<String, Object> payload) {
            
        UUID updatedBy = SecurityUtils.getCurrentUserId();
        String roleName = (String) payload.get("roleName");
        String description = (String) payload.get("description");
        @SuppressWarnings("unchecked")
        List<String> permissions = (List<String>) payload.get("permissions");
        
        return ResponseEntity.ok(customRoleService.updateCustomRole(roleCode, roleName, description, permissions, updatedBy));
    }

    @PatchMapping("/{roleCode}/status")
    public ResponseEntity<Role> toggleStatus(
            @PathVariable String roleCode,
            @RequestBody Map<String, Boolean> payload) {
            
        UUID updatedBy = SecurityUtils.getCurrentUserId();
        Boolean isActive = payload.get("isActive");
        
        return ResponseEntity.ok(customRoleService.toggleRoleStatus(roleCode, isActive, updatedBy));
    }
}
