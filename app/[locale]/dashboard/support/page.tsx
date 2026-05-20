'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import type { RealtimeChannel } from '@supabase/supabase-js';
import {
  LifeBuoy,
  Loader2,
  Mail,
  MessageSquare,
  Send,
  X,
} from 'lucide-react';
import { supabase } from '../../../../lib/supabaseClient';
import {
  normalizeSupportTicketFromRow,
  normalizeTicketReplyFromRow,
  type SupportTicket,
  type TicketReply,
  type TicketStatus,
} from '../../../../lib/supportTickets';
import { BFAX_SUPPORT_EMAIL, getBfaxSupportMailtoHref } from '../../../../lib/bfaxSupportContact';

const cardBg = '#0b0b0b';
const neonOrange = '#f97316';

async function getAccessToken(): Promise<string> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error('로그인이 필요합니다.');
  return token;
}

function formatDate(iso: string) {
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}

function StatusBadge({ status }: { status: TicketStatus }) {
  if (status === 'OPEN') {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full border border-red-500/50 bg-red-950/50 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-red-300 shadow-[0_0_12px_rgba(239,68,68,0.35)]">
        <span aria-hidden>🔴</span> OPEN
      </span>
    );
  }
  if (status === 'IN_PROGRESS') {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-400/50 bg-amber-950/40 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-amber-200 shadow-[0_0_12px_rgba(251,191,36,0.35)]">
        <span aria-hidden>🟡</span> IN_PROGRESS
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/50 bg-emerald-950/40 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-emerald-300 shadow-[0_0_12px_rgba(16,185,129,0.35)]">
      <span aria-hidden>🟢</span> RESOLVED
    </span>
  );
}

type TimelineItem =
  | { kind: 'initial'; at: string; content: string; email: string }
  | { kind: 'reply'; reply: TicketReply };

export default function SupportHelpdeskPage() {
  const [userId, setUserId] = useState<string | null>(null);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [replies, setReplies] = useState<TicketReply[]>([]);
  const [repliesLoading, setRepliesLoading] = useState(false);

  const [draft, setDraft] = useState('');
  const [sendLoading, setSendLoading] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const [sendSuccess, setSendSuccess] = useState<string | null>(null);

  const selectedTicket = useMemo(
    () => tickets.find((t) => t.id === selectedId) ?? null,
    [tickets, selectedId]
  );

  const timeline = useMemo((): TimelineItem[] => {
    if (!selectedTicket) return [];
    const items: TimelineItem[] = [
      {
        kind: 'initial',
        at: selectedTicket.created_at,
        content: selectedTicket.body,
        email: selectedTicket.user_email,
      },
    ];
    for (const reply of replies) {
      items.push({ kind: 'reply', reply });
    }
    return items;
  }, [selectedTicket, replies]);

  const fetchTickets = useCallback(async (_uid: string, _email: string) => {
    /** RLS가 본인 티켓만 반환하므로 컬럼 불일치를 피하려고 * 조회 + 정규화 */
    const { data, error } = await supabase
      .from('lb_support_tickets')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('[support] tickets', error);
      setFetchError(
        `티켓 목록을 불러오지 못했습니다.${error.message ? ` (${error.message})` : ''}`
      );
      setTickets([]);
      return;
    }

    setFetchError(null);
    setTickets(
      (data ?? [])
        .map((row) => normalizeSupportTicketFromRow(row as Record<string, unknown>))
        .filter((t): t is SupportTicket => t !== null)
    );
  }, []);

  const fetchReplies = useCallback(async (ticketId: string) => {
    setRepliesLoading(true);
    const { data, error } = await supabase
      .from('lb_ticket_replies')
      .select('*')
      .eq('ticket_id', ticketId)
      .order('created_at', { ascending: true });

    if (error) {
      console.error('[support] replies', error);
      setReplies([]);
    } else {
      setReplies(
        (data ?? [])
          .map((row) => normalizeTicketReplyFromRow(row as Record<string, unknown>))
          .filter((r): r is TicketReply => r !== null)
      );
    }
    setRepliesLoading(false);
  }, []);

  useEffect(() => {
    let ticketsChannel: RealtimeChannel | null = null;
    let mounted = true;

    const init = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!mounted) return;
      if (!user?.email) {
        setLoading(false);
        return;
      }

      setUserId(user.id);
      setUserEmail(user.email);
      await fetchTickets(user.id, user.email);
      setLoading(false);

      const refetch = () => void fetchTickets(user.id, user.email);

      ticketsChannel = supabase
        .channel(`support-tickets-uid-${user.id}`)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'lb_support_tickets',
            filter: `user_id=eq.${user.id}`,
          },
          refetch
        )
        .subscribe();

      /** user_id가 없는 티켓(메일 유입 등) 갱신은 목록 새로고침으로 보완 */
    };

    void init();

    return () => {
      mounted = false;
      if (ticketsChannel) supabase.removeChannel(ticketsChannel);
    };
  }, [fetchTickets]);

  useEffect(() => {
    if (!selectedId || !userId || !userEmail) return;

    let channel: RealtimeChannel | null = null;
    let mounted = true;

    const load = async () => {
      await fetchReplies(selectedId);

      channel = supabase
        .channel(`support-replies-${selectedId}`)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'lb_ticket_replies',
            filter: `ticket_id=eq.${selectedId}`,
          },
          () => {
            if (mounted) void fetchReplies(selectedId);
          }
        )
        .subscribe();
    };

    void load();

    return () => {
      mounted = false;
      if (channel) supabase.removeChannel(channel);
    };
  }, [selectedId, userId, userEmail, fetchReplies]);

  const openTicket = (id: string) => {
    setSelectedId(id);
    setDraft('');
    setSendError(null);
    setSendSuccess(null);
  };

  const closeDetail = () => {
    setSelectedId(null);
    setReplies([]);
    setDraft('');
    setSendError(null);
    setSendSuccess(null);
  };

  const sendReply = async () => {
    if (!selectedId || !draft.trim()) return;

    setSendLoading(true);
    setSendError(null);
    setSendSuccess(null);

    try {
      const token = await getAccessToken();
      const res = await fetch('/api/support/tickets/reply', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ ticket_id: selectedId, content: draft.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || '전송 실패');

      setDraft('');
      setSendSuccess('메시지가 전송되었습니다.');
      await fetchReplies(selectedId);
    } catch (e) {
      setSendError(e instanceof Error ? e.message : '메시지 전송에 실패했습니다.');
    } finally {
      setSendLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div
        className="relative overflow-hidden rounded-2xl border border-orange-500/35 bg-gradient-to-r from-[#120800] via-[#0b0b0b] to-[#0a0505] p-5 sm:p-6 shadow-[0_0_40px_rgba(249,115,22,0.15)]"
        role="banner"
      >
        <div
          className="pointer-events-none absolute inset-0 opacity-40"
          style={{
            background:
              'radial-gradient(ellipse 60% 80% at 0% 50%, rgba(249,115,22,0.25), transparent 60%)',
          }}
        />
        <div className="relative flex items-start gap-3">
          <div className="rounded-xl border border-orange-500/40 bg-orange-950/30 p-2.5">
            <LifeBuoy className="h-6 w-6 text-orange-400" />
          </div>
          <div>
            <p className="text-xs font-mono uppercase tracking-[0.2em] text-orange-400/90">
              Omnichannel Helpdesk
            </p>
            <p className="mt-2 text-sm sm:text-base text-slate-300 leading-relaxed">
              <span className="mr-1" aria-hidden>
                📬
              </span>
              OMNICHANNEL HELPDESK: Send your claims to{' '}
              <a
                href={getBfaxSupportMailtoHref()}
                className="font-semibold text-orange-300 hover:text-orange-200 underline underline-offset-2"
              >
                {BFAX_SUPPORT_EMAIL}
              </a>
              . Your emails are automatically tokenized into immutable support tickets here.
            </p>
          </div>
        </div>
      </div>

      <div
        className="rounded-2xl overflow-hidden"
        style={{ background: cardBg, border: '1px solid rgba(249,115,22,0.12)' }}
      >
        <div className="px-4 sm:px-6 py-4 border-b border-orange-500/15 flex items-center justify-between gap-3">
          <h2 className="text-lg font-semibold text-slate-100 flex items-center gap-2">
            <MessageSquare className="h-5 w-5 text-orange-400" />
            My Support Tickets
          </h2>
          {loading && <Loader2 className="h-4 w-4 animate-spin text-orange-400" />}
        </div>

        {fetchError && (
          <p className="px-6 py-3 text-sm text-red-400 border-b border-red-500/20 bg-red-950/20">
            {fetchError}
          </p>
        )}

        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="text-xs uppercase tracking-wider text-slate-500 bg-[#070707]">
              <tr>
                <th className="px-4 sm:px-6 py-3">Ticket #</th>
                <th className="px-4 sm:px-6 py-3">Title</th>
                <th className="px-4 sm:px-6 py-3 hidden sm:table-cell">Received</th>
                <th className="px-4 sm:px-6 py-3">Status</th>
              </tr>
            </thead>
            <tbody>
              {!loading && tickets.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-6 py-12 text-center text-slate-500">
                    아직 등록된 티켓이 없습니다.{' '}
                    <span className="text-orange-400/90">bfax.help@brainfax.net</span>으로 메일을
                    보내 주세요.
                  </td>
                </tr>
              )}
              {tickets.map((ticket) => {
                const active = selectedId === ticket.id;
                return (
                  <tr
                    key={ticket.id}
                    onClick={() => openTicket(ticket.id)}
                    className={`cursor-pointer border-t border-gray-800/60 transition ${
                      active
                        ? 'bg-orange-950/25'
                        : 'hover:bg-gray-900/40'
                    }`}
                  >
                    <td className="px-4 sm:px-6 py-3 font-mono text-orange-300/90 text-xs">
                      {ticket.ticket_number}
                    </td>
                    <td className="px-4 sm:px-6 py-3 text-slate-200 max-w-[200px] sm:max-w-none truncate">
                      {ticket.title}
                    </td>
                    <td className="px-4 sm:px-6 py-3 text-slate-500 hidden sm:table-cell whitespace-nowrap">
                      {formatDate(ticket.created_at)}
                    </td>
                    <td className="px-4 sm:px-6 py-3">
                      <StatusBadge status={ticket.status} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {selectedTicket && (
        <div
          className="rounded-2xl overflow-hidden"
          style={{
            background: cardBg,
            border: `1px solid rgba(249,115,22,0.25)`,
            boxShadow: `0 0 32px rgba(249,115,22,0.08)`,
          }}
        >
          <div className="flex items-start justify-between gap-3 px-4 sm:px-6 py-4 border-b border-orange-500/20 bg-[#0a0806]">
            <div>
              <p className="text-xs font-mono text-orange-400/80">{selectedTicket.ticket_number}</p>
              <h3 className="mt-1 text-lg font-semibold text-slate-100">{selectedTicket.title}</h3>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <StatusBadge status={selectedTicket.status} />
                <span className="text-xs text-slate-500">{formatDate(selectedTicket.created_at)}</span>
              </div>
            </div>
            <button
              type="button"
              onClick={closeDetail}
              className="p-2 rounded-lg border border-gray-800 text-slate-400 hover:text-slate-200 hover:border-orange-500/30"
              aria-label="Close ticket detail"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="px-4 sm:px-6 py-5 max-h-[420px] overflow-y-auto space-y-4 bg-[#060606]">
            <p className="text-xs uppercase tracking-wider text-slate-500 font-mono">Ticket Timeline</p>

            {repliesLoading && (
              <div className="flex justify-center py-6">
                <Loader2 className="h-5 w-5 animate-spin text-orange-400" />
              </div>
            )}

            {!repliesLoading &&
              timeline.map((item, idx) => {
                if (item.kind === 'initial') {
                  return (
                    <div key="initial" className="flex justify-start">
                      <div className="max-w-[92%] rounded-2xl rounded-tl-sm border border-orange-500/25 bg-orange-950/20 px-4 py-3">
                        <div className="flex items-center gap-2 text-[10px] uppercase tracking-wider text-orange-300/80 font-semibold">
                          <Mail className="h-3 w-3" />
                          Original inquiry (email)
                        </div>
                        <p className="mt-2 text-xs text-slate-500">{item.email}</p>
                        <p className="mt-2 text-sm text-slate-200 whitespace-pre-wrap leading-relaxed">
                          {item.content}
                        </p>
                        <p className="mt-2 text-[10px] text-slate-600 text-right">{formatDate(item.at)}</p>
                      </div>
                    </div>
                  );
                }

                const { reply } = item;
                const isAdmin = reply.sender_type === 'ADMIN';
                return (
                  <div
                    key={reply.id ?? idx}
                    className={`flex ${isAdmin ? 'justify-start' : 'justify-end'}`}
                  >
                    <div
                      className={`max-w-[92%] rounded-2xl px-4 py-3 ${
                        isAdmin
                          ? 'rounded-tl-sm border border-red-500/30 bg-red-950/25'
                          : 'rounded-tr-sm border border-slate-700/50 bg-slate-900/80'
                      }`}
                    >
                      <div
                        className={`text-[10px] uppercase tracking-wider font-bold ${
                          isAdmin ? 'text-red-300/90' : 'text-slate-400'
                        }`}
                      >
                        {isAdmin ? 'BrainFax Operations (ADMIN)' : 'You (USER)'}
                      </div>
                      <p className="mt-1 text-[10px] text-slate-500">{reply.email}</p>
                      <p className="mt-2 text-sm text-slate-200 whitespace-pre-wrap leading-relaxed">
                        {reply.content}
                      </p>
                      <p className="mt-2 text-[10px] text-slate-600 text-right">
                        {formatDate(reply.created_at)}
                      </p>
                    </div>
                  </div>
                );
              })}
          </div>

          <div className="px-4 sm:px-6 py-4 border-t border-orange-500/15 bg-[#080808] space-y-3">
            <label className="text-xs text-slate-400 uppercase tracking-wider">추가 문의 내용</label>
            <textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              rows={3}
              placeholder="추가로 전달할 내용을 입력하세요…"
              className="w-full rounded-xl border border-gray-800 bg-[#050505] px-4 py-3 text-sm text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-orange-500/50 focus:ring-1 focus:ring-orange-500/30 resize-y min-h-[88px]"
              disabled={sendLoading || selectedTicket.status === 'RESOLVED'}
            />
            {selectedTicket.status === 'RESOLVED' && (
              <p className="text-xs text-emerald-400/80">이 티켓은 RESOLVED 상태입니다. 추가 문의는 새 메일로 접수해 주세요.</p>
            )}
            {sendError && <p className="text-sm text-red-400">{sendError}</p>}
            {sendSuccess && <p className="text-sm text-emerald-400">{sendSuccess}</p>}
            <button
              type="button"
              onClick={() => void sendReply()}
              disabled={sendLoading || !draft.trim() || selectedTicket.status === 'RESOLVED'}
              className="inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-bold text-black disabled:opacity-50 disabled:cursor-not-allowed transition hover:brightness-110"
              style={{
                background: `linear-gradient(135deg, ${neonOrange}, #ea580c)`,
                boxShadow: '0 0 24px rgba(249,115,22,0.35)',
              }}
            >
              {sendLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
              메시지 전송
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
