import { Navigate } from 'react-router-dom';

import { isSuperAdmin } from '../config/rbac';
import { ROUTE_PATHS } from '../constants';
import { useAppSelector } from '../redux/hooks';

const RootRedirect = () => {
  const token = useAppSelector((state) => state.auth.token);
  const orgId = useAppSelector((state) => state.auth.orgId);
  const user = useAppSelector((state) => state.auth.user);

  if (!token) {
    return <Navigate to={`/${ROUTE_PATHS.LOGIN}`} replace />;
  }

  if (isSuperAdmin(user?.role)) {
    return <Navigate to={`/${ROUTE_PATHS.ADMIN_DASHBOARD}`} replace />;
  }

  if (orgId) {
    return <Navigate to={`/orgs/${orgId}/${ROUTE_PATHS.DASHBOARD}`} replace />;
  }

  return <Navigate to={`/${ROUTE_PATHS.LOGIN}`} replace />;
};

export default RootRedirect;
