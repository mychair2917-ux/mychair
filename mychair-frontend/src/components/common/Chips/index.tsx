import React from 'react';

import { cn } from '../../../utils/cn';

export type ChipStatus = 'active' | 'inactive' | 'pending' | 'completed' | 'cancelled' | 'success' | 'warning' | 'error' | 'info' | 'default';

export interface CommonChipsProps extends React.HTMLAttributes<HTMLSpanElement> {
  status?: ChipStatus | string;
  label?: React.ReactNode;
  dot?: boolean;
}

const statusClasses: Record<string, string> = {
  active: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  inactive: 'bg-gray-100 text-gray-600 ring-gray-200',
  pending: 'bg-amber-50 text-amber-700 ring-amber-200',
  completed: 'bg-blue-50 text-blue-700 ring-blue-200',
  cancelled: 'bg-red-50 text-red-700 ring-red-200',
  success: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  warning: 'bg-amber-50 text-amber-700 ring-amber-200',
  error: 'bg-red-50 text-red-700 ring-red-200',
  info: 'bg-blue-50 text-blue-700 ring-blue-200',
  default: 'bg-[var(--color-surface-bg)] text-[var(--color-text-secondary)] ring-[var(--color-border-soft)]',
};

const dotClasses: Record<string, string> = {
  active: 'bg-emerald-500',
  inactive: 'bg-gray-400',
  pending: 'bg-amber-500',
  completed: 'bg-blue-500',
  cancelled: 'bg-red-500',
  success: 'bg-emerald-500',
  warning: 'bg-amber-500',
  error: 'bg-red-500',
  info: 'bg-blue-500',
  default: 'bg-[var(--color-brand-gold)]',
};

const normalizeStatus = (status?: string) => status?.toLowerCase() ?? 'default';

const CommonChips: React.FC<CommonChipsProps> = ({
  status = 'default',
  label,
  dot = true,
  className,
  children,
  ...props
}) => {
  const normalizedStatus = normalizeStatus(status);
  const content = label ?? children ?? normalizedStatus;

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold capitalize ring-1 ring-inset',
        statusClasses[normalizedStatus] ?? statusClasses.default,
        className
      )}
      {...props}
    >
      {dot && (
        <span
          className={cn('h-1.5 w-1.5 rounded-full', dotClasses[normalizedStatus] ?? dotClasses.default)}
          aria-hidden="true"
        />
      )}
      {content}
    </span>
  );
};

export default CommonChips;
export { CommonChips };
