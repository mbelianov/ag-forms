import { Navigate } from 'react-router-dom';
import type { ReactNode } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Loading } from '@carbon/react';

type Role = 'admin' | 'doctor' | 'viewer';

interface ProtectedRouteProps {
  children: ReactNode;
  requiredRole?: Role;
  /** Any one of these roles may enter (e.g. ['doctor', 'admin']). */
  allowedRoles?: Role[];
}

/**
 * Protected Route component that checks authentication status and optional role.
 * Redirects to login if not authenticated.
 * Redirects to dashboard if authenticated but role doesn't match
 * `requiredRole` (single role) or `allowedRoles` (any of a list).
 * Shows loading state while checking authentication.
 */
export default function ProtectedRoute({ children, requiredRole, allowedRoles }: ProtectedRouteProps) {
  const { isAuthenticated, isLoading, user } = useAuth();

  // Show loading state while checking authentication
  if (isLoading) {
    return (
      <div
        style={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          height: '100vh',
        }}
      >
        <Loading description="Loading..." withOverlay={false} />
      </div>
    );
  }

  // Redirect to login if not authenticated
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  // Redirect to dashboard if role requirement not met
  if (requiredRole && user?.role !== requiredRole) {
    return <Navigate to="/dashboard" replace />;
  }
  if (allowedRoles && (!user || !allowedRoles.includes(user.role))) {
    return <Navigate to="/dashboard" replace />;
  }

  // Render protected content if authenticated
  return <>{children}</>;
}

// Made with Bob
