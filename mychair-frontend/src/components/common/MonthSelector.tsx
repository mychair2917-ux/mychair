import React, { useMemo } from 'react';
import { Calendar, ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '../../utils/cn';

export interface MonthSelectorProps {
  month: number; // 1 - 12
  year: number; // e.g. 2026
  onChange: (month: number, year: number) => void;
  className?: string;
  idPrefix?: string;
}

export const MONTH_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

export const MonthSelector: React.FC<MonthSelectorProps> = ({
  month,
  year,
  onChange,
  className,
  idPrefix = 'month-selector',
}) => {
  const now = new Date();
  const currentMonth = now.getMonth() + 1;
  const currentYear = now.getFullYear();

  const isCurrentMonth = month === currentMonth && year === currentYear;

  // Generate a range of years around current year (e.g. past 4 years to next year)
  const yearOptions = useMemo(() => {
    const startYear = Math.min(year, currentYear - 3);
    const endYear = Math.max(year + 1, currentYear + 1);
    const years: number[] = [];
    for (let y = startYear; y <= endYear; y++) {
      years.push(y);
    }
    return years;
  }, [year, currentYear]);

  const handlePrevMonth = () => {
    if (month === 1) {
      onChange(12, year - 1);
    } else {
      onChange(month - 1, year);
    }
  };

  const handleNextMonth = () => {
    if (month === 12) {
      onChange(1, year + 1);
    } else {
      onChange(month + 1, year);
    }
  };

  const handleCurrentMonthJump = () => {
    onChange(currentMonth, currentYear);
  };

  return (
    <div
      id={`${idPrefix}-container`}
      className={cn(
        'inline-flex flex-wrap items-center gap-1.5 rounded-2xl border border-[var(--color-border-strong)] bg-white p-1.5 shadow-xs',
        className
      )}
    >
      {/* Calendar icon badge with selected month name & year indicator */}
      <div className="flex items-center gap-1.5 pl-2 pr-1 text-xs font-bold text-[var(--color-brand-gold-dark)]">
        <Calendar className="h-4 w-4 text-[var(--color-brand-gold)]" />
        <span className="hidden sm:inline text-gray-500 font-semibold uppercase tracking-wider text-[11px]">
          Month:
        </span>
      </div>

      {/* Prev Month Button */}
      <button
        type="button"
        id={`${idPrefix}-btn-prev`}
        onClick={handlePrevMonth}
        title="Previous Month"
        className="flex h-8 w-8 items-center justify-center rounded-xl text-gray-500 hover:bg-gray-100 hover:text-gray-900 transition-colors focus:outline-none"
      >
        <ChevronLeft className="h-4 w-4" />
      </button>

      {/* Month Dropdown */}
      <select
        id={`${idPrefix}-select-month`}
        aria-label="Select billing month"
        value={String(month)}
        onChange={(e) => onChange(Number(e.target.value), year)}
        className="h-8 rounded-xl border border-[var(--color-border-soft)] bg-[var(--color-surface-bg)] px-2.5 text-xs font-bold text-[var(--color-text-primary)] transition hover:border-[var(--color-brand-gold)] focus:border-[var(--color-brand-gold)] focus:outline-none focus:ring-1 focus:ring-[var(--color-brand-gold)] cursor-pointer"
      >
        {MONTH_NAMES.map((name, index) => (
          <option key={name} value={String(index + 1)}>
            {name}
          </option>
        ))}
      </select>

      {/* Year Dropdown */}
      <select
        id={`${idPrefix}-select-year`}
        aria-label="Select billing year"
        value={String(year)}
        onChange={(e) => onChange(month, Number(e.target.value))}
        className="h-8 rounded-xl border border-[var(--color-border-soft)] bg-[var(--color-surface-bg)] px-2.5 text-xs font-bold text-[var(--color-text-primary)] transition hover:border-[var(--color-brand-gold)] focus:border-[var(--color-brand-gold)] focus:outline-none focus:ring-1 focus:ring-[var(--color-brand-gold)] cursor-pointer"
      >
        {yearOptions.map((y) => (
          <option key={y} value={String(y)}>
            {y}
          </option>
        ))}
      </select>

      {/* Next Month Button */}
      <button
        type="button"
        id={`${idPrefix}-btn-next`}
        onClick={handleNextMonth}
        title="Next Month"
        className="flex h-8 w-8 items-center justify-center rounded-xl text-gray-500 hover:bg-gray-100 hover:text-gray-900 transition-colors focus:outline-none"
      >
        <ChevronRight className="h-4 w-4" />
      </button>

      {/* Current Month quick shortcut if viewing a different month */}
      {!isCurrentMonth && (
        <button
          type="button"
          id={`${idPrefix}-btn-current`}
          onClick={handleCurrentMonthJump}
          title="Jump to current calendar month"
          className="ml-1 rounded-xl bg-amber-50 px-2.5 py-1 text-[11px] font-bold text-[var(--color-brand-gold-dark)] hover:bg-amber-100 transition-colors border border-amber-200/60"
        >
          Today
        </button>
      )}
    </div>
  );
};

export default MonthSelector;
