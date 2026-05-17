import React from 'react';
import Link from 'next/link';
import AccountInfo from '../../components/AccountInfo';
import { Home, Clock, CreditCard, Users, Gift, LogOut } from 'lucide-react';

const NAV_ITEMS = [
  { id: 'dashboard', href: '/dashboard', label: 'Dashboard', icon: Home },
  { id: 'tasks', href: '/dashboard/history', label: 'Task History', icon: Clock },
  { id: 'billing', href: '/dashboard/billing', label: 'Billing & Recharge', icon: CreditCard },
  { id: 'team', href: '/dashboard/team', label: 'Team Workspace', icon: Users },
  { id: 'rewards', href: '/dashboard/rewards', label: 'Rewards & Promotions', icon: Gift },
];

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex bg-deepgray text-slate-200 font-sans">
      <aside className="w-72 flex-shrink-0 bg-[#070707] border-r border-gray-800/60 px-4 py-6">
        <div className="mb-8 px-2">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-md bg-gradient-to-br from-[#081014] to-[#0a0a0a] flex items-center justify-center border border-gray-800">
              <span style={{ color: '#10b981' }} className="font-extrabold">BF</span>
            </div>
            <div>
              <div className="text-sm font-semibold text-slate-200">BrainFax</div>
              <div className="text-xs text-slate-400">Deep Tech Console</div>
            </div>
          </div>
        </div>

        <nav className="space-y-1">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            return (
              <Link key={item.id} href={item.href} className="group flex items-center gap-3 px-3 py-2 rounded-md text-slate-300 hover:bg-gray-900/40 hover:text-white transition">
                <Icon className="w-5 h-5 text-slate-300 group-hover:text-neon" />
                <span className="text-sm">{item.label}</span>
                <span className="ml-auto text-xs text-slate-500">→</span>
              </Link>
            );
          })}
        </nav>

        <div className="mt-8 px-3">
          <div className="text-xs uppercase text-slate-500 mb-2">Account</div>
          <AccountInfo />
        </div>

        <div className="mt-6 px-3 text-xs text-slate-500">
          <div className="flex items-center justify-between">
            <div>Version</div>
            <div className="text-slate-400">0.1.0</div>
          </div>
        </div>

        <div className="mt-4 px-3">
          <button className="w-full flex items-center gap-2 justify-center py-2 rounded bg-transparent border border-gray-800 text-slate-400 hover:bg-[#081010]"><LogOut className="w-4 h-4"/> Sign Out</button>
        </div>
      </aside>

      <div className="flex-1 min-h-screen">
        <header className="sticky top-0 z-40 bg-gradient-to-b from-[#000000] via-transparent to-transparent border-b border-gray-800/60">
          <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
            <div>
              <h1 className="text-lg font-semibold text-slate-100">BrainFax Dashboard</h1>
            </div>
            <div className="flex items-center gap-3">
              <button className="px-3 py-1 rounded text-sm bg-transparent border border-gray-800 text-slate-300 hover:bg-[#081010]">Support</button>
              <div className="w-9 h-9 rounded-full bg-card border border-gray-800 flex items-center justify-center text-sm text-neon">HJ</div>
            </div>
          </div>
        </header>

        <main className="max-w-7xl mx-auto px-6 py-8">{children}</main>
      </div>
    </div>
  );
}
