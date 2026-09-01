import { apiClient } from '../client';

export interface User {
  userId: string;
  displayName: string;
  email: string;
  isActive: boolean;
  mustChangePassword: boolean;
  createdAt: string;
}

export interface UserRoleAssignment {
  assignmentId: string;
  userId: string;
  role: string;
  assignedBy: string;
  assignedAt: string;
}

export interface UserWithRoles {
  user: User;
  roles: UserRoleAssignment[];
}

export interface Role {
  roleCode: string;
  roleName: string;
  description: string;
  isActive: boolean;
  isSystem: boolean;
}

export class UserService {
  static async getUsers(): Promise<UserWithRoles[]> {
    const res = await apiClient.get('/v1/admin/users');
    return res.data;
  }

  static async getRoles(): Promise<Role[]> {
    const res = await apiClient.get('/v1/admin/roles');
    return res.data;
  }

  static async inviteUser(payload: { email: string; displayName: string; initialPassword?: string }): Promise<User> {
    const res = await apiClient.post('/v1/users', payload);
    return res.data;
  }

  static async assignRole(userId: string, roleCode: string): Promise<UserRoleAssignment> {
    const res = await apiClient.post(`/v1/admin/users/${userId}/roles`, { role: roleCode });
    return res.data;
  }

  static async revokeRole(assignmentId: string): Promise<void> {
    await apiClient.delete(`/v1/admin/roles/${assignmentId}`);
  }

  static async updateUserStatus(userId: string, isActive: boolean): Promise<User> {
    const res = await apiClient.patch(`/v1/users/${userId}/status`, { isActive });
    return res.data;
  }
}
