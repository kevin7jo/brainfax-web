import { createClient } from '@supabase/supabase-js';
import { isAdminUser } from './admin';

export type AdminAuthResult =
  | { ok: true; userEmail: string }
  | { ok: false; status: number; error: string };

export async function verifyAdminRequest(request: Request): Promise<AdminAuthResult> {
  const authHeader = request.headers.get('authorization');
  const token = authHeader?.replace(/^Bearer\s+/i, '');
  if (!token) {
    return { ok: false, status: 401, error: '로그인이 필요합니다.' };
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anon) {
    return { ok: false, status: 500, error: 'Supabase 환경 변수가 설정되지 않았습니다.' };
  }

  const supabase = createClient(url, anon);
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data.user) {
    return { ok: false, status: 401, error: '세션이 유효하지 않습니다.' };
  }
  if (!isAdminUser(data.user)) {
    return { ok: false, status: 403, error: '어드민 권한이 없습니다.' };
  }

  return { ok: true, userEmail: data.user.email ?? 'admin' };
}
