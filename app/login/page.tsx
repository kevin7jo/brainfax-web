"use client"

import React, { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Sparkles, ShieldAlert, ArrowRight, Clock } from "lucide-react"
import { supabase } from "../../lib/supabaseClient"
import { SHOWCASE_CASES } from "./showcaseCases"
import CaseResponseMarkdown from "./CaseResponseMarkdown"
import { LoginHowItWorks, LoginProductShowcase } from "./LoginMarketingSections"

function GoogleIcon() {
  return (
    <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" aria-hidden>
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l3.66-2.85z" fill="#FBBC05" />
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.85c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
    </svg>
  )
}

export default function LoginPage() {
  const router = useRouter()
  const [activeCaseId, setActiveCaseId] = useState(SHOWCASE_CASES[0].id)
  const activeCase = SHOWCASE_CASES.find((c) => c.id === activeCaseId) ?? SHOWCASE_CASES[0]

  useEffect(() => {
    let mounted = true

    supabase.auth.getSession().then(({ data }) => {
      if (mounted && data.session) router.replace("/dashboard")
    })

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session) router.replace("/dashboard")
    })

    return () => {
      mounted = false
      listener.subscription.unsubscribe()
    }
  }, [router])

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
    <div className="min-h-screen bg-[#050505] flex flex-col text-slate-200 antialiased selection:bg-[#10b981]/30">
      {/* 글로벌 헤더 */}
      <header className="sticky top-0 z-50 border-b border-zinc-900/80 bg-[#050505]/90 backdrop-blur-md">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center gap-4">
          <div className="min-w-0">
            <div className="inline-flex items-center gap-2 rounded-full px-3 py-1 text-[10px] uppercase font-semibold tracking-[0.25em] bg-[#07160f] text-[#10b981] border border-[#10b981]/20">
              <Sparkles className="w-3 h-3 shrink-0" />
              <span className="truncate">The LocalBrain Universe</span>
            </div>
            <h1 className="mt-2 text-lg sm:text-xl font-extrabold tracking-tight bg-gradient-to-r from-slate-100 to-zinc-400 bg-clip-text text-transparent">
              BrainFax Console
            </h1>
          </div>

          <button
            type="button"
            onClick={handleGoogleLogin}
            className="shrink-0 inline-flex items-center gap-2 rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2.5 sm:px-4 sm:py-3 text-xs sm:text-sm font-semibold text-slate-200 transition-all duration-200 hover:bg-zinc-900 hover:border-[#10b981]/50 active:scale-[0.98] group"
          >
            <GoogleIcon />
            <span className="hidden sm:inline">Sign in with Google</span>
            <span className="sm:hidden">Sign in</span>
            <ArrowRight className="w-3.5 h-3.5 text-zinc-500 transition-transform group-hover:translate-x-0.5 group-hover:text-[#10b981] hidden sm:block" />
          </button>
        </div>
      </header>

      {/* 메인 바디 */}
      <main className="flex-1 w-full max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-14 space-y-12 sm:space-y-16">
        {/* 1) 100원의 기적 */}
        <section>
          <div className="rounded-2xl border border-zinc-800/80 bg-zinc-950 p-6 sm:p-10 shadow-xl relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-32 h-32 bg-[#10b981]/5 rounded-full blur-3xl transition-all group-hover:bg-[#10b981]/10" />
            <h2 className="relative text-2xl sm:text-3xl lg:text-4xl font-bold text-slate-100 leading-snug">
              단돈{" "}
              <span className="text-[#10b981] font-extrabold underline underline-offset-4 font-mono">
                100원(10¢)
              </span>
              으로 특급 개발자에게
              <br />
              프로그램을 이메일로 받아보세요.
            </h2>
            <p className="relative text-zinc-400 text-sm sm:text-base mt-4 leading-relaxed max-w-3xl">
              별도의 하드웨어 설치나 복잡한 SaaS 인프라 학습 비용이 전혀 없습니다. 네이버 스마트스토어 결제 또는
              BFAX 토큰 소각 후, 평소 사용하시던 회사 메일함에서 요구사항을 던지면{" "}
              <strong className="text-slate-300">S+++ 등급 산출물</strong>이 즉시 납품됩니다.
            </p>
          </div>
        </section>

        {/* 2) How It Works */}
        <section>
          <LoginHowItWorks />
        </section>

        {/* 3) Product Showcase */}
        <section>
          <LoginProductShowcase />
        </section>

        {/* 4) Live Case Showcase */}
        <section className="space-y-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="font-mono text-xs font-semibold uppercase tracking-[0.2em] text-[#10b981]/85">
                Live Tech Showcase
              </p>
              <h2 className="mt-2 text-2xl sm:text-3xl font-bold tracking-tight text-slate-100">
                실전 기술 쇼케이스
              </h2>
            </div>
            <div className="flex gap-1.5 overflow-x-auto pb-0.5">
              {SHOWCASE_CASES.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setActiveCaseId(c.id)}
                  className={`shrink-0 rounded-lg px-3 py-1.5 text-[11px] font-mono font-bold transition-all ${
                    activeCaseId === c.id
                      ? "bg-[#07160f] text-[#10b981] border border-[#10b981]/40"
                      : "bg-zinc-900 text-zinc-500 border border-zinc-800 hover:text-zinc-300"
                  }`}
                >
                  {c.label}
                </button>
              ))}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[10px] font-mono uppercase tracking-wider text-[#10b981] bg-[#07160f] border border-[#10b981]/20 px-2 py-0.5 rounded">
              {activeCase.badge}
            </span>
            <span className="text-[10px] text-zinc-500 font-mono">{activeCase.stack}</span>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-start">
            <div className="rounded-xl border border-zinc-900 bg-zinc-950/60 p-4 sm:p-5 font-mono text-xs shadow-inner">
              <div className="flex items-center justify-between border-b border-zinc-900 pb-2 text-zinc-500">
                <span>📬 INBOUND ORDER</span>
                <span className="text-[10px] bg-zinc-900 px-2 py-0.5 rounded">user@company.com</span>
              </div>
              <div className="mt-3 space-y-1.5 text-zinc-300">
                <p>
                  <span className="text-zinc-500">Subject:</span> {activeCase.badge}
                </p>
                <p className="text-zinc-400 mt-2 bg-[#050505] p-3 rounded-lg border border-zinc-900/50 leading-relaxed text-[11px] sm:text-xs">
                  &quot;{activeCase.request}&quot;
                </p>
              </div>
            </div>

            <div className="rounded-xl border border-[#10b981]/30 bg-zinc-950/90 p-4 sm:p-5 font-mono text-xs shadow-md shadow-[#10b981]/5 relative min-h-[280px]">
              <div className="absolute top-3 right-3 z-10 flex items-center gap-1 text-[10px] text-[#10b981] font-bold bg-[#07160f] px-2 py-0.5 rounded border border-[#10b981]/20">
                <Clock className="w-3 h-3 animate-pulse" /> 1 MIN REPLIER
              </div>
              <div className="flex items-center justify-between border-b border-zinc-900 pb-2 text-[#10b981] font-bold pr-24">
                <span>⚡ OUTBOUND DELIVERY</span>
                <span className="text-[10px] text-zinc-500 font-normal">## Response</span>
              </div>
              <div className="mt-3 text-slate-200">
                <p className="mb-2">
                  <span className="text-zinc-500">From:</span> help@localbrain.co.kr
                </p>
                <CaseResponseMarkdown key={activeCase.caseFile} caseFile={activeCase.caseFile} />
              </div>
            </div>
          </div>
        </section>

        {/* 5) SLA */}
        <section>
          <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-5 sm:p-6">
            <div className="flex items-start gap-3">
              <ShieldAlert className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
              <p className="text-sm leading-relaxed text-amber-200/80 font-medium">
                BrainFax 서비스는{" "}
                <span className="text-amber-300 font-bold underline underline-offset-2">
                  1시간 이내에 이메일 응답
                </span>
                을 목표로 최선을 다하고 있습니다. 서비스의 응답속도가 지연되지 않도록 관리하겠으나, 글로벌
                트래픽 요청의 일시적인 폭증에 따라 다소 지연이 발생할 수 있음을 너른 마음으로 양해
                부탁드립니다.
              </p>
            </div>
          </div>
        </section>
      </main>

      {/* 풋터 */}
      <footer className="border-t border-zinc-900/80 py-6 text-center text-[10px] tracking-wider text-zinc-600 font-mono">
        Version 0.1.0 | © 2026 (주)로컬브레인. All rights reserved.
      </footer>
    </div>
  )
}
