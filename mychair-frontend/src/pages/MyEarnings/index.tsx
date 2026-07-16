import React, { useEffect, useMemo, useState } from 'react';
import ReactECharts from 'echarts-for-react';
import {
  ArrowUpRight,
  BarChart3,
  CalendarDays,
  CreditCard,
  Download,
  HandCoins,
  Sparkles,
  Target,
  TrendingUp,
  Wallet,
} from 'lucide-react';

import '../../utils/echarts-init';
import { Button, Input, ProgressBar, Select } from '../../components/common';
import {
  useGetMyEarningsSummaryQuery,
  useGetMyIncentiveBreakdownQuery,
  useGetMyWalletQuery,
  useLazyGetMySalarySlipQuery,
  useListMyDailyEarningsQuery,
  useListMyRecentActivityQuery,
  useListMySalaryHistoryQuery,
} from '../../redux/slices/myEarnings/myEarningsApi';
import { useAppSelector } from '../../redux/hooks';
import { getUserDisplayName } from '../../redux/slices/auth/authSlice';
import type { MyEarningsQueryParams } from '../../redux/slices/myEarnings/Types';
import { cn } from '../../utils/cn';
import { formatCurrency } from '../../utils/currency';
import { downloadSalarySlipPDF } from '../../utils/salarySlipPdf';
import { formatDateDMY } from '../../utils/utilities';
import { useListEmployeesQuery } from '../../redux/slices/employees/employeesApi';
import { normalizeRole, isSuperAdmin } from '../../config/rbac';
import { ROLES } from '../../constants';

type EarningsTab = 'dashboard' | 'daily' | 'wallet' | 'salary-history' | 'breakdown';
type PeriodFilter = NonNullable<MyEarningsQueryParams['period']>;

const MONTH_OPTIONS = [
  { value: '1', label: 'January' },
  { value: '2', label: 'February' },
  { value: '3', label: 'March' },
  { value: '4', label: 'April' },
  { value: '5', label: 'May' },
  { value: '6', label: 'June' },
  { value: '7', label: 'July' },
  { value: '8', label: 'August' },
  { value: '9', label: 'September' },
  { value: '10', label: 'October' },
  { value: '11', label: 'November' },
  { value: '12', label: 'December' },
];

const PERIOD_OPTIONS = [
  { value: 'daily', label: 'Daily' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'monthly', label: 'Monthly' },
  { value: 'custom', label: 'Custom Range' },
];

const tabs: Array<{ id: EarningsTab; label: string }> = [
  { id: 'dashboard', label: 'Dashboard' },
  { id: 'daily', label: 'Daily Earnings' },
  { id: 'wallet', label: 'Wallet' },
  { id: 'salary-history', label: 'Salary History' },
  { id: 'breakdown', label: 'Breakdown' },
];

const yearOptions = (): { value: string; label: string }[] => {
  const current = new Date().getFullYear();
  const years: { value: string; label: string }[] = [];
  for (let year = current + 1; year >= current - 4; year -= 1) {
    years.push({ value: String(year), label: String(year) });
  }
  return years;
};

const SectionCard: React.FC<{ children: React.ReactNode; className?: string }> = ({
  children,
  className,
}) => (
  <div
    className={cn(
      'rounded-[1.5rem] border border-[var(--color-border-soft)] bg-white p-5 shadow-soft',
      className
    )}
  >
    {children}
  </div>
);

const MetricCard: React.FC<{
  label: string;
  value: string;
  helper: string;
  icon: React.ElementType;
  tone: string;
}> = ({ label, value, helper, icon: Icon, tone }) => (
  <SectionCard>
    <div className="flex items-start justify-between gap-3">
      <div className={cn('flex h-11 w-11 items-center justify-center rounded-2xl', tone)}>
        <Icon className="h-5 w-5" />
      </div>
      <span className="rounded-full bg-[var(--color-surface-bg)] px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-gray-500">
        Live
      </span>
    </div>
    <p className="mt-4 text-sm font-medium text-[var(--color-text-secondary)]">{label}</p>
    <h3 className="mt-1 text-2xl font-bold text-[var(--color-text-primary)]">{value}</h3>
    <p className="mt-2 text-xs text-gray-500">{helper}</p>
  </SectionCard>
);

const EmptyState: React.FC<{ title: string; description: string }> = ({ title, description }) => (
  <SectionCard className="border-dashed text-center">
    <h3 className="text-base font-bold text-[var(--color-text-primary)]">{title}</h3>
    <p className="mt-1 text-sm text-[var(--color-text-secondary)]">{description}</p>
  </SectionCard>
);

const StatusPill: React.FC<{ status: string }> = ({ status }) => {
  const paid = status === 'PAID';
  return (
    <span
      className={cn(
        'inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ring-1',
        paid
          ? 'bg-emerald-50 text-emerald-700 ring-emerald-200'
          : 'bg-amber-50 text-amber-700 ring-amber-200'
      )}
    >
      {paid ? 'Paid' : 'Pending'}
    </span>
  );
};

const TableShell: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="overflow-hidden rounded-[1.5rem] border border-[var(--color-border-soft)] bg-white shadow-soft">
    <div className="custom-scrollbar overflow-x-auto">{children}</div>
  </div>
);

const filterLabel = (period: PeriodFilter): string => {
  switch (period) {
    case 'daily':
      return 'today';
    case 'weekly':
      return 'this week';
    case 'custom':
      return 'selected range';
    default:
      return 'this month';
  }
};

const MyEarningsPage: React.FC = () => {
  const user = useAppSelector((state) => state.auth.user);
  const now = new Date();

  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [period, setPeriod] = useState<PeriodFilter>('monthly');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [tab, setTab] = useState<EarningsTab>('dashboard');
  const [historyPage, setHistoryPage] = useState(1);
  const [activeSlipId, setActiveSlipId] = useState<string | null>(null);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string>('');

  const isPrivilegedRole = useMemo(() => {
    const norm = normalizeRole(user?.role);
    return (
      norm === ROLES.SUPER_ADMIN ||
      norm === ROLES.SALON_OWNER ||
      norm === ROLES.SALON_ADMIN ||
      norm === ROLES.SALON_MANAGER
    );
  }, [user]);

  const { data: employeesRes } = useListEmployeesQuery(undefined, {
    skip: !isPrivilegedRole,
  });
  const employees = employeesRes?.data ?? [];

  useEffect(() => {
    if (isSuperAdmin(user?.role) && employees.length > 0 && !selectedEmployeeId) {
      setSelectedEmployeeId(employees[0].id);
    }
  }, [employees, user, selectedEmployeeId]);

  const selectedEmployee = useMemo(() => {
    return employees.find((emp) => emp.id === selectedEmployeeId);
  }, [employees, selectedEmployeeId]);

  const displayName = useMemo(() => {
    if (selectedEmployee) {
      return selectedEmployee.full_name;
    }
    return getUserDisplayName(user) || 'Team member';
  }, [selectedEmployee, user]);

  const params = useMemo<MyEarningsQueryParams>(
    () => ({
      month,
      year,
      period,
      startDate: period === 'custom' ? startDate || undefined : undefined,
      endDate: period === 'custom' ? endDate || undefined : undefined,
      employeeId: selectedEmployeeId || undefined,
    }),
    [endDate, month, period, startDate, year, selectedEmployeeId]
  );

  const monthName =
    MONTH_OPTIONS.find((option) => Number(option.value) === month)?.label ?? String(month);

  const { data: summaryRes, isLoading: summaryLoading } = useGetMyEarningsSummaryQuery(params);
  const { data: dailyRes, isLoading: dailyLoading } = useListMyDailyEarningsQuery(params);
  const { data: walletRes, isLoading: walletLoading } = useGetMyWalletQuery(params);
  const { data: historyRes, isLoading: historyLoading } = useListMySalaryHistoryQuery({
    page: historyPage,
    limit: 10,
    employeeId: selectedEmployeeId || undefined,
  });
  const { data: breakdownRes, isLoading: breakdownLoading } = useGetMyIncentiveBreakdownQuery(params);
  const { data: activityRes, isLoading: activityLoading } = useListMyRecentActivityQuery({
    ...params,
    limit: 8,
  });
  const [fetchSalarySlip] = useLazyGetMySalarySlipQuery();

  const summary = summaryRes?.data;
  const dailyRows = dailyRes?.data ?? [];
  const wallet = walletRes?.data;
  const history = historyRes?.data;
  const breakdown = breakdownRes?.data;
  const activityRows = activityRes?.data ?? [];

  const growthChartOption = useMemo(
    () => ({
      tooltip: { trigger: 'axis' },
      grid: { left: 24, right: 20, top: 24, bottom: 24, containLabel: true },
      xAxis: {
        type: 'category',
        data: breakdown?.monthly_growth.map((item) => item.label) ?? [],
        axisLine: { lineStyle: { color: '#E5E7EB' } },
        axisLabel: { color: '#6B7280' },
      },
      yAxis: {
        type: 'value',
        axisLine: { show: false },
        splitLine: { lineStyle: { color: '#F3F4F6' } },
        axisLabel: {
          color: '#6B7280',
          formatter: (value: number) => `₹${Math.round(value)}`,
        },
      },
      series: [
        {
          name: 'Earnings',
          type: 'line',
          smooth: true,
          data: breakdown?.monthly_growth.map((item) => item.earnings) ?? [],
          lineStyle: { color: '#0F9D58', width: 3 },
          itemStyle: { color: '#0F9D58' },
          areaStyle: { color: 'rgba(15,157,88,0.12)' },
        },
        {
          name: 'Incentives',
          type: 'line',
          smooth: true,
          data: breakdown?.monthly_growth.map((item) => item.incentives) ?? [],
          lineStyle: { color: '#7C3AED', width: 3 },
          itemStyle: { color: '#7C3AED' },
          areaStyle: { color: 'rgba(124,58,237,0.08)' },
        },
      ],
    }),
    [breakdown?.monthly_growth]
  );

  const handleDownloadSlip = async (payrollId: string) => {
    try {
      setActiveSlipId(payrollId);
      const response = await fetchSalarySlip({
        payrollId,
        employeeId: selectedEmployeeId || undefined,
      }).unwrap();
      if (response.data) {
        downloadSalarySlipPDF(response.data);
      }
    } finally {
      setActiveSlipId(null);
    }
  };

  return (
    <div className="min-h-screen bg-[var(--color-surface-bg)] p-4 md:p-6 xl:p-8">
      <div className="mx-auto max-w-[1600px] space-y-5">
        <SectionCard className="bg-white/90 backdrop-blur">
          <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
            <div>
              <div className="mb-2 inline-flex items-center gap-2 rounded-full bg-[var(--color-brand-gold-light)]/20 px-3 py-1 text-xs font-semibold text-[var(--color-brand-gold-dark)]">
                <Sparkles className="h-3.5 w-3.5" />
                Personal earnings tracker
              </div>
              <h1 className="text-2xl font-bold text-[var(--color-text-primary)] md:text-3xl">
                My Earnings
              </h1>
              <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
                See how much you earned today, this month, and from each service or product you helped sell.
              </p>
              <p className="mt-2 text-xs text-gray-500">
                Viewing {filterLabel(period)} for {displayName}.
              </p>
            </div>

            <div className="flex flex-col gap-3 xl:min-w-[540px]">
              {isPrivilegedRole && (
                <div className="w-full">
                  <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-500">
                    Select Employee
                  </label>
                  <Select
                    value={selectedEmployeeId}
                    onChange={(e) => setSelectedEmployeeId(e.target.value)}
                    options={[
                      ...(!isSuperAdmin(user?.role) ? [{ value: '', label: 'My Own Earnings' }] : []),
                      ...employees.map((emp) => ({
                        value: emp.id,
                        label: `${emp.full_name} (${emp.role})`,
                      })),
                    ]}
                  />
                </div>
              )}

              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <Select
                  value={period}
                  onChange={(e) => setPeriod(e.target.value as PeriodFilter)}
                  options={PERIOD_OPTIONS}
                />
                <Select
                  value={String(month)}
                  onChange={(e) => setMonth(Number(e.target.value))}
                  options={MONTH_OPTIONS}
                />
                <Select
                  value={String(year)}
                  onChange={(e) => setYear(Number(e.target.value))}
                  options={yearOptions()}
                />
                <div className="rounded-2xl border border-[var(--color-border-soft)] bg-[var(--color-surface-bg)] px-3 py-2 text-xs font-medium text-gray-500 flex items-center justify-center">
                  {period === 'custom' ? 'Custom dates' : `${monthName} ${year}`}
                </div>
              </div>
            </div>
          </div>

          {period === 'custom' && (
            <div className="mt-4 grid gap-3 md:grid-cols-2 xl:max-w-xl">
              <div>
                <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-500">
                  Start Date
                </label>
                <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
                {startDate ? (
                  <p className="mt-1 text-xs text-gray-500">{formatDateDMY(startDate)}</p>
                ) : null}
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-500">
                  End Date
                </label>
                <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
                {endDate ? <p className="mt-1 text-xs text-gray-500">{formatDateDMY(endDate)}</p> : null}
              </div>
            </div>
          )}
        </SectionCard>

        <div className="custom-scrollbar flex gap-2 overflow-x-auto rounded-2xl border border-[var(--color-border-soft)] bg-white p-1 shadow-soft">
          {tabs.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setTab(item.id)}
              className={cn(
                'whitespace-nowrap rounded-xl px-4 py-2 text-sm font-semibold transition-all',
                tab === item.id
                  ? 'bg-[var(--color-brand-gold)] text-white shadow-sm'
                  : 'text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-bg)] hover:text-[var(--color-text-primary)]'
              )}
            >
              {item.label}
            </button>
          ))}
        </div>

        {tab === 'dashboard' && (
          <div className="space-y-5">
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-6">
              <MetricCard
                label="Today's Earnings"
                value={formatCurrency(summary?.today_earnings ?? 0)}
                helper="Live value for today"
                icon={CalendarDays}
                tone="bg-blue-50 text-blue-700"
              />
              <MetricCard
                label="Current Earnings"
                value={formatCurrency(summary?.month_earnings_to_date ?? 0)}
                helper={`Running total for ${filterLabel(period)}`}
                icon={TrendingUp}
                tone="bg-emerald-50 text-emerald-700"
              />
              <MetricCard
                label="Service Incentives"
                value={formatCurrency(summary?.total_service_incentive ?? 0)}
                helper="From completed services"
                icon={HandCoins}
                tone="bg-emerald-50 text-emerald-700"
              />
              <MetricCard
                label="Product Incentives"
                value={formatCurrency(summary?.total_product_incentive ?? 0)}
                helper="From retail product sales"
                icon={BarChart3}
                tone="bg-violet-50 text-violet-700"
              />
              <MetricCard
                label="Pending Salary"
                value={formatCurrency(summary?.pending_payout ?? 0)}
                helper="Not yet settled in payroll"
                icon={CreditCard}
                tone="bg-amber-50 text-amber-700"
              />
              <MetricCard
                label="Wallet Balance"
                value={formatCurrency(summary?.wallet_balance ?? 0)}
                helper="Current incentive wallet"
                icon={Wallet}
                tone="bg-teal-50 text-teal-700"
              />
            </div>

            <div className="grid gap-5 xl:grid-cols-[1.25fr_0.75fr]">
              <SectionCard>
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <h3 className="text-lg font-bold text-[var(--color-text-primary)]">
                      Monthly Growth
                    </h3>
                    <p className="text-sm text-[var(--color-text-secondary)]">
                      Track earnings momentum and incentive growth over recent months.
                    </p>
                  </div>
                  <ArrowUpRight className="h-5 w-5 text-[var(--color-brand-gold-dark)]" />
                </div>

                <div className="mt-5 rounded-2xl bg-[var(--color-surface-bg)] p-3">
                  <ReactECharts option={growthChartOption} style={{ height: 280 }} />
                </div>
              </SectionCard>

              <SectionCard>
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <h3 className="text-lg font-bold text-[var(--color-text-primary)]">
                      Progress Snapshot
                    </h3>
                    <p className="text-sm text-[var(--color-text-secondary)]">
                      A simple view of where your pay is heading.
                    </p>
                  </div>
                  <Target className="h-5 w-5 text-[var(--color-brand-gold-dark)]" />
                </div>

                <div className="mt-6 space-y-5">
                  <div>
                    <div className="mb-2 flex items-center justify-between text-sm">
                      <span className="font-medium text-[var(--color-text-secondary)]">Wallet Progress</span>
                      <span className="font-semibold text-[var(--color-text-primary)]">
                        {summary?.month_progress_percent ?? 0}%
                      </span>
                    </div>
                    <ProgressBar positive={summary?.month_progress_percent ?? 0} negative={0} />
                  </div>

                  <div>
                    <div className="mb-2 flex items-center justify-between text-sm">
                      <span className="font-medium text-[var(--color-text-secondary)]">Target Progress</span>
                      <span className="font-semibold text-[var(--color-text-primary)]">
                        {summary?.target_progress_percent ?? 0}%
                      </span>
                    </div>
                    <ProgressBar positive={summary?.target_progress_percent ?? 0} negative={0} />
                  </div>

                  <div className="grid gap-3 md:grid-cols-2">
                    <div className="rounded-2xl bg-[var(--color-surface-bg)] p-4">
                      <p className="text-sm font-medium text-[var(--color-text-secondary)]">
                        Daily Average
                      </p>
                      <p className="mt-2 text-2xl font-bold text-[var(--color-text-primary)]">
                        {formatCurrency(summary?.daily_average_earnings ?? 0)}
                      </p>
                    </div>
                    <div className="rounded-2xl bg-[var(--color-surface-bg)] p-4">
                      <p className="text-sm font-medium text-[var(--color-text-secondary)]">
                        Estimated Month-End
                      </p>
                      <p className="mt-2 text-2xl font-bold text-[var(--color-text-primary)]">
                        {formatCurrency(summary?.estimated_month_end_earnings ?? 0)}
                      </p>
                    </div>
                  </div>

                  <div className="grid gap-3 md:grid-cols-2">
                    <div className="rounded-2xl border border-[var(--color-border-soft)] p-4">
                      <p className="text-sm font-medium text-[var(--color-text-secondary)]">
                        Completed Appointments
                      </p>
                      <p className="mt-2 text-2xl font-bold text-[var(--color-text-primary)]">
                        {summary?.completed_appointments_count ?? 0}
                      </p>
                    </div>
                    <div className="rounded-2xl border border-[var(--color-border-soft)] p-4">
                      <p className="text-sm font-medium text-[var(--color-text-secondary)]">
                        Incentive Entries
                      </p>
                      <p className="mt-2 text-2xl font-bold text-[var(--color-text-primary)]">
                        {summary?.incentive_entries_count ?? 0}
                      </p>
                    </div>
                  </div>
                </div>
              </SectionCard>
            </div>

            <div className="grid gap-5 xl:grid-cols-[0.85fr_1.15fr]">
              <SectionCard>
                <h3 className="text-lg font-bold text-[var(--color-text-primary)]">
                  Best Earning Days
                </h3>
                <p className="text-sm text-[var(--color-text-secondary)]">
                  Your strongest performance days for the selected period.
                </p>

                <div className="mt-4 space-y-3">
                  {!(breakdown?.best_earning_days.length) ? (
                    <p className="text-sm text-gray-500">No earning days recorded yet.</p>
                  ) : (
                    breakdown?.best_earning_days.map((day) => (
                      <div
                        key={day.date}
                        className="rounded-2xl border border-[var(--color-border-soft)] p-4"
                      >
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <p className="font-semibold text-[var(--color-text-primary)]">
                              {formatDateDMY(day.date)}
                            </p>
                            <p className="text-xs text-gray-500">
                              Service {formatCurrency(day.service_earnings)} · Product{' '}
                              {formatCurrency(day.product_earnings)}
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="font-bold text-emerald-700">
                              {formatCurrency(day.total_earnings)}
                            </p>
                            <p className="text-xs text-gray-500">
                              Incentives {formatCurrency(day.total_incentives)}
                            </p>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </SectionCard>

              <SectionCard>
                <h3 className="text-lg font-bold text-[var(--color-text-primary)]">
                  Recent Earnings Activity
                </h3>
                <p className="text-sm text-[var(--color-text-secondary)]">
                  Every eligible billing entry adds to your live wallet automatically.
                </p>

                <div className="mt-4 space-y-3">
                  {activityLoading ? (
                    <p className="text-sm text-gray-500">Loading recent activity...</p>
                  ) : activityRows.length === 0 ? (
                    <p className="text-sm text-gray-500">
                      Completed services and successful billings will appear here.
                    </p>
                  ) : (
                    activityRows.map((item) => (
                      <div
                        key={item.id}
                        className="rounded-2xl border border-[var(--color-border-soft)] p-4"
                      >
                        <div className="flex items-start justify-between gap-4">
                          <div>
                            <div className="flex items-center gap-2">
                              <span
                                className={cn(
                                  'rounded-full px-2 py-1 text-[10px] font-semibold uppercase tracking-wide',
                                  item.item_type === 'SERVICE'
                                    ? 'bg-emerald-50 text-emerald-700'
                                    : 'bg-violet-50 text-violet-700'
                                )}
                              >
                                {item.item_type === 'SERVICE' ? 'Service' : 'Product'}
                              </span>
                              <span className="text-xs text-gray-500">
                                {formatDateDMY(item.date)}
                              </span>
                            </div>
                            <p className="mt-2 font-semibold text-[var(--color-text-primary)]">
                              {item.item_name}
                            </p>
                            <p className="text-xs text-gray-500">
                              {item.reference_label || item.appointment_id || 'Direct billing'} ·{' '}
                              {item.note || 'Auto-calculated'}
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="font-bold text-emerald-700">
                              {formatCurrency(item.incentive_amount)}
                            </p>
                            <p className="text-xs text-gray-500">
                              Sales {formatCurrency(item.net_amount)}
                            </p>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </SectionCard>
            </div>

            <div className="rounded-2xl bg-[var(--color-surface-bg)] px-4 py-3 text-sm text-[var(--color-text-secondary)]">
              {summaryLoading
                ? 'Refreshing your earnings numbers...'
                : 'Incentives are counted only after appointment completion or successful payment. Cancelled appointments do not count, and refunds reduce earnings automatically.'}
            </div>
          </div>
        )}

        {tab === 'daily' && (
          <TableShell>
            <table className="min-w-full text-sm">
              <thead className="bg-[var(--color-surface-bg)] text-xs uppercase tracking-wide text-gray-500">
                <tr>
                  <th className="whitespace-nowrap px-4 py-3 text-left font-bold">Date</th>
                  <th className="whitespace-nowrap px-4 py-3 text-right font-bold">Service</th>
                  <th className="whitespace-nowrap px-4 py-3 text-right font-bold">Product</th>
                  <th className="whitespace-nowrap px-4 py-3 text-right font-bold">Service Incentive</th>
                  <th className="whitespace-nowrap px-4 py-3 text-right font-bold">Product Incentive</th>
                  <th className="whitespace-nowrap px-4 py-3 text-right font-bold">Daily Total</th>
                  <th className="whitespace-nowrap px-4 py-3 text-left font-bold">Appointments</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--color-border-soft)]">
                {dailyLoading ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-10 text-center text-sm text-gray-500">
                      Loading daily earnings...
                    </td>
                  </tr>
                ) : dailyRows.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-10">
                      <EmptyState
                        title="No daily earnings yet"
                        description="Eligible billed services and product commissions will appear date-wise here."
                      />
                    </td>
                  </tr>
                ) : (
                  dailyRows.map((row) => (
                    <tr key={row.date} className="transition hover:bg-[var(--color-surface-bg)]/70">
                      <td className="whitespace-nowrap px-4 py-4 font-semibold text-[var(--color-text-primary)]">
                        {formatDateDMY(row.date)}
                      </td>
                      <td className="whitespace-nowrap px-4 py-4 text-right">
                        {formatCurrency(row.service_earnings)}
                      </td>
                      <td className="whitespace-nowrap px-4 py-4 text-right">
                        {formatCurrency(row.product_earnings)}
                      </td>
                      <td className="whitespace-nowrap px-4 py-4 text-right text-emerald-700">
                        {formatCurrency(row.service_incentive)}
                      </td>
                      <td className="whitespace-nowrap px-4 py-4 text-right text-violet-700">
                        {formatCurrency(row.product_incentive)}
                      </td>
                      <td className="whitespace-nowrap px-4 py-4 text-right font-bold text-gray-900">
                        {formatCurrency(row.total_earnings)}
                      </td>
                      <td className="px-4 py-4 text-xs text-gray-500">
                        {row.appointment_references.length
                          ? row.appointment_references.join(', ')
                          : '-'}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </TableShell>
        )}

        {tab === 'wallet' && (
          <div className="space-y-5">
            <div className="grid gap-4 md:grid-cols-4">
              <MetricCard
                label="Wallet Balance"
                value={formatCurrency(wallet?.balance ?? 0)}
                helper="Live incentive balance"
                icon={Wallet}
                tone="bg-teal-50 text-teal-700"
              />
              <MetricCard
                label="Earned Total"
                value={formatCurrency(wallet?.earned_total ?? 0)}
                helper="All incentives in this view"
                icon={Sparkles}
                tone="bg-emerald-50 text-emerald-700"
              />
              <MetricCard
                label="Paid Out"
                value={formatCurrency(wallet?.paid_out_total ?? 0)}
                helper="Settled through payroll"
                icon={CreditCard}
                tone="bg-violet-50 text-violet-700"
              />
              <MetricCard
                label="Today Incentives"
                value={formatCurrency(summary?.today_incentives ?? 0)}
                helper="Today's live wallet growth"
                icon={HandCoins}
                tone="bg-amber-50 text-amber-700"
              />
            </div>

            <TableShell>
              <table className="min-w-full text-sm">
                <thead className="bg-[var(--color-surface-bg)] text-xs uppercase tracking-wide text-gray-500">
                  <tr>
                    <th className="whitespace-nowrap px-4 py-3 text-left font-bold">Date</th>
                    <th className="whitespace-nowrap px-4 py-3 text-left font-bold">Type</th>
                    <th className="whitespace-nowrap px-4 py-3 text-left font-bold">Reference</th>
                    <th className="whitespace-nowrap px-4 py-3 text-left font-bold">Item</th>
                    <th className="whitespace-nowrap px-4 py-3 text-right font-bold">Amount</th>
                    <th className="whitespace-nowrap px-4 py-3 text-right font-bold">Running Balance</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--color-border-soft)]">
                  {walletLoading ? (
                    <tr>
                      <td colSpan={6} className="px-4 py-10 text-center text-sm text-gray-500">
                        Loading wallet transactions...
                      </td>
                    </tr>
                  ) : !(wallet?.transactions.length) ? (
                    <tr>
                      <td colSpan={6} className="px-4 py-10">
                        <EmptyState
                          title="No wallet transactions yet"
                          description="Every completed incentive entry will update this wallet automatically."
                        />
                      </td>
                    </tr>
                  ) : (
                    wallet.transactions.map((transaction) => (
                      <tr key={transaction.id} className="transition hover:bg-[var(--color-surface-bg)]/70">
                        <td className="whitespace-nowrap px-4 py-4">
                          {formatDateDMY(transaction.date)}
                        </td>
                        <td className="whitespace-nowrap px-4 py-4">
                          <span
                            className={cn(
                              'inline-flex rounded-full px-2.5 py-1 text-xs font-semibold',
                              transaction.transaction_type === 'PAYOUT'
                                ? 'bg-amber-50 text-amber-700'
                                : transaction.category === 'SERVICE_INCENTIVE'
                                  ? 'bg-emerald-50 text-emerald-700'
                                  : 'bg-violet-50 text-violet-700'
                            )}
                          >
                            {transaction.transaction_type === 'PAYOUT'
                              ? 'Payout'
                              : transaction.category === 'SERVICE_INCENTIVE'
                                ? 'Service'
                                : 'Product'}
                          </span>
                        </td>
                        <td className="px-4 py-4 text-xs text-gray-600">
                          {transaction.reference_label || '-'}
                        </td>
                        <td className="px-4 py-4 text-xs text-gray-600">
                          {transaction.item_name || transaction.note || '-'}
                        </td>
                        <td
                          className={cn(
                            'whitespace-nowrap px-4 py-4 text-right font-semibold',
                            transaction.amount < 0 ? 'text-amber-700' : 'text-emerald-700'
                          )}
                        >
                          {formatCurrency(transaction.amount)}
                        </td>
                        <td className="whitespace-nowrap px-4 py-4 text-right font-bold text-gray-900">
                          {formatCurrency(transaction.running_balance)}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </TableShell>
          </div>
        )}

        {tab === 'salary-history' && (
          <div className="space-y-5">
            <TableShell>
              <table className="min-w-full text-sm">
                <thead className="bg-[var(--color-surface-bg)] text-xs uppercase tracking-wide text-gray-500">
                  <tr>
                    <th className="whitespace-nowrap px-4 py-3 text-left font-bold">Month</th>
                    <th className="whitespace-nowrap px-4 py-3 text-right font-bold">Base Salary</th>
                    <th className="whitespace-nowrap px-4 py-3 text-right font-bold">Service Incentive</th>
                    <th className="whitespace-nowrap px-4 py-3 text-right font-bold">Product Incentive</th>
                    <th className="whitespace-nowrap px-4 py-3 text-right font-bold">Bonus</th>
                    <th className="whitespace-nowrap px-4 py-3 text-right font-bold">Deductions</th>
                    <th className="whitespace-nowrap px-4 py-3 text-right font-bold">Final Paid</th>
                    <th className="whitespace-nowrap px-4 py-3 text-center font-bold">Status</th>
                    <th className="whitespace-nowrap px-4 py-3 text-left font-bold">Payment Date</th>
                    <th className="whitespace-nowrap px-4 py-3 text-right font-bold">Slip</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--color-border-soft)]">
                  {historyLoading ? (
                    <tr>
                      <td colSpan={10} className="px-4 py-10 text-center text-sm text-gray-500">
                        Loading salary history...
                      </td>
                    </tr>
                  ) : !(history?.items.length) ? (
                    <tr>
                      <td colSpan={10} className="px-4 py-10">
                        <EmptyState
                          title="No salary history found"
                          description="Generated payroll records and salary slips will appear here month-wise."
                        />
                      </td>
                    </tr>
                  ) : (
                    history.items.map((item) => (
                      <tr key={item.id} className="transition hover:bg-[var(--color-surface-bg)]/70">
                        <td className="whitespace-nowrap px-4 py-4 font-semibold text-[var(--color-text-primary)]">
                          {MONTH_OPTIONS.find((option) => Number(option.value) === item.month)?.label} {item.year}
                        </td>
                        <td className="whitespace-nowrap px-4 py-4 text-right">
                          {formatCurrency(item.base_salary)}
                        </td>
                        <td className="whitespace-nowrap px-4 py-4 text-right text-emerald-700">
                          {formatCurrency(item.service_incentive)}
                        </td>
                        <td className="whitespace-nowrap px-4 py-4 text-right text-violet-700">
                          {formatCurrency(item.product_incentive)}
                        </td>
                        <td className="whitespace-nowrap px-4 py-4 text-right">
                          {formatCurrency(item.bonus)}
                        </td>
                        <td className="whitespace-nowrap px-4 py-4 text-right text-amber-700">
                          {formatCurrency(item.deduction)}
                        </td>
                        <td className="whitespace-nowrap px-4 py-4 text-right font-bold text-gray-900">
                          {formatCurrency(item.final_paid_amount)}
                        </td>
                        <td className="whitespace-nowrap px-4 py-4 text-center">
                          <StatusPill status={item.payment_status} />
                        </td>
                        <td className="whitespace-nowrap px-4 py-4 text-xs text-gray-500">
                          {formatDateDMY(item.payment_date)}
                        </td>
                        <td className="whitespace-nowrap px-4 py-4 text-right">
                          <Button
                            variant="secondary"
                            size="sm"
                            disabled={activeSlipId === item.id}
                            onClick={() => handleDownloadSlip(item.id)}
                            icon={<Download className="h-3.5 w-3.5" />}
                          >
                            {activeSlipId === item.id ? 'Loading...' : 'Slip'}
                          </Button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </TableShell>

            {(history?.pages ?? 1) > 1 && (
              <SectionCard className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-xs text-gray-500">
                  Showing page <span className="font-medium">{history?.page}</span> of{' '}
                  <span className="font-medium">{history?.pages}</span>
                </p>
                <div className="flex items-center gap-2">
                  <Button
                    variant="secondary"
                    size="sm"
                    disabled={historyPage <= 1}
                    onClick={() => setHistoryPage((prev) => Math.max(1, prev - 1))}
                  >
                    Previous
                  </Button>
                  <Button
                    variant="secondary"
                    size="sm"
                    disabled={historyPage >= (history?.pages ?? 1)}
                    onClick={() => setHistoryPage((prev) => prev + 1)}
                  >
                    Next
                  </Button>
                </div>
              </SectionCard>
            )}
          </div>
        )}

        {tab === 'breakdown' && (
          <div className="space-y-5">
            <div className="grid gap-4 md:grid-cols-2">
              <MetricCard
                label="Service Incentive Total"
                value={formatCurrency(breakdown?.service_incentive_total ?? 0)}
                helper="Service commissions earned"
                icon={HandCoins}
                tone="bg-emerald-50 text-emerald-700"
              />
              <MetricCard
                label="Product Incentive Total"
                value={formatCurrency(breakdown?.product_incentive_total ?? 0)}
                helper="Product commissions earned"
                icon={BarChart3}
                tone="bg-violet-50 text-violet-700"
              />
            </div>

            <div className="grid gap-5 xl:grid-cols-2">
              <SectionCard>
                <h3 className="text-lg font-bold text-[var(--color-text-primary)]">
                  Top Services
                </h3>
                <div className="mt-4 space-y-3">
                  {breakdownLoading ? (
                    <p className="text-sm text-gray-500">Loading service breakdown...</p>
                  ) : !(breakdown?.top_services.length) ? (
                    <p className="text-sm text-gray-500">No service incentives yet for this view.</p>
                  ) : (
                    breakdown.top_services.map((item) => (
                      <div
                        key={item.name}
                        className="rounded-2xl border border-[var(--color-border-soft)] p-4"
                      >
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <p className="font-semibold text-[var(--color-text-primary)]">{item.name}</p>
                            <p className="text-xs text-gray-500">{item.count} completed billings</p>
                          </div>
                          <div className="text-right">
                            <p className="font-bold text-emerald-700">
                              {formatCurrency(item.incentive)}
                            </p>
                            <p className="text-xs text-gray-500">
                              Sales {formatCurrency(item.earnings)}
                            </p>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </SectionCard>

              <SectionCard>
                <h3 className="text-lg font-bold text-[var(--color-text-primary)]">
                  Top Products
                </h3>
                <div className="mt-4 space-y-3">
                  {breakdownLoading ? (
                    <p className="text-sm text-gray-500">Loading product breakdown...</p>
                  ) : !(breakdown?.top_products.length) ? (
                    <p className="text-sm text-gray-500">No product incentives yet for this view.</p>
                  ) : (
                    breakdown.top_products.map((item) => (
                      <div
                        key={item.name}
                        className="rounded-2xl border border-[var(--color-border-soft)] p-4"
                      >
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <p className="font-semibold text-[var(--color-text-primary)]">{item.name}</p>
                            <p className="text-xs text-gray-500">{item.count} completed billings</p>
                          </div>
                          <div className="text-right">
                            <p className="font-bold text-violet-700">
                              {formatCurrency(item.incentive)}
                            </p>
                            <p className="text-xs text-gray-500">
                              Sales {formatCurrency(item.earnings)}
                            </p>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </SectionCard>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default MyEarningsPage;
