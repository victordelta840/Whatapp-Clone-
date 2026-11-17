import { describe, expect, it } from 'vitest';
import {
  calculateScaledDimensions,
  isBlockedExecutableFile,
  verifyFileMagicBytes,
} from '@/lib/media/imageProcessor';
import { canPlayAudioMime } from '@/lib/media/voiceRecorder';

describe('media validation & scaling', () => {
  it('scales image dimensions preserving aspect ratio', () => {
    expect(calculateScaledDimensions(3200, 1600, 1600)).toEqual({ width: 1600, height: 800 });
    expect(calculateScaledDimensions(800, 600, 1600)).toEqual({ width: 800, height: 600 });
  });

  it('blocks executable filenames and MIME types', () => {
    expect(isBlockedExecutableFile('payload.exe', 'application/octet-stream')).toBe(true);
    expect(isBlockedExecutableFile('script.sh', 'application/x-sh')).toBe(true);
    expect(isBlockedExecutableFile('report.pdf', 'application/pdf')).toBe(false);
  });

  it('verifies PNG and JPEG magic bytes', async () => {
    const pngBlob = new Blob([new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])]);
    const fakeBlob = new Blob([new Uint8Array([0x4d, 0x5a, 0x90, 0x00])]);
    expect(await verifyFileMagicBytes(pngBlob, 'image')).toBe(true);
    expect(await verifyFileMagicBytes(fakeBlob, 'image')).toBe(false);
  });

  it('checks audio mime playability safely', () => {
    expect(typeof canPlayAudioMime('audio/webm')).toBe('boolean');
  });
});
