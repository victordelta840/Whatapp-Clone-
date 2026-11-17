import type { CallSignal } from '@/types';
import { FirestoreSignaling } from './FirestoreSignaling';

export type NetworkQuality = 'good' | 'fair' | 'poor';

export interface PeerConnectionCallbacks {
  onRemoteStream: (stream: MediaStream) => void;
  onConnectionStateChange: (state: RTCPeerConnectionState) => void;
  onQualityChange: (quality: NetworkQuality) => void;
}

export class PeerConnectionManager {
  private pc: RTCPeerConnection;
  private signaling: FirestoreSignaling;
  private remoteStream = new MediaStream();
  private pendingCandidates: RTCIceCandidateInit[] = [];
  private remoteDescriptionSet = false;
  private statsTimer: number | null = null;
  private callbacks: PeerConnectionCallbacks;

  constructor(
    iceServers: RTCIceServer[],
    signaling: FirestoreSignaling,
    callbacks: PeerConnectionCallbacks,
  ) {
    this.pc = new RTCPeerConnection({ iceServers });
    this.signaling = signaling;
    this.callbacks = callbacks;

    this.pc.ontrack = (event) => {
      event.streams[0]?.getTracks().forEach((track) => {
        this.remoteStream.addTrack(track);
      });
      if (!event.streams[0] && event.track) {
        this.remoteStream.addTrack(event.track);
      }
      this.callbacks.onRemoteStream(this.remoteStream);
    };

    this.pc.onicecandidate = (event) => {
      if (event.candidate) {
        void this.signaling.sendCandidate(event.candidate.toJSON()).catch(() => undefined);
      }
    };

    this.pc.onconnectionstatechange = () => {
      this.callbacks.onConnectionStateChange(this.pc.connectionState);
    };

    this.pc.oniceconnectionstatechange = () => {
      if (
        this.pc.iceConnectionState === 'failed' ||
        this.pc.iceConnectionState === 'disconnected'
      ) {
        if (typeof this.pc.restartIce === 'function') {
          this.pc.restartIce();
        }
      }
    };

    this.statsTimer = window.setInterval(() => void this.pollStats(), 4000);
  }

  attachLocalStream(stream: MediaStream): void {
    for (const track of stream.getTracks()) {
      this.pc.addTrack(track, stream);
    }
  }

  async replaceVideoTrack(nextTrack: MediaStreamTrack): Promise<void> {
    const sender = this.pc.getSenders().find((s) => s.track?.kind === 'video');
    if (sender) {
      await sender.replaceTrack(nextTrack);
    }
  }

  async createAndSendOffer(iceRestart = false): Promise<void> {
    const offer = await this.pc.createOffer({ iceRestart });
    await this.pc.setLocalDescription(offer);
    if (offer.sdp) {
      await this.signaling.sendOffer(offer.sdp);
    }
  }

  async handleIncomingSignal(signal: CallSignal): Promise<void> {
    if (signal.kind === 'offer' && signal.sdp) {
      await this.pc.setRemoteDescription({ type: 'offer', sdp: signal.sdp });
      this.remoteDescriptionSet = true;
      await this.flushCandidates();
      const answer = await this.pc.createAnswer();
      await this.pc.setLocalDescription(answer);
      if (answer.sdp) {
        await this.signaling.sendAnswer(answer.sdp);
      }
    } else if (signal.kind === 'answer' && signal.sdp) {
      await this.pc.setRemoteDescription({ type: 'answer', sdp: signal.sdp });
      this.remoteDescriptionSet = true;
      await this.flushCandidates();
    } else if (signal.kind === 'candidate' && signal.candidate) {
      const candidateInit: RTCIceCandidateInit = {
        candidate: signal.candidate,
        sdpMid: signal.sdpMid ?? undefined,
        sdpMLineIndex: signal.sdpMLineIndex ?? undefined,
      };
      if (this.remoteDescriptionSet) {
        await this.pc.addIceCandidate(candidateInit).catch(() => undefined);
      } else {
        this.pendingCandidates.push(candidateInit);
      }
    }
  }

  private async flushCandidates(): Promise<void> {
    const queued = [...this.pendingCandidates];
    this.pendingCandidates = [];
    for (const c of queued) {
      await this.pc.addIceCandidate(c).catch(() => undefined);
    }
  }

  private async pollStats(): Promise<void> {
    try {
      const stats = await this.pc.getStats();
      let rttMs = 0;
      let packetLoss = 0;
      stats.forEach((report) => {
        if (report.type === 'candidate-pair' && report.state === 'succeeded') {
          const r = report as { currentRoundTripTime?: number };
          if (typeof r.currentRoundTripTime === 'number') {
            rttMs = r.currentRoundTripTime * 1000;
          }
        }
        if (report.type === 'inbound-rtp') {
          const r = report as { packetsLost?: number; packetsReceived?: number };
          const total = (r.packetsLost ?? 0) + (r.packetsReceived ?? 0);
          if (total > 0) {
            packetLoss = (r.packetsLost ?? 0) / total;
          }
        }
      });
      if (rttMs > 350 || packetLoss > 0.08) {
        this.callbacks.onQualityChange('poor');
      } else if (rttMs > 150 || packetLoss > 0.03) {
        this.callbacks.onQualityChange('fair');
      } else {
        this.callbacks.onQualityChange('good');
      }
    } catch {
      // ignore stats failures on closing PC
    }
  }

  dispose(): void {
    if (this.statsTimer !== null) {
      window.clearInterval(this.statsTimer);
      this.statsTimer = null;
    }
    this.pc.close();
  }
}
