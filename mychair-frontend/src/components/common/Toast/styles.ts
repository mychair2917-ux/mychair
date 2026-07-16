import { TOAST_TYPES } from '../../../constants';
import { IconColor, IconSize } from '../SvgIcon/Types';
import { TypographyColor } from '../Typography/Types';

export const toastTypeStyles: Record<string, string> = {
  [TOAST_TYPES.DEFAULT]: 'border border-[var(--color-border-strong)] bg-white text-[var(--color-text-primary)]',
  [TOAST_TYPES.SUCCESS]:
    'border border-[var(--color-brand-gold-dark)] bg-[var(--color-brand-gold)] text-white shadow-card',
  'outlined-success': 'border border-green-500 bg-green-50 text-green-800',
  [TOAST_TYPES.ERROR]: 'border border-red-600 bg-red-600 text-white shadow-card',
  'outlined-error': 'border border-red-500 bg-red-50 text-red-700',
  [TOAST_TYPES.WARNING]: 'border border-amber-500 bg-amber-500 text-white shadow-card',
  'outlined-warning': 'border border-amber-400 bg-amber-50 text-amber-800',
  'outlined-notice': 'border border-orange-500 bg-orange-50 text-orange-700',
  [TOAST_TYPES.INFO]: 'border border-blue-600 bg-blue-600 text-white shadow-card',
  'outlined-info': 'border border-blue-500 bg-blue-50 text-blue-800',
  notification: 'bg-[linear-gradient(29deg,#3131F5_0.03%,#0D8BFD_57.66%)] text-white',
  'notification-success': 'bg-[linear-gradient(29deg,#3131F5_0.03%,#0D8BFD_57.66%)] text-white',
  'notification-error': 'border border-red-500 bg-red-100 text-red-700',
};

export const buttonColorMapping: Record<string, string> = {
  'outlined-success': 'text-green-600',
  'outlined-error': 'text-red-600',
  'outlined-info': 'text-blue-600',
  'outlined-warning': 'text-amber-600',
  'outlined-notice': 'text-orange-600',
  [TOAST_TYPES.DEFAULT]: 'text-[var(--color-text-secondary)]',
  'notification-error': 'text-red-500',
  [TOAST_TYPES.SUCCESS]: 'text-white/90',
  [TOAST_TYPES.ERROR]: 'text-white/90',
  [TOAST_TYPES.WARNING]: 'text-white/90',
  [TOAST_TYPES.INFO]: 'text-white/90',
};

export const outlinedTypes = new Set<string>([
  'outlined-success',
  'outlined-error',
  'outlined-info',
  'outlined-warning',
  'outlined-notice',
  TOAST_TYPES.DEFAULT,
]);

export const NotificationOutlinedTypes = new Set<string>([
  'notification',
  'notification-error',
  'notification-success',
]);

export const borderColorMapping: Record<string, string> = {
  'outlined-success': 'border-green-500',
  'notification-error': 'border-red-500',
  'outlined-info': 'border-blue-500',
  'outlined-warning': 'border-amber-400',
  'outlined-notice': 'border-orange-500',
  [TOAST_TYPES.DEFAULT]: 'border-[var(--color-border-strong)]',
};

export const actionLabelColorMapping: Record<string, string> = {
  'outlined-success': 'text-green-700',
  'notification-error': 'text-red-600',
  'outlined-info': 'text-blue-700',
  'outlined-warning': 'text-amber-700',
  'outlined-notice': 'text-orange-700',
  [TOAST_TYPES.DEFAULT]: 'text-[var(--color-text-primary)]',
  [TOAST_TYPES.SUCCESS]: 'text-white',
  [TOAST_TYPES.ERROR]: 'text-white',
  'outlined-error': 'text-red-600',
  [TOAST_TYPES.WARNING]: 'text-white',
  [TOAST_TYPES.INFO]: 'text-white',
  notification: 'text-white',
  'notification-success': 'text-white',
};

export const customIconStyleMapping: Record<string, { color: IconColor; size: IconSize }> = {
  [TOAST_TYPES.SUCCESS]: { color: 'white', size: 'lg' },
  'outlined-success': { color: 'green', size: 'lg' },
  [TOAST_TYPES.ERROR]: { color: 'white', size: 'lg' },
  'outlined-error': { color: 'red', size: 'lg' },
  [TOAST_TYPES.WARNING]: { color: 'white', size: 'lg' },
  'outlined-warning': { color: 'yellow', size: 'lg' },
  'outlined-notice': { color: 'orange', size: 'lg' },
  [TOAST_TYPES.INFO]: { color: 'white', size: 'lg' },
  'outlined-info': { color: 'blue', size: 'lg' },
  [TOAST_TYPES.DEFAULT]: { color: 'gray', size: 'md' },
  notification: { color: 'white', size: 'md' },
  'notification-success': { color: 'white', size: 'md' },
  'notification-error': { color: 'red', size: 'md' },
};

export const nonDismissableColorMapping: Record<string, TypographyColor> = {
  'outlined-warning': 'yellow',
  'outlined-error': 'red',
  'outlined-info': 'blue',
  'outlined-notice': 'orange-500',
  [TOAST_TYPES.DEFAULT]: 'gray',
  'notification-error': 'red',
};
