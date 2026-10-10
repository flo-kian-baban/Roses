'use client';
// The Details tab (step 2; owner and admin): name and tagline in both languages, the logo (uploaded from the phone),
// the locations (label, address, phone, hours; "to confirm" marks from the import until edited or confirmed) and the
// per-venue switch for Persian drafts. Every field saves itself through /api/admin/venue with "Saved · Undo".
import { useEffect, useState } from 'react';
import type { EditorVenue, Location, Logo } from '@/lib/types';
import { Icon } from '../../../_ui/icons';
import { call, type Resp } from './api';
import { uploadImage } from './upload';
import { Badge, Switch, TextField, btnDanger, btnSecondary } from './ui';

export function DetailsTab({ venue, version, onSaved }: { venue: EditorVenue; version: number; onSaved: (r: Resp, text?: string) => void }) {
  const [v, setV] = useState<EditorVenue>(venue);
  const [err, setErr] = useState<string | null>(null);
  const [confirmRemove, setConfirmRemove] = useState<number | null>(null);
  useEffect(() => { if (!err) return; const t = setTimeout(() => setErr(null), 6000); return () => clearTimeout(t); }, [err]);
  // After an Undo (version changes) the saved details are read back.
  useEffect(() => {
    if (version === 0) return;
    let live = true;
    fetch(`/api/admin/venue?id=${encodeURIComponent(venue.id)}`, { credentials: 'same-origin' }).then(async (r) => { const j = await r.json().catch(() => null); if (live && r.ok && j?.ok && j.venue) setV(j.venue as EditorVenue); }).catch(() => undefined);
    return () => { live = false; };
  }, [venue.id, version]);
  const save = async (patch: Record<string, unknown>, text = 'Saved') => {
    try { setErr(null); const r = await call('/api/admin/venue', { action: 'update', id: v.id, patch }); if (r.venue) setV(r.venue as EditorVenue); onSaved(r, text); }
    catch (e) { setErr((e as Error).message); throw e; }
  };
  const locPatch = (i: number, l: Partial<Location> & { confirmed?: boolean }) => save({ locations: v.locations.map((x, k) => (k === i ? { ...x, ...l } : x)) });
  const addLocation = () => save({ locations: [...v.locations, { label: { en: v.locations.length ? 'New location' : v.name.en, fa: null }, address: null, phone: null, hours: { en: null, fa: null } }] }, 'Location added');
  const removeLocation = (i: number) => save({ locations: v.locations.filter((_, k) => k !== i) }, 'Location removed');

  return (
    <div className="mx-auto w-full max-w-3xl space-y-4 px-3 pb-32 pt-4 sm:px-5" data-details-tab>
      {err && <p role="alert" className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-[15px] text-red-900">{err}</p>}
      <Group title="Name">
        <TextField label="Name" value={v.name.en} required onCommit={(x) => save({ name: { ...v.name, en: x } })} />
        <TextField label="Name (فارسی)" value={v.name.fa} dir="rtl" lang="fa" onCommit={(x) => save({ name: { ...v.name, fa: x } })} />
        <TextField label="Tagline" value={v.tagline.en} placeholder="Optional, under the name in the page description" onCommit={(x) => save({ tagline: { ...v.tagline, en: x } })} />
        <TextField label="Tagline (فارسی)" value={v.tagline.fa} dir="rtl" lang="fa" onCommit={(x) => save({ tagline: { ...v.tagline, fa: x } })} />
        <p className="text-xs text-ink-muted">Customers&rsquo; page: <a href={`/${v.id}`} target="_blank" rel="noreferrer" className="font-medium text-ink underline-offset-4 hover:underline">/{v.id}</a> (the address does not change when the name does).</p>
      </Group>
      <Group title="Logo">
        <LogoField venueId={v.id} logo={v.logo} tile={v.brandColors?.background} onChange={(logo) => save({ logo }, logo ? 'Logo saved' : 'Logo removed')} />
      </Group>
      <Group title={`Location${v.locations.length === 1 ? '' : 's'}`} hint="Shown at the bottom of the customers' page. A phone number dials exactly as written.">
        {v.locations.map((l, i) => {
          const confirm = new Set(l.confirm ?? []);
          return (
            <div key={i} className="space-y-3 rounded-2xl border border-line p-3" data-location={i}>
              <div className="flex items-center justify-between gap-2"><span className="text-sm font-semibold">{l.label.en || `Location ${i + 1}`}</span>{confirm.size > 0 && <button type="button" className={`${btnSecondary} min-h-11 px-3 text-sm`} onClick={() => locPatch(i, { confirmed: true })}><Icon name="check" className="h-4 w-4" />Mark confirmed</button>}</div>
              <div className="grid gap-3 sm:grid-cols-2">
                <TextField label="Label" value={l.label.en} placeholder="Dine-in, Take-out…" onCommit={(x) => locPatch(i, { label: { ...l.label, en: x } })} />
                <TextField label="Label (فارسی)" value={l.label.fa} dir="rtl" lang="fa" onCommit={(x) => locPatch(i, { label: { ...l.label, fa: x } })} />
              </div>
              <TextField label="Address" value={l.address} badge={confirm.has('address') ? <Badge tone="amber">To confirm</Badge> : null} onCommit={(x) => locPatch(i, { address: x })} />
              <TextField label="Phone" value={l.phone} inputMode="text" placeholder="(905) 555 0100" badge={confirm.has('phone') ? <Badge tone="amber">To confirm</Badge> : null} onCommit={(x) => locPatch(i, { phone: x })} />
              <div className="grid gap-3 sm:grid-cols-2">
                <TextField label="Hours" value={l.hours.en} placeholder="11 AM – 11 PM, every day" badge={confirm.has('hours') ? <Badge tone="amber">To confirm</Badge> : null} onCommit={(x) => locPatch(i, { hours: { ...l.hours, en: x } })} />
                <TextField label="Hours (فارسی)" value={l.hours.fa} dir="rtl" lang="fa" onCommit={(x) => locPatch(i, { hours: { ...l.hours, fa: x } })} />
              </div>
              {confirmRemove === i
                ? <div className="flex flex-wrap items-center gap-2 text-sm"><span>Remove this location?</span><button type="button" className={`${btnDanger} min-h-11 px-3 text-sm`} onClick={() => { setConfirmRemove(null); void removeLocation(i); }}>Remove</button><button type="button" className={`${btnSecondary} min-h-11 px-3 text-sm`} onClick={() => setConfirmRemove(null)}>Cancel</button></div>
                : <button type="button" className="inline-flex min-h-11 items-center text-sm font-medium text-red-600 underline-offset-4 hover:underline" onClick={() => setConfirmRemove(i)}>Remove location</button>}
            </div>
          );
        })}
        <button type="button" className={btnSecondary} onClick={() => { void addLocation(); }}><Icon name="plus" className="h-4 w-4" />Add location</button>
      </Group>
      <Group title="Persian">
        <label className="flex min-h-14 items-center justify-between gap-4 rounded-2xl border border-line px-4 py-3">
          <span><span className="block font-medium">Show Persian drafts to customers</span><span className="block text-xs text-ink-muted">Off: drafted Persian (marked “Persian draft” in the menu) falls back to English on the customers&rsquo; page until it is reviewed.</span></span>
          <Switch checked={v.settings.showPersianDrafts !== false} label={`Persian drafts: ${v.settings.showPersianDrafts !== false ? 'shown' : 'hidden'}`} onChange={(x) => save({ showPersianDrafts: x })} />
        </label>
      </Group>
    </div>
  );
}

function Group({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return <section className="rounded-2xl border border-line bg-white p-4 shadow-card"><h2 className="text-[17px] font-semibold">{title}</h2>{hint && <p className="mt-0.5 text-xs text-ink-muted">{hint}</p>}<div className="mt-3 space-y-3">{children}</div></section>;
}

// The logo: uploaded from the phone (PNG with transparency, SVG, JPEG or WebP) and shown on the brand background tile.
function LogoField({ venueId, logo, tile, onChange }: { venueId: string; logo: Logo | null; tile?: string; onChange: (l: Logo | null) => Promise<void> }) {
  const [busy, setBusy] = useState(false); const [err, setErr] = useState<string | null>(null);
  const pick = async (f: File) => {
    setBusy(true); setErr(null);
    try { const u = await uploadImage(venueId, 'logo', f); if (!u.width || !u.height) throw new Error('The logo size could not be read; try a PNG or JPEG'); await onChange({ url: u.url, key: u.key, width: u.width, height: u.height }); }
    catch (e) { setErr((e as Error).message); } finally { setBusy(false); }
  };
  return (
    <div className="flex items-start gap-4">
      <span className="flex h-20 w-28 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-black/5 p-2" style={{ background: tile || '#f5f5f7' }}>{logo ? <img src={logo.url} alt="" className="max-h-full max-w-full object-contain" /> : <Icon name="image" className="h-6 w-6 text-neutral-400" />}</span>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap gap-2">
          <label className={`${btnSecondary} cursor-pointer`} aria-busy={busy}>{busy ? 'Uploading…' : logo ? 'Replace logo' : 'Upload logo'}<input type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" className="sr-only" aria-label="Choose a logo file" disabled={busy} onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) void pick(f); }} /></label>
          {logo && <button type="button" className={btnDanger} disabled={busy} onClick={() => { setErr(null); void onChange(null).catch((e) => setErr(e.message)); }}>Remove</button>}
        </div>
        {logo && <p className="mt-1 text-xs text-ink-muted">{logo.width} × {logo.height} px{logo.key ? ', uploaded' : ', from the venue files'}</p>}
        {err && <p role="alert" className="mt-1 text-sm text-red-600">{err}</p>}
        <p className="mt-1 text-xs text-ink-muted">A PNG or SVG with a transparent background looks best. It is used in the header, on the welcome screen and in the admin.</p>
      </div>
    </div>
  );
}
