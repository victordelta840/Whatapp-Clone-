import { describe, expect, it } from 'vitest';
import {
  extractLinks,
  isEmojiOnlyMessage,
  isSafeHref,
  parseSafeLinks,
  sanitizeFileName,
} from '@/lib/format/linkify';

describe('linkify & formatting safety', () => {
  it('permits only http, https, mailto, and tel URLs', () => {
    expect(isSafeHref('https://example.com')).toBe(true);
    expect(isSafeHref('mailto:test@example.com')).toBe(true);
    expect(isSafeHref('tel:+14155550100')).toBe(true);
    expect(isSafeHref('javascript:alert(1)')).toBe(false);
    expect(isSafeHref('data:text/html,<script>')).toBe(false);
  });

  it('parses links out of text without XSS vectors', () => {
    const segs = parseSafeLinks('Check https://converse.app/u/alex and mailto:hi@converse.app!');
    expect(segs.some((s) => s.kind === 'link' && s.href === 'https://converse.app/u/alex')).toBe(
      true,
    );
    expect(extractLinks('Visit https://example.org/docs.')).toEqual(['https://example.org/docs']);
  });

  it('detects 1 to 3 emoji-only messages cleanly', () => {
    expect(isEmojiOnlyMessage('👍')).toBe(true);
    expect(isEmojiOnlyMessage('🎉🔥🚀')).toBe(true);
    expect(isEmojiOnlyMessage('🎉🔥🚀✨')).toBe(false);
    expect(isEmojiOnlyMessage('hello 👍')).toBe(false);
  });

  it('sanitizes dangerous characters in filenames', () => {
    expect(sanitizeFileName('../etc/passwd')).toBe('.._etc_passwd');
  });
});
