import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

import { SalarySlip } from '../redux/slices/payroll/Types';
import { formatDateDMY } from './utilities';
import { resolveMediaUrl } from './media';
import { formatCurrencyPdf, stringifyAddress, wrapText } from './pdfHelpers';

const INK = [28, 28, 28] as [number, number, number];
const MUTED = [100, 100, 100] as [number, number, number];
const RULE = [210, 210, 210] as [number, number, number];
const LIGHT = [248, 248, 248] as [number, number, number];
const WHITE = [255, 255, 255] as [number, number, number];
const ACCENT = [45, 45, 45] as [number, number, number];

const MARGIN = 16;
const CONTENT_WIDTH = 210 - MARGIN * 2;

const MONTH_LABELS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

export function downloadSalarySlipPDF(slip: SalarySlip): void {
  const doc = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' });
  const pw = doc.internal.pageSize.getWidth();
  const ph = doc.internal.pageSize.getHeight();
  const right = pw - MARGIN;
  const autoTableDoc = doc as jsPDF & { lastAutoTable?: { finalY?: number } };

  const salonName = (slip.salon_name || 'Salon').trim();
  const salonPhone = (slip.salon_phone || '').trim();
  const salonEmail = (slip.salon_email || '').trim();
  const salonAddress = stringifyAddress(slip.salon_address);
  const salonLogo = resolveMediaUrl(slip.salon_logo_url);
  const period = `${MONTH_LABELS[slip.month - 1] ?? slip.month} ${slip.year}`;

  let y = MARGIN;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.setTextColor(...INK);
  y = wrapText(doc, salonName, MARGIN, y + 4, CONTENT_WIDTH - (salonLogo ? 28 : 0), 6.5);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(...MUTED);
  if (salonAddress) {
    y = wrapText(doc, salonAddress, MARGIN, y + 1, CONTENT_WIDTH - (salonLogo ? 28 : 0), 3.8);
  }
  const contactParts = [
    salonPhone ? `Phone: ${salonPhone}` : '',
    salonEmail ? `Email: ${salonEmail}` : '',
  ].filter(Boolean);
  if (contactParts.length) {
    y = wrapText(doc, contactParts.join('   |   '), MARGIN, y + 1.5, CONTENT_WIDTH, 3.8);
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
  y += 9;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.setTextColor(...INK);
  doc.text('SALARY SLIP', MARGIN, y);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(...MUTED);
  doc.text(`Salary Month  ${period}`, right, y - 4, { align: 'right' });
  doc.text(`Status  ${slip.payment_status}`, right, y + 1.5, { align: 'right' });
  if (slip.generated_at) {
    doc.text(`Generated  ${formatDateDMY(slip.generated_at)}`, right, y + 7, {
      align: 'right',
    });
  }
  y += 12;

  const leftMeta: string[] = [];
  const employeeIdLabel = slip.employee_code || slip.employee_id;
  if (employeeIdLabel) leftMeta.push(`Employee ID: ${employeeIdLabel}`);
  if (slip.employee_role) leftMeta.push(`Designation: ${slip.employee_role}`);
  if (slip.employee_phone) leftMeta.push(`Phone: ${slip.employee_phone}`);

  const rightMeta: string[] = [`Salary Type: ${slip.salary_type}`];
  if (slip.payment_date) rightMeta.push(`Paid On: ${formatDateDMY(slip.payment_date)}`);

  const metaLines = Math.max(leftMeta.length, rightMeta.length, 1);
  const panelHeight = 18 + metaLines * 4.5;

  doc.setFillColor(...LIGHT);
  doc.setDrawColor(...RULE);
  doc.setLineWidth(0.25);
  doc.rect(MARGIN, y, CONTENT_WIDTH, panelHeight, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(...MUTED);
  doc.text('EMPLOYEE DETAILS', MARGIN + 4, y + 6);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(...INK);
  doc.text(slip.employee_name || 'Employee', MARGIN + 4, y + 13);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(...MUTED);

  const metaY = y + 19;
  leftMeta.forEach((line, idx) => {
    doc.text(line, MARGIN + 4, metaY + idx * 4.5);
  });
  rightMeta.forEach((line, idx) => {
    doc.text(line, MARGIN + CONTENT_WIDTH / 2 + 2, metaY + idx * 4.5);
  });

  y += panelHeight + 10;

  autoTable(doc, {
    startY: y,
    head: [['Earnings / Components', 'Amount']],
    body: [
      ['Base Salary', formatCurrencyPdf(slip.base_salary)],
      [
        `Service Incentive (${slip.service_incentive_percent}% of ${formatCurrencyPdf(
          slip.service_sales_total
        )})`,
        formatCurrencyPdf(slip.service_incentive),
      ],
      [
        `Product Incentive (${slip.product_incentive_percent}% of ${formatCurrencyPdf(
          slip.product_sales_total
        )})`,
        formatCurrencyPdf(slip.product_incentive),
      ],
    ],
    foot: [['Final Salary', formatCurrencyPdf(slip.final_salary)]],
    theme: 'grid',
    margin: { left: MARGIN, right: MARGIN },
    headStyles: {
      fillColor: ACCENT,
      textColor: WHITE,
      fontStyle: 'bold',
      fontSize: 9,
      cellPadding: { top: 3.4, bottom: 3.4, left: 3, right: 3 },
      valign: 'middle',
    },
    bodyStyles: {
      fontSize: 9,
      textColor: INK,
      cellPadding: { top: 3.4, bottom: 3.4, left: 3, right: 3 },
      lineColor: RULE,
      lineWidth: 0.2,
      overflow: 'linebreak',
      valign: 'middle',
      minCellHeight: 8,
    },
    alternateRowStyles: { fillColor: LIGHT },
    footStyles: {
      fillColor: LIGHT,
      textColor: INK,
      fontStyle: 'bold',
      fontSize: 10,
      cellPadding: { top: 3.6, bottom: 3.6, left: 3, right: 3 },
      lineColor: RULE,
      lineWidth: 0.3,
      valign: 'middle',
    },
    styles: {
      font: 'helvetica',
      fontSize: 9,
      valign: 'middle',
    },
    columnStyles: {
      0: { cellWidth: CONTENT_WIDTH * 0.65 },
      1: { cellWidth: CONTENT_WIDTH * 0.35, halign: 'right' },
    },
  });

  const summaryY = (autoTableDoc.lastAutoTable?.finalY ?? y + 45) + 10;
  const boxPadX = 5;
  const netAmount = formatCurrencyPdf(slip.final_salary);

  doc.setDrawColor(...INK);
  doc.setLineWidth(0.4);
  doc.rect(MARGIN, summaryY, CONTENT_WIDTH, 12);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(...INK);
  doc.text('Net Payable', MARGIN + boxPadX, summaryY + 7.8);
  doc.text(netAmount, right - boxPadX, summaryY + 7.8, { align: 'right' });

  const sigY = summaryY + 28;
  doc.setDrawColor(...RULE);
  doc.setLineWidth(0.3);
  doc.line(MARGIN, sigY, MARGIN + 60, sigY);
  doc.line(right - 60, sigY, right, sigY);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(...MUTED);
  doc.text('Employer Signature', MARGIN, sigY + 5);
  doc.text('Employee Signature', right - 60, sigY + 5);

  doc.setDrawColor(...RULE);
  doc.setLineWidth(0.3);
  doc.line(MARGIN, ph - 16, right, ph - 16);
  doc.setFontSize(8);
  doc.text('This is a system-generated salary slip for payroll records.', pw / 2, ph - 10, {
    align: 'center',
  });

  const safeName = (slip.employee_name || 'employee').replace(/\s+/g, '-').toLowerCase();
  doc.save(`salary-slip-${safeName}-${slip.month}-${slip.year}.pdf`);
}
