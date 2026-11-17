import { FieldValue, Timestamp, getFirestore } from 'firebase-admin/firestore';
import { getStorage } from 'firebase-admin/storage';
import { onSchedule } from 'firebase-functions/v2/scheduler';
import { FUNCTIONS_REGION, WINDOWS } from '../lib/constants.js';

export const expireStatuses = onSchedule(
  { schedule: 'every 1 hours', region: FUNCTIONS_REGION },
  async () => {
    const db = getFirestore();
    const bucket = getStorage().bucket();
    const now = Timestamp.now();
    const expiredSnap = await db
      .collection('statuses')
      .where('expiresAt', '<=', now)
      .limit(200)
      .get();

    for (const docSnap of expiredSnap.docs) {
      const mediaPath = docSnap.data()?.media?.storagePath as string | undefined;
      if (mediaPath) {
        await bucket.file(mediaPath).delete({ ignoreNotFound: true }).catch(() => undefined);
      }
      await db.recursiveDelete(docSnap.ref);
    }
  },
);

export const sweepStaleCalls = onSchedule(
  { schedule: 'every 2 minutes', region: FUNCTIONS_REGION },
  async () => {
    const db = getFirestore();
    const cutoff = Timestamp.fromMillis(Date.now() - WINDOWS.CALL_STALE_MS);
    const staleSnap = await db
      .collection('calls')
      .where('state', '==', 'ringing')
      .where('createdAt', '<=', cutoff)
      .limit(100)
      .get();

    const batch = db.batch();
    for (const docSnap of staleSnap.docs) {
      batch.update(docSnap.ref, {
        state: 'missed',
        endedAt: FieldValue.serverTimestamp(),
        endedBy: 'system',
        endReason: 'ring-timeout',
      });
    }
    if (!staleSnap.empty) await batch.commit();
  },
);

export const cleanupOrphanUploads = onSchedule(
  { schedule: 'every 24 hours', region: FUNCTIONS_REGION },
  async () => {
    const db = getFirestore();
    const bucket = getStorage().bucket();
    const [files] = await bucket.getFiles({ prefix: 'chatMedia/', maxResults: 300 });
    const cutoffMs = Date.now() - WINDOWS.ORPHAN_UPLOAD_MS;

    for (const file of files) {
      const createdMs = file.metadata.timeCreated
        ? Date.parse(file.metadata.timeCreated)
        : Date.now();
      if (createdMs > cutoffMs) continue;

      const parts = file.name.split('/');
      const cid = parts[1];
      const mid = parts[3];
      if (!cid || !mid) continue;

      const msgSnap = await db
        .collection('conversations')
        .doc(cid)
        .collection('messages')
        .doc(mid)
        .get();
      if (!msgSnap.exists) {
        await file.delete({ ignoreNotFound: true }).catch(() => undefined);
      }
    }
  },
);

export const cleanupDevices = onSchedule(
  { schedule: 'every 24 hours', region: FUNCTIONS_REGION },
  async () => {
    const db = getFirestore();
    const cutoff = Timestamp.fromMillis(Date.now() - WINDOWS.DEVICE_STALE_MS);
    const staleDevices = await db
      .collectionGroup('devices')
      .where('lastSeenAt', '<=', cutoff)
      .limit(300)
      .get();

    const batch = db.batch();
    for (const d of staleDevices.docs) batch.delete(d.ref);
    if (!staleDevices.empty) await batch.commit();
  },
);

export const cleanupExports = onSchedule(
  { schedule: 'every 1 hours', region: FUNCTIONS_REGION },
  async () => {
    const bucket = getStorage().bucket();
    const [files] = await bucket.getFiles({ prefix: 'exports/', maxResults: 200 });
    const cutoffMs = Date.now() - WINDOWS.EXPORT_EXPIRE_MS;
    for (const file of files) {
      const createdMs = file.metadata.timeCreated
        ? Date.parse(file.metadata.timeCreated)
        : Date.now();
      if (createdMs <= cutoffMs) {
        await file.delete({ ignoreNotFound: true }).catch(() => undefined);
      }
    }
  },
);

export const cleanupRateLimits = onSchedule(
  { schedule: 'every 24 hours', region: FUNCTIONS_REGION },
  async () => {
    const db = getFirestore();
    const now = Timestamp.now();
    const expired = await db
      .collection('rateLimits')
      .where('expiresAt', '<=', now)
      .limit(500)
      .get();
    const batch = db.batch();
    for (const d of expired.docs) batch.delete(d.ref);
    if (!expired.empty) await batch.commit();
  },
);
