"use client"

import React, { useState } from 'react';
import Link from 'next/link';
import AccountInfo from '../../components/AccountInfo';
import { Home, Clock, CreditCard, Users, Gift, Menu, X, Wallet } from 'lucide-react';

const NAV_ITEMS = [
  { id: 'dashboard', href: '/dashboard', label: 'Dashboard', icon: Home },
  { id: 'tasks', href: '/dashboard/history', label: 'Task History', icon: Clock },
  { id: 'billing', href: '/dashboard/billing', label: 'Billing & Bundles', icon: CreditCard },
  { id: 'recharge', href: '/dashboard/recharge', label: 'Crypto Recharge (POL)', icon: Wallet },
  { id: 'team', href: '/dashboard/team', label: 'Team Workspace', icon: Users },
  { id: 'rewards', href: '/dashboard/rewards', label: 'Rewards & Promotions', icon: Gift },
];

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false)

  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-deepgray text-slate-200 font-sans">
      <header className="flex items-center justify-between px-4 py-4 border-b border-gray-800/60 bg-[#050505] md:hidden">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-md bg-gradient-to-br from-[#081014] to-[#0a0a0a] flex items-center justify-center border border-gray-800">
            <span style={{ color: '#10b981' }} className="font-extrabold">BF</span>
          </div>
          <div>
            <div className="text-sm font-semibold text-slate-100">BrainFax</div>
            <div className="text-xs text-slate-400">Deep Tech Console</div>
          </div>
        </div>
        <button onClick={() => setSidebarOpen((open) => !open)} className="p-2 rounded-md border border-gray-800 bg-[#081010] text-slate-200">
          {sidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
      </header>

      <div className={`${sidebarOpen ? 'fixed inset-0 z-40 bg-black/50' : 'hidden'} md:hidden`} onClick={() => setSidebarOpen(false)} />

      <aside className={`fixed inset-y-0 left-0 z-50 w-72 transform bg-[#070707] border-r border-gray-800/60 px-4 py-6 transition-transform duration-300 md:static md:translate-x-0 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
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
              <Link key={item.id} href={item.href} onClick={() => setSidebarOpen(false)} className="group flex items-center gap-3 px-3 py-2 rounded-md text-slate-300 hover:bg-gray-900/40 hover:text-white transition">
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

        
      </aside>

      <div className="flex-1 min-h-screen">
        <header className="sticky top-0 z-40 hidden md:block bg-gradient-to-b from-[#000000] via-transparent to-transparent border-b border-gray-800/60">
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

        <main className="max-w-7xl mx-auto w-full px-3 sm:px-6 py-8">{children}</main>
      </div>
    </div>
  );
}
