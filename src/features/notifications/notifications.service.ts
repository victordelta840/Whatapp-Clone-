import { useEffect, useState } from 'react';
import { deleteDoc, limit, onSnapshot, orderBy, query, serverTimestamp, setDoc, updateDoc } from 'firebase/firestore';
import { getToken, isSupported, onMessage } from 'firebase/messaging';
import { PAGINATION } from '@/config/constants';
import { getEnvConfig } from '@/config/env';
import { getFirebaseHandles } from '@/config/firebase';
import { refs } from '@/config/refs';
import { getOrCreateDeviceId } from '@/lib/idb';
import { getServiceWorkerRegistration } from '@/lib/pwa';
import { toast } from '@/components/ui';
import { useAuthStore } from '@/features/auth';
import type { NotificationDoc } from '@/types';

export async function enablePushNotifications(): Promise<{
  granted: boolean;
  reason?: string;
}> {
  if (typeof Notification === 'undefined') {
    return { granted: false, reason: 'Web Notifications API is not supported in this browser.' };
  }

  const permission = await Notification.requestPermission();
  if (permission !== 'granted') {
    return { granted: false, reason: 'Notification permission was not granted.' };
  }

  const env = getEnvConfig();
  const handles = getFirebaseHandles();
  const uid = handles?.auth.currentUser?.uid;
  if (!handles || !uid) {
    return { granted: false, reason: 'Sign in required to register device notifications.' };
  }

  const deviceId = await getOrCreateDeviceId();
  let fcmToken: string | null = null;
  let reason: string | undefined;

  if (!env?.vapidKey) {
    reason =
      'Permission granted, but VITE_FIREBASE_VAPID_KEY is unset. Remote background push requires external VAPID configuration.';
  } else if (await isSupported().catch(() => false)) {
    try {
      const { getMessaging } = await import('firebase/messaging');
      const messaging = getMessaging(handles.app);
      const swReg = getServiceWorkerRegistration() ?? undefined;
      fcmToken = await getToken(messaging, {
        vapidKey: env.vapidKey,
        serviceWorkerRegistration: swReg,
      });
    } catch (err) {
      reason = err instanceof Error ? err.message : 'Unable to fetch FCM push token.';
    }
  } else {
    reason = 'Firebase Cloud Messaging is not supported in this browser.';
  }

  await setDoc(refs.deviceDoc(uid, deviceId), {
    schemaVersion: 1,
    fcmToken,
    platform: navigator.platform || 'web',
    appVersion: '1.0.0',
    userAgentSummary: navigator.userAgent.slice(0, 150),
    notificationsEnabled: Boolean(fcmToken),
    createdAt: serverTimestamp(),
    lastSeenAt: serverTimestamp(),
  });

  return { granted: true, reason };
}

export function useForegroundPushListener(): void {
  const uid = useAuthStore((s) => s.authUser?.uid ?? null);

  useEffect(() => {
    if (!uid) return;
    const handles = getFirebaseHandles();
    if (!handles) return;

    let unsub: (() => void) | undefined;
    void isSupported().then(async (supported) => {
      if (!supported) return;
      const { getMessaging } = await import('firebase/messaging');
      const messaging = getMessaging(handles.app);
      unsub = onMessage(messaging, (payload) => {
        if (document.visibilityState === 'visible' && document.hasFocus()) {
          const title = payload.notification?.title ?? 'New activity';
          const body = payload.notification?.body ?? '';
          toast.info(body ? `${title}: ${body}` : title);
        }
      });
    });

    return () => {
      unsub?.();
    };
  }, [uid]);
}

export function updateAppBadgeCount(unreadCount: number): void {
  if (typeof navigator !== 'undefined' && 'setAppBadge' in navigator) {
    const nav = navigator as Navigator & {
      setAppBadge?: (count?: number) => Promise<void>;
      clearAppBadge?: () => Promise<void>;
    };
    if (unreadCount > 0) {
      void nav.setAppBadge?.(unreadCount).catch(() => undefined);
    } else {
      void nav.clearAppBadge?.().catch(() => undefined);
    }
  }
  if (typeof document !== 'undefined') {
    document.title = unreadCount > 0 ? `(${unreadCount}) WhatsApp` : 'WhatsApp';
  }
}

export function useNotificationsCenter() {
  const uid = useAuthStore((s) => s.authUser?.uid ?? null);
  const [items, setItems] = useState<Array<NotificationDoc & { id: string }>>([]);
  const [loading, setLoading] = useState(Boolean(uid));

  useEffect(() => {
    if (!uid) {
      return;
    }
    const q = query(
      refs.notificationsCol(uid),
      orderBy('createdAt', 'desc'),
      limit(PAGINATION.NOTIFICATIONS_PAGE_SIZE),
    );
    const unsub = onSnapshot(
      q,
      (snap) => {
        setItems(snap.docs.map((d) => ({ ...d.data(), id: d.id })));
        setLoading(false);
      },
      () => setLoading(false),
    );
    return unsub;
  }, [uid]);

  const visibleItems = uid ? items : [];
  const unreadCount = visibleItems.filter((n) => !n.read).length;

  const markRead = async (nid: string) => {
    if (!uid) return;
    await updateDoc(refs.notificationDoc(uid, nid), { read: true });
  };

  const removeNotification = async (nid: string) => {
    if (!uid) return;
    await deleteDoc(refs.notificationDoc(uid, nid));
  };

  return { items: visibleItems, unreadCount, loading: uid ? loading : false, markRead, removeNotification };
}
