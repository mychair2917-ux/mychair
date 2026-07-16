import React from 'react';

import { ROUTE_PATHS } from '../../../constants';
import { buildOrgPath } from '../../../utils/utilities';
import ErrorPage from '../ErrorPage';
import { ErrorBoundaryProps, ErrorBoundaryState } from './Types';

class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('Uncaught error:', error, errorInfo);
    // Optionally report to a service like Sentry here
  }

  resetError = () => {
    this.setState({ hasError: false });
  };

  // Returns the current organization ID from localStorage, or null if not available or invalid.
  getCurrentOrgId(): string | null {
    const selectedOrgStr = localStorage.getItem('selected_organization');
    if (selectedOrgStr) {
      try {
        const selectedOrg = JSON.parse(selectedOrgStr);
        return selectedOrg?.id ?? null;
      } catch {
        return null;
      }
    }

    return null;
  }

  render() {
    if (this.state.hasError) {
      const { fallback } = this.props;

      if (typeof fallback === 'function') {
        return fallback(this.resetError);
      }

      return (
        fallback || (
          <ErrorPage
            title="Something went wrong"
            description="An unexpected error occurred."
            errorDescription="Please try again or return to the home page."
            buttonLabel="Go to Home Page"
            onButtonClick={() => {
              this.resetError();

              const orgId = this.getCurrentOrgId();
              if (orgId) {
                window.location.href = buildOrgPath(orgId, ROUTE_PATHS.HOME);
              } else {
                window.location.href = `/${ROUTE_PATHS.LOGIN}`;
              }
            }}
          />
        )
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
