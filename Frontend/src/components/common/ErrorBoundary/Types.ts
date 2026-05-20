import { ReactNode } from 'react';

export interface ErrorBoundaryProps {
  children: ReactNode;
  /**
   * Optional static fallback component or a render function that receives a `resetError` callback
   */
  fallback?: React.ReactNode | ((resetError: () => void) => React.ReactNode);
}

export interface ErrorBoundaryState {
  hasError: boolean;
}
