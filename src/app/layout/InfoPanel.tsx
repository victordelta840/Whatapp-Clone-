import React, { useEffect } from 'react';
import { X } from 'lucide-react';
import { IconButton } from '@/components/ui';
import { useBreakpoint } from '@/hooks/useBreakpoint';

export interface InfoPanelProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}

export const InfoPanel: React.FC<InfoPanelProps> = ({ open, onClose, title, children }) => {
  const { isDesktop } = useBreakpoint();

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  if (isDesktop) {
    return (
      <aside
        aria-label={title}
        className="flex h-full w-[360px] shrink-0 flex-col border-s border-border bg-surface-raised overflow-y-auto"
      >
        <header className="flex h-14 shrink-0 items-center justify-between border-b border-border px-4">
          <h2 className="text-sm font-semibold text-text-primary">{title}</h2>
          <IconButton label={`Close ${title}`} onClick={onClose}>
            <X className="h-5 w-5" aria-hidden="true" />
          </IconButton>
        </header>
        <div className="flex-1 overflow-y-auto">{children}</div>
      </aside>
    );
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={title}
      className="fixed inset-0 z-50 flex justify-end bg-black/40 backdrop-blur-xs"
    >
      <div className="flex h-full w-full max-w-md flex-col bg-surface-raised shadow-2xl">
        <header className="flex h-14 shrink-0 items-center justify-between border-b border-border px-4 pt-safe">
          <h2 className="text-sm font-semibold text-text-primary">{title}</h2>
          <IconButton label={`Close ${title}`} onClick={onClose}>
            <X className="h-5 w-5" aria-hidden="true" />
          </IconButton>
        </header>
        <div className="flex-1 overflow-y-auto pb-safe">{children}</div>
      </div>
    </div>
  );
};
