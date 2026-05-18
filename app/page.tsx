'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import AboutBrainfaxContent from '../components/AboutBrainfaxContent';
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

  return <AboutBrainfaxContent computeHref={computeHref} showRedirectHint />;
}
