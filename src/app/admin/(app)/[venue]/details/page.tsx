import { notFound } from 'next/navigation';
import { getSession } from '@/lib/admin/session';
import { isAdmin } from '@/lib/admin/auth';
import { getVenueRow } from '@/lib/admin/venue';
import { listRevisions } from '@/lib/admin/restore';
import { Badge, BiFields, Field, Notice, When, primary, secondary } from '../../../_ui';
import { Forbidden } from '../../_forbidden';

export default async function Details({ params, searchParams }: { params: Promise<{ venue: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { venue: venueId } = await params; const sp = await searchParams;
  const session = (await getSession())!;
  if (!isAdmin(session)) return <Forbidden what="venue details (main admin only)" />;
  const v = await getVenueRow(venueId);
  if (!v) notFound();
  const history = await listRevisions(venueId, { table: 'venues', limit: 30 });
  const back = `/admin/${venueId}/details`;
  const locs = [...v.locations, { label: { en: '', fa: '' }, address: '', phone: '', hours: { en: '', fa: '' } }];
  return (
    <>
      <p className="text-sm"><a className="underline" href={`/admin/${venueId}`}>← {venueId}</a></p>
      <h1 className="mt-2 text-2xl font-semibold">Venue details</h1>
      <div className="mt-4"><Notice sp={sp} /></div>
      <form method="post" action="/api/admin/venue" className="space-y-6 rounded-xl border border-neutral-200 bg-white p-4">
        <input type="hidden" name="id" value={v.id} /><input type="hidden" name="_back" value={back} />
        <BiFields label="Venue name" name="name" value={v.name} />
        <BiFields label="Tagline" name="tagline" value={v.tagline} />
        <fieldset className="space-y-4">
          <legend className="text-sm font-medium">Locations <span className="font-normal text-neutral-600">(tap-to-call dials exactly the number as written here)</span></legend>
          {locs.map((l, n) => (
            <div key={n} className="space-y-3 rounded-lg border border-neutral-300 p-3">
              <p className="text-sm font-medium">{n < v.locations.length ? `Location ${n + 1}` : 'Add a location'} {l.confirm?.length ? <Badge tone="amber">to confirm: {l.confirm.join(', ')}</Badge> : null}</p>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Label (English)" name={`l${n}_label_en`} value={l.label?.en ?? ''} />
                <Field label="Label (فارسی)" name={`l${n}_label_fa`} value={l.label?.fa ?? ''} dir="rtl" />
              </div>
              <Field label="Address" name={`l${n}_address`} value={l.address ?? ''} />
              <Field label="Phone (as it should be displayed and dialled)" name={`l${n}_phone`} value={l.phone ?? ''} inputMode="text" />
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Hours (English)" name={`l${n}_hours_en`} value={l.hours?.en ?? ''} hint="Optional." />
                <Field label="Hours (فارسی)" name={`l${n}_hours_fa`} value={l.hours?.fa ?? ''} dir="rtl" />
              </div>
              {l.confirm?.length ? <label className="flex min-h-11 items-center gap-2 text-sm"><input type="checkbox" name={`l${n}_confirmed`} className="h-5 w-5" /> Confirmed with the owner (clears the "to confirm" marks)</label> : null}
            </div>
          ))}
        </fieldset>
        <label className="flex min-h-11 items-center gap-3 rounded-lg border border-neutral-300 px-3">
          <input type="checkbox" name="showPersianDrafts" className="h-5 w-5" defaultChecked={v.settings?.showPersianDrafts !== false} />
          <span>Show Persian drafts to customers <span className="text-sm text-neutral-600">(off: drafted Persian falls back to English until reviewed)</span></span>
        </label>
        <button className={primary} type="submit">Save venue details</button>
      </form>
      <section className="mt-8">
        <h2 className="font-semibold">History</h2>
        <ul className="mt-2 divide-y divide-neutral-200 text-sm">
          {history.map((r) => (
            <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
              <span><When at={r.at} /> · <strong>{r.action}</strong> by {r.by.name}</span>
              {r.before != null && <form method="post" action="/api/admin/restore"><input type="hidden" name="revision" value={r.id} /><input type="hidden" name="_back" value={back} /><button className={`${secondary} min-h-9 px-3 py-1 text-sm`} type="submit">Restore to before this</button></form>}
            </li>
          ))}
          {history.length === 0 && <li className="py-2 text-neutral-600">No changes yet.</li>}
        </ul>
      </section>
      <p className="mt-6 text-xs text-neutral-600">Logo, colours and fonts are set in the build (import files); they are not edited here in the MVP.</p>
    </>
  );
}
