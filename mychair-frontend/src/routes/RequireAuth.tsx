import React from 'react';

import { ModuleKey } from '../config/rbac';
import ProtectedRoute from './ProtectedRoute';

interface RequireAuthProps {
  children: React.ReactElement;
  allowedRoles?: string[];
  module?: ModuleKey;
  superAdminOnly?: boolean;
}

/** @deprecated Prefer ProtectedRoute with module prop; kept for compatibility. */
const RequireAuth = ({ children, allowedRoles, module, superAdminOnly }: RequireAuthProps) => (
  <ProtectedRoute
    module={module}
    allowedRoles={allowedRoles}
    superAdminOnly={superAdminOnly}
  >
    {children}
  </ProtectedRoute>
);

export default RequireAuth;
