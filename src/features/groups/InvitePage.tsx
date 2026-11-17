import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Users } from 'lucide-react';
import { Button, ErrorState, Spinner, toast } from '@/components/ui';
import { mapFirebaseError } from '@/lib/errors';
import { joinGroupByInviteCode, previewGroupInvite } from './groups.service';

export const InvitePage: React.FC = () => {
  const { code = '' } = useParams<{ code: string }>();
  const navigate = useNavigate();
  const [result, setResult] = useState<{
    code: string;
    error: string | null;
    preview: {
      conversationId: string;
      name: string;
      description: string;
      memberCount: number;
      joinApproval: boolean;
    } | null;
  }>({ code: '', error: null, preview: null });
  const [joining, setJoining] = useState(false);

  const loading = result.code !== code;
  const error = loading ? null : result.error;
  const preview = loading ? null : result.preview;

  useEffect(() => {
    let active = true;
    previewGroupInvite(code)
      .then((res) => {
        if (active) setResult({ code, error: null, preview: res });
      })
      .catch((err) => {
        if (active) setResult({ code, error: mapFirebaseError(err).userMessage, preview: null });
      });
    return () => {
      active = false;
    };
  }, [code]);

  const handleJoin = async () => {
    setJoining(true);
    try {
      const res = await joinGroupByInviteCode(code);
      if (res.pendingApproval) {
        toast.info('Join request submitted. A group admin must approve it.');
        navigate('/chats');
      } else {
        toast.success('Joined group!');
        navigate(`/chats/${res.conversationId}`);
      }
    } catch (err) {
      toast.error(mapFirebaseError(err).userMessage);
    } finally {
      setJoining(false);
    }
  };

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center p-8">
        <Spinner size="lg" />
      </div>
    );
  }

  if (error || !preview) {
    return (
      <ErrorState
        title="Invite link unavailable"
        description={error || 'This group invite link may be expired or revoked.'}
      />
    );
  }

  return (
    <div className="mx-auto max-w-md p-6">
      <div className="flex flex-col items-center rounded-2xl border border-border bg-surface-raised p-8 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10 text-primary">
          <Users className="h-8 w-8" />
        </div>
        <h1 className="mt-4 text-xl font-bold text-text-primary">{preview.name}</h1>
        <p className="mt-1 text-xs text-text-secondary">{preview.memberCount} members</p>
        {preview.description && (
          <p className="mt-3 text-sm text-text-secondary">{preview.description}</p>
        )}
        {preview.joinApproval && (
          <p className="mt-3 rounded-lg bg-warning/10 px-3 py-1.5 text-xs text-warning">
            Admin approval is required before entering this group.
          </p>
        )}
        <div className="mt-6 flex w-full gap-2">
          <Button variant="secondary" fullWidth onClick={() => navigate('/chats')}>
            Cancel
          </Button>
          <Button fullWidth loading={joining} onClick={() => void handleJoin()}>
            {preview.joinApproval ? 'Request to join' : 'Join group'}
          </Button>
        </div>
      </div>
    </div>
  );
};
