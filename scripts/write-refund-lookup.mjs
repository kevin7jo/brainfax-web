import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const target = path.join(path.dirname(fileURLToPath(import.meta.url)), '../components/admin/RefundLookupPanel.tsx');
const d = String.fromCharCode(60, 47, 100, 105, 118, 62);

const content = `'use client';

import { useState } from 'react';
import { Search } from 'lucide-react';
import { supabase } from '../../lib/supabaseClient';
import { adminFetch } from '../../lib/adminApiClient';
import { readBfaxAmount, type UserBalanceRow } from '../../lib/admin';

type Props = {
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

export default function RefundLookupPanel({ onLedgerRefresh }: Props) {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [profile, setProfile] = useState<UserBalanceRow | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [refundAmount, setRefundAmount] = useState('');
  const [refundNote, setRefundNote] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const balance = readBfaxAmount(profile);
  const maxRefund = balance;

  const searchUser = async () => {
    const target = email.trim();
    if (!target) {
      setMessage('\uC720\uC800 \uC774\uBA54\uC77C\uC744 \uC785\uB825\uD558\uC138\uC694.');
      return;
    }

    setLoading(true);
    setMessage(null);
    setRefundAmount('');
    setRefundNote('');

    try {
      const result = await adminFetch<{ user: UserBalanceRow | null }>(
        \`/api/admin/user-balance?email=\${encodeURIComponent(target)}\`
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
        console.error('refund user lookup', apiError, fallbackError);
        setProfile(null);
        const detail = fallbackError instanceof Error ? fallbackError.message : 'unknown';
        setMessage(apiMsg || \`\uC720\uC800 \uC870\uD68C\uC5D0 \uC2E4\uD328\uD588\uC2B5\uB2C8\uB2E4. (\${detail})\`);
      }
    } finally {
      setLoading(false);
    }
  };

  const applyRefund = async () => {
    if (!profile?.customer_email) return;

    const refundBfax = Number(refundAmount);

    if (!Number.isFinite(refundBfax) || refundBfax <= 0) {
      setMessage('0\uBCF4\uB2E4 \uD070 \uD658\uBD88 BFAX \uC218\uB7C9\uC744 \uC785\uB825\uD558\uC138\uC694.');
      return;
    }
    if (maxRefund <= 0) {
      setMessage('\uD658\uBD88\uD560 BFAX \uC794\uC561\uC774 \uC5C6\uC2B5\uB2C8\uB2E4.');
      return;
    }
    if (refundBfax > maxRefund) {
      setMessage(
        \`\uD658\uBD88 \uC218\uB7C9\uC740 \uD604\uC7AC \uBCF4\uC720\uB7C9(\${maxRefund.toLocaleString()} BFAX)\uC744 \uCD08\uACFC\uD560 \uC218 \uC5C6\uC2B5\uB2C8\uB2E4.\`
      );
      return;
    }

    setSubmitting(true);
    setMessage(null);

    try {
      const result = await adminFetch<{ balance_after: number; ledgerWarning?: string | null }>(
        '/api/admin/ledger',
        {
          method: 'POST',
          body: JSON.stringify({
            email: profile.customer_email,
            bfax_amount: refundBfax,
            note: refundNote.trim(),
          }),
        }
      );

      setProfile({
        ...profile,
        bfax_queue: result.balance_after,
        bfax_amount: result.balance_after,
      });
      setRefundAmount('');
      setRefundNote('');
      setMessage(
        result.ledgerWarning
          ? \`\uD658\uBD88 \uBC18\uC601(\uC794\uC561 \${result.balance_after} BFAX). \uC7A5\uBD80: \${result.ledgerWarning}\`
          : \`\uD658\uBD88 \uC644\uB8CC: \${refundBfax} BFAX \uCC28\uAC10. \uC794\uC561 \${result.balance_after} BFAX\`
      );
      onLedgerRefresh?.();
    } catch (e) {
      console.error('bfax refund', e);
      setMessage(e instanceof Error ? e.message : '\uD658\uBD88 \uCC98\uB9AC\uC5D0 \uC2E4\uD328\uD588\uC2B5\uB2C8\uB2E4.');
    } finally {
      setSubmitting(false);
    }
  };

  const refundPreview =
    refundAmount && Number(refundAmount) > 0
      ? Math.max(0, balance - Number(refundAmount))
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
        <div className="rounded-lg border border-zinc-800 bg-zinc-950/80 px-4 py-3 text-sm text-zinc-300">{message}${d}
      ) : null}

      {profile ? (
        <div className="rounded-2xl border border-zinc-800/80 bg-zinc-950/60 p-6 space-y-6">
          <div>
            <p className="font-mono text-[10px] uppercase tracking-wider text-[#10b981]/75">Refund Target</p>
            <p className="mt-1 text-lg font-semibold text-slate-100">{profile.customer_email}</p>
            <div className="mt-4 rounded-xl border border-[#10b981]/30 bg-[#07160f] px-4 py-3 inline-block">
              <p className="text-xs text-zinc-500">\uD604\uC7AC BFAX \uBCF4\uC720\uB7C9 (\uD658\uBD88 \uAC00\uB2A5 \uCD5C\uB300)</p>
              <p className="mt-1 text-3xl font-extrabold tabular-nums text-[#10b981]">
                {balance.toLocaleString()} <span className="text-base font-semibold">BFAX</span>
              </p>
            ${d}
          ${d}

          <div className="border-t border-zinc-800/80 pt-6 space-y-4 max-w-lg">
            <h3 className="text-sm font-semibold text-slate-200">\uD658\uBD88 \uCC98\uB9AC</h3>
            <div>
              <label className="text-xs text-zinc-500">BFAX \uD658\uBD88 \uC218\uB7C9</label>
              <input
                type="number"
                min={balance > 0 ? 1 : 0}
                max={maxRefund}
                step={1}
                value={refundAmount}
                onChange={(e) => setRefundAmount(e.target.value)}
                placeholder={maxRefund > 0 ? \`1 ~ \${maxRefund.toLocaleString()}\` : '0'}
                disabled={maxRefund <= 0 || submitting}
                className="mt-1 w-full rounded-lg border border-zinc-800 bg-[#060606] px-3 py-2 text-sm text-slate-100 disabled:opacity-50"
              />
              <p className="mt-1 text-xs text-zinc-600">
                \uCD5C\uB300 {\${maxRefund.toLocaleString()}} BFAX\uAE4C\uC9C0 \uD658\uBD88 \uAC00\uB2A5
              </p>
            ${d}
            {refundPreview !== null && refundPreview >= 0 ? (
              <p className="text-xs text-zinc-500">
                \uD658\uBD88 \uD6C4 \uC608\uC0C1 \uC794\uC561:{' '}
                <span className="text-[#10b981]">{refundPreview.toLocaleString()} BFAX</span>
              </p>
            ) : null}
            <div>
              <label className="text-xs text-zinc-500">\uBA54\uBAA8 (\uC7A5\uBD80)</label>
              <input
                value={refundNote}
                onChange={(e) => setRefundNote(e.target.value)}
                placeholder="REFUND \uC0AC\uC720"
                disabled={submitting}
                className="mt-1 w-full rounded-lg border border-zinc-800 bg-[#060606] px-3 py-2 text-sm text-slate-100 disabled:opacity-50"
              />
            ${d}
            <button
              type="button"
              onClick={applyRefund}
              disabled={submitting || maxRefund <= 0}
              className="w-full rounded-lg border border-red-900/50 bg-red-950/40 py-2.5 text-sm font-semibold text-red-400 hover:bg-red-950/60 disabled:opacity-50"
            >
              {submitting ? '\uCC98\uB9AC \uC911\u2026' : 'BFAX \uD658\uBD88 \uC2E4\uD589'}
            </button>
          ${d}
        ${d}
      ) : null}
    ${d}
  );
}
`;

fs.writeFileSync(target, content, 'utf8');
console.log('wrote', target);
