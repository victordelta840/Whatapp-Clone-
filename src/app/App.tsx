import React from 'react';
import { RouterProvider } from 'react-router-dom';
import { ToastHost, TooltipProvider } from '@/components/ui';
import { envResult } from '@/config/env';
import { getFirebaseHandles } from '@/config/firebase';
import { ThemeProvider } from '@/hooks/useTheme';
import { AuthProvider } from '@/features/auth';
import { CallOverlay } from '@/features/calls';
import { ErrorBoundary } from './ErrorBoundary';
import { SetupRequired } from './SetupRequired';
import { router } from './router';

if (envResult.ok) {
  getFirebaseHandles();
}

export const App: React.FC = () => {
  if (!envResult.ok) {
    return (
      <ThemeProvider>
        <SetupRequired missing={envResult.missing} invalid={envResult.invalid} />
      </ThemeProvider>
    );
  }

  return (
    <ErrorBoundary>
      <ThemeProvider>
        <TooltipProvider>
          <AuthProvider>
            <RouterProvider router={router} />
            <CallOverlay />
            <ToastHost />
          </AuthProvider>
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
};
