import { useEffect } from 'react';
import { WINDOWS } from '@/config/constants';
import { useAuthStore } from '@/features/auth';
import { writePresenceState } from './presence.service';

export function usePresenceHeartbeat(): void {
  const uid = useAuthStore((s) => s.authUser?.uid ?? null);
  const lastSeenPolicy = useAuthStore((s) => s.settings?.privacy.lastSeen ?? 'everyone');

  useEffect(() => {
    if (!uid) return;

    const pushOnline = () => {
      if (document.visibilityState === 'visible') {
        void writePresenceState(uid, lastSeenPolicy === 'nobody' ? 'offline' : 'online').catch(
          () => undefined,
        );
      }
    };

    const pushOffline = () => {
      void writePresenceState(uid, 'offline').catch(() => undefined);
    };

    pushOnline();
    const interval = window.setInterval(pushOnline, WINDOWS.PRESENCE_HEARTBEAT_MS);

    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        pushOnline();
      } else {
        pushOffline();
      }
    };

    document.addEventListener('visibilitychange', onVisibilityChange);
    window.addEventListener('pagehide', pushOffline);

    return () => {
      window.clearInterval(interval);
      document.removeEventListener('visibilitychange', onVisibilityChange);
      window.removeEventListener('pagehide', pushOffline);
      pushOffline();
    };
  }, [uid, lastSeenPolicy]);
}
