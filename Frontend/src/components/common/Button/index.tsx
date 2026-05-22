import React from 'react';
import { Loader2 } from 'lucide-react';

import { ButtonRadius, buttonRadiusClassNameMapping } from './Types';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  radius?: ButtonRadius;
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
  fullWidth?: boolean;
  isLoading?: boolean;
  loadingText?: string;
}

const Button: React.FC<ButtonProps> = ({ 
  children, 
  radius = 'md', 
  variant = 'primary', 
  fullWidth = false,
  isLoading = false,
  loadingText,
  className = '',
  disabled,
  ...props 
}) => {
  const baseStyles = 'px-4 py-2 font-medium transition-colors focus:outline-none flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed';
  
  const variantStyles = {
    primary: 'bg-blue-600 text-white hover:bg-blue-700',
    secondary: 'bg-gray-200 text-gray-800 hover:bg-gray-300',
    danger: 'bg-red-600 text-white hover:bg-red-700',
    ghost: 'bg-transparent text-gray-600 hover:bg-gray-100',
  };

  const widthClass = fullWidth ? 'w-full' : '';
  const radiusClass = buttonRadiusClassNameMapping[radius];

  const isDisabled = disabled || isLoading;

  return (
    <button 
      className={`${baseStyles} ${variantStyles[variant]} ${widthClass} ${radiusClass} ${className}`} 
      disabled={isDisabled}
      {...props}
    >
      {isLoading && <Loader2 className="h-4 w-4 animate-spin" />}
      {isLoading && loadingText ? loadingText : children}
    </button>
  );
};

export default Button;
