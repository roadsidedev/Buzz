/**
 * ErrorBoundary Component
 * React error boundary for graceful error handling
 */

import React, { ReactNode } from "react";
import { AlertCircle, RefreshCw } from "lucide-react";

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: (error: Error, retry: () => void) => ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

/**
 * ErrorBoundary Component
 * Catches errors in child components and displays error UI
 */
export class ErrorBoundary extends React.Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
    };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return {
      hasError: true,
      error,
    };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error("Error caught by ErrorBoundary:", error, errorInfo);
  }

  retry = () => {
    this.setState({
      hasError: false,
      error: null,
    });
  };

  render() {
    if (this.state.hasError && this.state.error) {
      if (this.props.fallback) {
        return this.props.fallback(this.state.error, this.retry);
      }

      return <DefaultErrorFallback error={this.state.error} onRetry={this.retry} />;
    }

    return this.props.children;
  }
}

/**
 * Default Error Fallback UI
 */
interface DefaultErrorFallbackProps {
  error: Error;
  onRetry: () => void;
}

export const DefaultErrorFallback: React.FC<DefaultErrorFallbackProps> = ({
  error,
  onRetry,
}) => (
  <div className="flex items-center justify-center min-h-screen bg-gray-50">
    <div className="rounded-lg bg-white p-8 text-center shadow-lg">
      <AlertCircle className="mx-auto h-12 w-12 text-red-500 mb-4" />

      <h1 className="text-2xl font-bold text-gray-900 mb-2">
        Something went wrong
      </h1>

      <p className="text-gray-600 mb-6 max-w-md">
        {error.message || "An unexpected error occurred"}
      </p>

      <button
        onClick={onRetry}
        className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors"
      >
        <RefreshCw className="w-4 h-4" />
        Try Again
      </button>

      {process.env.NODE_ENV === "development" && (
        <details className="mt-6 text-left">
          <summary className="cursor-pointer text-sm font-medium text-gray-600">
            Error Details
          </summary>
          <pre className="mt-2 overflow-auto rounded bg-gray-100 p-3 text-xs text-gray-800">
            {error.stack}
          </pre>
        </details>
      )}
    </div>
  </div>
);

/**
 * withErrorBoundary HOC
 * Wraps a component with error boundary
 */
export function withErrorBoundary<P extends object>(
  Component: React.ComponentType<P>,
  fallback?: (error: Error, retry: () => void) => ReactNode
) {
  return (props: P) => (
    <ErrorBoundary fallback={fallback}>
      <Component {...props} />
    </ErrorBoundary>
  );
}

export default ErrorBoundary;
