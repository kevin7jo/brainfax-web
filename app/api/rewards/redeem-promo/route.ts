import { NextResponse } from 'next/server';
import {
  buildBalanceUpsert,
  fetchUserBalanceRow,
  insertRechargeLedger,
  readBfaxAmount,
} from '../../../../lib/adminDb';
import { promoActivityLabel, resolvePromoCode } from '../../../../lib/promoCodes';
import { createServiceClient } from '../../../../lib/supabaseAdmin';
import { verifyUserRequest } from '../../../../lib/verifyUserRequest';

type Body = { code?: string };

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

  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return NextResponse.json({ error: '요청 본문이 올바르지 않습니다.' }, { status: 400 });
  }

  const promo = resolvePromoCode(body?.code ?? '');
  if (!promo) {
    return NextResponse.json(
      { error: '유효하지 않은 프로모션 코드입니다. 코드를 확인해 주세요.' },
      { status: 400 }
    );
  }

  const activity = promoActivityLabel(promo.code);

  const { data: prior } = await db
    .from('lb_rewards_history')
    .select('id')
    .eq('customer_email', auth.email)
    .eq('activity', activity)
    .maybeSingle();

  if (prior) {
    return NextResponse.json(
      { error: `이미 사용한 프로모션 코드입니다. (${promo.code})` },
      { status: 409 }
    );
  }

  const { data: balanceRow, error: balanceReadError } = await fetchUserBalanceRow(db, auth.email);
  if (balanceReadError) {
    return NextResponse.json({ error: balanceReadError }, { status: 500 });
  }

  const current = readBfaxAmount(balanceRow);
  const next = current + promo.bfax;

  const { error: upsertError } = await db
    .from('lb_user_balance')
    .upsert(buildBalanceUpsert(auth.email, next), { onConflict: 'customer_email' });

  if (upsertError) {
    console.error('[redeem-promo] balance upsert', upsertError);
    return NextResponse.json({ error: 'BFAX 잔액 반영에 실패했습니다.' }, { status: 500 });
  }

  const { error: rewardError } = await db.from('lb_rewards_history').insert({
    customer_email: auth.email,
    activity,
    reward_bfax: promo.bfax,
    status: 'Success',
  });

  if (rewardError) {
    console.error('[redeem-promo] rewards history', rewardError);
    return NextResponse.json({ error: '리워드 기록 저장에 실패했습니다.' }, { status: 500 });
  }

  const ledger = await insertRechargeLedger(db, {
    customer_email: auth.email,
    bfax_delta: promo.bfax,
    balance_after: next,
    status: 'PROMO',
    note: activity,
  });

  if (!ledger.ok) {
    console.warn('[redeem-promo] ledger warning', ledger.error);
  }

  return NextResponse.json({
    ok: true,
    code: promo.code,
    bfaxGranted: promo.bfax,
    balanceAfter: next,
  });
}
