import React from 'react';

import { cn } from '../../utils/cn';

interface PermissionToggleProps {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  hint?: string;
}

const PermissionToggle: React.FC<PermissionToggleProps> = ({
  label,
  checked,
  onChange,
  disabled = false,
  hint,
}) => (
  <div className="flex items-center justify-between gap-4 rounded-xl border border-[var(--color-border-soft)] bg-white px-4 py-3">
    <div className="min-w-0">
      <p className="text-sm font-medium text-[var(--color-text-primary)]">{label}</p>
      {hint && <p className="text-xs text-[var(--color-text-secondary)]">{hint}</p>}
    </div>
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cn(
        'relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors disabled:opacity-50',
        checked ? 'bg-[var(--color-brand-gold)]' : 'bg-gray-300'
      )}
    >
      <span
        className={cn(
          'inline-block h-4 w-4 transform rounded-full bg-white transition-transform',
          checked ? 'translate-x-6' : 'translate-x-1'
        )}
      />
    </button>
  </div>
);

export default PermissionToggle;
