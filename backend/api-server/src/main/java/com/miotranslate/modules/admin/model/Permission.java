package com.miotranslate.modules.admin.model;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

@Entity
@Table(name = "permissions", schema = "admin")
@Getter
@Setter
public class Permission {

    @Id
    @Column(name = "permission_code", nullable = false, length = 50)
    private String permissionCode;

    @Column(name = "description", nullable = false, length = 500)
    private String description;

    @Column(name = "category", nullable = false, length = 30)
    private String category;

    @Column(name = "is_protected", nullable = false)
    private Boolean isProtected = false;
}
