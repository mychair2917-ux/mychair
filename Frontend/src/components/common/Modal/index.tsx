import React from 'react';

import ModalContent from './ModalContent';
import { ModalContext } from './ModalContext';
import { ModalProps } from './Types';
import { useModal } from './useModal';

/**
Provides a fully accessible and context-powered modal dialog component.

@function Modal

@typedef {Object} ModalProps - Props used to configure the modal component. Defined in './Types'.

@component
@param {ModalProps} props - Props passed to the Modal component.
@param {React.Ref<HTMLDivElement>} ref - Ref forwarded to the underlying modal container.

@returns {JSX.Element} - A React component that renders a modal with context and internal logic.

Usage:
- Wraps content in a modal dialog with state management via `useModal`.
- Uses `ModalContext` to share modal state across child components.

Note:
- This component must be used in combination with `ModalContent` and other internal modal parts.
*/

const Modal = React.forwardRef<HTMLDivElement, ModalProps>(function Modal(
  { children, ...others },
  ref
) {
  const value = useModal({ ref, ...others });

  return (
    <ModalContext.Provider value={value}>
      <ModalContent>{children}</ModalContent>
    </ModalContext.Provider>
  );
});

Modal.displayName = 'Modal';

export default Modal;
