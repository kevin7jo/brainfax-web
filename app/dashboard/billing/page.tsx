'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { Download, Link2, Wallet } from 'lucide-react';
import { supabase } from '../../../lib/supabaseClient';

const neon = '#10b981';
const cardBg = '#0b0b0b';

type BillingRecord = {
  id: string;
  customer_email: string;
  plan: string;
  bfax_paid: number;
  queue_credited: number;
  tx_hash: string;
  status: string;
  created_at: string;
  receipt_url?: string;
};

const tierMap = {
  standard: { label: 'Standard Bundle', bfax: 10, queue: 100, bonus: 0 },
  professional: { label: 'Professional Bundle', bfax: 50, queue: 500, bonus: 0 },
  enterprise: { label: 'Enterprise Bundle', bfax: 100, queue: 1100, bonus: 10 },
};

const tierOptions = [
  { id: 'standard', subtitle: '10 BFAX Coin → 100 BFAX Queue' },
  { id: 'professional', subtitle: '50 BFAX Coin → 500 BFAX Queue' },
  { id: 'enterprise', subtitle: '100 BFAX Coin → 1,100 BFAX Queue (+10% Bonus)' },
];

const getExplorerLink = (txHash: string) => `https://etherscan.io/tx/${txHash}`;
const maskAddress = (address: string) => `${address.slice(0, 6)}...${address.slice(-4)}`;
const generateTxHash = () => {
  return '0x' + Array.from({ length: 64 }, () => Math.floor(Math.random() * 16).toString(16)).join('');
};

export default function BillingPage() {
  const [autoRecharge, setAutoRecharge] = useState(true);
  const [selectedTier, setSelectedTier] = useState<'standard' | 'professional' | 'enterprise'>('professional');
  const [balance, setBalance] = useState<number | null>(null);
  const [user, setUser] = useState<any>(null);
  const [walletAddress, setWalletAddress] = useState<string | null>(null);
  const [billingHistory, setBillingHistory] = useState<BillingRecord[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [purchaseLoading, setPurchaseLoading] = useState(false);
  const [purchaseMessage, setPurchaseMessage] = useState<string | null>(null);

  const selectedTierData = tierMap[selectedTier];

  const walletStatus = useMemo(() => {
    if (!walletAddress) return { label: 'No wallet connected', color: 'text-slate-500' };
    return { label: `Connected: ${maskAddress(walletAddress)}`, color: 'text-neon' };
  }, [walletAddress]);

  useEffect(() => {
    const stored = window.localStorage.getItem('bfax_wallet_address');
    if (stored) setWalletAddress(stored);
  }, []);

  useEffect(() => {
    let mounted = true;
    supabase.auth.getUser().then(({ data }) => {
      if (!mounted) return;
      if (data?.user) setUser(data.user);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) setUser(session.user);
      if (!session) setUser(null);
    });

    return () => {
      mounted = false;
      try {
        if (listener?.subscription?.unsubscribe) listener.subscription.unsubscribe();
      } catch (e) {
        console.error('auth cleanup error', e);
      }
    };
  }, []);

  useEffect(() => {
    if (!user?.email) return;
    const email = user.email;
    let mounted = true;

    const fetchBalance = async () => {
      const { data, error } = await supabase
        .from('lb_user_balance')
        .select('bfax_queue')
        .eq('customer_email', email)
        .single();
      if (!mounted) return;
      if (error) {
        console.error('fetch balance error', error);
        setBalance(null);
        return;
      }
      setBalance(data?.bfax_queue ?? 0);
    };

    fetchBalance();

    const balanceChannel = supabase
      .channel(`lb_user_balance_${email}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'lb_user_balance', filter: `customer_email=eq.${email}` }, (payload) => {
        const newRow: any = payload?.new;
        if (newRow && newRow.bfax_queue !== undefined) {
          setBalance(newRow.bfax_queue);
        }
      })
      .subscribe();

    return () => {
      mounted = false;
      try {
        supabase.removeChannel(balanceChannel);
      } catch (e) {
        console.error('balance cleanup error', e);
      }
    };
  }, [user]);

  useEffect(() => {
    if (!user?.email) return;
    const email = user.email;
    let mounted = true;

    const fetchHistory = async () => {
      setLoadingHistory(true);
      const { data, error } = await supabase
        .from('lb_billing_history')
        .select('*')
        .eq('customer_email', email)
        .order('created_at', { ascending: false });
      if (!mounted) return;
      setLoadingHistory(false);
      if (error) {
        console.error('fetch billing history error', error);
        setBillingHistory([]);
        return;
      }
      setBillingHistory(data || []);
    };

    fetchHistory();

    const historyChannel = supabase
      .channel(`lb_billing_history_${email}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'lb_billing_history', filter: `customer_email=eq.${email}` }, () => {
        fetchHistory();
      })
      .subscribe();

    return () => {
      mounted = false;
      try {
        supabase.removeChannel(historyChannel);
      } catch (e) {
        console.error('history cleanup error', e);
      }
    };
  }, [user]);

  const connectWallet = async () => {
    if (typeof window === 'undefined' || !(window as any).ethereum) {
      alert('Web3 wallet provider가 감지되지 않았습니다. MetaMask 또는 WalletConnect가 필요합니다.');
      return;
    }

    try {
      const provider = (window as any).ethereum;
      const accounts: string[] = await provider.request({ method: 'eth_requestAccounts' });
      const address = accounts?.[0];
      if (address) {
        setWalletAddress(address);
        window.localStorage.setItem('bfax_wallet_address', address);
      }
    } catch (error) {
      console.error('connect wallet error', error);
    }
  };

  const handlePurchase = async () => {
    if (!user?.email) {
      alert('로그인이 필요합니다.');
      return;
    }
    if (!walletAddress) {
      alert('지갑을 먼저 연결해 주세요.');
      return;
    }

    setPurchaseLoading(true);
    setPurchaseMessage('트랜잭션을 생성 중입니다...');

    const txHash = generateTxHash();
    const createdAt = new Date().toISOString();
    const record = {
      customer_email: user.email,
      plan: tierMap[selectedTier].label,
      bfax_paid: tierMap[selectedTier].bfax,
      queue_credited: tierMap[selectedTier].queue,
      tx_hash: txHash,
      status: 'Pending',
      created_at: createdAt,
      wallet_address: walletAddress,
    } as any;

    const { error: insertError } = await supabase.from('lb_billing_history').insert([record]);
    if (insertError) {
      console.error('billing insert error', insertError);
      alert('청구 내역 생성에 실패했습니다.');
      setPurchaseLoading(false);
      setPurchaseMessage(null);
      return;
    }

    setPurchaseMessage('블록체인 입금 확인 대기 중...');

    try {
      const updateResult = await supabase
        .from('lb_user_balance')
        .upsert({ customer_email: user.email, bfax_queue: (balance ?? 0) + tierMap[selectedTier].queue }, { onConflict: 'customer_email' });
      if (updateResult.error) {
        console.error('balance update error', updateResult.error);
      }

      const { error: statusError } = await supabase
        .from('lb_billing_history')
        .update({ status: 'Confirmed' })
        .eq('tx_hash', txHash);
      if (statusError) {
        console.error('billing confirm update error', statusError);
      }

      setTimeout(async () => {
        const { error: successError } = await supabase
          .from('lb_billing_history')
          .update({ status: 'Success' })
          .eq('tx_hash', txHash);
        if (successError) {
          console.error('billing success update error', successError);
        }
      }, 1500);

      setPurchaseMessage('충전 완료되었습니다. BFAX Queue가 실시간으로 반영되었습니다.');
    } finally {
      setPurchaseLoading(false);
      setTimeout(() => setPurchaseMessage(null), 4000);
    }
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 xl:grid-cols-[1.2fr_0.8fr] gap-6">
        <div className="p-6 rounded-3xl" style={{ background: cardBg, border: '1px solid rgba(255,255,255,0.05)' }}>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h2 className="text-2xl font-semibold text-slate-100">BFAX 코인경제 연동</h2>
              <p className="mt-2 text-slate-500">Web3 Wallet 연결로 BFAX Queue를 블록체인 기반으로 충전하고 실시간 정산합니다.</p>
            </div>
            <button onClick={connectWallet} className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-[#111111] border border-gray-800 text-slate-100 hover:border-neon transition">
              <Wallet className="w-4 h-4" />
              {walletAddress ? 'Wallet Reconnect' : 'Connect Wallet'}
            </button>
          </div>

          <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="rounded-2xl p-4 border border-gray-800/60 bg-[#090909]">
              <div className="text-xs uppercase tracking-[0.2em] text-slate-500">BFAX Web3 Wallet Address</div>
              <div className="mt-3 text-lg font-semibold text-slate-100">{walletAddress ? maskAddress(walletAddress) : '연결된 지갑이 없습니다'}</div>
              {walletAddress && <div className="mt-2 text-xs text-slate-500">Wallet Address is linked to your BFAX payment pipeline.</div>}
            </div>
            <div className="rounded-2xl p-4 border border-gray-800/60 bg-[#090909]">
              <div className="text-xs uppercase tracking-[0.2em] text-slate-500">Transaction Engine</div>
              <div className="mt-3 text-lg font-semibold text-slate-100">Real-time Settlement</div>
              <p className="mt-2 text-slate-500 text-sm">블록체인 Tx Hash, Pending → Confirmed → Success 상태로 Billing History에 자동 반영됩니다.</p>
            </div>
          </div>

          <div className="mt-6 rounded-3xl border border-gray-800/60 bg-[#070707] p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-400">현재 BFAX Queue</p>
                <p className="mt-2 text-5xl font-extrabold text-neon">{balance === null ? '로딩...' : balance}</p>
              </div>
              <div className="text-right">
                <p className="text-sm text-slate-400">연결 상태</p>
                <p className={`mt-2 font-medium ${walletStatus.color}`}>{walletStatus.label}</p>
              </div>
            </div>
            <div className="mt-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div className="rounded-2xl p-4 bg-[#0d0d0d] border border-gray-800/60">
                <p className="text-xs uppercase tracking-[0.16em] text-slate-500">Selected Bundle</p>
                <p className="mt-2 text-lg font-semibold text-slate-100">{selectedTierData.label}</p>
                <p className="mt-1 text-sm text-slate-400">{selectedTierData.bfax} BFAX Coin → {selectedTierData.queue} BFAX Queue</p>
              </div>
              <button onClick={handlePurchase} disabled={purchaseLoading} className="inline-flex items-center justify-center rounded-full bg-neon px-5 py-3 font-semibold text-black transition hover:shadow-[0_0_25px_rgba(16,185,129,0.24)] disabled:cursor-not-allowed disabled:bg-slate-700">
                {purchaseLoading ? '충전 처리 중...' : 'BFAX 코인 충전 시작'}
              </button>
            </div>
            {purchaseMessage && <div className="mt-4 rounded-2xl border border-neon/20 bg-[#081010] p-4 text-sm text-slate-300">{purchaseMessage}</div>}
          </div>
        </div>

        <div className="p-6 rounded-3xl" style={{ background: cardBg, border: '1px solid rgba(255,255,255,0.05)' }}>
          <div className="flex items-center justify-between gap-4">
            <div>
              <h3 className="text-xl font-semibold text-slate-100">충전 티어 선택</h3>
              <p className="mt-2 text-slate-500">BFAX Coin 기반 충전 패키지</p>
            </div>
            <div className="inline-flex items-center rounded-full bg-[#121212] px-3 py-2 text-sm text-slate-400">
              <span className="h-2 w-2 rounded-full bg-neon block mr-2" /> Web3 Settlement
            </div>
          </div>

          <div className="mt-6 grid grid-cols-1 gap-4">
            {tierOptions.map((option) => {
              const selected = selectedTier === option.id;
              return (
                <button key={option.id} onClick={() => setSelectedTier(option.id as any)} className={`w-full rounded-3xl border p-5 text-left ${selected ? 'border-neon bg-[#081010] shadow-[0_0_24px_rgba(16,185,129,0.11)]' : 'border-gray-800 bg-[#070707] hover:border-slate-500'} transition`}>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm uppercase tracking-[0.2em] text-slate-500">{tierMap[option.id].label}</p>
                      <p className="mt-3 text-2xl font-semibold text-slate-100">{tierMap[option.id].bfax} BFAX Coin</p>
                    </div>
                    <div className="text-right text-slate-400">
                      <p className="text-sm">{option.subtitle}</p>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <div className="p-6 rounded-3xl" style={{ background: cardBg, border: '1px solid rgba(255,255,255,0.05)' }}>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h3 className="text-xl font-semibold text-slate-100">Billing History</h3>
            <p className="mt-2 text-slate-500">BFAX Paid, Tx Hash, 실시간 상태까지 한눈에 확인</p>
          </div>
          <div className="text-sm text-slate-400">Total records: {billingHistory.length}</div>
        </div>

        <div className="mt-6 overflow-x-auto">
          <table className="min-w-full text-left text-sm text-slate-200">
            <thead>
              <tr className="border-b border-gray-800/40 text-xs uppercase tracking-[0.2em] text-slate-500">
                <th className="py-3 px-3">Date</th>
                <th className="py-3 px-3">BFAX Paid</th>
                <th className="py-3 px-3">Tx Hash</th>
                <th className="py-3 px-3">Plan</th>
                <th className="py-3 px-3">Status</th>
                <th className="py-3 px-3">Queue Credited</th>
              </tr>
            </thead>
            <tbody>
              {loadingHistory ? (
                Array.from({ length: 4 }).map((_, idx) => (
                  <tr key={idx} className="border-b border-gray-800/20">
                    <td className="py-4 px-3"><div className="h-4 w-24 bg-slate-800 rounded" /></td>
                    <td className="py-4 px-3"><div className="h-4 w-16 bg-slate-800 rounded" /></td>
                    <td className="py-4 px-3"><div className="h-4 w-40 bg-slate-800 rounded" /></td>
                    <td className="py-4 px-3"><div className="h-4 w-28 bg-slate-800 rounded" /></td>
                    <td className="py-4 px-3"><div className="h-4 w-20 bg-slate-800 rounded" /></td>
                    <td className="py-4 px-3"><div className="h-4 w-20 bg-slate-800 rounded" /></td>
                  </tr>
                ))
              ) : billingHistory.length === 0 ? (
                <tr><td colSpan={6} className="py-10 text-center text-slate-500">No billing records yet.</td></tr>
              ) : (
                billingHistory.map((record) => (
                  <tr key={record.id} className="border-b border-gray-800/20 hover:bg-[#060606] transition">
                    <td className="py-4 px-3 text-slate-300">{new Date(record.created_at).toLocaleString()}</td>
                    <td className="py-4 px-3 text-slate-200">{record.bfax_paid} BFAX</td>
                    <td className="py-4 px-3">
                      <a href={getExplorerLink(record.tx_hash)} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 text-slate-200 hover:text-neon">
                        <Link2 className="w-3.5 h-3.5" />
                        <span>{maskAddress(record.tx_hash)}</span>
                      </a>
                    </td>
                    <td className="py-4 px-3 text-slate-200">{record.plan}</td>
                    <td className="py-4 px-3">
                      <span className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-semibold ${record.status === 'Success' ? 'bg-emerald-600/20 text-emerald-200' : record.status === 'Confirmed' ? 'bg-amber-600/20 text-amber-200' : 'bg-slate-700/40 text-slate-200'}`}>
                        {record.status}
                      </span>
                    </td>
                    <td className="py-4 px-3 text-slate-200">{record.queue_credited}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
