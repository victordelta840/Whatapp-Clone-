import { randomUUID } from 'node:crypto';
import { FieldValue, Timestamp } from 'firebase-admin/firestore';
import { getStorage } from 'firebase-admin/storage';
import { onCall } from 'firebase-functions/v2/https';
import JSZip from 'jszip';
import { FUNCTIONS_REGION, RATE_LIMITS, WINDOWS } from '../lib/constants.js';
import { getDb } from '../lib/db.js';
import { requireAuth } from '../lib/errors.js';
import { enforceRateLimit } from '../lib/rateLimit.js';

export const exportMyData = onCall(
  { region: FUNCTIONS_REGION, enforceAppCheck: true },
  async (request) => {
    const uid = requireAuth(request);
    await enforceRateLimit(
      uid,
      'exportMyData',
      RATE_LIMITS.EXPORT_DATA.limit,
      RATE_LIMITS.EXPORT_DATA.windowSec,
    );

    const db = getDb();
    const userRef = db.collection('users').doc(uid);

    const [profileSnap, accountSnap, settingsSnap, contactsSnap, blocksSnap, convsSnap] =
      await Promise.all([
        userRef.get(),
        userRef.collection('private').doc('account').get(),
        userRef.collection('private').doc('settings').get(),
        userRef.collection('contacts').get(),
        userRef.collection('blocks').get(),
        db.collection('conversations').where('participantIds', 'array-contains', uid).limit(200).get(),
      ]);

    const conversationsPayload = await Promise.all(
      convsSnap.docs.map(async (convDoc) => {
        const messagesSnap = await convDoc.ref
          .collection('messages')
          .orderBy('createdAt', 'desc')
          .limit(500)
          .get();
        return {
          id: convDoc.id,
          data: convDoc.data(),
          messages: messagesSnap.docs.map((m) => ({ id: m.id, ...m.data() })),
        };
      }),
    );

    const exportJson = {
      exportedAt: new Date().toISOString(),
      notice:
        'Messages in Converse are protected in transit and at rest by Google Cloud infrastructure and are not end-to-end encrypted.',
      profile: profileSnap.data() ?? null,
      account: accountSnap.data() ?? null,
      settings: settingsSnap.data() ?? null,
      contacts: contactsSnap.docs.map((d) => ({ uid: d.id, ...d.data() })),
      blocks: blocksSnap.docs.map((d) => ({ uid: d.id, ...d.data() })),
      conversations: conversationsPayload,
    };

    const zip = new JSZip();
    zip.file('converse-export.json', JSON.stringify(exportJson, null, 2));
    const buffer = await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });

    const exportId = randomUUID();
    const storagePath = `exports/${uid}/${exportId}.zip`;
    const bucket = getStorage().bucket();
    const file = bucket.file(storagePath);
    await file.save(buffer, {
      contentType: 'application/zip',
      metadata: {
        metadata: {
          ownerUid: uid,
          expiresAtMs: String(Date.now() + WINDOWS.EXPORT_EXPIRE_MS),
        },
      },
    });

    await db.collection('users').doc(uid).collection('private').doc('lastExport').set({
      schemaVersion: 1,
      storagePath,
      createdAt: FieldValue.serverTimestamp(),
      expiresAt: Timestamp.fromMillis(Date.now() + WINDOWS.EXPORT_EXPIRE_MS),
    });

    return { ok: true, storagePath };
  },
);
