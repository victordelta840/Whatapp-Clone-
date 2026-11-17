import React, { useCallback, useEffect, useState } from 'react';
import { CheckCircle2, Copy, RefreshCw, ShieldAlert, XCircle, Radio } from 'lucide-react';
import {
  runDiagnostics,
  testTurnRelay,
  type DiagnosticCheckResult,
  type DiagnosticStatus,
} from '@/lib/diagnostics';
import { getEnvConfig } from '@/config/env';

function statusLabel(status: DiagnosticStatus): string {
  switch (status) {
    case 'pass':
      return 'Pass';
    case 'fail':
      return 'Fail';
    case 'requires-config':
      return 'Requires external configuration';
    case 'requires-backend':
      return 'Requires backend deployment';
  }
}

export const DiagnosticsPage: React.FC = () => {
  const [checks, setChecks] = useState<DiagnosticCheckResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [turnResult, setTurnResult] = useState<{ ok: boolean; detail: string } | null>(null);
  const [testingTurn, setTestingTurn] = useState(false);
  const [copied, setCopied] = useState(false);

  const executeChecks = useCallback(async () => {
    setLoading(true);
    const res = await runDiagnostics();
    setChecks(res);
    setLoading(false);
  }, []);

  useEffect(() => {
    let active = true;
    void runDiagnostics().then((res) => {
      if (!active) return;
      setChecks(res);
      setLoading(false);
    });
    return () => {
      active = false;
    };
  }, []);

  const handleTurnTest = async () => {
    setTestingTurn(true);
    const res = await testTurnRelay();
    setTurnResult(res);
    setTestingTurn(false);
  };

  const handleCopyReport = async () => {
    const env = getEnvConfig();
    const report = {
      generatedAt: new Date().toISOString(),
      projectId: env?.projectId ?? 'unconfigured',
      functionsRegion: env?.functionsRegion ?? 'unknown',
      usingEmulators: env?.useEmulators ?? false,
      checks: checks.map((c) => ({
        id: c.id,
        label: c.label,
        status: c.status,
        detail: c.detail,
      })),
      turnRelayTest: turnResult,
    };
    try {
      await navigator.clipboard.writeText(JSON.stringify(report, null, 2));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard may be restricted in preview iframe
    }
  };

  return (
    <div className="mx-auto max-w-3xl p-4 sm:p-6 space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-border pb-4">
        <div>
          <h1 className="text-xl font-bold text-text-primary">System Diagnostics</h1>
          <p className="mt-1 text-sm text-text-secondary">
            Live verification of Firebase services, App Check, Web Push, Service Worker, and WebRTC
            relay connectivity.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => void handleCopyReport()}
            className="min-h-[44px] inline-flex items-center gap-2 rounded-xl border border-border bg-surface-raised px-4 py-2 text-sm font-medium text-text-primary hover:bg-surface-sunken transition-colors whitespace-nowrap"
          >
            <Copy className="h-4 w-4" aria-hidden="true" />
            {copied ? 'Copied' : 'Copy Redacted Report'}
          </button>
          <button
            type="button"
            onClick={() => void executeChecks()}
            disabled={loading}
            className="min-h-[44px] inline-flex items-center gap-2 rounded-xl bg-brand px-4 py-2 text-sm font-medium text-brand-foreground hover:bg-brand-hover disabled:opacity-50 transition-colors whitespace-nowrap"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} aria-hidden="true" />
            Re-run Checks
          </button>
        </div>
      </div>

      <div className="divide-y divide-border rounded-2xl border border-border bg-surface-raised">
        {loading && checks.length === 0 ? (
          <div className="p-6 text-sm text-text-secondary" aria-busy="true">
            Running diagnostic probes...
          </div>
        ) : (
          checks.map((item) => (
            <div key={item.id} className="flex items-start justify-between gap-4 p-4">
              <div className="flex items-start gap-3">
                {item.status === 'pass' ? (
                  <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-success" aria-hidden="true" />
                ) : item.status === 'fail' ? (
                  <XCircle className="mt-0.5 h-5 w-5 shrink-0 text-danger" aria-hidden="true" />
                ) : (
                  <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0 text-warning" aria-hidden="true" />
                )}
                <div>
                  <div className="text-sm font-semibold text-text-primary">{item.label}</div>
                  <p className="mt-0.5 text-xs text-text-secondary">{item.detail}</p>
                </div>
              </div>
              <span
                className={`shrink-0 text-xs font-semibold tabular-nums ${
                  item.status === 'pass'
                    ? 'text-success'
                    : item.status === 'fail'
                      ? 'text-danger'
                      : 'text-warning'
                }`}
              >
                {statusLabel(item.status)}
              </span>
            </div>
          ))
        )}
      </div>

      <div className="rounded-2xl border border-border bg-surface-raised p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold text-text-primary">TURN Relay Connectivity Test</h2>
            <p className="mt-0.5 text-xs text-text-secondary">
              Forces <code className="font-mono">iceTransportPolicy: &apos;relay&apos;</code> to
              verify a TURN relay candidate can be gathered.
            </p>
          </div>
          <button
            type="button"
            onClick={() => void handleTurnTest()}
            disabled={testingTurn}
            className="min-h-[44px] inline-flex items-center gap-2 rounded-xl border border-border bg-surface px-4 py-2 text-sm font-medium text-text-primary hover:bg-surface-sunken disabled:opacity-50 transition-colors"
          >
            <Radio className="h-4 w-4" aria-hidden="true" />
            {testingTurn ? 'Testing TURN...' : 'Test TURN'}
          </button>
        </div>
        {turnResult && (
          <p
            className={`mt-3 text-xs font-medium ${
              turnResult.ok ? 'text-success' : 'text-warning'
            }`}
          >
            {turnResult.detail}
          </p>
        )}
      </div>
    </div>
  );
};
