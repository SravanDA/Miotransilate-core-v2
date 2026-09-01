package com.miotranslate.modules.collaboration.model;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.OffsetDateTime;
import java.util.UUID;

@Entity
@Table(name = "comments", schema = "collaboration")
@Getter
@Setter
public class Comment {

    @Id
    @Column(name = "comment_id", nullable = false)
    private UUID commentId = UUID.randomUUID();

    @Column(name = "tag_id", nullable = false, length = 150)
    private String tagId;

    @Column(name = "parent_comment_id")
    private UUID parentCommentId;

    @Column(name = "comment_scope", nullable = false, length = 20)
    private String commentScope = "ENGLISH"; // ENGLISH or LANGUAGE

    @Column(name = "language_code", length = 10)
    private String languageCode;

    @Column(name = "comment_text", nullable = false)
    private String commentText;

    @Column(name = "author_id", nullable = false)
    private UUID authorId;

    @Column(name = "is_resolved", nullable = false)
    private Boolean isResolved = false;

    @Column(name = "resolved_at")
    private OffsetDateTime resolvedAt;

    @Column(name = "resolved_by")
    private UUID resolvedBy;

    @Column(name = "is_escalation", nullable = false)
    private Boolean isEscalation = false;

    @Column(name = "escalation_reason")
    private String escalationReason;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private OffsetDateTime createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at", nullable = false)
    private OffsetDateTime updatedAt;
}
