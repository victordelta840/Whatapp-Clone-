import { initializeApp, getApps, type FirebaseApp } from 'firebase/app';
import {
  initializeAuth,
  getAuth,
  indexedDBLocalPersistence,
  browserLocalPersistence,
  connectAuthEmulator,
  type Auth,
} from 'firebase/auth';
import {
  initializeFirestore,
  getFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
  memoryLocalCache,
  connectFirestoreEmulator,
  enableNetwork,
  doc,
  getDocFromServer,
  type Firestore,
} from 'firebase/firestore';
import { getStorage, connectStorageEmulator, type FirebaseStorage } from 'firebase/storage';
import { getFunctions, connectFunctionsEmulator, type Functions } from 'firebase/functions';
import { getMessaging, isSupported as isMessagingSupported, type Messaging } from 'firebase/messaging';
import { getEnvConfig } from './env';
import { initAppCheck } from './appCheck';

export interface FirebaseHandles {
  app: FirebaseApp;
  auth: Auth;
  db: Firestore;
  storage: FirebaseStorage;
  functions: Functions;
  persistenceMode: 'indexeddb-multi-tab' | 'memory-fallback';
  usingEmulators: boolean;
}

let handles: FirebaseHandles | null = null;
let messagingPromise: Promise<Messaging | null> | null = null;

function isEmbeddedIframe(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return window.self !== window.top;
  } catch {
    return true;
  }
}

function createFirebaseHandles(): FirebaseHandles | null {
  const config = getEnvConfig();
  if (!config) return null;

  if (handles) return handles;

  const existingApps = getApps();
  const app =
    existingApps[0] ??
    initializeApp({
      apiKey: config.apiKey,
      authDomain: config.authDomain,
      projectId: config.projectId,
      storageBucket: config.storageBucket,
      messagingSenderId: config.messagingSenderId,
      appId: config.appId,
    });

  // Initialize App Check before any other Firebase service call
  initAppCheck(app, config);

  let auth: Auth;
  try {
    auth = initializeAuth(app, {
      persistence: [indexedDBLocalPersistence, browserLocalPersistence],
    });
  } catch {
    auth = getAuth(app);
  }

  let db: Firestore;
  let persistenceMode: 'indexeddb-multi-tab' | 'memory-fallback' = 'indexeddb-multi-tab';
  const dbId = config.firestoreDatabaseId || undefined;
  const isRealBrowser =
    typeof window !== 'undefined' &&
    typeof navigator !== 'undefined' &&
    !/jsdom/i.test(navigator.userAgent);
  const canUseIndexedDb = typeof indexedDB !== 'undefined' && !isEmbeddedIframe();
  const transportSettings = isRealBrowser ? { experimentalForceLongPolling: true } : {};

  if (canUseIndexedDb) {
    try {
      db = initializeFirestore(
        app,
        {
          localCache: persistentLocalCache({
            tabManager: persistentMultipleTabManager(),
          }),
          ...transportSettings,
        },
        dbId,
      );
    } catch {
      try {
        persistenceMode = 'memory-fallback';
        db = initializeFirestore(
          app,
          {
            localCache: memoryLocalCache(),
            ...transportSettings,
          },
          dbId,
        );
      } catch {
        db = dbId ? getFirestore(app, dbId) : getFirestore(app);
      }
    }
  } else {
    persistenceMode = 'memory-fallback';
    try {
      db = initializeFirestore(
        app,
        {
          localCache: memoryLocalCache(),
          ...transportSettings,
        },
        dbId,
      );
    } catch {
      db = dbId ? getFirestore(app, dbId) : getFirestore(app);
    }
  }

  const storage = getStorage(app);
  const functions = getFunctions(app, config.functionsRegion);

  if (config.useEmulators) {
    connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
    connectFirestoreEmulator(db, '127.0.0.1', 8080);
    connectStorageEmulator(storage, '127.0.0.1', 9199);
    connectFunctionsEmulator(functions, '127.0.0.1', 5001);
  }

  handles = {
    app,
    auth,
    db,
    storage,
    functions,
    persistenceMode,
    usingEmulators: config.useEmulators,
  };

  // Validate Firestore connectivity on startup without failing silently on permission errors
  void testFirestoreConnection(db, auth);

  return handles;
}

async function testFirestoreConnection(db: Firestore, auth: Auth): Promise<void> {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    return;
  }

  await auth.authStateReady().catch(() => undefined);

  const attemptProbe = () => getDocFromServer(doc(db, 'test', 'connection'));

  try {
    await attemptProbe();
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      await enableNetwork(db).catch(() => undefined);
      await new Promise((resolve) => setTimeout(resolve, 2000));
      if (typeof navigator !== 'undefined' && navigator.onLine === false) {
        return;
      }
      try {
        await attemptProbe();
      } catch (retryError) {
        if (retryError instanceof Error && retryError.message.includes('the client is offline')) {
          console.error('Firestore unreachable (client is offline). Check Firebase configuration.');
        }
      }
    }
  }
}

export function getFirebaseHandles(): FirebaseHandles | null {
  return createFirebaseHandles();
}

export function requireFirebaseHandles(): FirebaseHandles {
  const h = createFirebaseHandles();
  if (!h) {
    throw new Error('Firebase is not configured. Check environment variables.');
  }
  return h;
}

export async function getFirebaseMessaging(): Promise<Messaging | null> {
  const h = createFirebaseHandles();
  if (!h) return null;
  if (!messagingPromise) {
    messagingPromise = isMessagingSupported()
      .then((supported) => (supported ? getMessaging(h.app) : null))
      .catch(() => null);
  }
  return messagingPromise;
}
