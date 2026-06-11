import React, { useMemo, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import {
  AlertCircle,
  Banknote,
  BarChart3,
  Building2,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  CreditCard,
  Download,
  FileText,
  Filter,
  IndianRupee,
  MoreHorizontal,
  PackageCheck,
  Paperclip,
  Plus,
  Printer,
  ReceiptText,
  Search,
  Send,
  Sparkles,
  UploadCloud,
  Users,
  Wallet,
  X,
} from 'lucide-react';

import { Button, Input, Select } from '../components/common';
import { showToast } from '../components/common/Toast/toastService';
import ExpensesSection from '../components/expenses/ExpensesSection';
import PayrollSection from '../components/payroll/PayrollSection';
import { useAppSelector } from '../redux/hooks';
import { useLazyGetBillDetailQuery, useListBillsQuery } from '../redux/slices/billing/billingApi';
import { BillListItem } from '../redux/slices/billing/Types';
import { cn } from '../utils/cn';
import { formatCurrency } from '../utils/currency';
import { downloadInvoicePDF } from '../utils/invoicePdf';
import { formatDateDMY, toDateInputValue } from '../utils/utilities';

type SectionKey = 'bills' | 'payroll' | 'expenses';
type StatusTone = 'paid' | 'pending' | 'refunded' | 'processing' | 'partial' | 'approved' | 'danger' | 'neutral';
type DatePreset = 'today' | 'yesterday' | 'this_week' | 'this_month' | 'last_month' | 'custom';

interface TabItem {
  label: string;
  value: string;
}

interface StatCardItem {
  label: string;
  value: string;
  helper: string;
  tone: string;
  icon: React.ElementType;
}

interface Column<T> {
  key: keyof T | string;
  header: string;
  align?: 'left' | 'right' | 'center';
  render?: (row: T) => React.ReactNode;
  className?: string;
}

interface PurchaseRow {
  id: string;
  vendor: string;
  products: string;
  qty: string;
  amount: string;
  status: StatusTone;
  due: string;
}

interface PaymentRow {
  id: string;
  invoice: string;
  customer: string;
  method: string;
  amount: string;
  status: StatusTone;
  date: string;
}

const sectionItems: Array<{ key: SectionKey; label: string; description: string; icon: React.ElementType }> = [
  { key: 'bills', label: 'Bills', description: 'Invoices and refunds', icon: ReceiptText },
  { key: 'payroll', label: 'Payroll', description: 'Salary and incentives', icon: Users },
  { key: 'expenses', label: 'Expenses', description: 'Spend and approvals', icon: FileText },

];

const isSectionKey = (value: string | undefined): value is SectionKey =>
  Boolean(value && sectionItems.some((item) => item.key === value));

const tabsBySection: Record<SectionKey, TabItem[]> = {
  bills: [
    { label: 'All', value: 'all' },
    { label: 'Paid', value: 'paid' },
    { label: 'Pending', value: 'pending' },
    { label: 'Partially Paid', value: 'partially_paid' },
  ],
  payroll: [
    { label: 'Salary Structure', value: 'structure' },
    { label: 'Monthly Salary', value: 'monthly' },
    { label: 'Salary History', value: 'history' },
  ],
  expenses: [
    { label: 'All Expenses', value: 'all' },
    { label: 'Add Expense', value: 'add' },
    
  ],

};

const purchases: PurchaseRow[] = [
  {
    id: 'PO-8841',
    vendor: 'Luxe Beauty Supply',
    products: 'Color tubes, developer',
    qty: '86 units',
    amount: '₹48,600',
    status: 'pending',
    due: '05 Jun',
  },
  {
    id: 'PO-8840',
    vendor: 'Olaplex Partner',
    products: 'Treatment kits',
    qty: '24 units',
    amount: '₹72,400',
    status: 'paid',
    due: 'Paid',
  },
  {
    id: 'PO-8839',
    vendor: 'Spa Essentials',
    products: 'Towels, oils',
    qty: '120 units',
    amount: '₹21,300',
    status: 'processing',
    due: '08 Jun',
  },
];

const payments: PaymentRow[] = [
  {
    id: 'PAY-5601',
    invoice: 'INV-2408',
    customer: 'Aarohi Mehta',
    method: 'UPI',
    amount: '₹6,800',
    status: 'paid',
    date: '02 Jun 2026',
  },
  {
    id: 'PAY-5600',
    invoice: 'INV-2407',
    customer: 'Riya Kapoor',
    method: 'Split',
    amount: '₹5,000 / ₹9,400',
    status: 'partial',
    date: '02 Jun 2026',
  },
  {
    id: 'PAY-5599',
    invoice: 'INV-2406',
    customer: 'Maya Shah',
    method: 'Cash',
    amount: '₹12,500',
    status: 'pending',
    date: '01 Jun 2026',
  },
];

const statusStyles: Record<StatusTone, string> = {
  paid: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  pending: 'bg-amber-50 text-amber-700 ring-amber-200',
  refunded: 'bg-red-50 text-red-700 ring-red-200',
  processing: 'bg-blue-50 text-blue-700 ring-blue-200',
  partial: 'bg-violet-50 text-violet-700 ring-violet-200',
  approved: 'bg-teal-50 text-teal-700 ring-teal-200',
  danger: 'bg-red-50 text-red-700 ring-red-200',
  neutral: 'bg-gray-50 text-gray-600 ring-gray-200',
};

const formatStatus = (status: StatusTone) =>
  status === 'partial' ? 'Partial Paid' : status.charAt(0).toUpperCase() + status.slice(1);

const PageHeader: React.FC<{
  section: string;
  subtitle: string;
  onOpenDrawer: () => void;
}> = ({ section, subtitle, onOpenDrawer }) => (
  <div className="rounded-[2rem] border border-[var(--color-border-soft)] bg-white/90 p-4 shadow-soft backdrop-blur md:p-5 xl:p-6">
    <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
      <div>
        <div className="mb-2 inline-flex items-center gap-2 rounded-full bg-[var(--color-brand-gold-light)]/20 px-3 py-1 text-xs font-semibold text-[var(--color-brand-gold-dark)]">
          <Sparkles className="h-3.5 w-3.5" />
          Premium salon ERP finance desk
        </div>
        <h1 className="text-2xl font-bold text-[var(--color-text-primary)] md:text-3xl">
          Billing & Finance
        </h1>
        <p className="mt-1 text-sm text-[var(--color-text-secondary)]">{section} · {subtitle}</p>
      </div>

      <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
        <div className="relative min-w-0 lg:w-80">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <Input
            className="!h-11 rounded-2xl border-[var(--color-border-strong)] bg-[var(--color-surface-bg)] !pl-10"
            placeholder="Search invoice, client, vendor..."
          />
        </div>
        <Select
          className="!h-11 rounded-2xl border-[var(--color-border-strong)] bg-white"
          value="today"
          onChange={() => undefined}
          options={[
            { value: 'today', label: 'Today' },
            { value: 'week', label: 'This week' },
            { value: 'month', label: 'This month' },
          ]}
        />
        <Button className="h-11 rounded-2xl" icon={<Plus className="h-4 w-4" />} onClick={onOpenDrawer}>
          Create Bill
        </Button>
      </div>
    </div>
  </div>
);

const TabNavigation: React.FC<{
  tabs: TabItem[];
  value: string;
  onChange: (value: string) => void;
}> = ({ tabs, value, onChange }) => (
  <div className="custom-scrollbar flex gap-2 overflow-x-auto rounded-2xl border border-[var(--color-border-soft)] bg-white p-1 shadow-soft">
    {tabs.map((tab) => (
      <button
        key={tab.value}
        type="button"
        onClick={() => onChange(tab.value)}
        className={cn(
          'whitespace-nowrap rounded-xl px-4 py-2 text-sm font-semibold transition-all',
          value === tab.value
            ? 'bg-[var(--color-brand-gold)] text-white shadow-sm'
            : 'text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-bg)] hover:text-[var(--color-text-primary)]'
        )}
      >
        {tab.label}
      </button>
    ))}
  </div>
);

const StatCard: React.FC<StatCardItem> = ({ label, value, helper, tone, icon: Icon }) => (
  <div className="group overflow-hidden rounded-[1.5rem] border border-[var(--color-border-soft)] bg-white p-5 shadow-soft transition hover:-translate-y-0.5 hover:shadow-card">
    <div className="flex items-start justify-between">
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
  </div>
);

const SummaryCards: React.FC<{ items: StatCardItem[] }> = ({ items }) => (
  <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
    {items.map((item) => (
      <StatCard key={item.label} {...item} />
    ))}
  </div>
);

const StatusBadge: React.FC<{ status: StatusTone; label?: string }> = ({ status, label }) => (
  <span className={cn('inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ring-1', statusStyles[status])}>
    {label ?? formatStatus(status)}
  </span>
);

const ActionDropdown: React.FC<{ actions: string[] }> = ({ actions }) => (
  <div className="group relative flex justify-end">
    <button className="rounded-xl p-2 text-gray-400 transition hover:bg-gray-100 hover:text-gray-700">
      <MoreHorizontal className="h-4 w-4" />
    </button>
    <div className="invisible absolute right-0 top-9 z-20 min-w-36 translate-y-1 rounded-2xl border border-[var(--color-border-soft)] bg-white p-1 opacity-0 shadow-card transition group-hover:visible group-hover:translate-y-0 group-hover:opacity-100">
      {actions.map((action) => (
        <button
          key={action}
          type="button"
          className={cn(
            'flex w-full items-center rounded-xl px-3 py-2 text-left text-xs font-semibold transition hover:bg-[var(--color-surface-bg)]',
            action === 'Refund' || action === 'Cancel' || action === 'Reject'
              ? 'text-red-600'
              : 'text-[var(--color-text-primary)]'
          )}
        >
          {action}
        </button>
      ))}
    </div>
  </div>
);

const SearchFilterBar: React.FC<{ compact?: boolean }> = ({ compact }) => (
  <div className="flex flex-col gap-3 rounded-[1.5rem] border border-[var(--color-border-soft)] bg-white p-3 shadow-soft xl:flex-row xl:items-center">
    <div className="relative flex-1">
      <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
      <Input
        className="!h-10 rounded-xl border-[var(--color-border-strong)] !pl-10"
        placeholder="Search records..."
      />
    </div>
    <div className="grid gap-2 sm:grid-cols-3 xl:flex">
      <Select
        className="!h-10 rounded-xl border-[var(--color-border-strong)]"
        value=""
        onChange={() => undefined}
        placeholder="Status"
        options={[
          { value: 'paid', label: 'Paid' },
          { value: 'pending', label: 'Pending' },
          { value: 'partial', label: 'Partial' },
          { value: 'refunded', label: 'Refunded' },
        ]}
      />
      <Input className="!h-10 rounded-xl border-[var(--color-border-strong)]" type="date" />
      <Button variant="secondary" className="h-10 rounded-xl" icon={<Filter className="h-4 w-4" />}>
        {compact ? 'Filters' : 'More Filters'}
      </Button>
    </div>
  </div>
);

function DataTable<T extends object>({
  columns,
  data,
  actions,
}: {
  columns: Column<T>[];
  data: T[];
  actions: string[];
}) {
  return (
    <div className="overflow-hidden rounded-[1.5rem] border border-[var(--color-border-soft)] bg-white shadow-soft">
      <div className="custom-scrollbar overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead className="sticky top-0 z-10 bg-[var(--color-surface-bg)] text-xs uppercase tracking-wide text-gray-500">
            <tr>
              {columns.map((column) => (
                <th
                  key={String(column.key)}
                  className={cn(
                    'whitespace-nowrap px-4 py-3 font-bold',
                    column.align === 'right' ? 'text-right' : column.align === 'center' ? 'text-center' : 'text-left',
                    column.className
                  )}
                >
                  {column.header}
                </th>
              ))}
              <th className="sticky right-0 bg-[var(--color-surface-bg)] px-4 py-3 text-right font-bold">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--color-border-soft)]">
            {data.map((row, rowIndex) => (
              <tr key={rowIndex} className="transition hover:bg-[var(--color-surface-bg)]/70">
                {columns.map((column) => (
                  <td
                    key={String(column.key)}
                    className={cn(
                      'whitespace-nowrap px-4 py-4 text-[var(--color-text-secondary)]',
                      column.align === 'right' ? 'text-right' : column.align === 'center' ? 'text-center' : 'text-left',
                      column.className
                    )}
                  >
                    {column.render ? column.render(row) : String(row[column.key as keyof T] ?? '-')}
                  </td>
                ))}
                <td className="sticky right-0 bg-white px-4 py-4">
                  <ActionDropdown actions={actions} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <TablePagination />
    </div>
  );
}

const TablePagination: React.FC = () => (
  <div className="flex flex-col gap-3 border-t border-[var(--color-border-soft)] px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
    <p className="text-xs text-gray-500">Showing 1–4 of 42 records</p>
    <div className="flex items-center gap-1">
      <button className="rounded-lg p-2 text-gray-400 hover:bg-gray-100">
        <ChevronLeft className="h-4 w-4" />
      </button>
      {[1, 2, 3].map((page) => (
        <button
          key={page}
          className={cn(
            'flex h-8 w-8 items-center justify-center rounded-lg text-xs font-bold transition',
            page === 1 ? 'bg-[var(--color-brand-gold)] text-white' : 'text-gray-500 hover:bg-gray-100'
          )}
        >
          {page}
        </button>
      ))}
      <button className="rounded-lg p-2 text-gray-400 hover:bg-gray-100">
        <ChevronRight className="h-4 w-4" />
      </button>
    </div>
  </div>
);

const AmountCard: React.FC<{ label: string; value: string; icon: React.ElementType; tone: string }> = ({
  label,
  value,
  icon: Icon,
  tone,
}) => (
  <div className="rounded-2xl border border-[var(--color-border-soft)] bg-white p-4 shadow-soft">
    <div className="flex items-center justify-between">
      <span className="text-sm font-semibold text-gray-500">{label}</span>
      <span className={cn('rounded-xl p-2', tone)}>
        <Icon className="h-4 w-4" />
      </span>
    </div>
    <p className="mt-3 text-2xl font-bold text-[var(--color-text-primary)]">{value}</p>
  </div>
);

const EmptyState: React.FC<{ title: string; description: string }> = ({ title, description }) => (
  <div className="rounded-[1.5rem] border border-dashed border-[var(--color-border-strong)] bg-white p-8 text-center shadow-soft">
    <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-[var(--color-brand-gold-light)]/20 text-[var(--color-brand-gold-dark)]">
      <FileText className="h-5 w-5" />
    </div>
    <h3 className="mt-4 text-base font-bold text-[var(--color-text-primary)]">{title}</h3>
    <p className="mx-auto mt-1 max-w-md text-sm text-[var(--color-text-secondary)]">{description}</p>
  </div>
);

const UploadBox: React.FC = () => (
  <div className="rounded-2xl border border-dashed border-[var(--color-border-strong)] bg-[var(--color-surface-bg)] p-6 text-center">
    <UploadCloud className="mx-auto h-8 w-8 text-[var(--color-brand-gold-dark)]" />
    <p className="mt-3 text-sm font-semibold text-[var(--color-text-primary)]">Upload receipt</p>
    <p className="mt-1 text-xs text-gray-500">PDF, PNG, JPG up to 5 MB</p>
  </div>
);

const SideDrawer: React.FC<{ open: boolean; onClose: () => void }> = ({ open, onClose }) => {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[70] bg-black/30 backdrop-blur-sm">
      <div className="absolute right-0 top-0 h-full w-full max-w-xl overflow-y-auto bg-white p-5 shadow-2xl">
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-xl font-bold text-[var(--color-text-primary)]">Create quick bill</h2>
            <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
              Fast counter billing with split payment support.
            </p>
          </div>
          <button onClick={onClose} className="rounded-xl p-2 text-gray-400 hover:bg-gray-100">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="mt-6 space-y-4">
          <FormInput label="Customer" placeholder="Search or add customer" />
          <div className="grid gap-4 sm:grid-cols-2">
            <FormInput label="Appointment" placeholder="Select appointment" />
            <FormInput label="Staff" placeholder="Assign staff" />
          </div>
          <FormInput label="Services" placeholder="Hair spa, manicure..." />
          <div className="grid gap-4 sm:grid-cols-2">
            <FormInput label="Amount" placeholder="₹0.00" />
            <FormInput label="Payment Method" placeholder="Cash / UPI / Card" />
          </div>
          <div className="rounded-2xl bg-[var(--color-surface-bg)] p-4">
            <p className="text-sm font-bold text-[var(--color-text-primary)]">Split payment</p>
            <div className="mt-3 grid gap-3 sm:grid-cols-3">
              <FormInput label="Cash" placeholder="₹0" />
              <FormInput label="UPI" placeholder="₹0" />
              <FormInput label="Card" placeholder="₹0" />
            </div>
          </div>
          <Button fullWidth className="h-11 rounded-2xl" icon={<Send className="h-4 w-4" />}>
            Save & print bill
          </Button>
        </div>
      </div>
    </div>
  );
};

const FormInput: React.FC<{ label: string; placeholder: string; type?: string }> = ({ label, placeholder, type }) => (
  <label className="block">
    <span className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-gray-500">{label}</span>
    <Input
      type={type}
      className="!h-11 rounded-2xl border-[var(--color-border-strong)] bg-white"
      placeholder={placeholder}
    />
  </label>
);

const paymentStatusTone: Record<string, StatusTone> = {
  PAID: 'paid',
  PENDING: 'pending',
  PARTIALLY_PAID: 'partial',
};

const paymentStatusLabel: Record<string, string> = {
  PAID: 'Paid',
  PENDING: 'Pending',
  PARTIALLY_PAID: 'Partially Paid',
};

const whatsappStatusTone: Record<string, StatusTone> = {
  sent: 'approved',
  failed: 'danger',
  pending: 'pending',
};

const whatsappStatusLabel: Record<string, string> = {
  sent: 'Sent',
  failed: 'Failed',
  pending: 'Pending',
};

const BillsSkeletonRow: React.FC = () => (
  <tr>
    {Array.from({ length: 12 }).map((_, i) => (
      <td key={i} className="px-4 py-4">
        <div className="h-4 animate-pulse rounded bg-gray-200" />
      </td>
    ))}
  </tr>
);

const getDatePresetRange = (preset: DatePreset): { startDate?: string; endDate?: string } => {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  if (preset === 'today') {
    const iso = toDateInputValue(today);
    return { startDate: iso, endDate: iso };
  }

  if (preset === 'yesterday') {
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    const iso = toDateInputValue(yesterday);
    return { startDate: iso, endDate: iso };
  }

  if (preset === 'this_week') {
    const weekStart = new Date(today);
    const day = weekStart.getDay();
    const diff = day === 0 ? -6 : 1 - day;
    weekStart.setDate(weekStart.getDate() + diff);
    return { startDate: toDateInputValue(weekStart), endDate: toDateInputValue(today) };
  }

  if (preset === 'this_month') {
    const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
    return { startDate: toDateInputValue(monthStart), endDate: toDateInputValue(today) };
  }

  if (preset === 'last_month') {
    const firstDayLastMonth = new Date(today.getFullYear(), today.getMonth() - 1, 1);
    const lastDayLastMonth = new Date(today.getFullYear(), today.getMonth(), 0);
    return {
      startDate: toDateInputValue(firstDayLastMonth),
      endDate: toDateInputValue(lastDayLastMonth),
    };
  }

  return {};
};

const BillsSection: React.FC<{ salonId: string; activeTab: string }> = ({ salonId, activeTab }) => {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [datePreset, setDatePreset] = useState<DatePreset>('this_month');
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('');
  const [billStatus, setBillStatus] = useState('');
  const [staffName, setStaffName] = useState('');
  const [branchId, setBranchId] = useState(salonId);
  const [printingBillId, setPrintingBillId] = useState<string | null>(null);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const LIMIT = 20;
  const [fetchBillDetail] = useLazyGetBillDetailQuery();

  const paymentStatusFilter =
    activeTab === 'paid' ? 'PAID'
    : activeTab === 'pending' ? 'PENDING'
    : activeTab === 'partially_paid' ? 'PARTIALLY_PAID'
    : undefined;

  const selectedDateRange =
    datePreset === 'custom'
      ? {
          startDate: customStartDate || undefined,
          endDate: customEndDate || undefined,
        }
      : getDatePresetRange(datePreset);

  const { data, isLoading, isFetching, isError } = useListBillsQuery(
    {
      salon_id: branchId || salonId,
      branch_id: branchId || undefined,
      page,
      limit: LIMIT,
      payment_status: paymentStatusFilter,
      bill_status: billStatus || undefined,
      payment_method: paymentMethod || undefined,
      staff_name: staffName || undefined,
      startDate: selectedDateRange.startDate,
      endDate: selectedDateRange.endDate,
      search: debouncedSearch || undefined,
    },
    { skip: !(branchId || salonId) }
  );

  const items: BillListItem[] = data?.data?.items ?? [];
  const total = data?.data?.total ?? 0;
  const totalPages = data?.data?.pages ?? 1;
  const startItem = total === 0 ? 0 : (page - 1) * LIMIT + 1;
  const endItem = Math.min(page * LIMIT, total);

  const totalRevenue = items.reduce((s, b) => s + b.total_amount, 0);
  const totalPaid = items.reduce((s, b) => s + b.paid_amount, 0);
  const totalPending = items.reduce((s, b) => s + b.remaining_amount, 0);
  const paidCount = items.filter((b) => b.payment_status === 'PAID').length;

  const handleSearchChange = (val: string) => {
    setSearch(val);
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => {
      setDebouncedSearch(val);
      setPage(1);
    }, 400);
  };

  const handlePresetChange = (preset: DatePreset) => {
    setDatePreset(preset);
    setPage(1);
  };

  const handlePrint = async (billId: string) => {
    setPrintingBillId(billId);
    try {
      const res = await fetchBillDetail(billId).unwrap();
      if (res?.data) {
        downloadInvoicePDF(res.data);
      } else {
        showToast('error', 'No printable data found for this bill');
      }
    } catch {
      showToast('error', 'Failed to fetch bill details for printing');
    } finally {
      setPrintingBillId(null);
    }
  };

  React.useEffect(() => {
    setBranchId(salonId);
  }, [salonId]);

  return (
    <SectionStack>
      {/* Summary cards */}
      <SummaryCards
        items={[
          {
            label: 'Total Bills',
            value: String(total),
            helper: `${paidCount} paid this page`,
            tone: 'bg-blue-50 text-blue-700',
            icon: ReceiptText,
          },
          {
            label: 'Total Amount',
            value: formatCurrency(totalRevenue),
            helper: 'Current page',
            tone: 'bg-emerald-50 text-emerald-700',
            icon: IndianRupee,
          },
          {
            label: 'Collected',
            value: formatCurrency(totalPaid),
            helper: 'Paid amount',
            tone: 'bg-teal-50 text-teal-700',
            icon: CheckCircle2,
          },
          {
            label: 'Pending',
            value: formatCurrency(totalPending),
            helper: 'Remaining balance',
            tone: 'bg-amber-50 text-amber-700',
            icon: AlertCircle,
          },
        ]}
      />

      {/* Filters */}
      <div className="space-y-3 rounded-[1.5rem] border border-[var(--color-border-soft)] bg-white p-3 shadow-soft">
        <div className="flex flex-wrap gap-2">
          {[
            { key: 'today', label: 'Today' },
            { key: 'yesterday', label: 'Yesterday' },
            { key: 'this_week', label: 'This Week' },
            { key: 'this_month', label: 'This Month' },
            { key: 'last_month', label: 'Last Month' },
            { key: 'custom', label: 'Custom Range' },
          ].map((preset) => (
            <button
              key={preset.key}
              type="button"
              onClick={() => handlePresetChange(preset.key as DatePreset)}
              className={cn(
                'rounded-xl px-3 py-2 text-xs font-semibold transition',
                datePreset === preset.key
                  ? 'bg-[var(--color-brand-gold)] text-white'
                  : 'bg-[var(--color-surface-bg)] text-gray-600 hover:text-[var(--color-text-primary)]'
              )}
            >
              {preset.label}
            </button>
          ))}
        </div>
        <div className="grid gap-2 xl:grid-cols-6">
          <div className="relative xl:col-span-2">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <Input
              className="!h-10 rounded-xl border-[var(--color-border-strong)] !pl-10"
              placeholder="Search invoice, customer, phone..."
              value={search}
              onChange={(e) => handleSearchChange(e.target.value)}
            />
          </div>
          <Select
            className="!h-10 rounded-xl border-[var(--color-border-strong)]"
            value={paymentMethod}
            onChange={(e) => {
              setPaymentMethod(e.target.value);
              setPage(1);
            }}
            options={[
              { value: '', label: 'Payment Mode' },
              { value: 'CASH', label: 'Cash' },
              { value: 'UPI', label: 'UPI' },
              { value: 'CARD', label: 'Card' },
              { value: 'SPLIT', label: 'Split' },
            ]}
          />
          <Select
            className="!h-10 rounded-xl border-[var(--color-border-strong)]"
            value={billStatus}
            onChange={(e) => {
              setBillStatus(e.target.value);
              setPage(1);
            }}
            options={[
              { value: '', label: 'Bill Status' },
              { value: 'FINALIZED', label: 'Finalized' },
              { value: 'DRAFT', label: 'Draft' },
              { value: 'VOIDED', label: 'Voided' },
            ]}
          />
          <Input
            className="!h-10 rounded-xl border-[var(--color-border-strong)]"
            placeholder="Staff name"
            value={staffName}
            onChange={(e) => {
              setStaffName(e.target.value);
              setPage(1);
            }}
          />
          <Input
            className="!h-10 rounded-xl border-[var(--color-border-strong)]"
            placeholder="Branch ID"
            value={branchId}
            onChange={(e) => {
              setBranchId(e.target.value);
              setPage(1);
            }}
          />
        </div>
        {datePreset === 'custom' && (
          <div className="grid gap-2 sm:grid-cols-2 xl:max-w-[420px]">
            <Input
              type="date"
              className="!h-10 rounded-xl border-[var(--color-border-strong)]"
              value={customStartDate}
              onChange={(e) => {
                setCustomStartDate(e.target.value);
                setPage(1);
              }}
            />
            <Input
              type="date"
              className="!h-10 rounded-xl border-[var(--color-border-strong)]"
              value={customEndDate}
              onChange={(e) => {
                setCustomEndDate(e.target.value);
                setPage(1);
              }}
            />
          </div>
        )}
        <div className="flex items-center justify-between text-xs text-gray-500">
          <span>
            Range:{' '}
            {selectedDateRange.startDate ? formatDateDMY(selectedDateRange.startDate) : 'Any'} -{' '}
            {selectedDateRange.endDate ? formatDateDMY(selectedDateRange.endDate) : 'Any'}
          </span>
          {isFetching && !isLoading && <span>Refreshing...</span>}
        </div>
      </div>

      {/* Bills table */}
      <div className="overflow-hidden rounded-[1.5rem] border border-[var(--color-border-soft)] bg-white shadow-soft">
        <div className="custom-scrollbar overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="sticky top-0 z-10 bg-[var(--color-surface-bg)] text-xs uppercase tracking-wide text-gray-500">
              <tr>
                <th className="whitespace-nowrap px-4 py-3 text-left font-bold">Invoice #</th>
                <th className="whitespace-nowrap px-4 py-3 text-left font-bold">Customer</th>
                <th className="whitespace-nowrap px-4 py-3 text-left font-bold">Services</th>
                <th className="whitespace-nowrap px-4 py-3 text-left font-bold">Staff</th>
                <th className="whitespace-nowrap px-4 py-3 text-left font-bold">Method</th>
                <th className="whitespace-nowrap px-4 py-3 text-left font-bold">Status</th>
                <th className="whitespace-nowrap px-4 py-3 text-left font-bold">WhatsApp</th>
                <th className="whitespace-nowrap px-4 py-3 text-right font-bold">Total</th>
                <th className="whitespace-nowrap px-4 py-3 text-right font-bold">Paid</th>
                <th className="whitespace-nowrap px-4 py-3 text-right font-bold">Remaining</th>
                <th className="whitespace-nowrap px-4 py-3 text-left font-bold">Date</th>
                <th className="sticky right-0 bg-[var(--color-surface-bg)] px-4 py-3 text-right font-bold">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--color-border-soft)]">
              {isLoading ? (
                Array.from({ length: 6 }).map((_, i) => <BillsSkeletonRow key={i} />)
              ) : isError ? (
                <tr>
                  <td colSpan={12} className="px-4 py-12 text-center text-sm text-red-500">
                    Failed to load bills. Please try again.
                  </td>
                </tr>
              ) : !salonId ? (
                <tr>
                  <td colSpan={12} className="px-4 py-12 text-center text-sm text-amber-700">
                    Select a salon to view bills.
                  </td>
                </tr>
              ) : items.length === 0 ? (
                <tr>
                  <td colSpan={12} className="px-4 py-16 text-center">
                    <div className="flex flex-col items-center gap-2">
                      <ReceiptText className="h-10 w-10 text-gray-300" />
                      <p className="text-sm font-medium text-gray-500">No bills found</p>
                      <p className="text-xs text-gray-400">
                        Bills are auto-generated when appointments are submitted.
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                items.map((bill) => {
                  const statusTone = paymentStatusTone[bill.payment_status] ?? 'neutral';
                  const whatsappStatus = bill.whatsapp_status || 'pending';
                  const whatsappTone = whatsappStatusTone[whatsappStatus] ?? 'neutral';
                  return (
                    <tr
                      key={bill.id}
                      className="transition hover:bg-[var(--color-surface-bg)]/70"
                    >
                      <td className="whitespace-nowrap px-4 py-4">
                        <span className="font-mono text-xs font-bold text-gray-900">
                          {bill.invoice_number}
                        </span>
                      </td>
                      <td className="whitespace-nowrap px-4 py-4">
                        <CustomerCell
                          name={bill.customer_name || 'Unknown'}
                          subtitle={bill.customer_phone || undefined}
                        />
                      </td>
                      <td className="max-w-[160px] px-4 py-4 text-gray-600">
                        <span className="line-clamp-2 text-xs">{bill.items_summary || '-'}</span>
                      </td>
                      <td className="whitespace-nowrap px-4 py-4 text-xs text-gray-600">
                        {bill.staff_summary || '-'}
                      </td>
                      <td className="whitespace-nowrap px-4 py-4 text-xs text-gray-600">
                        {bill.payment_method || '-'}
                      </td>
                      <td className="whitespace-nowrap px-4 py-4">
                        <StatusBadge
                          status={statusTone}
                          label={paymentStatusLabel[bill.payment_status] ?? bill.payment_status}
                        />
                      </td>
                      <td className="whitespace-nowrap px-4 py-4">
                        <StatusBadge
                          status={whatsappTone}
                          label={whatsappStatusLabel[whatsappStatus] ?? whatsappStatus}
                        />
                      </td>
                      <td className="whitespace-nowrap px-4 py-4 text-right font-bold text-gray-900">
                        {formatCurrency(bill.total_amount)}
                      </td>
                      <td className="whitespace-nowrap px-4 py-4 text-right font-semibold text-emerald-700">
                        {formatCurrency(bill.paid_amount)}
                      </td>
                      <td className="whitespace-nowrap px-4 py-4 text-right font-semibold text-amber-700">
                        {bill.remaining_amount > 0
                          ? formatCurrency(bill.remaining_amount)
                          : '-'}
                      </td>
                      <td className="whitespace-nowrap px-4 py-4 text-xs text-gray-500">
                        {formatDateDMY(bill.created_at)}
                      </td>
                      <td className="sticky right-0 bg-white px-4 py-4">
                        <button
                          type="button"
                          onClick={() => handlePrint(bill.id)}
                          title="Download PDF invoice"
                          disabled={printingBillId === bill.id}
                          className="inline-flex items-center gap-1.5 rounded-xl border border-[var(--color-border-strong)] bg-white px-3 py-1.5 text-xs font-semibold text-gray-700 shadow-sm transition hover:border-[var(--color-brand-gold)] hover:text-[var(--color-brand-gold-dark)]"
                        >
                          <Printer className="h-3.5 w-3.5" />
                          {printingBillId === bill.id ? 'Printing...' : 'Print'}
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {!isLoading && total > 0 && (
          <div className="flex flex-col gap-3 border-t border-[var(--color-border-soft)] px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-xs text-gray-500">
              Showing{' '}
              <span className="font-medium">
                {startItem}–{endItem}
              </span>{' '}
              of <span className="font-medium">{total}</span> bills
            </p>
            <div className="flex items-center gap-1">
              <button
                className="rounded-lg p-2 text-gray-400 hover:bg-gray-100 disabled:opacity-40"
                onClick={() => setPage((p) => p - 1)}
                disabled={page <= 1 || isFetching}
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
                const pn =
                  totalPages <= 5
                    ? i + 1
                    : page <= 3
                    ? i + 1
                    : page >= totalPages - 2
                    ? totalPages - 4 + i
                    : page - 2 + i;
                if (pn < 1 || pn > totalPages) return null;
                return (
                  <button
                    key={pn}
                    onClick={() => setPage(pn)}
                    disabled={isFetching}
                    className={cn(
                      'flex h-8 w-8 items-center justify-center rounded-lg text-xs font-bold transition',
                      pn === page
                        ? 'bg-[var(--color-brand-gold)] text-white'
                        : 'text-gray-500 hover:bg-gray-100'
                    )}
                  >
                    {pn}
                  </button>
                );
              })}
              <button
                className="rounded-lg p-2 text-gray-400 hover:bg-gray-100 disabled:opacity-40"
                onClick={() => setPage((p) => p + 1)}
                disabled={page >= totalPages || isFetching}
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    </SectionStack>
  );
};

const PurchasingSection: React.FC<{ activeTab: string }> = ({ activeTab }) => {
  const columns: Column<PurchaseRow>[] = [
    { key: 'id', header: 'Purchase ID', render: (row) => <span className="font-mono text-xs font-bold text-gray-900">{row.id}</span> },
    { key: 'vendor', header: 'Vendor', render: (row) => <CustomerCell name={row.vendor} subtitle="Verified supplier" /> },
    { key: 'products', header: 'Products' },
    { key: 'qty', header: 'Quantity' },
    { key: 'amount', header: 'Amount', align: 'right', render: (row) => <b className="text-gray-900">{row.amount}</b> },
    { key: 'status', header: 'Status', render: (row) => <StatusBadge status={row.status} /> },
    { key: 'due', header: 'Due Date' },
  ];

  if (activeTab === 'vendors') {
    return (
      <div className="grid gap-4 lg:grid-cols-3">
        {purchases.map((purchase) => (
          <div key={purchase.id} className="rounded-[1.5rem] border border-[var(--color-border-soft)] bg-white p-5 shadow-soft">
            <div className="flex items-center justify-between">
              <Building2 className="h-8 w-8 text-[var(--color-brand-gold-dark)]" />
              <StatusBadge status={purchase.status} />
            </div>
            <h3 className="mt-4 text-lg font-bold text-[var(--color-text-primary)]">{purchase.vendor}</h3>
            <p className="mt-1 text-sm text-gray-500">+91 98765 43210 · billing@vendor.com</p>
            <div className="mt-4 rounded-2xl bg-[var(--color-surface-bg)] p-3">
              <p className="text-xs text-gray-500">Due amount</p>
              <p className="text-xl font-bold text-gray-900">{purchase.status === 'paid' ? '₹0' : purchase.amount}</p>
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <SectionStack>
      <SearchFilterBar />
      <DataTable
        columns={columns}
        data={purchases}
        actions={activeTab === 'history' ? ['Download Invoice', 'View'] : ['View', 'Payment', 'Download Invoice']}
      />
    </SectionStack>
  );
};

const PaymentsSection: React.FC = () => {
  const columns: Column<PaymentRow>[] = [
    { key: 'id', header: 'Payment ID', render: (row) => <span className="font-mono text-xs font-bold text-gray-900">{row.id}</span> },
    { key: 'invoice', header: 'Invoice' },
    { key: 'customer', header: 'Customer', render: (row) => <CustomerCell name={row.customer} /> },
    { key: 'method', header: 'Method' },
    { key: 'amount', header: 'Amount', align: 'right', render: (row) => <b className="text-gray-900">{row.amount}</b> },
    { key: 'status', header: 'Status', render: (row) => <StatusBadge status={row.status} /> },
    { key: 'date', header: 'Date' },
  ];

  return (
    <SectionStack>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <AmountCard label="Cash" value={formatCurrency(284000)} icon={Banknote} tone="bg-emerald-50 text-emerald-700" />
        <AmountCard label="UPI" value={formatCurrency(542000)} icon={Wallet} tone="bg-blue-50 text-blue-700" />
        <AmountCard label="Card" value={formatCurrency(318000)} icon={CreditCard} tone="bg-violet-50 text-violet-700" />
        <AmountCard label="Wallet" value={formatCurrency(74800)} icon={IndianRupee} tone="bg-amber-50 text-amber-700" />
      </div>
      <div className="grid gap-4 xl:grid-cols-[1fr_340px]">
        <DataTable columns={columns} data={payments} actions={['Payment Detail', 'Collect Payment', 'Print']} />
        <div className="rounded-[1.5rem] border border-[var(--color-border-soft)] bg-white p-5 shadow-soft">
          <h3 className="font-bold text-[var(--color-text-primary)]">Split payment</h3>
          <p className="mt-1 text-sm text-gray-500">Collect mixed tender payments without leaving the desk.</p>
          <div className="mt-4 space-y-3">
            <FormInput label="Cash" placeholder="₹2,000" />
            <FormInput label="UPI" placeholder="₹3,000" />
            <FormInput label="Card" placeholder="₹4,400" />
            <Button fullWidth className="rounded-2xl" icon={<CheckCircle2 className="h-4 w-4" />}>
              Collect Payment
            </Button>
          </div>
        </div>
      </div>
    </SectionStack>
  );
};

const ReportsSection: React.FC<{ activeTab: string }> = ({ activeTab }) => (
  <SectionStack>
    <SummaryCards
      items={[
        { label: 'Revenue', value: formatCurrency(1842000), helper: 'Sales reports', tone: 'bg-emerald-50 text-emerald-700', icon: IndianRupee },
        { label: 'Expenses', value: formatCurrency(618000), helper: 'Expense reports', tone: 'bg-red-50 text-red-700', icon: FileText },
        { label: 'Payroll', value: formatCurrency(920000), helper: 'Salary + incentives', tone: 'bg-blue-50 text-blue-700', icon: Users },
        { label: 'Net Profit', value: formatCurrency(304000), helper: 'Profit reports', tone: 'bg-violet-50 text-violet-700', icon: BarChart3 },
      ]}
    />
    <div className="grid gap-5 xl:grid-cols-[1.4fr_1fr]">
      <div className="rounded-[1.5rem] border border-[var(--color-border-soft)] bg-white p-5 shadow-soft">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-bold text-[var(--color-text-primary)]">
              {activeTab === 'profit' ? 'Revenue vs expenses' : 'Monthly performance'}
            </h3>
            <p className="text-sm text-gray-500">Clean visual reporting for salon owners.</p>
          </div>
          <Button variant="secondary" size="sm" className="rounded-xl" icon={<Download className="h-4 w-4" />}>
            Export
          </Button>
        </div>
        <div className="mt-6 flex h-64 items-end gap-3 rounded-2xl bg-[var(--color-surface-bg)] p-4">
          {[42, 58, 46, 74, 66, 88, 72, 94].map((height, index) => (
            <div key={index} className="flex flex-1 flex-col justify-end gap-2">
              <div
                className="rounded-t-2xl bg-gradient-to-t from-[var(--color-brand-gold)] to-[var(--color-brand-gold-light)]"
                style={{ height: `${height}%` }}
              />
              <span className="text-center text-[10px] font-semibold text-gray-400">
                {['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug'][index]}
              </span>
            </div>
          ))}
        </div>
      </div>
      <div className="space-y-4">
        {(activeTab === 'sales' ? ['Top services', 'Top staff', 'Retail product sales'] : activeTab === 'expenses' ? ['Category spend', 'Monthly comparison', 'Approval delays'] : activeTab === 'payroll' ? ['Salary totals', 'Incentive totals', 'Deductions'] : ['Gross margin', 'Net profit', 'Cash flow']).map((item, index) => (
          <div key={item} className="rounded-[1.5rem] border border-[var(--color-border-soft)] bg-white p-4 shadow-soft">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-bold text-[var(--color-text-primary)]">{item}</p>
                <p className="text-sm text-gray-500">{index + 1} insight ready for review</p>
              </div>
              <span className="rounded-full bg-emerald-50 px-2 py-1 text-xs font-bold text-emerald-700">
                +{8 + index * 3}%
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  </SectionStack>
);

const CustomerCell: React.FC<{ name: string; subtitle?: string }> = ({ name, subtitle }) => (
  <div className="flex items-center gap-3">
    <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-[var(--color-brand-gold-light)] to-[var(--color-brand-gold)] text-xs font-bold text-white">
      {name
        .split(' ')
        .map((part) => part[0])
        .slice(0, 2)
        .join('')}
    </div>
    <div>
      <p className="font-bold text-[var(--color-text-primary)]">{name}</p>
      {subtitle && <p className="text-xs text-gray-500">{subtitle}</p>}
    </div>
  </div>
);

const SectionStack: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="space-y-5">{children}</div>
);

const BillingFinance: React.FC = () => {
  const { financeSection, orgId } = useParams<{ financeSection?: string; orgId?: string }>();
  const storedOrgId = useAppSelector((state) => state.auth.orgId);
  const selectedSalonId = useAppSelector((state) => state.auth.selectedSalonId);
  const role = useAppSelector((state) => state.auth.user?.role);
  const isSuperAdmin = role === 'super_admin';
  const salonId = (orgId ?? (isSuperAdmin ? selectedSalonId : storedOrgId) ?? '').trim();

  const activeSection: SectionKey = isSectionKey(financeSection) ? financeSection : 'bills';
  const [activeTabs, setActiveTabs] = useState<Record<SectionKey, string>>({
    bills: 'all',
    payroll: 'structure',
    expenses: 'all',
  });
  const [drawerOpen, setDrawerOpen] = useState(false);

  const currentSection = sectionItems.find((item) => item.key === activeSection) ?? sectionItems[0];
  const tabs = tabsBySection[activeSection];
  const activeTab = activeTabs[activeSection];

  const content = useMemo(() => {
    switch (activeSection) {
      case 'bills':
        return <BillsSection salonId={salonId} activeTab={activeTab} />;
      case 'payroll':
        return <PayrollSection activeTab={activeTab} salonId={salonId} />;
      case 'expenses':
        return <ExpensesSection activeTab={activeTab} salonId={salonId} />;
    
     
      default:
        return null;
    }
  }, [activeSection, activeTab, salonId]);

  return (
    <div className="min-h-screen bg-[var(--color-surface-bg)] p-4 md:p-6 xl:p-8">
      <div className="mx-auto max-w-[1680px] space-y-5">
        <PageHeader
          section={currentSection.label}
          subtitle={currentSection.description}
          onOpenDrawer={() => setDrawerOpen(true)}
        />

        <main className="min-w-0 space-y-5">
          <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
            <TabNavigation
              tabs={tabs}
              value={activeTab}
              onChange={(value) => setActiveTabs((prev) => ({ ...prev, [activeSection]: value }))}
            />
          </div>
          {content}
        </main>
      </div>
      <SideDrawer open={drawerOpen} onClose={() => setDrawerOpen(false)} />
    </div>
  );
};

export default BillingFinance;
