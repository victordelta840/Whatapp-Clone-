import React, { useState } from 'react';
import { CheckCircle2, Download, MoreVertical, Smartphone } from 'lucide-react';
import { usePWAInstall } from '@/lib/pwa';
import { Button } from './Button';
import { Dialog } from './Dialog';
import { toast } from './Toast';

export interface PWAInstallCardProps {
  compact?: boolean;
}

export const PWAInstallCard: React.FC<PWAInstallCardProps> = ({ compact = false }) => {
  const { isAndroid, isEmbedded, isStandalone, hasNativePrompt, triggerInstall } = usePWAInstall();
  const [guideOpen, setGuideOpen] = useState(false);

  const handleInstallClick = async () => {
    if (hasNativePrompt) {
      const accepted = await triggerInstall();
      if (accepted) {
        toast.success('WhatsApp is installing onto your device.');
      }
      return;
    }
    setGuideOpen(true);
  };

  if (compact) {
    if (isStandalone) return null;
    if (!hasNativePrompt && !isAndroid) return null;
    return (
      <>
        <button
          type="button"
          onClick={() => void handleInstallClick()}
          className="inline-flex min-h-[40px] items-center justify-center gap-1.5 rounded-xl border border-border bg-surface-raised px-3 py-2 text-xs font-semibold text-brand hover:bg-surface-muted transition-colors"
        >
          <Download className="h-3.5 w-3.5" aria-hidden="true" />
          <span>{isAndroid ? 'Install Android App' : 'Install App'}</span>
        </button>
        <AndroidInstallGuideDialog
          open={guideOpen}
          onOpenChange={setGuideOpen}
          isEmbedded={isEmbedded}
        />
      </>
    );
  }

  return (
    <>
      <div className="rounded-xl border border-border bg-surface-raised p-4 space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-2.5">
            <Smartphone className="mt-0.5 h-5 w-5 shrink-0 text-brand" aria-hidden="true" />
            <div>
              <h3 className="text-sm font-semibold text-text-primary">Android App Installation</h3>
              <p className="mt-0.5 text-xs text-text-secondary">
                {isStandalone
                  ? 'Running in standalone app mode with full-screen navigation and home-screen shortcut.'
                  : 'Install WhatsApp on your Android home screen for full-screen mode, offline chat cache, and push notifications.'}
              </p>
            </div>
          </div>
          {isStandalone ? (
            <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-accent/15 px-2.5 py-0.5 text-[11px] font-semibold text-accent">
              <CheckCircle2 className="h-3.5 w-3.5" />
              Installed
            </span>
          ) : (
            <Button
              size="sm"
              leftIcon={<Download className="h-3.5 w-3.5" />}
              onClick={() => void handleInstallClick()}
            >
              {hasNativePrompt ? 'Install now' : 'How to install'}
            </Button>
          )}
        </div>
      </div>

      <AndroidInstallGuideDialog
        open={guideOpen}
        onOpenChange={setGuideOpen}
        isEmbedded={isEmbedded}
      />
    </>
  );
};

const AndroidInstallGuideDialog: React.FC<{
  open: boolean;
  onOpenChange: (open: boolean) => void;
  isEmbedded: boolean;
}> = ({ open, onOpenChange, isEmbedded }) => (
  <Dialog
    open={open}
    onOpenChange={onOpenChange}
    title="Install WhatsApp on Android"
    description="Follow these quick steps in Google Chrome on your Android phone."
    size="sm"
  >
    <ol className="space-y-2.5 text-xs text-text-secondary">
      {isEmbedded && (
        <li className="rounded-lg border border-warning/30 bg-warning/10 p-2.5 text-text-primary">
          <span className="font-semibold">1. Open in standalone Chrome tab:</span> Installing an
          Android WebAPK requires opening the app URL directly in Chrome (not inside a preview iframe).
        </li>
      )}
      <li className="flex items-start gap-2">
        <span className="font-bold text-brand">{isEmbedded ? '2.' : '1.'}</span>
        <span>
          In Chrome on Android, tap the{' '}
          <span className="inline-flex items-center font-semibold text-text-primary">
            <MoreVertical className="mx-0.5 h-3.5 w-3.5" aria-hidden="true" /> Menu
          </span>{' '}
          button in the top-right corner.
        </span>
      </li>
      <li className="flex items-start gap-2">
        <span className="font-bold text-brand">{isEmbedded ? '3.' : '2.'}</span>
        <span>
          Tap <strong className="text-text-primary">Install app</strong> or{' '}
          <strong className="text-text-primary">Add to Home screen</strong>, then confirm{' '}
          <strong className="text-text-primary">Install</strong>.
        </span>
      </li>
      <li className="flex items-start gap-2">
        <span className="font-bold text-brand">{isEmbedded ? '4.' : '3.'}</span>
        <span>
          Open WhatsApp from your Android launcher and enable{' '}
          <strong className="text-text-primary">Settings &rarr; Notifications</strong> to receive
          background alerts.
        </span>
      </li>
    </ol>
  </Dialog>
);
