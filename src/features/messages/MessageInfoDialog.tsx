import React from 'react';
import { Dialog } from '@/components/ui';
import type { ConversationMember, Message } from '@/types';
import type { HydratedUserSummary } from '@/features/profile';

export interface MessageInfoDialogProps {
  message: (Message & { id: string }) | null;
  onOpenChange: (open: boolean) => void;
  members: Array<ConversationMember & { uid: string }>;
  profiles: Record<string, HydratedUserSummary>;
  myUid: string;
}

export const MessageInfoDialog: React.FC<MessageInfoDialogProps> = ({
  message,
  onOpenChange,
  members,
  profiles,
  myUid,
}) => {
  if (!message) return null;
  const createdMs = message.createdAt?.toMillis?.() ?? 0;
  const others = members.filter((m) => m.uid !== myUid);

  return (
    <Dialog
      open={Boolean(message)}
      onOpenChange={onOpenChange}
      title="Message info"
      description="Delivery and read status across participants."
      size="sm"
    >
      <div className="space-y-4">
        <div className="rounded-xl bg-surface-muted p-3 text-xs text-text-primary">
          <p className="font-medium">{message.text || `[${message.type}]`}</p>
          <p className="mt-1 text-text-tertiary">
            Sent: {message.createdAt?.toDate?.()?.toLocaleString() ?? 'Pending'}
          </p>
        </div>

        <div className="divide-y divide-border rounded-xl border border-border">
          {others.map((m) => {
            const name = profiles[m.uid]?.profile?.displayName ?? m.uid;
            const read = (m.lastReadAt?.toMillis?.() ?? 0) >= createdMs && createdMs > 0;
            const delivered = (m.lastDeliveredAt?.toMillis?.() ?? 0) >= createdMs && createdMs > 0;
            return (
              <div key={m.uid} className="flex items-center justify-between px-3 py-2.5 text-xs">
                <span className="font-medium text-text-primary">{name}</span>
                <span className={read ? 'font-semibold text-accent' : 'text-text-secondary'}>
                  {read
                    ? `Read ${m.lastReadAt?.toDate?.()?.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
                    : delivered
                      ? 'Delivered'
                      : 'Sent'}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </Dialog>
  );
};
