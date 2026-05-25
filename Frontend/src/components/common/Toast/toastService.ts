import { TOAST_TYPES } from '../../../constants';
import { ToastOptions, ToastType } from './Types';

type ToastHandler = (options: ToastOptions) => void;

export type SimpleToastType = 'success' | 'error' | 'warning' | 'info';

const SIMPLE_TOAST_TYPE_MAP: Record<SimpleToastType, ToastType> = {
  success: TOAST_TYPES.SUCCESS,
  error: TOAST_TYPES.ERROR,
  warning: TOAST_TYPES.WARNING,
  info: TOAST_TYPES.INFO,
};

const DEFAULT_DURATION = 5000;
const DEDUPE_WINDOW_MS = 3000;

let toastQueue: ToastOptions[] = [];
let toastHandler: ToastHandler | null = null;
let isHandlerInitialized = false;
const recentToasts = new Map<string, number>();

const buildDedupeKey = (type: ToastType, message: string) => `${type}::${message.trim()}`;

const isDuplicateToast = (type: ToastType, message: string): boolean => {
  const key = buildDedupeKey(type, message);
  const lastShownAt = recentToasts.get(key);
  const now = Date.now();

  if (lastShownAt && now - lastShownAt < DEDUPE_WINDOW_MS) {
    return true;
  }

  recentToasts.set(key, now);
  return false;
};

export const setToastHandler = (handler: ToastHandler | null) => {
  toastHandler = handler;

  if (handler) {
    isHandlerInitialized = true;

    if (toastQueue.length > 0) {
      toastQueue.forEach((options) => {
        handler(options);
      });
      toastQueue = [];
    }
  }
};

const dispatchToast = (
  message: string,
  type: ToastType,
  options?: Partial<Omit<ToastOptions, 'message' | 'type'>>
) => {
  const trimmedMessage = message.trim();
  if (!trimmedMessage || isDuplicateToast(type, trimmedMessage)) {
    return;
  }

  const toastOptions: ToastOptions = {
    message: trimmedMessage,
    type,
    duration: options?.duration ?? DEFAULT_DURATION,
    ...options,
  };

  if (toastHandler && isHandlerInitialized) {
    toastHandler(toastOptions);
  } else {
    toastQueue.push(toastOptions);
  }
};

const createToast = (
  message: string,
  type: ToastType,
  options?: Partial<Omit<ToastOptions, 'message' | 'type'>>
) => {
  dispatchToast(message, type, options);
};

/**
 * Simple reusable API: showToast('success', 'Invitation sent!')
 */
export const showToast = (
  type: SimpleToastType,
  message: string,
  options?: Partial<Omit<ToastOptions, 'message' | 'type'>>
) => {
  const mappedType = SIMPLE_TOAST_TYPE_MAP[type] ?? TOAST_TYPES.DEFAULT;
  createToast(message, mappedType, options);
};

export const toast = {
  show: (message: string, options?: Partial<Omit<ToastOptions, 'message' | 'type'>>) =>
    createToast(message, 'default', options),

  success: (message: string, options?: Partial<Omit<ToastOptions, 'message' | 'type'>>) =>
    createToast(message, TOAST_TYPES.SUCCESS, options),

  OUTLINED_SUCCESS: (message: string, options?: Partial<Omit<ToastOptions, 'message' | 'type'>>) =>
    createToast(message, 'outlined-success', options),

  error: (message: string, options?: Partial<Omit<ToastOptions, 'message' | 'type'>>) =>
    createToast(message, TOAST_TYPES.ERROR, options),

  OUTLINED_ERROR: (message: string, options?: Partial<Omit<ToastOptions, 'message' | 'type'>>) =>
    createToast(message, 'outlined-error', options),

  warning: (message: string, options?: Partial<Omit<ToastOptions, 'message' | 'type'>>) =>
    createToast(message, TOAST_TYPES.WARNING, options),

  OUTLINED_WARNING: (message: string, options?: Partial<Omit<ToastOptions, 'message' | 'type'>>) =>
    createToast(message, 'outlined-warning', options),

  OUTLINED_NOTICE: (message: string, options?: Partial<Omit<ToastOptions, 'message' | 'type'>>) =>
    createToast(message, 'outlined-notice', options),

  info: (message: string, options?: Partial<Omit<ToastOptions, 'message' | 'type'>>) =>
    createToast(message, TOAST_TYPES.INFO, options),

  OUTLINED_INFO: (message: string, options?: Partial<Omit<ToastOptions, 'message' | 'type'>>) =>
    createToast(message, 'outlined-info', options),
};

if (typeof window !== 'undefined') {
  window.showToast = showToast;
}
