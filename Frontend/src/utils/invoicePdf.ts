import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { BillListItem } from '../redux/slices/billing/Types';

const GOLD = [184, 134, 11] as [number, number, number];
const DARK = [26, 26, 26] as [number, number, number];
const GRAY = [100, 100, 100] as [number, number, number];
const LIGHT_GRAY = [245, 245, 245] as [number, number, number];
const WHITE = [255, 255, 255] as [number, number, number];
const GREEN = [16, 140, 80] as [number, number, number];
const AMBER = [180, 100, 0] as [number, number, number];
const VIOLET = [100, 60, 180] as [number, number, number];

function formatCurrency(amount: number): string {
  return `Rs. ${amount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatDate(isoString?: string | null): string {
  if (!isoString) return '-';
  return new Date(isoString).toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

function paymentStatusColor(status: string): [number, number, number] {
  if (status === 'PAID') return GREEN;
  if (status === 'PARTIALLY_PAID') return VIOLET;
  return AMBER;
}

function paymentStatusLabel(status: string): string {
  if (status === 'PAID') return 'Paid';
  if (status === 'PARTIALLY_PAID') return 'Partially Paid';
  return 'Pending';
}

export function downloadInvoicePDF(bill: BillListItem): void {
  const doc = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' });
  const pw = doc.internal.pageSize.getWidth();

  // ── Gold header bar ──────────────────────────────────────────────
  doc.setFillColor(...GOLD);
  doc.rect(0, 0, pw, 38, 'F');

  // Salon name
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(20);
  doc.setTextColor(...WHITE);
  doc.text(bill.salon_name || 'Salon', 14, 16);

  // Salon tagline
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(255, 240, 180);
  doc.text('Premium Beauty & Wellness', 14, 22);

  // Salon contact (right side)
  doc.setFontSize(8);
  doc.setTextColor(...WHITE);
  if (bill.salon_phone) {
    doc.text(`Tel: ${bill.salon_phone}`, pw - 14, 14, { align: 'right' });
  }
  if (bill.salon_address) {
    const maxWidth = 65;
    const addrLines = doc.splitTextToSize(bill.salon_address, maxWidth) as string[];
    addrLines.slice(0, 2).forEach((line, i) => {
      doc.text(line, pw - 14, 20 + i * 5, { align: 'right' });
    });
  }

  // ── INVOICE label ────────────────────────────────────────────────
  doc.setFillColor(...DARK);
  doc.rect(0, 38, pw, 12, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.setTextColor(...WHITE);
  doc.setLetterSpacing(3);
  doc.text('INVOICE', pw / 2, 46.5, { align: 'center' });
  doc.setLetterSpacing(0);

  // ── Invoice meta + customer info ─────────────────────────────────
  let y = 60;
  doc.setFillColor(...LIGHT_GRAY);
  doc.roundedRect(10, y - 4, pw - 20, 28, 3, 3, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(...DARK);
  doc.text('INVOICE NUMBER', 16, y + 2);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(...GOLD);
  doc.text(bill.invoice_number, 16, y + 8);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(...DARK);
  doc.text('DATE', 16, y + 16);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(...GRAY);
  doc.text(formatDate(bill.created_at), 16, y + 22);

  // Customer block (right)
  const cx = pw / 2 + 4;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(...DARK);
  doc.text('BILLED TO', cx, y + 2);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.text(bill.customer_name || 'Customer', cx, y + 9);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(...GRAY);
  if (bill.customer_phone) {
    doc.text(`Phone: ${bill.customer_phone}`, cx, y + 15);
  }

  // ── Items table ───────────────────────────────────────────────────
  y += 36;

  const tableRows = bill.items.map((item) => {
    const lineTotal = item.unit_price * item.quantity - item.discount;
    return [
      item.name,
      item.item_type === 'SERVICE' ? 'Service' : 'Product',
      String(item.quantity),
      formatCurrency(item.unit_price),
      item.staff_name || '-',
      formatCurrency(lineTotal),
    ];
  });

  autoTable(doc, {
    startY: y,
    head: [['Item', 'Type', 'Qty', 'Price', 'Staff', 'Total']],
    body: tableRows,
    theme: 'plain',
    styles: {
      fontSize: 9,
      cellPadding: { top: 3.5, bottom: 3.5, left: 4, right: 4 },
      textColor: DARK,
      lineColor: [220, 220, 220],
      lineWidth: 0.3,
    },
    headStyles: {
      fillColor: DARK,
      textColor: WHITE,
      fontStyle: 'bold',
      fontSize: 8.5,
    },
    alternateRowStyles: { fillColor: [251, 251, 251] },
    columnStyles: {
      0: { cellWidth: 55 },
      1: { cellWidth: 22 },
      2: { cellWidth: 14, halign: 'center' },
      3: { cellWidth: 28, halign: 'right' },
      4: { cellWidth: 30 },
      5: { cellWidth: 28, halign: 'right', fontStyle: 'bold' },
    },
    margin: { left: 10, right: 10 },
  });

  // ── Summary block ─────────────────────────────────────────────────
  const afterTable = (doc as any).lastAutoTable?.finalY ?? y + 30;
  let sy = afterTable + 8;

  // Divider
  doc.setDrawColor(...GOLD);
  doc.setLineWidth(0.5);
  doc.line(10, sy, pw - 10, sy);
  sy += 6;

  const summaryX = pw - 75;
  const labelX = summaryX;
  const valX = pw - 12;

  const addSummaryRow = (label: string, value: string, bold = false, color = DARK) => {
    doc.setFont('helvetica', bold ? 'bold' : 'normal');
    doc.setFontSize(9);
    doc.setTextColor(...GRAY);
    doc.text(label, labelX, sy);
    doc.setTextColor(...color);
    doc.text(value, valX, sy, { align: 'right' });
    sy += 6;
  };

  addSummaryRow('Subtotal', formatCurrency(bill.subtotal));
  if (bill.discount_amount > 0) {
    addSummaryRow('Discount', `- ${formatCurrency(bill.discount_amount)}`);
  }
  if (bill.tax_amount > 0) {
    addSummaryRow('Tax', formatCurrency(bill.tax_amount));
  }

  // Grand total box
  sy += 1;
  doc.setFillColor(...DARK);
  doc.roundedRect(summaryX - 4, sy - 5, pw - summaryX + 4 - 8, 10, 2, 2, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(...WHITE);
  doc.text('GRAND TOTAL', summaryX, sy + 2);
  doc.text(formatCurrency(bill.total_amount), valX, sy + 2, { align: 'right' });
  sy += 14;

  // Paid / Remaining rows
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(...GREEN);
  doc.text('Amount Paid', labelX, sy);
  doc.text(formatCurrency(bill.paid_amount), valX, sy, { align: 'right' });
  sy += 6;

  if (bill.remaining_amount > 0) {
    doc.setTextColor(...AMBER);
    doc.text('Remaining Balance', labelX, sy);
    doc.text(formatCurrency(bill.remaining_amount), valX, sy, { align: 'right' });
    sy += 6;
  }

  // ── Payment info pill ─────────────────────────────────────────────
  sy += 4;
  const statusColor = paymentStatusColor(bill.payment_status);
  doc.setFillColor(statusColor[0], statusColor[1], statusColor[2], 0.1);
  doc.setDrawColor(...statusColor);
  doc.setLineWidth(0.5);
  doc.roundedRect(10, sy - 4, 85, 14, 3, 3, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(...statusColor);
  doc.text(`Status: ${paymentStatusLabel(bill.payment_status)}`, 16, sy + 3);
  if (bill.payment_method) {
    doc.text(`Method: ${bill.payment_method}`, 16, sy + 9);
  }

  // ── Footer ────────────────────────────────────────────────────────
  const footerY = doc.internal.pageSize.getHeight() - 22;
  doc.setFillColor(...GOLD);
  doc.rect(0, footerY, pw, 22, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(...WHITE);
  doc.text('Thank You for Your Visit!', pw / 2, footerY + 8, { align: 'center' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(255, 240, 180);
  doc.text(
    `We look forward to seeing you again at ${bill.salon_name || 'our salon'}.`,
    pw / 2,
    footerY + 14,
    { align: 'center' }
  );
  doc.text('For queries, contact us at the number above.', pw / 2, footerY + 19, {
    align: 'center',
  });

  doc.save(`${bill.invoice_number}.pdf`);
}
