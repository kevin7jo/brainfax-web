'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

/** POL 충전은 /dashboard/billing 으로 통합됨 */
export default function RechargeRedirectPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/dashboard/billing');
  }, [router]);

  return (
    <div className="py-16 text-center text-slate-400 text-sm">
      Billing 페이지로 이동 중…
    </div>
  );
}
