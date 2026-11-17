import { randomUUID } from 'node:crypto';
import { FieldValue, getFirestore } from 'firebase-admin/firestore';
import { getStorage } from 'firebase-admin/storage';
import { HttpsError, onCall } from 'firebase-functions/v2/https';
import { z } from 'zod';
import { FUNCTIONS_REGION, LIMITS, RATE_LIMITS } from '../lib/constants.js';
import { parseInput, requireVerifiedEmailOrProvider } from '../lib/errors.js';
import { enforceRateLimit } from '../lib/rateLimit.js';

const startDirectSchema = z.object({
  targetUid: z.string().trim().min(1).max(128),
});

export const startDirectChat = onCall(
  { region: FUNCTIONS_REGION, enforceAppCheck: true },
  async (request) => {
    const callerUid = requireVerifiedEmailOrProvider(request);
    const input = parseInput(startDirectSchema, request.data);
    if (input.targetUid === callerUid) {
      throw new HttpsError('invalid-argument', 'Cannot start a direct chat with yourself.');
    }

    await enforceRateLimit(
      callerUid,
      'startDirectChat',
      RATE_LIMITS.START_DIRECT_CHAT.limit,
      RATE_LIMITS.START_DIRECT_CHAT.windowSec,
    );

    const db = getFirestore();
    const [targetSnap, targetBlockSnap, callerBlockSnap] = await Promise.all([
      db.collection('users').doc(input.targetUid).get(),
      db.collection('users').doc(input.targetUid).collection('blocks').doc(callerUid).get(),
      db.collection('users').doc(callerUid).collection('blocks').doc(input.targetUid).get(),
    ]);

    if (!targetSnap.exists) {
      throw new HttpsError('not-found', 'Target user does not exist.');
    }
    if (targetBlockSnap.exists || callerBlockSnap.exists) {
      throw new HttpsError('permission-denied', 'Cannot message this user due to block settings.');
    }

    const pair = [callerUid, input.targetUid].sort();
    const cid = `d_${pair[0]}_${pair[1]}`;
    const convRef = db.collection('conversations').doc(cid);

    await db.runTransaction(async (tx) => {
      const existing = await tx.get(convRef);
      if (existing.exists) return;

      tx.set(convRef, {
        schemaVersion: 1,
        type: 'direct',
        participantIds: pair,
        createdBy: callerUid,
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
        lastMessage: null,
        lastMessageAt: null,
      });

      for (const uid of pair) {
        tx.set(convRef.collection('members').doc(uid), {
          schemaVersion: 1,
          role: 'member',
          joinedAt: FieldValue.serverTimestamp(),
          addedBy: callerUid,
          lastDeliveredAt: null,
          lastReadAt: null,
          lastReadMessageId: null,
        });

        tx.set(db.collection('users').doc(uid).collection('chatStates').doc(cid), {
          schemaVersion: 1,
          pinned: false,
          pinnedAt: null,
          archived: false,
          mutedUntil: null,
          unreadCount: 0,
          markedUnread: false,
          clearedAt: null,
          lastOpenedAt: FieldValue.serverTimestamp(),
        });
      }
    });

    return { ok: true, conversationId: cid };
  },
);

const forwardSchema = z.object({
  sourceConversationId: z.string().trim().min(1).max(128),
  messageIds: z.array(z.string().trim().min(1).max(128)).min(1).max(10),
  targetConversationIds: z
    .array(z.string().trim().min(1).max(128))
    .min(1)
    .max(LIMITS.FORWARD_MAX_TARGETS),
});

export const forwardMessages = onCall(
  { region: FUNCTIONS_REGION, enforceAppCheck: true },
  async (request) => {
    const callerUid = requireVerifiedEmailOrProvider(request);
    const input = parseInput(forwardSchema, request.data);
    await enforceRateLimit(
      callerUid,
      'forwardMessages',
      RATE_LIMITS.FORWARD_MESSAGES.limit,
      RATE_LIMITS.FORWARD_MESSAGES.windowSec,
    );

    const db = getFirestore();
    const sourceMember = await db
      .collection('conversations')
      .doc(input.sourceConversationId)
      .collection('members')
      .doc(callerUid)
      .get();
    if (!sourceMember.exists) {
      throw new HttpsError('permission-denied', 'Not a participant in source conversation.');
    }

    const bucket = getStorage().bucket();
    const sourceMessages = await Promise.all(
      input.messageIds.map((mid) =>
        db
          .collection('conversations')
          .doc(input.sourceConversationId)
          .collection('messages')
          .doc(mid)
          .get(),
      ),
    );

    for (const targetCid of input.targetConversationIds) {
      const [convSnap, targetMember] = await Promise.all([
        db.collection('conversations').doc(targetCid).get(),
        db.collection('conversations').doc(targetCid).collection('members').doc(callerUid).get(),
      ]);

      if (!convSnap.exists || !targetMember.exists) {
        throw new HttpsError('permission-denied', `Cannot forward to conversation ${targetCid}.`);
      }

      const convData = convSnap.data() as {
        type?: string;
        group?: { settings?: { sendMessages?: string } };
      };
      if (
        convData.type === 'group' &&
        convData.group?.settings?.sendMessages === 'adminsOnly' &&
        !['owner', 'admin'].includes(String(targetMember.data()?.role))
      ) {
        throw new HttpsError('permission-denied', 'Only admins can send in this group.');
      }

      for (const srcDoc of sourceMessages) {
        if (!srcDoc.exists) continue;
        const src = srcDoc.data() as {
          type: string;
          text: string | null;
          media: {
            storagePath: string;
            thumbPath: string | null;
            mimeType: string;
            sizeBytes: number;
            width?: number | null;
            height?: number | null;
            durationMs?: number | null;
            fileName?: string | null;
            waveform?: number[];
          } | null;
          deletedForEveryone?: boolean;
        };
        if (src.deletedForEveryone || src.type === 'system') continue;

        const newMid = randomUUID();
        let copiedMedia = src.media;

        if (src.media?.storagePath) {
          const destPath = `chatMedia/${targetCid}/${callerUid}/${newMid}/original`;
          await bucket.file(src.media.storagePath).copy(bucket.file(destPath)).catch(() => undefined);
          let destThumb: string | null = null;
          if (src.media.thumbPath) {
            destThumb = `chatMedia/${targetCid}/${callerUid}/${newMid}/thumb`;
            await bucket.file(src.media.thumbPath).copy(bucket.file(destThumb)).catch(() => undefined);
          }
          copiedMedia = {
            ...src.media,
            storagePath: destPath,
            thumbPath: destThumb,
          };
        }

        const preview =
          src.text?.trim().slice(0, 100) ||
          (src.type === 'image'
            ? 'Photo'
            : src.type === 'video'
              ? 'Video'
              : src.type === 'voice'
                ? 'Voice note'
                : src.type === 'audio'
                  ? 'Audio'
                  : 'Document');

        const batch = db.batch();
        const msgRef = db.collection('conversations').doc(targetCid).collection('messages').doc(newMid);
        batch.set(msgRef, {
          schemaVersion: 1,
          senderId: callerUid,
          type: src.type,
          text: src.text ?? null,
          media: copiedMedia ?? null,
          replyTo: null,
          forwarded: true,
          mentions: [],
          createdAt: FieldValue.serverTimestamp(),
          editedAt: null,
          deletedForEveryone: false,
          deletedAt: null,
          reactions: {},
        });
        batch.update(db.collection('conversations').doc(targetCid), {
          lastMessage: {
            id: newMid,
            senderId: callerUid,
            type: src.type,
            textPreview: preview,
            createdAt: FieldValue.serverTimestamp(),
          },
          lastMessageAt: FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp(),
        });
        await batch.commit();
      }
    }

    return { ok: true };
  },
);
