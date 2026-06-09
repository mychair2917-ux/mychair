import React from 'react';

import { cn } from '../../../utils/cn';
import Typography from '../Typography';
import { dotSizeMap, DotSpinnerProps, sizeMap } from './Types';

/**
Renders a circular dot spinner loader with animated pulsing dots.

The loader displays 8 dots arranged in a circle, each with a staggered animation delay
to create a smooth rotating pulse effect. The size and color of the spinner can be customized.

Parameters:
- size: 'sm' | 'md' | 'lg' (optional) — Controls the overall size of the spinner. Defaults to 'md'.
- color: string (optional) — Sets the tailwind color class for the dots. Defaults to 'bg-blue-500'.

Returns:
JSX.Element - A responsive animated loader spinner with a "Loading..." label.

Exception Handling:
None
*/
const Loader: React.FC<DotSpinnerProps> = ({ size = 'md', color = 'bg-[var(--color-brand-gold)]' }) => {
  const delays = ['-0.875s', '-0.75s', '-0.625s', '-0.5s', '-0.375s', '-0.25s', '-0.125s', '0s'];

  return (
    <div className="flex h-full flex-1 flex-col items-center justify-center">
      <div className={cn('relative flex items-center justify-start', sizeMap[size])}>
        {Array.from({ length: 8 }).map((_, i) => (
          <div
            key={i}
            className="absolute top-0 left-0 flex h-full w-full items-center justify-start"
            style={{ transform: `rotate(${i * 45}deg)` }}
          >
            <div
              className={cn(
                'animate-dot-pulse rounded-full opacity-50 shadow-[0_0_20px_rgba(18,31,53,0.3)]',
                dotSizeMap[size],
                color
              )}
              style={{ animationDelay: delays[i] }}
            />
          </div>
        ))}
      </div>
      <Typography>Loading...</Typography>
    </div>
  );
};

interface PageLoaderProps extends DotSpinnerProps {
  label?: string;
  className?: string;
}

export const PageLoader: React.FC<PageLoaderProps> = ({
  label = 'Preparing your salon workspace...',
  className,
  ...props
}) => (
  <div className={cn('flex min-h-[320px] flex-col items-center justify-center rounded-3xl bg-white', className)}>
    <Loader {...props} />
    <p className="mt-3 text-sm text-[var(--color-text-secondary)]">{label}</p>
  </div>
);

export const ButtonLoader: React.FC<{ className?: string }> = ({ className }) => (
  <span
    className={cn(
      'inline-block h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent',
      className
    )}
    aria-hidden="true"
  />
);

export const SkeletonLoader: React.FC<{
  rows?: number;
  className?: string;
  itemClassName?: string;
}> = ({ rows = 3, className, itemClassName }) => (
  <div className={cn('space-y-3', className)} aria-label="Loading content">
    {Array.from({ length: rows }).map((_, index) => (
      <div
        key={index}
        className={cn(
          'h-4 animate-pulse rounded-full bg-gradient-to-r from-[#f3eadb] via-white to-[#f3eadb]',
          itemClassName,
          index % 2 === 1 && 'w-10/12'
        )}
      />
    ))}
  </div>
);

export const TableLoader: React.FC<{ rows?: number; columns?: number }> = ({ rows = 5, columns = 5 }) => (
  <div className="w-full space-y-3 p-4" aria-label="Loading table">
    {Array.from({ length: rows }).map((_, rowIndex) => (
      <div key={rowIndex} className="grid gap-3" style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}>
        {Array.from({ length: columns }).map((__, columnIndex) => (
          <div
            key={columnIndex}
            className="h-10 animate-pulse rounded-xl bg-gradient-to-r from-[#f7f0e3] via-white to-[#f7f0e3]"
          />
        ))}
      </div>
    ))}
  </div>
);

export const EmptyState: React.FC<{
  title?: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}> = ({
  title = 'No records found',
  description = 'Try adjusting your search or filters. New salon activity will appear here.',
  action,
  className,
}) => (
  <div className={cn('flex flex-col items-center justify-center px-6 py-14 text-center', className)}>
    <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-3xl bg-[var(--color-surface-bg)] text-2xl shadow-inner">
      <span aria-hidden="true">MC</span>
    </div>
    <h3 className="text-base font-semibold text-[var(--color-text-primary)]">{title}</h3>
    <p className="mt-2 max-w-md text-sm leading-6 text-[var(--color-text-secondary)]">{description}</p>
    {action && <div className="mt-5">{action}</div>}
  </div>
);

export default Loader;
export { Loader as CommonLoader };
