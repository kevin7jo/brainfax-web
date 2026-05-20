import { NextResponse } from 'next/server';
import {
  REWARD_STATUS,
  REWARDS_HISTORY_COLUMNS,
  fetchPendingReviewMissions,
  fetchRecentReviewMissionSubmissions,
  fetchRewardsHistoryTableTail,
  isReviewMissionHeuristic,
  matchesUnderReviewStatusLoose,
  parseRewardsHistoryRow,
} from '../../../../lib/rewardsHistory';
import {
  buildBalanceUpsert,
  fetchUserBalanceRow,
  insertRechargeLedger,
  readBfaxAmount,
} from '../../../../lib/adminDb';
import { createServiceClient } from '../../../../lib/supabaseAdmin';
import { verifyAdminRequest } from '../../../../lib/verifyAdminRequest';

type PatchBody = { id?: number; action?: string };

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

  const [pending, recent, tail] = await Promise.all([
    fetchPendingReviewMissions(db),
    fetchRecentReviewMissionSubmissions(db, 25),
    fetchRewardsHistoryTableTail(db, 20),
  ]);

  if (pending.error) {
    console.error('[review-missions GET] pending', pending.error);
    return NextResponse.json({ error: '리뷰 미션 목록을 불러오지 못했습니다.' }, { status: 500 });
  }
  if (recent.error) {
    console.warn('[review-missions GET] recent sample', recent.error);
  }
  if (tail.error) {
    console.warn('[review-missions GET] tail', tail.error);
  }

  return NextResponse.json({
    missions: pending.rows,
    recentReviewSubmissions: recent.error ? [] : recent.rows,
    recentLoadError: recent.error,
    debug: {
      tableTail: tail.error ? [] : tail.rows,
      tableTailError: tail.error,
    },
  });
}

export async function PATCH(request: Request) {
  const auth = await verifyAdminRequest(request);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const db = createServiceClient();
  if (!db) {
    return NextResponse.json(
      { error: 'SUPABASE_SERVICE_ROLE_KEY가 설정되지 않았습니다.' },
      { status: 503 }
    );
  }

  let body: PatchBody;
  try {
    body = (await request.json()) as PatchBody;
  } catch {
    return NextResponse.json({ error: '요청 본문이 올바르지 않습니다.' }, { status: 400 });
  }

  const id = Number(body.id);
  const action = String(body.action ?? '').toLowerCase();
  if (!Number.isFinite(id) || id <= 0) {
    return NextResponse.json({ error: '유효한 id가 필요합니다.' }, { status: 400 });
  }
  if (action !== 'approve' && action !== 'reject') {
    return NextResponse.json({ error: 'action은 approve 또는 reject 여야 합니다.' }, { status: 400 });
  }

  const { data: rawRow, error: readError } = await db
    .from('lb_rewards_history')
    .select(REWARDS_HISTORY_COLUMNS)
    .eq('id', id)
    .maybeSingle();

  if (readError) {
    console.error('[review-missions PATCH] read', readError);
    return NextResponse.json({ error: '행을 조회하지 못했습니다.' }, { status: 500 });
  }
  if (!rawRow) {
    return NextResponse.json({ error: '해당 ID의 기록이 없습니다.' }, { status: 404 });
  }

  const row = parseRewardsHistoryRow(rawRow as Record<string, unknown>);
  if (!row) {
    return NextResponse.json({ error: '기록 형식이 올바르지 않습니다.' }, { status: 400 });
  }
  if (
    !isReviewMissionHeuristic(row) ||
    !matchesUnderReviewStatusLoose(row.status) ||
    !String(row.review_url ?? '').trim()
  ) {
    return NextResponse.json(
      { error: '리뷰 미션 검수 대기 건이 아닙니다. (activity/status/URL 확인)' },
      { status: 400 }
    );
  }

  const statusAsStored = row.status;

  if (action === 'reject') {
    const { data, error } = await db
      .from('lb_rewards_history')
      .update({ status: REWARD_STATUS.REJECTED })
      .eq('id', id)
      .eq('status', statusAsStored)
      .select('id')
      .maybeSingle();

    if (error) {
      console.error('[review-missions reject]', error);
      return NextResponse.json({ error: '거절 처리에 실패했습니다.' }, { status: 500 });
    }
    if (!data) {
      return NextResponse.json(
        { error: '동시에 다른 처리가 반영되었습니다. 새로고침 후 다시 시도해 주세요.' },
        { status: 409 }
      );
    }
    return NextResponse.json({ ok: true, id, status: REWARD_STATUS.REJECTED });
  }

  const { data: claimed, error: claimError } = await db
    .from('lb_rewards_history')
    .update({ status: REWARD_STATUS.APPROVED })
    .eq('id', id)
    .eq('status', statusAsStored)
    .not('review_url', 'is', null)
    .select('id, customer_email, reward_bfax, review_url, activity')
    .maybeSingle();

  if (claimError) {
    console.error('[review-missions approve claim]', claimError);
    return NextResponse.json({ error: '승인 처리에 실패했습니다.' }, { status: 500 });
  }
  if (!claimed) {
    return NextResponse.json(
      { error: '동시에 다른 처리가 반영되었습니다. 새로고침 후 다시 시도해 주세요.' },
      { status: 409 }
    );
  }

  const email = String(claimed.customer_email ?? '').trim();
  const delta = Number(claimed.reward_bfax);
  if (!email || !Number.isFinite(delta) || delta <= 0) {
    await db
      .from('lb_rewards_history')
      .update({ status: statusAsStored })
      .eq('id', id)
      .eq('status', REWARD_STATUS.APPROVED);
    return NextResponse.json({ error: '리워드 행 데이터가 올바르지 않습니다.' }, { status: 500 });
  }

  const { data: balanceRow, error: balanceReadError } = await fetchUserBalanceRow(db, email);
  if (balanceReadError) {
    await db
      .from('lb_rewards_history')
      .update({ status: statusAsStored })
      .eq('id', id)
      .eq('status', REWARD_STATUS.APPROVED);
    return NextResponse.json({ error: balanceReadError }, { status: 500 });
  }

  const current = readBfaxAmount(balanceRow);
  const next = current + delta;
  const upsertRow = buildBalanceUpsert(email, next, balanceRow?.account_status as string | undefined);

  const { error: upsertError } = await db.from('lb_user_balance').upsert(upsertRow, {
    onConflict: 'customer_email',
  });

  if (upsertError) {
    console.error('[review-missions approve balance]', upsertError);
    await db
      .from('lb_rewards_history')
      .update({ status: statusAsStored })
      .eq('id', id)
      .eq('status', REWARD_STATUS.APPROVED);
    return NextResponse.json({ error: 'BFAX 잔액 반영에 실패했습니다.' }, { status: 500 });
  }

  const ledger = await insertRechargeLedger(db, {
    customer_email: email,
    bfax_delta: delta,
    balance_after: next,
    status: 'REVIEW_MISSION',
    note: `Review mission approved (id ${id})`,
    admin_email: auth.userEmail,
  });

  if (!ledger.ok) {
    console.warn('[review-missions approve ledger]', ledger.error);
  }

  return NextResponse.json({
    ok: true,
    id,
    status: REWARD_STATUS.APPROVED,
    customer_email: email,
    bfaxGranted: delta,
    balanceAfter: next,
    ledgerWarning: ledger.error,
  });
}
