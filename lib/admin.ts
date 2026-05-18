import type { User } from '@supabase/supabase-js';

export type AdminSection = 'audit' | 'credit' | 'users' | 'refunds';

export type UserBalanceRow = {
  customer_email: string;
  bfax_amount?: number | null;
  bfax_queue?: number | null;
  account_status?: string | null;
  updated_at?: string | null;
};

export type RechargeLedgerRow = {
  id: string;
  customer_email: string;
  bfax_amount?: number | null;
  balance_after?: number | null;
  status: string;
  note?: string | null;
  admin_email?: string | null;
  created_at: string;
};

export function isAdminUser(user: User | null | undefined): boolean {
  return user?.user_metadata?.role === 'admin';
}

/** DB 실컬럼 bfax_queue 우선 (bfax_amount 별칭 폴백) */
export function readBfaxAmount(row: UserBalanceRow | null | undefined): number {
  if (!row) return 0;
  const raw = row.bfax_queue ?? row.bfax_amount ?? 0;
  const n = Number(raw);
  return Number.isFinite(n) ? n : 0;
}

export function normalizeAccountStatus(status?: string | null): 'ACTIVE' | 'BANNED' {
  return String(status || 'ACTIVE').toUpperCase() === 'BANNED' ? 'BANNED' : 'ACTIVE';
}

export const ADMIN_NAV: { id: AdminSection; href: string; label: string; sub: string }[] = [
  { id: 'audit', href: '/admin/audit', label: 'User BFAX Audit Logs', sub: '유저 히스토리 조회' },
  { id: 'credit', href: '/admin/credit', label: 'BFAX Credit Manager', sub: 'BFAX 잔액 조정/회수' },
  { id: 'users', href: '/admin/users', label: 'User Ban / Activate', sub: '유저 활성화/비활성화' },
  { id: 'refunds', href: '/admin/refunds', label: 'Refund & BFAX Ledger', sub: '환불 처리 및 이력' },
];
