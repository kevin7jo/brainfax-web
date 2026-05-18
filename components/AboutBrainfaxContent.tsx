'use client';

import BurnProtocolBanner from './BurnProtocolBanner';

type AboutBrainfaxContentProps = {
  computeHref?: string;
  /** 대시보드·로그인 하단 등에 임베드 */
  embedded?: boolean;
};

export default function AboutBrainfaxContent({
  computeHref = '/login',
  embedded = false,
}: AboutBrainfaxContentProps) {
  return (
    <div className={embedded ? 'space-y-8' : 'min-h-screen bg-[#050505] text-slate-200'}>
      <div
        className={
          embedded
            ? undefined
            : 'border-b border-rose-500/10 bg-gradient-to-b from-[#0a0008] to-[#050505] pt-6 pb-2'
        }
      >
        <BurnProtocolBanner variant="landing" computeHref={computeHref} />
      </div>

      <main
        className={
          embedded
            ? 'text-center py-4'
            : 'mx-auto max-w-6xl px-4 sm:px-6 py-16 sm:py-24 text-center'
        }
      >
        <p className="text-xs font-mono uppercase tracking-[0.35em] text-zinc-600">
          BrainFax · LocalBrain AI
        </p>
        <h1 className="mt-6 text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight text-slate-100">
          Enterprise AI Compute
          <span className="block mt-2 text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-cyan-400">
            Powered on Polygon
          </span>
        </h1>
        <p className="mt-6 max-w-2xl mx-auto text-slate-400 text-sm sm:text-base leading-relaxed">
          BFAX Queue fuels your private LocalBrain engine. Every BFAX Token payment is verified
          on-chain and routed to permanent burn — hyper-deflation by design.
        </p>
      </main>
    </div>
  );
}
