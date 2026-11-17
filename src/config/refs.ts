import { collection, doc, type CollectionReference, type DocumentReference } from 'firebase/firestore';
import { requireFirebaseHandles } from './firebase';
import {
  blockDocSchema,
  callDocSchema,
  callSignalSchema,
  chatStateSchema,
  contactDocSchema,
  conversationMemberSchema,
  conversationSchema,
  createZodConverter,
  messageSchema,
  notificationDocSchema,
  presenceDocSchema,
  privateAccountSchema,
  restrictedAboutSchema,
  restrictedPhotoSchema,
  statusSchema,
  statusViewSchema,
  userProfileSchema,
  userSettingsSchema,
} from '@/types';

const userProfileConverter = createZodConverter(userProfileSchema);
const restrictedPhotoConverter = createZodConverter(restrictedPhotoSchema);
const restrictedAboutConverter = createZodConverter(restrictedAboutSchema);
const privateAccountConverter = createZodConverter(privateAccountSchema);
const userSettingsConverter = createZodConverter(userSettingsSchema);
const contactConverter = createZodConverter(contactDocSchema);
const blockConverter = createZodConverter(blockDocSchema);
const presenceConverter = createZodConverter(presenceDocSchema);
const notificationConverter = createZodConverter(notificationDocSchema);
const chatStateConverter = createZodConverter(chatStateSchema);
const conversationConverter = createZodConverter(conversationSchema);
const memberConverter = createZodConverter(conversationMemberSchema);
const messageConverter = createZodConverter(messageSchema);
const statusConverter = createZodConverter(statusSchema);
const statusViewConverter = createZodConverter(statusViewSchema);
const callConverter = createZodConverter(callDocSchema);
const signalConverter = createZodConverter(callSignalSchema);

export const refs = {
  userDoc(uid: string) {
    const { db } = requireFirebaseHandles();
    return doc(db, 'users', uid).withConverter(userProfileConverter);
  },
  restrictedPhotoDoc(uid: string) {
    const { db } = requireFirebaseHandles();
    return doc(db, 'users', uid, 'restricted', 'photo').withConverter(restrictedPhotoConverter);
  },
  restrictedAboutDoc(uid: string) {
    const { db } = requireFirebaseHandles();
    return doc(db, 'users', uid, 'restricted', 'about').withConverter(restrictedAboutConverter);
  },
  privateAccountDoc(uid: string) {
    const { db } = requireFirebaseHandles();
    return doc(db, 'users', uid, 'private', 'account').withConverter(privateAccountConverter);
  },
  settingsDoc(uid: string) {
    const { db } = requireFirebaseHandles();
    return doc(db, 'users', uid, 'private', 'settings').withConverter(userSettingsConverter);
  },
  contactsCol(uid: string) {
    const { db } = requireFirebaseHandles();
    return collection(db, 'users', uid, 'contacts').withConverter(contactConverter);
  },
  contactDoc(uid: string, contactUid: string) {
    const { db } = requireFirebaseHandles();
    return doc(db, 'users', uid, 'contacts', contactUid).withConverter(contactConverter);
  },
  blocksCol(uid: string) {
    const { db } = requireFirebaseHandles();
    return collection(db, 'users', uid, 'blocks').withConverter(blockConverter);
  },
  blockDoc(uid: string, blockedUid: string) {
    const { db } = requireFirebaseHandles();
    return doc(db, 'users', uid, 'blocks', blockedUid).withConverter(blockConverter);
  },
  deviceDoc(uid: string, deviceId: string): DocumentReference {
    const { db } = requireFirebaseHandles();
    return doc(db, 'users', uid, 'devices', deviceId);
  },
  notificationsCol(uid: string) {
    const { db } = requireFirebaseHandles();
    return collection(db, 'users', uid, 'notifications').withConverter(notificationConverter);
  },
  notificationDoc(uid: string, nid: string) {
    const { db } = requireFirebaseHandles();
    return doc(db, 'users', uid, 'notifications', nid).withConverter(notificationConverter);
  },
  chatStatesCol(uid: string) {
    const { db } = requireFirebaseHandles();
    return collection(db, 'users', uid, 'chatStates').withConverter(chatStateConverter);
  },
  chatStateDoc(uid: string, cid: string) {
    const { db } = requireFirebaseHandles();
    return doc(db, 'users', uid, 'chatStates', cid).withConverter(chatStateConverter);
  },
  hiddenMessagesCol(uid: string, cid: string): CollectionReference {
    const { db } = requireFirebaseHandles();
    return collection(db, 'users', uid, 'chatStates', cid, 'hiddenMessages');
  },
  hiddenMessageDoc(uid: string, cid: string, mid: string): DocumentReference {
    const { db } = requireFirebaseHandles();
    return doc(db, 'users', uid, 'chatStates', cid, 'hiddenMessages', mid);
  },
  presenceDoc(uid: string) {
    const { db } = requireFirebaseHandles();
    return doc(db, 'presence', uid).withConverter(presenceConverter);
  },
  conversationsCol() {
    const { db } = requireFirebaseHandles();
    return collection(db, 'conversations').withConverter(conversationConverter);
  },
  conversationDoc(cid: string) {
    const { db } = requireFirebaseHandles();
    return doc(db, 'conversations', cid).withConverter(conversationConverter);
  },
  membersCol(cid: string) {
    const { db } = requireFirebaseHandles();
    return collection(db, 'conversations', cid, 'members').withConverter(memberConverter);
  },
  memberDoc(cid: string, uid: string) {
    const { db } = requireFirebaseHandles();
    return doc(db, 'conversations', cid, 'members', uid).withConverter(memberConverter);
  },
  typingCol(cid: string): CollectionReference {
    const { db } = requireFirebaseHandles();
    return collection(db, 'conversations', cid, 'typing');
  },
  typingDoc(cid: string, uid: string): DocumentReference {
    const { db } = requireFirebaseHandles();
    return doc(db, 'conversations', cid, 'typing', uid);
  },
  joinRequestsCol(cid: string): CollectionReference {
    const { db } = requireFirebaseHandles();
    return collection(db, 'conversations', cid, 'joinRequests');
  },
  messagesCol(cid: string) {
    const { db } = requireFirebaseHandles();
    return collection(db, 'conversations', cid, 'messages').withConverter(messageConverter);
  },
  messageDoc(cid: string, mid: string) {
    const { db } = requireFirebaseHandles();
    return doc(db, 'conversations', cid, 'messages', mid).withConverter(messageConverter);
  },
  statusesCol() {
    const { db } = requireFirebaseHandles();
    return collection(db, 'statuses').withConverter(statusConverter);
  },
  statusDoc(sid: string) {
    const { db } = requireFirebaseHandles();
    return doc(db, 'statuses', sid).withConverter(statusConverter);
  },
  statusViewsCol(sid: string) {
    const { db } = requireFirebaseHandles();
    return collection(db, 'statuses', sid, 'views').withConverter(statusViewConverter);
  },
  statusViewDoc(sid: string, viewerUid: string) {
    const { db } = requireFirebaseHandles();
    return doc(db, 'statuses', sid, 'views', viewerUid).withConverter(statusViewConverter);
  },
  callsCol() {
    const { db } = requireFirebaseHandles();
    return collection(db, 'calls').withConverter(callConverter);
  },
  callDoc(callId: string) {
    const { db } = requireFirebaseHandles();
    return doc(db, 'calls', callId).withConverter(callConverter);
  },
  callSignalsCol(callId: string) {
    const { db } = requireFirebaseHandles();
    return collection(db, 'calls', callId, 'signals').withConverter(signalConverter);
  },
  reportsCol(): CollectionReference {
    const { db } = requireFirebaseHandles();
    return collection(db, 'reports');
  },
};
