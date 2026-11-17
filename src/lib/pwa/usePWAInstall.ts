import { useEffect, useState } from 'react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

const DISMISS_KEY = 'converse:pwa-install-dismissed';

export function usePWAInstall() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [dismissed, setDismissed] = useState(() => {
    try {
      return localStorage.getItem(DISMISS_KEY) === '1';
    } catch {
      return false;
    }
  });
  const [isStandalone, setIsStandalone] = useState(() =>
    typeof window !== 'undefined'
      ? window.matchMedia('(display-mode: standalone)').matches
      : false,
  );

  const ua = typeof navigator !== 'undefined' ? navigator.userAgent : '';
  const isAndroid = /android/i.test(ua);
  const isIosSafari =
    /iphone|ipad|ipod/i.test(ua) && !/crios|fxios|edgios/i.test(ua);
  const isEmbedded =
    typeof window !== 'undefined' ? window.self !== window.top : false;

  useEffect(() => {
    const onBeforeInstall = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };
    const onInstalled = () => {
      setDeferredPrompt(null);
      setIsStandalone(true);
    };

    window.addEventListener('beforeinstallprompt', onBeforeInstall);
    window.addEventListener('appinstalled', onInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstall);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  const triggerInstall = async (): Promise<boolean> => {
    if (!deferredPrompt) return false;
    await deferredPrompt.prompt();
    const res = await deferredPrompt.userChoice;
    setDeferredPrompt(null);
    return res.outcome === 'accepted';
  };

  const dismiss = () => {
    setDismissed(true);
    try {
      localStorage.setItem(DISMISS_KEY, '1');
    } catch {
      // ignore storage errors
    }
  };

  return {
    isAndroid,
    isIosSafari,
    isEmbedded,
    isStandalone,
    hasNativePrompt: Boolean(deferredPrompt),
    canPromptInstall: Boolean(deferredPrompt) && !isStandalone && !dismissed,
    showAndroidManualHint: isAndroid && !isStandalone && !dismissed && !deferredPrompt,
    showIosHint: isIosSafari && !isStandalone && !dismissed && !deferredPrompt,
    triggerInstall,
    dismiss,
  };
}
