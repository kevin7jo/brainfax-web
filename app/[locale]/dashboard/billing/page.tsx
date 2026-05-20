'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
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
import { supabase } from '../../../../lib/supabaseClient';
import { polygonMainnet } from '../../../../lib/polygonChain';
import {
  isErc20PaymentMethod,
  type PaymentMethod,
} from '../../../../lib/cryptoPayment';
import {
  BFAX_QUEUE_LABEL,
  BFAX_TOKEN_LABEL,
  formatBfaxQueue,
  formatBfaxToken,
} from '../../../../lib/bfaxBranding';
import type { BillingPricesSnapshot } from '../../../../lib/billingPrices';
import {
  computePackagePaymentQuote,
  formatBonusStackLabel,
  type PackagePaymentQuote,
} from '../../../../lib/billingQuotes';
import {
  BFAX_PRICE_FLOOR_USD,
  BFAX_TOKEN_PAYMENT_BONUS_PERCENT,
  RECHARGE_PACKAGES,
  computeSaaSCreditsForPackage,
  type PackageId,
} from '../../../../lib/bfaxOracle';
import { BFAX_BURN_ADDRESS, BFAX_BURN_POLYGONSCAN_URL } from '../../../../lib/bfaxBurn';
import {
  getPaymentTokenContract,
  getTokenContractEnvHint,
  getTransferDestinationClient,
  getTreasuryAddressClient,
  PAYMENT_METHOD_LABELS,
} from '../../../../lib/paymentContracts';

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
  const t = useTranslations('billing');
  const locale = useLocale();
  const treasury = getTreasuryAddressClient();

  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('BFAX');

  const transferDestination = useMemo((): `0x${string}` | null => {
    if (paymentMethod === 'POL') return treasury;
    if (paymentMethod === 'BFAX') {
      return getTransferDestinationClient('BFAX', treasury ?? BFAX_BURN_ADDRESS);
    }
    if (!treasury) return null;
    return getTransferDestinationClient(paymentMethod, treasury);
  }, [paymentMethod, treasury]);

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
      if (!res.ok || !data.updatedAt) throw new Error(data.error || t('errors.oracleFetch'));
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
  }, [t]);

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
        setPurchaseMessage(t('errors.loginRequired'));
        return;
      }

      setPurchaseLoading(true);
      setPurchaseMessage(t('purchase.processing', { queueLabel: BFAX_QUEUE_LABEL }));

      try {
        const { data: sessionData } = await supabase.auth.getSession();
        const token = sessionData.session?.access_token;
        if (!token) throw new Error(t('errors.noSession'));

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
          throw new Error(result.error || t('errors.backendVerification'));
        }

        setPhase('credited');
        const paidLabel =
          pending.method === 'POL'
            ? `${result.polAmount ?? pending.amountHuman} POL`
            : `${result.tokenAmount ?? pending.amountHuman} ${pending.method}`;
        setPurchaseMessage(
          t('purchase.complete', {
            credited: formatBfaxQueue(result.bfaxCredited, {
              bonus: pending.method === 'BFAX',
            }),
            paidLabel,
            balance: formatBfaxQueue(result.balanceAfter),
          })
        );
        await loadBalance(userEmail);
        await fetchHistory(userEmail);
      } catch (err) {
        console.error(err);
        setPhase('idle');
        setPurchaseMessage(err instanceof Error ? err.message : t('errors.chargeFailed'));
      } finally {
        setPurchaseLoading(false);
        pendingChargeRef.current = null;
      }
    },
    [userEmail, loadBalance, fetchHistory, t]
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
      setPurchaseMessage(t('errors.switchPolygon'));
      return false;
    }
  };

  const handleCryptoRecharge = async () => {
    setPurchaseMessage(null);
    setPhase('idle');

    if (!userEmail) {
      setPurchaseMessage(t('errors.loginRequired'));
      return;
    }
    if (paymentMethod !== 'BFAX' && !treasury) {
      setPurchaseMessage(t('errors.treasuryEnv'));
      return;
    }
    if (!transferDestination) {
      setPurchaseMessage(t('errors.transferDestUnknown'));
      return;
    }
    if (!isConnected || !walletAddress) {
      setPurchaseMessage(t('errors.connectWallet'));
      return;
    }
    if (!(await ensurePolygonNetwork())) return;

    if (!prices || !selectedQuote) {
      setPurchaseMessage(t('errors.oracleLoadingWait'));
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
          t('walletSign.pol', {
            amount: selectedQuote.amountHuman,
            usd: `$${selectedTier.usdValue}`,
            unitPrice: `$${selectedQuote.unitPriceUsd.toFixed(4)}`,
          })
        );
        await sendTransactionAsync({
          chainId: polygonMainnet.id,
          to: transferDestination,
          value: selectedQuote.amountWei,
        });
      } else {
        if (!erc20Contract) {
          setPurchaseMessage(
            t('errors.missingTokenContractEnv', {
              env: `NEXT_PUBLIC_${paymentMethod}_CONTRACT_ADDRESS`,
            })
          );
          setPhase('idle');
          setPurchaseLoading(false);
          pendingChargeRef.current = null;
          return;
        }

        const burnNote = paymentMethod === 'BFAX' ? t('walletSign.burnNote') : '';
        setPurchaseMessage(
          t('walletSign.erc20', {
            payAmount: formatPayAmountLabel(selectedQuote),
            usd: `$${selectedTier.usdValue}`,
            burnNote,
          })
        );

        await writeContractAsync({
          chainId: polygonMainnet.id,
          address: erc20Contract,
          abi: erc20Abi,
          functionName: 'transfer',
          args: [transferDestination, selectedQuote.amountWei],
        });
      }

      setPurchaseMessage(t('tx.submitted'));
    } catch (err) {
      setPhase('idle');
      setPurchaseLoading(false);
      pendingChargeRef.current = null;
      console.error(err);
      setPurchaseMessage(err instanceof Error ? err.message : t('errors.txCancelled'));
    }
  };

  const busy = purchaseLoading || isPolSending || isErc20Sending || isConfirming;
  const canPay =
    Boolean(prices && selectedQuote && transferDestination) &&
    (paymentMethod === 'POL' ||
      (paymentMethod === 'BFAX' && Boolean(erc20Contract)) ||
      (paymentMethod !== 'BFAX' && Boolean(treasury && erc20Contract)));

  const payBlockerMessage = useMemo(() => {
    if (canPay) return null;
    if (!isConnected) return t('errors.payBlockerWallet');
    if (paymentMethod !== 'BFAX' && !treasury) return t('errors.payBlockerTreasury');
    if (!prices || !selectedQuote) return t('errors.payBlockerOracle');
    if (paymentMethod !== 'POL' && !erc20Contract) {
      const hint = getTokenContractEnvHint(paymentMethod) ?? t('tokenContractFallbackHint');
      return t('errors.payBlockerTokenEnv', { hint });
    }
    return null;
  }, [canPay, isConnected, paymentMethod, treasury, prices, selectedQuote, erc20Contract, t]);

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

      {paymentMethod === 'BFAX' && (
        <div
          className="relative overflow-hidden rounded-2xl border border-rose-500/55 bg-gradient-to-r from-[#1a0308] via-[#12010f] to-[#0a0508] px-4 py-3.5 shadow-[0_0_40px_rgba(244,63,94,0.35),0_0_60px_rgba(236,72,153,0.2)]"
          role="status"
        >
          <div
            className="pointer-events-none absolute inset-0 opacity-50"
            style={{
              background:
                'radial-gradient(ellipse 70% 80% at 0% 50%, rgba(239,68,68,0.25), transparent 60%)',
            }}
          />
          <p className="relative z-10 text-center text-xs sm:text-sm font-bold uppercase tracking-wide text-transparent bg-clip-text bg-gradient-to-r from-orange-300 via-rose-400 to-fuchsia-400 animate-pulse">
            🔥 HYPER-DEFLATION: 100% OF BFAX TOKENS SPENT ARE IMMEDIATELY BURNED ON-CHAIN FOREVER
          </p>
          <p className="relative z-10 mt-2 text-center text-[10px] sm:text-xs text-rose-300/80 font-mono">
            Destination: {BFAX_BURN_ADDRESS.slice(0, 10)}...{BFAX_BURN_ADDRESS.slice(-4)}{' '}
            <a
              href={BFAX_BURN_POLYGONSCAN_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="underline hover:text-rose-200"
            >
              {t('links.trackBurns')}
            </a>
          </p>
        </div>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-[1.2fr_0.8fr] gap-6">
        <div className="p-6 rounded-3xl" style={{ background: cardBg, border: '1px solid rgba(255,255,255,0.05)' }}>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h2 className="text-2xl font-semibold text-slate-100">{t('hero.title')}</h2>
              <p className="mt-2 text-slate-500 text-sm">
                {t('hero.subtitle', { token: BFAX_TOKEN_LABEL })}
              </p>
            </div>
            <ConnectButton />
          </div>

          <div className="mt-6 rounded-3xl border border-gray-800/60 bg-[#070707] p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-400">{t('balance.label')}</p>
                <p className="mt-2 text-5xl font-extrabold text-neon">
                  {balance === null ? t('balance.loading') : formatBfaxQueue(balance ?? 0)}
                </p>
              </div>
              <div className="text-right">
                <p className="text-sm text-slate-400">
                  {paymentMethod === 'BFAX' ? t('balance.burnDestination') : t('balance.treasury')}
                </p>
                <p
                  className={`mt-2 text-xs font-mono ${
                    paymentMethod === 'BFAX' ? 'text-rose-400/90' : 'text-slate-500'
                  }`}
                >
                  {paymentMethod === 'BFAX'
                    ? `${BFAX_BURN_ADDRESS.slice(0, 6)}...${BFAX_BURN_ADDRESS.slice(-4)}`
                    : treasury
                      ? `${treasury.slice(0, 6)}...${treasury.slice(-4)}`
                      : t('balance.notSet')}
                </p>
              </div>
            </div>

            <div className="mt-6 rounded-2xl border border-emerald-500/25 bg-[#050f0c] p-4 shadow-[0_0_32px_rgba(16,185,129,0.1)]">
              <p className="text-xs uppercase tracking-[0.2em] text-emerald-400/90 font-semibold">
                Live Multi-Oracle · Omnichain Settlement
              </p>
              {pricesLoading || !prices ? (
                <p className="mt-2 text-sm text-slate-500 animate-pulse">{t('oracle.syncing')}</p>
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
                        {t('oracle.floorGuard', { price: `$${BFAX_PRICE_FLOOR_USD.toFixed(2)}` })}
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
                  {t('oracle.bfaxExclusive', { token: BFAX_TOKEN_LABEL, bonus: bonusStackLabel })}
                </p>
              )}
              {prices && (
                <p className="mt-2 text-[10px] text-slate-600 font-mono">
                  {t('oracle.lastUpdated', {
                    time: new Date(prices.updatedAt).toLocaleTimeString(
                      locale === 'ko' ? 'ko-KR' : 'en-US'
                    ),
                  })}
                </p>
              )}
            </div>

            <div className="mt-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 bg-[#0d0d0d] p-4 rounded-2xl border border-gray-800/60">
              <div>
                <p className="text-xs uppercase tracking-[0.16em] text-slate-500">{t('payment.amountLabel')}</p>
                <p className="mt-1 text-lg font-semibold text-slate-100">
                  {selectedQuote ? formatPayAmountLabel(selectedQuote) : '—'}
                </p>
                <p className="text-xs text-slate-500 mt-0.5">
                  ${selectedTier.usdValue} ÷ $
                  {selectedQuote?.unitPriceUsd.toFixed(selectedQuote.paymentMethod === 'POL' ? 4 : 2) ?? '—'}
                </p>
                <p className="text-xs text-neon mt-1">
                  {t('payment.creditExpected', { expected: expectedQueueLabel })}
                </p>
              </div>
              <button
                type="button"
                onClick={handleCryptoRecharge}
                disabled={busy || !canPay || !isConnected}
                className="inline-flex items-center justify-center rounded-full bg-neon px-6 py-3.5 font-semibold text-black transition hover:shadow-[0_0_25px_rgba(16,185,129,0.4)] disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-400"
              >
                {busy ? t('payment.processing') : t('payment.payCta', { queueLabel: BFAX_QUEUE_LABEL })}
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
                {t('links.polygonscan')}
              </a>
            )}
          </div>
        </div>

        <div className="p-6 rounded-3xl" style={{ background: cardBg, border: '1px solid rgba(255,255,255,0.05)' }}>
          <h3 className="text-xl font-semibold text-slate-100">{t('packages.title')}</h3>
          <p className="mt-1 text-sm text-slate-500">
            {t('packages.subtitle', {
              usdLabel: `$${selectedTier.usdValue}`,
              stack: paymentMethod === 'BFAX' ? t('packages.stackBfax') : t('packages.stackOther'),
            })}
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
        <h3 className="text-xl font-semibold text-slate-100">{t('ledger.title')}</h3>
        <p className="mt-1 text-sm text-slate-500">
          {t('ledger.subtitle', { token: BFAX_TOKEN_LABEL, queueLabel: BFAX_QUEUE_LABEL })}
        </p>
        <div className="mt-6 overflow-x-auto">
          <table className="min-w-full text-left text-sm text-slate-200">
            <thead>
              <tr className="border-b border-gray-800/40 text-xs uppercase tracking-[0.2em] text-slate-500">
                <th className="py-3 px-3">{t('ledger.colDate')}</th>
                <th className="py-3 px-3">{t('ledger.colQueue', { queueLabel: BFAX_QUEUE_LABEL })}</th>
                <th className="py-3 px-3">{t('ledger.colTx')}</th>
                <th className="py-3 px-3">{t('ledger.colStatus')}</th>
                <th className="py-3 px-3">{t('ledger.colNote')}</th>
              </tr>
            </thead>
            <tbody>
              {loadingHistory ? (
                <tr>
                  <td colSpan={5} className="py-10 text-center text-slate-500">
                    {t('ledger.loading')}
                  </td>
                </tr>
              ) : billingHistory.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-10 text-center text-slate-500">
                    {t('ledger.empty')}
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
                        {new Date(record.created_at).toLocaleString(locale === 'ko' ? 'ko-KR' : 'en-US')}
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
                          <span className="text-slate-500">{t('ledger.offChain')}</span>
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
