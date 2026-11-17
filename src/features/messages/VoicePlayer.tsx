import React, { useEffect, useRef, useState } from 'react';
import { Download, Pause, Play } from 'lucide-react';
import { getDownloadURL, ref } from 'firebase/storage';
import { requireFirebaseHandles } from '@/config/firebase';
import { canPlayAudioMime } from '@/lib/media/voiceRecorder';

let activePlayerId: string | null = null;
const pauseListeners = new Map<string, () => void>();

export interface VoicePlayerProps {
  id: string;
  storagePath: string;
  mimeType: string;
  durationMs?: number | null;
  waveform?: number[];
  isOwn?: boolean;
}

function formatDuration(ms: number): string {
  const sec = Math.max(0, Math.round(ms / 1000));
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

export const VoicePlayer: React.FC<VoicePlayerProps> = ({
  id,
  storagePath,
  mimeType,
  durationMs,
  waveform = [],
  isOwn = false,
}) => {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [url, setUrl] = useState<string | null>(null);
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [currentMs, setCurrentMs] = useState(0);
  const [speed, setSpeed] = useState<1 | 1.5 | 2>(1);
  const playable = canPlayAudioMime(mimeType);

  useEffect(() => {
    pauseListeners.set(id, () => {
      audioRef.current?.pause();
      setPlaying(false);
    });
    return () => {
      pauseListeners.delete(id);
      if (activePlayerId === id) activePlayerId = null;
    };
  }, [id]);

  const ensureUrl = async (): Promise<string> => {
    if (url) return url;
    const { storage } = requireFirebaseHandles();
    const resolved = await getDownloadURL(ref(storage, storagePath));
    setUrl(resolved);
    return resolved;
  };

  const togglePlay = async () => {
    const resolved = await ensureUrl();
    const el = audioRef.current;
    if (!el) return;
    if (el.src !== resolved) {
      el.src = resolved;
    }
    el.playbackRate = speed;

    if (playing) {
      el.pause();
      setPlaying(false);
      return;
    }

    if (activePlayerId && activePlayerId !== id) {
      pauseListeners.get(activePlayerId)?.();
    }
    activePlayerId = id;
    await el.play();
    setPlaying(true);
  };

  const cycleSpeed = () => {
    const next: 1 | 1.5 | 2 = speed === 1 ? 1.5 : speed === 1.5 ? 2 : 1;
    setSpeed(next);
    if (audioRef.current) audioRef.current.playbackRate = next;
  };

  const bars = waveform.length > 0 ? waveform : Array.from({ length: 24 }, (_, i) => 20 + ((i * 19) % 70));

  if (!playable) {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-border/50 bg-black/5 px-3 py-2 text-xs">
        <span>Audio format unsupported on this browser.</span>
        <button
          type="button"
          className="inline-flex items-center gap-1 font-semibold underline"
          onClick={() =>
            void ensureUrl().then((u) => {
              const a = document.createElement('a');
              a.href = u;
              a.download = 'voice-note';
              a.click();
            })
          }
        >
          <Download className="h-3.5 w-3.5" /> Download
        </button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2.5 min-w-[210px] max-w-[270px]">
      <audio
        ref={audioRef}
        preload="none"
        onTimeUpdate={(e) => {
          const el = e.currentTarget;
          const total = el.duration ? el.duration * 1000 : (durationMs ?? 1);
          setCurrentMs(el.currentTime * 1000);
          setProgress(Math.min(1, (el.currentTime * 1000) / Math.max(1, total)));
        }}
        onEnded={() => {
          setPlaying(false);
          setProgress(0);
          setCurrentMs(0);
        }}
      >
        <track kind="captions" />
      </audio>
      <button
        type="button"
        onClick={() => void togglePlay()}
        aria-label={playing ? 'Pause voice note' : 'Play voice note'}
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand text-white hover:bg-brand-hover"
      >
        {playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4 ml-0.5" />}
      </button>

      <div className="flex flex-1 flex-col gap-1">
        <div className="flex h-6 items-end gap-[2px]">
          {bars.slice(0, 28).map((val, idx) => {
            const pct = idx / Math.min(28, bars.length);
            const activeBar = pct <= progress;
            return (
              <span
                key={idx}
                className={`w-1 rounded-full transition-colors ${
                  activeBar
                    ? 'bg-brand dark:bg-[#25D366]'
                    : isOwn
                      ? 'bg-black/20 dark:bg-white/25'
                      : 'bg-border-strong'
                }`}
                style={{ height: `${Math.max(20, Math.min(100, val))}%` }}
              />
            );
          })}
        </div>
        <div className="flex items-center justify-between text-[10px] tabular-nums opacity-85">
          <span>{formatDuration(playing ? currentMs : (durationMs ?? 0))}</span>
          <button
            type="button"
            onClick={cycleSpeed}
            className="rounded px-1 font-semibold hover:bg-black/10"
            aria-label="Playback speed"
          >
            {speed}x
          </button>
        </div>
      </div>
    </div>
  );
};
