import { describe, expect, it } from 'vitest';
import { isSetSinkIdSupported } from '@/lib/webrtc/MediaDeviceManager';
import { isPresenceOnline } from '@/features/presence/presence.service';
import { Timestamp } from 'firebase/firestore';

describe('webrtc & presence helpers', () => {
  it('detects setSinkId capability safely without crashing in jsdom', () => {
    expect(typeof isSetSinkIdSupported()).toBe('boolean');
  });

  it('marks presence offline after 90 seconds stale threshold', () => {
    const fresh = {
      schemaVersion: 1,
      state: 'online' as const,
      lastActiveAt: Timestamp.fromMillis(Date.now() - 20_000),
      updatedAt: Timestamp.now(),
    };
    const stale = {
      schemaVersion: 1,
      state: 'online' as const,
      lastActiveAt: Timestamp.fromMillis(Date.now() - 120_000),
      updatedAt: Timestamp.now(),
    };
    expect(isPresenceOnline(fresh)).toBe(true);
    expect(isPresenceOnline(stale)).toBe(false);
  });
});
