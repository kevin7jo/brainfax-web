'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { Sparkles, Ticket, Send, Bookmark, ExternalLink } from 'lucide-react';
import { supabase } from '../../../lib/supabaseClient';
import {
  REWARD_STATUS,
  parseRewardsHistoryRow,
  type RewardsHistoryRow,
} from '../../../lib/rewardsHistory';

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

function statusLabel(status: string): string {
  if (status === REWARD_STATUS.SUCCESS) return 'Success(🟢)';
  if (status === REWARD_STATUS.APPROVED) return 'Approved(🟢)';
  if (status === REWARD_STATUS.UNDER_REVIEW) return 'Under Review(🟡)';
  if (status === REWARD_STATUS.REJECTED) return 'Rejected(🔴)';
  return status;
}

async function getAccessToken(): Promise<string | null> {
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? null;
}

export default function RewardsPage() {
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

  const formatDate = (value: string) =>
    new Date(value).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });

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
        setErrorMessage('Unable to load mission history right now.');
        setHistory([]);
      } else {
        setErrorMessage(null);
        setHistory(payload.history ?? []);
      }
    } catch (error) {
      console.error('Failed to load rewards history:', error);
      setErrorMessage('Unable to load mission history right now.');
      setHistory([]);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    let rewardsChannel: ReturnType<typeof supabase.channel> | null = null;
    let authSubscription: { subscription: { unsubscribe: () => void } } | null = null;
    let currentEmail: string | null = null;

    const subscribeRealtime = (email: string) => {
      if (rewardsChannel) {
        supabase.removeChannel(rewardsChannel);
      }

      rewardsChannel = supabase.channel(`rewards-history-channel-${email}`);
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

    const init = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      const email = user?.email ?? null;
      currentEmail = email;
      setUserEmail(email);

      if (!email) {
        setLoading(false);
        return;
      }

      await fetchHistory();
      subscribeRealtime(email);
    };

    void init().then(() => {
      const { data } = supabase.auth.onAuthStateChange((_event, session) => {
        const email = session?.user?.email ?? null;
        if (email === currentEmail) return;

        currentEmail = email;
        setUserEmail(email);
        if (!email) {
          setHistory([]);
          setLoading(false);
          return;
        }

        setLoading(true);
        void fetchHistory();
        subscribeRealtime(email);
      });
      authSubscription = data;
    });

    return () => {
      if (rewardsChannel) supabase.removeChannel(rewardsChannel);
      authSubscription?.subscription.unsubscribe();
    };
  }, [fetchHistory]);

  const handleApplyPromo = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!promoCode.trim() || !userEmail) {
      setPromoError(true);
      setPromoMessage('프로모션 코드를 입력해 주세요.');
      return;
    }

    setPromoLoading(true);
    setPromoMessage('');
    setPromoError(false);

    try {
      const token = await getAccessToken();
      if (!token) {
        setPromoError(true);
        setPromoMessage('로그인이 필요합니다.');
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
        setPromoMessage(payload.error ?? '프로모션 적용에 실패했습니다.');
        return;
      }

      setPromoError(false);
      setPromoMessage(
        `프로모션 코드 ${payload.code} 적용 완료! ${payload.bfaxGranted} BFAX Queue가 충전되었습니다. (잔액: ${payload.balanceAfter} BFAX)`
      );
      setPromoCode('');
      await fetchHistory();
    } catch (e) {
      console.error('redeem promo', e);
      setPromoError(true);
      setPromoMessage('네트워크 오류로 프로모션을 적용하지 못했습니다.');
    } finally {
      setPromoLoading(false);
    }
  };

  const handleSubmitReview = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!reviewUrl.trim() || !userEmail) {
      setReviewError(true);
      setReviewMessage('리뷰 URL을 입력해 주세요.');
      return;
    }

    setReviewLoading(true);
    setReviewMessage('');
    setReviewError(false);

    try {
      const token = await getAccessToken();
      if (!token) {
        setReviewError(true);
        setReviewMessage('로그인이 필요합니다.');
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
        setReviewMessage(payload.error ?? '리뷰 제출에 실패했습니다.');
        return;
      }

      setReviewError(false);
      setReviewMessage(
        `리뷰가 제출되었습니다. 검수 후 ${payload.reward_bfax ?? 50} BFAX Queue가 지급됩니다.`
      );
      setReviewUrl('');
      await fetchHistory();
    } catch (e) {
      console.error('submit review', e);
      setReviewError(true);
      setReviewMessage('네트워크 오류로 리뷰를 제출하지 못했습니다.');
    } finally {
      setReviewLoading(false);
    }
  };

  return (
    <div className="min-h-screen p-3 sm:p-6 bg-[#050505] text-slate-200">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-sm uppercase tracking-[0.3em] text-zinc-500">Rewards & Promotions</p>
            <h1 className="text-xl sm:text-3xl font-semibold">Earn extra BFAX with mission rewards</h1>
          </div>
          <div className="inline-flex items-center gap-2 rounded-2xl border border-zinc-800 bg-[#101010] px-4 py-3 text-sm text-zinc-300">
            <Sparkles className="w-5 h-5 text-[#10b981]" />
            Weekly bonus missions available now
          </div>
        </div>

        <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1.2fr_1fr]">
          <section className="rounded-3xl border border-zinc-800 bg-zinc-950 p-5 sm:p-6 shadow-sm">
            <div className="flex items-center justify-between gap-3 mb-5">
              <div>
                <p className="text-sm text-zinc-400 uppercase tracking-[0.25em]">Enter Promotion Code</p>
                <h2 className="mt-2 text-xl sm:text-2xl font-semibold">Charge bonus BFAX instantly</h2>
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
                  placeholder="DEEPTECH10"
                  className="w-full rounded-2xl border border-zinc-800 bg-[#070707] px-4 py-3 text-sm text-slate-100 placeholder:text-zinc-500 focus:border-[#10b981] focus:outline-none"
                />
                <button
                  type="submit"
                  disabled={promoLoading}
                  className="inline-flex items-center justify-center gap-2 rounded-2xl bg-[#10b981] px-5 py-3 text-sm font-semibold text-black transition hover:brightness-105 disabled:opacity-50"
                >
                  {promoLoading ? 'Applying…' : 'Apply Code'}
                </button>
              </div>
              <p className="text-sm text-zinc-500">
                프로모션 코드 <span className="text-zinc-300">DEEPTECH10</span> — 10 BFAX 즉시 충전 (계정당 1회)
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
                <p className="text-sm text-zinc-400 uppercase tracking-[0.25em]">Share & Earn BFAX</p>
                <h2 className="mt-2 text-xl sm:text-2xl font-semibold">Review Mission Panel</h2>
              </div>
              <div className="rounded-2xl bg-[#081509] p-3 text-[#10b981]">
                <Bookmark className="w-6 h-6" />
              </div>
            </div>
            <p className="text-sm leading-7 text-zinc-300">
              블로그, 카페, SNS에 BrainFax 사용 후기를 남기고 URL을 제출하시면, 검수 후 50 BFAX Queue를
              보상으로 꽂아드립니다!
            </p>
            <div className="mt-5 rounded-3xl border border-zinc-800 bg-[#0b0b0b] p-5">
              <p className="text-sm font-semibold text-zinc-300">리뷰 작성 규칙</p>
              <ul className="mt-3 space-y-2 text-sm text-zinc-400">
                <li>• 리뷰는 500자 이상 작성해야 합니다.</li>
                <li>
                  • 필수 태그: <span className="text-[#10b981]">#BrainFax #LocalBrain</span>
                </li>
                <li>• 솔직하고 실제 사용 경험 기반 내용이어야 합니다.</li>
              </ul>
            </div>

            <form onSubmit={handleSubmitReview} className="mt-6 space-y-4">
              <input
                type="url"
                value={reviewUrl}
                onChange={(event) => setReviewUrl(event.target.value)}
                placeholder="https://blog.example.com/review"
                className="w-full rounded-2xl border border-zinc-800 bg-[#070707] px-4 py-3 text-sm text-slate-100 placeholder:text-zinc-500 focus:border-[#10b981] focus:outline-none"
              />
              <button
                type="submit"
                disabled={reviewLoading}
                className="inline-flex items-center justify-center gap-2 rounded-2xl bg-[#10b981] px-5 py-3 text-sm font-semibold text-black transition hover:brightness-105 disabled:opacity-50"
              >
                <Send className="w-4 h-4" />
                {reviewLoading ? 'Submitting…' : 'Submit Mission'}
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
              <p className="text-sm uppercase tracking-[0.25em] text-zinc-500">My Mission History</p>
              <h2 className="text-xl sm:text-2xl font-semibold">Recent reward activity</h2>
            </div>
            <div className="rounded-2xl bg-[#081509] px-4 py-2 text-sm text-[#10b981]">Latest activity</div>
          </div>

          <div className="-mx-4 px-4 mt-6 overflow-x-auto">
            {loading ? (
              <div className="rounded-3xl border border-zinc-800 bg-[#080808] p-6 text-sm text-zinc-400">
                Loading mission history...
              </div>
            ) : history.length === 0 ? (
              <div className="rounded-3xl border border-zinc-800 bg-[#080808] p-6 text-sm text-zinc-400">
                No mission history yet.
              </div>
            ) : (
              <table className="min-w-full border-separate border-spacing-y-3 text-sm">
                <thead>
                  <tr className="text-left text-xs uppercase tracking-[0.3em] text-zinc-500">
                    <th className="px-4 py-3">Date</th>
                    <th className="px-4 py-3">Activity</th>
                    <th className="px-4 py-3">Reward</th>
                    <th className="px-4 py-3">Status</th>
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
                            Review link
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
