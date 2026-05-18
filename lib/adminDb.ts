import type { SupabaseClient } from '@supabase/supabase-js';
import type { RechargeLedgerRow, UserBalanceRow } from './admin';
import { readBfaxAmount } from './admin';

/** 프로덕션 lb_user_balance 실제 컬럼 기준 조회 */
export async function fetchUserBalanceRow(
  db: SupabaseClient,
  email: string
): Promise<{ data: UserBalanceRow | null; error: string | null }> {
  const trimmed = email.trim();

  const { data, error } = await db
    .from('lb_user_balance')
    .select('customer_email, bfax_queue, bfax_amount, account_status')
    .eq('customer_email', trimmed)
    .maybeSingle();

  if (error) {
    if (error.message?.includes('bfax_amount') || error.message?.includes('account_status')) {
      const fallback = await db
        .from('lb_user_balance')
        .select('customer_email, bfax_queue')
        .eq('customer_email', trimmed)
        .maybeSingle();
      if (fallback.error) return { data: null, error: fallback.error.message };
      return { data: (fallback.data as UserBalanceRow) ?? null, error: null };
    }
    return { data: null, error: error.message };
  }

  return { data: (data as UserBalanceRow) ?? null, error: null };
}

export function buildBalanceUpsert(email: string, nextAmount: number, accountStatus?: string) {
  const row: Record<string, unknown> = {
    customer_email: email.trim(),
    bfax_queue: nextAmount,
  };
  if (accountStatus) row.account_status = accountStatus;
  return row;
}

export async function insertRechargeLedger(
  db: SupabaseClient,
  entry: {
    customer_email: string;
    bfax_delta: number;
    balance_after: number;
    status: string;
    note?: string;
    admin_email?: string;
  }
): Promise<{ ok: boolean; error: string | null }> {
  const payload = {
    customer_email: entry.customer_email,
    bfax_amount: entry.bfax_delta,
    balance_after: entry.balance_after,
    status: entry.status,
    note: entry.note ?? null,
    admin_email: entry.admin_email ?? null,
    created_at: new Date().toISOString(),
  };

  const { error } = await db.from('lb_recharge_history').insert([payload]);
  if (error) return { ok: false, error: error.message };
  return { ok: true, error: null };
}

export async function fetchLedgerRows(
  db: SupabaseClient,
  statusFilter?: string | string[]
): Promise<{ rows: RechargeLedgerRow[]; error: string | null }> {
  let q = db
    .from('lb_recharge_history')
    .select('id, customer_email, bfax_amount, balance_after, status, note, admin_email, created_at')
    .order('created_at', { ascending: false })
    .limit(100);

  if (statusFilter) {
    q = Array.isArray(statusFilter) ? q.in('status', statusFilter) : q.eq('status', statusFilter);
  }

  const { data, error } = await q;
  if (error) {
    if (error.code === '42P01' || error.message?.includes('does not exist')) {
      return {
        rows: [],
        error: 'lb_recharge_history 테이블이 없습니다. Supabase SQL 마이그레이션을 실행하세요.',
      };
    }
    return { rows: [], error: error.message };
  }

  return { rows: (data as RechargeLedgerRow[]) ?? [], error: null };
}

export { readBfaxAmount };
