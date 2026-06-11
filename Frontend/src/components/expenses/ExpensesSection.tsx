import React, { useEffect, useRef, useState } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Download,
  Eye,
  ExternalLink,
  Paperclip,
  Pencil,
  Search,
  Trash2,
  UploadCloud,
} from 'lucide-react';

import { Button, Input, Select } from '../common';
import Modal from '../common/Modal';
import ModalBody from '../common/Modal/ModalBody';
import ModalFooter from '../common/Modal/ModalFooter';
import ModalHeader from '../common/Modal/ModalHeader';
import { showToast } from '../common/Toast/toastService';
import {
  useCreateExpenseMutation,
  useDeleteExpenseMutation,
  useGetExpenseCategoriesQuery,
  useGetPaymentModesQuery,
  useLazyGetExpenseQuery,
  useListExpensesQuery,
  useUpdateExpenseMutation,
  useUploadExpenseReceiptMutation,
} from '../../redux/slices/expenses/expensesApi';
import { ExpenseItem } from '../../redux/slices/expenses/Types';
import { cn } from '../../utils/cn';
import { formatCurrency } from '../../utils/currency';
import { getApiErrorMessage } from '../../utils/apiErrors';
import { formatDateDMY, toDateInputValue } from '../../utils/utilities';

const LIMIT = 20;

type SortField = 'expense_date' | 'amount' | 'category' | 'payment_mode' | 'vendor_name' | 'expense_no';

interface ExpenseFormState {
  category: string;
  amount: string;
  payment_mode: string;
  expense_date: string;
  vendor_name: string;
  description: string;
}

const emptyFormState = (): ExpenseFormState => ({
  category: '',
  amount: '',
  payment_mode: '',
  expense_date: toDateInputValue(new Date()),
  vendor_name: '',
  description: '',
});

const SectionStack: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="space-y-5">{children}</div>
);

const FormField: React.FC<{
  label: string;
  required?: boolean;
  error?: string;
  children: React.ReactNode;
}> = ({ label, required, error, children }) => (
  <label className="block">
    <span className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-gray-500">
      {label}
      {required ? ' *' : ''}
    </span>
    {children}
    {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
  </label>
);

const ReceiptUploadBox: React.FC<{
  file: File | null;
  previewUrl: string | null;
  existingUrl?: string | null;
  onSelect: (file: File | null) => void;
}> = ({ file, previewUrl, existingUrl, onSelect }) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const displayUrl = previewUrl || existingUrl || null;
  const isPdf = file?.type === 'application/pdf' || existingUrl?.toLowerCase().endsWith('.pdf');

  const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const selected = event.target.files?.[0] ?? null;
    if (!selected) return;
    const allowed = ['image/png', 'image/jpeg', 'image/jpg', 'application/pdf'];
    if (!allowed.includes(selected.type)) {
      showToast('error', 'Only PNG, JPEG images and PDF files are allowed');
      return;
    }
    if (selected.size > 5 * 1024 * 1024) {
      showToast('error', 'Receipt file must be 5MB or smaller');
      return;
    }
    onSelect(selected);
  };

  return (
    <div className="rounded-2xl border border-dashed border-[var(--color-border-strong)] bg-[var(--color-surface-bg)] p-6 text-center">
      <input
        ref={inputRef}
        type="file"
        accept="image/png,image/jpeg,application/pdf"
        className="hidden"
        onChange={handleChange}
      />
      {displayUrl && !isPdf ? (
        <img src={displayUrl} alt="Receipt preview" className="mx-auto max-h-40 rounded-xl object-contain" />
      ) : (
        <UploadCloud className="mx-auto h-8 w-8 text-[var(--color-brand-gold-dark)]" />
      )}
      <p className="mt-3 text-sm font-semibold text-[var(--color-text-primary)]">
        {file ? file.name : 'Upload receipt'}
      </p>
      <p className="mt-1 text-xs text-gray-500">PDF, PNG, JPG up to 5 MB</p>
      <div className="mt-4 flex flex-wrap justify-center gap-2">
        <Button
          type="button"
          variant="secondary"
          size="sm"
          className="rounded-xl"
          onClick={() => inputRef.current?.click()}
        >
          Choose file
        </Button>
        {existingUrl && (
          <a
            href={existingUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 rounded-xl border border-[var(--color-border-soft)] px-3 py-2 text-xs font-semibold text-[var(--color-brand-gold-dark)]"
          >
            <ExternalLink className="h-3.5 w-3.5" />
            View receipt
          </a>
        )}
      </div>
    </div>
  );
};

const ExpenseForm: React.FC<{
  form: ExpenseFormState;
  errors: Partial<Record<keyof ExpenseFormState, string>>;
  categoryOptions: { value: string; label: string }[];
  paymentOptions: { value: string; label: string }[];
  receiptFile: File | null;
  receiptPreview: string | null;
  existingReceiptUrl?: string | null;
  onChange: <K extends keyof ExpenseFormState>(field: K, value: ExpenseFormState[K]) => void;
  onReceiptSelect: (file: File | null) => void;
}> = ({
  form,
  errors,
  categoryOptions,
  paymentOptions,
  receiptFile,
  receiptPreview,
  existingReceiptUrl,
  onChange,
  onReceiptSelect,
}) => (
  <div className="grid gap-5 xl:grid-cols-[1fr_320px]">
    <div className="rounded-[1.5rem] border border-[var(--color-border-soft)] bg-white p-5 shadow-soft">
      <h3 className="text-lg font-bold text-[var(--color-text-primary)]">Expense details</h3>
      <div className="mt-5 grid gap-4 md:grid-cols-2">
        <FormField label="Category" required error={errors.category}>
          <Select
            className="!h-11 rounded-2xl border-[var(--color-border-strong)]"
            value={form.category}
            onChange={(e) => onChange('category', e.target.value)}
            placeholder="Select category"
            options={[{ value: '', label: 'Select category' }, ...categoryOptions]}
          />
        </FormField>
        <FormField label="Amount" required error={errors.amount}>
          <Input
            className="!h-11 rounded-2xl border-[var(--color-border-strong)]"
            placeholder="0.00"
            value={form.amount}
            onChange={(e) => onChange('amount', e.target.value)}
          />
        </FormField>
        <FormField label="Payment mode" required error={errors.payment_mode}>
          <Select
            className="!h-11 rounded-2xl border-[var(--color-border-strong)]"
            value={form.payment_mode}
            onChange={(e) => onChange('payment_mode', e.target.value)}
            placeholder="Select payment mode"
            options={[{ value: '', label: 'Select payment mode' }, ...paymentOptions]}
          />
        </FormField>
        <FormField label="Expense date" required error={errors.expense_date}>
          <Input
            type="date"
            className="!h-11 rounded-2xl border-[var(--color-border-strong)]"
            value={form.expense_date}
            onChange={(e) => onChange('expense_date', e.target.value)}
          />
        </FormField>
        <FormField label="Vendor / supplier name" error={errors.vendor_name}>
          <Input
            className="!h-11 rounded-2xl border-[var(--color-border-strong)]"
            placeholder="Vendor name"
            value={form.vendor_name}
            onChange={(e) => onChange('vendor_name', e.target.value)}
          />
        </FormField>
      </div>
      <FormField label="Notes / description">
        <textarea
          className="min-h-28 w-full rounded-2xl border border-[var(--color-border-strong)] p-3 text-sm outline-none focus:ring-2 focus:ring-[var(--color-brand-gold)]"
          placeholder="Add vendor, approval, or operational notes"
          value={form.description}
          onChange={(e) => onChange('description', e.target.value)}
        />
      </FormField>
    </div>
    <ReceiptUploadBox
      file={receiptFile}
      previewUrl={receiptPreview}
      existingUrl={existingReceiptUrl}
      onSelect={onReceiptSelect}
    />
  </div>
);

const ViewExpenseModal: React.FC<{
  open: boolean;
  expense: ExpenseItem | null;
  onClose: () => void;
}> = ({ open, expense, onClose }) => (
  <Modal open={open} onClose={onClose} size="md" isShowIcon>
    <ModalHeader>
      <h3 className="text-lg font-bold text-[var(--color-text-primary)]">Expense details</h3>
    </ModalHeader>
    <ModalBody>
      {expense && (
        <dl className="space-y-3 text-sm">
          <div className="flex justify-between gap-4">
            <dt className="text-gray-500">Expense ID</dt>
            <dd className="font-mono font-semibold text-gray-900">{expense.expense_no}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-gray-500">Category</dt>
            <dd className="font-semibold text-gray-900">{expense.category_label}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-gray-500">Amount</dt>
            <dd className="font-semibold text-gray-900">{formatCurrency(expense.amount)}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-gray-500">Payment mode</dt>
            <dd className="font-semibold text-gray-900">{expense.payment_mode_label}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-gray-500">Date</dt>
            <dd className="font-semibold text-gray-900">{formatDateDMY(expense.expense_date)}</dd>
          </div>
          {expense.vendor_name && (
            <div className="flex justify-between gap-4">
              <dt className="text-gray-500">Vendor</dt>
              <dd className="font-semibold text-gray-900">{expense.vendor_name}</dd>
            </div>
          )}
          {expense.description && (
            <div>
              <dt className="text-gray-500">Notes</dt>
              <dd className="mt-1 rounded-xl bg-[var(--color-surface-bg)] p-3 text-gray-800">{expense.description}</dd>
            </div>
          )}
          {expense.created_by_name && (
            <div className="flex justify-between gap-4">
              <dt className="text-gray-500">Created by</dt>
              <dd className="font-semibold text-gray-900">{expense.created_by_name}</dd>
            </div>
          )}
          {expense.receipt_url && (
            <a
              href={expense.receipt_url}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 rounded-xl bg-[var(--color-brand-gold-light)]/20 px-3 py-2 text-sm font-semibold text-[var(--color-brand-gold-dark)]"
            >
              <Download className="h-4 w-4" />
              Download receipt
            </a>
          )}
        </dl>
      )}
    </ModalBody>
    <ModalFooter>
      <Button variant="secondary" onClick={onClose} className="rounded-xl">
        Close
      </Button>
    </ModalFooter>
  </Modal>
);

const ExpensesSection: React.FC<{ activeTab: string; salonId: string }> = ({ activeTab, salonId }) => {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [sortBy, setSortBy] = useState<SortField>('expense_date');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [form, setForm] = useState<ExpenseFormState>(emptyFormState);
  const [formErrors, setFormErrors] = useState<Partial<Record<keyof ExpenseFormState, string>>>({});
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [receiptPreview, setReceiptPreview] = useState<string | null>(null);

  const [viewExpense, setViewExpense] = useState<ExpenseItem | null>(null);
  const [editExpense, setEditExpense] = useState<ExpenseItem | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ExpenseItem | null>(null);

  const { data: categoriesData } = useGetExpenseCategoriesQuery();
  const { data: paymentModesData } = useGetPaymentModesQuery();
  const categoryOptions = categoriesData?.data ?? [];
  const paymentOptions = paymentModesData?.data ?? [];

  const { data, isLoading, isFetching, isError, refetch } = useListExpensesQuery(
    {
      salon_id: salonId,
      page,
      limit: LIMIT,
      search: debouncedSearch || undefined,
      sort_by: sortBy,
      sort_order: sortOrder,
    },
    { skip: !salonId || activeTab !== 'all' }
  );

  const [createExpense, { isLoading: isCreating }] = useCreateExpenseMutation();
  const [updateExpense, { isLoading: isUpdating }] = useUpdateExpenseMutation();
  const [deleteExpense, { isLoading: isDeleting }] = useDeleteExpenseMutation();
  const [uploadReceipt, { isLoading: isUploadingReceipt }] = useUploadExpenseReceiptMutation();
  const [fetchExpense] = useLazyGetExpenseQuery();

  const items = data?.data?.items ?? [];
  const total = data?.data?.total ?? 0;
  const totalPages = data?.data?.pages ?? 1;
  const startItem = total === 0 ? 0 : (page - 1) * LIMIT + 1;
  const endItem = Math.min(page * LIMIT, total);

  useEffect(() => {
    setPage(1);
  }, [salonId]);

  const handleSearchChange = (value: string) => {
    setSearch(value);
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => {
      setDebouncedSearch(value);
      setPage(1);
    }, 350);
  };

  const handleFieldChange = <K extends keyof ExpenseFormState>(field: K, value: ExpenseFormState[K]) => {
    setForm((current) => ({ ...current, [field]: value }));
    setFormErrors((current) => ({ ...current, [field]: undefined }));
  };

  const handleReceiptSelect = (file: File | null) => {
    setReceiptFile(file);
    if (receiptPreview) URL.revokeObjectURL(receiptPreview);
    setReceiptPreview(file && file.type.startsWith('image/') ? URL.createObjectURL(file) : null);
  };

  const validateForm = () => {
    const nextErrors: Partial<Record<keyof ExpenseFormState, string>> = {};
    if (!form.category) nextErrors.category = 'Category is required';
    if (!form.payment_mode) nextErrors.payment_mode = 'Payment mode is required';
    if (!form.expense_date) nextErrors.expense_date = 'Expense date is required';
    const amount = Number(form.amount.replace(/,/g, ''));
    if (!form.amount.trim() || Number.isNaN(amount) || amount <= 0) {
      nextErrors.amount = 'Enter a valid amount greater than 0';
    }
    setFormErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const resetForm = () => {
    setForm(emptyFormState());
    setFormErrors({});
    handleReceiptSelect(null);
  };

  const buildPayload = () => ({
    salon_id: salonId,
    category: form.category,
    amount: Number(form.amount.replace(/,/g, '')),
    payment_mode: form.payment_mode,
    expense_date: new Date(`${form.expense_date}T00:00:00`).toISOString(),
    vendor_name: form.vendor_name.trim() || null,
    description: form.description.trim() || null,
  });

  const handleCreate = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!salonId) {
      showToast('error', 'Select a salon before adding expenses');
      return;
    }
    if (!validateForm()) return;

    try {
      const created = await createExpense(buildPayload()).unwrap();
      if (receiptFile && created.data?.id) {
        await uploadReceipt({ id: created.data.id, file: receiptFile }).unwrap();
      }
      showToast('success', 'Expense created successfully');
      resetForm();
      refetch();
    } catch (error) {
      showToast('error', getApiErrorMessage(error, 'Failed to create expense'));
    }
  };

  const openEdit = async (row: ExpenseItem) => {
    try {
      const res = await fetchExpense(row.id).unwrap();
      const expense = res.data;
      if (!expense) return;
      setEditExpense(expense);
      setForm({
        category: expense.category,
        amount: String(expense.amount),
        payment_mode: expense.payment_mode,
        expense_date: toDateInputValue(expense.expense_date),
        vendor_name: expense.vendor_name ?? '',
        description: expense.description ?? '',
      });
      handleReceiptSelect(null);
    } catch (error) {
      showToast('error', getApiErrorMessage(error, 'Failed to load expense'));
    }
  };

  const handleUpdate = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!editExpense || !validateForm()) return;
    try {
      const updated = await updateExpense({
        id: editExpense.id,
        body: {
          category: form.category,
          amount: Number(form.amount.replace(/,/g, '')),
          payment_mode: form.payment_mode,
          expense_date: new Date(`${form.expense_date}T00:00:00`).toISOString(),
          vendor_name: form.vendor_name.trim() || null,
          description: form.description.trim() || null,
        },
      }).unwrap();
      if (receiptFile && updated.data?.id) {
        await uploadReceipt({ id: updated.data.id, file: receiptFile }).unwrap();
      }
      showToast('success', 'Expense updated successfully');
      setEditExpense(null);
      resetForm();
      refetch();
    } catch (error) {
      showToast('error', getApiErrorMessage(error, 'Failed to update expense'));
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await deleteExpense(deleteTarget.id).unwrap();
      showToast('success', 'Expense deleted successfully');
      setDeleteTarget(null);
      refetch();
    } catch (error) {
      showToast('error', getApiErrorMessage(error, 'Failed to delete expense'));
    }
  };

  const toggleSort = (field: SortField) => {
    if (sortBy === field) {
      setSortOrder((current) => (current === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortBy(field);
      setSortOrder('desc');
    }
    setPage(1);
  };

  const sortIndicator = (field: SortField) => {
    if (sortBy !== field) return '';
    return sortOrder === 'asc' ? ' ↑' : ' ↓';
  };

  if (activeTab === 'add') {
    return (
      <SectionStack>
        <form onSubmit={handleCreate}>
          <ExpenseForm
            form={form}
            errors={formErrors}
            categoryOptions={categoryOptions}
            paymentOptions={paymentOptions}
            receiptFile={receiptFile}
            receiptPreview={receiptPreview}
            onChange={handleFieldChange}
            onReceiptSelect={handleReceiptSelect}
          />
          <div className="mt-5 flex justify-end gap-3">
            <Button type="button" variant="secondary" className="rounded-2xl" onClick={resetForm}>
              Reset
            </Button>
            <Button
              type="submit"
              className="rounded-2xl"
              disabled={isCreating || isUploadingReceipt || !salonId}
            >
              {isCreating || isUploadingReceipt ? 'Saving...' : 'Save expense'}
            </Button>
          </div>
        </form>
      </SectionStack>
    );
  }

  return (
    <SectionStack>
      <div className="rounded-[1.5rem] border border-[var(--color-border-soft)] bg-white p-3 shadow-soft">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <Input
            className="!h-10 rounded-xl border-[var(--color-border-strong)] !pl-10"
            placeholder="Search category, vendor, notes, amount, payment mode..."
            value={search}
            onChange={(e) => handleSearchChange(e.target.value)}
          />
        </div>
      </div>

      <div className="overflow-hidden rounded-[1.5rem] border border-[var(--color-border-soft)] bg-white shadow-soft">
        <div className="custom-scrollbar overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="sticky top-0 z-10 bg-[var(--color-surface-bg)] text-xs uppercase tracking-wide text-gray-500">
              <tr>
                {[
                  { key: 'expense_no' as SortField, label: 'Expense ID' },
                  { key: 'category' as SortField, label: 'Category' },
                  { key: 'payment_mode' as SortField, label: 'Payment Mode' },
                  { key: 'amount' as SortField, label: 'Amount', align: 'right' as const },
                  { key: 'vendor_name' as SortField, label: 'Vendor' },
                  { key: 'expense_date' as SortField, label: 'Date' },
                ].map((column) => (
                  <th
                    key={column.key}
                    className={cn(
                      'whitespace-nowrap px-4 py-3 font-bold',
                      column.align === 'right' ? 'text-right' : 'text-left'
                    )}
                  >
                    <button type="button" className="inline-flex items-center gap-1" onClick={() => toggleSort(column.key)}>
                      {column.label}
                      <span className="text-[var(--color-brand-gold-dark)]">{sortIndicator(column.key)}</span>
                    </button>
                  </th>
                ))}
                <th className="px-4 py-3 text-left font-bold">Attachment</th>
                <th className="sticky right-0 bg-[var(--color-surface-bg)] px-4 py-3 text-right font-bold">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {isLoading || isFetching ? (
                Array.from({ length: 5 }).map((_, index) => (
                  <tr key={index}>
                    {Array.from({ length: 8 }).map((__, cell) => (
                      <td key={cell} className="px-4 py-4">
                        <div className="h-4 animate-pulse rounded bg-gray-200" />
                      </td>
                    ))}
                  </tr>
                ))
              ) : isError ? (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-sm text-red-600">
                    Failed to load expenses. Please try again.
                  </td>
                </tr>
              ) : items.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-sm text-gray-500">
                    No expenses found.
                  </td>
                </tr>
              ) : (
                items.map((row) => (
                  <tr key={row.id} className="border-t border-[var(--color-border-soft)]">
                    <td className="px-4 py-4">
                      <span className="font-mono text-xs font-bold text-gray-900">{row.expense_no}</span>
                    </td>
                    <td className="px-4 py-4 text-gray-800">{row.category_label}</td>
                    <td className="px-4 py-4 text-gray-800">{row.payment_mode_label}</td>
                    <td className="px-4 py-4 text-right font-bold text-gray-900">{formatCurrency(row.amount)}</td>
                    <td className="px-4 py-4 text-gray-700">{row.vendor_name || '—'}</td>
                    <td className="px-4 py-4 text-gray-700">{formatDateDMY(row.expense_date)}</td>
                    <td className="px-4 py-4">
                      {row.receipt_url ? (
                        <a
                          href={row.receipt_url}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 text-xs font-semibold text-[var(--color-brand-gold-dark)]"
                        >
                          <Paperclip className="h-3.5 w-3.5" />
                          Receipt
                        </a>
                      ) : (
                        <span className="text-xs text-gray-400">—</span>
                      )}
                    </td>
                    <td className="sticky right-0 bg-white px-4 py-4">
                      <div className="flex justify-end gap-1">
                        <button
                          type="button"
                          title="View"
                          onClick={() => setViewExpense(row)}
                          className="rounded-lg p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-700"
                        >
                          <Eye className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          title="Edit"
                          onClick={() => openEdit(row)}
                          className="rounded-lg p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-700"
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          title="Delete"
                          onClick={() => setDeleteTarget(row)}
                          className="rounded-lg p-2 text-gray-400 hover:bg-red-50 hover:text-red-600"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="flex flex-col gap-3 border-t border-[var(--color-border-soft)] px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-gray-500">
            Showing {startItem}–{endItem} of {total} records
          </p>
          <div className="flex items-center gap-1">
            <button
              type="button"
              disabled={page <= 1}
              onClick={() => setPage((current) => Math.max(1, current - 1))}
              className="rounded-lg p-2 text-gray-400 hover:bg-gray-100 disabled:opacity-40"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            {Array.from({ length: Math.min(totalPages, 5) }, (_, index) => {
              const start = Math.max(1, Math.min(page - 2, totalPages - 4));
              const pageNumber = start + index;
              if (pageNumber > totalPages) return null;
              return (
                <button
                  key={pageNumber}
                  type="button"
                  onClick={() => setPage(pageNumber)}
                  className={cn(
                    'flex h-8 w-8 items-center justify-center rounded-lg text-xs font-bold transition',
                    pageNumber === page
                      ? 'bg-[var(--color-brand-gold)] text-white'
                      : 'text-gray-500 hover:bg-gray-100'
                  )}
                >
                  {pageNumber}
                </button>
              );
            })}
            <button
              type="button"
              disabled={page >= totalPages}
              onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
              className="rounded-lg p-2 text-gray-400 hover:bg-gray-100 disabled:opacity-40"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      <ViewExpenseModal
        open={!!viewExpense}
        expense={viewExpense}
        onClose={() => setViewExpense(null)}
      />

      <Modal open={!!editExpense} onClose={() => setEditExpense(null)} size="xl" isShowIcon>
        <ModalHeader>
          <h3 className="text-lg font-bold text-[var(--color-text-primary)]">Edit expense</h3>
        </ModalHeader>
        <ModalBody>
          <form id="edit-expense-form" onSubmit={handleUpdate}>
            <ExpenseForm
              form={form}
              errors={formErrors}
              categoryOptions={categoryOptions}
              paymentOptions={paymentOptions}
              receiptFile={receiptFile}
              receiptPreview={receiptPreview}
              existingReceiptUrl={editExpense?.receipt_url}
              onChange={handleFieldChange}
              onReceiptSelect={handleReceiptSelect}
            />
          </form>
        </ModalBody>
        <ModalFooter>
          <Button variant="secondary" className="rounded-xl" onClick={() => setEditExpense(null)}>
            Cancel
          </Button>
          <Button
            type="submit"
            form="edit-expense-form"
            className="rounded-xl"
            disabled={isUpdating || isUploadingReceipt}
          >
            {isUpdating || isUploadingReceipt ? 'Saving...' : 'Save changes'}
          </Button>
        </ModalFooter>
      </Modal>

      <Modal open={!!deleteTarget} onClose={() => setDeleteTarget(null)} size="sm" isShowIcon>
        <ModalHeader>
          <h3 className="text-lg font-bold text-[var(--color-text-primary)]">Delete expense</h3>
        </ModalHeader>
        <ModalBody>
          <p className="text-sm text-gray-600">
            Delete expense <strong>{deleteTarget?.expense_no}</strong>? This action cannot be undone.
          </p>
        </ModalBody>
        <ModalFooter>
          <Button variant="secondary" className="rounded-xl" onClick={() => setDeleteTarget(null)}>
            Cancel
          </Button>
          <Button
            className="rounded-xl bg-red-600 hover:bg-red-700"
            onClick={handleDelete}
            disabled={isDeleting}
          >
            {isDeleting ? 'Deleting...' : 'Delete'}
          </Button>
        </ModalFooter>
      </Modal>
    </SectionStack>
  );
};

export default ExpensesSection;
