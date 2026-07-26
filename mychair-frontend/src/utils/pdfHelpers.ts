import jsPDF from 'jspdf';

/** PDF-safe INR formatting — Helvetica cannot render the ₹ glyph. */
export function formatCurrencyPdf(
  value?: number | string | null,
  options?: { minimumFractionDigits?: number; maximumFractionDigits?: number }
): string {
  if (value === null || value === undefined || value === '') {
    return 'Rs. 0.00';
  }

  const numericValue = typeof value === 'string' ? Number(value) : value;
  if (!Number.isFinite(numericValue)) {
    return 'Rs. 0.00';
  }

  const minimumFractionDigits = options?.minimumFractionDigits ?? 2;
  const maximumFractionDigits = options?.maximumFractionDigits ?? 2;

  const formatted = new Intl.NumberFormat('en-IN', {
    minimumFractionDigits,
    maximumFractionDigits,
  }).format(numericValue);

  return `Rs. ${formatted}`;
}

export const stringifyAddress = (
  address?: string | null | Record<string, unknown>
): string => {
  if (!address) return '';
  if (typeof address === 'string') return address.trim();
  return Object.values(address)
    .filter((v) => typeof v === 'string' && v.trim().length > 0)
    .join(', ');
};

export const wrapText = (
  doc: jsPDF,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  lineHeight = 4.2
): number => {
  const lines = doc.splitTextToSize(text, maxWidth) as string[];
  doc.text(lines, x, y);
  return y + lines.length * lineHeight;
};
