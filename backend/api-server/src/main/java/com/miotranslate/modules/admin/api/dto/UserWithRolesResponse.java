package com.miotranslate.modules.admin.api.dto;

import com.miotranslate.modules.admin.model.User;
import com.miotranslate.modules.admin.model.UserRoleAssignment;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class UserWithRolesResponse {
    private User user;
    private List<UserRoleAssignment> roles;
}
