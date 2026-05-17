"use client"

import {
  Brain,
  Cpu,
  Inbox,
  Mail,
  Pencil,
  Send,
  Server,
  Shield,
  Workflow,
} from "lucide-react"

const HOW_STEPS = [
  {
    title: "구체적인 요구사항 작성",
    body: "이메일 본문에 제품 맥락을 적고, 귀사의 기존 산출물(테이블 정의서, 인터페이스 설계서 등)을 그대로 첨부하십시오. 계정·포털은 필요 없습니다.",
    icon: Pencil,
  },
  {
    title: "팩토리 엔진: 몇 분 이내, 수석 컨설턴트 수준 코드",
    body: "요구를 정규화한 뒤 몇 분 이내에 SRS·SDS(설계)와 수석 컨설턴트 품질의 최적화된 소스 시안을 동일 흐름에서 도출합니다.",
    icon: Workflow,
  },
  {
    title: "수석급 응답을 메일로 수신",
    body: "답장에서 산출물을 받아 내부 리뷰·반복에 바로 투입합니다. 민감 데이터는 온프레미스에만 머뭅니다.",
    icon: Inbox,
  },
] as const

const cardClass =
  "group rounded-xl border border-zinc-800/80 bg-zinc-950/50 p-4 transition-colors hover:border-[#10b981]/30"

function PlaceholderEmailToCode() {
  return (
    <div className="flex flex-col items-stretch gap-2 sm:flex-row sm:items-center sm:justify-center">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-[#10b981]/30 bg-[#07160f] text-[#10b981]">
        <Mail className="h-4 w-4" />
      </div>
      <Send className="hidden h-3 w-3 rotate-[-35deg] text-zinc-600 sm:block" />
      <div className="flex min-h-[3.5rem] flex-1 flex-col items-center justify-center gap-1 rounded-lg border border-zinc-800 bg-[#090909] px-2 py-1.5">
        <div className="flex items-center gap-1 text-[9px] font-mono text-zinc-500">
          <Cpu className="h-3 w-3 text-[#10b981]/70" />
          아키텍트 분석
        </div>
        <div className="h-0.5 w-full max-w-[4rem] rounded-full bg-gradient-to-r from-[#10b981]/30 via-[#10b981]/60 to-[#10b981]/30" />
      </div>
      <div className="flex h-14 flex-1 flex-col justify-center gap-0.5 rounded border border-zinc-800 bg-[#050505] p-1.5 font-mono text-[8px] leading-tight text-[#10b981]/80">
        <span className="text-zinc-600">// ABAP / Java</span>
        <span>REPORT z...</span>
        <span className="text-zinc-600">...</span>
      </div>
    </div>
  )
}

function PlaceholderEnterprise() {
  return (
    <div className="flex items-center justify-center gap-6 py-2">
      <div className="flex h-14 w-14 items-center justify-center rounded-xl border border-[#10b981]/35 bg-[#07160f] text-[#10b981] shadow-[0_0_24px_-6px_rgba(16,185,129,0.35)]">
        <Shield className="h-7 w-7" />
      </div>
      <div className="flex flex-col items-center gap-1">
        <div className="flex gap-0.5">
          <Server className="h-6 w-6 text-zinc-600" />
          <Server className="h-6 w-6 text-zinc-500" />
          <Server className="h-6 w-6 text-[#10b981]/50" />
        </div>
        <span className="text-[9px] font-mono text-zinc-600">온프레미스 랙</span>
      </div>
    </div>
  )
}

function PlaceholderSenior() {
  return (
    <div className="flex items-center justify-center gap-4 py-2">
      <div className="flex flex-col gap-1 rounded border border-zinc-800 bg-[#090909] p-2">
        <div className="h-1 w-10 rounded bg-zinc-800" />
        <div className="h-1 w-14 rounded bg-[#10b981]/30" />
        <div className="mt-1 flex gap-0.5">
          <div className="h-4 w-6 rounded border border-zinc-800 bg-[#050505]" />
          <div className="h-4 w-6 rounded border border-[#10b981]/20 bg-[#07160f]" />
        </div>
      </div>
      <div className="relative flex h-16 w-16 items-center justify-center rounded-xl border border-[#10b981]/25 bg-gradient-to-br from-zinc-900 to-[#050505]">
        <Cpu className="h-7 w-7 text-[#10b981]" />
        <span className="absolute bottom-1 text-[7px] font-mono text-[#10b981]/60">엔진</span>
      </div>
      <div className="hidden flex-col items-end gap-0.5 sm:flex">
        <Brain className="h-5 w-5 text-[#10b981]/40" />
        <span className="text-[8px] font-mono text-zinc-600">25년 커널</span>
      </div>
    </div>
  )
}

function PlaceholderOmniParse() {
  return (
    <div
      className="lb-omni-stage relative mx-auto flex h-32 w-full items-center justify-center"
      aria-hidden
    >
      <div className="pointer-events-none absolute inset-0 rounded-lg bg-[radial-gradient(ellipse_65%_80%_at_50%_50%,rgba(16,185,129,0.12),transparent_72%)]" />
      <div className="absolute left-2 top-2">
        <span className="lb-omni-chip lb-omni-chip-pdf lb-omni-in-pdf">PDF</span>
      </div>
      <div className="absolute right-2 top-2">
        <span className="lb-omni-chip lb-omni-chip-xls lb-omni-in-xls">XLS</span>
      </div>
      <div className="absolute bottom-2 left-3">
        <span className="lb-omni-chip lb-omni-chip-doc lb-omni-in-doc">DOC</span>
      </div>
      <div className="absolute bottom-2 right-3">
        <span className="lb-omni-chip lb-omni-chip-xml lb-omni-in-xml">XML</span>
      </div>
      <div className="relative z-[1] flex flex-col items-center gap-0.5">
        <div className="lb-omni-engine-core flex h-10 w-10 items-center justify-center rounded-xl border border-[#10b981]/40 bg-gradient-to-br from-zinc-900 to-[#050505] text-[#10b981]">
          <Server className="h-5 w-5" />
        </div>
        <span className="font-mono text-[8px] font-semibold uppercase tracking-wider text-[#10b981]/55">
          Parse Router
        </span>
      </div>
    </div>
  )
}

export function LoginHowItWorks() {
  return (
    <section>
      <p className="font-mono text-xs font-semibold uppercase tracking-[0.2em] text-[#10b981]/85">
        How it Works
      </p>
      <h2 className="mt-2 text-2xl sm:text-3xl font-bold tracking-tight text-slate-100">
        메일 한 통으로 켜지는 팩토리
      </h2>
      <ol className="mt-6 grid list-none gap-4 sm:grid-cols-3">
        {HOW_STEPS.map((s, i) => (
          <li
            key={s.title}
            className="relative flex flex-col rounded-2xl border border-zinc-800/80 bg-zinc-950/60 p-5 sm:p-6 transition-colors hover:border-[#10b981]/25"
          >
            <div className="mb-3 flex items-center justify-between">
              <span className="font-mono text-sm font-bold tabular-nums text-[#10b981]/80">
                {String(i + 1).padStart(2, "0")}
              </span>
              <div className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-[#10b981]/25 bg-[#07160f] text-[#10b981]">
                <s.icon className="h-5 w-5" strokeWidth={1.75} />
              </div>
            </div>
            <h3 className="text-sm font-semibold leading-snug text-slate-100">{s.title}</h3>
            <p className="mt-2 text-xs sm:text-sm leading-relaxed text-zinc-500">{s.body}</p>
          </li>
        ))}
      </ol>
    </section>
  )
}

export function LoginProductShowcase() {
  return (
    <section className="mt-10 border-t border-zinc-800/80 pt-8 pb-4">
      <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.2em] text-[#10b981]/85">
        Product Showcase
      </p>

      <div className="mt-4 space-y-3">
        <article className={cardClass}>
          <p className="font-mono text-[9px] font-semibold uppercase tracking-wider text-[#10b981]/75">
            Email-to-Code Factory
          </p>
          <h3 className="mt-1 text-sm font-semibold text-slate-100">
            요구사항에서 코드까지, 단 한 통의 메일로.
          </h3>
          <p className="mt-2 text-[11px] leading-relaxed text-zinc-500">
            비정형화된 이메일 요구사항을 AI 수석 아키텍트가 분석하여, 정밀한 소프트웨어 설계서(SRS)와
            최적화된 ABAP/Java 소스코드로 변환하여 즉시 회신합니다.
          </p>
          <div className="mt-3 rounded-lg border border-zinc-900 bg-[#050505] p-2">
            <PlaceholderEmailToCode />
          </div>
        </article>

        <article className={cardClass}>
          <p className="font-mono text-[9px] font-semibold uppercase tracking-wider text-[#10b981]/75">
            Enterprise Security
          </p>
          <h3 className="mt-1 text-sm font-semibold text-slate-100">
            데이터 유출 Zero, 폐쇄망 독립 구동.
          </h3>
          <p className="mt-2 text-[11px] leading-relaxed text-zinc-500">
            로컬브레인은 클라우드에 의존하지 않습니다. 고객사 사내망 내부(On-Premise)에 물리적으로
            설치되어, 기업의 핵심 자산인 소스코드가 단 1바이트도 외부로 유출되지 않음을 보증합니다.
          </p>
          <div className="mt-3 rounded-lg border border-zinc-900 bg-[#050505] p-2">
            <PlaceholderEnterprise />
          </div>
        </article>

        <article className={cardClass}>
          <p className="font-mono text-[9px] font-semibold uppercase tracking-wider text-[#10b981]/75">
            Senior Intelligence
          </p>
          <h3 className="mt-1 text-sm font-semibold text-slate-100">
            25년 차 아키텍트의 지능을 이식하다.
          </h3>
          <p className="mt-2 text-[11px] leading-relaxed text-zinc-500">
            단순한 생성형 AI가 아닙니다. 25년간 수많은 엔터프라이즈 프로젝트를 성공시킨 수석
            아키텍트의 설계 철학과 로직을 학습한 전용 엔진이 시니어 급의 코드 무결성을 보장합니다.
          </p>
          <div className="mt-3 rounded-lg border border-zinc-900 bg-[#050505] p-2">
            <PlaceholderSenior />
          </div>
        </article>

        <article className={`${cardClass} group`}>
          <p className="font-mono text-[9px] font-semibold uppercase tracking-wider text-[#10b981]/75">
            Omni-Format Parsing
          </p>
          <h3 className="mt-1 text-sm font-semibold text-slate-100">
            Omni-Format Parsing Engine (5대 엔터프라이즈 포맷 지원)
          </h3>
          <p className="mt-1 text-[11px] font-semibold text-[#10b981]/90">
            어떤 형태의 산출물이든, AI가 즉시 해독합니다.
          </p>
          <p className="mt-2 text-[11px] leading-relaxed text-zinc-500">
            PDF(인터페이스 설계서), Excel(테이블/데이터 딕셔너리), Word/RTF(업무 매뉴얼), XML(BAPI
            페이로드) 등 SI 현장에서 쓰이는 모든 문서를 로컬브레인의 전용 라우터가 실시간으로 추출하고
            최적화(CSV 경량화 등)하여 초거대 지능 모델의 뇌 속으로 직접 주입합니다.
          </p>
          <div className="mt-3 rounded-lg border border-zinc-900 bg-[#050505] p-2">
            <PlaceholderOmniParse />
          </div>
          <p className="mt-2 text-center font-mono text-[8px] text-zinc-600">
            호버 시 흡입·엔진 펄스 가속
          </p>
        </article>
      </div>
    </section>
  )
}
