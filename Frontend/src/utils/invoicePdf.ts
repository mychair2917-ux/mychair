import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { BillDetail, BillListItem } from '../redux/slices/billing/Types';
import { formatCurrency } from './currency';
import { formatDateDMY } from './utilities';

const DARK = [36, 36, 36] as [number, number, number];
const GOLD = [184, 134, 11] as [number, number, number];
const MUTED = [110, 110, 110] as [number, number, number];
const LIGHT = [245, 245, 245] as [number, number, number];
const WHITE = [255, 255, 255] as [number, number, number];

const toSafeFilePart = (value?: string | null, fallback = 'Customer'): string =>
  (value || fallback).replace(/[^a-zA-Z0-9]/g, '');

const paymentStatusLabel = (status: string): string => {
  if (status === 'PAID') return 'Paid';
  if (status === 'PARTIALLY_PAID') return 'Partially Paid';
  return 'Pending';
};

const stringifyAddress = (address?: string | null | Record<string, unknown>): string => {
  if (!address) return '-';
  if (typeof address === 'string') return address;
  return Object.values(address)
    .filter((v) => typeof v === 'string' && v.trim().length > 0)
    .join(', ');
};

export function downloadInvoicePDF(bill: BillListItem | BillDetail): void {
  const doc = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' });
  const autoTableDoc = doc as jsPDF & { lastAutoTable?: { finalY?: number } };
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 12;

  const detail = bill as BillDetail;
  const salonName = detail.salon?.name || bill.salon_name || 'Salon';
  const salonPhone = detail.salon?.phone || bill.salon_phone || '-';
  const salonAddress = stringifyAddress(detail.salon?.address || bill.salon_address);
  const salonGst = detail.salon?.gst_number || '-';

  const customerName = detail.customer?.name || bill.customer_name || 'Customer';
  const customerPhone = detail.customer?.phone || bill.customer_phone || '-';
  const staffName =
    bill.staff_summary ||
    (bill.items || [])
      .map((i) => i.staff_name)
      .filter(Boolean)
      .join(', ') ||
    '-';

  doc.setFillColor(...DARK);
  doc.rect(0, 0, pageWidth, 32, 'F');
  doc.setDrawColor(...GOLD);
  doc.setLineWidth(1.2);
  doc.line(0, 32, pageWidth, 32);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.setTextColor(...WHITE);
  doc.text(salonName, margin, 13);
  doc.setFontSize(9);
  doc.setTextColor(220, 220, 220);
  doc.text(`Phone: ${salonPhone}`, margin, 19);
  doc.text(`Address: ${salonAddress}`, margin, 24);
  doc.text(`GST: ${salonGst}`, margin, 29);

  doc.setTextColor(...WHITE);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(17);
  doc.text('TAX INVOICE', pageWidth - margin, 13, { align: 'right' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.text(`Invoice #: ${bill.invoice_number}`, pageWidth - margin, 20, { align: 'right' });
  doc.text(`Date: ${formatDateDMY(bill.created_at)}`, pageWidth - margin, 25, { align: 'right' });

  doc.setFillColor(...LIGHT);
  doc.roundedRect(margin, 38, pageWidth - margin * 2, 30, 2, 2, 'F');
  doc.setFontSize(9);
  doc.setTextColor(...MUTED);
  doc.setFont('helvetica', 'bold');
  doc.text('Billed To', margin + 3, 45);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...DARK);
  doc.text(customerName, margin + 3, 50);
  doc.text(`Phone: ${customerPhone}`, margin + 3, 55);
  doc.text(`Staff: ${staffName}`, margin + 3, 60);

  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...MUTED);
  doc.text('Payment', pageWidth / 2 + 5, 45);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...DARK);
  doc.text(`Mode: ${bill.payment_method || '-'}`, pageWidth / 2 + 5, 50);
  doc.text(`Status: ${paymentStatusLabel(bill.payment_status)}`, pageWidth / 2 + 5, 55);
  doc.text(`Notes: ${detail.customer?.notes || '-'}`, pageWidth / 2 + 5, 60);

  const rowSource =
    detail.services || detail.products
      ? [
          ...(detail.services || []).map((s) => ({ ...s, type: 'Service' })),
          ...(detail.products || []).map((p) => ({ ...p, type: 'Product' })),
        ]
      : (bill.items || []).map((item) => ({
          name: item.name,
          quantity: item.quantity,
          unit_price: item.unit_price,
          discount: item.discount,
          tax_amount: ((item.unit_price * item.quantity - item.discount) * item.tax_rate) / 100,
          line_total:
            item.unit_price * item.quantity -
            item.discount +
            ((item.unit_price * item.quantity - item.discount) * item.tax_rate) / 100,
          type: item.item_type === 'SERVICE' ? 'Service' : 'Product',
        }));

  autoTable(doc, {
    startY: 74,
    margin: { left: margin, right: margin },
    head: [['Type', 'Item', 'Qty', 'Price', 'Discount', 'Tax', 'Total']],
    body: rowSource.map((item) => [
      item.type,
      item.name,
      String(item.quantity),
      formatCurrency(item.unit_price),
      formatCurrency(item.discount),
      formatCurrency(item.tax_amount),
      formatCurrency(item.line_total),
    ]),
    theme: 'grid',
    headStyles: {
      fillColor: DARK,
      textColor: WHITE,
      fontStyle: 'bold',
      fontSize: 8.5,
    },
    styles: {
      fontSize: 8.5,
      cellPadding: { top: 2.8, bottom: 2.8, left: 2.5, right: 2.5 },
      lineColor: [220, 220, 220],
      lineWidth: 0.2,
      overflow: 'linebreak',
      textColor: DARK,
    },
    columnStyles: {
      0: { cellWidth: 18 },
      1: { cellWidth: 56 },
      2: { cellWidth: 12, halign: 'center' },
      3: { cellWidth: 24, halign: 'right' },
      4: { cellWidth: 22, halign: 'right' },
      5: { cellWidth: 20, halign: 'right' },
      6: { cellWidth: 24, halign: 'right', fontStyle: 'bold' },
    },
  });

  let y = (autoTableDoc.lastAutoTable?.finalY || 90) + 8;

  const taxRows =
    detail.tax_breakdown?.length
      ? detail.tax_breakdown.map((t) => [t.rate, formatCurrency(t.amount)])
      : [['Overall', formatCurrency(bill.tax_amount)]];

  autoTable(doc, {
    startY: y,
    margin: { left: margin, right: pageWidth / 2 + 4 },
    head: [['Tax Rate', 'Amount']],
    body: taxRows,
    theme: 'striped',
    headStyles: { fillColor: [70, 70, 70], textColor: WHITE, fontSize: 8 },
    styles: { fontSize: 8, cellPadding: 2.4 },
    columnStyles: { 1: { halign: 'right' } },
  });

  y = (autoTableDoc.lastAutoTable?.finalY || y) + 2;
  const sx = pageWidth - 70;
  doc.setDrawColor(...GOLD);
  doc.line(sx, y, pageWidth - margin, y);
  y += 6;

  const addSummary = (label: string, value: string, bold = false) => {
    doc.setFont('helvetica', bold ? 'bold' : 'normal');
    doc.setFontSize(9);
    doc.setTextColor(...MUTED);
    doc.text(label, sx, y);
    doc.setTextColor(...DARK);
    doc.text(value, pageWidth - margin, y, { align: 'right' });
    y += 5.8;
  };

  addSummary('Subtotal', formatCurrency(bill.subtotal));
  addSummary('Discount', formatCurrency(bill.discount_amount));
  addSummary('Tax', formatCurrency(bill.tax_amount));
  addSummary('Grand Total', formatCurrency(bill.total_amount), true);
  addSummary('Amount Paid', formatCurrency(bill.paid_amount));
  addSummary('Balance', formatCurrency(bill.remaining_amount));

  const footerY = pageHeight - 18;
  doc.setDrawColor(...LIGHT);
  doc.line(margin, footerY - 3, pageWidth - margin, footerY - 3);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(...DARK);
  doc.text('Thank you for choosing us!', pageWidth / 2, footerY, { align: 'center' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(...MUTED);
  doc.text('This is a computer-generated invoice.', pageWidth / 2, footerY + 5, {
    align: 'center',
  });

  const safeInvoice = toSafeFilePart(bill.invoice_number, 'Invoice');
  const safeCustomer = toSafeFilePart(customerName, 'Customer');
  doc.save(`${safeInvoice}_${safeCustomer}.pdf`);
}
