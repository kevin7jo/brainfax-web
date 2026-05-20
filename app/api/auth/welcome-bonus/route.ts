import { NextResponse } from 'next/server';
import {
  buildBalanceUpsert,
  fetchUserBalanceRow,
  insertRechargeLedger,
  readBfaxAmount,
} from '../../../../lib/adminDb';
import {
  SIGNUP_WELCOME_ACTIVITY,
  SIGNUP_WELCOME_BFAX,
  SIGNUP_WELCOME_LEDGER_STATUS,
} from '../../../../lib/signupBonus';
import { createServiceClient } from '../../../../lib/supabaseAdmin';
import { verifyUserRequest } from '../../../../lib/verifyUserRequest';

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

  const { data: existing, error: readError } = await fetchUserBalanceRow(db, auth.email);
  if (readError) {
    return NextResponse.json({ error: readError }, { status: 500 });
  }

  if (existing) {
    return NextResponse.json({
      ok: true,
      alreadyProvisioned: true,
      balance: readBfaxAmount(existing),
    });
  }

  const { error: upsertError } = await db
    .from('lb_user_balance')
    .upsert(buildBalanceUpsert(auth.email, SIGNUP_WELCOME_BFAX), {
      onConflict: 'customer_email',
    });

  if (upsertError) {
    console.error('[welcome-bonus] balance upsert', upsertError);
    return NextResponse.json({ error: '가입 웰컴 BFAX 지급에 실패했습니다.' }, { status: 500 });
  }

  const ledger = await insertRechargeLedger(db, {
    customer_email: auth.email,
    bfax_delta: SIGNUP_WELCOME_BFAX,
    balance_after: SIGNUP_WELCOME_BFAX,
    status: SIGNUP_WELCOME_LEDGER_STATUS,
    note: SIGNUP_WELCOME_ACTIVITY,
  });

  if (!ledger.ok) {
    console.warn('[welcome-bonus] ledger warning', ledger.error);
  }

  return NextResponse.json({
    ok: true,
    granted: SIGNUP_WELCOME_BFAX,
    balanceAfter: SIGNUP_WELCOME_BFAX,
  });
}
