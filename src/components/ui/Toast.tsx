import React from 'react';
import { create } from 'zustand';
import { CheckCircle2, Info, AlertTriangle, X } from 'lucide-react';

export type ToastVariant = 'info' | 'success' | 'warning' | 'danger';

export interface ToastItem {
  id: string;
  title: string;
  description?: string;
  variant: ToastVariant;
  actionLabel?: string;
  onAction?: () => void;
}

interface ToastStore {
  toasts: ToastItem[];
  push: (toast: Omit<ToastItem, 'id'>, durationMs?: number) => string;
  dismiss: (id: string) => void;
}

export const useToastStore = create<ToastStore>((set) => ({
  toasts: [],
  push: (toast, durationMs = 4500) => {
    const id = `toast-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    set((state) => ({ toasts: [...state.toasts.slice(-3), { ...toast, id }] }));
    if (durationMs > 0 && typeof window !== 'undefined') {
      window.setTimeout(() => {
        set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) }));
      }, durationMs);
    }
    return id;
  },
  dismiss: (id) => set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) })),
}));

export const toast = {
  info: (title: string, description?: string) =>
    useToastStore.getState().push({ title, description, variant: 'info' }),
  success: (title: string, description?: string, action?: { label: string; onClick: () => void }) =>
    useToastStore.getState().push({
      title,
      description,
      variant: 'success',
      actionLabel: action?.label,
      onAction: action?.onClick,
    }),
  warning: (title: string, description?: string) =>
    useToastStore.getState().push({ title, description, variant: 'warning' }),
  danger: (title: string, description?: string) =>
    useToastStore.getState().push({ title, description, variant: 'danger' }),
  error: (title: string, description?: string) =>
    useToastStore.getState().push({ title, description, variant: 'danger' }),
};

export const ToastHost: React.FC = () => {
  const toasts = useToastStore((s) => s.toasts);
  const dismiss = useToastStore((s) => s.dismiss);

  if (toasts.length === 0) return null;

  return (
    <div
      aria-live="polite"
      aria-relevant="additions text"
      className="fixed bottom-4 end-4 z-[70] flex w-[calc(100%-2rem)] max-w-sm flex-col gap-2 pointer-events-none"
    >
      {toasts.map((item) => (
        <div
          key={item.id}
          role="status"
          className="pointer-events-auto flex items-start gap-3 rounded-xl border border-border bg-surface-raised p-3.5 shadow-lg"
        >
          {item.variant === 'success' ? (
            <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-success" aria-hidden="true" />
          ) : item.variant === 'warning' || item.variant === 'danger' ? (
            <AlertTriangle
              className={`mt-0.5 h-5 w-5 shrink-0 ${
                item.variant === 'danger' ? 'text-danger' : 'text-warning'
              }`}
              aria-hidden="true"
            />
          ) : (
            <Info className="mt-0.5 h-5 w-5 shrink-0 text-info" aria-hidden="true" />
          )}
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-text-primary">{item.title}</p>
            {item.description && (
              <p className="mt-0.5 text-xs text-text-secondary">{item.description}</p>
            )}
            {item.actionLabel && item.onAction && (
              <button
                type="button"
                onClick={() => {
                  item.onAction?.();
                  dismiss(item.id);
                }}
                className="mt-1.5 text-xs font-semibold text-brand hover:underline cursor-pointer"
              >
                {item.actionLabel}
              </button>
            )}
          </div>
          <button
            type="button"
            aria-label="Dismiss notification"
            onClick={() => dismiss(item.id)}
            className="min-h-[32px] min-w-[32px] flex items-center justify-center rounded-lg text-text-secondary hover:bg-surface-sunken cursor-pointer"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
      ))}
    </div>
  );
};
