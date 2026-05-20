import { NextResponse } from 'next/server';
import {
  REWARDS_HISTORY_COLUMNS,
  parseRewardsHistoryRows,
} from '../../../../lib/rewardsHistory';
import { createServiceClient } from '../../../../lib/supabaseAdmin';
import { verifyUserRequest } from '../../../../lib/verifyUserRequest';

export async function GET(request: Request) {
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

  const { data, error } = await db
    .from('lb_rewards_history')
    .select(REWARDS_HISTORY_COLUMNS)
    .eq('customer_email', auth.email)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('[rewards/history]', error);
    return NextResponse.json({ error: '미션 기록을 불러오지 못했습니다.' }, { status: 500 });
  }

  return NextResponse.json({ history: parseRewardsHistoryRows(data) });
}
