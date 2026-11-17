import React, { useState } from 'react';
import { Bell, HardDrive, Monitor, Moon, Sun } from 'lucide-react';
import { Button, Switch, toast } from '@/components/ui';
import { mapFirebaseError } from '@/lib/errors';
import { clearUserLocalData } from '@/lib/idb';
import { useTheme } from '@/hooks/useTheme';
import { useAuthStore, requestDataExport } from '@/features/auth';
import { enablePushNotifications } from '@/features/notifications';
import { PrivacySettingsPanel, updateUserSettings } from '@/features/privacy';
import { ProfileEditor } from '@/features/profile';

export const ProfileSettingsPage: React.FC = () => (
  <div className="space-y-4">
    <div>
      <h2 className="text-lg font-bold text-text-primary">Profile</h2>
      <p className="text-xs text-text-secondary">Update your photo, display name, username, and about.</p>
    </div>
    <ProfileEditor />
  </div>
);

export const PrivacySettingsPage: React.FC = () => (
  <div className="space-y-4">
    <div>
      <h2 className="text-lg font-bold text-text-primary">Privacy &amp; blocks</h2>
      <p className="text-xs text-text-secondary">
        Control who sees your profile details, presence, read receipts, and status updates.
      </p>
    </div>
    <PrivacySettingsPanel />
  </div>
);

export const NotificationsSettingsPage: React.FC = () => {
  const uid = useAuthStore((s) => s.authUser?.uid ?? null);
  const settings = useAuthStore((s) => s.settings);
  const [busy, setBusy] = useState(false);

  if (!uid || !settings) return null;

  const toggle = async (key: keyof typeof settings.notifications, value: boolean) => {
    try {
      await updateUserSettings(
        uid,
        (cur) => ({ ...cur, notifications: { ...cur.notifications, [key]: value } }),
        settings,
      );
      toast.success('Notification preference updated.');
    } catch (err) {
      toast.error(mapFirebaseError(err).userMessage);
    }
  };

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-lg font-bold text-text-primary">Notifications</h2>
        <p className="text-xs text-text-secondary">Configure browser push registration and alerts.</p>
      </div>

      <div className="flex items-center justify-between rounded-xl border border-border bg-surface-raised p-4">
        <div className="flex items-center gap-3">
          <Bell className="h-5 w-5 text-primary" />
          <div>
            <p className="text-sm font-semibold text-text-primary">Browser push notifications</p>
            <p className="text-xs text-text-secondary">
              Status: {typeof Notification !== 'undefined' ? Notification.permission : 'unsupported'}
            </p>
          </div>
        </div>
        <Button
          size="sm"
          loading={busy}
          onClick={async () => {
            setBusy(true);
            try {
              const res = await enablePushNotifications();
              if (res.granted) toast.success(res.reason || 'Push registered.');
              else toast.info(res.reason || 'Permission not granted.');
            } finally {
              setBusy(false);
            }
          }}
        >
          Register device
        </Button>
      </div>

      <div className="rounded-xl border border-border bg-surface-raised p-4 space-y-4">
        <Switch
          checked={settings.notifications.messages}
          onCheckedChange={(v) => void toggle('messages', v)}
          label="Direct messages"
        />
        <Switch
          checked={settings.notifications.groups}
          onCheckedChange={(v) => void toggle('groups', v)}
          label="Group messages &amp; mentions"
        />
        <Switch
          checked={settings.notifications.calls}
          onCheckedChange={(v) => void toggle('calls', v)}
          label="Incoming &amp; missed calls"
        />
        <Switch
          checked={settings.notifications.statusUpdates}
          onCheckedChange={(v) => void toggle('statusUpdates', v)}
          label="Status replies"
        />
        <Switch
          checked={settings.notifications.showPreviews}
          onCheckedChange={(v) => void toggle('showPreviews', v)}
          label="Show message previews in notifications"
        />
      </div>
    </div>
  );
};

export const AppearanceSettingsPage: React.FC = () => {
  const uid = useAuthStore((s) => s.authUser?.uid ?? null);
  const settings = useAuthStore((s) => s.settings);
  const { theme, setTheme } = useTheme();

  const handleSelect = async (next: 'light' | 'dark' | 'system') => {
    setTheme(next);
    if (!uid || !settings) return;
    await updateUserSettings(uid, (cur) => ({ ...cur, theme: next }), settings).catch(() => undefined);
    toast.success(`Theme set to ${next}.`);
  };

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-bold text-text-primary">Appearance</h2>
        <p className="text-xs text-text-secondary">Choose light, dark, or system-matched theme.</p>
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        {(
          [
            { id: 'light', label: 'Light', icon: Sun },
            { id: 'dark', label: 'Dark', icon: Moon },
            { id: 'system', label: 'System', icon: Monitor },
          ] as const
        ).map((item) => {
          const Icon = item.icon;
          const active = theme === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => void handleSelect(item.id)}
              className={`flex flex-col items-center gap-2 rounded-2xl border p-4 text-sm font-medium transition-colors ${
                active
                  ? 'border-primary bg-primary/10 text-primary'
                  : 'border-border bg-surface-raised text-text-primary hover:bg-surface-muted'
              }`}
            >
              <Icon className="h-5 w-5" />
              <span>{item.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
};

export const ChatsSettingsPage: React.FC = () => {
  const [exporting, setExporting] = useState(false);

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-bold text-text-primary">Chats &amp; export</h2>
        <p className="text-xs text-text-secondary">
          Server-synced conversations and downloadable JSON history archive.
        </p>
      </div>
      <div className="rounded-xl border border-border bg-surface-raised p-4 space-y-3">
        <p className="text-xs text-text-secondary">
          Your recent messages are cached locally in IndexedDB/Firestore persistence for offline reading and searched per-device. Export a full account snapshot via Cloud Functions.
        </p>
        <Button
          size="sm"
          loading={exporting}
          onClick={async () => {
            setExporting(true);
            try {
              const res = await requestDataExport();
              toast.success(`Export saved to ${res.storagePath}`);
            } catch (err) {
              toast.error(mapFirebaseError(err).userMessage);
            } finally {
              setExporting(false);
            }
          }}
        >
          Generate JSON backup
        </Button>
      </div>
    </div>
  );
};

export const StorageSettingsPage: React.FC = () => {
  const uid = useAuthStore((s) => s.authUser?.uid ?? null);
  const [clearing, setClearing] = useState(false);
  const navConn = (navigator as Navigator & { connection?: { effectiveType?: string; saveData?: boolean } }).connection;

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-bold text-text-primary">Storage &amp; network</h2>
        <p className="text-xs text-text-secondary">Manage local search cache, drafts, and media outbox.</p>
      </div>
      <div className="rounded-xl border border-border bg-surface-raised p-4 space-y-3">
        <div className="flex items-center gap-2 text-sm font-semibold text-text-primary">
          <HardDrive className="h-4 w-4 text-primary" />
          <span>Local device cache</span>
        </div>
        {navConn && (
          <p className="text-xs text-text-secondary">
            Detected connection: {navConn.effectiveType || 'unknown'}{' '}
            {navConn.saveData ? '(Data Saver enabled)' : ''}
          </p>
        )}
        <Button
          size="sm"
          variant="secondary"
          loading={clearing}
          onClick={async () => {
            if (!uid) return;
            setClearing(true);
            await clearUserLocalData(uid);
            setClearing(false);
            toast.success('Local search index, drafts, and upload outbox cleared.');
          }}
        >
          Clear local cache &amp; search index
        </Button>
      </div>
    </div>
  );
};

const PLATFORM_MATRIX = [
  ['iOS background push notifications', 'Requires PWA installed via Share -> Add to Home Screen (iOS 16.4+)'],
  ['True VoIP full-screen incoming call wakeup', 'Web apps rely on standard notifications when closed; full-screen ringing only while open'],
  ['Automatic background address book sync', 'Not supported on web; opt-in via Contact Picker API or .vcf/.csv import'],
  ['Audio output (earpiece/speaker) selection', 'Chrome/Edge desktop via setSinkId(); unavailable on iOS Safari'],
  ['Service Worker offline queue flush', 'Best-effort; Safari lacks Background Sync API and flushes on app reopen'],
  ['End-to-end encryption (E2EE)', 'Not implemented; messages protected in transit (TLS) and at rest by Google Cloud'],
  ['Multi-party group audio/video calls', 'Requires SFU media server; only 1:1 WebRTC calls are implemented'],
];

export const PlatformNotesPage: React.FC = () => (
  <div className="space-y-4">
    <div>
      <h2 className="text-lg font-bold text-text-primary">Web &amp; PWA platform limitations</h2>
      <p className="text-xs text-text-secondary">
        Transparent disclosure of browser and operating system capabilities compared to native binaries.
      </p>
    </div>
    <div className="overflow-hidden rounded-xl border border-border bg-surface-raised">
      <table className="w-full text-left text-xs">
        <thead className="border-b border-border bg-surface-muted text-text-secondary">
          <tr>
            <th className="px-4 py-2.5 font-semibold">Capability</th>
            <th className="px-4 py-2.5 font-semibold">Web / PWA Reality</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {PLATFORM_MATRIX.map(([cap, reality]) => (
            <tr key={cap}>
              <td className="px-4 py-3 font-medium text-text-primary">{cap}</td>
              <td className="px-4 py-3 text-text-secondary">{reality}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  </div>
);

export const AboutPage: React.FC = () => (
  <div className="space-y-4">
    <div>
      <h2 className="text-lg font-bold text-text-primary">About WhatsApp Web</h2>
      <p className="text-xs text-text-secondary">Version 1.0.0 · Progressive Web Messenger</p>
    </div>
    <div className="rounded-xl border border-border bg-surface-raised p-4 space-y-2 text-xs text-text-secondary">
      <p className="font-semibold text-text-primary">Security &amp; Encryption Notice</p>
      <p>
        Connections are secured using HTTPS/TLS in transit and stored data is encrypted at rest on Google Cloud / Firebase infrastructure. This web clone does not claim or provide Signal-protocol end-to-end encryption.
      </p>
      <p className="pt-2 font-semibold text-text-primary">Data Handling</p>
      <p>
        Contact discovery phone lists are hashed transiently server-side and never persisted. Status updates expire after 24 hours and are cleaned up on schedule. You can export your JSON data archive or permanently delete your account at any time under Account &amp; security.
      </p>
    </div>
  </div>
);
