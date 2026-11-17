import React, { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Bell, Camera, CheckCircle2, UserCheck } from 'lucide-react';
import { Avatar, Button, Input, TextArea, toast } from '@/components/ui';
import { LIMITS, USERNAME_REGEX } from '@/config/constants';
import { mapFirebaseError } from '@/lib/errors';
import { updateProfileDetails, uploadProfilePhoto, claimUsername } from '@/features/profile/profile.service';
import { enablePushNotifications } from '@/features/notifications/notifications.service';
import { ensureProfileBootstrapped } from './auth.service';
import { useAuthStore } from './authStore';

export const OnboardingPage: React.FC = () => {
  const authUser = useAuthStore((s) => s.authUser);
  const profile = useAuthStore((s) => s.profile);
  const photo = useAuthStore((s) => s.photo);
  const about = useAuthStore((s) => s.about);
  const setNeedsOnboarding = useAuthStore((s) => s.setNeedsOnboarding);
  const navigate = useNavigate();
  const location = useLocation();

  const initialDisplayName =
    profile?.displayName && profile.displayName !== authUser?.phoneNumber
      ? profile.displayName
      : (authUser?.displayName ?? '');

  const [displayName, setDisplayName] = useState(initialDisplayName);
  const [username, setUsername] = useState(profile?.username ?? '');
  const [aboutText, setAboutText] = useState(about?.text ?? 'Hey there! I am using WhatsApp.');
  const [photoPreview, setPhotoPreview] = useState<string | null>(
    photo?.photoURL ?? authUser?.photoURL ?? null,
  );
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [notifStatus, setNotifStatus] = useState<'idle' | 'granted' | 'skipped'>('idle');
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const params = new URLSearchParams(location.search);
  const redirectParam = params.get('redirect');
  const nextRoute = redirectParam && redirectParam.startsWith('/') ? redirectParam : '/chats';

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setSelectedFile(file);
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') setPhotoPreview(reader.result);
    };
    reader.readAsDataURL(file);
  };

  const handleRequestNotifications = async () => {
    try {
      const res = await enablePushNotifications();
      if (res.granted) {
        setNotifStatus('granted');
        toast.success('Notifications enabled for this browser.');
      } else {
        setNotifStatus('skipped');
        toast.info(res.reason ?? 'Notifications remain disabled. You can enable them later in Settings.');
      }
    } catch (err) {
      setNotifStatus('skipped');
      toast.info(mapFirebaseError(err).userMessage);
    }
  };

  const handleFinish = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!authUser) return;
    setErrorMsg(null);
    const cleanName = displayName.trim();
    if (cleanName.length < LIMITS.DISPLAY_NAME_MIN || cleanName.length > LIMITS.DISPLAY_NAME_MAX) {
      setErrorMsg('Display name must be between 1 and 60 characters.');
      return;
    }
    const cleanUsername = username.trim().toLowerCase();
    if (cleanUsername && !USERNAME_REGEX.test(cleanUsername)) {
      setErrorMsg('Username must be 3–30 lowercase letters, numbers, underscores, or periods.');
      return;
    }

    setSaving(true);
    try {
      await ensureProfileBootstrapped(authUser, cleanName);
      await updateProfileDetails(authUser.uid, {
        displayName: cleanName,
        aboutText: aboutText.trim().slice(0, LIMITS.ABOUT_MAX),
      });
      if (selectedFile) {
        await uploadProfilePhoto(authUser.uid, selectedFile);
      }
      if (cleanUsername && cleanUsername !== profile?.username) {
        await claimUsername(cleanUsername);
      }
      setNeedsOnboarding(false);
      toast.success('Profile setup complete!');
      navigate(nextRoute, { replace: true });
    } catch (err) {
      setErrorMsg(mapFirebaseError(err).userMessage);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex min-h-dvh w-full items-center justify-center bg-surface px-4 py-8">
      <form
        onSubmit={handleFinish}
        className="w-full max-w-lg space-y-5 rounded-2xl border border-border bg-surface-raised p-6 shadow-sm sm:p-8"
      >
        <div>
          <h1 className="text-xl font-bold text-text-primary">Profile info</h1>
          <p className="mt-1 text-xs text-text-secondary">
            Choose how contacts see you across conversations and calls.
          </p>
        </div>

        <div className="flex items-center gap-4">
          <Avatar src={photoPreview} name={displayName || 'User'} size="xl" />
          <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-border bg-surface-muted px-3 py-2 text-xs font-medium text-text-primary hover:bg-surface-sunken">
            <Camera className="h-4 w-4 text-primary" />
            <span>Upload profile photo</span>
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif"
              className="hidden"
              onChange={handlePhotoChange}
            />
          </label>
        </div>

        <Input
          label="Display name"
          required
          maxLength={LIMITS.DISPLAY_NAME_MAX}
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          placeholder="How people see your name"
        />

        <Input
          label="Username (optional)"
          maxLength={LIMITS.USERNAME_MAX}
          value={username}
          onChange={(e) => setUsername(e.target.value.toLowerCase())}
          placeholder="alex_morgan"
          hint="3–30 characters: a-z, 0-9, underscore, or period. Shareable at /u/username."
        />

        <TextArea
          label="About"
          rows={2}
          maxLength={LIMITS.ABOUT_MAX}
          value={aboutText}
          onChange={(e) => setAboutText(e.target.value)}
          hint={`${aboutText.length}/${LIMITS.ABOUT_MAX}`}
        />

        <div className="rounded-xl border border-border bg-surface-muted p-4 space-y-3">
          <div className="flex items-start gap-3">
            <Bell className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-text-primary">Push notifications</p>
              <p className="text-xs text-text-secondary">
                Receive alerts for incoming messages and calls when WhatsApp is in the background.
              </p>
            </div>
            {notifStatus === 'granted' ? (
              <span className="inline-flex items-center gap-1 text-xs font-medium text-accent">
                <CheckCircle2 className="h-4 w-4" /> Enabled
              </span>
            ) : (
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => void handleRequestNotifications()}
              >
                Enable
              </Button>
            )}
          </div>
          <div className="flex items-start gap-3 border-t border-border pt-3">
            <UserCheck className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
            <p className="text-xs text-text-secondary">
              Contact discovery is always opt-in. After setup you can find friends by phone number, username, or vCard import without granting background contact access.
            </p>
          </div>
        </div>

        {errorMsg && (
          <p className="rounded-lg bg-danger/10 px-3 py-2 text-xs text-danger" role="alert">
            {errorMsg}
          </p>
        )}

        <div className="flex items-center justify-end gap-3 pt-2">
          <Button type="submit" fullWidth loading={saving}>
            Continue to WhatsApp
          </Button>
        </div>
      </form>
    </div>
  );
};
