import React from 'react';

import { ModalContext, ModalContextType } from './Types';

/**
  Custom React hook to access the Modal context.
 
  - Provides access to modal-related state and functions defined in `ModalContext`.
  - Ensures that the hook is only used within a valid `ModalContextProvider`.
  - Throws a descriptive error if used outside the provider to prevent misuse.
 
  @function useModalContext
  @returns {ModalContextType} The modal context value, including state and utility functions for controlling modals.
 
  @throws {Error} If the hook is used outside of the `ModalContextProvider`.
 
  @example
  const { isOpen, openModal, closeModal } = useModalContext();
 */

export function useModalContext(): ModalContextType {
  const context = React.useContext(ModalContext);

  if (!context) {
    throw new Error('useModalContext has to be used within the ModalContextProvider.');
  }

  return context;
}
