'use client';

import { useState } from 'react';
import { Ban, Coins, Search, ShieldCheck } from 'lucide-react';
import { supabase } from '../../lib/supabaseClient';
import { adminFetch } from '../../lib/adminApiClient';
import {
  ADMIN_API_PATH,
  normalizeAccountStatus,
  readBfaxAmount,
  type UserBalanceRow,
} from '../../lib/admin';

type Props = {
  mode: 'credit' | 'users';
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

export default function UserLookupPanel({ mode, onLedgerRefresh }: Props) {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [profile, setProfile] = useState<UserBalanceRow | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [adjustOpen, setAdjustOpen] = useState(false);
  const [adjustAmount, setAdjustAmount] = useState('');
  const [adjustMode, setAdjustMode] = useState<'add' | 'subtract'>('add');
  const [adjustNote, setAdjustNote] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const searchUser = async () => {
    const target = email.trim();
    if (!target) {
      setMessage('유저 이메일을 입력하세요.');
      return;
    }

    setLoading(true);
    setMessage(null);

    try {
      const result = await adminFetch<{ user: UserBalanceRow | null }>(
        `${ADMIN_API_PATH}/user-balance?email=${encodeURIComponent(target)}`
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
        console.error('admin user lookup', apiError, fallbackError);
        setProfile(null);
        const detail = fallbackError instanceof Error ? fallbackError.message : 'unknown';
        setMessage(apiMsg || `유저 조회에 실패했습니다. (${detail})`);
      }
    } finally {
      setLoading(false);
    }
  };

  const applyBfaxAdjust = async () => {
    if (!profile?.customer_email) return;

    const deltaRaw = Number(adjustAmount);
    if (!Number.isFinite(deltaRaw) || deltaRaw <= 0) {
      setMessage('0보다 큰 BFAX 수량을 입력하세요.');
      return;
    }

    const signed = adjustMode === 'add' ? deltaRaw : -deltaRaw;
    const current = readBfaxAmount(profile);
    if (current + signed < 0) {
      setMessage('회수 후 BFAX 잔액이 음수가 될 수 없습니다.');
      return;
    }

    setSubmitting(true);
    setMessage(null);

    try {
      const result = await adminFetch<{ user: UserBalanceRow; ledgerWarning?: string | null }>(
        `${ADMIN_API_PATH}/user-balance`,
        {
          method: 'PATCH',
          body: JSON.stringify({
            email: profile.customer_email,
            delta: signed,
            note: adjustNote.trim(),
          }),
        }
      );

      setProfile(result.user);
      setAdjustOpen(false);
      setAdjustAmount('');
      setAdjustNote('');
      const next = readBfaxAmount(result.user);
      setMessage(
        result.ledgerWarning
          ? `BFAX 반영됨(잔액 ${next}). 장부 기록 실패: ${result.ledgerWarning}`
          : `BFAX ${signed > 0 ? '+' : ''}${signed} 반영 완료. 현재 잔액: ${next} BFAX`
      );
      onLedgerRefresh?.();
    } catch (e) {
      console.error('bfax adjust', e);
      setMessage(e instanceof Error ? e.message : 'BFAX 조정에 실패했습니다.');
    } finally {
      setSubmitting(false);
    }
  };

  const setBanStatus = async (status: 'BANNED' | 'ACTIVE') => {
    if (!profile?.customer_email) return;

    setSubmitting(true);
    setMessage(null);

    try {
      const result = await adminFetch<{ user: UserBalanceRow }>(`${ADMIN_API_PATH}/user-balance`, {
        method: 'PATCH',
        body: JSON.stringify({
          email: profile.customer_email,
          account_status: status,
        }),
      });
      setProfile(result.user);
      setMessage(
        status === 'BANNED'
          ? '유저를 BANNED 상태로 전환했습니다.'
          : '유저를 ACTIVE 상태로 복구했습니다.'
      );
      onLedgerRefresh?.();
    } catch (e) {
      console.error('ban status', e);
      setMessage(e instanceof Error ? e.message : '계정 상태 변경에 실패했습니다.');
    } finally {
      setSubmitting(false);
    }
  };

  const accountStatus = normalizeAccountStatus(profile?.account_status);
  const balance = readBfaxAmount(profile);
  const preview =
    adjustAmount && Number(adjustAmount) > 0
      ? balance + (adjustMode === 'add' ? Number(adjustAmount) : -Number(adjustAmount))
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
        <div className="rounded-2xl border border-zinc-800/80 bg-zinc-950/60 p-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <p className="font-mono text-[10px] uppercase tracking-wider text-[#10b981]/75">Target User</p>
              <p className="mt-1 text-lg font-semibold text-slate-100">{profile.customer_email}</p>
              <div className="mt-4 flex flex-wrap items-center gap-3">
                <div className="rounded-xl border border-[#10b981]/30 bg-[#07160f] px-4 py-3">
                  <p className="text-xs text-zinc-500">현재 BFAX 보유량</p>
                  <p className="mt-1 text-3xl font-extrabold tabular-nums text-[#10b981]">
                    {balance.toLocaleString()} <span className="text-base font-semibold">BFAX</span>
                  </p>
                </div>
                <div
                  className={`rounded-full px-3 py-1 text-xs font-bold ${
                    accountStatus === 'BANNED' ? 'bg-red-500/20 text-red-400' : 'bg-[#07160f] text-[#10b981]'
                  }`}
                >
                  {accountStatus}
                </div>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              {mode === 'credit' ? (
                <button type="button" onClick={() => setAdjustOpen(true)} disabled={submitting} className="inline-flex items-center gap-2 rounded-lg border border-[#10b981]/40 bg-[#07160f] px-4 py-2 text-sm font-semibold text-[#10b981] hover:bg-[#0a2018] disabled:opacity-50"><Coins className="h-4 w-4" />BFAX 조정</button>
              ) : null}
              {mode === 'users' ? (
                accountStatus !== 'BANNED' ? (
                  <button type="button" onClick={() => setBanStatus('BANNED')} disabled={submitting} className="inline-flex items-center gap-2 rounded-lg border border-red-900/60 bg-red-950/40 px-4 py-2 text-sm font-semibold text-red-400 hover:bg-red-950/70 disabled:opacity-50"><Ban className="h-4 w-4" />비활성화 (BANNED)</button>
                ) : (
                  <button type="button" onClick={() => setBanStatus('ACTIVE')} disabled={submitting} className="inline-flex items-center gap-2 rounded-lg border border-zinc-700 bg-zinc-900 px-4 py-2 text-sm font-semibold text-slate-200 hover:bg-zinc-800 disabled:opacity-50"><ShieldCheck className="h-4 w-4" />활성화 (ACTIVE)</button>
                )
              ) : null}
            </div>
          </div>
        </div>
      ) : null}

      {adjustOpen && profile ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="w-full max-w-md rounded-2xl border border-zinc-800 bg-[#0b0b0b] p-6 shadow-2xl">
            <h3 className="text-lg font-semibold text-slate-100">BFAX 수동 조정</h3>
            <p className="mt-1 text-sm text-zinc-500">{profile.customer_email}</p>
            <p className="mt-2 text-xs text-zinc-600">현재 잔액: {balance.toLocaleString()} BFAX</p>
            <div className="mt-5 space-y-4">
              <div className="flex gap-2">
                <button type="button" onClick={() => setAdjustMode('add')} className={`flex-1 rounded-lg py-2 text-sm font-medium ${adjustMode === 'add' ? 'bg-[#07160f] text-[#10b981] border border-[#10b981]/40' : 'border border-zinc-800 text-zinc-500'}`}>+ 지급</button>
                <button type="button" onClick={() => setAdjustMode('subtract')} className={`flex-1 rounded-lg py-2 text-sm font-medium ${adjustMode === 'subtract' ? 'bg-red-950/50 text-red-400 border border-red-900/50' : 'border border-zinc-800 text-zinc-500'}`}>− 회수</button>
              </div>
              <div><label className="text-xs text-zinc-500">BFAX 수량</label><input type="number" min={1} value={adjustAmount} onChange={(e) => setAdjustAmount(e.target.value)} className="mt-1 w-full rounded-lg border border-zinc-800 bg-[#060606] px-3 py-2 text-sm text-slate-100" /></div>
              {preview !== null && preview >= 0 ? (<p className="text-xs text-zinc-500">반영 후 예상: <span className="text-[#10b981]">{preview.toLocaleString()} BFAX</span></p>) : null}
              <div><label className="text-xs text-zinc-500">메모 (장부)</label><input value={adjustNote} onChange={(e) => setAdjustNote(e.target.value)} placeholder="ADMIN_ADJUST 사유" className="mt-1 w-full rounded-lg border border-zinc-800 bg-[#060606] px-3 py-2 text-sm text-slate-100" /></div>
            </div>
            <div className="mt-6 flex gap-2">
              <button type="button" onClick={() => setAdjustOpen(false)} className="flex-1 rounded-lg border border-zinc-800 py-2 text-sm text-zinc-400 hover:bg-zinc-900">취소</button>
              <button type="button" onClick={applyBfaxAdjust} disabled={submitting} className="flex-1 rounded-lg border border-[#10b981]/40 bg-[#07160f] py-2 text-sm font-semibold text-[#10b981] hover:bg-[#0a2018] disabled:opacity-50">{submitting ? '처리 중…' : 'BFAX 반영'}</button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
