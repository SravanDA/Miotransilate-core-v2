package com.miotranslate.modules.migration.model;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.time.OffsetDateTime;
import java.util.UUID;

@Entity
@Table(name = "import_events", schema = "migration")
@Getter
@Setter
public class ImportEvent {

    @Id
    @Column(name = "import_event_id", nullable = false)
    private UUID importEventId = UUID.randomUUID();

    @Column(name = "status", nullable = false, length = 30)
    private String status = "PENDING"; // PENDING, PROCESSING, COMPLETED, FAILED

    @Column(name = "file_reference_url")
    private String fileReferenceUrl;

    @Column(name = "original_filename", nullable = false, length = 500)
    private String originalFilename;

    @Column(name = "file_size_bytes", nullable = false)
    private Long fileSizeBytes;

    @Column(name = "initiated_by", nullable = false)
    private UUID initiatedBy;

    @Column(name = "initiated_at", nullable = false)
    private OffsetDateTime initiatedAt = OffsetDateTime.now();

    @Column(name = "processing_started_at")
    private OffsetDateTime processingStartedAt;

    @Column(name = "completed_at")
    private OffsetDateTime completedAt;

    @Column(name = "pages_attempted", nullable = false)
    private Integer pagesAttempted = 0;

    @Column(name = "pages_succeeded", nullable = false)
    private Integer pagesSucceeded = 0;

    @Column(name = "pages_failed", nullable = false)
    private Integer pagesFailed = 0;

    @Column(name = "tags_imported", nullable = false)
    private Integer tagsImported = 0;

    @Column(name = "translations_imported", nullable = false)
    private Integer translationsImported = 0;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "validation_report")
    private String validationReport; // JSON representation for now

    @Column(name = "error_summary")
    private String errorSummary;

    @Version
    @Column(name = "etag_version", nullable = false)
    private Integer etagVersion = 1;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private OffsetDateTime createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at", nullable = false)
    private OffsetDateTime updatedAt;
    
    // Additional fields from schema
    @Column(name = "executed_by")
    private UUID executedBy;
    
    @Column(name = "file_format", nullable = false, length = 10)
    private String fileFormat = "CSV";
}
