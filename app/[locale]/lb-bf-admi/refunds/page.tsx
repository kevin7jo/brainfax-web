'use client';

import { useState } from 'react';
import RefundLookupPanel from '../../../../components/admin/RefundLookupPanel';
import LedgerTable from '../../../../components/admin/LedgerTable';

export default function AdminRefundsPage() {
  const [refreshKey, setRefreshKey] = useState(0);

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-lg font-semibold text-slate-100">Refund & BFAX Ledger</h2>
        <p className="mt-1 text-sm text-zinc-500">
          유저를 검색한 뒤 보유 BFAX 범위 내에서만 환불할 수 있습니다. 모든 환불은 REFUND로 장부에 기록됩니다.
        </p>
      </div>

      <RefundLookupPanel onLedgerRefresh={() => setRefreshKey((k) => k + 1)} />

      <LedgerTable title="REFUND 장부 이력" statusFilter="REFUND" refreshKey={refreshKey} />
    </div>
  );
}
