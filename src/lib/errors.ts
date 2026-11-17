import { getFirebaseHandles } from '@/config/firebase';
import { logger } from './logger';

export interface MappedFirebaseError {
  code: string;
  userMessage: string;
  retryable: boolean;
}

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: Array<{
      providerId?: string | null;
      email?: string | null;
    }>;
  };
}

export function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null,
): never {
  const handles = getFirebaseHandles();
  const user = handles?.auth.currentUser;
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    operationType,
    path,
    authInfo: {
      userId: user?.uid ?? null,
      email: user?.email ?? null,
      emailVerified: user?.emailVerified ?? null,
      isAnonymous: user?.isAnonymous ?? null,
      tenantId: user?.tenantId ?? null,
      providerInfo:
        user?.providerData?.map((provider) => ({
          providerId: provider.providerId,
          email: provider.email,
        })) ?? [],
    },
  };
  logger.error('Firestore operation failed', error, { operationType, path });
  throw new Error(JSON.stringify(errInfo));
}

function extractCode(error: unknown): string {
  if (typeof error === 'object' && error !== null && 'code' in error) {
    const code = (error as { code?: unknown }).code;
    if (typeof code === 'string') return code;
  }
  if (error instanceof Error) {
    const match = error.message.match(/\(([^)]+)\)/);
    if (match?.[1]) return match[1];
  }
  return 'unknown';
}

export function mapFirebaseError(error: unknown): MappedFirebaseError {
  const code = extractCode(error);
  const normalized = code.replace(/^functions\//, '');

  switch (normalized) {
    case 'permission-denied':
      return {
        code,
        userMessage: 'You do not have permission to perform this action.',
        retryable: false,
      };
    case 'unauthenticated':
      return {
        code,
        userMessage: 'Your session expired. Please sign in again.',
        retryable: false,
      };
    case 'unavailable':
      return {
        code,
        userMessage: 'Service is temporarily unavailable. Check your connection and retry.',
        retryable: true,
      };
    case 'deadline-exceeded':
      return {
        code,
        userMessage: 'The request timed out. Please try again.',
        retryable: true,
      };
    case 'resource-exhausted':
      return {
        code,
        userMessage: 'Rate limit or quota reached. Please wait a moment and try again.',
        retryable: true,
      };
    case 'failed-precondition':
      return {
        code,
        userMessage:
          error instanceof Error && error.message.includes('index')
            ? `Database index required: ${error.message}`
            : 'Precondition failed for this operation.',
        retryable: false,
      };
    case 'not-found':
      return {
        code,
        userMessage: 'The requested item was not found or has been removed.',
        retryable: false,
      };
    case 'already-exists':
      return {
        code,
        userMessage: 'That item or identifier already exists.',
        retryable: false,
      };
    case 'invalid-argument':
      return {
        code,
        userMessage:
          error instanceof Error ? error.message : 'Please check your input and try again.',
        retryable: false,
      };
    case 'auth/invalid-credential':
    case 'auth/wrong-password':
    case 'auth/user-not-found':
      return {
        code,
        userMessage: 'Invalid email or password.',
        retryable: false,
      };
    case 'auth/email-already-in-use':
      return {
        code,
        userMessage: 'An account with this email already exists.',
        retryable: false,
      };
    case 'auth/weak-password':
      return {
        code,
        userMessage: 'Password must be at least 8 characters.',
        retryable: false,
      };
    case 'auth/too-many-requests':
      return {
        code,
        userMessage: 'Too many attempts. Please wait before trying again.',
        retryable: true,
      };
    case 'auth/popup-blocked':
      return {
        code,
        userMessage:
          'Sign-in popup was blocked by the browser or preview frame. Use redirect sign-in or open in a full tab.',
        retryable: true,
      };
    case 'auth/popup-closed-by-user':
      return {
        code,
        userMessage: 'Sign-in was cancelled before completion.',
        retryable: true,
      };
    case 'auth/account-exists-with-different-credential':
      return {
        code,
        userMessage:
          'An account already exists with the same email under another provider. Sign in with that provider first, then link accounts in Settings.',
        retryable: false,
      };
    case 'auth/requires-recent-login':
      return {
        code,
        userMessage: 'Please re-authenticate to complete this sensitive account change.',
        retryable: false,
      };
    case 'auth/operation-not-allowed':
      return {
        code,
        userMessage:
          'Phone sign-in is not enabled yet. Enable the Phone provider in Firebase Console -> Authentication -> Sign-in method.',
        retryable: false,
      };
    case 'auth/invalid-phone-number':
      return {
        code,
        userMessage: 'Enter a valid phone number including country code (for example, +1 415 555 0123).',
        retryable: false,
      };
    case 'auth/missing-phone-number':
      return {
        code,
        userMessage: 'Please enter your phone number to receive an SMS code.',
        retryable: false,
      };
    case 'auth/invalid-verification-code':
      return {
        code,
        userMessage: 'The 6-digit SMS verification code is incorrect. Please check and try again.',
        retryable: true,
      };
    case 'auth/code-expired':
      return {
        code,
        userMessage: 'This SMS code has expired. Tap Resend SMS to get a new 6-digit code.',
        retryable: true,
      };
    case 'auth/captcha-check-failed':
      return {
        code,
        userMessage:
          'reCAPTCHA check failed. Please retry or open the app in a full browser tab (not a nested iframe).',
        retryable: true,
      };
    case 'auth/quota-exceeded':
      return {
        code,
        userMessage:
          'SMS quota has been temporarily exceeded for this project. Try again later or configure a Firebase test phone number.',
        retryable: true,
      };
    case 'auth/unauthorized-domain':
      return {
        code,
        userMessage:
          'This domain is not authorized for Phone Auth. Add this hostname in Firebase Console -> Authentication -> Settings -> Authorized domains.',
        retryable: false,
      };
    case 'auth/invalid-app-credential':
      return {
        code,
        userMessage:
          'App verification failed for Phone Auth. Ensure this domain is added under Authorized domains in Firebase Console.',
        retryable: true,
      };
    case 'storage/unauthorized':
      return {
        code,
        userMessage: 'You do not have permission to upload or access this file.',
        retryable: false,
      };
    case 'storage/canceled':
      return {
        code,
        userMessage: 'Upload was cancelled.',
        retryable: true,
      };
    case 'storage/quota-exceeded':
      return {
        code,
        userMessage: 'Storage quota exceeded.',
        retryable: false,
      };
    default:
      if (code.startsWith('auth/')) {
        return {
          code,
          userMessage: 'Authentication failed. Please check your details and try again.',
          retryable: false,
        };
      }
      if (code.startsWith('storage/')) {
        return {
          code,
          userMessage: 'File transfer failed. Please check the file size/type and retry.',
          retryable: true,
        };
      }
      if (code.startsWith('functions/')) {
        return {
          code,
          userMessage:
            'Backend function is unreachable or returned an error. Ensure Cloud Functions are deployed.',
          retryable: true,
        };
      }
      return {
        code,
        userMessage:
          error instanceof Error && error.message
            ? error.message
            : 'An unexpected error occurred.',
        retryable: true,
      };
  }
}

export async function withCallableRetry<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (error) {
    const mapped = mapFirebaseError(error);
    if (mapped.code === 'functions/unavailable' || mapped.code === 'unavailable') {
      await new Promise((resolve) => setTimeout(resolve, 600));
      return fn();
    }
    throw error;
  }
}
