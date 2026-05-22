import React from 'react';

import { cn } from '../../../utils/cn';
import { FormFieldProps } from './Types';

const FormField: React.FC<FormFieldProps> = ({
  label,
  name,
  error,
  touched,
  required = false,
  children,
  className = '',
}) => {
  const showError = touched && error;

  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      <label htmlFor={name} className="text-sm font-medium text-gray-700">
        {label}
        {required && <span className="ml-0.5 text-red-500">*</span>}
      </label>
      {children}
      {showError && (
        <p className="text-xs text-red-600" role="alert">
          {error}
        </p>
      )}
    </div>
  );
};

export default FormField;
