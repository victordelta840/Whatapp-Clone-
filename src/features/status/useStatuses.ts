import { useEffect, useMemo, useState } from 'react';
import { Timestamp, onSnapshot, orderBy, query, where } from 'firebase/firestore';
import { refs } from '@/config/refs';
import { useAuthStore } from '@/features/auth';
import { fetchUserSummary, type HydratedUserSummary } from '@/features/profile';
import type { StatusUpdate } from '@/types';

export interface GroupedStatusAuthor {
  authorUid: string;
  authorName: string;
  authorPhotoURL: string | null;
  statuses: Array<StatusUpdate & { id: string }>;
  allViewed: boolean;
  muted: boolean;
}

export function useStatuses() {
  const uid = useAuthStore((s) => s.authUser?.uid ?? null);
  const mutedAuthors = useAuthStore((s) => s.settings?.mutedStatusAuthors ?? []);

  const [ownStatuses, setOwnStatuses] = useState<Array<StatusUpdate & { id: string }>>([]);
  const [contactStatuses, setContactStatuses] = useState<Array<StatusUpdate & { id: string }>>([]);
  const [viewedIds, setViewedIds] = useState<Set<string>>(new Set());
  const [profiles, setProfiles] = useState<Record<string, HydratedUserSummary>>({});
  const [loading, setLoading] = useState(Boolean(uid));
  const [nowMs, setNowMs] = useState(() => Date.now());

  useEffect(() => {
    const id = window.setInterval(() => setNowMs(Date.now()), 30000);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    if (!uid) {
      return;
    }

    const nowTs = Timestamp.now();
    const ownQuery = query(
      refs.statusesCol(),
      where('authorId', '==', uid),
      where('expiresAt', '>', nowTs),
      orderBy('expiresAt', 'asc'),
    );
    const contactQuery = query(
      refs.statusesCol(),
      where('viewerIds', 'array-contains', uid),
      where('expiresAt', '>', nowTs),
      orderBy('expiresAt', 'asc'),
    );

    const unsubOwn = onSnapshot(
      ownQuery,
      (snap) => {
        setOwnStatuses(snap.docs.map((d) => ({ ...d.data(), id: d.id })));
        setLoading(false);
      },
      () => setLoading(false),
    );

    const unsubContacts = onSnapshot(
      contactQuery,
      (snap) => {
        setContactStatuses(snap.docs.map((d) => ({ ...d.data(), id: d.id })));
        setLoading(false);
      },
      () => setLoading(false),
    );

    return () => {
      unsubOwn();
      unsubContacts();
    };
  }, [uid]);

  useEffect(() => {
    const authors = Array.from(new Set(contactStatuses.map((s) => s.authorId)));
    if (authors.length === 0) return;
    let active = true;
    Promise.all(authors.map((aid) => fetchUserSummary(aid))).then((items) => {
      if (!active) return;
      setProfiles((prev) => {
        const next = { ...prev };
        items.forEach((p) => {
          next[p.uid] = p;
        });
        return next;
      });
    });
    return () => {
      active = false;
    };
  }, [contactStatuses]);

  const markLocalViewed = (sid: string) => {
    setViewedIds((prev) => new Set(prev).add(sid));
  };

  const grouped = useMemo<GroupedStatusAuthor[]>(() => {
    const map = new Map<string, Array<StatusUpdate & { id: string }>>();
    for (const s of contactStatuses) {
      if ((s.expiresAt?.toMillis?.() ?? 0) <= nowMs) continue;
      const list = map.get(s.authorId) ?? [];
      list.push(s);
      map.set(s.authorId, list);
    }
    const mutedSet = new Set(mutedAuthors);
    return Array.from(map.entries()).map(([authorUid, list]) => {
      const sorted = list.sort(
        (a, b) => (a.createdAt?.toMillis?.() ?? 0) - (b.createdAt?.toMillis?.() ?? 0),
      );
      const p = profiles[authorUid];
      return {
        authorUid,
        authorName: p?.profile?.displayName || 'Contact',
        authorPhotoURL: p?.photoURL ?? null,
        statuses: sorted,
        allViewed: sorted.every((s) => viewedIds.has(s.id)),
        muted: mutedSet.has(authorUid),
      };
    });
  }, [contactStatuses, profiles, viewedIds, mutedAuthors, nowMs]);

  const activeOwn = useMemo(() => {
    return ownStatuses
      .filter((s) => (s.expiresAt?.toMillis?.() ?? 0) > nowMs)
      .sort((a, b) => (a.createdAt?.toMillis?.() ?? 0) - (b.createdAt?.toMillis?.() ?? 0));
  }, [ownStatuses, nowMs]);

  return {
    ownStatuses: uid ? activeOwn : [],
    recentAuthors: uid ? grouped.filter((g) => !g.muted && !g.allViewed) : [],
    viewedAuthors: uid ? grouped.filter((g) => !g.muted && g.allViewed) : [],
    mutedAuthors: uid ? grouped.filter((g) => g.muted) : [],
    loading: uid ? loading : false,
    markLocalViewed,
  };
}
