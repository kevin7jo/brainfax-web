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

export const REVIEW_MISSION_ACTIVITY = 'Review Mission';
export const REVIEW_MISSION_REWARD_BFAX = 50;

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
  const reviewUrl = entry.review_url ?? null;
  const hasReviewUrl = reviewUrl != null && String(reviewUrl).trim() !== '';
  /** review_url 이 있으면 기본 Success 대신 검수 대기로 넣어 대기 큐에 잡히게 함 */
  const status =
    entry.status ??
    (hasReviewUrl ? REWARD_STATUS.UNDER_REVIEW : REWARD_STATUS.SUCCESS);

  const payload = {
    customer_email: entry.customer_email.trim(),
    activity: entry.activity.trim(),
    reward_bfax: entry.reward_bfax,
    status,
    review_url: reviewUrl,
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

/** SQL `lower(trim(activity)) = 'review mission'` 와 동일한 앱측 판별 */
export function matchesReviewMissionActivity(raw: string | null | undefined): boolean {
  return (raw ?? '').trim().toLowerCase() === 'review mission';
}

/** SQL `lower(trim(status)) = 'under review'` 와 동일 */
export function matchesUnderReviewStatus(raw: string | null | undefined): boolean {
  return (raw ?? '').trim().toLowerCase() === 'under review';
}

/**
 * DB·레거시 데이터에 흔한 변형 (공백·언더스코어·한글·대기/PENDING 등).
 * canonical 매칭이 안 될 때 어드민 큐에라도 잡히게 보조한다.
 */
export function matchesReviewMissionActivityLoose(raw: string | null | undefined): boolean {
  if (matchesReviewMissionActivity(raw)) return true;
  const s = (raw ?? '')
    .trim()
    .toLowerCase()
    .replace(/_/g, ' ');
  if (s === 'reviewmission') return true;
  if (s.includes('review') && s.includes('mission')) return true;
  if (s.includes('리뷰') && s.includes('미션')) return true;
  return false;
}

export function matchesUnderReviewStatusLoose(raw: string | null | undefined): boolean {
  if (matchesUnderReviewStatus(raw)) return true;
  const s = (raw ?? '').trim().toLowerCase();
  if (s === 'pending' || s === 'in review') return true;
  if (s.includes('under') && s.includes('review')) return true;
  if (s.includes('검수')) return true;
  return false;
}

/** review_url 이 있으면서 리뷰 미션으로 볼 만한 행 (활동명이 완전히 다를 때도 후보 표시용) */
export function isReviewMissionHeuristic(row: {
  activity: string;
  reward_bfax: number;
  review_url: string | null;
}): boolean {
  if (matchesReviewMissionActivityLoose(row.activity)) return true;
  const url = (row.review_url ?? '').trim();
  if (!url) return false;
  return row.reward_bfax === REVIEW_MISSION_REWARD_BFAX;
}

/** 리뷰 미션: 검수 대기 중인 제출이 있는지 */
export async function hasPendingReviewMission(
  db: SupabaseClient,
  customerEmail: string
): Promise<boolean> {
  const { data, error } = await db
    .from('lb_rewards_history')
    .select('id, activity, status, review_url, reward_bfax')
    .eq('customer_email', customerEmail.trim())
    .not('review_url', 'is', null)
    .order('created_at', { ascending: false })
    .limit(80);

  if (error) {
    console.warn('[rewardsHistory] hasPendingReviewMission', error);
    return false;
  }
  return (data ?? []).some(
    (row) =>
      isReviewMissionHeuristic({
        activity: String(row.activity ?? ''),
        reward_bfax: Number(row.reward_bfax ?? 0),
        review_url: row.review_url != null ? String(row.review_url) : null,
      }) && matchesUnderReviewStatusLoose(row.status as string)
  );
}

/** 어드민: 테이블 최신 행 샘플 (필터 없음 — 진단용) */
export async function fetchRewardsHistoryTableTail(
  db: SupabaseClient,
  limit = 20
): Promise<{ rows: Record<string, unknown>[]; error: string | null }> {
  const lim = Math.min(Math.max(limit, 1), 50);
  const { data, error } = await db
    .from('lb_rewards_history')
    .select('id, created_at, customer_email, activity, status, reward_bfax, review_url')
    .order('created_at', { ascending: false })
    .limit(lim);

  if (error) return { rows: [], error: error.message };
  return { rows: (data as Record<string, unknown>[]) ?? [], error: null };
}

/** 어드민: 검수 대기 중인 리뷰 미션 제출 목록
 *  1) PostgREST: activity/status 에 ilike 로 대소문자 무시 1차 필터 (lower(activity) 근사)
 *  2) review_url 이 있는 최근 행을 추가로 읽어 공백 등 변형 행을 보완
 *  3) 앱에서 isReviewMissionHeuristic + matchesUnderReviewStatusLoose 로 최종 일치 (레거시 문자열 대응)
 */
export async function fetchPendingReviewMissions(
  db: SupabaseClient
): Promise<{ rows: RewardsHistoryRow[]; error: string | null }> {
  const [tight, broad] = await Promise.all([
    db
      .from('lb_rewards_history')
      .select(REWARDS_HISTORY_COLUMNS)
      .ilike('activity', 'review mission')
      .ilike('status', 'under review')
      .not('review_url', 'is', null)
      .order('created_at', { ascending: false })
      .limit(250),
    db
      .from('lb_rewards_history')
      .select(REWARDS_HISTORY_COLUMNS)
      .not('review_url', 'is', null)
      .order('created_at', { ascending: false })
      .limit(800),
  ]);

  if (tight.error) console.warn('[rewardsHistory] fetchPending tight', tight.error);
  if (broad.error) console.warn('[rewardsHistory] fetchPending broad', broad.error);
  if (tight.error && broad.error) {
    return { rows: [], error: broad.error?.message ?? tight.error?.message ?? 'query failed' };
  }

  const seen = new Set<number>();
  const merged: Record<string, unknown>[] = [];
  for (const list of [tight.data, broad.data]) {
    if (!list) continue;
    for (const r of list) {
      const raw = r as Record<string, unknown>;
      const id = raw.id;
      if (id == null || seen.has(Number(id))) continue;
      seen.add(Number(id));
      merged.push(raw);
    }
  }
  merged.sort(
    (a, b) =>
      new Date(String(b.created_at)).getTime() - new Date(String(a.created_at)).getTime()
  );

  const parsed = parseRewardsHistoryRows(merged);
  const rows = parsed.filter(
    (r) =>
      isReviewMissionHeuristic(r) &&
      matchesUnderReviewStatusLoose(r.status) &&
      (r.review_url ?? '').trim() !== ''
  );
  return { rows, error: null };
}

/** 어드민: 리뷰 미션 제출 최근 이력 (상태 무관 — activity 만 Review Mission 계열)
 *  ilike 로 1차 수집 + 최신 전체 샘플 병합 후 isReviewMissionHeuristic 로 확정 (status 무관)
 */
export async function fetchRecentReviewMissionSubmissions(
  db: SupabaseClient,
  limit = 25
): Promise<{ rows: RewardsHistoryRow[]; error: string | null }> {
  const lim = Math.min(Math.max(limit, 1), 100);
  const [tight, broad] = await Promise.all([
    db
      .from('lb_rewards_history')
      .select(REWARDS_HISTORY_COLUMNS)
      .ilike('activity', 'review mission')
      .order('created_at', { ascending: false })
      .limit(150),
    db
      .from('lb_rewards_history')
      .select(REWARDS_HISTORY_COLUMNS)
      .order('created_at', { ascending: false })
      .limit(800),
  ]);

  if (tight.error) console.warn('[rewardsHistory] fetchRecent tight', tight.error);
  if (broad.error) console.warn('[rewardsHistory] fetchRecent broad', broad.error);
  if (tight.error && broad.error) {
    return { rows: [], error: broad.error?.message ?? tight.error?.message ?? 'query failed' };
  }

  const seen = new Set<number>();
  const merged: Record<string, unknown>[] = [];
  for (const list of [tight.data, broad.data]) {
    if (!list) continue;
    for (const r of list) {
      const raw = r as Record<string, unknown>;
      const id = raw.id;
      if (id == null || seen.has(Number(id))) continue;
      seen.add(Number(id));
      merged.push(raw);
    }
  }
  merged.sort(
    (a, b) =>
      new Date(String(b.created_at)).getTime() - new Date(String(a.created_at)).getTime()
  );

  const rows = parseRewardsHistoryRows(merged).filter((r) => isReviewMissionHeuristic(r)).slice(0, lim);
  return { rows, error: null };
}
