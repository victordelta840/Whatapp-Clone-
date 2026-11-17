import { randomUUID } from 'node:crypto';
import { FieldValue, getFirestore } from 'firebase-admin/firestore';
import { getStorage } from 'firebase-admin/storage';
import { onDocumentCreated, onDocumentUpdated } from 'firebase-functions/v2/firestore';
import { onObjectFinalized } from 'firebase-functions/v2/storage';
import { defineSecret } from 'firebase-functions/params';
import { FUNCTIONS_REGION } from '../lib/constants.js';
import { sendPushToUser } from '../lib/fcm.js';
import { hashE164Phone } from '../callable/statusAndContacts.js';
const phoneHashPepper = defineSecret('PHONE_HASH_PEPPER');
export const onCallCreated = onDocumentCreated({ region: FUNCTIONS_REGION, document: 'calls/{callId}' }, async (event) => {
    const snap = event.data;
    if (!snap)
        return;
    const call = snap.data();
    if (call.state !== 'ringing')
        return;
    const db = getFirestore();
    const callerSnap = await db.collection('users').doc(call.callerId).get();
    const callerName = callerSnap.data()?.displayName ?? 'Someone';
    await sendPushToUser({
        recipientUid: call.calleeId,
        category: 'calls',
        callId: event.params.callId,
        title: `Incoming ${call.type} call`,
        body: `${callerName} is calling you on Converse`,
        tag: `call-${event.params.callId}`,
        highPriority: true,
        data: {
            callId: event.params.callId,
            conversationId: call.conversationId,
            kind: 'call',
            callType: call.type,
        },
    });
});
export const onCallUpdated = onDocumentUpdated({ region: FUNCTIONS_REGION, document: 'calls/{callId}' }, async (event) => {
    const before = event.data?.before.data();
    const after = event.data?.after.data();
    if (!before || !after || before.state === after.state)
        return;
    const terminalStates = new Set(['declined', 'busy', 'cancelled', 'missed', 'ended', 'failed']);
    if (!after.state || !terminalStates.has(after.state))
        return;
    const db = getFirestore();
    const { callId } = event.params;
    if (after.answeredAt && after.endedAt && after.durationSec == null) {
        const durationSec = Math.max(0, Math.round((after.endedAt.toMillis() - after.answeredAt.toMillis()) / 1000));
        await event.data.after.ref.update({ durationSec });
    }
    if (after.state === 'missed' || after.state === 'declined') {
        const mid = randomUUID();
        const text = after.state === 'missed'
            ? `Missed ${after.type} call`
            : `Declined ${after.type} call`;
        const batch = db.batch();
        batch.set(db
            .collection('conversations')
            .doc(after.conversationId)
            .collection('messages')
            .doc(mid), {
            schemaVersion: 1,
            senderId: after.callerId,
            type: 'system',
            text,
            media: null,
            replyTo: null,
            forwarded: false,
            mentions: [],
            createdAt: FieldValue.serverTimestamp(),
            editedAt: null,
            deletedForEveryone: false,
            deletedAt: null,
            reactions: {},
            systemEvent: {
                kind: after.state === 'missed' ? 'callMissed' : 'callDeclined',
                actorUid: after.callerId,
                targetUids: [after.calleeId],
                callId,
            },
        });
        batch.update(db.collection('conversations').doc(after.conversationId), {
            lastMessage: {
                id: mid,
                senderId: after.callerId,
                type: 'system',
                textPreview: text,
                createdAt: FieldValue.serverTimestamp(),
            },
            lastMessageAt: FieldValue.serverTimestamp(),
            updatedAt: FieldValue.serverTimestamp(),
        });
        await batch.commit();
        if (after.state === 'missed') {
            const callerSnap = await db.collection('users').doc(after.callerId).get();
            const callerName = callerSnap.data()?.displayName ?? 'Someone';
            await db.collection('users').doc(after.calleeId).collection('notifications').add({
                schemaVersion: 1,
                type: 'missedCall',
                title: 'Missed call',
                body: `Missed ${after.type} call from ${callerName}`,
                data: {
                    conversationId: after.conversationId,
                    messageId: mid,
                    callId,
                    actorUid: after.callerId,
                },
                read: false,
                createdAt: FieldValue.serverTimestamp(),
            });
        }
    }
    // Delete WebRTC signaling documents on call termination
    const signalsSnap = await event.data.after.ref.collection('signals').get();
    if (!signalsSnap.empty) {
        const batch = db.batch();
        for (const s of signalsSnap.docs)
            batch.delete(s.ref);
        await batch.commit();
    }
});
export const onStatusViewCreated = onDocumentCreated({ region: FUNCTIONS_REGION, document: 'statuses/{sid}/views/{viewerUid}' }, async (event) => {
    const db = getFirestore();
    await db
        .collection('statuses')
        .doc(event.params.sid)
        .update({ viewCount: FieldValue.increment(1) })
        .catch(() => undefined);
});
export const onBlockCreated = onDocumentCreated({ region: FUNCTIONS_REGION, document: 'users/{uid}/blocks/{blockedUid}' }, async (event) => {
    const { uid, blockedUid } = event.params;
    const db = getFirestore();
    // Remove each party from the other's active status audiences
    const [aStatuses, bStatuses] = await Promise.all([
        db.collection('statuses').where('authorId', '==', uid).get(),
        db.collection('statuses').where('authorId', '==', blockedUid).get(),
    ]);
    const batch = db.batch();
    for (const s of aStatuses.docs) {
        batch.update(s.ref, { viewerIds: FieldValue.arrayRemove(blockedUid) });
    }
    for (const s of bStatuses.docs) {
        batch.update(s.ref, { viewerIds: FieldValue.arrayRemove(uid) });
    }
    await batch.commit();
});
export const onReportCreated = onDocumentCreated({ region: FUNCTIONS_REGION, document: 'reports/{rid}' }, async (event) => {
    const snap = event.data;
    if (!snap)
        return;
    const report = snap.data();
    if (!report.conversationId)
        return;
    const db = getFirestore();
    const recentMsgs = await db
        .collection('conversations')
        .doc(report.conversationId)
        .collection('messages')
        .orderBy('createdAt', 'desc')
        .limit(5)
        .get();
    const evidenceSnapshot = recentMsgs.docs.map((d) => ({
        id: d.id,
        senderId: d.data().senderId,
        type: d.data().type,
        text: d.data().text ?? null,
        createdAt: d.data().createdAt ?? null,
    }));
    await snap.ref.update({ evidenceSnapshot });
});
export const onSettingsUpdated = onDocumentUpdated({
    region: FUNCTIONS_REGION,
    document: 'users/{uid}/private/settings',
    secrets: [phoneHashPepper],
}, async (event) => {
    const uid = event.params.uid;
    const beforeFindable = event.data?.before.data()?.privacy?.findableByPhone;
    const afterFindable = event.data?.after.data()?.privacy?.findableByPhone;
    if (beforeFindable === afterFindable)
        return;
    const db = getFirestore();
    const accountSnap = await db.collection('users').doc(uid).collection('private').doc('account').get();
    const phone = accountSnap.data()?.phoneNumber;
    if (!phone)
        return;
    const pepper = phoneHashPepper.value() || 'dev-ephemeral-pepper';
    const hmac = hashE164Phone(phone, pepper);
    if (afterFindable) {
        await db.collection('phoneIndex').doc(hmac).set({ schemaVersion: 1, uid });
    }
    else {
        await db.collection('phoneIndex').doc(hmac).delete().catch(() => undefined);
    }
});
const BLOCKED_MIMES = new Set([
    'application/x-msdownload',
    'application/x-msdos-program',
    'application/x-executable',
    'application/x-sh',
    'application/x-shellscript',
    'application/x-bat',
    'application/java-archive',
    'application/vnd.android.package-archive',
]);
export const onStorageFinalized = onObjectFinalized({ region: FUNCTIONS_REGION }, async (event) => {
    const object = event.data;
    const name = object.name ?? '';
    const contentType = (object.contentType ?? '').toLowerCase();
    const size = Number(object.size ?? 0);
    if (!name.startsWith('chatMedia/') && !name.startsWith('statusMedia/')) {
        return;
    }
    const violatesExecutable = BLOCKED_MIMES.has(contentType);
    const violatesMax = size > 64 * 1024 * 1024;
    if (violatesExecutable || violatesMax) {
        await getStorage().bucket(object.bucket).file(name).delete({ ignoreNotFound: true });
    }
});
//# sourceMappingURL=onCallAndStatus.js.map