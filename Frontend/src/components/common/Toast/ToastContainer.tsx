import { useCallback, useEffect, useState } from 'react';

import Toast from '.';
import { setToastHandler } from './toastService';
import { ToastOptions } from './Types';

let toastId = 0;

export const ToastContainer = () => {
  const [toasts, setToasts] = useState<Array<ToastOptions & { id: string }>>([]);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const showToast = useCallback((options: ToastOptions) => {
    const id = `toast-${toastId++}`;
    setToasts((prev) => [...prev, { id, ...options }]);
  }, []);

  useEffect(() => {
    setToastHandler(showToast);
    return () => {
      setToastHandler(null);
    };
  }, [showToast]);

  return (
    <div
      className="pointer-events-none fixed top-4 right-4 left-4 z-[9999] flex flex-col items-end gap-3 sm:top-5 sm:right-5 sm:left-auto"
      aria-live="polite"
      aria-relevant="additions"
      role="status"
    >
      {toasts.map((toast) => (
        <div key={toast.id} className="pointer-events-auto w-full max-w-sm">
          <Toast {...toast} onClose={removeToast} />
        </div>
      ))}
    </div>
  );
};
