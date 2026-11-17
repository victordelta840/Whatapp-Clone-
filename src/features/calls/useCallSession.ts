import { useEffect } from 'react';
import { limit, onSnapshot, orderBy, query, where } from 'firebase/firestore';
import { create } from 'zustand';
import { WINDOWS } from '@/config/constants';
import { refs } from '@/config/refs';
import { mapFirebaseError } from '@/lib/errors';
import {
  FirestoreSignaling,
  PeerConnectionManager,
  acquireLocalMediaStream,
  requestWakeLock,
  type NetworkQuality,
} from '@/lib/webrtc';
import { useAuthStore } from '@/features/auth';
import { fetchUserSummary, type HydratedUserSummary } from '@/features/profile';
import { toast } from '@/components/ui';
import type { CallDoc } from '@/types';
import {
  acceptCallDoc,
  cancelOrTimeoutCallDoc,
  endAcceptedCallDoc,
  fetchIceServers,
  rejectCallDoc,
  startCallCallable,
} from './calls.service';

interface CallSessionStore {
  activeCall: (CallDoc & { id: string }) | null;
  incomingCalls: Array<CallDoc & { id: string }>;
  peerSummary: HydratedUserSummary | null;
  localStream: MediaStream | null;
  remoteStream: MediaStream | null;
  connectionState: RTCPeerConnectionState;
  quality: NetworkQuality;
  micMuted: boolean;
  cameraMuted: boolean;
  minimized: boolean;
  elapsedSec: number;
  setState: (patch: Partial<CallSessionStore>) => void;
  resetActive: () => void;
}

export const useCallStore = create<CallSessionStore>((set) => ({
  activeCall: null,
  incomingCalls: [],
  peerSummary: null,
  localStream: null,
  remoteStream: null,
  connectionState: 'new',
  quality: 'good',
  micMuted: false,
  cameraMuted: false,
  minimized: false,
  elapsedSec: 0,
  setState: (patch) => set((s) => ({ ...s, ...patch })),
  resetActive: () =>
    set({
      activeCall: null,
      peerSummary: null,
      localStream: null,
      remoteStream: null,
      connectionState: 'new',
      quality: 'good',
      micMuted: false,
      cameraMuted: false,
      minimized: false,
      elapsedSec: 0,
    }),
}));

let activePc: PeerConnectionManager | null = null;
let activeSignaling: FirestoreSignaling | null = null;
let activeWakeLock: { release: () => Promise<void> } | null = null;
let offerSentForCallId: string | null = null;

function teardownWebRTC(): void {
  activeSignaling?.dispose();
  activeSignaling = null;
  activePc?.dispose();
  activePc = null;
  offerSentForCallId = null;
  const local = useCallStore.getState().localStream;
  local?.getTracks().forEach((t) => t.stop());
  void activeWakeLock?.release().catch(() => undefined);
  activeWakeLock = null;
}

export async function startOutgoingCall(payload: {
  conversationId: string;
  calleeId: string;
  type: 'audio' | 'video';
}): Promise<void> {
  const uid = useAuthStore.getState().authUser?.uid;
  if (!uid) return;
  if (useCallStore.getState().activeCall) {
    toast.info('Finish your current call before starting a new one.');
    return;
  }

  try {
    const stream = await acquireLocalMediaStream({ video: payload.type === 'video' });
    const res = await startCallCallable(payload);
    if (res.state === 'busy') {
      stream.getTracks().forEach((t) => t.stop());
      toast.info('Recipient is currently busy on another call.');
      return;
    }

    const peer = await fetchUserSummary(payload.calleeId);
    useCallStore.getState().setState({
      localStream: stream,
      peerSummary: peer,
      micMuted: false,
      cameraMuted: false,
      minimized: false,
    });
  } catch (err) {
    toast.error(mapFirebaseError(err).userMessage);
  }
}

export async function answerIncomingCall(call: CallDoc & { id: string }): Promise<void> {
  const uid = useAuthStore.getState().authUser?.uid;
  if (!uid) return;
  try {
    const stream = await acquireLocalMediaStream({ video: call.type === 'video' });
    const peer = await fetchUserSummary(call.callerId);
    useCallStore.getState().setState({
      activeCall: call,
      localStream: stream,
      peerSummary: peer,
      minimized: false,
    });
    await acceptCallDoc(call.id);
  } catch (err) {
    toast.error(mapFirebaseError(err).userMessage);
  }
}

export async function declineIncomingCall(callId: string): Promise<void> {
  const uid = useAuthStore.getState().authUser?.uid;
  if (!uid) return;
  await rejectCallDoc(callId, uid, 'declined');
}

export async function hangUpCurrentCall(): Promise<void> {
  const uid = useAuthStore.getState().authUser?.uid;
  const call = useCallStore.getState().activeCall;
  teardownWebRTC();
  useCallStore.getState().resetActive();
  if (!uid || !call) return;

  if (call.state === 'ringing') {
    if (call.callerId === uid) {
      await cancelOrTimeoutCallDoc(call.id, uid, 'cancelled').catch(() => undefined);
    } else {
      await rejectCallDoc(call.id, uid, 'declined').catch(() => undefined);
    }
  } else if (call.state === 'accepted') {
    await endAcceptedCallDoc(call.id, uid, 'ended').catch(() => undefined);
  }
}

export function toggleCallMic(): void {
  const { localStream, micMuted } = useCallStore.getState();
  const next = !micMuted;
  localStream?.getAudioTracks().forEach((t) => {
    t.enabled = !next;
  });
  useCallStore.getState().setState({ micMuted: next });
}

export function toggleCallCamera(): void {
  const { localStream, cameraMuted } = useCallStore.getState();
  const next = !cameraMuted;
  localStream?.getVideoTracks().forEach((t) => {
    t.enabled = !next;
  });
  useCallStore.getState().setState({ cameraMuted: next });
}

export async function switchCallCamera(deviceId: string): Promise<void> {
  const { localStream } = useCallStore.getState();
  if (!localStream || !activePc) return;
  const newStream = await acquireLocalMediaStream({ video: true, videoDeviceId: deviceId });
  const nextTrack = newStream.getVideoTracks()[0];
  if (!nextTrack) return;
  localStream.getVideoTracks().forEach((t) => {
    localStream.removeTrack(t);
    t.stop();
  });
  localStream.addTrack(nextTrack);
  await activePc.replaceVideoTrack(nextTrack);
}

export function useCallSessionListener(): void {
  const uid = useAuthStore((s) => s.authUser?.uid ?? null);
  const activeCall = useCallStore((s) => s.activeCall);
  const localStream = useCallStore((s) => s.localStream);

  // Listen to active calls involving user
  useEffect(() => {
    if (!uid) {
      teardownWebRTC();
      useCallStore.getState().resetActive();
      return;
    }

    const q = query(
      refs.callsCol(),
      where('participantIds', 'array-contains', uid),
      orderBy('createdAt', 'desc'),
      limit(10),
    );

    const unsub = onSnapshot(
      q,
      (snap) => {
        const docs = snap.docs.map((d) => ({ ...d.data(), id: d.id }));
        const ringingIncoming = docs.filter((d) => d.state === 'ringing' && d.calleeId === uid);
        useCallStore.getState().setState({ incomingCalls: ringingIncoming });

        const currentActive = docs.find(
          (d) =>
            (d.state === 'ringing' && d.callerId === uid) || d.state === 'accepted',
        );

        const store = useCallStore.getState();
        if (currentActive) {
          store.setState({ activeCall: currentActive });
          if (!store.peerSummary) {
            const peerId =
              currentActive.callerId === uid ? currentActive.calleeId : currentActive.callerId;
            void fetchUserSummary(peerId).then((peer) =>
              useCallStore.getState().setState({ peerSummary: peer }),
            );
          }
        } else if (store.activeCall) {
          teardownWebRTC();
          store.resetActive();
        }
      },
      () => undefined,
    );

    return unsub;
  }, [uid]);

  // 45s ring timeout for caller
  useEffect(() => {
    if (!uid || !activeCall || activeCall.state !== 'ringing' || activeCall.callerId !== uid) {
      return;
    }
    const timer = window.setTimeout(() => {
      void cancelOrTimeoutCallDoc(activeCall.id, uid, 'missed').catch(() => undefined);
      teardownWebRTC();
      useCallStore.getState().resetActive();
      toast.info('No answer.');
    }, WINDOWS.CALL_RING_TIMEOUT_MS);

    return () => window.clearTimeout(timer);
  }, [uid, activeCall]);

  // WebRTC handshake once accepted
  useEffect(() => {
    if (!uid || !activeCall || activeCall.state !== 'accepted' || !localStream) {
      return;
    }
    if (activePc && offerSentForCallId === activeCall.id) return;

    let cancelled = false;
    const peerUid = activeCall.callerId === uid ? activeCall.calleeId : activeCall.callerId;

    void (async () => {
      try {
        const { iceServers } = await fetchIceServers('call', activeCall.id);
        if (cancelled) return;

        const signaling = new FirestoreSignaling(activeCall.id, uid, peerUid);
        const pc = new PeerConnectionManager(iceServers, signaling, {
          onRemoteStream: (stream) => useCallStore.getState().setState({ remoteStream: stream }),
          onConnectionStateChange: (state) =>
            useCallStore.getState().setState({ connectionState: state }),
          onQualityChange: (quality) => useCallStore.getState().setState({ quality }),
        });

        pc.attachLocalStream(localStream);
        activeSignaling = signaling;
        activePc = pc;
        offerSentForCallId = activeCall.id;

        signaling.subscribe((signal) => {
          void pc.handleIncomingSignal(signal).catch(() => undefined);
        });

        if (activeCall.callerId === uid) {
          await pc.createAndSendOffer(false);
        }

        activeWakeLock = await requestWakeLock();
      } catch (err) {
        toast.error(mapFirebaseError(err).userMessage);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [uid, activeCall, localStream]);

  // Call duration timer
  useEffect(() => {
    if (!activeCall || activeCall.state !== 'accepted') {
      useCallStore.getState().setState({ elapsedSec: 0 });
      return;
    }
    const timer = window.setInterval(() => {
      useCallStore.getState().setState({ elapsedSec: useCallStore.getState().elapsedSec + 1 });
    }, 1000);
    return () => window.clearInterval(timer);
  }, [activeCall]);
}
