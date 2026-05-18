import { supabase } from './supabaseClient';

export async function getAdminAuthHeaders(): Promise<HeadersInit> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error('로그인이 필요합니다.');
  return { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
}

export async function adminFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const headers = await getAdminAuthHeaders();
  const res = await fetch(path, { ...init, headers: { ...headers, ...init?.headers } });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(body.error || body.message || `요청 실패 (${res.status})`);
  }
  return body as T;
}
