'use client';
// "+ Add venue" (step 2; owner and admin): a name in both languages creates the venue on the default template, with
// one empty section, and opens its Details tab. The web address is made from the English name.
import { useState } from 'react';
import { call } from './api';
import { btnPrimary, fieldCls } from './ui';

export function NewVenue() {
  const [en, setEn] = useState(''); const [fa, setFa] = useState('');
  const [busy, setBusy] = useState(false); const [err, setErr] = useState<string | null>(null);
  const slug = en.normalize('NFKD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/&/g, ' and ').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40);
  return (
    <form className="space-y-4 rounded-2xl border border-line bg-white p-5 shadow-card" onSubmit={async (e) => {
      e.preventDefault(); if (!en.trim()) { setErr('The name is required'); return; }
      setBusy(true); setErr(null);
      try { const r = await call('/api/admin/venue', { action: 'create', name: { en: en.trim(), fa: fa.trim() || null } }); window.location.href = `/admin/${r.venue as string}?tab=details`; }
      catch (x) { setErr((x as Error).message); setBusy(false); }
    }}>
      <label className="block"><span className="mb-1 block text-sm font-medium">Name</span><input className={fieldCls} value={en} onChange={(e) => setEn(e.target.value)} autoFocus required aria-label="Venue name" placeholder="For example Roses Bakery" /></label>
      <label className="block"><span className="mb-1 block text-sm font-medium">Name (فارسی)</span><input className={fieldCls} value={fa} onChange={(e) => setFa(e.target.value)} dir="rtl" lang="fa" aria-label="Venue name in Persian" /></label>
      <p className="text-xs text-ink-muted">Customers&rsquo; page: <span className="font-mono">/{slug || '…'}</span> · default template, one empty section to start. Logo, addresses and hours come next in the Details tab.</p>
      {err && <p role="alert" className="text-sm text-red-600">{err}</p>}
      <button type="submit" className={`${btnPrimary} w-full`} disabled={busy}>Create venue</button>
    </form>
  );
}
