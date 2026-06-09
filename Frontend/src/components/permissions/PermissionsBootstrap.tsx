import { useEffect } from 'react';

import { useAppDispatch, useAppSelector } from '../../redux/hooks';
import { setPermissions } from '../../redux/slices/auth/authSlice';
import { useGetMyPermissionsQuery } from '../../redux/slices/permissions/permissionsApi';

/**
 * Fetches merged permissions when authenticated but permissions are missing from storage.
 */
const PermissionsBootstrap: React.FC = () => {
  const dispatch = useAppDispatch();
  const token = useAppSelector((state) => state.auth.token);
  const permissions = useAppSelector((state) => state.auth.permissions);
  const { data } = useGetMyPermissionsQuery(undefined, {
    skip: !token || Boolean(permissions),
  });

  useEffect(() => {
    if (data?.data?.permissions) {
      dispatch(setPermissions(data.data.permissions));
    }
  }, [data, dispatch]);

  return null;
};

export default PermissionsBootstrap;
