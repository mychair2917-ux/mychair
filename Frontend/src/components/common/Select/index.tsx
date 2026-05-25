import * as React from 'react';

import { cn } from '../../../utils/cn';

export interface SelectOption {
  value: string;
  label: string;
}

export interface SelectProps extends Omit<React.ComponentProps<'select'>, 'children'> {
  options: SelectOption[];
  placeholder?: string;
}

const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
  ({ className, options, placeholder = 'Select an option', ...props }, ref) => {
    return (
      <select
        ref={ref}
        className={cn(
          'border-input bg-background ring-offset-background',
          'flex h-4 w-full rounded-[7px] border px-3 py-2 text-base',
          'focus-visible:ring-ring focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none',
          'disabled:cursor-not-allowed disabled:opacity-50 sm:h-8 md:text-sm [@media(min-width:1440px)]:h-10',
          className
        )}
        {...props}
      >
        <option value="" disabled>
          {placeholder}
        </option>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    );
  }
);
Select.displayName = 'Select';

export default Select;
