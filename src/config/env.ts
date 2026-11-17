import { z } from 'zod';
import appletConfigJson from '@root/firebase-applet-config.json';

export interface AppletFirebaseJson {
  projectId?: string;
  appId?: string;
  apiKey?: string;
  authDomain?: string;
  firestoreDatabaseId?: string;
  storageBucket?: string;
  messagingSenderId?: string;
  measurementId?: string;
  recaptchaSiteKey?: string;
}

const rawEnvSchema = z.object({
  VITE_FIREBASE_API_KEY: z.string().trim().min(10, 'Must be a valid Firebase Web API key'),
  VITE_FIREBASE_AUTH_DOMAIN: z
    .string()
    .trim()
    .min(3)
    .refine((v) => v.includes('.'), 'Must be a valid auth domain'),
  VITE_FIREBASE_PROJECT_ID: z
    .string()
    .trim()
    .regex(/^[a-z0-9-]+$/, 'Must be a lowercase Firebase project ID'),
  VITE_FIREBASE_STORAGE_BUCKET: z.string().trim().min(3),
  VITE_FIREBASE_MESSAGING_SENDER_ID: z
    .string()
    .trim()
    .regex(/^\d+$/, 'Must be a numeric messaging sender ID'),
  VITE_FIREBASE_APP_ID: z.string().trim().min(5),
  VITE_FIREBASE_DATABASE_ID: z.string().trim().optional().default(''),
  VITE_FIREBASE_VAPID_KEY: z.string().trim().optional().default(''),
  VITE_APPCHECK_SITE_KEY: z.string().trim().optional().default(''),
  VITE_FUNCTIONS_REGION: z
    .string()
    .trim()
    .regex(/^[a-z]+-[a-z]+\d+$/, 'Must be a valid GCP region like us-central1')
    .default('us-central1'),
  VITE_USE_EMULATORS: z.enum(['true', 'false', '']).optional().default('false'),
  VITE_APP_NAME: z.string().trim().min(1).max(40).optional().default('Converse'),
  VITE_APPCHECK_DEBUG_TOKEN: z.string().trim().optional().default(''),
});

export interface ValidatedEnvConfig {
  apiKey: string;
  authDomain: string;
  projectId: string;
  storageBucket: string;
  messagingSenderId: string;
  appId: string;
  firestoreDatabaseId: string;
  vapidKey: string;
  appCheckSiteKey: string;
  functionsRegion: string;
  useEmulators: boolean;
  appName: string;
  appCheckDebugToken: string;
  isDev: boolean;
  isProd: boolean;
  configSource: 'env' | 'applet-config';
}

export type EnvParseResult =
  | { ok: true; config: ValidatedEnvConfig }
  | {
      ok: false;
      missing: string[];
      invalid: Array<{ key: string; message: string }>;
    };

const REQUIRED_ENV_KEYS = [
  'VITE_FIREBASE_API_KEY',
  'VITE_FIREBASE_AUTH_DOMAIN',
  'VITE_FIREBASE_PROJECT_ID',
  'VITE_FIREBASE_STORAGE_BUCKET',
  'VITE_FIREBASE_MESSAGING_SENDER_ID',
  'VITE_FIREBASE_APP_ID',
] as const;

function cleanVal(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

export function parseEnv(
  rawViteEnv: Record<string, unknown>,
  fallbackAppletConfig: AppletFirebaseJson | null = null,
  options: { isDev?: boolean; isProd?: boolean } = {},
): EnvParseResult {
  const fromViteApiKey = cleanVal(rawViteEnv.VITE_FIREBASE_API_KEY);
  const usedFallback =
    !fromViteApiKey &&
    Boolean(fallbackAppletConfig?.apiKey && fallbackAppletConfig?.projectId);

  const merged = {
    VITE_FIREBASE_API_KEY: fromViteApiKey || cleanVal(fallbackAppletConfig?.apiKey),
    VITE_FIREBASE_AUTH_DOMAIN:
      cleanVal(rawViteEnv.VITE_FIREBASE_AUTH_DOMAIN) ||
      cleanVal(fallbackAppletConfig?.authDomain),
    VITE_FIREBASE_PROJECT_ID:
      cleanVal(rawViteEnv.VITE_FIREBASE_PROJECT_ID) ||
      cleanVal(fallbackAppletConfig?.projectId),
    VITE_FIREBASE_STORAGE_BUCKET:
      cleanVal(rawViteEnv.VITE_FIREBASE_STORAGE_BUCKET) ||
      cleanVal(fallbackAppletConfig?.storageBucket),
    VITE_FIREBASE_MESSAGING_SENDER_ID:
      cleanVal(rawViteEnv.VITE_FIREBASE_MESSAGING_SENDER_ID) ||
      cleanVal(fallbackAppletConfig?.messagingSenderId),
    VITE_FIREBASE_APP_ID:
      cleanVal(rawViteEnv.VITE_FIREBASE_APP_ID) || cleanVal(fallbackAppletConfig?.appId),
    VITE_FIREBASE_DATABASE_ID:
      cleanVal(rawViteEnv.VITE_FIREBASE_DATABASE_ID) ||
      cleanVal(fallbackAppletConfig?.firestoreDatabaseId),
    VITE_FIREBASE_VAPID_KEY: cleanVal(rawViteEnv.VITE_FIREBASE_VAPID_KEY),
    VITE_APPCHECK_SITE_KEY:
      cleanVal(rawViteEnv.VITE_APPCHECK_SITE_KEY) ||
      cleanVal(fallbackAppletConfig?.recaptchaSiteKey),
    VITE_FUNCTIONS_REGION: cleanVal(rawViteEnv.VITE_FUNCTIONS_REGION) || 'us-central1',
    VITE_USE_EMULATORS: cleanVal(rawViteEnv.VITE_USE_EMULATORS) || 'false',
    VITE_APP_NAME: cleanVal(rawViteEnv.VITE_APP_NAME) || 'Converse',
    VITE_APPCHECK_DEBUG_TOKEN: cleanVal(rawViteEnv.VITE_APPCHECK_DEBUG_TOKEN),
  };

  const missing: string[] = [];
  for (const key of REQUIRED_ENV_KEYS) {
    if (!merged[key]) {
      missing.push(key);
    }
  }

  const parsed = rawEnvSchema.safeParse(merged);
  if (!parsed.success) {
    const invalid: Array<{ key: string; message: string }> = [];
    for (const issue of parsed.error.issues) {
      const key = String(issue.path[0] ?? 'env');
      if (!missing.includes(key)) {
        invalid.push({ key, message: issue.message });
      }
    }
    return { ok: false, missing, invalid };
  }

  const isDev = options.isDev ?? Boolean(rawViteEnv.DEV);
  const isProd = options.isProd ?? Boolean(rawViteEnv.PROD);

  return {
    ok: true,
    config: {
      apiKey: parsed.data.VITE_FIREBASE_API_KEY,
      authDomain: parsed.data.VITE_FIREBASE_AUTH_DOMAIN,
      projectId: parsed.data.VITE_FIREBASE_PROJECT_ID,
      storageBucket: parsed.data.VITE_FIREBASE_STORAGE_BUCKET,
      messagingSenderId: parsed.data.VITE_FIREBASE_MESSAGING_SENDER_ID,
      appId: parsed.data.VITE_FIREBASE_APP_ID,
      firestoreDatabaseId: parsed.data.VITE_FIREBASE_DATABASE_ID,
      vapidKey: parsed.data.VITE_FIREBASE_VAPID_KEY,
      appCheckSiteKey: parsed.data.VITE_APPCHECK_SITE_KEY,
      functionsRegion: parsed.data.VITE_FUNCTIONS_REGION,
      useEmulators: parsed.data.VITE_USE_EMULATORS === 'true',
      appName: parsed.data.VITE_APP_NAME,
      // Debug tokens are strictly permitted only in dev builds
      appCheckDebugToken: isDev ? parsed.data.VITE_APPCHECK_DEBUG_TOKEN : '',
      isDev,
      isProd,
      configSource: usedFallback ? 'applet-config' : 'env',
    },
  };
}

export const envResult: EnvParseResult = parseEnv(
  import.meta.env as Record<string, unknown>,
  appletConfigJson as AppletFirebaseJson,
  { isDev: import.meta.env.DEV, isProd: import.meta.env.PROD },
);

export function getEnvConfig(): ValidatedEnvConfig | null {
  return envResult.ok ? envResult.config : null;
}
