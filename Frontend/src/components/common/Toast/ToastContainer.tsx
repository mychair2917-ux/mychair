import { useCallback, useEffect, useState } from 'react';

import Toast from '.';
import { setToastHandler } from './toastService';
import { ToastOptions } from './Types';

let toastId = 0;

/** Renders a container component for managing and displaying toast notifications.
It handles toast creation, display, and removal, and registers a global handler to allow toasts to be triggered from anywhere in the application.
Parameters:
@param {None}
Returns:
@returns {JSX.Element} - A React component that displays a stack of toast messages.
Exception Handling:
None
Side Effects:

Registers a global toast handler via setToastHandler to enable external toast triggering.

Cleans up the handler on unmount to prevent memory leaks and stale references.
*/
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
    // Register the toast handler when the component mounts
    setToastHandler(showToast);

    // Important: Return cleanup function to avoid memory leaks and stale handlers
    return () => {
      setToastHandler(null);
    };
  }, [showToast]);

  return (
    <div className="fixed top-5 right-5 z-9999 space-y-3">
      {toasts.map((toast) => (
        <Toast key={toast.id} {...toast} onClose={removeToast} />
      ))}
    </div>
  );
};
