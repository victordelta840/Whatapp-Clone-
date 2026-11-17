import { doc, getDoc, serverTimestamp, setDoc } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { ref, getDownloadURL } from 'firebase/storage';
import { getToken, isSupported as isMessagingSupported } from 'firebase/messaging';
import { verifyAppCheckToken } from '@/config/appCheck';
import { getEnvConfig } from '@/config/env';
import { getFirebaseHandles, getFirebaseMessaging } from '@/config/firebase';
import { mapFirebaseError } from '@/lib/errors';

export type DiagnosticStatus = 'pass' | 'fail' | 'requires-config' | 'requires-backend';

export interface DiagnosticCheckResult {
  id: string;
  label: string;
  status: DiagnosticStatus;
  detail: string;
}

export async function runDiagnostics(): Promise<DiagnosticCheckResult[]> {
  const results: DiagnosticCheckResult[] = [];
  const env = getEnvConfig();
  const handles = getFirebaseHandles();

  if (!env || !handles) {
    return [
      {
        id: 'env',
        label: 'Environment Configuration',
        status: 'requires-config',
        detail: 'Firebase web environment variables are missing.',
      },
    ];
  }

  // 1. Auth
  const currentUser = handles.auth.currentUser;
  results.push({
    id: 'auth',
    label: 'Firebase Authentication',
    status: currentUser ? 'pass' : 'fail',
    detail: currentUser
      ? `Signed in (${currentUser.providerData.map((p) => p.providerId).join(', ') || 'authenticated'}).`
      : 'No active user session. Sign in to run authenticated checks.',
  });

  // 2. Persistent Cache Mode
  results.push({
    id: 'persistent-cache',
    label: 'Firestore Persistent Cache',
    status: handles.persistenceMode === 'indexeddb-multi-tab' ? 'pass' : 'fail',
    detail:
      handles.persistenceMode === 'indexeddb-multi-tab'
        ? 'Multi-tab IndexedDB persistence active.'
        : 'Degraded to memory cache (IndexedDB unavailable, e.g., private browsing).',
  });

  // 3. Firestore Read/Write
  if (!currentUser) {
    results.push({
      id: 'firestore',
      label: 'Firestore Read / Write',
      status: 'fail',
      detail: 'Requires an active signed-in session to test user-scoped read/write rules.',
    });
  } else {
    try {
      const diagRef = doc(handles.db, 'users', currentUser.uid, 'restricted', 'about');
      const snap = await getDoc(diagRef);
      if (!snap.exists()) {
        await setDoc(diagRef, {
          schemaVersion: 1,
          text: 'Available',
          updatedAt: serverTimestamp(),
        });
      }
      results.push({
        id: 'firestore',
        label: 'Firestore Read / Write',
        status: 'pass',
        detail: `Connected to database ${env.firestoreDatabaseId || '(default)'}; security rules read succeeded.`,
      });
    } catch (err) {
      const mapped = mapFirebaseError(err);
      results.push({
        id: 'firestore',
        label: 'Firestore Read / Write',
        status: 'fail',
        detail: mapped.userMessage,
      });
    }
  }

  // 4. Storage Reachability
  if (!currentUser) {
    results.push({
      id: 'storage',
      label: 'Cloud Storage Reachability',
      status: 'fail',
      detail: 'Sign in required to test Storage rules.',
    });
  } else {
    try {
      const probeRef = ref(handles.storage, `profilePhotos/${currentUser.uid}/probe.txt`);
      await getDownloadURL(probeRef);
      results.push({
        id: 'storage',
        label: 'Cloud Storage Reachability',
        status: 'pass',
        detail: `Storage bucket ${env.storageBucket} reachable.`,
      });
    } catch (err) {
      const code = (err as { code?: string })?.code ?? '';
      if (code === 'storage/object-not-found') {
        results.push({
          id: 'storage',
          label: 'Cloud Storage Reachability',
          status: 'pass',
          detail: `Storage bucket ${env.storageBucket} reachable (rules evaluated cleanly).`,
        });
      } else {
        results.push({
          id: 'storage',
          label: 'Cloud Storage Reachability',
          status: 'fail',
          detail: mapFirebaseError(err).userMessage,
        });
      }
    }
  }

  // 5. App Check
  const appCheckStatus = await verifyAppCheckToken();
  results.push({
    id: 'app-check',
    label: 'App Check Token Acquisition',
    status:
      appCheckStatus.status === 'verified'
        ? 'pass'
        : appCheckStatus.status === 'requires-config'
          ? 'requires-config'
          : 'fail',
    detail: appCheckStatus.message,
  });

  // 6. Functions Ping Callable
  if (!currentUser) {
    results.push({
      id: 'functions-ping',
      label: 'Cloud Functions (ping)',
      status: 'requires-backend',
      detail: 'Sign in and deploy 2nd-gen Cloud Functions to verify the ping callable.',
    });
  } else {
    try {
      const pingFn = httpsCallable<{ echo: string }, { ok: boolean; region: string }>(
        handles.functions,
        'ping',
      );
      const res = await pingFn({ echo: 'diagnostics' });
      results.push({
        id: 'functions-ping',
        label: 'Cloud Functions (ping)',
        status: res.data.ok ? 'pass' : 'fail',
        detail: res.data.ok
          ? `Callable responded from ${res.data.region}.`
          : 'Unexpected ping response.',
      });
    } catch (err) {
      results.push({
        id: 'functions-ping',
        label: 'Cloud Functions (ping)',
        status: 'requires-backend',
        detail: `Requires backend deployment (${mapFirebaseError(err).userMessage})`,
      });
    }
  }

  // 7. Service Worker State
  if (typeof navigator !== 'undefined' && 'serviceWorker' in navigator) {
    try {
      const reg = await navigator.serviceWorker.getRegistration();
      results.push({
        id: 'service-worker',
        label: 'Service Worker State',
        status: reg?.active ? 'pass' : 'fail',
        detail: reg?.active
          ? `Active (${reg.scope}).`
          : 'No active service worker yet (may be restricted in preview iframe).',
      });
    } catch {
      results.push({
        id: 'service-worker',
        label: 'Service Worker State',
        status: 'fail',
        detail: 'Service Worker API blocked in this browsing context.',
      });
    }
  } else {
    results.push({
      id: 'service-worker',
      label: 'Service Worker State',
      status: 'fail',
      detail: 'Service workers are not supported in this browser.',
    });
  }

  // 8. Notification Permission
  if (typeof Notification === 'undefined') {
    results.push({
      id: 'notifications',
      label: 'Notification Permission',
      status: 'fail',
      detail: 'Notifications API is unavailable on this browser/platform (e.g., non-installed iOS Safari).',
    });
  } else {
    results.push({
      id: 'notifications',
      label: 'Notification Permission',
      status: Notification.permission === 'granted' ? 'pass' : 'fail',
      detail:
        Notification.permission === 'granted'
          ? 'Granted.'
          : Notification.permission === 'denied'
            ? 'Denied in browser/OS settings. Re-enable in site permissions.'
            : 'Not requested yet.',
    });
  }

  // 9. FCM Token Registration
  const messagingSupported = await isMessagingSupported().catch(() => false);
  if (!env.vapidKey) {
    results.push({
      id: 'fcm',
      label: 'FCM Token Registration',
      status: 'requires-config',
      detail: 'Requires external configuration: set VITE_FIREBASE_VAPID_KEY.',
    });
  } else if (!messagingSupported) {
    results.push({
      id: 'fcm',
      label: 'FCM Token Registration',
      status: 'fail',
      detail: 'Firebase Messaging is not supported in this context.',
    });
  } else if (typeof Notification === 'undefined' || Notification.permission !== 'granted') {
    results.push({
      id: 'fcm',
      label: 'FCM Token Registration',
      status: 'fail',
      detail: 'Grant notification permission first to register an FCM token.',
    });
  } else {
    try {
      const messaging = await getFirebaseMessaging();
      const swReg = await navigator.serviceWorker.getRegistration();
      if (messaging && swReg) {
        const token = await getToken(messaging, {
          vapidKey: env.vapidKey,
          serviceWorkerRegistration: swReg,
        });
        results.push({
          id: 'fcm',
          label: 'FCM Token Registration',
          status: token ? 'pass' : 'fail',
          detail: token ? 'FCM Web Push token acquired.' : 'No FCM token returned.',
        });
      } else {
        results.push({
          id: 'fcm',
          label: 'FCM Token Registration',
          status: 'fail',
          detail: 'Service worker registration required for FCM.',
        });
      }
    } catch (err) {
      results.push({
        id: 'fcm',
        label: 'FCM Token Registration',
        status: 'fail',
        detail: mapFirebaseError(err).userMessage,
      });
    }
  }

  // 10. TURN Credential Retrieval
  if (!currentUser) {
    results.push({
      id: 'turn',
      label: 'TURN Credential Retrieval',
      status: 'requires-backend',
      detail: 'Sign in and deploy getIceServers to test TURN credentials.',
    });
  } else {
    try {
      const iceFn = httpsCallable<
        { mode: 'diagnostics' },
        { iceServers: RTCIceServer[]; turnConfigured: boolean }
      >(handles.functions, 'getIceServers');
      const res = await iceFn({ mode: 'diagnostics' });
      results.push({
        id: 'turn',
        label: 'TURN Credential Retrieval',
        status: res.data.turnConfigured ? 'pass' : 'requires-config',
        detail: res.data.turnConfigured
          ? `Short-lived TURN credentials returned (${res.data.iceServers.length} ICE server entries).`
          : 'STUN only; TURN secrets not configured on Cloud Functions.',
      });
    } catch {
      results.push({
        id: 'turn',
        label: 'TURN Credential Retrieval',
        status: 'requires-backend',
        detail: 'Requires backend deployment (getIceServers callable unreachable).',
      });
    }
  }

  return results;
}

export async function testTurnRelay(): Promise<{ ok: boolean; detail: string }> {
  const handles = getFirebaseHandles();
  if (!handles || !handles.auth.currentUser) {
    return { ok: false, detail: 'Sign in and deploy getIceServers before testing TURN relay.' };
  }
  try {
    const iceFn = httpsCallable<
      { mode: 'diagnostics' },
      { iceServers: RTCIceServer[]; turnConfigured: boolean }
    >(handles.functions, 'getIceServers');
    const res = await iceFn({ mode: 'diagnostics' });
    if (!res.data.turnConfigured) {
      return {
        ok: false,
        detail: 'TURN server secrets are not configured in Cloud Functions.',
      };
    }

    const pc = new RTCPeerConnection({
      iceServers: res.data.iceServers,
      iceTransportPolicy: 'relay',
    });

    return await new Promise((resolve) => {
      let gatheredRelay = false;
      const timer = setTimeout(() => {
        pc.close();
        resolve({
          ok: gatheredRelay,
          detail: gatheredRelay
            ? 'TURN relay ICE candidate gathered successfully.'
            : 'Timed out waiting for a TURN relay candidate.',
        });
      }, 6000);

      pc.onicecandidate = (event) => {
        if (event.candidate?.candidate.includes('typ relay')) {
          gatheredRelay = true;
          clearTimeout(timer);
          pc.close();
          resolve({
            ok: true,
            detail: 'TURN relay ICE candidate gathered successfully.',
          });
        }
      };

      pc.createDataChannel('turn-probe');
      void pc
        .createOffer()
        .then((offer) => pc.setLocalDescription(offer))
        .catch((err) => {
          clearTimeout(timer);
          pc.close();
          resolve({
            ok: false,
            detail: err instanceof Error ? err.message : 'Failed to create probe offer.',
          });
        });
    });
  } catch (err) {
    return {
      ok: false,
      detail: `Requires backend deployment (${mapFirebaseError(err).userMessage})`,
    };
  }
}
