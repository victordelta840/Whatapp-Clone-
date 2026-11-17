import React, { useEffect, useState } from 'react';
import { Eye, Send, Trash2, VolumeX, X } from 'lucide-react';
import { onSnapshot } from 'firebase/firestore';
import { Avatar, Button, Input, toast } from '@/components/ui';
import { STATUS_BACKGROUNDS, STATUS_FONTS } from '@/config/constants';
import { refs } from '@/config/refs';
import { mapFirebaseError } from '@/lib/errors';
import { useAuthStore } from '@/features/auth';
import { startDirectConversation } from '@/features/conversations/conversations.service';
import { sendMessageBatched } from '@/features/messages/messages.service';
import type { StatusUpdate } from '@/types';
import {
  deleteOwnStatus,
  recordStatusView,
  resolveStatusMediaUrl,
  toggleMuteStatusAuthor,
} from './status.service';

export interface StatusViewerProps {
  open: boolean;
  onClose: () => void;
  authorUid: string;
  authorName: string;
  authorPhotoURL: string | null;
  statuses: Array<StatusUpdate & { id: string }>;
  isOwn: boolean;
  onViewed?: (statusId: string) => void;
}

export const StatusViewer: React.FC<StatusViewerProps> = ({
  open,
  onClose,
  authorUid,
  authorName,
  authorPhotoURL,
  statuses,
  isOwn,
  onViewed,
}) => {
  const uid = useAuthStore((s) => s.authUser?.uid ?? null);
  const settings = useAuthStore((s) => s.settings);

  const [sessionState, setSessionState] = useState<{ authorUid: string; index: number }>({
    authorUid,
    index: 0,
  });
  const index = sessionState.authorUid === authorUid ? sessionState.index : 0;
  const setIndex = (updater: number | ((prev: number) => number)) => {
    setSessionState((prev) => {
      const base = prev.authorUid === authorUid ? prev.index : 0;
      const next = typeof updater === 'function' ? updater(base) : updater;
      return { authorUid, index: next };
    });
  };

  const [paused, setPaused] = useState(false);
  const [progressState, setProgressState] = useState<{ sid: string; value: number }>({
    sid: '',
    value: 0,
  });
  const [mediaMap, setMediaMap] = useState<Record<string, string>>({});
  const [replyText, setReplyText] = useState('');
  const [viewers, setViewers] = useState<string[]>([]);
  const [showViewers, setShowViewers] = useState(false);

  const current = statuses[index];
  const progress = current && progressState.sid === current.id ? progressState.value : 0;
  const mediaUrl = current ? (mediaMap[current.id] ?? null) : null;

  useEffect(() => {
    if (!open || !current) return;
    const statusId = current.id;
    const storagePath = current.media?.storagePath;
    if (storagePath) {
      void resolveStatusMediaUrl(storagePath)
        .then((url) => {
          if (url) {
            setMediaMap((prev) => ({ ...prev, [statusId]: url }));
          }
        })
        .catch(() => undefined);
    }
    if (!isOwn && uid) {
      void recordStatusView(statusId, uid)
        .then(() => onViewed?.(statusId))
        .catch(() => undefined);
    }
  }, [open, current, isOwn, uid, onViewed]);

  useEffect(() => {
    if (!open || !current || !isOwn) {
      return;
    }
    const unsub = onSnapshot(
      refs.statusViewsCol(current.id),
      (snap) => setViewers(snap.docs.map((d) => d.id)),
      () => setViewers([]),
    );
    return unsub;
  }, [open, current, isOwn]);

  useEffect(() => {
    if (!open || paused || !current) return;
    const sid = current.id;
    const stepMs = 50;
    const totalMs = 5000;
    const timer = window.setInterval(() => {
      setProgressState((prev) => {
        const base = prev.sid === sid ? prev.value : 0;
        const next = base + (stepMs / totalMs) * 100;
        if (next >= 100) {
          if (index < statuses.length - 1) {
            setSessionState({ authorUid, index: index + 1 });
          } else {
            onClose();
          }
          return { sid, value: 0 };
        }
        return { sid, value: next };
      });
    }, stepMs);
    return () => window.clearInterval(timer);
  }, [open, paused, current, index, statuses.length, onClose, authorUid]);

  if (!open || !current) return null;

  const bg =
    STATUS_BACKGROUNDS.find((b) => b.id === current.backgroundColor) ?? STATUS_BACKGROUNDS[0];
  const font = STATUS_FONTS.find((f) => f.id === current.fontStyle) ?? STATUS_FONTS[0];

  const handleReply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!uid || !replyText.trim() || isOwn) return;
    try {
      const cid = await startDirectConversation(authorUid);
      await sendMessageBatched({
        cid,
        senderId: uid,
        type: 'text',
        text: replyText.trim(),
        replyTo: {
          kind: 'status',
          statusId: current.id,
          senderId: authorUid,
          type: current.type === 'text' ? 'text' : current.type,
          textPreview: (current.text || current.caption || 'Status update').slice(0, 100),
          thumbPath: current.media?.thumbPath ?? null,
        },
      });
      setReplyText('');
      toast.success('Reply sent privately.');
    } catch (err) {
      toast.error(mapFirebaseError(err).userMessage);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col bg-black text-white"
      onPointerDown={() => setPaused(true)}
      onPointerUp={() => setPaused(false)}
      onPointerCancel={() => setPaused(false)}
    >
      <div className="flex gap-1.5 px-4 pt-3">
        {statuses.map((s, idx) => (
          <div key={s.id} className="h-1 flex-1 overflow-hidden rounded-full bg-white/30">
            <div
              className="h-full bg-white transition-all duration-75"
              style={{
                width: idx < index ? '100%' : idx === index ? `${progress}%` : '0%',
              }}
            />
          </div>
        ))}
      </div>

      <div className="flex items-center justify-between px-4 py-3">
        <div className="flex items-center gap-3">
          <Avatar src={authorPhotoURL} name={authorName} size="sm" />
          <div>
            <p className="text-sm font-semibold">{isOwn ? 'My status' : authorName}</p>
            <p className="text-[11px] text-white/70">
              {current.createdAt?.toDate?.()?.toLocaleTimeString([], {
                hour: '2-digit',
                minute: '2-digit',
              })}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {!isOwn && uid && settings && (
            <button
              type="button"
              onClick={() =>
                void toggleMuteStatusAuthor(uid, authorUid, settings, true)
                  .then(() => {
                    toast.info(`Muted ${authorName}'s statuses.`);
                    onClose();
                  })
                  .catch((err) => toast.error(mapFirebaseError(err).userMessage))
              }
              aria-label="Mute status author"
              className="rounded-lg p-2 hover:bg-white/10"
            >
              <VolumeX className="h-4 w-4" />
            </button>
          )}
          {isOwn && (
            <button
              type="button"
              onClick={() =>
                void deleteOwnStatus(current.id)
                  .then(() => {
                    toast.success('Status deleted.');
                    if (statuses.length <= 1) onClose();
                  })
                  .catch((err) => toast.error(mapFirebaseError(err).userMessage))
              }
              aria-label="Delete status"
              className="rounded-lg p-2 hover:bg-white/10"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            aria-label="Close status viewer"
            className="rounded-lg p-2 hover:bg-white/10"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
      </div>

      <div className="relative flex flex-1 items-center justify-center overflow-hidden p-4">
        <button
          type="button"
          aria-label="Previous status"
          onClick={() => index > 0 && setIndex((i) => i - 1)}
          className="absolute inset-y-0 left-0 w-1/4 z-10"
        />
        <button
          type="button"
          aria-label="Next status"
          onClick={() => (index < statuses.length - 1 ? setIndex((i) => i + 1) : onClose())}
          className="absolute inset-y-0 right-0 w-1/4 z-10"
        />

        {current.type === 'text' ? (
          <div
            className={`flex h-full w-full max-w-lg items-center justify-center rounded-2xl p-8 text-center ${bg.className} ${font.className}`}
          >
            <p className="text-2xl leading-relaxed whitespace-pre-wrap">{current.text}</p>
          </div>
        ) : current.type === 'video' ? (
          mediaUrl ? (
            <video src={mediaUrl} controls autoPlay className="max-h-full max-w-full rounded-xl">
              <track kind="captions" />
            </video>
          ) : (
            <p className="text-xs text-white/70">Loading video...</p>
          )
        ) : mediaUrl ? (
          <img
            src={mediaUrl}
            alt={current.caption || 'Status photo'}
            className="max-h-full max-w-full rounded-xl object-contain"
          />
        ) : (
          <p className="text-xs text-white/70">Loading photo...</p>
        )}
      </div>

      {current.caption && (
        <p className="px-6 pb-2 text-center text-sm text-white/95">{current.caption}</p>
      )}

      <div className="border-t border-white/15 px-4 py-3">
        {isOwn ? (
          <div className="mx-auto max-w-md">
            <button
              type="button"
              onClick={() => setShowViewers((v) => !v)}
              className="flex items-center gap-2 text-xs font-medium text-white/90 hover:underline"
            >
              <Eye className="h-4 w-4" />
              <span>Viewed by {Math.max(current.viewCount, viewers.length)}</span>
            </button>
            {showViewers && viewers.length > 0 && (
              <div className="mt-2 max-h-28 overflow-y-auto rounded-lg bg-white/10 p-2 text-xs">
                {viewers.map((v) => (
                  <p key={v}>{v}</p>
                ))}
              </div>
            )}
          </div>
        ) : (
          <form onSubmit={(e) => void handleReply(e)} className="mx-auto flex max-w-md gap-2">
            <div className="flex-1">
              <Input
                value={replyText}
                onChange={(e) => setReplyText(e.target.value)}
                placeholder="Reply privately..."
                className="bg-white/10 border-white/20 text-white placeholder:text-white/60"
              />
            </div>
            <Button type="submit" size="sm">
              <Send className="h-4 w-4" />
            </Button>
          </form>
        )}
      </div>
    </div>
  );
};
