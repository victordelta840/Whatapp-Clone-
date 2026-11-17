import {
  Timestamp,
  serverTimestamp,
  updateDoc,
  writeBatch,
  collection,
  doc,
} from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { requireFirebaseHandles } from '@/config/firebase';
import { refs } from '@/config/refs';
import { withCallableRetry } from '@/lib/errors';

export async function startDirectConversation(targetUid: string): Promise<string> {
  const { functions } = requireFirebaseHandles();
  const fn = httpsCallable<{ targetUid: string }, { ok: boolean; conversationId: string }>(
    functions,
    'startDirectChat',
  );
  const res = await withCallableRetry(() => fn({ targetUid }));
  return res.data.conversationId;
}

export async function pinConversation(uid: string, cid: string, pinned: boolean): Promise<void> {
  await updateDoc(refs.chatStateDoc(uid, cid), {
    pinned,
    pinnedAt: pinned ? (serverTimestamp() as unknown as never) : null,
  });
}

export async function archiveConversation(
  uid: string,
  cid: string,
  archived: boolean,
): Promise<void> {
  await updateDoc(refs.chatStateDoc(uid, cid), {
    archived,
  });
}

export async function muteConversation(
  uid: string,
  cid: string,
  durationMs: number | null,
): Promise<void> {
  const mutedUntil =
    durationMs === null
      ? null
      : durationMs === Number.POSITIVE_INFINITY
        ? Timestamp.fromMillis(Date.now() + 100 * 365 * 24 * 3600 * 1000)
        : Timestamp.fromMillis(Date.now() + durationMs);
  await updateDoc(refs.chatStateDoc(uid, cid), { mutedUntil });
}

export async function markConversationRead(uid: string, cid: string): Promise<void> {
  await updateDoc(refs.chatStateDoc(uid, cid), {
    unreadCount: 0,
    markedUnread: false,
    lastOpenedAt: serverTimestamp() as unknown as never,
  });
}

export async function markConversationUnread(uid: string, cid: string): Promise<void> {
  await updateDoc(refs.chatStateDoc(uid, cid), {
    markedUnread: true,
  });
}

export async function clearConversationForMe(uid: string, cid: string): Promise<void> {
  await updateDoc(refs.chatStateDoc(uid, cid), {
    clearedAt: serverTimestamp() as unknown as never,
    unreadCount: 0,
    markedUnread: false,
  });
}

export async function deleteConversationForMe(uid: string, cid: string): Promise<void> {
  await updateDoc(refs.chatStateDoc(uid, cid), {
    clearedAt: serverTimestamp() as unknown as never,
    archived: true,
    pinned: false,
    pinnedAt: null,
    unreadCount: 0,
    markedUnread: false,
  });
}

export async function hideMessageForMe(uid: string, cid: string, mid: string): Promise<void> {
  const { db } = requireFirebaseHandles();
  const hiddenRef = doc(collection(db, 'users', uid, 'chatStates', cid, 'hiddenMessages'), mid);
  const batch = writeBatch(db);
  batch.set(hiddenRef, {
    schemaVersion: 1,
    hiddenAt: serverTimestamp(),
  });
  await batch.commit();
}
