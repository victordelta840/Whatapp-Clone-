export interface AvailableMediaDevices {
  audioInputs: MediaDeviceInfo[];
  videoInputs: MediaDeviceInfo[];
  audioOutputs: MediaDeviceInfo[];
  supportsSinkId: boolean;
}

export function isSetSinkIdSupported(): boolean {
  if (typeof HTMLMediaElement === 'undefined') return false;
  return 'setSinkId' in HTMLMediaElement.prototype;
}

export async function listMediaDevices(): Promise<AvailableMediaDevices> {
  if (typeof navigator === 'undefined' || !navigator.mediaDevices?.enumerateDevices) {
    return { audioInputs: [], videoInputs: [], audioOutputs: [], supportsSinkId: false };
  }
  const devices = await navigator.mediaDevices.enumerateDevices();
  return {
    audioInputs: devices.filter((d) => d.kind === 'audioinput'),
    videoInputs: devices.filter((d) => d.kind === 'videoinput'),
    audioOutputs: devices.filter((d) => d.kind === 'audiooutput'),
    supportsSinkId: isSetSinkIdSupported(),
  };
}

export async function acquireLocalMediaStream(options: {
  video: boolean;
  audioDeviceId?: string;
  videoDeviceId?: string;
}): Promise<MediaStream> {
  if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
    throw new Error('Camera and microphone access are unavailable in this browser context.');
  }
  return navigator.mediaDevices.getUserMedia({
    audio: options.audioDeviceId ? { deviceId: { exact: options.audioDeviceId } } : true,
    video: options.video
      ? options.videoDeviceId
        ? { deviceId: { exact: options.videoDeviceId }, width: { ideal: 1280 }, height: { ideal: 720 } }
        : { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 } }
      : false,
  });
}

export async function setElementAudioOutput(
  el: HTMLMediaElement | null,
  sinkId: string,
): Promise<boolean> {
  if (!el || !isSetSinkIdSupported()) return false;
  try {
    await (el as HTMLMediaElement & { setSinkId: (id: string) => Promise<void> }).setSinkId(sinkId);
    return true;
  } catch {
    return false;
  }
}

export async function requestWakeLock(): Promise<{ release: () => Promise<void> } | null> {
  try {
    const nav = navigator as Navigator & {
      wakeLock?: { request: (type: 'screen') => Promise<{ release: () => Promise<void> }> };
    };
    if (!nav.wakeLock?.request) return null;
    return await nav.wakeLock.request('screen');
  } catch {
    return null;
  }
}
