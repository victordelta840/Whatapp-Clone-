import { createHmac } from 'node:crypto';
import { describe, expect, it } from 'vitest';

function hashPhone(phone: string, pepper: string): string {
  return createHmac('sha256', pepper).update(phone).digest('hex');
}

describe('Cloud Functions domain logic', () => {
  it('produces deterministic salted HMAC-SHA256 hashes for E.164 discovery', () => {
    const a = hashPhone('+14155550123', 'test-pepper');
    const b = hashPhone('+14155550123', 'test-pepper');
    const c = hashPhone('+14155550123', 'other-pepper');
    expect(a).toHaveLength(64);
    expect(a).toBe(b);
    expect(a).not.toBe(c);
  });
});
