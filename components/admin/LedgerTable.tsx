'use client';

import { useCallback, useEffect, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { adminFetch } from '../../lib/adminApiClient';
import { ADMIN_API_PATH, type RechargeLedgerRow } from '../../lib/admin';

type Props = {
  statusFilter?: string | string[];
  title: string;
  refreshKey?: number;
};

export default function LedgerTable({ statusFilter, title, refreshKey = 0 }: Props) {
  const [rows, setRows] = useState<RechargeLedgerRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [tableError, setTableError] = useState<string | null>(null);

  const fetchRows = useCallback(async () => {
    setLoading(true);
    setTableError(null);

    const statusParam = Array.isArray(statusFilter)
      ? statusFilter.join(',')
      : statusFilter ?? '';

    try {
      const result = await adminFetch<{ rows: RechargeLedgerRow[]; error: string | null }>(
        `${ADMIN_API_PATH}/ledger${statusParam ? `?status=${encodeURIComponent(statusParam)}` : ''}`
      );
      setRows(result.rows);
      setTableError(result.error);
    } catch (e) {
      console.error('ledger fetch', e);
      setRows([]);
      setTableError(e instanceof Error ? e.message : '장부 조회 실패');
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => {
    fetchRows();
  }, [fetchRows, refreshKey]);

  return (
    <div className="rounded-2xl border border-zinc-800/80 bg-zinc-950/40 overflow-hidden">
      <div className="flex items-center justify-between border-b border-zinc-800/80 px-4 py-3">
        <h3 className="text-sm font-semibold text-slate-200">{title}</h3>
        <button
          type="button"
          onClick={fetchRows}
          className="inline-flex items-center gap-1 rounded-md border border-zinc-800 px-2 py-1 text-xs text-zinc-400 hover:text-[#10b981]"
        >
          <RefreshCw className={`h-3 w-3 ${loading ? 'animate-spin' : ''}`} />
          새로고침
        </button>
      </div>
      {tableError ? (
        <div className="border-b border-amber-900/40 bg-amber-950/20 px-4 py-3 text-xs text-amber-200">{tableError}</div>
      ) : null}
      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead>
            <tr className="border-b border-zinc-800/60 text-xs uppercase tracking-wider text-zinc-500">
              <th className="px-4 py-3">시각</th>
              <th className="px-4 py-3">이메일</th>
              <th className="px-4 py-3">BFAX</th>
              <th className="px-4 py-3">잔액</th>
              <th className="px-4 py-3">상태</th>
              <th className="px-4 py-3">메모</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-zinc-500">
                  장부 로딩 중…
                </td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-zinc-500">
                  기록이 없습니다.
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr key={row.id} className="border-b border-zinc-900/80 hover:bg-zinc-900/30">
                  <td className="px-4 py-3 text-xs text-zinc-400 whitespace-nowrap">
                    {new Date(row.created_at).toLocaleString('ko-KR')}
                  </td>
                  <td className="px-4 py-3 text-slate-200">{row.customer_email}</td>
                  <td
                    className={`px-4 py-3 font-mono tabular-nums ${
                      Number(row.bfax_amount) >= 0 ? 'text-[#10b981]' : 'text-red-400'
                    }`}
                  >
                    {Number(row.bfax_amount) >= 0 ? '+' : ''}
                    {row.bfax_amount ?? 0}
                  </td>
                  <td className="px-4 py-3 font-mono text-zinc-400">{row.balance_after ?? '—'}</td>
                  <td className="px-4 py-3">
                    <span className="rounded-full bg-zinc-900 px-2 py-0.5 text-[10px] font-bold text-zinc-300">
                      {row.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs text-zinc-500 max-w-[200px] truncate">
                    {row.note || row.admin_email || '—'}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
