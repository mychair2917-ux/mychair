import React, { useEffect, useMemo, useState } from 'react';
import { Bell, BriefcaseBusiness, Mail, Send, Settings, Shapes } from 'lucide-react';
import { Navigate } from 'react-router-dom';

import { Button, CommonCard, Input, Select } from '../../components/common';
import { showToast } from '../../components/common/Toast/toastService';
import { canAccessModule, isSuperAdmin, MODULES, normalizeRole } from '../../config/rbac';
import { ROUTE_PATHS } from '../../constants';
import { useAppSelector } from '../../redux/hooks';
import {
  useCloneNotificationTemplateMutation,
  useCreateCommunicationCampaignMutation,
  useCreateNotificationTemplateMutation,
  useDeleteNotificationTemplateMutation,
  useGetNotificationPreferencesQuery,
  useListBusinessAlertsQuery,
  useListCommunicationCampaignsQuery,
  useListCommunicationLogsQuery,
  useListNotificationsQuery,
  useListNotificationTemplatesQuery,
  useListSubscriptionNotificationsQuery,
  useMarkAllNotificationsReadMutation,
  useMarkNotificationReadMutation,
  useSendCommunicationCampaignMutation,
  useUpdateNotificationPreferencesMutation,
} from '../../redux/slices/notifications/notificationsApi';
import type { NotificationPreferences } from '../../redux/slices/notifications/Types';
import { formatDateDMY } from '../../utils/utilities';

const PAGE_SIZE = 12;
const categories = ['APPOINTMENT', 'PAYMENT', 'STAFF', 'SUBSCRIPTION', 'INVENTORY', 'ATTENDANCE', 'LEAVE', 'CUSTOMER', 'GENERAL'];
const categoryLabels: Record<string, string> = {
  APPOINTMENT: 'Booking Notifications',
  PAYMENT: 'Payment Notifications',
  STAFF: 'Staff Notifications',
  SUBSCRIPTION: 'Subscription Notifications',
  INVENTORY: 'Inventory Notifications',
  ATTENDANCE: 'Attendance Notifications',
  LEAVE: 'Leave Notifications',
  CUSTOMER: 'Customer Notifications',
  GENERAL: 'System Notifications',
};
const templateTypes = ['APPOINTMENT', 'BILLING', 'MEMBERSHIP', 'MARKETING', 'SUBSCRIPTION', 'INVENTORY'];
const variables = ['{{customer_name}}', '{{staff_name}}', '{{salon_name}}', '{{appointment_date}}', '{{membership_name}}', '{{amount}}'];

const tabs = [
  { id: 'notifications', label: 'Notifications', icon: Bell },
  { id: 'communication', label: 'Customer Communication', icon: Mail },
  { id: 'alerts', label: 'Business Alerts', icon: BriefcaseBusiness },
  { id: 'templates', label: 'Templates', icon: Shapes },
  { id: 'settings', label: 'Settings', icon: Settings },
] as const;

type TabId = (typeof tabs)[number]['id'];

const NotificationsCommunication: React.FC = () => {
  const user = useAppSelector((state) => state.auth.user);
  const permissions = useAppSelector((state) => state.auth.permissions);
  const selectedSalonId = useAppSelector((state) => state.auth.selectedSalonId);
  const [activeTab, setActiveTab] = useState<TabId>('notifications');
  const [notificationPage, setNotificationPage] = useState(1);
  const [notificationCategory, setNotificationCategory] = useState('');
  const [notificationType, setNotificationType] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [campaignForm, setCampaignForm] = useState({
    name: '',
    communication_type: 'EMAIL' as 'EMAIL' | 'WHATSAPP' | 'BOTH',
    audience: 'ALL_CUSTOMERS',
    subject: '',
    body: '',
    send_now: true,
    scheduled_for: '',
  });
  const [templateForm, setTemplateForm] = useState({
    name: '',
    template_type: 'MARKETING',
    channel: 'EMAIL',
    subject: '',
    body: '',
  });
  const [preferenceDraft, setPreferenceDraft] = useState<NotificationPreferences | null>(null);

  const role = normalizeRole(user?.role);
  const canCreateCampaign = role !== 'employee';
  const canManageTemplates = role === 'super_admin' || role === 'salon_owner' || role === 'salon_admin';
  const canViewSubscription = role === 'super_admin' || role === 'salon_owner' || role === 'salon_admin';
  const salonId = selectedSalonId || undefined;

  const notificationsQuery = useListNotificationsQuery({
    page: notificationPage,
    limit: PAGE_SIZE,
    category: notificationCategory || undefined,
    notification_type: notificationType || undefined,
    date_from: dateFrom || undefined,
    date_to: dateTo || undefined,
    salon_id: salonId,
  });
  const templatesQuery = useListNotificationTemplatesQuery({ page: 1, limit: 50, salon_id: salonId });
  const campaignsQuery = useListCommunicationCampaignsQuery(
    { page: 1, limit: 20, salon_id: salonId },
    { skip: !canCreateCampaign, pollingInterval: activeTab === 'communication' ? 5000 : 0 }
  );
  const logsQuery = useListCommunicationLogsQuery(
    { page: 1, limit: 20 },
    { skip: !canCreateCampaign, pollingInterval: activeTab === 'communication' ? 5000 : 0 }
  );
  const alertsQuery = useListBusinessAlertsQuery({ page: 1, limit: 30, salon_id: salonId });
  const subscriptionQuery = useListSubscriptionNotificationsQuery({ page: 1, limit: 20, salon_id: salonId }, { skip: !canViewSubscription });
  const preferencesQuery = useGetNotificationPreferencesQuery();

  const [markRead] = useMarkNotificationReadMutation();
  const [markAllRead] = useMarkAllNotificationsReadMutation();
  const [createCampaign, { isLoading: isCreatingCampaign }] = useCreateCommunicationCampaignMutation();
  const [sendCampaign, { isLoading: isSendingCampaign }] = useSendCommunicationCampaignMutation();
  const [createTemplate, { isLoading: isCreatingTemplate }] = useCreateNotificationTemplateMutation();
  const [cloneTemplate] = useCloneNotificationTemplateMutation();
  const [deleteTemplate] = useDeleteNotificationTemplateMutation();
  const [updatePreferences, { isLoading: isUpdatingPreferences }] = useUpdateNotificationPreferencesMutation();

  useEffect(() => {
    if (preferencesQuery.data?.data) {
      setPreferenceDraft(preferencesQuery.data.data);
    }
  }, [preferencesQuery.data?.data]);

  const pageTitle = useMemo(() => {
    if (isSuperAdmin(user?.role)) return 'Platform Notifications & Communication';
    if (role === 'employee') return 'My Notifications';
    return 'Notifications & Customer Communication';
  }, [role, user?.role]);

  if (!canAccessModule(user?.role, MODULES.NOTIFICATIONS_COMMUNICATION, permissions)) {
    return <Navigate to={`/${ROUTE_PATHS.NOT_FOUND}`} replace />;
  }

  const handleCreateCampaign = async (event: React.FormEvent) => {
    event.preventDefault();
    try {
      const response = await createCampaign({
        ...campaignForm,
        scheduled_for: campaignForm.send_now ? undefined : campaignForm.scheduled_for || undefined,
        salon_id: salonId,
      }).unwrap();
      showToast('success', response.message || (campaignForm.send_now ? 'Campaign send started' : 'Campaign saved'));
      setCampaignForm({ name: '', communication_type: 'EMAIL', audience: 'ALL_CUSTOMERS', subject: '', body: '', send_now: true, scheduled_for: '' });
    } catch {
      showToast('error', 'Failed to create campaign');
    }
  };

  const handleSendCampaign = async (campaignId: string) => {
    try {
      const response = await sendCampaign(campaignId).unwrap();
      showToast('success', response.message || 'Campaign send started');
    } catch {
      showToast('error', 'Failed to send campaign');
    }
  };

  const handleCreateTemplate = async (event: React.FormEvent) => {
    event.preventDefault();
    try {
      const response = await createTemplate({
        ...templateForm,
        variables,
        salon_id: salonId,
      }).unwrap();
      showToast('success', response.message || 'Template created');
      setTemplateForm({ name: '', template_type: 'MARKETING', channel: 'EMAIL', subject: '', body: '' });
    } catch {
      showToast('error', 'Failed to create template');
    }
  };

  const updatePreferenceFlag = async (
    key: 'email_enabled' | 'whatsapp_enabled' | 'sound_enabled' | 'browser_notification_enabled' | 'popup_toast_enabled',
    value: boolean
  ) => {
    const previous = preferenceDraft;
    if (!previous) return;
    setPreferenceDraft({ ...previous, [key]: value });
    try {
      if (key === 'browser_notification_enabled' && value && 'Notification' in window && Notification.permission === 'default') {
        await Notification.requestPermission();
      }
      await updatePreferences({ [key]: value } as Partial<NotificationPreferences>).unwrap();
      showToast('success', 'Notification setting updated');
    } catch {
      setPreferenceDraft(previous);
      showToast('error', 'Failed to update notification setting');
    }
  };

  const updateCategoryPreference = async (category: string, channel: 'in_app' | 'sound' | 'email' | 'whatsapp', value: boolean) => {
    const previous = preferenceDraft;
    if (!previous) return;
    const next: NotificationPreferences = {
      ...previous,
      categories: {
        ...previous.categories,
        [category]: {
          ...previous.categories[category],
          [channel]: value,
        },
      },
    };
    setPreferenceDraft(next);
    try {
      await updatePreferences({ categories: next.categories }).unwrap();
    } catch {
      setPreferenceDraft(previous);
      showToast('error', 'Failed to update notification setting');
    }
  };

  return (
    <div className="space-y-6 p-4 sm:p-6 md:p-8">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[var(--color-brand-gold-dark)]">
            Notification Center
          </p>
          <h1 className="mt-2 text-3xl font-bold text-gray-950">{pageTitle}</h1>
          <p className="mt-2 max-w-3xl text-sm text-gray-500">
            Real-time alerts, customer campaigns, reusable templates, delivery logs, and per-user notification preferences.
          </p>
        </div>
        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-amber-700">Unread</p>
          <p className="text-3xl font-bold text-amber-900">{notificationsQuery.data?.data.unread_count ?? 0}</p>
        </div>
      </div>

      <div className="flex gap-2 overflow-x-auto rounded-2xl border border-[var(--color-border-soft)] bg-white p-2">
        {tabs
          .filter((tab) => tab.id !== 'communication' || canCreateCampaign)
          .filter((tab) => tab.id !== 'templates' || role !== 'employee')
          .map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`flex min-w-fit items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold transition-colors ${
                activeTab === tab.id
                  ? 'bg-[var(--color-brand-gold-dark)] text-white'
                  : 'text-gray-600 hover:bg-[var(--color-surface-bg)]'
              }`}
            >
              <tab.icon className="h-4 w-4" />
              {tab.label}
            </button>
          ))}
      </div>

      {activeTab === 'notifications' && (
        <CommonCard title="Notification History" subtitle="Filter, review, and mark notifications as read.">
          <div className="mb-5 grid gap-3 md:grid-cols-5">
            <Select
              value={notificationCategory}
              onChange={(event) => setNotificationCategory(event.target.value)}
              placeholder="All categories"
              options={categories.map((item) => ({ value: item, label: categoryLabels[item] ?? item }))}
            />
            <Input placeholder="Type filter" value={notificationType} onChange={(event) => setNotificationType(event.target.value)} />
            <Input type="date" value={dateFrom} onChange={(event) => setDateFrom(event.target.value)} />
            <Input type="date" value={dateTo} onChange={(event) => setDateTo(event.target.value)} />
            <Button onClick={() => markAllRead({ salon_id: salonId })}>Mark all as read</Button>
          </div>
          <div className="space-y-3">
            {notificationsQuery.data?.data.items.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => !item.is_read && markRead(item.id)}
                className={`w-full rounded-2xl border p-4 text-left transition-colors hover:bg-gray-50 ${
                  item.is_read ? 'border-gray-200 bg-white' : 'border-amber-200 bg-amber-50'
                }`}
              >
                <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
                  <div>
                    <p className="text-sm font-bold text-gray-900">{item.title}</p>
                    <p className="mt-1 text-sm text-gray-600">{item.body}</p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2 text-xs text-gray-500">
                    <span className="rounded-full bg-gray-100 px-2 py-1">{item.category}</span>
                    <span>{formatDateDMY(item.created_at)}</span>
                  </div>
                </div>
              </button>
            ))}
            {!notificationsQuery.isFetching && (notificationsQuery.data?.data.items.length ?? 0) === 0 && (
              <div className="rounded-2xl border border-dashed border-gray-200 p-8 text-center text-sm text-gray-500">
                No notifications found.
              </div>
            )}
          </div>
          {(notificationsQuery.data?.data.pages ?? 1) > 1 && (
            <div className="mt-5 flex justify-end gap-2">
              <Button disabled={notificationPage === 1} onClick={() => setNotificationPage((page) => Math.max(1, page - 1))}>Previous</Button>
              <Button disabled={notificationPage >= (notificationsQuery.data?.data.pages ?? 1)} onClick={() => setNotificationPage((page) => page + 1)}>Next</Button>
            </div>
          )}
        </CommonCard>
      )}

      {activeTab === 'communication' && canCreateCampaign && (
        <div className="grid gap-6 xl:grid-cols-[1fr_1fr]">
          <CommonCard title="Create Campaign" subtitle="Send email, WhatsApp, or both to customer audiences.">
            <form className="space-y-4" onSubmit={handleCreateCampaign}>
              <Input required placeholder="Campaign name" value={campaignForm.name} onChange={(event) => setCampaignForm((form) => ({ ...form, name: event.target.value }))} />
              <div className="grid gap-3 md:grid-cols-2">
                <Select
                  value={campaignForm.communication_type}
                  onChange={(event) => setCampaignForm((form) => ({ ...form, communication_type: event.target.value as 'EMAIL' | 'WHATSAPP' | 'BOTH' }))}
                  options={[
                    { value: 'EMAIL', label: 'Email' },
                    { value: 'WHATSAPP', label: 'WhatsApp' },
                    { value: 'BOTH', label: 'Both' },
                  ]}
                />
                <Select
                  value={campaignForm.audience}
                  onChange={(event) => setCampaignForm((form) => ({ ...form, audience: event.target.value }))}
                  options={[
                    { value: 'ALL_CUSTOMERS', label: 'All Customers' },
                    { value: 'ACTIVE_CUSTOMERS', label: 'Active Customers' },
                    { value: 'VIP_CUSTOMERS', label: 'VIP Customers' },
                    { value: 'MEMBERSHIP_CUSTOMERS', label: 'Membership Customers' },
                    { value: 'SELECTED_CUSTOMERS', label: 'Selected Customers' },
                  ]}
                />
              </div>
              <Input placeholder="Message subject" value={campaignForm.subject} onChange={(event) => setCampaignForm((form) => ({ ...form, subject: event.target.value }))} />
              <textarea required className="min-h-36 w-full rounded-xl border border-gray-200 px-4 py-3 text-sm outline-none focus:border-[var(--color-brand-gold-dark)]" placeholder="Message body" value={campaignForm.body} onChange={(event) => setCampaignForm((form) => ({ ...form, body: event.target.value }))} />
              <div className="flex flex-wrap items-center gap-4">
                <label className="flex items-center gap-2 text-sm text-gray-700">
                  <input type="checkbox" checked={campaignForm.send_now} onChange={(event) => setCampaignForm((form) => ({ ...form, send_now: event.target.checked }))} />
                  Send now
                </label>
                {!campaignForm.send_now && (
                  <Input type="datetime-local" value={campaignForm.scheduled_for} onChange={(event) => setCampaignForm((form) => ({ ...form, scheduled_for: event.target.value }))} />
                )}
              </div>
              <Button type="submit" disabled={isCreatingCampaign}>
                <Send className="mr-2 h-4 w-4" />
                {isCreatingCampaign ? 'Saving...' : campaignForm.send_now ? 'Send Campaign' : 'Save Campaign'}
              </Button>
            </form>
          </CommonCard>
          <CommonCard title="Campaigns & Delivery Logs" subtitle="Sent/delivered/failed counts are persisted per campaign and recipient.">
            <div className="space-y-3">
              {campaignsQuery.data?.data.items.map((item) => {
                const totalJobs = item.totals.total_jobs ?? item.totals.total_recipients ?? 0;
                const completedJobs = (item.totals.sent ?? 0) + (item.totals.failed ?? 0);
                const progress = totalJobs ? Math.min(100, Math.round((completedJobs / totalJobs) * 100)) : 0;
                return (
                  <div key={item.id} className="rounded-2xl border border-gray-200 p-4">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <p className="font-semibold text-gray-900">{item.name}</p>
                        <p className="text-xs text-gray-500">{item.communication_type} • {item.audience}</p>
                      </div>
                      <span className="rounded-full bg-gray-100 px-2 py-1 text-xs font-semibold">{item.status.replace('_', ' ')}</span>
                    </div>
                    <div className="mt-4 h-2 overflow-hidden rounded-full bg-gray-100">
                      <div className="h-full rounded-full bg-[var(--color-brand-gold-dark)] transition-all" style={{ width: `${progress}%` }} />
                    </div>
                    <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-gray-500">
                      <span>Recipients {item.totals.total_recipients ?? 0}</span>
                      <span>Pending {item.totals.pending ?? 0}</span>
                      <span>Sent {item.totals.sent ?? 0}</span>
                      <span>Delivered {item.totals.delivered ?? 0}</span>
                      <span>Failed {item.totals.failed ?? 0}</span>
                    </div>
                    {['DRAFT', 'SCHEDULED', 'FAILED', 'PARTIALLY_SENT'].includes(item.status) && (
                      <Button className="mt-4" variant="secondary" disabled={isSendingCampaign} onClick={() => handleSendCampaign(item.id)}>
                        Send Campaign
                      </Button>
                    )}
                  </div>
                );
              })}
              {campaignsQuery.isFetching && <p className="text-xs text-gray-400">Refreshing campaign progress...</p>}
              {logsQuery.data?.data.items.slice(0, 6).map((log) => (
                <div key={log.id} className="rounded-xl bg-gray-50 px-3 py-2 text-xs text-gray-600">
                  {log.channel} to {log.recipient_address || '-'}: {log.status}
                  {log.error_message ? <span className="ml-1 text-red-600">({log.error_message})</span> : null}
                </div>
              ))}
            </div>
          </CommonCard>
        </div>
      )}

      {activeTab === 'alerts' && (
        <div className="grid gap-6 xl:grid-cols-2">
          <CommonCard title="Business Alerts" subtitle="Inventory, HR, operations, finance, membership, and package alerts.">
            <div className="space-y-3">
              {alertsQuery.data?.data.items.map((item) => (
                <div key={item.id} className="rounded-2xl border border-gray-200 p-4">
                  <p className="font-semibold text-gray-900">{item.title}</p>
                  <p className="mt-1 text-sm text-gray-600">{item.message}</p>
                  <p className="mt-2 text-xs text-gray-400">{item.category} • {item.priority}</p>
                </div>
              ))}
              {(alertsQuery.data?.data.items.length ?? 0) === 0 && <p className="text-sm text-gray-500">No active business alerts.</p>}
            </div>
          </CommonCard>
          {canViewSubscription && (
            <CommonCard title="Subscription Notifications" subtitle="Trial, expiry, payment, upgrade, and downgrade notices.">
              <div className="space-y-3">
                {subscriptionQuery.data?.data.items.map((item) => (
                  <div key={item.id} className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
                    <p className="font-semibold text-amber-950">{item.title}</p>
                    <p className="mt-1 text-sm text-amber-800">{item.message}</p>
                  </div>
                ))}
                {(subscriptionQuery.data?.data.items.length ?? 0) === 0 && <p className="text-sm text-gray-500">No subscription notifications.</p>}
              </div>
            </CommonCard>
          )}
        </div>
      )}

      {activeTab === 'templates' && role !== 'employee' && (
        <div className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
          {canManageTemplates && (
            <CommonCard title="Create Template" subtitle="Use variables like {{customer_name}} and {{appointment_date}}.">
              <form className="space-y-4" onSubmit={handleCreateTemplate}>
                <Input required placeholder="Template name" value={templateForm.name} onChange={(event) => setTemplateForm((form) => ({ ...form, name: event.target.value }))} />
                <div className="grid gap-3 md:grid-cols-2">
                  <Select
                    value={templateForm.template_type}
                    onChange={(event) => setTemplateForm((form) => ({ ...form, template_type: event.target.value }))}
                    options={templateTypes.map((item) => ({ value: item, label: item }))}
                  />
                  <Select
                    value={templateForm.channel}
                    onChange={(event) => setTemplateForm((form) => ({ ...form, channel: event.target.value }))}
                    options={[
                      { value: 'EMAIL', label: 'Email' },
                      { value: 'WHATSAPP', label: 'WhatsApp' },
                      { value: 'IN_APP', label: 'In-App' },
                    ]}
                  />
                </div>
                <Input placeholder="Subject" value={templateForm.subject} onChange={(event) => setTemplateForm((form) => ({ ...form, subject: event.target.value }))} />
                <textarea required className="min-h-36 w-full rounded-xl border border-gray-200 px-4 py-3 text-sm outline-none focus:border-[var(--color-brand-gold-dark)]" placeholder="Template body" value={templateForm.body} onChange={(event) => setTemplateForm((form) => ({ ...form, body: event.target.value }))} />
                <div className="flex flex-wrap gap-2">
                  {variables.map((item) => <span key={item} className="rounded-full bg-gray-100 px-2 py-1 text-xs text-gray-600">{item}</span>)}
                </div>
                <Button type="submit" disabled={isCreatingTemplate}>{isCreatingTemplate ? 'Creating...' : 'Create Template'}</Button>
              </form>
            </CommonCard>
          )}
          <CommonCard title="Template Library" subtitle={canManageTemplates ? 'Create, edit, delete, preview, and clone templates.' : 'Use approved templates for communication.'}>
            <div className="space-y-3">
              {templatesQuery.data?.data.items.map((item) => (
                <div key={item.id} className="rounded-2xl border border-gray-200 p-4">
                  <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                    <div>
                      <p className="font-semibold text-gray-900">{item.name}</p>
                      <p className="text-xs text-gray-500">{item.template_type} • {item.channel} • {item.status}</p>
                      <p className="mt-2 line-clamp-2 text-sm text-gray-600">{item.body}</p>
                    </div>
                    {canManageTemplates && (
                      <div className="flex gap-2">
                        <Button variant="secondary" onClick={() => cloneTemplate(item.id)}>Clone</Button>
                        <Button variant="secondary" onClick={() => deleteTemplate(item.id)}>Delete</Button>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CommonCard>
        </div>
      )}

      {activeTab === 'settings' && (
        <CommonCard title="Notification Settings" subtitle="Saved per user and respected by realtime alerts.">
          {preferencesQuery.isLoading && <p className="mb-4 text-sm text-gray-500">Loading notification settings...</p>}
          {preferencesQuery.isError && <p className="mb-4 text-sm text-red-600">Unable to load notification settings.</p>}
          <div className="grid gap-4 md:grid-cols-3">
            {[
              ['email_enabled', 'Email Notifications'],
              ['whatsapp_enabled', 'WhatsApp Notifications'],
              ['browser_notification_enabled', 'Browser Notifications'],
              ['sound_enabled', 'Sound Notifications'],
              ['popup_toast_enabled', 'Popup Toast'],
            ].map(([key, label]) => (
              <label key={key} className="flex items-center justify-between rounded-2xl border border-gray-200 p-4 text-sm font-semibold text-gray-800">
                {label}
                <input
                  type="checkbox"
                  disabled={!preferenceDraft || isUpdatingPreferences}
                  checked={Boolean(preferenceDraft?.[key as keyof NotificationPreferences])}
                  onChange={(event) => updatePreferenceFlag(key as 'email_enabled' | 'whatsapp_enabled' | 'sound_enabled' | 'browser_notification_enabled' | 'popup_toast_enabled', event.target.checked)}
                />
              </label>
            ))}
          </div>
          <div className="mt-6 overflow-x-auto">
            <table className="w-full min-w-[780px] text-left text-sm">
              <thead>
                <tr className="border-b border-gray-200 text-xs uppercase text-gray-500">
                  <th className="py-3">Alert Type</th>
                  <th>In-App</th>
                  <th>Sound</th>
                  <th>Email</th>
                  <th>WhatsApp</th>
                </tr>
              </thead>
              <tbody>
                {categories.map((category) => {
                  const categoryPrefs = preferenceDraft?.categories[category];
                  return (
                    <tr key={category} className="border-b border-gray-100">
                      <td className="py-3 font-semibold text-gray-800">{categoryLabels[category] ?? category}</td>
                      {(['in_app', 'sound', 'email', 'whatsapp'] as const).map((channel) => (
                        <td key={channel}>
                          <input
                            type="checkbox"
                            disabled={!preferenceDraft || isUpdatingPreferences}
                            checked={categoryPrefs?.[channel] ?? false}
                            onChange={(event) => updateCategoryPreference(category, channel, event.target.checked)}
                          />
                        </td>
                      ))}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </CommonCard>
      )}
    </div>
  );
};

export default NotificationsCommunication;
