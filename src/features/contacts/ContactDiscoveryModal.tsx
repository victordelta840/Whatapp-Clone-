import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FileUp, Search, Smartphone, UserPlus } from 'lucide-react';
import { Avatar, Button, Dialog, Input, Tabs, toast } from '@/components/ui';
import { mapFirebaseError } from '@/lib/errors';
import { useAuthStore } from '@/features/auth';
import { lookupUserByIdentifier } from '@/features/profile';
import { startDirectConversation } from '@/features/conversations/conversations.service';
import {
  addContactRecord,
  discoverContactsByPhones,
  extractPhonesFromVCardOrCsv,
  isContactPickerSupported,
  pickPhonesFromDevice,
  type DiscoveredMatch,
} from './contacts.service';

export interface ContactDiscoveryModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const ContactDiscoveryModal: React.FC<ContactDiscoveryModalProps> = ({
  open,
  onOpenChange,
}) => {
  const uid = useAuthStore((s) => s.authUser?.uid ?? null);
  const navigate = useNavigate();

  const [tab, setTab] = useState<'lookup' | 'import'>('lookup');
  const [identifier, setIdentifier] = useState('');
  const [searching, setSearching] = useState(false);
  const [foundUser, setFoundUser] = useState<{
    uid: string;
    displayName: string;
    username: string | null;
    photoURL: string | null;
    about: string | null;
  } | null>(null);
  const [lookupEmpty, setLookupEmpty] = useState(false);

  const [pendingNumbers, setPendingNumbers] = useState<string[]>([]);
  const [consentOpen, setConsentOpen] = useState(false);
  const [matches, setMatches] = useState<DiscoveredMatch[]>([]);
  const [discovering, setDiscovering] = useState(false);

  const handleLookup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!identifier.trim()) return;
    setSearching(true);
    setLookupEmpty(false);
    setFoundUser(null);
    try {
      const res = await lookupUserByIdentifier(identifier.trim());
      if (res.found && res.uid && res.displayName) {
        setFoundUser({
          uid: res.uid,
          displayName: res.displayName,
          username: res.username ?? null,
          photoURL: res.photoURL ?? null,
          about: res.about ?? null,
        });
      } else {
        setLookupEmpty(true);
      }
    } catch (err) {
      toast.error(mapFirebaseError(err).userMessage);
    } finally {
      setSearching(false);
    }
  };

  const handleVCardFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    const nums = extractPhonesFromVCardOrCsv(text);
    if (nums.length === 0) {
      toast.info('No E.164 phone numbers (+...) found in that file.');
      return;
    }
    setPendingNumbers(nums);
    setConsentOpen(true);
  };

  const handleDevicePicker = async () => {
    try {
      const nums = await pickPhonesFromDevice();
      if (nums.length === 0) {
        toast.info('No E.164 phone numbers selected.');
        return;
      }
      setPendingNumbers(nums);
      setConsentOpen(true);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Unable to pick contacts.');
    }
  };

  const confirmDiscover = async () => {
    setDiscovering(true);
    try {
      const found = await discoverContactsByPhones(pendingNumbers);
      setMatches(found);
      setConsentOpen(false);
      if (found.length === 0) {
        toast.info('None of those phone numbers matched discoverable WhatsApp accounts.');
      }
    } catch (err) {
      toast.error(mapFirebaseError(err).userMessage);
    } finally {
      setDiscovering(false);
    }
  };

  const openChatWith = async (targetUid: string) => {
    if (!uid) return;
    try {
      await addContactRecord(uid, targetUid, 'discovery');
      const cid = await startDirectConversation(targetUid);
      onOpenChange(false);
      navigate(`/chats/${cid}`);
    } catch (err) {
      toast.error(mapFirebaseError(err).userMessage);
    }
  };

  return (
    <>
      <Dialog
        open={open}
        onOpenChange={onOpenChange}
        title="Find people on WhatsApp"
        description="Search by phone number, @username, or opt-in contact import."
        size="md"
      >
        <div className="space-y-4">
          <Tabs
            value={tab}
            onValueChange={(v) => setTab(v as 'lookup' | 'import')}
            items={[
              { value: 'lookup', label: 'Exact lookup', icon: <Search className="h-3.5 w-3.5" /> },
              { value: 'import', label: 'Import contacts', icon: <FileUp className="h-3.5 w-3.5" /> },
            ]}
          />

          {tab === 'lookup' ? (
            <div className="space-y-4">
              <form onSubmit={(e) => void handleLookup(e)} className="flex gap-2">
                <div className="flex-1">
                  <Input
                    value={identifier}
                    onChange={(e) => setIdentifier(e.target.value)}
                    placeholder="+14155550123 or @username"
                    aria-label="Phone number or username"
                  />
                </div>
                <Button type="submit" loading={searching}>
                  Find
                </Button>
              </form>

              {foundUser && (
                <div className="flex items-center justify-between gap-3 rounded-xl border border-border bg-surface-muted p-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <Avatar src={foundUser.photoURL} name={foundUser.displayName} size="md" />
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-text-primary">
                        {foundUser.displayName}
                      </p>
                      {foundUser.username && (
                        <p className="truncate text-xs text-text-secondary">
                          @{foundUser.username}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {uid && foundUser.uid !== uid && (
                      <>
                        <Button
                          size="sm"
                          variant="secondary"
                          leftIcon={<UserPlus className="h-3.5 w-3.5" />}
                          onClick={() =>
                            void addContactRecord(uid, foundUser.uid, 'manual')
                              .then(() => toast.success('Saved to contacts.'))
                              .catch((err) => toast.error(mapFirebaseError(err).userMessage))
                          }
                        >
                          Save
                        </Button>
                        <Button size="sm" onClick={() => void openChatWith(foundUser.uid)}>
                          Message
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              )}

              {lookupEmpty && (
                <p className="text-xs text-text-secondary">
                  No discoverable account matched that exact identifier.
                </p>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              <p className="text-xs text-text-secondary">
                Numbers are hashed server-side solely to find matching accounts and are never persisted on our servers.
              </p>

              <div className="flex flex-wrap gap-2">
                <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-border bg-surface-muted px-3 py-2 text-xs font-medium text-text-primary hover:bg-surface-sunken">
                  <FileUp className="h-4 w-4 text-primary" />
                  <span>Import .vcf or .csv</span>
                  <input
                    type="file"
                    accept=".vcf,.csv,text/vcard,text/csv"
                    className="hidden"
                    onChange={(e) => void handleVCardFile(e)}
                  />
                </label>

                {isContactPickerSupported() && (
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    leftIcon={<Smartphone className="h-4 w-4" />}
                    onClick={() => void handleDevicePicker()}
                  >
                    Select from device contacts
                  </Button>
                )}
              </div>

              {matches.length > 0 && (
                <div className="divide-y divide-border rounded-xl border border-border">
                  {matches.map((m) => (
                    <div key={m.uid} className="flex items-center justify-between gap-3 p-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <Avatar name={m.displayName} size="sm" />
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium text-text-primary">
                            {m.displayName}
                          </p>
                          {m.username && (
                            <p className="truncate text-xs text-text-secondary">@{m.username}</p>
                          )}
                        </div>
                      </div>
                      <Button size="sm" onClick={() => void openChatWith(m.uid)}>
                        Message
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </Dialog>

      <Dialog
        open={consentOpen}
        onOpenChange={setConsentOpen}
        title="Confirm contact discovery"
        description={`Check ${pendingNumbers.length} phone number${pendingNumbers.length === 1 ? '' : 's'} against discoverable WhatsApp users?`}
        size="sm"
      >
        <div className="space-y-4">
          <p className="text-xs text-text-secondary">
            Only matching user accounts are returned. Your uploaded phone numbers are never stored or logged.
          </p>
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setConsentOpen(false)}>
              Cancel
            </Button>
            <Button loading={discovering} onClick={() => void confirmDiscover()}>
              Check matches
            </Button>
          </div>
        </div>
      </Dialog>
    </>
  );
};
