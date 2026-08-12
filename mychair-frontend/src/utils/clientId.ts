/**
 * Client ID Generation Utility.
 * Format: CL-XXXXXX (6 alphanumeric characters)
 */

export const generateLocalClientId = (): string => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = '';
  for (let i = 0; i < 6; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return `CL-${result}`;
};

export const isClientReferenceId = (val: string | null | undefined): boolean => {
  if (!val) return false;
  return /^CL-[A-Z0-9]{6}$/i.test(val.trim());
};
