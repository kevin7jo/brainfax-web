"use client"

import React, { useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Link, usePathname } from '../../../i18n/navigation';
import AccountInfo from '../../../components/AccountInfo';
import DashboardAuthGate from '../../../components/DashboardAuthGate';
import { DashboardLocaleSwitcher } from '../../../components/DashboardLocaleSwitcher';
import { BFAX_SUPPORT_EMAIL, getBfaxSupportMailtoHref } from '../../../lib/bfaxSupportContact';
import { Home, Clock, Users, Gift, Menu, X, Wallet, Mail, Info, LifeBuoy } from 'lucide-react';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const pathname = usePathname();
  const tSidebar = useTranslations('sidebar');
  const tHeader = useTranslations('header');

  const navItems = useMemo(
    () =>
      [
        { id: 'dashboard', href: '/dashboard', labelKey: 'nav.dashboard', icon: Home },
        { id: 'tasks', href: '/dashboard/history', labelKey: 'nav.history', icon: Clock },
        { id: 'billing', href: '/dashboard/billing', labelKey: 'nav.billing', icon: Wallet },
        { id: 'team', href: '/dashboard/team', labelKey: 'nav.team', icon: Users },
        { id: 'rewards', href: '/dashboard/rewards', labelKey: 'nav.rewards', icon: Gift },
        { id: 'emails', href: '/dashboard/settings/emails', labelKey: 'nav.emails', icon: Mail },
        { id: 'support', href: '/dashboard/support', labelKey: 'nav.support', icon: LifeBuoy },
      ] as const,
    []
  );

  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-deepgray text-slate-200 font-sans">
      <header className="flex items-center justify-between px-4 py-4 border-b border-gray-800/60 bg-[#050505] md:hidden gap-2">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-10 h-10 rounded-md bg-gradient-to-br from-[#081014] to-[#0a0a0a] flex items-center justify-center border border-gray-800 shrink-0">
            <span style={{ color: '#10b981' }} className="font-extrabold">BF</span>
          </div>
          <div className="min-w-0">
            <div className="text-sm font-semibold text-slate-100 truncate">{tSidebar('brandTitle')}</div>
            <div className="text-xs text-slate-400 truncate">{tSidebar('brandSubtitle')}</div>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <DashboardLocaleSwitcher />
          <button
            type="button"
            onClick={() => setSidebarOpen((open) => !open)}
            className="p-2 rounded-md border border-gray-800 bg-[#081010] text-slate-200"
            aria-expanded={sidebarOpen}
            aria-label="Menu"
          >
            {sidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </header>

      <div className={`${sidebarOpen ? 'fixed inset-0 z-40 bg-black/50' : 'hidden'} md:hidden`} onClick={() => setSidebarOpen(false)} />

      <aside className={`fixed inset-y-0 left-0 z-50 w-72 flex flex-col transform bg-[#070707] border-r border-gray-800/60 px-4 py-6 transition-transform duration-300 md:static md:translate-x-0 md:min-h-screen ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="mb-8 px-2">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-md bg-gradient-to-br from-[#081014] to-[#0a0a0a] flex items-center justify-center border border-gray-800">
              <span style={{ color: '#10b981' }} className="font-extrabold">BF</span>
            </div>
            <div>
              <div className="text-sm font-semibold text-slate-200">{tSidebar('brandTitle')}</div>
              <div className="text-xs text-slate-400">{tSidebar('brandSubtitle')}</div>
            </div>
          </div>
        </div>

        <nav className="space-y-1 flex-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active =
              item.href === '/dashboard'
                ? pathname === '/dashboard' || pathname === '/dashboard/'
                : pathname === item.href || (pathname?.startsWith(`${item.href}/`) ?? false);
            return (
              <Link
                key={item.id}
                href={item.href}
                onClick={() => setSidebarOpen(false)}
                className={`group flex items-center gap-3 px-3 py-2 rounded-md transition border ${
                  active
                    ? 'border-[#10b981]/35 bg-[#07160f] text-[#10b981]'
                    : 'border-transparent text-slate-300 hover:bg-gray-900/40 hover:text-white'
                }`}
              >
                <Icon className={`w-5 h-5 shrink-0 ${active ? 'text-[#10b981]' : 'text-slate-300 group-hover:text-neon'}`} />
                <span className="text-sm font-medium">{tSidebar(item.labelKey)}</span>
                <span className={`ml-auto text-xs ${active ? 'text-[#10b981]/80' : 'text-slate-500'}`}>→</span>
              </Link>
            );
          })}
        </nav>

        <div className="mt-8 px-3">
          <div className="text-xs uppercase text-slate-500 mb-2">{tSidebar('account')}</div>
          <AccountInfo />
        </div>

        <div className="mt-auto pt-6 border-t border-gray-800/60">
          <Link
            href="/dashboard/about"
            onClick={() => setSidebarOpen(false)}
            className={`group flex items-center gap-3 px-3 py-2 rounded-md transition border ${
              pathname === '/dashboard/about'
                ? 'border-[#10b981]/35 bg-[#07160f] text-[#10b981]'
                : 'border-transparent text-slate-400 hover:bg-gray-900/40 hover:text-white'
            }`}
          >
            <Info className={`w-5 h-5 shrink-0 ${pathname === '/dashboard/about' ? 'text-[#10b981]' : 'text-slate-400 group-hover:text-neon'}`} />
            <span className="text-sm font-medium">{tSidebar('nav.about')}</span>
            <span
              className={`ml-auto text-xs ${pathname === '/dashboard/about' ? 'text-[#10b981]/80' : 'text-slate-500'}`}
            >
              →
            </span>
          </Link>
          <div className="mt-4 px-3 text-xs text-slate-500">
            <div className="flex items-center justify-between">
              <div>{tSidebar('version')}</div>
              <div className="text-slate-400">0.1.0</div>
            </div>
          </div>
        </div>
      </aside>

      <div className="flex-1 min-h-screen">
        <header className="sticky top-0 z-40 hidden md:block bg-gradient-to-b from-[#000000] via-transparent to-transparent border-b border-gray-800/60">
          <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between gap-4">
            <div>
              <h1 className="text-lg font-semibold text-slate-100">{tHeader('title')}</h1>
            </div>
            <div className="flex items-center gap-3">
              <DashboardLocaleSwitcher />
              <a
                href={getBfaxSupportMailtoHref()}
                className="px-3 py-1 rounded text-sm bg-transparent border border-gray-800 text-slate-300 hover:bg-[#081010] transition"
                aria-label={tHeader('supportEmailAria')}
                title={BFAX_SUPPORT_EMAIL}
              >
                {tHeader('support')}
              </a>
              <div className="w-9 h-9 rounded-full bg-card border border-gray-800 flex items-center justify-center text-sm text-neon">
                {tHeader('avatarFallback').slice(0, 2).toUpperCase()}
              </div>
            </div>
          </div>
        </header>

        <main className="max-w-7xl mx-auto w-full px-3 sm:px-6 py-8">
          <DashboardAuthGate>{children}</DashboardAuthGate>
        </main>
      </div>
    </div>
  );
}
