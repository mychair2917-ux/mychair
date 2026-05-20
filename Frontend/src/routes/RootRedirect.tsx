import { Navigate } from 'react-router-dom';

import { ROUTE_PATHS } from '../constants';
import { useAppSelector } from '../redux/hooks';

const RootRedirect = () => {
  const token = useAppSelector((state) => state.auth.token);
  const orgId = useAppSelector((state) => state.auth.orgId);

  if (!token) {
    return <Navigate to={`/${ROUTE_PATHS.LOGIN}`} replace />;
  }

  if (orgId) {
    return <Navigate to={`/orgs/${orgId}/${ROUTE_PATHS.DASHBOARD}`} replace />;
  }

  return <Navigate to={`/${ROUTE_PATHS.LOGIN}`} replace />;
};

export default RootRedirect;
