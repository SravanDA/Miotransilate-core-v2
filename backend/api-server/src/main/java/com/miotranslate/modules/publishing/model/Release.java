package com.miotranslate.modules.publishing.model;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.OffsetDateTime;
import java.util.UUID;

@Entity
@Table(name = "releases", schema = "publishing")
@Getter
@Setter
public class Release {

    @Id
    @Column(name = "release_id", nullable = false)
    private UUID releaseId = UUID.randomUUID();

    @Column(name = "page_id", nullable = false, length = 100)
    private String pageId;

    @Column(name = "language_code", nullable = false, length = 10)
    private String languageCode;

    @Column(name = "environment", nullable = false, length = 20)
    private String environment;

    @Column(name = "deployment_version", nullable = false)
    private Integer deploymentVersion;

    @Column(name = "release_type", nullable = false, length = 20)
    private String releaseType = "PUBLISH";

    @Column(name = "trigger_source", nullable = false, length = 30)
    private String triggerSource = "USER_INITIATED";

    @Column(name = "rolled_back_from_deployment_version")
    private Integer rolledBackFromDeploymentVersion;

    @Column(name = "status", nullable = false, length = 20)
    private String status = "PENDING";

    @Column(name = "approval_request_id")
    private UUID approvalRequestId;

    @Column(name = "published_by")
    private UUID publishedBy;

    @Column(name = "published_by_source", nullable = false, length = 100)
    private String publishedBySource = "USER";

    @Column(name = "initiated_at", nullable = false)
    private OffsetDateTime initiatedAt = OffsetDateTime.now();

    @Column(name = "completed_at")
    private OffsetDateTime completedAt;

    @Column(name = "rolled_back_at")
    private OffsetDateTime rolledBackAt;

    @Column(name = "api_response_payload", columnDefinition = "jsonb")
    private String apiResponsePayload;

    @Column(name = "api_response_success")
    private Boolean apiResponseSuccess;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private OffsetDateTime createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at", nullable = false)
    private OffsetDateTime updatedAt;
}
