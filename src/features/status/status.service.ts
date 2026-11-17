import { deleteDoc, getDoc, serverTimestamp, setDoc, updateDoc } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { getDownloadURL, ref, uploadBytes } from 'firebase/storage';
import { LIMITS } from '@/config/constants';
import { requireFirebaseHandles } from '@/config/firebase';
import { refs } from '@/config/refs';
import { withCallableRetry } from '@/lib/errors';
import { captureVideoThumbnail, processImageFile } from '@/lib/media/imageProcessor';
import type { MediaPayload, UserSettings } from '@/types';

export async function createTextStatus(payload: {
  text: string;
  backgroundColor: string;
  fontStyle: string;
}): Promise<string> {
  const { functions } = requireFirebaseHandles();
  const fn = httpsCallable<
    {
      type: 'text';
      text: string;
      backgroundColor: string;
      fontStyle: string;
    },
    { ok: boolean; statusId: string }
  >(functions, 'createStatus');
  const res = await withCallableRetry(() =>
    fn({
      type: 'text',
      text: payload.text.trim().slice(0, LIMITS.STATUS_TEXT_MAX),
      backgroundColor: payload.backgroundColor,
      fontStyle: payload.fontStyle,
    }),
  );
  return res.data.statusId;
}

export async function createMediaStatus(payload: {
  uid: string;
  file: File;
  caption: string;
}): Promise<string> {
  const { storage, functions } = requireFirebaseHandles();
  const isVideo = payload.file.type.startsWith('video/');
  const statusId =
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID().replace(/-/g, '')
      : `st_${Date.now()}`;

  let media: MediaPayload;
  if (isVideo) {
    const meta = await captureVideoThumbnail(payload.file);
    if (meta.durationMs > LIMITS.STATUS_VIDEO_MAX_SEC * 1000) {
      throw new Error(`Status videos are limited to ${LIMITS.STATUS_VIDEO_MAX_SEC} seconds.`);
    }
    const videoRef = ref(storage, `statusMedia/${payload.uid}/${statusId}/media`);
    await uploadBytes(videoRef, payload.file, { contentType: payload.file.type });
    let thumbPath: string | null = null;
    if (meta.thumbBlob) {
      const thumbRef = ref(storage, `statusMedia/${payload.uid}/${statusId}/thumb`);
      await uploadBytes(thumbRef, meta.thumbBlob, { contentType: 'image/jpeg' });
      thumbPath = thumbRef.fullPath;
    }
    media = {
      storagePath: videoRef.fullPath,
      thumbPath,
      mimeType: payload.file.type,
      sizeBytes: payload.file.size,
      durationMs: meta.durationMs,
    };
  } else {
    const processed = await processImageFile(payload.file);
    const imgRef = ref(storage, `statusMedia/${payload.uid}/${statusId}/media`);
    await uploadBytes(imgRef, processed.blob, { contentType: processed.mimeType });
    const thumbRef = ref(storage, `statusMedia/${payload.uid}/${statusId}/thumb`);
    await uploadBytes(thumbRef, processed.thumbBlob, { contentType: 'image/jpeg' });
    media = {
      storagePath: imgRef.fullPath,
      thumbPath: thumbRef.fullPath,
      mimeType: processed.mimeType,
      sizeBytes: processed.blob.size,
    };
  }

  const fn = httpsCallable<
    {
      statusId: string;
      type: 'image' | 'video';
      caption: string | null;
      media: MediaPayload;
    },
    { ok: boolean; statusId: string }
  >(functions, 'createStatus');
  const res = await withCallableRetry(() =>
    fn({
      statusId,
      type: isVideo ? 'video' : 'image',
      caption: payload.caption.trim() || null,
      media,
    }),
  );
  return res.data.statusId;
}

export async function recordStatusView(statusId: string, viewerUid: string): Promise<void> {
  const viewRef = refs.statusViewDoc(statusId, viewerUid);
  const existing = await getDoc(viewRef).catch(() => null);
  if (existing?.exists()) return;
  await setDoc(viewRef, {
    schemaVersion: 1,
    viewedAt: serverTimestamp() as unknown as never,
  });
}

export async function deleteOwnStatus(statusId: string): Promise<void> {
  await deleteDoc(refs.statusDoc(statusId));
}

export async function toggleMuteStatusAuthor(
  uid: string,
  authorUid: string,
  settings: UserSettings,
  mute: boolean,
): Promise<void> {
  const current = new Set(settings.mutedStatusAuthors);
  if (mute) current.add(authorUid);
  else current.delete(authorUid);
  await updateDoc(refs.settingsDoc(uid), {
    mutedStatusAuthors: Array.from(current),
  });
}

export async function resolveStatusMediaUrl(storagePath: string): Promise<string> {
  const { storage } = requireFirebaseHandles();
  return getDownloadURL(ref(storage, storagePath));
}
