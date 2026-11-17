import { useEffect, useState } from 'react';
import { addDoc, deleteDoc, onSnapshot, serverTimestamp, setDoc, updateDoc } from 'firebase/firestore';
import { refs } from '@/config/refs';
import { useAuthStore } from '@/features/auth';
import type { BlockDoc, UserSettings } from '@/types';

export async function updateUserSettings(
  uid: string,
  updater: (current: UserSettings) => UserSettings,
  currentSettings: UserSettings,
): Promise<void> {
  const next = updater(currentSettings);
  await setDoc(refs.settingsDoc(uid), next);
}

export async function patchPrivacySettings(
  uid: string,
  patch: Partial<UserSettings['privacy']>,
  current: UserSettings,
): Promise<void> {
  await updateDoc(refs.settingsDoc(uid), {
    privacy: {
      ...current.privacy,
      ...patch,
    },
  });
}

export async function blockUser(uid: string, targetUid: string): Promise<void> {
  if (uid === targetUid) return;
  await setDoc(refs.blockDoc(uid, targetUid), {
    schemaVersion: 1,
    blockedAt: serverTimestamp() as unknown as never,
  });
}

export async function unblockUser(uid: string, targetUid: string): Promise<void> {
  await deleteDoc(refs.blockDoc(uid, targetUid));
}

export function useBlockedUsers() {
  const uid = useAuthStore((s) => s.authUser?.uid ?? null);
  const [blocks, setBlocks] = useState<Array<BlockDoc & { uid: string }>>([]);

  useEffect(() => {
    if (!uid) {
      return;
    }
    const unsub = onSnapshot(
      refs.blocksCol(uid),
      (snap) => {
        setBlocks(snap.docs.map((d) => ({ ...d.data(), uid: d.id })));
      },
      () => setBlocks([]),
    );
    return unsub;
  }, [uid]);

  return uid ? blocks : [];
}

export type ReportReason =
  | 'spam'
  | 'harassment'
  | 'hate'
  | 'violence'
  | 'sexual'
  | 'scam'
  | 'other';

export async function submitReport(payload: {
  reporterId: string;
  targetType: 'user' | 'message' | 'group' | 'status';
  targetId: string;
  reason: ReportReason;
  details: string;
}): Promise<void> {
  await addDoc(refs.reportsCol(), {
    schemaVersion: 1,
    reporterId: payload.reporterId,
    targetType: payload.targetType,
    targetId: payload.targetId,
    reason: payload.reason,
    details: payload.details.trim().slice(0, 1000),
    status: 'open',
    createdAt: serverTimestamp(),
  });
}
