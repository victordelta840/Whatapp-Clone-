import { describe, expect, it } from 'vitest';
import { Timestamp } from 'firebase/firestore';
import { computeReceiptState, canEditMessage, canDeleteForEveryone } from '@/features/messages/messages.service';
import type { ConversationMember, Message } from '@/types';

function makeTs(ms: number): Timestamp {
  return Timestamp.fromMillis(ms);
}

describe('receipts & message time windows', () => {
  const now = Date.now();
  const baseMessage: Message = {
    schemaVersion: 1,
    senderId: 'alice',
    type: 'text',
    text: 'hello',
    media: null,
    replyTo: null,
    forwarded: false,
    mentions: [],
    createdAt: makeTs(now - 60_000),
    editedAt: null,
    deletedForEveryone: false,
    deletedAt: null,
    reactions: {},
  };

  const members: Array<ConversationMember & { uid: string }> = [
    {
      uid: 'alice',
      schemaVersion: 1,
      role: 'member',
      joinedAt: makeTs(now - 100_000),
      addedBy: 'alice',
      lastDeliveredAt: null,
      lastReadAt: null,
      lastReadMessageId: null,
    },
    {
      uid: 'bob',
      schemaVersion: 1,
      role: 'member',
      joinedAt: makeTs(now - 100_000),
      addedBy: 'alice',
      lastDeliveredAt: makeTs(now - 10_000),
      lastReadAt: makeTs(now - 5_000),
      lastReadMessageId: 'm1',
    },
  ];

  it('marks read when recipient read high-water >= message createdAt and reciprocity enabled', () => {
    const state = computeReceiptState({
      message: baseMessage,
      myUid: 'alice',
      conversationType: 'direct',
      members,
      myReadReceiptsEnabled: true,
      peerReadReceiptsEnabled: true,
    });
    expect(state).toBe('read');
  });

  it('downgrades read receipt to delivered when direct read receipts disabled', () => {
    const state = computeReceiptState({
      message: baseMessage,
      myUid: 'alice',
      conversationType: 'direct',
      members,
      myReadReceiptsEnabled: false,
      peerReadReceiptsEnabled: true,
    });
    expect(state).toBe('delivered');
  });

  it('enforces 15m edit and 48h delete windows', () => {
    expect(canEditMessage(baseMessage, 'alice')).toBe(true);
    expect(canDeleteForEveryone(baseMessage, 'alice')).toBe(true);

    const oldMsg = { ...baseMessage, createdAt: makeTs(now - 20 * 60_000) };
    expect(canEditMessage(oldMsg, 'alice')).toBe(false);
    expect(canDeleteForEveryone(oldMsg, 'alice')).toBe(true);

    const ancientMsg = { ...baseMessage, createdAt: makeTs(now - 50 * 3600_000) };
    expect(canDeleteForEveryone(ancientMsg, 'alice')).toBe(false);
  });
});
