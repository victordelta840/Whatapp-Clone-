import { getMessaging } from 'firebase-admin/messaging';
import { getDb } from './db.js';
export async function sendPushToUser(opts) {
    const db = getDb();
    const userRef = db.collection('users').doc(opts.recipientUid);
    const [settingsSnap, chatStateSnap, devicesSnap] = await Promise.all([
        userRef.collection('private').doc('settings').get(),
        opts.conversationId
            ? userRef.collection('chatStates').doc(opts.conversationId).get()
            : Promise.resolve(null),
        userRef.collection('devices').where('notificationsEnabled', '==', true).get(),
    ]);
    if (devicesSnap.empty)
        return;
    const settings = settingsSnap.data();
    const notifPrefs = settings?.notifications;
    if (notifPrefs && notifPrefs[opts.category] === false) {
        return;
    }
    if (chatStateSnap?.exists) {
        const mutedUntil = chatStateSnap.data()?.mutedUntil?.toMillis?.();
        if (mutedUntil && mutedUntil > Date.now()) {
            return;
        }
    }
    const showPreviews = notifPrefs?.showPreviews !== false;
    const resolvedBody = showPreviews ? opts.body : 'New activity on Converse';
    const messaging = getMessaging();
    const tokens = [];
    for (const doc of devicesSnap.docs) {
        const token = doc.data()?.fcmToken;
        if (token)
            tokens.push({ docId: doc.id, token });
    }
    if (tokens.length === 0)
        return;
    const response = await messaging.sendEachForMulticast({
        tokens: tokens.map((t) => t.token),
        notification: {
            title: opts.title,
            body: resolvedBody,
        },
        data: {
            ...(opts.data ?? {}),
            title: opts.title,
            body: resolvedBody,
            tag: opts.tag,
        },
        webpush: {
            headers: {
                Urgency: opts.highPriority ? 'high' : 'normal',
            },
            notification: {
                tag: opts.tag,
                renotify: Boolean(opts.highPriority),
            },
        },
    });
    // Clean up invalid registration tokens immediately
    const batch = db.batch();
    let hasDeletes = false;
    response.responses.forEach((res, idx) => {
        if (!res.success && res.error) {
            const code = res.error.code;
            if (code === 'messaging/registration-token-not-registered' ||
                code === 'messaging/invalid-registration-token') {
                const entry = tokens[idx];
                if (entry) {
                    batch.delete(userRef.collection('devices').doc(entry.docId));
                    hasDeletes = true;
                }
            }
        }
    });
    if (hasDeletes) {
        await batch.commit();
    }
}
//# sourceMappingURL=fcm.js.map