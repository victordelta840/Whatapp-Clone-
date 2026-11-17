import React from 'react';
import { NavLink } from 'react-router-dom';
import { Bell, CircleDot, MessageSquare, Phone, Settings } from 'lucide-react';
import { Avatar, Tooltip, WhatsAppLogo } from '@/components/ui';

export interface NavRailProps {
  userName?: string;
  userPhotoUrl?: string | null;
  unreadNotifications?: number;
  unreadChats?: number;
}

const topNavItems = [
  { to: '/chats', label: 'Chats', icon: MessageSquare },
  { to: '/status', label: 'Status', icon: CircleDot },
  { to: '/calls', label: 'Calls', icon: Phone },
  { to: '/notifications', label: 'Notifications', icon: Bell },
] as const;

export const NavRail: React.FC<NavRailProps> = ({
  userName = 'Account',
  userPhotoUrl,
  unreadNotifications = 0,
  unreadChats = 0,
}) => {
  return (
    <nav
      aria-label="Primary navigation"
      className="flex h-full w-16 shrink-0 flex-col items-center justify-between border-e border-border bg-surface-sunken py-3 pt-safe pb-safe"
    >
      <div className="flex flex-col items-center gap-2">
        <NavLink
          to="/chats"
          aria-label="WhatsApp Home"
          className="mb-2 flex h-11 w-11 items-center justify-center rounded-full transition-transform hover:scale-105"
        >
          <WhatsAppLogo className="h-8 w-8" />
        </NavLink>

        {topNavItems.map((item) => {
          const Icon = item.icon;
          const badgeCount =
            item.to === '/chats'
              ? unreadChats
              : item.to === '/notifications'
                ? unreadNotifications
                : 0;
          return (
            <Tooltip key={item.to} content={item.label} side="right">
              <NavLink
                to={item.to}
                aria-label={item.label}
                className={({ isActive }) =>
                  `relative flex h-11 w-11 items-center justify-center rounded-full transition-colors ${
                    isActive
                      ? 'bg-black/8 text-text-primary dark:bg-white/12 dark:text-text-primary'
                      : 'text-text-secondary hover:bg-black/5 hover:text-text-primary dark:hover:bg-white/6'
                  }`
                }
              >
                <Icon className="h-5 w-5" aria-hidden="true" />
                {badgeCount > 0 && (
                  <span
                    aria-label={`${badgeCount} unread`}
                    className="absolute top-1.5 end-1 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-brand px-1 text-[10px] font-bold text-white tabular-nums"
                  >
                    {badgeCount > 99 ? '99+' : badgeCount}
                  </span>
                )}
              </NavLink>
            </Tooltip>
          );
        })}
      </div>

      <div className="flex flex-col items-center gap-2">
        <Tooltip content="Settings" side="right">
          <NavLink
            to="/settings"
            aria-label="Settings"
            className={({ isActive }) =>
              `flex h-11 w-11 items-center justify-center rounded-full transition-colors ${
                isActive
                  ? 'bg-black/8 text-text-primary dark:bg-white/12'
                  : 'text-text-secondary hover:bg-black/5 hover:text-text-primary dark:hover:bg-white/6'
              }`
            }
          >
            <Settings className="h-5 w-5" aria-hidden="true" />
          </NavLink>
        </Tooltip>

        <Tooltip content="Profile" side="right">
          <NavLink
            to="/settings/profile"
            aria-label="My profile"
            className="flex h-11 w-11 items-center justify-center rounded-full hover:ring-2 hover:ring-brand/40 transition"
          >
            <Avatar name={userName} src={userPhotoUrl} size="sm" />
          </NavLink>
        </Tooltip>
      </div>
    </nav>
  );
};
