package com.miotranslate.modules.admin.repository;

import com.miotranslate.modules.admin.model.Permission;
import org.springframework.data.jpa.repository.JpaRepository;

public interface PermissionRepository extends JpaRepository<Permission, String> {
}
