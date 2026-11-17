export const FUNCTIONS_REGION = process.env.FUNCTIONS_REGION || 'us-central1';

export const LIMITS = {
  MAX_GROUP_MEMBERS: 256,
  DISPLAY_NAME_MIN: 1,
  DISPLAY_NAME_MAX: 60,
  USERNAME_MIN: 3,
  USERNAME_MAX: 30,
  ABOUT_MAX: 139,
  GROUP_NAME_MIN: 1,
  GROUP_NAME_MAX: 60,
  GROUP_DESC_MAX: 512,
  FORWARD_MAX_TARGETS: 5,
  STATUS_TEXT_MAX: 700,
  STATUS_VIEWERS_MAX: 1000,
  DISCOVER_BATCH_MAX: 500,
} as const;

export const RATE_LIMITS = {
  PING: { limit: 60, windowSec: 60 },
  BOOTSTRAP: { limit: 10, windowSec: 3600 },
  UPDATE_USERNAME: { limit: 10, windowSec: 3600 },
  LOOKUP_USER: { limit: 30, windowSec: 3600 },
  DISCOVER_CONTACTS: { limit: 10, windowSec: 86400 },
  START_DIRECT_CHAT: { limit: 30, windowSec: 3600 },
  CREATE_GROUP: { limit: 10, windowSec: 86400 },
  FORWARD_MESSAGES: { limit: 30, windowSec: 3600 },
  CREATE_STATUS: { limit: 30, windowSec: 86400 },
  START_CALL: { limit: 30, windowSec: 3600 },
  GET_ICE_SERVERS: { limit: 30, windowSec: 3600 },
  EXPORT_DATA: { limit: 3, windowSec: 86400 },
  MESSAGES_PER_MIN_MODERATION: 60,
  FIRST_CONTACTS_PER_DAY_MODERATION: 20,
} as const;

export const WINDOWS = {
  STATUS_EXPIRY_MS: 24 * 60 * 60 * 1000,
  STATUS_DELETE_TTL_MS: 48 * 60 * 60 * 1000,
  CALL_STALE_MS: 90 * 1000,
  ORPHAN_UPLOAD_MS: 24 * 60 * 60 * 1000,
  DEVICE_STALE_MS: 60 * 24 * 60 * 60 * 1000,
  EXPORT_EXPIRE_MS: 24 * 60 * 60 * 1000,
  CALL_SIGNALS_TTL_MS: 10 * 60 * 1000,
} as const;
