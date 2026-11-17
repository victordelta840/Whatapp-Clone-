import React, { useState } from 'react';
import { Button, Dialog, Select, TextArea, toast } from '@/components/ui';
import { LIMITS } from '@/config/constants';
import { mapFirebaseError } from '@/lib/errors';
import { useAuthStore } from '@/features/auth';
import { submitReport, type ReportReason } from './privacy.service';

export interface ReportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  targetType: 'user' | 'message' | 'group' | 'status';
  targetId: string;
  targetLabel?: string;
}

const REASON_OPTIONS = [
  { value: 'spam', label: 'Spam or unwanted solicitation' },
  { value: 'harassment', label: 'Harassment or abuse' },
  { value: 'hate', label: 'Hate speech' },
  { value: 'violence', label: 'Violence or threats' },
  { value: 'sexual', label: 'Inappropriate sexual content' },
  { value: 'scam', label: 'Scam or impersonation' },
  { value: 'other', label: 'Other' },
];

export const ReportDialog: React.FC<ReportDialogProps> = ({
  open,
  onOpenChange,
  targetType,
  targetId,
  targetLabel,
}) => {
  const uid = useAuthStore((s) => s.authUser?.uid ?? null);
  const [reason, setReason] = useState<ReportReason>('spam');
  const [details, setDetails] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!uid) return;
    setSubmitting(true);
    try {
      await submitReport({
        reporterId: uid,
        targetType,
        targetId,
        reason,
        details,
      });
      toast.success('Report submitted for moderation review.');
      setDetails('');
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
      title={`Report ${targetLabel ?? targetType}`}
      description="Submitted reports are stored securely and reviewed by moderation."
      size="sm"
    >
      <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4">
        <Select
          label="Reason"
          value={reason}
          options={REASON_OPTIONS}
          onChange={(e) => setReason(e.target.value as ReportReason)}
        />
        <TextArea
          label="Additional context (optional)"
          rows={3}
          maxLength={LIMITS.REPORT_DETAILS_MAX}
          value={details}
          onChange={(e) => setDetails(e.target.value)}
          placeholder="Describe what happened..."
        />
        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="submit" variant="danger" loading={submitting}>
            Submit report
          </Button>
        </div>
      </form>
    </Dialog>
  );
};
