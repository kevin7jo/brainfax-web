'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { Sparkles, Ticket, Send, Bookmark, ExternalLink } from 'lucide-react';
import { supabase } from '../../../../lib/supabaseClient';
import {
  REWARD_STATUS,
  parseRewardsHistoryRow,
  type RewardsHistoryRow,
} from '../../../../lib/rewardsHistory';

const DEFAULT_REVIEW_REWARD = 50;
const PROMO_HINT_CODE = 'DEEPTECH10';
const PROMO_HINT_AMOUNT = 10;

function statusStyle(status: string): string {
  if (status === REWARD_STATUS.SUCCESS || status === REWARD_STATUS.APPROVED) {
    return 'bg-emerald-900 text-emerald-300';
  }
  if (status === REWARD_STATUS.UNDER_REVIEW) {
    return 'bg-amber-900 text-amber-300';
  }
  if (status === REWARD_STATUS.REJECTED) {
    return 'bg-rose-900 text-rose-300';
  }
  return 'bg-zinc-800 text-zinc-300';
}

async function getAccessToken(): Promise<string | null> {
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? null;
}

export default function RewardsPage() {
  const t = useTranslations('rewards');
  const locale = useLocale();

  const [promoCode, setPromoCode] = useState('');
  const [reviewUrl, setReviewUrl] = useState('');
  const [promoMessage, setPromoMessage] = useState('');
  const [promoError, setPromoError] = useState(false);
  const [promoLoading, setPromoLoading] = useState(false);
  const [reviewMessage, setReviewMessage] = useState('');
  const [reviewError, setReviewError] = useState(false);
  const [reviewLoading, setReviewLoading] = useState(false);
  const [history, setHistory] = useState<RewardsHistoryRow[]>([]);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const formatDate = useCallback(
    (value: string) =>
      new Date(value).toLocaleDateString(locale === 'ko' ? 'ko-KR' : 'en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      }),
    [locale]
  );

  const statusLabel = useCallback(
    (status: string) => {
      if (status === REWARD_STATUS.SUCCESS) return t('status.success');
      if (status === REWARD_STATUS.APPROVED) return t('status.approved');
      if (status === REWARD_STATUS.UNDER_REVIEW) return t('status.underReview');
      if (status === REWARD_STATUS.REJECTED) return t('status.rejected');
      return status;
    },
    [t]
  );

  const fetchHistory = useCallback(async () => {
    const token = await getAccessToken();
    if (!token) {
      setHistory([]);
      setLoading(false);
      return;
    }

    try {
      const res = await fetch('/api/rewards/history', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const payload = (await res.json()) as { error?: string; history?: RewardsHistoryRow[] };

      if (!res.ok) {
        console.error('Failed to load rewards history:', payload.error);
        setErrorMessage(t('history.loadError'));
        setHistory([]);
      } else {
        setErrorMessage(null);
        setHistory(payload.history ?? []);
      }
    } catch (error) {
      console.error('Failed to load rewards history:', error);
      setErrorMessage(t('history.loadError'));
      setHistory([]);
    }
    setLoading(false);
  }, [t]);

  useEffect(() => {
    let cancelled = false;
    let rewardsChannel: ReturnType<typeof supabase.channel> | null = null;

    const detachRealtime = () => {
      if (rewardsChannel) {
        void supabase.removeChannel(rewardsChannel);
        rewardsChannel = null;
      }
    };

    const attachRealtime = (email: string) => {
      detachRealtime();
      const safeTopic = `rewards-history:${encodeURIComponent(email)}:${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
      rewardsChannel = supabase.channel(safeTopic);
      rewardsChannel.on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'lb_rewards_history',
          filter: `customer_email=eq.${email}`,
        },
        (payload) => {
          if (!payload.new && !payload.old) return;

          setHistory((current) => {
            if (payload.eventType === 'INSERT' && payload.new) {
              const row = parseRewardsHistoryRow(payload.new as Record<string, unknown>);
              if (!row || current.some((item) => item.id === row.id)) return current;
              return [row, ...current];
            }

            if (payload.eventType === 'UPDATE' && payload.new) {
              const row = parseRewardsHistoryRow(payload.new as Record<string, unknown>);
              if (!row) return current;
              return current.map((item) => (item.id === row.id ? row : item));
            }

            if (payload.eventType === 'DELETE' && payload.old) {
              const oldId = Number((payload.old as { id?: number }).id);
              return current.filter((item) => item.id !== oldId);
            }

            return current;
          });
        }
      );
      rewardsChannel.subscribe();
    };

    const syncUserAndHistory = async (email: string | null) => {
      setUserEmail(email);
      if (!email) {
        detachRealtime();
        setHistory([]);
        setLoading(false);
        return;
      }
      setLoading(true);
      await fetchHistory();
      if (cancelled) return;
      attachRealtime(email);
      if (!cancelled) setLoading(false);
    };

    let currentEmail: string | null = null;

    void (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (cancelled) return;
      const email = user?.email ?? null;
      if (email === currentEmail) return;
      currentEmail = email;
      await syncUserAndHistory(email);
    })();

    const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
      const email = session?.user?.email ?? null;
      if (email === currentEmail) return;
      currentEmail = email;
      detachRealtime();
      void syncUserAndHistory(email);
    });

    return () => {
      cancelled = true;
      detachRealtime();
      authListener.subscription.unsubscribe();
    };
  }, [fetchHistory]);

  const handleApplyPromo = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!promoCode.trim() || !userEmail) {
      setPromoError(true);
      setPromoMessage(t('errors.promoRequired'));
      return;
    }

    setPromoLoading(true);
    setPromoMessage('');
    setPromoError(false);

    try {
      const token = await getAccessToken();
      if (!token) {
        setPromoError(true);
        setPromoMessage(t('errors.loginRequired'));
        return;
      }

      const res = await fetch('/api/rewards/redeem-promo', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ code: promoCode.trim() }),
      });

      const payload = (await res.json()) as {
        error?: string;
        code?: string;
        bfaxGranted?: number;
        balanceAfter?: number;
      };

      if (!res.ok) {
        setPromoError(true);
        setPromoMessage(payload.error ?? t('errors.promoFailed'));
        return;
      }

      setPromoError(false);
      setPromoMessage(
        t('success.promoApplied', {
          code: payload.code ?? promoCode.trim(),
          granted: payload.bfaxGranted ?? 0,
          balance: payload.balanceAfter ?? 0,
        })
      );
      setPromoCode('');
      await fetchHistory();
    } catch (e) {
      console.error('redeem promo', e);
      setPromoError(true);
      setPromoMessage(t('errors.promoNetwork'));
    } finally {
      setPromoLoading(false);
    }
  };

  const handleSubmitReview = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!reviewUrl.trim() || !userEmail) {
      setReviewError(true);
      setReviewMessage(t('errors.reviewUrlRequired'));
      return;
    }

    setReviewLoading(true);
    setReviewMessage('');
    setReviewError(false);

    try {
      const token = await getAccessToken();
      if (!token) {
        setReviewError(true);
        setReviewMessage(t('errors.loginRequired'));
        return;
      }

      const res = await fetch('/api/rewards/submit-review', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ reviewUrl: reviewUrl.trim() }),
      });

      const payload = (await res.json()) as { error?: string; reward_bfax?: number };

      if (!res.ok) {
        setReviewError(true);
        setReviewMessage(payload.error ?? t('errors.reviewFailed'));
        return;
      }

      setReviewError(false);
      setReviewMessage(
        t('success.reviewSubmitted', {
          reward: payload.reward_bfax ?? DEFAULT_REVIEW_REWARD,
        })
      );
      setReviewUrl('');
      await fetchHistory();
    } catch (e) {
      console.error('submit review', e);
      setReviewError(true);
      setReviewMessage(t('errors.reviewNetwork'));
    } finally {
      setReviewLoading(false);
    }
  };

  return (
    <div className="min-h-screen p-3 sm:p-6 bg-[#050505] text-slate-200">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-sm uppercase tracking-[0.3em] text-zinc-500">{t('hero.eyebrow')}</p>
            <h1 className="text-xl sm:text-3xl font-semibold">{t('hero.title')}</h1>
          </div>
          <div className="inline-flex items-center gap-2 rounded-2xl border border-zinc-800 bg-[#101010] px-4 py-3 text-sm text-zinc-300">
            <Sparkles className="w-5 h-5 text-[#10b981]" />
            {t('hero.badge')}
          </div>
        </div>

        <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1.2fr_1fr]">
          <section className="rounded-3xl border border-zinc-800 bg-zinc-950 p-5 sm:p-6 shadow-sm">
            <div className="flex items-center justify-between gap-3 mb-5">
              <div>
                <p className="text-sm text-zinc-400 uppercase tracking-[0.25em]">{t('promo.eyebrow')}</p>
                <h2 className="mt-2 text-xl sm:text-2xl font-semibold">{t('promo.title')}</h2>
              </div>
              <div className="rounded-2xl bg-[#081509] p-3 text-[#10b981]">
                <Ticket className="w-6 h-6" />
              </div>
            </div>

            <form onSubmit={handleApplyPromo} className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
                <input
                  type="text"
                  value={promoCode}
                  onChange={(event) => setPromoCode(event.target.value)}
                  placeholder={t('promo.placeholder')}
                  className="w-full rounded-2xl border border-zinc-800 bg-[#070707] px-4 py-3 text-sm text-slate-100 placeholder:text-zinc-500 focus:border-[#10b981] focus:outline-none"
                />
                <button
                  type="submit"
                  disabled={promoLoading}
                  className="inline-flex items-center justify-center gap-2 rounded-2xl bg-[#10b981] px-5 py-3 text-sm font-semibold text-black transition hover:brightness-105 disabled:opacity-50"
                >
                  {promoLoading ? t('promo.applying') : t('promo.applyCta')}
                </button>
              </div>
              <p className="text-sm text-zinc-500">
                {t('promo.hint', { code: PROMO_HINT_CODE, amount: PROMO_HINT_AMOUNT })}
              </p>
              {promoMessage ? (
                <p
                  className={`rounded-2xl border px-4 py-3 text-sm ${
                    promoError
                      ? 'border-rose-500/20 bg-rose-500/10 text-rose-200'
                      : 'border-emerald-500/20 bg-emerald-500/10 text-emerald-200'
                  }`}
                >
                  {promoMessage}
                </p>
              ) : null}
            </form>
          </section>

          <section className="rounded-3xl border border-zinc-800 bg-zinc-950 p-5 sm:p-6 shadow-sm">
            <div className="flex items-center justify-between gap-3 mb-5">
              <div>
                <p className="text-sm text-zinc-400 uppercase tracking-[0.25em]">{t('review.eyebrow')}</p>
                <h2 className="mt-2 text-xl sm:text-2xl font-semibold">{t('review.title')}</h2>
              </div>
              <div className="rounded-2xl bg-[#081509] p-3 text-[#10b981]">
                <Bookmark className="w-6 h-6" />
              </div>
            </div>
            <p className="text-sm leading-7 text-zinc-300">
              {t('review.description', { reward: DEFAULT_REVIEW_REWARD })}
            </p>
            <div className="mt-5 rounded-3xl border border-zinc-800 bg-[#0b0b0b] p-5">
              <p className="text-sm font-semibold text-zinc-300">{t('review.rulesTitle')}</p>
              <ul className="mt-3 space-y-2 text-sm text-zinc-400">
                <li>{t('review.ruleMinLength')}</li>
                <li>
                  {t('review.ruleTags')}{' '}
                  <span className="text-[#10b981]">#BrainFax #LocalBrain</span>
                </li>
                <li>{t('review.ruleAuthentic')}</li>
              </ul>
            </div>

            <form onSubmit={handleSubmitReview} className="mt-6 space-y-4">
              <input
                type="url"
                value={reviewUrl}
                onChange={(event) => setReviewUrl(event.target.value)}
                placeholder={t('review.urlPlaceholder')}
                className="w-full rounded-2xl border border-zinc-800 bg-[#070707] px-4 py-3 text-sm text-slate-100 placeholder:text-zinc-500 focus:border-[#10b981] focus:outline-none"
              />
              <button
                type="submit"
                disabled={reviewLoading}
                className="inline-flex items-center justify-center gap-2 rounded-2xl bg-[#10b981] px-5 py-3 text-sm font-semibold text-black transition hover:brightness-105 disabled:opacity-50"
              >
                <Send className="w-4 h-4" />
                {reviewLoading ? t('review.submitting') : t('review.submitCta')}
              </button>
              {reviewMessage ? (
                <p
                  className={`rounded-2xl border px-4 py-3 text-sm ${
                    reviewError
                      ? 'border-rose-500/20 bg-rose-500/10 text-rose-200'
                      : 'border-amber-500/20 bg-amber-500/10 text-amber-200'
                  }`}
                >
                  {reviewMessage}
                </p>
              ) : null}
            </form>
          </section>
        </div>

        <section className="rounded-3xl border border-zinc-800 bg-zinc-950 p-5 sm:p-6 shadow-sm">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm uppercase tracking-[0.25em] text-zinc-500">{t('history.eyebrow')}</p>
              <h2 className="text-xl sm:text-2xl font-semibold">{t('history.title')}</h2>
            </div>
            <div className="rounded-2xl bg-[#081509] px-4 py-2 text-sm text-[#10b981]">{t('history.badge')}</div>
          </div>

          <div className="-mx-4 px-4 mt-6 overflow-x-auto">
            {loading ? (
              <div className="rounded-3xl border border-zinc-800 bg-[#080808] p-6 text-sm text-zinc-400">
                {t('history.loading')}
              </div>
            ) : history.length === 0 ? (
              <div className="rounded-3xl border border-zinc-800 bg-[#080808] p-6 text-sm text-zinc-400">
                {t('history.empty')}
              </div>
            ) : (
              <table className="min-w-full border-separate border-spacing-y-3 text-sm">
                <thead>
                  <tr className="text-left text-xs uppercase tracking-[0.3em] text-zinc-500">
                    <th className="px-4 py-3">{t('history.colDate')}</th>
                    <th className="px-4 py-3">{t('history.colActivity')}</th>
                    <th className="px-4 py-3">{t('history.colReward')}</th>
                    <th className="px-4 py-3">{t('history.colStatus')}</th>
                  </tr>
                </thead>
                <tbody>
                  {history.map((item) => (
                    <tr key={item.id} className="rounded-3xl bg-[#080808] border border-zinc-800">
                      <td className="px-4 py-4 text-slate-300">{formatDate(item.created_at)}</td>
                      <td className="px-4 py-4 text-slate-100">
                        <div>{item.activity}</div>
                        {item.review_url ? (
                          <a
                            href={item.review_url}
                            target="_blank"
                            rel="noreferrer"
                            className="mt-1 inline-flex items-center gap-1 text-xs text-[#10b981] hover:underline"
                          >
                            <ExternalLink className="h-3 w-3" />
                            {t('history.reviewLink')}
                          </a>
                        ) : null}
                      </td>
                      <td className="px-4 py-4 text-slate-200">{item.reward_bfax} BFAX</td>
                      <td className="px-4 py-4">
                        <span
                          className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold ${statusStyle(item.status)}`}
                        >
                          {statusLabel(item.status)}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
          {errorMessage ? <p className="mt-4 text-sm text-rose-400">{errorMessage}</p> : null}
        </section>
      </div>
    </div>
  );
}
