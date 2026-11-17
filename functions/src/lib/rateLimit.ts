import { FieldValue, Timestamp } from 'firebase-admin/firestore';
import { HttpsError } from 'firebase-functions/v2/https';
import { getDb } from './db.js';

export async function enforceRateLimit(
  uid: string,
  bucket: string,
  limit: number,
  windowSec: number,
): Promise<void> {
  const db = getDb();
  const key = `${uid}_${bucket}`;
  const ref = db.collection('rateLimits').doc(key);
  const nowMs = Date.now();
  const windowMs = windowSec * 1000;

  await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const data = snap.data() as
      | { count?: number; windowStart?: Timestamp; expiresAt?: Timestamp }
      | undefined;

    const windowStartMs = data?.windowStart?.toMillis() ?? 0;
    const isExpired = nowMs - windowStartMs >= windowMs;

    if (!snap.exists || isExpired) {
      tx.set(ref, {
        schemaVersion: 1,
        uid,
        bucket,
        count: 1,
        windowStart: Timestamp.fromMillis(nowMs),
        expiresAt: Timestamp.fromMillis(nowMs + windowMs),
        updatedAt: FieldValue.serverTimestamp(),
      });
      return;
    }

    const currentCount = data?.count ?? 0;
    if (currentCount >= limit) {
      throw new HttpsError(
        'resource-exhausted',
        `Rate limit exceeded for ${bucket}. Try again later.`,
      );
    }

    tx.update(ref, {
      count: currentCount + 1,
      updatedAt: FieldValue.serverTimestamp(),
    });
  });
}
