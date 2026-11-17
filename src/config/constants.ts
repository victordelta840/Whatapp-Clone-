export const APP_DEFAULT_NAME = 'Converse';

export const LIMITS = {
  MAX_GROUP_MEMBERS: 256,
  DISPLAY_NAME_MIN: 1,
  DISPLAY_NAME_MAX: 60,
  USERNAME_MIN: 3,
  USERNAME_MAX: 30,
  ABOUT_MAX: 139,
  NICKNAME_MAX: 64,
  GROUP_NAME_MIN: 1,
  GROUP_NAME_MAX: 60,
  GROUP_DESC_MAX: 512,
  MESSAGE_TEXT_MAX: 4096,
  MESSAGE_CAPTION_MAX: 1024,
  TEXT_PREVIEW_MAX: 100,
  MAX_MENTIONS: 50,
  MAX_WAVEFORM_SAMPLES: 64,
  REACTION_MAX_LENGTH: 8,
  STATUS_TEXT_MAX: 700,
  STATUS_CAPTION_MAX: 700,
  STATUS_VIEWERS_MAX: 1000,
  STATUS_VIDEO_MAX_SEC: 30,
  REPORT_DETAILS_MAX: 1000,
  FORWARD_MAX_TARGETS: 5,
  COMPOSER_MAX_FILES: 10,
  CONCURRENT_UPLOADS_MAX: 3,
  LOCAL_SEARCH_MAX_PER_CHAT: 5000,
} as const;

export const WINDOWS = {
  EDIT_WINDOW_MINUTES: 15,
  DELETE_FOR_EVERYONE_HOURS: 48,
  PRESENCE_HEARTBEAT_MS: 45_000,
  PRESENCE_ONLINE_THRESHOLD_MS: 90_000,
  TYPING_THROTTLE_MS: 3_000,
  TYPING_EXPIRY_MS: 6_000,
  CALL_RING_TIMEOUT_MS: 45_000,
  CALL_STALE_SWEEP_SEC: 90,
  STATUS_EXPIRY_HOURS: 24,
  STATUS_TTL_GRACE_HOURS: 24,
  EXPORT_EXPIRY_HOURS: 24,
  PHONE_RESEND_COOLDOWN_SEC: 60,
} as const;

export const PAGINATION = {
  MESSAGES_PAGE_SIZE: 30,
  CONVERSATIONS_PAGE_SIZE: 30,
  CHAT_STATES_LIMIT: 500,
  CALLS_PAGE_SIZE: 25,
  NOTIFICATIONS_PAGE_SIZE: 30,
  SEARCH_RESULTS_LIMIT: 20,
  DIAGNOSTICS_LISTENER_WARN_THRESHOLD: 25,
} as const;

export const MEDIA_LIMITS = {
  PROFILE_PHOTO_MAX_BYTES: 5 * 1024 * 1024,
  PROFILE_PHOTO_MAX_EDGE: 1024,
  GROUP_PHOTO_MAX_BYTES: 5 * 1024 * 1024,
  CHAT_IMAGE_MAX_BYTES: 10 * 1024 * 1024,
  CHAT_IMAGE_MAX_EDGE: 1600,
  CHAT_IMAGE_QUALITY: 0.8,
  THUMB_MAX_BYTES: 200 * 1024,
  THUMB_MAX_EDGE: 320,
  CHAT_VIDEO_MAX_BYTES: 64 * 1024 * 1024,
  CHAT_AUDIO_MAX_BYTES: 16 * 1024 * 1024,
  CHAT_DOCUMENT_MAX_BYTES: 50 * 1024 * 1024,
  VOICE_AUDIO_BITS_PER_SECOND: 32_000,
  CALL_SIGNAL_MAX_BYTES: 8 * 1024,
} as const;

export const ALLOWED_MIME_TYPES = {
  IMAGE: ['image/jpeg', 'image/png', 'image/webp', 'image/gif'] as const,
  VIDEO: ['video/mp4', 'video/webm', 'video/quicktime'] as const,
  AUDIO: [
    'audio/webm',
    'audio/webm;codecs=opus',
    'audio/mp4',
    'audio/ogg',
    'audio/mpeg',
    'audio/aac',
  ] as const,
} as const;

export const BLOCKED_EXECUTABLE_EXTENSIONS = [
  '.exe',
  '.msi',
  '.bat',
  '.cmd',
  '.com',
  '.scr',
  '.pif',
  '.sh',
  '.bash',
  '.zsh',
  '.ps1',
  '.vbs',
  '.vbe',
  '.js',
  '.jse',
  '.wsf',
  '.wsh',
  '.jar',
  '.apk',
  '.ipa',
  '.dmg',
  '.pkg',
  '.deb',
  '.rpm',
  '.app',
  '.dll',
  '.so',
  '.dylib',
] as const;

export const BLOCKED_EXECUTABLE_MIMES = [
  'application/x-msdownload',
  'application/x-msdos-program',
  'application/x-executable',
  'application/x-sh',
  'application/x-shellscript',
  'application/x-bat',
  'application/java-archive',
  'application/vnd.android.package-archive',
] as const;

export const RATE_LIMITS = {
  LOOKUP_USER_PER_HOUR: 30,
  DISCOVER_CONTACTS_PER_DAY: 10,
  DISCOVER_CONTACTS_BATCH_MAX: 500,
  MESSAGES_PER_MINUTE_MODERATION: 60,
  FIRST_CONTACTS_PER_DAY_MODERATION: 20,
} as const;

export const STATUS_BACKGROUNDS = [
  { id: 'indigo', label: 'Deep Indigo', className: 'bg-[#312E81] text-white' },
  { id: 'emerald', label: 'Emerald', className: 'bg-[#065F46] text-white' },
  { id: 'slate', label: 'Midnight Slate', className: 'bg-[#1E293B] text-white' },
  { id: 'amber', label: 'Warm Amber', className: 'bg-[#92400E] text-white' },
  { id: 'crimson', label: 'Crimson', className: 'bg-[#991B1B] text-white' },
  { id: 'teal', label: 'Ocean Teal', className: 'bg-[#115E59] text-white' },
] as const;

export const STATUS_FONTS = [
  { id: 'sans', label: 'Clean Sans', className: 'font-sans font-semibold' },
  { id: 'serif', label: 'Editorial Serif', className: 'font-serif font-medium' },
  { id: 'mono', label: 'Monospace', className: 'font-mono font-medium' },
] as const;

export const USERNAME_REGEX = /^[a-z0-9_.]{3,30}$/;
export const E164_REGEX = /^\+[1-9]\d{6,14}$/;
