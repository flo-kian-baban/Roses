'use client';
// The Style tab (step 2; owner and admin): the options the venue's page template declares (src/venues/styles.ts),
// loaded from /api/admin/style (403 for staff) and saved one change at a time with "Saved · Undo" like everything else.
// Colours offer the recorded brand colours as swatches plus a custom picker; the brand record itself is never changed.
import { useEffect, useState } from 'react';
import type { StyleValues } from '@/lib/types';
import type { StyleOption } from '@/venues/styles';
import { Icon } from '../../../_ui/icons';
import { call, type Resp } from './api';
import { Switch } from './ui';

type Data = { template: { id: string; name: string }; options: StyleOption[]; values: StyleValues; chosen: StyleValues };

export function StyleTab({ venueId, version, onSaved }: { venueId: string; version: number; onSaved: (r: Resp, text?: string) => void }) {
  const [data, setData] = useState<Data | null>(null);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => {
    let live = true;
    fetch(`/api/admin/style?venue=${encodeURIComponent(venueId)}`, { credentials: 'same-origin' })
      .then(async (r) => { const j = await r.json().catch(() => null); if (!r.ok || !j?.ok) throw new Error(j?.error || `Could not load the style options (${r.status})`); if (live) { setData(j as Data); setErr(null); } })
      .catch((e) => { if (live) setErr((e as Error).message); });
    return () => { live = false; };
  }, [venueId, version]);
  const set = async (key: string, value: string | boolean) => {
    if (!data) return;
    const before = data;
    setData({ ...data, values: { ...data.values, [key]: value } });
    try { const r = await call('/api/admin/style', { action: 'update', venue: venueId, patch: { [key]: value } }); setData((d) => (d ? { ...d, values: r.values as StyleValues, chosen: r.chosen as StyleValues } : d)); onSaved(r); }
    catch (e) { setData(before); setErr((e as Error).message); }
  };
  if (err && !data) return <p role="alert" className="mx-auto mt-6 max-w-3xl rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-[15px] text-red-900">{err}</p>;
  if (!data) return <p className="mx-auto mt-10 max-w-3xl px-5 text-center text-sm text-ink-muted" aria-busy="true">Loading the style options…</p>;
  return (
    <div className="mx-auto w-full max-w-3xl px-3 pb-32 pt-4 sm:px-5" data-style-tab>
      <p className="px-1 text-sm text-ink-muted">The {data.template.name} template offers these options. Each change saves itself and shows in the preview.</p>
      {err && <p role="alert" className="mt-3 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-[15px] text-red-900">{err}</p>}
      <div className="mt-3 divide-y divide-line rounded-2xl border border-line bg-white shadow-card">
        {data.options.map((o) => (
          <div key={o.key} className="px-4 py-4" data-style-option={o.key}>
            {o.type === 'switch' ? (
              <label className="flex items-center justify-between gap-4">
                <span><span className="block font-medium">{o.label}</span>{o.hint && <span className="mt-0.5 block text-xs text-ink-muted">{o.hint}</span>}</span>
                <Switch checked={data.values[o.key] === true} label={`${o.label}: ${data.values[o.key] === true ? 'on' : 'off'}`} onChange={(v) => set(o.key, v)} />
              </label>
            ) : o.type === 'color' ? (
              <div>
                <div className="flex items-center justify-between gap-3"><span className="font-medium">{o.label}</span><span className="rounded-full bg-fill px-2.5 py-0.5 font-mono text-[12px] uppercase text-ink-muted" data-style-value>{String(data.values[o.key])}</span></div>
                {o.hint && <p className="mt-0.5 text-xs text-ink-muted">{o.hint}</p>}
                <div className="mt-3 flex flex-wrap items-center gap-2" role="group" aria-label={`${o.label} swatches`}>
                  {[...new Set([o.default, ...o.swatches])].map((c) => {
                    const on = String(data.values[o.key]).toLowerCase() === c.toLowerCase();
                    return <button key={c} type="button" onClick={() => set(o.key, c)} aria-label={`${o.label}: ${c}${c === o.default ? ' (default)' : ''}`} aria-pressed={on} className={`relative h-10 w-10 rounded-full border border-black/10 transition active:scale-95 ${on ? 'ring-[3px] ring-accent/40 ring-offset-2' : ''}`} style={{ background: c }}>{on && <Icon name="check" className="absolute inset-0 m-auto h-5 w-5" strokeWidth={2.6} />}<span className="sr-only">{c}</span><style>{`[aria-label="${o.label}: ${c}${c === o.default ? ' (default)' : ''}"] svg{color:${luma(c) > 0.6 ? '#000' : '#fff'}}`}</style></button>;
                  })}
                  <label className="flex h-10 cursor-pointer items-center gap-2 rounded-full border border-line bg-white px-3 text-[14px] font-medium hover:bg-fill">
                    <input type="color" value={String(data.values[o.key])} aria-label={`${o.label}: custom colour`} onChange={(e) => { void set(o.key, e.target.value); }} className="h-6 w-6 cursor-pointer appearance-none rounded-full border-0 bg-transparent p-0 [&::-webkit-color-swatch]:rounded-full [&::-webkit-color-swatch]:border-0 [&::-webkit-color-swatch-wrapper]:p-0" />
                    Custom
                  </label>
                </div>
              </div>
            ) : (
              <div>
                <span className="block font-medium">{o.label}</span>
                {o.hint && <p className="mt-0.5 text-xs text-ink-muted">{o.hint}</p>}
                <div className="mt-3 flex flex-wrap gap-2" role="radiogroup" aria-label={o.label}>
                  {o.choices.map((c) => <button key={c.value} type="button" role="radio" aria-checked={data.values[o.key] === c.value} onClick={() => set(o.key, c.value)} className={`min-h-10 rounded-full border px-4 text-[15px] font-medium transition active:scale-[.97] ${data.values[o.key] === c.value ? 'border-ink bg-ink text-white' : 'border-line bg-white hover:bg-fill'}`}>{c.label}</button>)}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
      <p className="mt-3 px-1 text-xs text-ink-muted">The recorded brand colours (logo, website) stay on file; the swatches above come from them.</p>
    </div>
  );
}

function luma(hex: string): number {
  const m = hex.match(/^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i); if (!m) return 0;
  const [r, g, b] = [m[1], m[2], m[3]].map((x) => parseInt(x, 16) / 255);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
