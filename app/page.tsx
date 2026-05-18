'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import BurnProtocolBanner from '../components/BurnProtocolBanner';
import { supabase } from '../lib/supabaseClient';

const AUTO_REDIRECT_MS = 10_000;

export default function Home() {
  const router = useRouter();
  const [computeHref, setComputeHref] = useState('/login');

  useEffect(() => {
    let mounted = true;
    let redirectTimer: ReturnType<typeof setTimeout> | undefined;

    const scheduleRedirect = (href: string) => {
      redirectTimer = setTimeout(() => {
        if (mounted) router.replace(href);
      }, AUTO_REDIRECT_MS);
    };

    const init = async () => {
      const { data } = await supabase.auth.getSession();
      if (!mounted) return;
      const href = data.session ? '/dashboard' : '/login';
      setComputeHref(href);
      scheduleRedirect(href);
    };

    void init();

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!mounted) return;
      const href = session ? '/dashboard' : '/login';
      setComputeHref(href);
      if (redirectTimer) clearTimeout(redirectTimer);
      scheduleRedirect(href);
    });

    return () => {
      mounted = false;
      if (redirectTimer) clearTimeout(redirectTimer);
      listener.subscription.unsubscribe();
    };
  }, [router]);

  return (
    <div className="min-h-screen bg-[#050505] text-slate-200">
      <div className="border-b border-rose-500/10 bg-gradient-to-b from-[#0a0008] to-[#050505] pt-6 pb-2">
        <BurnProtocolBanner variant="landing" computeHref={computeHref} />
      </div>

      <main className="mx-auto max-w-6xl px-4 sm:px-6 py-16 sm:py-24 text-center">
        <p className="text-xs font-mono uppercase tracking-[0.35em] text-zinc-600">
          BrainFax · LocalBrain AI
        </p>
        <h1 className="mt-6 text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight text-slate-100">
          Enterprise AI Compute
          <span className="block mt-2 text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-cyan-400">
            Powered on Polygon
          </span>
        </h1>
        <p className="mt-6 max-w-2xl mx-auto text-slate-400 text-sm sm:text-base leading-relaxed">
          BFAX Queue fuels your private LocalBrain engine. Every BFAX Token payment is verified
          on-chain and routed to permanent burn — hyper-deflation by design.
        </p>
        <p className="mt-10 text-[11px] font-mono text-zinc-600 animate-pulse">
          Entering command deck in {AUTO_REDIRECT_MS / 1000}s…
        </p>
      </main>
    </div>
  );
}
