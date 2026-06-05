export const formatCurrency = (
  value?: number | string | null,
  options?: { minimumFractionDigits?: number; maximumFractionDigits?: number }
): string => {
  if (value === null || value === undefined || value === '') {
    return '₹0.00';
  }

  const numericValue = typeof value === 'string' ? Number(value) : value;
  if (!Number.isFinite(numericValue)) {
    return '₹0.00';
  }

  const minimumFractionDigits = options?.minimumFractionDigits ?? 2;
  const maximumFractionDigits = options?.maximumFractionDigits ?? 2;

  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits,
    maximumFractionDigits,
  }).format(numericValue);
};
