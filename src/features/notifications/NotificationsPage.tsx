import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, Check, Trash2 } from 'lucide-react';
import { Button, EmptyState, IconButton, Spinner } from '@/components/ui';
import { useNotificationsCenter } from './notifications.service';

export const NotificationsPage: React.FC = () => {
  const navigate = useNavigate();
  const { items, loading, markRead, removeNotification } = useNotificationsCenter();

  return (
    <div className="mx-auto max-w-2xl p-4 sm:p-6 space-y-4">
      <div className="flex items-center justify-between border-b border-border pb-3">
        <div className="flex items-center gap-2">
          <Bell className="h-5 w-5 text-primary" />
          <h1 className="text-lg font-bold text-text-primary">Notifications</h1>
        </div>
        {items.some((n) => !n.read) && (
          <Button
            size="sm"
            variant="secondary"
            onClick={() => {
              items.filter((n) => !n.read).forEach((n) => void markRead(n.id));
            }}
          >
            Mark all read
          </Button>
        )}
      </div>

      {loading ? (
        <div className="flex justify-center py-8">
          <Spinner />
        </div>
      ) : items.length === 0 ? (
        <EmptyState
          title="You're all caught up"
          description="Missed calls, mentions, and group invites appear here."
        />
      ) : (
        <div className="divide-y divide-border rounded-2xl border border-border bg-surface-raised">
          {items.map((n) => (
            <div
              key={n.id}
              className={`flex items-start justify-between gap-3 p-4 ${
                !n.read ? 'bg-primary/5' : ''
              }`}
            >
              <button
                type="button"
                onClick={() => {
                  void markRead(n.id);
                  if (n.data?.conversationId) {
                    navigate(`/chats/${n.data.conversationId}`);
                  } else if (n.data?.callId) {
                    navigate('/calls');
                  }
                }}
                className="min-w-0 flex-1 text-left"
              >
                <p className="text-sm font-semibold text-text-primary">{n.title}</p>
                <p className="mt-0.5 text-xs text-text-secondary">{n.body}</p>
                <p className="mt-1 text-[11px] text-text-tertiary">
                  {n.createdAt?.toDate?.()?.toLocaleString()}
                </p>
              </button>
              <div className="flex items-center gap-1 shrink-0">
                {!n.read && (
                  <IconButton size="sm" label="Mark as read" onClick={() => void markRead(n.id)}>
                    <Check className="h-4 w-4 text-accent" />
                  </IconButton>
                )}
                <IconButton
                  size="sm"
                  label="Delete notification"
                  onClick={() => void removeNotification(n.id)}
                >
                  <Trash2 className="h-4 w-4 text-danger" />
                </IconButton>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
