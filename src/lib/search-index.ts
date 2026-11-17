import { LIMITS, PAGINATION } from '@/config/constants';
import { getConverseDb, type IndexedMessageEntry } from './idb';

export type LocalSearchHit = IndexedMessageEntry;

export async function indexMessagesForSearch(
  uid: string,
  cid: string,
  entries: Array<{ mid: string; senderId: string; text: string; createdAtMs: number }>,
): Promise<void> {
  const db = await getConverseDb();
  if (!db || entries.length === 0) return;

  const tx = db.transaction('searchMessages', 'readwrite');
  const store = tx.objectStore('searchMessages');

  for (const item of entries) {
    if (!item.text.trim()) continue;
    await store.put({
      key: `${uid}:${cid}:${item.mid}`,
      uid,
      cid,
      mid: item.mid,
      senderId: item.senderId,
      text: item.text,
      textLower: item.text.toLowerCase(),
      createdAtMs: item.createdAtMs,
    });
  }

  // Prune per-conversation index to LOCAL_SEARCH_MAX_PER_CHAT (5,000)
  const existing = await store.index('by-uid-cid').getAll([uid, cid]);
  if (existing.length > LIMITS.LOCAL_SEARCH_MAX_PER_CHAT) {
    existing.sort((a, b) => a.createdAtMs - b.createdAtMs);
    const excess = existing.length - LIMITS.LOCAL_SEARCH_MAX_PER_CHAT;
    for (let i = 0; i < excess; i++) {
      const target = existing[i];
      if (target) await store.delete(target.key);
    }
  }

  await tx.done;
}

export async function removeIndexedMessage(uid: string, cid: string, mid: string): Promise<void> {
  const db = await getConverseDb();
  if (!db) return;
  await db.delete('searchMessages', `${uid}:${cid}:${mid}`);
}

export async function clearConversationSearchIndex(uid: string, cid: string): Promise<void> {
  const db = await getConverseDb();
  if (!db) return;
  const tx = db.transaction('searchMessages', 'readwrite');
  const keys = await tx.objectStore('searchMessages').index('by-uid-cid').getAllKeys([uid, cid]);
  for (const key of keys) {
    await tx.objectStore('searchMessages').delete(key);
  }
  await tx.done;
}

export async function searchLocalMessages(
  uid: string,
  queryText: string,
  cid?: string,
  limitCount = PAGINATION.SEARCH_RESULTS_LIMIT,
): Promise<IndexedMessageEntry[]> {
  const needle = queryText.trim().toLowerCase();
  if (!needle) return [];
  const db = await getConverseDb();
  if (!db) return [];

  const all = cid
    ? await db.getAllFromIndex('searchMessages', 'by-uid-cid', [uid, cid])
    : await db.getAllFromIndex('searchMessages', 'by-uid', uid);

  const matched = all.filter((entry) => entry.textLower.includes(needle));
  matched.sort((a, b) => b.createdAtMs - a.createdAtMs);
  return matched.slice(0, limitCount);
}

export async function indexMessagesLocally(
  uid: string,
  cid: string,
  messages: Array<{
    id: string;
    senderId: string;
    text?: string | null;
    createdAt?: { toMillis?: () => number } | null;
  }>,
): Promise<void> {
  const entries = messages
    .filter((m) => typeof m.text === 'string' && m.text.trim().length > 0)
    .map((m) => ({
      mid: m.id,
      senderId: m.senderId,
      text: m.text ?? '',
      createdAtMs: m.createdAt?.toMillis?.() ?? Date.now(),
    }));
  if (entries.length === 0) return;
  await indexMessagesForSearch(uid, cid, entries);
}
