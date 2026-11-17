import { useEffect, useState } from 'react';
import { onSnapshot } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { getDownloadURL, ref, uploadBytes } from 'firebase/storage';
import { MEDIA_LIMITS } from '@/config/constants';
import { requireFirebaseHandles } from '@/config/firebase';
import { refs } from '@/config/refs';
import { withCallableRetry } from '@/lib/errors';
import { processImageFile } from '@/lib/media/imageProcessor';

export async function createGroupConversation(payload: {
  name: string;
  description: string;
  memberUids: string[];
}): Promise<{ conversationId: string; memberCount: number }> {
  const { functions } = requireFirebaseHandles();
  const fn = httpsCallable<
    typeof payload,
    { ok: boolean; conversationId: string; memberCount: number }
  >(functions, 'createGroup');
  const res = await withCallableRetry(() => fn(payload));
  return { conversationId: res.data.conversationId, memberCount: res.data.memberCount };
}

export async function updateGroupInfo(payload: {
  conversationId: string;
  name?: string;
  description?: string;
  photoPath?: string | null;
  photoURL?: string | null;
}): Promise<void> {
  const { functions } = requireFirebaseHandles();
  const fn = httpsCallable<typeof payload, { ok: boolean }>(functions, 'updateGroupInfo');
  await withCallableRetry(() => fn(payload));
}

export async function uploadGroupPhoto(cid: string, file: File): Promise<string> {
  const { storage } = requireFirebaseHandles();
  const processed = await processImageFile(file, MEDIA_LIMITS.PROFILE_PHOTO_MAX_EDGE, 0.85);
  if (processed.blob.size > MEDIA_LIMITS.GROUP_PHOTO_MAX_BYTES) {
    throw new Error('Processed group photo exceeds 5 MB.');
  }
  const storagePath = `groupPhotos/${cid}/avatar_${Date.now()}.jpg`;
  const storageRef = ref(storage, storagePath);
  await uploadBytes(storageRef, processed.blob, { contentType: processed.mimeType });
  const photoURL = await getDownloadURL(storageRef);
  await updateGroupInfo({ conversationId: cid, photoPath: storagePath, photoURL });
  return photoURL;
}

export async function updateGroupSettings(payload: {
  conversationId: string;
  sendMessages?: 'all' | 'adminsOnly';
  editInfo?: 'all' | 'adminsOnly';
  addMembers?: 'all' | 'adminsOnly';
  joinApproval?: boolean;
}): Promise<void> {
  const { functions } = requireFirebaseHandles();
  const fn = httpsCallable<typeof payload, { ok: boolean }>(functions, 'updateGroupSettings');
  await withCallableRetry(() => fn(payload));
}

export async function addGroupMembers(cid: string, memberUids: string[]): Promise<number> {
  const { functions } = requireFirebaseHandles();
  const fn = httpsCallable<
    { conversationId: string; memberUids: string[] },
    { ok: boolean; addedCount: number }
  >(functions, 'addGroupMembers');
  const res = await withCallableRetry(() => fn({ conversationId: cid, memberUids }));
  return res.data.addedCount;
}

export async function removeGroupMember(cid: string, targetUid: string): Promise<void> {
  const { functions } = requireFirebaseHandles();
  const fn = httpsCallable<{ conversationId: string; targetUid: string }, { ok: boolean }>(
    functions,
    'removeGroupMember',
  );
  await withCallableRetry(() => fn({ conversationId: cid, targetUid }));
}

export async function setGroupMemberRole(
  cid: string,
  targetUid: string,
  role: 'admin' | 'member',
): Promise<void> {
  const { functions } = requireFirebaseHandles();
  const fn = httpsCallable<
    { conversationId: string; targetUid: string; role: 'admin' | 'member' },
    { ok: boolean }
  >(functions, 'setGroupRole');
  await withCallableRetry(() => fn({ conversationId: cid, targetUid, role }));
}

export async function leaveGroupConversation(cid: string): Promise<void> {
  const { functions } = requireFirebaseHandles();
  const fn = httpsCallable<{ conversationId: string }, { ok: boolean; deletedGroup: boolean }>(
    functions,
    'leaveGroup',
  );
  await withCallableRetry(() => fn({ conversationId: cid }));
}

export async function createGroupInviteLink(cid: string): Promise<string> {
  const { functions } = requireFirebaseHandles();
  const fn = httpsCallable<
    { conversationId: string; expiresHours?: number; maxUses?: number },
    { ok: boolean; code: string }
  >(functions, 'createInviteLink');
  const res = await withCallableRetry(() => fn({ conversationId: cid }));
  return res.data.code;
}

export async function revokeGroupInviteLink(cid: string, code: string): Promise<void> {
  const { functions } = requireFirebaseHandles();
  const fn = httpsCallable<{ conversationId: string; code: string }, { ok: boolean }>(
    functions,
    'revokeInviteLink',
  );
  await withCallableRetry(() => fn({ conversationId: cid, code }));
}

export async function previewGroupInvite(code: string): Promise<{
  conversationId: string;
  name: string;
  description: string;
  memberCount: number;
  joinApproval: boolean;
}> {
  const { functions } = requireFirebaseHandles();
  const fn = httpsCallable<
    { code: string },
    {
      conversationId: string;
      name: string;
      description: string;
      memberCount: number;
      joinApproval: boolean;
    }
  >(functions, 'previewInvite');
  const res = await withCallableRetry(() => fn({ code }));
  return res.data;
}

export async function joinGroupByInviteCode(code: string): Promise<{
  joined: boolean;
  pendingApproval: boolean;
  conversationId: string;
}> {
  const { functions } = requireFirebaseHandles();
  const fn = httpsCallable<
    { code: string },
    { joined: boolean; pendingApproval: boolean; conversationId: string }
  >(functions, 'joinGroupByInvite');
  const res = await withCallableRetry(() => fn({ code }));
  return res.data;
}

export async function resolveGroupJoinRequest(
  cid: string,
  targetUid: string,
  approve: boolean,
): Promise<void> {
  const { functions } = requireFirebaseHandles();
  const fn = httpsCallable<
    { conversationId: string; targetUid: string; approve: boolean },
    { ok: boolean }
  >(functions, 'resolveJoinRequest');
  await withCallableRetry(() => fn({ conversationId: cid, targetUid, approve }));
}

export function useGroupJoinRequests(cid: string | undefined, enabled: boolean) {
  const [requests, setRequests] = useState<Array<{ uid: string }>>([]);

  useEffect(() => {
    if (!cid || !enabled) {
      return;
    }
    const unsub = onSnapshot(
      refs.joinRequestsCol(cid),
      (snap) => {
        setRequests(snap.docs.map((d) => ({ uid: d.id })));
      },
      () => setRequests([]),
    );
    return unsub;
  }, [cid, enabled]);

  return cid && enabled ? requests : [];
}
