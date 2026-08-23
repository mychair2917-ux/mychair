import React, { useMemo, useState } from 'react';
import ReactECharts from 'echarts-for-react';
import {
  Award,
  Download,
  Gift,
  MoreVertical,
  Pencil,
  Plus,
  Search,
  Star,
  Trash2,
  TrendingUp,
  Upload,
  UserCheck,
  Users,
  Sparkles,
  X,
  Crown,
  AlertCircle,
  Calendar,
  ShieldCheck,
} from 'lucide-react';
import { useFormik } from 'formik';
import * as Yup from 'yup';

import '../../utils/echarts-init';
import { Button, Input, Select, showToast } from '../../components/common';
import { Modal, ModalHeader, ModalBody, ModalFooter } from '../../components/common/Modal';
import BulkClientUploadModal from '../../components/customerAnalytics/BulkClientUploadModal';
import { AddRenewMembershipModal } from './AddRenewMembershipModal';
import { cn } from '../../utils/cn';
import { formatCurrency } from '../../utils/currency';
import { formatDateDMY, toDateInputValue } from '../../utils/utilities';
import { applyApiFieldErrors, getApiErrorMessage } from '../../utils/apiErrors';
import { generateLocalClientId } from '../../utils/clientId';
import { useAppSelector } from '../../redux/hooks';
import { normalizeRole } from '../../config/rbac';
import { ROLES } from '../../constants';
import {
  useGetCustomerAnalyticsOverviewQuery,
  useGetCustomersQuery,
  useGetCustomerByIdQuery,
  useCreateCustomerMutation,
  useLazyCheckCustomerPhoneQuery,
  useLazyGenerateCustomerIdQuery,
  useUpdateCustomerMutation,
  useDeleteCustomerMutation,
  useLazyDownloadCustomerImportTemplateQuery,
  useGetRewardSettingsQuery,
  useUpdateRewardSettingsMutation,
  useCreateRewardSegmentMutation,
  useUpdateRewardSegmentMutation,
  useDeleteRewardSegmentMutation,
  useGetMembershipSettingsQuery,
} from '../../redux/slices/customerAnalytics/customerAnalyticsApi';
import type { Customer, RewardSegment } from '../../redux/slices/customerAnalytics/Types';
import { MembershipSettingsComponent } from '../../components/membership/MembershipSettingsComponent';

// ─────────────────────────── shared primitives ───────────────────────────────

type AnalyticsTab = 'overview' | 'customers' | 'membership-settings' | 'reward-settings';

const TABS: Array<{ id: AnalyticsTab; label: string }> = [
  { id: 'overview', label: 'Overview' },
  { id: 'customers', label: 'Customers' },
  { id: 'membership-settings', label: 'Membership Settings' },
  { id: 'reward-settings', label: 'Reward Settings' },
];

const canManageMembership = (role: string | undefined): boolean => {
  const normalized = normalizeRole(role);
  return (
    normalized === ROLES.SUPER_ADMIN ||
    normalized === ROLES.SALON_OWNER ||
    normalized === ROLES.SALON_ADMIN ||
    normalized === ROLES.ADMIN ||
    normalized === ROLES.SALON_MANAGER
  );
};

const MembershipBadge: React.FC<{ customer?: Customer; isMember?: boolean }> = ({
  customer,
  isMember,
}) => {
  const status =
    customer?.membership_status ||
    (customer?.is_member || isMember ? 'ACTIVE' : 'NON_MEMBER');

  if (status === 'ACTIVE') {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 dark:bg-emerald-950/50 px-2.5 py-1 text-xs font-semibold text-emerald-700 dark:text-emerald-300 border border-emerald-200/60 dark:border-emerald-800/60">
        <Crown className="w-3.5 h-3.5 text-amber-500" /> Active Member
      </span>
    );
  }
  if (status === 'EXPIRED') {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 dark:bg-amber-950/50 px-2.5 py-1 text-xs font-semibold text-amber-700 dark:text-amber-300 border border-amber-200/60 dark:border-amber-800/60">
        <AlertCircle className="w-3.5 h-3.5 text-amber-600" /> Expired Member
      </span>
    );
  }
  return (
    <span className="inline-flex rounded-full bg-slate-100 dark:bg-slate-800 px-2.5 py-1 text-xs font-medium text-slate-600 dark:text-slate-400">
      Non-member
    </span>
  );
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
  value: string | number;
  icon: React.ElementType;
  tone: string;
  sub?: string;
}> = ({ label, value, icon: Icon, tone, sub }) => (
  <SectionCard>
    <div className="flex items-start justify-between gap-3">
      <div className={cn('flex h-11 w-11 items-center justify-center rounded-2xl', tone)}>
        <Icon className="h-5 w-5" />
      </div>
    </div>
    <p className="mt-4 text-sm font-medium text-[var(--color-text-secondary)]">{label}</p>
    <h3 className="mt-1 text-2xl font-bold text-[var(--color-text-primary)]">{value}</h3>
    {sub && <p className="mt-1 text-xs text-gray-500">{sub}</p>}
  </SectionCard>
);

const TableShell: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="overflow-hidden rounded-[1.5rem] border border-[var(--color-border-soft)] bg-white shadow-soft">
    <div className="custom-scrollbar overflow-x-auto">{children}</div>
  </div>
);

const EmptyRow: React.FC<{ cols: number; message: string }> = ({ cols, message }) => (
  <tr>
    <td colSpan={cols} className="px-4 py-10 text-center text-sm text-gray-500">
      {message}
    </td>
  </tr>
);

const StatusBadge: React.FC<{ customer: Customer }> = ({ customer }) => {
  if (!customer.last_visit_at) {
    return (
      <span className="inline-flex rounded-full bg-gray-100 px-2.5 py-1 text-xs font-semibold text-gray-600">
        New
      </span>
    );
  }
  const days = (Date.now() - new Date(customer.last_visit_at).getTime()) / 86400000;
  const active = days <= 90;
  return (
    <span
      className={cn(
        'inline-flex rounded-full px-2.5 py-1 text-xs font-semibold',
        active
          ? 'bg-emerald-50 text-emerald-700'
          : 'bg-amber-50 text-amber-700'
      )}
    >
      {active ? 'Active' : 'Inactive'}
    </span>
  );
};

// ─────────────────────────── validation schemas ───────────────────────────────

const CustomerSchema = Yup.object({
  first_name: Yup.string().trim().min(1, 'Required').required('Full name is required'),
  phone: Yup.string()
    .trim()
    .min(6, 'Enter a valid mobile number or Client ID')
    .required('Mobile number or Client ID is required'),
  email: Yup.string().email('Enter a valid email').optional(),
  gender: Yup.string().optional(),
  dob: Yup.string().optional(),
  anniversary_date: Yup.string().optional(),
  address: Yup.string().optional(),
  notes: Yup.string().optional(),
});

const SegmentSchema = Yup.object({
  min_bill_amount: Yup.number()
    .min(0, 'Must be positive')
    .required('Bill amount is required'),
  reward_points: Yup.number()
    .min(0, 'Must be positive')
    .required('Reward points is required'),
});

// ─────────────────────────── Overview Tab ────────────────────────────────────

const OverviewTab: React.FC = () => {
  const { data: res, isLoading } = useGetCustomerAnalyticsOverviewQuery();
  const overview = res?.data;

  const newCustomersChart = useMemo(
    () => ({
      tooltip: { trigger: 'axis' },
      grid: { left: 24, right: 20, top: 24, bottom: 24, containLabel: true },
      xAxis: {
        type: 'category',
        data: overview?.monthly_new_customers.map((d) => d.month) ?? [],
        axisLabel: { color: '#6B7280', fontSize: 11 },
        axisLine: { lineStyle: { color: '#E5E7EB' } },
      },
      yAxis: {
        type: 'value',
        axisLabel: { color: '#6B7280' },
        splitLine: { lineStyle: { color: '#F3F4F6' } },
      },
      series: [
        {
          name: 'New Customers',
          type: 'bar',
          data: overview?.monthly_new_customers.map((d) => d.count) ?? [],
          itemStyle: { color: 'var(--color-brand-gold)', borderRadius: [6, 6, 0, 0] },
        },
      ],
    }),
    [overview]
  );

  const rewardTrendChart = useMemo(
    () => ({
      tooltip: { trigger: 'axis' },
      grid: { left: 24, right: 20, top: 24, bottom: 24, containLabel: true },
      xAxis: {
        type: 'category',
        data: overview?.reward_points_trend.map((d) => d.month) ?? [],
        axisLabel: { color: '#6B7280', fontSize: 11 },
        axisLine: { lineStyle: { color: '#E5E7EB' } },
      },
      yAxis: {
        type: 'value',
        axisLabel: { color: '#6B7280' },
        splitLine: { lineStyle: { color: '#F3F4F6' } },
      },
      series: [
        {
          name: 'Points Issued',
          type: 'line',
          smooth: true,
          data: overview?.reward_points_trend.map((d) => d.points) ?? [],
          lineStyle: { color: '#7C3AED', width: 3 },
          itemStyle: { color: '#7C3AED' },
          areaStyle: { color: 'rgba(124,58,237,0.1)' },
        },
      ],
    }),
    [overview]
  );

  if (isLoading) {
    return (
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <SectionCard key={i} className="animate-pulse">
            <div className="h-11 w-11 rounded-2xl bg-gray-100" />
            <div className="mt-4 h-3 w-24 rounded bg-gray-100" />
            <div className="mt-2 h-7 w-16 rounded bg-gray-100" />
          </SectionCard>
        ))}
      </div>
    );
  }

  const cards = [
    {
      label: 'Total Customers',
      value: overview?.total_customers ?? 0,
      icon: Users,
      tone: 'bg-blue-50 text-blue-700',
    },
    {
      label: 'Active Members',
      value: overview?.active_members ?? 0,
      icon: Crown,
      tone: 'bg-emerald-50 text-emerald-700',
      sub: 'Valid 1-yr membership',
    },
    {
      label: 'Expiring Soon',
      value: overview?.expiring_soon_members ?? 0,
      icon: AlertCircle,
      tone: 'bg-amber-50 text-amber-700',
      sub: 'Expires in next 30 days',
    },
    {
      label: 'Active Customers',
      value: overview?.active_customers ?? 0,
      icon: UserCheck,
      tone: 'bg-emerald-50 text-emerald-700',
      sub: 'Visited in last 90 days',
    },
    {
      label: 'New This Month',
      value: overview?.new_customers ?? 0,
      icon: Plus,
      tone: 'bg-amber-50 text-amber-700',
    },
    {
      label: 'Repeat Customers',
      value: overview?.repeat_customers ?? 0,
      icon: TrendingUp,
      tone: 'bg-violet-50 text-violet-700',
      sub: 'More than 1 visit',
    },
    {
      label: 'Total Points Issued',
      value: overview?.total_reward_points_issued ?? 0,
      icon: Gift,
      tone: 'bg-rose-50 text-rose-700',
    },
    {
      label: 'Top Reward Customer',
      value: overview?.top_reward_customer?.name ?? '—',
      icon: Star,
      tone: 'bg-[var(--color-brand-gold-light)]/20 text-[var(--color-brand-gold-dark)]',
      sub: overview?.top_reward_customer
        ? `${overview.top_reward_customer.points} pts`
        : undefined,
    },
  ];

  return (
    <div className="space-y-5">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {cards.map((card) => (
          <MetricCard key={card.label} {...card} />
        ))}
      </div>

      <div className="grid gap-5 xl:grid-cols-2">
        <SectionCard>
          <h3 className="text-lg font-bold text-[var(--color-text-primary)]">
            Monthly New Customers
          </h3>
          <p className="text-sm text-[var(--color-text-secondary)]">
            New signups over the last 6 months.
          </p>
          <div className="mt-4 rounded-2xl bg-[var(--color-surface-bg)] p-3">
            <ReactECharts option={newCustomersChart} style={{ height: 240 }} />
          </div>
        </SectionCard>

        <SectionCard>
          <h3 className="text-lg font-bold text-[var(--color-text-primary)]">
            Reward Points Trend
          </h3>
          <p className="text-sm text-[var(--color-text-secondary)]">
            Points issued monthly over the last 6 months.
          </p>
          <div className="mt-4 rounded-2xl bg-[var(--color-surface-bg)] p-3">
            <ReactECharts option={rewardTrendChart} style={{ height: 240 }} />
          </div>
        </SectionCard>
      </div>
    </div>
  );
};

// ─────────────────────────── Customer Form Modal ─────────────────────────────

interface CustomerFormModalProps {
  open: boolean;
  onClose: () => void;
  editCustomer?: Customer | null;
}

const CustomerFormModal: React.FC<CustomerFormModalProps> = ({
  open,
  onClose,
  editCustomer,
}) => {
  const userRole = useAppSelector((state) => state.auth.user?.role);
  const allowMembership = canManageMembership(userRole);
  const { data: memSettingsRes } = useGetMembershipSettingsQuery(undefined, { skip: !open });
  const [createCustomer, { isLoading: creating }] = useCreateCustomerMutation();
  const [updateCustomer, { isLoading: updating }] = useUpdateCustomerMutation();
  const [checkCustomerPhone] = useLazyCheckCustomerPhoneQuery();
  const [triggerGenerateId, { isLoading: isGeneratingId }] = useLazyGenerateCustomerIdQuery();
  const isEdit = !!editCustomer;

  const handleGenerateId = async () => {
    try {
      const res = await triggerGenerateId().unwrap();
      if (res.data?.client_id) {
        formik.setFieldValue('phone', res.data.client_id);
        formik.setFieldError('phone', undefined);
        return;
      }
    } catch {
      // fallback
    }
    const fallbackId = generateLocalClientId();
    formik.setFieldValue('phone', fallbackId);
    formik.setFieldError('phone', undefined);
  };

  const formik = useFormik({
    enableReinitialize: true,
    initialValues: {
      first_name: editCustomer?.first_name ?? '',
      last_name: editCustomer?.last_name ?? '',
      phone: editCustomer?.phone ?? '',
      email: editCustomer?.email ?? '',
      gender: editCustomer?.gender ?? '',
      dob: editCustomer?.dob ? toDateInputValue(editCustomer.dob) : '',
      anniversary_date: editCustomer?.anniversary_date ? toDateInputValue(editCustomer.anniversary_date) : '',
      address: editCustomer?.address ?? '',
      notes: editCustomer?.notes ?? '',
      is_member: Boolean(editCustomer?.is_member),
      membership_end_date: editCustomer?.membership_end_date ? toDateInputValue(editCustomer.membership_end_date) : '',
    },
    validationSchema: CustomerSchema,
    onSubmit: async (values, helpers) => {
      try {
        const payload = {
          first_name: values.first_name.trim(),
          last_name: values.last_name.trim(),
          phone: values.phone.trim(),
          email: values.email || undefined,
          gender: values.gender || undefined,
          dob: values.is_member && values.dob ? values.dob : undefined,
          anniversary_date: values.is_member && values.anniversary_date ? values.anniversary_date : undefined,
          address: values.address || undefined,
          notes: values.notes || undefined,
          ...(allowMembership
            ? {
                is_member: Boolean(values.is_member),
                membership_end_date: values.is_member && values.membership_end_date ? values.membership_end_date : undefined,
              }
            : {}),
        };

        const phoneCheck = await checkCustomerPhone({
          phone: values.phone.trim(),
          excludeId: isEdit && editCustomer ? editCustomer.id : undefined,
        }).unwrap();
        if (phoneCheck.data?.exists && phoneCheck.data.message) {
          helpers.setFieldError('phone', phoneCheck.data.message);
          showToast('error', phoneCheck.data.message);
          return;
        }

        if (isEdit && editCustomer) {
          await updateCustomer({ id: editCustomer.id, ...payload }).unwrap();
          showToast('success', 'Customer updated successfully');
        } else {
          await createCustomer(payload).unwrap();
          showToast('success', 'Customer added successfully');
        }
        helpers.resetForm();
        onClose();
      } catch (err: unknown) {
        applyApiFieldErrors(
          (err as { data?: { errors?: Record<string, string[]> } })?.data?.errors,
          helpers.setFieldError
        );
        showToast(
          'error',
          getApiErrorMessage(err, 'Something went wrong. Please try again.')
        );
      }
    },
  });

  const handlePhoneBlur = async (event: React.FocusEvent<HTMLInputElement>) => {
    formik.handleBlur(event);
    const phone = formik.values.phone.trim();
    if (phone.length < 6) return;
    try {
      const result = await checkCustomerPhone({
        phone,
        excludeId: isEdit && editCustomer ? editCustomer.id : undefined,
      }).unwrap();
      if (result.data?.exists && result.data.message) {
        formik.setFieldError('phone', result.data.message);
      }
    } catch {
      // Backend create/update remains the source of truth.
    }
  };

  if (!open) return null;

  const field = (
    name: Exclude<keyof typeof formik.values, 'is_member' | 'membership_end_date'>,
    label: string,
    type = 'text',
    required = false
  ) => (
    <div>
      <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-500">
        {label}
        {required && <span className="ml-1 text-red-500">*</span>}
      </label>
      <Input
        type={type}
        name={name}
        value={formik.values[name]}
        onChange={formik.handleChange}
        onBlur={name === 'phone' ? handlePhoneBlur : formik.handleBlur}
        className={cn(
          formik.touched[name] && formik.errors[name] ? 'border-red-400' : ''
        )}
      />
      {formik.touched[name] && formik.errors[name] && (
        <p className="mt-1 text-xs text-red-500">{formik.errors[name]}</p>
      )}
      {type === 'date' && formik.values[name] && (
        <p className="mt-1 text-xs text-gray-500">{formatDateDMY(formik.values[name])}</p>
      )}
    </div>
  );

  return (
    <Modal open={open} onClose={onClose} size="lg">
      <ModalHeader>
        {isEdit ? 'Edit Customer' : 'Add New Customer'}
      </ModalHeader>
      <form onSubmit={formik.handleSubmit}>
        <ModalBody>
          <div className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              {field('first_name', 'Full Name', 'text', true)}
              {field('last_name', 'Last Name')}
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <div className="mb-1 flex items-center justify-between">
                  <label className="block text-xs font-semibold uppercase tracking-wide text-gray-500">
                    Mobile / Client ID <span className="text-red-500">*</span>
                  </label>
                  {!isEdit && (
                    <button
                      type="button"
                      onClick={handleGenerateId}
                      disabled={isGeneratingId}
                      className="inline-flex items-center gap-1 text-xs font-semibold text-[var(--color-brand-gold-dark)] hover:underline focus:outline-none"
                    >
                      <Sparkles className="h-3 w-3" />
                      Generate ID
                    </button>
                  )}
                </div>
                <div className="flex gap-2">
                  <Input
                    type="text"
                    name="phone"
                    value={formik.values.phone}
                    onChange={formik.handleChange}
                    onBlur={handlePhoneBlur}
                    placeholder="Phone or CL-XXXXXX"
                    className={cn(
                      'flex-1',
                      formik.touched.phone && formik.errors.phone ? 'border-red-400' : ''
                    )}
                  />
                  {!isEdit && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={handleGenerateId}
                      disabled={isGeneratingId}
                      className="whitespace-nowrap px-3 text-xs font-semibold"
                    >
                      Generate ID
                    </Button>
                  )}
                </div>
                {formik.touched.phone && formik.errors.phone && (
                  <p className="mt-1 text-xs text-red-500">{formik.errors.phone}</p>
                )}
              </div>
              {field('email', 'Email', 'email')}
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-500">
                  Gender
                </label>
                <Select
                  name="gender"
                  value={formik.values.gender}
                  onChange={formik.handleChange}
                  options={[
                    { value: '', label: 'Select gender' },
                    { value: 'MALE', label: 'Male' },
                    { value: 'FEMALE', label: 'Female' },
                    { value: 'OTHER', label: 'Other' },
                  ]}
                />
              </div>
              {formik.values.is_member && field('dob', 'Date of Birth (Birthday)', 'date')}
            </div>
            {formik.values.is_member && (
              <div className="grid gap-4 sm:grid-cols-2">
                {field('anniversary_date', 'Anniversary Date', 'date')}
              </div>
            )}
            {field('address', 'Address')}
            {allowMembership && (
              <div className="space-y-3 rounded-xl bg-amber-50/50 dark:bg-amber-950/20 p-3.5 border border-amber-200/70 dark:border-amber-800/40">
                <label className="flex items-center gap-2 text-sm font-semibold text-[var(--color-text-primary)]">
                  <input
                    type="checkbox"
                    name="is_member"
                    checked={formik.values.is_member}
                    onChange={(e) => {
                      formik.handleChange(e);
                      if (!e.target.checked) {
                        formik.setFieldValue('dob', '');
                        formik.setFieldValue('anniversary_date', '');
                      }
                      if (e.target.checked && !formik.values.membership_end_date) {
                        const num = memSettingsRes?.data?.default_duration_number || 1;
                        const unit = (memSettingsRes?.data?.default_duration_unit || 'Years').toLowerCase();
                        const defaultExpiry = new Date();
                        if (unit.includes('day')) {
                          defaultExpiry.setDate(defaultExpiry.getDate() + num - 1);
                        } else if (unit.includes('month')) {
                          defaultExpiry.setMonth(defaultExpiry.getMonth() + num);
                          defaultExpiry.setDate(defaultExpiry.getDate() - 1);
                        } else {
                          defaultExpiry.setFullYear(defaultExpiry.getFullYear() + num);
                          defaultExpiry.setDate(defaultExpiry.getDate() - 1);
                        }
                        formik.setFieldValue('membership_end_date', toDateInputValue(defaultExpiry));
                      }
                    }}
                    className="h-4 w-4 rounded border-gray-300 text-[var(--color-brand-gold)] focus:ring-[var(--color-brand-gold)]"
                  />
                  Member
                </label>
                {formik.values.is_member && (
                  <div className="pt-1">
                    <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-500">
                      Membership Expiry Date
                    </label>
                    <Input
                      type="date"
                      name="membership_end_date"
                      value={formik.values.membership_end_date}
                      onChange={formik.handleChange}
                      onBlur={formik.handleBlur}
                      className={cn(
                        formik.touched.membership_end_date && formik.errors.membership_end_date ? 'border-red-400' : ''
                      )}
                    />
                    {formik.values.membership_end_date && (
                      <p className="mt-1 text-xs text-amber-700 dark:text-amber-400 font-medium">
                        Expires on {formatDateDMY(formik.values.membership_end_date)}
                      </p>
                    )}
                  </div>
                )}
              </div>
            )}
            {!allowMembership && isEdit && (
              <div className="flex items-center gap-2 text-sm">
                <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                  Membership
                </span>
                <MembershipBadge isMember={editCustomer?.is_member} />
              </div>
            )}
            <div>
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-500">
                Notes
              </label>
              <textarea
                name="notes"
                rows={3}
                value={formik.values.notes}
                onChange={formik.handleChange}
                className="w-full rounded-xl border border-[var(--color-border-soft)] bg-white px-3 py-2 text-sm text-[var(--color-text-primary)] outline-none focus:border-[var(--color-brand-gold)] focus:ring-1 focus:ring-[var(--color-brand-gold)]"
                placeholder="Allergies, preferences, style notes…"
              />
            </div>
          </div>
        </ModalBody>
        <ModalFooter>
          <Button variant="secondary" type="button" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="primary"
            type="submit"
            disabled={creating || updating}
          >
            {creating || updating ? 'Saving…' : isEdit ? 'Update Customer' : 'Add Customer'}
          </Button>
        </ModalFooter>
      </form>
    </Modal>
  );
};

// ─────────────────────────── Customer Profile Drawer ─────────────────────────

interface CustomerProfileProps {
  customerId: string | null;
  onClose: () => void;
}

const CustomerProfile: React.FC<CustomerProfileProps> = ({ customerId, onClose }) => {
  const { user } = useAppSelector((state) => state.auth);
  const allowManageMembership = canManageMembership(user?.role);
  const [membershipModal, setMembershipModal] = useState<{
    isOpen: boolean;
    mode: 'add' | 'renew';
  }>({ isOpen: false, mode: 'add' });

  const { data: res, isLoading } = useGetCustomerByIdQuery(customerId ?? '', {
    skip: !customerId,
  });
  const detail = res?.data;

  if (!customerId) return null;

  const isMemberActive = detail?.membership_status === 'ACTIVE';
  const isMemberExpired = detail?.membership_status === 'EXPIRED';

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div
        className="absolute inset-0 bg-black/30 backdrop-blur-sm"
        onClick={onClose}
      />
      <div className="relative z-10 flex h-full w-full max-w-xl flex-col bg-white shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[var(--color-border-soft)] p-5">
          <h2 className="text-lg font-bold text-[var(--color-text-primary)]">
            Customer Profile
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-700"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="custom-scrollbar flex-1 overflow-y-auto p-5 space-y-5">
          {isLoading && (
            <div className="space-y-4 animate-pulse">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="h-16 rounded-2xl bg-gray-100" />
              ))}
            </div>
          )}

          {detail && (
            <>
              {/* Membership Card */}
              <SectionCard className="border-amber-200/80 bg-gradient-to-br from-white via-amber-50/20 to-yellow-50/30">
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div className="flex items-center gap-2">
                    <div className="p-2 bg-gradient-to-tr from-amber-500 to-yellow-400 text-white rounded-xl shadow-sm">
                      <Crown className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="font-bold text-slate-900">
                        Client Membership
                      </h3>
                      <p className="text-xs text-slate-500">
                        {detail.membership_type || 'Standard Membership'}
                      </p>
                    </div>
                  </div>
                  <MembershipBadge customer={detail} />
                </div>

                <div className="grid grid-cols-2 gap-3 p-3 bg-white/80 rounded-xl border border-slate-100 text-xs mb-3">
                  <div>
                    <span className="block text-slate-400 font-medium">Valid From</span>
                    <span className="font-semibold text-slate-800">
                      {detail.membership_start_date
                        ? formatDateDMY(detail.membership_start_date)
                        : '—'}
                    </span>
                  </div>
                  <div>
                    <span className="block text-slate-400 font-medium">Expiry Date</span>
                    <span className="font-semibold text-amber-600">
                      {detail.membership_end_date
                        ? formatDateDMY(detail.membership_end_date)
                        : '—'}
                    </span>
                  </div>
                </div>

                {detail.membership_end_date && (
                  <div className="mb-4">
                    {isMemberActive && (
                      <div className="flex items-center gap-1.5 text-xs text-emerald-700 font-medium bg-emerald-50 p-2 rounded-lg border border-emerald-200/50">
                        <Sparkles className="w-4 h-4 shrink-0 text-emerald-500" />
                        {detail.days_until_expiry !== null && detail.days_until_expiry !== undefined
                          ? `${detail.days_until_expiry} days remaining in active subscription`
                          : 'Active membership status'}
                      </div>
                    )}
                    {isMemberExpired && (
                      <div className="flex items-center gap-1.5 text-xs text-amber-700 font-medium bg-amber-50 p-2 rounded-lg border border-amber-200/50">
                        <AlertCircle className="w-4 h-4 shrink-0 text-amber-600" />
                        Membership expired. Renew to re-activate member discounts.
                      </div>
                    )}
                  </div>
                )}

                {allowManageMembership && (
                  <div className="flex justify-end pt-1">
                    {isMemberActive || isMemberExpired ? (
                      <button
                        type="button"
                        onClick={() => setMembershipModal({ isOpen: true, mode: 'renew' })}
                        className="inline-flex items-center gap-2 px-4 py-2 text-xs font-bold text-amber-900 bg-gradient-to-r from-amber-400 to-yellow-400 hover:from-amber-500 hover:to-yellow-500 rounded-xl shadow-md shadow-amber-500/20 transition"
                      >
                        <ShieldCheck className="w-4 h-4" /> Renew Membership
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setMembershipModal({ isOpen: true, mode: 'add' })}
                        className="inline-flex items-center gap-2 px-4 py-2 text-xs font-bold text-white bg-gradient-to-r from-amber-500 via-yellow-500 to-amber-600 hover:from-amber-600 hover:to-yellow-600 rounded-xl shadow-md shadow-amber-500/20 transition"
                      >
                        <Crown className="w-4 h-4" /> Enroll Membership (1 Year)
                      </button>
                    )}
                  </div>
                )}
              </SectionCard>

              {/* Basic Info */}
              <SectionCard>
                <h3 className="mb-3 font-bold text-[var(--color-text-primary)]">Basic Info</h3>
                <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                  {[
                    ['Name', detail.full_name],
                    ['Mobile', detail.phone],
                    ['Email', detail.email ?? '—'],
                    ['Gender', detail.gender ?? '—'],
                    ['DOB (Birthday)', detail.dob ? formatDateDMY(detail.dob) : '—'],
                    ['Anniversary', detail.anniversary_date ? formatDateDMY(detail.anniversary_date) : '—'],
                    ['Address', detail.address ?? '—'],
                    ['Membership', detail.is_member ? 'Member' : 'Non-member'],
                  ].map(([k, v]) => (
                    <div key={k}>
                      <dt className="text-xs font-medium text-gray-500">{k}</dt>
                      <dd className="font-semibold text-[var(--color-text-primary)] break-words">{v}</dd>
                    </div>
                  ))}
                </dl>
              </SectionCard>

              {/* Membership History Table */}
              {detail.membership_history && detail.membership_history.length > 0 && (
                <SectionCard>
                  <h3 className="mb-3 font-bold text-[var(--color-text-primary)]">
                    Membership History
                  </h3>
                  <TableShell>
                    <table className="min-w-full text-sm">
                      <thead className="bg-[var(--color-surface-bg)] text-xs uppercase tracking-wide text-gray-500">
                        <tr>
                          <th className="whitespace-nowrap px-3 py-2 text-left font-bold">Start Date</th>
                          <th className="whitespace-nowrap px-3 py-2 text-left font-bold">Expiry Date</th>
                          <th className="whitespace-nowrap px-3 py-2 text-left font-bold">Type</th>
                          <th className="whitespace-nowrap px-3 py-2 text-left font-bold">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[var(--color-border-soft)]">
                        {detail.membership_history.map((rec) => (
                          <tr key={rec.id} className="hover:bg-[var(--color-surface-bg)]/70">
                            <td className="whitespace-nowrap px-3 py-2 text-xs">
                              {formatDateDMY(rec.membership_start_date)}
                            </td>
                            <td className="whitespace-nowrap px-3 py-2 text-xs font-semibold text-amber-700">
                              {formatDateDMY(rec.membership_end_date)}
                            </td>
                            <td className="whitespace-nowrap px-3 py-2 text-xs">{rec.membership_type}</td>
                            <td className="whitespace-nowrap px-3 py-2">
                              <span
                                className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-bold ${
                                  rec.status === 'ACTIVE'
                                    ? 'bg-emerald-100 text-emerald-800'
                                    : 'bg-amber-100 text-amber-800'
                                }`}
                              >
                                {rec.status}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </TableShell>
                </SectionCard>
              )}

              {/* Analytics */}
              <SectionCard>
                <h3 className="mb-3 font-bold text-[var(--color-text-primary)]">Analytics</h3>
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { label: 'Total Visits', value: detail.total_visits },
                    { label: 'Total Spend', value: formatCurrency(detail.total_spent) },
                    { label: 'Reward Points', value: detail.reward_points },
                    {
                      label: 'Last Visit',
                      value: detail.last_visit_at ? formatDateDMY(detail.last_visit_at) : '—',
                    },
                  ].map(({ label, value }) => (
                    <div
                      key={label}
                      className="rounded-2xl bg-[var(--color-surface-bg)] p-3"
                    >
                      <p className="text-xs font-medium text-gray-500">{label}</p>
                      <p className="mt-1 text-base font-bold text-[var(--color-text-primary)]">
                        {value}
                      </p>
                    </div>
                  ))}
                </div>
              </SectionCard>

              {/* Appointment History */}
              {detail.appointment_history.length > 0 && (
                <SectionCard>
                  <h3 className="mb-3 font-bold text-[var(--color-text-primary)]">
                    Appointment History
                  </h3>
                  <TableShell>
                    <table className="min-w-full text-sm">
                      <thead className="bg-[var(--color-surface-bg)] text-xs uppercase tracking-wide text-gray-500">
                        <tr>
                          <th className="whitespace-nowrap px-3 py-2 text-left font-bold">Date</th>
                          <th className="whitespace-nowrap px-3 py-2 text-left font-bold">Service</th>
                          <th className="whitespace-nowrap px-3 py-2 text-left font-bold">Staff</th>
                          <th className="whitespace-nowrap px-3 py-2 text-right font-bold">Amount</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[var(--color-border-soft)]">
                        {detail.appointment_history.map((row) => (
                          <tr key={row.id} className="hover:bg-[var(--color-surface-bg)]/70">
                            <td className="whitespace-nowrap px-3 py-2">{formatDateDMY(row.date)}</td>
                            <td className="px-3 py-2 text-xs">{row.service}</td>
                            <td className="whitespace-nowrap px-3 py-2 text-xs">{row.staff}</td>
                            <td className="whitespace-nowrap px-3 py-2 text-right font-semibold">
                              {formatCurrency(row.amount)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </TableShell>
                </SectionCard>
              )}

              {/* Billing History */}
              {detail.billing_history.length > 0 && (
                <SectionCard>
                  <h3 className="mb-3 font-bold text-[var(--color-text-primary)]">
                    Billing History
                  </h3>
                  <TableShell>
                    <table className="min-w-full text-sm">
                      <thead className="bg-[var(--color-surface-bg)] text-xs uppercase tracking-wide text-gray-500">
                        <tr>
                          <th className="whitespace-nowrap px-3 py-2 text-left font-bold">Invoice</th>
                          <th className="whitespace-nowrap px-3 py-2 text-left font-bold">Date</th>
                          <th className="whitespace-nowrap px-3 py-2 text-right font-bold">Amount</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[var(--color-border-soft)]">
                        {detail.billing_history.map((row) => (
                          <tr key={row.id} className="hover:bg-[var(--color-surface-bg)]/70">
                            <td className="whitespace-nowrap px-3 py-2 font-mono text-xs">
                              {row.invoice_number}
                            </td>
                            <td className="whitespace-nowrap px-3 py-2">
                              {row.date ? formatDateDMY(row.date) : '—'}
                            </td>
                            <td className="whitespace-nowrap px-3 py-2 text-right font-semibold">
                              {formatCurrency(row.amount)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </TableShell>
                </SectionCard>
              )}

              {/* Reward Transactions */}
              {detail.reward_transactions.length > 0 && (
                <SectionCard>
                  <h3 className="mb-3 font-bold text-[var(--color-text-primary)]">
                    Reward Transactions
                  </h3>
                  <TableShell>
                    <table className="min-w-full text-sm">
                      <thead className="bg-[var(--color-surface-bg)] text-xs uppercase tracking-wide text-gray-500">
                        <tr>
                          <th className="whitespace-nowrap px-3 py-2 text-left font-bold">Date</th>
                          <th className="whitespace-nowrap px-3 py-2 text-right font-bold">Points</th>
                          <th className="whitespace-nowrap px-3 py-2 text-left font-bold">Type</th>
                          <th className="whitespace-nowrap px-3 py-2 text-right font-bold">Bill Amt</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[var(--color-border-soft)]">
                        {detail.reward_transactions.map((t) => (
                          <tr key={t.id} className="hover:bg-[var(--color-surface-bg)]/70">
                            <td className="whitespace-nowrap px-3 py-2">
                              {t.date ? formatDateDMY(t.date) : '—'}
                            </td>
                            <td className="whitespace-nowrap px-3 py-2 text-right font-bold text-emerald-700">
                              +{t.points}
                            </td>
                            <td className="px-3 py-2">
                              <span className="inline-flex rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-700">
                                {t.type}
                              </span>
                            </td>
                            <td className="whitespace-nowrap px-3 py-2 text-right">
                              {formatCurrency(t.bill_amount)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </TableShell>
                </SectionCard>
              )}
            </>
          )}
        </div>

        {detail && (
          <AddRenewMembershipModal
            isOpen={membershipModal.isOpen}
            onClose={() => setMembershipModal({ isOpen: false, mode: 'add' })}
            customer={detail}
            mode={membershipModal.mode}
          />
        )}
      </div>
    </div>
  );
};

// ─────────────────────────── Customers Tab ───────────────────────────────────

const GENDER_OPTIONS = [
  { value: '', label: 'All Genders' },
  { value: 'MALE', label: 'Male' },
  { value: 'FEMALE', label: 'Female' },
  { value: 'OTHER', label: 'Other' },
];

const STATUS_OPTIONS = [
  { value: '', label: 'All Status' },
  { value: 'active', label: 'Active' },
  { value: 'inactive', label: 'Inactive' },
];

const MEMBERSHIP_OPTIONS = [
  { value: '', label: 'All Memberships' },
  { value: 'active', label: 'Active Members' },
  { value: 'expired', label: 'Expired Members' },
  { value: 'expiring_soon', label: 'Expiring Soon' },
  { value: 'non_members', label: 'Non-members' },
];

const CustomersTab: React.FC = () => {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [gender, setGender] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [membershipFilter, setMembershipFilter] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<Customer | null>(null);
  const [viewId, setViewId] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState<string | null>(null);

  const [deleteCustomer, { isLoading: deleting }] = useDeleteCustomerMutation();
  const [downloadTemplate, { isFetching: downloadingTemplate }] =
    useLazyDownloadCustomerImportTemplateQuery();

  const handleDownloadTemplate = async () => {
    try {
      const blob = await downloadTemplate('xlsx').unwrap();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'client_import_template.xlsx';
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      showToast('success', 'Template downloaded');
    } catch {
      showToast('error', 'Failed to download template');
    }
  };

  const { data: res, isLoading } = useGetCustomersQuery({
    page,
    limit: 15,
    search: debouncedSearch || undefined,
    gender: gender || undefined,
    status: statusFilter || undefined,
    membership: membershipFilter || undefined,
  });

  const customers = res?.data?.items ?? [];
  const total = res?.data?.total ?? 0;
  const pages = res?.data?.pages ?? 1;

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearch(e.target.value);
    clearTimeout((window as unknown as Record<string, unknown>)._caSearchTimer as number);
    (window as unknown as Record<string, unknown>)._caSearchTimer = window.setTimeout(() => {
      setDebouncedSearch(e.target.value);
      setPage(1);
    }, 400);
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Delete this customer? This cannot be undone.')) return;
    try {
      await deleteCustomer(id).unwrap();
      showToast('success', 'Customer deleted');
      setMenuOpen(null);
    } catch {
      showToast('error', 'Failed to delete customer');
    }
  };

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <SectionCard>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-1 flex-col gap-3 sm:flex-row sm:items-center">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <Input
                value={search}
                onChange={handleSearchChange}
                placeholder="Search by name, mobile, email…"
                className="pl-9 w-full"
              />
            </div>
            <Select
              value={gender}
              onChange={(e) => { setGender(e.target.value); setPage(1); }}
              options={GENDER_OPTIONS}
              className="w-full sm:w-28 md:w-32"
            />
            <Select
              value={statusFilter}
              onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
              options={STATUS_OPTIONS}
              className="w-full sm:w-28 md:w-32"
            />
            <Select
              value={membershipFilter}
              onChange={(e) => { setMembershipFilter(e.target.value); setPage(1); }}
              options={MEMBERSHIP_OPTIONS}
              className="w-full sm:w-36 md:w-40"
            />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="secondary"
              icon={<Download className="h-4 w-4" />}
              onClick={handleDownloadTemplate}
              isLoading={downloadingTemplate}
            >
              Download Template
            </Button>
            <Button
              variant="outline"
              icon={<Upload className="h-4 w-4" />}
              onClick={() => setUploadOpen(true)}
            >
              Upload
            </Button>
            <Button
              variant="primary"
              icon={<Plus className="h-4 w-4" />}
              onClick={() => { setEditTarget(null); setFormOpen(true); }}
            >
              Add Customer
            </Button>
          </div>
        </div>
      </SectionCard>

      {/* Table */}
      <TableShell>
        <table className="min-w-full text-sm">
          <thead className="bg-[var(--color-surface-bg)] text-xs uppercase tracking-wide text-gray-500">
            <tr>
              <th className="whitespace-nowrap px-4 py-3 text-left font-bold">Name</th>
              <th className="whitespace-nowrap px-4 py-3 text-left font-bold">Mobile</th>
              <th className="whitespace-nowrap px-4 py-3 text-left font-bold">Gender</th>
              <th className="whitespace-nowrap px-4 py-3 text-left font-bold">Membership</th>
              <th className="whitespace-nowrap px-4 py-3 text-left font-bold">Membership Expiry</th>
              <th className="whitespace-nowrap px-4 py-3 text-right font-bold">Visits</th>
              <th className="whitespace-nowrap px-4 py-3 text-right font-bold">Points</th>
              <th className="whitespace-nowrap px-4 py-3 text-left font-bold">Last Visit</th>
              <th className="whitespace-nowrap px-4 py-3 text-left font-bold">Status</th>
              <th className="whitespace-nowrap px-4 py-3 text-center font-bold">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--color-border-soft)]">
            {isLoading ? (
              <tr>
                <td colSpan={10} className="px-4 py-10 text-center text-sm text-gray-500">
                  Loading customers…
                </td>
              </tr>
            ) : customers.length === 0 ? (
              <EmptyRow cols={10} message="No customers found. Add your first customer." />
            ) : (
              customers.map((c) => (
                <tr
                  key={c.id}
                  className="transition hover:bg-[var(--color-surface-bg)]/70"
                >
                  <td className="whitespace-nowrap px-4 py-3">
                    <div>
                      <p className="font-semibold text-[var(--color-text-primary)]">
                        {c.full_name}
                      </p>
                      {c.email && (
                        <p className="text-xs text-gray-500">{c.email}</p>
                      )}
                    </div>
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 font-mono text-xs">{c.phone}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-xs text-gray-600">
                    {c.gender ? c.gender.charAt(0) + c.gender.slice(1).toLowerCase() : '—'}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3">
                    <MembershipBadge customer={c} isMember={c.is_member} />
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-xs">
                    {c.membership_end_date ? (
                      c.membership_status === 'ACTIVE' || c.is_member ? (
                        c.is_expiring_soon ? (
                          <span className="inline-flex items-center gap-1 font-semibold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-md border border-amber-200/60">
                            <Calendar className="h-3 w-3 text-amber-500" />
                            {formatDateDMY(c.membership_end_date)} ({c.days_until_expiry}d left)
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 font-medium text-slate-700">
                            <Calendar className="h-3 w-3 text-slate-400" />
                            {formatDateDMY(c.membership_end_date)}
                          </span>
                        )
                      ) : c.membership_status === 'EXPIRED' ? (
                        <span className="inline-flex items-center gap-1 font-medium text-rose-600 bg-rose-50 px-2 py-0.5 rounded-md border border-rose-200/60">
                          <Calendar className="h-3 w-3 text-rose-400" />
                          Expired {formatDateDMY(c.membership_end_date)}
                        </span>
                      ) : (
                        <span className="text-gray-400">—</span>
                      )
                    ) : c.is_member || c.membership_status === 'ACTIVE' ? (
                      <span className="inline-flex items-center gap-1 font-medium text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200/60">
                        <Calendar className="h-3 w-3 text-emerald-500" />
                        Active Member
                      </span>
                    ) : (
                      <span className="text-gray-400">—</span>
                    )}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-right font-semibold">
                    {c.total_visits}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-right">
                    <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-xs font-semibold text-amber-700">
                      <Award className="h-3 w-3" />
                      {c.reward_points}
                    </span>
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-xs text-gray-600">
                    {c.last_visit_at ? formatDateDMY(c.last_visit_at) : '—'}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3">
                    <StatusBadge customer={c} />
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-center">
                    <div className="relative inline-block">
                      <button
                        type="button"
                        className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-700"
                        onClick={() =>
                          setMenuOpen((prev) => (prev === c.id ? null : c.id))
                        }
                      >
                        <MoreVertical className="h-4 w-4" />
                      </button>
                      {menuOpen === c.id && (
                        <div className="absolute right-0 z-20 mt-1 w-40 rounded-xl border border-[var(--color-border-soft)] bg-white py-1 shadow-lg">
                          <button
                            type="button"
                            className="flex w-full items-center gap-2 px-4 py-2 text-sm text-[var(--color-text-primary)] hover:bg-[var(--color-surface-bg)]"
                            onClick={() => { setViewId(c.id); setMenuOpen(null); }}
                          >
                            <UserCheck className="h-4 w-4" /> View
                          </button>
                          <button
                            type="button"
                            className="flex w-full items-center gap-2 px-4 py-2 text-sm text-[var(--color-text-primary)] hover:bg-[var(--color-surface-bg)]"
                            onClick={() => { setEditTarget(c); setFormOpen(true); setMenuOpen(null); }}
                          >
                            <Pencil className="h-4 w-4" /> Edit
                          </button>
                          <button
                            type="button"
                            disabled={deleting}
                            className="flex w-full items-center gap-2 px-4 py-2 text-sm text-red-600 hover:bg-red-50 disabled:opacity-50"
                            onClick={() => handleDelete(c.id)}
                          >
                            <Trash2 className="h-4 w-4" /> Delete
                          </button>
                        </div>
                      )}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </TableShell>

      {/* Pagination */}
      {pages > 1 && (
        <SectionCard className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-gray-500">
            Showing page <span className="font-medium">{page}</span> of{' '}
            <span className="font-medium">{pages}</span> ({total} total)
          </p>
          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              size="sm"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              Previous
            </Button>
            <Button
              variant="secondary"
              size="sm"
              disabled={page >= pages}
              onClick={() => setPage((p) => p + 1)}
            >
              Next
            </Button>
          </div>
        </SectionCard>
      )}

      {/* Modals / Drawers */}
      <CustomerFormModal
        open={formOpen}
        onClose={() => { setFormOpen(false); setEditTarget(null); }}
        editCustomer={editTarget}
      />
      <BulkClientUploadModal open={uploadOpen} onClose={() => setUploadOpen(false)} />
      {viewId && (
        <CustomerProfile customerId={viewId} onClose={() => setViewId(null)} />
      )}
    </div>
  );
};

// ─────────────────────────── Segment Form ────────────────────────────────────

interface SegmentFormProps {
  open: boolean;
  onClose: () => void;
  editSegment?: RewardSegment | null;
}

const SegmentFormModal: React.FC<SegmentFormProps> = ({ open, onClose, editSegment }) => {
  const [createSegment, { isLoading: creating }] = useCreateRewardSegmentMutation();
  const [updateSegment, { isLoading: updating }] = useUpdateRewardSegmentMutation();
  const isEdit = !!editSegment;

  const formik = useFormik({
    enableReinitialize: true,
    initialValues: {
      min_bill_amount: editSegment?.min_bill_amount ?? '',
      reward_points: editSegment?.reward_points ?? '',
    },
    validationSchema: SegmentSchema,
    onSubmit: async (values, helpers) => {
      try {
        if (isEdit && editSegment) {
          await updateSegment({
            id: editSegment.id,
            min_bill_amount: Number(values.min_bill_amount),
            reward_points: Number(values.reward_points),
          }).unwrap();
          showToast('success', 'Segment updated');
        } else {
          await createSegment({
            min_bill_amount: Number(values.min_bill_amount),
            reward_points: Number(values.reward_points),
          }).unwrap();
          showToast('success', 'Segment added');
        }
        helpers.resetForm();
        onClose();
      } catch (err: unknown) {
        const e = err as { data?: { message?: string } };
        showToast('error', e?.data?.message ?? 'Failed to save segment');
      }
    },
  });

  if (!open) return null;

  return (
    <Modal open={open} onClose={onClose} size="sm">
      <ModalHeader>
        {isEdit ? 'Edit Segment' : 'Add Reward Segment'}
      </ModalHeader>
      <form onSubmit={formik.handleSubmit}>
        <ModalBody>
          <div className="space-y-4">
            <div>
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-500">
                Min Bill Amount (₹) <span className="text-red-500">*</span>
              </label>
              <Input
                type="number"
                name="min_bill_amount"
                value={String(formik.values.min_bill_amount)}
                onChange={formik.handleChange}
                onBlur={formik.handleBlur}
                min={0}
              />
              {formik.touched.min_bill_amount && formik.errors.min_bill_amount && (
                <p className="mt-1 text-xs text-red-500">{formik.errors.min_bill_amount}</p>
              )}
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-500">
                Reward Points <span className="text-red-500">*</span>
              </label>
              <Input
                type="number"
                name="reward_points"
                value={String(formik.values.reward_points)}
                onChange={formik.handleChange}
                onBlur={formik.handleBlur}
                min={0}
              />
              {formik.touched.reward_points && formik.errors.reward_points && (
                <p className="mt-1 text-xs text-red-500">{formik.errors.reward_points}</p>
              )}
            </div>
          </div>
        </ModalBody>
        <ModalFooter>
          <Button variant="secondary" type="button" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" type="submit" disabled={creating || updating}>
            {creating || updating ? 'Saving…' : isEdit ? 'Update' : 'Add Segment'}
          </Button>
        </ModalFooter>
      </form>
    </Modal>
  );
};

// ─────────────────────────── Reward Settings Tab ─────────────────────────────

const RewardSettingsTab: React.FC = () => {
  const { data: res, isLoading } = useGetRewardSettingsQuery();
  const [updateSettings, { isLoading: saving }] = useUpdateRewardSettingsMutation();
  const [deleteSegment, { isLoading: deletingSegment }] = useDeleteRewardSegmentMutation();
  const [segmentOpen, setSegmentOpen] = useState(false);
  const [editSegment, setEditSegment] = useState<RewardSegment | null>(null);

  const settings = res?.data;

  const handleToggle = async (enabled: boolean) => {
    try {
      await updateSettings({ is_enabled: enabled }).unwrap();
      showToast('success', enabled ? 'Rewards enabled' : 'Rewards disabled');
    } catch {
      showToast('error', 'Failed to update reward settings');
    }
  };

  const handleDefaultPoints = async (points: number) => {
    try {
      await updateSettings({ default_points: points }).unwrap();
      showToast('success', 'Default points updated');
    } catch {
      showToast('error', 'Failed to update default points');
    }
  };

  const handleDeleteSegment = async (id: string) => {
    if (!window.confirm('Delete this reward segment?')) return;
    try {
      await deleteSegment(id).unwrap();
      showToast('success', 'Segment deleted');
    } catch {
      showToast('error', 'Failed to delete segment');
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-4 animate-pulse">
        <div className="h-24 rounded-2xl bg-gray-100" />
        <div className="h-32 rounded-2xl bg-gray-100" />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Global toggle */}
      <SectionCard>
        <div className="flex items-center justify-between gap-4">
          <div>
            <h3 className="font-bold text-[var(--color-text-primary)]">Reward System</h3>
            <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
              When enabled, customers automatically earn points after every completed
              appointment/invoice.
            </p>
          </div>
          <button
            type="button"
            disabled={saving}
            onClick={() => handleToggle(!settings?.is_enabled)}
            className={cn(
              'relative inline-flex h-7 w-12 items-center rounded-full transition-colors focus:outline-none',
              settings?.is_enabled
                ? 'bg-[var(--color-brand-gold)]'
                : 'bg-gray-300'
            )}
          >
            <span
              className={cn(
                'inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform',
                settings?.is_enabled ? 'translate-x-6' : 'translate-x-1'
              )}
            />
          </button>
        </div>
        {settings?.is_enabled && (
          <div className="mt-4 flex items-end gap-4 border-t border-[var(--color-border-soft)] pt-4">
            <div className="flex-1 max-w-xs">
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-500">
                Default Points per Appointment
              </label>
              <DefaultPointsInput
                defaultVal={settings?.default_points ?? 10}
                onSave={handleDefaultPoints}
                saving={saving}
              />
            </div>
            <p className="text-xs text-gray-500 pb-1">
              Applied when no segment matches the bill amount.
            </p>
          </div>
        )}
      </SectionCard>

      {/* Segments */}
      {settings?.is_enabled && (
        <SectionCard>
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h3 className="font-bold text-[var(--color-text-primary)]">
                Bill Amount Segments
              </h3>
              <p className="mt-0.5 text-sm text-[var(--color-text-secondary)]">
                System applies only the highest matching segment per invoice.
              </p>
            </div>
            <Button
              variant="primary"
              size="sm"
              icon={<Plus className="h-4 w-4" />}
              onClick={() => { setEditSegment(null); setSegmentOpen(true); }}
            >
              Add Segment
            </Button>
          </div>

          {!settings.segments?.length ? (
            <div className="rounded-2xl border border-dashed border-[var(--color-border-soft)] py-8 text-center">
              <Gift className="mx-auto mb-2 h-8 w-8 text-gray-300" />
              <p className="text-sm text-gray-500">
                No segments yet. Add bill-amount thresholds to reward high-spend customers.
              </p>
            </div>
          ) : (
            <TableShell>
              <table className="min-w-full text-sm">
                <thead className="bg-[var(--color-surface-bg)] text-xs uppercase tracking-wide text-gray-500">
                  <tr>
                    <th className="whitespace-nowrap px-4 py-3 text-left font-bold">
                      Min Bill Amount
                    </th>
                    <th className="whitespace-nowrap px-4 py-3 text-right font-bold">
                      Reward Points
                    </th>
                    <th className="whitespace-nowrap px-4 py-3 text-center font-bold">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--color-border-soft)]">
                  {[...(settings.segments ?? [])]
                    .sort((a, b) => a.min_bill_amount - b.min_bill_amount)
                    .map((seg) => (
                      <tr key={seg.id} className="hover:bg-[var(--color-surface-bg)]/70">
                        <td className="whitespace-nowrap px-4 py-3 font-semibold text-[var(--color-text-primary)]">
                          {formatCurrency(seg.min_bill_amount)}
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 text-right">
                          <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-700">
                            <Award className="h-3 w-3" />
                            {seg.reward_points} pts
                          </span>
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 text-center">
                          <div className="flex items-center justify-center gap-2">
                            <button
                              type="button"
                              className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-700"
                              onClick={() => { setEditSegment(seg); setSegmentOpen(true); }}
                            >
                              <Pencil className="h-4 w-4" />
                            </button>
                            <button
                              type="button"
                              disabled={deletingSegment}
                              className="rounded-lg p-1.5 text-red-400 hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
                              onClick={() => handleDeleteSegment(seg.id)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </TableShell>
          )}
        </SectionCard>
      )}

      {/* Logic explanation */}
      {settings?.is_enabled && (
        <SectionCard className="border-[var(--color-brand-gold-light)] bg-amber-50/30">
          <h4 className="font-semibold text-[var(--color-text-primary)]">How it works</h4>
          <ul className="mt-2 space-y-1 text-sm text-[var(--color-text-secondary)]">
            <li>• After every completed appointment, the system checks the bill amount.</li>
            <li>• The <strong>highest matching segment</strong> wins — points are not combined.</li>
            <li>
              • If no segment matches, the customer earns{' '}
              <strong>{settings?.default_points ?? 10} default points</strong>.
            </li>
            <li>• Points are reflected immediately in the customer's profile.</li>
          </ul>
          <div className="mt-3 rounded-xl bg-white p-3 text-sm">
            <p className="font-semibold text-[var(--color-text-primary)]">Example</p>
            <p className="text-gray-500">
              Bill ₹1,200 · Segments: ₹500→30pts, ₹1,000→70pts → Customer earns{' '}
              <strong className="text-emerald-700">70 pts only</strong>
            </p>
          </div>
        </SectionCard>
      )}

      <SegmentFormModal
        open={segmentOpen}
        onClose={() => { setSegmentOpen(false); setEditSegment(null); }}
        editSegment={editSegment}
      />
    </div>
  );
};

// ─────────────────────────── Default Points Inline Input ─────────────────────

const DefaultPointsInput: React.FC<{
  defaultVal: number;
  onSave: (v: number) => void;
  saving: boolean;
}> = ({ defaultVal, onSave, saving }) => {
  const [val, setVal] = useState(String(defaultVal));

  return (
    <div className="flex items-center gap-2">
      <Input
        type="number"
        min={0}
        value={val}
        onChange={(e) => setVal(e.target.value)}
        className="w-24"
      />
      <Button
        variant="secondary"
        size="sm"
        disabled={saving || Number(val) === defaultVal}
        onClick={() => onSave(Number(val))}
      >
        {saving ? 'Saving…' : 'Save'}
      </Button>
    </div>
  );
};

// ─────────────────────────── Main Page ───────────────────────────────────────

const CustomerAnalyticsPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<AnalyticsTab>('overview');

  return (
    <div className="min-h-screen bg-[var(--color-surface-bg)] p-4 md:p-6 xl:p-8">
      <div className="mx-auto max-w-[1600px] space-y-5">
        {/* Header */}
        <SectionCard className="bg-white/90 backdrop-blur">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="mb-1 inline-flex items-center gap-2 rounded-full bg-[var(--color-brand-gold-light)]/20 px-3 py-1 text-xs font-semibold text-[var(--color-brand-gold-dark)]">
                <Users className="h-3.5 w-3.5" />
                Customer Intelligence
              </div>
              <h1 className="text-2xl font-bold text-[var(--color-text-primary)] md:text-3xl">
                Customer Analytics
              </h1>
              <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
                Manage customers, track retention, and configure your reward programme.
              </p>
            </div>
          </div>
        </SectionCard>

        {/* Tab Bar */}
        <div className="custom-scrollbar flex gap-2 overflow-x-auto rounded-2xl border border-[var(--color-border-soft)] bg-white p-1 shadow-soft">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setActiveTab(t.id)}
              className={cn(
                'whitespace-nowrap rounded-xl px-4 py-2 text-sm font-semibold transition-all',
                activeTab === t.id
                  ? 'bg-[var(--color-brand-gold)] text-white shadow-sm'
                  : 'text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-bg)] hover:text-[var(--color-text-primary)]'
              )}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        {activeTab === 'overview' && <OverviewTab />}
        {activeTab === 'customers' && <CustomersTab />}
        {activeTab === 'membership-settings' && <MembershipSettingsComponent />}
        {activeTab === 'reward-settings' && <RewardSettingsTab />}
      </div>
    </div>
  );
};

export default CustomerAnalyticsPage;
