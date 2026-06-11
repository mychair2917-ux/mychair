import { useMemo, useState } from 'react';
import {
  Calendar,
  CreditCard,
  Mail,
  RefreshCw,
  Search,
  Settings2,
  Shield,
} from 'lucide-react';

import { Button, CommonModal, FormField, Input, Select } from '../../components/common';
import { showToast } from '../../components/common/Toast/toastService';
import { isSuperAdmin } from '../../config/rbac';
import {
  useGetDefaultSubscriptionDaysQuery,
  useGetMySubscriptionQuery,
  useGetSubscriptionDashboardQuery,
  useGetSubscriptionPlansQuery,
  useListSubscriptionsQuery,
  useUpdateDefaultSubscriptionDaysMutation,
  useUpdateSubscriptionMutation,
} from '../../redux/slices/subscriptions/subscriptionsApi';
import type { SubscriptionRecord } from '../../redux/slices/subscriptions/Types';
import { useAppSelector } from '../../redux/hooks';
import { formatDateDMY, toDateInputValue } from '../../utils/utilities';

const STATUS_OPTIONS = [
  { value: '', label: 'All statuses' },
  { value: 'ACTIVE', label: 'Active' },
  { value: 'EXPIRED', label: 'Expired' },
  { value: 'SUSPENDED', label: 'Suspended' },
];

const statusBadgeClass = (status: string) => {
  if (status === 'ACTIVE') return 'bg-emerald-50 text-emerald-700 border-emerald-200';
  if (status === 'SUSPENDED') return 'bg-amber-50 text-amber-700 border-amber-200';
  return 'bg-red-50 text-red-700 border-red-200';
};

const AdminSubscriptionManagement = () => {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [planFilter, setPlanFilter] = useState('');
  const [selected, setSelected] = useState<SubscriptionRecord | null>(null);
  const [defaultDaysInput, setDefaultDaysInput] = useState('');
  const [editForm, setEditForm] = useState({
    plan_name: '',
    status: '',
    start_date: '',
    end_date: '',
    extend_days: '',
  });

  const { data: dashboard, isLoading: dashboardLoading } = useGetSubscriptionDashboardQuery();
  const { data: plans = [] } = useGetSubscriptionPlansQuery();
  const { data: defaultDaysData } = useGetDefaultSubscriptionDaysQuery();
  const { data: subscriptions = [], isFetching, refetch } = useListSubscriptionsQuery({
    search: search || undefined,
    status: statusFilter || undefined,
    plan_name: planFilter || undefined,
  });
  const [updateDefaultDays, { isLoading: savingDefaultDays }] = useUpdateDefaultSubscriptionDaysMutation();
  const [updateSubscription, { isLoading: savingSubscription }] = useUpdateSubscriptionMutation();

  const planOptions = useMemo(
    () => [{ value: '', label: 'All plans' }, ...plans.map((p) => ({ value: p.value, label: p.label }))],
    [plans]
  );

  const openEditModal = (record: SubscriptionRecord) => {
    setSelected(record);
    setEditForm({
      plan_name: record.plan_name,
      status: record.status,
      start_date: toDateInputValue(record.start_date),
      end_date: toDateInputValue(record.end_date),
      extend_days: '',
    });
  };

  const handleSaveDefaultDays = async () => {
    const days = Number(defaultDaysInput || defaultDaysData?.default_subscription_days || 30);
    if (!days || days < 1) {
      showToast('error', 'Enter a valid number of days');
      return;
    }
    try {
      await updateDefaultDays({ default_subscription_days: days }).unwrap();
      showToast('success', 'Default subscription days updated');
    } catch {
      showToast('error', 'Failed to update default subscription days');
    }
  };

  const handleSaveSubscription = async () => {
    if (!selected) return;
    try {
      await updateSubscription({
        id: selected.id,
        body: {
          plan_name: editForm.plan_name || undefined,
          status: editForm.status || undefined,
          start_date: editForm.start_date ? `${editForm.start_date}T00:00:00Z` : undefined,
          end_date: editForm.end_date ? `${editForm.end_date}T23:59:59Z` : undefined,
          extend_days: editForm.extend_days ? Number(editForm.extend_days) : undefined,
        },
      }).unwrap();
      showToast('success', 'Subscription updated');
      setSelected(null);
    } catch {
      showToast('error', 'Failed to update subscription');
    }
  };

  return (
    <div className="mx-auto max-w-[1600px] space-y-8 p-4 md:p-8">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-[var(--color-text-primary)]">Subscription Management</h1>
          <p className="mt-1 text-[var(--color-text-secondary)]">
            Manage salon subscriptions, renewals, and platform defaults.
          </p>
        </div>
        <Button variant="secondary" onClick={() => refetch()} className="inline-flex items-center gap-2">
          <RefreshCw className={`h-4 w-4 ${isFetching ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {[
          { label: 'Active Subscriptions', value: dashboard?.total_active ?? 0, color: 'text-emerald-600' },
          { label: 'Expired Subscriptions', value: dashboard?.total_expired ?? 0, color: 'text-red-600' },
          { label: 'Suspended Subscriptions', value: dashboard?.total_suspended ?? 0, color: 'text-amber-600' },
          { label: 'Upcoming Expirations', value: dashboard?.upcoming_expirations ?? 0, color: 'text-blue-600' },
        ].map((card) => (
          <div
            key={card.label}
            className="rounded-2xl border border-[var(--color-border-soft)] bg-white p-5 shadow-soft"
          >
            <p className="text-sm text-[var(--color-text-secondary)]">{card.label}</p>
            <p className={`mt-2 text-3xl font-bold ${card.color}`}>
              {dashboardLoading ? '—' : card.value}
            </p>
          </div>
        ))}
      </div>

      <div className="rounded-2xl border border-[var(--color-border-soft)] bg-white p-5 shadow-soft">
        <div className="mb-4 flex items-center gap-2">
          <Settings2 className="h-5 w-5 text-[var(--color-brand-gold)]" />
          <h2 className="text-lg font-semibold">System Configuration</h2>
        </div>
        <div className="flex flex-col gap-3 md:flex-row md:items-end">
          <div className="md:w-64">
            <label className="mb-1 block text-sm font-medium">Default Subscription Days</label>
            <Input
              type="number"
              min={1}
              value={defaultDaysInput || String(defaultDaysData?.default_subscription_days ?? 30)}
              onChange={(e) => setDefaultDaysInput(e.target.value)}
            />
          </div>
          <Button onClick={handleSaveDefaultDays} disabled={savingDefaultDays}>
            Save Default Days
          </Button>
        </div>
        <p className="mt-2 text-xs text-[var(--color-text-secondary)]">
          New salons will use this value. Existing subscriptions are not changed.
        </p>
      </div>

      <div className="rounded-2xl border border-[var(--color-border-soft)] bg-white shadow-soft">
        <div className="border-b border-[var(--color-border-soft)] p-5">
          <div className="grid gap-3 lg:grid-cols-4">
            <div className="relative lg:col-span-2">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--color-text-secondary)]" />
              <Input
                className="pl-10"
                placeholder="Search by salon name or owner email"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <Select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              options={STATUS_OPTIONS}
            />
            <Select
              value={planFilter}
              onChange={(e) => setPlanFilter(e.target.value)}
              options={planOptions}
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-[var(--color-surface-bg)] text-left text-[var(--color-text-secondary)]">
              <tr>
                <th className="px-5 py-3 font-medium">Salon</th>
                <th className="px-5 py-3 font-medium">Plan</th>
                <th className="px-5 py-3 font-medium">Status</th>
                <th className="px-5 py-3 font-medium">Start</th>
                <th className="px-5 py-3 font-medium">End</th>
                <th className="px-5 py-3 font-medium">Days Left</th>
                <th className="px-5 py-3 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {subscriptions.map((record) => (
                <tr key={record.id} className="border-t border-[var(--color-border-soft)]">
                  <td className="px-5 py-4">
                    <div className="font-medium">{record.salon_name}</div>
                    <div className="text-xs text-[var(--color-text-secondary)]">{record.owner_email}</div>
                  </td>
                  <td className="px-5 py-4">{record.plan_label}</td>
                  <td className="px-5 py-4">
                    <span className={`rounded-full border px-2.5 py-1 text-xs font-medium ${statusBadgeClass(record.status)}`}>
                      {record.status}
                    </span>
                  </td>
                  <td className="px-5 py-4">{formatDateDMY(record.start_date)}</td>
                  <td className="px-5 py-4">{formatDateDMY(record.end_date)}</td>
                  <td className="px-5 py-4">{record.days_remaining}</td>
                  <td className="px-5 py-4">
                    <Button variant="secondary" size="sm" onClick={() => openEditModal(record)}>
                      Manage
                    </Button>
                  </td>
                </tr>
              ))}
              {!subscriptions.length && (
                <tr>
                  <td colSpan={7} className="px-5 py-10 text-center text-[var(--color-text-secondary)]">
                    No subscriptions found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <CommonModal
        open={Boolean(selected)}
        onClose={() => setSelected(null)}
        title="Manage Subscription"
        size="lg"
        footer={
          <div className="flex justify-end gap-3">
            <Button variant="secondary" onClick={() => setSelected(null)}>
              Cancel
            </Button>
            <Button onClick={handleSaveSubscription} isLoading={savingSubscription}>
              Save Changes
            </Button>
          </div>
        }
      >
        {selected && (
          <div className="space-y-4">
            <p className="text-sm text-[var(--color-text-secondary)]">
              {selected.salon_name} · {selected.owner_email}
            </p>
            <FormField label="Plan" name="plan_name">
              <Select
                value={editForm.plan_name}
                onChange={(e) => setEditForm((prev) => ({ ...prev, plan_name: e.target.value }))}
                options={plans.map((p) => ({ value: p.value, label: p.label }))}
                placeholder="Select plan"
              />
            </FormField>
            <FormField label="Status" name="status">
              <Select
                value={editForm.status}
                onChange={(e) => setEditForm((prev) => ({ ...prev, status: e.target.value }))}
                options={STATUS_OPTIONS.filter((o) => o.value)}
                placeholder="Select status"
              />
            </FormField>
            <div className="grid gap-4 md:grid-cols-2">
              <FormField label="Start Date" name="start_date">
                <Input
                  type="date"
                  value={editForm.start_date}
                  onChange={(e) => setEditForm((prev) => ({ ...prev, start_date: e.target.value }))}
                />
              </FormField>
              <FormField label="End Date" name="end_date">
                <Input
                  type="date"
                  value={editForm.end_date}
                  onChange={(e) => setEditForm((prev) => ({ ...prev, end_date: e.target.value }))}
                />
              </FormField>
            </div>
            <FormField label="Extend by days" name="extend_days">
              <Input
                type="number"
                min={1}
                placeholder="Optional quick extension"
                value={editForm.extend_days}
                onChange={(e) => setEditForm((prev) => ({ ...prev, extend_days: e.target.value }))}
              />
            </FormField>
          </div>
        )}
      </CommonModal>
    </div>
  );
};

const OwnerSubscriptionManagement = () => {
  const { data: subscription, isLoading } = useGetMySubscriptionQuery();

  if (isLoading) {
    return <div className="p-8">Loading subscription...</div>;
  }

  if (!subscription) {
    return <div className="p-8">Subscription information is not available.</div>;
  }

  return (
    <div className="mx-auto max-w-5xl space-y-8 p-4 md:p-8">
      <div>
        <h1 className="text-3xl font-bold text-[var(--color-text-primary)]">Subscription Management</h1>
        <p className="mt-1 text-[var(--color-text-secondary)]">
          View your current plan and billing history. Contact your administrator to renew.
        </p>
      </div>

      <section className="rounded-2xl border border-[var(--color-border-soft)] bg-white p-6 shadow-soft">
        <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold">
          <Shield className="h-5 w-5 text-[var(--color-brand-gold)]" />
          Current Subscription
        </h2>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          <div>
            <p className="text-xs uppercase tracking-wide text-[var(--color-text-secondary)]">Plan</p>
            <p className="mt-1 font-semibold">{subscription.plan_label}</p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wide text-[var(--color-text-secondary)]">Status</p>
            <p className={`mt-1 font-semibold ${subscription.is_expired ? 'text-red-600' : 'text-emerald-600'}`}>
              {subscription.status}
            </p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wide text-[var(--color-text-secondary)]">Days Remaining</p>
            <p className="mt-1 font-semibold">{subscription.days_remaining}</p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wide text-[var(--color-text-secondary)]">Start Date</p>
            <p className="mt-1 font-semibold">{formatDateDMY(subscription.start_date)}</p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wide text-[var(--color-text-secondary)]">End Date</p>
            <p className="mt-1 font-semibold">{formatDateDMY(subscription.end_date)}</p>
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-[var(--color-border-soft)] bg-white p-6 shadow-soft">
        <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold">
          <CreditCard className="h-5 w-5 text-[var(--color-brand-gold)]" />
          Available Plans
        </h2>
        <div className="grid gap-3 sm:grid-cols-2">
          {subscription.available_plans.map((plan) => (
            <div
              key={plan.value}
              className={`rounded-xl border px-4 py-3 ${
                plan.value === subscription.plan_name
                  ? 'border-[var(--color-brand-gold)] bg-[var(--color-brand-gold-light)]/10'
                  : 'border-[var(--color-border-soft)]'
              }`}
            >
              <p className="font-medium">{plan.label}</p>
              {plan.value === subscription.plan_name && (
                <p className="mt-1 text-xs text-[var(--color-brand-gold)]">Current plan</p>
              )}
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-2xl border border-[var(--color-border-soft)] bg-white p-6 shadow-soft">
        <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold">
          <Calendar className="h-5 w-5 text-[var(--color-brand-gold)]" />
          Billing History
        </h2>
        {subscription.billing_history.length ? (
          <div className="space-y-3">
            {subscription.billing_history.map((item, index) => (
              <div key={`${item.date}-${index}`} className="rounded-xl border border-[var(--color-border-soft)] px-4 py-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-medium">{item.plan_label}</span>
                  <span className="text-sm text-[var(--color-text-secondary)]">
                    {formatDateDMY(item.date)}
                  </span>
                </div>
                <p className="mt-1 text-sm text-[var(--color-text-secondary)]">{item.notes || item.action}</p>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-[var(--color-text-secondary)]">No billing history yet.</p>
        )}
      </section>

      <section className="rounded-2xl border border-[var(--color-border-soft)] bg-[var(--color-surface-bg)] p-6">
        <h2 className="mb-2 flex items-center gap-2 font-semibold">
          <Mail className="h-4 w-4 text-[var(--color-brand-gold)]" />
          Contact Support
        </h2>
        <p className="text-sm text-[var(--color-text-secondary)]">
          To renew or change your plan, contact your MyChair administrator at{' '}
          <a href="mailto:support@mychair.com" className="text-[var(--color-brand-gold)] underline">
            support@mychair.com
          </a>
          .
        </p>
      </section>
    </div>
  );
};

const SubscriptionManagement = () => {
  const user = useAppSelector((state) => state.auth.user);
  return isSuperAdmin(user?.role) ? <AdminSubscriptionManagement /> : <OwnerSubscriptionManagement />;
};

export default SubscriptionManagement;
