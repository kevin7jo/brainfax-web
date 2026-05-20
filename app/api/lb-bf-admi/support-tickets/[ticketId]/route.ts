import { NextResponse } from 'next/server';
import { createServiceClient } from '../../../../../lib/supabaseAdmin';
import { verifyAdminRequest } from '../../../../../lib/verifyAdminRequest';
import {
  normalizeAdminReplyRow,
  normalizeAdminTicketRow,
} from '../../../../../lib/adminSupportTickets';

type Ctx = { params: Promise<{ ticketId: string }> };

export async function GET(request: Request, ctx: Ctx) {
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

  const { data: ticketRaw, error: ticketError } = await db
    .from('lb_support_tickets')
    .select('*')
    .eq('id', id)
    .maybeSingle();

  if (ticketError) {
    console.error('[admin support-tickets detail]', ticketError);
    return NextResponse.json({ error: '티켓 조회에 실패했습니다.' }, { status: 500 });
  }

  const ticket = ticketRaw ? normalizeAdminTicketRow(ticketRaw as Record<string, unknown>) : null;
  if (!ticket) {
    return NextResponse.json({ error: '티켓을 찾을 수 없습니다.' }, { status: 404 });
  }

  const { data: repliesRaw, error: repliesError } = await db
    .from('lb_ticket_replies')
    .select('*')
    .eq('ticket_id', id)
    .order('created_at', { ascending: true });

  if (repliesError) {
    console.error('[admin support-tickets replies]', repliesError);
    return NextResponse.json({ error: '답변 목록을 불러오지 못했습니다.' }, { status: 500 });
  }

  const replies = (repliesRaw as Record<string, unknown>[])
    .map((r) => normalizeAdminReplyRow(r))
    .filter((r): r is NonNullable<typeof r> => r !== null);

  return NextResponse.json({ ticket, replies });
}
