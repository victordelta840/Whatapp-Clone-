import { randomBytes, randomUUID } from 'node:crypto';
import { FieldValue, Timestamp, getFirestore } from 'firebase-admin/firestore';
import { HttpsError, onCall } from 'firebase-functions/v2/https';
import { z } from 'zod';
import { FUNCTIONS_REGION, LIMITS, RATE_LIMITS } from '../lib/constants.js';
import { parseInput, requireAuth, requireVerifiedEmailOrProvider } from '../lib/errors.js';
import { enforceRateLimit } from '../lib/rateLimit.js';

async function writeGroupSystemMessage(
  cid: string,
  kind: 'memberAdded' | 'memberRemoved' | 'memberLeft' | 'roleChanged' | 'groupRenamed' | 'groupSettingsChanged',
  actorUid: string,
  targetUids: string[],
  text: string,
) {
  const db = getFirestore();
  const mid = randomUUID();
  const batch = db.batch();
  batch.set(db.collection('conversations').doc(cid).collection('messages').doc(mid), {
    schemaVersion: 1,
    senderId: actorUid,
    type: 'system',
    text,
    media: null,
    replyTo: null,
    forwarded: false,
    mentions: [],
    createdAt: FieldValue.serverTimestamp(),
    editedAt: null,
    deletedForEveryone: false,
    deletedAt: null,
    reactions: {},
    systemEvent: {
      kind,
      actorUid,
      targetUids,
      callId: null,
    },
  });
  batch.update(db.collection('conversations').doc(cid), {
    lastMessage: {
      id: mid,
      senderId: actorUid,
      type: 'system',
      textPreview: text.slice(0, 100),
      createdAt: FieldValue.serverTimestamp(),
    },
    lastMessageAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  });
  await batch.commit();
}

const createGroupSchema = z.object({
  name: z.string().trim().min(LIMITS.GROUP_NAME_MIN).max(LIMITS.GROUP_NAME_MAX),
  description: z.string().trim().max(LIMITS.GROUP_DESC_MAX).optional().default(''),
  memberUids: z.array(z.string().trim().min(1).max(128)).max(LIMITS.MAX_GROUP_MEMBERS - 1),
});

export const createGroup = onCall(
  { region: FUNCTIONS_REGION, enforceAppCheck: true },
  async (request) => {
    const callerUid = requireVerifiedEmailOrProvider(request);
    const input = parseInput(createGroupSchema, request.data);
    await enforceRateLimit(
      callerUid,
      'createGroup',
      RATE_LIMITS.CREATE_GROUP.limit,
      RATE_LIMITS.CREATE_GROUP.windowSec,
    );

    const db = getFirestore();
    const uniqueTargets = Array.from(new Set(input.memberUids.filter((u) => u !== callerUid)));
    const eligibleUids: string[] = [callerUid];

    for (const targetUid of uniqueTargets) {
      const [userSnap, settingsSnap, contactSnap, blockSnap] = await Promise.all([
        db.collection('users').doc(targetUid).get(),
        db.collection('users').doc(targetUid).collection('private').doc('settings').get(),
        db.collection('users').doc(targetUid).collection('contacts').doc(callerUid).get(),
        db.collection('users').doc(targetUid).collection('blocks').doc(callerUid).get(),
      ]);
      if (!userSnap.exists || blockSnap.exists) continue;
      const groupAdd = settingsSnap.data()?.privacy?.groupAdd as string | undefined;
      if (groupAdd === 'contacts' && !contactSnap.exists) continue;
      eligibleUids.push(targetUid);
    }

    if (eligibleUids.length > LIMITS.MAX_GROUP_MEMBERS) {
      throw new HttpsError('invalid-argument', 'Group cannot exceed 256 members.');
    }

    const convRef = db.collection('conversations').doc();
    const cid = convRef.id;
    const batch = db.batch();

    batch.set(convRef, {
      schemaVersion: 1,
      type: 'group',
      participantIds: eligibleUids,
      createdBy: callerUid,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
      lastMessage: null,
      lastMessageAt: null,
      group: {
        name: input.name,
        description: input.description,
        photoPath: null,
        photoURL: null,
        memberCount: eligibleUids.length,
        settings: {
          sendMessages: 'all',
          editInfo: 'adminsOnly',
          addMembers: 'adminsOnly',
          joinApproval: false,
        },
        inviteCodeActive: null,
      },
    });

    for (const uid of eligibleUids) {
      batch.set(convRef.collection('members').doc(uid), {
        schemaVersion: 1,
        role: uid === callerUid ? 'owner' : 'member',
        joinedAt: FieldValue.serverTimestamp(),
        addedBy: callerUid,
        lastDeliveredAt: null,
        lastReadAt: null,
        lastReadMessageId: null,
      });

      batch.set(db.collection('users').doc(uid).collection('chatStates').doc(cid), {
        schemaVersion: 1,
        pinned: false,
        pinnedAt: null,
        archived: false,
        mutedUntil: null,
        unreadCount: 0,
        markedUnread: false,
        clearedAt: null,
        lastOpenedAt: FieldValue.serverTimestamp(),
      });
    }

    await batch.commit();
    await writeGroupSystemMessage(
      cid,
      'memberAdded',
      callerUid,
      eligibleUids,
      `Created group "${input.name}"`,
    );

    return { ok: true, conversationId: cid, memberCount: eligibleUids.length };
  },
);

const updateGroupInfoSchema = z.object({
  conversationId: z.string().trim().min(1).max(128),
  name: z.string().trim().min(1).max(60).optional(),
  description: z.string().trim().max(512).optional(),
  photoPath: z.string().max(300).nullable().optional(),
  photoURL: z.string().max(2048).nullable().optional(),
});

export const updateGroupInfo = onCall(
  { region: FUNCTIONS_REGION, enforceAppCheck: true },
  async (request) => {
    const uid = requireAuth(request);
    const input = parseInput(updateGroupInfoSchema, request.data);
    const db = getFirestore();
    const convRef = db.collection('conversations').doc(input.conversationId);
    const [convSnap, memberSnap] = await Promise.all([
      convRef.get(),
      convRef.collection('members').doc(uid).get(),
    ]);

    if (!convSnap.exists || !memberSnap.exists) {
      throw new HttpsError('permission-denied', 'Not a member of this group.');
    }
    const conv = convSnap.data() as {
      type: string;
      group?: { name: string; settings?: { editInfo?: string } };
    };
    if (conv.type !== 'group') {
      throw new HttpsError('invalid-argument', 'Not a group conversation.');
    }
    const role = memberSnap.data()?.role as string;
    if (conv.group?.settings?.editInfo === 'adminsOnly' && role !== 'owner' && role !== 'admin') {
      throw new HttpsError('permission-denied', 'Only admins can edit group info.');
    }

    const updates: Record<string, unknown> = { updatedAt: FieldValue.serverTimestamp() };
    if (input.name !== undefined) updates['group.name'] = input.name;
    if (input.description !== undefined) updates['group.description'] = input.description;
    if (input.photoPath !== undefined) updates['group.photoPath'] = input.photoPath;
    if (input.photoURL !== undefined) updates['group.photoURL'] = input.photoURL;

    await convRef.update(updates);
    if (input.name !== undefined && input.name !== conv.group?.name) {
      await writeGroupSystemMessage(
        input.conversationId,
        'groupRenamed',
        uid,
        [],
        `Changed group name to "${input.name}"`,
      );
    }
    return { ok: true };
  },
);

const updateGroupSettingsSchema = z.object({
  conversationId: z.string().trim().min(1).max(128),
  sendMessages: z.enum(['all', 'adminsOnly']).optional(),
  editInfo: z.enum(['all', 'adminsOnly']).optional(),
  addMembers: z.enum(['all', 'adminsOnly']).optional(),
  joinApproval: z.boolean().optional(),
});

export const updateGroupSettings = onCall(
  { region: FUNCTIONS_REGION, enforceAppCheck: true },
  async (request) => {
    const uid = requireAuth(request);
    const input = parseInput(updateGroupSettingsSchema, request.data);
    const db = getFirestore();
    const convRef = db.collection('conversations').doc(input.conversationId);
    const memberSnap = await convRef.collection('members').doc(uid).get();
    if (!memberSnap.exists || !['owner', 'admin'].includes(String(memberSnap.data()?.role))) {
      throw new HttpsError('permission-denied', 'Only admins can change group settings.');
    }

    const updates: Record<string, unknown> = { updatedAt: FieldValue.serverTimestamp() };
    if (input.sendMessages) updates['group.settings.sendMessages'] = input.sendMessages;
    if (input.editInfo) updates['group.settings.editInfo'] = input.editInfo;
    if (input.addMembers) updates['group.settings.addMembers'] = input.addMembers;
    if (input.joinApproval !== undefined) updates['group.settings.joinApproval'] = input.joinApproval;

    await convRef.update(updates);
    await writeGroupSystemMessage(
      input.conversationId,
      'groupSettingsChanged',
      uid,
      [],
      'Updated group settings',
    );
    return { ok: true };
  },
);

const addMembersSchema = z.object({
  conversationId: z.string().trim().min(1).max(128),
  memberUids: z.array(z.string().trim().min(1).max(128)).min(1).max(50),
});

export const addGroupMembers = onCall(
  { region: FUNCTIONS_REGION, enforceAppCheck: true },
  async (request) => {
    const callerUid = requireAuth(request);
    const input = parseInput(addMembersSchema, request.data);
    const db = getFirestore();
    const convRef = db.collection('conversations').doc(input.conversationId);
    const [convSnap, callerMemberSnap] = await Promise.all([
      convRef.get(),
      convRef.collection('members').doc(callerUid).get(),
    ]);

    if (!convSnap.exists || !callerMemberSnap.exists) {
      throw new HttpsError('permission-denied', 'Not a member of this group.');
    }
    const conv = convSnap.data() as {
      participantIds: string[];
      group?: { settings?: { addMembers?: string } };
    };
    const role = callerMemberSnap.data()?.role as string;
    if (conv.group?.settings?.addMembers === 'adminsOnly' && role !== 'owner' && role !== 'admin') {
      throw new HttpsError('permission-denied', 'Only admins can add members.');
    }

    const added: string[] = [];
    for (const targetUid of input.memberUids) {
      if (conv.participantIds.includes(targetUid)) continue;
      if (conv.participantIds.length + added.length >= LIMITS.MAX_GROUP_MEMBERS) break;

      const [userSnap, settingsSnap, contactSnap, blockSnap] = await Promise.all([
        db.collection('users').doc(targetUid).get(),
        db.collection('users').doc(targetUid).collection('private').doc('settings').get(),
        db.collection('users').doc(targetUid).collection('contacts').doc(callerUid).get(),
        db.collection('users').doc(targetUid).collection('blocks').doc(callerUid).get(),
      ]);
      if (!userSnap.exists || blockSnap.exists) continue;
      if (settingsSnap.data()?.privacy?.groupAdd === 'contacts' && !contactSnap.exists) continue;
      added.push(targetUid);
    }

    if (added.length === 0) {
      return { ok: true, addedCount: 0 };
    }

    const batch = db.batch();
    const nextParticipants = [...conv.participantIds, ...added];
    batch.update(convRef, {
      participantIds: nextParticipants,
      'group.memberCount': nextParticipants.length,
      updatedAt: FieldValue.serverTimestamp(),
    });
    for (const uid of added) {
      batch.set(convRef.collection('members').doc(uid), {
        schemaVersion: 1,
        role: 'member',
        joinedAt: FieldValue.serverTimestamp(),
        addedBy: callerUid,
        lastDeliveredAt: null,
        lastReadAt: null,
        lastReadMessageId: null,
      });
      batch.set(db.collection('users').doc(uid).collection('chatStates').doc(input.conversationId), {
        schemaVersion: 1,
        pinned: false,
        pinnedAt: null,
        archived: false,
        mutedUntil: null,
        unreadCount: 0,
        markedUnread: false,
        clearedAt: null,
        lastOpenedAt: FieldValue.serverTimestamp(),
      });
    }
    await batch.commit();
    await writeGroupSystemMessage(
      input.conversationId,
      'memberAdded',
      callerUid,
      added,
      `Added ${added.length} member${added.length === 1 ? '' : 's'}`,
    );

    return { ok: true, addedCount: added.length };
  },
);

const removeMemberSchema = z.object({
  conversationId: z.string().trim().min(1).max(128),
  targetUid: z.string().trim().min(1).max(128),
});

export const removeGroupMember = onCall(
  { region: FUNCTIONS_REGION, enforceAppCheck: true },
  async (request) => {
    const callerUid = requireAuth(request);
    const input = parseInput(removeMemberSchema, request.data);
    const db = getFirestore();
    const convRef = db.collection('conversations').doc(input.conversationId);
    const [convSnap, callerSnap, targetSnap] = await Promise.all([
      convRef.get(),
      convRef.collection('members').doc(callerUid).get(),
      convRef.collection('members').doc(input.targetUid).get(),
    ]);

    if (!convSnap.exists || !callerSnap.exists || !targetSnap.exists) {
      throw new HttpsError('not-found', 'Membership record not found.');
    }
    const callerRole = callerSnap.data()?.role as string;
    const targetRole = targetSnap.data()?.role as string;
    if (!['owner', 'admin'].includes(callerRole) || targetRole === 'owner') {
      throw new HttpsError('permission-denied', 'Insufficient permissions to remove member.');
    }

    const participants = ((convSnap.data()?.participantIds as string[]) ?? []).filter(
      (id) => id !== input.targetUid,
    );
    const batch = db.batch();
    batch.update(convRef, {
      participantIds: participants,
      'group.memberCount': participants.length,
      updatedAt: FieldValue.serverTimestamp(),
    });
    batch.delete(convRef.collection('members').doc(input.targetUid));
    await batch.commit();
    await writeGroupSystemMessage(
      input.conversationId,
      'memberRemoved',
      callerUid,
      [input.targetUid],
      'Removed a member from the group',
    );
    return { ok: true };
  },
);

const setRoleSchema = z.object({
  conversationId: z.string().trim().min(1).max(128),
  targetUid: z.string().trim().min(1).max(128),
  role: z.enum(['admin', 'member']),
});

export const setGroupRole = onCall(
  { region: FUNCTIONS_REGION, enforceAppCheck: true },
  async (request) => {
    const callerUid = requireAuth(request);
    const input = parseInput(setRoleSchema, request.data);
    const db = getFirestore();
    const convRef = db.collection('conversations').doc(input.conversationId);
    const [callerSnap, targetSnap] = await Promise.all([
      convRef.collection('members').doc(callerUid).get(),
      convRef.collection('members').doc(input.targetUid).get(),
    ]);
    if (!callerSnap.exists || !targetSnap.exists) {
      throw new HttpsError('not-found', 'Member not found.');
    }
    if (!['owner', 'admin'].includes(String(callerSnap.data()?.role))) {
      throw new HttpsError('permission-denied', 'Only admins can change member roles.');
    }
    if (targetSnap.data()?.role === 'owner') {
      throw new HttpsError('permission-denied', 'Cannot demote group owner.');
    }
    await convRef.collection('members').doc(input.targetUid).update({ role: input.role });
    await writeGroupSystemMessage(
      input.conversationId,
      'roleChanged',
      callerUid,
      [input.targetUid],
      `Updated member role to ${input.role}`,
    );
    return { ok: true };
  },
);

const leaveGroupSchema = z.object({
  conversationId: z.string().trim().min(1).max(128),
});

export const leaveGroup = onCall(
  { region: FUNCTIONS_REGION, enforceAppCheck: true },
  async (request) => {
    const uid = requireAuth(request);
    const input = parseInput(leaveGroupSchema, request.data);
    const db = getFirestore();
    const convRef = db.collection('conversations').doc(input.conversationId);

    let deletedGroup = false;
    await db.runTransaction(async (tx) => {
      const convSnap = await tx.get(convRef);
      const memberSnap = await tx.get(convRef.collection('members').doc(uid));
      if (!convSnap.exists || !memberSnap.exists) {
        throw new HttpsError('not-found', 'Group membership not found.');
      }
      const participants = ((convSnap.data()?.participantIds as string[]) ?? []).filter(
        (id) => id !== uid,
      );
      if (participants.length === 0) {
        deletedGroup = true;
        tx.delete(convRef.collection('members').doc(uid));
        tx.delete(convRef);
        return;
      }

      const wasOwner = memberSnap.data()?.role === 'owner';
      if (wasOwner) {
        const remainingSnap = await convRef
          .collection('members')
          .orderBy('joinedAt', 'asc')
          .get();
        const others = remainingSnap.docs.filter((d) => d.id !== uid);
        const nextOwner = others.find((d) => d.data().role === 'admin') ?? others[0];
        if (nextOwner) {
          tx.update(nextOwner.ref, { role: 'owner' });
        }
      }

      tx.delete(convRef.collection('members').doc(uid));
      tx.update(convRef, {
        participantIds: participants,
        'group.memberCount': participants.length,
        updatedAt: FieldValue.serverTimestamp(),
      });
    });

    if (!deletedGroup) {
      await writeGroupSystemMessage(input.conversationId, 'memberLeft', uid, [uid], 'Left the group');
    }
    return { ok: true, deletedGroup };
  },
);

const createInviteSchema = z.object({
  conversationId: z.string().trim().min(1).max(128),
  expiresHours: z.number().int().min(1).max(720).default(168),
  maxUses: z.number().int().min(1).max(500).default(100),
});

export const createInviteLink = onCall(
  { region: FUNCTIONS_REGION, enforceAppCheck: true },
  async (request) => {
    const uid = requireAuth(request);
    const input = parseInput(createInviteSchema, request.data);
    const db = getFirestore();
    const convRef = db.collection('conversations').doc(input.conversationId);
    const memberSnap = await convRef.collection('members').doc(uid).get();
    if (!memberSnap.exists || !['owner', 'admin'].includes(String(memberSnap.data()?.role))) {
      throw new HttpsError('permission-denied', 'Only group admins can create invite links.');
    }

    const code = randomBytes(18).toString('base64url'); // >= 22 URL-safe chars
    const expiresHours = input.expiresHours ?? 168;
    const expiresAt = Timestamp.fromMillis(Date.now() + expiresHours * 3600 * 1000);

    await db.collection('groupInvites').doc(code).set({
      schemaVersion: 1,
      conversationId: input.conversationId,
      createdBy: uid,
      createdAt: FieldValue.serverTimestamp(),
      expiresAt,
      revoked: false,
      useCount: 0,
      maxUses: input.maxUses ?? 100,
    });
    await convRef.update({ 'group.inviteCodeActive': code });

    return { ok: true, code };
  },
);

const revokeInviteSchema = z.object({
  conversationId: z.string().trim().min(1).max(128),
  code: z.string().trim().min(10).max(128),
});

export const revokeInviteLink = onCall(
  { region: FUNCTIONS_REGION, enforceAppCheck: true },
  async (request) => {
    const uid = requireAuth(request);
    const input = parseInput(revokeInviteSchema, request.data);
    const db = getFirestore();
    const convRef = db.collection('conversations').doc(input.conversationId);
    const memberSnap = await convRef.collection('members').doc(uid).get();
    if (!memberSnap.exists || !['owner', 'admin'].includes(String(memberSnap.data()?.role))) {
      throw new HttpsError('permission-denied', 'Only admins can revoke invite links.');
    }
    await db.collection('groupInvites').doc(input.code).update({ revoked: true });
    await convRef.update({ 'group.inviteCodeActive': null });
    return { ok: true };
  },
);

const inviteCodeSchema = z.object({
  code: z.string().trim().min(10).max(128),
});

export const previewInvite = onCall(
  { region: FUNCTIONS_REGION, enforceAppCheck: true },
  async (request) => {
    requireAuth(request);
    const input = parseInput(inviteCodeSchema, request.data);
    const db = getFirestore();
    const inviteSnap = await db.collection('groupInvites').doc(input.code).get();
    if (!inviteSnap.exists) {
      throw new HttpsError('not-found', 'Invite link not found.');
    }
    const invite = inviteSnap.data() as {
      conversationId: string;
      revoked: boolean;
      expiresAt: Timestamp;
      useCount: number;
      maxUses: number;
    };
    if (
      invite.revoked ||
      invite.expiresAt.toMillis() <= Date.now() ||
      invite.useCount >= invite.maxUses
    ) {
      throw new HttpsError('failed-precondition', 'This invite link is expired or revoked.');
    }
    const convSnap = await db.collection('conversations').doc(invite.conversationId).get();
    if (!convSnap.exists) {
      throw new HttpsError('not-found', 'Group no longer exists.');
    }
    const group = convSnap.data()?.group as
      | { name: string; description: string; memberCount: number; settings?: { joinApproval?: boolean } }
      | undefined;

    return {
      conversationId: invite.conversationId,
      name: group?.name ?? 'Group',
      description: group?.description ?? '',
      memberCount: group?.memberCount ?? 0,
      joinApproval: Boolean(group?.settings?.joinApproval),
    };
  },
);

export const joinGroupByInvite = onCall(
  { region: FUNCTIONS_REGION, enforceAppCheck: true },
  async (request) => {
    const uid = requireVerifiedEmailOrProvider(request);
    const input = parseInput(inviteCodeSchema, request.data);
    const db = getFirestore();
    const inviteRef = db.collection('groupInvites').doc(input.code);

    const result = await db.runTransaction(async (tx) => {
      const inviteSnap = await tx.get(inviteRef);
      if (!inviteSnap.exists) throw new HttpsError('not-found', 'Invite link not found.');
      const invite = inviteSnap.data() as {
        conversationId: string;
        revoked: boolean;
        expiresAt: Timestamp;
        useCount: number;
        maxUses: number;
      };
      if (
        invite.revoked ||
        invite.expiresAt.toMillis() <= Date.now() ||
        invite.useCount >= invite.maxUses
      ) {
        throw new HttpsError('failed-precondition', 'Invite link is invalid or expired.');
      }

      const convRef = db.collection('conversations').doc(invite.conversationId);
      const convSnap = await tx.get(convRef);
      if (!convSnap.exists) throw new HttpsError('not-found', 'Group not found.');

      const participants = (convSnap.data()?.participantIds as string[]) ?? [];
      if (participants.includes(uid)) {
        return { joined: true, pendingApproval: false, conversationId: invite.conversationId };
      }
      if (participants.length >= LIMITS.MAX_GROUP_MEMBERS) {
        throw new HttpsError('resource-exhausted', 'Group has reached the 256-member cap.');
      }

      const joinApproval = Boolean(convSnap.data()?.group?.settings?.joinApproval);
      if (joinApproval) {
        tx.set(convRef.collection('joinRequests').doc(uid), {
          schemaVersion: 1,
          requestedAt: FieldValue.serverTimestamp(),
          via: 'invite',
        });
        return { joined: false, pendingApproval: true, conversationId: invite.conversationId };
      }

      const nextParticipants = [...participants, uid];
      tx.update(convRef, {
        participantIds: nextParticipants,
        'group.memberCount': nextParticipants.length,
        updatedAt: FieldValue.serverTimestamp(),
      });
      tx.set(convRef.collection('members').doc(uid), {
        schemaVersion: 1,
        role: 'member',
        joinedAt: FieldValue.serverTimestamp(),
        addedBy: uid,
        lastDeliveredAt: null,
        lastReadAt: null,
        lastReadMessageId: null,
      });
      tx.set(db.collection('users').doc(uid).collection('chatStates').doc(invite.conversationId), {
        schemaVersion: 1,
        pinned: false,
        pinnedAt: null,
        archived: false,
        mutedUntil: null,
        unreadCount: 0,
        markedUnread: false,
        clearedAt: null,
        lastOpenedAt: FieldValue.serverTimestamp(),
      });
      tx.update(inviteRef, { useCount: invite.useCount + 1 });
      return { joined: true, pendingApproval: false, conversationId: invite.conversationId };
    });

    if (result.joined) {
      await writeGroupSystemMessage(
        result.conversationId,
        'memberAdded',
        uid,
        [uid],
        'Joined via invite link',
      );
    }
    return result;
  },
);

const resolveJoinSchema = z.object({
  conversationId: z.string().trim().min(1).max(128),
  targetUid: z.string().trim().min(1).max(128),
  approve: z.boolean(),
});

export const resolveJoinRequest = onCall(
  { region: FUNCTIONS_REGION, enforceAppCheck: true },
  async (request) => {
    const callerUid = requireAuth(request);
    const input = parseInput(resolveJoinSchema, request.data);
    const db = getFirestore();
    const convRef = db.collection('conversations').doc(input.conversationId);

    const callerSnap = await convRef.collection('members').doc(callerUid).get();
    if (!callerSnap.exists || !['owner', 'admin'].includes(String(callerSnap.data()?.role))) {
      throw new HttpsError('permission-denied', 'Only admins can resolve join requests.');
    }

    await db.runTransaction(async (tx) => {
      const reqRef = convRef.collection('joinRequests').doc(input.targetUid);
      const reqSnap = await tx.get(reqRef);
      if (!reqSnap.exists) {
        throw new HttpsError('not-found', 'Join request not found.');
      }
      const convSnap = await tx.get(convRef);
      if (!convSnap.exists) throw new HttpsError('not-found', 'Group not found.');

      tx.delete(reqRef);
      if (!input.approve) return;

      const participants = (convSnap.data()?.participantIds as string[]) ?? [];
      if (participants.includes(input.targetUid)) return;
      if (participants.length >= LIMITS.MAX_GROUP_MEMBERS) {
        throw new HttpsError('resource-exhausted', 'Group has reached the 256-member cap.');
      }

      const nextParticipants = [...participants, input.targetUid];
      tx.update(convRef, {
        participantIds: nextParticipants,
        'group.memberCount': nextParticipants.length,
        updatedAt: FieldValue.serverTimestamp(),
      });
      tx.set(convRef.collection('members').doc(input.targetUid), {
        schemaVersion: 1,
        role: 'member',
        joinedAt: FieldValue.serverTimestamp(),
        addedBy: callerUid,
        lastDeliveredAt: null,
        lastReadAt: null,
        lastReadMessageId: null,
      });
      tx.set(
        db.collection('users').doc(input.targetUid).collection('chatStates').doc(input.conversationId),
        {
          schemaVersion: 1,
          pinned: false,
          pinnedAt: null,
          archived: false,
          mutedUntil: null,
          unreadCount: 0,
          markedUnread: false,
          clearedAt: null,
          lastOpenedAt: FieldValue.serverTimestamp(),
        },
      );
    });

    if (input.approve) {
      await writeGroupSystemMessage(
        input.conversationId,
        'memberAdded',
        callerUid,
        [input.targetUid],
        'Approved join request',
      );
    }
    return { ok: true };
  },
);
