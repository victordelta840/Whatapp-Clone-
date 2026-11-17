import React from 'react';
import { AlertTriangle, FileCode2, KeyRound } from 'lucide-react';

interface SetupRequiredProps {
  missing: string[];
  invalid: Array<{ key: string; message: string }>;
}

export const SetupRequired: React.FC<SetupRequiredProps> = ({ missing, invalid }) => {
  return (
    <div className="min-h-screen bg-surface text-text-primary flex items-center justify-center p-6">
      <main className="w-full max-w-2xl rounded-2xl border border-border bg-surface-raised p-8 shadow-sm">
        <div className="flex items-start gap-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-warning/15 text-warning">
            <AlertTriangle className="h-6 w-6" aria-hidden="true" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Firebase Setup Required</h1>
            <p className="mt-2 text-sm text-text-secondary leading-relaxed">
              Converse cannot start because required Firebase configuration variables are missing or
              invalid. There is no simulated authentication or local-only fallback.
            </p>
          </div>
        </div>

        {missing.length > 0 && (
          <section className="mt-6">
            <h2 className="text-sm font-semibold text-text-primary flex items-center gap-2">
              <KeyRound className="h-4 w-4 text-text-secondary" aria-hidden="true" />
              Missing environment variables
            </h2>
            <ul className="mt-2 space-y-1.5 rounded-xl border border-border bg-surface p-4 font-mono text-xs">
              {missing.map((key) => (
                <li key={key} className="text-danger">
                  {key}
                </li>
              ))}
            </ul>
          </section>
        )}

        {invalid.length > 0 && (
          <section className="mt-6">
            <h2 className="text-sm font-semibold text-text-primary">Invalid configuration</h2>
            <ul className="mt-2 space-y-1.5 rounded-xl border border-border bg-surface p-4 text-xs">
              {invalid.map((item) => (
                <li key={item.key} className="text-danger">
                  <span className="font-mono font-semibold">{item.key}</span>: {item.message}
                </li>
              ))}
            </ul>
          </section>
        )}

        <section className="mt-6 rounded-xl border border-border bg-surface p-4 text-sm text-text-secondary">
          <p className="font-medium text-text-primary flex items-center gap-2">
            <FileCode2 className="h-4 w-4" aria-hidden="true" />
            How to configure
          </p>
          <ol className="mt-2 list-decimal pl-5 space-y-1 text-xs leading-relaxed">
            <li>
              Copy <code className="font-mono">.env.example</code> to{' '}
              <code className="font-mono">.env.local</code> or configure the{' '}
              <code className="font-mono">VITE_FIREBASE_*</code> variables in your environment
              settings.
            </li>
            <li>
              Follow <code className="font-mono">docs/EXTERNAL_SETUP.md</code> for Firebase Web App
              registration, Authentication providers, App Check, VAPID key, and TURN credentials.
            </li>
            <li>Reload the application once the variables are saved.</li>
          </ol>
        </section>
      </main>
    </div>
  );
};
