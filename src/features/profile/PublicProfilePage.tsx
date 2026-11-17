import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { MessageSquare, UserPlus } from 'lucide-react';
import { Avatar, Button, EmptyState, ErrorState, Spinner, toast } from '@/components/ui';
import { mapFirebaseError } from '@/lib/errors';
import { useAuthStore } from '@/features/auth';
import { startDirectConversation } from '@/features/conversations/conversations.service';
import { addContactRecord } from '@/features/contacts/contacts.service';
import { lookupUserByIdentifier } from './profile.service';

export const PublicProfilePage: React.FC = () => {
  const { username = '' } = useParams<{ username: string }>();
  const navigate = useNavigate();
  const authUser = useAuthStore((s) => s.authUser);

  const [result, setResult] = useState<{
    username: string;
    error: string | null;
    target: {
      uid: string;
      displayName: string;
      username: string | null;
      photoURL: string | null;
      about: string | null;
    } | null;
  }>({ username: '', error: null, target: null });
  const [starting, setStarting] = useState(false);

  const loading = result.username !== username;
  const error = loading ? null : result.error;
  const target = loading ? null : result.target;

  useEffect(() => {
    let active = true;
    lookupUserByIdentifier(`@${username}`)
      .then((res) => {
        if (!active) return;
        if (res.found && res.uid && res.displayName) {
          setResult({
            username,
            error: null,
            target: {
              uid: res.uid,
              displayName: res.displayName,
              username: res.username ?? username,
              photoURL: res.photoURL ?? null,
              about: res.about ?? null,
            },
          });
        } else {
          setResult({ username, error: null, target: null });
        }
      })
      .catch((err) => {
        if (active) setResult({ username, error: mapFirebaseError(err).userMessage, target: null });
      });
    return () => {
      active = false;
    };
  }, [username]);

  const handleStartChat = async () => {
    if (!target || !authUser) return;
    setStarting(true);
    try {
      const cid = await startDirectConversation(target.uid);
      navigate(`/chats/${cid}`);
    } catch (err) {
      toast.error(mapFirebaseError(err).userMessage);
    } finally {
      setStarting(false);
    }
  };

  const handleSaveContact = async () => {
    if (!target || !authUser) return;
    try {
      await addContactRecord(authUser.uid, target.uid, 'invite');
      toast.success('Added to your contacts.');
    } catch (err) {
      toast.error(mapFirebaseError(err).userMessage);
    }
  };

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center p-8">
        <Spinner size="lg" />
      </div>
    );
  }

  if (error) {
    return <ErrorState title="Could not load profile" description={error} />;
  }

  if (!target) {
    return (
      <EmptyState
        title="Profile not found"
        description={`No discoverable user matches @${username}.`}
        action={<Button onClick={() => navigate('/chats')}>Back to Chats</Button>}
      />
    );
  }

  const isSelf = authUser?.uid === target.uid;

  return (
    <div className="mx-auto max-w-md p-6">
      <div className="flex flex-col items-center rounded-2xl border border-border bg-surface-raised p-8 text-center">
        <Avatar src={target.photoURL} name={target.displayName} size="xl" />
        <h1 className="mt-4 text-xl font-bold text-text-primary">{target.displayName}</h1>
        {target.username && <p className="text-sm text-text-secondary">@{target.username}</p>}
        {target.about && <p className="mt-3 text-sm text-text-secondary">{target.about}</p>}

        {!isSelf && (
          <div className="mt-6 flex w-full gap-2">
            <Button
              fullWidth
              loading={starting}
              leftIcon={<MessageSquare className="h-4 w-4" />}
              onClick={() => void handleStartChat()}
            >
              Message
            </Button>
            <Button
              variant="secondary"
              leftIcon={<UserPlus className="h-4 w-4" />}
              onClick={() => void handleSaveContact()}
            >
              Add
            </Button>
          </div>
        )}
      </div>
    </div>
  );
};
