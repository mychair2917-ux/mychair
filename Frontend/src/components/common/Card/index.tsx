import React from 'react';

import { cn } from '../../../utils/cn';
import { SkeletonLoader } from '../Loader';

export interface CommonCardProps extends Omit<React.HTMLAttributes<HTMLDivElement>, 'title'> {
  title?: React.ReactNode;
  subtitle?: React.ReactNode;
  actions?: React.ReactNode;
  loading?: boolean;
  hoverable?: boolean;
  bodyClassName?: string;
}

const CommonCard = React.forwardRef<HTMLDivElement, CommonCardProps>(
  (
    {
      title,
      subtitle,
      actions,
      loading = false,
      hoverable = false,
      className,
      bodyClassName,
      children,
      ...props
    },
    ref
  ) => (
    <div
      ref={ref}
      className={cn(
        'rounded-3xl border border-[var(--color-border-soft)] bg-white shadow-soft transition duration-200',
        hoverable && 'hover:-translate-y-0.5 hover:shadow-card',
        className
      )}
      {...props}
    >
      {(title || subtitle || actions) && (
        <div className="flex flex-col gap-3 border-b border-[var(--color-border-soft)] px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            {title && <h3 className="text-base font-semibold text-[var(--color-text-primary)]">{title}</h3>}
            {subtitle && <p className="mt-1 text-sm text-[var(--color-text-secondary)]">{subtitle}</p>}
          </div>
          {actions && <div className="flex items-center gap-2">{actions}</div>}
        </div>
      )}
      <div className={cn('p-5', bodyClassName)}>
        {loading ? <SkeletonLoader rows={4} /> : children}
      </div>
    </div>
  )
);

CommonCard.displayName = 'CommonCard';

export default CommonCard;
export { CommonCard };
