import {
  PhoneAuthProvider,
  RecaptchaVerifier,
  linkWithCredential,
  reauthenticateWithPhoneNumber,
  reload,
  signInWithPhoneNumber,
  signOut,
  type ConfirmationResult,
  type User,
} from 'firebase/auth';
import { deleteDoc, getDoc, serverTimestamp, setDoc } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { requireFirebaseHandles } from '@/config/firebase';
import { refs } from '@/config/refs';
import { detachAllSubscriptions } from '@/hooks/useFirestoreSubscription';
import { withCallableRetry } from '@/lib/errors';
import { clearUserLocalData, getOrCreateDeviceId } from '@/lib/idb';
import { logger } from '@/lib/logger';
import type { UserSettings } from '@/types';
import { useAuthStore } from './authStore';

export function isTrustedVerifiedUser(user: User | null): boolean {
  if (!user) return false;
  if (user.emailVerified) return true;
  return user.providerData.some(
    (p) => p.providerId === 'phone' || p.providerId === 'google.com',
  );
}

export function buildDefaultUserSettings(locale = 'en'): UserSettings {
  return {
    schemaVersion: 1,
    privacy: {
      lastSeen: 'everyone',
      onlineStatus: 'everyone',
      profilePhoto: 'everyone',
      about: 'everyone',
      readReceipts: true,
      typingIndicators: true,
      groupAdd: 'everyone',
      statusAudience: { mode: 'contacts', uids: [] },
      findableByUsername: true,
      findableByPhone: true,
      findableByEmail: false,
    },
    notifications: {
      messages: true,
      groups: true,
      calls: true,
      statusUpdates: true,
      showPreviews: true,
    },
    mutedStatusAuthors: [],
    theme: 'system',
    locale,
  };
}

async function withAuthBackoff<T>(fn: () => Promise<T>): Promise<T> {
  let attempt = 0;
  while (true) {
    try {
      return await fn();
    } catch (err) {
      const code = (err as { code?: string })?.code ?? '';
      if (code === 'auth/too-many-requests' && attempt < 2) {
        attempt += 1;
        await new Promise((r) => setTimeout(r, 800 * Math.pow(2, attempt)));
        continue;
      }
      throw err;
    }
  }
}

export async function ensureProfileBootstrapped(user: User, displayName?: string): Promise<boolean> {
  const { functions } = requireFirebaseHandles();
  const userSnap = await getDoc(refs.userDoc(user.uid));
  if (userSnap.exists()) {
    return false;
  }

  const fallbackName = (displayName || user.displayName || user.phoneNumber || 'WhatsApp User')
    .trim()
    .slice(0, 60);

  try {
    const bootstrapFn = httpsCallable<
      { displayName?: string; locale?: string },
      { ok: boolean; created: boolean }
    >(functions, 'bootstrapProfile');
    await withCallableRetry(() =>
      bootstrapFn({
        displayName: fallbackName,
        locale: 'en',
      }),
    );
    return true;
  } catch (err) {
    // Fallback to client-side owner creation when Cloud Functions are not yet deployed
    logger.warn('bootstrapProfile callable unavailable; creating owner profile documents directly', {
      reason: err instanceof Error ? err.message : 'unknown',
    });
    await setDoc(refs.userDoc(user.uid), {
      schemaVersion: 1,
      displayName: fallbackName,
      displayNameLower: fallbackName.toLowerCase(),
      username: null,
      createdAt: serverTimestamp() as unknown as never,
      updatedAt: serverTimestamp() as unknown as never,
    });
    await Promise.all([
      setDoc(refs.settingsDoc(user.uid), buildDefaultUserSettings('en')),
      setDoc(refs.restrictedAboutDoc(user.uid), {
        schemaVersion: 1,
        text: 'Hey there! I am using WhatsApp.',
        updatedAt: serverTimestamp() as unknown as never,
      }),
      setDoc(refs.restrictedPhotoDoc(user.uid), {
        schemaVersion: 1,
        photoPath: null,
        photoURL: user.photoURL ?? null,
        updatedAt: serverTimestamp() as unknown as never,
      }),
    ]);
    return true;
  }
}

export async function refreshAuthUser(): Promise<User | null> {
  const { auth } = requireFirebaseHandles();
  if (!auth.currentUser) return null;
  await reload(auth.currentUser);
  useAuthStore.getState().setAuthUser(auth.currentUser);
  return auth.currentUser;
}

export function createPhoneRecaptcha(
  containerId: string,
  size: 'invisible' | 'normal' = 'invisible',
): RecaptchaVerifier {
  const { auth } = requireFirebaseHandles();
  const container = document.getElementById(containerId);
  if (container) {
    container.innerHTML = '';
  }
  return new RecaptchaVerifier(auth, containerId, { size });
}

export function resetPhoneRecaptcha(
  verifier: RecaptchaVerifier | null,
  containerId?: string,
): void {
  if (verifier) {
    try {
      verifier.clear();
    } catch {
      // ignore widget teardown errors
    }
  }
  if (containerId) {
    const container = document.getElementById(containerId);
    if (container) {
      container.innerHTML = '';
    }
  }
}

export async function startPhoneSignIn(
  phoneE164: string,
  verifier: RecaptchaVerifier,
): Promise<ConfirmationResult> {
  const { auth } = requireFirebaseHandles();
  return withAuthBackoff(() => signInWithPhoneNumber(auth, phoneE164, verifier));
}

export async function confirmPhoneCode(
  confirmation: ConfirmationResult,
  code: string,
): Promise<{ user: User; isNewAccount: boolean }> {
  const cred = await confirmation.confirm(code);
  const created = await ensureProfileBootstrapped(cred.user);
  if (created) {
    useAuthStore.getState().setNeedsOnboarding(true);
  }
  return { user: cred.user, isNewAccount: created };
}

export async function startPhoneReauthentication(
  verifier: RecaptchaVerifier,
): Promise<ConfirmationResult> {
  const { auth } = requireFirebaseHandles();
  const user = auth.currentUser;
  if (!user || !user.phoneNumber) {
    throw new Error('No verified phone number is linked to this session.');
  }
  return withAuthBackoff(() => reauthenticateWithPhoneNumber(user, user.phoneNumber!, verifier));
}

export async function confirmPhoneReauthentication(
  confirmation: ConfirmationResult,
  code: string,
): Promise<void> {
  await confirmation.confirm(code);
}

export async function linkPhoneNumberProvider(
  phoneE164: string,
  verifier: RecaptchaVerifier,
): Promise<{ confirm: (code: string) => Promise<void> }> {
  const { auth } = requireFirebaseHandles();
  if (!auth.currentUser) throw new Error('Sign in required.');
  const provider = new PhoneAuthProvider(auth);
  const verificationId = await provider.verifyPhoneNumber(phoneE164, verifier);
  return {
    confirm: async (code: string) => {
      if (!auth.currentUser) throw new Error('Sign in required.');
      const cred = PhoneAuthProvider.credential(verificationId, code);
      await linkWithCredential(auth.currentUser, cred);
      await reload(auth.currentUser);
      useAuthStore.getState().setAuthUser(auth.currentUser);
    },
  };
}

export async function signOutCleanly(): Promise<void> {
  const { auth } = requireFirebaseHandles();
  const uid = auth.currentUser?.uid;
  detachAllSubscriptions();
  if (uid) {
    try {
      const deviceId = await getOrCreateDeviceId();
      await deleteDoc(refs.deviceDoc(uid, deviceId)).catch(() => undefined);
    } catch {
      // ignore device cleanup failure
    }
    await clearUserLocalData(uid).catch(() => undefined);
  }
  useAuthStore.getState().reset();
  await signOut(auth);
}

export async function revokeAllUserSessions(): Promise<void> {
  const { functions } = requireFirebaseHandles();
  const revokeFn = httpsCallable<undefined, { ok: boolean }>(functions, 'revokeAllSessions');
  await revokeFn();
  await signOutCleanly();
}

export async function requestDataExport(): Promise<{ storagePath: string }> {
  const { functions } = requireFirebaseHandles();
  const fn = httpsCallable<undefined, { ok: boolean; storagePath: string }>(
    functions,
    'exportMyData',
  );
  const res = await fn();
  return { storagePath: res.data.storagePath };
}

export async function deleteAccountPermanently(): Promise<void> {
  const { functions } = requireFirebaseHandles();
  const fn = httpsCallable<{ confirmation: 'DELETE MY ACCOUNT' }, { ok: boolean }>(
    functions,
    'deleteMyAccount',
  );
  await fn({ confirmation: 'DELETE MY ACCOUNT' });
  await signOutCleanly();
}
