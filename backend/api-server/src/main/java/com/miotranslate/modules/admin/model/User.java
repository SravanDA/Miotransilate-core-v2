package com.miotranslate.modules.admin.model;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.OffsetDateTime;
import java.util.UUID;

@Entity
@Table(name = "users", schema = "admin")
@Getter
@Setter
public class User {

    @Id
    @Column(name = "user_id", nullable = false)
    private UUID userId = UUID.randomUUID();

    @Column(name = "display_name", nullable = false, length = 255)
    private String displayName;

    @Column(name = "email", nullable = false, length = 320, unique = true)
    private String email;

    @Column(name = "external_auth_id", length = 512)
    private String externalAuthId;

    @Column(name = "is_active", nullable = false)
    private Boolean isActive = true;

    @Column(name = "password_hash", length = 255)
    private String passwordHash;

    @Column(name = "must_change_password", nullable = false)
    private Boolean mustChangePassword = false;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private OffsetDateTime createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at", nullable = false)
    private OffsetDateTime updatedAt;
}
