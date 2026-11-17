import { addDoc, onSnapshot, orderBy, query, serverTimestamp } from 'firebase/firestore';
import { refs } from '@/config/refs';
import type { CallSignal } from '@/types';

export class FirestoreSignaling {
  private readonly callId: string;
  private readonly myUid: string;
  private readonly peerUid: string;
  private unsub: (() => void) | null = null;
  private processedIds = new Set<string>();

  constructor(callId: string, myUid: string, peerUid: string) {
    this.callId = callId;
    this.myUid = myUid;
    this.peerUid = peerUid;
  }

  async sendOffer(sdp: string): Promise<void> {
    await addDoc(refs.callSignalsCol(this.callId), {
      schemaVersion: 1,
      from: this.myUid,
      to: this.peerUid,
      kind: 'offer',
      sdp,
      candidate: null,
      sdpMid: null,
      sdpMLineIndex: null,
      createdAt: serverTimestamp() as unknown as never,
    });
  }

  async sendAnswer(sdp: string): Promise<void> {
    await addDoc(refs.callSignalsCol(this.callId), {
      schemaVersion: 1,
      from: this.myUid,
      to: this.peerUid,
      kind: 'answer',
      sdp,
      candidate: null,
      sdpMid: null,
      sdpMLineIndex: null,
      createdAt: serverTimestamp() as unknown as never,
    });
  }

  async sendCandidate(candidate: RTCIceCandidateInit): Promise<void> {
    if (!candidate.candidate) return;
    await addDoc(refs.callSignalsCol(this.callId), {
      schemaVersion: 1,
      from: this.myUid,
      to: this.peerUid,
      kind: 'candidate',
      sdp: null,
      candidate: candidate.candidate,
      sdpMid: candidate.sdpMid ?? null,
      sdpMLineIndex: candidate.sdpMLineIndex ?? null,
      createdAt: serverTimestamp() as unknown as never,
    });
  }

  subscribe(onSignal: (signal: CallSignal & { id: string }) => void): void {
    const q = query(refs.callSignalsCol(this.callId), orderBy('createdAt', 'asc'));
    this.unsub = onSnapshot(
      q,
      (snap) => {
        for (const docSnap of snap.docs) {
          if (this.processedIds.has(docSnap.id)) continue;
          const data = docSnap.data();
          if (data.to !== this.myUid || data.from !== this.peerUid) continue;
          this.processedIds.add(docSnap.id);
          onSignal({ ...data, id: docSnap.id });
        }
      },
      () => undefined,
    );
  }

  dispose(): void {
    this.unsub?.();
    this.unsub = null;
    this.processedIds.clear();
  }
}
