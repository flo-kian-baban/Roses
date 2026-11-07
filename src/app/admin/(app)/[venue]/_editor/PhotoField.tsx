'use client';
// The photo field of the "+ Add item" sheet (moved out of ItemPanel.tsx on 2026-11-04, when the item editor got its own photo button; in the
// admin's look since the admin-wide clean-up, 2026-11-06: plain accent text to add or replace, Remove in red, 13 px lines).
import { useState } from 'react';
import type { Bi, Photo as PhotoData } from '@/lib/types';
import { Icon } from '../../../_ui/icons';
import { uploadImage } from './upload';
import { Photo } from './ui';
import { dangerText, textBtn } from '../../../_ui/look';

// The photo in the "+ Add item" sheet (step 2): uploaded from the phone's camera or photos, shrunk on the device first (see upload.ts).
export function PhotoField({ venueId, photo, alt, onChange }: { venueId: string; photo: PhotoData | null; alt: Bi; onChange: (p: PhotoData | null) => Promise<void> }) {
  const [busy, setBusy] = useState(false); const [err, setErr] = useState<string | null>(null); const [ms, setMs] = useState<number | null>(null);
  const pick = async (f: File) => {
    setBusy(true); setErr(null); const t0 = Date.now();
    try { const u = await uploadImage(venueId, 'photo', f); await onChange({ url: u.url, key: u.key, width: u.width, height: u.height, alt: photo?.alt ?? alt }); setMs(Date.now() - t0); }
    catch (e) { setErr((e as Error).message); } finally { setBusy(false); }
  };
  return (
    <div className="flex items-start gap-3" data-photo-field={busy ? 'uploading' : photo ? 'set' : 'empty'}>
      <Photo url={photo?.url} className="h-20 w-20 shrink-0 rounded-xl" />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap gap-x-4">
          <label className={`${textBtn} cursor-pointer`} aria-busy={busy}><Icon name="image" className="h-4 w-4" />{busy ? 'Uploading…' : photo ? 'Replace photo' : 'Add photo'}<input type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" aria-label="Choose a photo" disabled={busy} onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) void pick(f); }} /></label>
          {photo && <button type="button" className={dangerText} disabled={busy} onClick={() => { setErr(null); void onChange(null).catch((e) => setErr(e.message)); }}>Remove</button>}
        </div>
        {err && <p role="alert" className="mt-1 text-[13px] text-danger">{err}</p>}
        <p className="mt-1 text-[13px] text-ink-muted">{photo?.key ? `Uploaded${ms != null ? ` in ${(ms / 1000).toFixed(1)} s` : ''}.` : photo ? 'Linked from the venue’s website.' : 'From the phone’s camera or photos; large photos are shrunk before upload.'}</p>
      </div>
    </div>
  );
}
