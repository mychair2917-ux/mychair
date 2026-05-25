import { Navigate } from 'react-router-dom';

import { ROLES, ROUTE_PATHS } from '../constants';
import { useAppSelector } from '../redux/hooks';

const RootRedirect = () => {
  const token = useAppSelector((state) => state.auth.token);
  const orgId = useAppSelector((state) => state.auth.orgId);
  const user = useAppSelector((state) => state.auth.user);

  if (!token) {
    return <Navigate to={`/${ROUTE_PATHS.LOGIN}`} replace />;
  }

  if (user?.role === ROLES.SALON_OWNER) {
    return <Navigate to={`/${ROUTE_PATHS.SALON_OWNER_DASHBOARD}`} replace />;
  }

  if (user?.role === ROLES.SUPER_ADMIN) {
    return <Navigate to={`/${ROUTE_PATHS.ADMIN_DASHBOARD}`} replace />;
  }

  if (orgId) {
    return <Navigate to={`/orgs/${orgId}/${ROUTE_PATHS.DASHBOARD}`} replace />;
  }

  return <Navigate to={`/${ROUTE_PATHS.LOGIN}`} replace />;
};

export default RootRedirect;
