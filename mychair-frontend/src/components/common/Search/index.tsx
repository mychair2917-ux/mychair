import React, { useEffect, useState } from 'react';
import { Search, SlidersHorizontal, X } from 'lucide-react';

import { cn } from '../../../utils/cn';

export interface CommonSearchProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'onChange' | 'value'> {
  value?: string;
  onChange?: (value: string) => void;
  onDebouncedChange?: (value: string) => void;
  debounceMs?: number;
  showFilterIcon?: boolean;
  onFilterClick?: () => void;
  containerClassName?: string;
}

const CommonSearch = React.forwardRef<HTMLInputElement, CommonSearchProps>(
  (
    {
      value,
      defaultValue,
      onChange,
      onDebouncedChange,
      debounceMs = 350,
      showFilterIcon = false,
      onFilterClick,
      placeholder = 'Search records...',
      className,
      containerClassName,
      disabled,
      ...props
    },
    ref
  ) => {
    const [internalValue, setInternalValue] = useState(String(defaultValue ?? ''));
    const searchValue = value ?? internalValue;

    useEffect(() => {
      if (!onDebouncedChange) return;

      const timer = window.setTimeout(() => onDebouncedChange(searchValue), debounceMs);
      return () => window.clearTimeout(timer);
    }, [debounceMs, onDebouncedChange, searchValue]);

    const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
      const nextValue = event.target.value;
      if (value === undefined) {
        setInternalValue(nextValue);
      }
      onChange?.(nextValue);
    };

    const handleClear = () => {
      if (value === undefined) {
        setInternalValue('');
      }
      onChange?.('');
      onDebouncedChange?.('');
    };

    return (
      <div
        className={cn(
          'flex min-h-11 items-center gap-2 rounded-2xl border border-[var(--color-border-soft)] bg-white px-3 shadow-sm transition focus-within:border-[var(--color-brand-gold)] focus-within:ring-4 focus-within:ring-[rgba(197,160,89,0.12)]',
          disabled && 'cursor-not-allowed opacity-60',
          containerClassName
        )}
      >
        <Search className="h-4 w-4 text-[var(--color-text-secondary)]" aria-hidden="true" />
        <input
          ref={ref}
          value={searchValue}
          onChange={handleChange}
          placeholder={placeholder}
          disabled={disabled}
          className={cn(
            'min-w-0 flex-1 bg-transparent text-sm text-[var(--color-text-primary)] outline-none placeholder:text-gray-400 disabled:cursor-not-allowed',
            className
          )}
          {...props}
        />
        {searchValue && !disabled && (
          <button
            type="button"
            onClick={handleClear}
            className="rounded-full p-1 text-gray-400 transition hover:bg-gray-100 hover:text-gray-700"
            aria-label="Clear search"
          >
            <X className="h-4 w-4" />
          </button>
        )}
        {showFilterIcon && (
          <button
            type="button"
            onClick={onFilterClick}
            className="rounded-full p-1.5 text-[var(--color-text-secondary)] transition hover:bg-[var(--color-surface-bg)] hover:text-[var(--color-text-primary)]"
            aria-label="Open filters"
          >
            <SlidersHorizontal className="h-4 w-4" />
          </button>
        )}
      </div>
    );
  }
);

CommonSearch.displayName = 'CommonSearch';

export default CommonSearch;
export { CommonSearch };
