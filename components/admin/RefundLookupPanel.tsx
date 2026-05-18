'use client';

import { useState } from 'react';
import { Search } from 'lucide-react';
import { supabase } from '../../lib/supabaseClient';
import { adminFetch } from '../../lib/adminApiClient';
import { readBfaxAmount, type UserBalanceRow } from '../../lib/admin';

type Props = {
  onLedgerRefresh?: () => void;
};

async function clientFallbackSearch(email: string): Promise<UserBalanceRow | null> {
  const { data, error } = await supabase
    .from('lb_user_balance')
    .select('customer_email, bfax_queue')
    .eq('customer_email', email.trim())
    .maybeSingle();
  if (error) throw new Error(error.message);
  return (data as UserBalanceRow) ?? null;
}

export default function RefundLookupPanel({ onLedgerRefresh }: Props) {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [profile, setProfile] = useState<UserBalanceRow | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [refundAmount, setRefundAmount] = useState('');
  const [refundNote, setRefundNote] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const balance = readBfaxAmount(profile);
  const maxRefund = balance;

  const searchUser = async () => {
    const target = email.trim();
    if (!target) {
      setMessage('유저 이메일을 입력하세요.');
      return;
    }

    setLoading(true);
    setMessage(null);
    setRefundAmount('');
    setRefundNote('');

    try {
      const result = await adminFetch<{ user: UserBalanceRow | null }>(
        `/api/admin/user-balance?email=${encodeURIComponent(target)}`
      );
      if (!result.user) {
        setProfile(null);
        setMessage(
          '해당 이메일의 BFAX 잔액 레코드가 없습니다. 대시보드 로그인 또는 충전 후 다시 조회하세요.'
        );
        return;
      }
      setProfile(result.user);
    } catch (apiError) {
      const apiMsg = apiError instanceof Error ? apiError.message : '';
      const needsServiceRole =
        apiMsg.includes('SERVICE_ROLE') ||
        apiMsg.includes('503') ||
        apiMsg.includes('서버에 설정');

      if (needsServiceRole) {
        setProfile(null);
        setMessage(apiMsg || 'SUPABASE_SERVICE_ROLE_KEY가 .env.local에 필요합니다.');
        return;
      }

      try {
        const row = await clientFallbackSearch(target);
        if (!row) {
          setProfile(null);
          setMessage('해당 이메일의 BFAX 잔액 레코드가 없습니다.');
          return;
        }
        setProfile(row);
        setMessage('본인 계정만 조회되었습니다. 전체 유저 조회는 SUPABASE_SERVICE_ROLE_KEY가 필요합니다.');
      } catch (fallbackError) {
        console.error('refund user lookup', apiError, fallbackError);
        setProfile(null);
        const detail = fallbackError instanceof Error ? fallbackError.message : 'unknown';
        setMessage(apiMsg || `유저 조회에 실패했습니다. (${detail})`);
      }
    } finally {
      setLoading(false);
    }
  };

  const applyRefund = async () => {
    if (!profile?.customer_email) return;

    const refundBfax = Number(refundAmount);

    if (!Number.isFinite(refundBfax) || refundBfax <= 0) {
      setMessage('0보다 큰 환불 BFAX 수량을 입력하세요.');
      return;
    }
    if (maxRefund <= 0) {
      setMessage('환불할 BFAX 잔액이 없습니다.');
      return;
    }
    if (refundBfax > maxRefund) {
      setMessage(
        `환불 수량은 현재 보유량(${maxRefund.toLocaleString()} BFAX)을 초과할 수 없습니다.`
      );
      return;
    }

    setSubmitting(true);
    setMessage(null);

    try {
      const result = await adminFetch<{ balance_after: number; ledgerWarning?: string | null }>(
        '/api/admin/ledger',
        {
          method: 'POST',
          body: JSON.stringify({
            email: profile.customer_email,
            bfax_amount: refundBfax,
            note: refundNote.trim(),
          }),
        }
      );

      setProfile({
        ...profile,
        bfax_queue: result.balance_after,
        bfax_amount: result.balance_after,
      });
      setRefundAmount('');
      setRefundNote('');
      setMessage(
        result.ledgerWarning
          ? `환불 반영(잔액 ${result.balance_after} BFAX). 장부: ${result.ledgerWarning}`
          : `환불 완료: ${refundBfax} BFAX 차감. 잔액 ${result.balance_after} BFAX`
      );
      onLedgerRefresh?.();
    } catch (e) {
      console.error('bfax refund', e);
      setMessage(e instanceof Error ? e.message : '환불 처리에 실패했습니다.');
    } finally {
      setSubmitting(false);
    }
  };

  const refundPreview =
    refundAmount && Number(refundAmount) > 0
      ? Math.max(0, balance - Number(refundAmount))
      : null;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && searchUser()}
            placeholder="user@company.com"
            className="w-full rounded-xl border border-zinc-800 bg-[#060606] py-3 pl-10 pr-4 text-sm text-slate-100 placeholder:text-zinc-600 focus:border-[#10b981]/50 focus:outline-none"
          />
        </div>
        <button
          type="button"
          onClick={searchUser}
          disabled={loading}
          className="inline-flex items-center justify-center gap-2 rounded-xl border border-[#10b981]/40 bg-[#07160f] px-5 py-3 text-sm font-semibold text-[#10b981] transition hover:bg-[#0a2018] disabled:opacity-50"
        >
          <Search className="h-4 w-4" />
          {loading ? '조회 중…' : '유저 검색'}
        </button>
      </div>

      {message ? (
        <div className="rounded-lg border border-zinc-800 bg-zinc-950/80 px-4 py-3 text-sm text-zinc-300">{message}</div>
      ) : null}

      {profile ? (
        <div className="rounded-2xl border border-zinc-800/80 bg-zinc-950/60 p-6 space-y-6">
          <div>
            <p className="font-mono text-[10px] uppercase tracking-wider text-[#10b981]/75">Refund Target</p>
            <p className="mt-1 text-lg font-semibold text-slate-100">{profile.customer_email}</p>
            <div className="mt-4 rounded-xl border border-[#10b981]/30 bg-[#07160f] px-4 py-3 inline-block">
              <p className="text-xs text-zinc-500">현재 BFAX 보유량 (환불 가능 최대)</p>
              <p className="mt-1 text-3xl font-extrabold tabular-nums text-[#10b981]">
                {balance.toLocaleString()} <span className="text-base font-semibold">BFAX</span>
              </p>
            </div>
          </div>

          <div className="border-t border-zinc-800/80 pt-6 space-y-4 max-w-lg">
            <h3 className="text-sm font-semibold text-slate-200">환불 처리</h3>
            <div>
              <label className="text-xs text-zinc-500">BFAX 환불 수량</label>
              <input
                type="number"
                min={balance > 0 ? 1 : 0}
                max={maxRefund}
                step={1}
                value={refundAmount}
                onChange={(e) => setRefundAmount(e.target.value)}
                placeholder={maxRefund > 0 ? `1 ~ ${maxRefund.toLocaleString()}` : '0'}
                disabled={maxRefund <= 0 || submitting}
                className="mt-1 w-full rounded-lg border border-zinc-800 bg-[#060606] px-3 py-2 text-sm text-slate-100 disabled:opacity-50"
              />
              <p className="mt-1 text-xs text-zinc-600">
                최대 {maxRefund.toLocaleString()} BFAX까지 환불 가능
              </p>
            </div>
            {refundPreview !== null && refundPreview >= 0 ? (
              <p className="text-xs text-zinc-500">
                환불 후 예상 잔액:{' '}
                <span className="text-[#10b981]">{refundPreview.toLocaleString()} BFAX</span>
              </p>
            ) : null}
            <div>
              <label className="text-xs text-zinc-500">메모 (장부)</label>
              <input
                value={refundNote}
                onChange={(e) => setRefundNote(e.target.value)}
                placeholder="REFUND 사유"
                disabled={submitting}
                className="mt-1 w-full rounded-lg border border-zinc-800 bg-[#060606] px-3 py-2 text-sm text-slate-100 disabled:opacity-50"
              />
            </div>
            <button
              type="button"
              onClick={applyRefund}
              disabled={submitting || maxRefund <= 0}
              className="w-full rounded-lg border border-red-900/50 bg-red-950/40 py-2.5 text-sm font-semibold text-red-400 hover:bg-red-950/60 disabled:opacity-50"
            >
              {submitting ? '처리 중…' : 'BFAX 환불 실행'}
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
