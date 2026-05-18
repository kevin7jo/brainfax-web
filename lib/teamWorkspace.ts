/** 워크스페이스 소유자 — 플랫폼 /admin 과 무관 */
export const WORKSPACE_OWNER_ROLE = 'Owner' as const;

/** 초대·변경 가능한 팀원 역할 (Admin 금지) */
export const TEAM_INVITE_ROLES = ['Manager', 'Developer', 'Viewer'] as const;

export type TeamInviteRole = (typeof TEAM_INVITE_ROLES)[number];
export type WorkspaceRole = typeof WORKSPACE_OWNER_ROLE | TeamInviteRole;

const LEGACY_ADMIN_ROLE = 'Admin';

export function isTeamInviteRole(value: string): value is TeamInviteRole {
  return (TEAM_INVITE_ROLES as readonly string[]).includes(value);
}

/** DB 레거시 Admin → Manager, 그 외 비정상 값은 Viewer */
export function normalizeTeamMemberRole(raw: string | null | undefined): TeamInviteRole {
  if (raw === LEGACY_ADMIN_ROLE) return 'Manager';
  if (isTeamInviteRole(raw ?? '')) return raw;
  return 'Viewer';
}

export function assertWorkspaceOwner(
  ownerEmail: string | null | undefined,
  sessionEmail: string | null | undefined
): asserts ownerEmail is string {
  if (!sessionEmail || !ownerEmail || ownerEmail !== sessionEmail) {
    throw new Error('워크스페이스 소유자만 이 작업을 수행할 수 있습니다.');
  }
}
