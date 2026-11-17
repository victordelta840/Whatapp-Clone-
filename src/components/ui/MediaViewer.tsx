import React, { useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight, Download, Forward, X, ZoomIn, ZoomOut } from 'lucide-react';
import { IconButton } from './IconButton';

export interface MediaViewerItem {
  id: string;
  url: string;
  kind?: 'image' | 'video';
  mimeType?: string;
  fileName?: string | null;
  caption?: string | null;
  senderName?: string;
}

export interface MediaViewerProps {
  items: MediaViewerItem[];
  initialIndex?: number;
  open: boolean;
  onClose?: () => void;
  onOpenChange?: (open: boolean) => void;
  onForward?: (item: MediaViewerItem) => void;
}

export const MediaViewer: React.FC<MediaViewerProps> = ({
  items,
  initialIndex = 0,
  open,
  onClose,
  onOpenChange,
  onForward,
}) => {
  const activeKey = `${open}:${initialIndex}`;
  const [nav, setNav] = useState<{ key: string; index: number; zoom: number }>({
    key: activeKey,
    index: initialIndex,
    zoom: 1,
  });

  const index = nav.key === activeKey ? nav.index : initialIndex;
  const zoom = nav.key === activeKey ? nav.zoom : 1;

  const setIndex = (updater: number | ((prev: number) => number)) => {
    setNav((prev) => {
      const baseIndex = prev.key === activeKey ? prev.index : initialIndex;
      const baseZoom = prev.key === activeKey ? prev.zoom : 1;
      const nextIndex = typeof updater === 'function' ? updater(baseIndex) : updater;
      return { key: activeKey, index: nextIndex, zoom: baseZoom };
    });
  };

  const setZoom = (updater: number | ((prev: number) => number)) => {
    setNav((prev) => {
      const baseIndex = prev.key === activeKey ? prev.index : initialIndex;
      const baseZoom = prev.key === activeKey ? prev.zoom : 1;
      const nextZoom = typeof updater === 'function' ? updater(baseZoom) : updater;
      return { key: activeKey, index: baseIndex, zoom: nextZoom };
    });
  };

  const handleClose = () => {
    onClose?.();
    onOpenChange?.(false);
  };

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose?.();
        onOpenChange?.(false);
      }
      if (e.key === 'ArrowLeft') {
        setNav((prev) => {
          const base = prev.key === activeKey ? prev.index : initialIndex;
          return { key: activeKey, index: Math.max(0, base - 1), zoom: 1 };
        });
      }
      if (e.key === 'ArrowRight') {
        setNav((prev) => {
          const base = prev.key === activeKey ? prev.index : initialIndex;
          return { key: activeKey, index: Math.min(items.length - 1, base + 1), zoom: 1 };
        });
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, items.length, onClose, onOpenChange, activeKey, initialIndex]);

  if (!open || items.length === 0) return null;
  const current = items[index] ?? items[0];
  if (!current) return null;

  const isVideo =
    current.kind === 'video' || Boolean(current.mimeType?.startsWith('video/'));

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Media viewer"
      className="fixed inset-0 z-[80] flex flex-col bg-black/95 text-white"
    >
      <header className="flex items-center justify-between gap-4 px-4 py-3 border-b border-white/10">
        <div className="min-w-0">
          <div className="truncate text-sm font-semibold">{current.senderName ?? 'Media'}</div>
          {current.fileName && (
            <div className="truncate text-xs text-white/70">{current.fileName}</div>
          )}
        </div>
        <div className="flex items-center gap-1">
          {!isVideo && (
            <>
              <IconButton
                label="Zoom out"
                onClick={() => setZoom((z) => Math.max(1, Number((z - 0.5).toFixed(1))))}
                className="text-white hover:bg-white/10"
              >
                <ZoomOut className="h-5 w-5" aria-hidden="true" />
              </IconButton>
              <IconButton
                label="Zoom in"
                onClick={() => setZoom((z) => Math.min(3, Number((z + 0.5).toFixed(1))))}
                className="text-white hover:bg-white/10"
              >
                <ZoomIn className="h-5 w-5" aria-hidden="true" />
              </IconButton>
            </>
          )}
          {onForward && (
            <IconButton
              label="Forward media"
              onClick={() => onForward(current)}
              className="text-white hover:bg-white/10"
            >
              <Forward className="h-5 w-5" aria-hidden="true" />
            </IconButton>
          )}
          <a
            href={current.url}
            download={current.fileName ?? 'converse-media'}
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Download media"
            className="min-h-[44px] min-w-[44px] inline-flex items-center justify-center rounded-xl text-white hover:bg-white/10"
          >
            <Download className="h-5 w-5" aria-hidden="true" />
          </a>
          <IconButton
            label="Close media viewer"
            onClick={handleClose}
            className="text-white hover:bg-white/10"
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </IconButton>
        </div>
      </header>

      <div className="relative flex flex-1 items-center justify-center overflow-hidden p-4">
        {index > 0 && (
          <IconButton
            label="Previous media"
            onClick={() => {
              setIndex((i) => Math.max(0, i - 1));
              setZoom(1);
            }}
            className="absolute start-4 z-10 bg-black/50 text-white hover:bg-black/80"
          >
            <ChevronLeft className="h-6 w-6" aria-hidden="true" />
          </IconButton>
        )}

        {isVideo ? (
          <video
            src={current.url}
            controls
            playsInline
            autoPlay
            className="max-h-full max-w-full rounded-lg"
          >
            <track kind="captions" />
          </video>
        ) : (
          <img
            src={current.url}
            alt={current.caption ?? current.fileName ?? 'Shared image'}
            referrerPolicy="no-referrer"
            style={{ transform: `scale(${zoom})` }}
            className="max-h-full max-w-full object-contain transition-transform duration-fast"
          />
        )}

        {index < items.length - 1 && (
          <IconButton
            label="Next media"
            onClick={() => {
              setIndex((i) => Math.min(items.length - 1, i + 1));
              setZoom(1);
            }}
            className="absolute end-4 z-10 bg-black/50 text-white hover:bg-black/80"
          >
            <ChevronRight className="h-6 w-6" aria-hidden="true" />
          </IconButton>
        )}
      </div>

      {current.caption && (
        <div className="border-t border-white/10 bg-black/60 px-6 py-3 text-center text-sm text-white/90">
          {current.caption}
        </div>
      )}
    </div>
  );
};
