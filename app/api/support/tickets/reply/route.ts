import { NextResponse } from 'next/server';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createServiceClient } from '../../../../../lib/supabaseAdmin';
import { verifyUserRequest } from '../../../../../lib/verifyUserRequest';

type RequestBody = {
  ticket_id?: string;
  content?: string;
};

const MAX_CONTENT_LENGTH = 8000;

async function insertUserReply(
  db: SupabaseClient,
  ticketId: string,
  userEmail: string,
  content: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  const base = {
    ticket_id: ticketId,
    sender_type: 'USER' as const,
    content,
  };
  const withSender = { ...base, sender_email: userEmail };
  const { error: e1 } = await db.from('lb_ticket_replies').insert(withSender);
  if (!e1) return { ok: true };

  const msg = e1.message?.toLowerCase() ?? '';
  if (msg.includes('sender_email') || msg.includes('column') || e1.code === '42703') {
    const { error: e2 } = await db.from('lb_ticket_replies').insert({
      ...base,
      email: userEmail,
    });
    if (!e2) return { ok: true };
    return { ok: false, error: e2.message };
  }
  return { ok: false, error: e1.message };
}

export async function POST(request: Request) {
  const auth = await verifyUserRequest(request);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const db = createServiceClient();
  if (!db) {
    return NextResponse.json(
      { error: 'SUPABASE_SERVICE_ROLE_KEY가 설정되지 않았습니다.' },
      { status: 503 }
    );
  }

  let body: RequestBody;
  try {
    body = (await request.json()) as RequestBody;
  } catch {
    return NextResponse.json({ error: '요청 본문이 올바르지 않습니다.' }, { status: 400 });
  }

  const ticketId = body.ticket_id?.trim();
  const content = body.content?.trim();

  if (!ticketId) {
    return NextResponse.json({ error: 'ticket_id가 필요합니다.' }, { status: 400 });
  }
  if (!content) {
    return NextResponse.json({ error: '문의 내용을 입력해 주세요.' }, { status: 400 });
  }
  if (content.length > MAX_CONTENT_LENGTH) {
    return NextResponse.json(
      { error: `메시지는 ${MAX_CONTENT_LENGTH}자 이하여야 합니다.` },
      { status: 400 }
    );
  }

  const { data: ticketRaw, error: ticketError } = await db
    .from('lb_support_tickets')
    .select('*')
    .eq('id', ticketId)
    .maybeSingle();

  if (ticketError) {
    console.error('[support/reply] ticket lookup', ticketError);
    return NextResponse.json({ error: '티켓 조회에 실패했습니다.' }, { status: 500 });
  }
  if (!ticketRaw) {
    return NextResponse.json({ error: '티켓을 찾을 수 없습니다.' }, { status: 404 });
  }

  const ticket = ticketRaw as Record<string, unknown>;
  const rowEmail = String(ticket.customer_email ?? ticket.user_email ?? '')
    .trim()
    .toLowerCase();
  const authEmail = auth.email.trim().toLowerCase();
  const emailMatch = rowEmail === authEmail;
  const userMatch = ticket.user_id != null && String(ticket.user_id) === auth.userId;

  if (!emailMatch && !userMatch) {
    return NextResponse.json({ error: '이 티켓에 접근할 권한이 없습니다.' }, { status: 403 });
  }

  const ins = await insertUserReply(db, ticketId, auth.email, content);
  if (!ins.ok) {
    console.error('[support/reply] insert', ins.error);
    return NextResponse.json({ error: '메시지 전송에 실패했습니다.' }, { status: 500 });
  }

  const { data: insertedRows, error: readReplyError } = await db
    .from('lb_ticket_replies')
    .select('*')
    .eq('ticket_id', ticketId)
    .order('created_at', { ascending: false })
    .limit(1);

  if (readReplyError || !insertedRows?.length) {
    await db.from('lb_support_tickets').update({ updated_at: new Date().toISOString() }).eq('id', ticketId);
    return NextResponse.json({ ok: true });
  }

  const inserted = insertedRows[0] as Record<string, unknown>;

  await db.from('lb_support_tickets').update({ updated_at: new Date().toISOString() }).eq('id', ticketId);

  return NextResponse.json({
    ok: true,
    reply: {
      id: inserted.id,
      ticket_id: inserted.ticket_id,
      sender_type: inserted.sender_type,
      email: inserted.sender_email ?? inserted.email,
      content: inserted.content,
      created_at: inserted.created_at,
    },
  });
}
