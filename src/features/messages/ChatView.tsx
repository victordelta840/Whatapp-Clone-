import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowDown,
  ArrowLeft,
  Forward,
  Info,
  Pause,
  Phone,
  Play,
  Search,
  Trash2,
  Video,
  X,
} from 'lucide-react';
import {
  Avatar,
  Button,
  EmptyState,
  ErrorState,
  IconButton,
  MediaViewer,
  SearchField,
  Spinner,
  toast,
  type MediaViewerItem,
} from '@/components/ui';
import { LIMITS } from '@/config/constants';
import { mapFirebaseError } from '@/lib/errors';
import {
  cancelUpload,
  pauseUpload,
  registerUploadCompletionHandler,
  resumeUpload,
  useUploadOutboxStore,
} from '@/lib/media/uploadOutbox';
import { isTrustedVerifiedUser, useAuthStore } from '@/features/auth';
import { startOutgoingCall } from '@/features/calls';
import { hideMessageForMe, type HydratedConversationItem } from '@/features/conversations';
import { useUserPresence } from '@/features/presence';
import { fetchUserSummary, type HydratedUserSummary } from '@/features/profile';
import type { Message } from '@/types';
import { ForwardDialog } from './ForwardDialog';
import { MessageBubble } from './MessageBubble';
import { MessageComposer } from './MessageComposer';
import { MessageInfoDialog } from './MessageInfoDialog';
import {
  canDeleteForEveryone,
  canEditMessage,
  computeReceiptState,
  deleteMessageForEveryone,
  editMessageText,
  sendMessageBatched,
  toggleMessageReaction,
} from './messages.service';
import { useMessages } from './useMessages';

export interface ChatViewProps {
  item: HydratedConversationItem;
  peerProfiles: Record<string, HydratedUserSummary>;
  highlightMessageId?: string | null;
  onToggleInfo: () => void;
  onProvideContext?: (ctx: {
    members: ReturnType<typeof useMessages>['members'];
    messages: ReturnType<typeof useMessages>['messages'];
    profiles: Record<string, HydratedUserSummary>;
  }) => void;
}

export const ChatView: React.FC<ChatViewProps> = ({
  item,
  peerProfiles,
  highlightMessageId,
  onToggleInfo,
  onProvideContext,
}) => {
  const authUser = useAuthStore((s) => s.authUser);
  const uid = authUser?.uid ?? '';
  const myReadReceipts = useAuthStore((s) => s.settings?.privacy.readReceipts ?? true);
  const navigate = useNavigate();

  const clearedAtMs = item.chatState?.clearedAt?.toMillis?.() ?? 0;
  const { messages, members, typingUids, loading, loadingOlder, hasMore, error, loadOlder } =
    useMessages(item.id, item.conversation.type, clearedAtMs);

  const [extraProfiles, setExtraProfiles] = useState<Record<string, HydratedUserSummary>>({});
  const profiles = useMemo(
    () => ({ ...peerProfiles, ...extraProfiles }),
    [peerProfiles, extraProfiles],
  );
  const [replyTo, setReplyTo] = useState<(Message & { id: string }) | null>(null);
  const [editingMsg, setEditingMsg] = useState<(Message & { id: string }) | null>(null);
  const [infoMsg, setInfoMsg] = useState<(Message & { id: string }) | null>(null);
  const [forwardIds, setForwardIds] = useState<string[] | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [searchOpen, setSearchOpen] = useState(false);
  const [inChatQuery, setInChatQuery] = useState('');
  const [showScrollBottom, setShowScrollBottom] = useState(false);
  const [viewerItems, setViewerItems] = useState<MediaViewerItem[]>([]);
  const [viewerOpen, setViewerOpen] = useState(false);

  const scrollerRef = useRef<HTMLDivElement | null>(null);
  const prevHeightRef = useRef<number>(0);
  const showScrollBottomRef = useRef(false);
  const requestedProfileUidsRef = useRef<Set<string>>(new Set(Object.keys(peerProfiles)));

  const outboxEntries = useUploadOutboxStore((s) => s.entries);
  const activeUploads = useMemo(
    () => Object.values(outboxEntries).filter((e) => e.cid === item.id),
    [outboxEntries, item.id],
  );

  const presence = useUserPresence(item.peerUid);

  useEffect(() => {
    registerUploadCompletionHandler(async (entry, media) => {
      await sendMessageBatched({
        cid: entry.cid,
        senderId: entry.uid,
        type: entry.kind,
        text: entry.caption ? entry.caption : null,
        media,
        replyTo: entry.replyTo,
        clientMessageId: entry.id,
      });
    });
  }, []);

  useEffect(() => {
    Object.keys(peerProfiles).forEach((pid) => requestedProfileUidsRef.current.add(pid));
    const missing = item.conversation.participantIds.filter(
      (pid) => !requestedProfileUidsRef.current.has(pid),
    );
    if (missing.length === 0) return;
    missing.forEach((pid) => requestedProfileUidsRef.current.add(pid));
    let active = true;
    Promise.all(missing.map((pid) => fetchUserSummary(pid))).then((loaded) => {
      if (!active) return;
      setExtraProfiles((prev) => {
        const next = { ...prev };
        loaded.forEach((p) => {
          next[p.uid] = p;
        });
        return next;
      });
    });
    return () => {
      active = false;
    };
  }, [item.conversation.participantIds, peerProfiles]);

  useEffect(() => {
    onProvideContext?.({ members, messages, profiles });
  }, [members, messages, profiles, onProvideContext]);

  // Preserve scroll position when loading older messages; otherwise scroll to bottom on new chat
  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;
    if (prevHeightRef.current > 0) {
      const delta = el.scrollHeight - prevHeightRef.current;
      el.scrollTop += delta;
      prevHeightRef.current = 0;
    } else if (!showScrollBottomRef.current) {
      el.scrollTop = el.scrollHeight;
    }
  }, [messages.length, item.id]);

  useEffect(() => {
    if (!highlightMessageId) return;
    const node = document.getElementById(`msg-${highlightMessageId}`);
    node?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, [highlightMessageId, messages.length]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setReplyTo(null);
        setEditingMsg(null);
        setSelectedIds([]);
        setSearchOpen(false);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  const visibleMessages = useMemo(() => {
    const q = inChatQuery.trim().toLowerCase();
    if (!q) return messages;
    return messages.filter((m) => m.text?.toLowerCase().includes(q));
  }, [messages, inChatQuery]);

  const lastOwnEditableMessage = useMemo(() => {
    for (let i = messages.length - 1; i >= 0; i--) {
      const m = messages[i];
      if (m && canEditMessage(m, uid)) return m;
    }
    return null;
  }, [messages, uid]);

  const myMember = members.find((m) => m.uid === uid);
  const isGroup = item.conversation.type === 'group';
  const verified = isTrustedVerifiedUser(authUser);
  const adminsOnlyBlocked =
    isGroup &&
    item.conversation.group?.settings.sendMessages === 'adminsOnly' &&
    myMember?.role !== 'owner' &&
    myMember?.role !== 'admin';

  const composerDisabled = !verified || adminsOnlyBlocked;
  const disabledReason = !verified
    ? 'Verify your email address to send messages.'
    : adminsOnlyBlocked
      ? 'Only group admins can send messages in this group.'
      : undefined;

  const typingText =
    typingUids.length > 0
      ? typingUids.length === 1
        ? `${profiles[typingUids[0]!]?.profile?.displayName || 'Someone'} is typing...`
        : 'Several people are typing...'
      : null;

  const subtitle = typingText
    ? typingText
    : isGroup
      ? `${item.conversation.group?.memberCount ?? members.length} members`
      : presence.online
        ? 'online'
        : presence.label || 'Direct conversation';

  const mentionOptions = useMemo(
    () =>
      item.conversation.participantIds
        .filter((pid) => pid !== uid)
        .map((pid) => ({
          uid: pid,
          displayName: profiles[pid]?.profile?.displayName || 'Member',
          username: profiles[pid]?.profile?.username ?? null,
        })),
    [item.conversation.participantIds, uid, profiles],
  );

  const handleLoadOlder = () => {
    if (scrollerRef.current) {
      prevHeightRef.current = scrollerRef.current.scrollHeight;
    }
    void loadOlder();
  };

  return (
    <div className="flex h-full min-h-0 flex-col bg-surface">
      <header className="flex items-center justify-between gap-2 border-b border-border bg-surface-sunken px-3 py-2.5">
        <div className="flex min-w-0 items-center gap-2.5">
          <div className="md:hidden">
            <IconButton label="Back to chats" onClick={() => navigate('/chats')} size="sm">
              <ArrowLeft className="h-5 w-5" />
            </IconButton>
          </div>
          <button
            type="button"
            onClick={onToggleInfo}
            className="flex min-w-0 items-center gap-2.5 text-left"
          >
            <Avatar src={item.photoURL} name={item.title} size="md" online={presence.online} />
            <div className="min-w-0">
              <h2 className="truncate text-sm font-bold text-text-primary">{item.title}</h2>
              <p
                className={`truncate text-xs ${
                  typingText || presence.online ? 'text-brand font-medium' : 'text-text-secondary'
                }`}
              >
                {subtitle}
              </p>
            </div>
          </button>
        </div>

        <div className="flex items-center gap-1">
          {!isGroup && item.peerUid && verified && (
            <>
              <IconButton
                label="Audio call"
                onClick={() =>
                  void startOutgoingCall({
                    conversationId: item.id,
                    calleeId: item.peerUid!,
                    type: 'audio',
                  })
                }
              >
                <Phone className="h-4 w-4" />
              </IconButton>
              <IconButton
                label="Video call"
                onClick={() =>
                  void startOutgoingCall({
                    conversationId: item.id,
                    calleeId: item.peerUid!,
                    type: 'video',
                  })
                }
              >
                <Video className="h-4 w-4" />
              </IconButton>
            </>
          )}
          <IconButton label="Search in chat" onClick={() => setSearchOpen((o) => !o)}>
            <Search className="h-4 w-4" />
          </IconButton>
          <IconButton label="Conversation info" onClick={onToggleInfo}>
            <Info className="h-4 w-4" />
          </IconButton>
        </div>
      </header>

      {searchOpen && (
        <div className="flex items-center gap-2 border-b border-border bg-surface-muted px-3 py-2">
          <div className="flex-1">
            <SearchField
              value={inChatQuery}
              onChange={setInChatQuery}
              onClear={() => setInChatQuery('')}
              placeholder="Search loaded messages..."
            />
          </div>
          <IconButton label="Close search" size="sm" onClick={() => setSearchOpen(false)}>
            <X className="h-4 w-4" />
          </IconButton>
        </div>
      )}

      {selectedIds.length > 0 && (
        <div className="flex items-center justify-between border-b border-border bg-primary/10 px-4 py-2 text-xs">
          <span className="font-semibold text-primary">{selectedIds.length} selected</span>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="secondary"
              leftIcon={<Forward className="h-3.5 w-3.5" />}
              onClick={() => setForwardIds(selectedIds)}
            >
              Forward
            </Button>
            <Button
              size="sm"
              variant="danger"
              leftIcon={<Trash2 className="h-3.5 w-3.5" />}
              onClick={async () => {
                for (const mid of selectedIds) {
                  await hideMessageForMe(uid, item.id, mid);
                }
                setSelectedIds([]);
                toast.success('Hidden selected messages for your view.');
              }}
            >
              Delete for me
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setSelectedIds([])}>
              Cancel
            </Button>
          </div>
        </div>
      )}

      <div
        ref={scrollerRef}
        onScroll={(e) => {
          const el = e.currentTarget;
          const distFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
          const nextShow = distFromBottom > 180;
          showScrollBottomRef.current = nextShow;
          setShowScrollBottom(nextShow);
        }}
        className="wa-wallpaper relative min-h-0 flex-1 overflow-y-auto px-2 py-3 sm:px-6"
      >
        {hasMore && !loading && (
          <div className="mb-3 flex justify-center">
            <Button size="sm" variant="secondary" loading={loadingOlder} onClick={handleLoadOlder}>
              Load older messages
            </Button>
          </div>
        )}

        {loading ? (
          <div className="flex h-full items-center justify-center">
            <Spinner />
          </div>
        ) : error ? (
          <ErrorState title="Could not load messages" description={error} />
        ) : visibleMessages.length === 0 ? (
          <EmptyState
            title="Start the conversation"
            description="Messages sent here sync in real time across your devices."
          />
        ) : (
          <div className="space-y-0.5">
            {visibleMessages.map((msg, idx) => {
              const prev = visibleMessages[idx - 1];
              const msgDate = msg.createdAt?.toDate?.()?.toDateString();
              const prevDate = prev?.createdAt?.toDate?.()?.toDateString();
              const showDateDivider = msgDate && msgDate !== prevDate;
              const isOwn = msg.senderId === uid;
              const senderName =
                profiles[msg.senderId]?.profile?.displayName ?? (isOwn ? 'You' : 'Member');

              return (
                <React.Fragment key={msg.id}>
                  {showDateDivider && (
                    <div className="my-3 flex justify-center">
                      <span className="rounded-lg bg-surface-raised/95 px-3 py-1 text-[11px] font-medium text-text-secondary shadow-xs">
                        {msgDate}
                      </span>
                    </div>
                  )}
                  <MessageBubble
                    message={msg}
                    isOwn={isOwn}
                    isGroup={isGroup}
                    senderName={senderName}
                    receiptState={computeReceiptState({
                      message: msg,
                      myUid: uid,
                      conversationType: item.conversation.type,
                      members,
                      myReadReceiptsEnabled: myReadReceipts,
                    })}
                    myUid={uid}
                    canEdit={canEditMessage(msg, uid)}
                    canDeleteEveryone={canDeleteForEveryone(msg, uid)}
                    selectionMode={selectedIds.length > 0}
                    selected={selectedIds.includes(msg.id)}
                    highlighted={highlightMessageId === msg.id}
                    onToggleSelect={(mid) =>
                      setSelectedIds((prev) =>
                        prev.includes(mid) ? prev.filter((x) => x !== mid) : [...prev, mid],
                      )
                    }
                    onReply={(m) => {
                      setEditingMsg(null);
                      setReplyTo(m);
                    }}
                    onEdit={(m) => {
                      setReplyTo(null);
                      setEditingMsg(m);
                    }}
                    onForward={(m) => setForwardIds([m.id])}
                    onDeleteForMe={(mid) =>
                      void hideMessageForMe(uid, item.id, mid).catch((err) =>
                        toast.error(mapFirebaseError(err).userMessage),
                      )
                    }
                    onDeleteForEveryone={(mid) =>
                      void deleteMessageForEveryone(item.id, mid).catch((err) =>
                        toast.error(mapFirebaseError(err).userMessage),
                      )
                    }
                    onReact={(mid, emoji, curr) =>
                      void toggleMessageReaction(item.id, mid, uid, emoji, curr).catch((err) =>
                        toast.error(mapFirebaseError(err).userMessage),
                      )
                    }
                    onShowInfo={setInfoMsg}
                    onJumpToMessage={(mid) => {
                      document
                        .getElementById(`msg-${mid}`)
                        ?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    }}
                    onOpenMedia={(m, url) => {
                      if (!url) return;
                      setViewerItems([
                        {
                          id: m.id,
                          kind: m.type === 'video' ? 'video' : 'image',
                          url,
                          caption: m.text,
                          fileName: m.media?.fileName,
                        },
                      ]);
                      setViewerOpen(true);
                    }}
                  />
                </React.Fragment>
              );
            })}
          </div>
        )}

        {activeUploads.length > 0 && (
          <div className="mt-2 space-y-2 px-4">
            {activeUploads.map((up) => (
              <div
                key={up.id}
                className="ml-auto flex max-w-xs items-center justify-between gap-3 rounded-xl border border-border bg-surface-raised px-3 py-2 text-xs shadow-xs"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium text-text-primary">{up.fileName}</p>
                  <p className="text-[11px] text-text-secondary">
                    {up.status === 'failed'
                      ? up.errorMessage || 'Upload failed'
                      : `${up.status} · ${up.progress}%`}
                  </p>
                </div>
                <div className="flex items-center gap-1">
                  {up.status === 'uploading' ? (
                    <IconButton size="sm" label="Pause upload" onClick={() => pauseUpload(up.id)}>
                      <Pause className="h-3.5 w-3.5" />
                    </IconButton>
                  ) : (
                    <IconButton size="sm" label="Resume upload" onClick={() => resumeUpload(up.id)}>
                      <Play className="h-3.5 w-3.5" />
                    </IconButton>
                  )}
                  <IconButton
                    size="sm"
                    label="Cancel upload"
                    onClick={() => void cancelUpload(up.id)}
                  >
                    <X className="h-3.5 w-3.5 text-danger" />
                  </IconButton>
                </div>
              </div>
            ))}
          </div>
        )}

        {showScrollBottom && (
          <button
            type="button"
            onClick={() => {
              if (scrollerRef.current) {
                scrollerRef.current.scrollTo({
                  top: scrollerRef.current.scrollHeight,
                  behavior: 'smooth',
                });
              }
            }}
            aria-label="Scroll to latest messages"
            className="fixed bottom-24 right-6 z-20 flex h-10 w-10 items-center justify-center rounded-full border border-border bg-surface-raised text-text-secondary shadow-md hover:bg-surface-sunken"
          >
            <ArrowDown className="h-4 w-4" />
          </button>
        )}
      </div>

      <MessageComposer
        key={`${item.id}:${editingMsg?.id ?? 'compose'}`}
        cid={item.id}
        replyTo={replyTo}
        editingMessage={editingMsg}
        lastOwnEditableMessage={lastOwnEditableMessage}
        disabled={composerDisabled}
        disabledReason={disabledReason}
        isGroup={isGroup}
        mentionOptions={mentionOptions}
        onCancelReply={() => setReplyTo(null)}
        onCancelEdit={() => setEditingMsg(null)}
        onStartEditLast={() => lastOwnEditableMessage && setEditingMsg(lastOwnEditableMessage)}
        onSendText={async (text, mentions) => {
          await sendMessageBatched({
            cid: item.id,
            senderId: uid,
            type: 'text',
            text,
            mentions,
            replyTo: replyTo
              ? {
                  kind: 'message',
                  messageId: replyTo.id,
                  senderId: replyTo.senderId,
                  type: replyTo.type,
                  textPreview: (replyTo.text || replyTo.type).slice(0, LIMITS.TEXT_PREVIEW_MAX),
                }
              : null,
          });
          setReplyTo(null);
        }}
        onSaveEdit={async (mid, text) => {
          await editMessageText(item.id, mid, text);
          toast.success('Message edited.');
        }}
      />

      <ForwardDialog
        open={Boolean(forwardIds)}
        onOpenChange={(o) => !o && setForwardIds(null)}
        sourceConversationId={item.id}
        messageIds={forwardIds ?? []}
        onForwarded={() => setSelectedIds([])}
      />

      <MessageInfoDialog
        message={infoMsg}
        onOpenChange={(o) => !o && setInfoMsg(null)}
        members={members}
        profiles={profiles}
        myUid={uid}
      />

      <MediaViewer open={viewerOpen} onOpenChange={setViewerOpen} items={viewerItems} />
    </div>
  );
};
