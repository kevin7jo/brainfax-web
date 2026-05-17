"use client"

import React from "react"
import { Sparkles, ShieldAlert, ArrowRight, CheckCircle2, Clock } from "lucide-react"
import { supabase } from "../../lib/supabaseClient"

export default function LoginPage() {
  const handleGoogleLogin = async () => {
    try {
      await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: `${window.location.origin}/dashboard`,
        },
      })
    } catch (error) {
      console.error("OAuth 인증 실패:", error)
    }
  }

  return (
    <div className="min-h-screen grid grid-cols-1 lg:grid-cols-[1.2fr_1fr] bg-[#050505] text-slate-200 antialiased selection:bg-[#10b981]/30">

      {/* 좌측 영역: 기존 localbrain.co.kr 2~4P 마스터 임베딩 스크린 */}
      <main className="flex flex-col justify-between p-6 sm:p-12 lg:p-16 bg-[#030303] border-r border-zinc-900 overflow-y-auto max-h-screen">

        {/* 상단: 브랜드 기치 */}
        <div className="space-y-2">
          <div className="inline-flex items-center gap-2 rounded-full px-3 py-1 text-[10px] uppercase font-semibold tracking-[0.25em] bg-[#07160f] text-[#10b981] border border-[#10b981]/20">
            <Sparkles className="w-3 h-3" /> The LocalBrain Universe
          </div>
          <h1 className="text-2xl sm:text-4xl font-extrabold tracking-tight bg-gradient-to-r from-slate-100 to-zinc-400 bg-clip-text text-transparent mt-2">
            BrainFax Console
          </h1>
          <p className="text-zinc-500 text-xs sm:text-sm font-mono mt-1">
            자율형 폴리글랏 마스터 에이전트 가동 시스템
          </p>
        </div>

        {/* 중단: localbrain.co.kr 2~4P 가치 제안 및 실전 Showcase */}
        <div className="my-8 space-y-6">

          {/* [100원의 기적 핵심 카드] */}
          <div className="rounded-2xl border border-zinc-800/80 bg-zinc-950 p-5 sm:p-6 shadow-xl relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-24 h-24 bg-[#10b981]/5 rounded-full blur-2xl transition-all group-hover:bg-[#10b981]/10" />
            <h2 className="text-lg sm:text-2xl font-bold text-slate-100 leading-snug">
              단돈 <span className="text-[#10b981] font-extrabold underline underline-offset-4 font-mono">100원(10¢)</span>으로 특급 개발자에게<br className="hidden sm:inline" />
              프로그램을 이메일로 받아보세요.
            </h2>
            <p className="text-zinc-400 text-xs sm:text-sm mt-3 leading-relaxed">
              별도의 하드웨어 설치나 복잡한 SaaS 인프라 학습 비용이 전혀 없습니다. 네이버 스마트스토어 결제 또는 BFAX 토큰 소각 후, 평소 사용하시던 회사 메일함에서 요구사항을 던지면 **S+++ 등급 산출물**이 즉시 납품됩니다.
            </p>
          </div>

          {/* [How It Works - 마찰력 제로 3스텝 가이드] */}
          <div className="space-y-3">
            <p className="text-zinc-500 text-xs font-bold uppercase tracking-widest pl-1">How It Works</p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="p-4 rounded-xl bg-[#090909] border border-zinc-900">
                <div className="text-[#10b981] font-mono text-sm font-bold">STEP 1</div>
                <div className="text-slate-200 font-semibold text-sm mt-1">이메일 투찰</div>
                <div className="text-zinc-500 text-xs mt-1 leading-normal">요구사항/에러 로그를 help@localbrain.co.kr로 포워딩</div>
              </div>
              <div className="p-4 rounded-xl bg-[#090909] border border-zinc-900">
                <div className="text-[#10b981] font-mono text-sm font-bold">STEP 2</div>
                <div className="text-slate-200 font-semibold text-sm mt-1">무인 n8n 엔진</div>
                <div className="text-zinc-500 text-xs mt-1 leading-normal">AI 에이전트 자율 분석 가동 및 BFAX Queue 자동 정산</div>
              </div>
              <div className="p-4 rounded-xl bg-[#090909] border border-zinc-900">
                <div className="text-[#10b981] font-mono text-sm font-bold">STEP 3</div>
                <div className="text-slate-200 font-semibold text-sm mt-1">산출물 즉시 회신</div>
                <div className="text-zinc-500 text-xs mt-1 leading-normal">완전 구현 소스코드와 상세 사양서가 메일함으로 자동 납품</div>
              </div>
            </div>
          </div>

          {/* [Live Case Showcase - 진짜 개발자가 경악할 실사례 페어] */}
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 pt-2">

            {/* INPUT 카드 */}
            <div className="rounded-xl border border-zinc-900 bg-zinc-950/60 p-4 font-mono text-xs shadow-inner">
              <div className="flex items-center justify-between border-b border-zinc-900 pb-2 text-zinc-500">
                <span>📬 INBOUND ORDER</span>
                <span className="text-[10px] bg-zinc-900 px-2 py-0.5 rounded">user@company.com</span>
              </div>
              <div className="mt-3 space-y-1.5 text-zinc-300">
                <p><span className="text-zinc-500">Subject:</span> FastAPI 비동기 DB 연동 API 개발 건</p>
                <p className="text-zinc-400 mt-2 bg-[#050505] p-2 rounded border border-zinc-900/50 leading-relaxed">
                  &quot;FastAPI 환경에서 비동기 DB 엔진과 연동하고 Pydantic v2 유효성 검증을 완벽하게 충족하는 엔터프라이즈급 CRUD API 서버 소스코드를 짜주십시오.&quot;
                </p>
              </div>
            </div>

            {/* OUTPUT 카드 */}
            <div className="rounded-xl border border-[#10b981]/30 bg-zinc-950/90 p-4 font-mono text-xs shadow-md shadow-[#10b981]/5 relative">
              <div className="absolute top-2 right-2 flex items-center gap-1 text-[10px] text-[#10b981] font-bold bg-[#07160f] px-2 py-0.5 rounded border border-[#10b981]/20">
                <Clock className="w-3 h-3 animate-pulse" /> 1 MIN REPLIER
              </div>
              <div className="flex items-center justify-between border-b border-zinc-900 pb-2 text-[#10b981] font-bold">
                <span>⚡ OUTBOUND DELIVERY</span>
              </div>
              <div className="mt-3 space-y-1.5 text-slate-200">
                <p><span className="text-zinc-500">From:</span> help@localbrain.co.kr</p>
                <div className="text-xs text-zinc-400 mt-2 bg-[#050505] p-2 rounded border border-zinc-900 leading-relaxed space-y-1">
                  <p className="text-[#10b981] font-bold">###FINAL_EMAIL###</p>
                  <p>1. Production-Grade 비동기 전체 소스코드</p>
                  <p>2. 메모리 최적화 튜닝 사양서 및 명세표</p>
                  <p>3. pytest 기반 TDD 단위 테스트 케이스 완비</p>
                </div>
              </div>
            </div>

          </div>
        </div>

        {/* 하단: SLA 고지 */}
        <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-4 mt-auto">
          <div className="flex items-start gap-2.5">
            <ShieldAlert className="w-4 sm:w-5 h-4 sm:h-5 text-amber-400 shrink-0 mt-0.5" />
            <p className="text-[11px] sm:text-xs leading-relaxed text-amber-200/80 font-medium">
              BrainFax 서비스는 <span className="text-amber-300 font-bold underline underline-offset-2">1시간 이내에 이메일 응답</span>을 목표로 최선을 다하고 있습니다. 서비스의 응답속도가 지연되지 않도록 관리하겠으나, 글로벌 트래픽 요청의 일시적인 폭증에 따라 다소 지연이 발생할 수 있음을 너른 마음으로 양해 부탁드립니다.
            </p>
          </div>
        </div>

      </main>

      {/* 우측 영역: 프리미엄 보안 로그인 포트 */}
      <aside className="flex flex-col justify-between p-8 sm:p-12 lg:p-16 bg-[#060606] relative">
        <div className="absolute inset-0 bg-[radial-gradient(#10b981_1px,transparent_1px)] [background-size:24px_24px] opacity-[0.02]" />

        <div className="hidden lg:block text-right text-xs text-zinc-600 font-mono">
          SECURE PORT // AREA_45
        </div>

        <div className="max-w-md w-full mx-auto my-auto space-y-6 z-10">
          <div className="space-y-2">
            <h3 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-100">
              Welcome to BrainFax Console
            </h3>
            <p className="text-xs sm:text-sm text-zinc-400 leading-normal">
              Sign in to manage your agent automation and Web3 billing. 최상의 보안과 실시간 무결성을 유지하는 자율형 지휘소 입구입니다.
            </p>
          </div>

          <button
            type="button"
            onClick={handleGoogleLogin}
            className="w-full inline-flex items-center justify-between gap-3 rounded-xl border border-zinc-800 bg-zinc-950 px-5 py-4 text-sm font-semibold text-slate-200 transition-all duration-200 hover:bg-zinc-900 hover:border-[#10b981]/50 active:scale-[0.98] group"
          >
            <div className="flex items-center gap-3">
              <svg className="w-5 h-5" viewBox="0 0 24 24" width="24" height="24" xmlns="http://www.w3.org/2000/svg">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l3.66-2.85z" fill="#FBBC05"/>
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.85c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
              </svg>
              <span>Sign in with Google Account</span>
            </div>
            <ArrowRight className="w-4 h-4 text-zinc-500 transition-transform group-hover:translate-x-1 group-hover:text-[#10b981]" />
          </button>

          <div className="flex items-center gap-2 text-[10px] text-zinc-500 font-mono bg-zinc-950 p-3 rounded-lg border border-zinc-900">
            <CheckCircle2 className="w-3.5 h-3.5 text-[#10b981]" />
            <span>최고 등급의 보안 프로토콜 및 세션 무결성 검증 통과</span>
          </div>
        </div>

        <footer className="text-center lg:text-left text-[10px] tracking-wider text-zinc-600 font-mono mt-8">
          VERSION 0.1.0 // © 2026 (주)로컬브레인. ALL RIGHTS RESERVED.
        </footer>
      </aside>

    </div>
  )
}
