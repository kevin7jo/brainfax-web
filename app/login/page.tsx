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
        <section className="hidden lg:flex lg:w-[55%] items-start border-r border-slate-800/60 bg-[#070707] p-12">
          <div className="w-full space-y-8">
            <div className="space-y-4">
              <h1 className="text-4xl leading-tight font-extrabold text-white">단돈 100원(10¢)으로 특급 개발자에게 프로그램을 이메일로 받아보세요.</h1>
              <p className="max-w-3xl text-slate-400 text-lg leading-7">회원가입도, 프로그램 가동을 위한 복잡한 인프라 학습도 필요 없습니다. 평소 사용하시던 회사 메일함에서 요구사항을 던지면 1분 만에 S+++ 등급 산출물이 자동 납품됩니다.</p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-1 rounded-lg border border-slate-800 bg-[#060606] p-4">
                <div className="text-xs text-slate-500 mb-2">INPUT — 고객 요청</div>
                <div className="bg-[#040404] p-3 rounded-md border border-slate-800/30 text-sm text-slate-200">
                  <div className="mb-2"><span className="text-slate-400">From:</span> user@company.com</div>
                  <div className="mb-2"><span className="text-slate-400">Subject:</span> SAP 인프라 비동기 CRUD 연동 건 #LocalBrain</div>
                  <div className="pt-2 border-t border-slate-800/20 mt-2 text-sm leading-6">"FastAPI 환경에서 비동기 DB 엔진과 연동하고, Pydantic 모델 유효성 검증을 수행하는 엔터프라이즈급 CRUD API 서버 소스코드를 완벽하게 짜주십시오."</div>
                </div>
              </div>
              <div className="col-span-1 rounded-lg border-2 border-neon bg-[#03100f] p-4">
                <div className="text-xs text-neon mb-2">OUTPUT — BrainFax 실시간 납품 ⚡</div>
                <div className="bg-[#04100f] p-3 rounded-md text-sm text-slate-100">
                  <div className="mb-2"><span className="text-slate-400">From:</span> help@localbrain.co.kr</div>
                  <div className="mb-2 text-neon font-semibold">단 1분 만에 자동 회신 완료!</div>
                  <div className="pt-2 border-t border-neon/10 mt-2 text-sm leading-6">
                    <strong>###FINAL_EMAIL###</strong>
                    <p className="mt-2">안녕하십니까, 로컬브레인 수석 아키텍트입니다. 요청하신 FastAPI 비동기 아키텍처에 대해 S/4HANA급 무결성을 충족하는 Production-Grade 전체 소스코드를 송부해 드립니다.</p>
                    <ul className="list-disc ml-5 mt-2 text-slate-200">
                      <li>프로그램 소스코드(완전 구현)</li>
                      <li>프로그램 사양서 및 메모리 최적화 튜닝 포인트 표</li>
                      <li>TDD 기반 단위 테스트 케이스 완비</li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>

            <div className="rounded-[1.25rem] border border-slate-800/90 bg-[#050505] p-6">
              <div className="inline-flex items-center gap-2 rounded-full bg-neon/5 px-3 py-1 text-xs uppercase tracking-[0.28em] text-neon">On-chain BFAX Economy</div>
              <p className="mt-3 text-slate-400 leading-7">이 모든 100원의 기적은 메인넷 스마트 컨트랙트 기반의 총발행량 10억 개 기축 통화 'BFAX 코인'의 실시간 영구 소각(Burn)과 무인 n8n 고속 충전 파이프라인의 연동으로 동작합니다. 유저가 BFAX 코인을 지불하면 온체인에서 영구 소각되고, 대시보드 큐로 즉시 충전되어 서비스를 지속합니다.</p>
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
