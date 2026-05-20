import { ToastOptions } from './Types';

type ToastHandler = (options: ToastOptions) => void;

// Queue to store toasts that were triggered before the handler was initialized
let toastQueue: ToastOptions[] = [];
let toastHandler: ToastHandler | null = null;
let isHandlerInitialized = false;

export const setToastHandler = (handler: ToastHandler | null) => {
  toastHandler = handler;

  if (handler) {
    isHandlerInitialized = true;

    // Process any queued toasts
    if (toastQueue.length > 0) {
      toastQueue.forEach((options) => {
        handler(options);
      });
      toastQueue = [];
    }
  }
};

// Basic toast function with queue support
const createToast = (
  message: string,
  type: ToastOptions['type'],
  options?: Partial<Omit<ToastOptions, 'message' | 'type'>>
) => {
  const toastOptions = {
    message,
    type,
    ...options,
  };

  if (toastHandler && isHandlerInitialized) {
    toastHandler(toastOptions);
  } else {
    toastQueue.push(toastOptions);
  }
};

// Toast service with multiple methods for different toast types
export const toast = {
  show: (message: string, options?: Partial<Omit<ToastOptions, 'message' | 'type'>>) =>
    createToast(message, 'default', options),

  success: (message: string, options?: Partial<Omit<ToastOptions, 'message' | 'type'>>) =>
    createToast(message, 'success', options),

  OUTLINED_SUCCESS: (message: string, options?: Partial<Omit<ToastOptions, 'message' | 'type'>>) =>
    createToast(message, 'outlined-success', options),

  error: (message: string, options?: Partial<Omit<ToastOptions, 'message' | 'type'>>) =>
    createToast(message, 'error', options),

  OUTLINED_ERROR: (message: string, options?: Partial<Omit<ToastOptions, 'message' | 'type'>>) =>
    createToast(message, 'outlined-error', options),

  warning: (message: string, options?: Partial<Omit<ToastOptions, 'message' | 'type'>>) =>
    createToast(message, 'warning', options),

  OUTLINED_WARNING: (message: string, options?: Partial<Omit<ToastOptions, 'message' | 'type'>>) =>
    createToast(message, 'outlined-warning', options),

  OUTLINED_NOTICE: (message: string, options?: Partial<Omit<ToastOptions, 'message' | 'type'>>) =>
    createToast(message, 'outlined-notice', options),

  info: (message: string, options?: Partial<Omit<ToastOptions, 'message' | 'type'>>) =>
    createToast(message, 'info', options),

  OUTLINED_INFO: (message: string, options?: Partial<Omit<ToastOptions, 'message' | 'type'>>) =>
    createToast(message, 'outlined-info', options),
};

// For backward compatibility and global window access
export const showToast = (options: ToastOptions) => {
  if (toastHandler && isHandlerInitialized) {
    toastHandler(options);
  } else {
    toastQueue.push(options);
  }
};

// Initialize the global window.showToast function
if (typeof window !== 'undefined') {
  window.showToast = showToast;
}
