import React from 'react';
import { AlertTriangle, Info, WifiOff, X } from 'lucide-react';

export interface BannerProps {
  variant?: 'info' | 'warning' | 'danger' | 'offline';
  message: string;
  action?: React.ReactNode;
  actionLabel?: string;
  onAction?: () => void;
  onDismiss?: () => void;
}

export const Banner: React.FC<BannerProps> = ({
  variant = 'info',
  message,
  action,
  actionLabel,
  onAction,
  onDismiss,
}) => {
  const styles =
    variant === 'danger'
      ? 'bg-danger/10 text-danger border-danger/30'
      : variant === 'warning' || variant === 'offline'
        ? 'bg-warning/10 text-warning border-warning/30'
        : 'bg-info/10 text-info border-info/30';

  const Icon = variant === 'offline' ? WifiOff : variant === 'info' ? Info : AlertTriangle;

  return (
    <div
      role={variant === 'danger' || variant === 'offline' ? 'status' : undefined}
      className={`flex items-center justify-between gap-3 border-b px-4 py-2 text-xs font-medium ${styles}`}
    >
      <div className="flex min-w-0 items-center gap-2">
        <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
        <span className="truncate">{message}</span>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        {action}
        {!action && actionLabel && onAction && (
          <button
            type="button"
            onClick={onAction}
            className="min-h-[32px] rounded-lg px-2.5 py-1 font-semibold underline hover:no-underline cursor-pointer"
          >
            {actionLabel}
          </button>
        )}
        {onDismiss && (
          <button
            type="button"
            aria-label="Dismiss banner"
            onClick={onDismiss}
            className="min-h-[32px] min-w-[32px] inline-flex items-center justify-center rounded-lg hover:bg-black/5 cursor-pointer"
          >
            <X className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
        )}
      </div>
    </div>
  );
};
