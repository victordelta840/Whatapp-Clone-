import { HttpsError } from 'firebase-functions/v2/https';
export function requireAuth(request) {
    if (!request.auth?.uid) {
        throw new HttpsError('unauthenticated', 'Authentication is required.');
    }
    return request.auth.uid;
}
export function requireVerifiedEmailOrProvider(request) {
    const uid = requireAuth(request);
    const token = request.auth?.token;
    const provider = token?.firebase?.sign_in_provider;
    const verified = token?.email_verified === true;
    if (provider !== 'google.com' && provider !== 'phone' && !verified) {
        throw new HttpsError('permission-denied', 'Verify your phone number before performing this action.');
    }
    return uid;
}
export function parseInput(schema, raw) {
    const parsed = schema.safeParse(raw ?? {});
    if (!parsed.success) {
        throw new HttpsError('invalid-argument', parsed.error.issues.map((i) => `${i.path.join('.') || 'input'}: ${i.message}`).join('; '));
    }
    return parsed.data;
}
//# sourceMappingURL=errors.js.map