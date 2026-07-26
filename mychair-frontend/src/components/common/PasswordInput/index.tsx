import * as React from 'react';
import { Eye, EyeOff } from 'lucide-react';

import { cn } from '../../../utils/cn';
import Input from '../Input';

const PasswordInput = React.forwardRef<HTMLInputElement, React.ComponentProps<'input'>>(
  ({ className, ...props }, ref) => {
    const [showPassword, setShowPassword] = React.useState(false);

    return (
      <div className="relative">
        <Input
          ref={ref}
          type={showPassword ? 'text' : 'password'}
          className={cn('pr-10', className)}
          {...props}
        />
        <button
          type="button"
          onClick={() => setShowPassword((prev) => !prev)}
          className="absolute right-1.5 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-md text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-brand-gold)]"
          aria-label={showPassword ? 'Hide password' : 'Show password'}
          aria-pressed={showPassword}
          tabIndex={-1}
        >
          {showPassword ? (
            <EyeOff className="h-4 w-4" aria-hidden="true" />
          ) : (
            <Eye className="h-4 w-4" aria-hidden="true" />
          )}
        </button>
      </div>
    );
  }
);
PasswordInput.displayName = 'PasswordInput';

export default PasswordInput;
