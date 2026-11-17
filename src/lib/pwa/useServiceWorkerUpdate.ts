import { useEffect, useState } from 'react';
import { logger } from '@/lib/logger';

let swRegistrationRef: ServiceWorkerRegistration | null = null;

export function getServiceWorkerRegistration(): ServiceWorkerRegistration | null {
  return swRegistrationRef;
}

export function useServiceWorkerUpdate() {
  const [waitingWorker, setWaitingWorker] = useState<ServiceWorker | null>(null);

  useEffect(() => {
    if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return;
    let active = true;

    void navigator.serviceWorker
      .register('/sw.js')
      .then((reg) => {
        if (!active) return;
        swRegistrationRef = reg;
        if (reg.waiting) setWaitingWorker(reg.waiting);

        reg.addEventListener('updatefound', () => {
          const nextWorker = reg.installing;
          if (!nextWorker) return;
          nextWorker.addEventListener('statechange', () => {
            if (nextWorker.state === 'installed' && navigator.serviceWorker.controller) {
              setWaitingWorker(nextWorker);
            }
          });
        });
      })
      .catch((err) => {
        logger.info('Service worker registration skipped or unavailable', {
          reason: err instanceof Error ? err.message : 'unknown',
        });
      });

    return () => {
      active = false;
    };
  }, []);

  const applyUpdate = () => {
    if (!waitingWorker) return;
    waitingWorker.postMessage({ type: 'SKIP_WAITING' });
    window.location.reload();
  };

  return {
    updateReady: Boolean(waitingWorker),
    applyUpdate,
  };
}
