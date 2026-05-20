import { NextResponse } from 'next/server';
import { createServiceClient } from '../../../../lib/supabaseAdmin';
import { verifyAdminRequest } from '../../../../lib/verifyAdminRequest';
import {
  normalizeAdminTicketRow,
  type AdminTicketStatus,
} from '../../../../lib/adminSupportTickets';

function parseStatusFilter(
  param: string | null
): AdminTicketStatus | 'ALL' | null {
  if (!param || param.trim() === '' || param.toUpperCase() === 'ALL') return 'ALL';
  const s = param.toUpperCase().replace(/\s+/g, '_');
  if (['OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED'].includes(s)) {
    return s as AdminTicketStatus;
  }
  return null;
}

export async function GET(request: Request) {
  const auth = await verifyAdminRequest(request);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const db = createServiceClient();
  if (!db) {
    return NextResponse.json(
      { error: 'SUPABASE_SERVICE_ROLE_KEY가 설정되지 않았습니다.' },
      { status: 503 }
    );
  }

  const statusFilter = parseStatusFilter(new URL(request.url).searchParams.get('status'));
  if (statusFilter === null) {
    return NextResponse.json({ error: '유효하지 않은 status 필터입니다.' }, { status: 400 });
  }

  let q = db.from('lb_support_tickets').select('*').order('created_at', { ascending: false });
  if (statusFilter !== 'ALL') {
    q = q.eq('status', statusFilter);
  }

  const { data, error } = await q;

  if (error) {
    console.error('[admin support-tickets list]', error);
    return NextResponse.json({ error: '티켓 목록을 불러오지 못했습니다.' }, { status: 500 });
  }

  const tickets = (data as Record<string, unknown>[])
    .map((row) => normalizeAdminTicketRow(row))
    .filter((t): t is NonNullable<typeof t> => t !== null);

  return NextResponse.json({ tickets });
}
