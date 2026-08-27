package com.miotranslate.modules.content.model;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;
import org.hibernate.annotations.CreationTimestamp;

import java.time.OffsetDateTime;
import java.util.UUID;

@Entity
@Table(name = "english_copy_versions", schema = "content")
@IdClass(EnglishCopyVersionId.class)
@Getter
@Setter
public class EnglishCopyVersion {

    @Id
    @Column(name = "tag_id", nullable = false, length = 150)
    private String tagId;

    @Id
    @Column(name = "version_number", nullable = false)
    private Integer versionNumber;

    @Column(name = "text", nullable = false)
    private String text;

    @Column(name = "authored_by", nullable = false)
    private UUID authoredBy;

    @Column(name = "authored_at", nullable = false)
    private OffsetDateTime authoredAt = OffsetDateTime.now();

    @Column(name = "change_reason")
    private String changeReason;

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

    @Column(name = "escalated_to_founder", nullable = false)
    private Boolean escalatedToFounder = false;

    @Column(name = "escalated_at")
    private OffsetDateTime escalatedAt;

    @Column(name = "escalated_by")
    private UUID escalatedBy;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private OffsetDateTime createdAt;
}
