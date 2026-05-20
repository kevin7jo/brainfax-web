import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * public.lb_rewards_history — DB 스키마 1:1
 * id, created_at, customer_email, activity, reward_bfax, status, review_url
 */
export type RewardsHistoryRow = {
  id: number;
  created_at: string;
  customer_email: string;
  activity: string;
  reward_bfax: number;
  status: string;
  review_url: string | null;
};

export const REWARDS_HISTORY_COLUMNS =
  'id, created_at, customer_email, activity, reward_bfax, status, review_url' as const;

export const REWARD_STATUS = {
  SUCCESS: 'Success',
  UNDER_REVIEW: 'Under Review',
  APPROVED: 'Approved',
  REJECTED: 'Rejected',
} as const;

export type RewardStatus = (typeof REWARD_STATUS)[keyof typeof REWARD_STATUS];

export type RewardsHistoryInsert = {
  customer_email: string;
  activity: string;
  reward_bfax: number;
  status?: string;
  review_url?: string | null;
};

export function parseRewardsHistoryRow(raw: Record<string, unknown>): RewardsHistoryRow | null {
  if (
    raw.id == null ||
    raw.created_at == null ||
    raw.customer_email == null ||
    raw.activity == null ||
    raw.reward_bfax == null ||
    raw.status == null
  ) {
    console.warn('[rewardsHistory] skip row — missing required fields', raw);
    return null;
  }

  return {
    id: Number(raw.id),
    created_at: String(raw.created_at),
    customer_email: String(raw.customer_email),
    activity: String(raw.activity),
    reward_bfax: Number(raw.reward_bfax),
    status: String(raw.status),
    review_url: raw.review_url != null ? String(raw.review_url) : null,
  };
}

export function parseRewardsHistoryRows(rows: unknown): RewardsHistoryRow[] {
  if (!Array.isArray(rows)) return [];
  return rows
    .map((row) => parseRewardsHistoryRow(row as Record<string, unknown>))
    .filter((row): row is RewardsHistoryRow => row !== null);
}

export async function insertRewardsHistoryRow(
  db: SupabaseClient,
  entry: RewardsHistoryInsert
): Promise<{ ok: boolean; error: string | null }> {
  const payload = {
    customer_email: entry.customer_email.trim(),
    activity: entry.activity.trim(),
    reward_bfax: entry.reward_bfax,
    status: entry.status ?? REWARD_STATUS.SUCCESS,
    review_url: entry.review_url ?? null,
  };

  const { error } = await db.from('lb_rewards_history').insert(payload);
  if (error) return { ok: false, error: error.message };
  return { ok: true, error: null };
}

export async function hasRewardsActivity(
  db: SupabaseClient,
  customerEmail: string,
  activity: string
): Promise<boolean> {
  const { data, error } = await db
    .from('lb_rewards_history')
    .select('id')
    .eq('customer_email', customerEmail.trim())
    .eq('activity', activity)
    .maybeSingle();

  if (error) {
    console.warn('[rewardsHistory] hasRewardsActivity', error);
    return false;
  }
  return Boolean(data);
}

/** 리뷰 미션: 검수 대기 중인 제출이 있는지 */
export async function hasPendingReviewMission(
  db: SupabaseClient,
  customerEmail: string
): Promise<boolean> {
  const { data, error } = await db
    .from('lb_rewards_history')
    .select('id')
    .eq('customer_email', customerEmail.trim())
    .eq('status', REWARD_STATUS.UNDER_REVIEW)
    .not('review_url', 'is', null)
    .limit(1)
    .maybeSingle();

  if (error) {
    console.warn('[rewardsHistory] hasPendingReviewMission', error);
    return false;
  }
  return Boolean(data);
}

export const REVIEW_MISSION_ACTIVITY = 'Review Mission';
export const REVIEW_MISSION_REWARD_BFAX = 50;
