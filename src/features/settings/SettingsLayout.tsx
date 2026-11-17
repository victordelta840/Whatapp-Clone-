import React from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import {
  Activity,
  Bell,
  Database,
  HardDrive,
  Info,
  KeyRound,
  Lock,
  MessageSquare,
  Palette,
  Smartphone,
  User,
} from 'lucide-react';

const SETTINGS_LINKS = [
  { to: '/settings/profile', label: 'Profile', icon: User },
  { to: '/settings/account', label: 'Account & security', icon: KeyRound },
  { to: '/settings/privacy', label: 'Privacy & blocks', icon: Lock },
  { to: '/settings/notifications', label: 'Notifications', icon: Bell },
  { to: '/settings/appearance', label: 'Appearance', icon: Palette },
  { to: '/settings/chats', label: 'Chats & export', icon: MessageSquare },
  { to: '/settings/storage', label: 'Storage & network', icon: HardDrive },
  { to: '/settings/platform-notes', label: 'Platform notes', icon: Smartphone },
  { to: '/settings/diagnostics', label: 'Diagnostics', icon: Activity },
  { to: '/settings/about', label: 'About & data policy', icon: Info },
] as const;

export const SettingsLayout: React.FC = () => {
  return (
    <div className="flex h-full min-h-0 flex-col md:flex-row">
      <aside className="w-full shrink-0 border-b border-border bg-surface-raised p-3 md:w-64 md:border-b-0 md:border-r md:overflow-y-auto">
        <h1 className="px-3 pb-2 text-lg font-bold text-text-primary">Settings</h1>
        <nav aria-label="Settings sections" className="flex gap-1 overflow-x-auto md:flex-col">
          {SETTINGS_LINKS.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  `flex items-center gap-2.5 rounded-xl px-3 py-2 text-xs font-medium whitespace-nowrap transition-colors ${
                    isActive
                      ? 'bg-primary text-white'
                      : 'text-text-secondary hover:bg-surface-muted hover:text-text-primary'
                  }`
                }
              >
                <Icon className="h-4 w-4 shrink-0" />
                <span>{item.label}</span>
              </NavLink>
            );
          })}
        </nav>
        <div className="mt-4 hidden items-center gap-2 rounded-xl border border-border bg-surface-muted px-3 py-2 text-[11px] text-text-secondary md:flex">
          <Database className="h-3.5 w-3.5 shrink-0 text-primary" />
          <span>Synced with your WhatsApp account</span>
        </div>
      </aside>
      <main className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-6">
        <div className="mx-auto max-w-2xl">
          <Outlet />
        </div>
      </main>
    </div>
  );
};
