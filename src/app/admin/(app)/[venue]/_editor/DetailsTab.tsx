'use client';
// The Details tab (step 2; owner and admin): name and tagline in both languages, the logo (uploaded from the phone),
// the locations (label, address, phone, hours; "to confirm" marks from the import until edited or confirmed) and the
// per-venue switch for Persian drafts. Every field saves itself through /api/admin/venue with "Saved · Undo". In the admin's look (the
// admin-wide clean-up, 2026-11-06): each group a small grey heading over a card, each field a row with its label on the left.
import { useEffect, useState } from 'react';
import type { EditorVenue, Location, Logo } from '@/lib/types';
import { Icon } from '../../../_ui/icons';
import { ApiFail, call, type Resp } from './api';
import { LIMITS } from '@/lib/rules';
import { uploadImage } from './upload';
import { Badge, Switch, btnDanger, btnSecondary } from './ui';
import { CellText } from './kit';
import { card, dangerText, headingCls, headingStyle, textBtn } from '../../../_ui/look';

export function DetailsTab({ venue, version, onSaved, onFail }: { venue: EditorVenue; version: number; onSaved: (r: Resp, text?: string) => void; onFail: (e: unknown, again?: () => Promise<unknown>) => void }) {
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
  // A change of the locations carries them as this tab last saw them (base): someone else's change since is refused (409, with the details
  // as they are now, which replace this tab's copy; pre-go-live audit, the residual of D-03).
  const save = async (patch: Record<string, unknown>, text = 'Saved') => {
    const base = 'locations' in patch ? { locations: v.locations } : undefined;
    try { setErr(null); const r = await call('/api/admin/venue', { action: 'update', id: v.id, patch, ...(base ? { base } : {}) }); if (r.venue) setV(r.venue as EditorVenue); onSaved(r, text); }
    catch (e) { if (e instanceof ApiFail && e.status === 409 && e.extra.venue) setV(e.extra.venue as EditorVenue); setErr((e as Error).message); onFail(e, () => save(patch, text)); throw e; }
  };
  const locPatch = (i: number, l: Partial<Location> & { confirmed?: boolean }) => save({ locations: v.locations.map((x, k) => (k === i ? { ...x, ...l } : x)) });
  const addLocation = () => save({ locations: [...v.locations, { label: { en: v.locations.length ? 'New location' : v.name.en, fa: null }, address: null, phone: null, hours: { en: null, fa: null } }] }, 'Location added');
  const removeLocation = (i: number) => save({ locations: v.locations.filter((_, k) => k !== i) }, 'Location removed');

  return (
    <div className="mx-auto w-full max-w-3xl px-3 pb-32 pt-2 sm:px-5" data-details-tab>
      {err && <p role="alert" className={`${card} mt-4 px-4 py-3 text-base text-danger`}>{err}</p>}
      <Group title="Name" foot={<>Customers&rsquo; page: <a href={`/${v.id}`} target="_blank" rel="noreferrer" className="font-semibold text-accent-ink">/{v.id}</a> (the address does not change when the name does).</>}>
        <RowField label="Name" value={v.name.en} required maxLength={LIMITS.venueName} onCommit={(x) => save({ name: { en: x } })} />
        <RowField label="Name (فارسی)" value={v.name.fa} dir="rtl" lang="fa" maxLength={LIMITS.venueName} onCommit={(x) => save({ name: { fa: x } })} />
        <RowField label="Tagline" value={v.tagline.en} placeholder="Optional, under the name in the page description" maxLength={LIMITS.tagline} onCommit={(x) => save({ tagline: { en: x } })} />
        <RowField label="Tagline (فارسی)" value={v.tagline.fa} dir="rtl" lang="fa" maxLength={LIMITS.tagline} onCommit={(x) => save({ tagline: { fa: x } })} />
      </Group>
      <Group title="Logo">
        <LogoField venueId={v.id} logo={v.logo} tile={v.brandColors?.background} onChange={(logo) => save({ logo }, logo ? 'Logo saved' : 'Logo removed')} />
      </Group>
      {v.locations.map((l, i) => {
        const confirm = new Set(l.confirm ?? []);
        const mark = (k: string) => (confirm.has(k) ? <Badge>To confirm</Badge> : null);
        return (
          <Group key={i} title={l.label.en || `Location ${i + 1}`} hint={i === 0 ? "Shown at the bottom of the customers' page. A phone number dials exactly as written." : undefined}
            right={confirm.size > 0 ? <button type="button" className={textBtn} onClick={() => locPatch(i, { confirmed: true })}><Icon name="check" className="h-4 w-4" />Mark confirmed</button> : undefined} loc={i}>
            <RowField label="Label" maxLength={LIMITS.location} value={l.label.en} placeholder="Dine-in, Take-out…" onCommit={(x) => locPatch(i, { label: { ...l.label, en: x } })} />
            <RowField label="Label (فارسی)" maxLength={LIMITS.location} value={l.label.fa} dir="rtl" lang="fa" onCommit={(x) => locPatch(i, { label: { ...l.label, fa: x } })} />
            <RowField label="Address" maxLength={LIMITS.location} value={l.address} badge={mark('address')} onCommit={(x) => locPatch(i, { address: x })} />
            <RowField label="Phone" maxLength={LIMITS.location} value={l.phone} inputMode="text" placeholder="(905) 555 0100" badge={mark('phone')} onCommit={(x) => locPatch(i, { phone: x })} />
            <RowField label="Hours" maxLength={LIMITS.location} value={l.hours.en} placeholder="11 AM – 11 PM, every day" badge={mark('hours')} onCommit={(x) => locPatch(i, { hours: { ...l.hours, en: x } })} />
            <RowField label="Hours (فارسی)" maxLength={LIMITS.location} value={l.hours.fa} dir="rtl" lang="fa" onCommit={(x) => locPatch(i, { hours: { ...l.hours, fa: x } })} />
            {confirmRemove === i
              ? <div className="flex flex-wrap items-center gap-2 px-3 py-2 text-base"><span>Remove this location?</span><button type="button" className={btnDanger} onClick={() => { setConfirmRemove(null); void removeLocation(i); }}>Remove</button><button type="button" className={btnSecondary} onClick={() => setConfirmRemove(null)}>Cancel</button></div>
              : <div className="px-3"><button type="button" className={dangerText} onClick={() => setConfirmRemove(i)}>Remove location</button></div>}
          </Group>
        );
      })}
      <div className="px-3 pt-2"><button type="button" className={textBtn} onClick={() => { void addLocation(); }}><Icon name="plus" className="h-4 w-4" strokeWidth={2.4} />Add location</button></div>
      <Group title="Persian">
        <label className="flex min-h-11 items-center justify-between gap-4 px-3 py-2">
          <span><span className="block text-base">Show Persian drafts to customers</span><span className="block text-[13px] text-ink-muted">Off: drafted Persian (marked “Persian draft” in the menu) falls back to English on the customers&rsquo; page until it is reviewed.</span></span>
          <Switch checked={v.settings.showPersianDrafts !== false} label={`Persian drafts: ${v.settings.showPersianDrafts !== false ? 'shown' : 'hidden'}`} onChange={(x) => save({ showPersianDrafts: x })} />
        </label>
      </Group>
    </div>
  );
}

// A group (the admin's look, 2026-11-06): its small grey heading (and an action at its other end), then a white card whose rows are split by
// hairlines; a hint under the heading, a line under the card.
function Group({ title, hint, right, foot, loc, children }: { title: string; hint?: string; right?: React.ReactNode; foot?: React.ReactNode; loc?: number; children: React.ReactNode }) {
  return (
    <section data-location={loc}>
      <div className="flex min-h-11 items-end justify-between gap-3 px-3 pb-1.5 pt-6"><h2 className={headingCls} style={headingStyle}>{title}</h2>{right}</div>
      {hint && <p className="px-3 pb-2 text-[13px] text-ink-muted">{hint}</p>}
      <div className={card}>{children}</div>
      {foot && <p className="px-3 pt-1.5 text-[13px] text-ink-muted">{foot}</p>}
    </section>
  );
}

// A field as a row: its label on the left (with "To confirm" under it when the import could not check it), the value on the right in a
// one-line field as before, saved as you leave it, as everywhere in the editor (the item editor's CellText).
function RowField({ label, badge, lines, ...field }: { label: string; badge?: React.ReactNode; lines?: boolean; value: string | null | undefined; onCommit: (v: string | null) => void | Promise<void>; dir?: 'rtl' | 'ltr'; lang?: string; maxLength?: number; placeholder?: string; required?: boolean; inputMode?: 'text' | 'numeric' | 'decimal' }) {
  return (
    <label className="flex min-h-11 items-start gap-2 pl-3">
      <span className="w-28 shrink-0 pt-2.5 text-[13px] leading-5 text-ink-muted">{label}{badge && <span className="block">{badge}</span>}</span>
      <CellText label={label} lines={lines} {...field} />
    </label>
  );
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
    <div className="flex items-start gap-4 p-3">
      <span className="flex h-20 w-28 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-line p-2" style={{ background: tile || 'var(--color-fill)' }}>{logo ? <img src={logo.url} alt="" className="max-h-full max-w-full object-contain" /> : <Icon name="image" className="h-6 w-6 text-ink-muted" />}</span>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap gap-x-4">
          <label className={`${textBtn} cursor-pointer`} aria-busy={busy}>{busy ? 'Uploading…' : logo ? 'Replace logo' : 'Upload logo'}<input type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" className="sr-only" aria-label="Choose a logo file" disabled={busy} onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) void pick(f); }} /></label>
          {logo && <button type="button" className={dangerText} disabled={busy} onClick={() => { setErr(null); void onChange(null).catch((e) => setErr(e.message)); }}>Remove</button>}
        </div>
        {logo && <p className="mt-1 text-[13px] text-ink-muted">{logo.width} × {logo.height} px{logo.key ? ', uploaded' : ', from the venue files'}</p>}
        {err && <p role="alert" className="mt-1 text-[13px] text-danger">{err}</p>}
        <p className="mt-1 text-[13px] text-ink-muted">A PNG or SVG with a transparent background looks best. It is used in the header, on the welcome screen and in the admin.</p>
      </div>
    </div>
  );
}
