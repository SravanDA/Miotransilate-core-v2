package com.miotranslate.modules.admin.model;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;
import org.hibernate.annotations.CreationTimestamp;

import java.time.OffsetDateTime;

@Entity
@Table(name = "role_permissions", schema = "admin")
@IdClass(RolePermissionId.class)
@Getter
@Setter
public class RolePermission {

    @Id
    @Column(name = "role_code", nullable = false, length = 30)
    private String roleCode;

    @Id
    @Column(name = "permission_code", nullable = false, length = 50)
    private String permissionCode;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private OffsetDateTime createdAt;
}
