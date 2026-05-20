import { NextResponse } from 'next/server';
import {
  REVIEW_MISSION_ACTIVITY,
  REVIEW_MISSION_REWARD_BFAX,
  REWARD_STATUS,
  hasPendingReviewMission,
  insertRewardsHistoryRow,
} from '../../../../lib/rewardsHistory';
import { createServiceClient } from '../../../../lib/supabaseAdmin';
import { verifyUserRequest } from '../../../../lib/verifyUserRequest';

type Body = { reviewUrl?: string };

function isValidHttpUrl(raw: string): boolean {
  try {
    const url = new URL(raw);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
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

  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return NextResponse.json({ error: '요청 본문이 올바르지 않습니다.' }, { status: 400 });
  }

  const reviewUrl = (body.reviewUrl ?? '').trim();
  if (!reviewUrl) {
    return NextResponse.json({ error: '리뷰 URL을 입력해 주세요.' }, { status: 400 });
  }
  if (!isValidHttpUrl(reviewUrl)) {
    return NextResponse.json({ error: 'http 또는 https URL만 제출할 수 있습니다.' }, { status: 400 });
  }

  if (await hasPendingReviewMission(db, auth.email)) {
    return NextResponse.json(
      { error: '검수 중인 리뷰 미션이 있습니다. 승인 또는 반려 후 다시 제출해 주세요.' },
      { status: 409 }
    );
  }

  const insert = await insertRewardsHistoryRow(db, {
    customer_email: auth.email,
    activity: REVIEW_MISSION_ACTIVITY,
    reward_bfax: REVIEW_MISSION_REWARD_BFAX,
    status: REWARD_STATUS.UNDER_REVIEW,
    review_url: reviewUrl,
  });

  if (!insert.ok) {
    console.error('[submit-review]', insert.error);
    return NextResponse.json({ error: '리뷰 제출 기록 저장에 실패했습니다.' }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    activity: REVIEW_MISSION_ACTIVITY,
    reward_bfax: REVIEW_MISSION_REWARD_BFAX,
    status: REWARD_STATUS.UNDER_REVIEW,
  });
}
