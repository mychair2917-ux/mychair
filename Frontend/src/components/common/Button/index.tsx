import React from 'react';
import { Loader2 } from 'lucide-react';

import { cn } from '../../../utils/cn';
import {
  ButtonRadius,
  ButtonSize,
  ButtonVariant,
  buttonRadiusClassNameMapping,
} from './Types';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  radius?: ButtonRadius;
  variant?: ButtonVariant;
  size?: ButtonSize;
  fullWidth?: boolean;
  isLoading?: boolean;
  loadingText?: string;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  icon?: React.ReactNode;
}

const Button: React.FC<ButtonProps> = ({ 
  children, 
  radius = 'xl',
  variant = 'primary', 
  size = 'md',
  fullWidth = false,
  isLoading = false,
  loadingText,
  leftIcon,
  rightIcon,
  icon,
  className = '',
  disabled,
  ...props 
}) => {
  const baseStyles =
    'inline-flex items-center justify-center gap-2 font-semibold transition-all duration-200 focus-visible:ring-2 focus-visible:ring-[var(--color-brand-gold)] focus-visible:ring-offset-2 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-55';
  
  const variantStyles = {
    primary:
      'bg-[var(--color-brand-gold)] text-white shadow-sm shadow-[rgba(197,160,89,0.22)] hover:bg-[var(--color-brand-gold-dark)] hover:shadow-md',
    secondary:
      'border border-[var(--color-border-strong)] bg-white text-[var(--color-text-primary)] shadow-sm hover:bg-[var(--color-surface-bg)]',
    outline:
      'border border-[var(--color-brand-gold)] bg-white text-[var(--color-brand-gold-dark)] hover:bg-[var(--color-surface-bg)]',
    danger: 'bg-red-600 text-white shadow-sm hover:bg-red-700 hover:shadow-md',
    success: 'bg-emerald-600 text-white shadow-sm hover:bg-emerald-700 hover:shadow-md',
    ghost:
      'bg-transparent text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-bg)] hover:text-[var(--color-text-primary)]',
  };

  const sizeStyles: Record<ButtonSize, string> = {
    sm: 'min-h-9 px-3 py-1.5 text-xs',
    md: 'min-h-10 px-4 py-2 text-sm',
    lg: 'min-h-11 px-5 py-2.5 text-base',
  };

  const widthClass = fullWidth ? 'w-full' : '';
  const radiusClass = buttonRadiusClassNameMapping[radius];

  const isDisabled = disabled || isLoading;
  const resolvedLeftIcon = icon ?? leftIcon;

  return (
    <button 
      className={cn(
        baseStyles,
        variantStyles[variant],
        sizeStyles[size],
        widthClass,
        radiusClass,
        className
      )} 
      disabled={isDisabled}
      {...props}
    >
      {isLoading && <Loader2 className="h-4 w-4 animate-spin" />}
      {!isLoading && resolvedLeftIcon}
      {isLoading && loadingText ? loadingText : children}
      {!isLoading && rightIcon}
    </button>
  );
};

export default Button;
export { Button as CommonButton };
export type { ButtonProps };
