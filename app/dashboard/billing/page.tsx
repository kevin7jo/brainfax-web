'use client';

import React, { useEffect, useState } from 'react';
import { Download } from 'lucide-react';
import { supabase } from '../../../lib/supabaseClient';

const neon = '#10b981';
const cardBg = '#0b0b0b';

export default function BillingPage() {
  const [autoRecharge, setAutoRecharge] = useState(true);
  const [selectedTier, setSelectedTier] = useState('professional');
  const [balance, setBalance] = useState<number | null>(null);
  const [user, setUser] = useState<any>(null);

  const [invoices, setInvoices] = useState<any[]>([]);
  const [invoicesLoading, setInvoicesLoading] = useState(false);

  const tiers = [
    { id: 'standard', label: 'Standard', price: '$10.00', cubes: '100 BFAX Queue' },
    { id: 'professional', label: 'Professional', price: '$50.00', cubes: '500 BFAX Queue' },
    { id: 'enterprise', label: 'Enterprise', price: '$100.00', cubes: '1,100 BFAX Queue (+10% Bonus)' },
  ];

  // get auth user
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
      } catch (e) {}
    };
  }, []);

  // fetch balance and realtime subscribe
  useEffect(() => {
    if (!user?.email) return;
    const email = user.email;

    const fetchBalance = async () => {
      const { data, error } = await supabase
        .from('lb_user_balance')
        .select('bfax_queue')
        .eq('customer_email', email)
        .single();
      if (error) {
        console.error('fetch balance error', error);
        setBalance(null);
        return;
      }
      setBalance(data?.bfax_queue ?? 0);
    };

    fetchBalance();

    const channel = supabase
      .channel(`public:lb_user_balance:customer_email=eq.${email}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'lb_user_balance', filter: `customer_email=eq.${email}` }, (payload) => {
        const newRow: any = payload?.new;
        if (newRow && newRow.bfax_queue !== undefined) setBalance(newRow.bfax_queue);
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  // fetch invoices and realtime subscribe
  useEffect(() => {
    if (!user?.email) return;
    const email = user.email;
    let mounted = true;

    const fetchInvoices = async () => {
      setInvoicesLoading(true);
      const { data, error } = await supabase
        .from('lb_billing_history')
        .select('*')
        .eq('customer_email', email)
        .order('created_at', { ascending: false });
      if (!mounted) return;
      setInvoicesLoading(false);
      if (error) {
        console.error('fetch invoices error', error);
        setInvoices([]);
        return;
      }
      setInvoices(data || []);
    };

    fetchInvoices();

    const bChannel = supabase
      .channel(`public:lb_billing_history:customer_email=eq.${email}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'lb_billing_history', filter: `customer_email=eq.${email}` }, () => fetchInvoices())
      .subscribe();

    return () => {
      mounted = false;
      supabase.removeChannel(bChannel);
    };
  }, [user]);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Current Plan & Auto-Recharge */}
        <div className="p-6 rounded-2xl" style={{ background: cardBg, border: '1px solid rgba(255,255,255,0.03)' }}>
          <div className="flex items-start justify-between">
            <div>
              <h3 className="text-lg font-semibold text-slate-100">Current Balance</h3>
              <p className="text-sm text-slate-500 mt-1">Your available BFAX Queue balance</p>
            </div>
            <div className="text-sm text-slate-400">Plan: <span className="font-medium">Professional</span></div>
          </div>

          <div className="mt-6 flex items-center justify-between">
            <div>
              <div className="text-xs text-slate-400 uppercase">BFAX Queue</div>
              <div className="mt-2 text-5xl font-extrabold" style={{ color: neon }}>{balance === null ? '로딩...' : balance}</div>
              <div className="mt-1 text-sm text-slate-500">Real-time balance</div>
            </div>

            <div className="flex flex-col items-end">
              <div className="text-sm text-slate-300 mb-2">Auto-Recharge</div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input type="checkbox" className="sr-only peer" checked={autoRecharge} onChange={() => setAutoRecharge(v => !v)} />
                <div className="w-14 h-8 bg-gray-700 rounded-full peer-checked:bg-neon peer-focus:ring-2 peer-focus:ring-neon/40 peer-checked:after:translate-x-6 after:content[''] after:absolute after:top-0.5 after:left-0.5 after:bg-white after:border after:rounded-full after:h-7 after:w-7 after:transition-all relative" style={{ position: 'relative' }} />
              </label>
              <div className="mt-3 text-xs text-slate-500 text-right">Automatically charge registered card when balance &lt; 10 BFAX Queue</div>
            </div>
          </div>
        </div>

        {/* Recharge Tiers */}
        <div className="p-6 rounded-2xl" style={{ background: cardBg, border: '1px solid rgba(255,255,255,0.03)' }}>
          <div className="flex items-start justify-between">
            <div>
              <h3 className="text-lg font-semibold text-slate-100">Recharge BFAX Queue</h3>
              <p className="text-sm text-slate-500 mt-1">Choose a bundle to add BFAX Queue to your account</p>
            </div>
            <div className="text-sm text-slate-400">Payment methods: Card</div>
          </div>

          <div className="mt-6 grid grid-cols-1 sm:grid-cols-3 gap-4">
            {tiers.map(t => {
              const isSelected = selectedTier === t.id;
              return (
                <button key={t.id} onClick={() => setSelectedTier(t.id)} className={`p-4 rounded-lg text-left border ${isSelected ? 'border-neon shadow-[0_0_20px_rgba(16,185,129,0.12)]' : 'border-gray-800'} bg-[#070707] hover:scale-[1.01] transition`}>
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-sm text-slate-400">{t.label}</div>
                      <div className="text-lg font-semibold text-slate-100 mt-1">{t.price}</div>
                    </div>
                    <div className="text-sm text-slate-500">{t.cubes}</div>
                  </div>
                  {t.id === 'enterprise' && (
                    <div className="mt-3 text-xs text-neon font-medium">Most popular for teams — +10% bonus</div>
                  )}
                </button>
              );
            })}
          </div>

          <div className="mt-6 flex items-center gap-3">
            <button className="px-4 py-2 rounded bg-neon text-black font-medium">Purchase</button>
            <button className="px-4 py-2 rounded bg-transparent border border-gray-800 text-slate-300">Manage Payment Methods</button>
          </div>
        </div>
      </div>

      {/* Billing History Table */}
      <div className="p-6 rounded-2xl" style={{ background: cardBg, border: '1px solid rgba(255,255,255,0.03)' }}>
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-slate-100">Billing History</h3>
            <p className="text-sm text-slate-500 mt-1">Invoices and payments</p>
          </div>
          <div className="text-sm text-slate-400">Total: {invoices.length}</div>
        </div>

        <div className="mt-6 overflow-x-auto">
          <table className="w-full text-left table-auto">
            <thead>
              <tr className="text-xs text-slate-400 border-b border-gray-800/30">
                <th className="py-2 px-3">Date</th>
                <th className="py-2 px-3">Amount</th>
                <th className="py-2 px-3">Plan</th>
                <th className="py-2 px-3">Status</th>
                <th className="py-2 px-3">Receipt</th>
              </tr>
            </thead>
            <tbody>
              {invoicesLoading ? (
                Array.from({ length: 3 }).map((_, i) => (
                  <tr key={i} className="border-b border-gray-800/20 hover:bg-[#060606] animate-pulse">
                    <td className="py-3 px-3 text-sm text-slate-200"><div className="h-4 bg-[#060606] w-28 rounded" /></td>
                    <td className="py-3 px-3 text-sm text-slate-200"><div className="h-4 bg-[#060606] w-20 rounded" /></td>
                    <td className="py-3 px-3 text-sm text-slate-200"><div className="h-4 bg-[#060606] w-24 rounded" /></td>
                    <td className="py-3 px-3"><div className="h-4 bg-[#060606] w-16 rounded" /></td>
                    <td className="py-3 px-3"><div className="h-6 bg-[#060606] w-12 rounded" /></td>
                  </tr>
                ))
              ) : invoices.length === 0 ? (
                <tr><td colSpan={5} className="py-8 text-center text-slate-500">No billing history yet</td></tr>
              ) : (
                invoices.map(inv => (
                  <tr key={inv.id} className="border-b border-gray-800/20 hover:bg-[#060606]">
                    <td className="py-3 px-3 text-sm text-slate-200">{new Date(inv.created_at || inv.date || inv.timestamp).toLocaleDateString()}</td>
                    <td className="py-3 px-3 text-sm text-slate-200">{inv.amount}</td>
                    <td className="py-3 px-3 text-sm text-slate-200">{inv.plan}</td>
                    <td className="py-3 px-3">
                      <span className="inline-flex items-center px-2 py-1 rounded-full bg-green-600 text-white text-xs">{inv.status || 'Paid'}</span>
                    </td>
                    <td className="py-3 px-3">
                      {inv.receipt_url ? (
                        <a href={inv.receipt_url} className="inline-flex items-center gap-2 text-slate-200 hover:text-neon">
                          <Download className="w-4 h-4" />
                          <span className="text-sm">PDF</span>
                        </a>
                      ) : (
                        <span className="text-sm text-slate-500">-</span>
                      )}
                    </td>
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
