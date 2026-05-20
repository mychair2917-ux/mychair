import React, { useEffect } from 'react';

import { cn } from '../../../../utils/cn';
import { useModalContext } from '../ModalContext';

/**
 Renders the body section of the modal.
 
 This component registers itself with the modal context on mount to set the ARIA `aria-describedby` attribute for accessibility.
 It also ensures proper padding and layout styling for modal content.
 
 @function ModalBody
 
 @component
 @param {React.HTMLProps<HTMLDivElement>} props - Standard HTML div props.
 @param {string} [props.className] - Additional class names to style the modal body.
 @param {React.ReactNode} props.children - The content to display inside the modal body.
 
 @returns {JSX.Element} - A React component that renders the modal's body section.
 
 Usage:
 - Used within a Modal to define the main content area.
 - Automatically sets the `aria-describedby` ID for accessibility.
 
 Features:
 - Adds padding and responsive spacing.
 - Uses `useModalContext` to signal when the body is mounted or unmounted.
*/

const ModalBody = React.forwardRef<HTMLDivElement, React.HTMLProps<HTMLDivElement>>(
  function ModalBody({ className, children, ...others }, ref) {
    const { bodyId, setBodyStatus } = useModalContext();

    useEffect(() => {
      setBodyStatus('mounted');

      return () => setBodyStatus('unmounted');
    }, [setBodyStatus]);

    return (
      <div
        ref={ref}
        id={bodyId}
        className={cn('flex flex-1 flex-col px-6 pt-6 pb-3 sm:px-10 sm:pt-9 sm:pb-6', className)}
        {...others}
      >
        {children}
      </div>
    );
  }
);

ModalBody.displayName = 'ModalBody';

export default ModalBody;
