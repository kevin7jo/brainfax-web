'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link2 } from 'lucide-react';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import {
  useAccount,
  useReadContract,
  useSendTransaction,
  useSwitchChain,
  useWaitForTransactionReceipt,
  useWriteContract,
} from 'wagmi';
import { erc20Abi, parseEther, parseUnits } from 'viem';
import { supabase } from '../../../lib/supabaseClient';
import { polygonMainnet } from '../../../lib/polygonChain';
import type { PaymentMethod } from '../../../lib/cryptoPayment';
import {
  BFAX_QUEUE_LABEL,
  BFAX_TOKEN_LABEL,
  formatBfaxQueue,
  formatBfaxToken,
  formatPolToQueueRate,
} from '../../../lib/bfaxBranding';
import {
  BFAX_PRICE_FLOOR_USD,
  BFAX_TOKEN_PAYMENT_BONUS_PERCENT,
  RECHARGE_PACKAGES,
  computeSaaSCreditsForPackage,
  computeVariableBfaxTokenCharge,
  formatOracleQuoteForUi,
  type BfaxOracleSnapshot,
  type PackageId,
} from '../../../lib/bfaxOracle';

function formatTierQueueCredit(packageId: PackageId, paymentMethod: PaymentMethod): string {
  if (paymentMethod === 'POL') {
    const pkg = RECHARGE_PACKAGES[packageId];
    return formatBfaxQueue(polToBfax(pkg.polAmount));
  }
  return formatBfaxQueue(computeSaaSCreditsForPackage(packageId, 'BFAX'), { bonus: true });
}

const cardBg = '#0b0b0b';
const POLYGON_SCAN_TX = 'https://polygonscan.com/tx/';
const BFAX_PER_POL = Number(process.env.NEXT_PUBLIC_BFAX_PER_POL || '10');

const tierOptions = Object.values(RECHARGE_PACKAGES);

function getTreasuryAddress(): `0x${string}` | null {
  const addr = process.env.NEXT_PUBLIC_TREASURY_ADDRESS?.trim();
  if (!addr || !/^0x[a-fA-F0-9]{40}$/.test(addr)) return null;
  return addr as `0x${string}`;
}

function getBfaxContractAddress(): `0x${string}` | null {
  const addr = process.env.NEXT_PUBLIC_BFAX_CONTRACT_ADDRESS?.trim();
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

type PendingCharge = {
  method: PaymentMethod;
  wallet: string;
  packageId: PackageId;
  pol?: string;
  bfax?: string;
};

export default function SecureBillingPage() {
  const treasury = getTreasuryAddress();
  const bfaxContract = getBfaxContractAddress();

  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('POL');
  const [selectedTierId, setSelectedTierId] = useState<PackageId>('tier2');
  const [oracle, setOracle] = useState<BfaxOracleSnapshot | null>(null);
  const [oracleLoading, setOracleLoading] = useState(false);

  const { address: walletAddress, isConnected, chainId } = useAccount();
  const { switchChainAsync } = useSwitchChain();
  const { sendTransactionAsync, data: polTxHash, isPending: isPolSending } = useSendTransaction();
  const { writeContractAsync, data: bfaxTxHash, isPending: isBfaxSending } = useWriteContract();

  const activeTxHash = paymentMethod === 'POL' ? polTxHash : bfaxTxHash;
  const { isLoading: isConfirming, isSuccess: isConfirmed } = useWaitForTransactionReceipt({
    hash: activeTxHash,
  });

  const { data: tokenDecimals } = useReadContract({
    address: bfaxContract ?? undefined,
    abi: erc20Abi,
    functionName: 'decimals',
    chainId: polygonMainnet.id,
    query: { enabled: Boolean(bfaxContract) },
  });

  const decimals = tokenDecimals !== undefined ? Number(tokenDecimals) : 18;

  const selectedTier = RECHARGE_PACKAGES[selectedTierId];
  const selectedPol = selectedTier.polAmount;

  const [balance, setBalance] = useState<number | null>(null);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [billingHistory, setBillingHistory] = useState<BillingRecord[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [purchaseLoading, setPurchaseLoading] = useState(false);
  const [purchaseMessage, setPurchaseMessage] = useState<string | null>(null);
  const [phase, setPhase] = useState<'idle' | 'sent' | 'credited'>('idle');

  const pendingChargeRef = useRef<PendingCharge | null>(null);

  const fetchOracle = useCallback(async () => {
    setOracleLoading(true);
    try {
      const res = await fetch('/api/billing/bfax-price', { cache: 'no-store' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || '오라클 조회 실패');
      setOracle({
        marketPriceUsd: data.marketPriceUsd,
        effectivePriceUsd: data.effectivePriceUsd,
        priceFloorUsd: data.priceFloorUsd,
        source: data.source,
        updatedAt: data.updatedAt,
      });
    } catch (e) {
      console.error('oracle fetch', e);
      setOracle(null);
    } finally {
      setOracleLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchOracle();
  }, [fetchOracle, selectedTierId, paymentMethod]);

  const oracleQuote = useMemo(() => {
    if (paymentMethod !== 'BFAX' || !oracle) return null;
    return formatOracleQuoteForUi({
      packageId: selectedTierId,
      effectivePriceUsd: oracle.effectivePriceUsd,
      marketPriceUsd: oracle.marketPriceUsd,
      tokenDecimals: decimals,
    });
  }, [paymentMethod, oracle, selectedTierId, decimals]);

  const variableBfaxWei = useMemo(() => {
    if (!oracle || paymentMethod !== 'BFAX') return null;
    return computeVariableBfaxTokenCharge({
      packageUsd: selectedTier.usdValue,
      effectivePriceUsd: oracle.effectivePriceUsd,
      tokenDecimals: decimals,
    }).tokenAmountWei;
  }, [oracle, paymentMethod, selectedTier.usdValue, decimals]);

  const expectedQueueCredits = useMemo(() => {
    if (paymentMethod === 'POL') return polToBfax(selectedPol);
    if (oracleQuote) return oracleQuote.saasCredits;
    return computeSaaSCreditsForPackage(selectedTierId, 'BFAX');
  }, [paymentMethod, selectedPol, oracleQuote, selectedTierId]);

  const expectedQueueLabel = useMemo(() => {
    if (paymentMethod === 'BFAX') {
      return formatBfaxQueue(expectedQueueCredits, { bonus: true });
    }
    return formatBfaxQueue(expectedQueueCredits);
  }, [paymentMethod, expectedQueueCredits]);

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
    async (hash: string, pending: PendingCharge) => {
      if (!userEmail) {
        setPurchaseMessage('로그인이 필요합니다.');
        return;
      }

      setPurchaseLoading(true);
      setPurchaseMessage(`온체인 입금 확인 및 ${BFAX_QUEUE_LABEL} 충전 처리 중…`);

      try {
        const { data: sessionData } = await supabase.auth.getSession();
        const token = sessionData.session?.access_token;
        if (!token) throw new Error('로그인 세션이 없습니다.');

        const body = {
          txHash: hash,
          walletAddress: pending.wallet,
          packageId: pending.packageId,
          paymentMethod: pending.method,
          ...(pending.method === 'POL'
            ? { polAmount: pending.pol }
            : { bfaxAmount: pending.bfax }),
        };

        const response = await fetch('/api/billing/charge-crypto', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(body),
        });

        const result = await response.json();
        if (!response.ok) {
          throw new Error(result.error || '백엔드 검증에 실패했습니다.');
        }

        setPhase('credited');
        const paidLabel =
          pending.method === 'POL'
            ? `${result.polAmount} POL`
            : formatBfaxToken(result.bfaxAmount);
        setPurchaseMessage(
          `충전 완료: +${formatBfaxQueue(result.bfaxCredited, {
            bonus: pending.method === 'BFAX',
          })} (${paidLabel}). 잔액 ${formatBfaxQueue(result.balanceAfter)}`
        );
        await loadBalance(userEmail);
        await fetchHistory(userEmail);
      } catch (err) {
        console.error(err);
        setPhase('idle');
        setPurchaseMessage(err instanceof Error ? err.message : '충전 처리에 실패했습니다.');
      } finally {
        setPurchaseLoading(false);
        pendingChargeRef.current = null;
      }
    },
    [userEmail, loadBalance, fetchHistory]
  );

  useEffect(() => {
    if (!isConfirmed || !activeTxHash || phase !== 'sent') return;
    const pending = pendingChargeRef.current;
    if (!pending) return;
    submitChargeToApi(activeTxHash, pending);
  }, [isConfirmed, activeTxHash, phase, submitChargeToApi]);

  const ensurePolygonNetwork = async (): Promise<boolean> => {
    if (chainId === polygonMainnet.id) return true;
    try {
      await switchChainAsync({ chainId: polygonMainnet.id });
      return true;
    } catch {
      setPurchaseMessage('Polygon Mainnet(137)으로 네트워크를 전환해 주세요.');
      return false;
    }
  };

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
    if (!(await ensurePolygonNetwork())) return;

    try {
      if (paymentMethod === 'POL') {
        const pol = selectedPol.trim();
        if (!pol || Number(pol) <= 0) {
          setPurchaseMessage('유효한 POL 수량을 선택하세요.');
          return;
        }

        pendingChargeRef.current = {
          method: 'POL',
          pol,
          wallet: walletAddress,
          packageId: selectedTierId,
        };
        setPhase('sent');
        setPurchaseLoading(true);
        setPurchaseMessage('지갑 서명 대기 중… POL을 트레저리로 전송합니다.');

        await sendTransactionAsync({
          chainId: polygonMainnet.id,
          to: treasury,
          value: parseEther(pol),
        });
      } else {
        if (!bfaxContract) {
          setPurchaseMessage('NEXT_PUBLIC_BFAX_CONTRACT_ADDRESS가 설정되지 않았습니다.');
          return;
        }

        if (!oracle || !variableBfaxWei) {
          setPurchaseMessage('오라클 시세를 불러오는 중입니다. 잠시 후 다시 시도하세요.');
          return;
        }

        const { tokenAmountHuman, tokenAmountWei } = computeVariableBfaxTokenCharge({
          packageUsd: selectedTier.usdValue,
          effectivePriceUsd: oracle.effectivePriceUsd,
          tokenDecimals: decimals,
        });

        pendingChargeRef.current = {
          method: 'BFAX',
          bfax: tokenAmountHuman,
          wallet: walletAddress,
          packageId: selectedTierId,
        };
        setPhase('sent');
        setPurchaseLoading(true);
        setPurchaseMessage(
          `지갑 서명 대기 중… 정확히 ${formatBfaxToken(tokenAmountHuman)} 전송 (오라클 정산)`
        );

        await writeContractAsync({
          chainId: polygonMainnet.id,
          address: bfaxContract,
          abi: erc20Abi,
          functionName: 'transfer',
          args: [treasury, tokenAmountWei],
        });
      }

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

  const busy = purchaseLoading || isPolSending || isBfaxSending || isConfirming;
  const canPay =
    paymentMethod === 'POL'
      ? Boolean(treasury)
      : Boolean(treasury && bfaxContract && oracle && variableBfaxWei);
  return (
    <div className="space-y-6">
      <div className="flex rounded-2xl border border-gray-800 bg-[#070707] p-1 w-full max-w-md">
        <button
          type="button"
          onClick={() => setPaymentMethod('POL')}
          className={`flex-1 rounded-xl px-4 py-2.5 text-sm font-semibold transition ${
            paymentMethod === 'POL'
              ? 'bg-neon text-black shadow-[0_0_20px_rgba(16,185,129,0.25)]'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          Pay with POL
        </button>
        <button
          type="button"
          onClick={() => setPaymentMethod('BFAX')}
          className={`flex-1 rounded-xl px-4 py-2.5 text-sm font-semibold transition ${
            paymentMethod === 'BFAX'
              ? 'bg-neon text-black shadow-[0_0_20px_rgba(16,185,129,0.25)]'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          Pay with BFAX Token
        </button>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[1.2fr_0.8fr] gap-6">
        <div className="p-6 rounded-3xl" style={{ background: cardBg, border: '1px solid rgba(255,255,255,0.05)' }}>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h2 className="text-2xl font-semibold text-slate-100">BFAX 듀얼 토큰 결제 게이트웨이</h2>
              <p className="mt-2 text-slate-500">
                Polygon Mainnet(137) — POL 또는 {BFAX_TOKEN_LABEL}으로 {BFAX_QUEUE_LABEL}를 충전합니다.
              </p>
            </div>
            <ConnectButton />
          </div>

          <div className="mt-6 rounded-3xl border border-gray-800/60 bg-[#070707] p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-400">BFAX Queue Balance</p>
                <p className="mt-2 text-5xl font-extrabold text-neon">
                  {balance === null ? 'Loading...' : formatBfaxQueue(balance ?? 0)}
                </p>
              </div>
              <div className="text-right">
                <p className="text-sm text-slate-400">Treasury</p>
                <p className="mt-2 text-xs font-mono text-slate-500">
                  {treasury ? `${treasury.slice(0, 6)}...${treasury.slice(-4)}` : 'Not set'}
                </p>
              </div>
            </div>

            {paymentMethod === 'BFAX' && (
              <div className="mt-6 rounded-2xl border border-emerald-500/30 bg-[#050f0c] p-4 shadow-[0_0_32px_rgba(16,185,129,0.12)]">
                <p className="text-xs uppercase tracking-[0.2em] text-emerald-400/90 font-semibold">
                  Tactical B · Live Oracle Calculator
                </p>
                {oracleLoading || !oracle ? (
                  <p className="mt-2 text-sm text-slate-500 animate-pulse">오라클 시세 동기화 중…</p>
                ) : (
                  <>
                    <p className="mt-3 text-sm text-slate-300">
                      현재 시세 기준{' '}
                      <span className="text-neon font-bold">
                        1 {BFAX_TOKEN_LABEL} = ${oracle.effectivePriceUsd.toFixed(2)}
                      </span>
                      {oracle.marketPriceUsd < BFAX_PRICE_FLOOR_USD && (
                        <span className="ml-2 text-amber-400/90 text-xs">
                          (시장가 ${oracle.marketPriceUsd.toFixed(4)} → 하한 $
                          {BFAX_PRICE_FLOOR_USD.toFixed(2)} 적용)
                        </span>
                      )}
                    </p>
                    {oracleQuote && (
                      <p className="mt-2 text-base text-slate-100 leading-relaxed">
                        패키지 ${oracleQuote.packageUsd.toFixed(2)} 결제 시, MetaMask 서명에{' '}
                        <span className="text-neon font-extrabold text-lg">
                          {formatBfaxToken(oracleQuote.tokenAmountHuman)}
                        </span>{' '}
                        이 차감됩니다.
                        <span className="block mt-1 text-sm text-emerald-300/90">
                          → {formatBfaxQueue(oracleQuote.saasCredits, { bonus: true })} 적립 (
                          {BFAX_TOKEN_LABEL} 결제 +{BFAX_TOKEN_PAYMENT_BONUS_PERCENT}%)
                        </span>
                      </p>
                    )}
                    <p className="mt-2 text-[10px] text-slate-600 font-mono">
                      feed:{oracle.source} · {new Date(oracle.updatedAt).toLocaleTimeString()}
                    </p>
                  </>
                )}
              </div>
            )}

            <div className="mt-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 bg-[#0d0d0d] p-4 rounded-2xl border border-gray-800/60">
              <div>
                <p className="text-xs uppercase tracking-[0.16em] text-slate-500">Payment amount</p>
                <p className="mt-1 text-lg font-semibold text-slate-100">
                  {paymentMethod === 'POL'
                    ? `${selectedPol} POL`
                    : oracleQuote
                      ? formatBfaxToken(oracleQuote.tokenAmountHuman)
                      : '—'}
                </p>
                <p className="text-xs text-neon">→ {expectedQueueLabel} 적립 예정</p>
              </div>
              <button
                type="button"
                onClick={handleCryptoRecharge}
                disabled={busy || !isConnected || !canPay}
                className="inline-flex items-center justify-center rounded-full bg-neon px-6 py-3.5 font-semibold text-black transition hover:shadow-[0_0_25px_rgba(16,185,129,0.4)] disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-400"
              >
                {busy
                  ? 'Processing...'
                  : paymentMethod === 'POL'
                    ? '지갑 서명 및 BFAX Queue 충전'
                    : '지갑 서명 및 BFAX Queue 충전'}
              </button>
            </div>

            {purchaseMessage && (
              <div className="mt-4 rounded-2xl border border-neon/20 bg-[#081010] p-4 text-sm text-slate-300">
                {purchaseMessage}
              </div>
            )}

            {activeTxHash && (
              <a
                href={`${POLYGON_SCAN_TX}${activeTxHash}`}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-3 inline-flex items-center gap-1 text-xs text-slate-400 hover:text-neon"
              >
                <Link2 className="w-3.5 h-3.5" />
                View on Polygonscan
              </a>
            )}
          </div>
        </div>

        <div className="p-6 rounded-3xl" style={{ background: cardBg, border: '1px solid rgba(255,255,255,0.05)' }}>
          <h3 className="text-xl font-semibold text-slate-100">Recharge Packages</h3>
          <p className="mt-1 text-sm text-slate-500">
            {paymentMethod === 'POL'
              ? formatPolToQueueRate(BFAX_PER_POL)
              : `Oracle variable ${BFAX_TOKEN_LABEL} charge · $0.10 price floor`}
          </p>
          <div className="mt-6 grid grid-cols-1 gap-4">
            {tierOptions.map((tier) => {
              const active = selectedTierId === tier.id;
              const queueLabel = formatTierQueueCredit(tier.id, paymentMethod);
              const payLabel =
                paymentMethod === 'POL'
                  ? `${tier.polAmount} POL`
                  : oracle
                    ? formatBfaxToken(
                        formatOracleQuoteForUi({
                          packageId: tier.id,
                          effectivePriceUsd: oracle.effectivePriceUsd,
                          marketPriceUsd: oracle.marketPriceUsd,
                          tokenDecimals: decimals,
                        }).tokenAmountHuman
                      )
                    : `$${tier.usdValue}`;
              return (
                <button
                  key={tier.id}
                  type="button"
                  onClick={() => setSelectedTierId(tier.id)}
                  className={`w-full rounded-3xl border p-5 text-left transition ${
                    active
                      ? 'border-neon bg-[#081010] shadow-[0_0_24px_rgba(16,185,129,0.15)]'
                      : 'border-gray-800 bg-[#070707] hover:border-slate-500'
                  }`}
                >
                  <p className="text-xs uppercase tracking-[0.2em] text-slate-500">{tier.label}</p>
                  <div className="mt-3 flex items-center justify-between">
                    <p className="text-2xl font-bold text-slate-100">{queueLabel}</p>
                    <p className="text-sm font-medium text-neon">
                      {payLabel}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <div className="p-6 rounded-3xl" style={{ background: cardBg, border: '1px solid rgba(255,255,255,0.05)' }}>
        <h3 className="text-xl font-semibold text-slate-100">On-chain Recharge Ledger</h3>
        <p className="mt-1 text-sm text-slate-500">
          Verified POL and {BFAX_TOKEN_LABEL} deposits → {BFAX_QUEUE_LABEL} credits.
        </p>
        <div className="mt-6 overflow-x-auto">
          <table className="min-w-full text-left text-sm text-slate-200">
            <thead>
              <tr className="border-b border-gray-800/40 text-xs uppercase tracking-[0.2em] text-slate-500">
                <th className="py-3 px-3">Date</th>
                <th className="py-3 px-3">{BFAX_QUEUE_LABEL}</th>
                <th className="py-3 px-3">Tx</th>
                <th className="py-3 px-3">Status</th>
                <th className="py-3 px-3">Note</th>
              </tr>
            </thead>
            <tbody>
              {loadingHistory ? (
                <tr>
                  <td colSpan={5} className="py-10 text-center text-slate-500">
                    Loading...
                  </td>
                </tr>
              ) : billingHistory.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-10 text-center text-slate-500">
                    No records
                  </td>
                </tr>
              ) : (
                billingHistory.map((record) => {
                  const onChainTx = extractTxHashFromNote(record.note);
                  const isPol = record.status === 'CRYPTO_RECHARGE';
                  const isBfax = record.status === 'CRYPTO_BFAX_RECHARGE';
                  return (
                    <tr
                      key={record.id}
                      className="border-b border-gray-800/20 hover:bg-[#060606] transition"
                    >
                      <td className="py-4 px-3 text-slate-400">
                        {new Date(record.created_at).toLocaleString()}
                      </td>
                      <td className="py-4 px-3 text-neon font-semibold">
                        +{formatBfaxQueue(Number(record.bfax_amount))}
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
                          <span className="text-slate-500">Off-chain</span>
                        )}
                      </td>
                      <td className="py-4 px-3">
                        <span
                          className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                            isPol
                              ? 'bg-emerald-600/20 text-emerald-200'
                              : isBfax
                                ? 'bg-violet-600/20 text-violet-200'
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
