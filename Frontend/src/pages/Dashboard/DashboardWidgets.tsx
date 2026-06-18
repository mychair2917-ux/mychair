import React, { useMemo } from 'react';
import ReactECharts from 'echarts-for-react';
import {
  AlertCircle,
  Bell,
  Calendar as CalendarIcon,
  ChevronRight,
  Clock,
  Star,
  TrendingUp,
  Users,
} from 'lucide-react';

import '../../utils/echarts-init';
import { cn } from '../../utils/cn';
import type {
  DashboardAlert,
  DashboardAppointmentItem,
  DashboardKpi,
  DashboardOperation,
  DashboardQuickAction,
  PerformanceItem,
  TrendPoint,
} from '../../redux/slices/dashboard/Types';
import { formatKpiValue } from './dashboardActions';
import { formatCurrency } from '../../utils/currency';

const KPI_TONES: Record<string, string> = {
  blue: 'bg-blue-50 text-blue-600',
  emerald: 'bg-emerald-50 text-emerald-600',
  purple: 'bg-purple-50 text-purple-600',
  gold: 'bg-[var(--color-brand-gold-light)]/20 text-[var(--color-brand-gold)]',
  amber: 'bg-amber-50 text-amber-600',
};

const KPI_ICONS: Record<string, React.ElementType> = {
  appointments_today: CalendarIcon,
  active_appointments: CalendarIcon,
  today_revenue: TrendingUp,
  monthly_revenue: TrendingUp,
  walk_ins: Users,
  active_clients: Users,
  total_users: Users,
  total_staff: Users,
  total_salons: Users,
  active_salons: Users,
  inventory_alerts: AlertCircle,
  low_stock: AlertCircle,
  staff_present: Users,
  staff_attendance: Users,
  pending_services: Clock,
  pending_leave_requests: Clock,
  incentives_earned: TrendingUp,
  attendance_status: Clock,
  unread_notifications: Bell,
  business_alerts: AlertCircle,
  subscription_alerts: AlertCircle,
};

const SectionCard: React.FC<{ children: React.ReactNode; className?: string }> = ({
  children,
  className,
}) => (
  <div
    className={cn(
      'rounded-2xl border border-[var(--color-border-soft)] bg-white p-5 shadow-soft md:p-6',
      className
    )}
  >
    {children}
  </div>
);

const SectionHeading: React.FC<{ children: React.ReactNode; className?: string }> = ({
  children,
  className,
}) => (
  <h2
    className={cn(
      'text-base font-bold tracking-tight text-[var(--color-text-primary)] md:text-lg',
      className
    )}
  >
    {children}
  </h2>
);

export const KpiGrid: React.FC<{
  kpis: DashboardKpi[];
  onKpiClick?: (key: string) => void;
}> = ({ kpis, onKpiClick }) => {
  if (!kpis.length) return null;

  return (
    <div className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,220px),1fr))] gap-4 md:gap-5">
      {kpis.map((kpi) => {
        const Icon = KPI_ICONS[kpi.key] || TrendingUp;
        const tone = KPI_TONES[kpi.tone] || KPI_TONES.blue;
        const isClickable = Boolean(onKpiClick && kpi.key === 'pending_leave_requests');
        const Wrapper = isClickable ? 'button' : 'div';

        return (
          <SectionCard key={kpi.key} className="flex h-full min-h-[148px] flex-col">
            <Wrapper
              type={isClickable ? 'button' : undefined}
              onClick={isClickable ? () => onKpiClick?.(kpi.key) : undefined}
              className={cn(
                'flex h-full w-full flex-col text-left',
                isClickable &&
                  'cursor-pointer transition-shadow hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-brand-gold)]'
              )}
            >
              <div className="flex items-start justify-between gap-3">
                <div className={cn('flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl', tone)}>
                  <Icon className="h-5 w-5" />
                </div>
                {kpi.sub && (
                  <span className="shrink-0 rounded-full bg-[var(--color-surface-muted)] px-2.5 py-1 text-xs font-semibold text-[var(--color-text-secondary)]">
                    {kpi.sub}
                  </span>
                )}
              </div>
              <p className="mt-auto pt-4 text-sm font-medium text-[var(--color-text-secondary)]">
                {kpi.label}
              </p>
              <h3 className="mt-1 text-2xl font-bold leading-tight text-[var(--color-text-primary)]">
                {formatKpiValue(kpi.key, kpi.value)}
              </h3>
              {isClickable && (
                <p className="mt-2 text-xs font-semibold text-[var(--color-brand-gold-dark)]">
                  View leave requests
                </p>
              )}
            </Wrapper>
          </SectionCard>
        );
      })}
    </div>
  );
};

export const QuickActionsBar: React.FC<{
  actions: DashboardQuickAction[];
  onAction: (key: string) => void;
}> = ({ actions, onAction }) => {
  if (!actions.length) return null;

  return (
    <SectionCard>
      <SectionHeading className="mb-4">Quick Actions</SectionHeading>
      <div className="flex flex-wrap gap-2.5">
        {actions.map((action) => (
          <button
            key={action.key}
            type="button"
            onClick={() => onAction(action.key)}
            className="rounded-xl border border-[var(--color-border-soft)] bg-[var(--color-surface-muted)] px-4 py-2.5 text-sm font-semibold text-[var(--color-text-primary)] transition-all hover:border-[var(--color-brand-gold-light)] hover:bg-white hover:text-[var(--color-brand-gold-dark)] hover:shadow-sm"
          >
            {action.label}
          </button>
        ))}
      </div>
    </SectionCard>
  );
};

const useTrendChartOption = (title: string, points: TrendPoint[], color: string) =>
  useMemo(
    () => ({
      grid: { left: 40, right: 16, top: 32, bottom: 28 },
      tooltip: { trigger: 'axis' },
      xAxis: {
        type: 'category',
        data: points.map((point) => point.label),
        axisLine: { lineStyle: { color: '#e5e7eb' } },
        axisLabel: { color: '#6b7280' },
      },
      yAxis: {
        type: 'value',
        axisLine: { show: false },
        splitLine: { lineStyle: { color: '#f3f4f6' } },
        axisLabel: { color: '#6b7280' },
      },
      series: [
        {
          name: title,
          type: 'line',
          smooth: true,
          data: points.map((point) => point.value),
          lineStyle: { color, width: 3 },
          itemStyle: { color },
          areaStyle: { color: `${color}22` },
        },
      ],
    }),
    [color, points, title]
  );

export const TrendCharts: React.FC<{
  revenueTrend: TrendPoint[];
  appointmentTrend: TrendPoint[];
}> = ({ revenueTrend, appointmentTrend }) => {
  const hasRevenue = revenueTrend.length > 0;
  const hasAppointments = appointmentTrend.length > 0;
  if (!hasRevenue && !hasAppointments) return null;

  const revenueOption = useTrendChartOption('Revenue', revenueTrend, '#059669');
  const appointmentOption = useTrendChartOption('Appointments', appointmentTrend, '#2563eb');

  return (
    <div
      className={cn(
        'grid gap-5',
        hasRevenue && hasAppointments
          ? 'grid-cols-1 lg:grid-cols-2'
          : 'grid-cols-1'
      )}
    >
      {hasRevenue && (
        <SectionCard className="h-full">
          <SectionHeading className="mb-4">Revenue Trend</SectionHeading>
          <ReactECharts option={revenueOption} style={{ height: 260 }} />
        </SectionCard>
      )}
      {hasAppointments && (
        <SectionCard className="h-full">
          <SectionHeading className="mb-4">Appointment Trend</SectionHeading>
          <ReactECharts option={appointmentOption} style={{ height: 260 }} />
        </SectionCard>
      )}
    </div>
  );
};

export const UpcomingAppointments: React.FC<{
  items: DashboardAppointmentItem[];
  title?: string;
  onViewAll?: () => void;
}> = ({ items, title = 'Upcoming Appointments', onViewAll }) => {
  if (!items.length) return null;

  return (
    <SectionCard className="h-full">
      <div className="mb-5 flex items-center justify-between gap-3">
        <SectionHeading>{title}</SectionHeading>
        {onViewAll && (
          <button
            type="button"
            onClick={onViewAll}
            className="flex items-center text-sm font-semibold text-[var(--color-brand-gold-dark)] hover:underline"
          >
            View Calendar <ChevronRight className="ml-1 h-4 w-4" />
          </button>
        )}
      </div>
      <div className="space-y-3">
        {items.map((apt) => (
          <div
            key={apt.id}
            className="flex items-center justify-between rounded-xl border border-gray-100 p-4 transition-colors hover:bg-gray-50"
          >
            <div className="flex min-w-0 items-center gap-4">
              <div className="min-w-[70px] text-center">
                <span className="block text-sm font-bold text-[var(--color-text-primary)]">
                  {apt.time}
                </span>
              </div>
              <div className="h-10 w-[2px] rounded-full bg-gray-200" />
              <div className="min-w-0">
                <h4 className="truncate text-sm font-bold text-[var(--color-text-primary)]">
                  {apt.client_name}
                </h4>
                <p className="mt-0.5 truncate text-xs text-[var(--color-text-secondary)]">
                  {apt.service_summary} • with {apt.staff_name}
                </p>
              </div>
            </div>
            <span className="ml-3 shrink-0 rounded-full bg-gray-100 px-3 py-1 text-xs font-semibold text-gray-700">
              {apt.status}
            </span>
          </div>
        ))}
      </div>
    </SectionCard>
  );
};

export const PerformanceList: React.FC<{
  title: string;
  items: PerformanceItem[];
  icon?: React.ElementType;
}> = ({ title, items, icon: Icon = Star }) => {
  if (!items.length) return null;

  return (
    <SectionCard className="h-full">
      <div className="mb-4 flex items-center justify-between gap-3">
        <SectionHeading>{title}</SectionHeading>
        <Icon className="h-4 w-4 text-[var(--color-brand-gold)]" />
      </div>
      <div className="space-y-4">
        {items.map((item) => (
          <div key={item.id} className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <h4 className="truncate text-sm font-semibold text-[var(--color-text-primary)]">
                {item.name}
              </h4>
              {item.subtitle && (
                <p className="text-xs text-[var(--color-text-secondary)]">{item.subtitle}</p>
              )}
            </div>
            <span className="shrink-0 text-sm font-bold text-[var(--color-brand-gold-dark)]">
              {formatPerformanceValue(item.value)}
            </span>
          </div>
        ))}
      </div>
    </SectionCard>
  );
};

export const OperationsPanel: React.FC<{
  operations: DashboardOperation[];
  onOperationClick?: (key: string) => void;
}> = ({ operations, onOperationClick }) => {
  if (!operations.length) return null;

  return (
    <SectionCard className="h-full">
      <SectionHeading className="mb-4">Operations</SectionHeading>
      <div className="space-y-3">
        {operations.map((op) => {
          const isClickable = Boolean(
            onOperationClick && op.key === 'pending_leave_requests'
          );
          const Wrapper = isClickable ? 'button' : 'div';

          return (
            <Wrapper
              key={op.key}
              type={isClickable ? 'button' : undefined}
              onClick={isClickable ? () => onOperationClick?.(op.key) : undefined}
              className={cn(
                'flex w-full items-center justify-between rounded-xl border border-gray-100 px-4 py-3',
                isClickable &&
                  'cursor-pointer text-left transition-colors hover:bg-gray-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-brand-gold)]'
              )}
            >
              <div>
                <p className="text-sm font-semibold text-[var(--color-text-primary)]">{op.label}</p>
                {op.sub && <p className="text-xs text-[var(--color-text-secondary)]">{op.sub}</p>}
              </div>
              <span className="text-lg font-bold text-[var(--color-brand-gold-dark)]">
                {op.value}
              </span>
            </Wrapper>
          );
        })}
      </div>
    </SectionCard>
  );
};

const ALERT_STYLES: Record<DashboardAlert['severity'], string> = {
  error: 'bg-red-50',
  warning: 'bg-amber-50',
  info: 'bg-blue-50',
};

const ALERT_ICON_STYLES: Record<DashboardAlert['severity'], string> = {
  error: 'text-red-500',
  warning: 'text-amber-500',
  info: 'text-blue-500',
};

const ALERT_TEXT_STYLES: Record<DashboardAlert['severity'], string> = {
  error: 'text-red-800',
  warning: 'text-amber-800',
  info: 'text-blue-800',
};

export const AlertsPanel: React.FC<{ alerts: DashboardAlert[] }> = ({ alerts }) => {
  if (!alerts.length) return null;

  return (
    <SectionCard className="h-full">
      <SectionHeading className="mb-4">Action Required</SectionHeading>
      <div className="space-y-3">
        {alerts.map((alert) => (
          <div
            key={alert.key}
            className={cn('flex items-start gap-3 rounded-xl p-3', ALERT_STYLES[alert.severity])}
          >
            <AlertCircle
              className={cn('mt-0.5 h-5 w-5 shrink-0', ALERT_ICON_STYLES[alert.severity])}
            />
            <div>
              <h4 className={cn('text-sm font-semibold', ALERT_TEXT_STYLES[alert.severity])}>
                {alert.title}
              </h4>
              <p className="mt-1 text-xs text-[var(--color-text-secondary)]">{alert.message}</p>
            </div>
          </div>
        ))}
      </div>
    </SectionCard>
  );
};

export const StaffPerformancePanel: React.FC<{
  monthlyServices: number;
  targetProgress: number;
}> = ({ monthlyServices, targetProgress }) => (
  <SectionCard className="h-full">
    <SectionHeading className="mb-4">Performance</SectionHeading>
    <div className="space-y-4">
      <div>
        <p className="text-sm text-[var(--color-text-secondary)]">Monthly Services</p>
        <p className="text-2xl font-bold text-[var(--color-text-primary)]">{monthlyServices}</p>
      </div>
      <div>
        <div className="mb-2 flex items-center justify-between text-sm">
          <span className="text-[var(--color-text-secondary)]">Target Progress</span>
          <span className="font-semibold text-[var(--color-brand-gold-dark)]">
            {targetProgress.toFixed(0)}%
          </span>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-gray-100">
          <div
            className="h-full rounded-full bg-[var(--color-brand-gold)] transition-all"
            style={{ width: `${Math.min(targetProgress, 100)}%` }}
          />
        </div>
      </div>
    </div>
  </SectionCard>
);

function formatPerformanceValue(value: string): string {
  const numeric = Number(String(value).replace(/,/g, ''));
  if (Number.isFinite(numeric) && /^\d/.test(value.trim())) {
    return formatCurrency(numeric);
  }
  return value;
}

export const DashboardSkeleton: React.FC = () => (
  <div className="animate-pulse space-y-6 md:space-y-8">
    <div className="h-20 rounded-2xl bg-gray-100" />
    <div className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,220px),1fr))] gap-4 md:gap-5">
      {Array.from({ length: 4 }).map((_, index) => (
        <div key={index} className="h-[148px] rounded-2xl bg-gray-100" />
      ))}
    </div>
    <div className="h-48 rounded-2xl bg-gray-100" />
  </div>
);
