import React, { useEffect } from 'react';

import { cn } from '../../../../utils/cn';
import { useModalContext } from '../ModalContext';

/**
 Renders the header section of the modal.
 
 Typically used to display the modal title or introductory content at the top of the modal.
 Sets ARIA attributes for accessibility and communicates header presence to screen readers.
 
 @function ModalHeader
 
 @component
 @param {React.HTMLProps<HTMLElement>} props - Standard HTML header props.
 @param {string} [props.className] - Additional class names to style the modal header.
 @param {React.ReactNode} props.children - The content to display inside the modal header.
 
 @returns {JSX.Element} - A React component that renders the modal's header section.
 
 Usage:
 - Place inside a Modal to provide a title or heading for the modal content.
 - Integrates with modal context to inform accessibility features.
 
 Features:
 - Accessible via `aria-labelledby`.
 - Responsive padding and bold text for emphasis.
*/

const ModalHeader = React.forwardRef<HTMLElement, React.HTMLProps<HTMLElement>>(
  function ModalHeader({ children, className, ...others }, ref) {
    const { headerId, setHeaderStatus } = useModalContext();

    useEffect(() => {
      setHeaderStatus('mounted');

      return () => setHeaderStatus('unmounted');
    }, [setHeaderStatus]);

    return (
      <header
        ref={ref}
        id={headerId}
        className={cn(
          'flex font-bold text-gray-900',
          'px-6 pt-6 pb-3 sm:px-10 sm:pt-9 sm:pb-6',
          className
        )}
        {...others}
      >
        {children}
      </header>
    );
  }
);

ModalHeader.displayName = 'ModalHeader';

export default ModalHeader;
