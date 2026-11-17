import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useVirtualizer } from '@tanstack/react-virtual';
import {
  Archive,
  BellOff,
  BellRing,
  CheckCheck,
  MessageSquarePlus,
  Pin,
  PinOff,
  Trash2,
  Users,
  Ban,
  MailOpen,
} from 'lucide-react';
import { formatChatListTime } from '@/i18n';
import {
  Avatar,
  Badge,
  ChatListSkeleton,
  ConfirmDialog,
  ContextMenu,
  EmptyState,
  ErrorState,
  IconButton,
  SearchField,
  toast,
  type MenuItemConfig,
} from '@/components/ui';
import { en } from '@/i18n';
import { mapFirebaseError } from '@/lib/errors';
import { searchLocalMessages, type LocalSearchHit } from '@/lib/search-index';
import { useAuthStore } from '@/features/auth';
import { blockUser } from '@/features/privacy';
import {
  archiveConversation,
  clearConversationForMe,
  deleteConversationForMe,
  markConversationRead,
  markConversationUnread,
  muteConversation,
  pinConversation,
} from './conversations.service';
import type { HydratedConversationItem } from './useConversations';

export type ChatFilterChip = 'all' | 'unread' | 'groups' | 'archived';

export interface ConversationListProps {
  items: HydratedConversationItem[];
  loading: boolean;
  error: string | null;
  activeConversationId?: string;
  onNewChat: () => void;
  onNewGroup: () => void;
}

function formatRowTime(ms: number): string {
  if (!ms) return '';
  return formatChatListTime(new Date(ms));
}

export const ConversationList: React.FC<ConversationListProps> = ({
  items,
  loading,
  error,
  activeConversationId,
  onNewChat,
  onNewGroup,
}) => {
  const uid = useAuthStore((s) => s.authUser?.uid ?? null);
  const navigate = useNavigate();

  const [filter, setFilter] = useState<ChatFilterChip>('all');
  const [queryText, setQueryText] = useState('');
  const [localHits, setLocalHits] = useState<LocalSearchHit[]>([]);
  const [confirmClearId, setConfirmClearId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const scrollParentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const trimmed = queryText.trim();
    if (!uid || trimmed.length < 2) {
      setLocalHits([]);
      return;
    }
    let active = true;
    const handle = window.setTimeout(() => {
      void searchLocalMessages(uid, trimmed).then((hits) => {
        if (active) setLocalHits(hits);
      });
    }, 180);
    return () => {
      active = false;
      window.clearTimeout(handle);
    };
  }, [uid, queryText]);

  const filtered = useMemo(() => {
    const q = queryText.trim().toLowerCase();
    return items.filter((item) => {
      if (filter === 'archived') {
        if (!item.isArchived) return false;
      } else {
        if (item.isArchived) return false;
        if (filter === 'unread' && item.unreadTotal === 0) return false;
        if (filter === 'groups' && item.conversation.type !== 'group') return false;
      }
      if (!q) return true;
      return (
        item.title.toLowerCase().includes(q) ||
        (item.conversation.lastMessage?.textPreview.toLowerCase().includes(q) ?? false)
      );
    });
  }, [items, filter, queryText]);

  const rowVirtualizer = useVirtualizer({
    count: filtered.length,
    getScrollElement: () => scrollParentRef.current,
    estimateSize: () => 74,
    overscan: 8,
  });

  const buildRowMenu = (item: HydratedConversationItem): MenuItemConfig[] => {
    if (!uid) return [];
    const actions: MenuItemConfig[] = [
      {
        label: item.isPinned ? 'Unpin chat' : 'Pin chat',
        icon: item.isPinned ? <PinOff className="h-4 w-4" /> : <Pin className="h-4 w-4" />,
        onSelect: () =>
          void pinConversation(uid, item.id, !item.isPinned).catch((e) =>
            toast.error(mapFirebaseError(e).userMessage),
          ),
      },
      {
        label: item.isArchived ? 'Unarchive chat' : 'Archive chat',
        icon: <Archive className="h-4 w-4" />,
        onSelect: () =>
          void archiveConversation(uid, item.id, !item.isArchived).catch((e) =>
            toast.error(mapFirebaseError(e).userMessage),
          ),
      },
      {
        label: item.isMuted ? 'Unmute notifications' : 'Mute for 8 hours',
        icon: item.isMuted ? <BellRing className="h-4 w-4" /> : <BellOff className="h-4 w-4" />,
        onSelect: () =>
          void muteConversation(uid, item.id, item.isMuted ? null : 8 * 3600 * 1000).catch((e) =>
            toast.error(mapFirebaseError(e).userMessage),
          ),
      },
      {
        label: item.unreadTotal > 0 ? 'Mark as read' : 'Mark as unread',
        icon: item.unreadTotal > 0 ? <CheckCheck className="h-4 w-4" /> : <MailOpen className="h-4 w-4" />,
        onSelect: () =>
          void (item.unreadTotal > 0
            ? markConversationRead(uid, item.id)
            : markConversationUnread(uid, item.id)
          ).catch((e) => toast.error(mapFirebaseError(e).userMessage)),
      },
      {
        label: 'Clear chat',
        icon: <Trash2 className="h-4 w-4" />,
        onSelect: () => setConfirmClearId(item.id),
      },
      {
        label: 'Delete for me',
        icon: <Trash2 className="h-4 w-4" />,
        destructive: true,
        onSelect: () => setConfirmDeleteId(item.id),
      },
    ];
    if (item.peerUid) {
      actions.push({
        label: 'Block contact',
        icon: <Ban className="h-4 w-4" />,
        destructive: true,
        onSelect: () =>
          void blockUser(uid, item.peerUid!)
            .then(() => toast.success(`Blocked ${item.title}.`))
            .catch((e) => toast.error(mapFirebaseError(e).userMessage)),
      });
    }
    return actions;
  };

  return (
    <div className="flex h-full flex-col bg-surface-raised">
      <div className="px-4 pt-3 pb-2.5 space-y-3">
        <div className="flex items-center justify-between">
          <h1 className="text-[22px] font-bold tracking-tight text-accent dark:text-text-primary">
            WhatsApp
          </h1>
          <div className="flex items-center gap-1">
            <IconButton label="New group" onClick={onNewGroup} size="sm">
              <Users className="h-5 w-5" />
            </IconButton>
            <IconButton label={en.nav.newChat} onClick={onNewChat} size="sm">
              <MessageSquarePlus className="h-5 w-5" />
            </IconButton>
          </div>
        </div>

        <SearchField
          value={queryText}
          onChange={setQueryText}
          onClear={() => setQueryText('')}
          placeholder={en.chats.searchPlaceholder}
        />

        {queryText.trim().length > 0 && (
          <p className="text-[11px] text-text-tertiary">{en.chats.searchScopeNotice}</p>
        )}

        <div className="flex items-center gap-2 overflow-x-auto pb-0.5">
          {(
            [
              ['all', 'All'],
              ['unread', 'Unread'],
              ['groups', 'Groups'],
              ['archived', 'Archived'],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => setFilter(key)}
              className={`rounded-full px-3 py-1 text-xs font-medium whitespace-nowrap transition-colors ${
                filter === key
                  ? 'bg-[#E7FCE3] text-[#008069] dark:bg-[#0A332C] dark:text-[#00A884]'
                  : 'bg-surface-sunken text-text-secondary hover:bg-border/70'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div ref={scrollParentRef} className="min-h-0 flex-1 overflow-y-auto px-1.5 py-1">
        {loading ? (
          <ChatListSkeleton rows={6} />
        ) : error ? (
          <ErrorState title="Unable to load chats" description={error} />
        ) : filtered.length === 0 && localHits.length === 0 ? (
          <EmptyState
            title={filter === 'archived' ? 'No archived chats' : en.chats.emptyTitle}
            description={
              queryText.trim()
                ? 'No matching conversations or synced messages found on this device.'
                : en.chats.emptyDescription
            }
          />
        ) : (
          <>
            {filtered.length > 0 && (
              <div
                style={{
                  height: `${rowVirtualizer.getTotalSize()}px`,
                  width: '100%',
                  position: 'relative',
                }}
              >
                {rowVirtualizer.getVirtualItems().map((vItem) => {
                  const item = filtered[vItem.index];
                  if (!item) return null;
                  const active = item.id === activeConversationId;
                  const lastText = item.conversation.lastMessage?.textPreview ?? 'No messages yet';
                  const sentByMe = Boolean(uid && item.conversation.lastMessage?.senderId === uid);
                  return (
                    <div
                      key={item.id}
                      style={{
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        width: '100%',
                        height: `${vItem.size}px`,
                        transform: `translateY(${vItem.start}px)`,
                      }}
                    >
                      <ContextMenu items={buildRowMenu(item)}>
                        <button
                          type="button"
                          onClick={() => navigate(`/chats/${item.id}`)}
                          className={`flex h-[72px] w-full items-center gap-3 rounded-xl px-3 text-left transition-colors ${
                            active ? 'bg-surface-sunken' : 'hover:bg-surface-sunken/60'
                          }`}
                        >
                          <Avatar src={item.photoURL} name={item.title} size="lg" />
                          <div className="flex h-full min-w-0 flex-1 flex-col justify-center border-b border-border/60">
                            <div className="flex items-center justify-between gap-2">
                              <span className="truncate text-[15px] font-medium text-text-primary">
                                {item.title}
                              </span>
                              <span
                                className={`shrink-0 text-[11px] tabular-nums ${
                                  item.unreadTotal > 0
                                    ? 'font-semibold text-brand'
                                    : 'text-text-tertiary'
                                }`}
                              >
                                {formatRowTime(item.sortTimestampMs)}
                              </span>
                            </div>
                            <div className="mt-0.5 flex items-center justify-between gap-2">
                              <span className="flex min-w-0 items-center gap-1 truncate text-[13px] text-text-secondary">
                                {sentByMe && (
                                  <CheckCheck
                                    className="h-3.5 w-3.5 shrink-0 text-text-tertiary"
                                    aria-hidden="true"
                                  />
                                )}
                                <span className="truncate">{lastText}</span>
                              </span>
                              <div className="flex items-center gap-1.5 shrink-0">
                                {item.isPinned && (
                                  <Pin className="h-3.5 w-3.5 text-text-tertiary" aria-label="Pinned" />
                                )}
                                {item.isMuted && (
                                  <BellOff className="h-3.5 w-3.5 text-text-tertiary" aria-label="Muted" />
                                )}
                                {item.unreadTotal > 0 && (
                                  <Badge count={item.unreadTotal} muted={item.isMuted} />
                                )}
                              </div>
                            </div>
                          </div>
                        </button>
                      </ContextMenu>
                    </div>
                  );
                })}
              </div>
            )}

            {localHits.length > 0 && (
              <div className="mt-4 space-y-1 border-t border-border pt-3">
                <p className="px-2 text-[11px] font-semibold uppercase tracking-wide text-text-tertiary">
                  Synced Messages ({localHits.length})
                </p>
                {localHits.map((hit) => {
                  const conv = items.find((i) => i.id === hit.cid);
                  return (
                    <button
                      key={`${hit.cid}:${hit.mid}`}
                      type="button"
                      onClick={() => navigate(`/chats/${hit.cid}?highlight=${hit.mid}`)}
                      className="flex w-full flex-col rounded-xl px-3 py-2 text-left hover:bg-surface-muted"
                    >
                      <span className="text-xs font-semibold text-text-primary">
                        {conv?.title ?? 'Conversation'}
                      </span>
                      <span className="truncate text-xs text-text-secondary">{hit.text}</span>
                    </button>
                  );
                })}
              </div>
            )}
          </>
        )}
      </div>

      <ConfirmDialog
        open={Boolean(confirmClearId)}
        onOpenChange={(o) => !o && setConfirmClearId(null)}
        title="Clear chat on this account?"
        description="Messages older than now will be hidden from your view. Other participants still keep their copy."
        confirmLabel="Clear chat"
        destructive
        onConfirm={async () => {
          if (!uid || !confirmClearId) return;
          await clearConversationForMe(uid, confirmClearId);
          toast.success('Chat cleared.');
          setConfirmClearId(null);
        }}
      />

      <ConfirmDialog
        open={Boolean(confirmDeleteId)}
        onOpenChange={(o) => !o && setConfirmDeleteId(null)}
        title="Delete conversation for me?"
        description="This clears your message history and archives this conversation."
        confirmLabel="Delete for me"
        destructive
        onConfirm={async () => {
          if (!uid || !confirmDeleteId) return;
          await deleteConversationForMe(uid, confirmDeleteId);
          toast.success('Conversation deleted for your view.');
          if (activeConversationId === confirmDeleteId) navigate('/chats');
          setConfirmDeleteId(null);
        }}
      />
    </div>
  );
};
