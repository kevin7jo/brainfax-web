import type { SupabaseClient } from '@supabase/supabase-js';

/** 이메일 대소문자 무시 중복 제거, DB 조회용 원문 보존 */
function collectEmail(store: Map<string, string>, email: string | null | undefined) {
  const trimmed = (email ?? '').trim();
  if (!trimmed) return;
  const key = trimmed.toLowerCase();
  if (!store.has(key)) store.set(key, trimmed);
}

/**
 * Task History / Usage 조회에 쓸 customer_email 목록:
 * - 로그인 계정
 * - lb_user_emails 연동(인증) 이메일
 * - 내가 소유한 워크스페이스 팀원(member_email)
 * - 내가 속한 팀의 소유자·동료 팀원
 */
export async function resolveWorkspaceCustomerEmails(
  supabase: SupabaseClient,
  params: { sessionEmail: string; userId?: string | null }
): Promise<string[]> {
  const store = new Map<string, string>();
  const sessionEmail = params.sessionEmail.trim();
  if (!sessionEmail) return [];

  collectEmail(store, sessionEmail);

  if (params.userId) {
    const { data: linked, error: linkedError } = await supabase
      .from('lb_user_emails')
      .select('email, is_verified')
      .eq('user_id', params.userId);

    if (linkedError) {
      console.warn('[workspaceEmails] lb_user_emails', linkedError);
    } else {
      for (const row of linked ?? []) {
        collectEmail(store, row.email);
      }
    }
  }

  const { data: ownedTeam, error: ownedError } = await supabase
    .from('lb_team_members')
    .select('member_email')
    .eq('owner_email', sessionEmail);

  if (ownedError) {
    console.warn('[workspaceEmails] owned team', ownedError);
  } else {
    for (const row of ownedTeam ?? []) {
      collectEmail(store, row.member_email);
    }
  }

  const { data: memberships, error: memberError } = await supabase
    .from('lb_team_members')
    .select('owner_email')
    .ilike('member_email', sessionEmail);

  if (memberError) {
    console.warn('[workspaceEmails] memberships', memberError);
  } else {
    const ownerEmails = [
      ...new Set(
        (memberships ?? [])
          .map((r) => r.owner_email)
          .filter((e): e is string => Boolean(e?.trim()))
      ),
    ];

    for (const owner of ownerEmails) {
      collectEmail(store, owner);
      const { data: siblings, error: siblingsError } = await supabase
        .from('lb_team_members')
        .select('member_email')
        .eq('owner_email', owner);

      if (siblingsError) {
        console.warn('[workspaceEmails] siblings for', owner, siblingsError);
        continue;
      }
      for (const row of siblings ?? []) {
        collectEmail(store, row.member_email);
      }
    }
  }

  return Array.from(store.values());
}
