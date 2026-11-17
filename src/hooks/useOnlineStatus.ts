import { useEffect, useState } from 'react';

export type ConnectionState = 'online' | 'offline' | 'connecting';

export function useOnlineStatus(): {
  isOnline: boolean;
  connectionState: ConnectionState;
  setFirestoreSyncing: (syncing: boolean) => void;
} {
  const [navigatorOnline, setNavigatorOnline] = useState<boolean>(() =>
    typeof navigator !== 'undefined' ? navigator.onLine : true,
  );
  const [firestoreSyncing, setFirestoreSyncing] = useState(false);

  useEffect(() => {
    const handleOnline = () => setNavigatorOnline(true);
    const handleOffline = () => setNavigatorOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const connectionState: ConnectionState = !navigatorOnline
    ? 'offline'
    : firestoreSyncing
      ? 'connecting'
      : 'online';

  return {
    isOnline: navigatorOnline,
    connectionState,
    setFirestoreSyncing,
  };
}
