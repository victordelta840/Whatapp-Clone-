import { serverTimestamp, setDoc } from 'firebase/firestore';
import { WINDOWS } from '@/config/constants';
import { refs } from '@/config/refs';
import type { PresenceDoc } from '@/types';

export async function writePresenceState(uid: string, state: 'online' | 'offline'): Promise<void> {
  await setDoc(refs.presenceDoc(uid), {
    schemaVersion: 1,
    state,
    lastActiveAt: serverTimestamp() as unknown as never,
    updatedAt: serverTimestamp() as unknown as never,
  });
}

export function isPresenceOnline(doc: PresenceDoc | null): boolean {
  if (!doc || doc.state !== 'online') return false;
  const lastActiveMs = doc.lastActiveAt?.toMillis?.() ?? 0;
  return Date.now() - lastActiveMs <= WINDOWS.PRESENCE_ONLINE_THRESHOLD_MS;
}

export function formatLastSeenLabel(doc: PresenceDoc | null): string {
  if (!doc) return '';
  if (isPresenceOnline(doc)) return 'online';
  const lastMs = doc.lastActiveAt?.toMillis?.();
  if (!lastMs) return '';
  const diffMin = Math.floor((Date.now() - lastMs) / 60_000);
  if (diffMin < 1) return 'last seen just now';
  if (diffMin < 60) return `last seen ${diffMin}m ago`;
  const date = new Date(lastMs);
  const diffHours = Math.floor(diffMin / 60);
  if (diffHours < 24) {
    return `last seen today at ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
  }
  return `last seen ${date.toLocaleDateString([], { month: 'short', day: 'numeric' })}`;
}
