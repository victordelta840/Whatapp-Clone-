import { ALLOWED_MIME_TYPES, MEDIA_LIMITS } from '@/config/constants';

export function selectSupportedVoiceMimeType(): string | null {
  if (typeof MediaRecorder === 'undefined' || typeof MediaRecorder.isTypeSupported !== 'function') {
    return null;
  }
  const candidates = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg;codecs=opus'];
  for (const mime of candidates) {
    if (MediaRecorder.isTypeSupported(mime)) {
      return mime;
    }
  }
  return null;
}

export function canPlayAudioMime(mimeType: string): boolean {
  if (typeof document === 'undefined') return true;
  const audio = document.createElement('audio');
  if (!audio || typeof audio.canPlayType !== 'function') return false;
  const support = audio.canPlayType(mimeType);
  if (support === 'probably' || support === 'maybe') return true;
  const base = mimeType.split(';')[0]?.trim();
  if (base && base !== mimeType) {
    const baseSupport = audio.canPlayType(base);
    return baseSupport === 'probably' || baseSupport === 'maybe';
  }
  return false;
}

export async function extractWaveformSamples(blob: Blob, sampleCount = 48): Promise<number[]> {
  try {
    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return [];
    const ctx = new AudioCtx();
    try {
      const arrayBuffer = await blob.arrayBuffer();
      const audioBuffer = await ctx.decodeAudioData(arrayBuffer);
      const channel = audioBuffer.getChannelData(0);
      if (!channel || channel.length === 0) return [];
      const blockSize = Math.max(1, Math.floor(channel.length / sampleCount));
      const samples: number[] = [];
      for (let i = 0; i < sampleCount; i++) {
        let sum = 0;
        const start = i * blockSize;
        const end = Math.min(channel.length, start + blockSize);
        for (let j = start; j < end; j++) {
          sum += Math.abs(channel[j] ?? 0);
        }
        const avg = sum / Math.max(1, end - start);
        samples.push(Math.min(100, Math.max(8, Math.round(avg * 260))));
      }
      return samples;
    } finally {
      await ctx.close().catch(() => undefined);
    }
  } catch {
    return [];
  }
}

export interface VoiceRecorderController {
  stop: () => Promise<{ blob: Blob; mimeType: string; durationMs: number; waveform: number[] }>;
  cancel: () => void;
}

export async function startVoiceRecording(): Promise<VoiceRecorderController> {
  if (
    typeof navigator === 'undefined' ||
    !navigator.mediaDevices ||
    typeof navigator.mediaDevices.getUserMedia !== 'function'
  ) {
    throw new Error('Microphone recording is unavailable in this browser or preview context.');
  }

  const mimeType = selectSupportedVoiceMimeType();
  if (!mimeType) {
    throw new Error('No supported voice-note recording codec is available on this browser.');
  }

  const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  const recorder = new MediaRecorder(stream, {
    mimeType,
    audioBitsPerSecond: MEDIA_LIMITS.VOICE_AUDIO_BITS_PER_SECOND,
  });

  const chunks: BlobPart[] = [];
  const startedAt = Date.now();
  let cancelled = false;

  recorder.ondataavailable = (event) => {
    if (event.data.size > 0) chunks.push(event.data);
  };

  recorder.start(250);

  return {
    cancel() {
      cancelled = true;
      if (recorder.state !== 'inactive') {
        recorder.stop();
      }
      stream.getTracks().forEach((t) => t.stop());
    },
    stop() {
      return new Promise((resolve, reject) => {
        recorder.onstop = async () => {
          stream.getTracks().forEach((t) => t.stop());
          if (cancelled) {
            reject(new Error('Recording cancelled'));
            return;
          }
          const resolvedMime = recorder.mimeType || mimeType;
          const blob = new Blob(chunks, { type: resolvedMime });
          if (blob.size > MEDIA_LIMITS.CHAT_AUDIO_MAX_BYTES) {
            reject(new Error('Voice note exceeds the 16 MB limit.'));
            return;
          }
          if (
            !ALLOWED_MIME_TYPES.AUDIO.some((allowed) =>
              resolvedMime.toLowerCase().startsWith(allowed.split(';')[0] ?? ''),
            )
          ) {
            reject(new Error(`Unsupported recorded audio format: ${resolvedMime}`));
            return;
          }
          const durationMs = Math.max(500, Date.now() - startedAt);
          const waveform = await extractWaveformSamples(blob, 48);
          resolve({ blob, mimeType: resolvedMime, durationMs, waveform });
        };
        recorder.onerror = () => {
          stream.getTracks().forEach((t) => t.stop());
          reject(new Error('Microphone recording failed.'));
        };
        if (recorder.state !== 'inactive') {
          recorder.stop();
        }
      });
    },
  };
}
