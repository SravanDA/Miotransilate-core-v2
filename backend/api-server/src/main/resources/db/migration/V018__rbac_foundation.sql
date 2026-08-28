-- V018__rbac_foundation.sql

CREATE TABLE admin.roles (
    role_code       VARCHAR(30)     NOT NULL,
    role_name       VARCHAR(100)    NOT NULL,
    description     VARCHAR(500)    NULL,
    is_system       BOOLEAN         NOT NULL DEFAULT FALSE,
    is_active       BOOLEAN         NOT NULL DEFAULT TRUE,
    created_by      UUID            NULL REFERENCES admin.users(user_id),
    created_at      TIMESTAMPTZ     NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ     NOT NULL DEFAULT now(),
    CONSTRAINT roles_pkey PRIMARY KEY (role_code),
    CONSTRAINT roles_name_unique UNIQUE (role_name)
);

CREATE TABLE admin.permissions (
    permission_code VARCHAR(50)     NOT NULL,
    description     VARCHAR(500)    NOT NULL,
    category        VARCHAR(30)     NOT NULL,
    is_protected    BOOLEAN         NOT NULL DEFAULT FALSE,
    CONSTRAINT permissions_pkey PRIMARY KEY (permission_code)
);

CREATE TABLE admin.role_permissions (
    role_code       VARCHAR(30)     NOT NULL REFERENCES admin.roles(role_code),
    permission_code VARCHAR(50)     NOT NULL REFERENCES admin.permissions(permission_code),
    created_at      TIMESTAMPTZ     NOT NULL DEFAULT now(),
    CONSTRAINT role_permissions_pkey PRIMARY KEY (role_code, permission_code)
);
