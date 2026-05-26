import { Navigate } from 'react-router-dom';

import { ROUTE_PATHS } from '../constants';
import { useAppSelector } from '../redux/hooks';

/** Redirect legacy salon-owner dashboard URL to unified org dashboard. */
const SalonOwnerRedirect = () => {
  const orgId = useAppSelector((state) => state.auth.orgId);

  if (orgId) {
    return <Navigate to={`/orgs/${orgId}/${ROUTE_PATHS.DASHBOARD}`} replace />;
  }

  return <Navigate to={`/${ROUTE_PATHS.SALON_OWNER_LOGIN}`} replace />;
};

export default SalonOwnerRedirect;
