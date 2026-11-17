import { FieldValue, Timestamp } from 'firebase-admin/firestore';
import { getStorage } from 'firebase-admin/storage';
import { onDocumentCreated, onDocumentUpdated } from 'firebase-functions/v2/firestore';
import { FUNCTIONS_REGION, RATE_LIMITS } from '../lib/constants.js';
import { FIRESTORE_DATABASE_ID, getDb } from '../lib/db.js';
import { sendPushToUser } from '../lib/fcm.js';
export const onMessageCreated = onDocumentCreated({
    region: FUNCTIONS_REGION,
    database: FIRESTORE_DATABASE_ID,
    document: 'conversations/{cid}/messages/{mid}',
}, async (event) => {
    const snap = event.data;
    if (!snap)
        return;
    const msg = snap.data();
    const { cid, mid } = event.params;
    const db = getDb();
    const convSnap = await db.collection('conversations').doc(cid).get();
    if (!convSnap.exists)
        return;
    const conv = convSnap.data();
    if (msg.type === 'system')
        return;
    // Rate-limit / abuse check per sender
    const minBucket = Math.floor(Date.now() / 60000);
    const rateRef = db.collection('rateLimits').doc(`${msg.senderId}_msg_${minBucket}`);
    const newCount = await db.runTransaction(async (tx) => {
        const rSnap = await tx.get(rateRef);
        const count = (rSnap.data()?.count ?? 0) + 1;
        tx.set(rateRef, {
            schemaVersion: 1,
            uid: msg.senderId,
            bucket: 'msg_per_min',
            count,
            expiresAt: Timestamp.fromMillis(Date.now() + 120_000),
            updatedAt: FieldValue.serverTimestamp(),
        }, { merge: true });
        return count;
    });
    if (newCount > RATE_LIMITS.MESSAGES_PER_MIN_MODERATION) {
        await db
            .collection('users')
            .doc(msg.senderId)
            .collection('private')
            .doc('moderation')
            .set({
            schemaVersion: 1,
            restricted: true,
            reason: 'Automated message rate threshold exceeded',
            until: Timestamp.fromMillis(Date.now() + 15 * 60 * 1000),
        }, { merge: true });
    }
    const senderSnap = await db.collection('users').doc(msg.senderId).get();
    const senderName = senderSnap.data()?.displayName ?? 'Someone';
    const validMentions = new Set((msg.mentions ?? []).filter((uid) => conv.participantIds.includes(uid)));
    const preview = msg.text?.trim().slice(0, 100) ||
        (msg.type === 'image'
            ? 'Sent a photo'
            : msg.type === 'video'
                ? 'Sent a video'
                : msg.type === 'voice'
                    ? 'Sent a voice note'
                    : msg.type === 'audio'
                        ? 'Sent audio'
                        : 'Sent a document');
    const title = conv.type === 'group' ? conv.group?.name ?? 'Group Chat' : senderName;
    const body = conv.type === 'group' ? `${senderName}: ${preview}` : preview;
    for (const recipientUid of conv.participantIds) {
        if (recipientUid === msg.senderId)
            continue;
        const blockSnap = await db
            .collection('users')
            .doc(recipientUid)
            .collection('blocks')
            .doc(msg.senderId)
            .get();
        if (blockSnap.exists)
            continue;
        // Increment unread count
        await db
            .collection('users')
            .doc(recipientUid)
            .collection('chatStates')
            .doc(cid)
            .set({
            schemaVersion: 1,
            unreadCount: FieldValue.increment(1),
        }, { merge: true });
        const isMention = validMentions.has(recipientUid);
        await db
            .collection('users')
            .doc(recipientUid)
            .collection('notifications')
            .add({
            schemaVersion: 1,
            type: isMention ? 'mention' : 'message',
            title,
            body,
            data: {
                conversationId: cid,
                messageId: mid,
                callId: null,
                actorUid: msg.senderId,
            },
            read: false,
            createdAt: FieldValue.serverTimestamp(),
        });
        await sendPushToUser({
            recipientUid,
            category: conv.type === 'group' ? 'groups' : 'messages',
            conversationId: cid,
            title,
            body,
            tag: cid,
            data: { conversationId: cid, messageId: mid, kind: 'message' },
        });
    }
});
export const onMessageUpdated = onDocumentUpdated({
    region: FUNCTIONS_REGION,
    database: FIRESTORE_DATABASE_ID,
    document: 'conversations/{cid}/messages/{mid}',
}, async (event) => {
    const before = event.data?.before.data();
    const after = event.data?.after.data();
    if (!before || !after)
        return;
    const { cid, mid } = event.params;
    const db = getDb();
    const convRef = db.collection('conversations').doc(cid);
    if (!before.deletedForEveryone && after.deletedForEveryone) {
        const bucket = getStorage().bucket();
        if (before.media?.storagePath) {
            await bucket.file(before.media.storagePath).delete({ ignoreNotFound: true }).catch(() => undefined);
        }
        if (before.media?.thumbPath) {
            await bucket.file(before.media.thumbPath).delete({ ignoreNotFound: true }).catch(() => undefined);
        }
        const convSnap = await convRef.get();
        if (convSnap.data()?.lastMessage?.id === mid) {
            await convRef.update({
                'lastMessage.textPreview': 'This message was deleted',
                updatedAt: FieldValue.serverTimestamp(),
            });
        }
        return;
    }
    if (before.text !== after.text && after.text) {
        const convSnap = await convRef.get();
        if (convSnap.data()?.lastMessage?.id === mid) {
            await convRef.update({
                'lastMessage.textPreview': after.text.trim().slice(0, 100),
                updatedAt: FieldValue.serverTimestamp(),
            });
        }
    }
});
//# sourceMappingURL=onMessage.js.map