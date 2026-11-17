import { ALLOWED_MIME_TYPES, BLOCKED_EXECUTABLE_EXTENSIONS, BLOCKED_EXECUTABLE_MIMES, MEDIA_LIMITS } from '@/config/constants';

export interface ProcessedImageResult {
  blob: Blob;
  thumbBlob: Blob;
  width: number;
  height: number;
  mimeType: 'image/jpeg' | 'image/webp' | 'image/gif';
}

export function calculateScaledDimensions(
  srcWidth: number,
  srcHeight: number,
  maxEdge: number,
): { width: number; height: number } {
  if (srcWidth <= maxEdge && srcHeight <= maxEdge) {
    return { width: srcWidth, height: srcHeight };
  }
  if (srcWidth >= srcHeight) {
    return {
      width: maxEdge,
      height: Math.max(1, Math.round((srcHeight / srcWidth) * maxEdge)),
    };
  }
  return {
    width: Math.max(1, Math.round((srcWidth / srcHeight) * maxEdge)),
    height: maxEdge,
  };
}

export async function verifyFileMagicBytes(file: Blob, expectedCategory: 'image' | 'video' | 'audio' | 'document'): Promise<boolean> {
  if (expectedCategory === 'document') return true;
  const slice = await file.slice(0, 16).arrayBuffer();
  const bytes = new Uint8Array(slice);
  if (bytes.length < 4) return false;

  if (expectedCategory === 'image') {
    const isJpeg = bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
    const isPng = bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47;
    const isGif = bytes[0] === 0x47 && bytes[1] === 0x49 && bytes[2] === 0x46;
    const isWebp =
      bytes[0] === 0x52 &&
      bytes[1] === 0x49 &&
      bytes[2] === 0x46 &&
      bytes[3] === 0x46 &&
      bytes[8] === 0x57 &&
      bytes[9] === 0x45 &&
      bytes[10] === 0x42 &&
      bytes[11] === 0x50;
    return isJpeg || isPng || isGif || isWebp;
  }

  if (expectedCategory === 'video') {
    const isWebm = bytes[0] === 0x1a && bytes[1] === 0x45 && bytes[2] === 0xdf && bytes[3] === 0xa3;
    const isFtyp = bytes[4] === 0x66 && bytes[5] === 0x74 && bytes[6] === 0x79 && bytes[7] === 0x70;
    return isWebm || isFtyp;
  }

  if (expectedCategory === 'audio') {
    const isWebm = bytes[0] === 0x1a && bytes[1] === 0x45 && bytes[2] === 0xdf && bytes[3] === 0xa3;
    const isOgg = bytes[0] === 0x4f && bytes[1] === 0x67 && bytes[2] === 0x67 && bytes[3] === 0x53;
    const isFtyp = bytes[4] === 0x66 && bytes[5] === 0x74 && bytes[6] === 0x79 && bytes[7] === 0x70;
    const isId3 = bytes[0] === 0x49 && bytes[1] === 0x44 && bytes[2] === 0x33;
    const isMp3Sync = bytes[0] === 0xff && ((bytes[1] ?? 0) & 0xe0) === 0xe0;
    const isAdts = bytes[0] === 0xff && ((bytes[1] ?? 0) & 0xf0) === 0xf0;
    return isWebm || isOgg || isFtyp || isId3 || isMp3Sync || isAdts;
  }

  return false;
}

export function isBlockedExecutableFile(fileName: string, mimeType: string): boolean {
  const lowerName = fileName.toLowerCase();
  const lowerMime = mimeType.toLowerCase();
  return (
    BLOCKED_EXECUTABLE_EXTENSIONS.some((ext) => lowerName.endsWith(ext)) ||
    BLOCKED_EXECUTABLE_MIMES.some((m) => lowerMime === m)
  );
}

export async function processImageFile(
  file: File,
  maxEdge: number = MEDIA_LIMITS.CHAT_IMAGE_MAX_EDGE,
  quality: number = MEDIA_LIMITS.CHAT_IMAGE_QUALITY,
): Promise<ProcessedImageResult> {
  if (!ALLOWED_MIME_TYPES.IMAGE.includes(file.type as (typeof ALLOWED_MIME_TYPES.IMAGE)[number])) {
    throw new Error('Unsupported image format. Use JPEG, PNG, WebP, or GIF.');
  }
  const magicOk = await verifyFileMagicBytes(file, 'image');
  if (!magicOk) {
    throw new Error('File signature does not match a valid image.');
  }

  const bitmap = await createImageBitmap(file);
  const { width, height } = calculateScaledDimensions(bitmap.width, bitmap.height, maxEdge);

  // Canvas re-encoding strips all EXIF metadata
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Unable to initialize canvas for image compression.');
  ctx.drawImage(bitmap, 0, 0, width, height);

  const outputMime: 'image/jpeg' | 'image/webp' =
    file.type === 'image/webp' ? 'image/webp' : 'image/jpeg';

  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error('Image compression failed.'))),
      outputMime,
      quality,
    );
  });

  const thumbDims = calculateScaledDimensions(width, height, MEDIA_LIMITS.THUMB_MAX_EDGE);
  const thumbCanvas = document.createElement('canvas');
  thumbCanvas.width = thumbDims.width;
  thumbCanvas.height = thumbDims.height;
  const tCtx = thumbCanvas.getContext('2d');
  if (!tCtx) throw new Error('Unable to initialize thumbnail canvas.');
  tCtx.drawImage(bitmap, 0, 0, thumbDims.width, thumbDims.height);
  bitmap.close();

  const thumbBlob = await new Promise<Blob>((resolve, reject) => {
    thumbCanvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error('Thumbnail generation failed.'))),
      'image/jpeg',
      0.72,
    );
  });

  return {
    blob,
    thumbBlob,
    width,
    height,
    mimeType: outputMime,
  };
}

export async function captureVideoThumbnail(
  file: File,
): Promise<{ thumbBlob: Blob | null; durationMs: number; width: number; height: number }> {
  const magicOk = await verifyFileMagicBytes(file, 'video');
  if (!magicOk) {
    throw new Error('File signature does not match MP4, WebM, or QuickTime video.');
  }

  return new Promise((resolve, reject) => {
    const video = document.createElement('video');
    const url = URL.createObjectURL(file);
    video.preload = 'metadata';
    video.muted = true;
    video.playsInline = true;
    video.src = url;

    const cleanup = () => URL.revokeObjectURL(url);

    video.onerror = () => {
      cleanup();
      reject(new Error('Unable to read video metadata.'));
    };

    video.onloadeddata = () => {
      const durationMs = Math.round((Number.isFinite(video.duration) ? video.duration : 0) * 1000);
      const width = video.videoWidth || 640;
      const height = video.videoHeight || 360;
      video.currentTime = Math.min(0.5, video.duration ? video.duration / 4 : 0);

      video.onseeked = () => {
        const dims = calculateScaledDimensions(width, height, MEDIA_LIMITS.THUMB_MAX_EDGE);
        const canvas = document.createElement('canvas');
        canvas.width = dims.width;
        canvas.height = dims.height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          cleanup();
          resolve({ thumbBlob: null, durationMs, width, height });
          return;
        }
        ctx.drawImage(video, 0, 0, dims.width, dims.height);
        canvas.toBlob(
          (blob) => {
            cleanup();
            resolve({ thumbBlob: blob, durationMs, width, height });
          },
          'image/jpeg',
          0.75,
        );
      };
    };
  });
}
