'use client';

import { useEffect, useState } from 'react';
import UserLookupPanel from '../../../../components/admin/UserLookupPanel';
import { adminFetch } from '../../../../lib/adminApiClient';
import {
  ADMIN_API_PATH,
  normalizeAccountStatus,
  readBfaxAmount,
  type UserBalanceRow,
} from '../../../../lib/admin';

export default function AdminUsersPage() {
  const [users, setUsers] = useState<UserBalanceRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [listError, setListError] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const result = await adminFetch<{ users: UserBalanceRow[] }>(`${ADMIN_API_PATH}/users`);
        setUsers(result.users);
        setListError(null);
      } catch (e) {
        setListError(e instanceof Error ? e.message : '목록 조회 실패');
        setUsers([]);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-lg font-semibold text-slate-100">User Ban / Activate</h2>
        <p className="mt-1 text-sm text-zinc-500">
          계정을 BANNED로 전환하거나 ACTIVE로 복구합니다. BFAX 잔액은 lb_user_balance.bfax_queue 기준입니다.
        </p>
      </div>

      <UserLookupPanel mode="users" onLedgerRefresh={() => window.location.reload()} />

      <div className="rounded-2xl border border-zinc-800/80 bg-zinc-950/40 overflow-hidden">
        <div className="border-b border-zinc-800/80 px-4 py-3 text-sm font-semibold text-slate-200">
          최근 유저 상태 (상위 50)
        </div>
        {listError ? (
          <div className="px-4 py-3 text-xs text-amber-200">{listError}</div>
        ) : null}
        <div className="overflow-x-auto">
          <table className="w-full min-w-[520px] text-sm">
            <thead>
              <tr className="border-b border-zinc-800/60 text-xs uppercase text-zinc-500">
                <th className="px-4 py-3 text-left">이메일</th>
                <th className="px-4 py-3 text-left">BFAX</th>
                <th className="px-4 py-3 text-left">상태</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={3} className="px-4 py-8 text-center text-zinc-500">
                    로딩 중…
                  </td>
                </tr>
              ) : users.length === 0 ? (
                <tr>
                  <td colSpan={3} className="px-4 py-8 text-center text-zinc-500">
                    등록된 유저가 없습니다.
                  </td>
                </tr>
              ) : (
                users.map((u) => {
                  const st = normalizeAccountStatus(u.account_status);
                  return (
                    <tr key={u.customer_email} className="border-b border-zinc-900/80">
                      <td className="px-4 py-3 text-slate-200">{u.customer_email}</td>
                      <td className="px-4 py-3 font-mono text-[#10b981]">
                        {readBfaxAmount(u).toLocaleString()} BFAX
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`rounded-full px-2 py-0.5 text-xs font-bold ${
                            st === 'BANNED' ? 'bg-red-500/20 text-red-400' : 'bg-[#07160f] text-[#10b981]'
                          }`}
                        >
                          {st}
                        </span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
