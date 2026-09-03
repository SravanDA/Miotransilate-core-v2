import React, { createContext, useContext, useState, useEffect } from 'react';
import type { ReactNode } from 'react';
import { apiClient } from '../api/client';

interface User {
  userId: string;
  displayName: string;
  email: string;
  roles: string[];
  permissions: string[];
}

interface AuthState {
  user: User | null;
  mustChangePassword: boolean;
  isLoading: boolean;
}

interface AuthContextType extends AuthState {
  login: (token: string, user: User, mustChangePassword: boolean) => void;
  logout: () => void;
  can: (permission: string) => boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [state, setState] = useState<AuthState>({
    user: null,
    mustChangePassword: false,
    isLoading: true,
  });

  useEffect(() => {
    const initAuth = async () => {
      const token = localStorage.getItem('miotranslate_token');
      if (token) {
        try {
          const response = await apiClient.get('/v1/auth/me');
          const userData: User = response.data.user || {
            userId: response.data.userId,
            displayName: response.data.displayName || response.data.email,
            email: response.data.email,
            roles: response.data.roles || [],
            permissions: response.data.permissions || [],
          };
          setState({
            user: userData,
            mustChangePassword: response.data.mustChangePassword || false,
            isLoading: false,
          });
        } catch (err) {
          console.error('Failed to fetch auth state', err);
          localStorage.removeItem('miotranslate_token');
          setState({ user: null, mustChangePassword: false, isLoading: false });
        }
      } else {
        setState({ user: null, mustChangePassword: false, isLoading: false });
      }
    };
    initAuth();
  }, []);

  const login = (token: string, user: User, mustChangePassword: boolean) => {
    localStorage.setItem('miotranslate_token', token);
    setState({ user, mustChangePassword, isLoading: false });
  };

  const logout = () => {
    localStorage.removeItem('miotranslate_token');
    setState({ user: null, mustChangePassword: false, isLoading: false });
    window.location.href = '/login';
  };

  const can = (permission: string) => {
    if (!state.user) return true;
    if (state.user.roles?.includes('FN') || state.user.roles?.includes('FOUNDER') || state.user.roles?.includes('LEAD')) return true;
    if (!state.user.permissions || state.user.permissions.length === 0) return true;
    return state.user.permissions.includes(permission);
  };

  return (
    <AuthContext.Provider value={{ ...state, login, logout, can }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
