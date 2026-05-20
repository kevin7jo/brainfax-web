'use client';

import { useEffect, useState } from 'react';
import { useRouter } from '../../i18n/navigation';
import { supabase } from '../../lib/supabaseClient';
import { isAdminUser } from '../../lib/admin';

export default function AdminGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [allowed, setAllowed] = useState(false);

  useEffect(() => {
    let mounted = true;

    const enforce = async () => {
      const { data } = await supabase.auth.getUser();
      if (!mounted) return;

      if (!isAdminUser(data.user)) {
        router.replace('/');
        return;
      }

      setAllowed(true);
    };

    enforce();

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!isAdminUser(session?.user ?? null)) {
        router.replace('/');
        return;
      }
      if (mounted) setAllowed(true);
    });

    return () => {
      mounted = false;
      try {
        listener.subscription.unsubscribe();
      } catch {
        // ignore
      }
    };
  }, [router]);

  if (!allowed) {
    return (
      <AdminGuardLoading />
    );
  }

  return <>{children}</>;
}

function AdminGuardLoading() {
  return (
    <div className="min-h-screen bg-[#050505] flex items-center justify-center">
      <div className="text-sm font-mono text-zinc-500 animate-pulse">BFAX Admin — verifying role…</div>
    </div>
  );
}
