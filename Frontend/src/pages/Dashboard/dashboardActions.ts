import { useCallback } from 'react';
import { useNavigate } from 'react-router-dom';

import { showToast } from '../../components/common/Toast/toastService';
import { isSuperAdmin } from '../../config/rbac';
import { ROUTE_PATHS } from '../../constants';
import { useAppSelector } from '../../redux/hooks';

const ACTION_SEGMENTS: Record<string, string> = {
  create_salon: ROUTE_PATHS.ADMIN_INVITE,
  create_admin: ROUTE_PATHS.ADMIN_INVITE,
  manage_subscription: ROUTE_PATHS.ADMIN_SUBSCRIPTION_MANAGEMENT,
  view_analytics: ROUTE_PATHS.ADMIN_CUSTOMER_ANALYTICS,
  manage_plans: ROUTE_PATHS.ADMIN_SUBSCRIPTION_MANAGEMENT,
  create_appointment: ROUTE_PATHS.ADMIN_APPOINTMENTS,
  create_bill: `${ROUTE_PATHS.ADMIN_BILLING_FINANCE}/bills`,
  add_customer: ROUTE_PATHS.ADMIN_CUSTOMER_ANALYTICS,
  add_product: ROUTE_PATHS.ADMIN_PRODUCTS_INVENTORY,
  add_staff: ROUTE_PATHS.ADMIN_SALON_EMPLOYEES,
  view_reports: ROUTE_PATHS.ADMIN_BILLING_FINANCE,
  check_in_customer: ROUTE_PATHS.ADMIN_APPOINTMENTS,
  attendance: ROUTE_PATHS.ADMIN_ATTENDANCE,
  inventory_request: ROUTE_PATHS.ADMIN_PRODUCTS_INVENTORY,
  check_in: ROUTE_PATHS.ADMIN_ATTENDANCE,
  check_out: ROUTE_PATHS.ADMIN_ATTENDANCE,
  view_schedule: ROUTE_PATHS.ADMIN_APPOINTMENTS,
  my_customers: ROUTE_PATHS.ADMIN_APPOINTMENTS,
  my_performance: ROUTE_PATHS.ADMIN_MY_EARNINGS,
};

const ORG_ACTION_SEGMENTS: Record<string, string> = {
  create_appointment: ROUTE_PATHS.APPOINTMENTS,
  create_bill: `${ROUTE_PATHS.BILLING_FINANCE}/bills`,
  add_customer: ROUTE_PATHS.CUSTOMER_ANALYTICS,
  add_product: ROUTE_PATHS.PRODUCTS_INVENTORY,
  add_staff: ROUTE_PATHS.SALON_EMPLOYEES,
  view_reports: ROUTE_PATHS.BILLING_FINANCE,
  check_in_customer: ROUTE_PATHS.APPOINTMENTS,
  attendance: ROUTE_PATHS.ATTENDANCE,
  inventory_request: ROUTE_PATHS.PRODUCTS_INVENTORY,
  check_in: ROUTE_PATHS.ATTENDANCE,
  check_out: ROUTE_PATHS.ATTENDANCE,
  view_schedule: ROUTE_PATHS.APPOINTMENTS,
  my_customers: ROUTE_PATHS.APPOINTMENTS,
  my_performance: ROUTE_PATHS.MY_EARNINGS,
};

export function useDashboardActions() {
  const navigate = useNavigate();
  const user = useAppSelector((state) => state.auth.user);
  const orgId = useAppSelector((state) => state.auth.orgId);
  const selectedSalonId = useAppSelector((state) => state.auth.selectedSalonId);

  const navigateToLeave = useCallback(() => {
    if (isSuperAdmin(user?.role)) {
      if (!selectedSalonId) {
        showToast('warning', 'Select a salon from the header to view leave requests.');
        return;
      }
      navigate(`/${ROUTE_PATHS.ADMIN_LEAVE}`);
      return;
    }
    if (!orgId || orgId === 'system') {
      showToast('warning', 'Salon context is missing. Please sign in again.');
      return;
    }
    navigate(`/orgs/${orgId}/${ROUTE_PATHS.LEAVE}`);
  }, [navigate, orgId, selectedSalonId, user?.role]);

  const handleAction = useCallback(
    (actionKey: string) => {
      const isAdminRoute = isSuperAdmin(user?.role);

      if (isAdminRoute) {
        if (
          actionKey !== 'create_salon' &&
          actionKey !== 'create_admin' &&
          actionKey !== 'manage_subscription' &&
          actionKey !== 'manage_plans' &&
          !selectedSalonId
        ) {
          showToast('warning', 'Select a salon from the header before opening this module.');
          return;
        }
        const segment = ACTION_SEGMENTS[actionKey];
        if (!segment) return;
        navigate(`/${segment}`);
        return;
      }

      if (!orgId || orgId === 'system') {
        showToast('warning', 'Salon context is missing. Please sign in again.');
        return;
      }
      const segment = ORG_ACTION_SEGMENTS[actionKey];
      if (!segment) return;
      navigate(`/orgs/${orgId}/${segment}`);
    },
    [navigate, orgId, selectedSalonId, user?.role]
  );

  return { handleAction, navigateToLeave };
}

export function formatKpiValue(key: string, value: string): string {
  if (key.includes('revenue') || key.includes('incentive')) {
    const numeric = Number(String(value).replace(/,/g, ''));
    if (Number.isFinite(numeric)) {
      return new Intl.NumberFormat('en-IN', {
        style: 'currency',
        currency: 'INR',
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }).format(numeric);
    }
  }
  return value;
}
