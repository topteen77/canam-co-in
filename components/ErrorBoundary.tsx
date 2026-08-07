import React, { ErrorInfo, ReactNode } from 'react';

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
  onBack?: () => void;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    console.error('ErrorBoundary caught:', error, errorInfo);
  }

  render(): ReactNode {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;
      return (
        <div className="p-6 text-center">
          <p className="text-red-600 font-medium mb-2">Something went wrong loading this section.</p>
          {this.state.error && <p className="text-sm text-slate-500 mb-4">{this.state.error.message}</p>}
          {this.props.onBack && (
            <button
              type="button"
              onClick={() => { this.setState({ hasError: false, error: null }); this.props.onBack?.(); }}
              className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
            >
              ← Back to Leads
            </button>
          )}
        </div>
      );
    }
    return this.props.children;
  }
}
