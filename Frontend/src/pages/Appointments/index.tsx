import React, { useMemo, useState } from 'react';
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  Plus,
  ReceiptText,
  Search,
  Trash2,
  UserPlus,
} from 'lucide-react';
import { useParams } from 'react-router-dom';

import { Button, Input, Select } from '../../components/common';
import { showToast } from '../../components/common/Toast/toastService';
import { useAppSelector } from '../../redux/hooks';
import {
  useCreateAppointmentClientMutation,
  useCreateFrontDeskAppointmentMutation,
  useGetAppointmentClientHistoryQuery,
  useGetAppointmentServicesQuery,
  useGetAppointmentStaffQuery,
  useGetTodayAppointmentsQuery,
  useLazySearchAppointmentClientsQuery,
  useListAppointmentsQuery,
} from '../../redux/slices/appointments/appointmentsApi';
import { AppointmentClient, AppointmentListItem } from '../../redux/slices/appointments/Types';
import { getApiErrorMessage } from '../../utils/apiErrors';

/* ─── types ─────────────────────────────────────────────── */
type Tab = 'entry' | 'list';

type ServiceRow = {
  id: string;
  service_id: string;
  staff_id: string;
  price: string;
};

/* ─── constants ──────────────────────────────────────────── */
const PAGE_SIZE = 15;

const paymentOptions = [
  { value: 'CASH', label: 'Cash' },
  { value: 'UPI', label: 'UPI' },
];

const statusOptions = [
  { value: 'BOOKED', label: 'Booked' },
  { value: 'CHECKED_IN', label: 'Checked in' },
  { value: 'IN_PROGRESS', label: 'In progress' },
  { value: 'COMPLETED', label: 'Completed' },
];

const sourceOptions = [
  { value: 'all', label: 'All entries' },
  { value: 'WALK_IN', label: 'Walk-ins' },
  { value: 'RECEPTIONIST', label: 'Appointments' },
];

const statusStyles: Record<string, string> = {
  BOOKED: 'bg-blue-100 text-blue-700',
  CHECKED_IN: 'bg-amber-100 text-amber-700',
  IN_PROGRESS: 'bg-purple-100 text-purple-700',
  COMPLETED: 'bg-emerald-100 text-emerald-700',
  CANCELLED: 'bg-red-100 text-red-700',
  NO_SHOW: 'bg-gray-100 text-gray-600',
};

/* ─── helpers ────────────────────────────────────────────── */
function createRow(): ServiceRow {
  return { id: crypto.randomUUID(), service_id: '', staff_id: '', price: '' };
}

function toDateTimeInputValue(date: Date): string {
  const pad = (v: number) => String(v).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function formatTime(value: string): string {
  return new Date(value).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function formatDate(value: string): string {
  return new Date(value).toLocaleDateString([], { day: '2-digit', month: 'short', year: 'numeric' });
}

/* ─── sub-components ────────────────────────────────────── */
const AppointmentQueueCard: React.FC<{ appointment: AppointmentListItem }> = ({ appointment }) => (
  <div className="rounded-xl border border-gray-100 bg-gray-50 p-3">
    <div className="flex items-start justify-between gap-3">
      <div>
        <p className="font-semibold text-gray-900">{appointment.customer_name}</p>
        <p className="text-sm text-gray-500">{appointment.customer_phone}</p>
      </div>
      <span
        className={`rounded-full px-2 py-1 text-xs font-medium ${statusStyles[appointment.status] ?? 'bg-gray-100 text-gray-600'}`}
      >
        {appointment.status.toLowerCase().replace('_', ' ')}
      </span>
    </div>
    <div className="mt-3 flex items-center justify-between text-sm">
      <span className="font-medium text-gray-900">{formatTime(appointment.start_datetime)}</span>
      <span className="text-gray-500">₹{appointment.total_price}</span>
    </div>
    <p className="mt-2 line-clamp-2 text-xs text-gray-500">
      {appointment.services.map((s) => s.name).join(', ') || 'No services'}
    </p>
  </div>
);

/* ─── List tab skeleton row ─────────────────────────────── */
const SkeletonRow: React.FC = () => (
  <tr>
    {Array.from({ length: 9 }).map((_, i) => (
      <td key={i} className="px-3 py-3">
        <div className="h-4 animate-pulse rounded bg-gray-200" />
      </td>
    ))}
  </tr>
);

/* ─── Appointment List Tab ───────────────────────────────── */
const AppointmentListTab: React.FC<{ salonId: string }> = ({ salonId }) => {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [sortBy] = useState('start_datetime');
  const [sortOrder, setSortOrder] = useState<'desc' | 'asc'>('desc');
  const [debouncedSearch, setDebouncedSearch] = useState('');

  // Debounce search
  const handleSearchChange = (val: string) => {
    setSearch(val);
    clearTimeout((window as any).__apptSearchTimer);
    (window as any).__apptSearchTimer = setTimeout(() => {
      setDebouncedSearch(val);
      setPage(1);
    }, 400);
  };

  const { data, isLoading, isFetching, isError } = useListAppointmentsQuery(
    {
      salon_id: salonId,
      page,
      limit: PAGE_SIZE,
      search: debouncedSearch || undefined,
      status: statusFilter || undefined,
      sort_by: sortBy,
      sort_order: sortOrder,
    },
    { skip: !salonId }
  );

  const items = data?.data?.items ?? [];
  const total = data?.data?.total ?? 0;
  const totalPages = data?.data?.pages ?? 1;
  const startItem = total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const endItem = Math.min(page * PAGE_SIZE, total);

  return (
    <div className="rounded-2xl border border-gray-200 bg-white shadow-sm">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-3 border-b border-gray-100 p-4">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <Input
            placeholder="Search client name or phone..."
            value={search}
            onChange={(e) => handleSearchChange(e.target.value)}
            className="!pl-9"
          />
        </div>
        <div className="w-40">
          <Select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setPage(1);
            }}
            options={[
              { value: '', label: 'All statuses' },
              ...statusOptions,
              { value: 'CANCELLED', label: 'Cancelled' },
              { value: 'NO_SHOW', label: 'No-show' },
            ]}
            placeholder="Filter status"
          />
        </div>
        <Button
          type="button"
          variant="ghost"
          className="!px-3 !py-2 text-xs"
          onClick={() => setSortOrder((prev) => (prev === 'desc' ? 'asc' : 'desc'))}
        >
          Date {sortOrder === 'desc' ? '↓' : '↑'}
        </Button>
        {isFetching && !isLoading && (
          <span className="text-xs text-gray-400">Refreshing...</span>
        )}
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-100 text-sm">
          <thead className="bg-gray-50 text-xs uppercase tracking-wide">
            <tr>
              <th className="px-3 py-3 text-left font-semibold text-gray-500">ID</th>
              <th className="px-3 py-3 text-left font-semibold text-gray-500">Client</th>
              <th className="px-3 py-3 text-left font-semibold text-gray-500">Phone</th>
              <th className="px-3 py-3 text-left font-semibold text-gray-500">Services</th>
              <th className="px-3 py-3 text-left font-semibold text-gray-500">Staff</th>
              <th className="px-3 py-3 text-left font-semibold text-gray-500">Date & Time</th>
              <th className="px-3 py-3 text-left font-semibold text-gray-500">Status</th>
              <th className="px-3 py-3 text-left font-semibold text-gray-500">Payment</th>
              <th className="px-3 py-3 text-right font-semibold text-gray-500">Bill</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 bg-white">
            {isLoading ? (
              Array.from({ length: 6 }).map((_, i) => <SkeletonRow key={i} />)
            ) : isError ? (
              <tr>
                <td colSpan={9} className="px-3 py-12 text-center text-sm text-red-500">
                  Failed to load appointments. Please try again.
                </td>
              </tr>
            ) : items.length === 0 ? (
              <tr>
                <td colSpan={9} className="px-3 py-16 text-center">
                  <div className="flex flex-col items-center gap-2">
                    <CalendarDays className="h-10 w-10 text-gray-300" />
                    <p className="text-sm font-medium text-gray-500">No appointments found</p>
                    {(debouncedSearch || statusFilter) && (
                      <p className="text-xs text-gray-400">Try adjusting your filters</p>
                    )}
                  </div>
                </td>
              </tr>
            ) : (
              items.map((appt) => (
                <tr key={appt.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-3 py-3 font-mono text-xs text-gray-500">
                    {appt.id.slice(-8).toUpperCase()}
                  </td>
                  <td className="px-3 py-3 font-medium text-gray-900">{appt.customer_name}</td>
                  <td className="px-3 py-3 text-gray-600">{appt.customer_phone || '—'}</td>
                  <td className="px-3 py-3 text-gray-600 max-w-40">
                    <span className="line-clamp-2">
                      {appt.services.map((s) => s.name).join(', ') || '—'}
                    </span>
                  </td>
                  <td className="px-3 py-3 text-gray-600">{appt.staff_name || '—'}</td>
                  <td className="px-3 py-3 text-gray-600 whitespace-nowrap">
                    <p className="font-medium text-gray-900">{formatDate(appt.start_datetime)}</p>
                    <p className="text-xs text-gray-500">{formatTime(appt.start_datetime)}</p>
                  </td>
                  <td className="px-3 py-3">
                    <span
                      className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${statusStyles[appt.status] ?? 'bg-gray-100 text-gray-600'}`}
                    >
                      {appt.status.toLowerCase().replace('_', ' ')}
                    </span>
                  </td>
                  <td className="px-3 py-3">
                    <div>
                      <p className="font-medium text-gray-900">₹{appt.total_price}</p>
                      <p className="text-xs text-gray-500">{appt.payment_type || '—'}</p>
                    </div>
                  </td>
                  <td className="px-3 py-3 text-right">
                    <Button
                      type="button"
                      variant="ghost"
                      className="!px-2 !py-1 text-xs"
                      title="View bill (coming soon)"
                    >
                      <ReceiptText className="h-4 w-4 text-gray-400" />
                    </Button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {!isLoading && total > 0 && (
        <div className="flex items-center justify-between border-t border-gray-100 px-4 py-3">
          <p className="text-xs text-gray-500">
            Showing <span className="font-medium">{startItem}–{endItem}</span> of{' '}
            <span className="font-medium">{total}</span> appointments
          </p>
          <div className="flex items-center gap-1">
            <Button
              type="button"
              variant="ghost"
              className="!px-2 !py-1"
              onClick={() => setPage((p) => p - 1)}
              disabled={page <= 1 || isFetching}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => {
              const pn =
                totalPages <= 7
                  ? i + 1
                  : page <= 4
                  ? i + 1
                  : page >= totalPages - 3
                  ? totalPages - 6 + i
                  : page - 3 + i;
              if (pn < 1 || pn > totalPages) return null;
              return (
                <button
                  key={pn}
                  type="button"
                  onClick={() => setPage(pn)}
                  disabled={isFetching}
                  className={`flex h-7 w-7 items-center justify-center rounded-lg text-xs font-medium transition-colors ${
                    pn === page
                      ? 'bg-[var(--color-brand-gold)] text-white'
                      : 'text-gray-600 hover:bg-gray-100'
                  }`}
                >
                  {pn}
                </button>
              );
            })}
            <Button
              type="button"
              variant="ghost"
              className="!px-2 !py-1"
              onClick={() => setPage((p) => p + 1)}
              disabled={page >= totalPages || isFetching}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};

/* ─── Main Appointments Page ─────────────────────────────── */
const Appointments: React.FC = () => {
  const { orgId } = useParams<{ orgId: string }>();
  const storedOrgId = useAppSelector((state) => state.auth.orgId);
  const salonId = orgId ?? storedOrgId ?? '';

  const [activeTab, setActiveTab] = useState<Tab>('entry');

  const defaultStart = useMemo(() => {
    const date = new Date();
    date.setMinutes(date.getMinutes() + 5);
    return toDateTimeInputValue(date);
  }, []);

  const [queueSearch, setQueueSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [sourceFilter, setSourceFilter] = useState('all');
  const [clientSearch, setClientSearch] = useState('');
  const [selectedClient, setSelectedClient] = useState<AppointmentClient | null>(null);
  const [quickAddOpen, setQuickAddOpen] = useState(false);
  const [clientForm, setClientForm] = useState({ name: '', phone: '', email: '' });
  const [serviceRows, setServiceRows] = useState<ServiceRow[]>([createRow()]);
  const [paymentType, setPaymentType] = useState('CASH');
  const [totalAmount, setTotalAmount] = useState('');
  const [startDateTime, setStartDateTime] = useState(defaultStart);
  const [notes, setNotes] = useState('');

  const { data: todayData, isLoading: isTodayLoading } = useGetTodayAppointmentsQuery(
    { salon_id: salonId },
    { skip: !salonId }
  );
  const { data: servicesData } = useGetAppointmentServicesQuery();
  const { data: staffData } = useGetAppointmentStaffQuery();
  const { data: historyData, isFetching: isHistoryLoading } = useGetAppointmentClientHistoryQuery(
    selectedClient?.id ?? '',
    { skip: !selectedClient }
  );
  const [searchClients, { data: clientsData, isFetching: isSearchingClients }] =
    useLazySearchAppointmentClientsQuery();
  const [createClient, { isLoading: isCreatingClient }] = useCreateAppointmentClientMutation();
  const [createAppointment, { isLoading: isSubmitting }] = useCreateFrontDeskAppointmentMutation();

  const services = servicesData?.data ?? [];
  const staff = staffData?.data ?? [];
  const clients = clientsData?.data ?? [];
  const appointments = todayData?.data ?? [];
  const history = historyData?.data ?? [];

  const serviceOptions = services.map((service) => ({
    value: service.id,
    label: `${service.name} - ₹${service.price}`,
  }));
  const staffOptions = staff.map((member) => ({ value: member.id, label: member.name }));

  const calculatedTotal = useMemo(
    () => serviceRows.reduce((sum, row) => sum + Number(row.price || 0), 0),
    [serviceRows]
  );

  const visibleAppointments = useMemo(() => {
    const term = queueSearch.trim().toLowerCase();
    return appointments.filter((appointment) => {
      const matchesSearch =
        !term ||
        appointment.customer_name.toLowerCase().includes(term) ||
        appointment.customer_phone.includes(term);
      const matchesStatus = !statusFilter || appointment.status === statusFilter;
      const matchesSource = sourceFilter === 'all' || appointment.booking_source === sourceFilter;
      return matchesSearch && matchesStatus && matchesSource;
    });
  }, [appointments, queueSearch, sourceFilter, statusFilter]);

  const handleClientSearch = async (event: React.FormEvent) => {
    event.preventDefault();
    const term = clientSearch.trim();
    if (term.length < 2) {
      showToast('warning', 'Enter at least 2 characters to search clients');
      return;
    }
    const result = await searchClients({ search: term }).unwrap();
    setQuickAddOpen((result.data ?? []).length === 0);
  };

  const handleCreateClient = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!clientForm.name.trim() || !clientForm.phone.trim()) {
      showToast('warning', 'Name and phone number are required');
      return;
    }
    try {
      const response = await createClient({
        name: clientForm.name.trim(),
        phone: clientForm.phone.trim(),
        email: clientForm.email.trim() || undefined,
      }).unwrap();
      if (response.data) {
        setSelectedClient(response.data);
        setClientForm({ name: '', phone: '', email: '' });
        setQuickAddOpen(false);
        showToast('success', 'Client added');
      }
    } catch (err: unknown) {
      showToast('error', getApiErrorMessage(err, 'Failed to add client'));
    }
  };

  const updateServiceRow = (rowId: string, field: keyof ServiceRow, value: string) => {
    setServiceRows((rows) =>
      rows.map((row) => {
        if (row.id !== rowId) return row;
        if (field === 'service_id') {
          const selectedService = services.find((service) => service.id === value);
          const price = selectedService ? String(selectedService.price) : row.price;
          return { ...row, service_id: value, price };
        }
        return { ...row, [field]: value };
      })
    );
  };

  const removeServiceRow = (rowId: string) => {
    setServiceRows((rows) => (rows.length === 1 ? rows : rows.filter((row) => row.id !== rowId)));
  };

  const resetEntryForm = () => {
    setSelectedClient(null);
    setServiceRows([createRow()]);
    setTotalAmount('');
    setNotes('');
    setClientSearch('');
    setQuickAddOpen(false);
    setClientForm({ name: '', phone: '', email: '' });
  };

  const handleSubmit = async () => {
    if (!salonId) {
      showToast('error', 'Salon not identified. Please refresh the page.');
      return;
    }
    if (!selectedClient) {
      showToast('warning', 'Select or add a client first');
      return;
    }
    if (serviceRows.some((row) => !row.service_id || !row.staff_id || Number(row.price) < 0)) {
      showToast('warning', 'Complete all service rows before submitting');
      return;
    }

    try {
      const response = await createAppointment({
        salon_id: salonId,
        customer_id: selectedClient.id,
        start_datetime: new Date(startDateTime).toISOString(),
        services: serviceRows.map((row) => ({
          service_id: row.service_id,
          staff_id: row.staff_id,
          price: Number(row.price || 0),
        })),
        payment_type: paymentType,
        total_amount: Number(totalAmount || calculatedTotal),
        booking_source: 'WALK_IN',
        notes: notes.trim() || undefined,
      }).unwrap();
      if (response.success) {
        showToast('success', response.message || 'Appointment created successfully');
        resetEntryForm();
      }
    } catch (err: unknown) {
      showToast('error', getApiErrorMessage(err, 'Failed to create appointment'));
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-6 xl:p-8">
      {/* Page header with tabs */}
      <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[var(--color-text-primary)] md:text-3xl">
            Appointments
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            Front-desk workspace for today&apos;s queue, walk-ins, services, and billing.
          </p>
        </div>

        <div className="flex items-center gap-4">
          {/* Tab switcher — top-right */}
          <div className="flex items-center rounded-xl border border-gray-200 bg-white p-1 shadow-sm">
            <button
              type="button"
              onClick={() => setActiveTab('entry')}
              className={`flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-medium transition-all ${
                activeTab === 'entry'
                  ? 'bg-[var(--color-brand-gold)] text-white shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <ReceiptText className="h-4 w-4" />
              Entry
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('list')}
              className={`flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-medium transition-all ${
                activeTab === 'list'
                  ? 'bg-[var(--color-brand-gold)] text-white shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <ClipboardList className="h-4 w-4" />
              List
            </button>
          </div>

          <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            Today: {new Date().toLocaleDateString()}
          </div>
        </div>
      </div>

      {/* ── Entry Tab ── */}
      {activeTab === 'entry' && (
        <div className="grid grid-cols-1 gap-5 xl:grid-cols-[320px_minmax(420px,1fr)_320px]">
          {/* Today's queue */}
          <section className="rounded-2xl border border-gray-200 bg-white shadow-sm">
            <div className="border-b border-gray-100 p-4">
              <div className="flex items-center gap-2">
                <CalendarDays className="h-5 w-5 text-[var(--color-brand-gold)]" />
                <h2 className="font-semibold text-gray-900">Today&apos;s queue</h2>
              </div>
              <div className="mt-4 space-y-3">
                <Input
                  placeholder="Search name or phone"
                  value={queueSearch}
                  onChange={(event) => setQueueSearch(event.target.value)}
                />
                <div className="grid grid-cols-2 gap-2">
                  <Select
                    value={sourceFilter}
                    onChange={(event) => setSourceFilter(event.target.value)}
                    options={sourceOptions}
                    placeholder="Type"
                  />
                  <Select
                    value={statusFilter}
                    onChange={(event) => setStatusFilter(event.target.value)}
                    options={[{ value: '', label: 'All status' }, ...statusOptions]}
                    placeholder="Status"
                  />
                </div>
              </div>
            </div>
            <div className="space-y-3 p-4">
              {isTodayLoading ? (
                <p className="py-8 text-center text-sm text-gray-400">Loading queue...</p>
              ) : visibleAppointments.length === 0 ? (
                <p className="py-8 text-center text-sm text-gray-400">No appointments found for today.</p>
              ) : (
                visibleAppointments.map((appointment) => (
                  <AppointmentQueueCard key={appointment.id} appointment={appointment} />
                ))
              )}
            </div>
          </section>

          {/* Entry form */}
          <main className="space-y-5">
            <section className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <h2 className="font-semibold text-gray-900">Client</h2>
                  <p className="text-sm text-gray-500">Search by phone or name, then select history.</p>
                </div>
                <UserPlus className="h-5 w-5 text-gray-400" />
              </div>
              <form onSubmit={handleClientSearch} className="flex gap-2">
                <Input
                  placeholder="Phone number or client name"
                  value={clientSearch}
                  onChange={(event) => setClientSearch(event.target.value)}
                />
                <Button type="submit" isLoading={isSearchingClients} icon={<Search className="h-4 w-4" />}>
                  Search
                </Button>
              </form>

              {clients.length > 0 && (
                <div className="mt-4 grid gap-2 md:grid-cols-2">
                  {clients.map((client) => (
                    <button
                      key={client.id}
                      type="button"
                      onClick={() => setSelectedClient(client)}
                      className={`rounded-xl border p-3 text-left transition hover:border-[var(--color-brand-gold)] ${
                        selectedClient?.id === client.id
                          ? 'border-[var(--color-brand-gold)] bg-amber-50'
                          : 'border-gray-200 bg-white'
                      }`}
                    >
                      <p className="font-medium text-gray-900">{client.name}</p>
                      <p className="text-sm text-gray-500">{client.phone}</p>
                    </button>
                  ))}
                </div>
              )}

              {quickAddOpen && (
                <form onSubmit={handleCreateClient} className="mt-4 rounded-xl bg-gray-50 p-4">
                  <h3 className="mb-3 text-sm font-semibold text-gray-900">Quick add client</h3>
                  <div className="grid gap-3 md:grid-cols-3">
                    <Input
                      placeholder="Name *"
                      value={clientForm.name}
                      onChange={(event) => setClientForm({ ...clientForm, name: event.target.value })}
                    />
                    <Input
                      placeholder="Phone *"
                      value={clientForm.phone}
                      onChange={(event) => setClientForm({ ...clientForm, phone: event.target.value })}
                    />
                    <Input
                      placeholder="Email optional"
                      value={clientForm.email}
                      onChange={(event) => setClientForm({ ...clientForm, email: event.target.value })}
                    />
                  </div>
                  <Button type="submit" className="mt-3" isLoading={isCreatingClient}>
                    Save client
                  </Button>
                </form>
              )}
            </section>

            <section className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <h2 className="font-semibold text-gray-900">Services</h2>
                  <p className="text-sm text-gray-500">Add multiple service rows with assigned staff.</p>
                </div>
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  icon={<Plus className="h-4 w-4" />}
                  onClick={() => setServiceRows((rows) => [...rows, createRow()])}
                >
                  Add row
                </Button>
              </div>
              <div className="space-y-3">
                {serviceRows.map((row) => (
                  <div
                    key={row.id}
                    className="grid gap-3 rounded-xl border border-gray-100 bg-gray-50 p-3 md:grid-cols-[1fr_1fr_120px_40px]"
                  >
                    <Select
                      value={row.service_id}
                      onChange={(event) => updateServiceRow(row.id, 'service_id', event.target.value)}
                      options={serviceOptions}
                      placeholder="Service"
                    />
                    <Select
                      value={row.staff_id}
                      onChange={(event) => updateServiceRow(row.id, 'staff_id', event.target.value)}
                      options={staffOptions}
                      placeholder="Staff"
                    />
                    <Input
                      type="number"
                      min="0"
                      placeholder="Price"
                      value={row.price}
                      onChange={(event) => updateServiceRow(row.id, 'price', event.target.value)}
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      className="!px-2"
                      onClick={() => removeServiceRow(row.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            </section>

            <section className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
              <h2 className="font-semibold text-gray-900">Previous history</h2>
              {!selectedClient ? (
                <p className="mt-3 text-sm text-gray-500">Select a client to view previous services.</p>
              ) : isHistoryLoading ? (
                <p className="mt-3 text-sm text-gray-500">Loading history...</p>
              ) : history.length === 0 ? (
                <p className="mt-3 text-sm text-gray-500">No previous appointments for this client.</p>
              ) : (
                <div className="mt-3 grid gap-2 md:grid-cols-2">
                  {history.slice(0, 4).map((item) => (
                    <div key={item.id} className="rounded-xl bg-gray-50 p-3 text-sm">
                      <p className="font-medium text-gray-900">
                        {new Date(item.start_datetime).toLocaleDateString()}
                      </p>
                      <p className="mt-1 text-gray-500">{item.services.map((s) => s.name).join(', ')}</p>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </main>

          {/* Bill summary */}
          <aside className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm xl:sticky xl:top-6 xl:self-start">
            <div className="mb-4 flex items-center gap-2">
              <ReceiptText className="h-5 w-5 text-[var(--color-brand-gold)]" />
              <h2 className="font-semibold text-gray-900">Bill summary</h2>
            </div>
            <div className="space-y-4">
              <div className="rounded-xl bg-gray-50 p-3">
                <p className="text-xs uppercase tracking-wide text-gray-500">Client</p>
                <p className="mt-1 font-semibold text-gray-900">
                  {selectedClient?.name ?? 'No client selected'}
                </p>
                <p className="text-sm text-gray-500">{selectedClient?.phone}</p>
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-600">Start time</label>
                <Input
                  type="datetime-local"
                  value={startDateTime}
                  onChange={(event) => setStartDateTime(event.target.value)}
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-600">Payment type</label>
                <Select
                  value={paymentType}
                  onChange={(event) => setPaymentType(event.target.value)}
                  options={paymentOptions}
                  placeholder="Payment type"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-600">Total amount</label>
                <Input
                  type="number"
                  min="0"
                  placeholder={String(calculatedTotal)}
                  value={totalAmount}
                  onChange={(event) => setTotalAmount(event.target.value)}
                />
                <p className="mt-1 text-xs text-gray-500">Calculated: ₹{calculatedTotal}</p>
              </div>
              <textarea
                className="min-h-24 w-full rounded-xl border border-gray-200 p-3 text-sm outline-none focus:ring-2 focus:ring-[var(--color-brand-gold)]"
                placeholder="Notes for stylist or front desk"
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
              />
              <Button fullWidth type="button" isLoading={isSubmitting} onClick={handleSubmit}>
                Submit appointment
              </Button>
            </div>
          </aside>
        </div>
      )}

      {/* ── List Tab ── */}
      {activeTab === 'list' && (
        <AppointmentListTab salonId={salonId} />
      )}
    </div>
  );
};

export default Appointments;
