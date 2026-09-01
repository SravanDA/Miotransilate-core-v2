import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { AccessControlState } from './AccessControlState';

interface ProtectedRouteProps {
  children: React.ReactNode;
  permission?: string;
  allowPasswordChange?: boolean;
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ 
  children, 
  permission,
  allowPasswordChange = false
}) => {
  const { user, mustChangePassword, isLoading, can } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return <div className="flex h-screen items-center justify-center text-text-tertiary text-[13px]">Loading...</div>;
  }

  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (mustChangePassword && !allowPasswordChange) {
    return <Navigate to="/change-password" replace />;
  }

  if (permission && !can(permission)) {
    return (
      <AccessControlState 
        title="Access control"
        description="You don't have permission to view this page. Contact your workspace administrator to request access."
        requiredPermission={permission}
      />
    );
  }

  return <>{children}</>;
};
