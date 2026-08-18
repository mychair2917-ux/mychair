import { useMemo, useState } from 'react';
import {
  Calendar,
  CheckSquare,
  CreditCard,
  Layers,
  Mail,
  RefreshCw,
  Search,
  Settings2,
  Shield,
  ShieldCheck,
  Sliders,
  Sparkles,
  Square,
  Users,
} from 'lucide-react';

import { Button, CommonModal, FormField, Input, Select } from '../../components/common';
import { showToast } from '../../components/common/Toast/toastService';
import { isSuperAdmin } from '../../config/rbac';
import {
  useGetAdminPlansQuery,
  useGetDefaultSubscriptionDaysQuery,
  useGetFeatureCatalogQuery,
  useGetMySubscriptionQuery,
  useGetSubscriptionDashboardQuery,
  useGetSubscriptionPlansQuery,
  useListSubscriptionsQuery,
  useUpdateDefaultSubscriptionDaysMutation,
  useUpdatePlanFeaturesMutation,
  useUpdateSubscriptionMutation,
} from '../../redux/slices/subscriptions/subscriptionsApi';
import type { AdminPlanConfig, FeatureItem, SubscriptionRecord } from '../../redux/slices/subscriptions/Types';
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

const CATEGORY_ORDER = [
  'Core',
  'Client & Appointment',
  'Staff',
  'Finance & Analytics',
  'Communication',
];

const AdminSubscriptionManagement = () => {
  const [activeTab, setActiveTab] = useState<'subscriptions' | 'plans'>('subscriptions');

  // Subscriptions tab state
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [planFilter, setPlanFilter] = useState('');
  const [selectedSub, setSelectedSub] = useState<SubscriptionRecord | null>(null);
  const [defaultDaysInput, setDefaultDaysInput] = useState('');
  const [editForm, setEditForm] = useState({
    plan_name: '',
    status: '',
    start_date: '',
    end_date: '',
    extend_days: '',
  });

  // Plans & Features tab state
  const [selectedPlanKey, setSelectedPlanKey] = useState<string | null>(null);
  const [selectedFeatures, setSelectedFeatures] = useState<string[]>([]);
  const [featureSearch, setFeatureSearch] = useState('');

  const { data: dashboard, isLoading: dashboardLoading } = useGetSubscriptionDashboardQuery();
  const { data: plans = [] } = useGetSubscriptionPlansQuery();
  const { data: defaultDaysData } = useGetDefaultSubscriptionDaysQuery();
  const { data: subscriptions = [], isFetching, refetch } = useListSubscriptionsQuery({
    search: search || undefined,
    status: statusFilter || undefined,
    plan_name: planFilter || undefined,
  });
  const { data: adminPlans = [], isLoading: loadingAdminPlans, refetch: refetchAdminPlans } = useGetAdminPlansQuery();
  const { data: featureCatalog = [] } = useGetFeatureCatalogQuery();

  const [updateDefaultDays, { isLoading: savingDefaultDays }] = useUpdateDefaultSubscriptionDaysMutation();
  const [updateSubscription, { isLoading: savingSubscription }] = useUpdateSubscriptionMutation();
  const [updatePlanFeatures, { isLoading: savingPlanFeatures }] = useUpdatePlanFeaturesMutation();

  const planOptions = useMemo(
    () => [{ value: '', label: 'All plans' }, ...plans.map((p) => ({ value: p.value, label: p.label }))],
    [plans]
  );

  const currentSelectedPlan = useMemo(
    () => adminPlans.find((p) => p.plan_key === selectedPlanKey),
    [adminPlans, selectedPlanKey]
  );

  const openEditModal = (record: SubscriptionRecord) => {
    setSelectedSub(record);
    setEditForm({
      plan_name: record.plan_name,
      status: record.status,
      start_date: toDateInputValue(record.start_date),
      end_date: toDateInputValue(record.end_date),
      extend_days: '',
    });
  };

  const openManagePlanModal = (plan: AdminPlanConfig) => {
    setSelectedPlanKey(plan.plan_key);
    setSelectedFeatures(plan.features || []);
    setFeatureSearch('');
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
    if (!selectedSub) return;
    try {
      await updateSubscription({
        id: selectedSub.id,
        body: {
          plan_name: editForm.plan_name || undefined,
          status: editForm.status || undefined,
          start_date: editForm.start_date ? `${editForm.start_date}T00:00:00Z` : undefined,
          end_date: editForm.end_date ? `${editForm.end_date}T23:59:59Z` : undefined,
          extend_days: editForm.extend_days ? Number(editForm.extend_days) : undefined,
        },
      }).unwrap();
      showToast('success', 'Subscription updated');
      setSelectedSub(null);
    } catch {
      showToast('error', 'Failed to update subscription');
    }
  };

  const handleSavePlanFeatures = async () => {
    if (!selectedPlanKey) return;
    try {
      await updatePlanFeatures({
        plan_key: selectedPlanKey,
        features: selectedFeatures,
      }).unwrap();
      showToast('success', `Plan features updated for ${currentSelectedPlan?.display_name || selectedPlanKey}`);
      setSelectedPlanKey(null);
    } catch {
      showToast('error', 'Failed to update plan features');
    }
  };

  const toggleFeature = (key: string) => {
    setSelectedFeatures((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
    );
  };

  const selectAllFeatures = () => {
    setSelectedFeatures(featureCatalog.map((f) => f.key));
  };

  const clearAllFeatures = () => {
    setSelectedFeatures([]);
  };

  const catalogByCategory = useMemo(() => {
    const map: Record<string, FeatureItem[]> = {};
    const searchLower = featureSearch.toLowerCase().trim();

    featureCatalog.forEach((feature) => {
      if (
        searchLower &&
        !feature.name.toLowerCase().includes(searchLower) &&
        !feature.key.toLowerCase().includes(searchLower) &&
        !feature.category.toLowerCase().includes(searchLower)
      ) {
        return;
      }
      const cat = feature.category || 'Other';
      if (!map[cat]) map[cat] = [];
      map[cat].push(feature);
    });
    return map;
  }, [featureCatalog, featureSearch]);

  return (
    <div className="mx-auto max-w-[1600px] space-y-8 p-4 md:p-8">
      {/* Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-[var(--color-text-primary)]">Subscription Management</h1>
          <p className="mt-1 text-[var(--color-text-secondary)]">
            Manage salon subscriptions, plan feature mappings, and platform defaults.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button
            variant="secondary"
            onClick={() => {
              refetch();
              refetchAdminPlans();
            }}
            className="inline-flex items-center gap-2"
          >
            <RefreshCw className={`h-4 w-4 ${isFetching || loadingAdminPlans ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex border-b border-[var(--color-border-soft)]">
        <button
          type="button"
          onClick={() => setActiveTab('subscriptions')}
          className={`flex items-center gap-2 border-b-2 px-6 py-3 font-semibold text-sm transition-colors ${
            activeTab === 'subscriptions'
              ? 'border-[var(--color-brand-gold)] text-[var(--color-brand-gold)]'
              : 'border-transparent text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]'
          }`}
        >
          <CreditCard className="h-4 w-4" />
          Salon Subscriptions
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('plans')}
          className={`flex items-center gap-2 border-b-2 px-6 py-3 font-semibold text-sm transition-colors ${
            activeTab === 'plans'
              ? 'border-[var(--color-brand-gold)] text-[var(--color-brand-gold)]'
              : 'border-transparent text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]'
          }`}
        >
          <Sliders className="h-4 w-4" />
          Subscription Plans & Features
        </button>
      </div>

      {/* TAB 1: SALON SUBSCRIPTIONS */}
      {activeTab === 'subscriptions' && (
        <div className="space-y-8">
          {/* Dashboard Stats */}
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

          {/* System Configuration */}
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

          {/* Subscriptions Table */}
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
                    <tr key={record.id} className="border-t border-[var(--color-border-soft)] hover:bg-gray-50/50">
                      <td className="px-5 py-4">
                        <div className="font-medium">{record.salon_name}</div>
                        <div className="text-xs text-[var(--color-text-secondary)]">{record.owner_email}</div>
                      </td>
                      <td className="px-5 py-4">
                        <span className="font-semibold text-gray-900">{record.plan_label}</span>
                      </td>
                      <td className="px-5 py-4">
                        <span className={`rounded-full border px-2.5 py-1 text-xs font-medium ${statusBadgeClass(record.status)}`}>
                          {record.status}
                        </span>
                      </td>
                      <td className="px-5 py-4">{formatDateDMY(record.start_date)}</td>
                      <td className="px-5 py-4">{formatDateDMY(record.end_date)}</td>
                      <td className="px-5 py-4 font-medium">{record.days_remaining}</td>
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
        </div>
      )}

      {/* TAB 2: SUBSCRIPTION PLANS & FEATURES */}
      {activeTab === 'plans' && (
        <div className="space-y-8">
          <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="text-xl font-bold text-[var(--color-text-primary)] flex items-center gap-2">
                <ShieldCheck className="h-6 w-6 text-[var(--color-brand-gold)]" />
                Subscription Plan Catalog
              </h2>
              <p className="text-sm text-[var(--color-text-secondary)]">
                Manage feature availability per subscription tier without redeploying code.
              </p>
            </div>
          </div>

          {/* Admin Plan Cards Grid */}
          <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-4">
            {adminPlans.map((plan) => {
              const totalCat = plan.total_catalog_features || featureCatalog.length || 14;
              const enabledCnt = plan.features?.length || 0;
              const percent = Math.round((enabledCnt / totalCat) * 100);

              return (
                <div
                  key={plan.plan_key}
                  className="relative flex flex-col justify-between rounded-2xl border border-[var(--color-border-soft)] bg-white p-6 shadow-soft transition-all duration-200 hover:shadow-lg"
                >
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-[var(--color-brand-gold)] border border-amber-200">
                        {plan.plan_key}
                      </span>
                      <span className="text-xs font-medium text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                        {plan.status}
                      </span>
                    </div>

                    <div>
                      <h3 className="text-2xl font-bold text-gray-900">{plan.display_name}</h3>
                      <p className="mt-1 text-3xl font-extrabold text-gray-900">
                        {plan.price > 0 ? `$${plan.price}` : 'Free'}
                        <span className="text-xs font-normal text-gray-500"> / month</span>
                      </p>
                    </div>

                    <div className="space-y-2 border-t border-[var(--color-border-soft)] pt-4 text-sm">
                      <div className="flex items-center justify-between text-gray-600">
                        <span className="flex items-center gap-1.5">
                          <Users className="h-4 w-4 text-gray-400" /> Active Salons:
                        </span>
                        <span className="font-bold text-gray-900">{plan.active_subscribers}</span>
                      </div>
                      <div className="flex items-center justify-between text-gray-600">
                        <span className="flex items-center gap-1.5">
                          <Layers className="h-4 w-4 text-gray-400" /> Features:
                        </span>
                        <span className="font-bold text-gray-900">
                          {enabledCnt} / {totalCat}
                        </span>
                      </div>

                      {/* Progress Bar */}
                      <div className="w-full bg-gray-100 rounded-full h-2 mt-2 overflow-hidden">
                        <div
                          className="bg-[var(--color-brand-gold)] h-2 rounded-full transition-all duration-300"
                          style={{ width: `${percent}%` }}
                        />
                      </div>
                    </div>
                  </div>

                  <div className="mt-6 border-t border-[var(--color-border-soft)] pt-4">
                    <Button
                      variant="secondary"
                      className="w-full flex items-center justify-center gap-2 border-[var(--color-brand-gold)] text-[var(--color-brand-gold)] hover:bg-amber-50"
                      onClick={() => openManagePlanModal(plan)}
                    >
                      <Sliders className="h-4 w-4" />
                      Manage Features
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* MODAL 1: EDIT SINGLE SALON SUBSCRIPTION */}
      <CommonModal
        open={Boolean(selectedSub)}
        onClose={() => setSelectedSub(null)}
        title="Manage Subscription"
        size="lg"
        footer={
          <div className="flex justify-end gap-3">
            <Button variant="secondary" onClick={() => setSelectedSub(null)}>
              Cancel
            </Button>
            <Button onClick={handleSaveSubscription} isLoading={savingSubscription}>
              Save Changes
            </Button>
          </div>
        }
      >
        {selectedSub && (
          <div className="space-y-4">
            <p className="text-sm text-[var(--color-text-secondary)]">
              {selectedSub.salon_name} · {selectedSub.owner_email}
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
            {editForm.status === 'ACTIVE' && selectedSub.status === 'EXPIRED' && (
              <p className="text-xs text-[var(--color-text-secondary)]">
                Activating an expired subscription renews it from today using the default
                subscription days, unless you set a future end date or extend by days.
              </p>
            )}
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

      {/* MODAL 2: MANAGE PLAN FEATURES MATRIX */}
      <CommonModal
        open={Boolean(selectedPlanKey)}
        onClose={() => setSelectedPlanKey(null)}
        title={`Manage Plan Features — ${currentSelectedPlan?.display_name || selectedPlanKey}`}
        size="xl"
        footer={
          <div className="flex items-center justify-between w-full">
            <div className="text-xs text-[var(--color-text-secondary)] font-medium">
              {selectedFeatures.length} of {featureCatalog.length} features selected
            </div>
            <div className="flex gap-3">
              <Button variant="secondary" onClick={() => setSelectedPlanKey(null)}>
                Cancel
              </Button>
              <Button onClick={handleSavePlanFeatures} isLoading={savingPlanFeatures}>
                Save Changes
              </Button>
            </div>
          </div>
        }
      >
        {currentSelectedPlan && (
          <div className="space-y-6">
            {/* Plan Info Banner */}
            <div className="rounded-xl border border-amber-200 bg-amber-50/50 p-4 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
              <div>
                <span className="text-xs uppercase font-bold text-amber-700 tracking-wider">Plan Details</span>
                <div className="flex items-center gap-3 mt-1">
                  <h4 className="text-lg font-bold text-gray-900">{currentSelectedPlan.display_name}</h4>
                  <span className="text-xs bg-amber-100 text-amber-800 px-2 py-0.5 rounded font-mono">
                    {currentSelectedPlan.plan_key}
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-4 text-sm text-gray-700">
                <div>
                  <span className="text-xs text-gray-500 block">Status</span>
                  <span className="font-semibold text-emerald-700">{currentSelectedPlan.status}</span>
                </div>
                <div className="border-l border-amber-200 pl-4">
                  <span className="text-xs text-gray-500 block">Price</span>
                  <span className="font-semibold">{currentSelectedPlan.price > 0 ? `$${currentSelectedPlan.price}/mo` : 'Free'}</span>
                </div>
                <div className="border-l border-amber-200 pl-4">
                  <span className="text-xs text-gray-500 block">Active Salons</span>
                  <span className="font-semibold">{currentSelectedPlan.active_subscribers}</span>
                </div>
              </div>
            </div>

            {/* Filter and Quick Controls */}
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                <Input
                  className="pl-10"
                  placeholder="Filter features by name or key..."
                  value={featureSearch}
                  onChange={(e) => setFeatureSearch(e.target.value)}
                />
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <Button variant="secondary" size="sm" onClick={selectAllFeatures}>
                  Select All
                </Button>
                <Button variant="secondary" size="sm" onClick={clearAllFeatures}>
                  Clear All
                </Button>
              </div>
            </div>

            {/* Feature Categories */}
            <div className="space-y-6 max-h-[550px] overflow-y-auto pr-2 custom-scrollbar">
              {CATEGORY_ORDER.map((category) => {
                const categoryFeatures = catalogByCategory[category];
                if (!categoryFeatures || categoryFeatures.length === 0) return null;

                return (
                  <div key={category} className="rounded-xl border border-[var(--color-border-soft)] bg-white p-4 shadow-sm">
                    <h4 className="text-xs uppercase font-extrabold tracking-wider text-gray-500 border-b border-gray-100 pb-2 mb-3 flex items-center gap-2">
                      <Sparkles className="h-3.5 w-3.5 text-[var(--color-brand-gold)]" />
                      {category}
                    </h4>

                    <div className="grid gap-3 sm:grid-cols-2">
                      {categoryFeatures.map((feature) => {
                        const isChecked = selectedFeatures.includes(feature.key);
                        return (
                          <div
                            key={feature.key}
                            onClick={() => toggleFeature(feature.key)}
                            className={`group cursor-pointer rounded-xl border p-3.5 transition-all duration-150 flex items-start gap-3 ${
                              isChecked
                                ? 'border-[var(--color-brand-gold)] bg-amber-50/40 shadow-sm'
                                : 'border-gray-200 bg-gray-50/30 hover:border-gray-300 hover:bg-gray-50'
                            }`}
                          >
                            <button
                              type="button"
                              className="mt-0.5 text-[var(--color-brand-gold)] focus:outline-none shrink-0"
                              onClick={(e) => {
                                e.stopPropagation();
                                toggleFeature(feature.key);
                              }}
                            >
                              {isChecked ? (
                                <CheckSquare className="h-5 w-5 text-[var(--color-brand-gold)]" />
                              ) : (
                                <Square className="h-5 w-5 text-gray-400 group-hover:text-gray-600" />
                              )}
                            </button>
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center justify-between">
                                <span className={`font-semibold text-sm ${isChecked ? 'text-gray-900' : 'text-gray-700'}`}>
                                  {feature.name}
                                </span>
                                <span className="text-[10px] font-mono text-gray-400 bg-white px-1.5 py-0.5 rounded border border-gray-200">
                                  {feature.key}
                                </span>
                              </div>
                              <p className="mt-1 text-xs text-gray-500 leading-snug">
                                {feature.description}
                              </p>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
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
