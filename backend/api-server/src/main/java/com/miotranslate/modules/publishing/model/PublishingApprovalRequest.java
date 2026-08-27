package com.miotranslate.modules.publishing.model;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.OffsetDateTime;
import java.util.UUID;

@Entity
@Table(name = "publishing_approval_requests", schema = "publishing")
@Getter
@Setter
public class PublishingApprovalRequest {

    @Id
    @Column(name = "approval_request_id", nullable = false)
    private UUID approvalRequestId = UUID.randomUUID();

    @Column(name = "page_id", nullable = false, length = 100)
    private String pageId;

    @Column(name = "language_code", nullable = false, length = 10)
    private String languageCode;

    @Column(name = "environment", nullable = false, length = 20)
    private String environment;

    @Column(name = "bundle_snapshot_hash", nullable = false, length = 64)
    private String bundleSnapshotHash;

    @Column(name = "required_approver_role", nullable = false, length = 10)
    private String requiredApproverRole;

    @Column(name = "requested_by", nullable = false)
    private UUID requestedBy;

    @Column(name = "status", nullable = false, length = 20)
    private String status = "PENDING";

    @Column(name = "expires_at", nullable = false)
    private OffsetDateTime expiresAt;

    @Column(name = "decided_by")
    private UUID decidedBy;

    @Column(name = "decided_at")
    private OffsetDateTime decidedAt;

    @Column(name = "rejection_reason")
    private String rejectionReason;

    @Version
    @Column(name = "etag_version", nullable = false)
    private Integer etagVersion = 1;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private OffsetDateTime createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at", nullable = false)
    private OffsetDateTime updatedAt;
}
