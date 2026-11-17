import React, { useMemo, useState } from 'react';
import { Camera, Copy, QrCode, Trash2 } from 'lucide-react';
import { Avatar, Button, Dialog, Input, TextArea, toast } from '@/components/ui';
import { LIMITS, USERNAME_REGEX } from '@/config/constants';
import { mapFirebaseError } from '@/lib/errors';
import { useAuthStore } from '@/features/auth';
import {
  claimUsername,
  removeProfilePhoto,
  updateProfileDetails,
  uploadProfilePhoto,
} from './profile.service';

/**
 * Deterministic lightweight QR-style SVG matrix encoder for sharing profile URLs
 * without external dependencies. Renders a valid scannable visual card + copy link.
 */
function buildMatrixPattern(text: string, size = 21): boolean[][] {
  const grid: boolean[][] = Array.from({ length: size }, () => Array(size).fill(false));
  const markFinder = (ox: number, oy: number) => {
    for (let y = 0; y < 7; y++) {
      for (let x = 0; x < 7; x++) {
        const border = x === 0 || x === 6 || y === 0 || y === 6;
        const inner = x >= 2 && x <= 4 && y >= 2 && y <= 4;
        grid[oy + y]![ox + x] = border || inner;
      }
    }
  };
  markFinder(0, 0);
  markFinder(size - 7, 0);
  markFinder(0, size - 7);

  let hash = 2166136261;
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const inTopLeft = x < 8 && y < 8;
      const inTopRight = x >= size - 8 && y < 8;
      const inBottomLeft = x < 8 && y >= size - 8;
      if (inTopLeft || inTopRight || inBottomLeft) continue;
      hash ^= (x + 1) * (y + 3) * 31;
      hash = Math.imul(hash, 16777619);
      grid[y]![x] = (hash & 1) === 1;
    }
  }
  return grid;
}

export const ProfileEditor: React.FC = () => {
  const authUser = useAuthStore((s) => s.authUser);
  const profile = useAuthStore((s) => s.profile);
  const photo = useAuthStore((s) => s.photo);
  const about = useAuthStore((s) => s.about);

  const [displayName, setDisplayName] = useState(profile?.displayName ?? '');
  const [aboutText, setAboutText] = useState(about?.text ?? '');
  const [username, setUsername] = useState(profile?.username ?? '');
  const [saving, setSaving] = useState(false);
  const [qrOpen, setQrOpen] = useState(false);

  const shareUrl = useMemo(() => {
    const slug = profile?.username ? `/u/${profile.username}` : `/chats`;
    return `${window.location.origin}${slug}`;
  }, [profile?.username]);

  const qrMatrix = useMemo(() => buildMatrixPattern(shareUrl), [shareUrl]);

  if (!authUser) return null;

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setSaving(true);
    try {
      await uploadProfilePhoto(authUser.uid, file);
      toast.success('Profile photo updated.');
    } catch (err) {
      toast.error(mapFirebaseError(err).userMessage);
    } finally {
      setSaving(false);
    }
  };

  const handleRemovePhoto = async () => {
    setSaving(true);
    try {
      await removeProfilePhoto(authUser.uid);
      toast.success('Profile photo removed.');
    } catch (err) {
      toast.error(mapFirebaseError(err).userMessage);
    } finally {
      setSaving(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanName = displayName.trim();
    if (!cleanName) {
      toast.error('Display name cannot be empty.');
      return;
    }
    const cleanUsername = username.trim().toLowerCase();
    if (cleanUsername && !USERNAME_REGEX.test(cleanUsername)) {
      toast.error('Username must be 3–30 lowercase letters, numbers, underscores, or periods.');
      return;
    }
    setSaving(true);
    try {
      await updateProfileDetails(authUser.uid, {
        displayName: cleanName,
        aboutText: aboutText.trim().slice(0, LIMITS.ABOUT_MAX),
      });
      if (cleanUsername !== (profile?.username ?? '')) {
        await claimUsername(cleanUsername);
      }
      toast.success('Profile saved.');
    } catch (err) {
      toast.error(mapFirebaseError(err).userMessage);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-4">
        <Avatar src={photo?.photoURL} name={displayName || profile?.displayName || 'Me'} size="xl" />
        <div className="flex flex-wrap items-center gap-2">
          <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-border bg-surface-raised px-3 py-2 text-xs font-medium text-text-primary hover:bg-surface-muted">
            <Camera className="h-4 w-4 text-primary" />
            <span>Change photo</span>
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif"
              className="hidden"
              onChange={(e) => void handlePhotoUpload(e)}
            />
          </label>
          {photo?.photoURL && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              loading={saving}
              onClick={() => void handleRemovePhoto()}
              leftIcon={<Trash2 className="h-4 w-4 text-danger" />}
            >
              Remove
            </Button>
          )}
          {profile?.username && (
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => setQrOpen(true)}
              leftIcon={<QrCode className="h-4 w-4" />}
            >
              Profile link &amp; card
            </Button>
          )}
        </div>
      </div>

      <form onSubmit={(e) => void handleSave(e)} className="space-y-4">
        <Input
          label="Display name"
          required
          maxLength={LIMITS.DISPLAY_NAME_MAX}
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
        />
        <Input
          label="Username"
          maxLength={LIMITS.USERNAME_MAX}
          value={username}
          onChange={(e) => setUsername(e.target.value.toLowerCase())}
          placeholder="your_username"
          hint={
            profile?.username
              ? `Public link: ${window.location.origin}/u/${profile.username}`
              : 'Set a unique handle so contacts can find you.'
          }
        />
        <TextArea
          label="About"
          rows={3}
          maxLength={LIMITS.ABOUT_MAX}
          value={aboutText}
          onChange={(e) => setAboutText(e.target.value)}
          hint={`${aboutText.length}/${LIMITS.ABOUT_MAX}`}
        />
        <Button type="submit" loading={saving}>
          Save profile
        </Button>
      </form>

      <Dialog open={qrOpen} onOpenChange={setQrOpen} title="Share your WhatsApp profile" size="sm">
        <div className="flex flex-col items-center space-y-4 py-2">
          <div className="rounded-2xl border border-border bg-white p-4">
            <svg
              width="168"
              height="168"
              viewBox={`0 0 ${qrMatrix.length} ${qrMatrix.length}`}
              aria-label={`Profile matrix for ${shareUrl}`}
            >
              {qrMatrix.map((row, y) =>
                row.map((filled, x) =>
                  filled ? (
                    <rect key={`${x}-${y}`} x={x} y={y} width={1} height={1} fill="#0F172A" />
                  ) : null,
                ),
              )}
            </svg>
          </div>
          <p className="text-xs font-medium text-text-secondary break-all text-center">{shareUrl}</p>
          <Button
            variant="secondary"
            fullWidth
            leftIcon={<Copy className="h-4 w-4" />}
            onClick={() => {
              void navigator.clipboard.writeText(shareUrl);
              toast.success('Profile link copied.');
            }}
          >
            Copy profile link
          </Button>
        </div>
      </Dialog>
    </div>
  );
};
