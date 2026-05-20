import * as React from 'react';

import { cn } from './../../../utils/cn';

const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<'input'>>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          'border-input bg-background ring-offset-background',
          'file:text-foreground focus-visible:ring-ring flex h-4 w-full',
          'rounded-[7px] border px-3 py-2 text-base file:border-0',
          'file:bg-transparent file:text-sm file:font-medium',
          'focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none',
          'disabled:cursor-not-allowed disabled:opacity-50 sm:h-8 md:text-sm [@media(min-width:1440px)]:h-10',
          className
        )}
        ref={ref}
        {...props}
      />
    );
  }
);
Input.displayName = 'Input';

export default Input;
