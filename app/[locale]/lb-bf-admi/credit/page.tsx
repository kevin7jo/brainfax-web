'use client';

import { useState } from 'react';
import UserLookupPanel from '../../../../components/admin/UserLookupPanel';
import LedgerTable from '../../../../components/admin/LedgerTable';

export default function AdminCreditPage() {
  const [refreshKey, setRefreshKey] = useState(0);

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-lg font-semibold text-slate-100">BFAX Credit Manager</h2>
        <p className="mt-1 text-sm text-zinc-500">
          이메일로 유저를 검색한 뒤 BFAX 토큰을 지급·회수합니다. 모든 조정은 ADMIN_ADJUST로 장부에 기록됩니다.
        </p>
      </div>
      <UserLookupPanel mode="credit" onLedgerRefresh={() => setRefreshKey((k) => k + 1)} />
      <LedgerTable
        title="최근 ADMIN_ADJUST · BFAX 조정 이력"
        statusFilter="ADMIN_ADJUST"
        refreshKey={refreshKey}
      />
    </div>
  );
}
