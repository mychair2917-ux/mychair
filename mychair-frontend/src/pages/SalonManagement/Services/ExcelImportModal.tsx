import React, { useRef, useState } from 'react';
import { Download, Upload, AlertCircle, FileSpreadsheet, Trash2 } from 'lucide-react';
import * as XLSX from 'xlsx';
import { CommonModal, Button } from '../../../components/common';
import { showToast } from '../../../components/common/Toast/toastService';

interface ParsedServiceData {
  serviceName: string;
  price: number;
  memberPrice?: number;
}

interface ExcelImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImport: (data: ParsedServiceData[]) => Promise<void>;
  isImporting?: boolean;
}

const ExcelImportModal: React.FC<ExcelImportModalProps> = ({
  isOpen,
  onClose,
  onImport,
  isImporting = false,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [parsedData, setParsedData] = useState<ParsedServiceData[]>([]);
  const [fileName, setFileName] = useState<string | null>(null);

  const handleDownloadDemo = () => {
    const wsData = [
      ['Service Name', 'Price', 'Member Price'],
      ['Haircut - Men', 20, 15],
      ['Haircut - Women', 30, 25],
      ['Hair Coloring', 50, ''],
    ];
    const ws = XLSX.utils.aoa_to_sheet(wsData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Services Demo');
    XLSX.writeFile(wb, 'services_import_demo.xlsx');
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: 'binary' });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        const data = XLSX.utils.sheet_to_json<any>(ws);

        const formattedData: ParsedServiceData[] = data
          .map((row) => ({
            serviceName: row['Service Name']?.toString().trim() || '',
            price: Number(row['Price']) || 0,
            memberPrice: row['Member Price'] ? Number(row['Member Price']) : undefined,
          }))
          .filter((item) => item.serviceName && item.price > 0);

        if (formattedData.length === 0) {
          showToast('error', 'No valid data found in excel file.');
          setParsedData([]);
          return;
        }

        setParsedData(formattedData);
      } catch (err) {
        showToast('error', 'Failed to parse excel file.');
      }
    };
    reader.readAsBinaryString(file);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleConfirmImport = async () => {
    if (parsedData.length === 0) return;
    await onImport(parsedData);
    handleReset();
  };

  const handleReset = () => {
    setParsedData([]);
    setFileName(null);
  };

  return (
    <CommonModal
      open={isOpen}
      onClose={onClose}
      title="Import Services via Excel"
      size="xl"
    >
      <div className="space-y-6">
        {!parsedData.length ? (
          <div className="space-y-4">
            <div className="rounded-2xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-800">
              <div className="flex gap-3 items-start">
                <AlertCircle className="h-5 w-5 shrink-0 text-blue-600" />
                <div>
                  <p className="font-semibold mb-1">Instructions:</p>
                  <ul className="list-disc pl-5 space-y-1">
                    <li>Download the demo excel template.</li>
                    <li>Fill in the service details. Required columns: "Service Name", "Price".</li>
                    <li>Upload the filled excel sheet below.</li>
                  </ul>
                </div>
              </div>
            </div>

            <div className="flex gap-4">
              <Button
                variant="secondary"
                leftIcon={<Download className="h-4 w-4" />}
                onClick={handleDownloadDemo}
              >
                Download Demo Template
              </Button>

              <Button
                variant="primary"
                leftIcon={<Upload className="h-4 w-4" />}
                onClick={() => fileInputRef.current?.click()}
              >
                Upload Excel File
              </Button>
              <input
                type="file"
                ref={fileInputRef}
                className="hidden"
                accept=".xlsx, .xls, .csv"
                onChange={handleFileUpload}
              />
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex justify-between items-center bg-gray-50 p-3 rounded-xl border border-gray-200">
              <div className="flex items-center gap-2">
                <FileSpreadsheet className="h-5 w-5 text-emerald-600" />
                <span className="text-sm font-semibold text-gray-800">{fileName}</span>
                <span className="text-xs text-gray-500 bg-white px-2 py-1 rounded-md border border-gray-200">
                  {parsedData.length} valid rows
                </span>
              </div>
              <button
                type="button"
                onClick={handleReset}
                className="text-xs text-rose-600 hover:text-rose-700 font-semibold flex items-center gap-1"
              >
                <Trash2 className="h-3 w-3" />
                Discard
              </button>
            </div>

            <div className="max-h-[400px] overflow-y-auto rounded-xl border border-gray-200">
              <table className="w-full text-left text-sm">
                <thead className="sticky top-0 bg-gray-100 text-gray-600 font-semibold border-b border-gray-200 shadow-sm">
                  <tr>
                    <th className="py-2.5 px-4">Service Name</th>
                    <th className="py-2.5 px-4">Price</th>
                    <th className="py-2.5 px-4">Member Price</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 bg-white">
                  {parsedData.map((row, idx) => (
                    <tr key={idx} className="hover:bg-gray-50 transition-colors">
                      <td className="py-2.5 px-4 font-medium text-gray-900">{row.serviceName}</td>
                      <td className="py-2.5 px-4">{row.price.toFixed(2)}</td>
                      <td className="py-2.5 px-4">{row.memberPrice ? row.memberPrice.toFixed(2) : '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t border-gray-100">
              <Button variant="secondary" onClick={onClose} disabled={isImporting}>
                Cancel
              </Button>
              <Button
                variant="primary"
                onClick={handleConfirmImport}
                isLoading={isImporting}
              >
                Confirm & Import
              </Button>
            </div>
          </div>
        )}
      </div>
    </CommonModal>
  );
};

export default ExcelImportModal;
