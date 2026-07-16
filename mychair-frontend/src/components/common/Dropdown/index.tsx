import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Check, ChevronDown, Loader2, X } from 'lucide-react';

import { cn } from '../../../utils/cn';
import CommonSearch from '../Search';

export interface DropdownOption {
  value: string;
  label: string;
  disabled?: boolean;
}

export interface CommonDropdownProps {
  options: DropdownOption[];
  value?: string | string[];
  onChange?: (value: string | string[]) => void;
  placeholder?: string;
  searchable?: boolean;
  multiple?: boolean;
  clearable?: boolean;
  loading?: boolean;
  disabled?: boolean;
  label?: string;
  className?: string;
}

const CommonDropdown: React.FC<CommonDropdownProps> = ({
  options,
  value,
  onChange,
  placeholder = 'Select option',
  searchable = true,
  multiple = false,
  clearable = true,
  loading = false,
  disabled = false,
  label,
  className,
}) => {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);

  const selectedValues = useMemo(
    () => (Array.isArray(value) ? value : value ? [value] : []),
    [value]
  );

  const selectedOptions = options.filter((option) => selectedValues.includes(option.value));
  const filteredOptions = options.filter((option) =>
    option.label.toLowerCase().includes(search.toLowerCase())
  );

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelect = (option: DropdownOption) => {
    if (option.disabled) return;

    if (multiple) {
      const nextValue = selectedValues.includes(option.value)
        ? selectedValues.filter((selectedValue) => selectedValue !== option.value)
        : [...selectedValues, option.value];
      onChange?.(nextValue);
      return;
    }

    onChange?.(option.value);
    setOpen(false);
  };

  const handleClear = (event: React.MouseEvent<HTMLElement>) => {
    event.stopPropagation();
    onChange?.(multiple ? [] : '');
  };

  const displayText = selectedOptions.length
    ? selectedOptions.map((option) => option.label).join(', ')
    : placeholder;

  return (
    <div ref={containerRef} className={cn('relative w-full', className)}>
      {label && <label className="mb-1.5 block text-xs font-semibold text-[var(--color-text-secondary)]">{label}</label>}
      <button
        type="button"
        onClick={() => !disabled && setOpen((current) => !current)}
        disabled={disabled}
        className={cn(
          'flex min-h-11 w-full items-center justify-between gap-2 rounded-2xl border border-[var(--color-border-soft)] bg-white px-3 text-left text-sm shadow-sm transition hover:border-[var(--color-border-strong)] focus:ring-4 focus:ring-[rgba(197,160,89,0.12)] focus:outline-none',
          disabled && 'cursor-not-allowed opacity-60'
        )}
      >
        <span
          className={cn(
            'min-w-0 flex-1 truncate',
            selectedOptions.length ? 'text-[var(--color-text-primary)]' : 'text-gray-400'
          )}
        >
          {displayText}
        </span>
        {loading && <Loader2 className="h-4 w-4 animate-spin text-[var(--color-brand-gold)]" />}
        {clearable && selectedValues.length > 0 && !disabled && (
          <span
            role="button"
            tabIndex={0}
            onClick={handleClear}
            className="rounded-full p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-700"
            aria-label="Clear selection"
          >
            <X className="h-4 w-4" />
          </span>
        )}
        <ChevronDown className={cn('h-4 w-4 text-gray-400 transition', open && 'rotate-180')} />
      </button>

      {open && (
        <div className="absolute z-40 mt-2 w-full overflow-hidden rounded-2xl border border-[var(--color-border-soft)] bg-white p-2 shadow-card">
          {searchable && (
            <CommonSearch
              value={search}
              onChange={setSearch}
              placeholder="Search options..."
              containerClassName="mb-2 min-h-10 rounded-xl"
            />
          )}
          <div className="max-h-64 overflow-y-auto">
            {loading ? (
              <div className="px-3 py-6 text-center text-sm text-[var(--color-text-secondary)]">Loading options...</div>
            ) : filteredOptions.length ? (
              filteredOptions.map((option) => {
                const isSelected = selectedValues.includes(option.value);
                return (
                  <button
                    key={option.value}
                    type="button"
                    disabled={option.disabled}
                    onClick={() => handleSelect(option)}
                    className={cn(
                      'flex w-full items-center justify-between gap-3 rounded-xl px-3 py-2 text-left text-sm transition hover:bg-[var(--color-surface-bg)] disabled:cursor-not-allowed disabled:opacity-50',
                      isSelected && 'bg-[var(--color-surface-bg)] text-[var(--color-brand-gold-dark)]'
                    )}
                  >
                    <span className="truncate">{option.label}</span>
                    {isSelected && <Check className="h-4 w-4" />}
                  </button>
                );
              })
            ) : (
              <div className="px-3 py-6 text-center text-sm text-[var(--color-text-secondary)]">No options found</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default CommonDropdown;
export { CommonDropdown };
