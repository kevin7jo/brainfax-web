'use client';

import { useState } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { ShieldCheck, Sparkles, Cpu, ArrowRight } from 'lucide-react';

export default function LoginPage() {
  const [loading, setLoading] = useState(false);

  const handleGoogleSignIn = async () => {
    setLoading(true);
    const redirectTo = typeof window !== 'undefined' ? `${window.location.origin}/dashboard` : undefined;
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo },
    });
    if (error) {
      console.error('Google sign-in failed', error);
      alert('로그인에 실패했습니다. 다시 시도해 주세요.');
    }
    setLoading(false);
  };

  return (
    <main className="min-h-screen bg-[#050505] text-slate-100">
      <div className="mx-auto flex min-h-screen w-full max-w-[1760px] flex-col lg:flex-row">
        <section className="hidden lg:flex lg:w-[55%] items-center border-r border-slate-800/60 bg-[#070707] p-16">
          <div className="space-y-10">
            <div className="space-y-4">
              <span className="text-xs tracking-[0.35em] text-neon uppercase">THE LOCALBRAIN UNIVERSE</span>
              <h1 className="text-5xl leading-[1.03] font-extrabold text-white">BrainFax: 자율형 폴리글랏 마스터 에이전트 콘솔</h1>
              <p className="max-w-2xl text-slate-400 text-base leading-7">Deep Dark Mode의 웅장한 토크노믹스 관제 스크린입니다. 온체인 기반 BFAX Economy와 AI 자동화가 결합된 최첨단 대시보드를 경험해 보세요.</p>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="rounded-3xl border border-slate-800/80 bg-[#080808] p-6 shadow-[0_0_40px_rgba(16,185,129,0.08)]">
                <div className="flex items-center gap-3 text-neon mb-4">
                  <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white/5"><Sparkles className="h-5 w-5" /></span>
                  <div>
                    <p className="text-sm uppercase tracking-[0.24em] text-slate-400">25년 숙련 지능</p>
                  </div>
                </div>
                <p className="text-slate-200 leading-6">실시간 인프라 및 소스코드 분석부터 SAP BC 업무 자동화까지 완벽 수행합니다.</p>
              </div>
              <div className="rounded-3xl border border-slate-800/80 bg-[#080808] p-6 shadow-[0_0_40px_rgba(16,185,129,0.08)]">
                <div className="flex items-center gap-3 text-neon mb-4">
                  <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white/5"><ShieldCheck className="h-5 w-5" /></span>
                  <div>
                    <p className="text-sm uppercase tracking-[0.24em] text-slate-400">이메일 기반 팩토리</p>
                  </div>
                </div>
                <p className="text-slate-200 leading-6">경비 처리 없이 이메일 포워딩만으로 산출물이 즉시 자동 납품됩니다.</p>
              </div>
            </div>

            <div className="rounded-[2rem] border border-slate-800/90 bg-[#050505] p-8 shadow-[0_0_80px_rgba(0,0,0,0.35)]">
              <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-neon/20 bg-neon/5 px-4 py-2 text-xs uppercase tracking-[0.28em] text-neon">On-chain BFAX Economy</div>
              <h2 className="text-2xl font-semibold text-white">폴리글랏 메인넷 스마트 컨트랙트</h2>
              <p className="mt-4 text-slate-400 leading-7">총발행량 10억 개 기축 통화. 유저가 BFAX 코인을 지불하면 온체인에서 실시간 영구 소각(Burn)되며, 무인 n8n 고속 충전 파이프라인을 통해 대시보드 큐(BFAX Queue)로 0.1초 만에 마법처럼 치환됩니다.</p>
              <div className="mt-6 flex items-center gap-3 text-sm text-slate-400">
                <Cpu className="h-4 w-4 text-neon" />
                <span>영구 소각 + 실시간 큐 반영</span>
              </div>
            </div>
          </div>
        </section>

        <section className="flex w-full flex-1 items-center justify-center bg-[#050505] px-6 py-12 lg:w-[45%] lg:px-16">
          <div className="w-full max-w-md rounded-[2rem] border border-slate-800/80 bg-[#090909] p-8 shadow-[0_0_50px_rgba(0,0,0,0.45)] backdrop-blur-xl">
            <div className="space-y-4 text-center">
              <p className="text-sm uppercase tracking-[0.4em] text-neon">Welcome to BrainFax Console</p>
              <h1 className="text-4xl font-black text-white">Sign in to manage your agent automation and Web3 billing</h1>
              <p className="text-sm leading-6 text-slate-400">최상의 보안과 무결성을 유지하는 로그인 포트입니다. BFAX 토큰노믹스와 자동화 콘솔을 지금 연결하세요.</p>
            </div>

            <div className="mt-8 space-y-4">
              <button
                onClick={handleGoogleSignIn}
                disabled={loading}
                className="inline-flex w-full items-center justify-center gap-3 rounded-2xl border border-slate-800 bg-[#0d0d0d] px-5 py-4 text-base font-semibold text-white transition hover:border-neon hover:bg-[#111111] disabled:cursor-not-allowed disabled:opacity-70"
              >
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-white">
                  <svg viewBox="0 0 533.5 544.3" className="h-4 w-4" xmlns="http://www.w3.org/2000/svg">
                    <path d="M533.5 278.4c0-17.8-1.6-35-4.9-51.6H272.1v97.7h146.9c-6.4 34.6-25.6 63.9-54.5 83.4v69.5h88.1c51.5-47.4 81. -117.2 81-198.9z" fill="#4285F4"/>
                    <path d="M272.1 544.3c73.4 0 135.1-24.2 180.1-65.7l-88.1-69.5c-24.5 16.4-55.7 26.1-92 26.1-70.8 0-130.9-47.9-152.4-112.3H29.7v70.5c45.2 89.9 138.5 150.9 242.4 150.9z" fill="#34A853"/>
                    <path d="M119.7 324.9c-11.6-34.6-11.6-71.9 0-106.5V147.9H29.7c-38.5 76.8-38.5 168.2 0 245l90-67.9z" fill="#FBBC05"/>
                    <path d="M272.1 107.7c39.5 0 75.2 13.6 103.3 40.4l77.4-77.4C405.5 24.1 344.4 0 272.1 0 168.2 0 74.9 61 29.7 147.9l90 70.5c21.5-64.4 81.6-112.3 152.4-112.3z" fill="#EA4335"/>
                  </svg>
                </span>
                {loading ? 'Connecting...' : 'Sign in with Google'}
              </button>

              <div className="rounded-2xl border border-slate-800/70 bg-[#070707] p-5 text-sm text-slate-400">
                <p className="font-medium text-slate-100">Login Security</p>
                <p className="mt-2">최고 수준의 보안 프로토콜과 무결성 검증으로 BrainFax 콘솔 접근을 안전하게 보호합니다.</p>
              </div>
            </div>

            <footer className="mt-10 border-t border-slate-800/70 pt-5 text-center text-xs uppercase tracking-[0.28em] text-slate-500">
              Version 0.1.0 | © 2026 (주)로컬브레인. All rights reserved.
            </footer>
          </div>
        </section>
      </div>
    </main>
  );
}
