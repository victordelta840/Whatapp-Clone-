import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Camera,
  Check,
  Copy,
  Link2,
  LogOut,
  Shield,
  UserMinus,
  UserPlus,
  X,
} from 'lucide-react';
import {
  Avatar,
  Button,
  ConfirmDialog,
  Dialog,
  Input,
  Select,
  Switch,
  TextArea,
  toast,
} from '@/components/ui';
import { LIMITS } from '@/config/constants';
import { mapFirebaseError } from '@/lib/errors';
import { useAuthStore } from '@/features/auth';
import { useContacts } from '@/features/contacts';
import { blockUser, ReportDialog } from '@/features/privacy';
import type { HydratedUserSummary } from '@/features/profile';
import type { Conversation, ConversationMember, Message } from '@/types';
import { MediaGallery } from '@/features/messages/MediaGallery';
import {
  addGroupMembers,
  createGroupInviteLink,
  leaveGroupConversation,
  removeGroupMember,
  resolveGroupJoinRequest,
  revokeGroupInviteLink,
  setGroupMemberRole,
  updateGroupInfo,
  updateGroupSettings,
  uploadGroupPhoto,
  useGroupJoinRequests,
} from './groups.service';

export interface GroupInfoPanelProps {
  conversation: Conversation & { id: string };
  members: Array<ConversationMember & { uid: string }>;
  profiles: Record<string, HydratedUserSummary>;
  messages: Array<Message & { id: string }>;
  peerUid: string | null;
  onClose: () => void;
}

export const GroupInfoPanel: React.FC<GroupInfoPanelProps> = ({
  conversation,
  members,
  profiles,
  messages,
  peerUid,
  onClose,
}) => {
  const uid = useAuthStore((s) => s.authUser?.uid ?? null);
  const navigate = useNavigate();
  const { contacts } = useContacts();

  const isGroup = conversation.type === 'group';
  const myMember = members.find((m) => m.uid === uid);
  const isAdmin = myMember?.role === 'owner' || myMember?.role === 'admin';
  const canEditInfo = isGroup && (conversation.group?.settings.editInfo === 'all' || isAdmin);
  const canAddMembers = isGroup && (conversation.group?.settings.addMembers === 'all' || isAdmin);

  const joinRequests = useGroupJoinRequests(conversation.id, isGroup && isAdmin);

  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(conversation.group?.name ?? '');
  const [desc, setDesc] = useState(conversation.group?.description ?? '');
  const [busy, setBusy] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [leaveConfirm, setLeaveConfirm] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);

  const peer = peerUid ? profiles[peerUid] : undefined;
  const title = isGroup
    ? conversation.group?.name || 'Group'
    : peer?.profile?.displayName || 'User';
  const photoURL = isGroup ? conversation.group?.photoURL : peer?.photoURL;

  const handleSaveInfo = async () => {
    if (!name.trim()) return;
    setBusy(true);
    try {
      await updateGroupInfo({
        conversationId: conversation.id,
        name: name.trim(),
        description: desc.trim(),
      });
      setEditing(false);
      toast.success('Group info updated.');
    } catch (err) {
      toast.error(mapFirebaseError(err).userMessage);
    } finally {
      setBusy(false);
    }
  };

  const handleGroupPhoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setBusy(true);
    try {
      await uploadGroupPhoto(conversation.id, file);
      toast.success('Group photo updated.');
    } catch (err) {
      toast.error(mapFirebaseError(err).userMessage);
    } finally {
      setBusy(false);
    }
  };

  const handleCreateInvite = async () => {
    setBusy(true);
    try {
      const code = await createGroupInviteLink(conversation.id);
      const url = `${window.location.origin}/invite/${code}`;
      await navigator.clipboard.writeText(url).catch(() => undefined);
      toast.success('Invite link generated and copied!');
    } catch (err) {
      toast.error(mapFirebaseError(err).userMessage);
    } finally {
      setBusy(false);
    }
  };

  const inviteUrl = conversation.group?.inviteCodeActive
    ? `${window.location.origin}/invite/${conversation.group.inviteCodeActive}`
    : null;

  const nonMembers = contacts.filter((c) => !conversation.participantIds.includes(c.uid));

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <h2 className="text-sm font-semibold text-text-primary">
          {isGroup ? 'Group info' : 'Contact info'}
        </h2>
        <Button size="sm" variant="ghost" onClick={onClose} aria-label="Close panel">
          <X className="h-4 w-4" />
        </Button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-4 space-y-6">
        <div className="flex flex-col items-center text-center space-y-2">
          <div className="relative">
            <Avatar src={photoURL} name={title} size="xl" />
            {canEditInfo && (
              <label className="absolute -bottom-1 -right-1 flex h-8 w-8 cursor-pointer items-center justify-center rounded-full border border-border bg-surface-raised shadow hover:bg-surface-muted">
                <Camera className="h-4 w-4 text-primary" />
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/gif"
                  className="hidden"
                  onChange={(e) => void handleGroupPhoto(e)}
                />
              </label>
            )}
          </div>

          {!editing ? (
            <>
              <h3 className="text-base font-bold text-text-primary">{title}</h3>
              {isGroup ? (
                <p className="text-xs text-text-secondary">
                  {conversation.group?.description || `${members.length} members`}
                </p>
              ) : (
                <>
                  {peer?.profile?.username && (
                    <p className="text-xs text-text-secondary">@{peer.profile.username}</p>
                  )}
                  {peer?.aboutText && (
                    <p className="text-xs text-text-secondary">{peer.aboutText}</p>
                  )}
                </>
              )}
              {canEditInfo && (
                <Button size="sm" variant="secondary" onClick={() => setEditing(true)}>
                  Edit info
                </Button>
              )}
            </>
          ) : (
            <div className="w-full space-y-2 text-left">
              <Input
                label="Group name"
                maxLength={LIMITS.GROUP_NAME_MAX}
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
              <TextArea
                label="Description"
                rows={2}
                maxLength={LIMITS.GROUP_DESC_MAX}
                value={desc}
                onChange={(e) => setDesc(e.target.value)}
              />
              <div className="flex justify-end gap-2">
                <Button size="sm" variant="secondary" onClick={() => setEditing(false)}>
                  Cancel
                </Button>
                <Button size="sm" loading={busy} onClick={() => void handleSaveInfo()}>
                  Save
                </Button>
              </div>
            </div>
          )}
        </div>

        <MediaGallery messages={messages} />

        {isGroup && isAdmin && conversation.group && (
          <div className="rounded-xl border border-border bg-surface-muted p-3 space-y-3">
            <div className="flex items-center gap-2 text-xs font-semibold text-text-primary">
              <Shield className="h-4 w-4 text-primary" />
              <span>Group permissions</span>
            </div>
            <Select
              label="Send messages"
              value={conversation.group.settings.sendMessages}
              options={[
                { value: 'all', label: 'All members' },
                { value: 'adminsOnly', label: 'Admins only' },
              ]}
              onChange={(e) =>
                void updateGroupSettings({
                  conversationId: conversation.id,
                  sendMessages: e.target.value as 'all' | 'adminsOnly',
                }).catch((err) => toast.error(mapFirebaseError(err).userMessage))
              }
            />
            <Select
              label="Edit group info"
              value={conversation.group.settings.editInfo}
              options={[
                { value: 'adminsOnly', label: 'Admins only' },
                { value: 'all', label: 'All members' },
              ]}
              onChange={(e) =>
                void updateGroupSettings({
                  conversationId: conversation.id,
                  editInfo: e.target.value as 'all' | 'adminsOnly',
                }).catch((err) => toast.error(mapFirebaseError(err).userMessage))
              }
            />
            <Select
              label="Add members"
              value={conversation.group.settings.addMembers}
              options={[
                { value: 'adminsOnly', label: 'Admins only' },
                { value: 'all', label: 'All members' },
              ]}
              onChange={(e) =>
                void updateGroupSettings({
                  conversationId: conversation.id,
                  addMembers: e.target.value as 'all' | 'adminsOnly',
                }).catch((err) => toast.error(mapFirebaseError(err).userMessage))
              }
            />
            <Switch
              checked={conversation.group.settings.joinApproval}
              onCheckedChange={(v) =>
                void updateGroupSettings({
                  conversationId: conversation.id,
                  joinApproval: v,
                }).catch((err) => toast.error(mapFirebaseError(err).userMessage))
              }
              label="Approve new members via invite"
            />
          </div>
        )}

        {isGroup && isAdmin && (
          <div className="rounded-xl border border-border bg-surface-muted p-3 space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1.5 text-xs font-semibold text-text-primary">
                <Link2 className="h-4 w-4 text-primary" /> Invite link
              </span>
              <Button size="sm" variant="secondary" loading={busy} onClick={() => void handleCreateInvite()}>
                {inviteUrl ? 'Rotate' : 'Create'}
              </Button>
            </div>
            {inviteUrl && (
              <div className="space-y-2">
                <p className="break-all rounded-lg bg-surface p-2 text-[11px] text-text-secondary">
                  {inviteUrl}
                </p>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="secondary"
                    fullWidth
                    leftIcon={<Copy className="h-3.5 w-3.5" />}
                    onClick={() => {
                      void navigator.clipboard.writeText(inviteUrl);
                      toast.success('Invite link copied.');
                    }}
                  >
                    Copy
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() =>
                      void revokeGroupInviteLink(
                        conversation.id,
                        conversation.group!.inviteCodeActive!,
                      ).then(() => toast.success('Invite link revoked.'))
                    }
                  >
                    Revoke
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}

        {isGroup && isAdmin && joinRequests.length > 0 && (
          <div className="rounded-xl border border-border p-3 space-y-2">
            <p className="text-xs font-semibold text-text-primary">
              Pending join requests ({joinRequests.length})
            </p>
            {joinRequests.map((req) => (
              <div key={req.uid} className="flex items-center justify-between gap-2 text-xs">
                <span className="truncate text-text-primary">{req.uid}</span>
                <div className="flex gap-1">
                  <Button
                    size="sm"
                    onClick={() => void resolveGroupJoinRequest(conversation.id, req.uid, true)}
                  >
                    <Check className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => void resolveGroupJoinRequest(conversation.id, req.uid, false)}
                  >
                    <X className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}

        {isGroup && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-text-secondary">
                Members ({members.length})
              </span>
              {canAddMembers && (
                <Button
                  size="sm"
                  variant="ghost"
                  leftIcon={<UserPlus className="h-3.5 w-3.5" />}
                  onClick={() => setAddOpen(true)}
                >
                  Add
                </Button>
              )}
            </div>

            <div className="divide-y divide-border rounded-xl border border-border">
              {members.map((m) => {
                const p = profiles[m.uid];
                const label = m.uid === uid ? 'You' : p?.profile?.displayName || m.uid;
                return (
                  <div key={m.uid} className="flex items-center justify-between gap-2 px-3 py-2">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <Avatar src={p?.photoURL} name={label} size="sm" />
                      <div className="min-w-0">
                        <p className="truncate text-xs font-medium text-text-primary">{label}</p>
                        <p className="text-[10px] capitalize text-text-tertiary">{m.role}</p>
                      </div>
                    </div>
                    {isAdmin && m.uid !== uid && m.role !== 'owner' && (
                      <div className="flex items-center gap-1">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() =>
                            void setGroupMemberRole(
                              conversation.id,
                              m.uid,
                              m.role === 'admin' ? 'member' : 'admin',
                            ).catch((err) => toast.error(mapFirebaseError(err).userMessage))
                          }
                        >
                          {m.role === 'admin' ? 'Demote' : 'Admin'}
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          aria-label={`Remove ${label}`}
                          onClick={() =>
                            void removeGroupMember(conversation.id, m.uid).catch((err) =>
                              toast.error(mapFirebaseError(err).userMessage),
                            )
                          }
                        >
                          <UserMinus className="h-3.5 w-3.5 text-danger" />
                        </Button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <div className="space-y-2 border-t border-border pt-4">
          {!isGroup && peerUid && uid && (
            <Button
              variant="danger"
              size="sm"
              fullWidth
              onClick={() =>
                void blockUser(uid, peerUid)
                  .then(() => toast.success(`Blocked ${title}.`))
                  .catch((err) => toast.error(mapFirebaseError(err).userMessage))
              }
            >
              Block {title}
            </Button>
          )}
          <Button
            variant="secondary"
            size="sm"
            fullWidth
            onClick={() => setReportOpen(true)}
          >
            Report {isGroup ? 'group' : 'contact'}
          </Button>
          {isGroup && (
            <Button
              variant="danger"
              size="sm"
              fullWidth
              leftIcon={<LogOut className="h-4 w-4" />}
              onClick={() => setLeaveConfirm(true)}
            >
              Leave group
            </Button>
          )}
        </div>
      </div>

      <Dialog open={addOpen} onOpenChange={setAddOpen} title="Add members" size="sm">
        <div className="max-h-64 overflow-y-auto divide-y divide-border">
          {nonMembers.length === 0 ? (
            <p className="py-4 text-xs text-text-secondary">All your contacts are already in this group.</p>
          ) : (
            nonMembers.map((c) => (
              <div key={c.uid} className="flex items-center justify-between py-2">
                <span className="text-sm text-text-primary">{c.nickname || c.uid}</span>
                <Button
                  size="sm"
                  onClick={() =>
                    void addGroupMembers(conversation.id, [c.uid])
                      .then((added) => {
                        toast.success(added ? 'Member added.' : 'Skipped due to user privacy settings.');
                        setAddOpen(false);
                      })
                      .catch((err) => toast.error(mapFirebaseError(err).userMessage))
                  }
                >
                  Add
                </Button>
              </div>
            ))
          )}
        </div>
      </Dialog>

      <ConfirmDialog
        open={leaveConfirm}
        onOpenChange={setLeaveConfirm}
        title="Leave this group?"
        description="You will stop receiving messages from this group. If you are the owner, ownership transfers automatically."
        confirmLabel="Leave group"
        destructive
        onConfirm={async () => {
          await leaveGroupConversation(conversation.id);
          toast.success('Left group.');
          navigate('/chats');
        }}
      />

      <ReportDialog
        open={reportOpen}
        onOpenChange={setReportOpen}
        targetType={isGroup ? 'group' : 'user'}
        targetId={isGroup ? conversation.id : (peerUid ?? conversation.id)}
        targetLabel={title}
      />
    </div>
  );
};
