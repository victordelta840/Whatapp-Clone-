import { serverTimestamp, updateDoc } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { requireFirebaseHandles } from '@/config/firebase';
import { refs } from '@/config/refs';
import { withCallableRetry } from '@/lib/errors';

export async function startCallCallable(payload: {
  conversationId: string;
  calleeId: string;
  type: 'audio' | 'video';
}): Promise<{ callId: string; state: 'ringing' | 'busy' }> {
  const { functions } = requireFirebaseHandles();
  const fn = httpsCallable<
    typeof payload,
    { ok: boolean; callId: string; state: 'ringing' | 'busy' }
  >(functions, 'startCall');
  const res = await withCallableRetry(() => fn(payload));
  return { callId: res.data.callId, state: res.data.state };
}

export async function fetchIceServers(
  mode: 'call' | 'diagnostics',
  callId?: string,
): Promise<{ iceServers: RTCIceServer[]; turnConfigured: boolean }> {
  const { functions } = requireFirebaseHandles();
  const fn = httpsCallable<
    { mode: 'call' | 'diagnostics'; callId?: string },
    { iceServers: RTCIceServer[]; turnConfigured: boolean; ttlSec: number }
  >(functions, 'getIceServers');
  const res = await withCallableRetry(() => fn({ mode, callId }));
  return { iceServers: res.data.iceServers, turnConfigured: res.data.turnConfigured };
}

export async function acceptCallDoc(callId: string): Promise<void> {
  await updateDoc(refs.callDoc(callId), {
    state: 'accepted',
    answeredAt: serverTimestamp() as unknown as never,
  });
}

export async function rejectCallDoc(
  callId: string,
  uid: string,
  reason: 'declined' | 'busy' = 'declined',
): Promise<void> {
  await updateDoc(refs.callDoc(callId), {
    state: reason,
    endedAt: serverTimestamp() as unknown as never,
    endedBy: uid,
    endReason: reason,
  });
}

export async function cancelOrTimeoutCallDoc(
  callId: string,
  uid: string,
  state: 'cancelled' | 'missed',
): Promise<void> {
  await updateDoc(refs.callDoc(callId), {
    state,
    endedAt: serverTimestamp() as unknown as never,
    endedBy: uid,
    endReason: state,
  });
}

export async function endAcceptedCallDoc(
  callId: string,
  uid: string,
  state: 'ended' | 'failed' = 'ended',
  reason = 'hangup',
): Promise<void> {
  await updateDoc(refs.callDoc(callId), {
    state,
    endedAt: serverTimestamp() as unknown as never,
    endedBy: uid,
    endReason: reason,
  });
}
