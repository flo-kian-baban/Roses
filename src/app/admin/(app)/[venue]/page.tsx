import { notFound } from 'next/navigation';
import { getSession } from '@/lib/admin/session';
import { canEditVenue, isAdmin } from '@/lib/admin/auth';
import { getVenueRow } from '@/lib/admin/venue';
import { venueMenuForAdmin, type AdminItem } from '@/lib/admin/overview';
import { listingProblem, persianMissing } from '@/lib/admin/items';
import { price } from '@/lib/format';
import { Badge, Notice, secondary, primary } from '../../_ui';
import { Forbidden } from '../_forbidden';

export default async function VenueAdmin({ params, searchParams }: { params: Promise<{ venue: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { venue: venueId } = await params; const sp = await searchParams;
  const session = (await getSession())!;
  const venue = await getVenueRow(venueId);
  if (!venue) notFound();
  if (!canEditVenue(session, venueId)) return <Forbidden />;
  const { sections, orphans } = await venueMenuForAdmin(venueId);
  const back = `/admin/${venueId}`;
  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">{venue.name.en}</h1>
        <div className="flex flex-wrap gap-2">
          <a className={primary} href={`${back}/items/new`}>New item</a>
          <a className={secondary} href={`${back}/sections/new`}>New section</a>
          <a className={secondary} href={`${back}/history`}>History</a>
          {isAdmin(session) && <a className={secondary} href={`${back}/details`}>Venue details</a>}
        </div>
      </div>
      <div className="mt-4"><Notice sp={sp} /></div>
      <p className="text-sm text-neutral-600">Listed = shown to customers. A section shows only when it is listed and has at least one listed item. An item needs a price (or a price for every size) to be listed.</p>
      {sections.map((s) => {
        const listedItems = s.items.filter((i) => i.listed).length;
        return (
          <section key={s.id} className="mt-8">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-neutral-300 pb-2">
              <h2 className="text-lg font-semibold">
                <a className="underline" href={`${back}/sections/${s.id}`}>{s.name.en}</a>
                {s.name.fa && <span lang="fa" dir="rtl" className="ml-2 text-neutral-600">{s.name.fa}</span>}
                {!s.name.fa && <span className="ml-2"><Badge tone="amber">Persian missing</Badge></span>}
                {s.fa_draft.length > 0 && <span className="ml-2"><Badge tone="blue">Persian draft</Badge></span>}
              </h2>
              <div className="flex items-center gap-2 text-sm">
                {!s.listed ? <Badge tone="red">Unlisted section</Badge> : listedItems === 0 ? <Badge tone="amber">Hidden: no listed item</Badge> : <Badge tone="green">Shown</Badge>}
                <form method="post" action="/api/admin/section"><input type="hidden" name="id" value={s.id} /><input type="hidden" name="_back" value={back} /><input type="hidden" name="_action" value={s.listed ? 'unlist' : 'list'} /><button className={`${secondary} min-h-9 px-3 py-1 text-sm`} type="submit">{s.listed ? 'Unlist section' : 'List section'}</button></form>
              </div>
            </div>
            <ul className="divide-y divide-neutral-200">{s.items.map((i) => <Row key={i.id} i={i} back={back} />)}</ul>
            {s.items.length === 0 && <p className="py-3 text-sm text-neutral-600">No items in this section.</p>}
          </section>
        );
      })}
      {orphans.length > 0 && (
        <section className="mt-8"><h2 className="border-b border-neutral-300 pb-2 text-lg font-semibold">Not in any section</h2><ul className="divide-y divide-neutral-200">{orphans.map((i) => <Row key={i.id} i={i} back={back} />)}</ul></section>
      )}
    </>
  );
}

function Row({ i, back }: { i: AdminItem; back: string }) {
  const problem = listingProblem(i);
  const missing = persianMissing(i);
  return (
    <li className="flex items-start gap-3 py-3">
      {i.photo?.url ? <img src={i.photo.url} alt="" width={48} height={48} className="h-12 w-12 shrink-0 rounded object-cover" loading="lazy" /> : <div className="h-12 w-12 shrink-0 rounded bg-neutral-100" />}
      <div className="min-w-0 flex-1">
        <a className="font-medium underline" href={`${back}/items/${i.id}`}>{i.name.en}</a>
        {i.name.fa && <span lang="fa" dir="rtl" className="ml-2 text-sm text-neutral-600">{i.name.fa}</span>}
        <p className="mt-1 text-sm text-neutral-700">
          {i.price != null ? price(i.price) : i.variants.length ? i.variants.map((v) => `${v.label.en} ${v.price != null ? price(v.price) : '—'}`).join(' · ') : <span className="text-neutral-500">no price</span>}
        </p>
        <p className="mt-1 flex flex-wrap gap-1.5">
          {i.listed ? <Badge tone="green">Listed</Badge> : <Badge>Unlisted</Badge>}
          {problem && <Badge tone="amber">Needs price</Badge>}
          {i.listed && missing.length > 0 && <Badge tone="amber">Persian missing: {missing.join(', ')}</Badge>}
          {i.fa_draft.length > 0 && <Badge tone="blue">Persian draft</Badge>}
        </p>
      </div>
      <form method="post" action="/api/admin/item" className="shrink-0">
        <input type="hidden" name="id" value={i.id} /><input type="hidden" name="_back" value={back} /><input type="hidden" name="_action" value={i.listed ? 'unlist' : 'list'} />
        <button className={`${secondary} min-h-10 px-3 text-sm`} type="submit" disabled={!i.listed && !!problem} title={!i.listed && problem ? problem : undefined}>{i.listed ? 'Unlist' : 'List'}</button>
      </form>
    </li>
  );
}
