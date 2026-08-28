package com.miotranslate.modules.admin.service;

import com.miotranslate.modules.admin.model.Permission;
import com.miotranslate.modules.admin.model.Role;
import com.miotranslate.modules.admin.model.RolePermission;
import com.miotranslate.modules.admin.repository.PermissionRepository;
import com.miotranslate.modules.admin.repository.RolePermissionRepository;
import com.miotranslate.modules.admin.repository.RoleRepository;
import com.miotranslate.shared.audit.AuditService;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Isolation;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.UUID;

@Service
public class CustomRoleService {

    private final RoleRepository roleRepository;
    private final PermissionRepository permissionRepository;
    private final RolePermissionRepository rolePermissionRepository;
    private final AuditService auditService;

    public CustomRoleService(RoleRepository roleRepository,
                             PermissionRepository permissionRepository,
                             RolePermissionRepository rolePermissionRepository,
                             AuditService auditService) {
        this.roleRepository = roleRepository;
        this.permissionRepository = permissionRepository;
        this.rolePermissionRepository = rolePermissionRepository;
        this.auditService = auditService;
    }

    @Transactional(isolation = Isolation.READ_COMMITTED)
    public Role createCustomRole(String roleCode, String roleName, String description, List<String> permissions, UUID createdBy) {
        if (roleRepository.existsById(roleCode)) {
            throw new IllegalArgumentException("Role code already exists");
        }
        
        Role role = new Role();
        role.setRoleCode(roleCode);
        role.setRoleName(roleName);
        role.setDescription(description);
        role.setIsSystem(false);
        role.setIsActive(true);
        role.setCreatedBy(createdBy);
        Role savedRole = roleRepository.save(role);

        assignPermissions(roleCode, permissions);
        
        auditService.record("CUSTOM_ROLE_CREATED", "ROLE", roleCode, "Custom role created by " + createdBy);
        return savedRole;
    }

    @Transactional(isolation = Isolation.READ_COMMITTED)
    public Role updateCustomRole(String roleCode, String roleName, String description, List<String> permissions, UUID updatedBy) {
        Role role = roleRepository.findById(roleCode)
                .orElseThrow(() -> new IllegalArgumentException("Role not found"));
                
        if (role.getIsSystem()) {
            throw new IllegalStateException("Cannot modify a system role");
        }
        
        role.setRoleName(roleName);
        role.setDescription(description);
        Role updatedRole = roleRepository.save(role);
        
        rolePermissionRepository.deleteByRoleCode(roleCode);
        assignPermissions(roleCode, permissions);
        
        auditService.record("CUSTOM_ROLE_UPDATED", "ROLE", roleCode, "Custom role updated by " + updatedBy);
        return updatedRole;
    }

    @Transactional(isolation = Isolation.READ_COMMITTED)
    public Role toggleRoleStatus(String roleCode, boolean isActive, UUID updatedBy) {
        Role role = roleRepository.findById(roleCode)
                .orElseThrow(() -> new IllegalArgumentException("Role not found"));
                
        if (role.getIsSystem()) {
            throw new IllegalStateException("Cannot toggle status of a system role");
        }
        
        role.setIsActive(isActive);
        Role updatedRole = roleRepository.save(role);
        
        auditService.record("CUSTOM_ROLE_STATUS_CHANGED", "ROLE", roleCode, "Custom role status set to " + isActive + " by " + updatedBy);
        return updatedRole;
    }

    private void assignPermissions(String roleCode, List<String> permissionCodes) {
        for (String permCode : permissionCodes) {
            Permission permission = permissionRepository.findById(permCode)
                    .orElseThrow(() -> new IllegalArgumentException("Invalid permission code: " + permCode));
                    
            if (permission.getIsProtected()) {
                throw new IllegalStateException("Cannot assign PROTECTED permission to a custom role: " + permCode);
            }
            
            RolePermission rp = new RolePermission();
            rp.setRoleCode(roleCode);
            rp.setPermissionCode(permCode);
            rolePermissionRepository.save(rp);
        }
    }
}
