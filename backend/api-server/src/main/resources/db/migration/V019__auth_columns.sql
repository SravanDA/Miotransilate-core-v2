-- V019__auth_columns.sql

ALTER TABLE admin.users ADD COLUMN password_hash VARCHAR(255) NULL;
ALTER TABLE admin.users ADD COLUMN must_change_password BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE admin.user_role_assignments
    ADD CONSTRAINT user_role_assignments_role_fk
    FOREIGN KEY (role) REFERENCES admin.roles(role_code);
