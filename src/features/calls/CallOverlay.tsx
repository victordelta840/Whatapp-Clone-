import React, { useEffect, useRef, useState } from 'react';
import {
  Maximize2,
  Mic,
  MicOff,
  Minimize2,
  Phone,
  PhoneOff,
  SwitchCamera,
  Video,
  VideoOff,
  Volume2,
  Wifi,
} from 'lucide-react';
import { Avatar, Button } from '@/components/ui';
import { listMediaDevices, setElementAudioOutput } from '@/lib/webrtc';
import { useAuthStore } from '@/features/auth';
import {
  answerIncomingCall,
  declineIncomingCall,
  hangUpCurrentCall,
  switchCallCamera,
  toggleCallCamera,
  toggleCallMic,
  useCallStore,
} from './useCallSession';

function formatTimer(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export const CallOverlay: React.FC = () => {
  const uid = useAuthStore((s) => s.authUser?.uid ?? null);
  const activeCall = useCallStore((s) => s.activeCall);
  const incomingCalls = useCallStore((s) => s.incomingCalls);
  const peer = useCallStore((s) => s.peerSummary);
  const localStream = useCallStore((s) => s.localStream);
  const remoteStream = useCallStore((s) => s.remoteStream);
  const connectionState = useCallStore((s) => s.connectionState);
  const quality = useCallStore((s) => s.quality);
  const micMuted = useCallStore((s) => s.micMuted);
  const cameraMuted = useCallStore((s) => s.cameraMuted);
  const minimized = useCallStore((s) => s.minimized);
  const elapsedSec = useCallStore((s) => s.elapsedSec);
  const setState = useCallStore((s) => s.setState);

  const localVideoRef = useRef<HTMLVideoElement | null>(null);
  const remoteVideoRef = useRef<HTMLVideoElement | null>(null);
  const remoteAudioRef = useRef<HTMLAudioElement | null>(null);

  const [videoInputs, setVideoInputs] = useState<MediaDeviceInfo[]>([]);
  const [audioOutputs, setAudioOutputs] = useState<MediaDeviceInfo[]>([]);
  const [camIndex, setCamIndex] = useState(0);
  const [speakerIndex, setSpeakerIndex] = useState(0);

  useEffect(() => {
    if (localVideoRef.current && localStream) {
      localVideoRef.current.srcObject = localStream;
    }
  }, [localStream, minimized]);

  useEffect(() => {
    if (remoteVideoRef.current && remoteStream) {
      remoteVideoRef.current.srcObject = remoteStream;
    }
    if (remoteAudioRef.current && remoteStream) {
      remoteAudioRef.current.srcObject = remoteStream;
    }
  }, [remoteStream, minimized]);

  useEffect(() => {
    if (!activeCall) return;
    void listMediaDevices().then((devs) => {
      setVideoInputs(devs.videoInputs);
      setAudioOutputs(devs.supportsSinkId ? devs.audioOutputs : []);
    });
  }, [activeCall]);

  // Incoming call banner when no active call is open
  const incoming = !activeCall ? incomingCalls[0] : undefined;
  if (incoming && uid) {
    return (
      <div
        role="dialog"
        aria-label="Incoming call"
        className="fixed bottom-20 right-4 z-50 w-80 rounded-2xl border border-border bg-surface-raised p-4 shadow-2xl md:bottom-6"
      >
        <div className="flex items-center gap-3">
          <Avatar name={incoming.callerId} size="md" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-bold text-text-primary">
              Incoming {incoming.type} call
            </p>
            <p className="text-xs text-text-secondary">Tap Accept to connect</p>
          </div>
        </div>
        <div className="mt-4 flex gap-2">
          <Button
            variant="danger"
            fullWidth
            leftIcon={<PhoneOff className="h-4 w-4" />}
            onClick={() => void declineIncomingCall(incoming.id)}
          >
            Decline
          </Button>
          <Button
            variant="primary"
            fullWidth
            leftIcon={<Phone className="h-4 w-4" />}
            onClick={() => void answerIncomingCall(incoming)}
          >
            Accept
          </Button>
        </div>
      </div>
    );
  }

  if (!activeCall) return null;

  const peerName = peer?.profile?.displayName ?? 'Contact';
  const isVideo = activeCall.type === 'video';

  if (minimized) {
    return (
      <div className="fixed bottom-20 right-4 z-50 flex items-center gap-3 rounded-2xl border border-border bg-surface-raised p-3 shadow-2xl md:bottom-6">
        <audio ref={remoteAudioRef} autoPlay playsInline>
          <track kind="captions" />
        </audio>
        <Avatar src={peer?.photoURL} name={peerName} size="sm" />
        <div className="text-xs">
          <p className="font-semibold text-text-primary">{peerName}</p>
          <p className="text-text-secondary tabular-nums">
            {activeCall.state === 'accepted' ? formatTimer(elapsedSec) : 'Calling...'}
          </p>
        </div>
        <button
          type="button"
          onClick={() => setState({ minimized: false })}
          aria-label="Expand call"
          className="rounded-lg p-1.5 hover:bg-surface-muted"
        >
          <Maximize2 className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={() => void hangUpCurrentCall()}
          aria-label="End call"
          className="rounded-lg bg-danger p-1.5 text-white"
        >
          <PhoneOff className="h-4 w-4" />
        </button>
      </div>
    );
  }

  return (
    <div
      role="dialog"
      aria-label="Active call"
      className="fixed inset-0 z-50 flex flex-col justify-between bg-slate-950 text-white p-6"
    >
      <audio ref={remoteAudioRef} autoPlay playsInline>
        <track kind="captions" />
      </audio>

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-xs text-white/80">
          <Wifi
            className={`h-4 w-4 ${
              quality === 'good'
                ? 'text-emerald-400'
                : quality === 'fair'
                  ? 'text-amber-400'
                  : 'text-rose-400'
            }`}
          />
          <span className="capitalize">
            {activeCall.state === 'ringing'
              ? 'Ringing...'
              : connectionState === 'connected'
                ? `${formatTimer(elapsedSec)} (${quality})`
                : connectionState}
          </span>
        </div>

        <button
          type="button"
          onClick={() => setState({ minimized: true })}
          aria-label="Minimize call"
          className="rounded-lg bg-white/10 p-2 hover:bg-white/20"
        >
          <Minimize2 className="h-4 w-4" />
        </button>
      </div>

      <div className="relative flex flex-1 items-center justify-center overflow-hidden my-4 rounded-2xl bg-slate-900">
        {isVideo && remoteStream ? (
          <video
            ref={remoteVideoRef}
            autoPlay
            playsInline
            className="h-full w-full object-cover"
          >
            <track kind="captions" />
          </video>
        ) : (
          <div className="flex flex-col items-center gap-3 text-center">
            <Avatar src={peer?.photoURL} name={peerName} size="xl" />
            <h2 className="text-xl font-bold">{peerName}</h2>
            <p className="text-sm text-white/70">
              {activeCall.state === 'ringing' ? 'Calling...' : formatTimer(elapsedSec)}
            </p>
          </div>
        )}

        {isVideo && localStream && (
          <video
            ref={localVideoRef}
            autoPlay
            muted
            playsInline
            className="absolute bottom-4 right-4 h-36 w-28 rounded-xl border border-white/20 bg-black object-cover shadow-lg"
          />
        )}
      </div>

      <div className="flex items-center justify-center gap-4">
        <button
          type="button"
          onClick={toggleCallMic}
          aria-label={micMuted ? 'Unmute microphone' : 'Mute microphone'}
          className={`flex h-12 w-12 items-center justify-center rounded-full ${
            micMuted ? 'bg-white text-slate-900' : 'bg-white/15 text-white hover:bg-white/25'
          }`}
        >
          {micMuted ? <MicOff className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
        </button>

        {isVideo && (
          <button
            type="button"
            onClick={toggleCallCamera}
            aria-label={cameraMuted ? 'Turn camera on' : 'Turn camera off'}
            className={`flex h-12 w-12 items-center justify-center rounded-full ${
              cameraMuted ? 'bg-white text-slate-900' : 'bg-white/15 text-white hover:bg-white/25'
            }`}
          >
            {cameraMuted ? <VideoOff className="h-5 w-5" /> : <Video className="h-5 w-5" />}
          </button>
        )}

        {isVideo && videoInputs.length > 1 && (
          <button
            type="button"
            onClick={() => {
              const nextIdx = (camIndex + 1) % videoInputs.length;
              setCamIndex(nextIdx);
              const dev = videoInputs[nextIdx];
              if (dev) void switchCallCamera(dev.deviceId);
            }}
            aria-label="Switch camera"
            className="flex h-12 w-12 items-center justify-center rounded-full bg-white/15 text-white hover:bg-white/25"
          >
            <SwitchCamera className="h-5 w-5" />
          </button>
        )}

        {audioOutputs.length > 1 && (
          <button
            type="button"
            onClick={() => {
              const nextIdx = (speakerIndex + 1) % audioOutputs.length;
              setSpeakerIndex(nextIdx);
              const dev = audioOutputs[nextIdx];
              if (dev) void setElementAudioOutput(remoteAudioRef.current, dev.deviceId);
            }}
            aria-label="Switch speaker"
            className="flex h-12 w-12 items-center justify-center rounded-full bg-white/15 text-white hover:bg-white/25"
          >
            <Volume2 className="h-5 w-5" />
          </button>
        )}

        <button
          type="button"
          onClick={() => void hangUpCurrentCall()}
          aria-label="End call"
          className="flex h-14 w-14 items-center justify-center rounded-full bg-danger text-white shadow-lg hover:bg-red-700"
        >
          <PhoneOff className="h-6 w-6" />
        </button>
      </div>
    </div>
  );
};
