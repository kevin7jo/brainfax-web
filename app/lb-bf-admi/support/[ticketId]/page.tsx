'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, Loader2, Send } from 'lucide-react';
import { adminFetch } from '../../../../lib/adminApiClient';
import { ADMIN_API_PATH, ADMIN_CONSOLE_PATH } from '../../../../lib/admin';
import type {
  AdminSupportTicket,
  AdminTicketReply,
  AdminTicketStatus,
} from '../../../../lib/adminSupportTickets';

function formatDt(iso: string) {
  try {
    return new Date(iso).toLocaleString('ko-KR', { dateStyle: 'medium', timeStyle: 'short' });
  } catch {
    return iso;
  }
}

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

const STATUS_OPTIONS: AdminTicketStatus[] = ['IN_PROGRESS', 'RESOLVED', 'CLOSED', 'OPEN'];

export default function AdminSupportTicketDetailPage() {
  const params = useParams();
  const router = useRouter();
  const ticketId = typeof params.ticketId === 'string' ? params.ticketId : '';

  const [ticket, setTicket] = useState<AdminSupportTicket | null>(null);
  const [replies, setReplies] = useState<AdminTicketReply[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [draft, setDraft] = useState('');
  const [nextStatus, setNextStatus] = useState<AdminTicketStatus>('IN_PROGRESS');
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!ticketId) return;
    setLoading(true);
    try {
      const res = await adminFetch<{ ticket: AdminSupportTicket; replies: AdminTicketReply[] }>(
        `${ADMIN_API_PATH}/support-tickets/${ticketId}`
      );
      setTicket(res.ticket);
      setReplies(res.replies);
      setError(null);
      const st = res.ticket.status;
      if (st === 'OPEN') setNextStatus('IN_PROGRESS');
      else if (st === 'IN_PROGRESS') setNextStatus('IN_PROGRESS');
      else setNextStatus(st);
    } catch (e) {
      setError(e instanceof Error ? e.message : '불러오지 못했습니다.');
      setTicket(null);
      setReplies([]);
    } finally {
      setLoading(false);
    }
  }, [ticketId]);

  useEffect(() => {
    void load();
  }, [load]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    const text = draft.trim();
    if (!text || !ticketId) return;
    setSending(true);
    setSendError(null);
    try {
      await adminFetch<{ ok: boolean; status?: AdminTicketStatus }>(
        `${ADMIN_API_PATH}/support-tickets/${ticketId}/reply`,
        {
          method: 'POST',
          body: JSON.stringify({ content: text, status: nextStatus }),
        }
      );
      setDraft('');
      await load();
    } catch (err) {
      setSendError(err instanceof Error ? err.message : '전송에 실패했습니다.');
    } finally {
      setSending(false);
    }
  };

  if (!ticketId) {
    return (
      <div className="text-sm text-rose-300">잘못된 티켓 링크입니다.</div>
    );
  }

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() => router.push(`${ADMIN_CONSOLE_PATH}/support`)}
          className="inline-flex items-center gap-2 rounded-xl border border-zinc-800 px-3 py-2 text-xs text-zinc-400 hover:bg-zinc-900 hover:text-zinc-200"
        >
          <ArrowLeft className="h-4 w-4" />
          목록
        </button>
        <Link
          href={`${ADMIN_CONSOLE_PATH}/support`}
          className="text-xs text-zinc-500 hover:text-[#10b981]"
        >
          Support Tickets
        </Link>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 py-12 text-zinc-500">
          <Loader2 className="h-5 w-5 animate-spin" /> 불러오는 중…
        </div>
      ) : error ? (
        <div className="rounded-2xl border border-rose-500/20 bg-rose-950/30 px-4 py-3 text-sm text-rose-200">
          {error}
        </div>
      ) : !ticket ? null : (
        <>
          <div className="rounded-2xl border border-zinc-800/80 bg-zinc-950/50 p-5 sm:p-6 space-y-3">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="font-mono text-xs text-[#10b981]">{ticket.ticket_no}</p>
                <h1 className="mt-1 text-xl font-semibold text-slate-100">{ticket.title}</h1>
                <p className="mt-2 text-sm text-zinc-400">{ticket.customer_email}</p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <span className={statusBadge(ticket.status)}>{ticket.status}</span>
                <span className="rounded-lg border border-zinc-700 px-2 py-1 text-[10px] font-semibold uppercase text-zinc-400">
                  {ticket.priority}
                </span>
              </div>
            </div>
            <div className="text-xs text-zinc-500">접수 {formatDt(ticket.created_at)}</div>
            <div className="rounded-xl border border-zinc-800 bg-[#080808] p-4">
              <p className="text-[10px] uppercase tracking-wider text-zinc-500 mb-2">원문 문의</p>
              <p className="text-sm text-slate-200 whitespace-pre-wrap leading-relaxed">{ticket.content}</p>
            </div>
          </div>

          <div className="rounded-2xl border border-zinc-800/80 bg-zinc-950/40 p-5 sm:p-6">
            <h2 className="text-sm font-semibold text-slate-200 mb-4">대화 스레드</h2>
            <div className="space-y-3 max-h-[480px] overflow-y-auto pr-1">
              {replies.length === 0 ? (
                <p className="text-xs text-zinc-500">아직 답변이 없습니다.</p>
              ) : (
                replies.map((r) => {
                  const isAdmin = r.sender_type === 'ADMIN';
                  return (
                    <div
                      key={r.id}
                      className={`flex ${isAdmin ? 'justify-end' : 'justify-start'}`}
                    >
                      <div
                        className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm ${
                          isAdmin
                            ? 'bg-[#07160f] border border-[#10b981]/30 text-emerald-100'
                            : 'bg-zinc-900/80 border border-zinc-700 text-zinc-200'
                        }`}
                      >
                        <div className="flex flex-wrap items-center gap-2 text-[10px] uppercase tracking-wide opacity-80 mb-1">
                          <span className={isAdmin ? 'text-[#10b981]' : 'text-zinc-400'}>
                            {isAdmin ? 'Admin' : 'User'}
                          </span>
                          <span className="text-zinc-500">{r.sender_email || '—'}</span>
                          <span className="text-zinc-600">{formatDt(r.created_at)}</span>
                        </div>
                        <p className="whitespace-pre-wrap leading-relaxed">{r.content}</p>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          <form
            onSubmit={handleSend}
            className="rounded-2xl border border-zinc-800/80 bg-zinc-950/50 p-5 sm:p-6 space-y-4"
          >
            <h2 className="text-sm font-semibold text-slate-200">관리자 답변 · 상태</h2>
            <p className="text-xs text-zinc-500">
              전송 시 답변이 저장되고, 티켓 상태가 선택한 값으로 갱신됩니다. (OPEN이면 기본적으로
              IN_PROGRESS로 진행됩니다 — 아래에서 변경 가능)
            </p>
            <div className="flex flex-wrap items-center gap-3">
              <label className="text-xs text-zinc-400">
                다음 상태
                <select
                  value={nextStatus}
                  onChange={(ev) => setNextStatus(ev.target.value as AdminTicketStatus)}
                  className="mt-1 block w-full sm:w-auto rounded-xl border border-zinc-700 bg-[#0a0a0a] px-3 py-2 text-sm text-slate-200"
                >
                  {STATUS_OPTIONS.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <textarea
              value={draft}
              onChange={(ev) => setDraft(ev.target.value)}
              rows={5}
              placeholder="고객에게 보낼 답변을 입력하세요…"
              className="w-full rounded-2xl border border-zinc-700 bg-[#070707] px-4 py-3 text-sm text-slate-100 placeholder:text-zinc-600 focus:border-[#10b981]/50 focus:outline-none resize-y min-h-[120px]"
            />
            {sendError ? (
              <p className="text-sm text-rose-300">{sendError}</p>
            ) : null}
            <button
              type="submit"
              disabled={sending || !draft.trim()}
              className="inline-flex items-center gap-2 rounded-xl bg-[#10b981] px-5 py-3 text-sm font-semibold text-black hover:brightness-105 disabled:opacity-50"
            >
              {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              답변 전송
            </button>
          </form>
        </>
      )}
    </div>
  );
}
