import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const target = path.join(path.dirname(fileURLToPath(import.meta.url)), '../components/admin/UserLookupPanel.tsx');
const d = String.fromCharCode(60, 47, 100, 105, 118, 62);

const file = `'use client';

import { useState } from 'react';
import { Ban, Coins, Search, ShieldCheck } from 'lucide-react';
import { supabase } from '../../lib/supabaseClient';
import { adminFetch } from '../../lib/adminApiClient';
import {
  ADMIN_API_PATH,
  normalizeAccountStatus,
  readBfaxAmount,
  type UserBalanceRow,
} from '../../lib/admin';

type Props = {
  mode: 'credit' | 'users';
  onLedgerRefresh?: () => void;
};

async function clientFallbackSearch(email: string): Promise<UserBalanceRow | null> {
  const { data, error } = await supabase
    .from('lb_user_balance')
    .select('customer_email, bfax_queue')
    .eq('customer_email', email.trim())
    .maybeSingle();
  if (error) throw new Error(error.message);
  return (data as UserBalanceRow) ?? null;
}

export default function UserLookupPanel({ mode, onLedgerRefresh }: Props) {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [profile, setProfile] = useState<UserBalanceRow | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [adjustOpen, setAdjustOpen] = useState(false);
  const [adjustAmount, setAdjustAmount] = useState('');
  const [adjustMode, setAdjustMode] = useState<'add' | 'subtract'>('add');
  const [adjustNote, setAdjustNote] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const searchUser = async () => {
    const target = email.trim();
    if (!target) {
      setMessage('\uC720\uC800 \uC774\uBA54\uC77C\uC744 \uC785\uB825\uD558\uC138\uC694.');
      return;
    }

    setLoading(true);
    setMessage(null);

    try {
      const result = await adminFetch<{ user: UserBalanceRow | null }>(
        \`\${ADMIN_API_PATH}/user-balance?email=\${encodeURIComponent(target)}\`
      );
      if (!result.user) {
        setProfile(null);
        setMessage(
          '\uD574\uB2F9 \uC774\uBA54\uC77C\uC758 BFAX \uC794\uC561 \uB808\uCF54\uB4DC\uAC00 \uC5C6\uC2B5\uB2C8\uB2E4. \uB300\uC2DC\uBCF4\uB4DC \uB85C\uADF8\uC778 \uB610\uB294 \uCDA9\uC804 \uD6C4 \uB2E4\uC2DC \uC870\uD68C\uD558\uC138\uC694.'
        );
        return;
      }
      setProfile(result.user);
    } catch (apiError) {
      const apiMsg = apiError instanceof Error ? apiError.message : '';
      const needsServiceRole =
        apiMsg.includes('SERVICE_ROLE') ||
        apiMsg.includes('503') ||
        apiMsg.includes('\uC11C\uBC84\uC5D0 \uC124\uC815');

      if (needsServiceRole) {
        setProfile(null);
        setMessage(apiMsg || 'SUPABASE_SERVICE_ROLE_KEY\uAC00 .env.local\uC5D0 \uD544\uC694\uD569\uB2C8\uB2E4.');
        return;
      }

      try {
        const row = await clientFallbackSearch(target);
        if (!row) {
          setProfile(null);
          setMessage('\uD574\uB2F9 \uC774\uBA54\uC77C\uC758 BFAX \uC794\uC561 \uB808\uCF54\uB4DC\uAC00 \uC5C6\uC2B5\uB2C8\uB2E4.');
          return;
        }
        setProfile(row);
        setMessage('\uBCF8\uC778 \uACC4\uC815\uB9CC \uC870\uD68C\uB418\uC5C8\uC2B5\uB2C8\uB2E4. \uC804\uCCB4 \uC720\uC800 \uC870\uD68C\uB294 SUPABASE_SERVICE_ROLE_KEY\uAC00 \uD544\uC694\uD569\uB2C8\uB2E4.');
      } catch (fallbackError) {
        console.error('admin user lookup', apiError, fallbackError);
        setProfile(null);
        const detail = fallbackError instanceof Error ? fallbackError.message : 'unknown';
        setMessage(apiMsg || \`\uC720\uC800 \uC870\uD68C\uC5D0 \uC2E4\uD328\uD588\uC2B5\uB2C8\uB2E4. (\${detail})\`);
      }
    } finally {
      setLoading(false);
    }
  };

  const applyBfaxAdjust = async () => {
    if (!profile?.customer_email) return;

    const deltaRaw = Number(adjustAmount);
    if (!Number.isFinite(deltaRaw) || deltaRaw <= 0) {
      setMessage('0\uBCF4\uB2E4 \uD070 BFAX \uC218\uB7C9\uC744 \uC785\uB825\uD558\uC138\uC694.');
      return;
    }

    const signed = adjustMode === 'add' ? deltaRaw : -deltaRaw;
    const current = readBfaxAmount(profile);
    if (current + signed < 0) {
      setMessage('\uD68C\uC218 \uD6C4 BFAX \uC794\uC561\uC774 \uC74C\uC218\uAC00 \uB420 \uC218 \uC5C6\uC2B5\uB2C8\uB2E4.');
      return;
    }

    setSubmitting(true);
    setMessage(null);

    try {
      const result = await adminFetch<{ user: UserBalanceRow; ledgerWarning?: string | null }>(
        \`\${ADMIN_API_PATH}/user-balance\`,
        {
          method: 'PATCH',
          body: JSON.stringify({
            email: profile.customer_email,
            delta: signed,
            note: adjustNote.trim(),
          }),
        }
      );

      setProfile(result.user);
      setAdjustOpen(false);
      setAdjustAmount('');
      setAdjustNote('');
      const next = readBfaxAmount(result.user);
      setMessage(
        result.ledgerWarning
          ? \`BFAX \uBC18\uC601\uB428(\uC794\uC561 \${next}). \uC7A5\uBD80 \uAE30\uB85D \uC2E4\uD328: \${result.ledgerWarning}\`
          : \`BFAX \${signed > 0 ? '+' : ''}\${signed} \uBC18\uC601 \uC644\uB8CC. \uD604\uC7AC \uC794\uC561: \${next} BFAX\`
      );
      onLedgerRefresh?.();
    } catch (e) {
      console.error('bfax adjust', e);
      setMessage(e instanceof Error ? e.message : 'BFAX \uC870\uC815\uC5D0 \uC2E4\uD328\uD588\uC2B5\uB2C8\uB2E4.');
    } finally {
      setSubmitting(false);
    }
  };

  const setBanStatus = async (status: 'BANNED' | 'ACTIVE') => {
    if (!profile?.customer_email) return;

    setSubmitting(true);
    setMessage(null);

    try {
      const result = await adminFetch<{ user: UserBalanceRow }>(\`\${ADMIN_API_PATH}/user-balance\`, {
        method: 'PATCH',
        body: JSON.stringify({
          email: profile.customer_email,
          account_status: status,
        }),
      });
      setProfile(result.user);
      setMessage(
        status === 'BANNED'
          ? '\uC720\uC800\uB97C BANNED \uC0C1\uD0DC\uB85C \uC804\uD658\uD588\uC2B5\uB2C8\uB2E4.'
          : '\uC720\uC800\uB97C ACTIVE \uC0C1\uD0DC\uB85C \uBCF5\uAD6C\uD588\uC2B5\uB2C8\uB2E4.'
      );
      onLedgerRefresh?.();
    } catch (e) {
      console.error('ban status', e);
      setMessage(e instanceof Error ? e.message : '\uACC4\uC815 \uC0C1\uD0DC \uBCC0\uACBD\uC5D0 \uC2E4\uD328\uD588\uC2B5\uB2C8\uB2E4.');
    } finally {
      setSubmitting(false);
    }
  };

  const accountStatus = normalizeAccountStatus(profile?.account_status);
  const balance = readBfaxAmount(profile);
  const preview =
    adjustAmount && Number(adjustAmount) > 0
      ? balance + (adjustMode === 'add' ? Number(adjustAmount) : -Number(adjustAmount))
      : null;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && searchUser()}
            placeholder="user@company.com"
            className="w-full rounded-xl border border-zinc-800 bg-[#060606] py-3 pl-10 pr-4 text-sm text-slate-100 placeholder:text-zinc-600 focus:border-[#10b981]/50 focus:outline-none"
          />
        ${d}
        <button
          type="button"
          onClick={searchUser}
          disabled={loading}
          className="inline-flex items-center justify-center gap-2 rounded-xl border border-[#10b981]/40 bg-[#07160f] px-5 py-3 text-sm font-semibold text-[#10b981] transition hover:bg-[#0a2018] disabled:opacity-50"
        >
          <Search className="h-4 w-4" />
          {loading ? '\uC870\uD68C \uC911\u2026' : '\uC720\uC800 \uAC80\uC0C9'}
        </button>
      ${d}

      {message ? (
        <motionless />
      ) : null}

      {profile ? (
        <motionless />
      ) : null}

      {adjustOpen && profile ? (
        <motionless />
      ) : null}
    ${d}
  );
}
`;

const profileBlock = [
  '        <div className="rounded-2xl border border-zinc-800/80 bg-zinc-950/60 p-6">',
  '          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">',
  '            <div>',
  '              <p className="font-mono text-[10px] uppercase tracking-wider text-[#10b981]/75">Target User</p>',
  '              <p className="mt-1 text-lg font-semibold text-slate-100">{profile.customer_email}</p>',
  '              <motionless />',
  '            ' + d,
  '            <motionless />',
  '          ' + d,
  '        ' + d,
].join('\n');

const balanceBlock = [
  '              <motionless />',
].join('\n');

const balanceReal = [
  '              <div className="mt-4 flex flex-wrap items-center gap-3">',
  '                <div className="rounded-xl border border-[#10b981]/30 bg-[#07160f] px-4 py-3">',
  '                  <p className="text-xs text-zinc-500">\uD604\uC7AC BFAX \uBCF4\uC720\uB7C9</p>',
  '                  <p className="mt-1 text-3xl font-extrabold tabular-nums text-[#10b981]">',
  '                    {balance.toLocaleString()} <span className="text-base font-semibold">BFAX</span>',
  '                  </p>',
  '                ' + d,
  '                <div',
  '                  className={\`rounded-full px-3 py-1 text-xs font-bold \${',
  "                    accountStatus === 'BANNED' ? 'bg-red-500/20 text-red-400' : 'bg-[#07160f] text-[#10b981]'",
  '                  }\`}',
  '                >',
  '                  {accountStatus}',
  '                ' + d,
  '              ' + d,
].join('\n');

const actionsReal = [
  '            <div className="flex flex-wrap gap-2">',
  "              {mode === 'credit' ? (",
  '                <button type="button" onClick={() => setAdjustOpen(true)} disabled={submitting} className="inline-flex items-center gap-2 rounded-lg border border-[#10b981]/40 bg-[#07160f] px-4 py-2 text-sm font-semibold text-[#10b981] hover:bg-[#0a2018] disabled:opacity-50"><Coins className="h-4 w-4" />BFAX \uC870\uC815</button>',
  '              ) : null}',
  "              {mode === 'users' ? (",
  "                accountStatus !== 'BANNED' ? (",
  '                  <button type="button" onClick={() => setBanStatus(\'BANNED\')} disabled={submitting} className="inline-flex items-center gap-2 rounded-lg border border-red-900/60 bg-red-950/40 px-4 py-2 text-sm font-semibold text-red-400 hover:bg-red-950/70 disabled:opacity-50"><Ban className="h-4 w-4" />\uBE44\uD65C\uC131\uD654 (BANNED)</button>',
  '                ) : (',
  '                  <button type="button" onClick={() => setBanStatus(\'ACTIVE\')} disabled={submitting} className="inline-flex items-center gap-2 rounded-lg border border-zinc-700 bg-zinc-900 px-4 py-2 text-sm font-semibold text-slate-200 hover:bg-zinc-800 disabled:opacity-50"><ShieldCheck className="h-4 w-4" />\uD65C\uC131\uD654 (ACTIVE)</button>',
  '                )',
  '              ) : null}',
  '            ' + d,
].join('\n');

const profileFull = profileBlock
  .replace('              <motionless />', balanceReal)
  .replace('            <motionless />', actionsReal);

const modalFull = [
  '        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">',
  '          <div className="w-full max-w-md rounded-2xl border border-zinc-800 bg-[#0b0b0b] p-6 shadow-2xl">',
  '            <h3 className="text-lg font-semibold text-slate-100">BFAX \uC218\uB3D9 \uC870\uC815</h3>',
  '            <p className="mt-1 text-sm text-zinc-500">{profile.customer_email}</p>',
  '            <p className="mt-2 text-xs text-zinc-600">\uD604\uC7AC \uC794\uC561: {balance.toLocaleString()} BFAX</p>',
  '            <div className="mt-5 space-y-4">',
  '              <div className="flex gap-2">',
  "                <button type=\"button\" onClick={() => setAdjustMode('add')} className={\`flex-1 rounded-lg py-2 text-sm font-medium \${adjustMode === 'add' ? 'bg-[#07160f] text-[#10b981] border border-[#10b981]/40' : 'border border-zinc-800 text-zinc-500'}\`}>+ \uC9C0\uAE09</button>",
  "                <button type=\"button\" onClick={() => setAdjustMode('subtract')} className={\`flex-1 rounded-lg py-2 text-sm font-medium \${adjustMode === 'subtract' ? 'bg-red-950/50 text-red-400 border border-red-900/50' : 'border border-zinc-800 text-zinc-500'}\`}>\u2212 \uD68C\uC218</button>",
  '              ' + d,
  '              <div><label className="text-xs text-zinc-500">BFAX \uC218\uB7C9</label><input type="number" min={1} value={adjustAmount} onChange={(e) => setAdjustAmount(e.target.value)} className="mt-1 w-full rounded-lg border border-zinc-800 bg-[#060606] px-3 py-2 text-sm text-slate-100" />' + d,
  '              {preview !== null && preview >= 0 ? (<p className="text-xs text-zinc-500">\uBC18\uC601 \uD6C4 \uC608\uC0C1: <span className="text-[#10b981]">{preview.toLocaleString()} BFAX</span></p>) : null}',
  '              <motionless />',
  '            ' + d,
  '            <div className="mt-6 flex gap-2">',
  '              <button type="button" onClick={() => setAdjustOpen(false)} className="flex-1 rounded-lg border border-zinc-800 py-2 text-sm text-zinc-400 hover:bg-zinc-900">\uCDE8\uC18C</button>',
  "              <button type=\"button\" onClick={applyBfaxAdjust} disabled={submitting} className=\"flex-1 rounded-lg border border-[#10b981]/40 bg-[#07160f] py-2 text-sm font-semibold text-[#10b981] hover:bg-[#0a2018] disabled:opacity-50\">{submitting ? '\uCC98\uB9AC \uC911\u2026' : 'BFAX \uBC18\uC601'}</button>",
  '            ' + d,
  '          ' + d,
  '        ' + d,
].join('\n').replace(
  '              <motionless />',
  '              <div><label className="text-xs text-zinc-500">\uBA54\uBAA8 (\uC7A5\uBD80)</label><input value={adjustNote} onChange={(e) => setAdjustNote(e.target.value)} placeholder="ADMIN_ADJUST \uC0AC\uC720" className="mt-1 w-full rounded-lg border border-zinc-800 bg-[#060606] px-3 py-2 text-sm text-slate-100" />' + d
);

let out = file
  .replace(
    '      {message ? (\n        <motionless />\n      ) : null}',
    '      {message ? (\n        <div className="rounded-lg border border-zinc-800 bg-zinc-950/80 px-4 py-3 text-sm text-zinc-300">{message}' + d + '\n      ) : null}'
  )
  .replace('      {profile ? (\n        <motionless />\n      ) : null}', '      {profile ? (\n' + profileFull + '\n      ) : null}')
  .replace(
    '      {adjustOpen && profile ? (\n        <motionless />\n      ) : null}',
    '      {adjustOpen && profile ? (\n' + modalFull + '\n      ) : null}'
  );

fs.writeFileSync(target, out, 'utf8');
const t = fs.readFileSync(target, 'utf8');
console.log('lines', t.split('\n').length, 'search', t.includes('\uC720\uC800 \uAC80\uC0C9'), 'bad', /\\?\\?/.test(t));
