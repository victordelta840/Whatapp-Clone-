import {
  Timestamp,
  type FirestoreDataConverter,
  type QueryDocumentSnapshot,
  type SnapshotOptions,
  type WithFieldValue,
} from 'firebase/firestore';
import { z } from 'zod';

export type PrivacyAudience = 'everyone' | 'contacts' | 'nobody';
export type GroupAddPolicy = 'everyone' | 'contacts';
export type StatusAudienceMode = 'contacts' | 'excludeList' | 'onlyList';
export type ThemeMode = 'light' | 'dark' | 'system';

const timestampSchema = z.custom<Timestamp>(
  (val) => val instanceof Timestamp || (typeof val === 'object' && val !== null && 'toDate' in val),
  'Expected Firestore Timestamp',
);

export const userProfileSchema = z.object({
  schemaVersion: z.number().default(1),
  displayName: z.string().min(1).max(60),
  displayNameLower: z.string().min(1).max(60),
  username: z.string().min(3).max(30).nullable(),
  createdAt: timestampSchema,
  updatedAt: timestampSchema,
});
export type UserProfile = z.infer<typeof userProfileSchema> & { uid?: string };

export const restrictedPhotoSchema = z.object({
  schemaVersion: z.number().default(1),
  photoPath: z.string().nullable(),
  photoURL: z.string().nullable(),
  updatedAt: timestampSchema,
});
export type RestrictedPhoto = z.infer<typeof restrictedPhotoSchema>;

export const restrictedAboutSchema = z.object({
  schemaVersion: z.number().default(1),
  text: z.string().max(139),
  updatedAt: timestampSchema,
});
export type RestrictedAbout = z.infer<typeof restrictedAboutSchema>;

export const privateAccountSchema = z.object({
  schemaVersion: z.number().default(1),
  email: z.string().nullable(),
  phoneNumber: z.string().nullable(),
  providers: z.array(z.string()),
  createdAt: timestampSchema,
});
export type PrivateAccount = z.infer<typeof privateAccountSchema>;

export const userSettingsSchema = z.object({
  schemaVersion: z.number().default(1),
  privacy: z.object({
    lastSeen: z.enum(['everyone', 'contacts', 'nobody']),
    onlineStatus: z.enum(['everyone', 'contacts', 'nobody']),
    profilePhoto: z.enum(['everyone', 'contacts', 'nobody']),
    about: z.enum(['everyone', 'contacts', 'nobody']),
    readReceipts: z.boolean(),
    typingIndicators: z.boolean(),
    groupAdd: z.enum(['everyone', 'contacts']),
    statusAudience: z.object({
      mode: z.enum(['contacts', 'excludeList', 'onlyList']),
      uids: z.array(z.string()),
    }),
    findableByUsername: z.boolean(),
    findableByPhone: z.boolean(),
    findableByEmail: z.boolean(),
  }),
  notifications: z.object({
    messages: z.boolean(),
    groups: z.boolean(),
    calls: z.boolean(),
    statusUpdates: z.boolean(),
    showPreviews: z.boolean(),
  }),
  mutedStatusAuthors: z.array(z.string()),
  theme: z.enum(['light', 'dark', 'system']),
  locale: z.string().default('en'),
});
export type UserSettings = z.infer<typeof userSettingsSchema>;

export const contactDocSchema = z.object({
  schemaVersion: z.number().default(1),
  addedAt: timestampSchema,
  source: z.enum(['manual', 'discovery', 'invite', 'contactPicker']),
  nickname: z.string().max(64).nullable().default(null),
});
export type ContactDoc = z.infer<typeof contactDocSchema> & { uid?: string };

export const blockDocSchema = z.object({
  schemaVersion: z.number().default(1),
  blockedAt: timestampSchema,
});
export type BlockDoc = z.infer<typeof blockDocSchema> & { uid?: string };

export const presenceDocSchema = z.object({
  schemaVersion: z.number().default(1),
  state: z.enum(['online', 'offline']),
  lastActiveAt: timestampSchema,
  updatedAt: timestampSchema,
});
export type PresenceDoc = z.infer<typeof presenceDocSchema>;

export const notificationDocSchema = z.object({
  schemaVersion: z.number().default(1),
  type: z.enum([
    'message',
    'mention',
    'groupAdded',
    'groupInvite',
    'missedCall',
    'statusReply',
    'system',
  ]),
  title: z.string(),
  body: z.string(),
  data: z.object({
    conversationId: z.string().nullable().optional(),
    messageId: z.string().nullable().optional(),
    callId: z.string().nullable().optional(),
    actorUid: z.string().nullable().optional(),
  }),
  read: z.boolean(),
  createdAt: timestampSchema,
});
export type NotificationDoc = z.infer<typeof notificationDocSchema> & { id?: string };

export const chatStateSchema = z.object({
  schemaVersion: z.number().default(1),
  pinned: z.boolean(),
  pinnedAt: timestampSchema.nullable(),
  archived: z.boolean(),
  mutedUntil: timestampSchema.nullable(),
  unreadCount: z.number().int().min(0),
  markedUnread: z.boolean(),
  clearedAt: timestampSchema.nullable(),
  lastOpenedAt: timestampSchema.nullable(),
});
export type ChatState = z.infer<typeof chatStateSchema> & { id?: string };

export const lastMessageSummarySchema = z.object({
  id: z.string(),
  senderId: z.string(),
  type: z.enum(['text', 'image', 'video', 'audio', 'voice', 'document', 'system']),
  textPreview: z.string().max(100),
  createdAt: timestampSchema,
});

export const groupMetaSchema = z.object({
  name: z.string().min(1).max(60),
  description: z.string().max(512).default(''),
  photoPath: z.string().nullable(),
  photoURL: z.string().nullable(),
  memberCount: z.number().int().min(0).max(256),
  settings: z.object({
    sendMessages: z.enum(['all', 'adminsOnly']),
    editInfo: z.enum(['all', 'adminsOnly']),
    addMembers: z.enum(['all', 'adminsOnly']),
    joinApproval: z.boolean(),
  }),
  inviteCodeActive: z.string().nullable(),
});

export const conversationSchema = z.object({
  schemaVersion: z.number().default(1),
  type: z.enum(['direct', 'group']),
  participantIds: z.array(z.string()).max(256),
  createdBy: z.string(),
  createdAt: timestampSchema,
  updatedAt: timestampSchema,
  lastMessage: lastMessageSummarySchema.nullable(),
  lastMessageAt: timestampSchema.nullable(),
  group: groupMetaSchema.optional(),
});
export type Conversation = z.infer<typeof conversationSchema> & { id?: string };

export const conversationMemberSchema = z.object({
  schemaVersion: z.number().default(1),
  role: z.enum(['owner', 'admin', 'member']),
  joinedAt: timestampSchema,
  addedBy: z.string(),
  lastDeliveredAt: timestampSchema.nullable(),
  lastReadAt: timestampSchema.nullable(),
  lastReadMessageId: z.string().nullable(),
});
export type ConversationMember = z.infer<typeof conversationMemberSchema> & { uid?: string };

export const replyToSchema = z.object({
  kind: z.enum(['message', 'status']),
  messageId: z.string().optional(),
  statusId: z.string().optional(),
  senderId: z.string(),
  type: z.enum(['text', 'image', 'video', 'audio', 'voice', 'document', 'system']),
  textPreview: z.string().max(100),
  thumbPath: z.string().nullable().optional(),
});
export type ReplyTo = z.infer<typeof replyToSchema>;

export const mediaPayloadSchema = z.object({
  storagePath: z.string(),
  thumbPath: z.string().nullable(),
  mimeType: z.string(),
  sizeBytes: z.number().int().nonnegative(),
  width: z.number().int().positive().nullable().optional(),
  height: z.number().int().positive().nullable().optional(),
  durationMs: z.number().int().nonnegative().nullable().optional(),
  fileName: z.string().nullable().optional(),
  waveform: z.array(z.number().int().min(0).max(100)).max(64).optional(),
});
export type MediaPayload = z.infer<typeof mediaPayloadSchema>;

export const systemEventSchema = z.object({
  kind: z.enum([
    'memberAdded',
    'memberRemoved',
    'memberLeft',
    'roleChanged',
    'groupRenamed',
    'groupSettingsChanged',
    'callMissed',
    'callDeclined',
    'callEnded',
  ]),
  actorUid: z.string(),
  targetUids: z.array(z.string()).default([]),
  callId: z.string().nullable().optional(),
});
export type SystemEvent = z.infer<typeof systemEventSchema>;

export type MessageType = 'text' | 'image' | 'video' | 'audio' | 'voice' | 'document' | 'system';

export const messageSchema = z.object({
  schemaVersion: z.number().default(1),
  senderId: z.string(),
  type: z.enum(['text', 'image', 'video', 'audio', 'voice', 'document', 'system']),
  text: z.string().max(4096).nullable(),
  media: mediaPayloadSchema.nullable(),
  replyTo: replyToSchema.nullable(),
  forwarded: z.boolean().default(false),
  mentions: z.array(z.string()).max(50).default([]),
  createdAt: timestampSchema,
  editedAt: timestampSchema.nullable(),
  deletedForEveryone: z.boolean().default(false),
  deletedAt: timestampSchema.nullable(),
  reactions: z.record(z.string(), z.string().max(8)).default({}),
  systemEvent: systemEventSchema.nullable().optional(),
});
export type Message = z.infer<typeof messageSchema> & {
  id?: string;
  hasPendingWrites?: boolean;
  fromCache?: boolean;
};

export const statusSchema = z.object({
  schemaVersion: z.number().default(1),
  authorId: z.string(),
  type: z.enum(['text', 'image', 'video']),
  text: z.string().max(700).nullable(),
  backgroundColor: z.string().nullable(),
  fontStyle: z.string().nullable(),
  media: mediaPayloadSchema.nullable(),
  caption: z.string().max(700).nullable(),
  createdAt: timestampSchema,
  expiresAt: timestampSchema,
  deleteAt: timestampSchema,
  viewerIds: z.array(z.string()).max(1000),
  viewCount: z.number().int().nonnegative().default(0),
});
export type StatusUpdate = z.infer<typeof statusSchema> & { id?: string };

export const statusViewSchema = z.object({
  schemaVersion: z.number().default(1),
  viewedAt: timestampSchema,
});
export type StatusView = z.infer<typeof statusViewSchema> & { viewerUid?: string };

export type CallState =
  | 'ringing'
  | 'accepted'
  | 'declined'
  | 'busy'
  | 'cancelled'
  | 'missed'
  | 'ended'
  | 'failed';

export const callDocSchema = z.object({
  schemaVersion: z.number().default(1),
  conversationId: z.string(),
  callerId: z.string(),
  calleeId: z.string(),
  participantIds: z.array(z.string()).length(2),
  type: z.enum(['audio', 'video']),
  state: z.enum([
    'ringing',
    'accepted',
    'declined',
    'busy',
    'cancelled',
    'missed',
    'ended',
    'failed',
  ]),
  createdAt: timestampSchema,
  answeredAt: timestampSchema.nullable(),
  endedAt: timestampSchema.nullable(),
  endedBy: z.string().nullable(),
  endReason: z.string().nullable(),
  durationSec: z.number().int().nonnegative().nullable(),
});
export type CallDoc = z.infer<typeof callDocSchema> & { id?: string };

export const callSignalSchema = z.object({
  schemaVersion: z.number().default(1),
  from: z.string(),
  to: z.string(),
  kind: z.enum(['offer', 'answer', 'candidate']),
  sdp: z.string().max(8192).nullable().optional(),
  candidate: z.string().max(8192).nullable().optional(),
  sdpMid: z.string().max(64).nullable().optional(),
  sdpMLineIndex: z.number().int().nullable().optional(),
  createdAt: timestampSchema,
});
export type CallSignal = z.infer<typeof callSignalSchema> & { id?: string };

export function createZodConverter<T extends z.ZodTypeAny>(
  schema: T,
): FirestoreDataConverter<z.infer<T>> {
  return {
    toFirestore(modelObject: WithFieldValue<z.infer<T>>) {
      return modelObject as Record<string, unknown>;
    },
    fromFirestore(snapshot: QueryDocumentSnapshot, options: SnapshotOptions): z.infer<T> {
      const data = snapshot.data(options);
      const parsed = schema.safeParse(data);
      if (!parsed.success) {
        return data as z.infer<T>;
      }
      return parsed.data;
    },
  };
}
