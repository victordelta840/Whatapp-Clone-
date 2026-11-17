import { describe, expect, it } from 'vitest';
import {
  findCountryByDialCode,
  formatReadablePhone,
  isValidE164,
  normalizeToE164,
} from '@/features/auth/phoneCountries';
import { mapFirebaseError } from '@/lib/errors';

describe('phoneCountries E.164 normalization and formatting', () => {
  it('normalizes country dial code and local phone number into E.164', () => {
    expect(normalizeToE164('91', '098765 43210')).toBe('+919876543210');
    expect(normalizeToE164('1', '(415) 555-0123')).toBe('+14155550123');
    expect(normalizeToE164('44', '07700 900123')).toBe('+447700900123');
  });

  it('respects pasted full E.164 numbers starting with +', () => {
    expect(normalizeToE164('91', '+1 (415) 555-0199')).toBe('+14155550199');
  });

  it('validates E.164 bounds and detects countries by dial code', () => {
    expect(isValidE164('+919876543210')).toBe(true);
    expect(isValidE164('+14155550123')).toBe(true);
    expect(isValidE164('9876543210')).toBe(false);
    expect(isValidE164('+012345')).toBe(false);
    expect(findCountryByDialCode('91')?.iso).toBe('IN');
    expect(findCountryByDialCode('+44')?.iso).toBe('GB');
  });

  it('formats E.164 phone numbers cleanly for display', () => {
    expect(formatReadablePhone('+14155550123', '1')).toBe('+1 415 555 0123');
    expect(formatReadablePhone('+919876543210', '91')).toBe('+91 98765 43210');
  });
});

describe('mapFirebaseError phone auth mappings', () => {
  it('maps phone and recaptcha error codes to actionable user messages', () => {
    expect(mapFirebaseError({ code: 'auth/invalid-phone-number' }).userMessage).toContain('country code');
    expect(mapFirebaseError({ code: 'auth/invalid-verification-code' }).userMessage).toContain('6-digit SMS');
    expect(mapFirebaseError({ code: 'auth/code-expired' }).userMessage).toContain('Resend SMS');
    expect(mapFirebaseError({ code: 'auth/operation-not-allowed' }).userMessage).toContain('Phone provider');
    expect(mapFirebaseError({ code: 'auth/unauthorized-domain' }).userMessage).toContain('Authorized domains');
  });
});
