import React, { useEffect, useRef, useState } from 'react';
import type { ConfirmationResult, RecaptchaVerifier } from 'firebase/auth';
import { getDownloadURL, ref } from 'firebase/storage';
import { CheckCircle2, Download, LogOut, ShieldAlert, Smartphone, Trash2 } from 'lucide-react';
import { Button, Dialog, Input, PWAInstallCard, toast } from '@/components/ui';
import { requireFirebaseHandles } from '@/config/firebase';
import { mapFirebaseError } from '@/lib/errors';
import {
  confirmPhoneReauthentication,
  createPhoneRecaptcha,
  deleteAccountPermanently,
  formatReadablePhone,
  requestDataExport,
  resetPhoneRecaptcha,
  revokeAllUserSessions,
  signOutCleanly,
  startPhoneReauthentication,
  useAuthStore,
} from '@/features/auth';

const DELETE_RECAPTCHA_ID = 'whatsapp-delete-account-recaptcha';

export const AccountSettingsPage: React.FC = () => {
  const authUser = useAuthStore((s) => s.authUser);

  const [busy, setBusy] = useState(false);
  const [exportPath, setExportPath] = useState<string | null>(null);

  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deletePhrase, setDeletePhrase] = useState('');
  const [reauthConfirmation, setReauthConfirmation] = useState<ConfirmationResult | null>(null);
  const [reauthOtp, setReauthOtp] = useState('');
  const [sendingOtp, setSendingOtp] = useState(false);
  const verifierRef = useRef<RecaptchaVerifier | null>(null);

  useEffect(() => {
    return () => {
      resetPhoneRecaptcha(verifierRef.current, DELETE_RECAPTCHA_ID);
      verifierRef.current = null;
    };
  }, []);

  const handleDeleteDialogChange = (open: boolean) => {
    setDeleteOpen(open);
    if (!open) {
      resetPhoneRecaptcha(verifierRef.current, DELETE_RECAPTCHA_ID);
      verifierRef.current = null;
      setReauthConfirmation(null);
      setReauthOtp('');
      setDeletePhrase('');
    }
  };

  if (!authUser) return null;

  const formattedPhone = authUser.phoneNumber
    ? formatReadablePhone(authUser.phoneNumber)
    : 'Not linked';

  const handleExport = async () => {
    setBusy(true);
    try {
      const res = await requestDataExport();
      setExportPath(res.storagePath);
      toast.success('Account export archive ready for download.');
    } catch (err) {
      toast.error(mapFirebaseError(err).userMessage);
    } finally {
      setBusy(false);
    }
  };

  const handleDownloadExport = async () => {
    if (!exportPath) return;
    try {
      const { storage } = requireFirebaseHandles();
      const url = await getDownloadURL(ref(storage, exportPath));
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.target = '_blank';
      anchor.rel = 'noopener noreferrer';
      anchor.download = 'whatsapp-account-export.json';
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
    } catch (err) {
      toast.error(mapFirebaseError(err).userMessage);
    }
  };

  const handleSendDeleteOtp = async () => {
    setSendingOtp(true);
    try {
      resetPhoneRecaptcha(verifierRef.current, DELETE_RECAPTCHA_ID);
      verifierRef.current = createPhoneRecaptcha(DELETE_RECAPTCHA_ID, 'invisible');
      const conf = await startPhoneReauthentication(verifierRef.current);
      setReauthConfirmation(conf);
      toast.info(`Verification code sent to ${formattedPhone}.`);
    } catch (err) {
      resetPhoneRecaptcha(verifierRef.current, DELETE_RECAPTCHA_ID);
      verifierRef.current = null;
      toast.error(mapFirebaseError(err).userMessage);
    } finally {
      setSendingOtp(false);
    }
  };

  const handleDeleteAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    if (deletePhrase.trim() !== 'DELETE MY ACCOUNT') {
      toast.error('Type DELETE MY ACCOUNT exactly to confirm.');
      return;
    }
    if (authUser.phoneNumber) {
      if (!reauthConfirmation) {
        toast.error('Send and confirm your 6-digit SMS code first.');
        return;
      }
      if (!/^\d{6}$/.test(reauthOtp.trim())) {
        toast.error('Enter the 6-digit SMS verification code.');
        return;
      }
    }

    setBusy(true);
    try {
      if (authUser.phoneNumber && reauthConfirmation) {
        await confirmPhoneReauthentication(reauthConfirmation, reauthOtp.trim());
      }
      await deleteAccountPermanently();
      toast.success('Your account has been permanently deleted.');
    } catch (err) {
      toast.error(mapFirebaseError(err).userMessage);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-bold text-text-primary">Account &amp; security</h2>
        <p className="text-xs text-text-secondary">
          Manage your verified phone number, active sessions, data export, and account deletion.
        </p>
      </div>

      <div className="rounded-xl border border-border bg-surface-raised p-4 space-y-3">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-sm font-semibold text-text-primary">
            <Smartphone className="h-4 w-4 text-brand" />
            <span>Phone number</span>
          </div>
          {authUser.phoneNumber && (
            <span className="inline-flex items-center gap-1 rounded-full bg-accent/15 px-2.5 py-0.5 text-[11px] font-semibold text-accent">
              <CheckCircle2 className="h-3.5 w-3.5" />
              Verified via SMS
            </span>
          )}
        </div>
        <p className="text-base font-semibold text-text-primary tabular-nums">{formattedPhone}</p>
        <p className="text-xs text-text-secondary">
          Your WhatsApp account is secured solely by your phone number and SMS one-time verification codes.
        </p>
      </div>

      <PWAInstallCard />

      <div className="rounded-xl border border-border bg-surface-raised p-4 space-y-3">
        <h3 className="text-sm font-semibold text-text-primary">Sessions &amp; data</h3>
        <div className="flex flex-wrap gap-2">
          <Button
            size="sm"
            variant="secondary"
            leftIcon={<LogOut className="h-4 w-4" />}
            onClick={() => void signOutCleanly()}
          >
            Sign out this device
          </Button>
          <Button
            size="sm"
            variant="secondary"
            loading={busy}
            onClick={() =>
              void revokeAllUserSessions().catch((err) =>
                toast.error(mapFirebaseError(err).userMessage),
              )
            }
          >
            Sign out all devices
          </Button>
          <Button
            size="sm"
            variant="secondary"
            loading={busy}
            leftIcon={<Download className="h-4 w-4" />}
            onClick={() => void handleExport()}
          >
            Export my data (JSON)
          </Button>
          {exportPath && (
            <Button size="sm" onClick={() => void handleDownloadExport()}>
              Download export archive
            </Button>
          )}
        </div>
      </div>

      <div className="rounded-xl border border-danger/30 bg-danger/5 p-4 space-y-3">
        <div className="flex items-center gap-2 text-sm font-semibold text-danger">
          <ShieldAlert className="h-4 w-4" />
          <span>Danger zone</span>
        </div>
        <p className="text-xs text-text-secondary">
          Deleting your account permanently removes your profile, settings, contacts, devices, and phone registration.
        </p>
        <Button
          size="sm"
          variant="danger"
          leftIcon={<Trash2 className="h-4 w-4" />}
          onClick={() => setDeleteOpen(true)}
        >
          Delete my account
        </Button>
      </div>

      <Dialog
        open={deleteOpen}
        onOpenChange={handleDeleteDialogChange}
        title="Permanently delete account"
        description="Verify your phone number via SMS OTP and type DELETE MY ACCOUNT to confirm."
        size="sm"
      >
        <form onSubmit={(e) => void handleDeleteAccount(e)} className="space-y-4">
          <div id={DELETE_RECAPTCHA_ID} />

          {authUser.phoneNumber && (
            <div className="rounded-xl border border-border bg-surface-muted p-3 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-medium text-text-primary">
                  Verify {formattedPhone}
                </span>
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  loading={sendingOtp}
                  onClick={() => void handleSendDeleteOtp()}
                >
                  {reauthConfirmation ? 'Resend SMS' : 'Send SMS code'}
                </Button>
              </div>
              {reauthConfirmation && (
                <Input
                  label="6-digit SMS code"
                  inputMode="numeric"
                  maxLength={6}
                  required
                  value={reauthOtp}
                  onChange={(e) => setReauthOtp(e.target.value.replace(/\D/g, ''))}
                  placeholder="123456"
                />
              )}
            </div>
          )}

          <Input
            label='Type "DELETE MY ACCOUNT" to confirm'
            required
            value={deletePhrase}
            onChange={(e) => setDeletePhrase(e.target.value)}
          />

          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => handleDeleteDialogChange(false)}>
              Cancel
            </Button>
            <Button
              type="submit"
              variant="danger"
              loading={busy}
              disabled={
                deletePhrase.trim() !== 'DELETE MY ACCOUNT' ||
                (Boolean(authUser.phoneNumber) && (!reauthConfirmation || reauthOtp.length !== 6))
              }
            >
              Delete permanently
            </Button>
          </div>
        </form>
      </Dialog>
    </div>
  );
};
