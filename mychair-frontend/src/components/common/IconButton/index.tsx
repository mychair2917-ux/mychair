import React from 'react';

import { cn } from '../../../utils/cn';
import { buttonRadiusClassNameMapping } from '../Button/Types';
import { IconButtonProps } from './Types';

/**
  A flexible and reusable icon-only button component.
 
  - Designed for cases where you need an interactive icon (e.g., close button, action icons).
  - Supports customizable radius, button type, and additional props like `onClick`, `aria-label`, etc.
  - Automatically applies styles for layout, appearance, and disabled state handling.
 
  @component IconButton
  @param {IconButtonProps} props - Props for customizing the button.
  @param {React.ReactNode} props.children - The icon or content to render inside the button.
  @param {string} [props.type='button'] - The button type (e.g., 'button', 'submit', 'reset').
  @param {'sm' | 'md' | 'lg'} [props.radius='md'] - Controls the corner radius via Tailwind classes.
  @param {string} [props.className] - Additional class names to override or extend default styles.
  @param {React.Ref<HTMLButtonElement>} [ref] - Optional ref for direct DOM access.
 
  @returns {JSX.Element} A styled icon button component.
 
  @example
  <IconButton onClick={handleClose} radius="sm" aria-label="Close">
    <CloseIcon />
  </IconButton>
 */

const IconButton = React.forwardRef<HTMLButtonElement, IconButtonProps>(
  ({ className, children, type = 'button', radius = 'md', ...others }, ref) => {
    return (
      <button
        ref={ref}
        className={cn(
          'flex flex-shrink-0 appearance-none items-center justify-center bg-transparent p-0 select-none',
          'cursor-pointer disabled:pointer-events-none disabled:cursor-default disabled:opacity-30',
          buttonRadiusClassNameMapping[radius],
          className
        )}
        type={type}
        {...others}
      >
        {children}
      </button>
    );
  }
);

IconButton.displayName = 'IconButton';

export default IconButton;
