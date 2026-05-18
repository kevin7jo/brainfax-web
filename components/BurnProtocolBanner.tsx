'use client';

import Link from 'next/link';
import { ArrowUpRight, ExternalLink, Flame, Rocket } from 'lucide-react';
import { BFAX_BURN_POLYGONSCAN_URL } from '../lib/bfaxBurn';

type BurnProtocolBannerProps = {
  variant?: 'landing' | 'compact';
  computeHref?: string;
};

export default function BurnProtocolBanner({
  variant = 'landing',
  computeHref = '/login',
}: BurnProtocolBannerProps) {
  const isLanding = variant === 'landing';

  return (
    <section
      className={`relative overflow-hidden ${
        isLanding ? 'mx-auto max-w-6xl px-4 sm:px-6' : ''
      }`}
      aria-label="BFAX Burn Protocol"
    >
      <div
        className={`relative overflow-hidden rounded-2xl border border-rose-500/40 bg-gradient-to-br from-[#0a0008] via-[#12010f] to-[#050505] shadow-[0_0_60px_rgba(244,63,94,0.25),0_0_120px_rgba(236,72,153,0.12)] ${
          isLanding ? 'p-6 sm:p-8 lg:p-10' : 'p-4 sm:p-5'
        }`}
      >
        <div
          className="pointer-events-none absolute inset-0 opacity-60"
          style={{
            background:
              'radial-gradient(ellipse 80% 60% at 20% 0%, rgba(239,68,68,0.35), transparent 55%), radial-gradient(ellipse 70% 50% at 90% 100%, rgba(236,72,153,0.28), transparent 50%)',
          }}
        />
        <div
          className="pointer-events-none absolute inset-0 rounded-2xl animate-pulse"
          style={{
            boxShadow: 'inset 0 0 80px rgba(244,63,94,0.15), inset 0 0 40px rgba(236,72,153,0.1)',
          }}
        />

        <div className="relative z-10 flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
          <div className="max-w-3xl space-y-3">
            <div className="inline-flex items-center gap-2 rounded-full border border-rose-400/50 bg-rose-950/60 px-3 py-1 text-xs font-bold uppercase tracking-[0.2em] text-rose-300 shadow-[0_0_20px_rgba(244,63,94,0.4)]">
              <Flame className="h-3.5 w-3.5 text-orange-400 animate-pulse" />
              Hyper-Deflation Live
            </div>
            <h2
              className={`flex items-start gap-2 font-extrabold tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-orange-300 via-rose-400 to-fuchsia-400 drop-shadow-[0_0_24px_rgba(244,63,94,0.5)] ${
                isLanding ? 'text-2xl sm:text-3xl lg:text-4xl' : 'text-lg sm:text-xl'
              }`}
            >
              <Flame className="h-7 w-7 shrink-0 text-orange-400 mt-0.5" aria-hidden />
              <span>THE BURN PROTOCOL ACTIVATED: 100% HYPER-DEFLATION</span>
            </h2>
            <p
              className={`text-slate-300/95 leading-relaxed ${
                isLanding ? 'text-sm sm:text-base' : 'text-xs sm:text-sm'
              }`}
            >
              Every single BFAX Token used for LocalBrain AI Computing Engine is 100% burned
              directly on-chain. As enterprise demand expands, the token supply ruthlessly
              collapses.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row lg:flex-col gap-3 shrink-0">
            <a
              href={BFAX_BURN_POLYGONSCAN_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-rose-400/60 bg-rose-950/50 px-5 py-3 text-sm font-semibold text-rose-100 transition hover:border-rose-300 hover:bg-rose-900/60 hover:shadow-[0_0_28px_rgba(244,63,94,0.45)]"
            >
              <ExternalLink className="h-4 w-4" />
              VIEW LIVE BURN BURNER
              <ArrowUpRight className="h-4 w-4" />
            </a>
            <Link
              href={computeHref}
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-fuchsia-400/50 bg-gradient-to-r from-rose-600/80 to-fuchsia-700/80 px-5 py-3 text-sm font-bold text-white transition hover:shadow-[0_0_32px_rgba(236,72,153,0.5)]"
            >
              <Rocket className="h-4 w-4" />
              LAUNCH AI COMPUTE
              <ArrowUpRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
