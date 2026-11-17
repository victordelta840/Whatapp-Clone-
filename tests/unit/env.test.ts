import { describe, expect, it } from 'vitest';
import { parseEnv } from '@/config/env';

describe('parseEnv', () => {
  const validEnv = {
    VITE_FIREBASE_API_KEY: 'AIzaSyTestKey123456',
    VITE_FIREBASE_AUTH_DOMAIN: 'example.firebaseapp.com',
    VITE_FIREBASE_PROJECT_ID: 'my-project-123',
    VITE_FIREBASE_STORAGE_BUCKET: 'my-project-123.firebasestorage.app',
    VITE_FIREBASE_MESSAGING_SENDER_ID: '1234567890',
    VITE_FIREBASE_APP_ID: '1:1234567890:web:abcdef',
  };

  it('accepts valid VITE_FIREBASE_* config', () => {
    const res = parseEnv(validEnv, null, { isDev: true, isProd: false });
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.config.projectId).toBe('my-project-123');
      expect(res.config.configSource).toBe('env');
    }
  });

  it('reports missing variables when neither env nor fallback config exists', () => {
    const res = parseEnv({}, null, { isDev: true, isProd: false });
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.missing).toContain('VITE_FIREBASE_API_KEY');
      expect(res.missing).toContain('VITE_FIREBASE_PROJECT_ID');
    }
  });

  it('strips debug appcheck token in production mode', () => {
    const res = parseEnv(
      { ...validEnv, VITE_APPCHECK_DEBUG_TOKEN: 'secret-dev-token' },
      null,
      { isDev: false, isProd: true },
    );
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.config.appCheckDebugToken).toBe('');
    }
  });
});
