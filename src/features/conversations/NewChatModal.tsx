import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, UserPlus } from 'lucide-react';
import { Avatar, Button, Dialog, EmptyState, Input, toast } from '@/components/ui';
import { mapFirebaseError } from '@/lib/errors';
import { useContacts, ContactDiscoveryModal } from '@/features/contacts';
import { fetchUserSummary, type HydratedUserSummary } from '@/features/profile';
import { startDirectConversation } from './conversations.service';

export interface NewChatModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const NewChatModal: React.FC<NewChatModalProps> = ({ open, onOpenChange }) => {
  const navigate = useNavigate();
  const { contacts } = useContacts();
  const [profiles, setProfiles] = useState<Record<string, HydratedUserSummary>>({});
  const [filter, setFilter] = useState('');
  const [discoveryOpen, setDiscoveryOpen] = useState(false);
  const [startingUid, setStartingUid] = useState<string | null>(null);

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

  const filtered = contacts.filter((c) => {
    const p = profiles[c.uid];
    const name = c.nickname || p?.profile?.displayName || c.uid;
    const q = filter.trim().toLowerCase();
    return !q || name.toLowerCase().includes(q) || (p?.profile?.username ?? '').includes(q);
  });

  const handleStart = async (targetUid: string) => {
    setStartingUid(targetUid);
    try {
      const cid = await startDirectConversation(targetUid);
      onOpenChange(false);
      navigate(`/chats/${cid}`);
    } catch (err) {
      toast.error(mapFirebaseError(err).userMessage);
    } finally {
      setStartingUid(null);
    }
  };

  return (
    <>
      <Dialog
        open={open}
        onOpenChange={onOpenChange}
        title="Start a conversation"
        description="Choose a contact or find someone by username, email, or phone."
        size="md"
      >
        <div className="space-y-4">
          <div className="flex gap-2">
            <div className="flex-1">
              <Input
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
                placeholder="Filter your contacts..."
                leftIcon={<Search className="h-4 w-4" />}
              />
            </div>
            <Button
              variant="secondary"
              leftIcon={<UserPlus className="h-4 w-4" />}
              onClick={() => setDiscoveryOpen(true)}
            >
              Find user
            </Button>
          </div>

          <div className="max-h-80 overflow-y-auto divide-y divide-border rounded-xl border border-border">
            {filtered.length === 0 ? (
              <div className="p-6">
                <EmptyState
                  title="No saved contacts"
                  description="Use Find user to look up someone by @username, email, or phone."
                  action={
                    <Button size="sm" onClick={() => setDiscoveryOpen(true)}>
                      Find people
                    </Button>
                  }
                />
              </div>
            ) : (
              filtered.map((c) => {
                const p = profiles[c.uid];
                const name = c.nickname || p?.profile?.displayName || 'WhatsApp User';
                return (
                  <button
                    key={c.uid}
                    type="button"
                    disabled={startingUid === c.uid}
                    onClick={() => void handleStart(c.uid)}
                    className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left hover:bg-surface-muted disabled:opacity-60"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <Avatar src={p?.photoURL} name={name} size="sm" />
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-text-primary">{name}</p>
                        {p?.aboutText && (
                          <p className="truncate text-xs text-text-secondary">{p.aboutText}</p>
                        )}
                      </div>
                    </div>
                    <span className="text-xs font-medium text-primary">
                      {startingUid === c.uid ? 'Opening...' : 'Chat'}
                    </span>
                  </button>
                );
              })
            )}
          </div>
        </div>
      </Dialog>

      <ContactDiscoveryModal open={discoveryOpen} onOpenChange={setDiscoveryOpen} />
    </>
  );
};
