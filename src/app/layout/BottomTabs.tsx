import React from 'react';
import { NavLink } from 'react-router-dom';
import { CircleDot, MessageSquare, Phone, Settings } from 'lucide-react';

export interface BottomTabsProps {
  unreadChats?: number;
}

const mobileTabs = [
  { to: '/chats', label: 'Chats', icon: MessageSquare },
  { to: '/status', label: 'Updates', icon: CircleDot },
  { to: '/calls', label: 'Calls', icon: Phone },
  { to: '/settings', label: 'Settings', icon: Settings },
] as const;

export const BottomTabs: React.FC<BottomTabsProps> = ({ unreadChats = 0 }) => {
  return (
    <nav
      aria-label="Mobile navigation"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-surface-raised/95 backdrop-blur-md pb-safe md:hidden"
    >
      <div className="grid h-16 grid-cols-4 items-center">
        {mobileTabs.map((tab) => {
          const Icon = tab.icon;
          return (
            <NavLink
              key={tab.to}
              to={tab.to}
              className={({ isActive }) =>
                `group relative flex min-h-[44px] flex-col items-center justify-center gap-0.5 text-[11px] transition-colors ${
                  isActive
                    ? 'font-semibold text-text-primary'
                    : 'font-medium text-text-secondary hover:text-text-primary'
                }`
              }
            >
              {({ isActive }) => (
                <>
                  <div
                    className={`relative flex h-7 w-14 items-center justify-center rounded-full transition-colors ${
                      isActive ? 'bg-[#D8FDD2] text-[#008069] dark:bg-[#103529] dark:text-[#00A884]' : ''
                    }`}
                  >
                    <Icon className="h-5 w-5" aria-hidden="true" />
                    {tab.to === '/chats' && unreadChats > 0 && (
                      <span
                        aria-label={`${unreadChats} unread chats`}
                        className="absolute -top-1 end-2 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-brand px-1 text-[10px] font-bold text-white tabular-nums"
                      >
                        {unreadChats > 99 ? '99+' : unreadChats}
                      </span>
                    )}
                  </div>
                  <span>{tab.label}</span>
                </>
              )}
            </NavLink>
          );
        })}
      </div>
    </nav>
  );
};
