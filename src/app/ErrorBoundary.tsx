import React from 'react';
import { logger } from '@/lib/logger';
import { mapFirebaseError } from '@/lib/errors';

interface ErrorBoundaryProps {
  children: React.ReactNode;
  scope?: 'app' | 'route';
}

interface ErrorBoundaryState {
  hasError: boolean;
  message: string;
  isPermissionError: boolean;
}

export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  public override state: ErrorBoundaryState = {
    hasError: false,
    message: '',
    isPermissionError: false,
  };

  public static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    let displayMessage = error.message || 'Something went wrong while rendering this view.';
    let isPermissionError = false;

    try {
      const parsed = JSON.parse(error.message) as {
        error?: string;
        operationType?: string;
        path?: string;
      };
      if (parsed && typeof parsed.error === 'string' && parsed.operationType) {
        const mapped = mapFirebaseError(new Error(parsed.error));
        displayMessage = `${mapped.userMessage} (${parsed.operationType} on ${parsed.path ?? 'resource'})`;
        isPermissionError = parsed.error.toLowerCase().includes('permission');
      }
    } catch {
      const mapped = mapFirebaseError(error);
      displayMessage = mapped.userMessage;
    }

    return {
      hasError: true,
      message: displayMessage,
      isPermissionError,
    };
  }

  public override componentDidCatch(error: Error, info: React.ErrorInfo): void {
    logger.error('React ErrorBoundary caught error', error, {
      scope: this.props.scope ?? 'app',
      componentStackLength: info.componentStack?.length ?? 0,
    });
  }

  private handleReset = (): void => {
    this.setState({ hasError: false, message: '', isPermissionError: false });
  };

  public override render(): React.ReactNode {
    if (!this.state.hasError) {
      return this.props.children;
    }

    return (
      <div
        role="alert"
        className="flex min-h-[280px] flex-col items-center justify-center p-6 text-center bg-surface text-text-primary"
      >
        <div className="max-w-md rounded-2xl border border-border bg-surface-raised p-6">
          <h2 className="text-lg font-semibold">
            {this.state.isPermissionError ? 'Access Restricted' : 'Unable to load this section'}
          </h2>
          <p className="mt-2 text-sm text-text-secondary">{this.state.message}</p>
          <div className="mt-5 flex items-center justify-center gap-3">
            <button
              type="button"
              onClick={this.handleReset}
              className="min-h-[44px] rounded-xl bg-brand px-4 py-2 text-sm font-medium text-brand-foreground hover:bg-brand-hover transition-colors"
            >
              Retry
            </button>
            {this.props.scope !== 'route' && (
              <button
                type="button"
                onClick={() => window.location.assign('/chats')}
                className="min-h-[44px] rounded-xl border border-border bg-surface px-4 py-2 text-sm font-medium text-text-primary hover:bg-surface-sunken transition-colors"
              >
                Go to Chats
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }
}
