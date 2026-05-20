'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '../lib/supabaseClient';

async function provisionWelcomeBonus() {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) return;

  try {
    await fetch('/api/auth/welcome-bonus', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    });
  } catch (error) {
    console.warn('[DashboardAuthGate] welcome bonus', error);
  }
}

export default function DashboardAuthGate({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const welcomeRequested = useRef(false);

  useEffect(() => {
    let mounted = true;

    const ensureAuthed = async () => {
      const { data } = await supabase.auth.getSession();
      if (!mounted) return;
      if (!data.session) {
        router.replace('/login');
        return;
      }
      if (!welcomeRequested.current) {
        welcomeRequested.current = true;
        void provisionWelcomeBonus();
      }
      setReady(true);
    };

    void ensureAuthed();

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!mounted) return;
      if (!session) {
        welcomeRequested.current = false;
        setReady(false);
        router.replace('/login');
        return;
      }
      if (!welcomeRequested.current) {
        welcomeRequested.current = true;
        void provisionWelcomeBonus();
      }
      setReady(true);
    });

    return () => {
      mounted = false;
      listener.subscription.unsubscribe();
    };
  }, [router]);

  if (!ready) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <p className="text-sm font-mono text-zinc-500 animate-pulse">Authenticating…</p>
      </div>
    );
  }

  return <>{children}</>;
}
