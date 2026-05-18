import { NextResponse } from 'next/server';
import { verifyAdminRequest } from '../../../../lib/verifyAdminRequest';
import { createServiceClient } from '../../../../lib/supabaseAdmin';
import { fetchLedgerRows, insertRechargeLedger } from '../../../../lib/adminDb';
import { buildBalanceUpsert, fetchUserBalanceRow, readBfaxAmount } from '../../../../lib/adminDb';

export async function GET(request: Request) {
  const auth = await verifyAdminRequest(request);
  if (auth.ok === false) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const db = createServiceClient();
  if (!db) {
    return NextResponse.json({ error: 'SUPABASE_SERVICE_ROLE_KEY가 설정되지 않았습니다.' }, { status: 503 });
  }

  const status = new URL(request.url).searchParams.get('status');
  const filter = status ? status.split(',') : undefined;
  const { rows, error } = await fetchLedgerRows(db, filter?.length === 1 ? filter[0] : filter);

  return NextResponse.json({ rows, error });
}

export async function POST(request: Request) {
  const auth = await verifyAdminRequest(request);
  if (auth.ok === false) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const db = createServiceClient();
  if (!db) {
    return NextResponse.json({ error: 'SUPABASE_SERVICE_ROLE_KEY가 설정되지 않았습니다.' }, { status: 503 });
  }

  const body = await request.json().catch(() => null);
  const email = String(body?.email ?? '').trim();
  const refundBfax = Number(body?.bfax_amount);
  const note = String(body?.note ?? '').trim();

  if (!email || !Number.isFinite(refundBfax) || refundBfax <= 0) {
    return NextResponse.json({ error: 'email과 양수 bfax_amount가 필요합니다.' }, { status: 400 });
  }

  const { data: current, error: fetchError } = await fetchUserBalanceRow(db, email);
  if (fetchError) return NextResponse.json({ error: fetchError }, { status: 500 });
  if (!current) {
    return NextResponse.json({ error: '해당 이메일의 BFAX 잔액 레코드가 없습니다.' }, { status: 404 });
  }

  const currentAmount = readBfaxAmount(current);
  if (refundBfax > currentAmount) {
    return NextResponse.json(
      {
        error: `환불 수량은 현재 보유 BFAX(${currentAmount})를 초과할 수 없습니다.`,
      },
      { status: 400 }
    );
  }

  const next = currentAmount - refundBfax;

  const { error: balanceError } = await db
    .from('lb_user_balance')
    .upsert(buildBalanceUpsert(email, next, current?.account_status as string | undefined), {
      onConflict: 'customer_email',
    });
  if (balanceError) return NextResponse.json({ error: balanceError.message }, { status: 500 });

  const ledger = await insertRechargeLedger(db, {
    customer_email: email,
    bfax_delta: -refundBfax,
    balance_after: next,
    status: 'REFUND',
    note: note || 'Admin BFAX refund',
    admin_email: auth.userEmail,
  });

  return NextResponse.json({ balance_after: next, ledgerWarning: ledger.error });
}
