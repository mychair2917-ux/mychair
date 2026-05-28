import React from 'react';

import { cn } from '../../../utils/cn';

export type TooltipPlacement = 'top' | 'bottom' | 'left' | 'right';
export type TooltipTone = 'dark' | 'light';

export interface CommonTooltipProps {
  content: React.ReactNode;
  children: React.ReactNode;
  placement?: TooltipPlacement;
  tone?: TooltipTone;
  disabled?: boolean;
  className?: string;
}

const placementClasses: Record<TooltipPlacement, string> = {
  top: 'bottom-full left-1/2 mb-2 -translate-x-1/2',
  bottom: 'top-full left-1/2 mt-2 -translate-x-1/2',
  left: 'right-full top-1/2 mr-2 -translate-y-1/2',
  right: 'left-full top-1/2 ml-2 -translate-y-1/2',
};

const toneClasses: Record<TooltipTone, string> = {
  dark: 'bg-[#1f1f1e] text-white',
  light: 'border border-[var(--color-border-soft)] bg-white text-[var(--color-text-primary)] shadow-card',
};

const CommonTooltip: React.FC<CommonTooltipProps> = ({
  content,
  children,
  placement = 'top',
  tone = 'dark',
  disabled = false,
  className,
}) => (
  <span className="group relative inline-flex">
    {children}
    {!disabled && (
      <span
        role="tooltip"
        className={cn(
          'pointer-events-none absolute z-50 max-w-64 scale-95 whitespace-nowrap rounded-xl px-3 py-2 text-xs font-medium opacity-0 shadow-lg transition duration-150 group-hover:scale-100 group-hover:opacity-100 group-focus-within:scale-100 group-focus-within:opacity-100',
          placementClasses[placement],
          toneClasses[tone],
          className
        )}
      >
        {content}
      </span>
    )}
  </span>
);

export default CommonTooltip;
export { CommonTooltip };
