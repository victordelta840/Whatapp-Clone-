import React, { Suspense, lazy } from 'react';
import { Navigate, createBrowserRouter, useNavigate } from 'react-router-dom';
import { Button, EmptyState, Spinner } from '@/components/ui';
import { en } from '@/i18n';
import {
  AuthPages,
  OnboardingPage,
  RequireAuth,
  RequireGuest,
  RequireOnboarding,
} from '@/features/auth';
import { AuthenticatedShell, ChatsWorkspace } from './ChatsWorkspace';

const StatusList = lazy(() =>
  import('@/features/status/StatusList').then((m) => ({ default: m.StatusList })),
);
const CallsPage = lazy(() =>
  import('@/features/calls/CallsPage').then((m) => ({ default: m.CallsPage })),
);
const NotificationsPage = lazy(() =>
  import('@/features/notifications/NotificationsPage').then((m) => ({
    default: m.NotificationsPage,
  })),
);
const SettingsLayout = lazy(() =>
  import('@/features/settings/SettingsLayout').then((m) => ({ default: m.SettingsLayout })),
);
const AccountSettingsPage = lazy(() =>
  import('@/features/settings/AccountSettingsPage').then((m) => ({
    default: m.AccountSettingsPage,
  })),
);
const DiagnosticsPage = lazy(() =>
  import('@/features/settings/DiagnosticsPage').then((m) => ({ default: m.DiagnosticsPage })),
);
const ProfileSettingsPage = lazy(() =>
  import('@/features/settings/SettingsPages').then((m) => ({ default: m.ProfileSettingsPage })),
);
const PrivacySettingsPage = lazy(() =>
  import('@/features/settings/SettingsPages').then((m) => ({ default: m.PrivacySettingsPage })),
);
const NotificationsSettingsPage = lazy(() =>
  import('@/features/settings/SettingsPages').then((m) => ({
    default: m.NotificationsSettingsPage,
  })),
);
const AppearanceSettingsPage = lazy(() =>
  import('@/features/settings/SettingsPages').then((m) => ({ default: m.AppearanceSettingsPage })),
);
const ChatsSettingsPage = lazy(() =>
  import('@/features/settings/SettingsPages').then((m) => ({ default: m.ChatsSettingsPage })),
);
const StorageSettingsPage = lazy(() =>
  import('@/features/settings/SettingsPages').then((m) => ({ default: m.StorageSettingsPage })),
);
const PlatformNotesPage = lazy(() =>
  import('@/features/settings/SettingsPages').then((m) => ({ default: m.PlatformNotesPage })),
);
const AboutPage = lazy(() =>
  import('@/features/settings/SettingsPages').then((m) => ({ default: m.AboutPage })),
);
const PublicProfilePage = lazy(() =>
  import('@/features/profile/PublicProfilePage').then((m) => ({ default: m.PublicProfilePage })),
);
const InvitePage = lazy(() =>
  import('@/features/groups/InvitePage').then((m) => ({ default: m.InvitePage })),
);
const ComponentGallery = lazy(() =>
  import('@/dev/ComponentGallery').then((m) => ({ default: m.ComponentGallery })),
);

const LazyWrap: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <Suspense
    fallback={
      <div className="flex h-full items-center justify-center p-8">
        <Spinner size="lg" />
      </div>
    }
  >
    {children}
  </Suspense>
);

const NotFoundPage: React.FC = () => {
  const navigate = useNavigate();
  return (
    <div className="flex h-dvh items-center justify-center bg-surface p-6">
      <EmptyState
        title={en.errors.notFoundTitle}
        description={en.errors.notFoundDescription}
        action={<Button onClick={() => navigate('/chats')}>{en.errors.backToChats}</Button>}
      />
    </div>
  );
};

export const router = createBrowserRouter([
  { path: '/', element: <Navigate to="/chats" replace /> },
  {
    path: '/auth/signin',
    element: (
      <RequireGuest>
        <AuthPages />
      </RequireGuest>
    ),
  },
  {
    path: '/auth/register',
    element: <Navigate to="/auth/signin" replace />,
  },
  {
    path: '/auth/reset',
    element: <Navigate to="/auth/signin" replace />,
  },
  {
    path: '/onboarding',
    element: (
      <RequireOnboarding>
        <OnboardingPage />
      </RequireOnboarding>
    ),
  },
  {
    path: '/chats',
    element: (
      <RequireAuth>
        <ChatsWorkspace />
      </RequireAuth>
    ),
  },
  {
    path: '/chats/:cid',
    element: (
      <RequireAuth>
        <ChatsWorkspace />
      </RequireAuth>
    ),
  },
  {
    path: '/status',
    element: (
      <RequireAuth>
        <AuthenticatedShell>
          <LazyWrap>
            <StatusList />
          </LazyWrap>
        </AuthenticatedShell>
      </RequireAuth>
    ),
  },
  {
    path: '/calls',
    element: (
      <RequireAuth>
        <AuthenticatedShell>
          <LazyWrap>
            <CallsPage />
          </LazyWrap>
        </AuthenticatedShell>
      </RequireAuth>
    ),
  },
  {
    path: '/notifications',
    element: (
      <RequireAuth>
        <AuthenticatedShell>
          <LazyWrap>
            <NotificationsPage />
          </LazyWrap>
        </AuthenticatedShell>
      </RequireAuth>
    ),
  },
  {
    path: '/settings',
    element: (
      <RequireAuth>
        <AuthenticatedShell>
          <LazyWrap>
            <SettingsLayout />
          </LazyWrap>
        </AuthenticatedShell>
      </RequireAuth>
    ),
    children: [
      { index: true, element: <Navigate to="/settings/profile" replace /> },
      { path: 'profile', element: <LazyWrap><ProfileSettingsPage /></LazyWrap> },
      { path: 'account', element: <LazyWrap><AccountSettingsPage /></LazyWrap> },
      { path: 'privacy', element: <LazyWrap><PrivacySettingsPage /></LazyWrap> },
      { path: 'notifications', element: <LazyWrap><NotificationsSettingsPage /></LazyWrap> },
      { path: 'appearance', element: <LazyWrap><AppearanceSettingsPage /></LazyWrap> },
      { path: 'chats', element: <LazyWrap><ChatsSettingsPage /></LazyWrap> },
      { path: 'storage', element: <LazyWrap><StorageSettingsPage /></LazyWrap> },
      { path: 'platform-notes', element: <LazyWrap><PlatformNotesPage /></LazyWrap> },
      { path: 'diagnostics', element: <LazyWrap><DiagnosticsPage /></LazyWrap> },
      { path: 'about', element: <LazyWrap><AboutPage /></LazyWrap> },
    ],
  },
  {
    path: '/u/:username',
    element: (
      <RequireAuth>
        <AuthenticatedShell>
          <LazyWrap>
            <PublicProfilePage />
          </LazyWrap>
        </AuthenticatedShell>
      </RequireAuth>
    ),
  },
  {
    path: '/invite/:code',
    element: (
      <RequireAuth>
        <AuthenticatedShell>
          <LazyWrap>
            <InvitePage />
          </LazyWrap>
        </AuthenticatedShell>
      </RequireAuth>
    ),
  },
  ...(import.meta.env.DEV
    ? [
        {
          path: '/dev/components',
          element: (
            <LazyWrap>
              <ComponentGallery />
            </LazyWrap>
          ),
        },
      ]
    : []),
  { path: '*', element: <NotFoundPage /> },
]);
