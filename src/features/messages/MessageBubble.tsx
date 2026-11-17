import React, { useEffect, useRef, useState } from 'react';
import {
  Check,
  CheckCheck,
  Clock,
  Copy,
  Download,
  FileText,
  Forward,
  Info,
  Pencil,
  Reply,
  SmilePlus,
  Trash2,
} from 'lucide-react';
import { getDownloadURL, ref } from 'firebase/storage';
import { requireFirebaseHandles } from '@/config/firebase';
import { ContextMenu, Checkbox, toast, type MenuItemConfig } from '@/components/ui';
import { isEmojiOnlyMessage, parseSafeLinks } from '@/lib/format/linkify';
import type { Message } from '@/types';
import type { DeliveryReceiptState } from './messages.service';
import { VoicePlayer } from './VoicePlayer';

const QUICK_REACTIONS = ['👍', '❤️', '😂', '😮', '😢', '🙏'];

export interface MessageBubbleProps {
  message: Message & { id: string };
  isOwn: boolean;
  isGroup: boolean;
  senderName: string;
  senderColorClass?: string;
  receiptState: DeliveryReceiptState;
  myUid: string;
  canEdit: boolean;
  canDeleteEveryone: boolean;
  selectionMode: boolean;
  selected: boolean;
  highlighted?: boolean;
  onToggleSelect: (mid: string) => void;
  onReply: (msg: Message & { id: string }) => void;
  onEdit: (msg: Message & { id: string }) => void;
  onForward: (msg: Message & { id: string }) => void;
  onDeleteForMe: (mid: string) => void;
  onDeleteForEveryone: (mid: string) => void;
  onReact: (mid: string, emoji: string, currentEmoji?: string) => void;
  onShowInfo: (msg: Message & { id: string }) => void;
  onJumpToMessage: (mid: string) => void;
  onOpenMedia: (msg: Message & { id: string }, url: string) => void;
}

const GROUP_MEMBER_COLORS = [
  'text-[#008069] dark:text-[#25D366]',
  'text-[#027EB5] dark:text-[#53BDEB]',
  'text-[#9333EA] dark:text-[#C084FC]',
  'text-[#D97706] dark:text-[#FBBF24]',
  'text-[#E11D48] dark:text-[#FB7185]',
];

function getSenderColorClass(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = (hash * 31 + name.charCodeAt(i)) >>> 0;
  }
  return GROUP_MEMBER_COLORS[hash % GROUP_MEMBER_COLORS.length] ?? GROUP_MEMBER_COLORS[0]!;
}

function formatMsgTime(msg: Message): string {
  const d = msg.createdAt?.toDate?.();
  if (!d) return 'Sending...';
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export const MessageBubble: React.FC<MessageBubbleProps> = ({
  message,
  isOwn,
  isGroup,
  senderName,
  receiptState,
  myUid,
  canEdit,
  canDeleteEveryone,
  selectionMode,
  selected,
  highlighted = false,
  onToggleSelect,
  onReply,
  onEdit,
  onForward,
  onDeleteForMe,
  onDeleteForEveryone,
  onReact,
  onShowInfo,
  onJumpToMessage,
  onOpenMedia,
}) => {
  const [mediaUrl, setMediaUrl] = useState<string | null>(null);
  const [thumbUrl, setThumbUrl] = useState<string | null>(null);
  const [dragOffset, setDragOffset] = useState(0);
  const startXRef = useRef<number | null>(null);

  useEffect(() => {
    if (!message.media || message.deletedForEveryone) return;
    const { storage } = requireFirebaseHandles();
    if (message.media.thumbPath) {
      void getDownloadURL(ref(storage, message.media.thumbPath))
        .then(setThumbUrl)
        .catch(() => undefined);
    }
    if (message.type === 'image' || message.type === 'video' || message.type === 'document') {
      void getDownloadURL(ref(storage, message.media.storagePath))
        .then(setMediaUrl)
        .catch(() => undefined);
    }
  }, [message.id, message.media, message.deletedForEveryone, message.type]);

  if (message.type === 'system') {
    return (
      <div className="my-2 flex justify-center px-4">
        <span className="rounded-lg bg-surface-raised/95 px-3 py-1 text-center text-xs text-text-secondary shadow-xs">
          {message.text}
        </span>
      </div>
    );
  }

  const emojiOnly = !message.deletedForEveryone && message.type === 'text' && message.text
    ? isEmojiOnlyMessage(message.text)
    : false;

  const reactionEntries = Object.entries(message.reactions ?? {});
  const groupedReactions = reactionEntries.reduce<Record<string, number>>((acc, [, em]) => {
    acc[em] = (acc[em] ?? 0) + 1;
    return acc;
  }, {});
  const myReaction = message.reactions?.[myUid];

  const menuItems: MenuItemConfig[] = [
    { label: 'Reply', icon: <Reply className="h-4 w-4" />, onSelect: () => onReply(message) },
    ...(message.text && !message.deletedForEveryone
      ? [
          {
            label: 'Copy text',
            icon: <Copy className="h-4 w-4" />,
            onSelect: () => {
              void navigator.clipboard.writeText(message.text ?? '');
              toast.success('Copied to clipboard.');
            },
          },
        ]
      : []),
    ...(canEdit
      ? [{ label: 'Edit message', icon: <Pencil className="h-4 w-4" />, onSelect: () => onEdit(message) }]
      : []),
    ...(!message.deletedForEveryone
      ? [
          {
            label: 'Forward',
            icon: <Forward className="h-4 w-4" />,
            onSelect: () => onForward(message),
          },
          {
            label: 'React 👍',
            icon: <SmilePlus className="h-4 w-4" />,
            onSelect: () => onReact(message.id, '👍', myReaction),
          },
        ]
      : []),
    {
      label: 'Message info',
      icon: <Info className="h-4 w-4" />,
      onSelect: () => onShowInfo(message),
    },
    {
      label: 'Delete for me',
      icon: <Trash2 className="h-4 w-4" />,
      onSelect: () => onDeleteForMe(message.id),
    },
    ...(canDeleteEveryone
      ? [
          {
            label: 'Delete for everyone',
            icon: <Trash2 className="h-4 w-4" />,
            destructive: true,
            onSelect: () => onDeleteForEveryone(message.id),
          },
        ]
      : []),
  ];

  const handlePointerDown = (e: React.PointerEvent) => {
    if (e.pointerType !== 'touch') return;
    startXRef.current = e.clientX;
  };
  const handlePointerMove = (e: React.PointerEvent) => {
    if (startXRef.current === null) return;
    const dx = Math.max(0, Math.min(56, e.clientX - startXRef.current));
    if (dx > 8) setDragOffset(dx);
  };
  const handlePointerUp = () => {
    if (dragOffset >= 40) onReply(message);
    startXRef.current = null;
    setDragOffset(0);
  };

  return (
    <div
      id={`msg-${message.id}`}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      style={{ transform: dragOffset ? `translateX(${dragOffset}px)` : undefined }}
      className={`group flex items-end gap-2 px-3 py-1 transition-colors ${
        isOwn ? 'justify-end' : 'justify-start'
      } ${highlighted ? 'bg-primary/10' : ''}`}
    >
      {selectionMode && (
        <Checkbox
          checked={selected}
          onCheckedChange={() => onToggleSelect(message.id)}
          aria-label="Select message"
        />
      )}

      <ContextMenu items={menuItems}>
        <div
          className={`relative max-w-[82%] sm:max-w-[68%] rounded-lg px-3 py-1.5 shadow-xs ${
            isOwn
              ? 'bg-bubble-sent text-bubble-sent-text rounded-tr-none mr-1.5'
              : 'bg-bubble-received text-bubble-received-text rounded-tl-none ml-1.5'
          }`}
        >
          <span
            aria-hidden="true"
            className={`pointer-events-none absolute top-0 ${
              isOwn ? '-right-2 text-bubble-sent' : '-left-2 text-bubble-received'
            }`}
          >
            {isOwn ? (
              <svg viewBox="0 0 8 13" width="8" height="13" className="fill-current">
                <path d="M5.188 1H0v11.193l6.467-8.625C7.526 2.156 6.958 1 5.188 1z" />
              </svg>
            ) : (
              <svg viewBox="0 0 8 13" width="8" height="13" className="fill-current">
                <path d="M1.533 3.568L8 12.193V1H2.812C1.042 1 .474 2.156 1.533 3.568z" />
              </svg>
            )}
          </span>

          {isGroup && !isOwn && (
            <p className={`mb-0.5 text-[12px] font-semibold ${getSenderColorClass(senderName)}`}>
              {senderName}
            </p>
          )}

          {message.forwarded && !message.deletedForEveryone && (
            <p className="mb-1 flex items-center gap-1 text-[11px] italic text-text-secondary">
              <Forward className="h-3 w-3" /> Forwarded
            </p>
          )}

          {message.replyTo && !message.deletedForEveryone && (
            <button
              type="button"
              onClick={() => message.replyTo?.messageId && onJumpToMessage(message.replyTo.messageId)}
              className="mb-1.5 flex w-full flex-col rounded-md border-l-4 border-brand bg-black/5 px-2.5 py-1.5 text-left text-xs text-text-primary dark:bg-black/25"
            >
              <span className="font-semibold text-[11px] text-accent dark:text-brand">
                {message.replyTo.kind === 'status' ? 'Status reply' : 'Reply'}
              </span>
              <span className="truncate text-text-secondary">{message.replyTo.textPreview}</span>
            </button>
          )}

          {message.deletedForEveryone ? (
            <p className="text-xs italic opacity-75">This message was deleted</p>
          ) : (
            <>
              {message.type === 'image' && message.media && (
                <button
                  type="button"
                  onClick={() => onOpenMedia(message, mediaUrl || thumbUrl || '')}
                  className="mb-1.5 block overflow-hidden rounded-xl"
                >
                  {mediaUrl || thumbUrl ? (
                    <img
                      src={mediaUrl || thumbUrl || ''}
                      alt={message.text || 'Image attachment'}
                      className="max-h-72 w-auto rounded-xl object-cover"
                      loading="lazy"
                    />
                  ) : (
                    <div className="flex h-40 w-52 items-center justify-center rounded-xl bg-black/10 text-xs">
                      Loading photo...
                    </div>
                  )}
                </button>
              )}

              {message.type === 'video' && message.media && (
                <div className="mb-1.5 overflow-hidden rounded-xl bg-black">
                  {mediaUrl ? (
                    <video
                      src={mediaUrl}
                      controls
                      preload="metadata"
                      poster={thumbUrl ?? undefined}
                      className="max-h-72 w-full rounded-xl"
                    >
                      <track kind="captions" />
                    </video>
                  ) : (
                    <div className="flex h-40 w-56 items-center justify-center text-xs text-white/80">
                      Loading video...
                    </div>
                  )}
                </div>
              )}

              {(message.type === 'voice' || message.type === 'audio') && message.media && (
                <div className="my-1">
                  <VoicePlayer
                    id={message.id}
                    storagePath={message.media.storagePath}
                    mimeType={message.media.mimeType}
                    durationMs={message.media.durationMs}
                    waveform={message.media.waveform}
                    isOwn={isOwn}
                  />
                </div>
              )}

              {message.type === 'document' && message.media && (
                <div className="mb-1 flex items-center gap-2.5 rounded-lg bg-black/5 px-3 py-2 dark:bg-black/20">
                  <FileText className="h-5 w-5 shrink-0" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-medium">
                      {message.media.fileName || 'Document'}
                    </p>
                    <p className="text-[10px] opacity-75">
                      {(message.media.sizeBytes / 1024).toFixed(0)} KB
                    </p>
                  </div>
                  {mediaUrl && (
                    <a
                      href={mediaUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      download={message.media.fileName || 'document'}
                      aria-label="Download document"
                      className="rounded-lg p-1.5 hover:bg-black/10"
                    >
                      <Download className="h-4 w-4" />
                    </a>
                  )}
                </div>
              )}

              {message.text && (
                <p
                  className={`whitespace-pre-wrap break-words ${
                    emojiOnly ? 'text-4xl leading-snug py-1' : 'text-[15px] leading-relaxed'
                  }`}
                >
                  {parseSafeLinks(message.text).map((seg, idx) =>
                    seg.kind === 'link' && seg.href ? (
                      <a
                        key={idx}
                        href={seg.href}
                        target="_blank"
                        rel="noopener noreferrer nofollow"
                        className="text-[#027EB5] underline dark:text-[#53BDEB]"
                      >
                        {seg.value}
                      </a>
                    ) : (
                      <React.Fragment key={idx}>{seg.value}</React.Fragment>
                    ),
                  )}
                </p>
              )}
            </>
          )}

          <div className="mt-0.5 flex items-center justify-end gap-1 text-[11px] text-text-tertiary">
            {message.editedAt && <span>edited</span>}
            <span className="tabular-nums">{formatMsgTime(message)}</span>
            {isOwn && !message.deletedForEveryone && (
              <span aria-label={`Status: ${receiptState}`}>
                {receiptState === 'pending' && <Clock className="h-3 w-3" />}
                {receiptState === 'sent' && <Check className="h-3.5 w-3.5" />}
                {receiptState === 'delivered' && <CheckCheck className="h-3.5 w-3.5" />}
                {receiptState === 'read' && (
                  <CheckCheck className="h-3.5 w-3.5 text-tick-read" />
                )}
              </span>
            )}
          </div>

          {!message.deletedForEveryone && (
            <div
              className={`absolute -top-3 ${
                isOwn ? 'left-0 -translate-x-2' : 'right-0 translate-x-2'
              } hidden items-center gap-0.5 rounded-full border border-border bg-surface-raised px-1.5 py-0.5 shadow-md group-hover:flex`}
            >
              {QUICK_REACTIONS.map((em) => (
                <button
                  key={em}
                  type="button"
                  onClick={() => onReact(message.id, em, myReaction)}
                  className={`rounded-full px-1 text-xs hover:scale-125 transition-transform ${
                    myReaction === em ? 'bg-primary/15' : ''
                  }`}
                >
                  {em}
                </button>
              ))}
            </div>
          )}

          {Object.keys(groupedReactions).length > 0 && (
            <div className="mt-1 flex flex-wrap gap-1">
              {Object.entries(groupedReactions).map(([emoji, count]) => (
                <button
                  key={emoji}
                  type="button"
                  onClick={() => onReact(message.id, emoji, myReaction)}
                  className={`inline-flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-[11px] ${
                    myReaction === emoji
                      ? 'border-primary bg-primary/15 text-primary'
                      : 'border-border bg-surface-raised text-text-primary'
                  }`}
                >
                  <span>{emoji}</span>
                  {count > 1 && <span className="tabular-nums">{count}</span>}
                </button>
              ))}
            </div>
          )}
        </div>
      </ContextMenu>
    </div>
  );
};
