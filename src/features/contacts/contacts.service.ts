import { useEffect, useState } from 'react';
import { deleteDoc, onSnapshot, serverTimestamp, setDoc, updateDoc } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { E164_REGEX, LIMITS } from '@/config/constants';
import { requireFirebaseHandles } from '@/config/firebase';
import { refs } from '@/config/refs';
import { withCallableRetry } from '@/lib/errors';
import { useAuthStore } from '@/features/auth';
import type { ContactDoc } from '@/types';

export function useContacts() {
  const uid = useAuthStore((s) => s.authUser?.uid ?? null);
  const [contacts, setContacts] = useState<Array<ContactDoc & { uid: string }>>([]);
  const [loading, setLoading] = useState(Boolean(uid));

  useEffect(() => {
    if (!uid) {
      return;
    }
    const unsub = onSnapshot(
      refs.contactsCol(uid),
      (snap) => {
        setContacts(snap.docs.map((d) => ({ ...d.data(), uid: d.id })));
        setLoading(false);
      },
      () => {
        setLoading(false);
      },
    );
    return unsub;
  }, [uid]);

  return { contacts: uid ? contacts : [], loading: uid ? loading : false };
}

export async function addContactRecord(
  uid: string,
  targetUid: string,
  source: ContactDoc['source'] = 'manual',
  nickname: string | null = null,
): Promise<void> {
  if (uid === targetUid) throw new Error('Cannot add yourself as a contact.');
  await setDoc(refs.contactDoc(uid, targetUid), {
    schemaVersion: 1,
    addedAt: serverTimestamp() as unknown as never,
    source,
    nickname: nickname ? nickname.trim().slice(0, LIMITS.NICKNAME_MAX) : null,
  });
}

export async function updateContactNickname(
  uid: string,
  targetUid: string,
  nickname: string | null,
): Promise<void> {
  await updateDoc(refs.contactDoc(uid, targetUid), {
    nickname: nickname ? nickname.trim().slice(0, LIMITS.NICKNAME_MAX) : null,
  });
}

export async function removeContactRecord(uid: string, targetUid: string): Promise<void> {
  await deleteDoc(refs.contactDoc(uid, targetUid));
}

export interface DiscoveredMatch {
  uid: string;
  displayName: string;
  username: string | null;
}

export async function discoverContactsByPhones(phoneNumbers: string[]): Promise<DiscoveredMatch[]> {
  const normalized = Array.from(
    new Set(
      phoneNumbers
        .map((raw) => raw.replace(/[\s\-().]/g, '').trim())
        .filter((num) => E164_REGEX.test(num)),
    ),
  ).slice(0, 500);

  if (normalized.length === 0) {
    throw new Error('No valid E.164 phone numbers (e.g., +14155550123) were found.');
  }

  const { functions } = requireFirebaseHandles();
  const fn = httpsCallable<
    { phoneNumbers: string[] },
    { ok: boolean; matches: DiscoveredMatch[] }
  >(functions, 'discoverContacts');
  const res = await withCallableRetry(() => fn({ phoneNumbers: normalized }));
  return res.data.matches;
}

export function extractPhonesFromVCardOrCsv(rawText: string): string[] {
  const candidates = new Set<string>();
  const matches = rawText.match(/\+[1-9][\d\s\-().]{6,20}/g) ?? [];
  for (const m of matches) {
    const clean = m.replace(/[\s\-().]/g, '');
    if (E164_REGEX.test(clean)) {
      candidates.add(clean);
    }
  }
  return Array.from(candidates);
}

interface NavigatorContacts {
  select: (
    properties: Array<'name' | 'tel' | 'email'>,
    options?: { multiple?: boolean },
  ) => Promise<Array<{ name?: string[]; tel?: string[] }>>;
}

export function isContactPickerSupported(): boolean {
  return (
    typeof navigator !== 'undefined' &&
    'contacts' in navigator &&
    typeof (navigator as unknown as { contacts?: NavigatorContacts }).contacts?.select === 'function'
  );
}

export async function pickPhonesFromDevice(): Promise<string[]> {
  const navContacts = (navigator as unknown as { contacts?: NavigatorContacts }).contacts;
  if (!navContacts?.select) {
    throw new Error('Web Contact Picker API is not supported on this browser.');
  }
  const picked = await navContacts.select(['name', 'tel'], { multiple: true });
  const numbers: string[] = [];
  for (const entry of picked) {
    for (const tel of entry.tel ?? []) {
      const clean = tel.replace(/[\s\-().]/g, '');
      if (E164_REGEX.test(clean)) numbers.push(clean);
    }
  }
  return Array.from(new Set(numbers));
}
