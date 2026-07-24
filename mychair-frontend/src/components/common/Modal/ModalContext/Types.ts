import React from 'react';

import { ModalCloseButtonPropsType, ModalPropsType } from '../Types';

export interface ModalContextType {
  ref?:
    | React.RefObject<HTMLElement | null>
    | React.RefObject<HTMLElement | null>
    | React.Ref<HTMLElement | null>;
  open: boolean;
  escapeKey: boolean;
  outsidePress: boolean;
  headerId: string | undefined;
  bodyId: string | undefined;
  setHeaderStatus: (value: 'mounted' | 'unmounted') => void;
  setBodyStatus: (value: 'mounted' | 'unmounted') => void;
  getModalProps: () => ModalPropsType;
  getModalCloseButtonProps: () => ModalCloseButtonPropsType;
  onClose?: () => void;
  isShowIcon?: boolean;
}

export const ModalContext = React.createContext<ModalContextType | null>(null);
