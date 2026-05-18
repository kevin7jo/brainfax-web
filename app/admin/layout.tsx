'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Shield, LogOut } from 'lucide-react';
import AdminGuard from '../../components/admin/AdminGuard';
import { ADMIN_NAV } from '../../lib/admin';
import { supabase } from '../../lib/supabaseClient';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    window.location.href = '/';
  };

  return (
    <AdminGuard>
      <div className="min-h-screen flex bg-[#050505] text-slate-200">
        <aside className="w-72 shrink-0 border-r border-zinc-800/80 bg-[#070707] p-5 flex flex-col">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-[#10b981]/30 bg-[#07160f]">
              <Shield className="h-5 w-5 text-[#10b981]" />
            </div>
            <div>
              <p className="text-sm font-bold text-slate-100">BrainFax CS</p>
              <p className="text-[10px] text-zinc-500">BFAX Backoffice</p>
            </div>
          </div>
          <nav className="mt-8 flex-1 space-y-1">
            {ADMIN_NAV.map((item) => {
              const active = pathname === item.href || pathname?.startsWith(`${item.href}/`);
              return (
                <Link
                  key={item.id}
                  href={item.href}
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
            className="mt-4 inline-flex items-center gap-2 rounded-lg border border-zinc-800 px-3 py-2 text-sm text-zinc-400 hover:text-red-400"
          >
            <LogOut className="h-4 w-4" />
            Sign out
          </button>
        </aside>

        <div className="flex-1 min-w-0">
          <header className="border-b border-zinc-800/80 px-6 py-4">
            <p className="font-mono text-[10px] uppercase tracking-[0.25em] text-[#10b981]/70">
              Polygon On-Chain · BFAX Token Ops
            </p>
            <h1 className="mt-1 text-xl font-bold text-slate-100">BFAX Admin Control Tower</h1>
          </header>
          <main className="p-6 max-w-6xl">{children}</main>
        </div>
      </div>
    </AdminGuard>
  );
}
