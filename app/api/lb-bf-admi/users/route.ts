import { NextResponse } from 'next/server';
import { verifyAdminRequest } from '../../../../lib/verifyAdminRequest';
import { createServiceClient } from '../../../../lib/supabaseAdmin';

export async function GET(request: Request) {
  const auth = await verifyAdminRequest(request);
  if (auth.ok === false) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const db = createServiceClient();
  if (!db) {
    return NextResponse.json({ error: 'SUPABASE_SERVICE_ROLE_KEY가 설정되지 않았습니다.' }, { status: 503 });
  }

  const { data, error } = await db
    .from('lb_user_balance')
    .select('customer_email, bfax_queue, bfax_amount, account_status')
    .order('customer_email', { ascending: true })
    .limit(50);

  if (error) {
    const fallback = await db.from('lb_user_balance').select('customer_email, bfax_queue').limit(50);
    if (fallback.error) return NextResponse.json({ error: fallback.error.message }, { status: 500 });
    return NextResponse.json({ users: fallback.data ?? [] });
  }

  return NextResponse.json({ users: data ?? [] });
}
