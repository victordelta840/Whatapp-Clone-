import { useEffect, useState } from 'react';
import { onSnapshot } from 'firebase/firestore';
import { refs } from '@/config/refs';
import { useAuthStore } from '@/features/auth';
import type { PresenceDoc } from '@/types';
import { formatLastSeenLabel, isPresenceOnline } from './presence.service';

export function useUserPresence(targetUid: string | null) {
  const myUid = useAuthStore((s) => s.authUser?.uid ?? null);
  const myLastSeenSetting = useAuthStore((s) => s.settings?.privacy.lastSeen ?? 'everyone');
  const [docState, setDocState] = useState<{ uid: string | null; doc: PresenceDoc | null }>({
    uid: null,
    doc: null,
  });
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const timer = window.setInterval(() => setTick((t) => t + 1), 30_000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!targetUid || !myUid || myLastSeenSetting === 'nobody') {
      return;
    }
    const unsub = onSnapshot(
      refs.presenceDoc(targetUid),
      (snap) => {
        setDocState({ uid: targetUid, doc: snap.exists() ? snap.data() : null });
      },
      () => {
        setDocState({ uid: targetUid, doc: null });
      },
    );
    return unsub;
  }, [targetUid, myUid, myLastSeenSetting]);

  void tick;
  const doc = docState.uid === targetUid ? docState.doc : null;
  const visible = Boolean(targetUid && myUid && myLastSeenSetting !== 'nobody' && doc !== null);
  return {
    visible,
    online: visible && doc ? isPresenceOnline(doc) : false,
    label: visible && doc ? formatLastSeenLabel(doc) : '',
  };
}
