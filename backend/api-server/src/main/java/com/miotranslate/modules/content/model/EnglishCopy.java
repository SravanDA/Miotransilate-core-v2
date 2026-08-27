package com.miotranslate.modules.content.model;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.OffsetDateTime;

@Entity
@Table(name = "english_copies", schema = "content")
@Getter
@Setter
public class EnglishCopy {

    @Id
    @Column(name = "tag_id", nullable = false, length = 150)
    private String tagId;

    @Column(name = "status", nullable = false, length = 30)
    private String status = "NO_COPY";

    @Column(name = "current_version_number")
    private Integer currentVersionNumber;

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
