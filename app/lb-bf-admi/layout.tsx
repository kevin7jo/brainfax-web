'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Shield, LogOut, Menu, X } from 'lucide-react';
import AdminGuard from '../../components/admin/AdminGuard';
import { ADMIN_NAV } from '../../lib/admin';
import { supabase } from '../../lib/supabaseClient';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    window.location.href = '/';
  };

  return (
    <AdminGuard>
      <div className="min-h-screen flex flex-col md:flex-row bg-[#050505] text-slate-200">
        {/* 모바일 헤더 */}
        <header className="flex items-center justify-between px-4 py-4 border-b border-zinc-800/80 bg-[#050505] md:hidden shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-[#10b981]/30 bg-[#07160f]">
              <Shield className="h-5 w-5 text-[#10b981]" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-bold text-slate-100 truncate">BrainFax CS</p>
              <p className="text-[10px] text-zinc-500 truncate">BFAX Backoffice</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setSidebarOpen((open) => !open)}
            className="shrink-0 p-2 rounded-md border border-zinc-800 bg-[#081010] text-slate-200"
            aria-label={sidebarOpen ? 'Close menu' : 'Open menu'}
          >
            {sidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </header>

        <div
          className={`${sidebarOpen ? 'fixed inset-0 z-40 bg-black/50' : 'hidden'} md:hidden`}
          onClick={() => setSidebarOpen(false)}
          aria-hidden={!sidebarOpen}
        />

        {/* 사이드바 */}
        <aside
          className={`fixed inset-y-0 left-0 z-50 w-72 flex flex-col shrink-0 border-r border-zinc-800/80 bg-[#070707] p-5 transition-transform duration-300 md:static md:translate-x-0 md:min-h-screen ${
            sidebarOpen ? 'translate-x-0' : '-translate-x-full'
          }`}
        >
          <div className="hidden md:flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-[#10b981]/30 bg-[#07160f]">
              <Shield className="h-5 w-5 text-[#10b981]" />
            </div>
            <div>
              <p className="text-sm font-bold text-slate-100">BrainFax CS</p>
              <p className="text-[10px] text-zinc-500">BFAX Backoffice</p>
            </div>
          </div>

          <nav className="mt-6 md:mt-8 flex-1 space-y-1 overflow-y-auto">
            {ADMIN_NAV.map((item) => {
              const active = pathname === item.href || pathname?.startsWith(`${item.href}/`);
              return (
                <Link
                  key={item.id}
                  href={item.href}
                  onClick={() => setSidebarOpen(false)}
                  className={`block rounded-xl px-3 py-3 transition ${
                    active
                      ? 'border border-[#10b981]/35 bg-[#07160f] text-[#10b981]'
                      : 'border border-transparent text-zinc-400 hover:bg-zinc-900/50 hover:text-slate-200'
                  }`}
                >
                  <div className="text-sm font-semibold">{item.label}</div>
                  <div className="mt-0.5 text-xs text-zinc-500">{item.sub}</div>
                </Link>
              );
            })}
          </nav>

          <button
            type="button"
            onClick={handleSignOut}
            className="mt-4 inline-flex items-center gap-2 rounded-lg border border-zinc-800 px-3 py-2 text-sm text-zinc-400 hover:text-red-400 shrink-0"
          >
            <LogOut className="h-4 w-4" />
            Sign out
          </button>
        </aside>

        <div className="flex-1 min-w-0 min-h-0 flex flex-col">
          <header className="sticky top-0 z-30 hidden md:block border-b border-zinc-800/80 bg-[#050505]/95 backdrop-blur-sm px-6 py-4">
            <p className="font-mono text-[10px] uppercase tracking-[0.25em] text-[#10b981]/70">
              Polygon On-Chain · BFAX Token Ops
            </p>
            <h1 className="mt-1 text-xl font-bold text-slate-100">BFAX Admin Control Tower</h1>
          </header>

          <main className="flex-1 w-full max-w-6xl mx-auto px-3 sm:px-6 py-6 sm:py-8 min-w-0">
            {children}
          </main>
        </div>
      </div>
    </AdminGuard>
  );
}
