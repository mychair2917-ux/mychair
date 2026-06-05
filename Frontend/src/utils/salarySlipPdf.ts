import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

import { SalarySlip } from '../redux/slices/payroll/Types';
import { formatCurrency } from './currency';
import { formatDateDMY } from './utilities';

const GOLD = [184, 134, 11] as [number, number, number];
const DARK = [26, 26, 26] as [number, number, number];
const GRAY = [100, 100, 100] as [number, number, number];
const LIGHT = [246, 246, 246] as [number, number, number];
const WHITE = [255, 255, 255] as [number, number, number];

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
  const autoTableDoc = doc as jsPDF & { lastAutoTable?: { finalY?: number } };

  // Header band
  doc.setFillColor(...DARK);
  doc.rect(0, 0, pw, 32, 'F');
  doc.setDrawColor(...GOLD);
  doc.setLineWidth(1.1);
  doc.line(0, 32, pw, 32);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.setTextColor(...WHITE);
  doc.text(slip.salon_name || 'Salon', 14, 13);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(220, 220, 220);
  doc.text('Salary Settlement Statement', 14, 19);
  doc.text(`Generated: ${formatDateDMY(slip.generated_at)}`, 14, 24);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(15);
  doc.setTextColor(...WHITE);
  doc.text('SALARY SLIP', pw - 14, 13, { align: 'right' });

  const period = `${MONTH_LABELS[slip.month - 1] ?? slip.month} ${slip.year}`;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.text(period, pw - 14, 19, { align: 'right' });
  doc.text(`Status: ${slip.payment_status}`, pw - 14, 24, { align: 'right' });

  // Employee details card
  let y = 40;
  doc.setFillColor(...LIGHT);
  doc.roundedRect(14, y, pw - 28, 28, 2.2, 2.2, 'F');
  doc.setTextColor(...DARK);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.text(slip.employee_name || 'Employee', 18, y + 8);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(...GRAY);
  y += 14;
  if (slip.employee_role) {
    doc.text(`Role: ${slip.employee_role}`, 18, y);
    y += 5;
  }
  doc.text(`Salary Type: ${slip.salary_type}`, 18, y);
  y += 5;
  doc.text(`Payment Status: ${slip.payment_status}`, 18, y);
  if (slip.payment_date) {
    y += 5;
    doc.text(`Paid On: ${formatDateDMY(slip.payment_date)}`, 18, y);
  }

  // Salary composition table
  autoTable(doc, {
    startY: y + 10,
    head: [['Components', 'Amount']],
    body: [
      ['Base Salary', formatCurrency(slip.base_salary)],
      [
        `Service Incentive (${slip.service_incentive_percent}% of ${formatCurrency(
          slip.service_sales_total
        )})`,
        formatCurrency(slip.service_incentive),
      ],
      [
        `Product Incentive (${slip.product_incentive_percent}% of ${formatCurrency(
          slip.product_sales_total
        )})`,
        formatCurrency(slip.product_incentive),
      ],
    ],
    foot: [['Final Salary', formatCurrency(slip.final_salary)]],
    theme: 'striped',
    headStyles: { fillColor: DARK, textColor: WHITE, fontStyle: 'bold', fontSize: 9 },
    footStyles: { fillColor: GOLD, textColor: WHITE, fontStyle: 'bold', fontSize: 10 },
    columnStyles: { 1: { halign: 'right' } },
    styles: { fontSize: 9, cellPadding: 3 },
    margin: { left: 14, right: 14 },
  });

  const summaryY = (autoTableDoc.lastAutoTable?.finalY ?? y + 45) + 8;
  doc.setDrawColor(...DARK);
  doc.line(14, summaryY, pw - 14, summaryY);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(...GRAY);
  doc.text('Employer Signature: ____________________', 14, summaryY + 8);
  doc.text('Employee Signature: ____________________', pw - 86, summaryY + 8);
  doc.text('This is a system-generated salary slip for payroll records.', 14, ph - 10);

  const safeName = (slip.employee_name || 'employee').replace(/\s+/g, '-').toLowerCase();
  doc.save(`salary-slip-${safeName}-${slip.month}-${slip.year}.pdf`);
}
