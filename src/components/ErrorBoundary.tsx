import { Component, ReactNode, ErrorInfo } from 'react';
import { trackError } from '../lib/analytics';
import { captureException, addBreadcrumb } from '../lib/sentry';
import mixpanel from '../lib/mixpanel';

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  eventId: string | null;
}

export class ErrorBoundary extends Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      eventId: null,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return {
      hasError: true,
      error,
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    // Add breadcrumb for context
    addBreadcrumb({
      message: 'Error boundary triggered',
      category: 'error',
      level: 'error',
      data: {
        errorName: error.name,
        errorMessage: error.message,
      },
    });

    // Capture error to Sentry with component stack
    const eventId = captureException(error, {
      componentStack: errorInfo.componentStack,
      errorName: error.name,
      errorBoundary: true,
    });

    this.setState({ eventId });

    // Track error to analytics (legacy)
    trackError(error.message, 'error_boundary', {
      componentStack: errorInfo.componentStack,
      errorName: error.name,
    });

    // Track error to Mixpanel
    mixpanel.track('Error', {
      error_type: 'error_boundary',
      error_message: error.message,
      error_code: error.name,
      page_url: window.location.href,
    });

    // Log to console in development
    if (import.meta.env.DEV) {
      console.error('ErrorBoundary caught error:', error, errorInfo);
    }
  }

  render(): ReactNode {
    if (this.state.hasError) {
      // Show custom fallback UI if provided
      if (this.props.fallback) {
        return this.props.fallback;
      }

      // Default error UI
      return (
        <div
          style={{
            padding: '2rem',
            textAlign: 'center',
            maxWidth: '600px',
            margin: '4rem auto',
          }}
        >
          <h1 style={{ fontSize: '1.5rem', marginBottom: '1rem' }}>
            Something went wrong
          </h1>
          <p style={{ color: '#666', marginBottom: '1.5rem' }}>
            We've been notified about this error and will fix it as soon as
            possible.
          </p>
          <button
            onClick={() => window.location.reload()}
            style={{
              padding: '0.75rem 1.5rem',
              backgroundColor: '#007bff',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '1rem',
            }}
          >
            Reload Page
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
