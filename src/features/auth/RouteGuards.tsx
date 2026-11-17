import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { ChatListSkeleton, Spinner } from '@/components/ui';
import { useAuthStore } from './authStore';

const AuthLoadingSkeleton: React.FC = () => {
  return (
    <div className="flex h-dvh w-full items-center justify-center bg-surface p-6">
      <div className="w-full max-w-md space-y-4 rounded-2xl border border-border bg-surface-raised p-6">
        <div className="flex items-center gap-3">
          <Spinner />
          <span className="text-sm font-medium text-text-secondary">
            Loading your chats...
          </span>
        </div>
        <ChatListSkeleton rows={3} />
      </div>
    </div>
  );
};

export const RequireAuth: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const authReady = useAuthStore((s) => s.authReady);
  const authUser = useAuthStore((s) => s.authUser);
  const needsOnboarding = useAuthStore((s) => s.needsOnboarding);
  const profile = useAuthStore((s) => s.profile);
  const location = useLocation();

  if (!authReady) return <AuthLoadingSkeleton />;

  if (!authUser) {
    const redirect = encodeURIComponent(location.pathname + location.search);
    return <Navigate to={`/auth/signin?redirect=${redirect}`} replace />;
  }

  if ((needsOnboarding || !profile) && location.pathname !== '/onboarding') {
    const redirect = encodeURIComponent(location.pathname + location.search);
    return <Navigate to={`/onboarding?redirect=${redirect}`} replace />;
  }

  return <>{children}</>;
};

export const RequireGuest: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const authReady = useAuthStore((s) => s.authReady);
  const authUser = useAuthStore((s) => s.authUser);
  const needsOnboarding = useAuthStore((s) => s.needsOnboarding);
  const location = useLocation();

  if (!authReady) return <AuthLoadingSkeleton />;

  if (authUser) {
    const params = new URLSearchParams(location.search);
    const redirect = params.get('redirect');
    if (needsOnboarding) {
      const onboardingTarget =
        redirect && redirect.startsWith('/')
          ? `/onboarding?redirect=${encodeURIComponent(redirect)}`
          : '/onboarding';
      return <Navigate to={onboardingTarget} replace />;
    }
    const target = redirect && redirect.startsWith('/') ? redirect : '/chats';
    return <Navigate to={target} replace />;
  }

  return <>{children}</>;
};

export const RequireOnboarding: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const authReady = useAuthStore((s) => s.authReady);
  const authUser = useAuthStore((s) => s.authUser);
  if (!authReady) return <AuthLoadingSkeleton />;
  if (!authUser) return <Navigate to="/auth/signin" replace />;
  return <>{children}</>;
};
