import React, { useState } from 'react';
import { Image, Type } from 'lucide-react';
import { Button, Dialog, Input, Tabs, toast } from '@/components/ui';
import { LIMITS, STATUS_BACKGROUNDS, STATUS_FONTS } from '@/config/constants';
import { mapFirebaseError } from '@/lib/errors';
import { useAuthStore } from '@/features/auth';
import { createMediaStatus, createTextStatus } from './status.service';

export interface CreateStatusModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const CreateStatusModal: React.FC<CreateStatusModalProps> = ({ open, onOpenChange }) => {
  const uid = useAuthStore((s) => s.authUser?.uid ?? null);
  const [mode, setMode] = useState<'text' | 'media'>('text');
  const [text, setText] = useState('');
  const [bgId, setBgId] = useState<string>(STATUS_BACKGROUNDS[0].id);
  const [fontId, setFontId] = useState<string>(STATUS_FONTS[0].id);
  const [file, setFile] = useState<File | null>(null);
  const [caption, setCaption] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const selectedBg = STATUS_BACKGROUNDS.find((b) => b.id === bgId) ?? STATUS_BACKGROUNDS[0];
  const selectedFont = STATUS_FONTS.find((f) => f.id === fontId) ?? STATUS_FONTS[0];

  const handlePublish = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!uid) return;
    setSubmitting(true);
    try {
      if (mode === 'text') {
        if (!text.trim()) {
          toast.error('Write something before posting.');
          return;
        }
        await createTextStatus({
          text,
          backgroundColor: bgId,
          fontStyle: fontId,
        });
      } else {
        if (!file) {
          toast.error('Select a photo or video first.');
          return;
        }
        await createMediaStatus({ uid, file, caption });
      }
      toast.success('Status update published for 24 hours.');
      setText('');
      setFile(null);
      setCaption('');
      onOpenChange(false);
    } catch (err) {
      toast.error(mapFirebaseError(err).userMessage);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title="New status update"
      description="Visible to your configured audience for 24 hours."
      size="md"
    >
      <form onSubmit={(e) => void handlePublish(e)} className="space-y-4">
        <Tabs
          value={mode}
          onValueChange={(v) => setMode(v as 'text' | 'media')}
          items={[
            { value: 'text', label: 'Text status', icon: <Type className="h-3.5 w-3.5" /> },
            { value: 'media', label: 'Photo / Video', icon: <Image className="h-3.5 w-3.5" /> },
          ]}
        />

        {mode === 'text' ? (
          <>
            <div
              className={`flex min-h-[180px] items-center justify-center rounded-2xl p-6 text-center ${selectedBg.className} ${selectedFont.className}`}
            >
              <textarea
                rows={4}
                maxLength={LIMITS.STATUS_TEXT_MAX}
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="Share an update..."
                aria-label="Status text"
                className="w-full resize-none bg-transparent text-center text-lg placeholder:text-white/60 focus:outline-none"
              />
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-1.5">
                {STATUS_BACKGROUNDS.map((bg) => (
                  <button
                    key={bg.id}
                    type="button"
                    aria-label={bg.label}
                    onClick={() => setBgId(bg.id)}
                    className={`h-6 w-6 rounded-full border-2 ${bg.className} ${
                      bgId === bg.id ? 'border-text-primary scale-110' : 'border-transparent'
                    }`}
                  />
                ))}
              </div>
              <div className="flex items-center gap-1.5">
                {STATUS_FONTS.map((f) => (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => setFontId(f.id)}
                    className={`rounded-lg px-2 py-1 text-xs ${
                      fontId === f.id
                        ? 'bg-primary text-white'
                        : 'bg-surface-muted text-text-secondary'
                    }`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
            </div>
          </>
        ) : (
          <div className="space-y-3">
            <label className="flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed border-border p-6 text-center hover:bg-surface-muted">
              <span className="text-sm font-medium text-text-primary">
                {file ? file.name : 'Choose a photo or short video (max 30s)'}
              </span>
              <span className="mt-1 text-xs text-text-secondary">
                JPEG, PNG, WebP, GIF, MP4, or WebM
              </span>
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif,video/mp4,video/webm,video/quicktime"
                className="hidden"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              />
            </label>
            <Input
              label="Caption (optional)"
              maxLength={LIMITS.STATUS_CAPTION_MAX}
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              placeholder="Add a caption..."
            />
          </div>
        )}

        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="submit" loading={submitting}>
            Publish status
          </Button>
        </div>
      </form>
    </Dialog>
  );
};
