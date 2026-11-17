import { onCall } from 'firebase-functions/v2/https';
import { z } from 'zod';
import { FUNCTIONS_REGION, RATE_LIMITS } from '../lib/constants.js';
import { parseInput, requireAuth } from '../lib/errors.js';
import { enforceRateLimit } from '../lib/rateLimit.js';
const pingSchema = z.object({
    echo: z.string().max(64).optional(),
});
export const ping = onCall({
    region: FUNCTIONS_REGION,
    enforceAppCheck: true,
}, async (request) => {
    const uid = requireAuth(request);
    const input = parseInput(pingSchema, request.data);
    await enforceRateLimit(uid, 'ping', RATE_LIMITS.PING.limit, RATE_LIMITS.PING.windowSec);
    return {
        ok: true,
        region: FUNCTIONS_REGION,
        serverTimeIso: new Date().toISOString(),
        echo: input.echo ?? 'pong',
    };
});
//# sourceMappingURL=ping.js.map