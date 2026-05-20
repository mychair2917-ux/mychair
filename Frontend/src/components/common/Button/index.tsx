import React from 'react';
import { ButtonRadius, buttonRadiusClassNameMapping } from './Types';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  radius?: ButtonRadius;
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
  fullWidth?: boolean;
}

const Button: React.FC<ButtonProps> = ({ 
  children, 
  radius = 'md', 
  variant = 'primary', 
  fullWidth = false,
  className = '',
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

  return (
    <button 
      className={`${baseStyles} ${variantStyles[variant]} ${widthClass} ${radiusClass} ${className}`} 
      {...props}
    >
      {children}
    </button>
  );
};

export default Button;
