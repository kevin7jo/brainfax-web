'use client';

import { useCallback, useEffect, useState } from 'react';
import { Link } from '../../../../i18n/navigation';
import { Loader2, Headphones } from 'lucide-react';
import { adminFetch } from '../../../../lib/adminApiClient';
import { ADMIN_API_PATH, ADMIN_CONSOLE_PATH } from '../../../../lib/admin';
import type { AdminSupportTicket, AdminTicketStatus } from '../../../../lib/adminSupportTickets';

const TABS: { key: AdminTicketStatus | 'ALL'; label: string }[] = [
  { key: 'ALL', label: '전체' },
  { key: 'OPEN', label: 'OPEN' },
  { key: 'IN_PROGRESS', label: 'IN_PROGRESS' },
  { key: 'RESOLVED', label: 'RESOLVED' },
  { key: 'CLOSED', label: 'CLOSED' },
];

function statusBadge(status: AdminTicketStatus) {
  const base = 'inline-flex rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide';
  switch (status) {
    case 'OPEN':
      return `${base} border border-red-500/40 bg-red-950/50 text-red-200`;
    case 'IN_PROGRESS':
      return `${base} border border-amber-500/40 bg-amber-950/50 text-amber-200`;
    case 'RESOLVED':
      return `${base} border border-emerald-500/40 bg-emerald-950/50 text-emerald-200`;
    case 'CLOSED':
      return `${base} border border-zinc-500/40 bg-zinc-900/80 text-zinc-300`;
    default:
      return `${base} border border-zinc-700 bg-zinc-900 text-zinc-400`;
  }
}

function priorityLabel(p: string) {
  return p;
}

function formatDt(iso: string) {
  try {
    return new Date(iso).toLocaleString('ko-KR', { dateStyle: 'short', timeStyle: 'short' });
  } catch {
    return iso;
  }
}

export default function AdminSupportTicketsPage() {
  const [tab, setTab] = useState<AdminTicketStatus | 'ALL'>('OPEN');
  const [tickets, setTickets] = useState<AdminSupportTicket[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const qs = tab === 'ALL' ? '' : `?status=${tab}`;
      const res = await adminFetch<{ tickets: AdminSupportTicket[] }>(
        `${ADMIN_API_PATH}/support-tickets${qs}`
      );
      setTickets(res.tickets);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : '목록을 불러오지 못했습니다.');
      setTickets([]);
    } finally {
      setLoading(false);
    }
  }, [tab]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-slate-100 flex items-center gap-2">
          <Headphones className="h-5 w-5 text-[#10b981]" />
          Support Tickets
        </h2>
        <p className="mt-1 text-sm text-zinc-500">
          고객 문의 티켓을 상태별로 필터링합니다. 행을 클릭하면 상세·스레드 화면으로 이동합니다.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        {TABS.map((t) => {
          const active = tab === t.key;
          return (
            <button
              key={t.key}
              type="button"
              onClick={() => setTab(t.key)}
              className={`rounded-xl px-4 py-2 text-xs font-semibold transition border ${
                active
                  ? 'border-[#10b981]/40 bg-[#07160f] text-[#10b981]'
                  : 'border-zinc-800 bg-zinc-950 text-zinc-400 hover:border-zinc-700 hover:text-zinc-200'
              }`}
            >
              {t.label}
            </button>
          );
        })}
      </div>

      {error ? (
        <div className="rounded-2xl border border-rose-500/20 bg-rose-950/30 px-4 py-3 text-sm text-rose-200">
          {error}
        </div>
      ) : null}

      <div className="rounded-2xl border border-zinc-800/80 bg-zinc-950/40 overflow-hidden">
        <div className="border-b border-zinc-800/80 px-4 py-3 flex items-center justify-between gap-3">
          <span className="text-sm font-semibold text-slate-200">
            티켓 목록 <span className="text-zinc-500 font-normal">({tickets.length})</span>
          </span>
          <button
            type="button"
            onClick={() => void load()}
            disabled={loading}
            className="rounded-lg border border-zinc-700 px-3 py-1.5 text-xs text-zinc-300 hover:bg-zinc-900 disabled:opacity-50"
          >
            새로고침
          </button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center gap-2 py-16 text-sm text-zinc-500">
            <Loader2 className="h-5 w-5 animate-spin" />
            불러오는 중…
          </div>
        ) : tickets.length === 0 ? (
          <div className="py-16 text-center text-sm text-zinc-500">표시할 티켓이 없습니다.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] text-sm">
              <thead>
                <tr className="border-b border-zinc-800/60 text-left text-[10px] uppercase tracking-[0.2em] text-zinc-500">
                  <th className="px-4 py-3">Ticket No</th>
                  <th className="px-4 py-3">Email</th>
                  <th className="px-4 py-3">Title</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Priority</th>
                  <th className="px-4 py-3">Date</th>
                </tr>
              </thead>
              <tbody>
                {tickets.map((row) => (
                  <tr
                    key={row.id}
                    className="border-b border-zinc-800/40 hover:bg-zinc-900/40 transition"
                  >
                    <td className="px-4 py-3 font-mono text-xs text-[#10b981]">
                      <Link
                        href={`${ADMIN_CONSOLE_PATH}/support/${row.id}`}
                        className="hover:underline"
                      >
                        {row.ticket_no}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-zinc-300 break-all max-w-[200px]">
                      {row.customer_email}
                    </td>
                    <td className="px-4 py-3 text-slate-100 max-w-[280px] truncate" title={row.title}>
                      <Link
                        href={`${ADMIN_CONSOLE_PATH}/support/${row.id}`}
                        className="hover:text-[#10b981] hover:underline"
                      >
                        {row.title}
                      </Link>
                    </td>
                    <td className="px-4 py-3">
                      <span className={statusBadge(row.status)}>{row.status}</span>
                    </td>
                    <td className="px-4 py-3 text-zinc-400 text-xs">{priorityLabel(row.priority)}</td>
                    <td className="px-4 py-3 text-zinc-500 whitespace-nowrap text-xs">
                      {formatDt(row.created_at)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
