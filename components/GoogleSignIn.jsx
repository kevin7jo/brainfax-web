'use client';
import React, { useState } from 'react';
import { supabase } from '../lib/supabaseClient';

export default function GoogleSignIn({ className = '' }) {
  const [loading, setLoading] = useState(false);

  const handleSignIn = async () => {
    setLoading(true);
    const redirectTo = typeof window !== 'undefined' ? `${window.location.origin}/dashboard` : undefined;
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo }
    });
    if (error) {
      console.error('Supabase OAuth error', error);
      alert('로그인 중 오류가 발생했습니다.');
    }
    setLoading(false);
  };

  return (
    <button
      onClick={handleSignIn}
      className={`inline-flex items-center gap-3 px-4 py-2 rounded-md bg-white text-slate-800 shadow hover:shadow-md transition ${className}`}
      aria-label="Sign in with Google"
      disabled={loading}
    >
      <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden>
        <path fill="#fbbc05" d="M43.6 20.5H42V20H24v8h11.3C34 32 29.9 35.5 24 35.5 15.8 35.5 9.5 29.2 9.5 21S15.8 6.5 24 6.5c4.3 0 7.9 1.6 10.7 4.2l6.1-6.1C37 1.9 30.9 0 24 0 10.7 0 0 10.7 0 24s10.7 24 24 24c12.9 0 23.4-9.4 23.4-23.4 0-1.6-.2-3.1-.8-4.6z"/>
      </svg>
      {loading ? '연결 중...' : 'Continue with Google'}
    </button>
  );
}
