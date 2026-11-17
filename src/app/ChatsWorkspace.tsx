import React, { useCallback, useEffect, useState } from 'react';
import { Outlet, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { Download, Lock } from 'lucide-react';
import { Banner, Button, WhatsAppLogo } from '@/components/ui';
import { en } from '@/i18n';
import { restoreUploadOutbox } from '@/lib/media/uploadOutbox';
import { usePWAInstall, useServiceWorkerUpdate } from '@/lib/pwa';
import { useAuthStore } from '@/features/auth';
import { useCallSessionListener } from '@/features/calls';
import {
  ConversationList,
  NewChatModal,
  useConversations,
} from '@/features/conversations';
import { CreateGroupModal, GroupInfoPanel } from '@/features/groups';
import { ChatView } from '@/features/messages';
import { updateAppBadgeCount, useForegroundPushListener, useNotificationsCenter } from '@/features/notifications';
import { usePresenceHeartbeat } from '@/features/presence';
import type { HydratedUserSummary } from '@/features/profile';
import type { ConversationMember, Message } from '@/types';
import { AppShell } from './layout/AppShell';
import { InfoPanel } from './layout/InfoPanel';

/**
 * Authenticated Shell wrapping primary app routes, global real-time listeners,
 * and PWA update/install banners.
 */
export const AuthenticatedShell: React.FC<{
  listPane?: React.ReactNode;
  infoPanel?: React.ReactNode;
  hideMobileList?: boolean;
  hideBottomTabs?: boolean;
  children?: React.ReactNode;
}> = ({ listPane, infoPanel, hideMobileList, hideBottomTabs, children }) => {
  const uid = useAuthStore((s) => s.authUser?.uid ?? null);
  const profile = useAuthStore((s) => s.profile);
  const photo = useAuthStore((s) => s.photo);

  usePresenceHeartbeat();
  useForegroundPushListener();
  useCallSessionListener();

  const { totalUnreadCount } = useConversations();
  const { unreadCount: unreadNotifications } = useNotificationsCenter();
  const { updateReady, applyUpdate } = useServiceWorkerUpdate();
  const { canPromptInstall, showIosHint, triggerInstall, dismiss } = usePWAInstall();

  useEffect(() => {
    updateAppBadgeCount(totalUnreadCount);
  }, [totalUnreadCount]);

  useEffect(() => {
    if (uid) void restoreUploadOutbox(uid);
  }, [uid]);

  const topBanners = (
    <>
      {updateReady && (
        <Banner
          variant="info"
          message={en.app.updateAvailable}
          action={
            <Button size="sm" onClick={applyUpdate}>
              {en.app.reloadUpdate}
            </Button>
          }
        />
      )}
      {canPromptInstall && (
        <Banner
          variant="info"
          message="Install WhatsApp on your device for faster access and offline support."
          action={
            <div className="flex items-center gap-2">
              <Button size="sm" leftIcon={<Download className="h-3.5 w-3.5" />} onClick={() => void triggerInstall()}>
                Install
              </Button>
              <Button size="sm" variant="ghost" onClick={dismiss}>
                Dismiss
              </Button>
            </div>
          }
        />
      )}
      {showIosHint && (
        <Banner
          variant="info"
          message="On iOS Safari, tap Share -> Add to Home Screen to enable PWA install and push notifications."
          action={
            <Button size="sm" variant="ghost" onClick={dismiss}>
              Dismiss
            </Button>
          }
        />
      )}
    </>
  );

  return (
    <AppShell
      listPane={listPane}
      infoPanel={infoPanel}
      hideMobileList={hideMobileList}
      hideBottomTabs={hideBottomTabs}
      userName={profile?.displayName ?? 'Me'}
      userPhotoUrl={photo?.photoURL ?? null}
      unreadChats={totalUnreadCount}
      unreadNotifications={unreadNotifications}
      topBanners={topBanners}
    >
      {children ?? <Outlet />}
    </AppShell>
  );
};

export const ChatsWorkspace: React.FC = () => {
  const { cid } = useParams<{ cid: string }>();
  const [searchParams] = useSearchParams();
  const highlightId = searchParams.get('highlight');
  const navigate = useNavigate();

  const { items, peerProfiles, loading, error } = useConversations();
  const [newChatOpen, setNewChatOpen] = useState(false);
  const [newGroupOpen, setNewGroupOpen] = useState(false);
  const [infoOpenForCid, setInfoOpenForCid] = useState<string | null>(null);
  const infoOpen = Boolean(cid && infoOpenForCid === cid);
  const [chatContext, setChatContext] = useState<{
    members: Array<ConversationMember & { uid: string }>;
    messages: Array<Message & { id: string }>;
    profiles: Record<string, HydratedUserSummary>;
  }>({
    members: [],
    messages: [],
    profiles: {},
  });

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'n') {
        e.preventDefault();
        setNewChatOpen(true);
      } else if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        const searchEl = document.querySelector<HTMLInputElement>('input[type="search"]');
        searchEl?.focus();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  const activeItem = cid ? items.find((i) => i.id === cid) : undefined;

  const handleProvideContext = useCallback(
    (ctx: {
      members: Array<ConversationMember & { uid: string }>;
      messages: Array<Message & { id: string }>;
      profiles: Record<string, HydratedUserSummary>;
    }) => {
      setChatContext(ctx);
    },
    [],
  );

  return (
    <>
      <AuthenticatedShell
        hideMobileList={Boolean(cid)}
        hideBottomTabs={Boolean(cid)}
        listPane={
          <ConversationList
            items={items}
            loading={loading}
            error={error}
            activeConversationId={cid}
            onNewChat={() => setNewChatOpen(true)}
            onNewGroup={() => setNewGroupOpen(true)}
          />
        }
        infoPanel={
          activeItem ? (
            <InfoPanel
              open={infoOpen}
              onClose={() => setInfoOpenForCid(null)}
              title={activeItem.conversation.type === 'group' ? 'Group info' : 'Contact info'}
            >
              <GroupInfoPanel
                conversation={activeItem.conversation as typeof activeItem.conversation & { id: string }}
                members={chatContext.members}
                profiles={chatContext.profiles}
                messages={chatContext.messages}
                peerUid={activeItem.peerUid}
                onClose={() => setInfoOpenForCid(null)}
              />
            </InfoPanel>
          ) : undefined
        }
      >
        {activeItem ? (
          <ChatView
            item={activeItem}
            peerProfiles={peerProfiles}
            highlightMessageId={highlightId}
            onToggleInfo={() =>
              setInfoOpenForCid((curr) => (curr === cid ? null : (cid ?? null)))
            }
            onProvideContext={handleProvideContext}
          />
        ) : (
          <div className="flex h-full flex-col items-center justify-between bg-surface-sunken/70 px-6 py-10 text-center dark:bg-[#222E35]/60">
            <div aria-hidden="true" />
            <div className="mx-auto flex max-w-md flex-col items-center">
              <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-brand/12">
                <WhatsAppLogo className="h-12 w-12" />
              </div>
              <h2 className="text-2xl font-light tracking-tight text-text-primary">
                {cid ? 'Chat not found' : en.chats.selectConversationTitle}
              </h2>
              <p className="mt-3 text-sm leading-relaxed text-text-secondary">
                {en.chats.selectConversationDescription}
              </p>
              <div className="mt-6">
                {cid ? (
                  <Button onClick={() => navigate('/chats')}>Back to Chats</Button>
                ) : (
                  <Button onClick={() => setNewChatOpen(true)}>{en.chats.startChatCta}</Button>
                )}
              </div>
            </div>
            <p className="flex items-center gap-1.5 text-xs text-text-tertiary">
              <Lock className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Protected in transit (TLS) and at rest by Google Cloud</span>
            </p>
          </div>
        )}
      </AuthenticatedShell>

      <NewChatModal open={newChatOpen} onOpenChange={setNewChatOpen} />
      <CreateGroupModal open={newGroupOpen} onOpenChange={setNewGroupOpen} />
    </>
  );
};
