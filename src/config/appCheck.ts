import type { FirebaseApp } from 'firebase/app';
import {
  initializeAppCheck,
  ReCaptchaEnterpriseProvider,
  getToken as getAppCheckToken,
  type AppCheck,
} from 'firebase/app-check';
import type { ValidatedEnvConfig } from './env';

let appCheckInstance: AppCheck | null = null;
let appCheckInitError: string | null = null;

declare global {
  interface Window {
    FIREBASE_APPCHECK_DEBUG_TOKEN?: string | boolean;
  }
}

export function initAppCheck(app: FirebaseApp, config: ValidatedEnvConfig): AppCheck | null {
  if (appCheckInstance) return appCheckInstance;

  if (!config.appCheckSiteKey) {
    appCheckInitError = 'VITE_APPCHECK_SITE_KEY is not configured.';
    return null;
  }

  try {
    if (config.isDev && config.appCheckDebugToken && typeof window !== 'undefined') {
      window.FIREBASE_APPCHECK_DEBUG_TOKEN = config.appCheckDebugToken;
    }

    appCheckInstance = initializeAppCheck(app, {
      provider: new ReCaptchaEnterpriseProvider(config.appCheckSiteKey),
      isTokenAutoRefreshEnabled: true,
    });
    appCheckInitError = null;
    return appCheckInstance;
  } catch (err) {
    appCheckInitError = err instanceof Error ? err.message : 'App Check initialization failed.';
    return null;
  }
}

export async function verifyAppCheckToken(): Promise<{
  ok: boolean;
  status: 'verified' | 'requires-config' | 'error';
  message: string;
}> {
  if (!appCheckInstance) {
    return {
      ok: false,
      status: 'requires-config',
      message:
        appCheckInitError ??
        'App Check is not configured. Add VITE_APPCHECK_SITE_KEY (reCAPTCHA Enterprise).',
    };
  }
  try {
    const result = await getAppCheckToken(appCheckInstance, false);
    if (result.token) {
      return {
        ok: true,
        status: 'verified',
        message: 'App Check token acquired and auto-refresh active.',
      };
    }
    return {
      ok: false,
      status: 'error',
      message: 'App Check returned an empty token.',
    };
  } catch (err) {
    return {
      ok: false,
      status: 'error',
      message: err instanceof Error ? err.message : 'App Check token acquisition failed.',
    };
  }
}

export function getAppCheckInstance(): AppCheck | null {
  return appCheckInstance;
}
