import React, { useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';

import { isSuperAdmin } from '../../config/rbac';
import { ROUTE_PATHS } from '../../constants';
import { showToast } from '../../components/common/Toast/toastService';
import { getUserDisplayName } from '../../redux/slices/auth/authSlice';
import { useAppSelector } from '../../redux/hooks';
import { useGetDashboardQuery } from '../../redux/slices/dashboard/dashboardApi';
import { getApiErrorMessage } from '../../utils/apiErrors';
import { useDashboardActions } from './dashboardActions';
import {
  AlertsPanel,
  DashboardSkeleton,
  KpiGrid,
  OperationsPanel,
  PerformanceList,
  QuickActionsBar,
  StaffPerformancePanel,
  TrendCharts,
  UpcomingAppointments,
} from './DashboardWidgets';

const Dashboard: React.FC = () => {
  const navigate = useNavigate();
  const user = useAppSelector((state) => state.auth.user);
  const orgId = useAppSelector((state) => state.auth.orgId);
  const selectedSalonId = useAppSelector((state) => state.auth.selectedSalonId);
  const { handleAction, navigateToLeave } = useDashboardActions();
  const displayName = getUserDisplayName(user) || 'there';

  const salonId = isSuperAdmin(user?.role)
    ? selectedSalonId ?? undefined
    : orgId ?? undefined;

  const { data, isLoading, isError, error, refetch } = useGetDashboardQuery(
    salonId ? { salonId } : undefined,
    { skip: !user || (!isSuperAdmin(user?.role) && !orgId) }
  );

  const dashboard = data?.data;

  const greeting = useMemo(() => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good Morning';
    if (hour < 17) return 'Good Afternoon';
    return 'Good Evening';
  }, []);

  const handleViewAppointments = useCallback(() => {
    if (isSuperAdmin(user?.role)) {
      if (!selectedSalonId) {
        showToast('warning', 'Select a salon from the header to view appointments.');
        return;
      }
      navigate(`/${ROUTE_PATHS.ADMIN_APPOINTMENTS}`);
      return;
    }
    if (!orgId || orgId === 'system') {
      showToast('warning', 'Salon context is missing. Please sign in again.');
      return;
    }
    navigate(`/orgs/${orgId}/${ROUTE_PATHS.APPOINTMENTS}`);
  }, [navigate, orgId, selectedSalonId, user?.role]);

  const sidePanels = useMemo(() => {
    if (!dashboard) return [];

    const panels: React.ReactNode[] = [];

    if (dashboard.alerts.length) {
      panels.push(<AlertsPanel key="alerts" alerts={dashboard.alerts} />);
    }
    if (dashboard.operations.length) {
      panels.push(
        <OperationsPanel
          key="operations"
          operations={dashboard.operations}
          onOperationClick={(key) => {
            if (key === 'pending_leave_requests') {
              navigateToLeave();
            }
          }}
        />
      );
    }
    if (dashboard.top_staff.length) {
      panels.push(
        <PerformanceList key="top-staff" title="Top Staff Today" items={dashboard.top_staff} />
      );
    }
    if (dashboard.top_services.length) {
      panels.push(
        <PerformanceList
          key="top-services"
          title="Top Revenue Services"
          items={dashboard.top_services}
        />
      );
    }
    if (dashboard.top_salons.length) {
      panels.push(
        <PerformanceList
          key="top-salons"
          title="Top Performing Salons"
          items={dashboard.top_salons}
        />
      );
    }
    if (dashboard.performance) {
      panels.push(
        <StaffPerformancePanel
          key="performance"
          monthlyServices={dashboard.performance.monthly_services}
          targetProgress={dashboard.performance.target_progress_percent}
        />
      );
    }

    return panels;
  }, [dashboard, navigateToLeave]);

  const mainPanels = useMemo(() => {
    if (!dashboard) return [];

    const panels: React.ReactNode[] = [];

    if (dashboard.upcoming_appointments.length) {
      panels.push(
        <UpcomingAppointments
          key="appointments"
          items={dashboard.upcoming_appointments}
          title={
            dashboard.role_view === 'staff'
              ? "Today's Timeline"
              : 'Upcoming Appointments'
          }
          onViewAll={handleViewAppointments}
        />
      );
    }

    return panels;
  }, [dashboard, handleViewAppointments]);

  const hasTrendCharts =
    (dashboard?.revenue_trend?.length ?? 0) > 0 ||
    (dashboard?.appointment_trend?.length ?? 0) > 0;

  const hasMainColumn = mainPanels.length > 0 || hasTrendCharts;
  const hasSideColumn = sidePanels.length > 0;

  return (
    <div className="mx-auto max-w-[1600px] animate-in space-y-6 p-4 duration-500 fade-in md:space-y-8 md:p-6 lg:p-8">
      <header className="flex flex-col justify-between gap-3 border-b border-[var(--color-border-soft)] pb-6 md:flex-row md:items-end">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.12em] text-[var(--color-brand-gold-dark)]">
            Dashboard
          </p>
          <h1 className="mt-1 text-3xl font-bold text-[var(--color-text-primary)]">
            {greeting}, {displayName}
          </h1>
          <p className="mt-1.5 max-w-2xl text-[var(--color-text-secondary)]">
            {dashboard?.subtitle ?? 'Loading your dashboard...'}
          </p>
        </div>
      </header>

      {isLoading && <DashboardSkeleton />}

      {isError && (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-center">
          <p className="text-sm font-medium text-red-700">
            {getApiErrorMessage(error, 'Unable to load dashboard data.')}
          </p>
          <button
            type="button"
            onClick={() => refetch()}
            className="mt-4 rounded-xl bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700"
          >
            Retry
          </button>
        </div>
      )}

      {dashboard && (
        <div className="space-y-6 md:space-y-8">
          {dashboard.kpis.length > 0 && (
            <section aria-label="Key metrics">
              <KpiGrid
                kpis={dashboard.kpis}
                onKpiClick={(key) => {
                  if (key === 'pending_leave_requests') {
                    navigateToLeave();
                  }
                }}
              />
            </section>
          )}

          {dashboard.quick_actions.length > 0 && (
            <section aria-label="Quick actions">
              <QuickActionsBar actions={dashboard.quick_actions} onAction={handleAction} />
            </section>
          )}

          {(hasMainColumn || hasSideColumn) && (
            <section
              aria-label="Dashboard insights"
              className={
                hasMainColumn && hasSideColumn
                  ? 'grid grid-cols-1 items-start gap-6 xl:grid-cols-12 xl:gap-8'
                  : 'grid grid-cols-1 gap-6 md:gap-8'
              }
            >
              {hasMainColumn && (
                <div className={cnMainColumn(hasMainColumn, hasSideColumn)}>
                  {hasTrendCharts && (
                    <TrendCharts
                      revenueTrend={dashboard.revenue_trend}
                      appointmentTrend={dashboard.appointment_trend}
                    />
                  )}
                  {mainPanels}
                </div>
              )}
              {hasSideColumn && (
                <div className={cnSideColumn(hasMainColumn, hasSideColumn)}>{sidePanels}</div>
              )}
            </section>
          )}
        </div>
      )}
    </div>
  );
};

function cnMainColumn(hasMain: boolean, hasSide: boolean): string {
  if (hasMain && hasSide) return 'space-y-6 xl:col-span-8';
  return 'space-y-6';
}

function cnSideColumn(hasMain: boolean, hasSide: boolean): string {
  if (hasMain && hasSide) return 'space-y-6 xl:col-span-4';
  return 'grid grid-cols-1 gap-6 sm:grid-cols-2 xl:grid-cols-3';
}

export default Dashboard;
