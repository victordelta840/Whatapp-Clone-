import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import { onCall } from 'firebase-functions/v2/https';
import { z } from 'zod';
import { FUNCTIONS_REGION, RATE_LIMITS } from '../lib/constants.js';
import { parseInput, requireAuth } from '../lib/errors.js';
import { enforceRateLimit } from '../lib/rateLimit.js';
const lookupSchema = z.object({
    kind: z.enum(['username', 'email', 'phone']),
    value: z.string().trim().min(2).max(160),
});
export const lookupUser = onCall({ region: FUNCTIONS_REGION, enforceAppCheck: true }, async (request) => {
    const callerUid = requireAuth(request);
    const input = parseInput(lookupSchema, request.data);
    await enforceRateLimit(callerUid, 'lookupUser', RATE_LIMITS.LOOKUP_USER.limit, RATE_LIMITS.LOOKUP_USER.windowSec);
    const db = getFirestore();
    let targetUid = null;
    if (input.kind === 'username') {
        const normalized = input.value.toLowerCase().replace(/^@/, '');
        const snap = await db.collection('usernames').doc(normalized).get();
        if (snap.exists) {
            targetUid = snap.data()?.uid ?? null;
        }
    }
    else if (input.kind === 'email') {
        try {
            const record = await getAuth().getUserByEmail(input.value.toLowerCase());
            targetUid = record.uid;
        }
        catch {
            targetUid = null;
        }
    }
    else if (input.kind === 'phone') {
        try {
            const record = await getAuth().getUserByPhoneNumber(input.value);
            targetUid = record.uid;
        }
        catch {
            targetUid = null;
        }
    }
    if (!targetUid || targetUid === callerUid) {
        return { found: false, user: null };
    }
    const [userSnap, settingsSnap, blockSnap] = await Promise.all([
        db.collection('users').doc(targetUid).get(),
        db.collection('users').doc(targetUid).collection('private').doc('settings').get(),
        db.collection('users').doc(targetUid).collection('blocks').doc(callerUid).get(),
    ]);
    if (!userSnap.exists || blockSnap.exists) {
        return { found: false, user: null };
    }
    const privacy = settingsSnap.data()?.privacy;
    if (input.kind === 'username' && privacy?.findableByUsername === false) {
        return { found: false, user: null };
    }
    if (input.kind === 'email' && privacy?.findableByEmail === false) {
        return { found: false, user: null };
    }
    if (input.kind === 'phone' && privacy?.findableByPhone === false) {
        return { found: false, user: null };
    }
    const data = userSnap.data() ?? {};
    return {
        found: true,
        user: {
            uid: targetUid,
            displayName: data.displayName ?? 'Converse User',
            username: data.username ?? null,
        },
    };
});
//# sourceMappingURL=lookupUser.js.map