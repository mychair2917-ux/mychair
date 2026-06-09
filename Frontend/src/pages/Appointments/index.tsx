import React, { useMemo, useRef, useState } from 'react';
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  Download,
  Plus,
  ReceiptText,
  Search,
  Trash2,
  UserPlus,
} from 'lucide-react';
import { useParams } from 'react-router-dom';

import { Button, CommonDropdown, Input, Select } from '../../components/common';
import { useAppSelector } from '../../redux/hooks';
import {
  useCreateAppointmentClientMutation,
  useCreateFrontDeskAppointmentMutation,
  useGetAppointmentClientHistoryQuery,
  useGetAppointmentSalonProductsQuery,
  useGetAppointmentSalonServicesQuery,
  useGetAppointmentStaffQuery,
  useGetTodayAppointmentsQuery,
  useLazyGetBillByAppointmentQuery,
  useLazySearchAppointmentClientsQuery,
  useListAppointmentsQuery,
} from '../../redux/slices/appointments/appointmentsApi';
import { useLazyGetBillDetailQuery } from '../../redux/slices/billing/billingApi';
import {
  AppointmentClient,
  AppointmentListItem,
  AppointmentProductOption,
} from '../../redux/slices/appointments/Types';
import { getApiErrorMessage } from '../../utils/apiErrors';
import { cn } from '../../utils/cn';
import { formatDateDMY } from '../../utils/utilities';
import { downloadInvoicePDF } from '../../utils/invoicePdf';
import { showToast } from '../../components/common/Toast/toastService';

/* ─── types ─────────────────────────────────────────────── */
type Tab = 'entry' | 'list';

type ServiceRow = {
  id: string;
  salon_service_id: string;
  service_id: string;
  staff_id: string;
  price: string;
};

type ProductRow = {
  id: string;
  salon_product_id: string;
  product_id: string;
  staff_id: string;
  price: string;
};

/* ─── constants ──────────────────────────────────────────── */
const PAGE_SIZE = 15;

const paymentMethodOptions = [
  { value: 'CASH', label: 'Cash' },
  { value: 'UPI', label: 'UPI' },
  { value: 'CARD', label: 'Card' },
];

const paymentStatusOptions = [
  { value: 'PAID', label: 'Paid' },
  { value: 'PENDING', label: 'Pending' },
  { value: 'PARTIALLY_PAID', label: 'Partially Paid' },
];

const statusOptions = [
  { value: 'BOOKED', label: 'Booked' },
  { value: 'CHECKED_IN', label: 'Checked in' },
  { value: 'IN_PROGRESS', label: 'In progress' },
  { value: 'COMPLETED', label: 'Completed' },
  { value: 'CANCELLED', label: 'Cancelled' },
  { value: 'NO_SHOW', label: 'No show' },
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
  return { id: crypto.randomUUID(), salon_service_id: '', service_id: '', staff_id: '', price: '' };
}

function createProductRow(): ProductRow {
  return { id: crypto.randomUUID(), salon_product_id: '', product_id: '', staff_id: '', price: '' };
}

function hasValidPrice(value: string): boolean {
  return value.trim() !== '' && Number.isFinite(Number(value)) && Number(value) >= 0;
}

function isServiceRowComplete(row: ServiceRow): boolean {
  return Boolean(row.salon_service_id && row.staff_id && hasValidPrice(row.price));
}

function isProductRowBlank(row: ProductRow): boolean {
  return !row.salon_product_id && !row.product_id && !row.staff_id && row.price.trim() === '';
}

function isProductRowComplete(row: ProductRow): boolean {
  return Boolean(row.salon_product_id && row.staff_id && hasValidPrice(row.price));
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

const STATUS_LABELS: Record<string, string> = {
  BOOKED: 'Booked',
  CHECKED_IN: 'Checked In',
  IN_PROGRESS: 'In Progress',
  COMPLETED: 'Completed',
  CANCELLED: 'Cancelled',
  NO_SHOW: 'No Show',
};

/* ─── sub-components ────────────────────────────────────── */
const AppointmentQueueCard: React.FC<{ appointment: AppointmentListItem }> = ({ appointment }) => (
  <div className="rounded-xl border border-gray-100 bg-gray-50 p-3">
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0 flex-1">
        <p className="truncate font-semibold text-gray-900">{appointment.customer_name}</p>
        <p className="text-sm text-gray-500">{appointment.customer_phone || '—'}</p>
      </div>
      <span
        className={`shrink-0 rounded-full px-2 py-1 text-xs font-medium ${statusStyles[appointment.status] ?? 'bg-gray-100 text-gray-600'}`}
      >
        {STATUS_LABELS[appointment.status] ?? appointment.status}
      </span>
    </div>
    <div className="mt-3 flex items-center justify-between text-sm">
      <span className="font-medium text-gray-900">{formatTime(appointment.start_datetime)}</span>
      <span className="text-gray-500">₹{appointment.total_price}</span>
    </div>
    {appointment.staff_name && (
      <p className="mt-1 text-xs text-gray-400">Staff: {appointment.staff_name}</p>
    )}
    <p className="mt-2 line-clamp-2 text-xs text-gray-500">
      {[...appointment.services.map((s) => s.name), ...appointment.products.map((p) => p.name)].join(', ') ||
        'No services or products'}
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
  const [downloadingBillId, setDownloadingBillId] = useState<string | null>(null);
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [fetchBillByAppointment] = useLazyGetBillByAppointmentQuery();
  const [fetchBillDetail] = useLazyGetBillDetailQuery();

  // Debounce search
  const handleSearchChange = (val: string) => {
    setSearch(val);
    if (searchTimerRef.current) {
      clearTimeout(searchTimerRef.current);
    }
    searchTimerRef.current = setTimeout(() => {
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
              <th className="px-3 py-3 text-left font-semibold text-gray-500">Items</th>
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
                  <td className="px-3 py-3 text-gray-600">{appt.customer_phone || '-'}</td>
                  <td className="px-3 py-3 text-gray-600 max-w-40">
                    <span className="line-clamp-2">
                      {[...appt.services.map((s) => s.name), ...appt.products.map((p) => p.name)].join(', ') || '-'}
                    </span>
                  </td>
                  <td className="px-3 py-3 text-gray-600">{appt.staff_name || '-'}</td>
                  <td className="px-3 py-3 text-gray-600 whitespace-nowrap">
                    <p className="font-medium text-gray-900">{formatDateDMY(appt.start_datetime)}</p>
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
                      <p className="text-xs text-gray-500">{appt.payment_type || '-'}</p>
                    </div>
                  </td>
                  <td className="px-3 py-3 text-right">
                    <Button
                      type="button"
                      variant="ghost"
                      className="!px-2 !py-1 text-xs"
                      title={appt.payment_status === 'PENDING' ? 'No bill yet' : 'Download bill'}
                      disabled={downloadingBillId === appt.id}
                      onClick={async () => {
                        if (appt.payment_status === 'PENDING') {
                          showToast('warning', 'No bill available — payment is still pending.');
                          return;
                        }
                        setDownloadingBillId(appt.id);
                        try {
                          const listRes = await fetchBillByAppointment({
                            salon_id: salonId,
                            appointment_id: appt.id,
                          }).unwrap();
                          if (!listRes.data) {
                            showToast('warning', 'No bill found for this appointment.');
                            return;
                          }
                          const detailRes = await fetchBillDetail(listRes.data.id).unwrap();
                          if (detailRes.data) {
                            downloadInvoicePDF(detailRes.data);
                          } else {
                            downloadInvoicePDF(listRes.data);
                          }
                        } catch {
                          showToast('error', 'Failed to fetch bill. Please try again.');
                        } finally {
                          setDownloadingBillId(null);
                        }
                      }}
                    >
                      {downloadingBillId === appt.id ? (
                        <span className="text-xs text-gray-400">…</span>
                      ) : appt.payment_status === 'PENDING' ? (
                        <ReceiptText className="h-4 w-4 text-gray-300" />
                      ) : (
                        <Download className="h-4 w-4 text-[var(--color-brand-gold)]" />
                      )}
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
  const selectedSalonId = useAppSelector((state) => state.auth.selectedSalonId);
  const role = useAppSelector((state) => state.auth.user?.role);
  const isSuperAdmin = role === 'super_admin';
  const salonId = (orgId ?? (isSuperAdmin ? selectedSalonId : storedOrgId) ?? '').trim();

  const [activeTab, setActiveTab] = useState<Tab>('entry');

  const defaultStart = useMemo(() => {
    const date = new Date();
    date.setMinutes(date.getMinutes() + 5);
    return toDateTimeInputValue(date);
  }, []);

  const [queueSearch, setQueueSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [sourceFilter, setSourceFilter] = useState('all');
  const [showCompleted, setShowCompleted] = useState(false);
  const [clientSearch, setClientSearch] = useState('');
  const [selectedClient, setSelectedClient] = useState<AppointmentClient | null>(null);
  const [quickAddOpen, setQuickAddOpen] = useState(false);
  const [clientForm, setClientForm] = useState({ name: '', phone: '', email: '' });
  const [serviceRows, setServiceRows] = useState<ServiceRow[]>([createRow()]);
  const [productRows, setProductRows] = useState<ProductRow[]>([]);
  const [invalidServiceRowIds, setInvalidServiceRowIds] = useState<string[]>([]);
  const [invalidProductRowIds, setInvalidProductRowIds] = useState<string[]>([]);
  const [paymentMethod, setPaymentMethod] = useState('CASH');
  const [paymentStatus, setPaymentStatus] = useState('PAID');
  const [paidAmount, setPaidAmount] = useState('');
  const [totalAmount, setTotalAmount] = useState('');
  const [startDateTime, setStartDateTime] = useState(defaultStart);
  const [notes, setNotes] = useState('');

  const { data: todayData, isLoading: isTodayLoading } = useGetTodayAppointmentsQuery(
    { salon_id: salonId, include_completed: showCompleted },
    { skip: !salonId, pollingInterval: 60000 }
  );
  const { data: servicesData, isLoading: isLoadingSalonServices } = useGetAppointmentSalonServicesQuery(
    { salon_id: salonId },
    { skip: !salonId }
  );
  const { data: productsData, isLoading: isLoadingSalonProducts } = useGetAppointmentSalonProductsQuery(
    { salon_id: salonId },
    { skip: !salonId }
  );
  const { data: staffData } = useGetAppointmentStaffQuery(undefined, { skip: !salonId });
  const { data: historyData, isFetching: isHistoryLoading } = useGetAppointmentClientHistoryQuery(
    { id: selectedClient?.id ?? '', salon_id: salonId || undefined },
    { skip: !selectedClient }
  );
  const [searchClients, { data: clientsData, isFetching: isSearchingClients }] =
    useLazySearchAppointmentClientsQuery();
  const [createClient, { isLoading: isCreatingClient }] = useCreateAppointmentClientMutation();
  const [createAppointment, { isLoading: isSubmitting }] = useCreateFrontDeskAppointmentMutation();

  const services = servicesData?.data ?? [];
  const products = productsData?.data ?? [];
  const staff = staffData?.data ?? [];
  const clients = clientsData?.data ?? [];
  const appointments = useMemo(() => todayData?.data ?? [], [todayData?.data]);
  const history = historyData?.data ?? [];

  const serviceOptions = services.map((service) => ({
    value: service.salon_service_id,
    label: service.service_name,
  }));
  const productOptions = products.map((product: AppointmentProductOption) => ({
    value: product.salon_product_id,
    label: product.product_name,
  }));
  const staffOptions = staff.map((member) => ({ value: member.id, label: member.name }));

  const calculatedTotal = useMemo(
    () =>
      serviceRows.reduce((sum, row) => sum + Number(row.price || 0), 0) +
      productRows.reduce((sum, row) => sum + Number(row.price || 0), 0),
    [productRows, serviceRows]
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

  if (isSuperAdmin && !salonId) {
    return (
      <div className="min-h-screen bg-gray-50 p-4 md:p-6 xl:p-8">
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-800">
          Select a salon from the header to manage appointments.
        </div>
      </div>
    );
  }

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
    setInvalidServiceRowIds((ids) => ids.filter((id) => id !== rowId));
    setServiceRows((rows) =>
      rows.map((row) => {
        if (row.id !== rowId) return row;
        if (field === 'salon_service_id') {
          const selectedService = services.find((service) => service.salon_service_id === value);
          const price = selectedService ? String(selectedService.price) : row.price;
          return {
            ...row,
            salon_service_id: value,
            service_id: selectedService?.service_id ?? '',
            price,
          };
        }
        return { ...row, [field]: value };
      })
    );
  };
  const updateProductRow = (rowId: string, field: keyof ProductRow, value: string) => {
    setInvalidProductRowIds((ids) => ids.filter((id) => id !== rowId));
    setProductRows((rows) =>
      rows.map((row) => {
        if (row.id !== rowId) return row;
        if (field === 'salon_product_id') {
          const selectedProduct = products.find((product) => product.salon_product_id === value);
          const price = selectedProduct ? String(selectedProduct.price) : row.price;
          return {
            ...row,
            salon_product_id: value,
            product_id: selectedProduct?.product_id ?? '',
            price,
          };
        }
        return { ...row, [field]: value };
      })
    );
  };

  const removeServiceRow = (rowId: string) => {
    setServiceRows((rows) => (rows.length === 1 ? rows : rows.filter((row) => row.id !== rowId)));
    setInvalidServiceRowIds((ids) => ids.filter((id) => id !== rowId));
  };
  const removeProductRow = (rowId: string) => {
    setProductRows((rows) => rows.filter((row) => row.id !== rowId));
    setInvalidProductRowIds((ids) => ids.filter((id) => id !== rowId));
  };

  const effectiveTotal = Number(totalAmount || calculatedTotal);
  const remainingAmount =
    paymentStatus === 'PARTIALLY_PAID' && paidAmount
      ? Math.max(0, effectiveTotal - Number(paidAmount))
      : 0;

  const resetEntryForm = () => {
    setSelectedClient(null);
    setServiceRows([createRow()]);
    setProductRows([]);
    setTotalAmount('');
    setPaidAmount('');
    setPaymentStatus('PAID');
    setPaymentMethod('CASH');
    setNotes('');
    setClientSearch('');
    setQuickAddOpen(false);
    setClientForm({ name: '', phone: '', email: '' });
    setInvalidServiceRowIds([]);
    setInvalidProductRowIds([]);
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
    const invalidServiceIds = serviceRows
      .filter((row) => !isServiceRowComplete(row))
      .map((row) => row.id);
    const productRowsToSubmit = productRows.filter((row) => !isProductRowBlank(row));
    const invalidProductIds = productRowsToSubmit
      .filter((row) => !isProductRowComplete(row))
      .map((row) => row.id);

    setInvalidServiceRowIds(invalidServiceIds);
    setInvalidProductRowIds(invalidProductIds);

    if (invalidServiceIds.length || invalidProductIds.length) {
      showToast('warning', 'Complete the highlighted service or product rows before submitting');
      return;
    }

    const finalTotal = Number(totalAmount || calculatedTotal);

    if (paymentStatus === 'PARTIALLY_PAID') {
      const pa = Number(paidAmount);
      if (!paidAmount || pa <= 0) {
        showToast('warning', 'Enter the paid amount for partially paid status');
        return;
      }
      if (pa >= finalTotal) {
        showToast('warning', 'Paid amount must be less than total for partially paid status');
        return;
      }
    }

    try {
      const response = await createAppointment({
        salon_id: salonId,
        customer_id: selectedClient.id,
        start_datetime: new Date(startDateTime).toISOString(),
        services: serviceRows.map((row) => ({
          service_id: row.service_id || undefined,
          salon_service_id: row.salon_service_id,
          staff_id: row.staff_id,
          price: Number(row.price || 0),
        })),
        products: productRowsToSubmit.map((row) => ({
          product_id: row.product_id || undefined,
          salon_product_id: row.salon_product_id,
          staff_id: row.staff_id,
          price: Number(row.price || 0),
        })),
        payment_type: paymentMethod,
        payment_status: paymentStatus,
        paid_amount: paymentStatus === 'PARTIALLY_PAID' ? Number(paidAmount) : undefined,
        total_amount: finalTotal,
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
          {/* Tab switcher - top-right */}
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
            Today: {formatDateDMY(new Date().toISOString())}
          </div>
        </div>
      </div>

      {/* ── Entry Tab ── */}
      {activeTab === 'entry' && (
        <div className="grid grid-cols-1 gap-5 xl:grid-cols-[320px_minmax(420px,1fr)_320px]">
          {/* Today's queue */}
          <section className="rounded-2xl border border-gray-200 bg-white shadow-sm">
            <div className="border-b border-gray-100 p-4">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <CalendarDays className="h-5 w-5 text-[var(--color-brand-gold)]" />
                  <h2 className="font-semibold text-gray-900">Today&apos;s queue</h2>
                </div>
                <span className="rounded-full bg-[var(--color-brand-gold)] px-2 py-0.5 text-xs font-bold text-white">
                  {visibleAppointments.length}
                </span>
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
                <label className="flex cursor-pointer items-center gap-2 text-xs text-gray-500">
                  <input
                    type="checkbox"
                    checked={showCompleted}
                    onChange={(e) => setShowCompleted(e.target.checked)}
                    className="rounded"
                  />
                  Show completed &amp; cancelled
                </label>
              </div>
            </div>
            <div className="space-y-3 p-4">
              {isTodayLoading ? (
                <p className="py-8 text-center text-sm text-gray-400">Loading queue...</p>
              ) : visibleAppointments.length === 0 ? (
                <div className="py-8 text-center">
                  <CalendarDays className="mx-auto mb-2 h-8 w-8 text-gray-200" />
                  <p className="text-sm text-gray-400">
                    {showCompleted ? 'No appointments today.' : 'No active queue items. Check "Show completed" to see all.'}
                  </p>
                </div>
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
                {serviceRows.map((row) => {
                  const isInvalid = invalidServiceRowIds.includes(row.id);

                  return (
                    <div
                      key={row.id}
                      className={cn(
                        'grid gap-3 rounded-xl border p-3 md:grid-cols-[1fr_1fr_120px_40px]',
                        isInvalid
                          ? 'border-red-300 bg-red-50/70 ring-1 ring-red-200'
                          : 'border-gray-100 bg-gray-50'
                      )}
                    >
                      <CommonDropdown
                        value={row.salon_service_id}
                        onChange={(value) => updateServiceRow(row.id, 'salon_service_id', String(value))}
                        options={serviceOptions}
                        placeholder="Search service"
                        searchable
                        loading={isLoadingSalonServices}
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
                      {isInvalid && (
                        <p className="text-xs font-medium text-red-600 md:col-span-4">
                          Select a service, assign staff, and enter a valid price.
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            </section>

            <section className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <h2 className="font-semibold text-gray-900">Products</h2>
                  <p className="text-sm text-gray-500">Add multiple product rows with assigned staff.</p>
                </div>
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  icon={<Plus className="h-4 w-4" />}
                  onClick={() => setProductRows((rows) => [...rows, createProductRow()])}
                >
                  Add row
                </Button>
              </div>
              <div className="space-y-3">
                {productRows.length === 0 ? (
                  <p className="rounded-xl border border-dashed border-gray-200 bg-gray-50 p-4 text-sm text-gray-500">
                    No products added yet.
                  </p>
                ) : (
                  productRows.map((row) => {
                    const isInvalid = invalidProductRowIds.includes(row.id);

                    return (
                      <div
                        key={row.id}
                        className={cn(
                          'grid gap-3 rounded-xl border p-3 md:grid-cols-[1fr_1fr_120px_40px]',
                          isInvalid
                            ? 'border-red-300 bg-red-50/70 ring-1 ring-red-200'
                            : 'border-gray-100 bg-gray-50'
                        )}
                      >
                        <CommonDropdown
                          value={row.salon_product_id}
                          onChange={(value) => updateProductRow(row.id, 'salon_product_id', String(value))}
                          options={productOptions}
                          placeholder="Search product"
                          searchable
                          loading={isLoadingSalonProducts}
                        />
                        <Select
                          value={row.staff_id}
                          onChange={(event) => updateProductRow(row.id, 'staff_id', event.target.value)}
                          options={staffOptions}
                          placeholder="Staff"
                        />
                        <Input
                          type="number"
                          min="0"
                          placeholder="Price"
                          value={row.price}
                          onChange={(event) => updateProductRow(row.id, 'price', event.target.value)}
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          className="!px-2"
                          onClick={() => removeProductRow(row.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                        {isInvalid && (
                          <p className="text-xs font-medium text-red-600 md:col-span-4">
                            Complete this product row or remove it before submitting.
                          </p>
                        )}
                      </div>
                    );
                  })
                )}
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
                        {formatDateDMY(item.start_datetime)}
                      </p>
                      <p className="mt-1 text-gray-500">
                        {[...item.services.map((s) => s.name), ...item.products.map((p) => p.name)].join(', ')}
                      </p>
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
                <label className="mb-1 block text-xs font-medium text-gray-600">Payment method</label>
                <Select
                  value={paymentMethod}
                  onChange={(event) => setPaymentMethod(event.target.value)}
                  options={paymentMethodOptions}
                  placeholder="Payment method"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-600">Payment status</label>
                <Select
                  value={paymentStatus}
                  onChange={(event) => {
                    setPaymentStatus(event.target.value);
                    if (event.target.value !== 'PARTIALLY_PAID') setPaidAmount('');
                  }}
                  options={paymentStatusOptions}
                  placeholder="Payment status"
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
              {paymentStatus === 'PARTIALLY_PAID' && (
                <div className="rounded-xl border border-violet-200 bg-violet-50 p-3 space-y-3">
                  <div>
                    <label className="mb-1 block text-xs font-medium text-violet-700">
                      Paid amount <span className="text-red-500">*</span>
                    </label>
                    <Input
                      type="number"
                      min="0"
                      max={effectiveTotal - 0.01}
                      placeholder="Enter amount paid"
                      value={paidAmount}
                      onChange={(event) => {
                        const val = event.target.value;
                        if (Number(val) >= effectiveTotal) return;
                        setPaidAmount(val);
                      }}
                    />
                  </div>
                  <div className="flex items-center justify-between rounded-lg bg-white px-3 py-2">
                    <span className="text-xs font-medium text-gray-600">Remaining amount</span>
                    <span className="text-sm font-bold text-amber-700">
                      ₹{remainingAmount.toFixed(2)}
                    </span>
                  </div>
                </div>
              )}
              <div className="rounded-xl bg-gray-50 p-3 text-sm">
                <p className="text-xs uppercase tracking-wide text-gray-500">Items</p>
                <div className="mt-2 space-y-1 text-gray-600">
                  {serviceRows.map((row) => {
                    const item = services.find((service) => service.salon_service_id === row.salon_service_id);
                    if (!item) return null;
                    return (
                      <div key={row.id} className="flex items-center justify-between gap-3">
                        <span>{item.service_name}</span>
                        <span>₹{row.price || item.price}</span>
                      </div>
                    );
                  })}
                  {productRows.map((row) => {
                    const item = products.find((product) => product.salon_product_id === row.salon_product_id);
                    if (!item) return null;
                    return (
                      <div key={row.id} className="flex items-center justify-between gap-3">
                        <span>{item.product_name}</span>
                        <span>₹{row.price || item.price}</span>
                      </div>
                    );
                  })}
                </div>
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
