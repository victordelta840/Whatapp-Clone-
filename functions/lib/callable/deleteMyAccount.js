import { getAuth } from 'firebase-admin/auth';
import { FieldValue, getFirestore } from 'firebase-admin/firestore';
import { getStorage } from 'firebase-admin/storage';
import { HttpsError, onCall } from 'firebase-functions/v2/https';
import { z } from 'zod';
import { FUNCTIONS_REGION } from '../lib/constants.js';
import { parseInput, requireAuth } from '../lib/errors.js';
const deleteAccountSchema = z.object({
    confirmation: z.literal('DELETE MY ACCOUNT'),
});
export const deleteMyAccount = onCall({
    region: FUNCTIONS_REGION,
    enforceAppCheck: true,
    consumeAppCheckToken: true,
}, async (request) => {
    const uid = requireAuth(request);
    parseInput(deleteAccountSchema, request.data);
    const db = getFirestore();
    const bucket = getStorage().bucket();
    const userRef = db.collection('users').doc(uid);
    const userSnap = await userRef.get();
    const username = userSnap.data()?.username ?? null;
    if (username) {
        await db.collection('usernames').doc(username).delete().catch(() => undefined);
    }
    // Remove user from conversations & tombstone their sent messages
    const convsSnap = await db
        .collection('conversations')
        .where('participantIds', 'array-contains', uid)
        .get();
    for (const convDoc of convsSnap.docs) {
        const messagesSnap = await convDoc.ref
            .collection('messages')
            .where('senderId', '==', uid)
            .get();
        const batch = db.batch();
        for (const msgDoc of messagesSnap.docs) {
            batch.update(msgDoc.ref, {
                text: '[Deleted account message]',
                media: null,
                replyTo: null,
                deletedForEveryone: true,
                deletedAt: FieldValue.serverTimestamp(),
            });
        }
        batch.update(convDoc.ref, {
            participantIds: FieldValue.arrayRemove(uid),
            updatedAt: FieldValue.serverTimestamp(),
        });
        batch.delete(convDoc.ref.collection('members').doc(uid));
        await batch.commit();
    }
    // Delete statuses authored by user
    const statusesSnap = await db.collection('statuses').where('authorId', '==', uid).get();
    for (const statusDoc of statusesSnap.docs) {
        await db.recursiveDelete(statusDoc.ref);
    }
    // Delete user subcollections and doc
    await db.recursiveDelete(userRef);
    await db.collection('presence').doc(uid).delete().catch(() => undefined);
    // Delete user Storage artifacts
    await Promise.allSettled([
        bucket.deleteFiles({ prefix: `profilePhotos/${uid}/` }),
        bucket.deleteFiles({ prefix: `statusMedia/${uid}/` }),
        bucket.deleteFiles({ prefix: `exports/${uid}/` }),
    ]);
    try {
        await getAuth().deleteUser(uid);
    }
    catch (err) {
        throw new HttpsError('internal', err instanceof Error ? err.message : 'Failed to delete Auth account.');
    }
    return { ok: true };
});
//# sourceMappingURL=deleteMyAccount.js.map