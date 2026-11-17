import { createHmac } from 'node:crypto';
import { FieldValue, Timestamp } from 'firebase-admin/firestore';
import { onCall } from 'firebase-functions/v2/https';
import { defineSecret } from 'firebase-functions/params';
import { z } from 'zod';
import { FUNCTIONS_REGION, LIMITS, RATE_LIMITS, WINDOWS } from '../lib/constants.js';
import { getDb } from '../lib/db.js';
import { parseInput, requireVerifiedEmailOrProvider } from '../lib/errors.js';
import { enforceRateLimit } from '../lib/rateLimit.js';
const phoneHashPepper = defineSecret('PHONE_HASH_PEPPER');
const createStatusSchema = z.object({
    statusId: z.string().trim().min(1).max(128).optional(),
    type: z.enum(['text', 'image', 'video']),
    text: z.string().max(LIMITS.STATUS_TEXT_MAX).nullable().optional(),
    backgroundColor: z.string().max(32).nullable().optional(),
    fontStyle: z.string().max(32).nullable().optional(),
    caption: z.string().max(LIMITS.STATUS_TEXT_MAX).nullable().optional(),
    media: z
        .object({
        storagePath: z.string().max(300),
        thumbPath: z.string().max(300).nullable(),
        mimeType: z.string().max(120),
        sizeBytes: z.number().int().nonnegative(),
        durationMs: z.number().int().nonnegative().nullable().optional(),
    })
        .nullable()
        .optional(),
});
export const createStatus = onCall({ region: FUNCTIONS_REGION, enforceAppCheck: true }, async (request) => {
    const uid = requireVerifiedEmailOrProvider(request);
    const input = parseInput(createStatusSchema, request.data);
    await enforceRateLimit(uid, 'createStatus', RATE_LIMITS.CREATE_STATUS.limit, RATE_LIMITS.CREATE_STATUS.windowSec);
    const db = getDb();
    const userRef = db.collection('users').doc(uid);
    const [settingsSnap, contactsSnap] = await Promise.all([
        userRef.collection('private').doc('settings').get(),
        userRef.collection('contacts').limit(LIMITS.STATUS_VIEWERS_MAX).get(),
    ]);
    const audience = (settingsSnap.data()?.privacy?.statusAudience ?? {
        mode: 'contacts',
        uids: [],
    });
    const contactUids = contactsSnap.docs.map((d) => d.id);
    const candidateUids = audience.mode === 'onlyList'
        ? audience.uids
        : audience.mode === 'excludeList'
            ? (() => {
                const excluded = new Set(audience.uids);
                return contactUids.filter((id) => !excluded.has(id));
            })()
            : contactUids;
    const viewerIds = [];
    for (const candidate of candidateUids.slice(0, LIMITS.STATUS_VIEWERS_MAX)) {
        if (candidate === uid)
            continue;
        const blockedAuthorSnap = await db
            .collection('users')
            .doc(candidate)
            .collection('blocks')
            .doc(uid)
            .get();
        if (!blockedAuthorSnap.exists) {
            viewerIds.push(candidate);
        }
    }
    const nowMs = Date.now();
    const statusRef = input.statusId
        ? db.collection('statuses').doc(input.statusId)
        : db.collection('statuses').doc();
    await statusRef.set({
        schemaVersion: 1,
        authorId: uid,
        type: input.type,
        text: input.text ?? null,
        backgroundColor: input.backgroundColor ?? 'indigo',
        fontStyle: input.fontStyle ?? 'sans',
        media: input.media ?? null,
        caption: input.caption ?? null,
        createdAt: FieldValue.serverTimestamp(),
        expiresAt: Timestamp.fromMillis(nowMs + WINDOWS.STATUS_EXPIRY_MS),
        deleteAt: Timestamp.fromMillis(nowMs + WINDOWS.STATUS_DELETE_TTL_MS),
        viewerIds,
        viewCount: 0,
    });
    return { ok: true, statusId: statusRef.id, viewerCount: viewerIds.length };
});
const discoverSchema = z.object({
    phoneNumbers: z
        .array(z.string().trim().regex(/^\+[1-9]\d{6,14}$/))
        .min(1)
        .max(LIMITS.DISCOVER_BATCH_MAX),
});
export function hashE164Phone(e164, pepper) {
    return createHmac('sha256', pepper).update(e164).digest('hex');
}
export const discoverContacts = onCall({
    region: FUNCTIONS_REGION,
    enforceAppCheck: true,
    consumeAppCheckToken: true,
    secrets: [phoneHashPepper],
}, async (request) => {
    const callerUid = requireVerifiedEmailOrProvider(request);
    const input = parseInput(discoverSchema, request.data);
    await enforceRateLimit(callerUid, 'discoverContacts', RATE_LIMITS.DISCOVER_CONTACTS.limit, RATE_LIMITS.DISCOVER_CONTACTS.windowSec);
    const pepper = phoneHashPepper.value() || 'dev-ephemeral-pepper';
    const db = getDb();
    const matches = [];
    const seenUids = new Set();
    // Never persist the uploaded phone number list
    for (const phone of input.phoneNumbers) {
        const hmac = hashE164Phone(phone, pepper);
        const indexSnap = await db.collection('phoneIndex').doc(hmac).get();
        if (!indexSnap.exists)
            continue;
        const targetUid = indexSnap.data()?.uid;
        if (!targetUid || targetUid === callerUid || seenUids.has(targetUid))
            continue;
        seenUids.add(targetUid);
        const [userSnap, settingsSnap, blockSnap] = await Promise.all([
            db.collection('users').doc(targetUid).get(),
            db.collection('users').doc(targetUid).collection('private').doc('settings').get(),
            db.collection('users').doc(targetUid).collection('blocks').doc(callerUid).get(),
        ]);
        if (!userSnap.exists || blockSnap.exists)
            continue;
        if (settingsSnap.data()?.privacy?.findableByPhone !== true)
            continue;
        matches.push({
            uid: targetUid,
            displayName: userSnap.data()?.displayName ?? 'Converse User',
            username: userSnap.data()?.username ?? null,
        });
    }
    return { ok: true, matches };
});
//# sourceMappingURL=statusAndContacts.js.map