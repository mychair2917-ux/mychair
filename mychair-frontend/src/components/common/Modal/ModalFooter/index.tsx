import React from 'react';

import { cn } from '../../../../utils/cn';

/**
  Renders the footer section of the modal.
  
  Typically used to display action buttons like "Cancel" and "Confirm" at the bottom of the modal.
  Provides consistent padding and layout for footer content.
  
  @function ModalFooter
  
  @component
  @param {React.HTMLProps<HTMLElement>} props - Standard HTML footer props.
  @param {string} [props.className] - Additional class names to style the modal footer.
  @param {React.ReactNode} props.children - The content to display inside the modal footer.
  
  @returns {JSX.Element} - A React component that renders the modal's footer section.
  
  Usage:
  - Place inside a Modal to render actions or controls at the bottom.
  - Supports responsive layout with column-to-row direction on larger screens.
  
  Features:
  - Responsive spacing and padding.
  - Clean separation of modal actions from content.
 */

const ModalFooter = React.forwardRef<HTMLElement, React.HTMLProps<HTMLElement>>(
  function ModalFooter({ children, className, ...others }, ref) {
    return (
      <footer
        ref={ref}
        className={cn(
          'flex flex-col gap-4 sm:flex-row',
          'px-6 pt-6 pb-3 sm:px-10 sm:pt-9 sm:pb-6',
          className
        )}
        {...others}
      >
        {children}
      </footer>
    );
  }
);

ModalFooter.displayName = 'ModalFooter';

export default ModalFooter;
