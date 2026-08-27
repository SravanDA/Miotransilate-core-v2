package com.miotranslate.modules.publishing.repository;

import com.miotranslate.modules.publishing.model.PublishingApprovalRequest;
import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.Optional;
import java.util.UUID;

@Repository
public interface PublishingApprovalRequestRepository extends JpaRepository<PublishingApprovalRequest, UUID> {

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("SELECT par FROM PublishingApprovalRequest par WHERE par.approvalRequestId = :id")
    Optional<PublishingApprovalRequest> findByIdForUpdate(@Param("id") UUID id);
    
    // Check if there is an active PAR to enforce the partial unique index from application side as well
    boolean existsByPageIdAndLanguageCodeAndEnvironmentAndStatus(String pageId, String languageCode, String environment, String status);
}
