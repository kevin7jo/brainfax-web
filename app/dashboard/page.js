'use client';
import React, { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabaseClient';

export default function DashboardPage() {
  const [user, setUser] = useState(null);
  const [balance, setBalance] = useState(null);

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
      if (listener?.subscription) supabase.removeChannel(listener.subscription);
    };
  }, []);

  useEffect(() => {
    if (!user) return;
    const userEmail = user.email;

    const fetchBalance = async () => {
      const { data, error } = await supabase
        .from('lb_user_balance')
        .select('bfax_queue')
        .eq('customer_email', userEmail)
        .single();
      if (error) {
        console.error('fetch balance error', error);
        return;
      }
      setBalance(data?.bfax_queue ?? 0);
    };

    fetchBalance();

    const channel = supabase
      .channel(`public:lb_user_balance:customer_email=eq.${userEmail}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'lb_user_balance', filter: `customer_email=eq.${userEmail}` },
        (payload) => {
          if (payload?.new?.bfax_queue !== undefined) {
            setBalance(payload.new.bfax_queue);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="p-8 max-w-lg text-center">
          <h2 className="text-2xl font-semibold">로그인이 필요합니다</h2>
          <p className="mt-2 text-slate-600">대시보드를 보려면 Google로 로그인하세요.</p>
        </div>
      </div>
    );
  }

  const displayName = user.user_metadata?.name || user.user_metadata?.full_name || user.email;

  return (
    <main className="min-h-screen bg-gradient-to-b from-slate-50 to-white p-8">
      <header className="max-w-5xl mx-auto mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-extrabold text-indigo-600 drop-shadow-sm">{displayName}</h1>
          <p className="text-sm text-slate-500">{user.email}</p>
        </div>
      </header>

      <section className="max-w-5xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="col-span-1 md:col-span-2 p-6 bg-white rounded-xl shadow">
          <h2 className="text-lg font-medium text-slate-700">대시보드 개요</h2>
          <p className="mt-2 text-slate-500">Brainfax 사용 통계와 빠른 액세스.</p>
        </div>

        <div className="p-6 bg-gradient-to-br from-indigo-600 to-violet-500 text-white rounded-xl shadow-lg flex flex-col justify-center">
          <div className="text-sm uppercase opacity-90">보유 큐</div>
          <div className="mt-2 text-4xl font-extrabold tracking-tight">
            {balance === null ? '로딩...' : `${balance} Q`}
          </div>
          <div className="mt-3 text-sm opacity-80">실시간 잔액이 자동으로 갱신됩니다.</div>
        </div>
      </section>
    </main>
  );
}
