package com.miotranslate.modules.admin.repository;

import com.miotranslate.modules.admin.model.Role;
import org.springframework.data.jpa.repository.JpaRepository;

public interface RoleRepository extends JpaRepository<Role, String> {
}
