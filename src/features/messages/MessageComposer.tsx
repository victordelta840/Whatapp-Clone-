import React, { useEffect, useRef, useState } from 'react';
import { Mic, Paperclip, Send, Square, Trash2, X } from 'lucide-react';
import { EmojiPickerPopover, IconButton, toast } from '@/components/ui';
import { LIMITS, WINDOWS } from '@/config/constants';
import { loadDraft, saveDraft } from '@/lib/idb';
import {
  isBlockedExecutableFile,
  captureVideoThumbnail,
  processImageFile,
  verifyFileMagicBytes,
} from '@/lib/media/imageProcessor';
import { startVoiceRecording, type VoiceRecorderController } from '@/lib/media/voiceRecorder';
import { enqueueMediaUpload } from '@/lib/media/uploadOutbox';
import { useAuthStore } from '@/features/auth';
import type { Message } from '@/types';
import { clearTypingActive, generateClientId, setTypingActive } from './messages.service';

export interface GroupMentionOption {
  uid: string;
  displayName: string;
  username: string | null;
}

export interface MessageComposerProps {
  cid: string;
  replyTo: (Message & { id: string }) | null;
  editingMessage: (Message & { id: string }) | null;
  lastOwnEditableMessage: (Message & { id: string }) | null;
  disabled?: boolean;
  disabledReason?: string;
  isGroup: boolean;
  mentionOptions?: GroupMentionOption[];
  onCancelReply: () => void;
  onCancelEdit: () => void;
  onStartEditLast: () => void;
  onSendText: (text: string, mentions: string[]) => Promise<void>;
  onSaveEdit: (mid: string, text: string) => Promise<void>;
}

export const MessageComposer: React.FC<MessageComposerProps> = ({
  cid,
  replyTo,
  editingMessage,
  lastOwnEditableMessage,
  disabled = false,
  disabledReason,
  isGroup,
  mentionOptions = [],
  onCancelReply,
  onCancelEdit,
  onStartEditLast,
  onSendText,
  onSaveEdit,
}) => {
  const uid = useAuthStore((s) => s.authUser?.uid ?? null);
  const typingEnabled = useAuthStore((s) => s.settings?.privacy.typingIndicators ?? true);

  const [text, setText] = useState(() => editingMessage?.text ?? '');
  const [sending, setSending] = useState(false);
  const [recording, setRecording] = useState(false);
  const [recordSec, setRecordSec] = useState(0);
  const [mentionQuery, setMentionQuery] = useState<string | null>(null);
  const [mentionedUids, setMentionedUids] = useState<string[]>([]);

  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const recorderRef = useRef<VoiceRecorderController | null>(null);
  const lastTypingSentRef = useRef(0);
  const isEditing = Boolean(editingMessage);

  useEffect(() => {
    if (!uid || isEditing) return;
    let active = true;
    void loadDraft(uid, cid).then((draft) => {
      if (active && draft?.text) {
        setText(draft.text);
      }
    });
    return () => {
      active = false;
    };
  }, [uid, cid, isEditing]);

  useEffect(() => {
    if (isEditing) {
      textareaRef.current?.focus();
    }
  }, [isEditing]);

  useEffect(() => {
    if (!uid || isEditing) return;
    const handle = window.setTimeout(() => {
      void saveDraft(uid, cid, text, replyTo?.id ?? null);
    }, 250);
    return () => window.clearTimeout(handle);
  }, [uid, cid, text, replyTo?.id, isEditing]);

  useEffect(() => {
    if (!recording) return;
    const timer = window.setInterval(() => setRecordSec((s) => s + 1), 1000);
    return () => window.clearInterval(timer);
  }, [recording]);

  const handleTextChange = (value: string) => {
    setText(value);
    if (isGroup) {
      const match = value.match(/@([a-zA-Z0-9_.]*)$/);
      setMentionQuery(match ? (match[1] ?? '').toLowerCase() : null);
    } else {
      setMentionQuery(null);
    }

    if (uid && typingEnabled && value.trim()) {
      const now = Date.now();
      if (now - lastTypingSentRef.current >= WINDOWS.TYPING_THROTTLE_MS) {
        lastTypingSentRef.current = now;
        void setTypingActive(cid, uid).catch(() => undefined);
      }
    }
  };

  const handleFilesSelected = async (files: FileList | File[]) => {
    if (!uid || disabled) return;
    const list = Array.from(files).slice(0, LIMITS.COMPOSER_MAX_FILES);
    for (const file of list) {
      if (isBlockedExecutableFile(file.name, file.type)) {
        toast.error(`Blocked executable file: ${file.name}`);
        continue;
      }

      const mid = generateClientId();
      try {
        if (file.type.startsWith('image/')) {
          const processed = await processImageFile(file);
          await enqueueMediaUpload({
            id: mid,
            uid,
            cid,
            kind: 'image',
            fileName: file.name,
            mimeType: processed.mimeType,
            sizeBytes: processed.blob.size,
            caption: '',
            fileBlob: processed.blob,
            thumbBlob: processed.thumbBlob,
            width: processed.width,
            height: processed.height,
            durationMs: null,
            waveform: [],
            replyTo: replyTo
              ? {
                  kind: 'message',
                  messageId: replyTo.id,
                  senderId: replyTo.senderId,
                  type: replyTo.type,
                  textPreview: (replyTo.text || replyTo.type).slice(0, LIMITS.TEXT_PREVIEW_MAX),
                }
              : null,
            status: 'queued',
            progress: 0,
            errorMessage: null,
            createdAt: Date.now(),
          });
        } else if (file.type.startsWith('video/')) {
          const meta = await captureVideoThumbnail(file);
          await enqueueMediaUpload({
            id: mid,
            uid,
            cid,
            kind: 'video',
            fileName: file.name,
            mimeType: file.type,
            sizeBytes: file.size,
            caption: '',
            fileBlob: file,
            thumbBlob: meta.thumbBlob,
            width: meta.width,
            height: meta.height,
            durationMs: meta.durationMs,
            waveform: [],
            replyTo: null,
            status: 'queued',
            progress: 0,
            errorMessage: null,
            createdAt: Date.now(),
          });
        } else if (file.type.startsWith('audio/')) {
          const ok = await verifyFileMagicBytes(file, 'audio');
          if (!ok) {
            toast.error(`Unsupported or invalid audio file: ${file.name}`);
            continue;
          }
          await enqueueMediaUpload({
            id: mid,
            uid,
            cid,
            kind: 'audio',
            fileName: file.name,
            mimeType: file.type,
            sizeBytes: file.size,
            caption: '',
            fileBlob: file,
            thumbBlob: null,
            width: null,
            height: null,
            durationMs: null,
            waveform: [],
            replyTo: null,
            status: 'queued',
            progress: 0,
            errorMessage: null,
            createdAt: Date.now(),
          });
        } else {
          await enqueueMediaUpload({
            id: mid,
            uid,
            cid,
            kind: 'document',
            fileName: file.name,
            mimeType: file.type || 'application/octet-stream',
            sizeBytes: file.size,
            caption: '',
            fileBlob: file,
            thumbBlob: null,
            width: null,
            height: null,
            durationMs: null,
            waveform: [],
            replyTo: null,
            status: 'queued',
            progress: 0,
            errorMessage: null,
            createdAt: Date.now(),
          });
        }
      } catch (err) {
        toast.error(err instanceof Error ? err.message : `Failed to prepare ${file.name}`);
      }
    }
    onCancelReply();
  };

  const handleSubmit = async () => {
    const trimmed = text.trim();
    if (!trimmed || sending || disabled) return;
    setSending(true);
    try {
      if (editingMessage) {
        await onSaveEdit(editingMessage.id, trimmed);
        setText('');
        onCancelEdit();
      } else {
        await onSendText(trimmed, mentionedUids);
        setText('');
        setMentionedUids([]);
        if (uid) {
          void saveDraft(uid, cid, '', null);
          void clearTypingActive(cid, uid);
        }
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to send message.');
    } finally {
      setSending(false);
    }
  };

  const handleStartVoice = async () => {
    if (!uid || disabled) return;
    try {
      const controller = await startVoiceRecording();
      recorderRef.current = controller;
      setRecordSec(0);
      setRecording(true);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Microphone access unavailable.');
    }
  };

  const handleStopAndSendVoice = async () => {
    if (!uid || !recorderRef.current) return;
    setRecording(false);
    setRecordSec(0);
    try {
      const res = await recorderRef.current.stop();
      recorderRef.current = null;
      await enqueueMediaUpload({
        id: generateClientId(),
        uid,
        cid,
        kind: 'voice',
        fileName: `voice-${Date.now()}.webm`,
        mimeType: res.mimeType,
        sizeBytes: res.blob.size,
        caption: '',
        fileBlob: res.blob,
        thumbBlob: null,
        width: null,
        height: null,
        durationMs: res.durationMs,
        waveform: res.waveform,
        replyTo: null,
        status: 'queued',
        progress: 0,
        errorMessage: null,
        createdAt: Date.now(),
      });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Voice note failed.');
    }
  };

  const handleCancelVoice = () => {
    recorderRef.current?.cancel();
    recorderRef.current = null;
    setRecording(false);
    setRecordSec(0);
  };

  const filteredMentions =
    mentionQuery !== null
      ? mentionOptions
          .filter(
            (m) =>
              m.displayName.toLowerCase().includes(mentionQuery) ||
              (m.username ?? '').toLowerCase().includes(mentionQuery),
          )
          .slice(0, 6)
      : [];

  if (disabled) {
    return (
      <div className="border-t border-border bg-surface-muted px-4 py-3 text-center text-xs text-text-secondary">
        {disabledReason || 'Messaging is disabled in this conversation.'}
      </div>
    );
  }

  return (
    <div
      className="relative border-t border-border bg-surface-sunken px-3 py-2"
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => {
        e.preventDefault();
        if (e.dataTransfer.files.length > 0) {
          void handleFilesSelected(e.dataTransfer.files);
        }
      }}
    >
      {filteredMentions.length > 0 && (
        <div className="absolute bottom-full left-3 right-3 mb-2 rounded-xl border border-border bg-surface-raised p-1.5 shadow-lg">
          {filteredMentions.map((m) => (
            <button
              key={m.uid}
              type="button"
              onClick={() => {
                const handle = m.username || m.displayName.replace(/\s+/g, '');
                setText((prev) => prev.replace(/@([a-zA-Z0-9_.]*)$/, `@${handle} `));
                setMentionedUids((prev) => Array.from(new Set([...prev, m.uid])));
                setMentionQuery(null);
                textareaRef.current?.focus();
              }}
              className="flex w-full items-center justify-between rounded-lg px-3 py-1.5 text-left text-xs hover:bg-surface-muted"
            >
              <span className="font-semibold text-text-primary">{m.displayName}</span>
              {m.username && <span className="text-text-secondary">@{m.username}</span>}
            </button>
          ))}
        </div>
      )}

      {(replyTo || editingMessage) && (
        <div className="mb-2 flex items-center justify-between rounded-xl border-l-4 border-primary bg-surface-muted px-3 py-1.5 text-xs">
          <div className="min-w-0">
            <p className="font-semibold text-primary">
              {editingMessage ? 'Editing message' : 'Replying to message'}
            </p>
            <p className="truncate text-text-secondary">
              {(editingMessage ?? replyTo)?.text || (editingMessage ?? replyTo)?.type}
            </p>
          </div>
          <IconButton
            size="sm"
            label="Cancel"
            onClick={() => {
              if (editingMessage) {
                setText('');
                onCancelEdit();
              } else {
                onCancelReply();
              }
            }}
          >
            <X className="h-4 w-4" />
          </IconButton>
        </div>
      )}

      {recording ? (
        <div className="flex items-center justify-between gap-3 rounded-xl bg-danger/10 px-3 py-2">
          <div className="flex items-center gap-2 text-xs font-semibold text-danger">
            <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-danger" />
            <span>Recording voice note… {recordSec}s</span>
          </div>
          <div className="flex items-center gap-2">
            <IconButton label="Cancel recording" onClick={handleCancelVoice} size="sm">
              <Trash2 className="h-4 w-4 text-danger" />
            </IconButton>
            <button
              type="button"
              onClick={() => void handleStopAndSendVoice()}
              className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-white hover:bg-primary-hover"
            >
              <Square className="h-3.5 w-3.5 fill-current" /> Send
            </button>
          </div>
        </div>
      ) : (
        <div className="flex items-end gap-1.5">
          <EmojiPickerPopover
            onSelectEmoji={(emoji) => {
              setText((prev) => `${prev}${emoji}`);
              textareaRef.current?.focus();
            }}
          />

          <input
            ref={fileInputRef}
            type="file"
            multiple
            className="hidden"
            onChange={(e) => {
              if (e.target.files) void handleFilesSelected(e.target.files);
              e.target.value = '';
            }}
          />
          <IconButton label="Attach file" onClick={() => fileInputRef.current?.click()}>
            <Paperclip className="h-5 w-5" />
          </IconButton>

          <textarea
            ref={textareaRef}
            rows={1}
            maxLength={LIMITS.MESSAGE_TEXT_MAX}
            value={text}
            onChange={(e) => handleTextChange(e.target.value)}
            onPaste={(e) => {
              const items = Array.from(e.clipboardData.files);
              if (items.length > 0) {
                e.preventDefault();
                void handleFilesSelected(items);
              }
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                void handleSubmit();
              } else if (e.key === 'ArrowUp' && !text && lastOwnEditableMessage) {
                e.preventDefault();
                onStartEditLast();
              }
            }}
            placeholder="Type a message"
            aria-label="Message input"
            className="max-h-32 min-h-[42px] flex-1 resize-none rounded-xl border border-transparent bg-surface-raised px-3.5 py-2.5 text-sm text-text-primary placeholder:text-text-tertiary focus:border-brand/50 focus:outline-none"
          />

          {text.trim() ? (
            <button
              type="button"
              disabled={sending}
              onClick={() => void handleSubmit()}
              aria-label="Send message"
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand text-white hover:bg-brand-hover disabled:opacity-60 transition-colors"
            >
              <Send className="h-4 w-4" />
            </button>
          ) : (
            <IconButton label="Record voice note" onClick={() => void handleStartVoice()}>
              <Mic className="h-5 w-5" />
            </IconButton>
          )}
        </div>
      )}
    </div>
  );
};
