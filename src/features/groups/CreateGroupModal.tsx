import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Avatar, Button, Checkbox, Dialog, Input, TextArea, toast } from '@/components/ui';
import { LIMITS } from '@/config/constants';
import { mapFirebaseError } from '@/lib/errors';
import { useContacts } from '@/features/contacts';
import { fetchUserSummary, type HydratedUserSummary } from '@/features/profile';
import { createGroupConversation } from './groups.service';

export interface CreateGroupModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const CreateGroupModal: React.FC<CreateGroupModalProps> = ({ open, onOpenChange }) => {
  const navigate = useNavigate();
  const { contacts } = useContacts();
  const [profiles, setProfiles] = useState<Record<string, HydratedUserSummary>>({});
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [selectedUids, setSelectedUids] = useState<string[]>([]);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    if (!open || contacts.length === 0) return;
    let active = true;
    Promise.all(contacts.map((c) => fetchUserSummary(c.uid))).then((items) => {
      if (!active) return;
      const map: Record<string, HydratedUserSummary> = {};
      items.forEach((s) => {
        map[s.uid] = s;
      });
      setProfiles(map);
    });
    return () => {
      active = false;
    };
  }, [open, contacts]);

  const toggleUid = (uid: string) => {
    setSelectedUids((prev) =>
      prev.includes(uid) ? prev.filter((id) => id !== uid) : [...prev, uid],
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      toast.error('Group name is required.');
      return;
    }
    setCreating(true);
    try {
      const res = await createGroupConversation({
        name: name.trim(),
        description: description.trim(),
        memberUids: selectedUids,
      });
      toast.success(`Group created with ${res.memberCount} member(s).`);
      setName('');
      setDescription('');
      setSelectedUids([]);
      onOpenChange(false);
      navigate(`/chats/${res.conversationId}`);
    } catch (err) {
      toast.error(mapFirebaseError(err).userMessage);
    } finally {
      setCreating(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title="Create a new group"
      description="Groups support up to 256 members."
      size="md"
    >
      <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4">
        <Input
          label="Group name"
          required
          maxLength={LIMITS.GROUP_NAME_MAX}
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Weekend hiking crew"
        />
        <TextArea
          label="Description (optional)"
          rows={2}
          maxLength={LIMITS.GROUP_DESC_MAX}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />

        <div>
          <p className="mb-1.5 text-xs font-medium text-text-secondary">
            Add contacts ({selectedUids.length} selected)
          </p>
          <div className="max-h-52 overflow-y-auto divide-y divide-border rounded-xl border border-border">
            {contacts.length === 0 ? (
              <p className="p-4 text-xs text-text-secondary">
                No saved contacts yet. You can still create the group and share an invite link.
              </p>
            ) : (
              contacts.map((c) => {
                const p = profiles[c.uid];
                const label = c.nickname || p?.profile?.displayName || c.uid;
                return (
                  <div
                    key={c.uid}
                    className="flex items-center justify-between gap-3 px-3 py-2 hover:bg-surface-muted"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <Avatar src={p?.photoURL} name={label} size="sm" />
                      <span className="truncate text-sm text-text-primary">{label}</span>
                    </div>
                    <Checkbox
                      aria-label={`Select ${label}`}
                      checked={selectedUids.includes(c.uid)}
                      onCheckedChange={() => toggleUid(c.uid)}
                    />
                  </div>
                );
              })
            )}
          </div>
        </div>

        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="submit" loading={creating}>
            Create group
          </Button>
        </div>
      </form>
    </Dialog>
  );
};
