import React from 'react';

import { WEEK_DAYS } from '../../constants/weekOff';
import { cn } from '../../utils/cn';

interface WeekOffSelectorProps {
  value: string[];
  onChange: (days: string[]) => void;
  disabled?: boolean;
  className?: string;
}

const WeekOffSelector: React.FC<WeekOffSelectorProps> = ({
  value,
  onChange,
  disabled = false,
  className,
}) => {
  const toggleDay = (day: string) => {
    if (disabled) return;
    if (value.includes(day)) {
      onChange(value.filter((item) => item !== day));
    } else {
      onChange([...value, day]);
    }
  };

  return (
    <div className={cn('space-y-2', className)}>
      <p className="text-sm font-medium text-[var(--color-text-primary)]">Week Off</p>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {WEEK_DAYS.map((day) => {
          const checked = value.includes(day.value);
          return (
            <label
              key={day.value}
              className={cn(
                'flex cursor-pointer items-center gap-2 rounded-xl border px-3 py-2 text-sm transition-colors',
                checked
                  ? 'border-[var(--color-brand-gold)] bg-[rgba(201,162,39,0.08)] text-[var(--color-text-primary)]'
                  : 'border-[var(--color-border-soft)] text-[var(--color-text-secondary)] hover:border-[var(--color-brand-gold-light)]',
                disabled && 'cursor-not-allowed opacity-60'
              )}
            >
              <input
                type="checkbox"
                className="h-4 w-4 rounded border-gray-300 text-[var(--color-brand-gold)] focus:ring-[var(--color-brand-gold)]"
                checked={checked}
                disabled={disabled}
                onChange={() => toggleDay(day.value)}
              />
              <span>{day.label}</span>
            </label>
          );
        })}
      </div>
    </div>
  );
};

export default WeekOffSelector;
