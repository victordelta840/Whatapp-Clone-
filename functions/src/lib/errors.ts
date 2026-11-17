import { HttpsError, type CallableRequest } from 'firebase-functions/v2/https';
import type { ZodType } from 'zod';

export function requireAuth(request: CallableRequest<unknown>): string {
  if (!request.auth?.uid) {
    throw new HttpsError('unauthenticated', 'Authentication is required.');
  }
  return request.auth.uid;
}

export function requireVerifiedEmailOrProvider(request: CallableRequest<unknown>): string {
  const uid = requireAuth(request);
  const token = request.auth?.token;
  const provider = token?.firebase?.sign_in_provider;
  const verified = token?.email_verified === true;
  if (provider !== 'google.com' && provider !== 'phone' && !verified) {
    throw new HttpsError(
      'permission-denied',
      'Verify your phone number before performing this action.',
    );
  }
  return uid;
}

export function parseInput<T>(schema: ZodType<T>, raw: unknown): T {
  const parsed = schema.safeParse(raw ?? {});
  if (!parsed.success) {
    throw new HttpsError(
      'invalid-argument',
      parsed.error.issues.map((i) => `${i.path.join('.') || 'input'}: ${i.message}`).join('; '),
    );
  }
  return parsed.data;
}
