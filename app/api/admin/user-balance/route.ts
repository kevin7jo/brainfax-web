import { NextResponse } from 'next/server';
import { verifyAdminRequest } from '../../../../lib/verifyAdminRequest';
import { createServiceClient } from '../../../../lib/supabaseAdmin';
import { buildBalanceUpsert, fetchUserBalanceRow, insertRechargeLedger, readBfaxAmount } from '../../../../lib/adminDb';

export async function GET(request: Request) {
  const auth = await verifyAdminRequest(request);
  if (auth.ok === false) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const email = new URL(request.url).searchParams.get('email')?.trim();
  if (!email) return NextResponse.json({ error: 'email 파라미터가 필요합니다.' }, { status: 400 });

  const db = createServiceClient();
  if (!db) {
    return NextResponse.json(
      { error: 'SUPABASE_SERVICE_ROLE_KEY가 서버에 설정되지 않았습니다. Vercel 환경 변수를 확인하세요.' },
      { status: 503 }
    );
  }

  const { data, error } = await fetchUserBalanceRow(db, email);
  if (error) return NextResponse.json({ error }, { status: 500 });

  return NextResponse.json({ user: data });
}

export async function PATCH(request: Request) {
  const auth = await verifyAdminRequest(request);
  if (auth.ok === false) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const db = createServiceClient();
  if (!db) {
    return NextResponse.json({ error: 'SUPABASE_SERVICE_ROLE_KEY가 설정되지 않았습니다.' }, { status: 503 });
  }

  const body = await request.json().catch(() => null);
  const email = String(body?.email ?? '').trim();
  const delta = Number(body?.delta);
  const accountStatus = body?.account_status as string | undefined;
  const note = String(body?.note ?? '').trim();

  if (!email) return NextResponse.json({ error: 'email이 필요합니다.' }, { status: 400 });

  if (body?.account_status !== undefined && body?.delta === undefined) {
    const { data: current } = await fetchUserBalanceRow(db, email);
    const row = buildBalanceUpsert(email, readBfaxAmount(current), accountStatus);
    const { error } = await db.from('lb_user_balance').upsert(row, { onConflict: 'customer_email' });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    const { data: updated } = await fetchUserBalanceRow(db, email);
    return NextResponse.json({
      user: updated ?? { customer_email: email, bfax_queue: readBfaxAmount(current), account_status: accountStatus },
    });
  }

  if (!Number.isFinite(delta)) {
    return NextResponse.json({ error: '유효한 delta가 필요합니다.' }, { status: 400 });
  }

  const { data: current, error: fetchError } = await fetchUserBalanceRow(db, email);
  if (fetchError) return NextResponse.json({ error: fetchError }, { status: 500 });

  const currentAmount = readBfaxAmount(current);
  const next = currentAmount + delta;
  if (next < 0) return NextResponse.json({ error: 'BFAX 잔액이 음수가 될 수 없습니다.' }, { status: 400 });

  const upsertRow = buildBalanceUpsert(
    email,
    next,
    accountStatus ?? (current?.account_status as string | undefined)
  );

  const { error: balanceError } = await db.from('lb_user_balance').upsert(upsertRow, {
    onConflict: 'customer_email',
  });
  if (balanceError) return NextResponse.json({ error: balanceError.message }, { status: 500 });

  const ledger = await insertRechargeLedger(db, {
    customer_email: email,
    bfax_delta: delta,
    balance_after: next,
    status: 'ADMIN_ADJUST',
    note: note || (delta > 0 ? 'Admin BFAX credit' : 'Admin BFAX debit'),
    admin_email: auth.userEmail,
  });

  return NextResponse.json({
    user: { customer_email: email, bfax_queue: next, bfax_amount: next },
    ledgerWarning: ledger.error,
  });
}
