import type { SupabaseClient } from '@supabase/supabase-js';
import { resolveWorkspaceCustomerEmails } from './workspaceCustomerEmails';

/**
 * lb_usage_history — DB 스키마와 1:1 매핑
 * id, customer_email, task_subject, burned_queue, status, created_at
 */
export type UsageHistoryRow = {
  id: number;
  customer_email: string;
  task_subject: string;
  burned_queue: number;
  status: string;
  created_at: string | null;
};

export function burnedQueueAmount(row: Pick<UsageHistoryRow, 'burned_queue'>): number {
  const n = Number(row.burned_queue);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

/** Supabase row → UI 타입 (스네이크 케이스 그대로) */
export function parseUsageHistoryRow(raw: Record<string, unknown>): UsageHistoryRow | null {
  if (raw.id == null || raw.customer_email == null) {
    console.warn('[usageHistory] skip row — missing id or customer_email', raw);
    return null;
  }
  const subject = raw.task_subject != null ? String(raw.task_subject) : '';
  return {
    id: Number(raw.id),
    customer_email: String(raw.customer_email),
    task_subject: subject,
    burned_queue: Number(raw.burned_queue ?? 0),
    status: String(raw.status ?? ''),
    created_at: raw.created_at != null ? String(raw.created_at) : null,
  };
}

export function parseUsageHistoryRows(rows: unknown): UsageHistoryRow[] {
  if (!Array.isArray(rows)) return [];
  return rows
    .map((row) => parseUsageHistoryRow(row as Record<string, unknown>))
    .filter((row): row is UsageHistoryRow => row !== null);
}

export type FetchUsageHistoryResult = {
  rows: UsageHistoryRow[];
  customerEmails: string[];
  error: string | null;
};

/** 워크스페이스 범위(본인·연동·팀) usage history 조회 */
export async function fetchWorkspaceUsageHistory(
  supabase: SupabaseClient,
  params: { sessionEmail: string; userId?: string | null }
): Promise<FetchUsageHistoryResult> {
  const customerEmails = await resolveWorkspaceCustomerEmails(supabase, params);

  if (customerEmails.length === 0) {
    return { rows: [], customerEmails: [], error: null };
  }

  const { data, error } = await supabase
    .from('lb_usage_history')
    .select('*')
    .in('customer_email', customerEmails)
    .order('created_at', { ascending: false });

  if (error) {
    return { rows: [], customerEmails, error: error.message };
  }

  return {
    rows: parseUsageHistoryRows(data),
    customerEmails,
    error: null,
  };
}
