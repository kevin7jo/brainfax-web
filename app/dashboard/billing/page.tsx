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
import { erc20Abi } from 'viem';
import { supabase } from '../../../lib/supabaseClient';
import { polygonMainnet } from '../../../lib/polygonChain';
import {
  isErc20PaymentMethod,
  type PaymentMethod,
} from '../../../lib/cryptoPayment';
import {
  BFAX_QUEUE_LABEL,
  BFAX_TOKEN_LABEL,
  formatBfaxQueue,
  formatBfaxToken,
} from '../../../lib/bfaxBranding';
import type { BillingPricesSnapshot } from '../../../lib/billingPrices';
import {
  computePackagePaymentQuote,
  formatBonusStackLabel,
  type PackagePaymentQuote,
} from '../../../lib/billingQuotes';
import {
  BFAX_PRICE_FLOOR_USD,
  BFAX_TOKEN_PAYMENT_BONUS_PERCENT,
  RECHARGE_PACKAGES,
  computeSaaSCreditsForPackage,
  type PackageId,
} from '../../../lib/bfaxOracle';
import {
  getPaymentTokenContract,
  getTokenContractEnvHint,
  getTreasuryAddressClient,
  PAYMENT_METHOD_LABELS,
} from '../../../lib/paymentContracts';

function formatTierQueueCredit(packageId: PackageId, paymentMethod: PaymentMethod): string {
  const credits = computeSaaSCreditsForPackage(packageId, paymentMethod);
  return formatBfaxQueue(credits, { bonus: paymentMethod === 'BFAX' });
}

const cardBg = '#0b0b0b';
const POLYGON_SCAN_TX = 'https://polygonscan.com/tx/';
const PAYMENT_TABS: PaymentMethod[] = ['BFAX', 'POL', 'USDT', 'USDC'];
const tierOptions = Object.values(RECHARGE_PACKAGES);

function formatPayAmountLabel(quote: PackagePaymentQuote): string {
  if (quote.paymentMethod === 'BFAX') return formatBfaxToken(quote.amountHuman);
  return `${quote.amountHuman} ${quote.paymentMethod}`;
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
  amountHuman: string;
};

export default function SecureBillingPage() {
  const treasury = getTreasuryAddressClient();

  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('BFAX');
  const [selectedTierId, setSelectedTierId] = useState<PackageId>('tier2');
  const [prices, setPrices] = useState<BillingPricesSnapshot | null>(null);
  const [pricesLoading, setPricesLoading] = useState(false);

  const erc20Contract = getPaymentTokenContract(paymentMethod);

  const { address: walletAddress, isConnected, chainId } = useAccount();
  const { switchChainAsync } = useSwitchChain();
  const { sendTransactionAsync, data: polTxHash, isPending: isPolSending } = useSendTransaction();
  const { writeContractAsync, data: erc20TxHash, isPending: isErc20Sending } = useWriteContract();

  const activeTxHash = isErc20PaymentMethod(paymentMethod) ? erc20TxHash : polTxHash;
  const { isLoading: isConfirming, isSuccess: isConfirmed } = useWaitForTransactionReceipt({
    hash: activeTxHash,
  });

  const { data: tokenDecimals } = useReadContract({
    address: erc20Contract ?? undefined,
    abi: erc20Abi,
    functionName: 'decimals',
    chainId: polygonMainnet.id,
    query: { enabled: Boolean(erc20Contract) },
  });

  const decimals = tokenDecimals !== undefined ? Number(tokenDecimals) : 6;

  const selectedTier = RECHARGE_PACKAGES[selectedTierId];

  const [balance, setBalance] = useState<number | null>(null);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [billingHistory, setBillingHistory] = useState<BillingRecord[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [purchaseLoading, setPurchaseLoading] = useState(false);
  const [purchaseMessage, setPurchaseMessage] = useState<string | null>(null);
  const [phase, setPhase] = useState<'idle' | 'sent' | 'credited'>('idle');

  const pendingChargeRef = useRef<PendingCharge | null>(null);

  const fetchPrices = useCallback(async () => {
    setPricesLoading(true);
    try {
      const res = await fetch('/api/billing/prices', { cache: 'no-store' });
      const data = await res.json();
      if (!res.ok || !data.updatedAt) throw new Error(data.error || '오라클 조회 실패');
      setPrices({
        pol: data.pol,
        bfax: data.bfax,
        usdt: data.usdt,
        usdc: data.usdc,
        updatedAt: data.updatedAt,
      });
    } catch (e) {
      console.error('prices fetch', e);
      setPrices(null);
    } finally {
      setPricesLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchPrices();
    const interval = setInterval(() => void fetchPrices(), 10_000);
    return () => clearInterval(interval);
  }, [fetchPrices]);

  const selectedQuote = useMemo(() => {
    if (!prices) return null;
    try {
      return computePackagePaymentQuote({
        packageId: selectedTierId,
        paymentMethod,
        prices,
        tokenDecimals: decimals,
      });
    } catch {
      return null;
    }
  }, [prices, selectedTierId, paymentMethod, decimals]);

  const expectedQueueCredits =
    selectedQuote?.queueCredits ?? computeSaaSCreditsForPackage(selectedTierId, paymentMethod);

  const bonusStackLabel = selectedQuote ? formatBonusStackLabel(selectedQuote) : null;

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
            ? { polAmount: pending.amountHuman }
            : { tokenAmount: pending.amountHuman }),
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
            ? `${result.polAmount ?? pending.amountHuman} POL`
            : `${result.tokenAmount ?? pending.amountHuman} ${pending.method}`;
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

    if (!prices || !selectedQuote) {
      setPurchaseMessage('실시간 오라클 시세를 불러오는 중입니다.');
      return;
    }

    try {
      pendingChargeRef.current = {
        method: paymentMethod,
        wallet: walletAddress,
        packageId: selectedTierId,
        amountHuman: selectedQuote.amountHuman,
      };
      setPhase('sent');
      setPurchaseLoading(true);

      if (paymentMethod === 'POL') {
        setPurchaseMessage(
          `지갑 서명 대기… ${selectedQuote.amountHuman} POL ($${selectedTier.usdValue} @ $${selectedQuote.unitPriceUsd.toFixed(4)}/POL)`
        );
        await sendTransactionAsync({
          chainId: polygonMainnet.id,
          to: treasury,
          value: selectedQuote.amountWei,
        });
      } else {
        if (!erc20Contract) {
          setPurchaseMessage(`NEXT_PUBLIC_${paymentMethod}_CONTRACT_ADDRESS가 설정되지 않았습니다.`);
          setPhase('idle');
          setPurchaseLoading(false);
          pendingChargeRef.current = null;
          return;
        }

        setPurchaseMessage(
          `지갑 서명 대기… ${formatPayAmountLabel(selectedQuote)} ($${selectedTier.usdValue} 오라클 정산)`
        );

        await writeContractAsync({
          chainId: polygonMainnet.id,
          address: erc20Contract,
          abi: erc20Abi,
          functionName: 'transfer',
          args: [treasury, selectedQuote.amountWei],
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

  const busy = purchaseLoading || isPolSending || isErc20Sending || isConfirming;
  const canPay =
    Boolean(treasury && prices && selectedQuote) &&
    (paymentMethod === 'POL' || Boolean(erc20Contract));

  const payBlockerMessage: string | null = canPay
    ? null
    : !isConnected
      ? 'MetaMask(또는 지갑)을 먼저 연결해 주세요.'
      : !treasury
        ? 'NEXT_PUBLIC_TREASURY_ADDRESS가 설정되지 않았습니다.'
        : !prices || !selectedQuote
          ? '실시간 오라클 시세를 불러오지 못했습니다. 잠시 후 새로고침하세요.'
          : paymentMethod !== 'POL' && !erc20Contract
            ? `${getTokenContractEnvHint(paymentMethod) ?? '토큰 컨트랙트'} 환경 변수를 .env에 설정한 뒤 dev 서버를 재시작하세요.`
            : null;

  const tierQuote = (tierId: PackageId): PackagePaymentQuote | null => {
    if (!prices) return null;
    try {
      return computePackagePaymentQuote({
        packageId: tierId,
        paymentMethod,
        prices,
        tokenDecimals: decimals,
      });
    } catch {
      return null;
    }
  };
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 rounded-2xl border border-gray-800 bg-[#070707] p-1">
        {PAYMENT_TABS.map((method) => (
          <button
            key={method}
            type="button"
            onClick={() => setPaymentMethod(method)}
            className={`rounded-xl px-3 py-2.5 text-xs sm:text-sm font-semibold transition ${
              paymentMethod === method
                ? method === 'BFAX'
                  ? 'bg-neon text-black shadow-[0_0_20px_rgba(16,185,129,0.25)]'
                  : 'bg-slate-200 text-black'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            {PAYMENT_METHOD_LABELS[method]}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[1.2fr_0.8fr] gap-6">
        <div className="p-6 rounded-3xl" style={{ background: cardBg, border: '1px solid rgba(255,255,255,0.05)' }}>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h2 className="text-2xl font-semibold text-slate-100">옴니체인 통합 결제 게이트웨이</h2>
              <p className="mt-2 text-slate-500 text-sm">
                Polygon(137) — {BFAX_TOKEN_LABEL} · POL · USDT · USDC 실시간 오라클 정산
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

            <div className="mt-6 rounded-2xl border border-emerald-500/25 bg-[#050f0c] p-4 shadow-[0_0_32px_rgba(16,185,129,0.1)]">
              <p className="text-xs uppercase tracking-[0.2em] text-emerald-400/90 font-semibold">
                Live Multi-Oracle · Omnichain Settlement
              </p>
              {pricesLoading || !prices ? (
                <p className="mt-2 text-sm text-slate-500 animate-pulse">오라클 시세 동기화 중…</p>
              ) : (
                <div className="mt-3 grid grid-cols-2 gap-3 text-sm text-slate-300">
                  <p>
                    POL <span className="text-neon font-bold">${prices.pol.effectivePriceUsd.toFixed(4)}</span>
                  </p>
                  <p>
                    {BFAX_TOKEN_LABEL}{' '}
                    <span className="text-neon font-bold">${prices.bfax.effectivePriceUsd.toFixed(2)}</span>
                    {prices.bfax.marketPriceUsd < BFAX_PRICE_FLOOR_USD && (
                      <span className="block text-[10px] text-amber-400/90">
                        floor ${BFAX_PRICE_FLOOR_USD.toFixed(2)} guard
                      </span>
                    )}
                  </p>
                  <p>
                    USDT <span className="text-slate-100 font-bold">$1.00</span>
                  </p>
                  <p>
                    USDC <span className="text-slate-100 font-bold">$1.00</span>
                  </p>
                </div>
              )}
              {paymentMethod === 'BFAX' && bonusStackLabel && (
                <p className="mt-3 text-sm text-emerald-300/90 border-t border-emerald-500/20 pt-3">
                  ★ {BFAX_TOKEN_LABEL} 독점: {bonusStackLabel} · 다른 코인은 Vol 2%/3%만
                </p>
              )}
              {prices && (
                <p className="mt-2 text-[10px] text-slate-600 font-mono">
                  updated {new Date(prices.updatedAt).toLocaleTimeString()}
                </p>
              )}
            </div>

            <div className="mt-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 bg-[#0d0d0d] p-4 rounded-2xl border border-gray-800/60">
              <div>
                <p className="text-xs uppercase tracking-[0.16em] text-slate-500">Payment amount</p>
                <p className="mt-1 text-lg font-semibold text-slate-100">
                  {selectedQuote ? formatPayAmountLabel(selectedQuote) : '—'}
                </p>
                <p className="text-xs text-slate-500 mt-0.5">
                  ${selectedTier.usdValue} ÷ $
                  {selectedQuote?.unitPriceUsd.toFixed(selectedQuote.paymentMethod === 'POL' ? 4 : 2) ?? '—'}
                </p>
                <p className="text-xs text-neon mt-1">→ {expectedQueueLabel} 적립 예정</p>
              </div>
              <button
                type="button"
                onClick={handleCryptoRecharge}
                disabled={busy || !canPay || !isConnected}
                className="inline-flex items-center justify-center rounded-full bg-neon px-6 py-3.5 font-semibold text-black transition hover:shadow-[0_0_25px_rgba(16,185,129,0.4)] disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-400"
              >
                {busy ? 'Processing...' : '지갑 서명 및 BFAX Queue 충전'}
              </button>
            </div>

            {!canPay && !busy && payBlockerMessage && (
              <p className="mt-3 text-xs text-amber-400/90">{payBlockerMessage}</p>
            )}

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
            ${selectedTier.usdValue} 패키지 · 실시간 오라클 ·{' '}
            {paymentMethod === 'BFAX' ? 'Web3 + Vol stack' : 'Vol 2%/3% only'}
          </p>
          <div className="mt-6 grid grid-cols-1 gap-4">
            {tierOptions.map((tier) => {
              const active = selectedTierId === tier.id;
              const queueLabel = formatTierQueueCredit(tier.id, paymentMethod);
              const quote = tierQuote(tier.id);
              const payLabel = quote ? formatPayAmountLabel(quote) : `$${tier.usdValue}`;
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
          POL · {BFAX_TOKEN_LABEL} · USDT · USDC → {BFAX_QUEUE_LABEL}
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
                  const isUsdt = record.status === 'CRYPTO_USDT_RECHARGE';
                  const isUsdc = record.status === 'CRYPTO_USDC_RECHARGE';
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
                                : isUsdt
                                  ? 'bg-teal-600/20 text-teal-200'
                                  : isUsdc
                                    ? 'bg-blue-600/20 text-blue-200'
                                    : 'bg-zinc-700/40 text-zinc-300'
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
