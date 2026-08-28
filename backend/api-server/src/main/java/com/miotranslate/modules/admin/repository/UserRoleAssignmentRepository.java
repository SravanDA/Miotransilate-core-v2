package com.miotranslate.modules.admin.repository;

import com.miotranslate.modules.admin.model.UserRoleAssignment;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.UUID;

@Repository
public interface UserRoleAssignmentRepository extends JpaRepository<UserRoleAssignment, UUID> {
    
    List<UserRoleAssignment> findByUserIdAndRevokedAtIsNull(UUID userId);
    
    @Query("SELECT COUNT(DISTINCT ura.userId) FROM UserRoleAssignment ura WHERE ura.role IN ('ADMIN', 'FN') AND ura.revokedAt IS NULL")
    long countActiveAdminsAndFounders();
    
    @Query("SELECT COUNT(ura) FROM UserRoleAssignment ura WHERE ura.userId = :userId AND ura.role IN ('ADMIN', 'FN') AND ura.revokedAt IS NULL")
    long countActiveAdminRolesForUser(UUID userId);
    
    List<UserRoleAssignment> findAllByRevokedAtIsNull();
    
    boolean existsByUserIdAndRoleAndRevokedAtIsNull(UUID userId, String role);
}
