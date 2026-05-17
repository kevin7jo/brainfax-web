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
        <section className="order-2 lg:order-1 flex w-full lg:flex lg:w-[55%] items-start border-r border-slate-800/60 bg-[#070707] p-6 lg:p-12">
          <div className="w-full space-y-8">
            {/* Section 1: Main value proposition */}
            <div className="rounded-2xl border border-slate-800/60 bg-[#060606] p-6">
              <h1 className="text-3xl lg:text-4xl leading-tight font-extrabold text-white">단돈 100원(10¢)으로 특급 개발자에게 프로그램을 이메일로 받아보세요.</h1>
              <p className="mt-3 max-w-3xl text-slate-400 text-base leading-7">별도 하드웨어 설치나 복잡한 SaaS 인프라 학습 없이, 네이버 스마트스토어 결제 또는 BFAX 토큰 소각 후 평소 쓰시던 회사 이메일 전달(Forward)만으로 즉시 AI 분석 및 개발 산출물이 회신됩니다.</p>
            </div>

            {/* Section 2: How it works - 3 steps */}
            <div>
              <h3 className="text-sm text-slate-400 uppercase tracking-[0.2em]">How It Works</h3>
              <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="rounded-xl border border-slate-800/50 bg-[#050505] p-4">
                  <div className="flex items-start gap-3">
                    <div className="text-neon text-2xl">📩</div>
                    <div>
                      <div className="text-sm font-semibold text-white">Step 1. 이메일 투찰</div>
                      <div className="text-xs text-slate-400 mt-1">Outlook/사내 메일에서 요구사항을 <span className="font-medium text-slate-200">help@localbrain.co.kr</span>로 포워딩 합니다.</div>
                    </div>
                  </div>
                </div>
                <div className="rounded-xl border border-slate-800/50 bg-[#050505] p-4">
                  <div className="flex items-start gap-3">
                    <div className="text-neon text-2xl">⚡</div>
                    <div>
                      <div className="text-sm font-semibold text-white">Step 2. 무인 n8n 파이프라인</div>
                      <div className="text-xs text-slate-400 mt-1">AI 마스터 에이전트 가동 및 BFAX Queue 실시간 차감/정산으로 무마찰 처리.</div>
                    </div>
                  </div>
                </div>
                <div className="rounded-xl border border-slate-800/50 bg-[#050505] p-4">
                  <div className="flex items-start gap-3">
                    <div className="text-neon text-2xl">📦</div>
                    <div>
                      <div className="text-sm font-semibold text-white">Step 3. S+++ 산출물 즉시 납품</div>
                      <div className="text-xs text-slate-400 mt-1">단 1분 만에 완전 구현 소스코드, 사양서, TDD 기반 테스트 케이스를 자동 회신합니다.</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Section 3: Live case show (pair cards) */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="rounded-lg border border-slate-800 bg-[#060606] p-4">
                <div className="text-xs text-slate-500 mb-2">INPUT: 고객 오더</div>
                <div className="bg-[#040404] p-3 rounded-md border border-slate-800/30 text-sm text-slate-200">
                  <div className="mb-2"><span className="text-slate-400">From:</span> dev-lead@company.com</div>
                  <div className="mb-2"><span className="text-slate-400">Request:</span> FastAPI 환경에서 S/4HANA급 무결성을 충족하는 비동기 DB CRUD API 서버 소스코드를 완벽하게 구현해 주십시오.</div>
                </div>
              </div>
              <div className="rounded-lg border-2 border-neon bg-[#03100f] p-4">
                <div className="text-xs text-neon mb-2">OUTPUT: BrainFax 회신 ⚡</div>
                <div className="bg-[#04100f] p-3 rounded-md text-sm text-slate-100">
                  <div className="mb-2"><span className="text-slate-400">From:</span> help@localbrain.co.kr</div>
                  <div className="mb-2 text-neon font-semibold">즉시 납품 완료</div>
                  <div className="pt-2 border-t border-neon/10 mt-2 text-sm leading-6">요청하신 비동기 아키텍처 전체 구현 소스코드, 프로그램 상세 사양서, TDD 기반 단위 테스트 케이스(3종 세트)를 자동 납품하였습니다.</div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="order-1 lg:order-2 flex w-full flex-1 items-center justify-center bg-[#050505] px-6 py-12 lg:w-[45%] lg:px-16">
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
