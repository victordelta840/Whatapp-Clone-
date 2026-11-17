import React, { useEffect, useMemo, useRef, useState } from 'react';
import { FileText, Link2, Image as ImageIcon } from 'lucide-react';
import { getDownloadURL, ref } from 'firebase/storage';
import { requireFirebaseHandles } from '@/config/firebase';
import { MediaViewer, Tabs, type MediaViewerItem } from '@/components/ui';
import { extractLinks } from '@/lib/format/linkify';
import type { Message } from '@/types';

export interface MediaGalleryProps {
  messages: Array<Message & { id: string }>;
}

export const MediaGallery: React.FC<MediaGalleryProps> = ({ messages }) => {
  const [tab, setTab] = useState<'media' | 'docs' | 'links'>('media');
  const [urls, setUrls] = useState<Record<string, string>>({});
  const [viewerIndex, setViewerIndex] = useState<number | null>(null);
  const requestedIdsRef = useRef<Set<string>>(new Set());

  const mediaMsgs = useMemo(
    () =>
      messages.filter(
        (m) => !m.deletedForEveryone && (m.type === 'image' || m.type === 'video') && m.media,
      ),
    [messages],
  );
  const docMsgs = useMemo(
    () =>
      messages.filter(
        (m) => !m.deletedForEveryone && (m.type === 'document' || m.type === 'audio') && m.media,
      ),
    [messages],
  );
  const linkItems = useMemo(
    () =>
      messages
        .filter((m) => !m.deletedForEveryone && m.text)
        .flatMap((m) => extractLinks(m.text!).map((href) => ({ id: `${m.id}:${href}`, href }))),
    [messages],
  );

  useEffect(() => {
    const { storage } = requireFirebaseHandles();
    const targets = [...mediaMsgs, ...docMsgs].slice(-24);
    targets.forEach((m) => {
      if (!m.media || requestedIdsRef.current.has(m.id)) return;
      requestedIdsRef.current.add(m.id);
      const path = m.media.thumbPath || m.media.storagePath;
      void getDownloadURL(ref(storage, path))
        .then((u) => setUrls((prev) => ({ ...prev, [m.id]: u })))
        .catch(() => undefined);
    });
  }, [mediaMsgs, docMsgs]);

  const viewerItems: MediaViewerItem[] = mediaMsgs.map((m) => ({
    id: m.id,
    kind: m.type === 'video' ? 'video' : 'image',
    url: urls[m.id] ?? '',
    caption: m.text,
    fileName: m.media?.fileName,
  }));

  return (
    <div className="space-y-3">
      <Tabs
        value={tab}
        onValueChange={(v) => setTab(v as 'media' | 'docs' | 'links')}
        items={[
          { value: 'media', label: `Media (${mediaMsgs.length})`, icon: <ImageIcon className="h-3.5 w-3.5" /> },
          { value: 'docs', label: `Docs (${docMsgs.length})`, icon: <FileText className="h-3.5 w-3.5" /> },
          { value: 'links', label: `Links (${linkItems.length})`, icon: <Link2 className="h-3.5 w-3.5" /> },
        ]}
      />

      {tab === 'media' && (
        <div className="grid grid-cols-3 gap-1.5">
          {mediaMsgs.map((m, idx) => (
            <button
              key={m.id}
              type="button"
              onClick={async () => {
                if (m.media?.storagePath) {
                  const { storage } = requireFirebaseHandles();
                  const fullUrl = await getDownloadURL(ref(storage, m.media.storagePath));
                  setUrls((prev) => ({ ...prev, [m.id]: fullUrl }));
                }
                setViewerIndex(idx);
              }}
              className="aspect-square overflow-hidden rounded-lg border border-border bg-surface-muted"
            >
              {urls[m.id] ? (
                <img
                  src={urls[m.id]}
                  alt={m.media?.fileName || 'Shared media'}
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="flex h-full items-center justify-center text-[10px] text-text-tertiary">
                  {m.type}
                </div>
              )}
            </button>
          ))}
          {mediaMsgs.length === 0 && (
            <p className="col-span-3 py-6 text-center text-xs text-text-secondary">
              No shared photos or videos yet.
            </p>
          )}
        </div>
      )}

      {tab === 'docs' && (
        <div className="divide-y divide-border rounded-xl border border-border">
          {docMsgs.map((m) => (
            <div key={m.id} className="flex items-center justify-between gap-2 p-2.5 text-xs">
              <span className="truncate font-medium text-text-primary">
                {m.media?.fileName || 'Attachment'}
              </span>
              <button
                type="button"
                className="shrink-0 font-semibold text-primary hover:underline"
                onClick={async () => {
                  if (!m.media) return;
                  const { storage } = requireFirebaseHandles();
                  const u = await getDownloadURL(ref(storage, m.media.storagePath));
                  window.open(u, '_blank', 'noopener,noreferrer');
                }}
              >
                Open
              </button>
            </div>
          ))}
          {docMsgs.length === 0 && (
            <p className="py-6 text-center text-xs text-text-secondary">No documents yet.</p>
          )}
        </div>
      )}

      {tab === 'links' && (
        <div className="divide-y divide-border rounded-xl border border-border">
          {linkItems.map((item) => (
            <a
              key={item.id}
              href={item.href}
              target="_blank"
              rel="noopener noreferrer nofollow"
              className="block truncate p-2.5 text-xs text-primary hover:bg-surface-muted hover:underline"
            >
              {item.href}
            </a>
          ))}
          {linkItems.length === 0 && (
            <p className="py-6 text-center text-xs text-text-secondary">No links shared yet.</p>
          )}
        </div>
      )}

      <MediaViewer
        open={viewerIndex !== null}
        onOpenChange={(o: boolean) => !o && setViewerIndex(null)}
        items={viewerItems}
        initialIndex={viewerIndex ?? 0}
      />
    </div>
  );
};
