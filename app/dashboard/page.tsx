'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { supabase } from '../../lib/supabaseClient';

const neon = '#10b981';
const cardBg = '#0b0b0b';

type ChartPoint = { name: string; used: number };

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

function taskUsageAmount(task: any): number {
  const usage = Number(
    task.bfax_used ?? task.bfax_queue_used ?? task.queue_used ?? task.queue_cost ?? 0
  );
  return Number.isFinite(usage) && usage > 0 ? usage : 0;
}

function buildMonthlyUsageChart(tasks: any[]): ChartPoint[] {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const buckets = new Map<number, number>();

  for (let day = 1; day <= daysInMonth; day += 1) buckets.set(day, 0);

  for (const task of tasks) {
    if (!task?.created_at) continue;
    const created = new Date(task.created_at);
    if (created.getFullYear() !== year || created.getMonth() !== month) continue;
    const usage = taskUsageAmount(task);
    if (usage <= 0) continue;
    const day = created.getDate();
    buckets.set(day, (buckets.get(day) ?? 0) + usage);
  }

  return Array.from(buckets.entries()).map(([day, used]) => ({ name: String(day), used }));
}

function sumMonthlyUsage(tasks: any[]): number {
  const now = new Date();
  return tasks.reduce((sum, task) => {
    if (!task?.created_at) return sum;
    const created = new Date(task.created_at);
    if (created.getFullYear() !== now.getFullYear() || created.getMonth() !== now.getMonth()) return sum;
    return sum + taskUsageAmount(task);
  }, 0);
}

export default function DashboardHome() {
  const [balance, setBalance] = useState<number | null>(null);
  const [user, setUser] = useState<any>(null);
  const [tasks, setTasks] = useState<any[]>([]);
  const [tasksLoading, setTasksLoading] = useState(false);

  const monthLabel = useMemo(
    () => new Date().toLocaleDateString('ko-KR', { year: 'numeric', month: 'long' }),
    []
  );
  const chartData = useMemo(() => buildMonthlyUsageChart(tasks), [tasks]);
  const monthUsageTotal = useMemo(() => sumMonthlyUsage(tasks), [tasks]);

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
      } catch {
        // ignore
      }
    };
  }, []);

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
        () => fetchTasks()
      )
      .subscribe();

    return () => {
      mounted = false;
      supabase.removeChannel(tChannel);
    };
  }, [user]);

  return (
    <div className="w-full space-y-8">
      <section
        className="p-4 md:p-6 rounded-2xl w-full"
        style={{ background: `linear-gradient(180deg, ${cardBg}, #060606)`, border: '1px solid rgba(255,255,255,0.03)' }}
      >
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h2 className="text-xl sm:text-2xl font-extrabold text-slate-100">Overview</h2>
            <p className="text-sm sm:text-base text-slate-500 mt-1">High level usage & insights</p>
          </div>
          <div className="text-sm text-slate-400">{monthLabel}</div>
        </div>

        <OverviewGrid balance={balance} tasksLoading={tasksLoading} monthUsageTotal={monthUsageTotal} chartData={chartData} />
      </section>

      <section className="p-4 md:p-6 rounded-2xl w-full" style={{ background: cardBg, border: '1px solid rgba(255,255,255,0.03)' }}>
        <h3 className="text-lg sm:text-xl font-semibold text-slate-100">Task Activity</h3>
        <p className="text-sm sm:text-base text-slate-500 mt-1">Recent tasks and statuses</p>

        <div className="mt-4 divide-y divide-gray-800/40">
          <TaskActivityList tasks={tasks} tasksLoading={tasksLoading} />
        </div>
      </section>
    </div>
  );
}

function OverviewGrid({
  balance,
  tasksLoading,
  monthUsageTotal,
  chartData,
}: {
  balance: number | null;
  tasksLoading: boolean;
  monthUsageTotal: number;
  chartData: ChartPoint[];
}) {
  return (
    <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-12 lg:items-stretch">
      <div className="lg:col-span-4">
        <StatsCard
          title="Remaining BFAX Queue"
          value={balance === null ? '로딩...' : `${balance} BFAX Queue`}
          subtitle="Real-time balance"
        />
      </div>

      <div
        className="lg:col-span-8 p-4 md:p-5 rounded-xl"
        style={{ background: '#070707', border: '1px solid rgba(255,255,255,0.02)' }}
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="text-sm text-slate-400">This month usage</div>
          <div className="text-xs text-slate-500">
            Units: BFAX Queue
            {monthUsageTotal > 0 ? ` · Total ${monthUsageTotal}` : ''}
          </div>
        </div>
        <div className="mt-3 h-48 sm:h-56 min-h-[12rem]">
          <UsageChart tasksLoading={tasksLoading} monthUsageTotal={monthUsageTotal} chartData={chartData} />
        </div>
      </div>
    </div>
  );
}

function UsageChart({
  tasksLoading,
  monthUsageTotal,
  chartData,
}: {
  tasksLoading: boolean;
  monthUsageTotal: number;
  chartData: ChartPoint[];
}) {
  if (tasksLoading) {
    return <div className="h-full rounded-lg bg-[#060606] animate-pulse" />;
  }

  if (monthUsageTotal === 0) {
    return (
      <EmptyUsageChart />
    );
  }

  return (
    <ResponsiveContainer width="100%" height="100%">
      <AreaChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id="colorUsed" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor={neon} stopOpacity={0.8} />
            <stop offset="95%" stopColor={neon} stopOpacity={0.05} />
          </linearGradient>
        </defs>
        <CartesianGrid stroke="#0a0a0a" strokeDasharray="3 3" />
        <XAxis dataKey="name" stroke="#374151" tick={{ fontSize: 11 }} interval="preserveStartEnd" />
        <YAxis stroke="#374151" allowDecimals={false} width={36} />
        <Tooltip contentStyle={{ background: cardBg, border: '1px solid rgba(255,255,255,0.03)' }} />
        <Area type="monotone" dataKey="used" stroke={neon} fill="url(#colorUsed)" strokeWidth={2} />
      </AreaChart>
    </ResponsiveContainer>
  );
}

function EmptyUsageChart() {
  return (
    <div className="flex h-full items-center justify-center rounded-lg border border-dashed border-gray-800/60 bg-[#060606]/50 px-4 text-center text-sm text-slate-500">
      이번 달 BFAX Queue 사용 기록이 없습니다. 작업 완료 시 사용량이 차트에 반영됩니다.
    </div>
  );
}

function TaskActivityList({ tasks, tasksLoading }: { tasks: any[]; tasksLoading: boolean }) {
  if (tasksLoading) {
    return (
      <>
        {Array.from({ length: 4 }).map((_, i) => (
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
        ))}
      </>
    );
  }

  if (tasks.length === 0) {
    return <div className="py-8 text-center text-slate-500">No tasks yet</div>;
  }

  return (
    <>
      {tasks.map((t: any) => (
        <TaskRow key={t.id} task={t} />
      ))}
    </>
  );
}

function TaskRow({ task: t }: { task: any }) {
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
    <div className="py-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
      <div className="flex-1 min-w-0">
        <div className="flex flex-wrap items-center gap-3">
          <div className="text-sm font-medium text-slate-100 truncate">{t.title || t.file_name || `Task #${t.id}`}</div>
          <div className={`text-xs px-2 py-1 rounded-full shrink-0 ${badge.color}`}>{badge.text}</div>
        </div>
        <div className="text-xs text-slate-500 mt-1">Sent to: {t.customer_email} • {timeAgo(t.created_at)}</div>
        <div className="mt-2 w-full bg-[#060606] rounded-full h-2 overflow-hidden border border-gray-800/30">
          <TaskProgressBar progress={t.progress} />
        </div>
      </div>
      <div className="flex sm:flex-col items-center sm:items-end gap-2 shrink-0">
        <div className="text-xs text-slate-400">{new Date(t.created_at).toLocaleString()}</div>
        <TaskActionButton task={t} status={status} />
      </div>
    </div>
  );
}

function TaskProgressBar({ progress }: { progress?: number }) {
  return <div style={{ width: `${Math.min(100, progress || 0)}%`, background: neon, height: '100%' }} />;
}

function TaskActionButton({ task: t, status }: { task: any; status: string }) {
  if (status === 'completed' && t.result_url) {
    return (
      <a href={t.result_url} target="_blank" rel="noreferrer" className="text-sm text-slate-200 px-3 py-1 rounded bg-transparent border border-gray-800 hover:bg-[#081010]">
        Download
      </a>
    );
  }

  return (
    <button disabled className="text-sm text-slate-500 px-3 py-1 rounded bg-transparent border border-gray-800">
      {status === 'completed' ? 'Download' : 'Details'}
    </button>
  );
}
