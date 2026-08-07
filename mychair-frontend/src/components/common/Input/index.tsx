import * as React from 'react';

import { cn } from './../../../utils/cn';
import { isProperNameField, toTitleCase } from './../../../utils/personName';

export interface InputProps extends React.ComponentProps<'input'> {
  autoTitleCase?: boolean;
}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, autoTitleCase, onChange, onBlur, name, value, ...props }, ref) => {
    const shouldTitleCase =
      autoTitleCase !== undefined
        ? autoTitleCase
        : (type === 'text' || !type) && isProperNameField(name);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      if (shouldTitleCase && e.target.type !== 'password' && e.target.type !== 'email') {
        const titleCased = toTitleCase(e.target.value);
        if (titleCased !== e.target.value) {
          e.target.value = titleCased;
        }
      }
      if (onChange) {
        onChange(e);
      }
    };

    const handleBlur = (e: React.FocusEvent<HTMLInputElement>) => {
      if (shouldTitleCase && e.target.type !== 'password' && e.target.type !== 'email') {
        const titleCased = toTitleCase(e.target.value);
        if (titleCased !== e.target.value) {
          e.target.value = titleCased;
        }
      }
      if (onBlur) {
        onBlur(e);
      }
    };

    return (
      <input
        ref={ref}
        type={type}
        name={name}
        value={value}
        onChange={handleChange}
        onBlur={handleBlur}
        className={cn(
          'border-input bg-background ring-offset-background',
          'file:text-foreground focus-visible:ring-ring flex h-4 w-full',
          'rounded-[7px] border px-3 py-2 text-base file:border-0',
          'file:bg-transparent file:text-sm file:font-medium',
          'focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none',
          'disabled:cursor-not-allowed disabled:opacity-50 sm:h-8 md:text-sm [@media(min-width:1440px)]:h-10',
          className
        )}
        {...props}
      />
    );
  }
);
Input.displayName = 'Input';

export default Input;
