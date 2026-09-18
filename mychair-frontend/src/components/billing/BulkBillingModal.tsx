import React, { useCallback, useMemo, useRef, useState } from 'react';
import {
  AlertCircle,
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  Download,
  Edit2,
  FileSpreadsheet,
  History,
  Info,
  Loader2,
  Package,
  RefreshCw,
  Scissors,
  Search,
  Sparkles,
  Trash2,
  UploadCloud,
  UserCheck,
  UserPlus,
  X,
  XCircle,
} from 'lucide-react';

import { Button } from '../common';
import { showToast } from '../common/Toast/toastService';
import {
  useConfirmBulkUploadMutation,
  useEditBulkRowMutation,
  useLazyDownloadBatchSummaryQuery,
  useLazyDownloadFailedRecordsQuery,
  useLazyDownloadGeneratedClientIdsQuery,
  useLazyDownloadProductTemplateQuery,
  useLazyDownloadServiceTemplateQuery,
  useListBulkBatchesQuery,
  useValidateBulkUploadMutation,
} from '../../redux/slices/billing/billingApi';
import {
  BulkBillingBatchSummary,
  BulkBillingRowRecord,
  EditBulkRowPayload,
} from '../../redux/slices/billing/Types';
import { cn } from '../../utils/cn';
import { formatCurrency } from '../../utils/currency';
import { formatDateDMY } from '../../utils/utilities';

const MAX_FILE_BYTES = 25 * 1024 * 1024;
const ACCEPT = '.xlsx';

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

function triggerBlobDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

interface BulkBillingModalProps {
  open: boolean;
  salonId: string;
  onClose: () => void;
  onSuccess?: () => void;
}

type ModalTab = 'import' | 'history';
type ImportStage = 'select' | 'preview' | 'confirm' | 'results';
type RowStatusFilter = 'ALL' | 'VALID' | 'FAILED' | 'DUPLICATE';

export const BulkBillingModal: React.FC<BulkBillingModalProps> = ({
  open,
  salonId,
  onClose,
  onSuccess,
}) => {
  const [activeTab, setActiveTab] = useState<ModalTab>('import');
  const [stage, setStage] = useState<ImportStage>('select');

  // File states
  const [serviceFile, setServiceFile] = useState<File | null>(null);
  const [productFile, setProductFile] = useState<File | null>(null);
  const [deductInventory, setDeductInventory] = useState(false);

  // Drag states
  const [serviceDragging, setServiceDragging] = useState(false);
  const [productDragging, setProductDragging] = useState(false);

  // File input refs
  const serviceInputRef = useRef<HTMLInputElement>(null);
  const productInputRef = useRef<HTMLInputElement>(null);

  // Staff ambiguity resolution map: excel_name -> user_id
  const [staffMappings, setStaffMappings] = useState<Record<string, string>>({});

  // Validation results
  const [batchData, setBatchData] = useState<BulkBillingBatchSummary | null>(null);

  // Table filter states in preview
  const [tableFilter, setTableFilter] = useState<RowStatusFilter>('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  // API mutations & queries
  const [validateUpload, { isLoading: isValidating }] = useValidateBulkUploadMutation();
  const [confirmUpload, { isLoading: isConfirming }] = useConfirmBulkUploadMutation();
  const [downloadServiceTemplate, { isFetching: isDownloadingSvcTemplate }] =
    useLazyDownloadServiceTemplateQuery();
  const [downloadProductTemplate, { isFetching: isDownloadingProdTemplate }] =
    useLazyDownloadProductTemplateQuery();
  const [downloadFailedRecords, { isFetching: isDownloadingFailed }] =
    useLazyDownloadFailedRecordsQuery();
  const [downloadBatchSummary, { isFetching: isDownloadingSummary }] =
    useLazyDownloadBatchSummaryQuery();
  const [downloadGeneratedClientIds, { isFetching: isDownloadingClientIds }] =
    useLazyDownloadGeneratedClientIdsQuery();
  const [editBulkRow, { isLoading: isEditingRow }] = useEditBulkRowMutation();

  // In-place row editing state in preview
  const [editingRow, setEditingRow] = useState<BulkBillingRowRecord | null>(null);
  const [editFormData, setEditFormData] = useState<EditBulkRowPayload>({});

  const {
    data: batchesData,
    isLoading: isLoadingBatches,
    refetch: refetchBatches,
  } = useListBulkBatchesQuery({ salon_id: salonId, page: 1, limit: 20 }, { skip: !salonId || !open });

  const resetImportFlow = useCallback(() => {
    setServiceFile(null);
    setProductFile(null);
    setDeductInventory(false);
    setStaffMappings({});
    setBatchData(null);
    setEditingRow(null);
    setEditFormData({});
    setStage('select');
    setTableFilter('ALL');
    setSearchQuery('');
    if (serviceInputRef.current) serviceInputRef.current.value = '';
    if (productInputRef.current) productInputRef.current.value = '';
  }, []);

  const handleClose = () => {
    resetImportFlow();
    onClose();
  };

  const handleFileDrop = (e: React.DragEvent<HTMLDivElement>, type: 'SERVICE' | 'PRODUCT') => {
    e.preventDefault();
    if (type === 'SERVICE') setServiceDragging(false);
    else setProductDragging(false);

    const droppedFile = e.dataTransfer.files[0];
    if (!droppedFile) return;

    if (!droppedFile.name.toLowerCase().endsWith('.xlsx')) {
      showToast('error', 'Only Excel (.xlsx) files are supported.');
      return;
    }
    if (droppedFile.size > MAX_FILE_BYTES) {
      showToast('error', `File exceeds maximum limit of ${formatBytes(MAX_FILE_BYTES)}.`);
      return;
    }

    if (type === 'SERVICE') setServiceFile(droppedFile);
    else setProductFile(droppedFile);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>, type: 'SERVICE' | 'PRODUCT') => {
    const selected = e.target.files?.[0];
    if (!selected) return;

    if (!selected.name.toLowerCase().endsWith('.xlsx')) {
      showToast('error', 'Only Excel (.xlsx) files are supported.');
      return;
    }
    if (selected.size > MAX_FILE_BYTES) {
      showToast('error', `File exceeds maximum limit of ${formatBytes(MAX_FILE_BYTES)}.`);
      return;
    }

    if (type === 'SERVICE') setServiceFile(selected);
    else setProductFile(selected);
  };

  const handleDownloadTemplate = async (type: 'SERVICE' | 'PRODUCT') => {
    try {
      if (type === 'SERVICE') {
        const blob = await downloadServiceTemplate({ salon_id: salonId }).unwrap();
        triggerBlobDownload(blob, 'MyChair_Service_Billing_Template.xlsx');
      } else {
        const blob = await downloadProductTemplate({ salon_id: salonId }).unwrap();
        triggerBlobDownload(blob, 'MyChair_Product_Billing_Template.xlsx');
      }
      showToast('success', `${type === 'SERVICE' ? 'Service' : 'Product'} billing template downloaded.`);
    } catch {
      showToast('error', 'Failed to download template. Please try again.');
    }
  };

  const handleValidate = async () => {
    if (!serviceFile && !productFile) {
      showToast('error', 'Please select at least one Excel file to upload.');
      return;
    }

    const formData = new FormData();
    formData.append('salon_id', salonId);
    if (serviceFile) formData.append('service_file', serviceFile);
    if (productFile) formData.append('product_file', productFile);
    formData.append('deduct_inventory', String(deductInventory));
    if (Object.keys(staffMappings).length > 0) {
      formData.append('staff_mappings', JSON.stringify(staffMappings));
    }

    try {
      const res = await validateUpload(formData).unwrap();
      if (res.data) {
        setBatchData(res.data);
        setStage('preview');
        showToast('success', 'Excel file validated successfully. Review results before import.');
      }
    } catch (err: any) {
      const msg = err?.data?.detail || err?.message || 'File validation failed. Please check Excel format.';
      showToast('error', msg);
    }
  };

  const handleConfirmImport = async () => {
    if (!batchData) return;

    try {
      const res = await confirmUpload({
        batch_id: batchData.batch_id,
        salon_id: salonId,
        staff_mappings: staffMappings,
        deduct_inventory: deductInventory,
      }).unwrap();

      if (res.data) {
        setBatchData(res.data);
        setStage('results');
        refetchBatches();
        if (onSuccess) onSuccess();
        showToast('success', `Import complete: ${res.data.successful_bills} bills imported successfully!`);
      }
    } catch (err: any) {
      const msg = err?.data?.detail || err?.message || 'Failed to complete import.';
      showToast('error', msg);
    }
  };

  const handleDownloadFailed = async (batchId: string) => {
    try {
      const blob = await downloadFailedRecords({ batch_id: batchId, salon_id: salonId }).unwrap();
      triggerBlobDownload(blob, `MyChair_Failed_Billing_Records_${batchId}.xlsx`);
    } catch {
      showToast('error', 'Failed to download error report.');
    }
  };

  const handleDownloadSummary = async (batchId: string) => {
    try {
      const blob = await downloadBatchSummary({ batch_id: batchId, salon_id: salonId }).unwrap();
      triggerBlobDownload(blob, `MyChair_Import_Summary_${batchId}.xlsx`);
    } catch {
      showToast('error', 'Failed to download import summary.');
    }
  };

  const handleDownloadGeneratedClientIds = async (batchId: string) => {
    try {
      const blob = await downloadGeneratedClientIds({ batch_id: batchId, salon_id: salonId }).unwrap();
      triggerBlobDownload(blob, `MyChair_Generated_Client_IDs_${batchId}.xlsx`);
    } catch {
      showToast('error', 'Failed to download generated client IDs report.');
    }
  };

  const handleStartEditRow = (row: BulkBillingRowRecord) => {
    setEditingRow(row);
    setEditFormData({
      client_name: row.client_name || '',
      mobile_number: row.client_phone || '',
      item_name: row.item_name || '',
      staff_identifier: row.staff_identifier || '',
      quantity: row.quantity || 1,
      unit_price: row.unit_price || 0,
      discount: row.discount || 0,
      payment_method: row.payment_method || 'CASH',
      payment_status: row.payment_status || 'PAID',
      paid_amount: row.paid_amount ?? undefined,
      bill_date: row.bill_date ? row.bill_date.split('T')[0] : '',
      bill_group: row.bill_group || '',
      notes: row.notes || '',
    });
  };

  const handleSaveRowEdit = async () => {
    if (!batchData || !editingRow) return;
    try {
      const res = await editBulkRow({
        batch_id: batchData.batch_id,
        excel_row: editingRow.excel_row,
        salon_id: salonId,
        data: editFormData,
      }).unwrap();
      if (res.data) {
        setBatchData(res.data);
        showToast('success', `Row ${editingRow.excel_row} updated and revalidated.`);
      }
      setEditingRow(null);
    } catch (err: any) {
      const msg = err?.data?.detail || err?.message || 'Failed to update and revalidate row.';
      showToast('error', msg);
    }
  };

  // Filtered rows in preview table
  const filteredRows = useMemo(() => {
    if (!batchData?.row_records) return [];
    return batchData.row_records.filter((r) => {
      // Status filter
      if (tableFilter === 'VALID' && r.status !== 'VALID' && r.status !== 'COMMITTED') return false;
      if (tableFilter === 'FAILED' && r.status !== 'FAILED') return false;
      if (tableFilter === 'DUPLICATE' && r.status !== 'DUPLICATE') return false;

      // Text search
      if (!searchQuery.trim()) return true;
      const query = searchQuery.toLowerCase();
      return (
        r.original_bill_reference.toLowerCase().includes(query) ||
        (r.client_name && r.client_name.toLowerCase().includes(query)) ||
        (r.item_name && r.item_name.toLowerCase().includes(query)) ||
        (r.staff_identifier && r.staff_identifier.toLowerCase().includes(query)) ||
        (r.resolved_staff_name && r.resolved_staff_name.toLowerCase().includes(query))
      );
    });
  }, [batchData?.row_records, tableFilter, searchQuery]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/60 p-3 backdrop-blur-sm sm:p-4 md:p-6 animate-in fade-in duration-200">
      <div className="flex max-h-[92vh] w-full max-w-6xl flex-col overflow-hidden rounded-[2rem] border border-[var(--color-border-soft)] bg-white shadow-2xl">
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-[var(--color-border-soft)] bg-white px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[var(--color-brand-gold-light)]/20 text-[var(--color-brand-gold-dark)]">
              <FileSpreadsheet className="h-6 w-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-bold text-[var(--color-text-primary)]">
                  Bulk Billing Upload
                </h2>
                <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-[10px] font-bold tracking-wide uppercase text-amber-800">
                  Historical Importer
                </span>
              </div>
              <p className="text-xs text-[var(--color-text-secondary)]">
                Import past service and product billing records with automatic reconciliation and failure tracking.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleClose}
            className="rounded-xl p-2 text-gray-400 transition hover:bg-gray-100 hover:text-gray-600"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Navigation Tabs */}
        <div className="flex border-b border-[var(--color-border-soft)] bg-[var(--color-surface-bg)]/60 px-6">
          <button
            type="button"
            onClick={() => setActiveTab('import')}
            className={cn(
              'flex items-center gap-2 border-b-2 py-3 px-4 text-sm font-semibold transition',
              activeTab === 'import'
                ? 'border-[var(--color-brand-gold)] text-[var(--color-brand-gold-dark)]'
                : 'border-transparent text-gray-500 hover:text-gray-800'
            )}
          >
            <UploadCloud className="h-4 w-4" />
            Import Bills
          </button>
          <button
            type="button"
            onClick={() => {
              setActiveTab('history');
              refetchBatches();
            }}
            className={cn(
              'flex items-center gap-2 border-b-2 py-3 px-4 text-sm font-semibold transition',
              activeTab === 'history'
                ? 'border-[var(--color-brand-gold)] text-[var(--color-brand-gold-dark)]'
                : 'border-transparent text-gray-500 hover:text-gray-800'
            )}
          >
            <History className="h-4 w-4" />
            Import History
          </button>
        </div>

        {/* Modal Body */}
        <div className="custom-scrollbar flex-1 overflow-y-auto p-6">
          {activeTab === 'import' ? (
            <div>
              {/* STAGE 1: FILE SELECTION */}
              {stage === 'select' && (
                <div className="space-y-6">
                  {/* Option A & Option B Cards */}
                  <div className="grid gap-6 md:grid-cols-2">
                    {/* Option A: Service Billing */}
                    <div className="flex flex-col justify-between rounded-2xl border border-amber-200/80 bg-gradient-to-br from-amber-50/40 via-white to-amber-50/20 p-5 shadow-soft">
                      <div>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2.5">
                            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-500/10 text-amber-700">
                              <Scissors className="h-5 w-5" />
                            </div>
                            <h3 className="font-bold text-gray-900">Option A: Service Billing</h3>
                          </div>
                          <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-800">
                            Services
                          </span>
                        </div>
                        <p className="mt-2 text-xs text-gray-600">
                          Upload service bills with client details, service amounts and staff assignments.
                        </p>

                        <div className="mt-4 flex flex-wrap items-center gap-2">
                          <Button
                            id="btn-download-service-template"
                            variant="secondary"
                            className="!h-9 rounded-xl text-xs font-semibold"
                            onClick={() => handleDownloadTemplate('SERVICE')}
                            disabled={isDownloadingSvcTemplate}
                            icon={isDownloadingSvcTemplate ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
                          >
                            Download Service Template
                          </Button>
                          <Button
                            id="btn-upload-service-excel"
                            variant="outline"
                            className="!h-9 rounded-xl border-amber-300 text-amber-800 hover:bg-amber-100/50 text-xs font-semibold gap-1.5"
                            onClick={() => serviceInputRef.current?.click()}
                            icon={<UploadCloud className="h-3.5 w-3.5" />}
                          >
                            Upload Service Excel
                          </Button>
                        </div>

                        {/* File Dropzone */}
                        <div
                          onDragOver={(e) => {
                            e.preventDefault();
                            setServiceDragging(true);
                          }}
                          onDragLeave={() => setServiceDragging(false)}
                          onDrop={(e) => handleFileDrop(e, 'SERVICE')}
                          onClick={() => serviceInputRef.current?.click()}
                          className={cn(
                            'mt-4 flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed p-4 text-center transition',
                            serviceDragging
                              ? 'border-amber-500 bg-amber-50'
                              : serviceFile
                              ? 'border-emerald-400 bg-emerald-50/30'
                              : 'border-gray-200 bg-white hover:border-amber-400 hover:bg-amber-50/20'
                          )}
                        >
                          <input
                            ref={serviceInputRef}
                            type="file"
                            accept={ACCEPT}
                            className="hidden"
                            onChange={(e) => handleFileSelect(e, 'SERVICE')}
                          />
                          {serviceFile ? (
                            <div className="flex items-center gap-2 text-emerald-800">
                              <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                              <div className="text-left">
                                <p className="text-xs font-bold truncate max-w-[200px]">{serviceFile.name}</p>
                                <p className="text-[10px] text-gray-500">{formatBytes(serviceFile.size)}</p>
                              </div>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setServiceFile(null);
                                  if (serviceInputRef.current) serviceInputRef.current.value = '';
                                }}
                                className="ml-2 rounded-lg p-1 text-gray-400 hover:bg-red-50 hover:text-red-500"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </div>
                          ) : (
                            <>
                              <UploadCloud className="h-7 w-7 text-amber-500" />
                              <p className="mt-1 text-xs font-semibold text-gray-700">Upload Service Excel</p>
                              <p className="text-[10px] text-gray-400">Click or drag & drop (.xlsx)</p>
                            </>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Option B: Product Billing */}
                    <div className="flex flex-col justify-between rounded-2xl border border-sky-200/80 bg-gradient-to-br from-sky-50/40 via-white to-sky-50/20 p-5 shadow-soft">
                      <div>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2.5">
                            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-sky-500/10 text-sky-700">
                              <Package className="h-5 w-5" />
                            </div>
                            <h3 className="font-bold text-gray-900">Option B: Product Billing</h3>
                          </div>
                          <span className="rounded-full bg-sky-100 px-2 py-0.5 text-[10px] font-semibold text-sky-800">
                            Retail Sales
                          </span>
                        </div>
                        <p className="mt-2 text-xs text-gray-600">
                          Upload product sales with quantities, selling prices and selling staff.
                        </p>

                        <div className="mt-4 flex flex-wrap items-center gap-2">
                          <Button
                            id="btn-download-product-template"
                            variant="secondary"
                            className="!h-9 rounded-xl text-xs font-semibold"
                            onClick={() => handleDownloadTemplate('PRODUCT')}
                            disabled={isDownloadingProdTemplate}
                            icon={isDownloadingProdTemplate ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
                          >
                            Download Product Template
                          </Button>
                          <Button
                            id="btn-upload-product-excel"
                            variant="outline"
                            className="!h-9 rounded-xl border-sky-300 text-sky-800 hover:bg-sky-100/50 text-xs font-semibold gap-1.5"
                            onClick={() => productInputRef.current?.click()}
                            icon={<UploadCloud className="h-3.5 w-3.5" />}
                          >
                            Upload Product Excel
                          </Button>
                        </div>

                        {/* File Dropzone */}
                        <div
                          onDragOver={(e) => {
                            e.preventDefault();
                            setProductDragging(true);
                          }}
                          onDragLeave={() => setProductDragging(false)}
                          onDrop={(e) => handleFileDrop(e, 'PRODUCT')}
                          onClick={() => productInputRef.current?.click()}
                          className={cn(
                            'mt-4 flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed p-4 text-center transition',
                            productDragging
                              ? 'border-sky-500 bg-sky-50'
                              : productFile
                              ? 'border-emerald-400 bg-emerald-50/30'
                              : 'border-gray-200 bg-white hover:border-sky-400 hover:bg-sky-50/20'
                          )}
                        >
                          <input
                            ref={productInputRef}
                            type="file"
                            accept={ACCEPT}
                            className="hidden"
                            onChange={(e) => handleFileSelect(e, 'PRODUCT')}
                          />
                          {productFile ? (
                            <div className="flex items-center gap-2 text-emerald-800">
                              <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                              <div className="text-left">
                                <p className="text-xs font-bold truncate max-w-[200px]">{productFile.name}</p>
                                <p className="text-[10px] text-gray-500">{formatBytes(productFile.size)}</p>
                              </div>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setProductFile(null);
                                  if (productInputRef.current) productInputRef.current.value = '';
                                }}
                                className="ml-2 rounded-lg p-1 text-gray-400 hover:bg-red-50 hover:text-red-500"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </div>
                          ) : (
                            <>
                              <UploadCloud className="h-7 w-7 text-sky-500" />
                              <p className="mt-1 text-xs font-semibold text-gray-700">Upload Product Excel</p>
                              <p className="text-[10px] text-gray-400">Click or drag & drop (.xlsx)</p>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Combined Bill Pro Tip */}
                  <div className="flex items-start gap-3 rounded-2xl border border-amber-100 bg-amber-50/60 p-4 text-xs text-amber-900">
                    <Info className="h-5 w-5 shrink-0 text-amber-600" />
                    <div>
                      <p className="font-bold">Combined Invoices (Services + Products):</p>
                      <p className="mt-0.5 text-amber-800">
                        If a single bill contains both services and retail products, upload both files together with the
                        <span className="font-semibold"> same Original Bill Reference</span>. The system will automatically reconcile them into unified invoices.
                      </p>
                    </div>
                  </div>

                  {/* Inventory Policy Option */}
                  <div className="rounded-2xl border border-[var(--color-border-soft)] bg-white p-4">
                    <label className="flex items-start gap-3 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={deductInventory}
                        onChange={(e) => setDeductInventory(e.target.checked)}
                        className="mt-0.5 h-4 w-4 rounded border-gray-300 text-amber-600 focus:ring-amber-500"
                      />
                      <div>
                        <p className="text-sm font-semibold text-gray-900">
                          Deduct live inventory stock for imported product sales
                        </p>
                        <p className="text-xs text-gray-500">
                          Default is <span className="font-medium text-emerald-700">UNCHECKED</span> (Recommended for historical backlogs). Only check this if past product sales were never accounted for in opening inventory counts.
                        </p>
                      </div>
                    </label>
                  </div>

                  {/* Validate Button */}
                  <div className="flex justify-end gap-3 pt-2">
                    <Button variant="secondary" onClick={handleClose}>
                      Cancel
                    </Button>
                    <Button
                      id="btn-validate-files"
                      onClick={handleValidate}
                      disabled={(!serviceFile && !productFile) || isValidating}
                      className="min-w-[140px] font-semibold"
                      icon={isValidating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                    >
                      {isValidating ? 'Validating...' : 'Validate Files'}
                    </Button>
                  </div>
                </div>
              )}

              {/* STAGE 2: PREVIEW & AMBIGUITY RESOLUTION */}
              {stage === 'preview' && batchData && (
                <div className="space-y-5">
                  {/* Summary Metric Cards */}
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 xl:grid-cols-7">
                    <div className="rounded-2xl border border-gray-200 bg-gray-50/60 p-3 text-center">
                      <p className="text-[11px] font-medium text-gray-500">Total Rows</p>
                      <p className="mt-1 text-xl font-bold text-gray-900">{batchData.total_rows}</p>
                    </div>
                    <div className="rounded-2xl border border-blue-200 bg-blue-50/50 p-3 text-center">
                      <p className="text-[11px] font-medium text-blue-700">Unique Bills</p>
                      <p className="mt-1 text-xl font-bold text-blue-900">{batchData.total_bills}</p>
                    </div>
                    <div className="rounded-2xl border border-emerald-200 bg-emerald-50/50 p-3 text-center">
                      <p className="text-[11px] font-medium text-emerald-700">Valid Bills</p>
                      <p className="mt-1 text-xl font-bold text-emerald-800">{batchData.valid_bills}</p>
                    </div>
                    <div className="rounded-2xl border border-red-200 bg-red-50/50 p-3 text-center">
                      <p className="text-[11px] font-medium text-red-700">Invalid Bills</p>
                      <p className="mt-1 text-xl font-bold text-red-800">{batchData.invalid_bills}</p>
                    </div>
                    <div className="rounded-2xl border border-amber-200 bg-amber-50/50 p-3 text-center">
                      <p className="text-[11px] font-medium text-amber-700">Duplicate Bills</p>
                      <p className="mt-1 text-xl font-bold text-amber-800">{batchData.duplicate_bills}</p>
                    </div>
                    <div className="rounded-2xl border border-sky-200 bg-sky-50/50 p-3 text-center">
                      <p className="text-[11px] font-medium text-sky-700">New Client IDs</p>
                      <p className="mt-1 text-xl font-bold text-sky-800">{batchData.client_ids_generated_count ?? 0}</p>
                    </div>
                    <div className="rounded-2xl border border-teal-200 bg-teal-50/50 p-3 text-center col-span-2 sm:col-span-1">
                      <p className="text-[11px] font-medium text-teal-700">Valid Total</p>
                      <p className="mt-1 text-base font-bold text-teal-800 truncate">
                        {formatCurrency(batchData.total_valid_amount)}
                      </p>
                    </div>
                  </div>

                  {/* Customer Mapping Notice */}
                  {(batchData.client_ids_generated_count ?? 0) > 0 && (
                    <div className="flex items-center justify-between rounded-2xl border border-sky-200 bg-sky-50/80 p-3.5 shadow-xs">
                      <div className="flex items-center gap-2.5 text-sky-900">
                        <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-sky-100 text-sky-700 shrink-0">
                          <UserPlus className="h-4 w-4" />
                        </div>
                        <div>
                          <p className="text-xs font-bold text-sky-950">
                            {batchData.client_ids_generated_count ?? 0} Customer{(batchData.client_ids_generated_count ?? 0) > 1 ? 's' : ''} Require Auto-Generated Client IDs
                          </p>
                          <p className="text-[11px] text-sky-800">
                            Phone numbers are omitted for these records. Unique client reference IDs (CL-XXXXXX) will be generated automatically upon confirmed import.
                          </p>
                        </div>
                      </div>
                      <span className="hidden sm:inline-block rounded-full bg-sky-200/80 px-2.5 py-1 text-[10px] font-bold text-sky-900 uppercase">
                        Auto-assigned on confirm
                      </span>
                    </div>
                  )}

                  {/* Ambiguous Staff Mapping Section */}
                  {batchData.ambiguous_staff && batchData.ambiguous_staff.length > 0 && (
                    <div className="rounded-2xl border border-amber-300 bg-amber-50/90 p-4 shadow-sm">
                      <div className="flex items-center gap-2 text-amber-900">
                        <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0" />
                        <h4 className="font-bold text-sm">Action Required: Ambiguous Staff Assignments</h4>
                      </div>
                      <p className="mt-1 text-xs text-amber-800">
                        Multiple employees match the staff names below. Please map each Excel name to the exact employee before confirming import.
                      </p>

                      <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                        {batchData.ambiguous_staff.map((amb) => (
                          <div key={amb.excel_name} className="rounded-xl border border-amber-200 bg-white p-3">
                            <p className="text-xs font-bold text-gray-800">Excel Staff: <span className="text-amber-700 font-mono">{amb.excel_name}</span></p>
                            <select
                              className="mt-2 w-full rounded-lg border border-gray-300 bg-white px-2.5 py-1.5 text-xs text-gray-800 focus:border-amber-500 focus:ring-amber-500"
                              value={staffMappings[amb.excel_name] || ''}
                              onChange={(e) => setStaffMappings({ ...staffMappings, [amb.excel_name]: e.target.value })}
                            >
                              <option value="">-- Choose Employee --</option>
                              {amb.options.map((opt) => (
                                <option key={opt.id} value={opt.id}>{opt.name}</option>
                              ))}
                            </select>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Table Search & Status Filters */}
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex flex-wrap gap-1 rounded-xl bg-gray-100 p-1">
                      {(['ALL', 'VALID', 'FAILED', 'DUPLICATE'] as RowStatusFilter[]).map((f) => (
                        <button
                          key={f}
                          type="button"
                          onClick={() => setTableFilter(f)}
                          className={cn(
                            'rounded-lg px-3 py-1.5 text-xs font-semibold transition',
                            tableFilter === f ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-900'
                          )}
                        >
                          {f === 'ALL'
                            ? `All (${batchData.total_rows})`
                            : f === 'VALID'
                            ? `Valid (${batchData.valid_bills})`
                            : f === 'FAILED'
                            ? `Failed (${batchData.invalid_bills})`
                            : `Duplicates (${batchData.duplicate_bills})`}
                        </button>
                      ))}
                    </div>

                    <div className="relative min-w-[240px]">
                      <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-400" />
                      <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Search ref, client, item, staff..."
                        className="w-full rounded-xl border border-gray-300 py-1.5 pl-9 pr-3 text-xs focus:border-amber-500 focus:ring-amber-500"
                      />
                    </div>
                  </div>

                  {/* Preview Rows Table */}
                  <div className="max-h-[380px] overflow-auto rounded-2xl border border-[var(--color-border-soft)] bg-white shadow-soft">
                    <table className="min-w-full text-xs">
                      <thead className="sticky top-0 z-10 bg-gray-50 text-[11px] font-bold uppercase tracking-wider text-gray-500">
                        <tr>
                          <th className="px-3 py-2.5 text-center">Row</th>
                          <th className="px-3 py-2.5 text-left">Bill Group / Ref</th>
                          <th className="px-3 py-2.5 text-left">Client Name</th>
                          <th className="px-3 py-2.5 text-left">Mobile</th>
                          <th className="px-3 py-2.5 text-center">Client ID Status</th>
                          <th className="px-3 py-2.5 text-center">Type</th>
                          <th className="px-3 py-2.5 text-left">Item</th>
                          <th className="px-3 py-2.5 text-left">Staff</th>
                          <th className="px-3 py-2.5 text-right">Amount</th>
                          <th className="px-3 py-2.5 text-center">Status</th>
                          <th className="px-3 py-2.5 text-left">Reason / Action</th>
                          <th className="px-3 py-2.5 text-center">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {filteredRows.length === 0 ? (
                          <tr>
                            <td colSpan={12} className="py-8 text-center text-gray-400">
                              No rows match the selected filter.
                            </td>
                          </tr>
                        ) : (
                          filteredRows.map((r, idx) => {
                            const isRowDuplicate = r.status === 'DUPLICATE';
                            const isRowFailed = r.status === 'FAILED';
                            const isRowValid = r.status === 'VALID' || r.status === 'COMMITTED';
                            const isWillGenerate = r.client_id_status === 'WILL_GENERATE' || (!r.client_phone);

                            return (
                              <tr key={idx} className="hover:bg-gray-50/70 transition">
                                <td className="px-3 py-2 text-center font-mono text-gray-400">{r.excel_row}</td>
                                <td className="px-3 py-2 font-mono font-bold text-gray-800">
                                  {r.bill_group ? (
                                    <span className="rounded bg-gray-100 px-1.5 py-0.5 text-gray-700">Grp: {r.bill_group}</span>
                                  ) : (
                                    r.original_bill_reference
                                  )}
                                </td>
                                <td className="px-3 py-2 text-gray-900 font-medium truncate max-w-[130px]">{r.client_name || '-'}</td>
                                <td className="px-3 py-2 font-mono text-gray-600">
                                  {r.client_phone || <span className="italic text-gray-400 font-sans">Blank</span>}
                                </td>
                                <td className="px-3 py-2 text-center">
                                  {isWillGenerate ? (
                                    <span className="inline-flex items-center gap-1 rounded-full bg-sky-100 px-2 py-0.5 text-[10px] font-bold text-sky-800">
                                      <UserPlus className="h-3 w-3" /> Will Generate
                                    </span>
                                  ) : (
                                    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-800">
                                      <UserCheck className="h-3 w-3" /> Existing Client
                                    </span>
                                  )}
                                </td>
                                <td className="px-3 py-2 text-center">
                                  <span
                                    className={cn(
                                      'rounded-full px-2 py-0.5 text-[9px] font-bold uppercase',
                                      r.file_type === 'SERVICE' ? 'bg-amber-100 text-amber-800' : 'bg-sky-100 text-sky-800'
                                    )}
                                  >
                                    {r.file_type}
                                  </span>
                                </td>
                                <td className="px-3 py-2 text-gray-800 truncate max-w-[140px]">{r.item_name || '-'}</td>
                                <td className="px-3 py-2 text-gray-700 truncate max-w-[120px]">
                                  {r.resolved_staff_name || r.staff_identifier || '-'}
                                </td>
                                <td className="px-3 py-2 text-right font-semibold text-gray-900">
                                  {formatCurrency(r.line_total)}
                                </td>
                                <td className="px-3 py-2 text-center">
                                  <span
                                    className={cn(
                                      'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold',
                                      isRowValid && 'bg-emerald-100 text-emerald-800',
                                      isRowFailed && 'bg-red-100 text-red-800',
                                      isRowDuplicate && 'bg-amber-100 text-amber-800'
                                    )}
                                  >
                                    {isRowValid && <CheckCircle2 className="h-3 w-3" />}
                                    {isRowFailed && <XCircle className="h-3 w-3" />}
                                    {isRowDuplicate && <AlertTriangle className="h-3 w-3" />}
                                    {r.status}
                                  </span>
                                </td>
                                <td className="px-3 py-2 text-xs">
                                  {isRowValid ? (
                                    <span className="text-emerald-700 font-medium">Ready to import</span>
                                  ) : (
                                    <div>
                                      <p className="font-semibold text-red-700">{r.error_message}</p>
                                      {r.action_required && (
                                        <p className="text-[11px] text-gray-500">{r.action_required}</p>
                                      )}
                                    </div>
                                  )}
                                </td>
                                <td className="px-3 py-2 text-center">
                                  <button
                                    type="button"
                                    onClick={() => handleStartEditRow(r)}
                                    className="inline-flex items-center gap-1 rounded-lg border border-gray-200 bg-white px-2 py-1 text-[11px] font-semibold text-gray-700 hover:bg-gray-50 hover:border-gray-300 shadow-xs transition"
                                    title="Edit Row"
                                  >
                                    <Edit2 className="h-3 w-3 text-gray-500" />
                                    <span>Edit</span>
                                  </button>
                                </td>
                              </tr>
                            );
                          })
                        )}
                      </tbody>
                    </table>
                  </div>

                  {/* Actions */}
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between pt-2">
                    <Button
                      variant="secondary"
                      onClick={() => setStage('select')}
                      icon={<ArrowLeft className="h-4 w-4" />}
                    >
                      Back / Re-upload
                    </Button>

                    <div className="flex flex-wrap items-center gap-2">
                      {(batchData.invalid_bills > 0 || batchData.duplicate_bills > 0) && (
                        <Button
                          id="btn-download-failed-records"
                          variant="secondary"
                          onClick={() => handleDownloadFailed(batchData.batch_id)}
                          disabled={isDownloadingFailed}
                          icon={isDownloadingFailed ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                        >
                          Download Failed Records
                        </Button>
                      )}

                      <Button
                        id="btn-confirm-import"
                        onClick={() => setStage('confirm')}
                        disabled={batchData.valid_bills === 0}
                        className="font-semibold"
                        icon={<CheckCircle2 className="h-4 w-4" />}
                      >
                        Confirm Bulk Import ({batchData.valid_bills} Bills)
                      </Button>
                    </div>
                  </div>
                </div>
              )}

              {/* STAGE 3: CONFIRMATION MODAL STEP */}
              {stage === 'confirm' && batchData && (
                <div className="mx-auto max-w-xl space-y-5 py-4 text-center">
                  <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-amber-100 text-amber-700">
                    <AlertCircle className="h-7 w-7" />
                  </div>
                  <h3 className="text-xl font-bold text-gray-900">Confirm Bulk Billing Import</h3>
                  <p className="text-xs text-gray-600">
                    Please review the import summary before committing records to your salon database.
                  </p>

                  <div className="rounded-2xl border border-gray-200 bg-gray-50/70 p-4 text-left space-y-2 text-xs">
                    <div className="flex justify-between py-1 border-b border-gray-200">
                      <span className="text-gray-500">Bills to Import:</span>
                      <span className="font-bold text-gray-900">{batchData.valid_bills} Bills</span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-gray-200">
                      <span className="text-gray-500">Total Billed Revenue:</span>
                      <span className="font-bold text-emerald-700">{formatCurrency(batchData.total_valid_amount)}</span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-gray-200">
                      <span className="text-gray-500">Unimported / Failed Bills:</span>
                      <span className="font-bold text-red-600">{batchData.invalid_bills + batchData.duplicate_bills} Bills</span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-gray-200">
                      <span className="text-gray-500">Live Inventory Deduction:</span>
                      <span className="font-semibold text-gray-900">
                        {deductInventory ? 'YES (Stock will be decremented)' : 'NO (Preserves live inventory)'}
                      </span>
                    </div>
                    <div className="flex justify-between py-1">
                      <span className="text-gray-500">WhatsApp & Reminders:</span>
                      <span className="font-semibold text-emerald-700">Suppressed (No messages will be sent)</span>
                    </div>
                  </div>

                  <div className="flex justify-center gap-3 pt-3">
                    <Button variant="secondary" onClick={() => setStage('preview')}>
                      Go Back
                    </Button>
                    <Button
                      id="btn-proceed-import"
                      onClick={handleConfirmImport}
                      disabled={isConfirming}
                      className="min-w-[150px] font-semibold"
                      icon={isConfirming ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                    >
                      {isConfirming ? 'Importing...' : 'Proceed with Import'}
                    </Button>
                  </div>
                </div>
              )}

              {/* STAGE 4: RESULTS SCREEN */}
              {stage === 'results' && batchData && (
                <div className="space-y-6 py-4 text-center">
                  <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
                    <CheckCircle2 className="h-9 w-9" />
                  </div>

                  <div>
                    <h3 className="text-2xl font-bold text-gray-900">Import Batch Finished!</h3>
                    <p className="mt-1 text-sm text-gray-600">
                      Batch <span className="font-mono font-bold text-gray-800">{batchData.batch_id}</span> processed with status{' '}
                      <span
                        className={cn(
                          'rounded-md px-2 py-0.5 font-bold uppercase text-xs',
                          batchData.status === 'COMPLETED' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                        )}
                      >
                        {batchData.status}
                      </span>
                    </p>
                  </div>

                  <div className="mx-auto grid max-w-2xl grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
                    <div className="rounded-2xl border border-emerald-200 bg-emerald-50/60 p-3 text-center">
                      <p className="text-[11px] font-semibold text-emerald-700">Successful Bills</p>
                      <p className="mt-1 text-2xl font-black text-emerald-800">{batchData.successful_bills}</p>
                    </div>
                    <div className="rounded-2xl border border-red-200 bg-red-50/60 p-3 text-center">
                      <p className="text-[11px] font-semibold text-red-700">Failed / Duplicate</p>
                      <p className="mt-1 text-2xl font-black text-red-800">{batchData.failed_bills}</p>
                    </div>
                    <div className="rounded-2xl border border-blue-200 bg-blue-50/60 p-3 text-center">
                      <p className="text-[11px] font-semibold text-blue-700">Customers Created</p>
                      <p className="mt-1 text-2xl font-black text-blue-800">{batchData.customers_created_count ?? 0}</p>
                    </div>
                    <div className="rounded-2xl border border-sky-200 bg-sky-50/60 p-3 text-center">
                      <p className="text-[11px] font-semibold text-sky-700">Client IDs Generated</p>
                      <p className="mt-1 text-2xl font-black text-sky-800">{batchData.client_ids_generated_count ?? 0}</p>
                    </div>
                    <div className="rounded-2xl border border-teal-200 bg-teal-50/60 p-3 text-center col-span-2 sm:col-span-1">
                      <p className="text-[11px] font-semibold text-teal-700">Committed Revenue</p>
                      <p className="mt-1 text-base font-black text-teal-800 truncate">
                        {formatCurrency(batchData.total_committed_amount)}
                      </p>
                    </div>
                  </div>

                  {/* Generated Client IDs Informative Banner */}
                  {(batchData.client_ids_generated_count ?? 0) > 0 && (
                    <div className="mx-auto max-w-2xl rounded-2xl border border-sky-300 bg-sky-50/90 p-4 text-left shadow-xs">
                      <div className="flex items-center gap-2 text-sky-950">
                        <UserPlus className="h-5 w-5 text-sky-700 shrink-0" />
                        <h4 className="font-bold text-sm">
                          {batchData.client_ids_generated_count ?? 0} customer{(batchData.client_ids_generated_count ?? 0) > 1 ? 's were' : ' was'} created with automatically generated Client IDs.
                        </h4>
                      </div>
                      <p className="mt-1 text-xs text-sky-800">
                        These historical records had no mobile number. Unique Client IDs (CL-XXXXXX) have been generated and permanently saved to your customer directory and bills.
                      </p>
                    </div>
                  )}

                  {/* Table of Generated Client IDs */}
                  {batchData.generated_client_ids && batchData.generated_client_ids.length > 0 && (
                    <div className="mx-auto max-w-2xl text-left space-y-2">
                      <div className="flex items-center justify-between">
                        <h4 className="text-xs font-bold uppercase tracking-wider text-gray-700">
                          Committed Client ID Records ({batchData.generated_client_ids.length})
                        </h4>
                      </div>
                      <div className="max-h-[200px] overflow-auto rounded-xl border border-gray-200 bg-white shadow-xs">
                        <table className="min-w-full text-xs">
                          <thead className="sticky top-0 bg-gray-50 text-[10px] font-bold uppercase text-gray-500">
                            <tr>
                              <th className="px-3 py-2 text-left">Customer Name</th>
                              <th className="px-3 py-2 text-left font-mono">Client ID</th>
                              <th className="px-3 py-2 text-left font-mono">Bill Number</th>
                              <th className="px-3 py-2 text-left font-mono">Invoice Number</th>
                              <th className="px-3 py-2 text-center">Status</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-100">
                            {batchData.generated_client_ids.map((item, idx) => (
                              <tr key={idx} className="hover:bg-gray-50/70">
                                <td className="px-3 py-2 font-medium text-gray-900">{item.customer_name}</td>
                                <td className="px-3 py-2 font-mono font-bold text-sky-700">{item.client_id}</td>
                                <td className="px-3 py-2 font-mono text-gray-700">{item.bill_number || '-'}</td>
                                <td className="px-3 py-2 font-mono text-gray-700">{item.invoice_number || '-'}</td>
                                <td className="px-3 py-2 text-center">
                                  <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[9px] font-bold text-emerald-800">
                                    {item.customer_status}
                                  </span>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  <div className="flex flex-wrap justify-center gap-3 pt-4">
                    {batchData.generated_client_ids && batchData.generated_client_ids.length > 0 && (
                      <Button
                        id="btn-download-client-ids"
                        variant="secondary"
                        onClick={() => handleDownloadGeneratedClientIds(batchData.batch_id)}
                        disabled={isDownloadingClientIds}
                        icon={isDownloadingClientIds ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4 text-sky-700" />}
                      >
                        Download Generated Client IDs (.xlsx)
                      </Button>
                    )}

                    {batchData.failed_bills > 0 && (
                      <Button
                        id="btn-download-failed-final"
                        variant="secondary"
                        onClick={() => handleDownloadFailed(batchData.batch_id)}
                        disabled={isDownloadingFailed}
                        icon={isDownloadingFailed ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                      >
                        Download Failed Records (.xlsx)
                      </Button>
                    )}

                    <Button
                      id="btn-download-summary-final"
                      variant="secondary"
                      onClick={() => handleDownloadSummary(batchData.batch_id)}
                      disabled={isDownloadingSummary}
                      icon={isDownloadingSummary ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                    >
                      Download Summary (.xlsx)
                    </Button>

                    <Button id="btn-view-billing-history" onClick={handleClose} className="font-semibold">
                      View in Billing History
                    </Button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            /* TAB 2: IMPORT HISTORY */
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-bold text-gray-900">Bulk Import Batches</h3>
                  <p className="text-xs text-gray-500">Historical billing upload batches committed for this salon.</p>
                </div>
                <button
                  type="button"
                  onClick={() => refetchBatches()}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-gray-200 bg-white px-3 py-1.5 text-xs font-semibold text-gray-700 shadow-sm transition hover:bg-gray-50"
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                  Refresh
                </button>
              </div>

              {isLoadingBatches ? (
                <div className="flex h-48 items-center justify-center">
                  <Loader2 className="h-6 w-6 animate-spin text-amber-600" />
                </div>
              ) : !batchesData?.data?.items || batchesData.data.items.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-gray-200 py-12 text-center text-gray-400">
                  <FileSpreadsheet className="mx-auto h-8 w-8 text-gray-300" />
                  <p className="mt-2 text-xs font-semibold text-gray-600">No bulk billing uploads yet.</p>
                  <p className="text-[11px] text-gray-400">Upload your first historical Excel file to see batches here.</p>
                </div>
              ) : (
                <div className="overflow-hidden rounded-2xl border border-[var(--color-border-soft)] bg-white shadow-soft">
                  <table className="min-w-full text-xs">
                    <thead className="bg-gray-50 text-[11px] font-bold uppercase tracking-wider text-gray-500">
                      <tr>
                        <th className="px-4 py-3 text-left">Batch ID</th>
                        <th className="px-4 py-3 text-left">Date</th>
                        <th className="px-4 py-3 text-center">Type</th>
                        <th className="px-4 py-3 text-center">Total Bills</th>
                        <th className="px-4 py-3 text-center">Successful</th>
                        <th className="px-4 py-3 text-center">Failed</th>
                        <th className="px-4 py-3 text-center">Status</th>
                        <th className="px-4 py-3 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {batchesData.data.items.map((b) => (
                        <tr key={b.batch_id} className="hover:bg-gray-50/60 transition">
                          <td className="px-4 py-3 font-mono font-bold text-gray-900">{b.batch_id}</td>
                          <td className="px-4 py-3 text-gray-600">{b.created_at ? formatDateDMY(b.created_at) : '-'}</td>
                          <td className="px-4 py-3 text-center">
                            <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-bold uppercase text-gray-700">
                              {b.import_type}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-center font-semibold text-gray-800">{b.total_bills}</td>
                          <td className="px-4 py-3 text-center font-semibold text-emerald-700">{b.successful_bills}</td>
                          <td className="px-4 py-3 text-center font-semibold text-red-600">{b.failed_bills}</td>
                          <td className="px-4 py-3 text-center">
                            <span
                              className={cn(
                                'rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase',
                                b.status === 'COMPLETED' && 'bg-emerald-100 text-emerald-800',
                                b.status === 'PARTIAL' && 'bg-amber-100 text-amber-800',
                                b.status === 'FAILED' && 'bg-red-100 text-red-800',
                                b.status === 'VALIDATED' && 'bg-blue-100 text-blue-800',
                                b.status === 'IMPORTING' && 'bg-purple-100 text-purple-800'
                              )}
                            >
                              {b.status}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              {b.failed_bills > 0 && (
                                <button
                                  type="button"
                                  title="Download Failed Records"
                                  onClick={() => handleDownloadFailed(b.batch_id)}
                                  className="rounded-lg p-1.5 text-red-600 hover:bg-red-50"
                                >
                                  <Download className="h-3.5 w-3.5" />
                                </button>
                              )}
                              {((b.client_ids_generated_count ?? 0) > 0 || (b.generated_client_ids && b.generated_client_ids.length > 0)) && (
                                <button
                                  type="button"
                                  title="Download Generated Client IDs"
                                  onClick={() => handleDownloadGeneratedClientIds(b.batch_id)}
                                  className="rounded-lg p-1.5 text-sky-600 hover:bg-sky-50"
                                >
                                  <UserCheck className="h-3.5 w-3.5" />
                                </button>
                              )}
                              <button
                                type="button"
                                title="Download Summary"
                                onClick={() => handleDownloadSummary(b.batch_id)}
                                className="rounded-lg p-1.5 text-gray-600 hover:bg-gray-100"
                              >
                                <FileSpreadsheet className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* IN-PLACE ROW EDIT MODAL */}
      {editingRow && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs animate-in fade-in">
          <div className="w-full max-w-lg rounded-2xl border border-gray-200 bg-white p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <div>
                <h3 className="text-base font-bold text-gray-900">
                  Edit Excel Row {editingRow.excel_row} ({editingRow.file_type})
                </h3>
                <p className="text-xs text-gray-500">
                  Update values and revalidate the entire bill.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setEditingRow(null)}
                className="rounded-lg p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="col-span-2 sm:col-span-1">
                <label className="font-semibold text-gray-700">Client Name *</label>
                <input
                  type="text"
                  value={editFormData.client_name ?? ''}
                  onChange={(e) => setEditFormData({ ...editFormData, client_name: e.target.value })}
                  className="mt-1 w-full rounded-lg border border-gray-300 p-2 text-xs focus:border-amber-500 focus:ring-amber-500"
                  placeholder="Customer Name"
                />
              </div>

              <div className="col-span-2 sm:col-span-1">
                <label className="font-semibold text-gray-700">Mobile Number (Optional)</label>
                <input
                  type="text"
                  value={editFormData.mobile_number ?? ''}
                  onChange={(e) => setEditFormData({ ...editFormData, mobile_number: e.target.value })}
                  className="mt-1 w-full rounded-lg border border-gray-300 p-2 text-xs focus:border-amber-500 focus:ring-amber-500"
                  placeholder="Blank = Auto Client ID"
                />
              </div>

              <div className="col-span-2 sm:col-span-1">
                <label className="font-semibold text-gray-700">
                  {editingRow.file_type === 'SERVICE' ? 'Service Name *' : 'Product Name *'}
                </label>
                <input
                  type="text"
                  value={editFormData.item_name ?? ''}
                  onChange={(e) => setEditFormData({ ...editFormData, item_name: e.target.value })}
                  className="mt-1 w-full rounded-lg border border-gray-300 p-2 text-xs focus:border-amber-500 focus:ring-amber-500"
                  placeholder="Item catalog name"
                />
              </div>

              <div className="col-span-2 sm:col-span-1">
                <label className="font-semibold text-gray-700">
                  {editingRow.file_type === 'SERVICE' ? 'Staff Name *' : 'Sold By Staff *'}
                </label>
                <input
                  type="text"
                  value={editFormData.staff_identifier ?? ''}
                  onChange={(e) => setEditFormData({ ...editFormData, staff_identifier: e.target.value })}
                  className="mt-1 w-full rounded-lg border border-gray-300 p-2 text-xs focus:border-amber-500 focus:ring-amber-500"
                  placeholder="Staff name or code"
                />
              </div>

              {editingRow.file_type === 'PRODUCT' && (
                <div className="col-span-2 sm:col-span-1">
                  <label className="font-semibold text-gray-700">Quantity *</label>
                  <input
                    type="number"
                    min={1}
                    value={editFormData.quantity ?? 1}
                    onChange={(e) => setEditFormData({ ...editFormData, quantity: parseInt(e.target.value, 10) || 1 })}
                    className="mt-1 w-full rounded-lg border border-gray-300 p-2 text-xs focus:border-amber-500 focus:ring-amber-500"
                  />
                </div>
              )}

              <div className="col-span-2 sm:col-span-1">
                <label className="font-semibold text-gray-700">
                  {editingRow.file_type === 'SERVICE' ? 'Service Amount (₹) *' : 'Selling Price (₹/unit) *'}
                </label>
                <input
                  type="number"
                  step="0.01"
                  min={0}
                  value={editFormData.unit_price ?? 0}
                  onChange={(e) => setEditFormData({ ...editFormData, unit_price: parseFloat(e.target.value) || 0 })}
                  className="mt-1 w-full rounded-lg border border-gray-300 p-2 text-xs focus:border-amber-500 focus:ring-amber-500"
                />
              </div>

              <div className="col-span-2 sm:col-span-1">
                <label className="font-semibold text-gray-700">Discount (₹)</label>
                <input
                  type="number"
                  step="0.01"
                  min={0}
                  value={editFormData.discount ?? 0}
                  onChange={(e) => setEditFormData({ ...editFormData, discount: parseFloat(e.target.value) || 0 })}
                  className="mt-1 w-full rounded-lg border border-gray-300 p-2 text-xs focus:border-amber-500 focus:ring-amber-500"
                />
              </div>

              <div className="col-span-2 sm:col-span-1">
                <label className="font-semibold text-gray-700">Payment Method *</label>
                <select
                  value={editFormData.payment_method ?? 'CASH'}
                  onChange={(e) => setEditFormData({ ...editFormData, payment_method: e.target.value })}
                  className="mt-1 w-full rounded-lg border border-gray-300 p-2 text-xs focus:border-amber-500 focus:ring-amber-500"
                >
                  <option value="CASH">CASH</option>
                  <option value="UPI">UPI</option>
                  <option value="CARD">CARD</option>
                  <option value="SPLIT">SPLIT</option>
                </select>
              </div>

              <div className="col-span-2 sm:col-span-1">
                <label className="font-semibold text-gray-700">Payment Status *</label>
                <select
                  value={editFormData.payment_status ?? 'PAID'}
                  onChange={(e) => setEditFormData({ ...editFormData, payment_status: e.target.value })}
                  className="mt-1 w-full rounded-lg border border-gray-300 p-2 text-xs focus:border-amber-500 focus:ring-amber-500"
                >
                  <option value="PAID">PAID</option>
                  <option value="PARTIALLY_PAID">PARTIALLY_PAID</option>
                  <option value="PENDING">PENDING</option>
                </select>
              </div>

              {editFormData.payment_status === 'PARTIALLY_PAID' && (
                <div className="col-span-2 sm:col-span-1">
                  <label className="font-semibold text-gray-700">Paid Amount (₹) *</label>
                  <input
                    type="number"
                    step="0.01"
                    min={0}
                    value={editFormData.paid_amount ?? ''}
                    onChange={(e) => setEditFormData({ ...editFormData, paid_amount: parseFloat(e.target.value) || 0 })}
                    className="mt-1 w-full rounded-lg border border-gray-300 p-2 text-xs focus:border-amber-500 focus:ring-amber-500"
                    placeholder="Amount paid"
                  />
                </div>
              )}

              <div className="col-span-2 sm:col-span-1">
                <label className="font-semibold text-gray-700">Bill Date (YYYY-MM-DD) *</label>
                <input
                  type="date"
                  value={editFormData.bill_date ?? ''}
                  onChange={(e) => setEditFormData({ ...editFormData, bill_date: e.target.value })}
                  className="mt-1 w-full rounded-lg border border-gray-300 p-2 text-xs focus:border-amber-500 focus:ring-amber-500"
                />
              </div>

              <div className="col-span-2 sm:col-span-1">
                <label className="font-semibold text-gray-700">Bill Group (Optional)</label>
                <input
                  type="text"
                  value={editFormData.bill_group ?? ''}
                  onChange={(e) => setEditFormData({ ...editFormData, bill_group: e.target.value })}
                  className="mt-1 w-full rounded-lg border border-gray-300 p-2 text-xs focus:border-amber-500 focus:ring-amber-500"
                  placeholder="Leave blank for standalone bill"
                />
              </div>

              <div className="col-span-2">
                <label className="font-semibold text-gray-700">Notes (Optional)</label>
                <input
                  type="text"
                  value={editFormData.notes ?? ''}
                  onChange={(e) => setEditFormData({ ...editFormData, notes: e.target.value })}
                  className="mt-1 w-full rounded-lg border border-gray-300 p-2 text-xs focus:border-amber-500 focus:ring-amber-500"
                  placeholder="Optional remarks"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 border-t border-gray-100 pt-3">
              <Button variant="secondary" onClick={() => setEditingRow(null)}>
                Cancel
              </Button>
              <Button
                id="btn-save-row-edit"
                onClick={handleSaveRowEdit}
                disabled={isEditingRow}
                icon={isEditingRow ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                className="font-semibold"
              >
                {isEditingRow ? 'Saving & Revalidating...' : 'Save & Revalidate'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default BulkBillingModal;
