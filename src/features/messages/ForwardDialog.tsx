import React, { useState } from 'react';
import { Avatar, Button, Checkbox, Dialog, toast } from '@/components/ui';
import { LIMITS } from '@/config/constants';
import { mapFirebaseError } from '@/lib/errors';
import { useConversations } from '@/features/conversations';
import { forwardMessagesToConversations } from './messages.service';

export interface ForwardDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sourceConversationId: string;
  messageIds: string[];
  onForwarded?: () => void;
}

export const ForwardDialog: React.FC<ForwardDialogProps> = ({
  open,
  onOpenChange,
  sourceConversationId,
  messageIds,
  onForwarded,
}) => {
  const { items } = useConversations();
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);

  const toggle = (cid: string) => {
    setSelectedIds((prev) => {
      if (prev.includes(cid)) return prev.filter((id) => id !== cid);
      if (prev.length >= LIMITS.FORWARD_MAX_TARGETS) {
        toast.info(`You can forward to up to ${LIMITS.FORWARD_MAX_TARGETS} chats at once.`);
        return prev;
      }
      return [...prev, cid];
    });
  };

  const handleConfirm = async () => {
    if (selectedIds.length === 0) return;
    setSubmitting(true);
    try {
      await forwardMessagesToConversations({
        sourceConversationId,
        messageIds,
        targetConversationIds: selectedIds,
      });
      toast.success(`Forwarded ${messageIds.length} message(s).`);
      setSelectedIds([]);
      onOpenChange(false);
      onForwarded?.();
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
      title="Forward messages"
      description={`Select up to ${LIMITS.FORWARD_MAX_TARGETS} conversations.`}
      size="sm"
    >
      <div className="space-y-4">
        <div className="max-h-72 overflow-y-auto divide-y divide-border rounded-xl border border-border">
          {items.map((item) => (
            <div
              key={item.id}
              className="flex items-center justify-between gap-3 px-3 py-2.5 hover:bg-surface-muted"
            >
              <div className="flex items-center gap-3 min-w-0">
                <Avatar src={item.photoURL} name={item.title} size="sm" />
                <span className="truncate text-sm font-medium text-text-primary">{item.title}</span>
              </div>
              <Checkbox
                aria-label={`Forward to ${item.title}`}
                checked={selectedIds.includes(item.id)}
                onCheckedChange={() => toggle(item.id)}
              />
            </div>
          ))}
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            loading={submitting}
            disabled={selectedIds.length === 0}
            onClick={() => void handleConfirm()}
          >
            Forward ({selectedIds.length})
          </Button>
        </div>
      </div>
    </Dialog>
  );
};
