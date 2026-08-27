package com.miotranslate.modules.registry.model;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.OffsetDateTime;
import java.util.UUID;

@Entity
@Table(name = "tags", schema = "registry")
@Getter
@Setter
public class Tag {

    @Id
    @Column(name = "tag_id", nullable = false, length = 150)
    private String tagId;

    @Column(name = "page_id", nullable = false, length = 100)
    private String pageId;

    @Column(name = "copy_type", length = 100)
    private String copyType;

    @Column(name = "status", nullable = false, length = 20)
    private String status = "ACTIVE";

    @Column(name = "created_by", nullable = false)
    private UUID createdBy;

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
