import type { User } from '@supabase/supabase-js';

/** 스텔스 어드민 콘솔 URL (구 /admin 사용 금지) */
export const ADMIN_CONSOLE_PATH = '/lb-bf-admi';
export const ADMIN_API_PATH = '/api/lb-bf-admi';

export type AdminSection =
  | 'audit'
  | 'credit'
  | 'support'
  | 'users'
  | 'refunds'
  | 'review-missions';

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
  { id: 'audit', href: `${ADMIN_CONSOLE_PATH}/audit`, label: 'User BFAX Audit Logs', sub: '유저 히스토리 조회' },
  { id: 'credit', href: `${ADMIN_CONSOLE_PATH}/credit`, label: 'BFAX Credit Manager', sub: 'BFAX 잔액 조정/회수' },
  {
    id: 'support',
    href: `${ADMIN_CONSOLE_PATH}/support`,
    label: 'Support Tickets',
    sub: '고객 문의 · 채팅형 스레드',
  },
  { id: 'users', href: `${ADMIN_CONSOLE_PATH}/users`, label: 'User Ban / Activate', sub: '유저 활성화/비활성화' },
  {
    id: 'review-missions',
    href: `${ADMIN_CONSOLE_PATH}/review-missions`,
    label: 'Review Mission Queue',
    sub: '리뷰 미션 승인·거절',
  },
  { id: 'refunds', href: `${ADMIN_CONSOLE_PATH}/refunds`, label: 'Refund & BFAX Ledger', sub: '환불 처리 및 이력' },
];
