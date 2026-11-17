import { openDB, type DBSchema, type IDBPDatabase } from 'idb';

export interface DraftEntry {
  key: string; // `${uid}:${cid}`
  uid: string;
  cid: string;
  text: string;
  replyToId: string | null;
  updatedAt: number;
}

export interface UploadOutboxEntry {
  id: string; // messageId
  uid: string;
  cid: string;
  kind: 'image' | 'video' | 'audio' | 'voice' | 'document';
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  caption: string;
  fileBlob: Blob;
  thumbBlob: Blob | null;
  width: number | null;
  height: number | null;
  durationMs: number | null;
  waveform: number[];
  replyTo: {
    kind: 'message' | 'status';
    messageId?: string;
    statusId?: string;
    senderId: string;
    type: 'text' | 'image' | 'video' | 'audio' | 'voice' | 'document' | 'system';
    textPreview: string;
    thumbPath?: string | null;
  } | null;
  status: 'queued' | 'uploading' | 'paused' | 'failed';
  progress: number;
  errorMessage: string | null;
  createdAt: number;
}

export interface IndexedMessageEntry {
  key: string; // `${uid}:${cid}:${mid}`
  uid: string;
  cid: string;
  mid: string;
  senderId: string;
  text: string;
  textLower: string;
  createdAtMs: number;
}

interface ConverseDB extends DBSchema {
  drafts: {
    key: string;
    value: DraftEntry;
    indexes: { 'by-uid': string };
  };
  uploadOutbox: {
    key: string;
    value: UploadOutboxEntry;
    indexes: { 'by-uid': string; 'by-cid': string };
  };
  searchMessages: {
    key: string;
    value: IndexedMessageEntry;
    indexes: { 'by-uid': string; 'by-uid-cid': [string, string] };
  };
  appMeta: {
    key: string;
    value: { key: string; value: string };
  };
}

let dbPromise: Promise<IDBPDatabase<ConverseDB>> | null = null;
let idbAvailable = true;

export function isIndexedDbAvailable(): boolean {
  return idbAvailable;
}

export async function getConverseDb(): Promise<IDBPDatabase<ConverseDB> | null> {
  if (typeof indexedDB === 'undefined') {
    idbAvailable = false;
    return null;
  }
  if (!dbPromise) {
    dbPromise = openDB<ConverseDB>('converse-local-store', 1, {
      upgrade(db) {
        const drafts = db.createObjectStore('drafts', { keyPath: 'key' });
        drafts.createIndex('by-uid', 'uid');

        const outbox = db.createObjectStore('uploadOutbox', { keyPath: 'id' });
        outbox.createIndex('by-uid', 'uid');
        outbox.createIndex('by-cid', 'cid');

        const search = db.createObjectStore('searchMessages', { keyPath: 'key' });
        search.createIndex('by-uid', 'uid');
        search.createIndex('by-uid-cid', ['uid', 'cid']);

        db.createObjectStore('appMeta', { keyPath: 'key' });
      },
    }).catch(() => {
      idbAvailable = false;
      return null as unknown as IDBPDatabase<ConverseDB>;
    });
  }
  const db = await dbPromise;
  return db ?? null;
}

export async function getOrCreateDeviceId(): Promise<string> {
  const fallback =
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : `dev-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  const db = await getConverseDb();
  if (!db) return fallback;
  try {
    const existing = await db.get('appMeta', 'deviceId');
    if (existing?.value) return existing.value;
    await db.put('appMeta', { key: 'deviceId', value: fallback });
    return fallback;
  } catch {
    return fallback;
  }
}

export async function saveDraft(
  uid: string,
  cid: string,
  text: string,
  replyToId: string | null = null,
): Promise<void> {
  const db = await getConverseDb();
  if (!db) return;
  const key = `${uid}:${cid}`;
  if (!text.trim() && !replyToId) {
    await db.delete('drafts', key);
    return;
  }
  await db.put('drafts', {
    key,
    uid,
    cid,
    text,
    replyToId,
    updatedAt: Date.now(),
  });
}

export async function loadDraft(uid: string, cid: string): Promise<DraftEntry | undefined> {
  const db = await getConverseDb();
  if (!db) return undefined;
  return db.get('drafts', `${uid}:${cid}`);
}

export async function clearUserLocalData(uid: string): Promise<void> {
  const db = await getConverseDb();
  if (!db) return;
  const tx = db.transaction(['drafts', 'uploadOutbox', 'searchMessages'], 'readwrite');
  const draftKeys = await tx.objectStore('drafts').index('by-uid').getAllKeys(uid);
  for (const k of draftKeys) await tx.objectStore('drafts').delete(k);

  const outboxKeys = await tx.objectStore('uploadOutbox').index('by-uid').getAllKeys(uid);
  for (const k of outboxKeys) await tx.objectStore('uploadOutbox').delete(k);

  const searchKeys = await tx.objectStore('searchMessages').index('by-uid').getAllKeys(uid);
  for (const k of searchKeys) await tx.objectStore('searchMessages').delete(k);

  await tx.done;
}
