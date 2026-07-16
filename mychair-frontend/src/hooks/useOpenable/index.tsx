import { useCallback, useState } from 'react';

/**
  A custom React hook to manage the open/close state of a component (e.g., modal, dropdown, popover).
 
  @returns {Object} Openable state and control functions.
  @returns {boolean} isOpen - Current open state.
  @returns {Function} onOpen - Function to set the state to open (`true`).
  @returns {Function} onClose - Function to set the state to closed (`false`).
  @returns {Function} onOpenChange - Function to toggle the current open state.
 
  @example
  const { isOpen, onOpen, onClose, onOpenChange } = useOpenable();
  
  <button onClick={onOpenChange}>Toggle</button>
  {isOpen && <Modal onClose={onClose} />}
 */

function useOpenable() {
  const [isOpen, setIsOpen] = useState(false);

  // Function to set isOpen to true
  const onOpen = useCallback(() => setIsOpen(true), []);

  // Function to set isOpen to false
  const onClose = useCallback(() => setIsOpen(false), []);

  // Function to toggle the current state of isOpen
  const onOpenChange = () => {
    setIsOpen((prev) => !prev);
  };

  return {
    isOpen,
    onOpen,
    onClose,
    onOpenChange,
  };
}

export default useOpenable;
