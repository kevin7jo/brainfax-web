import { createClient, type SupabaseClient } from '@supabase/supabase-js';

/** 서버 전용 — SUPABASE_SERVICE_ROLE_KEY 필요 */
export function createServiceClient(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
