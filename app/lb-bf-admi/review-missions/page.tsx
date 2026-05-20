'use client';

import { useCallback, useEffect, useState } from 'react';
import { Bookmark, ExternalLink, Loader2 } from 'lucide-react';
import { adminFetch } from '../../../lib/adminApiClient';
import { ADMIN_API_PATH } from '../../../lib/admin';
import type { RewardsHistoryRow } from '../../../lib/rewardsHistory';

function formatDate(value: string) {
  return new Date(value).toLocaleString('ko-KR', {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
}

export default function AdminReviewMissionsPage() {
  const [missions, setMissions] = useState<RewardsHistoryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [listError, setListError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const result = await adminFetch<{ missions: RewardsHistoryRow[] }>(
        `${ADMIN_API_PATH}/review-missions`
      );
      setMissions(result.missions);
      setListError(null);
    } catch (e) {
      setListError(e instanceof Error ? e.message : '목록 조회 실패');
      setMissions([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const handleDecision = async (id: number, action: 'approve' | 'reject') => {
    if (action === 'reject') {
      if (!window.confirm('이 제출을 거절할까요? 사용자는 다시 제출할 수 있습니다.')) return;
    }
    setBusyId(id);
    try {
      await adminFetch<{ ok: boolean }>(`${ADMIN_API_PATH}/review-missions`, {
        method: 'PATCH',
        body: JSON.stringify({ id, action }),
      });
      setMissions((prev) => prev.filter((m) => m.id !== id));
    } catch (e) {
      alert(e instanceof Error ? e.message : '처리 실패');
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-lg font-semibold text-slate-100">Review Mission Queue</h2>
        <p className="mt-1 text-sm text-zinc-500">
          사용자가 제출한 리뷰 URL을 확인한 뒤 승인하면 약속된 BFAX Queue가 지급되고, 거절하면 재제출할 수
          있습니다.
        </p>
      </div>

      <div className="rounded-2xl border border-zinc-800/80 bg-zinc-950/40 overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-800/80 px-4 py-3">
          <div className="flex items-center gap-2 text-sm font-semibold text-slate-200">
            <Bookmark className="h-4 w-4 text-[#10b981]" />
            검수 대기 ({missions.length})
          </div>
          <button
            type="button"
            onClick={() => void load()}
            disabled={loading}
            className="rounded-lg border border-zinc-700 px-3 py-1.5 text-xs text-zinc-300 hover:bg-zinc-900 disabled:opacity-50"
          >
            새로고침
          </button>
        </div>

        {listError ? <div className="px-4 py-3 text-sm text-amber-200">{listError}</div> : null}

        {loading ? (
          <div className="flex items-center justify-center gap-2 px-4 py-12 text-sm text-zinc-500">
            <Loader2 className="h-5 w-5 animate-spin" />
            불러오는 중…
          </div>
        ) : missions.length === 0 ? (
          <div className="px-4 py-12 text-center text-sm text-zinc-500">대기 중인 리뷰 미션이 없습니다.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-sm">
              <thead>
                <tr className="border-b border-zinc-800/60 text-xs uppercase tracking-wide text-zinc-500">
                  <th className="px-4 py-3 text-left">제출일</th>
                  <th className="px-4 py-3 text-left">고객 이메일</th>
                  <th className="px-4 py-3 text-left">리뷰 URL</th>
                  <th className="px-4 py-3 text-right">보상 BFAX</th>
                  <th className="px-4 py-3 text-right">처리</th>
                </tr>
              </thead>
              <tbody>
                {missions.map((row) => (
                  <tr key={row.id} className="border-b border-zinc-800/40 align-top">
                    <td className="px-4 py-3 text-zinc-400 whitespace-nowrap">{formatDate(row.created_at)}</td>
                    <td className="px-4 py-3 text-slate-200 break-all">{row.customer_email}</td>
                    <td className="px-4 py-3 max-w-[280px]">
                      {row.review_url ? (
                        <a
                          href={row.review_url}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 text-[#10b981] hover:underline break-all"
                        >
                          <ExternalLink className="h-3.5 w-3.5 shrink-0" />
                          링크 열기
                        </a>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td className="px-4 py-3 text-right text-slate-200 tabular-nums">{row.reward_bfax}</td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex flex-wrap justify-end gap-2">
                        <button
                          type="button"
                          disabled={busyId === row.id}
                          onClick={() => void handleDecision(row.id, 'approve')}
                          className="rounded-lg bg-[#10b981] px-3 py-1.5 text-xs font-semibold text-black hover:brightness-105 disabled:opacity-50"
                        >
                          승인
                        </button>
                        <button
                          type="button"
                          disabled={busyId === row.id}
                          onClick={() => void handleDecision(row.id, 'reject')}
                          className="rounded-lg border border-zinc-600 px-3 py-1.5 text-xs text-zinc-300 hover:bg-zinc-900 disabled:opacity-50"
                        >
                          거절
                        </button>
                      </div>
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
