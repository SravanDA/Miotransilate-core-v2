package com.miotranslate.modules.admin.model;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.OffsetDateTime;
import java.util.UUID;

@Entity
@Table(name = "languages", schema = "admin")
@Getter
@Setter
public class Language {

    @Id
    @Column(name = "language_code", nullable = false, length = 10)
    private String languageCode;

    @Column(name = "language_name", nullable = false, length = 100)
    private String languageName;

    @Column(name = "direction", nullable = false, length = 3)
    private String direction = "LTR"; // LTR or RTL

    @Column(name = "status", nullable = false, length = 20)
    private String status = "ACTIVE"; // ACTIVE or INACTIVE

    @Column(name = "added_by", nullable = false)
    private UUID addedBy;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private OffsetDateTime createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at", nullable = false)
    private OffsetDateTime updatedAt;
}
