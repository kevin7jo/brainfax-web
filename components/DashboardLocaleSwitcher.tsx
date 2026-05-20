'use client';

import { useLocale, useTranslations } from 'next-intl';
import { routing, type AppLocale } from '../i18n/routing';
import { usePathname, useRouter } from '../i18n/navigation';
import { ChevronDown, Globe2 } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

const LOCALE_LABEL_KEY: Record<AppLocale, 'ko' | 'en' | 'ja' | 'es'> = {
  ko: 'ko',
  en: 'en',
  ja: 'ja',
  es: 'es',
};

export function DashboardLocaleSwitcher() {
  const t = useTranslations('localeSwitcher');
  const locale = useLocale() as AppLocale;
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('click', onDocClick);
    return () => document.removeEventListener('click', onDocClick);
  }, []);

  const setNext = (next: AppLocale) => {
    setOpen(false);
    if (next === locale) return;
    router.replace(pathname, { locale: next });
  };

  const currentLabel = t(LOCALE_LABEL_KEY[locale]);

  return (
    <div className="relative" ref={rootRef}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="inline-flex items-center gap-2 rounded-lg border border-gray-800 bg-[#081010] px-3 py-1.5 text-sm text-slate-200 shadow-sm transition hover:border-emerald-500/30 hover:bg-[#0a1414] focus:outline-none focus:ring-2 focus:ring-[#10b981]/40"
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-label={t('label')}
      >
        <Globe2 className="h-4 w-4 shrink-0 text-emerald-400/90" aria-hidden />
        <span className="hidden sm:inline max-w-[7rem] truncate">{currentLabel}</span>
        <span className="sm:hidden uppercase tabular-nums">{locale}</span>
        <ChevronDown
          className={`h-4 w-4 shrink-0 text-slate-500 transition ${open ? 'rotate-180' : ''}`}
          aria-hidden
        />
      </button>

      {open && (
        <ul
          role="listbox"
          className="absolute right-0 z-50 mt-2 min-w-[11rem] overflow-hidden rounded-lg border border-gray-800 bg-[#050505] py-1 shadow-xl shadow-black/40"
        >
          {routing.locales.map((loc) => (
            <li key={loc} role="presentation">
              <button
                type="button"
                role="option"
                aria-selected={loc === locale}
                onClick={() => setNext(loc)}
                className={`flex w-full items-center justify-between gap-3 px-4 py-2.5 text-left text-sm transition hover:bg-[#0f172a] ${
                  loc === locale ? 'text-[#10b981]' : 'text-slate-200'
                }`}
              >
                <span className="flex items-center gap-2.5">
                  <span className="w-6 text-[10px] font-mono uppercase tracking-wide text-slate-500">
                    {loc}
                  </span>
                  <span>{t(LOCALE_LABEL_KEY[loc])}</span>
                </span>
                {loc === locale ? <span className="text-xs text-emerald-500/80">✓</span> : null}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
