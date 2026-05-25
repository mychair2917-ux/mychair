import React from 'react';

import { SvgIconProps } from '../SvgIcon/Types';

export type ToastType =
  | 'default'
  | 'success'
  | 'error'
  | 'warning'
  | 'info'
  | 'outlined-success'
  | 'outlined-error'
  | 'outlined-warning'
  | 'outlined-notice'
  | 'outlined-info'
  | 'notification'
  | 'notification-success'
  | 'notification-error';

export interface ToastOptions {
  message: string;
  type?: ToastType;
  Icon?: React.ComponentType<SvgIconProps>;
  buttonLabel?: string;
  onButtonClick?: () => void;
  duration?: number;
  isNonDismissable?: boolean;
  handleToastNavigation?: () => void;
  action?: {
    label: string;
    onClick: () => void;
  };
}

declare global {
  interface Window {
    showToast: (type: 'success' | 'error' | 'warning' | 'info', message: string) => void;
  }
}

export interface ToastProps {
  id: string;
  message: string;
  type?: ToastType;
  buttonLabel?: string;
  onButtonClick?: () => void;
  onClose: (id: string) => void;
  duration?: number;
  Icon?: React.ComponentType<SvgIconProps>;
  action?: {
    label: string;
    onClick: () => void;
  };
  isNonDismissable?: boolean;
  handleToastNavigation?: () => void;
}
