import { getAuth } from 'firebase-admin/auth';
import { FieldValue, getFirestore } from 'firebase-admin/firestore';
import { onCall } from 'firebase-functions/v2/https';
import { FUNCTIONS_REGION } from '../lib/constants.js';
import { requireAuth } from '../lib/errors.js';
import { enforceRateLimit } from '../lib/rateLimit.js';

export const revokeAllSessions = onCall(
  { region: FUNCTIONS_REGION, enforceAppCheck: true },
  async (request) => {
    const uid = requireAuth(request);
    await enforceRateLimit(uid, 'revokeAllSessions', 10, 3600);

    await getAuth().revokeRefreshTokens(uid);
    const db = getFirestore();
    await db.collection('users').doc(uid).collection('private').doc('account').set(
      {
        sessionsRevokedAt: FieldValue.serverTimestamp(),
      },
      { merge: true },
    );

    const devicesSnap = await db.collection('users').doc(uid).collection('devices').get();
    const batch = db.batch();
    for (const d of devicesSnap.docs) {
      batch.delete(d.ref);
    }
    await batch.commit();

    return { ok: true };
  },
);
