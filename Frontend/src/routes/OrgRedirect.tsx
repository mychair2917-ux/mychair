import { Navigate, useParams } from 'react-router';

import { ROUTE_PATHS } from '../constants';
import { useAppSelector } from '../redux/hooks';

const OrgRedirect = ({ children }: { children: React.ReactElement }) => {
  const { orgId } = useParams<{ orgId: string }>();
  const token = useAppSelector((state) => state.auth.token);

  if (!token) {
    return <Navigate to={`/${ROUTE_PATHS.LOGIN}`} replace />;
  }

  if (!orgId) {
    return <Navigate to={`/${ROUTE_PATHS.LOGIN}`} replace />;
  }

  return children;
};

export default OrgRedirect;
