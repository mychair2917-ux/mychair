import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  Download,
  Pencil,
  Plus,
  ReceiptText,
  Search,
  Trash2,
} from 'lucide-react';
import { useParams } from 'react-router-dom';

import { Button, CommonDropdown, Input, Modal, Select } from '../../components/common';
import ModalBody from '../../components/common/Modal/ModalBody';
import ModalFooter from '../../components/common/Modal/ModalFooter';
import ModalHeader from '../../components/common/Modal/ModalHeader';
import { useDebouncedSearch } from '../../hooks';
import { useAppSelector } from '../../redux/hooks';
import {
  useCreateAppointmentClientMutation,
  useCreateFrontDeskAppointmentMutation,
  useGetAppointmentClientHistoryQuery,
  useGetAppointmentSalonProductsQuery,
  useGetAppointmentSalonServicesQuery,
  useGetAppointmentStaffQuery,
  useLazyCheckAppointmentClientPhoneQuery,
  useLazyGetBillByAppointmentQuery,
  useLazySearchAppointmentClientsQuery,
  useListAppointmentsQuery,
  useUpdateAppointmentPaymentMutation,
  useUpdateFrontDeskAppointmentMutation,
} from '../../redux/slices/appointments/appointmentsApi';
import { useLazyGetBillDetailQuery } from '../../redux/slices/billing/billingApi';
import {
  AppointmentClient,
  AppointmentListItem,
  AppointmentProductOption,
  AppointmentServiceOption,
  CreateFrontDeskAppointmentRequest,
} from '../../redux/slices/appointments/Types';
import { getApiErrorMessage } from '../../utils/apiErrors';
import { cn } from '../../utils/cn';
import { formatDateDMY } from '../../utils/utilities';
import { downloadInvoicePDF } from '../../utils/invoicePdf';
import { showToast } from '../../components/common/Toast/toastService';
import { normalizeRole } from '../../config/rbac';
import { ROLES } from '../../constants';

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
  quantity: string;
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
  { value: 'PARTIALLY_PAID', label: 'Partial' },
];

const clientGenderOptions = [
  { value: 'MALE', label: 'Male' },
  { value: 'FEMALE', label: 'Female' },
];

const paymentStatusStyles: Record<string, string> = {
  PAID: 'bg-emerald-100 text-emerald-700',
  PENDING: 'bg-amber-100 text-amber-700',
  PARTIALLY_PAID: 'bg-blue-100 text-blue-700',
};

const paymentStatusLabels: Record<string, string> = {
  PAID: 'Paid',
  PENDING: 'Pending',
  PARTIALLY_PAID: 'Partial',
};

function canUpdatePaymentStatus(status: string | undefined): boolean {
  const normalized = (status || '').toUpperCase();
  return normalized === 'PENDING' || normalized === 'PARTIALLY_PAID';
}

function nextPaymentStatusOptions(current: string): { value: string; label: string }[] {
  if ((current || '').toUpperCase() === 'PARTIALLY_PAID') {
    return [{ value: 'PAID', label: 'Paid (Complete)' }];
  }
  return [
    { value: 'PARTIALLY_PAID', label: 'Partial' },
    { value: 'PAID', label: 'Paid (Complete)' },
  ];
}

/* ─── helpers ────────────────────────────────────────────── */
function createRow(): ServiceRow {
  return { id: crypto.randomUUID(), salon_service_id: '', service_id: '', staff_id: '', price: '' };
}

function createProductRow(): ProductRow {
  return {
    id: crypto.randomUUID(),
    salon_product_id: '',
    product_id: '',
    staff_id: '',
    price: '',
    quantity: '1',
  };
}

function canManageMembership(role: string | undefined): boolean {
  const normalized = normalizeRole(role);
  return normalized === ROLES.SUPER_ADMIN || normalized === ROLES.SALON_OWNER;
}

function canEditAppointment(role: string | undefined): boolean {
  const normalized = normalizeRole(role);
  return normalized === ROLES.SUPER_ADMIN || normalized === ROLES.SALON_OWNER;
}

function resolveServicePriceForClient(
  service: AppointmentServiceOption | undefined,
  isMember: boolean | undefined
): string {
  if (!service) return '';
  if (
    isMember &&
    service.member_price !== null &&
    service.member_price !== undefined
  ) {
    return String(service.member_price);
  }
  return String(service.price);
}

function hasValidPrice(value: string): boolean {
  return value.trim() !== '' && Number.isFinite(Number(value)) && Number(value) >= 0;
}

function hasValidQuantity(value: string): boolean {
  const qty = Number(value);
  return value.trim() !== '' && Number.isInteger(qty) && qty >= 1;
}

function isServiceRowComplete(row: ServiceRow): boolean {
  return Boolean(row.salon_service_id && row.staff_id && hasValidPrice(row.price));
}

function isServiceRowBlank(row: ServiceRow): boolean {
  return !row.salon_service_id && !row.service_id && !row.staff_id && row.price.trim() === '';
}

function isProductRowBlank(row: ProductRow): boolean {
  return (
    !row.salon_product_id &&
    !row.product_id &&
    !row.staff_id &&
    row.price.trim() === '' &&
    (row.quantity.trim() === '' || row.quantity.trim() === '1')
  );
}

function isProductRowComplete(row: ProductRow): boolean {
  return Boolean(
    row.salon_product_id && row.staff_id && hasValidPrice(row.price) && hasValidQuantity(row.quantity)
  );
}

function productLineTotal(unitPrice: string | number, quantity: string | number): number {
  const price = Number(unitPrice || 0);
  const qty = Math.max(1, Number(quantity || 1));
  return price * qty;
}

function formatProductListLabel(product: {
  name: string;
  quantity?: number;
  display_name?: string;
}): string {
  // Quantity has its own column — product name must appear once.
  return product.display_name || product.name;
}

function toDateTimeInputValue(date: Date): string {
  const pad = (v: number) => String(v).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function formatTime(value: string): string {
  return new Date(value).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

/* ─── List tab skeleton row ─────────────────────────────── */
const SkeletonRow: React.FC = () => (
  <tr>
    {Array.from({ length: 13 }).map((_, i) => (
      <td key={i} className="px-3 py-3">
        <div className="h-4 animate-pulse rounded bg-gray-200" />
      </td>
    ))}
  </tr>
);

/* ─── Payment update modal ───────────────────────────────── */
const PaymentUpdateModal: React.FC<{
  open: boolean;
  appointment: AppointmentListItem | null;
  isLoading: boolean;
  onClose: () => void;
  onSubmit: (payload: {
    payment_status: 'PAID' | 'PARTIALLY_PAID';
    paid_amount?: number;
    payment_type?: string;
  }) => Promise<void>;
}> = ({ open, appointment, isLoading, onClose, onSubmit }) => {
  const [nextStatus, setNextStatus] = useState('PAID');
  const [paidAmount, setPaidAmount] = useState('');
  const [paymentType, setPaymentType] = useState('CASH');

  useEffect(() => {
    if (!appointment || !open) return;
    const options = nextPaymentStatusOptions(appointment.payment_status);
    setNextStatus(options[0]?.value ?? 'PAID');
    setPaidAmount(
      appointment.payment_status === 'PARTIALLY_PAID'
        ? String(appointment.paid_amount || '')
        : ''
    );
    setPaymentType(appointment.payment_type || 'CASH');
  }, [appointment, open]);

  if (!appointment) return null;

  const total = Number(appointment.total_price || 0);
  const alreadyPaid = Number(appointment.paid_amount || 0);
  const remainingPreview =
    nextStatus === 'PARTIALLY_PAID' && paidAmount
      ? Math.max(0, total - Number(paidAmount))
      : nextStatus === 'PAID'
        ? 0
        : Math.max(0, total - alreadyPaid);

  const handleSubmit = async () => {
    if (nextStatus === 'PARTIALLY_PAID') {
      const amount = Number(paidAmount);
      if (!paidAmount || !Number.isFinite(amount) || amount <= 0) {
        showToast('warning', 'Enter a valid paid amount');
        return;
      }
      if (amount <= alreadyPaid) {
        showToast('warning', 'Paid amount must be greater than amount already paid');
        return;
      }
      if (amount >= total) {
        showToast('warning', 'For partial payment, amount must be less than total');
        return;
      }
      await onSubmit({
        payment_status: 'PARTIALLY_PAID',
        paid_amount: amount,
        payment_type: paymentType,
      });
      return;
    }
    await onSubmit({
      payment_status: 'PAID',
      payment_type: paymentType,
    });
  };

  return (
    <Modal open={open} onClose={onClose} size="md" isShowIcon>
      <ModalHeader>
        <div>
          <h2 className="text-xl font-semibold text-gray-900">Update payment status</h2>
          <p className="mt-1 text-sm font-normal text-gray-500">
            {appointment.customer_name} · {formatDateDMY(appointment.start_datetime)}
          </p>
        </div>
      </ModalHeader>
      <ModalBody className="space-y-4">
        <div className="rounded-xl bg-gray-50 p-3 text-sm">
          <div className="flex justify-between gap-3">
            <span className="text-gray-500">Current status</span>
            <span className="font-medium text-gray-900">
              {paymentStatusLabels[appointment.payment_status] ?? appointment.payment_status}
            </span>
          </div>
          <div className="mt-1 flex justify-between gap-3">
            <span className="text-gray-500">Total</span>
            <span className="font-medium text-gray-900">₹{total}</span>
          </div>
          <div className="mt-1 flex justify-between gap-3">
            <span className="text-gray-500">Already paid</span>
            <span className="font-medium text-gray-900">₹{alreadyPaid}</span>
          </div>
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-gray-600">New payment status</label>
          <Select
            value={nextStatus}
            onChange={(e) => {
              setNextStatus(e.target.value);
              if (e.target.value !== 'PARTIALLY_PAID') setPaidAmount('');
            }}
            options={nextPaymentStatusOptions(appointment.payment_status)}
            placeholder="Select status"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-gray-600">Payment method</label>
          <Select
            value={paymentType}
            onChange={(e) => setPaymentType(e.target.value)}
            options={paymentMethodOptions}
            placeholder="Payment method"
          />
        </div>
        {nextStatus === 'PARTIALLY_PAID' && (
          <div className="space-y-2 rounded-xl border border-violet-200 bg-violet-50 p-3">
            <label className="mb-1 block text-xs font-medium text-violet-700">
              Paid amount <span className="text-red-500">*</span>
            </label>
            <Input
              type="number"
              min={alreadyPaid + 0.01}
              max={total - 0.01}
              placeholder="Enter total amount paid so far"
              value={paidAmount}
              onChange={(e) => setPaidAmount(e.target.value)}
            />
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Remaining</span>
              <span className="font-semibold text-amber-700">₹{remainingPreview.toFixed(2)}</span>
            </div>
          </div>
        )}
        {nextStatus === 'PAID' && (
          <p className="text-sm text-emerald-700">
            Marking as paid will set paid amount to the full total (₹{total}).
          </p>
        )}
      </ModalBody>
      <ModalFooter>
        <Button type="button" variant="secondary" onClick={onClose}>
          Cancel
        </Button>
        <Button type="button" isLoading={isLoading} onClick={handleSubmit}>
          Update status
        </Button>
      </ModalFooter>
    </Modal>
  );
};

/* ─── Edit Appointment Modal ─────────────────────────────── */
interface EditAppointmentModalProps {
  open: boolean;
  appointment: AppointmentListItem | null;
  salonId: string;
  onClose: () => void;
  onSuccess: () => void;
}

const EditAppointmentModal: React.FC<EditAppointmentModalProps> = ({
  open,
  appointment,
  salonId,
  onClose,
  onSuccess,
}) => {
  const [updateAppointment, { isLoading: isUpdating }] = useUpdateFrontDeskAppointmentMutation();

  const { data: servicesData, isLoading: isLoadingSalonServices } = useGetAppointmentSalonServicesQuery(
    { salon_id: salonId },
    { skip: !open || !salonId }
  );
  const { data: productsData, isLoading: isLoadingSalonProducts } = useGetAppointmentSalonProductsQuery(
    { salon_id: salonId },
    { skip: !open || !salonId }
  );
  const { data: staffData } = useGetAppointmentStaffQuery(undefined, { skip: !open || !salonId });

  const services = servicesData?.data ?? [];
  const products = productsData?.data ?? [];
  const staff = staffData?.data ?? [];

  const serviceOptions = services.map((service) => ({
    value: service.salon_service_id,
    label: service.service_name,
  }));
  const productOptions = products.map((product: AppointmentProductOption) => {
    const stockQty = product.stock_quantity;
    const isOos = stockQty !== undefined && stockQty <= 0;
    return {
      value: product.salon_product_id,
      label: isOos
        ? `${product.product_name} (${stockQty !== undefined && stockQty < 0 ? `Stock: ${stockQty}` : 'Out of Stock'})`
        : product.product_name,
    };
  });
  const staffOptions = staff.map((member) => ({ value: member.id, label: member.name }));

  const userRole = useAppSelector((state) => state.auth.user?.role);
  const canEdit = canEditAppointment(userRole);

  const [serviceRows, setServiceRows] = useState<ServiceRow[]>([]);
  const [productRows, setProductRows] = useState<ProductRow[]>([]);
  const [startDateTime, setStartDateTime] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('CASH');
  const [paymentStatus, setPaymentStatus] = useState('PAID');
  const [paidAmount, setPaidAmount] = useState('');
  const [totalAmount, setTotalAmount] = useState('');
  const [notes, setNotes] = useState('');
  const [invalidServiceRowIds, setInvalidServiceRowIds] = useState<string[]>([]);
  const [invalidProductRowIds, setInvalidProductRowIds] = useState<string[]>([]);

  useEffect(() => {
    if (!open || !appointment) return;

    setStartDateTime(toDateTimeInputValue(new Date(appointment.start_datetime)));
    setPaymentMethod(appointment.payment_type || 'CASH');
    setPaymentStatus(appointment.payment_status || 'PAID');
    setPaidAmount(appointment.paid_amount ? String(appointment.paid_amount) : '');
    setTotalAmount(appointment.total_price ? String(appointment.total_price) : '');
    setNotes(appointment.notes || '');
    setInvalidServiceRowIds([]);
    setInvalidProductRowIds([]);

    if (appointment.services && appointment.services.length > 0) {
      setServiceRows(
        appointment.services.map((s) => {
          const matched = services.find(
            (item) => item.service_id === s.service_id || item.salon_service_id === s.service_id || item.service_name === s.name
          );
          return {
            id: crypto.randomUUID(),
            salon_service_id: matched ? matched.salon_service_id : s.service_id || '',
            service_id: s.service_id || '',
            staff_id: s.staff_id || appointment.staff_id || (staff[0]?.id ?? ''),
            price: String(s.price),
          };
        })
      );
    } else {
      setServiceRows([]);
    }

    if (appointment.products && appointment.products.length > 0) {
      setProductRows(
        appointment.products.map((p) => {
          const matched = products.find(
            (item) => item.product_id === p.product_id || item.salon_product_id === p.product_id || item.product_name === p.name
          );
          return {
            id: crypto.randomUUID(),
            salon_product_id: matched ? matched.salon_product_id : p.product_id || '',
            product_id: p.product_id || '',
            staff_id: p.staff_id || appointment.staff_id || (staff[0]?.id ?? ''),
            quantity: String(p.quantity || 1),
            price: String(p.price),
          };
        })
      );
    } else {
      setProductRows([]);
    }
  }, [open, appointment, services, products, staff]);

  const calculatedTotal = useMemo(
    () =>
      serviceRows.reduce((sum, row) => sum + Number(row.price || 0), 0) +
      productRows.reduce((sum, row) => sum + productLineTotal(row.price, row.quantity), 0),
    [productRows, serviceRows]
  );

  useEffect(() => {
    setTotalAmount(String(calculatedTotal));
  }, [calculatedTotal]);

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
    setServiceRows((rows) => rows.filter((row) => row.id !== rowId));
    setInvalidServiceRowIds((ids) => ids.filter((id) => id !== rowId));
  };

  const removeProductRow = (rowId: string) => {
    setProductRows((rows) => rows.filter((row) => row.id !== rowId));
    setInvalidProductRowIds((ids) => ids.filter((id) => id !== rowId));
  };

  const handleSubmit = async () => {
    if (!appointment) return;

    const serviceRowsToSubmit = serviceRows.filter((row) => !isServiceRowBlank(row));
    const invalidServiceIds = serviceRowsToSubmit
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

    if (!serviceRowsToSubmit.length && !productRowsToSubmit.length) {
      showToast('warning', 'Add at least one service or product');
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

    const payload = {
      id: appointment.id,
      salon_id: salonId,
      customer_id: appointment.customer_id,
      start_datetime: new Date(startDateTime).toISOString(),
      services: serviceRowsToSubmit.map((row) => ({
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
        quantity: Math.max(1, Number(row.quantity || 1)),
      })),
      payment_type: paymentMethod,
      payment_status: paymentStatus,
      paid_amount: paymentStatus === 'PARTIALLY_PAID' ? Number(paidAmount) : undefined,
      total_amount: finalTotal,
      booking_source: appointment.booking_source || 'WALK_IN',
      notes: notes.trim() || undefined,
    };

    try {
      const response = await updateAppointment(payload).unwrap();
      if (response.success) {
        showToast('success', response.message || 'Appointment updated successfully');
        onSuccess();
        onClose();
      }
    } catch (err: unknown) {
      showToast('error', getApiErrorMessage(err, 'Failed to update appointment'));
    }
  };

  if (!appointment || !canEdit) return null;

  return (
    <Modal open={open} onClose={onClose} size="lg">
      <ModalHeader>
        <div>
          <h2 className="text-xl font-semibold text-gray-900">Edit Appointment</h2>
          <p className="mt-1 text-sm font-normal text-gray-500">
            {appointment.customer_name} · {appointment.customer_phone || ''}
          </p>
        </div>
      </ModalHeader>
      <ModalBody className="space-y-4 max-h-[75vh] overflow-y-auto">
        {/* Date & Time */}
        <div>
          <label className="mb-1 block text-xs font-medium text-gray-600">Start Time</label>
          <Input
            type="datetime-local"
            value={startDateTime}
            onChange={(event) => setStartDateTime(event.target.value)}
          />
        </div>

        {/* Services Section */}
        <div>
          <div className="mb-2 flex items-center justify-between">
            <label className="text-xs font-semibold text-gray-700">Services</label>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              icon={<Plus className="h-3.5 w-3.5" />}
              onClick={() => setServiceRows((rows) => [...rows, createRow()])}
            >
              Add Service
            </Button>
          </div>
          <div className="space-y-2">
            {serviceRows.length === 0 ? (
              <p className="text-xs text-gray-400 italic">No services added.</p>
            ) : (
              serviceRows.map((row) => {
                const isInvalid = invalidServiceRowIds.includes(row.id);
                return (
                  <div
                    key={row.id}
                    className={cn(
                      'grid gap-2 rounded-xl border p-2.5 md:grid-cols-[1fr_1fr_110px_36px]',
                      isInvalid ? 'border-red-300 bg-red-50/70' : 'border-gray-100 bg-gray-50'
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
                      placeholder="Service By"
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
                      className="!px-1.5 text-red-500 hover:text-red-700"
                      onClick={() => removeServiceRow(row.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Products Section */}
        <div>
          <div className="mb-2 flex items-center justify-between">
            <label className="text-xs font-semibold text-gray-700">Products</label>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              icon={<Plus className="h-3.5 w-3.5" />}
              onClick={() => setProductRows((rows) => [...rows, createProductRow()])}
            >
              Add Product
            </Button>
          </div>
          <div className="space-y-2">
            {productRows.length === 0 ? (
              <p className="text-xs text-gray-400 italic">No products added.</p>
            ) : (
              productRows.map((row) => {
                const isInvalid = invalidProductRowIds.includes(row.id);
                return (
                  <div
                    key={row.id}
                    className={cn(
                      'grid gap-2 rounded-xl border p-2.5 md:grid-cols-[1.2fr_1fr_70px_100px_36px]',
                      isInvalid ? 'border-red-300 bg-red-50/70' : 'border-gray-100 bg-gray-50'
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
                      placeholder="Sold By"
                    />
                    <Input
                      type="number"
                      min="1"
                      placeholder="Qty"
                      value={row.quantity}
                      onChange={(event) => updateProductRow(row.id, 'quantity', event.target.value)}
                    />
                    <Input
                      type="number"
                      min="0"
                      placeholder="Unit price"
                      value={row.price}
                      onChange={(event) => updateProductRow(row.id, 'price', event.target.value)}
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      className="!px-1.5 text-red-500 hover:text-red-700"
                      onClick={() => removeProductRow(row.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Payment & Amount Details */}
        <div className="grid gap-3 md:grid-cols-2">
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-600">Payment Method</label>
            <Select
              value={paymentMethod}
              onChange={(event) => setPaymentMethod(event.target.value)}
              options={paymentMethodOptions}
              placeholder="Payment method"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-600">Payment Status</label>
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
        </div>

        <div className="grid gap-3 md:grid-cols-2">
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-600">Total Amount (₹)</label>
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
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-600">Paid Amount (₹)</label>
              <Input
                type="number"
                min="0"
                placeholder="Enter paid amount"
                value={paidAmount}
                onChange={(event) => setPaidAmount(event.target.value)}
              />
            </div>
          )}
        </div>

        {/* Notes */}
        <div>
          <label className="mb-1 block text-xs font-medium text-gray-600">Notes</label>
          <textarea
            className="w-full rounded-xl border border-gray-200 p-2.5 text-sm outline-none focus:ring-2 focus:ring-[var(--color-brand-gold)]"
            rows={2}
            placeholder="Notes..."
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
          />
        </div>
      </ModalBody>
      <ModalFooter>
        <div className="flex justify-end gap-2">
          <Button variant="outline" type="button" onClick={onClose}>
            Cancel
          </Button>
          <Button type="button" isLoading={isUpdating} onClick={handleSubmit}>
            Save Changes
          </Button>
        </div>
      </ModalFooter>
    </Modal>
  );
};

/* ─── Appointment List Tab ───────────────────────────────── */
const AppointmentListTab: React.FC<{
  salonId: string;
  highlightAppointmentId?: string | null;
  initialSearch?: string;
  onHighlightConsumed?: () => void;
}> = ({ salonId, highlightAppointmentId = null, initialSearch = '', onHighlightConsumed }) => {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState(initialSearch);
  const [paymentStatusFilter, setPaymentStatusFilter] = useState('');
  const [sortBy] = useState('start_datetime');
  const [sortOrder, setSortOrder] = useState<'desc' | 'asc'>('desc');
  const [debouncedSearch, setDebouncedSearch] = useState(initialSearch);
  const [downloadingBillId, setDownloadingBillId] = useState<string | null>(null);
  const [updatingAppointment, setUpdatingAppointment] = useState<AppointmentListItem | null>(null);
  const [editingAppointment, setEditingAppointment] = useState<AppointmentListItem | null>(null);
  const [activeHighlightId, setActiveHighlightId] = useState<string | null>(highlightAppointmentId);
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const highlightTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const userRole = useAppSelector((state) => state.auth.user?.role);
  const canEdit = canEditAppointment(userRole);

  const [fetchBillByAppointment] = useLazyGetBillByAppointmentQuery();
  const [fetchBillDetail] = useLazyGetBillDetailQuery();
  const [updatePayment, { isLoading: isUpdatingPayment }] = useUpdateAppointmentPaymentMutation();

  useEffect(() => {
    if (!initialSearch) return;
    setSearch(initialSearch);
    setDebouncedSearch(initialSearch);
    setPage(1);
  }, [initialSearch]);

  useEffect(() => {
    if (!highlightAppointmentId) return;
    setActiveHighlightId(highlightAppointmentId);
    if (highlightTimerRef.current) clearTimeout(highlightTimerRef.current);
    highlightTimerRef.current = setTimeout(() => {
      setActiveHighlightId(null);
      onHighlightConsumed?.();
    }, 8000);
    return () => {
      if (highlightTimerRef.current) clearTimeout(highlightTimerRef.current);
    };
  }, [highlightAppointmentId]); // eslint-disable-line react-hooks/exhaustive-deps -- consume once per highlight id

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
      payment_status: paymentStatusFilter || undefined,
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

  useEffect(() => {
    if (!activeHighlightId || items.length === 0) return;
    const el = document.querySelector(`[data-appointment-id="${activeHighlightId}"]`);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [activeHighlightId, items]);

  const handlePaymentUpdate = async (payload: {
    payment_status: 'PAID' | 'PARTIALLY_PAID';
    paid_amount?: number;
    payment_type?: string;
  }) => {
    if (!updatingAppointment) return;
    try {
      const response = await updatePayment({
        id: updatingAppointment.id,
        ...payload,
      }).unwrap();
      if (response.success) {
        showToast('success', response.message || 'Payment status updated');
        setUpdatingAppointment(null);
      }
    } catch (err: unknown) {
      showToast('error', getApiErrorMessage(err, 'Failed to update payment status'));
    }
  };

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
        <div className="w-44">
          <Select
            value={paymentStatusFilter}
            onChange={(e) => {
              setPaymentStatusFilter(e.target.value);
              setPage(1);
            }}
            options={[
              { value: '', label: 'All payment statuses' },
              ...paymentStatusOptions,
            ]}
            placeholder="Filter payment status"
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
              <th className="px-3 py-3 text-left font-semibold text-gray-500">Products</th>
              <th className="px-3 py-3 text-right font-semibold text-gray-500">Quantity</th>
              <th className="px-3 py-3 text-left font-semibold text-gray-500">Service By</th>
              <th className="px-3 py-3 text-left font-semibold text-gray-500">Sold By</th>
              <th className="px-3 py-3 text-left font-semibold text-gray-500">Date & Time</th>
              <th className="px-3 py-3 text-left font-semibold text-gray-500">Payment Status</th>
              <th className="px-3 py-3 text-left font-semibold text-gray-500">Payment</th>
              <th className="px-3 py-3 text-right font-semibold text-gray-500">Bill</th>
              <th className="px-3 py-3 text-right font-semibold text-gray-500">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 bg-white">
            {isLoading ? (
              Array.from({ length: 6 }).map((_, i) => <SkeletonRow key={i} />)
            ) : isError ? (
              <tr>
                <td colSpan={13} className="px-3 py-12 text-center text-sm text-red-500">
                  Failed to load appointments. Please try again.
                </td>
              </tr>
            ) : items.length === 0 ? (
              <tr>
                <td colSpan={13} className="px-3 py-16 text-center">
                  <div className="flex flex-col items-center gap-2">
                    <CalendarDays className="h-10 w-10 text-gray-300" />
                    <p className="text-sm font-medium text-gray-500">No appointments found</p>
                    {(debouncedSearch || paymentStatusFilter) && (
                      <p className="text-xs text-gray-400">Try adjusting your filters</p>
                    )}
                  </div>
                </td>
              </tr>
            ) : (
              items.map((appt) => {
                const rowKey = appt.row_id || appt.id;
                const isHighlighted = activeHighlightId === appt.id;
                return (
                <tr
                  key={rowKey}
                  data-appointment-id={appt.id}
                  className={cn(
                    'transition-colors',
                    isHighlighted
                      ? 'bg-amber-50 ring-2 ring-inset ring-[var(--color-brand-gold)]'
                      : 'hover:bg-gray-50'
                  )}
                >
                  <td className="px-3 py-3 font-mono text-xs text-gray-500">
                    {appt.bill_reference || appt.id.slice(-8).toUpperCase()}
                  </td>
                  <td className="px-3 py-3 font-medium text-gray-900">{appt.customer_name}</td>
                  <td className="px-3 py-3 text-gray-600">{appt.customer_phone || '-'}</td>
                  <td className="px-3 py-3 text-gray-600 max-w-40">
                    <span className="line-clamp-2">
                      {appt.services.map((s) => s.name).join(', ') || '-'}
                    </span>
                  </td>
                  <td className="px-3 py-3 text-gray-600 max-w-40">
                    <span className="line-clamp-2">
                      {appt.products.map((p) => formatProductListLabel(p)).join(', ') || '-'}
                    </span>
                  </td>
                  <td className="px-3 py-3 text-right text-gray-600 tabular-nums">
                    {appt.quantity != null ? appt.quantity : '-'}
                  </td>
                  <td className="px-3 py-3 text-gray-600">{appt.service_by || '-'}</td>
                  <td className="px-3 py-3 text-gray-600">{appt.sold_by || '-'}</td>
                  <td className="px-3 py-3 text-gray-600 whitespace-nowrap">
                    <p className="font-medium text-gray-900">{formatDateDMY(appt.start_datetime)}</p>
                    <p className="text-xs text-gray-500">{formatTime(appt.start_datetime)}</p>
                  </td>
                  <td className="px-3 py-3">
                    <span
                      className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${paymentStatusStyles[appt.payment_status] ?? 'bg-gray-100 text-gray-600'}`}
                    >
                      {paymentStatusLabels[appt.payment_status] ?? appt.payment_status}
                    </span>
                  </td>
                  <td className="px-3 py-3">
                    <div>
                      <p className="font-medium text-gray-900">₹{appt.total_price}</p>
                      <p className="text-xs text-gray-500">
                        {appt.payment_type || '-'}
                        {canUpdatePaymentStatus(appt.payment_status)
                          ? ` · paid ₹${appt.paid_amount || 0}`
                          : ''}
                      </p>
                    </div>
                  </td>
                  <td className="px-3 py-3 text-right">
                    <Button
                      type="button"
                      variant="ghost"
                      className="!px-2 !py-1 text-xs"
                      title={appt.payment_status === 'PENDING' ? 'No bill yet' : 'Download bill'}
                      disabled={downloadingBillId === rowKey}
                      onClick={async () => {
                        if (appt.payment_status === 'PENDING') {
                          showToast('warning', 'No bill available — payment is still pending.');
                          return;
                        }
                        setDownloadingBillId(rowKey);
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
                      {downloadingBillId === rowKey ? (
                        <span className="text-xs text-gray-400">…</span>
                      ) : appt.payment_status === 'PENDING' ? (
                        <ReceiptText className="h-4 w-4 text-gray-300" />
                      ) : (
                        <Download className="h-4 w-4 text-[var(--color-brand-gold)]" />
                      )}
                    </Button>
                  </td>
                  <td className="px-3 py-3 text-right">
                    {canEdit ? (
                      <Button
                        type="button"
                        variant="ghost"
                        className="!px-2 !py-1 text-xs text-[var(--color-brand-gold)]"
                        title="Edit appointment"
                        onClick={() => setEditingAppointment(appt)}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                    ) : (
                      <span className="text-xs text-gray-300">—</span>
                    )}
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
        <div className="flex items-center justify-between border-t border-gray-100 px-4 py-3">
          <p className="text-xs text-gray-500">
            Showing <span className="font-medium">{startItem}–{endItem}</span> of{' '}
            <span className="font-medium">{total}</span> entries
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

      <PaymentUpdateModal
        open={Boolean(updatingAppointment)}
        appointment={updatingAppointment}
        isLoading={isUpdatingPayment}
        onClose={() => setUpdatingAppointment(null)}
        onSubmit={handlePaymentUpdate}
      />

      <EditAppointmentModal
        open={Boolean(editingAppointment)}
        appointment={editingAppointment}
        salonId={salonId}
        onClose={() => setEditingAppointment(null)}
        onSuccess={() => setEditingAppointment(null)}
      />
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
  const allowMembership = canManageMembership(role);
  const salonId = (orgId ?? (isSuperAdmin ? selectedSalonId : storedOrgId) ?? '').trim();

  const [activeTab, setActiveTab] = useState<Tab>('entry');
  const [highlightAppointmentId, setHighlightAppointmentId] = useState<string | null>(null);
  const [listSearchSeed, setListSearchSeed] = useState('');

  const openAppointmentInList = (item: AppointmentListItem) => {
    setListSearchSeed(item.customer_phone || item.customer_name || '');
    setHighlightAppointmentId(item.id);
    setActiveTab('list');
  };

  const defaultStart = useMemo(() => {
    const date = new Date();
    date.setMinutes(date.getMinutes() + 5);
    return toDateTimeInputValue(date);
  }, []);

  const [clientSearch, setClientSearch] = useState('');
  const [clientSearchResults, setClientSearchResults] = useState<AppointmentClient[]>([]);
  const [hasClientSearched, setHasClientSearched] = useState(false);
  const [selectedClient, setSelectedClient] = useState<AppointmentClient | null>(null);
  const [quickAddOpen, setQuickAddOpen] = useState(false);
  const [clientForm, setClientForm] = useState({
    name: '',
    phone: '',
    email: '',
    gender: '',
    is_member: false,
  });
  const [clientPhoneError, setClientPhoneError] = useState('');
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
  const [showOosConfirmModal, setShowOosConfirmModal] = useState(false);
  const [oosProductsToConfirm, setOosProductsToConfirm] = useState<string[]>([]);
  const [pendingSubmitData, setPendingSubmitData] = useState<CreateFrontDeskAppointmentRequest | null>(null);

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
  const [searchClients, { isFetching: isSearchingClients }] =
    useLazySearchAppointmentClientsQuery();
  const [checkClientPhone] = useLazyCheckAppointmentClientPhoneQuery();
  const [createClient, { isLoading: isCreatingClient }] = useCreateAppointmentClientMutation();
  const [createAppointment, { isLoading: isSubmitting }] = useCreateFrontDeskAppointmentMutation();

  const [showDropdown, setShowDropdown] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const [isFullSearch, setIsFullSearch] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const isProgrammaticChange = useRef(false);

  const debouncedClientSearch = useDebouncedSearch(clientSearch, 250);

  useEffect(() => {
    if (isProgrammaticChange.current) {
      isProgrammaticChange.current = false;
      return;
    }

    const term = debouncedClientSearch.trim();
    if (!term) {
      setClientSearchResults([]);
      setHasClientSearched(false);
      setIsFullSearch(false);
      setSelectedClient(null);
      setShowDropdown(false);
      return;
    }

    const fetchSuggestions = async () => {
      try {
        const response = await searchClients({ search: term }).unwrap();
        setClientSearchResults(response.data ?? []);
        setHasClientSearched(true);
        setShowDropdown(true);
        setHighlightedIndex(-1);
      } catch {
        setClientSearchResults([]);
        setHasClientSearched(true);
      }
    };

    void fetchSuggestions();
  }, [debouncedClientSearch, searchClients, setSelectedClient]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (!showDropdown) return;

    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setHighlightedIndex((prevIndex) =>
        prevIndex < clientSearchResults.length - 1 ? prevIndex + 1 : 0
      );
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setHighlightedIndex((prevIndex) =>
        prevIndex > 0 ? prevIndex - 1 : clientSearchResults.length - 1
      );
    } else if (event.key === 'Enter') {
      event.preventDefault();
      if (highlightedIndex >= 0 && highlightedIndex < clientSearchResults.length) {
        applyClientSelection(clientSearchResults[highlightedIndex]);
      } else if (clientSearch.trim()) {
        void handleClientSearch(event);
      }
    } else if (event.key === 'Escape') {
      setShowDropdown(false);
    }
  };

  const services = servicesData?.data ?? [];
  const products = productsData?.data ?? [];
  const staff = staffData?.data ?? [];
  const history = historyData?.data ?? [];

  const serviceOptions = services.map((service) => ({
    value: service.salon_service_id,
    label: service.service_name,
  }));
  const productOptions = products.map((product: AppointmentProductOption) => {
    const stockQty = product.stock_quantity;
    const isOos = stockQty !== undefined && stockQty <= 0;
    return {
      value: product.salon_product_id,
      label: isOos
        ? `${product.product_name} (${stockQty !== undefined && stockQty < 0 ? `Stock: ${stockQty}` : 'Out of Stock'})`
        : product.product_name,
    };
  });
  const staffOptions = staff.map((member) => ({ value: member.id, label: member.name }));

  const calculatedTotal = useMemo(
    () =>
      serviceRows.reduce((sum, row) => sum + Number(row.price || 0), 0) +
      productRows.reduce((sum, row) => sum + productLineTotal(row.price, row.quantity), 0),
    [productRows, serviceRows]
  );

  if (isSuperAdmin && !salonId) {
    return (
      <div className="min-h-screen bg-gray-50 p-4 md:p-6 xl:p-8">
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-800">
          Select a salon from the header to manage appointments.
        </div>
      </div>
    );
  }

  const prefillQuickAddFromSearch = (term: string) => {
    const digits = term.replace(/\D/g, '');
    const looksLikePhone = digits.length >= 6 && /^[\d\s+\-()]+$/.test(term);
    setClientForm((prev) => ({
      ...prev,
      name: looksLikePhone ? prev.name : term,
      phone: looksLikePhone ? term.trim() : prev.phone,
    }));
    setClientPhoneError('');
    setQuickAddOpen(true);
  };

  const handleClientSearch = async (event: React.FormEvent) => {
    event.preventDefault();
    const term = clientSearch.trim();
    if (term.length < 2) {
      showToast('warning', 'Enter at least 2 characters to search clients');
      return;
    }
    try {
      const response = await searchClients({ search: term }).unwrap();
      const matches = response.data ?? [];
      setClientSearchResults(matches);
      setHasClientSearched(true);
      setIsFullSearch(true);
      setShowDropdown(false);
      if (matches.length === 0) {
        prefillQuickAddFromSearch(term);
      } else {
        setQuickAddOpen(false);
      }
    } catch {
      setClientSearchResults([]);
      setHasClientSearched(true);
      setIsFullSearch(true);
      setShowDropdown(false);
      showToast('error', 'Failed to search clients');
    }
  };

  const handleClientPhoneBlur = async () => {
    const phone = clientForm.phone.trim();
    if (phone.length < 6) {
      setClientPhoneError('');
      return;
    }
    try {
      const result = await checkClientPhone({ phone }).unwrap();
      if (result.data?.exists && result.data.message) {
        setClientPhoneError(result.data.message);
      } else {
        setClientPhoneError('');
      }
    } catch {
      // Backend create remains the source of truth; ignore pre-check failures.
      setClientPhoneError('');
    }
  };

  const handleCreateClient = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!clientForm.name.trim() || !clientForm.phone.trim()) {
      showToast('warning', 'Name and phone number are required');
      return;
    }
    if (!clientForm.gender) {
      showToast('warning', 'Gender is required');
      return;
    }
    try {
      const phoneCheck = await checkClientPhone({ phone: clientForm.phone.trim() }).unwrap();
      if (phoneCheck.data?.exists && phoneCheck.data.message) {
        setClientPhoneError(phoneCheck.data.message);
        showToast('error', phoneCheck.data.message);
        return;
      }
      const response = await createClient({
        name: clientForm.name.trim(),
        phone: clientForm.phone.trim(),
        email: clientForm.email.trim() || undefined,
        gender: clientForm.gender,
        ...(allowMembership ? { is_member: Boolean(clientForm.is_member) } : {}),
      }).unwrap();
      if (response.data) {
        isProgrammaticChange.current = true;
        setSelectedClient(response.data);
        setClientForm({ name: '', phone: '', email: '', gender: '', is_member: false });
        setClientPhoneError('');
        setQuickAddOpen(false);
        setClientSearchResults([response.data]);
        setHasClientSearched(true);
        setClientSearch(response.data.name || response.data.phone || '');
        showToast('success', 'Client added');
      }
    } catch (err: unknown) {
      const message = getApiErrorMessage(err, 'Failed to add client');
      setClientPhoneError(message);
      showToast('error', message);
    }
  };

  const applyClientSelection = (client: AppointmentClient) => {
    isProgrammaticChange.current = true;
    setSelectedClient(client);
    setClientSearch(client.name || '');
    setShowDropdown(false);
    setClientSearchResults([]);
    setHasClientSearched(false);
    setServiceRows((rows) =>
      rows.map((row) => {
        if (!row.salon_service_id) return row;
        const selectedService = services.find(
          (service) => service.salon_service_id === row.salon_service_id
        );
        return {
          ...row,
          price: resolveServicePriceForClient(selectedService, client.is_member),
        };
      })
    );
  };

  const updateServiceRow = (rowId: string, field: keyof ServiceRow, value: string) => {
    setInvalidServiceRowIds((ids) => ids.filter((id) => id !== rowId));
    setServiceRows((rows) =>
      rows.map((row) => {
        if (row.id !== rowId) return row;
        if (field === 'salon_service_id') {
          const selectedService = services.find((service) => service.salon_service_id === value);
          const price = resolveServicePriceForClient(selectedService, selectedClient?.is_member);
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
    setServiceRows((rows) => rows.filter((row) => row.id !== rowId));
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
    isProgrammaticChange.current = true;
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
    setClientForm({ name: '', phone: '', email: '', gender: '', is_member: false });
    setInvalidServiceRowIds([]);
    setInvalidProductRowIds([]);
  };

  const executeSubmit = async (payload: CreateFrontDeskAppointmentRequest) => {
    try {
      const response = await createAppointment(payload).unwrap();
      if (response.success) {
        showToast('success', response.message || 'Appointment created successfully');
        resetEntryForm();
      }
    } catch (err: unknown) {
      showToast('error', getApiErrorMessage(err, 'Failed to create appointment'));
    }
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
    const serviceRowsToSubmit = serviceRows.filter((row) => !isServiceRowBlank(row));
    const invalidServiceIds = serviceRowsToSubmit
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

    if (!serviceRowsToSubmit.length && !productRowsToSubmit.length) {
      showToast('warning', 'Add at least one service or product');
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

    const payload = {
      salon_id: salonId,
      customer_id: selectedClient.id,
      start_datetime: new Date(startDateTime).toISOString(),
      services: serviceRowsToSubmit.map((row) => ({
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
        quantity: Math.max(1, Number(row.quantity || 1)),
      })),
      payment_type: paymentMethod,
      payment_status: paymentStatus,
      paid_amount: paymentStatus === 'PARTIALLY_PAID' ? Number(paidAmount) : undefined,
      total_amount: finalTotal,
      booking_source: 'WALK_IN',
      notes: notes.trim() || undefined,
    };

    const oosProducts = productRowsToSubmit
      .map((row) => {
        const item = products.find((p) => p.salon_product_id === row.salon_product_id);
        if (item && item.stock_quantity !== undefined && item.stock_quantity <= 0) {
          return item.product_name;
        }
        return null;
      })
      .filter((name): name is string => name !== null);

    if (oosProducts.length > 0) {
      setOosProductsToConfirm(oosProducts);
      setPendingSubmitData(payload);
      setShowOosConfirmModal(true);
      return;
    }

    await executeSubmit(payload);
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
            Front-desk workspace for walk-ins, services, and billing.
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
        <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(420px,1fr)_320px]">
          {/* Entry form */}
          <main className="space-y-5">
            <section className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <h2 className="font-semibold text-gray-900">Client</h2>
                  <p className="text-sm text-gray-500">Search by phone or name, then select history.</p>
                </div>
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  icon={<Plus className="h-4 w-4" />}
                  onClick={() => setQuickAddOpen((open) => !open)}
                >
                  Add
                </Button>
              </div>
              <form onSubmit={handleClientSearch} className="flex gap-2 relative">
                <div ref={dropdownRef} className="relative flex-1">
                  <Input
                    placeholder="Phone number or client name"
                    value={clientSearch}
                    onChange={(event) => {
                      setClientSearch(event.target.value);
                      setIsFullSearch(false);
                      if (hasClientSearched) {
                        setHasClientSearched(false);
                        setClientSearchResults([]);
                      }
                    }}
                    onKeyDown={handleKeyDown}
                    onFocus={() => {
                      if (clientSearchResults.length > 0) {
                        setShowDropdown(true);
                      }
                    }}
                  />

                  {isSearchingClients && (
                    <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center">
                      <svg className="animate-spin h-4 w-4 text-[var(--color-brand-gold)]" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                    </div>
                  )}

                  {!isSearchingClients && selectedClient && (
                    <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1.5">
                      <span className="text-xs font-semibold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded flex items-center gap-0.5">
                        ✓
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          setClientSearch('');
                          setSelectedClient(null);
                          setClientSearchResults([]);
                          setHasClientSearched(false);
                          setShowDropdown(false);
                          setIsFullSearch(false);
                        }}
                        className="text-gray-400 hover:text-gray-600 font-medium text-sm transition"
                        title="Clear selection"
                      >
                        ✕
                      </button>
                    </div>
                  )}

                  {showDropdown && (clientSearchResults.length > 0 || (hasClientSearched && clientSearch.trim().length > 0)) && (
                    <div className="absolute z-50 left-0 right-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-lg max-h-60 overflow-y-auto divide-y divide-gray-100">
                      {clientSearchResults.map((client, index) => (
                        <div
                          key={client.id}
                          onClick={() => applyClientSelection(client)}
                          onMouseEnter={() => setHighlightedIndex(index)}
                          className={cn(
                            "p-3 cursor-pointer transition text-left",
                            index === highlightedIndex ? "bg-amber-50" : "bg-white"
                          )}
                        >
                          <div className="flex items-center justify-between">
                            <span className="font-semibold text-gray-900 text-sm">
                              {client.name}
                              {client.is_member && (
                                <span className="ml-2 text-xs font-semibold text-indigo-700 bg-indigo-50 px-1.5 py-0.5 rounded">
                                  Member
                                </span>
                              )}
                            </span>
                            {client.gender && (
                              <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-600 capitalize">
                                {client.gender.toLowerCase()}
                              </span>
                            )}
                          </div>
                          <div className="flex items-center justify-between text-xs text-gray-500 mt-1">
                            <span>{client.phone}</span>
                            {client.email && <span className="truncate max-w-[200px]">{client.email}</span>}
                          </div>
                        </div>
                      ))}
                      {clientSearchResults.length === 0 && (
                        <div className="p-4 text-center text-sm text-gray-500">
                          No clients found
                          {!quickAddOpen && (
                            <button
                              type="button"
                              className="mt-2 block w-full text-[var(--color-brand-gold)] font-medium hover:underline text-center text-xs"
                              onClick={(e) => {
                                e.stopPropagation();
                                prefillQuickAddFromSearch(clientSearch.trim());
                                setShowDropdown(false);
                              }}
                            >
                              + Add New Client
                            </button>
                          )}
                        </div>
                      )}
                      {clientSearchResults.length >= 10 && (
                        <div className="p-2 bg-gray-50 text-center border-t border-gray-100">
                          <button
                            type="button"
                            className="text-xs text-[var(--color-brand-gold)] font-medium hover:underline"
                            onClick={(e) => {
                              e.stopPropagation();
                              setIsFullSearch(true);
                              setShowDropdown(false);
                            }}
                          >
                            View all matching clients
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
                <Button type="submit" isLoading={isSearchingClients} icon={<Search className="h-4 w-4" />}>
                  Search
                </Button>
              </form>

              {isFullSearch && clientSearchResults.length > 0 && (
                <div className="mt-4 grid gap-2 md:grid-cols-2">
                  {clientSearchResults.map((client) => (
                    <button
                      key={client.id}
                      type="button"
                      onClick={() => applyClientSelection(client)}
                      className={`rounded-xl border p-3 text-left transition hover:border-[var(--color-brand-gold)] ${
                        selectedClient?.id === client.id
                          ? 'border-[var(--color-brand-gold)] bg-amber-50'
                          : 'border-gray-200 bg-white'
                      }`}
                    >
                      <p className="font-medium text-gray-900">{client.name}</p>
                      <p className="text-xs font-semibold text-indigo-700">
                        {client.is_member ? 'Member' : 'Non-member'}
                      </p>
                      <p className="text-sm text-gray-500">{client.phone}</p>
                    </button>
                  ))}
                </div>
              )}

              {isFullSearch && clientSearchResults.length === 0 && !isSearchingClients && (
                <div className="mt-4 rounded-xl border border-dashed border-gray-200 bg-gray-50 p-4">
                  <p className="text-sm text-gray-600">
                    No client found for &ldquo;{clientSearch.trim()}&rdquo;.
                  </p>
                  {!quickAddOpen && (
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      className="mt-3"
                      icon={<Plus className="h-4 w-4" />}
                      onClick={() => prefillQuickAddFromSearch(clientSearch.trim())}
                    >
                      Quick add client
                    </Button>
                  )}
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
                    <div>
                      <Input
                        placeholder="Phone *"
                        value={clientForm.phone}
                        onChange={(event) => {
                          setClientPhoneError('');
                          setClientForm({ ...clientForm, phone: event.target.value });
                        }}
                        onBlur={() => {
                          void handleClientPhoneBlur();
                        }}
                        className={clientPhoneError ? 'border-red-400' : undefined}
                      />
                      {clientPhoneError && (
                        <p className="mt-1 text-xs text-red-500">{clientPhoneError}</p>
                      )}
                    </div>
                    <Input
                      placeholder="Email optional"
                      value={clientForm.email}
                      onChange={(event) => setClientForm({ ...clientForm, email: event.target.value })}
                    />
                    <div className="flex items-end gap-3">
                      <div className="min-w-0 flex-1">
                        <label className="mb-1 block text-xs font-medium text-gray-600">Gender *</label>
                        <Select
                          value={clientForm.gender}
                          onChange={(event) =>
                            setClientForm({ ...clientForm, gender: event.target.value })
                          }
                          options={clientGenderOptions}
                          placeholder="Select Gender"
                        />
                      </div>
                      {allowMembership && (
                        <label className="mb-2 flex shrink-0 items-center gap-2 text-sm text-gray-700">
                          <input
                            type="checkbox"
                            checked={clientForm.is_member}
                            onChange={(event) =>
                              setClientForm({ ...clientForm, is_member: event.target.checked })
                            }
                            className="h-4 w-4 rounded border-gray-300"
                          />
                          Member
                        </label>
                      )}
                    </div>
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
                  <p className="text-sm text-gray-500">Add multiple service with assigned staff.</p>
                </div>
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  icon={<Plus className="h-4 w-4" />}
                  onClick={() => setServiceRows((rows) => [...rows, createRow()])}
                >
                  Add
                </Button>
              </div>
              <div className="space-y-3">
                {serviceRows.length === 0 ? (
                  <p className="rounded-xl border border-dashed border-gray-200 bg-gray-50 p-4 text-sm text-gray-500">
                    No services added yet. You can sell products without a service.
                  </p>
                ) : (
                  serviceRows.map((row) => {
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
                          placeholder="Service By"
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
                  })
                )}
              </div>
            </section>

            <section className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <h2 className="font-semibold text-gray-900">Products</h2>
                  <p className="text-sm text-gray-500">Add products with quantity and sold-by staff.</p>
                </div>
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  icon={<Plus className="h-4 w-4" />}
                  onClick={() => setProductRows((rows) => [...rows, createProductRow()])}
                >
                  Add
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
                          'grid gap-3 rounded-xl border p-3 md:grid-cols-[1.2fr_1fr_80px_110px_40px]',
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
                          placeholder="Sold By"
                        />
                        <Input
                          type="number"
                          min="1"
                          step="1"
                          placeholder="Qty"
                          value={row.quantity}
                          onChange={(event) => updateProductRow(row.id, 'quantity', event.target.value)}
                        />
                        <Input
                          type="number"
                          min="0"
                          placeholder="Unit price"
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
                          <p className="text-xs font-medium text-red-600 md:col-span-5">
                            Complete this product row (product, sold by, qty, price) or remove it.
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
                  {history.slice(0, 5).map((item) => {
                    const canUpdate = canUpdatePaymentStatus(item.payment_status);
                    return (
                      <div key={item.id} className="rounded-xl bg-gray-50 p-3 text-sm">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <p className="font-medium text-gray-900">
                              {formatDateDMY(item.start_datetime)}
                            </p>
                            <p className="mt-1 text-gray-500">
                              {[
                                ...item.services.map((s) => s.name),
                                ...item.products.map((p) => p.name),
                              ].join(', ')}
                            </p>
                          </div>
                          <span
                            className={`inline-flex shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${paymentStatusStyles[item.payment_status] ?? 'bg-gray-100 text-gray-600'}`}
                          >
                            {paymentStatusLabels[item.payment_status] ?? item.payment_status}
                          </span>
                        </div>
                        {canUpdate && (
                          <div className="mt-3">
                            <Button
                              type="button"
                              variant="secondary"
                              size="sm"
                              className="!px-2 !py-1 text-xs"
                              icon={<Pencil className="h-3.5 w-3.5" />}
                              onClick={() => openAppointmentInList(item)}
                            >
                              Update payment
                            </Button>
                          </div>
                        )}
                      </div>
                    );
                  })}
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
                {selectedClient && (
                  <p className="text-xs font-semibold text-indigo-700">
                    {selectedClient.is_member ? 'Member' : 'Non-member'}
                  </p>
                )}
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
                        <span>₹{row.price !== '' ? row.price : item.price}</span>
                      </div>
                    );
                  })}
                  {productRows.map((row) => {
                    const item = products.find((product) => product.salon_product_id === row.salon_product_id);
                    if (!item) return null;
                    const qty = Math.max(1, Number(row.quantity || 1));
                    const lineTotal = productLineTotal(row.price || item.price, qty);
                    return (
                      <div key={row.id} className="flex items-center justify-between gap-3">
                        <span>
                          {item.product_name}
                          {qty > 1 ? ` × ${qty}` : ''}
                        </span>
                        <span>₹{lineTotal}</span>
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
        <AppointmentListTab
          salonId={salonId}
          highlightAppointmentId={highlightAppointmentId}
          initialSearch={listSearchSeed}
          onHighlightConsumed={() => {
            setHighlightAppointmentId(null);
            setListSearchSeed('');
          }}
        />
      )}

      {/* Out of Stock Confirmation Modal */}
      <Modal open={showOosConfirmModal} onClose={() => setShowOosConfirmModal(false)}>
        <ModalHeader>
          Confirm Out of Stock Sale
        </ModalHeader>
        <ModalBody>
          <div className="space-y-4">
            <p className="text-sm text-gray-600">
              The following products are currently marked as **Out of Stock**:
            </p>
            <ul className="list-inside list-disc space-y-1 text-sm font-semibold text-red-600">
              {oosProductsToConfirm.map((name, index) => (
                <li key={index}>{name}</li>
              ))}
            </ul>
            <p className="text-sm text-gray-500">
              Would you like to proceed with the checkout anyway? The system will record these as out-of-stock sales and adjust the inventory accordingly.
            </p>
          </div>
        </ModalBody>
        <ModalFooter>
          <div className="flex justify-end gap-3">
            <Button
              variant="outline"
              type="button"
              onClick={() => {
                setShowOosConfirmModal(false);
                setPendingSubmitData(null);
              }}
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={() => {
                setShowOosConfirmModal(false);
                if (pendingSubmitData) {
                  void executeSubmit(pendingSubmitData);
                }
              }}
            >
              Continue Anyway
            </Button>
          </div>
        </ModalFooter>
      </Modal>
    </div>
  );
};

export default Appointments;
