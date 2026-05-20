'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Trash2, Mail, UserPlus } from 'lucide-react';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { supabase } from '../../../../lib/supabaseClient';
import {
  TEAM_INVITE_ROLES,
  WORKSPACE_OWNER_ROLE,
  normalizeTeamMemberRole,
  type TeamInviteRole,
  type WorkspaceRole,
} from '../../../../lib/teamWorkspace';

type TeamMemberRow = {
  id: string;
  email: string;
  role: TeamInviteRole;
  bfaxUsed: number;
  status: 'Active' | 'Pending';
};

type OwnerRow = {
  id: 'owner';
  email: string;
  role: typeof WORKSPACE_OWNER_ROLE;
  bfaxUsed: number;
  status: 'Active';
  isYou: true;
};

type DbTeamMemberRow = {
  id: string | number;
  member_email: string;
  role: string | null;
  bfax_used: number | null;
  status: string | null;
  owner_email?: string;
};

const MAX_TEAM_SIZE = 10;

const ROLE_BADGE: Record<WorkspaceRole, string> = {
  Owner: 'bg-[#07160f] text-[#10b981] border border-[#10b981]/30',
  Manager: 'bg-violet-950/80 text-violet-300 border border-violet-500/25',
  Developer: 'bg-zinc-800 text-zinc-200 border border-zinc-700/80',
  Viewer: 'bg-zinc-900 text-zinc-400 border border-zinc-800',
};

function mapDbMember(row: DbTeamMemberRow): TeamMemberRow {
  return {
    id: String(row.id),
    email: row.member_email,
    role: normalizeTeamMemberRole(row.role),
    bfaxUsed: Number(row.bfax_used ?? 0),
    status: row.status === 'Pending' ? 'Pending' : 'Active',
  };
}

function RoleBadge({ role, label }: { role: WorkspaceRole; label: string }) {
  return (
    <span className={`inline-block px-2 py-1 rounded-md text-xs font-medium ${ROLE_BADGE[role]}`}>
      {label}
    </span>
  );
}

export default function TeamPage() {
  const t = useTranslations('teamWorkspace');

  const [members, setMembers] = useState<TeamMemberRow[]>([]);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<TeamInviteRole>('Viewer');
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [actionBusyId, setActionBusyId] = useState<string | null>(null);

  const masterUsage = 0;

  const roleLabel = useCallback(
    (role: WorkspaceRole) => t(`roles.${role}` as 'roles.Owner'),
    [t]
  );

  const ownerRow: OwnerRow | null = useMemo(() => {
    if (!userEmail) return null;
    return {
      id: 'owner',
      email: userEmail,
      role: WORKSPACE_OWNER_ROLE,
      bfaxUsed: masterUsage,
      status: 'Active',
      isYou: true,
    };
  }, [userEmail]);

  const totalMembers = (ownerRow ? 1 : 0) + members.length;
  const sharedUsage =
    (ownerRow?.bfaxUsed ?? 0) + members.reduce((sum, member) => sum + member.bfaxUsed, 0);

  const fetchMembers = useCallback(
    async (ownerEmail: string) => {
      const { data, error } = await supabase
        .from('lb_team_members')
        .select('id, member_email, role, bfax_used, status')
        .eq('owner_email', ownerEmail)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Failed to load team members:', error);
        setErrorMessage(t('errors.loadFailed'));
        setMembers([]);
      } else {
        setErrorMessage(null);
        setMembers((data as DbTeamMemberRow[] | null)?.map(mapDbMember) ?? []);
      }
      setLoading(false);
    },
    [t]
  );

  useEffect(() => {
    let cancelled = false;
    let teamChannel: RealtimeChannel | null = null;

    const detachRealtime = () => {
      if (teamChannel) {
        void supabase.removeChannel(teamChannel);
        teamChannel = null;
      }
    };

    const attachRealtime = (ownerEmail: string) => {
      detachRealtime();
      const topic = `team-members:${ownerEmail}:${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
      teamChannel = supabase.channel(topic);
      teamChannel.on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'lb_team_members',
          filter: `owner_email=eq.${ownerEmail}`,
        },
        (payload) => {
          if (!payload.new && !payload.old) return;

          setMembers((current) => {
            if (payload.eventType === 'INSERT' && payload.new) {
              const row = payload.new as DbTeamMemberRow;
              if (current.some((m) => m.id === String(row.id))) return current;
              return [mapDbMember(row), ...current];
            }

            if (payload.eventType === 'UPDATE' && payload.new) {
              const row = payload.new as DbTeamMemberRow;
              return current.map((member) =>
                member.id === String(row.id) ? mapDbMember(row) : member
              );
            }

            if (payload.eventType === 'DELETE' && payload.old) {
              const row = payload.old as DbTeamMemberRow;
              return current.filter((member) => member.id !== String(row.id));
            }

            return current;
          });
        }
      );
      teamChannel.subscribe();
    };

    let currentOwnerEmail: string | null = null;

    const syncForOwner = async (ownerEmail: string | null) => {
      setUserEmail(ownerEmail);
      if (!ownerEmail) {
        detachRealtime();
        setMembers([]);
        setLoading(false);
        return;
      }
      setLoading(true);
      await fetchMembers(ownerEmail);
      if (cancelled) return;
      attachRealtime(ownerEmail);
      if (!cancelled) setLoading(false);
    };

    void (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (cancelled) return;
      const ownerEmail = user?.email ?? null;
      if (ownerEmail === currentOwnerEmail) return;
      currentOwnerEmail = ownerEmail;
      await syncForOwner(ownerEmail);
    })();

    const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
      const ownerEmail = session?.user?.email ?? null;
      if (ownerEmail === currentOwnerEmail) return;
      currentOwnerEmail = ownerEmail;
      detachRealtime();
      void syncForOwner(ownerEmail);
    });

    return () => {
      cancelled = true;
      detachRealtime();
      authListener.subscription.unsubscribe();
    };
  }, [fetchMembers]);

  const ensureOwner = (): boolean => {
    if (!userEmail) {
      setErrorMessage(t('errors.notOwner'));
      return false;
    }
    return true;
  };

  const sendInvite = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!inviteEmail.trim() || !userEmail) return;

    const normalizedInvite = inviteEmail.trim().toLowerCase();
    if (normalizedInvite === userEmail.toLowerCase()) {
      setErrorMessage(t('errors.cannotInviteSelf'));
      return;
    }

    if (totalMembers >= MAX_TEAM_SIZE) {
      setErrorMessage(t('errors.maxTeamSize', { max: MAX_TEAM_SIZE }));
      return;
    }

    if (!ensureOwner()) return;

    const { error } = await supabase.from('lb_team_members').insert([
      {
        owner_email: userEmail,
        member_email: inviteEmail.trim(),
        role: inviteRole,
        bfax_used: 0,
        status: 'Pending',
      },
    ]);

    if (error) {
      console.error('Invite failed:', error);
      setErrorMessage(t('errors.inviteFailed'));
      return;
    }

    setInviteEmail('');
    setInviteRole('Viewer');
    setErrorMessage(null);
  };

  const removeMember = async (memberId: string) => {
    if (!userEmail) return;
    setActionBusyId(memberId);
    setErrorMessage(null);

    if (!ensureOwner()) {
      setActionBusyId(null);
      return;
    }

    try {
      const { error, count } = await supabase
        .from('lb_team_members')
        .delete({ count: 'exact' })
        .eq('id', memberId)
        .eq('owner_email', userEmail);

      if (error) throw error;
      if (count === 0) {
        setErrorMessage(t('errors.removeForbidden'));
        return;
      }

      setMembers((current) => current.filter((m) => m.id !== memberId));
    } catch (e) {
      console.error('Remove member failed:', e);
      setErrorMessage(t('errors.removeFailed'));
    } finally {
      setActionBusyId(null);
    }
  };

  const updateMemberRole = async (memberId: string, role: TeamInviteRole) => {
    if (!userEmail) return;
    setActionBusyId(memberId);
    setErrorMessage(null);

    if (!ensureOwner()) {
      setActionBusyId(null);
      return;
    }

    try {
      const { error, data } = await supabase
        .from('lb_team_members')
        .update({ role })
        .eq('id', memberId)
        .eq('owner_email', userEmail)
        .select('id, member_email, role, bfax_used, status')
        .maybeSingle();

      if (error) throw error;
      if (!data) {
        setErrorMessage(t('errors.roleChangeForbidden'));
        return;
      }

      const updated = mapDbMember(data as DbTeamMemberRow);
      setMembers((current) =>
        current.map((member) => (member.id === memberId ? updated : member))
      );
    } catch (e) {
      console.error('Update role failed:', e);
      setErrorMessage(t('errors.roleChangeFailed'));
    } finally {
      setActionBusyId(null);
    }
  };

  return (
    <div className="min-h-screen p-6 bg-[#050505] text-slate-200">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-2xl font-semibold mb-6">{t('title')}</h1>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          <div className="p-4 rounded-xl bg-zinc-900/90 border border-zinc-800 shadow-[0_0_24px_rgba(0,0,0,0.35)]">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-zinc-400">{t('stats.totalMembers')}</p>
                <p className="text-2xl font-bold mt-1 text-slate-100">
                  {loading ? t('stats.loading') : `${totalMembers}/${MAX_TEAM_SIZE}`}
                </p>
              </div>
              <UserPlus className="w-6 h-6 text-[#10b981]" aria-hidden />
            </div>
          </div>

          <div className="p-4 rounded-xl bg-zinc-900/90 border border-zinc-800 shadow-[0_0_24px_rgba(0,0,0,0.35)]">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-zinc-400">{t('stats.sharedUsage')}</p>
                <p className="text-2xl font-bold mt-1 text-[#10b981]">
                  {loading ? t('stats.loading') : t('stats.queueUnits', { amount: sharedUsage })}
                </p>
              </div>
              <div className="px-3 py-1 rounded-full bg-[#07160f] border border-[#10b981]/25 text-[#10b981] text-sm font-medium">
                #{sharedUsage}
              </div>
            </div>
          </div>
        </div>

        <div className="mb-6 p-4 rounded-xl bg-zinc-900/90 border border-zinc-800">
          <h2 className="text-lg font-medium mb-3 text-slate-100">{t('invite.title')}</h2>
          <form
            onSubmit={sendInvite}
            className="flex flex-col md:flex-row gap-3 items-start md:items-center"
          >
            <input
              aria-label={t('invite.emailAria')}
              placeholder={t('invite.emailPlaceholder')}
              type="email"
              value={inviteEmail}
              onChange={(event) => setInviteEmail(event.target.value)}
              className="flex-1 bg-[#070707] border border-zinc-800 rounded-lg px-3 py-2.5 text-sm placeholder:text-zinc-500 focus:border-[#10b981]/50 focus:outline-none focus:ring-1 focus:ring-[#10b981]/30"
            />
            <select
              value={inviteRole}
              onChange={(event) => setInviteRole(event.target.value as TeamInviteRole)}
              className="w-44 bg-[#070707] border border-zinc-800 rounded-lg px-3 py-2.5 text-sm focus:border-[#10b981]/50 focus:outline-none"
            >
              {TEAM_INVITE_ROLES.map((role) => (
                <option key={role} value={role}>
                  {roleLabel(role)}
                </option>
              ))}
            </select>
            <button
              type="submit"
              disabled={!inviteEmail.trim() || !userEmail || loading}
              className="inline-flex items-center gap-2 bg-[#10b981] text-black px-4 py-2.5 rounded-lg font-semibold hover:shadow-[0_0_20px_rgba(16,185,129,0.35)] disabled:opacity-60 disabled:cursor-not-allowed transition"
            >
              <Mail className="w-4 h-4" />
              {t('invite.sendInvite')}
            </button>
          </form>
          {errorMessage ? <p className="mt-3 text-sm text-rose-400">{errorMessage}</p> : null}
        </div>

        <div className="p-4 rounded-xl bg-zinc-900/90 border border-zinc-800">
          <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between mb-3">
            <h2 className="text-lg font-medium text-slate-100">{t('members.title')}</h2>
            {userEmail ? (
              <p className="text-xs uppercase tracking-[0.2em] text-zinc-500">
                {t('members.ownerLabel', { email: userEmail })}
              </p>
            ) : null}
          </div>

          {loading ? (
            <div className="rounded-lg border border-zinc-800 bg-[#080808] p-6 text-sm text-zinc-400 animate-pulse">
              {t('members.loading')}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full table-auto text-sm">
                <thead>
                  <tr className="text-zinc-400 text-left border-b border-zinc-800">
                    <th className="px-3 py-2 font-medium">{t('table.user')}</th>
                    <th className="px-3 py-2 font-medium">{t('table.role')}</th>
                    <th className="px-3 py-2 font-medium">{t('table.bfaxUsed')}</th>
                    <th className="px-3 py-2 font-medium">{t('table.status')}</th>
                    <th className="px-3 py-2 font-medium">{t('table.actions')}</th>
                  </tr>
                </thead>
                <tbody>
                  {ownerRow ? (
                    <tr className="border-t border-[#10b981]/15 bg-[#07160f]/40">
                      <td className="px-3 py-3">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-full bg-[#10b981]/15 border border-[#10b981]/30 flex items-center justify-center text-xs font-semibold text-[#10b981]">
                            {ownerRow.email.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <div className="font-medium text-slate-100">
                              {t('members.you')}{' '}
                              <span className="text-[#10b981] text-xs font-normal">
                                {t('members.ownerBadge')}
                              </span>
                            </div>
                            <div className="text-zinc-500 text-xs">{ownerRow.email}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-3 py-3">
                        <RoleBadge role={WORKSPACE_OWNER_ROLE} label={roleLabel(WORKSPACE_OWNER_ROLE)} />
                      </td>
                      <td className="px-3 py-3 text-zinc-300">
                        {t('members.queue', { amount: ownerRow.bfaxUsed })}
                      </td>
                      <td className="px-3 py-3">
                        <span className="inline-block px-2 py-1 rounded-full text-xs bg-emerald-900/80 text-emerald-300 border border-emerald-500/20">
                          {t('status.active')}
                        </span>
                      </td>
                      <td className="px-3 py-3 text-zinc-500">{t('actions.dash')}</td>
                    </tr>
                  ) : null}

                  {members.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-3 py-6 text-center text-sm text-zinc-500">
                        {t('members.empty')}
                      </td>
                    </tr>
                  ) : (
                    members.map((member) => (
                      <tr
                        key={member.id}
                        className="border-t border-zinc-800/80 hover:bg-[#080808]/80 transition"
                      >
                        <td className="px-3 py-3">
                          <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-full bg-zinc-800 flex items-center justify-center text-xs font-semibold">
                              {member.email.charAt(0).toUpperCase()}
                            </div>
                            <div className="font-medium text-slate-200">{member.email}</div>
                          </div>
                        </td>
                        <td className="px-3 py-3">
                          <RoleBadge role={member.role} label={roleLabel(member.role)} />
                        </td>
                        <td className="px-3 py-3 text-zinc-300">
                          {t('members.queue', { amount: member.bfaxUsed })}
                        </td>
                        <td className="px-3 py-3">
                          {member.status === 'Active' ? (
                            <span className="inline-block px-2 py-1 rounded-full text-xs bg-emerald-900/80 text-emerald-300 border border-emerald-500/20">
                              {t('status.active')}
                            </span>
                          ) : (
                            <span className="inline-block px-2 py-1 rounded-full text-xs bg-amber-900/80 text-amber-300 border border-amber-500/20">
                              {t('status.pending')}
                            </span>
                          )}
                        </td>
                        <td className="px-3 py-3">
                          <div className="flex flex-wrap items-center gap-2">
                            <select
                              aria-label={t('actions.changeRoleAria', { email: member.email })}
                              value={member.role}
                              disabled={actionBusyId === member.id || !userEmail}
                              onChange={(event) =>
                                void updateMemberRole(
                                  member.id,
                                  event.target.value as TeamInviteRole
                                )
                              }
                              className="bg-[#070707] border border-zinc-800 rounded-lg px-2 py-1.5 text-xs focus:border-[#10b981]/40 focus:outline-none disabled:opacity-50"
                            >
                              {TEAM_INVITE_ROLES.map((role) => (
                                <option key={role} value={role}>
                                  {roleLabel(role)}
                                </option>
                              ))}
                            </select>
                            <button
                              type="button"
                              title={t('actions.removeMember')}
                              disabled={actionBusyId === member.id || !userEmail}
                              className="p-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 border border-zinc-700/80 disabled:opacity-50 transition"
                              onClick={() => void removeMember(member.id)}
                            >
                              <Trash2 className="w-4 h-4 text-red-400" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
