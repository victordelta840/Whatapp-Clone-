import { useEffect, useMemo, useState } from 'react';
import { limit, onSnapshot, orderBy, query, where } from 'firebase/firestore';
import { PAGINATION } from '@/config/constants';
import { refs } from '@/config/refs';
import { useAuthStore } from '@/features/auth';
import { fetchUserSummary, type HydratedUserSummary } from '@/features/profile';
import type { ChatState, Conversation } from '@/types';

export interface HydratedConversationItem {
  id: string;
  conversation: Conversation;
  chatState: ChatState | null;
  title: string;
  photoURL: string | null;
  peerUid: string | null;
  unreadTotal: number;
  isMuted: boolean;
  isPinned: boolean;
  isArchived: boolean;
  sortTimestampMs: number;
}

export function useConversations() {
  const uid = useAuthStore((s) => s.authUser?.uid ?? null);
  const [conversations, setConversations] = useState<Array<Conversation & { id: string }>>([]);
  const [chatStates, setChatStates] = useState<Record<string, ChatState>>({});
  const [peerProfiles, setPeerProfiles] = useState<Record<string, HydratedUserSummary>>({});
  const [loading, setLoading] = useState(Boolean(uid));
  const [error, setError] = useState<string | null>(null);
  const [nowMs, setNowMs] = useState(() => Date.now());

  useEffect(() => {
    const id = window.setInterval(() => setNowMs(Date.now()), 30000);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    if (!uid) {
      return;
    }

    const convQuery = query(
      refs.conversationsCol(),
      where('participantIds', 'array-contains', uid),
      orderBy('updatedAt', 'desc'),
      limit(PAGINATION.CONVERSATIONS_PAGE_SIZE),
    );

    const unsubConvs = onSnapshot(
      convQuery,
      (snap) => {
        setConversations(snap.docs.map((d) => ({ ...d.data(), id: d.id })));
        setLoading(false);
        setError(null);
      },
      (err) => {
        setError(err.message);
        setLoading(false);
      },
    );

    const statesQuery = query(refs.chatStatesCol(uid), limit(PAGINATION.CHAT_STATES_LIMIT));
    const unsubStates = onSnapshot(
      statesQuery,
      (snap) => {
        const next: Record<string, ChatState> = {};
        snap.docs.forEach((d) => {
          next[d.id] = { ...d.data(), id: d.id };
        });
        setChatStates(next);
      },
      () => undefined,
    );

    return () => {
      unsubConvs();
      unsubStates();
    };
  }, [uid]);

  useEffect(() => {
    if (!uid || conversations.length === 0) return;
    const peerIds = Array.from(
      new Set(
        conversations
          .filter((c) => c.type === 'direct')
          .map((c) => c.participantIds.find((p) => p !== uid))
          .filter((id): id is string => Boolean(id)),
      ),
    );
    if (peerIds.length === 0) return;

    let active = true;
    Promise.all(peerIds.map((pid) => fetchUserSummary(pid))).then((summaries) => {
      if (!active) return;
      setPeerProfiles((prev) => {
        const next = { ...prev };
        summaries.forEach((s) => {
          next[s.uid] = s;
        });
        return next;
      });
    });

    return () => {
      active = false;
    };
  }, [uid, conversations]);

  const items = useMemo<HydratedConversationItem[]>(() => {
    if (!uid) return [];
    return conversations
      .map((conv) => {
        const state = chatStates[conv.id] ?? null;
        const peerUid =
          conv.type === 'direct' ? (conv.participantIds.find((p) => p !== uid) ?? null) : null;
        const peer = peerUid ? peerProfiles[peerUid] : undefined;
        const title =
          conv.type === 'group'
            ? conv.group?.name || 'Group'
            : peer?.profile?.displayName || 'WhatsApp User';
        const photoURL =
          conv.type === 'group' ? (conv.group?.photoURL ?? null) : (peer?.photoURL ?? null);

        const mutedUntilMs = state?.mutedUntil?.toMillis?.() ?? 0;
        const isMuted = mutedUntilMs > nowMs;
        const unreadTotal = (state?.unreadCount ?? 0) + (state?.markedUnread && (state?.unreadCount ?? 0) === 0 ? 1 : 0);
        const sortTimestampMs =
          conv.lastMessageAt?.toMillis?.() ??
          conv.updatedAt?.toMillis?.() ??
          conv.createdAt?.toMillis?.() ??
          0;

        return {
          id: conv.id,
          conversation: conv,
          chatState: state,
          title,
          photoURL,
          peerUid,
          unreadTotal,
          isMuted,
          isPinned: Boolean(state?.pinned),
          isArchived: Boolean(state?.archived),
          sortTimestampMs,
        };
      })
      .sort((a, b) => {
        if (a.isPinned !== b.isPinned) return a.isPinned ? -1 : 1;
        return b.sortTimestampMs - a.sortTimestampMs;
      });
  }, [uid, conversations, chatStates, peerProfiles, nowMs]);

  const totalUnreadCount = useMemo(
    () =>
      items.reduce(
        (sum, item) => sum + (!item.isArchived && !item.isMuted ? item.unreadTotal : 0),
        0,
      ),
    [items],
  );

  return {
    items,
    peerProfiles,
    totalUnreadCount,
    loading: uid ? loading : false,
    error: uid ? error : null,
  };
}
