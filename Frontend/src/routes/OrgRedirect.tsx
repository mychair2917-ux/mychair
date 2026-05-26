import { Navigate, useParams } from 'react-router';

import { canAccessTenant } from '../config/rbac';
import { ROUTE_PATHS } from '../constants';
import { useAppSelector } from '../redux/hooks';

const OrgRedirect = ({ children }: { children: React.ReactElement }) => {
  const { orgId } = useParams<{ orgId: string }>();
  const token = useAppSelector((state) => state.auth.token);
  const user = useAppSelector((state) => state.auth.user);
  const storedOrgId = useAppSelector((state) => state.auth.orgId);

  if (!token) {
    return <Navigate to={`/${ROUTE_PATHS.LOGIN}`} replace />;
  }

  if (!orgId) {
    return <Navigate to={`/${ROUTE_PATHS.LOGIN}`} replace />;
  }

  if (!canAccessTenant(user?.role, storedOrgId, orgId)) {
    if (storedOrgId) {
      return <Navigate to={`/orgs/${storedOrgId}/${ROUTE_PATHS.DASHBOARD}`} replace />;
    }
    return <Navigate to={`/${ROUTE_PATHS.NOT_FOUND}`} replace />;
  }

  return children;
};

export default OrgRedirect;
