import type { SupabaseClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import { createServiceClient } from '../../../../../../lib/supabaseAdmin';
import { verifyAdminRequest } from '../../../../../../lib/verifyAdminRequest';
import {
  normalizeAdminTicketRow,
  nextAdminStatusAfterReply,
  type AdminTicketStatus,
} from '../../../../../../lib/adminSupportTickets';

type Ctx = { params: Promise<{ ticketId: string }> };

type Body = {
  content?: string;
  /** 명시하지 않으면 OPEN → IN_PROGRESS 등 규칙 적용 */
  status?: AdminTicketStatus;
};

const MAX_LEN = 12000;

async function insertAdminReply(
  db: SupabaseClient,
  ticketId: string,
  adminEmail: string,
  content: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  const base = {
    ticket_id: ticketId,
    sender_type: 'ADMIN' as const,
    content,
  };

  const withSender = { ...base, sender_email: adminEmail };
  const { error: e1 } = await db.from('lb_ticket_replies').insert(withSender);
  if (!e1) return { ok: true };

  const msg = e1.message?.toLowerCase() ?? '';
  if (msg.includes('sender_email') || msg.includes('column') || e1.code === '42703') {
    const { error: e2 } = await db.from('lb_ticket_replies').insert({
      ...base,
      email: adminEmail,
    });
    if (!e2) return { ok: true };
    return { ok: false, error: e2.message };
  }

  return { ok: false, error: e1.message };
}

export async function POST(request: Request, ctx: Ctx) {
  const auth = await verifyAdminRequest(request);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { ticketId } = await ctx.params;
  const id = ticketId?.trim();
  if (!id) {
    return NextResponse.json({ error: 'ticketId가 필요합니다.' }, { status: 400 });
  }

  const db = createServiceClient();
  if (!db) {
    return NextResponse.json(
      { error: 'SUPABASE_SERVICE_ROLE_KEY가 설정되지 않았습니다.' },
      { status: 503 }
    );
  }

  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return NextResponse.json({ error: '요청 본문이 올바르지 않습니다.' }, { status: 400 });
  }

  const content = (body.content ?? '').trim();
  if (!content) {
    return NextResponse.json({ error: '답변 내용을 입력해 주세요.' }, { status: 400 });
  }
  if (content.length > MAX_LEN) {
    return NextResponse.json({ error: `답변은 ${MAX_LEN}자 이하여야 합니다.` }, { status: 400 });
  }

  const { data: ticketRaw, error: readError } = await db
    .from('lb_support_tickets')
    .select('*')
    .eq('id', id)
    .maybeSingle();

  if (readError) {
    console.error('[admin support reply] read', readError);
    return NextResponse.json({ error: '티켓 조회에 실패했습니다.' }, { status: 500 });
  }

  const ticket = ticketRaw ? normalizeAdminTicketRow(ticketRaw as Record<string, unknown>) : null;
  if (!ticket) {
    return NextResponse.json({ error: '티켓을 찾을 수 없습니다.' }, { status: 404 });
  }

  const nextStatus = nextAdminStatusAfterReply(ticket.status, body.status ?? undefined);

  const ins = await insertAdminReply(db, id, auth.userEmail, content);
  if (!ins.ok) {
    console.error('[admin support reply] insert', ins.error);
    return NextResponse.json({ error: '답변 저장에 실패했습니다.' }, { status: 500 });
  }

  const now = new Date().toISOString();
  const { error: updError } = await db
    .from('lb_support_tickets')
    .update({
      status: nextStatus,
      updated_at: now,
    })
    .eq('id', id);

  if (updError) {
    console.error('[admin support reply] ticket update', updError);
    return NextResponse.json(
      {
        error: '답변은 저장되었으나 티켓 상태 업데이트에 실패했습니다. 수동으로 상태를 맞춰 주세요.',
        partial: true,
      },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true, status: nextStatus });
}
