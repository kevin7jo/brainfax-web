 'use client';

import React, { useEffect, useState } from 'react';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { supabase } from '../../lib/supabaseClient';

const neon = '#10b981';
const cardBg = '#0b0b0b';

function StatsCard({ title, value, subtitle }: { title: string; value: React.ReactNode; subtitle?: string }) {
  return (
    <div className="rounded-2xl" style={{ background: `linear-gradient(180deg, ${cardBg}, #070707)`, border: '1px solid rgba(255,255,255,0.03)' }}>
      <div className="p-6">
        <div className="text-sm text-slate-400 uppercase">{title}</div>
        <div className="mt-3 flex items-end gap-3">
          <div className="text-5xl font-extrabold" style={{ color: neon }}>{value}</div>
          {subtitle && <div className="text-sm text-slate-500">{subtitle}</div>}
        </div>
      </div>
    </div>
  );
}

const sampleChartData = [
  { name: '1', used: 2 },
  { name: '5', used: 6 },
  { name: '10', used: 4 },
  { name: '15', used: 10 },
  { name: '20', used: 6 },
  { name: '25', used: 12 },
];

export default function DashboardHome() {
  const [balance, setBalance] = useState<number | null>(null);
  const [data, setData] = useState(sampleChartData);
  const [user, setUser] = useState<any>(null);
  const [tasks, setTasks] = useState<any[]>([]);
  const [tasksLoading, setTasksLoading] = useState(false);

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
      // unsubscribe auth listener if available
      try {
        if (listener?.subscription?.unsubscribe) listener.subscription.unsubscribe();
      } catch (e) {
        // ignore
      }
    };
  }, []);

  // fetch balance and subscribe to updates
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
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'lb_user_balance', filter: `customer_email=eq.${email}` },
        (payload) => {
          const newRow: any = payload?.new;
          if (newRow && newRow.bfax_queue !== undefined) setBalance(newRow.bfax_queue);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  // fetch tasks and subscribe
  useEffect(() => {
    if (!user?.email) return;
    const email = user.email;
    let mounted = true;

    const fetchTasks = async () => {
      setTasksLoading(true);
      const { data, error } = await supabase
        .from('lb_task_history')
        .select('*')
        .eq('customer_email', email)
        .order('created_at', { ascending: false });
      if (!mounted) return;
      setTasksLoading(false);
      if (error) {
        console.error('fetch tasks error', error);
        setTasks([]);
        return;
      }
      setTasks(data || []);
    };

    fetchTasks();

    const tChannel = supabase
      .channel(`public:lb_task_history:customer_email=eq.${email}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'lb_task_history', filter: `customer_email=eq.${email}` },
        (_payload) => {
          // refetch on change
          fetchTasks();
        }
      )
      .subscribe();

    return () => {
      mounted = false;
      supabase.removeChannel(tChannel);
    };
  }, [user]);

  return (
    <div className="space-y-8">
      <section className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 p-6 rounded-2xl" style={{ background: `linear-gradient(180deg, ${cardBg}, #060606)`, border: '1px solid rgba(255,255,255,0.03)' }}>
          <div className="flex items-start justify-between">
            <div>
              <h2 className="text-2xl font-extrabold text-slate-100">Overview</h2>
              <p className="text-sm text-slate-500 mt-1">High level usage & insights</p>
            </div>
            <div className="text-sm text-slate-400">May 2026</div>
          </div>

          <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4 items-stretch">
            <StatsCard title="Remaining BFAX Queue" value={balance === null ? '로딩...' : `${balance} BFAX Queue`} subtitle="Real-time balance" />

            <div className="col-span-1 md:col-span-2 p-4 rounded-xl" style={{ background: '#070707', border: '1px solid rgba(255,255,255,0.02)' }}>
              <div className="flex items-center justify-between">
                <div className="text-sm text-slate-400">This month usage</div>
                <div className="text-xs text-slate-500">Units: BFAX Queue</div>
              </div>
              <div className="mt-3 h-40">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={data} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="colorUsed" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor={neon} stopOpacity={0.8}/>
                        <stop offset="95%" stopColor={neon} stopOpacity={0.05}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid stroke="#0a0a0a" strokeDasharray="3 3" />
                    <XAxis dataKey="name" stroke="#374151" />
                    <YAxis stroke="#374151" />
                    <Tooltip contentStyle={{ background: cardBg, border: '1px solid rgba(255,255,255,0.03)' }} />
                    <Area type="monotone" dataKey="used" stroke={neon} fill="url(#colorUsed)" strokeWidth={2} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        </div>

        <aside className="p-6 rounded-2xl" style={{ background: cardBg, border: '1px solid rgba(255,255,255,0.03)' }}>
          <div className="text-sm text-slate-400">Quick Actions</div>
          <div className="mt-4 space-y-3">
            <button className="w-full py-2 rounded-md bg-[#081010] border border-gray-800 text-neon font-medium">Recharge BFAX Queue</button>
            <button className="w-full py-2 rounded-md bg-transparent border border-gray-800 text-slate-300 hover:bg-[#081010]">View Billing</button>
            <button className="w-full py-2 rounded-md bg-transparent border border-gray-800 text-slate-300 hover:bg-[#081010]">Create New Task</button>
          </div>
        </aside>
      </section>

      <section className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 p-6 rounded-2xl" style={{ background: cardBg, border: '1px solid rgba(255,255,255,0.03)' }}>
          <h3 className="text-lg font-semibold text-slate-100">Task Activity</h3>
          <p className="text-sm text-slate-500 mt-1">Recent tasks and statuses</p>

          <div className="mt-4 divide-y divide-gray-800/40">
            {tasksLoading ? (
              // skeleton rows
              Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="py-4 flex items-start justify-between animate-pulse">
                  <div className="flex-1">
                    <div className="h-4 bg-[#060606] rounded w-1/3 mb-2" />
                    <div className="h-3 bg-[#060606] rounded w-1/4" />
                    <div className="mt-3 h-2 bg-[#060606] rounded w-full" />
                  </div>
                  <div className="ml-4 w-24">
                    <div className="h-8 bg-[#060606] rounded w-full" />
                  </div>
                </div>
              ))
            ) : tasks.length === 0 ? (
              <div className="py-8 text-center text-slate-500">No tasks yet</div>
            ) : (
              tasks.map((t: any) => {
                const status = (t.status || '').toLowerCase();
                const badge = (() => {
                  if (status === 'queued') return { text: 'Queued', color: 'bg-yellow-500 text-black' };
                  if (status === 'processing') return { text: 'Processing', color: 'bg-blue-500 text-white' };
                  if (status === 'completed') return { text: 'Completed', color: 'bg-green-500 text-white' };
                  if (status === 'rejected') return { text: 'Rejected', color: 'bg-red-500 text-white' };
                  return { text: t.status || 'Unknown', color: 'bg-gray-500 text-white' };
                })();

                const timeAgo = (ts?: string) => {
                  if (!ts) return '';
                  const d = new Date(ts).getTime();
                  const diff = Math.floor((Date.now() - d) / 1000);
                  if (diff < 60) return `${diff}s ago`;
                  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
                  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
                  return new Date(ts).toLocaleString();
                };

                return (
                  <div key={t.id} className="py-4 flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3">
                        <div className="text-sm font-medium text-slate-100">{t.title || t.file_name || `Task #${t.id}`}</div>
                        <div className={`text-xs px-2 py-1 rounded-full ${badge.color}`}>{badge.text}</div>
                      </div>
                      <div className="text-xs text-slate-500 mt-1">Sent to: {t.customer_email} • {timeAgo(t.created_at)}</div>
                      <div className="mt-2 w-full bg-[#060606] rounded-full h-2 overflow-hidden border border-gray-800/30">
                        <div style={{ width: `${Math.min(100, (t.progress || 0))}%`, background: neon, height: '100%' }} />
                      </div>
                    </div>
                    <div className="ml-4 flex flex-col items-end gap-2">
                      <div className="text-xs text-slate-400">{new Date(t.created_at).toLocaleString()}</div>
                      {String((t.status || '').toLowerCase()) === 'completed' && t.result_url ? (
                        <a href={t.result_url} target="_blank" rel="noreferrer" className="text-sm text-slate-200 px-3 py-1 rounded bg-transparent border border-gray-800 hover:bg-[#081010]">Download</a>
                      ) : (
                        <button disabled className="text-sm text-slate-500 px-3 py-1 rounded bg-transparent border border-gray-800">{String((t.status || '').toLowerCase()) === 'completed' ? 'Download' : 'Details'}</button>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        <aside className="p-6 rounded-2xl" style={{ background: cardBg, border: '1px solid rgba(255,255,255,0.03)' }}>
          <h4 className="text-sm font-semibold text-slate-100">Promotions</h4>
          <div className="mt-3 text-sm text-slate-400">Use code <span className="text-neon font-medium">DEEPTECH10</span> for bonus BFAX Queue</div>
          <div className="mt-4">
            <input className="w-full rounded-md p-2 bg-[#060606] border border-gray-800 text-slate-200" placeholder="Promo code" />
            <button className="mt-3 w-full py-2 rounded-md bg-[#081010] text-neon">Apply</button>
          </div>
        </aside>
      </section>
    </div>
  );
}
