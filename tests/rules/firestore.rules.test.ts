import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import { Timestamp, doc, getDoc, setDoc, updateDoc, writeBatch } from 'firebase/firestore';
import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest';

let testEnv: RulesTestEnvironment;

beforeAll(async () => {
  const rules = readFileSync(resolve(process.cwd(), 'firestore.rules'), 'utf8');
  testEnv = await initializeTestEnvironment({
    projectId: 'converse-rules-test',
    firestore: {
      rules,
      host: '127.0.0.1',
      port: 8080,
    },
  });
});

afterAll(async () => {
  await testEnv?.cleanup();
});

beforeEach(async () => {
  await testEnv.clearFirestore();
});

describe('Converse Firestore Security Rules', () => {
  it('forbids listing /users directory and private account writes', async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      const db = ctx.firestore();
      await setDoc(doc(db, 'users', 'alice'), {
        schemaVersion: 1,
        displayName: 'Alice',
        displayNameLower: 'alice',
        username: 'alice',
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
      });
      await setDoc(doc(db, 'users', 'alice', 'private', 'account'), {
        schemaVersion: 1,
        email: 'alice@example.com',
        phoneNumber: null,
        providers: ['password'],
        createdAt: Timestamp.now(),
      });
    });

    const bobDb = testEnv.authenticatedContext('bob', { email_verified: true }).firestore();
    await assertSucceeds(getDoc(doc(bobDb, 'users', 'alice')));
    await assertFails(getDoc(doc(bobDb, 'users', 'alice', 'private', 'account')));
    await assertFails(
      setDoc(doc(bobDb, 'users', 'bob', 'private', 'account'), {
        schemaVersion: 1,
        email: 'bob@example.com',
        phoneNumber: null,
        providers: ['password'],
        createdAt: Timestamp.now(),
      }),
    );
  });

  it('enforces batched lastMessage atomicity and senderId check on message create', async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      const db = ctx.firestore();
      await setDoc(doc(db, 'conversations', 'c1'), {
        schemaVersion: 1,
        type: 'direct',
        participantIds: ['alice', 'bob'],
        createdBy: 'alice',
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
        lastMessage: null,
        lastMessageAt: null,
      });
      await setDoc(doc(db, 'conversations', 'c1', 'members', 'alice'), {
        schemaVersion: 1,
        role: 'member',
        joinedAt: Timestamp.now(),
        addedBy: 'alice',
        lastDeliveredAt: null,
        lastReadAt: null,
        lastReadMessageId: null,
      });
      await setDoc(doc(db, 'conversations', 'c1', 'members', 'bob'), {
        schemaVersion: 1,
        role: 'member',
        joinedAt: Timestamp.now(),
        addedBy: 'alice',
        lastDeliveredAt: null,
        lastReadAt: null,
        lastReadMessageId: null,
      });
    });

    const aliceDb = testEnv
      .authenticatedContext('alice', { email_verified: true })
      .firestore();

    // Non-batched message write without lastMessage fails getAfter check
    await assertFails(
      setDoc(doc(aliceDb, 'conversations', 'c1', 'messages', 'm1'), {
        schemaVersion: 1,
        senderId: 'alice',
        type: 'text',
        text: 'Hello',
        media: null,
        replyTo: null,
        forwarded: false,
        mentions: [],
        createdAt: Timestamp.now(),
        editedAt: null,
        deletedForEveryone: false,
        deletedAt: null,
        reactions: {},
      }),
    );

    // Non-participant Eve cannot read or write
    const eveDb = testEnv.authenticatedContext('eve', { email_verified: true }).firestore();
    await assertFails(getDoc(doc(eveDb, 'conversations', 'c1')));

    // Batched write fails if impersonating senderId
    const badBatch = writeBatch(aliceDb);
    badBatch.set(doc(aliceDb, 'conversations', 'c1', 'messages', 'm2'), {
      schemaVersion: 1,
      senderId: 'bob',
      type: 'text',
      text: 'Spoofed',
      media: null,
      replyTo: null,
      forwarded: false,
      mentions: [],
      createdAt: Timestamp.now(),
      editedAt: null,
      deletedForEveryone: false,
      deletedAt: null,
      reactions: {},
    });
    await assertFails(badBatch.commit());
  });

  it('enforces reaction ownership and denies editing another user message', async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      const db = ctx.firestore();
      await setDoc(doc(db, 'conversations', 'c1'), {
        schemaVersion: 1,
        type: 'direct',
        participantIds: ['alice', 'bob'],
        createdBy: 'alice',
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
        lastMessage: null,
        lastMessageAt: null,
      });
      await setDoc(doc(db, 'conversations', 'c1', 'members', 'alice'), { role: 'member' });
      await setDoc(doc(db, 'conversations', 'c1', 'members', 'bob'), { role: 'member' });
      await setDoc(doc(db, 'conversations', 'c1', 'messages', 'm1'), {
        schemaVersion: 1,
        senderId: 'alice',
        type: 'text',
        text: 'Hi Bob',
        media: null,
        replyTo: null,
        forwarded: false,
        mentions: [],
        createdAt: Timestamp.now(),
        editedAt: null,
        deletedForEveryone: false,
        deletedAt: null,
        reactions: {},
      });
    });

    const bobDb = testEnv.authenticatedContext('bob', { email_verified: true }).firestore();
    await assertSucceeds(
      updateDoc(doc(bobDb, 'conversations', 'c1', 'messages', 'm1'), {
        'reactions.bob': '👍',
      }),
    );
    await assertFails(
      updateDoc(doc(bobDb, 'conversations', 'c1', 'messages', 'm1'), {
        'reactions.alice': '🔥',
      }),
    );
    await assertFails(
      updateDoc(doc(bobDb, 'conversations', 'c1', 'messages', 'm1'), {
        text: 'Tampered',
      }),
    );
  });
});
