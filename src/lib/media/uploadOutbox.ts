import { getDownloadURL, ref, uploadBytesResumable, type UploadTask } from 'firebase/storage';
import { create } from 'zustand';
import { LIMITS } from '@/config/constants';
import { requireFirebaseHandles } from '@/config/firebase';
import { getConverseDb, type UploadOutboxEntry } from '@/lib/idb';
import { logger } from '@/lib/logger';
import type { MediaPayload } from '@/types';

interface UploadStoreState {
  entries: Record<string, UploadOutboxEntry>;
  upsertEntry: (entry: UploadOutboxEntry) => void;
  patchEntry: (id: string, patch: Partial<UploadOutboxEntry>) => void;
  removeEntry: (id: string) => void;
}

export const useUploadOutboxStore = create<UploadStoreState>((set) => ({
  entries: {},
  upsertEntry: (entry) =>
    set((s) => ({ entries: { ...s.entries, [entry.id]: entry } })),
  patchEntry: (id, patch) =>
    set((s) => {
      const prev = s.entries[id];
      if (!prev) return s;
      return { entries: { ...s.entries, [id]: { ...prev, ...patch } } };
    }),
  removeEntry: (id) =>
    set((s) => {
      const next = { ...s.entries };
      delete next[id];
      return { entries: next };
    }),
}));

const activeTasks = new Map<string, UploadTask>();
let activeCount = 0;

export type UploadCompletionCallback = (
  entry: UploadOutboxEntry,
  media: MediaPayload,
) => Promise<void>;

let completionHandler: UploadCompletionCallback | null = null;

export function registerUploadCompletionHandler(handler: UploadCompletionCallback): void {
  completionHandler = handler;
}

async function persistEntry(entry: UploadOutboxEntry): Promise<void> {
  const db = await getConverseDb();
  if (!db) return;
  await db.put('uploadOutbox', entry).catch(() => undefined);
}

async function deletePersistedEntry(id: string): Promise<void> {
  const db = await getConverseDb();
  if (!db) return;
  await db.delete('uploadOutbox', id).catch(() => undefined);
}

export async function restoreUploadOutbox(uid: string): Promise<void> {
  const db = await getConverseDb();
  if (!db) return;
  try {
    const items = await db.getAllFromIndex('uploadOutbox', 'by-uid', uid);
    const store = useUploadOutboxStore.getState();
    for (const item of items) {
      store.upsertEntry({
        ...item,
        status: item.status === 'uploading' ? 'paused' : item.status,
      });
    }
  } catch (err) {
    logger.warn('Failed to restore upload outbox', {
      reason: err instanceof Error ? err.message : 'unknown',
    });
  }
}

function pumpQueue(): void {
  if (activeCount >= LIMITS.CONCURRENT_UPLOADS_MAX) return;
  const entries = Object.values(useUploadOutboxStore.getState().entries).sort(
    (a, b) => a.createdAt - b.createdAt,
  );
  for (const item of entries) {
    if (activeCount >= LIMITS.CONCURRENT_UPLOADS_MAX) break;
    if (item.status === 'queued' && !activeTasks.has(item.id)) {
      void runUploadEntry(item.id);
    }
  }
}

export async function enqueueMediaUpload(entry: UploadOutboxEntry): Promise<void> {
  useUploadOutboxStore.getState().upsertEntry(entry);
  await persistEntry(entry);
  pumpQueue();
}

export async function runUploadEntry(id: string): Promise<void> {
  const entry = useUploadOutboxStore.getState().entries[id];
  if (!entry || activeTasks.has(id)) return;

  const { storage } = requireFirebaseHandles();
  activeCount += 1;
  useUploadOutboxStore.getState().patchEntry(id, { status: 'uploading', errorMessage: null });

  try {
    let thumbPath: string | null = null;
    if (entry.thumbBlob) {
      const thumbRef = ref(storage, `chatMedia/${entry.cid}/${entry.uid}/${entry.id}/thumb`);
      await uploadBytesResumable(thumbRef, entry.thumbBlob, { contentType: 'image/jpeg' });
      thumbPath = thumbRef.fullPath;
    }

    const safeFileName =
      entry.fileName.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 64) || 'original';
    const mainRef = ref(storage, `chatMedia/${entry.cid}/${entry.uid}/${entry.id}/${safeFileName}`);
    const task = uploadBytesResumable(mainRef, entry.fileBlob, {
      contentType: entry.mimeType || 'application/octet-stream',
    });
    activeTasks.set(id, task);

    await new Promise<void>((resolve, reject) => {
      task.on(
        'state_changed',
        (snap) => {
          const pct = snap.totalBytes
            ? Math.round((snap.bytesTransferred / snap.totalBytes) * 100)
            : 0;
          useUploadOutboxStore.getState().patchEntry(id, { progress: pct });
        },
        (err) => reject(err),
        () => resolve(),
      );
    });

    await getDownloadURL(mainRef);
    const media: MediaPayload = {
      storagePath: mainRef.fullPath,
      thumbPath,
      mimeType: entry.mimeType || 'application/octet-stream',
      sizeBytes: entry.sizeBytes,
      width: entry.width,
      height: entry.height,
      durationMs: entry.durationMs,
      fileName: entry.fileName,
      waveform: entry.waveform,
    };

    if (completionHandler) {
      await completionHandler(entry, media);
    }

    useUploadOutboxStore.getState().removeEntry(id);
    await deletePersistedEntry(id);
  } catch (err) {
    const code = (err as { code?: string })?.code ?? '';
    if (code === 'storage/canceled') {
      useUploadOutboxStore.getState().removeEntry(id);
      await deletePersistedEntry(id);
    } else {
      const msg = err instanceof Error ? err.message : 'Upload failed.';
      useUploadOutboxStore.getState().patchEntry(id, {
        status: 'failed',
        errorMessage: msg,
      });
      const updated = useUploadOutboxStore.getState().entries[id];
      if (updated) await persistEntry(updated);
    }
  } finally {
    activeTasks.delete(id);
    activeCount = Math.max(0, activeCount - 1);
    pumpQueue();
  }
}

export function pauseUpload(id: string): void {
  const task = activeTasks.get(id);
  if (task) task.pause();
  useUploadOutboxStore.getState().patchEntry(id, { status: 'paused' });
}

export function resumeUpload(id: string): void {
  const task = activeTasks.get(id);
  if (task) {
    task.resume();
    useUploadOutboxStore.getState().patchEntry(id, { status: 'uploading' });
  } else {
    useUploadOutboxStore.getState().patchEntry(id, { status: 'queued' });
    pumpQueue();
  }
}

export async function cancelUpload(id: string): Promise<void> {
  const task = activeTasks.get(id);
  if (task) task.cancel();
  useUploadOutboxStore.getState().removeEntry(id);
  await deletePersistedEntry(id);
}
