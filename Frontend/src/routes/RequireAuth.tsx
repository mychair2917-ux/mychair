import React from 'react';
import { Navigate, useParams } from 'react-router';

import { ROUTE_PATHS } from '../constants';
import { useAppSelector } from '../redux/hooks';

interface RequireAuthProps {
  children: React.ReactElement;
  allowedRoles?: string[];
}

const RequireAuth = ({ children, allowedRoles }: RequireAuthProps) => {
  const token = useAppSelector((state) => state.auth.token);
  const user = useAppSelector((state) => state.auth.user);
  
  const { orgId } = useParams<{ orgId: string }>();

  if (!token) {
    return <Navigate to={`/${ROUTE_PATHS.LOGIN}`} replace />;
  }

  // Check role-based access if needed
  if (allowedRoles && user && !allowedRoles.includes(user.role)) {
    return orgId ? (
      <Navigate to={`/orgs/${orgId}/${ROUTE_PATHS.NOT_FOUND}`} replace />
    ) : (
      <Navigate to={`/${ROUTE_PATHS.NOT_FOUND}`} replace />
    );
  }

  return children;
};

export default RequireAuth;
