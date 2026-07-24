import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  CheckCircle2,
  Download,
  FileSpreadsheet,
  Loader2,
  Trash2,
  UploadCloud,
} from 'lucide-react';

import { Button, showToast } from '../common';
import { Modal, ModalBody, ModalFooter, ModalHeader } from '../common/Modal';
import { cn } from '../../utils/cn';
import {
  useImportCustomersMutation,
  useLazyDownloadCustomerImportTemplateQuery,
} from '../../redux/slices/customerAnalytics/customerAnalyticsApi';
import type { CustomerImportResult } from '../../redux/slices/customerAnalytics/Types';

const MAX_BYTES = 20 * 1024 * 1024;
const ACCEPT = '.csv,.xlsx,.xls,text/csv,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
const ALLOWED_EXT = new Set(['.csv', '.xlsx', '.xls']);

type Stage = 'pick' | 'uploading' | 'summary';

function extensionOf(name: string): string {
  const lower = name.toLowerCase();
  for (const ext of ALLOWED_EXT) {
    if (lower.endsWith(ext)) return ext;
  }
  return '';
}

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

function downloadTextCsv(csv: string, filename: string) {
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  triggerBlobDownload(blob, filename);
}

interface BulkClientUploadModalProps {
  open: boolean;
  onClose: () => void;
}

const BulkClientUploadModal: React.FC<BulkClientUploadModalProps> = ({ open, onClose }) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [dragging, setDragging] = useState(false);
  const [stage, setStage] = useState<Stage>('pick');
  const [progress, setProgress] = useState(0);
  const [summary, setSummary] = useState<CustomerImportResult | null>(null);
  const submittingRef = useRef(false);

  const [importCustomers, { isLoading }] = useImportCustomersMutation();
  const [downloadTemplate, { isFetching: downloadingTemplate }] =
    useLazyDownloadCustomerImportTemplateQuery();

  const reset = useCallback(() => {
    setFile(null);
    setDragging(false);
    setStage('pick');
    setProgress(0);
    setSummary(null);
    submittingRef.current = false;
    if (inputRef.current) inputRef.current.value = '';
  }, []);

  useEffect(() => {
    if (!open) reset();
  }, [open, reset]);

  const validateAndSetFile = (selected: File | null) => {
    if (!selected) return;
    const ext = extensionOf(selected.name);
    if (!ext) {
      showToast('error', 'Only .csv, .xlsx, or .xls files are supported');
      return;
    }
    if (selected.size > MAX_BYTES) {
      showToast('error', 'File must be 20 MB or smaller');
      return;
    }
    if (selected.size === 0) {
      showToast('error', 'File is empty');
      return;
    }
    setFile(selected);
    setSummary(null);
    setStage('pick');
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const dropped = e.dataTransfer.files?.[0] ?? null;
    validateAndSetFile(dropped);
  };

  const handleDownloadTemplate = async (format: 'xlsx' | 'csv') => {
    try {
      const blob = await downloadTemplate(format).unwrap();
      triggerBlobDownload(
        blob,
        format === 'csv' ? 'client_import_template.csv' : 'client_import_template.xlsx'
      );
      showToast('success', 'Template downloaded');
    } catch {
      showToast('error', 'Failed to download template');
    }
  };

  const handleUpload = async () => {
    if (!file || submittingRef.current || isLoading) return;
    submittingRef.current = true;
    setStage('uploading');
    setProgress(12);

    const tick = window.setInterval(() => {
      setProgress((p) => (p >= 88 ? p : p + Math.random() * 8));
    }, 280);

    try {
      const res = await importCustomers(file).unwrap();
      window.clearInterval(tick);
      setProgress(100);
      const data = res.data;
      if (!data) {
        showToast('error', res.message || 'Import failed');
        setStage('pick');
        submittingRef.current = false;
        return;
      }
      setSummary(data);
      setStage('summary');
      if (data.inserted > 0 && data.failed === 0 && data.duplicates === 0) {
        showToast('success', `Successfully imported ${data.inserted} clients`);
      } else if (data.inserted > 0) {
        showToast(
          'success',
          `Imported ${data.inserted} · skipped ${data.skipped} · failed ${data.failed}`
        );
      } else {
        showToast('warning', 'No clients were imported. Check the summary for details.');
      }
    } catch (err: unknown) {
      window.clearInterval(tick);
      setProgress(0);
      setStage('pick');
      const e = err as { data?: { message?: string }; message?: string };
      showToast('error', e?.data?.message ?? e?.message ?? 'Upload failed. Please try again.');
    } finally {
      submittingRef.current = false;
    }
  };

  const handleDownloadErrorReport = () => {
    if (!summary?.errorReportCsv) return;
    downloadTextCsv(summary.errorReportCsv, 'client_import_errors.csv');
  };

  if (!open) return null;

  const reasonEntries = summary ? Object.entries(summary.reasons || {}) : [];

  return (
    <Modal
      open={open}
      onClose={() => {
        if (isLoading) return;
        onClose();
      }}
      size="lg"
      isShowIcon
      className="rounded-3xl border border-[var(--color-border-soft)] shadow-card"
    >
      <ModalHeader className="flex-col gap-1 pr-14">
        <h2 className="text-xl font-semibold text-[var(--color-text-primary)]">
          Upload Clients
        </h2>
        <p className="text-sm font-normal text-[var(--color-text-secondary)]">
          Import clients in bulk from CSV or Excel. Required columns: Full Name, Mobile Number.
        </p>
      </ModalHeader>

      <ModalBody className="space-y-4 pt-2">
        {stage !== 'summary' && (
          <>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="secondary"
                size="sm"
                icon={<Download className="h-3.5 w-3.5" />}
                isLoading={downloadingTemplate}
                onClick={() => handleDownloadTemplate('xlsx')}
              >
                Excel Template
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                icon={<Download className="h-3.5 w-3.5" />}
                isLoading={downloadingTemplate}
                onClick={() => handleDownloadTemplate('csv')}
              >
                CSV Template
              </Button>
            </div>

            <div
              onDragOver={(e) => {
                e.preventDefault();
                setDragging(true);
              }}
              onDragLeave={() => setDragging(false)}
              onDrop={onDrop}
              className={cn(
                'rounded-2xl border border-dashed bg-[var(--color-surface-bg)] p-8 text-center transition',
                dragging
                  ? 'border-[var(--color-brand-gold)] bg-[var(--color-brand-gold-light)]/20'
                  : 'border-[var(--color-border-strong)]'
              )}
            >
              <input
                ref={inputRef}
                type="file"
                accept={ACCEPT}
                className="hidden"
                onChange={(e) => {
                  validateAndSetFile(e.target.files?.[0] ?? null);
                  e.target.value = '';
                }}
              />
              <UploadCloud
                className={cn(
                  'mx-auto h-10 w-10 transition',
                  dragging
                    ? 'text-[var(--color-brand-gold-dark)] scale-110'
                    : 'text-[var(--color-brand-gold-dark)]'
                )}
              />
              <p className="mt-3 text-sm font-semibold text-[var(--color-text-primary)]">
                Drag & drop your file here
              </p>
              <p className="mt-1 text-xs text-gray-500">
                Supported: .csv, .xlsx, .xls · Max 20 MB
              </p>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                className="mt-4 rounded-xl"
                onClick={() => inputRef.current?.click()}
                disabled={isLoading}
              >
                Browse File
              </Button>
            </div>

            {file && (
              <div className="flex items-center gap-3 rounded-2xl border border-[var(--color-border-soft)] bg-white px-4 py-3">
                <FileSpreadsheet className="h-8 w-8 shrink-0 text-[var(--color-brand-gold-dark)]" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-[var(--color-text-primary)]">
                    {file.name}
                  </p>
                  <p className="text-xs text-gray-500">{formatBytes(file.size)}</p>
                </div>
                <button
                  type="button"
                  className="rounded-lg p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-700 disabled:opacity-50"
                  onClick={() => {
                    setFile(null);
                    setProgress(0);
                  }}
                  disabled={isLoading}
                  aria-label="Remove file"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            )}

            {stage === 'uploading' && (
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm text-[var(--color-text-secondary)]">
                  <Loader2 className="h-4 w-4 animate-spin text-[var(--color-brand-gold-dark)]" />
                  Uploading and validating clients…
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-gray-100">
                  <div
                    className="h-full rounded-full bg-[var(--color-brand-gold)] transition-all duration-300"
                    style={{ width: `${Math.min(100, Math.round(progress))}%` }}
                  />
                </div>
              </div>
            )}
          </>
        )}

        {stage === 'summary' && summary && (
          <div className="space-y-4">
            <div className="flex flex-col items-center gap-2 py-2 text-center">
              <CheckCircle2 className="h-12 w-12 text-emerald-500 animate-[bounce_0.6s_ease-out_1]" />
              <h3 className="text-lg font-bold text-[var(--color-text-primary)]">
                Successfully Imported
              </h3>
              <p className="text-sm text-[var(--color-text-secondary)]">
                Review the summary below. Download the error report if any rows were skipped or failed.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {[
                { label: 'Total Rows', value: summary.totalRows },
                { label: 'Inserted', value: summary.inserted, tone: 'text-emerald-700' },
                { label: 'Skipped', value: summary.skipped, tone: 'text-amber-700' },
                { label: 'Failed', value: summary.failed, tone: 'text-rose-700' },
              ].map((m) => (
                <div
                  key={m.label}
                  className="rounded-2xl border border-[var(--color-border-soft)] bg-[var(--color-surface-bg)] px-3 py-3 text-center"
                >
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">
                    {m.label}
                  </p>
                  <p className={cn('mt-1 text-xl font-bold', m.tone ?? 'text-[var(--color-text-primary)]')}>
                    {m.value}
                  </p>
                </div>
              ))}
            </div>

            {reasonEntries.length > 0 && (
              <div className="rounded-2xl border border-[var(--color-border-soft)] p-4">
                <p className="text-xs font-bold uppercase tracking-wide text-gray-500">Reasons</p>
                <ul className="mt-2 space-y-1.5">
                  {reasonEntries.map(([reason, count]) => (
                    <li
                      key={reason}
                      className="flex items-center justify-between text-sm text-[var(--color-text-primary)]"
                    >
                      <span>{reason}</span>
                      <span className="font-semibold text-gray-600">{count}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {summary.errors?.length > 0 && (
              <div className="max-h-40 overflow-auto rounded-2xl border border-[var(--color-border-soft)]">
                <table className="min-w-full text-xs">
                  <thead className="sticky top-0 bg-[var(--color-surface-bg)] text-left uppercase tracking-wide text-gray-500">
                    <tr>
                      <th className="px-3 py-2">Row</th>
                      <th className="px-3 py-2">Status</th>
                      <th className="px-3 py-2">Message</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--color-border-soft)]">
                    {summary.errors.slice(0, 50).map((err) => (
                      <tr key={`${err.row}-${err.reason}`}>
                        <td className="px-3 py-2 font-mono">{err.row}</td>
                        <td className="px-3 py-2 capitalize">{err.status}</td>
                        <td className="px-3 py-2">{err.reason}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {summary.errors.length > 50 && (
                  <p className="px-3 py-2 text-xs text-gray-500">
                    Showing first 50 errors. Download the full error report for all rows.
                  </p>
                )}
              </div>
            )}
          </div>
        )}
      </ModalBody>

      <ModalFooter className="justify-end gap-2 pt-2">
        {stage === 'summary' ? (
          <>
            {summary?.errorReportCsv && (
              <Button
                type="button"
                variant="secondary"
                icon={<Download className="h-4 w-4" />}
                onClick={handleDownloadErrorReport}
              >
                Download Error Report
              </Button>
            )}
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                reset();
              }}
            >
              Upload Another
            </Button>
            <Button type="button" variant="primary" onClick={onClose}>
              Done
            </Button>
          </>
        ) : (
          <>
            <Button type="button" variant="secondary" onClick={onClose} disabled={isLoading}>
              Cancel
            </Button>
            <Button
              type="button"
              variant="primary"
              icon={<UploadCloud className="h-4 w-4" />}
              onClick={handleUpload}
              isLoading={isLoading}
              disabled={!file || isLoading}
            >
              Upload
            </Button>
          </>
        )}
      </ModalFooter>
    </Modal>
  );
};

export default BulkClientUploadModal;
