import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Plus, Trash2, UserPlus } from 'lucide-react';
import { Button, CommonDropdown, Input, Modal, Select } from '../common';
import ModalBody from '../common/Modal/ModalBody';
import ModalFooter from '../common/Modal/ModalFooter';
import ModalHeader from '../common/Modal/ModalHeader';
import { showToast } from '../common/Toast/toastService';
import { getApiErrorMessage } from '../../utils/apiErrors';
import { cn } from '../../utils/cn';
import { useAppSelector } from '../../redux/hooks';
import { normalizeRole } from '../../config/rbac';
import { ROLES } from '../../constants';
import {
  useUpdateFrontDeskAppointmentMutation,
  useGetAppointmentSalonServicesQuery,
  useGetAppointmentSalonProductsQuery,
  useGetAppointmentStaffQuery,
} from '../../redux/slices/appointments/appointmentsApi';
import type {
  AppointmentListItem,
  AppointmentProductOption,
} from '../../redux/slices/appointments/Types';

export type ServiceRow = {
  id: string;
  salon_service_id: string;
  service_id: string;
  staff_id: string;
  price: string;
};

export type ProductRow = {
  id: string;
  salon_product_id: string;
  product_id: string;
  staff_id: string;
  price: string;
  quantity: string;
};

export const paymentMethodOptions = [
  { value: 'CASH', label: 'Cash' },
  { value: 'UPI', label: 'UPI' },
  { value: 'CARD', label: 'Card' },
];

export const paymentStatusOptions = [
  { value: 'PAID', label: 'Paid' },
  { value: 'PENDING', label: 'Pending' },
  { value: 'PARTIALLY_PAID', label: 'Partial' },
];

export function canEditAppointment(role: string | undefined): boolean {
  const normalized = normalizeRole(role);
  return (
    normalized === ROLES.SUPER_ADMIN ||
    normalized === ROLES.SALON_OWNER ||
    normalized === ROLES.SALON_ADMIN ||
    normalized === ROLES.ADMIN ||
    normalized === ROLES.SALON_MANAGER ||
    normalized === 'manager' ||
    normalized === 'salon_manager'
  );
}

export function createRow(staffId: string = ''): ServiceRow {
  return { id: crypto.randomUUID(), salon_service_id: '', service_id: '', staff_id: staffId, price: '' };
}

export function createProductRow(staffId: string = ''): ProductRow {
  return {
    id: crypto.randomUUID(),
    salon_product_id: '',
    product_id: '',
    staff_id: staffId,
    price: '',
    quantity: '1',
  };
}

export function hasValidPrice(value: string): boolean {
  return value.trim() !== '' && Number.isFinite(Number(value)) && Number(value) >= 0;
}

export function hasValidQuantity(value: string): boolean {
  const qty = Number(value);
  return value.trim() !== '' && Number.isInteger(qty) && qty >= 1;
}

export function isServiceRowComplete(row: ServiceRow): boolean {
  return Boolean(row.salon_service_id && row.staff_id && hasValidPrice(row.price));
}

export function isServiceRowBlank(row: ServiceRow): boolean {
  return !row.salon_service_id && !row.service_id && !row.staff_id && row.price.trim() === '';
}

export function isProductRowBlank(row: ProductRow): boolean {
  return (
    !row.salon_product_id &&
    !row.product_id &&
    !row.staff_id &&
    row.price.trim() === '' &&
    (row.quantity.trim() === '' || row.quantity.trim() === '1')
  );
}

export function isProductRowComplete(row: ProductRow): boolean {
  return Boolean(
    row.salon_product_id && row.staff_id && hasValidPrice(row.price) && hasValidQuantity(row.quantity)
  );
}

export function productLineTotal(unitPrice: string | number, quantity: string | number): number {
  const price = Number(unitPrice || 0);
  const qty = Math.max(1, Number(quantity || 1));
  return price * qty;
}

export function toDateTimeInputValue(date: Date): string {
  const pad = (v: number) => String(v).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export interface EditAppointmentModalProps {
  open: boolean;
  appointment: AppointmentListItem | null;
  salonId: string;
  onClose: () => void;
  onSuccess: () => void;
}

export const EditAppointmentModal: React.FC<EditAppointmentModalProps> = ({
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

  // Initialize modal state on open or appointment change
  useEffect(() => {
    if (!open || !appointment) return;

    try {
      const parsedDate = new Date(appointment.start_datetime);
      setStartDateTime(
        isNaN(parsedDate.getTime()) ? toDateTimeInputValue(new Date()) : toDateTimeInputValue(parsedDate)
      );
    } catch {
      setStartDateTime(toDateTimeInputValue(new Date()));
    }

    setPaymentMethod(appointment.payment_type || 'CASH');
    setPaymentStatus(appointment.payment_status || 'PAID');
    setPaidAmount(appointment.paid_amount ? String(appointment.paid_amount) : '');
    setTotalAmount(appointment.total_price ? String(appointment.total_price) : '');
    setNotes(appointment.notes || '');
    setInvalidServiceRowIds([]);
    setInvalidProductRowIds([]);

    const fullServices =
      appointment.all_services && appointment.all_services.length > 0
        ? appointment.all_services
        : appointment.services ?? [];

    const defaultStaffId = appointment.staff_id || (staff[0]?.id ?? '');

    if (fullServices && fullServices.length > 0) {
      setServiceRows(
        fullServices.map((s) => {
          const matched = services.find(
            (item) =>
              item.service_id === s.service_id ||
              item.salon_service_id === s.service_id ||
              item.service_name.toLowerCase() === (s.name || '').toLowerCase()
          );
          return {
            id: crypto.randomUUID(),
            salon_service_id: matched ? matched.salon_service_id : s.service_id || '',
            service_id: s.service_id || '',
            staff_id: s.staff_id || defaultStaffId,
            price: String(s.price),
          };
        })
      );
    } else {
      setServiceRows([]);
    }

    const fullProducts =
      appointment.all_products && appointment.all_products.length > 0
        ? appointment.all_products
        : appointment.products ?? [];

    if (fullProducts && fullProducts.length > 0) {
      setProductRows(
        fullProducts.map((p) => {
          const matched = products.find(
            (item) =>
              item.product_id === p.product_id ||
              item.salon_product_id === p.product_id ||
              item.product_name.toLowerCase() === (p.name || '').toLowerCase()
          );
          return {
            id: crypto.randomUUID(),
            salon_product_id: matched ? matched.salon_product_id : p.product_id || '',
            product_id: p.product_id || '',
            staff_id: p.staff_id || defaultStaffId,
            quantity: String(p.quantity || 1),
            price: String(p.price),
          };
        })
      );
    } else {
      setProductRows([]);
    }
  }, [open, appointment]);

  // Backfill staff_id when staff options finish loading if any row is missing staff
  useEffect(() => {
    if (!staff || staff.length === 0) return;
    const fallbackStaffId = staff[0].id;

    setServiceRows((prev) =>
      prev.map((r) => (!r.staff_id ? { ...r, staff_id: fallbackStaffId } : r))
    );
    setProductRows((prev) =>
      prev.map((r) => (!r.staff_id ? { ...r, staff_id: fallbackStaffId } : r))
    );
  }, [staff]);

  // Backfill service options matching if services finished loading
  useEffect(() => {
    if (!services || services.length === 0) return;
    setServiceRows((prev) =>
      prev.map((r) => {
        if (r.salon_service_id && !r.service_id) {
          const matched = services.find((s) => s.salon_service_id === r.salon_service_id);
          if (matched?.service_id) return { ...r, service_id: matched.service_id };
        } else if (!r.salon_service_id && r.service_id) {
          const matched = services.find(
            (s) => s.service_id === r.service_id || s.salon_service_id === r.service_id
          );
          if (matched) return { ...r, salon_service_id: matched.salon_service_id };
        }
        return r;
      })
    );
  }, [services]);

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

  const lastAddSameStaffTimeRef = useRef<number>(0);

  const handleAddSameStaffService = (currentRow: ServiceRow) => {
    const now = Date.now();
    if (now - lastAddSameStaffTimeRef.current < 300) return;
    lastAddSameStaffTimeRef.current = now;

    const staffToCarry = currentRow.staff_id || staff[0]?.id || '';
    const newRow = createRow(staffToCarry);

    setServiceRows((rows) => {
      const index = rows.findIndex((r) => r.id === currentRow.id);
      if (index !== -1) {
        const updated = [...rows];
        updated.splice(index + 1, 0, newRow);
        return updated;
      }
      return [...rows, newRow];
    });
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

    if (invalidServiceIds.length > 0 || invalidProductIds.length > 0) {
      showToast('warning', 'Please ensure all highlighted service or product items have a selection, assigned staff, and valid price.');
      return;
    }

    if (!serviceRowsToSubmit.length && !productRowsToSubmit.length) {
      showToast('warning', 'Please add at least one service or product');
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
        showToast('success', response.message || 'Billing updated successfully');
        onSuccess();
        onClose();
      }
    } catch (err: unknown) {
      showToast('error', getApiErrorMessage(err, 'Failed to update billing'));
    }
  };

  if (!appointment || !canEdit) return null;

  return (
    <Modal open={open} onClose={onClose} size="lg">
      <ModalHeader>
        <div>
          <h2 className="text-xl font-semibold text-gray-900">Edit Billing</h2>
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
            onChange={(event: React.ChangeEvent<HTMLInputElement>) => setStartDateTime(event.target.value)}
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
              onClick={() => setServiceRows((rows) => [...rows, createRow(staff[0]?.id ?? '')])}
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
                      'grid gap-2 rounded-xl border p-2.5 md:grid-cols-[1fr_1fr_110px_auto]',
                      isInvalid ? 'border-red-300 bg-red-50/70' : 'border-gray-100 bg-gray-50'
                    )}
                  >
                    <CommonDropdown
                      value={row.salon_service_id}
                      onChange={(value: string | string[]) =>
                        updateServiceRow(row.id, 'salon_service_id', Array.isArray(value) ? value[0] || '' : value)
                      }
                      options={serviceOptions}
                      placeholder="Search service"
                      searchable
                      loading={isLoadingSalonServices}
                    />
                    <Select
                      value={row.staff_id}
                      onChange={(event: React.ChangeEvent<HTMLSelectElement>) => updateServiceRow(row.id, 'staff_id', event.target.value)}
                      options={staffOptions}
                      placeholder="Service By"
                    />
                    <Input
                      type="number"
                      min="0"
                      placeholder="Price"
                      value={row.price}
                      onChange={(event: React.ChangeEvent<HTMLInputElement>) => updateServiceRow(row.id, 'price', event.target.value)}
                    />
                    <div className="flex items-center justify-end gap-1">
                      <Button
                        type="button"
                        variant="ghost"
                        className="!px-1.5 text-[var(--color-brand-gold-dark)] hover:bg-[var(--color-brand-gold-light)]/20 hover:text-[var(--color-brand-gold-dark)]"
                        title="Add another service for this staff"
                        aria-label="Add another service for this staff"
                        onClick={() => handleAddSameStaffService(row)}
                      >
                        <UserPlus className="h-4 w-4" />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        className="!px-1.5 text-red-500 hover:text-red-700"
                        title="Remove service"
                        aria-label="Remove service"
                        onClick={() => removeServiceRow(row.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
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
              onClick={() => setProductRows((rows) => [...rows, createProductRow(staff[0]?.id ?? '')])}
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
                      onChange={(value: string | string[]) =>
                        updateProductRow(row.id, 'salon_product_id', Array.isArray(value) ? value[0] || '' : value)
                      }
                      options={productOptions}
                      placeholder="Search product"
                      searchable
                      loading={isLoadingSalonProducts}
                    />
                    <Select
                      value={row.staff_id}
                      onChange={(event: React.ChangeEvent<HTMLSelectElement>) => updateProductRow(row.id, 'staff_id', event.target.value)}
                      options={staffOptions}
                      placeholder="Sold By"
                    />
                    <Input
                      type="number"
                      min="1"
                      placeholder="Qty"
                      value={row.quantity}
                      onChange={(event: React.ChangeEvent<HTMLInputElement>) => updateProductRow(row.id, 'quantity', event.target.value)}
                    />
                    <Input
                      type="number"
                      min="0"
                      placeholder="Unit price"
                      value={row.price}
                      onChange={(event: React.ChangeEvent<HTMLInputElement>) => updateProductRow(row.id, 'price', event.target.value)}
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
              onChange={(event: React.ChangeEvent<HTMLSelectElement>) => setPaymentMethod(event.target.value)}
              options={paymentMethodOptions}
              placeholder="Payment method"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-600">Payment Status</label>
            <Select
              value={paymentStatus}
              onChange={(event: React.ChangeEvent<HTMLSelectElement>) => {
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
              onChange={(event: React.ChangeEvent<HTMLInputElement>) => setTotalAmount(event.target.value)}
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
                onChange={(event: React.ChangeEvent<HTMLInputElement>) => setPaidAmount(event.target.value)}
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
            onChange={(event: React.ChangeEvent<HTMLTextAreaElement>) => setNotes(event.target.value)}
          />
        </div>
      </ModalBody>
      <ModalFooter>
        <div className="flex justify-end gap-2">
          <Button variant="outline" type="button" onClick={onClose}>
            Cancel
          </Button>
          <Button
            type="button"
            isLoading={isUpdating}
            disabled={isUpdating}
            onClick={handleSubmit}
          >
            Save Changes
          </Button>
        </div>
      </ModalFooter>
    </Modal>
  );
};
