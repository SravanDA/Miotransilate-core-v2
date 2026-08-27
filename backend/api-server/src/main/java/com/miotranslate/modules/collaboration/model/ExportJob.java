package com.miotranslate.modules.collaboration.model;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.OffsetDateTime;
import java.util.UUID;

@Entity
@Table(name = "export_jobs", schema = "collaboration")
@Getter
@Setter
public class ExportJob {

    @Id
    @Column(name = "export_job_id", nullable = false)
    private UUID exportJobId = UUID.randomUUID();

    @Column(name = "page_id", nullable = false, length = 100)
    private String pageId;

    @Column(name = "language_code", nullable = false, length = 10)
    private String languageCode;

    @Column(name = "format", nullable = false, length = 10)
    private String format; // JSON or CSV

    @Column(name = "requested_by", nullable = false)
    private UUID requestedBy;

    @Column(name = "status", nullable = false, length = 15)
    private String status = "GENERATING";

    @Column(name = "dataset_capture_at")
    private OffsetDateTime datasetCaptureAt;

    @Column(name = "row_count")
    private Integer rowCount;

    @Column(name = "generated_at")
    private OffsetDateTime generatedAt;

    @Column(name = "file_reference_url")
    private String fileReferenceUrl;

    @Column(name = "expires_at")
    private OffsetDateTime expiresAt;

    @Column(name = "failure_reason")
    private String failureReason;

    @Column(name = "request_id")
    private UUID requestId; // Correlation ID from MDC

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private OffsetDateTime createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at", nullable = false)
    private OffsetDateTime updatedAt;
}
