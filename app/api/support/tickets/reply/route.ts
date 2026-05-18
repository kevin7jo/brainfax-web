import { NextResponse } from 'next/server';
import { createServiceClient } from '../../../../../lib/supabaseAdmin';
import { verifyUserRequest } from '../../../../../lib/verifyUserRequest';

type RequestBody = {
  ticket_id?: string;
  content?: string;
};

const MAX_CONTENT_LENGTH = 8000;

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

  const { data: ticket, error: ticketError } = await db
    .from('lb_support_tickets')
    .select('id, user_id, user_email, status')
    .eq('id', ticketId)
    .maybeSingle();

  if (ticketError) {
    console.error('[support/reply] ticket lookup', ticketError);
    return NextResponse.json({ error: '티켓 조회에 실패했습니다.' }, { status: 500 });
  }
  if (!ticket) {
    return NextResponse.json({ error: '티켓을 찾을 수 없습니다.' }, { status: 404 });
  }

  const emailMatch =
    ticket.user_email?.toLowerCase() === auth.email.toLowerCase();
  const userMatch = ticket.user_id === auth.userId;
  if (!emailMatch && !userMatch) {
    return NextResponse.json({ error: '이 티켓에 접근할 권한이 없습니다.' }, { status: 403 });
  }

  const { data: inserted, error: insertError } = await db
    .from('lb_ticket_replies')
    .insert({
      ticket_id: ticketId,
      sender_type: 'USER',
      email: auth.email,
      content,
    })
    .select('id, ticket_id, sender_type, email, content, created_at')
    .single();

  if (insertError) {
    console.error('[support/reply] insert', insertError);
    return NextResponse.json({ error: '메시지 전송에 실패했습니다.' }, { status: 500 });
  }

  await db
    .from('lb_support_tickets')
    .update({ updated_at: new Date().toISOString() })
    .eq('id', ticketId);

  return NextResponse.json({ ok: true, reply: inserted });
}
