'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '../lib/supabaseClient';

export default function AuthRedirect() {
  const router = useRouter();

  useEffect(() => {
    let mounted = true;

    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      if (data?.session) {
        router.replace('/dashboard');
      }
    });

    return () => {
      mounted = false;
    };
  }, [router]);

  return null;
}
