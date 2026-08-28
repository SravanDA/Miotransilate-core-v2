package com.miotranslate.shared.auth;

import com.github.benmanes.caffeine.cache.Cache;
import com.github.benmanes.caffeine.cache.Caffeine;
import jakarta.persistence.EntityManager;
import org.springframework.stereotype.Service;

import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.TimeUnit;

@Service
public class PermissionService {

    private final EntityManager entityManager;

    private final Cache<UUID, Set<String>> userPermissionsCache = Caffeine.newBuilder()
            .expireAfterWrite(30, TimeUnit.SECONDS)
            .maximumSize(200)
            .build();

    private final Cache<UUID, List<String>> userRolesCache = Caffeine.newBuilder()
            .expireAfterWrite(30, TimeUnit.SECONDS)
            .maximumSize(200)
            .build();

    public PermissionService(EntityManager entityManager) {
        this.entityManager = entityManager;
    }

    public Set<String> getEffectivePermissions(UUID userId) {
        List<String> roles = getRoles(userId);
        if (roles.contains("DEV")) {
            Set<String> devSet = new HashSet<>();
            devSet.add("*"); // Universal permission for DEV
            return devSet;
        }
        return userPermissionsCache.get(userId, k -> fetchPermissionsFromDb(userId));
    }

    public List<String> getRoles(UUID userId) {
        return userRolesCache.get(userId, k -> fetchRolesFromDb(userId));
    }

    public boolean hasPermission(UUID userId, String permissionCode) {
        Set<String> perms = getEffectivePermissions(userId);
        return perms.contains("*") || perms.contains(permissionCode);
    }

    public void invalidateUser(UUID userId) {
        userPermissionsCache.invalidate(userId);
        userRolesCache.invalidate(userId);
    }

    public void invalidateRole(String roleCode) {
        @SuppressWarnings("unchecked")
        List<UUID> affectedUsers = entityManager.createNativeQuery(
                "SELECT user_id FROM admin.user_role_assignments WHERE role = :roleCode AND revoked_at IS NULL"
        )
        .setParameter("roleCode", roleCode)
        .getResultList();

        for (UUID userId : affectedUsers) {
            invalidateUser(userId);
        }
    }

    public Set<String> getPermissionsForRoles(List<String> roleCodes) {
        if (roleCodes == null || roleCodes.isEmpty()) return new HashSet<>();
        if (roleCodes.contains("DEV")) {
            Set<String> devSet = new HashSet<>();
            devSet.add("*");
            return devSet;
        }

        @SuppressWarnings("unchecked")
        List<String> permissions = entityManager.createNativeQuery(
                "SELECT DISTINCT rp.permission_code " +
                "FROM admin.role_permissions rp " +
                "JOIN admin.roles r ON rp.role_code = r.role_code " +
                "WHERE rp.role_code IN (:roles) " +
                "AND r.is_active = true"
        )
        .setParameter("roles", roleCodes)
        .getResultList();
        
        return new HashSet<>(permissions);
    }

    private Set<String> fetchPermissionsFromDb(UUID userId) {
        @SuppressWarnings("unchecked")
        List<String> permissions = entityManager.createNativeQuery(
                "SELECT DISTINCT rp.permission_code " +
                "FROM admin.user_role_assignments ura " +
                "JOIN admin.role_permissions rp ON ura.role = rp.role_code " +
                "JOIN admin.roles r ON rp.role_code = r.role_code " +
                "WHERE ura.user_id = :userId " +
                "AND ura.revoked_at IS NULL " +
                "AND r.is_active = true"
        )
        .setParameter("userId", userId)
        .getResultList();
        
        return new HashSet<>(permissions);
    }

    private List<String> fetchRolesFromDb(UUID userId) {
        @SuppressWarnings("unchecked")
        List<String> roles = entityManager.createNativeQuery(
                "SELECT ura.role " +
                "FROM admin.user_role_assignments ura " +
                "JOIN admin.roles r ON ura.role = r.role_code " +
                "WHERE ura.user_id = :userId " +
                "AND ura.revoked_at IS NULL " +
                "AND r.is_active = true"
        )
        .setParameter("userId", userId)
        .getResultList();
        
        return roles;
    }
}
