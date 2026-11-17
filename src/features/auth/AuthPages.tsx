import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import type { ConfirmationResult, RecaptchaVerifier } from 'firebase/auth';
import { ArrowLeft, CheckCircle2, Lock, MessageSquare, RefreshCw, ShieldAlert } from 'lucide-react';
import { WINDOWS } from '@/config/constants';
import { en } from '@/i18n';
import { mapFirebaseError } from '@/lib/errors';
import { Button, WhatsAppLogo, toast } from '@/components/ui';
import {
  confirmPhoneCode,
  createPhoneRecaptcha,
  resetPhoneRecaptcha,
  startPhoneSignIn,
} from './auth.service';
import {
  PHONE_COUNTRIES,
  findCountryByDialCode,
  formatReadablePhone,
  isValidE164,
  normalizeToE164,
} from './phoneCountries';

const RECAPTCHA_CONTAINER_ID = 'whatsapp-phone-recaptcha';

const SETUP_ERROR_CODES = new Set([
  'auth/operation-not-allowed',
  'auth/unauthorized-domain',
  'auth/captcha-check-failed',
  'auth/invalid-app-credential',
]);

export const AuthPages: React.FC<{ mode?: 'signin' }> = () => {
  const navigate = useNavigate();
  const location = useLocation();

  const [countryIso, setCountryIso] = useState('IN');
  const [dialCode, setDialCode] = useState('91');
  const [localPhone, setLocalPhone] = useState('');

  const [sentPhoneE164, setSentPhoneE164] = useState('');
  const [otpDigits, setOtpDigits] = useState<string[]>(['', '', '', '', '', '']);
  const [confirmation, setConfirmation] = useState<ConfirmationResult | null>(null);
  const [cooldown, setCooldown] = useState(0);

  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [setupHintCode, setSetupHintCode] = useState<string | null>(null);

  const verifierRef = useRef<RecaptchaVerifier | null>(null);
  const otpInputRefs = useRef<Array<HTMLInputElement | null>>([]);
  const lastAutoSubmittedCodeRef = useRef<string | null>(null);

  const params = new URLSearchParams(location.search);
  const redirectParam = params.get('redirect');
  const nextRoute = redirectParam && redirectParam.startsWith('/') ? redirectParam : '/chats';

  const selectedCountry = useMemo(
    () => PHONE_COUNTRIES.find((c) => c.iso === countryIso) ?? findCountryByDialCode(dialCode),
    [countryIso, dialCode],
  );

  const composedE164 = useMemo(
    () => normalizeToE164(dialCode, localPhone),
    [dialCode, localPhone],
  );

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = window.setInterval(() => {
      setCooldown((c) => Math.max(0, c - 1));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [cooldown]);

  useEffect(() => {
    return () => {
      resetPhoneRecaptcha(verifierRef.current, RECAPTCHA_CONTAINER_ID);
      verifierRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (confirmation) {
      otpInputRefs.current[0]?.focus();
    }
  }, [confirmation]);

  const handleCountryChange = (iso: string) => {
    setCountryIso(iso);
    const match = PHONE_COUNTRIES.find((c) => c.iso === iso);
    if (match) {
      setDialCode(match.dialCode);
    }
    setErrorMsg(null);
  };

  const handleDialCodeChange = (raw: string) => {
    const digits = raw.replace(/\D/g, '').slice(0, 4);
    setDialCode(digits);
    const matched = findCountryByDialCode(digits);
    if (matched) {
      setCountryIso(matched.iso);
    }
    setErrorMsg(null);
  };

  const sendOtpToPhone = useCallback(
    async (targetE164: string) => {
      setErrorMsg(null);
      setSetupHintCode(null);

      if (!isValidE164(targetE164)) {
        setErrorMsg('Enter a valid phone number with country code (for example, +91 98765 43210).');
        return;
      }

      setSubmitting(true);
      try {
        resetPhoneRecaptcha(verifierRef.current, RECAPTCHA_CONTAINER_ID);
        verifierRef.current = createPhoneRecaptcha(RECAPTCHA_CONTAINER_ID, 'invisible');
        const res = await startPhoneSignIn(targetE164, verifierRef.current);
        setConfirmation(res);
        setSentPhoneE164(targetE164);
        setOtpDigits(['', '', '', '', '', '']);
        lastAutoSubmittedCodeRef.current = null;
        setCooldown(WINDOWS.PHONE_RESEND_COOLDOWN_SEC);
        toast.info(`SMS verification code sent to ${formatReadablePhone(targetE164, dialCode)}.`);
      } catch (err) {
        const mapped = mapFirebaseError(err);
        resetPhoneRecaptcha(verifierRef.current, RECAPTCHA_CONTAINER_ID);
        verifierRef.current = null;
        if (SETUP_ERROR_CODES.has(mapped.code)) {
          setSetupHintCode(mapped.code);
        }
        setErrorMsg(mapped.userMessage);
      } finally {
        setSubmitting(false);
      }
    },
    [dialCode],
  );

  const handlePhoneFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await sendOtpToPhone(composedE164);
  };

  const verifyOtpCode = useCallback(
    async (code: string) => {
      if (!confirmation || submitting) return;
      if (!/^\d{6}$/.test(code)) {
        setErrorMsg('Enter the 6-digit SMS code sent to your phone.');
        return;
      }
      setErrorMsg(null);
      setSubmitting(true);
      try {
        const { isNewAccount } = await confirmPhoneCode(confirmation, code);
        if (isNewAccount) {
          toast.success('Phone number verified! Complete your WhatsApp profile.');
          const target =
            redirectParam && redirectParam.startsWith('/')
              ? `/onboarding?redirect=${encodeURIComponent(redirectParam)}`
              : '/onboarding';
          navigate(target, { replace: true });
        } else {
          toast.success('Phone number verified!');
          navigate(nextRoute, { replace: true });
        }
      } catch (err) {
        lastAutoSubmittedCodeRef.current = null;
        setErrorMsg(mapFirebaseError(err).userMessage);
      } finally {
        setSubmitting(false);
      }
    },
    [confirmation, navigate, nextRoute, redirectParam, submitting],
  );

  const otpJoined = otpDigits.join('');

  useEffect(() => {
    if (
      confirmation &&
      otpJoined.length === 6 &&
      /^\d{6}$/.test(otpJoined) &&
      lastAutoSubmittedCodeRef.current !== otpJoined &&
      !submitting
    ) {
      lastAutoSubmittedCodeRef.current = otpJoined;
      void verifyOtpCode(otpJoined);
    }
  }, [confirmation, otpJoined, submitting, verifyOtpCode]);

  const handleOtpDigitChange = (index: number, raw: string) => {
    const digitsOnly = raw.replace(/\D/g, '');
    if (!digitsOnly) {
      setOtpDigits((prev) => {
        const next = [...prev];
        next[index] = '';
        return next;
      });
      return;
    }

    // Handle multi-digit paste or iOS/Android one-time-code autofill
    if (digitsOnly.length > 1) {
      const sliced = digitsOnly.slice(0, 6).split('');
      setOtpDigits((prev) => {
        const next = [...prev];
        for (let i = 0; i < 6; i += 1) {
          next[i] = sliced[i] ?? '';
        }
        return next;
      });
      const focusIdx = Math.min(sliced.length, 5);
      otpInputRefs.current[focusIdx]?.focus();
      setErrorMsg(null);
      return;
    }

    setOtpDigits((prev) => {
      const next = [...prev];
      next[index] = digitsOnly;
      return next;
    });
    setErrorMsg(null);
    if (index < 5) {
      otpInputRefs.current[index + 1]?.focus();
    }
  };

  const handleOtpKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace') {
      if (otpDigits[index]) {
        setOtpDigits((prev) => {
          const next = [...prev];
          next[index] = '';
          return next;
        });
      } else if (index > 0) {
        setOtpDigits((prev) => {
          const next = [...prev];
          next[index - 1] = '';
          return next;
        });
        otpInputRefs.current[index - 1]?.focus();
      }
    } else if (e.key === 'ArrowLeft' && index > 0) {
      e.preventDefault();
      otpInputRefs.current[index - 1]?.focus();
    } else if (e.key === 'ArrowRight' && index < 5) {
      e.preventDefault();
      otpInputRefs.current[index + 1]?.focus();
    }
  };

  const handleOtpPaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '');
    if (pasted.length >= 2) {
      e.preventDefault();
      const chars = pasted.slice(0, 6).split('');
      setOtpDigits([
        chars[0] ?? '',
        chars[1] ?? '',
        chars[2] ?? '',
        chars[3] ?? '',
        chars[4] ?? '',
        chars[5] ?? '',
      ]);
      const focusIdx = Math.min(chars.length - 1, 5);
      otpInputRefs.current[focusIdx]?.focus();
      setErrorMsg(null);
    }
  };

  const handleWrongNumber = () => {
    setConfirmation(null);
    setOtpDigits(['', '', '', '', '', '']);
    setErrorMsg(null);
    setSetupHintCode(null);
    lastAutoSubmittedCodeRef.current = null;
  };

  const formattedSentPhone = formatReadablePhone(sentPhoneE164, dialCode);
  const currentHost = typeof window !== 'undefined' ? window.location.hostname : '';

  return (
    <div className="relative flex min-h-dvh w-full flex-col items-center justify-center bg-surface-sunken px-4 py-10">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 h-52 bg-brand dark:bg-[#005C4B]"
      />

      <div className="relative z-10 mb-5 flex w-full max-w-md items-center gap-2.5 text-white">
        <WhatsAppLogo className="h-8 w-8" />
        <span className="text-sm font-semibold tracking-wide uppercase">WhatsApp</span>
      </div>

      <div className="relative z-10 w-full max-w-md rounded-2xl border border-border bg-surface-raised p-6 shadow-md sm:p-8">
        {/* Keep reCAPTCHA container persistently mounted across phone/OTP steps */}
        <div id={RECAPTCHA_CONTAINER_ID} />

        {!confirmation ? (
          <form onSubmit={(e) => void handlePhoneFormSubmit(e)} className="space-y-5">
            <div className="text-center">
              <h1 className="text-xl font-bold text-text-primary">{en.auth.signInTitle}</h1>
              <p className="mt-1.5 text-xs leading-relaxed text-text-secondary">
                {en.auth.phoneSubtitle}
              </p>
            </div>

            <div className="space-y-3">
              <div>
                <label
                  htmlFor="wa-country-select"
                  className="mb-1 block text-xs font-medium text-text-secondary"
                >
                  Country
                </label>
                <select
                  id="wa-country-select"
                  value={selectedCountry?.iso ?? ''}
                  onChange={(e) => handleCountryChange(e.target.value)}
                  className="w-full rounded-lg border-b-2 border-brand bg-surface-muted px-3 py-2.5 text-sm font-medium text-text-primary outline-none transition-colors focus:bg-surface"
                >
                  {!selectedCountry && (
                    <option value="">Custom country code (+{dialCode || '?'})</option>
                  )}
                  {PHONE_COUNTRIES.map((country) => (
                    <option key={country.iso} value={country.iso}>
                      {country.flag} {country.name} (+{country.dialCode})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label
                  htmlFor="wa-local-phone"
                  className="mb-1 block text-xs font-medium text-text-secondary"
                >
                  Phone number
                </label>
                <div className="flex items-center gap-2.5">
                  <div className="flex w-24 shrink-0 items-center rounded-lg border-b-2 border-brand bg-surface-muted px-2.5 py-2.5 focus-within:bg-surface">
                    <span className="text-sm font-medium text-text-secondary select-none">+</span>
                    <input
                      type="text"
                      inputMode="numeric"
                      aria-label="Country dial code"
                      maxLength={4}
                      value={dialCode}
                      onChange={(e) => handleDialCodeChange(e.target.value)}
                      className="ml-1 w-full bg-transparent text-sm font-medium text-text-primary outline-none tabular-nums"
                    />
                  </div>
                  <div className="flex-1 rounded-lg border-b-2 border-brand bg-surface-muted px-3 py-2.5 focus-within:bg-surface">
                    <input
                      id="wa-local-phone"
                      type="tel"
                      inputMode="tel"
                      autoComplete="tel-national"
                      required
                      value={localPhone}
                      onChange={(e) => {
                        setLocalPhone(e.target.value);
                        setErrorMsg(null);
                      }}
                      placeholder={selectedCountry?.example ?? 'Phone number'}
                      className="w-full bg-transparent text-sm text-text-primary placeholder:text-text-tertiary outline-none tabular-nums"
                    />
                  </div>
                </div>
                {composedE164 && isValidE164(composedE164) && (
                  <p className="mt-1.5 flex items-center gap-1.5 text-[11px] text-accent">
                    <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
                    <span>Will verify {formatReadablePhone(composedE164, dialCode)} via SMS OTP</span>
                  </p>
                )}
              </div>
            </div>

            {errorMsg && (
              <div
                role="alert"
                className="rounded-xl border border-danger/30 bg-danger/10 p-3 text-xs text-danger"
              >
                <p className="font-medium">{errorMsg}</p>
                {setupHintCode && (
                  <div className="mt-2 space-y-1 border-t border-danger/20 pt-2 text-[11px] text-text-secondary">
                    <p className="flex items-center gap-1 font-semibold text-text-primary">
                      <ShieldAlert className="h-3.5 w-3.5 text-warning" />
                      Firebase Phone Auth setup checklist:
                    </p>
                    <p>1. Open Firebase Console &rarr; Authentication &rarr; Sign-in method &rarr; enable Phone.</p>
                    {currentHost && (
                      <p>
                        2. Under Authentication &rarr; Settings &rarr; Authorized domains, add{' '}
                        <code className="rounded bg-surface px-1 py-0.5 font-mono text-[10px] text-text-primary">
                          {currentHost}
                        </code>
                        .
                      </p>
                    )}
                    <p>3. Optional: add Phone numbers for testing in the Phone provider panel for instant deterministic OTP codes.</p>
                  </div>
                )}
              </div>
            )}

            <Button type="submit" fullWidth loading={submitting}>
              {en.auth.sendCode}
            </Button>
          </form>
        ) : (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void verifyOtpCode(otpJoined);
            }}
            className="space-y-5"
          >
            <div className="text-center">
              <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-brand/12 text-brand">
                <MessageSquare className="h-6 w-6" />
              </div>
              <h1 className="text-xl font-bold text-text-primary">
                Verify {formattedSentPhone}
              </h1>
              <p className="mt-1.5 text-xs leading-relaxed text-text-secondary">
                Enter the 6-digit SMS code sent to{' '}
                <span className="font-semibold text-text-primary">{formattedSentPhone}</span>.{' '}
                <button
                  type="button"
                  onClick={handleWrongNumber}
                  className="font-semibold text-brand hover:underline"
                >
                  {en.auth.wrongNumber}
                </button>
              </p>
            </div>

            <div>
              <label className="sr-only" htmlFor="wa-otp-0">
                6-digit SMS verification code
              </label>
              <div className="flex items-center justify-center gap-2 sm:gap-2.5">
                {otpDigits.map((digit, index) => (
                  <input
                    key={index}
                    id={`wa-otp-${index}`}
                    ref={(el) => {
                      otpInputRefs.current[index] = el;
                    }}
                    type="text"
                    inputMode="numeric"
                    autoComplete={index === 0 ? 'one-time-code' : 'off'}
                    maxLength={6}
                    aria-label={`Digit ${index + 1} of 6`}
                    value={digit}
                    disabled={submitting}
                    onChange={(e) => handleOtpDigitChange(index, e.target.value)}
                    onKeyDown={(e) => handleOtpKeyDown(index, e)}
                    onPaste={handleOtpPaste}
                    className="h-12 w-10 rounded-xl border-2 border-border bg-surface-muted text-center text-lg font-bold text-text-primary outline-none transition-colors focus:border-brand focus:bg-surface tabular-nums sm:h-14 sm:w-12 sm:text-xl"
                  />
                ))}
              </div>
              <p className="mt-2 text-center text-[11px] text-text-tertiary">
                Enter the 6-digit code
              </p>
            </div>

            {errorMsg && (
              <p
                className="rounded-xl border border-danger/30 bg-danger/10 px-3 py-2 text-center text-xs text-danger"
                role="alert"
              >
                {errorMsg}
              </p>
            )}

            <Button type="submit" fullWidth loading={submitting} disabled={otpJoined.length !== 6}>
              {en.auth.verifyCode}
            </Button>

            <div className="flex items-center justify-between border-t border-border pt-3 text-xs">
              <button
                type="button"
                onClick={handleWrongNumber}
                className="inline-flex items-center gap-1 font-medium text-text-secondary hover:text-text-primary"
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                Change number
              </button>
              <button
                type="button"
                disabled={cooldown > 0 || submitting}
                onClick={() => void sendOtpToPhone(sentPhoneE164)}
                className="inline-flex items-center gap-1.5 font-semibold text-brand disabled:text-text-tertiary hover:underline"
              >
                <RefreshCw className="h-3.5 w-3.5" />
                {cooldown > 0
                  ? `Resend SMS in 0:${String(cooldown).padStart(2, '0')}`
                  : en.auth.resendCode}
              </button>
            </div>
          </form>
        )}

        <div className="mt-6 flex items-start gap-2 rounded-xl border border-border bg-surface-sunken p-3 text-xs text-text-secondary">
          <Lock className="mt-0.5 h-4 w-4 shrink-0 text-accent" />
          <span>
            Your chats and calls are protected in transit (TLS) and at rest by Google Cloud infrastructure.
          </span>
        </div>
      </div>
    </div>
  );
};
