import { useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router';

import { isSuperAdmin } from '../../config/rbac';
import { ROUTE_PATHS } from '../../constants';
import { useGetSubscriptionStatusQuery } from '../../redux/slices/subscriptions/subscriptionsApi';
import { setSubscriptionExpired } from '../../redux/slices/auth/authSlice';
import { useAppDispatch, useAppSelector } from '../../redux/hooks';

const SubscriptionGuard = () => {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const location = useLocation();
  const user = useAppSelector((state) => state.auth.user);
  const subscriptionExpired = useAppSelector((state) => state.auth.subscriptionExpired);
  const token = useAppSelector((state) => state.auth.token);

  const skip = !token || !user || isSuperAdmin(user.role);
  const { data: status } = useGetSubscriptionStatusQuery(undefined, {
    skip,
    pollingInterval: 300000,
  });

  const expiredPath = `/${ROUTE_PATHS.SUBSCRIPTION_EXPIRED}`;
  const isOnExpiredPage = location.pathname === expiredPath;

  useEffect(() => {
    if (skip) return;

    const expired = subscriptionExpired || (status && !status.is_valid);
    if (expired && !isOnExpiredPage) {
      dispatch(setSubscriptionExpired(true));
      navigate(expiredPath, { replace: true });
    }
  }, [dispatch, expiredPath, isOnExpiredPage, navigate, skip, status, subscriptionExpired]);

  return null;
};

export default SubscriptionGuard;
