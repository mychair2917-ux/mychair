import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { BillDetail, BillListItem } from '../redux/slices/billing/Types';
import { formatDateDMY } from './utilities';
import { formatCurrencyPdf, stringifyAddress, wrapText } from './pdfHelpers';

const INK = [28, 28, 28] as [number, number, number];
const MUTED = [100, 100, 100] as [number, number, number];
const RULE = [210, 210, 210] as [number, number, number];
const LIGHT = [248, 248, 248] as [number, number, number];
const WHITE = [255, 255, 255] as [number, number, number];
const ACCENT = [45, 45, 45] as [number, number, number];

const MARGIN = 16;
const CONTENT_WIDTH = 210 - MARGIN * 2;

const toSafeFilePart = (value?: string | null, fallback = 'Customer'): string =>
  (value || fallback).replace(/[^a-zA-Z0-9]/g, '');

const paymentStatusLabel = (status: string): string => {
  if (status === 'PAID') return 'Paid';
  if (status === 'PARTIALLY_PAID') return 'Partially Paid';
  return 'Pending';
};

const hasStaffColumn = (
  rows: Array<{ staff_name?: string | null }>
): boolean => rows.some((row) => Boolean(row.staff_name && String(row.staff_name).trim()));

export function downloadInvoicePDF(bill: BillListItem | BillDetail): void {
  const doc = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' });
  const autoTableDoc = doc as jsPDF & { lastAutoTable?: { finalY?: number } };
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const right = pageWidth - MARGIN;

  const detail = bill as BillDetail;
  const resolvedName = (
    detail.salon?.name ||
    bill.salon_name ||
    'Salon'
  ).trim() || 'Salon';
  const salonPhone = (detail.salon?.phone || bill.salon_phone || '').trim();
  const salonAddress = stringifyAddress(detail.salon?.address || bill.salon_address);
  const salonEmail = (detail.salon?.email || '').trim();
  const salonGst = (detail.salon?.gst_number || '').trim();
  const salonLogo = detail.salon?.logo_url || '';

  const customerName = detail.customer?.name || bill.customer_name || 'Customer';
  const customerPhone = detail.customer?.phone || bill.customer_phone || '-';
  const staffName =
    bill.staff_summary ||
    (bill.items || [])
      .map((i) => i.staff_name)
      .filter(Boolean)
      .join(', ') ||
    '-';

  let y = MARGIN;

  // Salon branding header
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.setTextColor(...INK);
  const nameMaxWidth = CONTENT_WIDTH - (salonLogo ? 28 : 0);
  y = wrapText(doc, resolvedName, MARGIN, y + 4, nameMaxWidth, 6.5);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(...MUTED);
  if (salonAddress) {
    y = wrapText(doc, salonAddress, MARGIN, y + 1, nameMaxWidth, 3.8);
  }
  const contactParts = [
    salonPhone ? `Phone: ${salonPhone}` : '',
    salonEmail ? `Email: ${salonEmail}` : '',
    salonGst ? `GST: ${salonGst}` : '',
  ].filter(Boolean);
  if (contactParts.length) {
    y = wrapText(doc, contactParts.join('   |   '), MARGIN, y + 1.5, CONTENT_WIDTH, 3.8);
  } else {
    // Keep consistent spacing even when contact is missing
    y += 1;
  }

  if (salonLogo) {
    try {
      doc.addImage(salonLogo, 'PNG', right - 22, MARGIN, 22, 22);
    } catch {
      // Ignore unsupported logo formats
    }
  }

  y += 4;
  doc.setDrawColor(...INK);
  doc.setLineWidth(0.6);
  doc.line(MARGIN, y, right, y);
  y += 1.2;
  doc.setDrawColor(...RULE);
  doc.setLineWidth(0.2);
  doc.line(MARGIN, y, right, y);
  y += 8;

  // Document title + invoice meta
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.setTextColor(...INK);
  doc.text('INVOICE', MARGIN, y);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(...MUTED);
  doc.text(`Invoice No.  ${bill.invoice_number}`, right, y - 4, { align: 'right' });
  doc.text(`Date  ${formatDateDMY(bill.created_at)}`, right, y + 1.5, { align: 'right' });
  y += 10;

  // Customer + payment panels
  const panelTop = y;
  const panelHeight = 30;
  const colGap = 6;
  const colWidth = (CONTENT_WIDTH - colGap) / 2;

  doc.setFillColor(...LIGHT);
  doc.setDrawColor(...RULE);
  doc.setLineWidth(0.25);
  doc.rect(MARGIN, panelTop, colWidth, panelHeight, 'FD');
  doc.rect(MARGIN + colWidth + colGap, panelTop, colWidth, panelHeight, 'FD');

  const leftX = MARGIN + 4;
  const rightX = MARGIN + colWidth + colGap + 4;
  const textMax = colWidth - 8;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(...MUTED);
  doc.text('BILLED TO', leftX, panelTop + 6);
  doc.text('PAYMENT', rightX, panelTop + 6);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(...INK);
  wrapText(doc, customerName, leftX, panelTop + 12, textMax, 4);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(...MUTED);
  doc.text(`Phone: ${customerPhone}`, leftX, panelTop + 18);
  wrapText(doc, `Staff: ${staffName}`, leftX, panelTop + 23.5, textMax, 3.6);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(...INK);
  doc.text(`Mode: ${bill.payment_method || '-'}`, rightX, panelTop + 12);
  doc.text(`Status: ${paymentStatusLabel(bill.payment_status)}`, rightX, panelTop + 18);
  const notes = detail.customer?.notes || '-';
  wrapText(doc, `Notes: ${notes}`, rightX, panelTop + 23.5, textMax, 3.6);

  y = panelTop + panelHeight + 8;

  const rowSource =
    detail.services || detail.products
      ? [
          ...(detail.services || []).map((s) => ({
            ...s,
            type: 'Service',
            staff_name: s.staff_name,
          })),
          ...(detail.products || []).map((p) => ({
            ...p,
            type: 'Product',
            staff_name: p.staff_name,
          })),
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
          staff_name: item.staff_name,
        }));

  const showStaff = hasStaffColumn(rowSource);

  autoTable(doc, {
    startY: y,
    margin: { left: MARGIN, right: MARGIN },
    head: [
      showStaff
        ? ['Type', 'Service', 'Staff', 'Qty', 'Rate', 'Discount', 'Tax', 'Amount']
        : ['Type', 'Service', 'Qty', 'Rate', 'Discount', 'Tax', 'Amount'],
    ],
    body: rowSource.map((item) => [
      item.type,
      item.name,
      ...(showStaff ? [item.staff_name || '-'] : []),
      String(item.quantity),
      formatCurrencyPdf(item.unit_price),
      formatCurrencyPdf(item.discount),
      formatCurrencyPdf(item.tax_amount),
      formatCurrencyPdf(item.line_total),
    ]),
    theme: 'grid',
    headStyles: {
      fillColor: ACCENT,
      textColor: WHITE,
      fontStyle: 'bold',
      fontSize: 8,
      cellPadding: { top: 3.2, bottom: 3.2, left: 2, right: 2 },
      valign: 'middle',
    },
    bodyStyles: {
      fontSize: 8,
      textColor: INK,
      cellPadding: { top: 3.2, bottom: 3.2, left: 2, right: 2 },
      lineColor: RULE,
      lineWidth: 0.2,
      overflow: 'linebreak',
      valign: 'middle',
      minCellHeight: 8,
    },
    alternateRowStyles: { fillColor: LIGHT },
    styles: {
      font: 'helvetica',
      fontSize: 8,
      lineColor: RULE,
      lineWidth: 0.2,
      valign: 'middle',
    },
    columnStyles: showStaff
      ? {
          0: { cellWidth: 16 },
          1: { cellWidth: 38 },
          2: { cellWidth: 26 },
          3: { cellWidth: 10, halign: 'center' },
          4: { cellWidth: 22, halign: 'right' },
          5: { cellWidth: 22, halign: 'right' },
          6: { cellWidth: 20, halign: 'right' },
          7: { cellWidth: 24, halign: 'right', fontStyle: 'bold' },
        }
      : {
          0: { cellWidth: 18 },
          1: { cellWidth: 48 },
          2: { cellWidth: 12, halign: 'center' },
          3: { cellWidth: 26, halign: 'right' },
          4: { cellWidth: 24, halign: 'right' },
          5: { cellWidth: 22, halign: 'right' },
          6: { cellWidth: 28, halign: 'right', fontStyle: 'bold' },
        },
  });

  y = (autoTableDoc.lastAutoTable?.finalY || y) + 8;

  const taxRows =
    detail.tax_breakdown?.length
      ? detail.tax_breakdown.map((t) => [t.rate, formatCurrencyPdf(t.amount)])
      : [['Overall', formatCurrencyPdf(bill.tax_amount)]];

  const totalsStartY = y;
  const taxTableWidth = 70;
  autoTable(doc, {
    startY: y,
    tableWidth: taxTableWidth,
    margin: { left: MARGIN, right: pageWidth - MARGIN - taxTableWidth },
    head: [['Tax Rate', 'Amount']],
    body: taxRows,
    theme: 'grid',
    headStyles: {
      fillColor: LIGHT,
      textColor: INK,
      fontStyle: 'bold',
      fontSize: 8,
      lineWidth: 0.2,
      lineColor: RULE,
      valign: 'middle',
    },
    styles: {
      font: 'helvetica',
      fontSize: 8,
      cellPadding: { top: 2.8, bottom: 2.8, left: 2.5, right: 2.5 },
      textColor: INK,
      lineColor: RULE,
      lineWidth: 0.2,
      valign: 'middle',
      overflow: 'linebreak',
    },
    columnStyles: {
      0: { cellWidth: 28 },
      1: { cellWidth: 42, halign: 'right' },
    },
  });

  const sx = pageWidth / 2 + 10;
  const valueX = right;
  let summaryY = totalsStartY + 5;

  const addSummary = (label: string, value: string, emphasize = false) => {
    doc.setFont('helvetica', emphasize ? 'bold' : 'normal');
    doc.setFontSize(emphasize ? 10 : 9);
    doc.setTextColor(...(emphasize ? INK : MUTED));
    doc.text(label, sx, summaryY);
    doc.setFont('helvetica', emphasize ? 'bold' : 'normal');
    doc.setTextColor(...INK);
    doc.text(value, valueX, summaryY, { align: 'right' });
    summaryY += emphasize ? 6.8 : 5.8;
  };

  addSummary('Subtotal', formatCurrencyPdf(bill.subtotal));
  addSummary('Discount', formatCurrencyPdf(bill.discount_amount));
  addSummary('Tax', formatCurrencyPdf(bill.tax_amount));

  doc.setDrawColor(...RULE);
  doc.setLineWidth(0.3);
  doc.line(sx, summaryY - 2.2, valueX, summaryY - 2.2);
  summaryY += 2.5;
  addSummary('Grand Total', formatCurrencyPdf(bill.total_amount), true);
  addSummary('Amount Paid', formatCurrencyPdf(bill.paid_amount));
  addSummary('Remaining', formatCurrencyPdf(bill.remaining_amount));

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(...MUTED);
  doc.text(`Payment Method: ${bill.payment_method || '-'}`, sx, summaryY + 2);
  summaryY += 8;

  // Payment installments / history — placed below totals, PDF-safe text only
  const toPdfSafe = (value?: string | null): string =>
    String(value || '-')
      .replace(/₹/g, 'Rs. ')
      .replace(/\u20b9/g, 'Rs. ');

  const historySource =
    detail.payment_history && detail.payment_history.length > 0
      ? detail.payment_history
      : (detail.payments || []).map((p, idx) => ({
          installment_number: p.installment_number || idx + 1,
          amount: p.amount,
          method: p.method,
          status_after: p.status_after || bill.payment_status,
          paid_amount_after: p.paid_amount_after ?? p.amount,
          remaining_amount_after: p.remaining_amount_after ?? bill.remaining_amount,
          note: p.note || `Payment ${idx + 1}`,
          payment_date: p.payment_date,
        }));

  // Skip empty pending markers with no money movement when real payments exist
  const historyRows = historySource.filter((entry, _idx, all) => {
    const amount = Number(entry.amount || 0);
    if (amount > 0) return true;
    return all.every((row) => Number(row.amount || 0) <= 0);
  });

  const taxFinalY = autoTableDoc.lastAutoTable?.finalY || totalsStartY;
  let flowY = Math.max(summaryY, taxFinalY) + 8;

  if (historyRows.length > 0) {
    const ensureSpace = (needed: number) => {
      if (flowY + needed > pageHeight - 22) {
        doc.addPage();
        flowY = MARGIN;
      }
    };

    ensureSpace(28);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(...INK);
    doc.text('Payment Installments', MARGIN, flowY);
    flowY += 3;

    autoTable(doc, {
      startY: flowY,
      margin: { left: MARGIN, right: MARGIN, bottom: 22 },
      head: [['#', 'Date', 'Paid', 'Method', 'Remaining', 'Details']],
      body: historyRows.map((entry) => [
        String(entry.installment_number ?? ''),
        entry.payment_date ? formatDateDMY(entry.payment_date) : '-',
        formatCurrencyPdf(entry.amount),
        toPdfSafe(entry.method || bill.payment_method || '-'),
        formatCurrencyPdf(entry.remaining_amount_after ?? 0),
        toPdfSafe(entry.note || '-'),
      ]),
      theme: 'grid',
      headStyles: {
        fillColor: LIGHT,
        textColor: INK,
        fontStyle: 'bold',
        fontSize: 8,
        lineWidth: 0.2,
        lineColor: RULE,
        valign: 'middle',
      },
      bodyStyles: {
        font: 'helvetica',
        fontSize: 7.5,
        textColor: INK,
        cellPadding: { top: 2.2, bottom: 2.2, left: 1.6, right: 1.6 },
        lineColor: RULE,
        lineWidth: 0.2,
        valign: 'top',
        overflow: 'linebreak',
      },
      styles: {
        font: 'helvetica',
        overflow: 'linebreak',
        cellWidth: 'wrap',
      },
      columnStyles: {
        0: { cellWidth: 10, halign: 'center' },
        1: { cellWidth: 26 },
        2: { cellWidth: 28, halign: 'right' },
        3: { cellWidth: 22 },
        4: { cellWidth: 28, halign: 'right' },
        5: { cellWidth: 'auto' },
      },
    });

    flowY = (autoTableDoc.lastAutoTable?.finalY || flowY) + 6;
  }

  // Footer on the last content page, clear of installment table
  if (flowY > pageHeight - 20) {
    doc.addPage();
    flowY = MARGIN;
  }
  const footerY = pageHeight - 16;
  doc.setDrawColor(...RULE);
  doc.setLineWidth(0.3);
  doc.line(MARGIN, footerY - 4, right, footerY - 4);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(...MUTED);
  doc.text('Thank you for your business.', pageWidth / 2, footerY, { align: 'center' });
  doc.text('This is a computer-generated invoice.', pageWidth / 2, footerY + 4.5, {
    align: 'center',
  });

  const safeInvoice = toSafeFilePart(bill.invoice_number, 'Invoice');
  const safeCustomer = toSafeFilePart(customerName, 'Customer');
  doc.save(`${safeInvoice}_${safeCustomer}.pdf`);
}
