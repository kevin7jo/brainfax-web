'use client';

import { useCallback, useEffect, useState } from 'react';
import { Bookmark, ExternalLink, Loader2 } from 'lucide-react';
import { adminFetch } from '../../../lib/adminApiClient';
import { ADMIN_API_PATH } from '../../../lib/admin';
import {
  REWARD_STATUS,
  matchesReviewMissionActivity,
  matchesUnderReviewStatus,
  type RewardsHistoryRow,
} from '../../../lib/rewardsHistory';

function formatDate(value: string) {
  return new Date(value).toLocaleString('ko-KR', {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
}

function statusBadgeClass(status: string): string {
  if (status === REWARD_STATUS.UNDER_REVIEW) return 'bg-amber-900/50 text-amber-200';
  if (status === REWARD_STATUS.APPROVED) return 'bg-emerald-900/50 text-emerald-200';
  if (status === REWARD_STATUS.REJECTED) return 'bg-rose-900/40 text-rose-200';
  return 'bg-zinc-800 text-zinc-300';
}

type DebugPayload = {
  tableTail: Record<string, unknown>[];
  tableTailError: string | null;
};

export default function AdminReviewMissionsPage() {
  const [missions, setMissions] = useState<RewardsHistoryRow[]>([]);
  const [recent, setRecent] = useState<RewardsHistoryRow[]>([]);
  const [recentLoadError, setRecentLoadError] = useState<string | null>(null);
  const [debug, setDebug] = useState<DebugPayload | null>(null);
  const [showDebug, setShowDebug] = useState(true);
  const [loading, setLoading] = useState(true);
  const [listError, setListError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);

  const load = useCallback(async (opts?: { silent?: boolean }) => {
    if (!opts?.silent) setLoading(true);
    try {
      const result = await adminFetch<{
        missions: RewardsHistoryRow[];
        recentReviewSubmissions?: RewardsHistoryRow[];
        recentLoadError?: string | null;
        debug?: DebugPayload;
      }>(`${ADMIN_API_PATH}/review-missions`);
      setMissions(result.missions);
      setRecent(result.recentReviewSubmissions ?? []);
      setRecentLoadError(result.recentLoadError ?? null);
      setDebug(
        result.debug ?? {
          tableTail: [],
          tableTailError: null,
        }
      );
      setListError(null);
    } catch (e) {
      setListError(e instanceof Error ? e.message : '목록 조회 실패');
      setMissions([]);
      setRecent([]);
      setRecentLoadError(null);
      setDebug(null);
    } finally {
      if (!opts?.silent) setLoading(false);
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
      await load({ silent: true });
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
        <p className="mt-3 text-xs leading-relaxed text-zinc-600 border border-zinc-800/80 rounded-xl px-3 py-2 bg-zinc-950/60">
          서버는 <span className="text-zinc-400">service role</span>로 조회합니다. 아래{' '}
          <span className="text-zinc-400">진단: lb_rewards_history 최신 20건</span>에서 실제 DB에 저장된{' '}
          <span className="text-zinc-400">activity / status</span> 문자열을 확인하세요. 검수 대기 목록은
          표준값뿐 아니라 흔한 레거시 표기(공백·한글·PENDING 등)도 포함합니다.
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
                {missions.map((row) => {
                  const strictPending =
                    matchesReviewMissionActivity(row.activity) &&
                    matchesUnderReviewStatus(row.status);
                  return (
                  <tr key={row.id} className="border-b border-zinc-800/40 align-top">
                    <td className="px-4 py-3 text-zinc-400 whitespace-nowrap">
                      {formatDate(row.created_at)}
                      {!strictPending ? (
                        <span className="ml-2 rounded bg-amber-950/80 px-1.5 py-0.5 text-[10px] text-amber-200">
                          느슨 매칭
                        </span>
                      ) : null}
                    </td>
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
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="rounded-2xl border border-zinc-800/80 bg-zinc-950/40 overflow-hidden">
        <div className="border-b border-zinc-800/80 px-4 py-3 text-sm font-semibold text-slate-200">
          최근 리뷰 미션 제출 (최대 25건 · 모든 상태)
        </div>
        {recentLoadError ? (
          <div className="px-4 py-2 text-xs text-amber-200">
            최근 이력 샘플을 불러오지 못했습니다: {recentLoadError}
          </div>
        ) : null}
        {!loading && recent.length === 0 && !recentLoadError ? (
          <div className="px-4 py-8 text-center text-xs text-zinc-500">
            activity가 <span className="text-zinc-400">Review Mission</span> 인 행이 한 건도 없습니다. 제출
            API가 다른 Supabase 프로젝트를 보고 있지 않은지 확인해 보세요.
          </div>
        ) : null}
        {recent.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-sm">
              <thead>
                <tr className="border-b border-zinc-800/60 text-xs uppercase tracking-wide text-zinc-500">
                  <th className="px-4 py-3 text-left">제출일</th>
                  <th className="px-4 py-3 text-left">이메일</th>
                  <th className="px-4 py-3 text-left">상태</th>
                  <th className="px-4 py-3 text-right">BFAX</th>
                  <th className="px-4 py-3 text-left">URL</th>
                </tr>
              </thead>
              <tbody>
                {recent.map((row) => (
                  <tr key={row.id} className="border-b border-zinc-800/40 align-top">
                    <td className="px-4 py-3 text-zinc-400 whitespace-nowrap text-xs">{formatDate(row.created_at)}</td>
                    <td className="px-4 py-3 text-slate-300 break-all text-xs">{row.customer_email}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-block rounded-full px-2 py-0.5 text-xs ${statusBadgeClass(row.status)}`}>
                        {row.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums text-zinc-300">{row.reward_bfax}</td>
                    <td className="px-4 py-3 max-w-[200px]">
                      {row.review_url ? (
                        <a
                          href={row.review_url}
                          target="_blank"
                          rel="noreferrer"
                          className="text-[#10b981] hover:underline text-xs break-all"
                        >
                          열기
                        </a>
                      ) : (
                        '—'
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
      </div>

      <div className="rounded-2xl border border-zinc-800/80 bg-zinc-950/40 overflow-hidden">
        <button
          type="button"
          onClick={() => setShowDebug((v) => !v)}
          className="w-full border-b border-zinc-800/80 px-4 py-3 text-left text-sm font-semibold text-slate-200 flex items-center justify-between gap-2 hover:bg-zinc-900/40"
        >
          <span>진단: lb_rewards_history 최신 20건 (필터 없음)</span>
          <span className="text-xs text-zinc-500">{showDebug ? '접기' : '펼치기'}</span>
        </button>
        {showDebug ? (
          <div className="p-4 space-y-3">
            {debug?.tableTailError ? (
              <p className="text-xs text-rose-300">샘플 조회 오류: {debug.tableTailError}</p>
            ) : null}
            {!debug?.tableTail?.length && !debug?.tableTailError ? (
              <p className="text-xs text-zinc-500">행이 없거나 아직 로드되지 않았습니다.</p>
            ) : null}
            {debug && debug.tableTail.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[640px] text-xs font-mono">
                  <thead>
                    <tr className="border-b border-zinc-800 text-zinc-500 text-left">
                      <th className="py-2 pr-2">id</th>
                      <th className="py-2 pr-2">created_at</th>
                      <th className="py-2 pr-2">customer_email</th>
                      <th className="py-2 pr-2">activity</th>
                      <th className="py-2 pr-2">status</th>
                      <th className="py-2 pr-2">reward_bfax</th>
                      <th className="py-2">review_url</th>
                    </tr>
                  </thead>
                  <tbody>
                    {debug.tableTail.map((r, i) => (
                      <tr key={`${String(r.id ?? i)}`} className="border-b border-zinc-800/50 align-top text-zinc-400">
                        <td className="py-2 pr-2 whitespace-nowrap">{String(r.id ?? '—')}</td>
                        <td className="py-2 pr-2 whitespace-nowrap max-w-[140px] truncate" title={String(r.created_at ?? '')}>
                          {String(r.created_at ?? '—')}
                        </td>
                        <td className="py-2 pr-2 break-all text-zinc-300">{String(r.customer_email ?? '—')}</td>
                        <td className="py-2 pr-2 break-all text-amber-200/90">{JSON.stringify(r.activity)}</td>
                        <td className="py-2 pr-2 break-all text-sky-200/90">{JSON.stringify(r.status)}</td>
                        <td className="py-2 pr-2">{String(r.reward_bfax ?? '—')}</td>
                        <td className="py-2 break-all max-w-[180px] text-zinc-500 truncate" title={String(r.review_url ?? '')}>
                          {r.review_url != null ? String(r.review_url) : 'null'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : null}
            <p className="text-[11px] text-zinc-600 leading-relaxed">
              activity/status 가 JSON에 보이는 그대로 저장되어 있습니다. 여기서 행이 보이는데 위 목록이 비면,
              필터(느슨 매칭)를 더 조정하거나 해당 행의 문자열을 표준값으로 정리하는 마이그레이션이 필요합니다.
              여기서도 비면 <span className="text-zinc-400">SUPABASE URL / SERVICE_ROLE</span> 이 다른 프로젝트를
              가리키는지 확인하세요.
            </p>
          </div>
        ) : null}
      </div>
    </div>
  );
}
