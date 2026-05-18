'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '../lib/supabaseClient';

export default function Home() {
  const router = useRouter();

  useEffect(() => {
    let mounted = true;

    const routeBySession = async () => {
      const { data } = await supabase.auth.getSession();
      if (!mounted) return;
      router.replace(data.session ? '/dashboard' : '/login');
    };

    routeBySession();

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!mounted) return;
      router.replace(session ? '/dashboard' : '/login');
    });

    return () => {
      mounted = false;
      listener.subscription.unsubscribe();
    };
  }, [router]);

  return (
    <div className="min-h-screen bg-[#050505] flex items-center justify-center">
      <p className="text-sm font-mono text-zinc-500 animate-pulse">BrainFax — loading…</p>
    </div>
  );
}
