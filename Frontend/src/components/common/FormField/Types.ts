import { ReactNode } from 'react';

export interface FormFieldProps {
  label: string;
  name: string;
  error?: string;
  touched?: boolean;
  required?: boolean;
  children: ReactNode;
  className?: string;
}
