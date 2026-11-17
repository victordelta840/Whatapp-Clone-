import { createHmac } from 'node:crypto';
import { FieldValue, getFirestore } from 'firebase-admin/firestore';
import { HttpsError, onCall } from 'firebase-functions/v2/https';
import { defineSecret } from 'firebase-functions/params';
import { z } from 'zod';
import { FUNCTIONS_REGION, RATE_LIMITS } from '../lib/constants.js';
import { parseInput, requireAuth, requireVerifiedEmailOrProvider } from '../lib/errors.js';
import { enforceRateLimit } from '../lib/rateLimit.js';
const turnSharedSecret = defineSecret('TURN_SHARED_SECRET');
const turnUrlsSecret = defineSecret('TURN_URLS');
const startCallSchema = z.object({
    conversationId: z.string().trim().min(1).max(128),
    calleeId: z.string().trim().min(1).max(128),
    type: z.enum(['audio', 'video']),
});
export const startCall = onCall({ region: FUNCTIONS_REGION, enforceAppCheck: true }, async (request) => {
    const callerUid = requireVerifiedEmailOrProvider(request);
    const input = parseInput(startCallSchema, request.data);
    if (input.calleeId === callerUid) {
        throw new HttpsError('invalid-argument', 'Cannot call yourself.');
    }
    await enforceRateLimit(callerUid, 'startCall', RATE_LIMITS.START_CALL.limit, RATE_LIMITS.START_CALL.windowSec);
    const db = getFirestore();
    const [convSnap, calleeBlockSnap, callerBlockSnap, activeCallsSnap] = await Promise.all([
        db.collection('conversations').doc(input.conversationId).get(),
        db.collection('users').doc(input.calleeId).collection('blocks').doc(callerUid).get(),
        db.collection('users').doc(callerUid).collection('blocks').doc(input.calleeId).get(),
        db
            .collection('calls')
            .where('participantIds', 'array-contains', input.calleeId)
            .where('state', 'in', ['ringing', 'accepted'])
            .limit(1)
            .get(),
    ]);
    if (!convSnap.exists) {
        throw new HttpsError('not-found', 'Conversation not found.');
    }
    const conv = convSnap.data();
    if (conv.type !== 'direct' ||
        !conv.participantIds.includes(callerUid) ||
        !conv.participantIds.includes(input.calleeId)) {
        throw new HttpsError('permission-denied', 'One-to-one calls require a direct conversation.');
    }
    if (calleeBlockSnap.exists || callerBlockSnap.exists) {
        throw new HttpsError('permission-denied', 'Calls are blocked between these users.');
    }
    const callRef = db.collection('calls').doc();
    const isBusy = !activeCallsSnap.empty;
    await callRef.set({
        schemaVersion: 1,
        conversationId: input.conversationId,
        callerId: callerUid,
        calleeId: input.calleeId,
        participantIds: [callerUid, input.calleeId],
        type: input.type,
        state: isBusy ? 'busy' : 'ringing',
        createdAt: FieldValue.serverTimestamp(),
        answeredAt: null,
        endedAt: isBusy ? FieldValue.serverTimestamp() : null,
        endedBy: isBusy ? input.calleeId : null,
        endReason: isBusy ? 'busy' : null,
        durationSec: null,
    });
    return { ok: true, callId: callRef.id, state: isBusy ? 'busy' : 'ringing' };
});
const iceSchema = z.object({
    mode: z.enum(['call', 'diagnostics']).default('call'),
    callId: z.string().trim().min(1).max(128).optional(),
});
export const getIceServers = onCall({
    region: FUNCTIONS_REGION,
    enforceAppCheck: true,
    consumeAppCheckToken: true,
    secrets: [turnSharedSecret, turnUrlsSecret],
}, async (request) => {
    const uid = requireAuth(request);
    const input = parseInput(iceSchema, request.data);
    await enforceRateLimit(uid, 'getIceServers', RATE_LIMITS.GET_ICE_SERVERS.limit, RATE_LIMITS.GET_ICE_SERVERS.windowSec);
    if (input.mode === 'call') {
        if (!input.callId) {
            throw new HttpsError('invalid-argument', 'callId is required for call ICE servers.');
        }
        const callSnap = await getFirestore().collection('calls').doc(input.callId).get();
        if (!callSnap.exists) {
            throw new HttpsError('not-found', 'Call not found.');
        }
        const participants = callSnap.data()?.participantIds ?? [];
        if (!participants.includes(uid)) {
            throw new HttpsError('permission-denied', 'Not a participant in this call.');
        }
    }
    const iceServers = [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
    ];
    const secret = turnSharedSecret.value();
    const rawUrls = turnUrlsSecret.value();
    let turnConfigured = false;
    if (secret && rawUrls) {
        const urls = rawUrls
            .split(',')
            .map((u) => u.trim())
            .filter(Boolean);
        if (urls.length > 0) {
            // Short-lived coturn REST API time-limited credential (1 hour TTL)
            const expiryEpoch = Math.floor(Date.now() / 1000) + 3600;
            const username = `${expiryEpoch}:${uid}`;
            const credential = createHmac('sha1', secret).update(username).digest('base64');
            iceServers.push({
                urls,
                username,
                credential,
            });
            turnConfigured = true;
        }
    }
    return { iceServers, turnConfigured, ttlSec: 3600 };
});
//# sourceMappingURL=calls.js.map