export type LogLevel = 'info' | 'warn' | 'error';

const SENSITIVE_KEYS = /token|password|secret|text|body|phone|email|sdp|candidate|apiKey/i;

function redactObject(input: unknown, depth = 0): unknown {
  if (depth > 3) return '[redacted-depth]';
  if (input === null || input === undefined) return input;
  if (typeof input === 'string') {
    return input.length > 160 ? `${input.slice(0, 160)}...[truncated]` : input;
  }
  if (typeof input !== 'object') return input;
  if (Array.isArray(input)) {
    return input.slice(0, 10).map((item) => redactObject(item, depth + 1));
  }
  const out: Record<string, unknown> = {};
  for (const [key, val] of Object.entries(input as Record<string, unknown>)) {
    if (SENSITIVE_KEYS.test(key)) {
      out[key] = '[redacted]';
    } else {
      out[key] = redactObject(val, depth + 1);
    }
  }
  return out;
}

export const logger = {
  info(event: string, meta?: Record<string, unknown>): void {
    console.info(`[Converse] ${event}`, meta ? redactObject(meta) : '');
  },
  warn(event: string, meta?: Record<string, unknown>): void {
    console.warn(`[Converse] ${event}`, meta ? redactObject(meta) : '');
  },
  error(event: string, error?: unknown, meta?: Record<string, unknown>): void {
    const errorSummary =
      error instanceof Error
        ? { name: error.name, message: error.message }
        : { raw: String(error ?? 'unknown') };
    console.error(`[Converse] ${event}`, {
      error: errorSummary,
      ...(meta ? (redactObject(meta) as Record<string, unknown>) : {}),
    });
  },
};
