'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { Coins, ExternalLink, Loader2 } from 'lucide-react';
import { useAccount, useSwitchChain, useSendTransaction, useWaitForTransactionReceipt } from 'wagmi';
import { parseEther } from 'viem';
import { polygonMainnet } from '../../../lib/polygonChain';
import { supabase } from '../../../lib/supabaseClient';

const neon = '#10b981';
const cardBg = '#0b0b0b';
const POLYGON_SCAN_TX = 'https://polygonscan.com/tx/';

function getTreasuryFromEnv(): string | null {
  const addr = process.env.NEXT_PUBLIC_TREASURY_ADDRESS?.trim();
  if (!addr || !/^0x[a-fA-F0-9]{40}$/.test(addr)) return null;
  return addr;
}

function getBfaxPerPolPublic(): number {
  const raw = process.env.NEXT_PUBLIC_BFAX_PER_POL ?? '100';
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? n : 100;
}

export default function CryptoRechargePage() {
  const treasury = getTreasuryFromEnv();
  const bfaxPerPol = getBfaxPerPolPublic();

  const { address, isConnected, chainId } = useAccount();
  const { switchChainAsync } = useSwitchChain();
  const { sendTransactionAsync, data: txHash, isPending: isSending, error: sendError } =
    useSendTransaction();
  const { isLoading: isConfirming, isSuccess: isConfirmed } = useWaitForTransactionReceipt({
    hash: txHash,
  });

  const [polAmount, setPolAmount] = useState('');
  const [balance, setBalance] = useState<number | null>(null);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [apiLoading, setApiLoading] = useState(false);
  const [phase, setPhase] = useState<'idle' | 'sent' | 'credited'>('idle');

  const expectedBfax = useMemo(() => {
    const pol = Number(polAmount);
    if (!Number.isFinite(pol) || pol <= 0) return 0;
    return Math.floor(pol * bfaxPerPol);
  }, [polAmount, bfaxPerPol]);

  const loadBalance = useCallback(async (email: string) => {
    const { data, error } = await supabase
      .from('lb_user_balance')
      .select('bfax_queue')
      .eq('customer_email', email)
      .maybeSingle();
    if (error) {
      console.error('balance fetch', error);
      setBalance(null);
      return;
    }
    setBalance(data?.bfax_queue ?? 0);
  }, []);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      const email = data.user?.email ?? null;
      setUserEmail(email);
      if (email) loadBalance(email);
    });
  }, [loadBalance]);

  const submitChargeToApi = useCallback(
    async (hash: string, pol: string, wallet: string) => {
      if (!userEmail) {
        setMessage('로그인이 필요합니다.');
        return;
      }

      setApiLoading(true);
      setMessage('온체인 입금 확인 및 BFAX 충전 처리 중…');

      try {
        const { data: sessionData } = await supabase.auth.getSession();
        const token = sessionData.session?.access_token;
        if (!token) throw new Error('로그인 세션이 없습니다.');

        const res = await fetch('/api/billing/charge-crypto', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            txHash: hash,
            walletAddress: wallet,
            polAmount: pol,
          }),
        });

        const body = await res.json().catch(() => ({}));
        if (!res.ok) {
          throw new Error(body.error || `충전 API 실패 (${res.status})`);
        }

        setPhase('credited');
        setMessage(
          `충전 완료: ${body.bfaxCredited} BFAX 반영 (입금 ${body.polAmount} POL). 잔액 ${body.balanceAfter} BFAX`
        );
        await loadBalance(userEmail);
        setPolAmount('');
      } catch (e) {
        console.error('charge-crypto client', e);
        setPhase('idle');
        setMessage(e instanceof Error ? e.message : 'BFAX 충전 처리에 실패했습니다.');
      } finally {
        setApiLoading(false);
      }
    },
    [userEmail, loadBalance]
  );

  useEffect(() => {
    if (!isConfirmed || !txHash || !address || phase !== 'sent') return;
    submitChargeToApi(txHash, polAmount, address);
  }, [isConfirmed, txHash, address, phase, polAmount, submitChargeToApi]);

  const handleRecharge = async () => {
    setMessage(null);
    setPhase('idle');

    if (!treasury) {
      setMessage('NEXT_PUBLIC_TREASURY_ADDRESS가 설정되지 않았습니다.');
      return;
    }
    if (!isConnected || !address) {
      setMessage('지갑을 연결해 주세요.');
      return;
    }
    if (chainId !== polygonMainnet.id) {
      try {
        await switchChainAsync({ chainId: polygonMainnet.id });
      } catch {
        setMessage('Polygon Mainnet(137)으로 네트워크를 전환해 주세요.');
        return;
      }
    }

    const pol = polAmount.trim();
    if (!pol || Number(pol) <= 0) {
      setMessage('0보다 큰 POL 수량을 입력하세요.');
      return;
    }

    try {
      setPhase('sent');
      setMessage('POL 전송 트랜잭션 제출 중…');
      await sendTransactionAsync({
        chainId: polygonMainnet.id,
        to: treasury as `0x${string}`,
        value: parseEther(pol),
      });
      setMessage('트랜잭션 전송됨. 블록 확정 대기 중…');
    } catch (e) {
      setPhase('idle');
      console.error('send tx', e);
      setMessage(e instanceof Error ? e.message : '트랜잭션 전송에 실패했습니다.');
    }
  };

  const busy = isSending || isConfirming || apiLoading;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-semibold text-slate-100">POL 암호화폐 충전</h2>
          <p className="text-sm text-slate-400 mt-1">
            Polygon Mainnet(137)에서 POL을 송금하면 BFAX가 자동 적립됩니다.
          </p>
        </div>
        <ConnectButton />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-xl border border-gray-800 p-4" style={{ backgroundColor: cardBg }}>
          <div className="text-xs uppercase text-slate-500 mb-1">보유 BFAX</div>
          <div className="text-2xl font-bold" style={{ color: neon }}>
            {balance === null ? '—' : balance.toLocaleString()}
          </div>
        </div>
        <div className="rounded-xl border border-gray-800 p-4" style={{ backgroundColor: cardBg }}>
            <div className="text-xs uppercase text-slate-500 mb-1">환율</div>
          <div className="text-lg text-slate-200">
            1 POL = <span style={{ color: neon }}>{bfaxPerPol}</span> BFAX
          </div>
        </div>
      </div>

      <div
        className="rounded-xl border border-gray-800 p-5 sm:p-6 space-y-5"
        style={{ backgroundColor: cardBg }}
      >
        <div className="flex items-center gap-2 text-slate-200">
          <Coins className="w-5 h-5" style={{ color: neon }} />
          <h3 className="font-semibold">코인 충전</h3>
        </div>

        {!treasury ? (
          <p className="text-sm text-amber-400">
            관리자: <code className="text-slate-300">NEXT_PUBLIC_TREASURY_ADDRESS</code>를 설정하세요.
          </p>
        ) : (
          <p className="text-xs text-slate-500 break-all">
            수신 주소: <span className="text-slate-300">{treasury}</span>
          </p>
        )}

        <div>
          <label htmlFor="pol-amount" className="block text-sm text-slate-400 mb-2">
            송금할 POL 수량
          </label>
          <input
            id="pol-amount"
            type="text"
            inputMode="decimal"
            placeholder="예: 0.5"
            value={polAmount}
            onChange={(e) => setPolAmount(e.target.value)}
            disabled={busy}
            className="w-full rounded-lg border border-gray-700 bg-[#050505] px-4 py-3 text-slate-100 placeholder:text-slate-600 focus:border-emerald-600 focus:outline-none"
          />
          {expectedBfax > 0 && (
            <p className="mt-2 text-sm text-slate-400">
              예상 적립: <span style={{ color: neon }}>{expectedBfax.toLocaleString()} BFAX</span>
            </p>
          )}
        </div>

        <button
          type="button"
          onClick={handleRecharge}
          disabled={busy || !treasury}
          className="w-full flex items-center justify-center gap-2 rounded-lg py-3 font-semibold text-[#050505] disabled:opacity-50 disabled:cursor-not-allowed transition"
          style={{ backgroundColor: neon }}
        >
          {busy ? <Loader2 className="w-5 h-5 animate-spin" /> : null}
          BFAX 충전하기
        </button>

        {sendError && (
          <p className="text-sm text-red-400">{sendError.message}</p>
        )}

        {message && (
          <p
            className={`text-sm ${
              phase === 'credited' ? 'text-emerald-400' : 'text-slate-300'
            }`}
          >
            {message}
          </p>
        )}

        {txHash && (
          <a
            href={`${POLYGON_SCAN_TX}${txHash}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-sm text-slate-400 hover:text-emerald-400"
          >
            Polygonscan에서 보기
            <ExternalLink className="w-4 h-4" />
          </a>
        )}

        <p className="text-xs text-slate-500">
          MetaMask·WalletConnect 등 멀티 지갑 모달로 연결 후, 트랜잭션 확정 시 자동으로 BFAX가
          적립됩니다.{' '}
          <Link href="/dashboard/billing" className="underline hover:text-slate-300">
            카드/번들 결제
          </Link>
          는 Billing 페이지에서 이용하세요.
        </p>
      </div>
    </div>
  );
}
