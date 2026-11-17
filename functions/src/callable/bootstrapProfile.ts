import { createHmac } from 'node:crypto';
import { FieldValue } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';
import { defineSecret } from 'firebase-functions/params';
import { onCall } from 'firebase-functions/v2/https';
import { z } from 'zod';
import { FUNCTIONS_REGION, LIMITS, RATE_LIMITS } from '../lib/constants.js';
import { getDb } from '../lib/db.js';
import { parseInput, requireAuth } from '../lib/errors.js';
import { enforceRateLimit } from '../lib/rateLimit.js';

const phoneHashPepper = defineSecret('PHONE_HASH_PEPPER');

const bootstrapSchema = z.object({
  displayName: z.string().trim().min(LIMITS.DISPLAY_NAME_MIN).max(LIMITS.DISPLAY_NAME_MAX).optional(),
  locale: z.string().trim().min(2).max(16).optional(),
});

export const defaultSettings = (locale = 'en') => ({
  schemaVersion: 1,
  privacy: {
    lastSeen: 'everyone',
    onlineStatus: 'everyone',
    profilePhoto: 'everyone',
    about: 'everyone',
    readReceipts: true,
    typingIndicators: true,
    groupAdd: 'everyone',
    statusAudience: { mode: 'contacts', uids: [] as string[] },
    findableByUsername: true,
    findableByPhone: true,
    findableByEmail: true,
  },
  notifications: {
    messages: true,
    groups: true,
    calls: true,
    statusUpdates: true,
    showPreviews: true,
  },
  mutedStatusAuthors: [] as string[],
  theme: 'system',
  locale,
});

export const bootstrapProfile = onCall(
  { region: FUNCTIONS_REGION, enforceAppCheck: true, secrets: [phoneHashPepper] },
  async (request) => {
    const uid = requireAuth(request);
    const input = parseInput(bootstrapSchema, request.data);
    await enforceRateLimit(
      uid,
      'bootstrapProfile',
      RATE_LIMITS.BOOTSTRAP.limit,
      RATE_LIMITS.BOOTSTRAP.windowSec,
    );

    const db = getDb();
    const authUser = await getAuth().getUser(uid);
    const providers = authUser.providerData.map((p) => p.providerId);
    const resolvedName =
      input.displayName || authUser.displayName?.trim() || authUser.phoneNumber || 'WhatsApp User';

    const userRef = db.collection('users').doc(uid);
    const accountRef = userRef.collection('private').doc('account');
    const settingsRef = userRef.collection('private').doc('settings');
    const photoRef = userRef.collection('restricted').doc('photo');
    const aboutRef = userRef.collection('restricted').doc('about');

    const created = await db.runTransaction(async (tx) => {
      const userSnap = await tx.get(userRef);
      if (userSnap.exists) {
        tx.set(
          accountRef,
          {
            schemaVersion: 1,
            email: authUser.email ?? null,
            phoneNumber: authUser.phoneNumber ?? null,
            providers,
          },
          { merge: true },
        );
        return false;
      }

      tx.set(userRef, {
        schemaVersion: 1,
        displayName: resolvedName.slice(0, LIMITS.DISPLAY_NAME_MAX),
        displayNameLower: resolvedName.slice(0, LIMITS.DISPLAY_NAME_MAX).toLowerCase(),
        username: null,
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      });
      tx.set(accountRef, {
        schemaVersion: 1,
        email: authUser.email ?? null,
        phoneNumber: authUser.phoneNumber ?? null,
        providers,
        createdAt: FieldValue.serverTimestamp(),
      });
      tx.set(settingsRef, defaultSettings(input.locale ?? 'en'));
      tx.set(photoRef, {
        schemaVersion: 1,
        photoPath: null,
        photoURL: authUser.photoURL ?? null,
        updatedAt: FieldValue.serverTimestamp(),
      });
      tx.set(aboutRef, {
        schemaVersion: 1,
        text: 'Hey there! I am using WhatsApp.',
        updatedAt: FieldValue.serverTimestamp(),
      });
      return true;
    });

    if (authUser.phoneNumber) {
      const settingsSnap = await settingsRef.get();
      const findableByPhone = settingsSnap.data()?.privacy?.findableByPhone !== false;
      if (findableByPhone) {
        const pepper = phoneHashPepper.value() || 'dev-ephemeral-pepper';
        const hmac = createHmac('sha256', pepper).update(authUser.phoneNumber).digest('hex');
        await db.collection('phoneIndex').doc(hmac).set({ schemaVersion: 1, uid }, { merge: true });
      }
    }

    return { ok: true, created };
  },
);
