package com.miotranslate.modules.admin.repository;

import com.miotranslate.modules.admin.model.RolePermission;
import com.miotranslate.modules.admin.model.RolePermissionId;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface RolePermissionRepository extends JpaRepository<RolePermission, RolePermissionId> {
    List<RolePermission> findByRoleCode(String roleCode);
    void deleteByRoleCode(String roleCode);
}
