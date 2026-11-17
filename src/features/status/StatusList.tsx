import React, { useState } from 'react';
import { Plus } from 'lucide-react';
import { Avatar, Button, EmptyState, Spinner } from '@/components/ui';
import { en } from '@/i18n';
import { useAuthStore } from '@/features/auth';
import { useStatuses, type GroupedStatusAuthor } from './useStatuses';
import { CreateStatusModal } from './CreateStatusModal';
import { StatusViewer } from './StatusViewer';

export const StatusList: React.FC = () => {
  const profile = useAuthStore((s) => s.profile);
  const photo = useAuthStore((s) => s.photo);
  const uid = useAuthStore((s) => s.authUser?.uid ?? '');

  const { ownStatuses, recentAuthors, viewedAuthors, mutedAuthors, loading, markLocalViewed } =
    useStatuses();
  const [createOpen, setCreateOpen] = useState(false);
  const [viewerTarget, setViewerTarget] = useState<{
    authorUid: string;
    authorName: string;
    authorPhotoURL: string | null;
    statuses: GroupedStatusAuthor['statuses'];
    isOwn: boolean;
  } | null>(null);

  const renderGroup = (label: string, list: GroupedStatusAuthor[], ringClass: string) => {
    if (list.length === 0) return null;
    return (
      <div className="space-y-1.5">
        <p className="px-2 text-[11px] font-semibold uppercase tracking-wide text-text-tertiary">
          {label}
        </p>
        {list.map((g) => (
          <button
            key={g.authorUid}
            type="button"
            onClick={() =>
              setViewerTarget({
                authorUid: g.authorUid,
                authorName: g.authorName,
                authorPhotoURL: g.authorPhotoURL,
                statuses: g.statuses,
                isOwn: false,
              })
            }
            className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left hover:bg-surface-muted"
          >
            <div className={`rounded-full p-0.5 border-2 ${ringClass}`}>
              <Avatar src={g.authorPhotoURL} name={g.authorName} size="md" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-text-primary">{g.authorName}</p>
              <p className="text-xs text-text-secondary">
                {g.statuses.length} update{g.statuses.length === 1 ? '' : 's'}
              </p>
            </div>
          </button>
        ))}
      </div>
    );
  };

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <h1 className="text-lg font-bold text-text-primary">Status</h1>
        <Button size="sm" leftIcon={<Plus className="h-4 w-4" />} onClick={() => setCreateOpen(true)}>
          New status
        </Button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-3 space-y-5">
        <div className="rounded-xl border border-border bg-surface-raised p-3">
          <div className="flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={() => {
                if (ownStatuses.length > 0) {
                  setViewerTarget({
                    authorUid: uid,
                    authorName: profile?.displayName ?? 'Me',
                    authorPhotoURL: photo?.photoURL ?? null,
                    statuses: ownStatuses,
                    isOwn: true,
                  });
                } else {
                  setCreateOpen(true);
                }
              }}
              className="flex flex-1 items-center gap-3 text-left"
            >
              <div
                className={`rounded-full p-0.5 border-2 ${
                  ownStatuses.length > 0 ? 'border-accent' : 'border-border'
                }`}
              >
                <Avatar src={photo?.photoURL} name={profile?.displayName ?? 'Me'} size="md" />
              </div>
              <div>
                <p className="text-sm font-semibold text-text-primary">{en.status.myStatus}</p>
                <p className="text-xs text-text-secondary">
                  {ownStatuses.length > 0
                    ? `${ownStatuses.length} active update${ownStatuses.length === 1 ? '' : 's'}`
                    : 'Tap to add an update (24h expiry)'}
                </p>
              </div>
            </button>
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center py-8">
            <Spinner />
          </div>
        ) : recentAuthors.length === 0 && viewedAuthors.length === 0 && mutedAuthors.length === 0 ? (
          <EmptyState title={en.status.emptyTitle} description={en.status.emptyDescription} />
        ) : (
          <>
            {renderGroup(en.status.recentUpdates, recentAuthors, 'border-accent')}
            {renderGroup(en.status.viewedUpdates, viewedAuthors, 'border-border-strong')}
            {renderGroup(en.status.mutedUpdates, mutedAuthors, 'border-border opacity-60')}
          </>
        )}
      </div>

      <CreateStatusModal open={createOpen} onOpenChange={setCreateOpen} />

      <StatusViewer
        open={Boolean(viewerTarget)}
        onClose={() => setViewerTarget(null)}
        authorUid={viewerTarget?.authorUid ?? ''}
        authorName={viewerTarget?.authorName ?? ''}
        authorPhotoURL={viewerTarget?.authorPhotoURL ?? null}
        statuses={viewerTarget?.statuses ?? []}
        isOwn={Boolean(viewerTarget?.isOwn)}
        onViewed={markLocalViewed}
      />

      <button
        type="button"
        onClick={() => setCreateOpen(true)}
        aria-label="New status"
        className="fixed bottom-20 end-4 z-30 flex h-14 w-14 items-center justify-center rounded-2xl bg-brand text-white shadow-lg transition-transform hover:bg-brand-hover active:scale-95 md:hidden"
      >
        <Plus className="h-6 w-6" aria-hidden="true" />
      </button>
    </div>
  );
};
