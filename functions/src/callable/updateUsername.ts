import { FieldValue, getFirestore } from 'firebase-admin/firestore';
import { HttpsError, onCall } from 'firebase-functions/v2/https';
import { z } from 'zod';
import { FUNCTIONS_REGION, RATE_LIMITS } from '../lib/constants.js';
import { parseInput, requireAuth } from '../lib/errors.js';
import { enforceRateLimit } from '../lib/rateLimit.js';

const updateUsernameSchema = z.object({
  username: z
    .string()
    .trim()
    .toLowerCase()
    .regex(/^[a-z0-9_.]{3,30}$/, 'Username must be 3-30 chars using a-z, 0-9, _, or .')
    .nullable(),
});

export const updateUsername = onCall(
  { region: FUNCTIONS_REGION, enforceAppCheck: true },
  async (request) => {
    const uid = requireAuth(request);
    const input = parseInput(updateUsernameSchema, request.data);
    await enforceRateLimit(
      uid,
      'updateUsername',
      RATE_LIMITS.UPDATE_USERNAME.limit,
      RATE_LIMITS.UPDATE_USERNAME.windowSec,
    );

    const db = getFirestore();
    const userRef = db.collection('users').doc(uid);

    await db.runTransaction(async (tx) => {
      const userSnap = await tx.get(userRef);
      if (!userSnap.exists) {
        throw new HttpsError('failed-precondition', 'Profile must be bootstrapped first.');
      }
      const oldUsername = (userSnap.data()?.username as string | null) ?? null;
      const nextUsername = input.username;

      if (oldUsername === nextUsername) {
        return;
      }

      if (nextUsername) {
        const nextReservationRef = db.collection('usernames').doc(nextUsername);
        const reservationSnap = await tx.get(nextReservationRef);
        if (reservationSnap.exists && reservationSnap.data()?.uid !== uid) {
          throw new HttpsError('already-exists', 'That username is already taken.');
        }
        tx.set(nextReservationRef, {
          schemaVersion: 1,
          uid,
          createdAt: FieldValue.serverTimestamp(),
        });
      }

      if (oldUsername) {
        const oldRef = db.collection('usernames').doc(oldUsername);
        const oldSnap = await tx.get(oldRef);
        if (oldSnap.exists && oldSnap.data()?.uid === uid) {
          tx.delete(oldRef);
        }
      }

      tx.update(userRef, {
        username: nextUsername,
        updatedAt: FieldValue.serverTimestamp(),
      });
    });

    return { ok: true, username: input.username };
  },
);
