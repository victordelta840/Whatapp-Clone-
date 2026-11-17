import React, { useEffect, useState } from 'react';
import { limit, onSnapshot, orderBy, query, where } from 'firebase/firestore';
import { Phone, PhoneIncoming, PhoneMissed, PhoneOutgoing, Video } from 'lucide-react';
import { Avatar, Banner, EmptyState, IconButton, Spinner } from '@/components/ui';
import { PAGINATION } from '@/config/constants';
import { refs } from '@/config/refs';
import { en } from '@/i18n';
import { useAuthStore } from '@/features/auth';
import { fetchUserSummary, type HydratedUserSummary } from '@/features/profile';
import type { CallDoc } from '@/types';
import { startOutgoingCall } from './useCallSession';

export const CallsPage: React.FC = () => {
  const uid = useAuthStore((s) => s.authUser?.uid ?? null);
  const [calls, setCalls] = useState<Array<CallDoc & { id: string }>>([]);
  const [profiles, setProfiles] = useState<Record<string, HydratedUserSummary>>({});
  const [loading, setLoading] = useState(Boolean(uid));

  useEffect(() => {
    if (!uid) {
      return;
    }
    const q = query(
      refs.callsCol(),
      where('participantIds', 'array-contains', uid),
      orderBy('createdAt', 'desc'),
      limit(PAGINATION.CALLS_PAGE_SIZE),
    );
    const unsub = onSnapshot(
      q,
      (snap) => {
        setCalls(snap.docs.map((d) => ({ ...d.data(), id: d.id })));
        setLoading(false);
      },
      () => setLoading(false),
    );
    return unsub;
  }, [uid]);

  useEffect(() => {
    if (!uid || calls.length === 0) return;
    const peerIds = Array.from(
      new Set(calls.map((c) => (c.callerId === uid ? c.calleeId : c.callerId))),
    );
    let active = true;
    Promise.all(peerIds.map((id) => fetchUserSummary(id))).then((items) => {
      if (!active) return;
      const map: Record<string, HydratedUserSummary> = {};
      items.forEach((p) => {
        map[p.uid] = p;
      });
      setProfiles(map);
    });
    return () => {
      active = false;
    };
  }, [uid, calls]);

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-border px-4 py-3">
        <h1 className="text-lg font-bold text-text-primary">Calls</h1>
      </div>

      <Banner variant="info" message={en.calls.webRingLimitNotice} />

      <div className="min-h-0 flex-1 overflow-y-auto p-3">
        {uid && loading ? (
          <div className="flex justify-center py-8">
            <Spinner />
          </div>
        ) : !uid || calls.length === 0 ? (
          <EmptyState title={en.calls.emptyTitle} description={en.calls.emptyDescription} />
        ) : (
          <div className="divide-y divide-border rounded-xl border border-border bg-surface-raised">
            {calls.map((call) => {
              const peerUid = call.callerId === uid ? call.calleeId : call.callerId;
              const p = profiles[peerUid];
              const name = p?.profile?.displayName ?? 'Contact';
              const isMissed =
                call.state === 'missed' || call.state === 'declined' || call.state === 'failed';
              const isOutgoing = call.callerId === uid;

              return (
                <div key={call.id} className="flex items-center justify-between gap-3 px-4 py-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <Avatar src={p?.photoURL} name={name} size="md" />
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-text-primary">{name}</p>
                      <div className="flex items-center gap-1.5 text-xs text-text-secondary">
                        {isMissed ? (
                          <PhoneMissed className="h-3.5 w-3.5 text-danger" />
                        ) : isOutgoing ? (
                          <PhoneOutgoing className="h-3.5 w-3.5 text-accent" />
                        ) : (
                          <PhoneIncoming className="h-3.5 w-3.5 text-primary" />
                        )}
                        <span className="capitalize">{call.state}</span>
                        <span>•</span>
                        <span>
                          {call.createdAt?.toDate?.()?.toLocaleDateString([], {
                            month: 'short',
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </span>
                      </div>
                    </div>
                  </div>
                  <IconButton
                    label={`Call ${name} back`}
                    onClick={() =>
                      void startOutgoingCall({
                        conversationId: call.conversationId,
                        calleeId: peerUid,
                        type: call.type,
                      })
                    }
                  >
                    {call.type === 'video' ? (
                      <Video className="h-4 w-4 text-primary" />
                    ) : (
                      <Phone className="h-4 w-4 text-primary" />
                    )}
                  </IconButton>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
