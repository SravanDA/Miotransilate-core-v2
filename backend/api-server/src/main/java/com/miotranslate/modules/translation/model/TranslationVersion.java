package com.miotranslate.modules.translation.model;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;
import org.hibernate.annotations.CreationTimestamp;

import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.UUID;

@Entity
@Table(name = "translation_versions", schema = "translation")
@IdClass(TranslationVersionId.class)
@Getter
@Setter
public class TranslationVersion {

    @Id
    @Column(name = "tag_id", nullable = false, length = 150)
    private String tagId;

    @Id
    @Column(name = "language_code", nullable = false, length = 10)
    private String languageCode;

    @Id
    @Column(name = "version_number", nullable = false)
    private Integer versionNumber;

    @Column(name = "text", nullable = false)
    private String text;

    @Column(name = "creation_method", nullable = false, length = 20)
    private String creationMethod; // 'HUMAN' or 'AI'

    @Column(name = "source_english_version", nullable = false)
    private Integer sourceEnglishVersion;

    @Column(name = "confidence_score")
    private BigDecimal confidenceScore;

    @Column(name = "back_translation")
    private String backTranslation;

    @Column(name = "variable_integrity_status", nullable = false, length = 20)
    private String variableIntegrityStatus = "NOT_CHECKED";

    @Column(name = "change_reason")
    private String changeReason;

    // P1-2 fix: AI engine signals — previously computed and discarded
    @Column(name = "sense")
    private String sense;

    @Column(name = "resolved_by", length = 30)
    private String resolvedBy;

    @Column(name = "risk", length = 10)
    private String risk;

    @Column(name = "model_used", length = 100)
    private String modelUsed;

    @Column(name = "authored_by")
    private UUID authoredBy;

    @Column(name = "authored_by_source", nullable = false, length = 100)
    private String authoredBySource = "USER";

    @Column(name = "authored_at", nullable = false)
    private OffsetDateTime authoredAt = OffsetDateTime.now();

    @Column(name = "status", nullable = false, length = 30)
    private String status = "DRAFT";

    @Column(name = "submitted_for_review_at")
    private OffsetDateTime submittedForReviewAt;

    @Column(name = "submitted_for_review_by")
    private UUID submittedForReviewBy;

    @Column(name = "reviewed_by")
    private UUID reviewedBy;

    @Column(name = "reviewed_at")
    private OffsetDateTime reviewedAt;

    @Column(name = "approved_by")
    private UUID approvedBy;

    @Column(name = "approved_at")
    private OffsetDateTime approvedAt;

    @Column(name = "rejection_reason")
    private String rejectionReason;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private OffsetDateTime createdAt;
}
