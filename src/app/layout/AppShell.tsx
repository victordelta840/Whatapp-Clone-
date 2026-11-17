import React from 'react';
import { Banner } from '@/components/ui';
import { useOnlineStatus } from '@/hooks/useOnlineStatus';
import { en } from '@/i18n';
import { NavRail } from './NavRail';
import { BottomTabs } from './BottomTabs';
import { ListPane } from './ListPane';
import { ConversationPane } from './ConversationPane';

export interface AppShellProps {
  listPane?: React.ReactNode;
  children: React.ReactNode;
  infoPanel?: React.ReactNode;
  hideMobileList?: boolean;
  hideBottomTabs?: boolean;
  userName?: string;
  userPhotoUrl?: string | null;
  unreadChats?: number;
  unreadNotifications?: number;
  topBanners?: React.ReactNode;
}

export const AppShell: React.FC<AppShellProps> = ({
  listPane,
  children,
  infoPanel,
  hideMobileList = false,
  hideBottomTabs = false,
  userName,
  userPhotoUrl,
  unreadChats = 0,
  unreadNotifications = 0,
  topBanners,
}) => {
  const { connectionState } = useOnlineStatus();

  return (
    <div className="flex h-dvh w-full flex-col overflow-hidden bg-surface text-text-primary">
      {connectionState === 'offline' && (
        <Banner variant="offline" message={en.app.offlineBanner} />
      )}
      {connectionState === 'connecting' && (
        <Banner variant="info" message={en.app.connectingBanner} />
      )}
      {topBanners}

      <div className="flex min-h-0 flex-1 overflow-hidden">
        <div className="hidden md:flex">
          <NavRail
            userName={userName}
            userPhotoUrl={userPhotoUrl}
            unreadChats={unreadChats}
            unreadNotifications={unreadNotifications}
          />
        </div>

        {listPane && (
          <div className={`${hideMobileList ? 'hidden md:flex' : 'flex w-full md:w-auto'} min-h-0`}>
            <ListPane className={hideBottomTabs ? '' : 'pb-16 md:pb-0'}>{listPane}</ListPane>
          </div>
        )}

        <div
          className={`${
            listPane && !hideMobileList ? 'hidden md:flex' : 'flex'
          } min-w-0 flex-1 min-h-0 ${hideBottomTabs ? '' : 'pb-16 md:pb-0'}`}
        >
          <ConversationPane>{children}</ConversationPane>
          {infoPanel}
        </div>
      </div>

      {!hideBottomTabs && <BottomTabs unreadChats={unreadChats} />}
    </div>
  );
};
