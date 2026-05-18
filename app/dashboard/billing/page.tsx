'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link2 } from 'lucide-react';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import {
  useAccount,
  useSendTransaction,
  useSwitchChain,
  useWaitForTransactionReceipt,
} from 'wagmi';
import { parseEther } from 'viem';
import { supabase } from '../../../lib/supabaseClient';
import { polygonMainnet } from '../../../lib/polygonChain';

const cardBg = '#0b0b0b';
const POLYGON_SCAN_TX = 'https://polygonscan.com/tx/';

const BFAX_PER_POL = Number(process.env.NEXT_PUBLIC_BFAX_PER_POL || '10');

function getTreasuryAddress(): `0x${string}` | null {
  const addr = process.env.NEXT_PUBLIC_TREASURY_ADDRESS?.trim();
  if (!addr || !/^0x[a-fA-F0-9]{40}$/.test(addr)) return null;
  return addr as `0x${string}`;
}

function polToBfax(pol: string): number {
  const n = Number(pol);
  if (!Number.isFinite(n) || n <= 0) return 0;
  return Math.floor(n * BFAX_PER_POL);
}

function extractTxHashFromNote(note?: string | null): string | null {
  const match = note?.match(/tx:(0x[a-fA-F0-9]{64})/i);
  return match?.[1] ?? null;
}

function readBalanceFromRow(row: { bfax_queue?: number | null; bfax_amount?: number | null } | null) {
  const raw = row?.bfax_queue ?? row?.bfax_amount ?? 0;
  const n = Number(raw);
  return Number.isFinite(n) ? n : 0;
}

type BillingRecord = {
  id: string;
  customer_email: string;
  bfax_amount: number;
  balance_after: number;
  status: string;
  note: string | null;
  created_at: string;
};

const tierOptions = [
  { id: 'tier1', pol: '10', label: 'Standard Bundle' },
  { id: 'tier2', pol: '50', label: 'Professional Bundle' },
  { id: 'tier3', pol: '100', label: 'Enterprise Bundle' },
];

export default function SecureBillingPage() {
  const treasury = getTreasuryAddress();

  const { address: walletAddress, isConnected, chainId } = useAccount();
  const { switchChainAsync } = useSwitchChain();
  const { sendTransactionAsync, data: txHash, isPending: isSending } = useSendTransaction();
  const { isLoading: isConfirming, isSuccess: isConfirmed } = useWaitForTransactionReceipt({
    hash: txHash,
  });

  const [selectedPol, setSelectedPol] = useState('50');
  const [balance, setBalance] = useState<number | null>(null);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [billingHistory, setBillingHistory] = useState<BillingRecord[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [purchaseLoading, setPurchaseLoading] = useState(false);
  const [purchaseMessage, setPurchaseMessage] = useState<string | null>(null);
  const [phase, setPhase] = useState<'idle' | 'sent' | 'credited'>('idle');

  const pendingChargeRef = useRef<{ pol: string; wallet: string } | null>(null);

  const selectedBfax = useMemo(() => polToBfax(selectedPol), [selectedPol]);

  const loadBalance = useCallback(async (email: string) => {
    const { data, error } = await supabase
      .from('lb_user_balance')
      .select('bfax_queue, bfax_amount')
      .eq('customer_email', email)
      .maybeSingle();

    if (error) {
      const fallback = await supabase
        .from('lb_user_balance')
        .select('bfax_queue')
        .eq('customer_email', email)
        .maybeSingle();
      if (!fallback.error) {
        setBalance(readBalanceFromRow(fallback.data));
        return;
      }
      setBalance(null);
      return;
    }
    setBalance(readBalanceFromRow(data));
  }, []);

  const fetchHistory = useCallback(async (email: string) => {
    setLoadingHistory(true);
    const { data } = await supabase
      .from('lb_recharge_history')
      .select('*')
      .eq('customer_email', email)
      .order('created_at', { ascending: false });
    setBillingHistory((data as BillingRecord[]) || []);
    setLoadingHistory(false);
  }, []);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      const email = data.user?.email ?? null;
      setUserEmail(email);
      if (email) {
        loadBalance(email);
        fetchHistory(email);
      }
    });
  }, [loadBalance, fetchHistory]);

  useEffect(() => {
    if (!userEmail) return;

    const balanceChannel = supabase
      .channel(`user_balance_${userEmail}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'lb_user_balance',
          filter: `customer_email=eq.${userEmail}`,
        },
        (payload) => {
          const newRow = payload.new as { bfax_queue?: number; bfax_amount?: number } | null;
          if (newRow) setBalance(readBalanceFromRow(newRow));
        }
      )
      .subscribe();

    const historyChannel = supabase
      .channel(`recharge_history_${userEmail}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'lb_recharge_history',
          filter: `customer_email=eq.${userEmail}`,
        },
        () => fetchHistory(userEmail)
      )
      .subscribe();

    return () => {
      supabase.removeChannel(balanceChannel);
      supabase.removeChannel(historyChannel);
    };
  }, [userEmail, fetchHistory]);

  const submitChargeToApi = useCallback(
    async (hash: string, pol: string, wallet: string) => {
      if (!userEmail) {
        setPurchaseMessage('로그인이 필요합니다.');
        return;
      }

      setPurchaseLoading(true);
      setPurchaseMessage('온체인 입금 확인 및 BFAX 충전 처리 중…');

      try {
        const { data: sessionData } = await supabase.auth.getSession();
        const token = sessionData.session?.access_token;
        if (!token) throw new Error('로그인 세션이 없습니다.');

        const response = await fetch('/api/billing/charge-crypto', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            txHash: hash,
            walletAddress: wallet,
            polAmount: pol,
          }),
        });

        const result = await response.json();
        if (!response.ok) {
          throw new Error(result.error || '백엔드 검증에 실패했습니다.');
        }

        setPhase('credited');
        setPurchaseMessage(
          `충전 완료: +${result.bfaxCredited} BFAX (입금 ${result.polAmount} POL). 잔액 ${result.balanceAfter} BFAX`
        );
        await loadBalance(userEmail);
        await fetchHistory(userEmail);
      } catch (err) {
        console.error(err);
        setPhase('idle');
        setPurchaseMessage(err instanceof Error ? err.message : 'BFAX 충전 처리에 실패했습니다.');
      } finally {
        setPurchaseLoading(false);
        pendingChargeRef.current = null;
      }
    },
    [userEmail, loadBalance, fetchHistory]
  );

  useEffect(() => {
    if (!isConfirmed || !txHash || phase !== 'sent') return;
    const pending = pendingChargeRef.current;
    if (!pending) return;
    submitChargeToApi(txHash, pending.pol, pending.wallet);
  }, [isConfirmed, txHash, phase, submitChargeToApi]);

  const handleCryptoRecharge = async () => {
    setPurchaseMessage(null);
    setPhase('idle');

    if (!userEmail) {
      setPurchaseMessage('로그인이 필요합니다.');
      return;
    }
    if (!treasury) {
      setPurchaseMessage('NEXT_PUBLIC_TREASURY_ADDRESS가 설정되지 않았습니다.');
      return;
    }
    if (!isConnected || !walletAddress) {
      setPurchaseMessage('지갑을 먼저 연결해 주세요.');
      return;
    }
    if (chainId !== polygonMainnet.id) {
      try {
        await switchChainAsync({ chainId: polygonMainnet.id });
      } catch {
        setPurchaseMessage('Polygon Mainnet(137)으로 네트워크를 전환해 주세요.');
        return;
      }
    }

    const pol = selectedPol.trim();
    if (!pol || Number(pol) <= 0) {
      setPurchaseMessage('유효한 POL 수량을 선택하세요.');
      return;
    }

    try {
      pendingChargeRef.current = { pol, wallet: walletAddress };
      setPhase('sent');
      setPurchaseLoading(true);
      setPurchaseMessage('지갑 서명 대기 중… Polygon Mainnet으로 POL을 전송합니다.');

      await sendTransactionAsync({
        chainId: polygonMainnet.id,
        to: treasury,
        value: parseEther(pol),
      });

      setPurchaseMessage('트랜잭션 전송됨. 블록 확정 대기 중…');
    } catch (err) {
      setPhase('idle');
      setPurchaseLoading(false);
      pendingChargeRef.current = null;
      console.error(err);
      setPurchaseMessage(
        err instanceof Error ? err.message : '트랜잭션이 취소되었거나 전송에 실패했습니다.'
      );
    }
  };

  const busy = purchaseLoading || isSending || isConfirming;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 xl:grid-cols-[1.2fr_0.8fr] gap-6">
        <div className="p-6 rounded-3xl" style={{ background: cardBg, border: '1px solid rgba(255,255,255,0.05)' }}>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h2 className="text-2xl font-semibold text-slate-100">BFAX 무인 온체인 조폐소</h2>
              <p className="mt-2 text-slate-500">
                Polygon Mainnet(137)에서 POL을 전송하면 BFAX 잔액이 실시간 반영됩니다.
              </p>
            </div>
            <ConnectButton />
          </div>

          <div className="mt-6 rounded-3xl border border-gray-800/60 bg-[#070707] p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-400">보유 BFAX 토큰 잔액</p>
                <p className="mt-2 text-5xl font-extrabold text-neon">
                  {balance === null ? '조회 중...' : `${balance.toLocaleString()} BFAX`}
                </p>
              </div>
              <div className="text-right">
                <p className="text-sm text-slate-400">지갑 타겟 금고</p>
                <p className="mt-2 text-xs font-mono text-slate-500">
                  {treasury ? `${treasury.slice(0, 6)}...${treasury.slice(-4)}` : '설정 누락'}
                </p>
              </div>
            </div>

            <div className="mt-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 bg-[#0d0d0d] p-4 rounded-2xl border border-gray-800/60">
              <div>
                <p className="text-xs uppercase tracking-[0.16em] text-slate-500">지정 청구 대금</p>
                <p className="mt-1 text-lg font-semibold text-slate-100">{selectedPol} POL 코인 투찰</p>
                <p className="text-xs text-neon">→ {selectedBfax.toLocaleString()} BFAX 토큰 적립 예정</p>
              </div>
              <button
                type="button"
                onClick={handleCryptoRecharge}
                disabled={busy || !isConnected || !treasury}
                className="inline-flex items-center justify-center rounded-full bg-neon px-6 py-3.5 font-semibold text-black transition hover:shadow-[0_0_25px_rgba(16,185,129,0.4)] disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-400"
              >
                {busy ? '블록체인 정산 중...' : '지갑 서명 및 BFAX 충전'}
              </button>
            </div>

            {purchaseMessage && (
              <div className="mt-4 rounded-2xl border border-neon/20 bg-[#081010] p-4 text-sm text-slate-300">
                {purchaseMessage}
              </div>
            )}

            {txHash && (
              <a
                href={`${POLYGON_SCAN_TX}${txHash}`}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-3 inline-flex items-center gap-1 text-xs text-slate-400 hover:text-neon"
              >
                <Link2 className="w-3.5 h-3.5" />
                Polygonscan에서 트랜잭션 보기
              </a>
            )}
          </div>
        </div>

        <div className="p-6 rounded-3xl" style={{ background: cardBg, border: '1px solid rgba(255,255,255,0.05)' }}>
          <h3 className="text-xl font-semibold text-slate-100">충전 패키지 정렬</h3>
          <p className="mt-1 text-sm text-slate-500">교환 요율: 1 POL = {BFAX_PER_POL} BFAX 토큰</p>

          <div className="mt-6 grid grid-cols-1 gap-4">
            {tierOptions.map((tier) => {
              const active = selectedPol === tier.pol;
              const tierBfax = polToBfax(tier.pol);
              return (
                <button
                  key={tier.id}
                  type="button"
                  onClick={() => setSelectedPol(tier.pol)}
                  className={`w-full rounded-3xl border p-5 text-left transition ${
                    active
                      ? 'border-neon bg-[#081010] shadow-[0_0_24px_rgba(16,185,129,0.15)]'
                      : 'border-gray-800 bg-[#070707] hover:border-slate-500'
                  }`}
                >
                  <p className="text-xs uppercase tracking-[0.2em] text-slate-500">{tier.label}</p>
                  <div className="mt-3 flex items-center justify-between">
                    <p className="text-2xl font-bold text-slate-100">{tierBfax.toLocaleString()} BFAX</p>
                    <p className="text-sm font-medium text-neon">{tier.pol} POL 코인</p>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <div className="p-6 rounded-3xl" style={{ background: cardBg, border: '1px solid rgba(255,255,255,0.05)' }}>
        <h3 className="text-xl font-semibold text-slate-100">BFAX 온체인 트랜잭션 충전 원장</h3>
        <p className="mt-1 text-sm text-slate-500">폴리곤 메인넷에서 검증된 충전 내역만 표시됩니다.</p>

        <div className="mt-6 overflow-x-auto">
          <table className="min-w-full text-left text-sm text-slate-200">
            <thead>
              <tr className="border-b border-gray-800/40 text-xs uppercase tracking-[0.2em] text-slate-500">
                <th className="py-3 px-3">결제 일시</th>
                <th className="py-3 px-3">BFAX 충전액</th>
                <th className="py-3 px-3">온체인 증적</th>
                <th className="py-3 px-3">상태</th>
                <th className="py-3 px-3">비고</th>
              </tr>
            </thead>
            <tbody>
              {loadingHistory ? (
                <tr>
                  <td colSpan={5} className="py-10 text-center text-slate-500">
                    원장 데이터 스캔 중...
                  </td>
                </tr>
              ) : billingHistory.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-10 text-center text-slate-500">
                    충전 기록이 없습니다.
                  </td>
                </tr>
              ) : (
                billingHistory.map((record) => {
                  const onChainTx = extractTxHashFromNote(record.note);
                  return (
                    <tr
                      key={record.id}
                      className="border-b border-gray-800/20 hover:bg-[#060606] transition"
                    >
                      <td className="py-4 px-3 text-slate-400">
                        {new Date(record.created_at).toLocaleString()}
                      </td>
                      <td className="py-4 px-3 text-neon font-semibold">
                        +{Number(record.bfax_amount).toLocaleString()} BFAX
                      </td>
                      <td className="py-4 px-3">
                        {onChainTx ? (
                          <a
                            href={`${POLYGON_SCAN_TX}${onChainTx}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1.5 text-slate-300 hover:text-neon font-mono text-xs"
                          >
                            <Link2 className="w-3.5 h-3.5" />
                            {onChainTx.slice(0, 10)}...{onChainTx.slice(-8)}
                          </a>
                        ) : (
                          <span className="text-slate-500">오프체인 조정</span>
                        )}
                      </td>
                      <td className="py-4 px-3">
                        <span
                          className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                            record.status === 'CRYPTO_RECHARGE'
                              ? 'bg-emerald-600/20 text-emerald-200'
                              : 'bg-blue-600/20 text-blue-200'
                          }`}
                        >
                          {record.status}
                        </span>
                      </td>
                      <td className="py-4 px-3 text-slate-400 text-xs max-w-xs truncate">
                        {record.note}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
