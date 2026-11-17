import React, { useEffect, useState } from 'react';
import { Ban, Shield } from 'lucide-react';
import { Avatar, Button, Select, Switch, toast } from '@/components/ui';
import { mapFirebaseError } from '@/lib/errors';
import { useAuthStore } from '@/features/auth';
import { fetchUserSummary, type HydratedUserSummary } from '@/features/profile';
import type { GroupAddPolicy, PrivacyAudience, StatusAudienceMode } from '@/types';
import { patchPrivacySettings, unblockUser, useBlockedUsers } from './privacy.service';

const AUDIENCE_OPTIONS = [
  { value: 'everyone', label: 'Everyone' },
  { value: 'contacts', label: 'My contacts' },
  { value: 'nobody', label: 'Nobody' },
];

const GROUP_ADD_OPTIONS = [
  { value: 'everyone', label: 'Everyone' },
  { value: 'contacts', label: 'My contacts only' },
];

const STATUS_AUDIENCE_OPTIONS = [
  { value: 'contacts', label: 'My contacts' },
  { value: 'excludeList', label: 'My contacts except...' },
  { value: 'onlyList', label: 'Only share with...' },
];

export const PrivacySettingsPanel: React.FC = () => {
  const uid = useAuthStore((s) => s.authUser?.uid ?? null);
  const settings = useAuthStore((s) => s.settings);
  const blocks = useBlockedUsers();
  const [blockedProfiles, setBlockedProfiles] = useState<Record<string, HydratedUserSummary>>({});

  useEffect(() => {
    let active = true;
    Promise.all(blocks.map((b) => fetchUserSummary(b.uid))).then((items) => {
      if (!active) return;
      const map: Record<string, HydratedUserSummary> = {};
      items.forEach((item) => {
        map[item.uid] = item;
      });
      setBlockedProfiles(map);
    });
    return () => {
      active = false;
    };
  }, [blocks]);

  if (!uid || !settings) return null;

  const updateField = async <K extends keyof typeof settings.privacy>(
    key: K,
    val: (typeof settings.privacy)[K],
  ) => {
    try {
      await patchPrivacySettings(uid, { [key]: val }, settings);
      toast.success('Privacy preference saved.');
    } catch (err) {
      toast.error(mapFirebaseError(err).userMessage);
    }
  };

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-border bg-surface-raised p-4 space-y-4">
        <div className="flex items-center gap-2 text-sm font-semibold text-text-primary">
          <Shield className="h-4 w-4 text-primary" />
          <span>Who can see my personal information</span>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Select
            label="Last seen & online status"
            value={settings.privacy.lastSeen}
            options={AUDIENCE_OPTIONS}
            onChange={(e) => {
              const v = e.target.value as PrivacyAudience;
              void patchPrivacySettings(uid, { lastSeen: v, onlineStatus: v }, settings)
                .then(() => toast.success('Presence privacy updated.'))
                .catch((err) => toast.error(mapFirebaseError(err).userMessage));
            }}
            hint="If you hide last seen, you also cannot see others' last seen."
          />
          <Select
            label="Profile photo"
            value={settings.privacy.profilePhoto}
            options={AUDIENCE_OPTIONS}
            onChange={(e) => void updateField('profilePhoto', e.target.value as PrivacyAudience)}
          />
          <Select
            label="About info"
            value={settings.privacy.about}
            options={AUDIENCE_OPTIONS}
            onChange={(e) => void updateField('about', e.target.value as PrivacyAudience)}
          />
          <Select
            label="Who can add me to groups"
            value={settings.privacy.groupAdd}
            options={GROUP_ADD_OPTIONS}
            onChange={(e) => void updateField('groupAdd', e.target.value as GroupAddPolicy)}
          />
          <Select
            label="Default status audience"
            value={settings.privacy.statusAudience.mode}
            options={STATUS_AUDIENCE_OPTIONS}
            onChange={(e) =>
              void updateField('statusAudience', {
                mode: e.target.value as StatusAudienceMode,
                uids: settings.privacy.statusAudience.uids,
              })
            }
          />
        </div>
      </div>

      <div className="rounded-xl border border-border bg-surface-raised p-4 space-y-4">
        <h3 className="text-sm font-semibold text-text-primary">Messaging &amp; discovery</h3>
        <Switch
          checked={settings.privacy.readReceipts}
          onCheckedChange={(v) => void updateField('readReceipts', v)}
          label="Read receipts"
          description="If turned off, you won't send or see read receipts in direct chats. Group receipts stay active."
        />
        <Switch
          checked={settings.privacy.typingIndicators}
          onCheckedChange={(v) => void updateField('typingIndicators', v)}
          label="Typing indicators"
          description="Show when you are actively typing a reply."
        />
        <Switch
          checked={settings.privacy.findableByPhone}
          onCheckedChange={(v) => void updateField('findableByPhone', v)}
          label="Findable by phone number"
        />
        <Switch
          checked={settings.privacy.findableByUsername}
          onCheckedChange={(v) => void updateField('findableByUsername', v)}
          label="Findable by username"
        />
      </div>

      <div className="rounded-xl border border-border bg-surface-raised p-4 space-y-3">
        <div className="flex items-center gap-2 text-sm font-semibold text-text-primary">
          <Ban className="h-4 w-4 text-danger" />
          <span>Blocked contacts ({blocks.length})</span>
        </div>
        {blocks.length === 0 ? (
          <p className="text-xs text-text-secondary">You have not blocked anyone.</p>
        ) : (
          <div className="divide-y divide-border">
            {blocks.map((block) => {
              const summary = blockedProfiles[block.uid];
              const name = summary?.profile?.displayName ?? block.uid;
              return (
                <div key={block.uid} className="flex items-center justify-between py-2.5">
                  <div className="flex items-center gap-3 min-w-0">
                    <Avatar src={summary?.photoURL} name={name} size="sm" />
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-text-primary">{name}</p>
                      {summary?.profile?.username && (
                        <p className="truncate text-xs text-text-secondary">
                          @{summary.profile.username}
                        </p>
                      )}
                    </div>
                  </div>
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() =>
                      void unblockUser(uid, block.uid)
                        .then(() => toast.success(`Unblocked ${name}.`))
                        .catch((err) => toast.error(mapFirebaseError(err).userMessage))
                    }
                  >
                    Unblock
                  </Button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
