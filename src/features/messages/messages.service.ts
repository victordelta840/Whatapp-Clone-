import {
  Timestamp,
  deleteDoc,
  doc,
  serverTimestamp,
  setDoc,
  updateDoc,
  writeBatch,
  deleteField,
} from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { LIMITS, WINDOWS } from '@/config/constants';
import { requireFirebaseHandles } from '@/config/firebase';
import { refs } from '@/config/refs';
import { withCallableRetry } from '@/lib/errors';
import type {
  ConversationMember,
  MediaPayload,
  Message,
  MessageType,
  ReplyTo,
} from '@/types';

export function generateClientId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID().replace(/-/g, '');
  }
  return `m_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

export function buildPreviewText(type: MessageType, text: string | null, fileName?: string | null): string {
  const trimmed = text?.trim();
  if (trimmed) return trimmed.slice(0, LIMITS.TEXT_PREVIEW_MAX);
  switch (type) {
    case 'image':
      return 'Photo';
    case 'video':
      return 'Video';
    case 'voice':
      return 'Voice note';
    case 'audio':
      return 'Audio';
    case 'document':
      return (fileName || 'Document').slice(0, LIMITS.TEXT_PREVIEW_MAX);
    default:
      return '';
  }
}

export async function sendMessageBatched(payload: {
  cid: string;
  senderId: string;
  type: Exclude<MessageType, 'system'>;
  text: string | null;
  media?: MediaPayload | null;
  replyTo?: ReplyTo | null;
  mentions?: string[];
  clientMessageId?: string;
}): Promise<string> {
  const { db } = requireFirebaseHandles();
  const mid = payload.clientMessageId ?? generateClientId();
  const batch = writeBatch(db);

  const msgRef = refs.messageDoc(payload.cid, mid);
  const convRef = refs.conversationDoc(payload.cid);

  batch.set(msgRef, {
    schemaVersion: 1,
    senderId: payload.senderId,
    type: payload.type,
    text: payload.text,
    media: payload.media ?? null,
    replyTo: payload.replyTo ?? null,
    forwarded: false,
    mentions: payload.mentions ?? [],
    createdAt: serverTimestamp() as unknown as never,
    editedAt: null,
    deletedForEveryone: false,
    deletedAt: null,
    reactions: {},
  });

  batch.update(convRef, {
    lastMessage: {
      id: mid,
      senderId: payload.senderId,
      type: payload.type,
      textPreview: buildPreviewText(payload.type, payload.text, payload.media?.fileName),
      createdAt: serverTimestamp() as unknown as never,
    },
    lastMessageAt: serverTimestamp() as unknown as never,
    updatedAt: serverTimestamp() as unknown as never,
  });

  await batch.commit();
  return mid;
}

export function canEditMessage(msg: Message, myUid: string): boolean {
  if (msg.senderId !== myUid || msg.deletedForEveryone) return false;
  if (!['text', 'image', 'video', 'audio', 'document'].includes(msg.type)) return false;
  const createdMs = msg.createdAt?.toMillis?.() ?? 0;
  if (!createdMs) return false;
  return Date.now() - createdMs <= WINDOWS.EDIT_WINDOW_MINUTES * 60_000;
}

export function canDeleteForEveryone(msg: Message, myUid: string): boolean {
  if (msg.senderId !== myUid || msg.deletedForEveryone || msg.type === 'system') return false;
  const createdMs = msg.createdAt?.toMillis?.() ?? 0;
  if (!createdMs) return false;
  return Date.now() - createdMs <= WINDOWS.DELETE_FOR_EVERYONE_HOURS * 3600_000;
}

export async function editMessageText(
  cid: string,
  mid: string,
  newText: string,
): Promise<void> {
  await updateDoc(refs.messageDoc(cid, mid), {
    text: newText.trim(),
    editedAt: serverTimestamp() as unknown as never,
  });
}

export async function deleteMessageForEveryone(cid: string, mid: string): Promise<void> {
  await updateDoc(refs.messageDoc(cid, mid), {
    deletedForEveryone: true,
    deletedAt: serverTimestamp() as unknown as never,
    text: null,
    media: null,
    replyTo: null,
  });
}

export async function toggleMessageReaction(
  cid: string,
  mid: string,
  uid: string,
  emoji: string,
  currentEmoji?: string,
): Promise<void> {
  const msgRef = refs.messageDoc(cid, mid);
  if (currentEmoji === emoji) {
    await updateDoc(msgRef, {
      [`reactions.${uid}`]: deleteField(),
    });
  } else {
    await updateDoc(msgRef, {
      [`reactions.${uid}`]: emoji,
    });
  }
}

export async function forwardMessagesToConversations(payload: {
  sourceConversationId: string;
  messageIds: string[];
  targetConversationIds: string[];
}): Promise<void> {
  const { functions } = requireFirebaseHandles();
  const fn = httpsCallable<typeof payload, { ok: boolean }>(functions, 'forwardMessages');
  await withCallableRetry(() => fn(payload));
}

export async function updateDeliveryHighWater(
  cid: string,
  uid: string,
  latestMessageAt: Timestamp,
): Promise<void> {
  await updateDoc(refs.memberDoc(cid, uid), {
    lastDeliveredAt: latestMessageAt,
  });
}

export async function updateReadHighWater(
  cid: string,
  uid: string,
  latestMessageId: string,
  latestMessageAt: Timestamp,
): Promise<void> {
  const { db } = requireFirebaseHandles();
  const batch = writeBatch(db);
  batch.update(refs.memberDoc(cid, uid), {
    lastReadAt: latestMessageAt,
    lastReadMessageId: latestMessageId,
  });
  batch.update(refs.chatStateDoc(uid, cid), {
    unreadCount: 0,
    markedUnread: false,
    lastOpenedAt: serverTimestamp(),
  });
  await batch.commit();
}

export async function setTypingActive(cid: string, uid: string): Promise<void> {
  await setDoc(doc(refs.typingCol(cid), uid), {
    schemaVersion: 1,
    updatedAt: serverTimestamp(),
  });
}

export async function clearTypingActive(cid: string, uid: string): Promise<void> {
  await deleteDoc(refs.typingDoc(cid, uid)).catch(() => undefined);
}

export type DeliveryReceiptState = 'pending' | 'sent' | 'delivered' | 'read';

export function computeReceiptState(params: {
  message: Message;
  myUid: string;
  conversationType: 'direct' | 'group';
  members: Array<ConversationMember & { uid: string }>;
  myReadReceiptsEnabled: boolean;
  peerReadReceiptsEnabled?: boolean;
}): DeliveryReceiptState {
  const {
    message,
    myUid,
    conversationType,
    members,
    myReadReceiptsEnabled,
    peerReadReceiptsEnabled = true,
  } = params;

  if (message.hasPendingWrites) return 'pending';
  const msgMs = message.createdAt?.toMillis?.() ?? 0;
  if (!msgMs) return 'pending';

  const others = members.filter((m) => m.uid !== myUid);
  if (others.length === 0) return 'sent';

  const canShowRead =
    conversationType === 'group' || (myReadReceiptsEnabled && peerReadReceiptsEnabled);

  if (canShowRead) {
    const allRead = others.every((m) => (m.lastReadAt?.toMillis?.() ?? 0) >= msgMs);
    if (allRead) return 'read';
  }

  const anyDelivered = others.some(
    (m) =>
      (m.lastDeliveredAt?.toMillis?.() ?? 0) >= msgMs ||
      (m.lastReadAt?.toMillis?.() ?? 0) >= msgMs,
  );
  return anyDelivered ? 'delivered' : 'sent';
}
