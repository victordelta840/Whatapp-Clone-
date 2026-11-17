import { getFirestore, type Firestore } from 'firebase-admin/firestore';

export const FIRESTORE_DATABASE_ID =
  process.env.FIRESTORE_DATABASE_ID || 'ai-studio-a98db9ab-2051-4bc7-8254-906ad7ca81d5';

export function getDb(): Firestore {
  return FIRESTORE_DATABASE_ID && FIRESTORE_DATABASE_ID !== '(default)'
    ? getFirestore(FIRESTORE_DATABASE_ID)
    : getFirestore();
}
