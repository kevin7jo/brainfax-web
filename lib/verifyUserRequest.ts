import { createClient } from '@supabase/supabase-js';

export type UserAuthResult =
  | { ok: true; email: string; userId: string }
  | { ok: false; status: number; error: string };

export async function verifyUserRequest(request: Request): Promise<UserAuthResult> {
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
  if (error || !data.user?.email) {
    return { ok: false, status: 401, error: '세션이 유효하지 않습니다.' };
  }

  return { ok: true, email: data.user.email, userId: data.user.id };
}
