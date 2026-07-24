import React, { useMemo, useState } from 'react';
import {
  CheckCircle2,
  Download,
  Eye,
  Pencil,
  Sparkles,
  Users,
  Wallet,
  X,
} from 'lucide-react';

import { Button, Input, Select } from '../common';
import Modal from '../common/Modal';
import ModalBody from '../common/Modal/ModalBody';
import ModalFooter from '../common/Modal/ModalFooter';
import ModalHeader from '../common/Modal/ModalHeader';
import { showToast } from '../common/Toast/toastService';
import {
  useGeneratePayrollMutation,
  useLazyGetPayrollBreakdownQuery,
  useLazyGetSalarySlipQuery,
  useListMonthlyPayrollQuery,
  useListSalaryHistoryQuery,
  useListSalaryStructureQuery,
  useMarkPayrollPaidMutation,
  useUpdateSalaryStructureMutation,
} from '../../redux/slices/payroll/payrollApi';
import {
  PayrollBreakdown,
  PayrollItem,
  SalaryStructureItem,
} from '../../redux/slices/payroll/Types';
import { cn } from '../../utils/cn';
import { formatCurrency } from '../../utils/currency';
import { getApiErrorMessage } from '../../utils/apiErrors';
import { formatDateDMY, toDateInputValue } from '../../utils/utilities';
import { downloadSalarySlipPDF } from '../../utils/salarySlipPdf';

const SALARY_TYPE_OPTIONS = [
  { value: 'monthly', label: 'Monthly' },
  { value: 'daily', label: 'Daily' },
  { value: 'weekly', label: 'Weekly' },
];

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

const ROLE_LABELS: Record<string, string> = {
  salon_manager: 'Manager',
  employee: 'Staff',
  salon_admin: 'Admin',
};

const roleLabel = (role?: string | null): string =>
  role ? ROLE_LABELS[role] ?? role.replace(/_/g, ' ') : '-';

const inr = (amount: number): string => formatCurrency(amount);

const monthLabel = (month: number): string =>
  MONTH_OPTIONS.find((m) => Number(m.value) === month)?.label ?? String(month);

const yearOptions = (): { value: string; label: string }[] => {
  const current = new Date().getFullYear();
  const years: { value: string; label: string }[] = [];
  for (let y = current + 1; y >= current - 5; y -= 1) {
    years.push({ value: String(y), label: String(y) });
  }
  return years;
};

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

const SectionStack: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="space-y-5">{children}</div>
);

const TableShell: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="overflow-hidden rounded-[1.5rem] border border-[var(--color-border-soft)] bg-white shadow-soft">
    <div className="custom-scrollbar overflow-x-auto">
      <table className="min-w-full text-sm">{children}</table>
    </div>
  </div>
);

const SkeletonRows: React.FC<{ cols: number; rows?: number }> = ({ cols, rows = 5 }) => (
  <>
    {Array.from({ length: rows }).map((_, r) => (
      <tr key={r}>
        {Array.from({ length: cols }).map((_, c) => (
          <td key={c} className="px-4 py-4">
            <div className="h-4 animate-pulse rounded bg-gray-200" />
          </td>
        ))}
      </tr>
    ))}
  </>
);

/* ------------------------------------------------------------------ */
/* Tab 1 — Salary Structure                                            */
/* ------------------------------------------------------------------ */

interface EditFormState {
  salary: string;
  salary_type: string;
  joining_date: string;
  incentive_base: boolean;
  service_incentive_percent: string;
  product_incentive_percent: string;
}

const EditSalaryModal: React.FC<{
  open: boolean;
  row: SalaryStructureItem | null;
  onClose: () => void;
}> = ({ open, row, onClose }) => {
  const [updateSalary, { isLoading }] = useUpdateSalaryStructureMutation();
  const [form, setForm] = useState<EditFormState>({
    salary: '',
    salary_type: 'monthly',
    joining_date: '',
    incentive_base: false,
    service_incentive_percent: '',
    product_incentive_percent: '',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  React.useEffect(() => {
    if (row) {
      setForm({
        salary: String(row.salary ?? ''),
        salary_type: row.salary_type || 'monthly',
        joining_date: toDateInputValue(row.joining_date),
        incentive_base: row.incentive_base,
        service_incentive_percent:
          row.service_incentive_percent != null ? String(row.service_incentive_percent) : '',
        product_incentive_percent:
          row.product_incentive_percent != null ? String(row.product_incentive_percent) : '',
      });
      setErrors({});
    }
  }, [row]);

  const set = <K extends keyof EditFormState>(key: K, value: EditFormState[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const validate = (): boolean => {
    const next: Record<string, string> = {};
    const salaryNum = Number(form.salary);
    if (form.salary === '' || !Number.isFinite(salaryNum) || salaryNum < 0) {
      next.salary = 'Enter a valid salary amount';
    }
    if (!form.salary_type) next.salary_type = 'Salary type is required';
    if (!form.joining_date) next.joining_date = 'Joining date is required';
    if (form.incentive_base) {
      const svc = Number(form.service_incentive_percent);
      const prod = Number(form.product_incentive_percent);
      if (form.service_incentive_percent === '' || !Number.isFinite(svc) || svc < 0 || svc > 100) {
        next.service_incentive_percent = 'Enter a percentage between 0 and 100';
      }
      if (form.product_incentive_percent === '' || !Number.isFinite(prod) || prod < 0 || prod > 100) {
        next.product_incentive_percent = 'Enter a percentage between 0 and 100';
      }
    }
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleSubmit = async () => {
    if (!row || !validate()) return;
    try {
      const res = await updateSalary({
        employeeId: row.employee_id,
        body: {
          salary: Number(form.salary),
          salary_type: form.salary_type,
          joining_date: form.joining_date || null,
          incentive_base: form.incentive_base,
          service_incentive_percent: form.incentive_base
            ? Number(form.service_incentive_percent)
            : null,
          product_incentive_percent: form.incentive_base
            ? Number(form.product_incentive_percent)
            : null,
        },
      }).unwrap();
      if (res.success) {
        showToast('success', res.message || 'Salary structure updated');
        onClose();
      }
    } catch (err) {
      showToast('error', getApiErrorMessage(err, 'Failed to update salary structure'));
    }
  };

  if (!open || !row) return null;

  return (
    <Modal open={open} onClose={onClose} size="lg" isShowIcon>
      <ModalHeader>
        <h2 className="text-xl font-semibold">Edit Salary Structure</h2>
        <p className="mt-0.5 text-sm text-gray-500">{row.employee_name}</p>
      </ModalHeader>
      <ModalBody className="!pt-0">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-gray-700">
              Salary<span className="ml-0.5 text-red-500">*</span>
            </label>
            <Input
              type="number"
              min={0}
              step="0.01"
              value={form.salary}
              onChange={(e) => set('salary', e.target.value)}
              placeholder="e.g. 30000"
            />
            {errors.salary && <p className="text-xs text-red-600">{errors.salary}</p>}
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-gray-700">
              Salary Type<span className="ml-0.5 text-red-500">*</span>
            </label>
            <Select
              value={form.salary_type}
              onChange={(e) => set('salary_type', e.target.value)}
              options={SALARY_TYPE_OPTIONS}
              placeholder="Select salary type"
            />
            {errors.salary_type && <p className="text-xs text-red-600">{errors.salary_type}</p>}
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-gray-700">
              Joining Date<span className="ml-0.5 text-red-500">*</span>
            </label>
            <Input
              type="date"
              value={form.joining_date}
              onChange={(e) => set('joining_date', e.target.value)}
            />
            {form.joining_date && (
              <span className="text-xs text-gray-500">{formatDateDMY(form.joining_date)}</span>
            )}
            {errors.joining_date && <p className="text-xs text-red-600">{errors.joining_date}</p>}
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-gray-700">
              Incentive Based<span className="ml-0.5 text-red-500">*</span>
            </label>
            <div className="flex h-10 items-center gap-3">
              <button
                type="button"
                role="switch"
                aria-checked={form.incentive_base}
                onClick={() => set('incentive_base', !form.incentive_base)}
                className={cn(
                  'relative inline-flex h-6 w-11 items-center rounded-full transition-colors',
                  form.incentive_base ? 'bg-[var(--color-brand-gold)]' : 'bg-gray-300'
                )}
              >
                <span
                  className={cn(
                    'inline-block h-4 w-4 transform rounded-full bg-white transition-transform',
                    form.incentive_base ? 'translate-x-6' : 'translate-x-1'
                  )}
                />
              </button>
              <span className="text-sm text-[var(--color-text-secondary)]">
                {form.incentive_base ? 'Yes' : 'No'}
              </span>
            </div>
          </div>

          {form.incentive_base && (
            <>
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-gray-700">
                  Service Incentive %<span className="ml-0.5 text-red-500">*</span>
                </label>
                <Input
                  type="number"
                  min={0}
                  max={100}
                  step="0.01"
                  value={form.service_incentive_percent}
                  onChange={(e) => set('service_incentive_percent', e.target.value)}
                  placeholder="e.g. 10"
                />
                {errors.service_incentive_percent && (
                  <p className="text-xs text-red-600">{errors.service_incentive_percent}</p>
                )}
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-gray-700">
                  Product Incentive %<span className="ml-0.5 text-red-500">*</span>
                </label>
                <Input
                  type="number"
                  min={0}
                  max={100}
                  step="0.01"
                  value={form.product_incentive_percent}
                  onChange={(e) => set('product_incentive_percent', e.target.value)}
                  placeholder="e.g. 5"
                />
                {errors.product_incentive_percent && (
                  <p className="text-xs text-red-600">{errors.product_incentive_percent}</p>
                )}
              </div>
            </>
          )}
        </div>
      </ModalBody>
      <ModalFooter className="!pt-0">
        <Button type="button" variant="secondary" onClick={onClose}>
          Cancel
        </Button>
        <Button
          type="button"
          variant="primary"
          className="!bg-[var(--color-brand-gold)] hover:!bg-[var(--color-brand-gold-dark)]"
          isLoading={isLoading}
          loadingText="Saving..."
          onClick={handleSubmit}
        >
          Save Changes
        </Button>
      </ModalFooter>
    </Modal>
  );
};

const SalaryStructureTab: React.FC = () => {
  const { data, isLoading, isFetching, isError, refetch } = useListSalaryStructureQuery();
  const [editRow, setEditRow] = useState<SalaryStructureItem | null>(null);
  const rows = data?.data ?? [];

  return (
    <SectionStack>
      <div className="flex flex-col gap-2 rounded-[1.5rem] border border-[var(--color-border-soft)] bg-white p-4 shadow-soft sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <h3 className="text-base font-bold text-[var(--color-text-primary)]">
            Employee Salary Configuration
          </h3>
          <p className="text-sm text-[var(--color-text-secondary)]">
            Manage base salary, salary type and incentive setup.
          </p>
        </div>
        {isFetching && !isLoading && <span className="text-xs text-gray-400">Refreshing...</span>}
      </div>

      <TableShell>
        <thead className="bg-[var(--color-surface-bg)] text-xs uppercase tracking-wide text-gray-500">
          <tr>
            <th className="whitespace-nowrap px-4 py-3 text-left font-bold">Employee</th>
            <th className="whitespace-nowrap px-4 py-3 text-left font-bold">Role</th>
            <th className="whitespace-nowrap px-4 py-3 text-right font-bold">Monthly Salary</th>
            <th className="whitespace-nowrap px-4 py-3 text-left font-bold">Salary Type</th>
            <th className="whitespace-nowrap px-4 py-3 text-center font-bold">Incentive Base</th>
            <th className="whitespace-nowrap px-4 py-3 text-right font-bold">Service %</th>
            <th className="whitespace-nowrap px-4 py-3 text-right font-bold">Product %</th>
            <th className="whitespace-nowrap px-4 py-3 text-left font-bold">Joining Date</th>
            <th className="whitespace-nowrap px-4 py-3 text-right font-bold">Action</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-[var(--color-border-soft)]">
          {isLoading ? (
            <SkeletonRows cols={9} />
          ) : isError ? (
            <tr>
              <td colSpan={9} className="px-4 py-12 text-center text-sm text-red-500">
                Failed to load salary structure.{' '}
                <button type="button" className="underline" onClick={() => refetch()}>
                  Retry
                </button>
              </td>
            </tr>
          ) : rows.length === 0 ? (
            <tr>
              <td colSpan={9} className="px-4 py-16 text-center">
                <div className="flex flex-col items-center gap-2">
                  <Users className="h-10 w-10 text-gray-300" />
                  <p className="text-sm font-medium text-gray-500">No employees found</p>
                  <p className="text-xs text-gray-400">
                    Add managers or staff to configure their salary.
                  </p>
                </div>
              </td>
            </tr>
          ) : (
            rows.map((row) => (
              <tr key={row.employee_id} className="transition hover:bg-[var(--color-surface-bg)]/70">
                <td className="whitespace-nowrap px-4 py-4 font-semibold text-[var(--color-text-primary)]">
                  {row.employee_name}
                </td>
                <td className="whitespace-nowrap px-4 py-4 text-gray-600">{roleLabel(row.role)}</td>
                <td className="whitespace-nowrap px-4 py-4 text-right font-bold text-gray-900">
                  {inr(row.salary)}
                </td>
                <td className="whitespace-nowrap px-4 py-4 capitalize text-gray-600">
                  {row.salary_type}
                </td>
                <td className="whitespace-nowrap px-4 py-4 text-center">
                  <span
                    className={cn(
                      'inline-flex rounded-full px-2 py-0.5 text-xs font-semibold',
                      row.incentive_base
                        ? 'bg-emerald-50 text-emerald-700'
                        : 'bg-gray-100 text-gray-500'
                    )}
                  >
                    {row.incentive_base ? 'Yes' : 'No'}
                  </span>
                </td>
                <td className="whitespace-nowrap px-4 py-4 text-right text-gray-600">
                  {row.incentive_base ? `${row.service_incentive_percent}%` : '-'}
                </td>
                <td className="whitespace-nowrap px-4 py-4 text-right text-gray-600">
                  {row.incentive_base ? `${row.product_incentive_percent}%` : '-'}
                </td>
                <td className="whitespace-nowrap px-4 py-4 text-gray-600">
                  {formatDateDMY(row.joining_date)}
                </td>
                <td className="whitespace-nowrap px-4 py-4 text-right">
                  <button
                    type="button"
                    onClick={() => setEditRow(row)}
                    title="Edit salary structure"
                    className="inline-flex items-center gap-1.5 rounded-xl border border-[var(--color-border-strong)] bg-white px-3 py-1.5 text-xs font-semibold text-gray-700 shadow-sm transition hover:border-[var(--color-brand-gold)] hover:text-[var(--color-brand-gold-dark)]"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                    Edit
                  </button>
                </td>
              </tr>
            ))
          )}
        </tbody>
      </TableShell>

      <EditSalaryModal open={!!editRow} row={editRow} onClose={() => setEditRow(null)} />
    </SectionStack>
  );
};

/* ------------------------------------------------------------------ */
/* Tab 2 — Monthly Salary                                              */
/* ------------------------------------------------------------------ */

const BreakdownModal: React.FC<{
  open: boolean;
  breakdown: PayrollBreakdown | null;
  onClose: () => void;
}> = ({ open, breakdown, onClose }) => {
  if (!open || !breakdown) return null;
  return (
    <Modal open={open} onClose={onClose} size="md" isShowIcon>
      <ModalHeader>
        <h2 className="text-xl font-semibold">Salary Breakdown</h2>
        <p className="mt-0.5 text-sm text-gray-500">
          {breakdown.employee_name} · {monthLabel(breakdown.month)} {breakdown.year}
        </p>
      </ModalHeader>
      <ModalBody>
        <table className="min-w-full text-sm">
          <thead className="bg-[var(--color-surface-bg)] text-xs uppercase tracking-wide text-gray-500">
            <tr>
              <th className="px-4 py-3 text-left font-bold">Type</th>
              <th className="px-4 py-3 text-right font-bold">Amount</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--color-border-soft)]">
            {breakdown.rows.map((r) => (
              <tr
                key={r.type}
                className={r.type === 'Final Salary' ? 'bg-[var(--color-surface-bg)]/60' : ''}
              >
                <td
                  className={cn(
                    'px-4 py-3',
                    r.type === 'Final Salary'
                      ? 'font-bold text-[var(--color-text-primary)]'
                      : 'text-gray-600'
                  )}
                >
                  {r.type}
                </td>
                <td
                  className={cn(
                    'px-4 py-3 text-right',
                    r.type === 'Final Salary'
                      ? 'font-bold text-gray-900'
                      : 'font-semibold text-gray-800'
                  )}
                >
                  {inr(r.amount)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </ModalBody>
      <ModalFooter>
        <Button type="button" variant="secondary" onClick={onClose}>
          Close
        </Button>
      </ModalFooter>
    </Modal>
  );
};

const MonthlySalaryTab: React.FC = () => {
  const now = new Date();
  const [month, setMonth] = useState<number>(now.getMonth() + 1);
  const [year, setYear] = useState<number>(now.getFullYear());

  const { data, isLoading, isFetching, isError, refetch } = useListMonthlyPayrollQuery({
    month,
    year,
  });
  const [generatePayroll, { isLoading: isGenerating }] = useGeneratePayrollMutation();
  const [markPaid, { isLoading: isMarking }] = useMarkPayrollPaidMutation();
  const [fetchBreakdown] = useLazyGetPayrollBreakdownQuery();
  const [fetchSlip] = useLazyGetSalarySlipQuery();

  const [breakdown, setBreakdown] = useState<PayrollBreakdown | null>(null);
  const [payingId, setPayingId] = useState<string | null>(null);
  const [slipId, setSlipId] = useState<string | null>(null);

  const rows: PayrollItem[] = data?.data ?? [];

  const totals = useMemo(() => {
    return rows.reduce(
      (acc, r) => {
        acc.base += r.base_salary;
        acc.incentive += r.service_incentive + r.product_incentive;
        acc.final += r.final_salary;
        if (r.payment_status === 'PAID') acc.paid += 1;
        return acc;
      },
      { base: 0, incentive: 0, final: 0, paid: 0 }
    );
  }, [rows]);

  const handleGenerate = async () => {
    try {
      const res = await generatePayroll({ month, year }).unwrap();
      if (res.success) {
        showToast('success', res.message || 'Payroll generated successfully');
      }
    } catch (err) {
      showToast('error', getApiErrorMessage(err, 'Failed to generate payroll'));
    }
  };

  const handleViewBreakdown = async (id: string) => {
    try {
      const res = await fetchBreakdown(id).unwrap();
      if (res.success) setBreakdown(res.data);
    } catch (err) {
      showToast('error', getApiErrorMessage(err, 'Failed to load breakdown'));
    }
  };

  const handleMarkPaid = async (id: string) => {
    setPayingId(id);
    try {
      const res = await markPaid(id).unwrap();
      if (res.success) showToast('success', res.message || 'Marked as paid');
    } catch (err) {
      showToast('error', getApiErrorMessage(err, 'Failed to mark as paid'));
    } finally {
      setPayingId(null);
    }
  };

  const handleDownloadSlip = async (id: string) => {
    setSlipId(id);
    try {
      const res = await fetchSlip(id).unwrap();
      if (res.success && res.data) downloadSalarySlipPDF(res.data);
    } catch (err) {
      showToast('error', getApiErrorMessage(err, 'Failed to download salary slip'));
    } finally {
      setSlipId(null);
    }
  };

  return (
    <SectionStack>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {[
          { label: 'Total Base Salary', value: inr(totals.base), tone: 'bg-blue-50 text-blue-700', icon: Users },
          { label: 'Total Incentives', value: inr(totals.incentive), tone: 'bg-emerald-50 text-emerald-700', icon: Sparkles },
          { label: 'Final Payout', value: inr(totals.final), tone: 'bg-violet-50 text-violet-700', icon: Wallet },
          { label: 'Paid', value: `${totals.paid}/${rows.length}`, tone: 'bg-teal-50 text-teal-700', icon: CheckCircle2 },
        ].map((card) => (
          <div
            key={card.label}
            className="rounded-[1.5rem] border border-[var(--color-border-soft)] bg-white p-5 shadow-soft"
          >
            <div className={cn('flex h-11 w-11 items-center justify-center rounded-2xl', card.tone)}>
              <card.icon className="h-5 w-5" />
            </div>
            <p className="mt-4 text-sm font-medium text-[var(--color-text-secondary)]">{card.label}</p>
            <h3 className="mt-1 text-2xl font-bold text-[var(--color-text-primary)]">{card.value}</h3>
          </div>
        ))}
      </div>

      <div className="flex flex-col gap-3 rounded-[1.5rem] border border-[var(--color-border-soft)] bg-white p-4 shadow-soft md:flex-row md:items-end md:justify-between">
        <div className="grid grid-cols-2 gap-3 sm:max-w-md">
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-bold uppercase tracking-wide text-gray-500">Month</label>
            <Select
              value={String(month)}
              onChange={(e) => setMonth(Number(e.target.value))}
              options={MONTH_OPTIONS}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-bold uppercase tracking-wide text-gray-500">Year</label>
            <Select
              value={String(year)}
              onChange={(e) => setYear(Number(e.target.value))}
              options={yearOptions()}
            />
          </div>
        </div>
        <Button
          className="rounded-2xl"
          icon={<Sparkles className="h-4 w-4" />}
          isLoading={isGenerating}
          loadingText="Generating..."
          onClick={handleGenerate}
        >
          Generate Payroll
        </Button>
      </div>

      <TableShell>
        <thead className="bg-[var(--color-surface-bg)] text-xs uppercase tracking-wide text-gray-500">
          <tr>
            <th className="whitespace-nowrap px-4 py-3 text-left font-bold">Employee</th>
            <th className="whitespace-nowrap px-4 py-3 text-right font-bold">Base Salary</th>
            <th className="whitespace-nowrap px-4 py-3 text-right font-bold">Service Incentive</th>
            <th className="whitespace-nowrap px-4 py-3 text-right font-bold">Product Incentive</th>
            <th className="whitespace-nowrap px-4 py-3 text-right font-bold">Final Salary</th>
            <th className="whitespace-nowrap px-4 py-3 text-center font-bold">Status</th>
            <th className="whitespace-nowrap px-4 py-3 text-right font-bold">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-[var(--color-border-soft)]">
          {isLoading || isFetching ? (
            <SkeletonRows cols={7} />
          ) : isError ? (
            <tr>
              <td colSpan={7} className="px-4 py-12 text-center text-sm text-red-500">
                Failed to load payroll.{' '}
                <button type="button" className="underline" onClick={() => refetch()}>
                  Retry
                </button>
              </td>
            </tr>
          ) : rows.length === 0 ? (
            <tr>
              <td colSpan={7} className="px-4 py-16 text-center">
                <div className="flex flex-col items-center gap-2">
                  <Wallet className="h-10 w-10 text-gray-300" />
                  <p className="text-sm font-medium text-gray-500">
                    No payroll generated for {monthLabel(month)} {year}
                  </p>
                  <p className="text-xs text-gray-400">
                    Click “Generate Payroll” to auto-calculate salaries for this period.
                  </p>
                </div>
              </td>
            </tr>
          ) : (
            rows.map((row) => (
              <tr key={row.id} className="transition hover:bg-[var(--color-surface-bg)]/70">
                <td className="whitespace-nowrap px-4 py-4">
                  <p className="font-semibold text-[var(--color-text-primary)]">
                    {row.employee_name}
                  </p>
                  <p className="text-xs text-gray-500">{roleLabel(row.employee_role)}</p>
                </td>
                <td className="whitespace-nowrap px-4 py-4 text-right text-gray-700">
                  {inr(row.base_salary)}
                </td>
                <td className="whitespace-nowrap px-4 py-4 text-right text-emerald-700">
                  {inr(row.service_incentive)}
                </td>
                <td className="whitespace-nowrap px-4 py-4 text-right text-emerald-700">
                  {inr(row.product_incentive)}
                </td>
                <td className="whitespace-nowrap px-4 py-4 text-right font-bold text-gray-900">
                  {inr(row.final_salary)}
                </td>
                <td className="whitespace-nowrap px-4 py-4 text-center">
                  <StatusPill status={row.payment_status} />
                </td>
                <td className="whitespace-nowrap px-4 py-4">
                  <div className="flex items-center justify-end gap-1.5">
                    <button
                      type="button"
                      title="View breakdown"
                      onClick={() => handleViewBreakdown(row.id)}
                      className="inline-flex items-center gap-1 rounded-lg border border-[var(--color-border-strong)] bg-white px-2.5 py-1.5 text-xs font-semibold text-gray-700 transition hover:border-[var(--color-brand-gold)] hover:text-[var(--color-brand-gold-dark)]"
                    >
                      <Eye className="h-3.5 w-3.5" />
                      Breakdown
                    </button>
                    {row.payment_status !== 'PAID' && (
                      <button
                        type="button"
                        title="Mark as paid"
                        disabled={isMarking && payingId === row.id}
                        onClick={() => handleMarkPaid(row.id)}
                        className="inline-flex items-center gap-1 rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 py-1.5 text-xs font-semibold text-emerald-700 transition hover:bg-emerald-100 disabled:opacity-50"
                      >
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        {isMarking && payingId === row.id ? 'Saving...' : 'Mark Paid'}
                      </button>
                    )}
                    <button
                      type="button"
                      title="Download salary slip"
                      disabled={slipId === row.id}
                      onClick={() => handleDownloadSlip(row.id)}
                      className="inline-flex items-center gap-1 rounded-lg border border-[var(--color-border-strong)] bg-white px-2.5 py-1.5 text-xs font-semibold text-gray-700 transition hover:border-[var(--color-brand-gold)] hover:text-[var(--color-brand-gold-dark)] disabled:opacity-50"
                    >
                      <Download className="h-3.5 w-3.5" />
                      Slip
                    </button>
                  </div>
                </td>
              </tr>
            ))
          )}
        </tbody>
      </TableShell>

      <BreakdownModal open={!!breakdown} breakdown={breakdown} onClose={() => setBreakdown(null)} />
    </SectionStack>
  );
};

/* ------------------------------------------------------------------ */
/* Tab 3 — Salary History                                              */
/* ------------------------------------------------------------------ */

const PAGE_SIZE = 10;

const SalaryHistoryTab: React.FC = () => {
  const [page, setPage] = useState(1);
  const [filterMonth, setFilterMonth] = useState('');
  const [filterYear, setFilterYear] = useState('');
  const [filterEmployee, setFilterEmployee] = useState('');
  const [filterStatus, setFilterStatus] = useState('');

  const { data: structureData } = useListSalaryStructureQuery();
  const employeeOptions = useMemo(
    () => [
      { value: '', label: 'All Employees' },
      ...(structureData?.data ?? []).map((e) => ({
        value: e.employee_id,
        label: e.employee_name,
      })),
    ],
    [structureData]
  );

  const { data, isLoading, isFetching, isError, refetch } = useListSalaryHistoryQuery({
    page,
    limit: PAGE_SIZE,
    month: filterMonth ? Number(filterMonth) : undefined,
    year: filterYear ? Number(filterYear) : undefined,
    employee_id: filterEmployee || undefined,
    payment_status: filterStatus || undefined,
  });

  const items = data?.data?.items ?? [];
  const total = data?.data?.total ?? 0;
  const totalPages = data?.data?.pages ?? 1;

  const resetPageAnd = (fn: () => void) => {
    fn();
    setPage(1);
  };

  return (
    <SectionStack>
      <div className="grid gap-3 rounded-[1.5rem] border border-[var(--color-border-soft)] bg-white p-4 shadow-soft sm:grid-cols-2 xl:grid-cols-4">
        <Select
          value={filterMonth}
          onChange={(e) => resetPageAnd(() => setFilterMonth(e.target.value))}
          options={[{ value: '', label: 'All Months' }, ...MONTH_OPTIONS]}
          placeholder="Month"
        />
        <Select
          value={filterYear}
          onChange={(e) => resetPageAnd(() => setFilterYear(e.target.value))}
          options={[{ value: '', label: 'All Years' }, ...yearOptions()]}
          placeholder="Year"
        />
        <Select
          value={filterEmployee}
          onChange={(e) => resetPageAnd(() => setFilterEmployee(e.target.value))}
          options={employeeOptions}
          placeholder="Employee"
        />
        <Select
          value={filterStatus}
          onChange={(e) => resetPageAnd(() => setFilterStatus(e.target.value))}
          options={[
            { value: '', label: 'All Status' },
            { value: 'PENDING', label: 'Pending' },
            { value: 'PAID', label: 'Paid' },
          ]}
          placeholder="Status"
        />
      </div>

      <TableShell>
        <thead className="bg-[var(--color-surface-bg)] text-xs uppercase tracking-wide text-gray-500">
          <tr>
            <th className="whitespace-nowrap px-4 py-3 text-left font-bold">Employee</th>
            <th className="whitespace-nowrap px-4 py-3 text-left font-bold">Month</th>
            <th className="whitespace-nowrap px-4 py-3 text-left font-bold">Year</th>
            <th className="whitespace-nowrap px-4 py-3 text-right font-bold">Base Salary</th>
            <th className="whitespace-nowrap px-4 py-3 text-right font-bold">Service Incentive</th>
            <th className="whitespace-nowrap px-4 py-3 text-right font-bold">Product Incentive</th>
            <th className="whitespace-nowrap px-4 py-3 text-right font-bold">Final Salary</th>
            <th className="whitespace-nowrap px-4 py-3 text-center font-bold">Status</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-[var(--color-border-soft)]">
          {isLoading || isFetching ? (
            <SkeletonRows cols={8} />
          ) : isError ? (
            <tr>
              <td colSpan={8} className="px-4 py-12 text-center text-sm text-red-500">
                Failed to load salary history.{' '}
                <button type="button" className="underline" onClick={() => refetch()}>
                  Retry
                </button>
              </td>
            </tr>
          ) : items.length === 0 ? (
            <tr>
              <td colSpan={8} className="px-4 py-16 text-center">
                <div className="flex flex-col items-center gap-2">
                  <Wallet className="h-10 w-10 text-gray-300" />
                  <p className="text-sm font-medium text-gray-500">No payroll history found</p>
                  <p className="text-xs text-gray-400">
                    Generated payroll records appear here month-wise.
                  </p>
                </div>
              </td>
            </tr>
          ) : (
            items.map((row) => (
              <tr key={row.id} className="transition hover:bg-[var(--color-surface-bg)]/70">
                <td className="whitespace-nowrap px-4 py-4">
                  <p className="font-semibold text-[var(--color-text-primary)]">
                    {row.employee_name}
                  </p>
                  <p className="text-xs text-gray-500">{roleLabel(row.employee_role)}</p>
                </td>
                <td className="whitespace-nowrap px-4 py-4 text-gray-600">{monthLabel(row.month)}</td>
                <td className="whitespace-nowrap px-4 py-4 text-gray-600">{row.year}</td>
                <td className="whitespace-nowrap px-4 py-4 text-right text-gray-700">
                  {inr(row.base_salary)}
                </td>
                <td className="whitespace-nowrap px-4 py-4 text-right text-emerald-700">
                  {inr(row.service_incentive)}
                </td>
                <td className="whitespace-nowrap px-4 py-4 text-right text-emerald-700">
                  {inr(row.product_incentive)}
                </td>
                <td className="whitespace-nowrap px-4 py-4 text-right font-bold text-gray-900">
                  {inr(row.final_salary)}
                </td>
                <td className="whitespace-nowrap px-4 py-4 text-center">
                  <StatusPill status={row.payment_status} />
                </td>
              </tr>
            ))
          )}
        </tbody>
      </TableShell>

      {!isLoading && total > 0 && (
        <div className="flex flex-col gap-3 rounded-[1.5rem] border border-[var(--color-border-soft)] bg-white px-4 py-3 shadow-soft sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-gray-500">
            Showing page <span className="font-medium">{page}</span> of{' '}
            <span className="font-medium">{totalPages}</span> · {total} records
          </p>
          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              size="sm"
              className="rounded-xl"
              disabled={page <= 1 || isFetching}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              Previous
            </Button>
            <Button
              variant="secondary"
              size="sm"
              className="rounded-xl"
              disabled={page >= totalPages || isFetching}
              onClick={() => setPage((p) => p + 1)}
            >
              Next
            </Button>
          </div>
        </div>
      )}
    </SectionStack>
  );
};

/* ------------------------------------------------------------------ */
/* Container                                                           */
/* ------------------------------------------------------------------ */

const PayrollSection: React.FC<{ activeTab: string; salonId: string }> = ({
  activeTab,
  salonId,
}) => {
  if (!salonId) {
    return (
      <div className="rounded-[1.5rem] border border-dashed border-[var(--color-border-strong)] bg-white p-10 text-center shadow-soft">
        <X className="mx-auto h-8 w-8 text-amber-500" />
        <p className="mt-3 text-sm font-semibold text-amber-700">
          Select a salon to manage payroll.
        </p>
      </div>
    );
  }

  if (activeTab === 'monthly') return <MonthlySalaryTab />;
  if (activeTab === 'history') return <SalaryHistoryTab />;
  return <SalaryStructureTab />;
};

export default PayrollSection;
