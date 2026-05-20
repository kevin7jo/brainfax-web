'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { supabase } from '../../../../lib/supabaseClient';
import {
  burnedQueueAmount,
  fetchWorkspaceUsageHistory,
  type UsageHistoryRow,
} from '../../../../lib/usageHistory';

const neon = '#10b981';

export default function HistoryPage() {
  const t = useTranslations('taskHistory');
  const locale = useLocale();

  const [user, setUser] = useState<{ id?: string; email?: string | null } | null>(null);
  const [tasks, setTasks] = useState<UsageHistoryRow[]>([]);
  const [scopeEmails, setScopeEmails] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState('all');
  const [fetchError, setFetchError] = useState<string | null>(null);

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

  const fetchTasks = useCallback(async () => {
    const sessionEmail = user?.email?.trim();
    if (!sessionEmail) return;

    setLoading(true);
    setFetchError(null);

    const result = await fetchWorkspaceUsageHistory(supabase, {
      sessionEmail,
      userId: user?.id,
    });

    setScopeEmails(result.customerEmails);
    setLoading(false);

    if (result.error) {
      console.error('[TaskHistory] fetch failed', result.error);
      setFetchError(result.error);
      setTasks([]);
      return;
    }

    setTasks(result.rows);
  }, [user?.email, user?.id]);

  useEffect(() => {
    if (!user?.email) return;

    void fetchTasks();

    const channel = supabase
      .channel(`usage-history-workspace-${user.id ?? user.email}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'lb_usage_history' },
        () => fetchTasks()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.email, user?.id, fetchTasks]);

  const statusBadge = (s: string) => {
    const st = (s || '').toLowerCase();
    if (st === 'queued') {
      return (
        <span className="text-xs px-2 py-1 rounded-full bg-yellow-500 text-black">
          {t('status.queued')}
        </span>
      );
    }
    if (st === 'processing') {
      return (
        <span className="text-xs px-2 py-1 rounded-full bg-blue-500 text-white">
          {t('status.processing')}
        </span>
      );
    }
    if (st === 'completed') {
      return (
        <span className="text-xs px-2 py-1 rounded-full bg-green-500 text-white">
          {t('status.completed')}
        </span>
      );
    }
    if (st === 'rejected') {
      return (
        <span className="text-xs px-2 py-1 rounded-full bg-red-500 text-white">
          {t('status.rejected')}
        </span>
      );
    }
    return (
      <span className="text-xs px-2 py-1 rounded-full bg-gray-500 text-white">
        {s || t('dash')}
      </span>
    );
  };

  const timeAgo = (ts: string | null) => {
    if (!ts) return '';
    const d = new Date(ts).getTime();
    if (Number.isNaN(d)) return '';
    const diff = Math.floor((Date.now() - d) / 1000);
    if (diff < 60) return t('time.secondsAgo', { n: diff });
    if (diff < 3600) return t('time.minutesAgo', { n: Math.floor(diff / 60) });
    if (diff < 86400) return t('time.hoursAgo', { n: Math.floor(diff / 3600) });
    return new Date(ts).toLocaleString(locale === 'ko' ? 'ko-KR' : 'en-US');
  };

  const filtered = tasks.filter((task) =>
    filter === 'all' ? true : (task.status || '').toLowerCase() === filter
  );

  const filterLabel = (value: string) => {
    if (value === 'all') return t('filter.all');
    if (value === 'queued') return t('filter.queued');
    if (value === 'processing') return t('filter.processing');
    if (value === 'completed') return t('filter.completed');
    if (value === 'rejected') return t('filter.rejected');
    return value;
  };

  return (
    <div>
      {fetchError ? (
        <div className="mb-4 rounded-lg border border-red-900/50 bg-red-950/30 px-4 py-3 text-sm text-red-300">
          {fetchError}
        </div>
      ) : null}

      <div className="mb-6 flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-extrabold text-slate-100">{t('title')}</h2>
          <p className="text-sm text-slate-500 mt-1">
            {t('subtitle')}
            {scopeEmails.length > 0 ? ` ${t('accountCount', { count: scopeEmails.length })}` : ''}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="bg-[#060606] text-slate-200 border border-gray-800 p-2 rounded"
          >
            <option value="all">{t('filter.all')}</option>
            <option value="queued">{t('filter.queued')}</option>
            <option value="processing">{t('filter.processing')}</option>
            <option value="completed">{t('filter.completed')}</option>
            <option value="rejected">{t('filter.rejected')}</option>
          </select>
          <button
            type="button"
            onClick={() => void fetchTasks()}
            className="text-xs px-3 py-2 rounded border border-[#10b981]/40 text-[#10b981] hover:bg-[#07160f]"
          >
            {t('reload')}
          </button>
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
          <div className="py-8 text-center text-slate-500">
            {t('empty')}
            {tasks.length > 0 && filter !== 'all' ? (
              <p className="mt-2 text-xs text-amber-400/90">
                {t('filterHidden', { total: tasks.length, filter: filterLabel(filter) })}
              </p>
            ) : null}
          </div>
        ) : (
          <div className="divide-y divide-gray-800/40">
            {filtered.map((task) => (
              <div key={task.id} className="py-4 flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3">
                    <div className="text-sm font-medium text-slate-100">
                      {task.task_subject || t('taskFallback', { id: task.id })}
                    </div>
                    {statusBadge(task.status)}
                  </div>
                  <div className="text-xs text-slate-500 mt-1">
                    {task.customer_email} • {timeAgo(task.created_at)}
                  </div>
                  <div className="mt-2 text-xs font-medium" style={{ color: neon }}>
                    {burnedQueueAmount(task) > 0
                      ? t('bfaxBurned', { amount: burnedQueueAmount(task).toLocaleString() })
                      : t('noBurn')}
                  </div>
                </div>

                <div className="ml-4 flex flex-col items-end gap-2">
                  <div className="text-xs text-slate-400">
                    {task.created_at
                      ? new Date(task.created_at).toLocaleString(locale === 'ko' ? 'ko-KR' : 'en-US')
                      : t('dash')}
                  </div>
                  <span className="text-sm text-slate-400 px-3 py-1 rounded border border-gray-800">
                    {burnedQueueAmount(task) > 0
                      ? `${burnedQueueAmount(task).toLocaleString()} BFAX`
                      : t('dash')}
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
