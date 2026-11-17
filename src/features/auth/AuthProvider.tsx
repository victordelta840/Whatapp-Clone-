import React, { useEffect } from 'react';
import { onAuthStateChanged, onIdTokenChanged } from 'firebase/auth';
import { doc, onSnapshot } from 'firebase/firestore';
import { getFirebaseHandles } from '@/config/firebase';
import { refs } from '@/config/refs';
import { useTheme } from '@/hooks/useTheme';
import { logger } from '@/lib/logger';
import { detachAllSubscriptions } from '@/hooks/useFirestoreSubscription';
import { signOutCleanly } from './auth.service';
import { useAuthStore } from './authStore';

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { setTheme } = useTheme();

  useEffect(() => {
    const handles = getFirebaseHandles();
    if (!handles) {
      useAuthStore.getState().setAuthReady(true);
      return;
    }

    let unsubProfile: (() => void) | null = null;
    let unsubPhoto: (() => void) | null = null;
    let unsubAbout: (() => void) | null = null;
    let unsubSettings: (() => void) | null = null;
    let unsubAccountRevoke: (() => void) | null = null;
    let sessionBootMs = Date.now();

    const detachProfileListeners = () => {
      unsubProfile?.();
      unsubPhoto?.();
      unsubAbout?.();
      unsubSettings?.();
      unsubAccountRevoke?.();
      unsubProfile = null;
      unsubPhoto = null;
      unsubAbout = null;
      unsubSettings = null;
      unsubAccountRevoke = null;
    };

    const unsubAuth = onAuthStateChanged(handles.auth, (user) => {
      const store = useAuthStore.getState();
      detachProfileListeners();

      if (!user) {
        detachAllSubscriptions();
        store.reset();
        store.setAuthReady(true);
        return;
      }

      sessionBootMs = Date.now();
      store.setAuthUser(user);

      unsubProfile = onSnapshot(
        refs.userDoc(user.uid),
        (snap) => {
          if (snap.exists()) {
            store.setProfileData({ profile: { ...snap.data(), uid: snap.id } });
          } else {
            store.setProfileData({ profile: null });
            store.setNeedsOnboarding(true);
          }
          store.setAuthReady(true);
        },
        (err) => {
          logger.error('Failed to subscribe to user profile', err);
          store.setAuthReady(true);
        },
      );

      unsubPhoto = onSnapshot(
        refs.restrictedPhotoDoc(user.uid),
        (snap) => {
          store.setProfileData({
            profile: useAuthStore.getState().profile,
            photo: snap.exists() ? snap.data() : null,
          });
        },
        () => undefined,
      );

      unsubAbout = onSnapshot(
        refs.restrictedAboutDoc(user.uid),
        (snap) => {
          store.setProfileData({
            profile: useAuthStore.getState().profile,
            about: snap.exists() ? snap.data() : null,
          });
        },
        () => undefined,
      );

      unsubSettings = onSnapshot(
        refs.settingsDoc(user.uid),
        (snap) => {
          if (snap.exists()) {
            const s = snap.data();
            store.setProfileData({
              profile: useAuthStore.getState().profile,
              settings: s,
            });
            setTheme(s.theme);
          }
        },
        () => undefined,
      );

      // Watch forced session revocation timestamp
      unsubAccountRevoke = onSnapshot(
        doc(handles.db, 'users', user.uid, 'private', 'account'),
        (snap) => {
          const revokedAt = snap.data()?.sessionsRevokedAt?.toMillis?.() as number | undefined;
          if (revokedAt && revokedAt > sessionBootMs + 2000) {
            void signOutCleanly();
          }
        },
        () => undefined,
      );
    });

    const unsubToken = onIdTokenChanged(handles.auth, async (user) => {
      if (user) {
        try {
          await user.getIdToken();
        } catch {
          // Force sign-out if refresh token was revoked server-side
          void signOutCleanly();
        }
      }
    });

    return () => {
      detachProfileListeners();
      unsubAuth();
      unsubToken();
    };
  }, [setTheme]);

  return <>{children}</>;
};
