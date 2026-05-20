import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const target = path.join(path.dirname(fileURLToPath(import.meta.url)), '../components/admin/UserLookupPanel.tsx');
const d = String.fromCharCode(60, 47, 100, 105, 118, 62);

let head = fs.readFileSync(target, 'utf8');
const idx = head.indexOf('  return (');
if (idx < 0) throw new Error('return not found');
head = head.slice(0, idx);

const profileBlock = [
  '        <motionless />',
].join('\n');

const profile = [
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

const balanceAndBadge = [
  '              <div className="mt-4 flex flex-wrap items-center gap-3">',
  '                <div className="rounded-xl border border-[#10b981]/30 bg-[#07160f] px-4 py-3">',
  '                  <p className="text-xs text-zinc-500">\uD604\uC7AC BFAX \uBCF4\uC720\uB7C9</p>',
  '                  <p className="mt-1 text-3xl font-extrabold tabular-nums text-[#10b981]">',
  '                    {balance.toLocaleString()} <span className="text-base font-semibold">BFAX</span>',
  '                  </p>',
  '                ' + d,
  '                <div',
  '                  className={`rounded-full px-3 py-1 text-xs font-bold ${',
  "                    accountStatus === 'BANNED' ? 'bg-red-500/20 text-red-400' : 'bg-[#07160f] text-[#10b981]'",
  '                  }`}',
  '                >',
  '                  {accountStatus}',
  '                ' + d,
  '              ' + d,
].join('\n');

const actions = [
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

const profileFull = profile
  .replace('              <motionless />', balanceAndBadge)
  .replace('            <motionless />', actions);

const modal = [
  '        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">',
  '          <div className="w-full max-w-md rounded-2xl border border-zinc-800 bg-[#0b0b0b] p-6 shadow-2xl">',
  '            <h3 className="text-lg font-semibold text-slate-100">BFAX \uC218\uB3D9 \uC870\uC815</h3>',
  '            <p className="mt-1 text-sm text-zinc-500">{profile.customer_email}</p>',
  '            <p className="mt-2 text-xs text-zinc-600">\uD604\uC7AC \uC794\uC561: {balance.toLocaleString()} BFAX</p>',
  '            <div className="mt-5 space-y-4">',
  '              <div className="flex gap-2">',
  "                <button type=\"button\" onClick={() => setAdjustMode('add')} className={`flex-1 rounded-lg py-2 text-sm font-medium ${adjustMode === 'add' ? 'bg-[#07160f] text-[#10b981] border border-[#10b981]/40' : 'border border-zinc-800 text-zinc-500'}`}>+ \uC9C0\uAE09</button>",
  "                <button type=\"button\" onClick={() => setAdjustMode('subtract')} className={`flex-1 rounded-lg py-2 text-sm font-medium ${adjustMode === 'subtract' ? 'bg-red-950/50 text-red-400 border border-red-900/50' : 'border border-zinc-800 text-zinc-500'}`}>\u2212 \uD68C\uC218</button>",
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
].join('\n');

const noteField = [
  '              <div><label className="text-xs text-zinc-500">\uBA54\uBAA8 (\uC7A5\uBD80)</label><input value={adjustNote} onChange={(e) => setAdjustNote(e.target.value)} placeholder="ADMIN_ADJUST \uC0AC\uC720" className="mt-1 w-full rounded-lg border border-zinc-800 bg-[#060606] px-3 py-2 text-sm text-slate-100" />' + d,
].join('\n');

const modalFull = modal.replace('              <motionless />', noteField);

const out = [
  '  return (',
  '    <div className="space-y-6">',
  '      <div className="flex flex-col gap-3 sm:flex-row">',
  '        <div className="relative flex-1">',
  '          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />',
  '          <input',
  '            type="email"',
  '            value={email}',
  '            onChange={(e) => setEmail(e.target.value)}',
  '            onKeyDown={(e) => e.key === \'Enter\' && searchUser()}',
  '            placeholder="user@company.com"',
  '            className="w-full rounded-xl border border-zinc-800 bg-[#060606] py-3 pl-10 pr-4 text-sm text-slate-100 placeholder:text-zinc-600 focus:border-[#10b981]/50 focus:outline-none"',
  '          />',
  '        ' + d,
  '        <button',
  '          type="button"',
  '          onClick={searchUser}',
  '          disabled={loading}',
  '          className="inline-flex items-center justify-center gap-2 rounded-xl border border-[#10b981]/40 bg-[#07160f] px-5 py-3 text-sm font-semibold text-[#10b981] transition hover:bg-[#0a2018] disabled:opacity-50"',
  '        >',
  '          <Search className="h-4 w-4" />',
  "          {loading ? '\uC870\uD68C \uC911\u2026' : '\uC720\uC800 \uAC80\uC0C9'}",
  '        </button>',
  '      ' + d,
  '      {message ? (',
  '        <motionless />',
  '      ) : null}',
  '      {profile ? (',
  '        <motionless />',
  '      ) : null}',
  '      {adjustOpen && profile ? (',
  '        <motionless />',
  '      ) : null}',
  '    ' + d,
  '  );',
  '}',
  '',
]
  .join('\n')
  .replace(
    '      {message ? (\n        <motionless />\n      ) : null}',
    '      {message ? (\n        <motionless />\n      ) : null}'.replace(
      '<motionless />',
      '<div className="rounded-lg border border-zinc-800 bg-zinc-950/80 px-4 py-3 text-sm text-zinc-300">{message}' + d
    )
  );

// Too messy - build message line directly
const messageLine =
  '      {message ? (\n        <motionless />\n      ) : null}';

const ui = [
  '  return (',
  '    <div className="space-y-6">',
  '      <div className="flex flex-col gap-3 sm:flex-row">',
  '        <div className="relative flex-1">',
  '          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />',
  '          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} onKeyDown={(e) => e.key === \'Enter\' && searchUser()} placeholder="user@company.com" className="w-full rounded-xl border border-zinc-800 bg-[#060606] py-3 pl-10 pr-4 text-sm text-slate-100 placeholder:text-zinc-600 focus:border-[#10b981]/50 focus:outline-none" />',
  '        ' + d,
  '        <button type="button" onClick={searchUser} disabled={loading} className="inline-flex items-center justify-center gap-2 rounded-xl border border-[#10b981]/40 bg-[#07160f] px-5 py-3 text-sm font-semibold text-[#10b981] transition hover:bg-[#0a2018] disabled:opacity-50"><Search className="h-4 w-4" />{loading ? \'\uC870\uD68C \uC911\u2026\' : \'\uC720\uC800 \uAC80\uC0C9\'}</button>',
  '      ' + d,
  '      {message ? (<div className="rounded-lg border border-zinc-800 bg-zinc-950/80 px-4 py-3 text-sm text-zinc-300">{message}' + d + ') : null}',
  '      {profile ? (' + profileFull + ') : null}',
  '      {adjustOpen && profile ? (' + modalFull + ') : null}',
  '    ' + d,
  '  );',
  '}',
  '',
].join('\n');

fs.writeFileSync(target, head + ui, 'utf8');
const check = fs.readFileSync(target, 'utf8');
console.log('ok', check.includes('\uC720\uC800 \uAC80\uC0C9'), 'bad', check.includes('?? ??'));
