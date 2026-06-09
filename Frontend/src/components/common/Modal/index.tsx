import React from 'react';

import Button from '../Button';
import Loader from '../Loader';
import ModalBody from './ModalBody';
import ModalContent from './ModalContent';
import { ModalContext } from './ModalContext';
import ModalFooter from './ModalFooter';
import ModalHeader from './ModalHeader';
import { CommonModalProps, ModalProps } from './Types';
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

const CommonModal: React.FC<CommonModalProps> = ({
  open,
  title,
  subtitle,
  children,
  onClose,
  footer,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  onConfirm,
  isLoading = false,
  mode = 'default',
  size = mode === 'form' ? 'lg' : 'md',
  confirmVariant = mode === 'confirmation' ? 'danger' : 'primary',
  className,
}) => (
  <Modal
    open={open}
    onClose={onClose}
    size={size}
    isShowIcon
    className={`rounded-3xl border border-[var(--color-border-soft)] shadow-card ${className ?? ''}`}
  >
    <ModalHeader className="flex-col gap-1 pr-14">
      <h2 className="text-xl font-semibold text-[var(--color-text-primary)]">{title}</h2>
      {subtitle && <p className="text-sm font-normal text-[var(--color-text-secondary)]">{subtitle}</p>}
    </ModalHeader>
    <ModalBody className="pt-2">
      {isLoading ? (
        <div className="min-h-36">
          <Loader />
        </div>
      ) : (
        children
      )}
    </ModalBody>
    {(footer || onConfirm || onClose) && (
      <ModalFooter className="justify-end pt-2">
        {footer ?? (
          <>
            {onClose && (
              <Button type="button" variant="secondary" onClick={onClose}>
                {cancelLabel}
              </Button>
            )}
            {onConfirm && (
              <Button
                type="button"
                variant={confirmVariant}
                onClick={onConfirm}
                isLoading={isLoading}
              >
                {confirmLabel}
              </Button>
            )}
          </>
        )}
      </ModalFooter>
    )}
  </Modal>
);

export default Modal;
export { CommonModal, Modal, ModalBody, ModalFooter, ModalHeader };
