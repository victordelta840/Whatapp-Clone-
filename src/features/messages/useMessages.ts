import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  startAfter,
  type QueryDocumentSnapshot,
} from 'firebase/firestore';
import { PAGINATION, WINDOWS } from '@/config/constants';
import { refs } from '@/config/refs';
import { indexMessagesLocally } from '@/lib/search-index';
import { useAuthStore } from '@/features/auth';
import type { ConversationMember, Message } from '@/types';
import { updateDeliveryHighWater, updateReadHighWater } from './messages.service';

export function useMessages(
  cid: string | undefined,
  conversationType: 'direct' | 'group',
  clearedAtMs: number,
) {
  const uid = useAuthStore((s) => s.authUser?.uid ?? null);
  const myReadReceipts = useAuthStore((s) => s.settings?.privacy.readReceipts ?? true);
  const scopeKey = cid && uid ? `${uid}:${cid}` : '';

  const [liveState, setLiveState] = useState<{
    key: string;
    rows: Array<Message & { id: string }>;
    lastDoc: QueryDocumentSnapshot<Message> | null;
    hasMore: boolean;
    error: string | null;
  } | null>(null);

  const [olderState, setOlderState] = useState<{
    key: string;
    rows: Array<Message & { id: string }>;
    oldestDoc: QueryDocumentSnapshot<Message> | null;
    hasMore: boolean;
  } | null>(null);

  const [loadingOlder, setLoadingOlder] = useState(false);

  const [hiddenState, setHiddenState] = useState<{
    key: string;
    ids: Set<string>;
  } | null>(null);

  const [membersState, setMembersState] = useState<{
    key: string;
    rows: Array<ConversationMember & { uid: string }>;
  } | null>(null);

  const [typingState, setTypingState] = useState<{
    key: string;
    uids: string[];
  } | null>(null);

  useEffect(() => {
    if (!cid || !uid || !scopeKey) return;

    const msgsQuery = query(
      refs.messagesCol(cid),
      orderBy('createdAt', 'desc'),
      limit(PAGINATION.MESSAGES_PAGE_SIZE),
    );

    const unsubMsgs = onSnapshot(
      msgsQuery,
      { includeMetadataChanges: true },
      (snap) => {
        const rows = snap.docs
          .map((d) => ({
            ...d.data(),
            id: d.id,
            hasPendingWrites: d.metadata.hasPendingWrites,
            fromCache: d.metadata.fromCache,
          }))
          .reverse();
        const lastDoc = snap.docs[snap.docs.length - 1] ?? null;
        setLiveState({
          key: scopeKey,
          rows,
          lastDoc,
          hasMore: snap.docs.length >= PAGINATION.MESSAGES_PAGE_SIZE,
          error: null,
        });

        void indexMessagesLocally(uid, cid, rows);
      },
      (err) => {
        setLiveState({
          key: scopeKey,
          rows: [],
          lastDoc: null,
          hasMore: false,
          error: err.message,
        });
      },
    );

    const unsubHidden = onSnapshot(
      refs.hiddenMessagesCol(uid, cid),
      (snap) => {
        setHiddenState({ key: scopeKey, ids: new Set(snap.docs.map((d) => d.id)) });
      },
      () => undefined,
    );

    const unsubMembers = onSnapshot(
      refs.membersCol(cid),
      (snap) => {
        setMembersState({
          key: scopeKey,
          rows: snap.docs.map((d) => ({ ...d.data(), uid: d.id })),
        });
      },
      () => undefined,
    );

    const unsubTyping = onSnapshot(
      refs.typingCol(cid),
      (snap) => {
        const now = Date.now();
        const activeTypers = snap.docs
          .filter((d) => d.id !== uid)
          .filter((d) => {
            const ts = d.data()?.updatedAt?.toMillis?.() ?? 0;
            return now - ts <= WINDOWS.TYPING_EXPIRY_MS;
          })
          .map((d) => d.id);
        setTypingState({ key: scopeKey, uids: activeTypers });
      },
      () => undefined,
    );

    return () => {
      unsubMsgs();
      unsubHidden();
      unsubMembers();
      unsubTyping();
    };
  }, [cid, uid, scopeKey]);

  const liveMessages = useMemo(
    () => (liveState?.key === scopeKey ? liveState.rows : []),
    [liveState, scopeKey],
  );
  const olderMessages = useMemo(
    () => (olderState?.key === scopeKey ? olderState.rows : []),
    [olderState, scopeKey],
  );
  const hiddenIds = useMemo(
    () => (hiddenState?.key === scopeKey ? hiddenState.ids : new Set<string>()),
    [hiddenState, scopeKey],
  );
  const members = useMemo(
    () => (membersState?.key === scopeKey ? membersState.rows : []),
    [membersState, scopeKey],
  );
  const typingUids = useMemo(
    () => (typingState?.key === scopeKey ? typingState.uids : []),
    [typingState, scopeKey],
  );

  const lastLiveDoc = liveState?.key === scopeKey ? liveState.lastDoc : null;
  const oldestDoc = olderState?.key === scopeKey ? olderState.oldestDoc : null;
  const hasMore =
    (liveState?.key === scopeKey ? liveState.hasMore : true) &&
    (olderState?.key === scopeKey ? olderState.hasMore : true);
  const loading = Boolean(scopeKey) && liveState?.key !== scopeKey;
  const error = liveState?.key === scopeKey ? liveState.error : null;

  const loadOlder = useCallback(async () => {
    if (!cid || !uid || !scopeKey || loadingOlder || !hasMore) return;
    const cursor = oldestDoc ?? lastLiveDoc;
    if (!cursor) {
      setOlderState((prev) => ({
        key: scopeKey,
        rows: prev?.key === scopeKey ? prev.rows : [],
        oldestDoc: null,
        hasMore: false,
      }));
      return;
    }
    setLoadingOlder(true);
    try {
      const q = query(
        refs.messagesCol(cid),
        orderBy('createdAt', 'desc'),
        startAfter(cursor),
        limit(PAGINATION.MESSAGES_PAGE_SIZE),
      );
      const snap = await getDocs(q);
      const rows = snap.docs.map((d) => ({ ...d.data(), id: d.id })).reverse();
      setOlderState((prev) => {
        const baseRows = prev?.key === scopeKey ? prev.rows : [];
        return {
          key: scopeKey,
          rows: rows.length > 0 ? [...rows, ...baseRows] : baseRows,
          oldestDoc: snap.docs[snap.docs.length - 1] ?? (prev?.key === scopeKey ? prev.oldestDoc : null),
          hasMore: snap.docs.length >= PAGINATION.MESSAGES_PAGE_SIZE,
        };
      });
      if (rows.length > 0) {
        void indexMessagesLocally(uid, cid, rows);
      }
    } finally {
      setLoadingOlder(false);
    }
  }, [cid, uid, scopeKey, loadingOlder, hasMore, oldestDoc, lastLiveDoc]);

  const messages = useMemo(() => {
    const mergedMap = new Map<string, Message & { id: string }>();
    for (const m of olderMessages) mergedMap.set(m.id, m);
    for (const m of liveMessages) mergedMap.set(m.id, m);
    return Array.from(mergedMap.values()).filter((m) => {
      if (hiddenIds.has(m.id)) return false;
      const ms = m.createdAt?.toMillis?.() ?? Number.MAX_SAFE_INTEGER;
      if (clearedAtMs > 0 && ms <= clearedAtMs) return false;
      return true;
    });
  }, [olderMessages, liveMessages, hiddenIds, clearedAtMs]);

  // High-water mark delivery + read acknowledgement when chat is visible
  useEffect(() => {
    if (!cid || !uid || liveMessages.length === 0) return;
    const latest = liveMessages[liveMessages.length - 1];
    if (!latest?.createdAt || latest.hasPendingWrites) return;
    if (latest.senderId === uid) return;

    const myMember = members.find((m) => m.uid === uid);
    if (!myMember) return;

    const latestMs = latest.createdAt.toMillis?.() ?? 0;
    const deliveredMs = myMember.lastDeliveredAt?.toMillis?.() ?? 0;
    const readMs = myMember.lastReadAt?.toMillis?.() ?? 0;

    if (latestMs > deliveredMs) {
      void updateDeliveryHighWater(cid, uid, latest.createdAt).catch(() => undefined);
    }

    const canSendRead = conversationType === 'group' || myReadReceipts;
    if (
      canSendRead &&
      document.visibilityState === 'visible' &&
      latestMs > readMs
    ) {
      void updateReadHighWater(cid, uid, latest.id, latest.createdAt).catch(() => undefined);
    }
  }, [cid, uid, liveMessages, members, conversationType, myReadReceipts]);

  return {
    messages,
    members,
    typingUids,
    loading,
    loadingOlder,
    hasMore,
    error,
    loadOlder,
  };
}
