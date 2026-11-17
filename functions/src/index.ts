import { initializeApp, getApps } from 'firebase-admin/app';

if (getApps().length === 0) {
  initializeApp();
}

// Callables
export { ping } from './callable/ping.js';
export { bootstrapProfile } from './callable/bootstrapProfile.js';
export { updateUsername } from './callable/updateUsername.js';
export { lookupUser } from './callable/lookupUser.js';
export { revokeAllSessions } from './callable/revokeAllSessions.js';
export { exportMyData } from './callable/exportMyData.js';
export { deleteMyAccount } from './callable/deleteMyAccount.js';
export { startDirectChat, forwardMessages } from './callable/conversations.js';
export {
  createGroup,
  updateGroupInfo,
  updateGroupSettings,
  addGroupMembers,
  removeGroupMember,
  setGroupRole,
  leaveGroup,
  createInviteLink,
  revokeInviteLink,
  previewInvite,
  joinGroupByInvite,
  resolveJoinRequest,
} from './callable/groups.js';
export { createStatus, discoverContacts } from './callable/statusAndContacts.js';
export { startCall, getIceServers } from './callable/calls.js';

// Triggers
export { onMessageCreated, onMessageUpdated } from './triggers/onMessage.js';
export {
  onCallCreated,
  onCallUpdated,
  onStatusViewCreated,
  onBlockCreated,
  onReportCreated,
  onSettingsUpdated,
  onStorageFinalized,
} from './triggers/onCallAndStatus.js';

// Scheduled Jobs
export {
  expireStatuses,
  sweepStaleCalls,
  cleanupOrphanUploads,
  cleanupDevices,
  cleanupExports,
  cleanupRateLimits,
} from './scheduled/maintenance.js';
