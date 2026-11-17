/**
 * Development & Emulator Seed Script
 * Strictly refuses to run unless FIRESTORE_EMULATOR_HOST is explicitly set.
 */
import { initializeApp } from 'firebase-admin/app';
import { FieldValue, getFirestore } from 'firebase-admin/firestore';

if (!process.env.FIRESTORE_EMULATOR_HOST) {
  console.error(
    'Refusing to seed: FIRESTORE_EMULATOR_HOST is not set. This script only runs against local emulators.',
  );
  process.exit(1);
}

initializeApp({ projectId: process.env.GCLOUD_PROJECT || 'converse-dev' });
const db = getFirestore();

async function seed() {
  const users = [
    { uid: 'seed-alice', displayName: 'Alice Rivera', username: 'alice_r' },
    { uid: 'seed-bob', displayName: 'Bob Chen', username: 'bob_c' },
  ];

  for (const u of users) {
    await db.collection('users').doc(u.uid).set({
      schemaVersion: 1,
      displayName: u.displayName,
      displayNameLower: u.displayName.toLowerCase(),
      username: u.username,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });
  }

  console.log('Seeded emulator users:', users.map((u) => u.uid).join(', '));
}

void seed();
