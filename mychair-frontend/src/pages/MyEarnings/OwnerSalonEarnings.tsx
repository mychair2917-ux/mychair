import React, { useMemo, useState } from 'react';
import ReactECharts from 'echarts-for-react';
import {
  ArrowDownRight,
  ArrowUpRight,
  BarChart3,
  HandCoins,
  Package,
  Percent,
  ReceiptText,
  RefreshCw,
  Scissors,
  TrendingUp,
  Users,
  Wallet,
} from 'lucide-react';

import '../../utils/echarts-init';
import { Button, Input, Select } from '../../components/common';
import { showToast } from '../../components/common/Toast/toastService';
import {
  useGetSalonEarningsReportQuery,
  useListSalonEarningsTransactionsQuery,
} from '../../redux/slices/myEarnings/myEarningsApi';
import { useLazyGetBillDetailQuery } from '../../redux/slices/billing/billingApi';
import type { SalonEarningsQueryParams } from '../../redux/slices/myEarnings/Types';
import { cn } from '../../utils/cn';
import { formatCurrency } from '../../utils/currency';
import { downloadInvoicePDF } from '../../utils/invoicePdf';
import { getApiErrorMessage } from '../../utils/apiErrors';
import { formatDateDMY } from '../../utils/utilities';

type OwnerTab = 'overview' | 'services' | 'products' | 'staff' | 'transactions';
type PeriodFilter = NonNullable<SalonEarningsQueryParams['period']>;

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

const TABS: Array<{ id: OwnerTab; label: string }> = [
  { id: 'overview', label: 'Overview' },
  { id: 'services', label: 'Services' },
  { id: 'products', label: 'Products' },
  { id: 'staff', label: 'Staff Performance' },
  { id: 'transactions', label: 'Transactions' },
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

const TableShell: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="overflow-hidden rounded-[1.5rem] border border-[var(--color-border-soft)] bg-white shadow-soft">
    <div className="custom-scrollbar overflow-x-auto">{children}</div>
  </div>
);

const periodLabel = (period: PeriodFilter): string => {
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

const OwnerSalonEarnings: React.FC = () => {
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [period, setPeriod] = useState<PeriodFilter>('monthly');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [tab, setTab] = useState<OwnerTab>('overview');
  const [staffId, setStaffId] = useState('');
  const [serviceId, setServiceId] = useState('');
  const [productId, setProductId] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('');
  const [revenueType, setRevenueType] = useState<'' | 'SERVICE' | 'PRODUCT'>('');
  const [txPage, setTxPage] = useState(1);
  const [openingBillId, setOpeningBillId] = useState<string | null>(null);

  const params = useMemo<SalonEarningsQueryParams>(
    () => ({
      month,
      year,
      period,
      startDate: period === 'custom' ? startDate || undefined : undefined,
      endDate: period === 'custom' ? endDate || undefined : undefined,
      staffId: staffId || undefined,
      serviceId: serviceId || undefined,
      productId: productId || undefined,
      paymentMethod: paymentMethod || undefined,
      revenueType: revenueType || undefined,
    }),
    [
      endDate,
      month,
      paymentMethod,
      period,
      productId,
      revenueType,
      serviceId,
      staffId,
      startDate,
      year,
    ]
  );

  const {
    data: reportRes,
    isLoading,
    isFetching,
    isError,
    error,
    refetch,
  } = useGetSalonEarningsReportQuery(params);

  const {
    data: txRes,
    isLoading: txLoading,
    isFetching: txFetching,
    isError: txError,
    refetch: refetchTx,
  } = useListSalonEarningsTransactionsQuery(
    { ...params, page: txPage, limit: 15 },
    { skip: tab !== 'transactions' }
  );

  const [fetchBillDetail] = useLazyGetBillDetailQuery();

  const report = reportRes?.data;
  const summary = report?.summary;
  const comparison = summary?.comparison;
  const filterOptions = report?.filter_options;
  const transactions = txRes?.data;

  const rangeDisplay = useMemo(() => {
    if (!report?.period_start || !report?.period_end) {
      return periodLabel(period);
    }
    const start = formatDateDMY(report.period_start);
    const end = formatDateDMY(report.period_end);
    if (period === 'daily' || start === end) return start;
    return `${start} – ${end}`;
  }, [period, report?.period_end, report?.period_start]);

  const trendOption = useMemo(
    () => ({
      tooltip: { trigger: 'axis' },
      legend: { data: ['Revenue', 'Net Salon Earnings'], bottom: 0 },
      grid: { left: 24, right: 20, top: 24, bottom: 48, containLabel: true },
      xAxis: {
        type: 'category',
        data: report?.trend.map((item) => item.label) ?? [],
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
          name: 'Revenue',
          type: 'bar',
          data: report?.trend.map((item) => item.total_revenue) ?? [],
          itemStyle: { color: '#0F9D58', borderRadius: [6, 6, 0, 0] },
        },
        {
          name: 'Net Salon Earnings',
          type: 'line',
          smooth: true,
          data: report?.trend.map((item) => item.net_salon_earnings) ?? [],
          lineStyle: { color: '#B45309', width: 3 },
          itemStyle: { color: '#B45309' },
        },
      ],
    }),
    [report?.trend]
  );

  const handleOpenBill = async (billId: string) => {
    try {
      setOpeningBillId(billId);
      const res = await fetchBillDetail(billId).unwrap();
      if (res.data) {
        downloadInvoicePDF(res.data);
      } else {
        showToast('warning', 'Bill details not available.');
      }
    } catch (err) {
      showToast('error', getApiErrorMessage(err, 'Failed to open bill details'));
    } finally {
      setOpeningBillId(null);
    }
  };

  const resetDetailFilters = () => {
    setStaffId('');
    setServiceId('');
    setProductId('');
    setPaymentMethod('');
    setRevenueType('');
    setTxPage(1);
  };

  const hasData = (summary?.invoice_count ?? 0) > 0 || (summary?.total_revenue ?? 0) > 0;

  return (
    <div className="space-y-5 pb-8">
      <div className="rounded-[2rem] border border-[var(--color-border-soft)] bg-white/90 p-4 shadow-soft backdrop-blur md:p-5 xl:p-6">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <div className="mb-2 inline-flex items-center gap-2 rounded-full bg-[var(--color-brand-gold-light)]/20 px-3 py-1 text-xs font-semibold text-[var(--color-brand-gold-dark)]">
              <TrendingUp className="h-3.5 w-3.5" />
              Salon earnings overview
            </div>
            <h1 className="text-2xl font-bold text-[var(--color-text-primary)] md:text-3xl">
              My Earnings
            </h1>
            <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
              Complete salon financial performance for {rangeDisplay}
            </p>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Select
              className="!h-11 rounded-2xl"
              value={period}
              onChange={(e) => {
                setPeriod(e.target.value as PeriodFilter);
                setTxPage(1);
              }}
              options={PERIOD_OPTIONS}
            />
            <Select
              className="!h-11 rounded-2xl"
              value={String(month)}
              onChange={(e) => {
                setMonth(Number(e.target.value));
                setTxPage(1);
              }}
              options={MONTH_OPTIONS}
              disabled={period === 'daily' || period === 'weekly' || period === 'custom'}
            />
            <Select
              className="!h-11 rounded-2xl"
              value={String(year)}
              onChange={(e) => {
                setYear(Number(e.target.value));
                setTxPage(1);
              }}
              options={yearOptions()}
              disabled={period === 'daily' || period === 'weekly' || period === 'custom'}
            />
            <Button
              type="button"
              variant="secondary"
              className="h-11 rounded-2xl"
              onClick={() => {
                refetch();
                if (tab === 'transactions') refetchTx();
              }}
              icon={<RefreshCw className={cn('h-4 w-4', (isFetching || txFetching) && 'animate-spin')} />}
            >
              Refresh
            </Button>
          </div>
        </div>

        {period === 'custom' && (
          <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <Input
                type="date"
                className="!h-11 rounded-2xl"
                value={startDate}
                onChange={(e) => {
                  setStartDate(e.target.value);
                  setTxPage(1);
                }}
              />
              <p className="mt-1 text-xs text-gray-500">
                Start: {startDate ? formatDateDMY(startDate) : '—'}
              </p>
            </div>
            <div>
              <Input
                type="date"
                className="!h-11 rounded-2xl"
                value={endDate}
                onChange={(e) => {
                  setEndDate(e.target.value);
                  setTxPage(1);
                }}
              />
              <p className="mt-1 text-xs text-gray-500">
                End: {endDate ? formatDateDMY(endDate) : '—'}
              </p>
            </div>
          </div>
        )}

        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <Select
            className="!h-11 rounded-2xl"
            value={staffId}
            onChange={(e) => {
              setStaffId(e.target.value);
              setTxPage(1);
            }}
            options={[
              { value: '', label: 'All Staff' },
              ...(filterOptions?.staff.map((opt) => ({
                value: opt.value,
                label: opt.label,
              })) ?? []),
            ]}
          />
          <Select
            className="!h-11 rounded-2xl"
            value={serviceId}
            onChange={(e) => {
              setServiceId(e.target.value);
              setTxPage(1);
            }}
            options={[
              { value: '', label: 'All Services' },
              ...(filterOptions?.services.map((opt) => ({
                value: opt.value,
                label: opt.label,
              })) ?? []),
            ]}
          />
          <Select
            className="!h-11 rounded-2xl"
            value={productId}
            onChange={(e) => {
              setProductId(e.target.value);
              setTxPage(1);
            }}
            options={[
              { value: '', label: 'All Products' },
              ...(filterOptions?.products.map((opt) => ({
                value: opt.value,
                label: opt.label,
              })) ?? []),
            ]}
          />
          <Select
            className="!h-11 rounded-2xl"
            value={paymentMethod}
            onChange={(e) => {
              setPaymentMethod(e.target.value);
              setTxPage(1);
            }}
            options={[
              { value: '', label: 'All Payment Methods' },
              ...(filterOptions?.payment_methods.map((opt) => ({
                value: opt.value,
                label: opt.label,
              })) ?? []),
            ]}
          />
          <Select
            className="!h-11 rounded-2xl"
            value={revenueType}
            onChange={(e) => {
              setRevenueType(e.target.value as '' | 'SERVICE' | 'PRODUCT');
              setTxPage(1);
            }}
            options={[
              { value: '', label: 'All Revenue Types' },
              { value: 'SERVICE', label: 'Services Only' },
              { value: 'PRODUCT', label: 'Products Only' },
            ]}
          />
        </div>
      </div>

      <div className="custom-scrollbar flex gap-2 overflow-x-auto rounded-2xl border border-[var(--color-border-soft)] bg-white p-1 shadow-soft">
        {TABS.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setTab(item.id)}
            className={cn(
              'whitespace-nowrap rounded-xl px-4 py-2.5 text-sm font-semibold transition',
              tab === item.id
                ? 'bg-[var(--color-brand-gold)] text-white'
                : 'text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-bg)]'
            )}
          >
            {item.label}
          </button>
        ))}
      </div>

      {isLoading && (
        <SectionCard>
          <div className="animate-pulse space-y-4">
            <div className="h-4 w-40 rounded bg-gray-100" />
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {Array.from({ length: 4 }).map((_, idx) => (
                <div key={idx} className="h-28 rounded-2xl bg-gray-100" />
              ))}
            </div>
            <div className="h-56 rounded-2xl bg-gray-100" />
          </div>
        </SectionCard>
      )}

      {isError && (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-center">
          <p className="text-sm font-medium text-red-700">
            {getApiErrorMessage(error, 'Unable to load salon earnings.')}
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

      {!isLoading && !isError && report && !hasData && tab === 'overview' && (
        <EmptyState
          title="No earnings data for this period"
          description="Try a different date filter or clear staff/service/product filters to see salon revenue."
        />
      )}

      {!isLoading && !isError && report && hasData && tab === 'overview' && (
        <div className="space-y-5">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <MetricCard
              label="Total Revenue"
              value={formatCurrency(summary?.total_revenue ?? 0)}
              helper="Net sales after discounts & refunds"
              icon={Wallet}
              tone="bg-emerald-50 text-emerald-700"
            />
            <MetricCard
              label="Net Salon Earnings"
              value={formatCurrency(summary?.net_salon_earnings ?? 0)}
              helper="Revenue minus staff incentives"
              icon={TrendingUp}
              tone="bg-amber-50 text-amber-700"
            />
            <MetricCard
              label="Service Revenue"
              value={formatCurrency(summary?.service_revenue ?? 0)}
              helper="From salon services"
              icon={Scissors}
              tone="bg-sky-50 text-sky-700"
            />
            <MetricCard
              label="Product Revenue"
              value={formatCurrency(summary?.product_revenue ?? 0)}
              helper="From product sales"
              icon={Package}
              tone="bg-violet-50 text-violet-700"
            />
            <MetricCard
              label="Discounts"
              value={formatCurrency(summary?.discounts ?? 0)}
              helper="Line & invoice discounts"
              icon={Percent}
              tone="bg-orange-50 text-orange-700"
            />
            <MetricCard
              label="Refunds"
              value={formatCurrency(summary?.refunds ?? 0)}
              helper="Attributed refund reductions"
              icon={RefreshCw}
              tone="bg-rose-50 text-rose-700"
            />
            <MetricCard
              label="Taxes"
              value={formatCurrency(summary?.taxes ?? 0)}
              helper="Tax collected on net sales"
              icon={ReceiptText}
              tone="bg-slate-50 text-slate-700"
            />
            <MetricCard
              label="Staff Incentives"
              value={formatCurrency(summary?.staff_incentives ?? 0)}
              helper="Commissions for the period"
              icon={HandCoins}
              tone="bg-teal-50 text-teal-700"
            />
          </div>

          {comparison?.has_previous_data && (
            <SectionCard>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm font-medium text-[var(--color-text-secondary)]">
                    vs previous period
                  </p>
                  <h3 className="mt-1 text-2xl font-bold text-[var(--color-text-primary)]">
                    {formatCurrency(comparison.current_amount)}
                  </h3>
                  <p className="mt-1 text-xs text-gray-500">
                    Previous: {formatCurrency(comparison.previous_amount)}
                  </p>
                </div>
                {comparison.change_percent != null && (
                  <div
                    className={cn(
                      'inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-sm font-semibold',
                      comparison.change_percent >= 0
                        ? 'bg-emerald-50 text-emerald-700'
                        : 'bg-rose-50 text-rose-700'
                    )}
                  >
                    {comparison.change_percent >= 0 ? (
                      <ArrowUpRight className="h-4 w-4" />
                    ) : (
                      <ArrowDownRight className="h-4 w-4" />
                    )}
                    {comparison.change_percent >= 0 ? '+' : ''}
                    {comparison.change_percent}% vs previous period
                  </div>
                )}
              </div>
            </SectionCard>
          )}

          <div className="grid grid-cols-1 gap-5 xl:grid-cols-3">
            <SectionCard className="xl:col-span-2">
              <div className="mb-4 flex items-center gap-2">
                <BarChart3 className="h-5 w-5 text-[var(--color-brand-gold-dark)]" />
                <h3 className="text-base font-bold text-[var(--color-text-primary)]">
                  Earnings Trend
                </h3>
              </div>
              {(report.trend?.length ?? 0) === 0 ? (
                <p className="text-sm text-gray-500">No trend points for this period.</p>
              ) : (
                <ReactECharts option={trendOption} style={{ height: 320 }} opts={{ renderer: 'svg' }} />
              )}
            </SectionCard>

            <SectionCard>
              <h3 className="text-base font-bold text-[var(--color-text-primary)]">
                Revenue Sources
              </h3>
              <p className="mt-1 text-xs text-gray-500">Where salon revenue comes from</p>
              <div className="mt-5 space-y-4">
                {(report.revenue_sources?.length ?? 0) === 0 ? (
                  <p className="text-sm text-gray-500">No revenue sources in this period.</p>
                ) : (
                  report.revenue_sources.map((source) => (
                    <div key={source.key}>
                      <div className="mb-1.5 flex items-center justify-between text-sm">
                        <span className="font-medium text-[var(--color-text-primary)]">
                          {source.label}
                        </span>
                        <span className="text-[var(--color-text-secondary)]">
                          {formatCurrency(source.amount)} · {source.percent}%
                        </span>
                      </div>
                      <div className="h-2 overflow-hidden rounded-full bg-gray-100">
                        <div
                          className={cn(
                            'h-full rounded-full',
                            source.key === 'services' ? 'bg-emerald-500' : 'bg-violet-500'
                          )}
                          style={{ width: `${Math.min(Math.max(source.percent, 0), 100)}%` }}
                        />
                      </div>
                    </div>
                  ))
                )}
              </div>

              <div className="mt-6 rounded-2xl bg-[var(--color-surface-bg)] p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                  How net is calculated
                </p>
                <p className="mt-2 text-sm text-[var(--color-text-secondary)]">
                  Revenue (services + products, after discounts & refunds) − Staff incentives ={' '}
                  <span className="font-semibold text-[var(--color-text-primary)]">
                    Net Salon Earnings
                  </span>
                  . Taxes are shown separately as amounts collected.
                </p>
              </div>
            </SectionCard>
          </div>
        </div>
      )}

      {!isLoading && !isError && report && tab === 'services' && (
        <TableShell>
          <table className="min-w-full text-left text-sm">
            <thead className="bg-[var(--color-surface-bg)] text-xs uppercase tracking-wide text-gray-500">
              <tr>
                <th className="px-4 py-3">Service</th>
                <th className="px-4 py-3">Times</th>
                <th className="px-4 py-3">Gross</th>
                <th className="px-4 py-3">Discounts</th>
                <th className="px-4 py-3">Net</th>
                <th className="px-4 py-3">Staff</th>
                <th className="px-4 py-3">Incentive</th>
                <th className="px-4 py-3">Salon Earnings</th>
              </tr>
            </thead>
            <tbody>
              {(report.services?.length ?? 0) === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-gray-500">
                    No service earnings for this period.
                  </td>
                </tr>
              ) : (
                report.services.map((row) => (
                  <tr key={row.service_id} className="border-t border-gray-100">
                    <td className="px-4 py-3 font-medium text-[var(--color-text-primary)]">
                      {row.service_name}
                    </td>
                    <td className="px-4 py-3">{row.times_performed}</td>
                    <td className="px-4 py-3">{formatCurrency(row.gross_revenue)}</td>
                    <td className="px-4 py-3">{formatCurrency(row.discounts)}</td>
                    <td className="px-4 py-3">{formatCurrency(row.net_revenue)}</td>
                    <td className="px-4 py-3 text-[var(--color-text-secondary)]">
                      {row.staff_names.join(', ') || '—'}
                    </td>
                    <td className="px-4 py-3">{formatCurrency(row.staff_incentive)}</td>
                    <td className="px-4 py-3 font-semibold">
                      {formatCurrency(row.salon_earnings)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </TableShell>
      )}

      {!isLoading && !isError && report && tab === 'products' && (
        <TableShell>
          <table className="min-w-full text-left text-sm">
            <thead className="bg-[var(--color-surface-bg)] text-xs uppercase tracking-wide text-gray-500">
              <tr>
                <th className="px-4 py-3">Product</th>
                <th className="px-4 py-3">Qty</th>
                <th className="px-4 py-3">Gross</th>
                <th className="px-4 py-3">Discounts</th>
                <th className="px-4 py-3">Net</th>
                <th className="px-4 py-3">Sold By</th>
                <th className="px-4 py-3">Cost</th>
                <th className="px-4 py-3">Profit</th>
                <th className="px-4 py-3">Salon Earnings</th>
              </tr>
            </thead>
            <tbody>
              {(report.products?.length ?? 0) === 0 ? (
                <tr>
                  <td colSpan={9} className="px-4 py-8 text-center text-gray-500">
                    No product sales for this period.
                  </td>
                </tr>
              ) : (
                report.products.map((row) => (
                  <tr key={row.product_id} className="border-t border-gray-100">
                    <td className="px-4 py-3 font-medium text-[var(--color-text-primary)]">
                      {row.product_name}
                    </td>
                    <td className="px-4 py-3">{row.quantity_sold}</td>
                    <td className="px-4 py-3">{formatCurrency(row.gross_sales)}</td>
                    <td className="px-4 py-3">{formatCurrency(row.discounts)}</td>
                    <td className="px-4 py-3">{formatCurrency(row.net_sales)}</td>
                    <td className="px-4 py-3 text-[var(--color-text-secondary)]">
                      {row.sold_by.join(', ') || '—'}
                    </td>
                    <td className="px-4 py-3">
                      {row.product_cost != null ? formatCurrency(row.product_cost) : '—'}
                    </td>
                    <td className="px-4 py-3">
                      {row.profit != null ? formatCurrency(row.profit) : '—'}
                    </td>
                    <td className="px-4 py-3 font-semibold">
                      {formatCurrency(row.salon_earnings)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </TableShell>
      )}

      {!isLoading && !isError && report && tab === 'staff' && (
        <TableShell>
          <table className="min-w-full text-left text-sm">
            <thead className="bg-[var(--color-surface-bg)] text-xs uppercase tracking-wide text-gray-500">
              <tr>
                <th className="px-4 py-3">Staff</th>
                <th className="px-4 py-3">Services</th>
                <th className="px-4 py-3">Service Revenue</th>
                <th className="px-4 py-3">Product Sales</th>
                <th className="px-4 py-3">Total Generated</th>
                <th className="px-4 py-3">Incentive</th>
                <th className="px-4 py-3">Salon Contribution</th>
              </tr>
            </thead>
            <tbody>
              {(report.staff_performance?.length ?? 0) === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-gray-500">
                    No staff performance data for this period.
                  </td>
                </tr>
              ) : (
                report.staff_performance.map((row) => (
                  <tr key={row.staff_id} className="border-t border-gray-100">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <Users className="h-4 w-4 text-gray-400" />
                        <span className="font-medium text-[var(--color-text-primary)]">
                          {row.staff_name}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3">{row.services_performed}</td>
                    <td className="px-4 py-3">{formatCurrency(row.service_revenue)}</td>
                    <td className="px-4 py-3">{formatCurrency(row.product_sales)}</td>
                    <td className="px-4 py-3 font-semibold">
                      {formatCurrency(row.total_generated_revenue)}
                    </td>
                    <td className="px-4 py-3">{formatCurrency(row.incentive)}</td>
                    <td className="px-4 py-3 font-semibold text-emerald-700">
                      {formatCurrency(row.salon_contribution)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </TableShell>
      )}

      {tab === 'transactions' && (
        <div className="space-y-4">
          {txError && (
            <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-center">
              <p className="text-sm font-medium text-red-700">
                Unable to load transactions for this period.
              </p>
              <button
                type="button"
                onClick={() => refetchTx()}
                className="mt-4 rounded-xl bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700"
              >
                Retry
              </button>
            </div>
          )}

          {(txLoading || txFetching) && !transactions && (
            <SectionCard>
              <p className="text-sm text-gray-500">Loading transactions...</p>
            </SectionCard>
          )}

          {transactions && (
            <>
              <TableShell>
                <table className="min-w-full text-left text-sm">
                  <thead className="bg-[var(--color-surface-bg)] text-xs uppercase tracking-wide text-gray-500">
                    <tr>
                      <th className="px-4 py-3">Invoice</th>
                      <th className="px-4 py-3">Date</th>
                      <th className="px-4 py-3">Client</th>
                      <th className="px-4 py-3">Services</th>
                      <th className="px-4 py-3">Products</th>
                      <th className="px-4 py-3">Gross</th>
                      <th className="px-4 py-3">Discount</th>
                      <th className="px-4 py-3">Tax</th>
                      <th className="px-4 py-3">Final</th>
                      <th className="px-4 py-3">Payment</th>
                      <th className="px-4 py-3">Refund</th>
                      <th className="px-4 py-3">Staff</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(transactions.items?.length ?? 0) === 0 ? (
                      <tr>
                        <td colSpan={12} className="px-4 py-8 text-center text-gray-500">
                          No transactions for this period.
                        </td>
                      </tr>
                    ) : (
                      transactions.items.map((row) => (
                        <tr
                          key={row.id}
                          className="cursor-pointer border-t border-gray-100 hover:bg-[var(--color-surface-bg)]"
                          onClick={() => handleOpenBill(row.id)}
                        >
                          <td className="px-4 py-3 font-medium text-[var(--color-brand-gold-dark)]">
                            {openingBillId === row.id ? 'Opening…' : row.invoice_number}
                          </td>
                          <td className="px-4 py-3">{formatDateDMY(row.date)}</td>
                          <td className="px-4 py-3">{row.client_name || '—'}</td>
                          <td className="max-w-[160px] truncate px-4 py-3" title={row.services_summary}>
                            {row.services_summary}
                          </td>
                          <td className="max-w-[160px] truncate px-4 py-3" title={row.products_summary}>
                            {row.products_summary}
                          </td>
                          <td className="px-4 py-3">{formatCurrency(row.gross_amount)}</td>
                          <td className="px-4 py-3">{formatCurrency(row.discount)}</td>
                          <td className="px-4 py-3">{formatCurrency(row.tax)}</td>
                          <td className="px-4 py-3 font-semibold">
                            {formatCurrency(row.final_amount)}
                          </td>
                          <td className="px-4 py-3">
                            <div className="text-xs">
                              <p>{row.payment_method || '—'}</p>
                              <p className="text-gray-500">{row.payment_status}</p>
                            </div>
                          </td>
                          <td className="px-4 py-3">{formatCurrency(row.refund_amount)}</td>
                          <td className="max-w-[140px] truncate px-4 py-3" title={row.staff_summary}>
                            {row.staff_summary}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </TableShell>

              {transactions.pages > 1 && (
                <div className="flex items-center justify-between">
                  <p className="text-sm text-gray-500">
                    Page {transactions.page} of {transactions.pages} · {transactions.total} bills
                  </p>
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant="secondary"
                      className="rounded-xl"
                      disabled={transactions.page <= 1}
                      onClick={() => setTxPage((p) => Math.max(p - 1, 1))}
                    >
                      Previous
                    </Button>
                    <Button
                      type="button"
                      variant="secondary"
                      className="rounded-xl"
                      disabled={transactions.page >= transactions.pages}
                      onClick={() => setTxPage((p) => p + 1)}
                    >
                      Next
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {!isLoading && !isError && !hasData && (
        <div className="flex justify-center">
          <Button type="button" variant="secondary" className="rounded-2xl" onClick={resetDetailFilters}>
            Clear filters
          </Button>
        </div>
      )}
    </div>
  );
};

export default OwnerSalonEarnings;
