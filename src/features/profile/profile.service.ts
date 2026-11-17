import { getDoc, serverTimestamp, setDoc, updateDoc } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { deleteObject, getDownloadURL, ref, uploadBytes } from 'firebase/storage';
import { MEDIA_LIMITS } from '@/config/constants';
import { requireFirebaseHandles } from '@/config/firebase';
import { refs } from '@/config/refs';
import { withCallableRetry } from '@/lib/errors';
import { processImageFile } from '@/lib/media/imageProcessor';
import type { RestrictedAbout, RestrictedPhoto, UserProfile } from '@/types';

export interface HydratedUserSummary {
  uid: string;
  profile: UserProfile | null;
  photoURL: string | null;
  aboutText: string | null;
}

const profileCache = new Map<string, HydratedUserSummary>();

export async function fetchUserSummary(uid: string, force = false): Promise<HydratedUserSummary> {
  if (!force && profileCache.has(uid)) {
    return profileCache.get(uid)!;
  }

  let profile: UserProfile | null = null;
  let photo: RestrictedPhoto | null = null;
  let about: RestrictedAbout | null = null;

  try {
    const snap = await getDoc(refs.userDoc(uid));
    if (snap.exists()) {
      profile = { ...snap.data(), uid: snap.id };
    }
  } catch {
    profile = null;
  }

  try {
    const snap = await getDoc(refs.restrictedPhotoDoc(uid));
    if (snap.exists()) photo = snap.data();
  } catch {
    // Restricted by owner's privacy settings
    photo = null;
  }

  try {
    const snap = await getDoc(refs.restrictedAboutDoc(uid));
    if (snap.exists()) about = snap.data();
  } catch {
    // Restricted by owner's privacy settings
    about = null;
  }

  const summary: HydratedUserSummary = {
    uid,
    profile,
    photoURL: photo?.photoURL ?? null,
    aboutText: about?.text ?? null,
  };
  profileCache.set(uid, summary);
  return summary;
}

export function invalidateUserCache(uid: string): void {
  profileCache.delete(uid);
}

export async function updateProfileDetails(
  uid: string,
  payload: { displayName: string; aboutText: string },
): Promise<void> {
  const cleanName = payload.displayName.trim();
  await updateDoc(refs.userDoc(uid), {
    displayName: cleanName,
    displayNameLower: cleanName.toLowerCase(),
    updatedAt: serverTimestamp() as unknown as never,
  });
  await setDoc(refs.restrictedAboutDoc(uid), {
    schemaVersion: 1,
    text: payload.aboutText.trim(),
    updatedAt: serverTimestamp() as unknown as never,
  });
  invalidateUserCache(uid);
}

export async function uploadProfilePhoto(uid: string, file: File): Promise<string> {
  const { storage } = requireFirebaseHandles();
  const processed = await processImageFile(
    file,
    MEDIA_LIMITS.PROFILE_PHOTO_MAX_EDGE,
    0.85,
  );
  if (processed.blob.size > MEDIA_LIMITS.PROFILE_PHOTO_MAX_BYTES) {
    throw new Error('Processed profile photo exceeds 5 MB.');
  }
  const storagePath = `profilePhotos/${uid}/avatar_${Date.now()}.jpg`;
  const storageRef = ref(storage, storagePath);
  await uploadBytes(storageRef, processed.blob, { contentType: processed.mimeType });
  const photoURL = await getDownloadURL(storageRef);

  const prevSnap = await getDoc(refs.restrictedPhotoDoc(uid)).catch(() => null);
  const prevPath = prevSnap?.exists() ? prevSnap.data().photoPath : null;

  await setDoc(refs.restrictedPhotoDoc(uid), {
    schemaVersion: 1,
    photoPath: storagePath,
    photoURL,
    updatedAt: serverTimestamp() as unknown as never,
  });

  if (prevPath && prevPath !== storagePath) {
    await deleteObject(ref(storage, prevPath)).catch(() => undefined);
  }
  invalidateUserCache(uid);
  return photoURL;
}

export async function removeProfilePhoto(uid: string): Promise<void> {
  const { storage } = requireFirebaseHandles();
  const prevSnap = await getDoc(refs.restrictedPhotoDoc(uid)).catch(() => null);
  const prevPath = prevSnap?.exists() ? prevSnap.data().photoPath : null;

  await setDoc(refs.restrictedPhotoDoc(uid), {
    schemaVersion: 1,
    photoPath: null,
    photoURL: null,
    updatedAt: serverTimestamp() as unknown as never,
  });

  if (prevPath) {
    await deleteObject(ref(storage, prevPath)).catch(() => undefined);
  }
  invalidateUserCache(uid);
}

export async function claimUsername(username: string): Promise<string | null> {
  const { functions } = requireFirebaseHandles();
  const fn = httpsCallable<{ username: string | null }, { ok: boolean; username: string | null }>(
    functions,
    'updateUsername',
  );
  const res = await withCallableRetry(() => fn({ username: username || null }));
  return res.data.username;
}

export async function lookupUserByIdentifier(identifier: string): Promise<{
  found: boolean;
  uid?: string;
  displayName?: string;
  username?: string | null;
  photoURL?: string | null;
  about?: string | null;
}> {
  const { functions } = requireFirebaseHandles();
  const fn = httpsCallable<
    { identifier: string },
    {
      found: boolean;
      uid?: string;
      displayName?: string;
      username?: string | null;
      photoURL?: string | null;
      about?: string | null;
    }
  >(functions, 'lookupUser');
  const res = await withCallableRetry(() => fn({ identifier }));
  return res.data;
}
