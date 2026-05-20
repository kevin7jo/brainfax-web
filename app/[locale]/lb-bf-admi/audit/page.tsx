'use client';

import LedgerTable from '../../../../components/admin/LedgerTable';

export default function AdminAuditPage() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-slate-100">User BFAX Audit Logs</h2>
        <p className="mt-1 text-sm text-zinc-500">
          유저별 BFAX 토큰 충전·조정·환불 장부 전체 이력 (lb_recharge_history)
        </p>
      </div>
      <LedgerTable title="BFAX Ledger — 전체 감사 로그" />
    </div>
  );
}
