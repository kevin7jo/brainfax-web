'use client';

import React, { useEffect, useState } from 'react';
import { supabase } from '../../../lib/supabaseClient';

const neon = '#10b981';
const cardBg = '#0b0b0b';

export default function HistoryPage() {
  const [user, setUser] = useState<any>(null);
  const [tasks, setTasks] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState('all');

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
      try { if (listener?.subscription?.unsubscribe) listener.subscription.unsubscribe(); } catch (e) {}
    };
  }, []);

  useEffect(() => {
    if (!user?.email) return;
    const email = user.email;
    let mounted = true;

    const fetchTasks = async () => {
      setLoading(true);
      let q = supabase
        .from('lb_usage_history')
        .select('*')
        .eq('customer_email', email)
        .order('created_at', { ascending: false });
      const { data, error } = await q;
      if (!mounted) return;
      setLoading(false);
      if (error) {
        console.error('fetch tasks error', error);
        setTasks([]);
        return;
      }
      setTasks(data || []);
    };

    fetchTasks();

    const tChannel = supabase
      .channel(`public:lb_usage_history:customer_email=eq.${email}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'lb_usage_history', filter: `customer_email=eq.${email}` }, () => fetchTasks())
      .subscribe();

    return () => {
      mounted = false;
      supabase.removeChannel(tChannel);
    };
  }, [user]);

  const statusBadge = (s: string) => {
    const st = (s || '').toLowerCase();
    if (st === 'queued') return <span className="text-xs px-2 py-1 rounded-full bg-yellow-500 text-black">Queued</span>;
    if (st === 'processing') return <span className="text-xs px-2 py-1 rounded-full bg-blue-500 text-white">Processing</span>;
    if (st === 'completed') return <span className="text-xs px-2 py-1 rounded-full bg-green-500 text-white">Completed</span>;
    if (st === 'rejected') return <span className="text-xs px-2 py-1 rounded-full bg-red-500 text-white">Rejected</span>;
    return <span className="text-xs px-2 py-1 rounded-full bg-gray-500 text-white">{s}</span>;
  };

  const timeAgo = (ts?: string) => {
    if (!ts) return '';
    const d = new Date(ts).getTime();
    const diff = Math.floor((Date.now() - d) / 1000);
    if (diff < 60) return `${diff}s ago`;
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    return new Date(ts).toLocaleString();
  };

  const filtered = tasks.filter(t => filter === 'all' ? true : (t.status || '').toLowerCase() === filter);

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-extrabold text-slate-100">Task History</h2>
          <p className="text-sm text-slate-500 mt-1">All your submitted tasks and statuses</p>
        </div>
        <div className="flex items-center gap-3">
          <select value={filter} onChange={(e) => setFilter(e.target.value)} className="bg-[#060606] text-slate-200 border border-gray-800 p-2 rounded">
            <option value="all">All</option>
            <option value="queued">Queued</option>
            <option value="processing">Processing</option>
            <option value="completed">Completed</option>
            <option value="rejected">Rejected</option>
          </select>
        </div>
      </div>

      <div className="bg-card rounded-2xl p-4 border border-gray-800/30">
        {loading ? (
          <div>
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="py-4 flex items-start justify-between animate-pulse">
                <div className="flex-1">
                  <div className="h-4 bg-[#060606] rounded w-1/3 mb-2" />
                  <div className="h-3 bg-[#060606] rounded w-1/4" />
                </div>
                <div className="ml-4 w-24">
                  <div className="h-8 bg-[#060606] rounded w-full" />
                </div>
              </div>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="py-8 text-center text-slate-500">No tasks yet</div>
        ) : (
          <div className="divide-y divide-gray-800/40">
            {filtered.map(t => (
              <div key={t.id} className="py-4 flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3">
                    <div className="text-sm font-medium text-slate-100">{t.task_subject || `Task #${t.id}`}</div>
                    {statusBadge(t.status)}
                  </div>
                  <div className="text-xs text-slate-500 mt-1">{t.customer_email} • {timeAgo(t.created_at)}</div>
                  <div className="mt-2 text-xs font-medium" style={{ color: neon }}>
                    {Number(t.burned_queue) > 0
                      ? `${Number(t.burned_queue).toLocaleString()} BFAX burned`
                      : 'No BFAX burned'}
                  </div>
                </div>

                <div className="ml-4 flex flex-col items-end gap-2">
                  <div className="text-xs text-slate-400">{new Date(t.created_at).toLocaleString()}</div>
                  <span className="text-sm text-slate-400 px-3 py-1 rounded border border-gray-800">
                    {Number(t.burned_queue) > 0 ? `${Number(t.burned_queue).toLocaleString()} BFAX` : '—'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
