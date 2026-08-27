package com.miotranslate.modules.reporting.model;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.UUID;

@Entity
@Table(name = "coverage_metrics", schema = "reporting")
@IdClass(CoverageMetricId.class)
@Getter
@Setter
public class CoverageMetric {

    @Id
    @Column(name = "page_id", nullable = false, length = 100)
    private String pageId;

    @Id
    @Column(name = "language_code", nullable = false, length = 10)
    private String languageCode;

    @Column(name = "active_tag_count", nullable = false)
    private Integer activeTagCount = 0;

    @Column(name = "deployed_tag_count", nullable = false)
    private Integer deployedTagCount = 0;

    @Column(name = "stale_deployed_count", nullable = false)
    private Integer staleDeployedCount = 0;

    @Column(name = "approved_not_deployed_count", nullable = false)
    private Integer approvedNotDeployedCount = 0;

    @Column(name = "coverage_percentage", nullable = false, precision = 5, scale = 2)
    private BigDecimal coveragePercentage = BigDecimal.ZERO;

    @Column(name = "current_live_release_id")
    private UUID currentLiveReleaseId;

    @Column(name = "current_live_deployment_version")
    private Integer currentLiveDeploymentVersion;

    @Column(name = "last_computed_at", nullable = false)
    private OffsetDateTime lastComputedAt = OffsetDateTime.now();

    @Column(name = "computation_status", nullable = false, length = 20)
    private String computationStatus = "PENDING"; // PENDING, SUCCESS, FAILED

    @Column(name = "computation_error")
    private String computationError;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private OffsetDateTime createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at", nullable = false)
    private OffsetDateTime updatedAt;
}
