import React from 'react';
import { Navigate, useParams } from 'react-router';

import { MODULES, ModuleKey, canAccessModule, canAccessTenant, isSuperAdmin } from '../config/rbac';
import { ROUTE_PATHS } from '../constants';
import { useAppSelector } from '../redux/hooks';

interface ProtectedRouteProps {
  children: React.ReactElement;
  module?: ModuleKey;
  /** Restrict to super_admin only (platform admin routes). */
  superAdminOnly?: boolean;
  /** Legacy explicit role list; used when module is not set. */
  allowedRoles?: string[];
}

/**
 * Route guard: authentication, optional module permission, tenant isolation.
 */
const ProtectedRoute = ({
  children,
  module,
  superAdminOnly = false,
  allowedRoles,
}: ProtectedRouteProps) => {
  const token = useAppSelector((state) => state.auth.token);
  const user = useAppSelector((state) => state.auth.user);
  const orgId = useAppSelector((state) => state.auth.orgId);
  const { orgId: routeOrgId } = useParams<{ orgId: string }>();

  if (!token) {
    return <Navigate to={`/${ROUTE_PATHS.LOGIN}`} replace />;
  }

  const role = user?.role;

  if (superAdminOnly && !isSuperAdmin(role)) {
    return <Navigate to={`/${ROUTE_PATHS.NOT_FOUND}`} replace />;
  }

  if (module && !canAccessModule(role, module)) {
    const fallbackOrg = routeOrgId || orgId;
    if (fallbackOrg && canAccessModule(role, MODULES.DASHBOARD)) {
      return <Navigate to={`/orgs/${fallbackOrg}/${ROUTE_PATHS.DASHBOARD}`} replace />;
    }
    if (isSuperAdmin(role)) {
      return <Navigate to={`/${ROUTE_PATHS.ADMIN_DASHBOARD}`} replace />;
    }
    return <Navigate to={`/${ROUTE_PATHS.NOT_FOUND}`} replace />;
  }

  if (allowedRoles && user && !allowedRoles.includes(role ?? '')) {
    const normalizedAllowed = allowedRoles;
    const normalizedRole = role ?? '';
    if (!normalizedAllowed.includes(normalizedRole)) {
      const fallbackOrg = routeOrgId || orgId;
      return fallbackOrg ? (
        <Navigate to={`/orgs/${fallbackOrg}/${ROUTE_PATHS.NOT_FOUND}`} replace />
      ) : (
        <Navigate to={`/${ROUTE_PATHS.NOT_FOUND}`} replace />
      );
    }
  }

  const tenantOrgId = routeOrgId;
  if (tenantOrgId && !canAccessTenant(role, orgId, tenantOrgId)) {
    if (orgId && canAccessModule(role, MODULES.DASHBOARD)) {
      return <Navigate to={`/orgs/${orgId}/${ROUTE_PATHS.DASHBOARD}`} replace />;
    }
    return <Navigate to={`/${ROUTE_PATHS.NOT_FOUND}`} replace />;
  }

  return children;
};

export default ProtectedRoute;
