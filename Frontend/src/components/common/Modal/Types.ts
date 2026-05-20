import React, { ReactNode } from 'react';

export interface ModalProps extends React.HTMLAttributes<HTMLDivElement> {
  classNames?: ModalClassNamesType;
  open?: boolean;
  size?: ModalSize;
  escapeKey?: boolean;
  outsidePress?: boolean;
  onClose?: () => void;
  isShowIcon?: boolean;
}

export interface ModalContentProps {
  children: ReactNode;
}

export type ModalClassNamesType = {
  closeButton?: string;
};

export type ModalSize = 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '3xl' | '4xl' | '5xl' | '6xl';

export type ModalPropsType = {
  'aria-modal': boolean;
  'aria-labelledby': string | undefined;
  'aria-describedby': string | undefined;
  className: string;
};

export type ModalCloseButtonPropsType = {
  className: string;
};

export const modalSizeClassNameMapping: Record<ModalSize, string> = {
  sm: 'max-w-sm',
  md: 'max-w-md',
  lg: 'max-w-[568px]',
  xl: 'max-w-xl',
  '2xl': 'max-w-2xl',
  '3xl': 'max-w-3xl',
  '4xl': 'max-w-4xl',
  '5xl': 'max-w-5xl',
  '6xl': 'max-w-6xl',
};
