'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import {
  CheckCircle2,
  Clock,
  Loader2,
  Mail,
  Plus,
  Trash2,
  X,
  Zap,
} from 'lucide-react';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { supabase } from '../../../../../lib/supabaseClient';
import { OTP_LENGTH } from '../../../../../lib/userEmailsConstants';

type LinkedEmailRow = {
  id: string;
  email: string;
  is_verified: boolean;
  created_at: string;
};

export default function LinkedEmailsPage() {
  const t = useTranslations('settings');
  const locale = useLocale();

  const [rows, setRows] = useState<LinkedEmailRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [newEmail, setNewEmail] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [requestLoading, setRequestLoading] = useState(false);
  const [verifyLoading, setVerifyLoading] = useState(false);
  const [deleteBusyId, setDeleteBusyId] = useState<string | null>(null);

  const [otpOpen, setOtpOpen] = useState(false);
  const [otpTargetEmail, setOtpTargetEmail] = useState('');
  const [otpCode, setOtpCode] = useState('');

  const formatDate = useCallback(
    (iso: string) => {
      try {
        return new Date(iso).toLocaleString(locale === 'ko' ? 'ko-KR' : 'en-US');
      } catch {
        return iso;
      }
    },
    [locale]
  );

  const getAccessToken = useCallback(async (): Promise<string> => {
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    if (!token) throw new Error(t('errors.loginRequired'));
    return token;
  }, [t]);

  const fetchEmails = useCallback(async () => {
    const { data, error } = await supabase
      .from('lb_user_emails')
      .select('id, email, is_verified, created_at')
      .order('created_at', { ascending: false });

    if (error) {
      console.error(error);
      setErrorMessage(t('errors.loadFailed'));
      setRows([]);
    } else {
      setRows((data as LinkedEmailRow[]) ?? []);
    }
    setLoading(false);
  }, [t]);

  useEffect(() => {
    let cancelled = false;
    let channel: RealtimeChannel | null = null;

    const detachRealtime = () => {
      if (channel) {
        void supabase.removeChannel(channel);
        channel = null;
      }
    };

    const attachRealtime = (userId: string) => {
      detachRealtime();
      const topic = `user-emails:${userId}:${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
      channel = supabase.channel(topic);
      channel.on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'lb_user_emails',
          filter: `user_id=eq.${userId}`,
        },
        () => {
          void fetchEmails();
        }
      );
      channel.subscribe();
    };

    let currentUserId: string | null = null;

    const syncForUser = async (userId: string | null) => {
      if (!userId) {
        detachRealtime();
        setRows([]);
        setLoading(false);
        return;
      }
      setLoading(true);
      await fetchEmails();
      if (cancelled) return;
      attachRealtime(userId);
      if (!cancelled) setLoading(false);
    };

    void (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (cancelled) return;
      const userId = user?.id ?? null;
      if (userId === currentUserId) return;
      currentUserId = userId;
      await syncForUser(userId);
    })();

    const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
      const userId = session?.user?.id ?? null;
      if (userId === currentUserId) return;
      currentUserId = userId;
      detachRealtime();
      void syncForUser(userId);
    });

    return () => {
      cancelled = true;
      detachRealtime();
      authListener.subscription.unsubscribe();
    };
  }, [fetchEmails]);

  const sendVerificationRequest = async (event: React.FormEvent) => {
    event.preventDefault();
    const email = newEmail.trim();
    if (!email) return;

    setRequestLoading(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const token = await getAccessToken();
      const response = await fetch('/api/settings/emails/request', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ email }),
      });

      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error || t('errors.requestFailed'));
      }

      setOtpTargetEmail(result.email ?? email);
      setOtpCode('');
      setOtpOpen(true);
      setSuccessMessage(result.message ?? t('success.codeSent'));
      await fetchEmails();
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : t('errors.requestGeneric'));
    } finally {
      setRequestLoading(false);
    }
  };

  const submitOtpVerification = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!otpTargetEmail || otpCode.replace(/\D/g, '').length !== OTP_LENGTH) return;

    setVerifyLoading(true);
    setErrorMessage(null);

    try {
      const token = await getAccessToken();
      const response = await fetch('/api/settings/emails/verify', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          email: otpTargetEmail,
          code: otpCode.replace(/\D/g, ''),
        }),
      });

      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error || t('errors.verifyFailed'));
      }

      setOtpOpen(false);
      setOtpCode('');
      setNewEmail('');
      setSuccessMessage(result.message ?? t('success.linked'));
      await fetchEmails();
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : t('errors.verifyFailed'));
    } finally {
      setVerifyLoading(false);
    }
  };

  const removeEmail = async (id: string) => {
    setDeleteBusyId(id);
    setErrorMessage(null);

    const { error, count } = await supabase
      .from('lb_user_emails')
      .delete({ count: 'exact' })
      .eq('id', id);

    if (error) {
      console.error(error);
      setErrorMessage(t('errors.deleteFailed'));
    } else if (count === 0) {
      setErrorMessage(t('errors.deleteNotAllowed'));
    } else {
      setRows((current) => current.filter((row) => row.id !== id));
      setSuccessMessage(t('success.deleted'));
    }

    setDeleteBusyId(null);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="inline-flex items-center gap-2 text-[#10b981] text-xs uppercase tracking-[0.25em] font-semibold">
            <Zap className="w-3.5 h-3.5" />
            {t('emails.brand')}
          </div>
          <h1 className="mt-2 text-2xl font-semibold text-slate-100">{t('emails.title')}</h1>
          <p className="mt-2 text-sm text-zinc-500 max-w-2xl">{t('emails.description')}</p>
        </div>
      </div>

      <div className="p-5 rounded-2xl border border-zinc-800 bg-zinc-900/80 shadow-[0_0_32px_rgba(16,185,129,0.06)]">
        <h2 className="text-lg font-medium text-slate-100 flex items-center gap-2">
          <Plus className="w-5 h-5 text-[#10b981]" />
          {t('emails.addTitle')}
        </h2>
        <form
          onSubmit={sendVerificationRequest}
          className="mt-4 flex flex-col md:flex-row gap-3"
        >
          <input
            type="email"
            value={newEmail}
            onChange={(e) => setNewEmail(e.target.value)}
            placeholder={t('emails.placeholder')}
            className="flex-1 rounded-xl border border-zinc-800 bg-[#070707] px-4 py-3 text-sm text-slate-100 placeholder:text-zinc-600 focus:border-[#10b981]/50 focus:outline-none focus:ring-1 focus:ring-[#10b981]/30"
            required
          />
          <button
            type="submit"
            disabled={requestLoading || !newEmail.trim()}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#10b981] px-5 py-3 text-sm font-semibold text-black hover:shadow-[0_0_24px_rgba(16,185,129,0.35)] disabled:opacity-50 disabled:cursor-not-allowed transition"
          >
            {requestLoading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Mail className="w-4 h-4" />
            )}
            {t('emails.sendVerification')}
          </button>
        </form>
        {successMessage && !otpOpen ? (
          <p className="mt-3 text-sm text-emerald-400">{successMessage}</p>
        ) : null}
        {errorMessage ? <p className="mt-3 text-sm text-rose-400">{errorMessage}</p> : null}
      </div>

      <div className="p-5 rounded-2xl border border-zinc-800 bg-zinc-900/80">
        <h2 className="text-lg font-medium text-slate-100 mb-4">{t('emails.listTitle')}</h2>

        {loading ? (
          <div className="flex items-center gap-2 text-sm text-zinc-400 py-8 justify-center">
            <Loader2 className="w-4 h-4 animate-spin text-[#10b981]" />
            {t('emails.loading')}
          </div>
        ) : rows.length === 0 ? (
          <p className="text-sm text-zinc-500 py-8 text-center border border-dashed border-zinc-800 rounded-xl">
            {t('emails.empty')}
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead>
                <tr className="text-xs uppercase tracking-wider text-zinc-500 border-b border-zinc-800">
                  <th className="py-3 px-3 font-medium">{t('table.email')}</th>
                  <th className="py-3 px-3 font-medium">{t('table.verificationStatus')}</th>
                  <th className="py-3 px-3 font-medium">{t('table.registeredAt')}</th>
                  <th className="py-3 px-3 font-medium text-right">{t('table.actions')}</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr
                    key={row.id}
                    className="border-b border-zinc-800/80 hover:bg-[#080808]/80 transition"
                  >
                    <td className="py-3 px-3 font-medium text-slate-200">{row.email}</td>
                    <td className="py-3 px-3">
                      {row.is_verified ? (
                        <span className="inline-flex items-center gap-1.5 text-emerald-400">
                          <span className="w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.9)]" />
                          {t('status.verified')}
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 text-amber-400">
                          <span className="w-2 h-2 rounded-full bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.8)]" />
                          {t('status.pending')}
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-3 text-zinc-400">
                      <span className="inline-flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5" />
                        {formatDate(row.created_at)}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-right">
                      <button
                        type="button"
                        title={t('actions.delete')}
                        disabled={deleteBusyId === row.id}
                        onClick={() => void removeEmail(row.id)}
                        className="inline-flex items-center gap-1 rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-1.5 text-xs text-red-400 hover:bg-zinc-700 disabled:opacity-50 transition"
                      >
                        {deleteBusyId === row.id ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <Trash2 className="w-3.5 h-3.5" />
                        )}
                        {t('actions.delete')}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {otpOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="otp-dialog-title"
            className="w-full max-w-md rounded-2xl border border-[#10b981]/30 bg-[#0a0a0a] p-6 shadow-[0_0_48px_rgba(16,185,129,0.15)]"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 id="otp-dialog-title" className="text-lg font-semibold text-slate-100">
                  {t('otp.title')}
                </h3>
                <p className="mt-1 text-sm text-zinc-500">
                  {t('otp.hint', { email: otpTargetEmail })}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setOtpOpen(false)}
                className="p-1.5 rounded-lg text-zinc-500 hover:text-slate-200 hover:bg-zinc-800"
                aria-label={t('actions.close')}
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={submitOtpVerification} className="mt-6 space-y-4">
              <input
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={OTP_LENGTH}
                value={otpCode}
                onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, '').slice(0, OTP_LENGTH))}
                placeholder={t('otp.placeholder')}
                className="w-full text-center text-2xl tracking-[0.5em] font-mono rounded-xl border border-zinc-800 bg-[#070707] px-4 py-4 text-[#10b981] focus:border-[#10b981]/50 focus:outline-none focus:ring-1 focus:ring-[#10b981]/40"
                autoFocus
              />
              <button
                type="submit"
                disabled={verifyLoading || otpCode.length !== OTP_LENGTH}
                className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-[#10b981] py-3 font-semibold text-black hover:shadow-[0_0_24px_rgba(16,185,129,0.35)] disabled:opacity-50 transition"
              >
                {verifyLoading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <CheckCircle2 className="w-4 h-4" />
                )}
                {t('actions.verifyComplete')}
              </button>
            </form>
            {successMessage ? (
              <p className="mt-3 text-xs text-emerald-400/90">{successMessage}</p>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
