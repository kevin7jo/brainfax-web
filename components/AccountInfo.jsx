'use client';

import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import { useTranslations } from 'next-intl';
import { useRouter } from '../i18n/navigation';

export default function AccountInfo() {
  const [user, setUser] = useState(null);
  const router = useRouter();
  const t = useTranslations('accountInfo');

  useEffect(() => {
    let mounted = true;
    supabase.auth.getUser().then(({ data }) => {
      if (!mounted) return;
      if (data?.user) setUser(data.user);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) setUser(session.user);
      if (!session) setUser(null);
    });

    return () => {
      mounted = false;
      try {
        if (listener?.subscription?.unsubscribe) listener.subscription.unsubscribe();
      } catch (e) {}
    };
  }, []);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.push('/');
  };

  return (
    <div className="bg-card border border-gray-800/60 rounded-md p-3 text-slate-300">
      <div className="text-sm font-medium">{user?.user_metadata?.name || user?.email || t('guest')}</div>
      <div className="text-xs text-slate-500">{user?.email || t('notConnected')}</div>
      <div className="mt-3">
        <button onClick={handleSignOut} className="w-full text-sm py-2 rounded bg-transparent border border-gray-800 hover:bg-[#081010] transition text-neon">
          {t('signOut')}
        </button>
      </div>
    </div>
  );
}
