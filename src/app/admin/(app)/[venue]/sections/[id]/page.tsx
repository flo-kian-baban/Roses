import { notFound, redirect } from 'next/navigation';
import { canEditVenue } from '@/lib/admin/auth';
import { getVenueRow } from '@/lib/admin/venue';
import { getSection } from '@/lib/admin/sections';
import { venueMenuForAdmin } from '@/lib/admin/overview';
import { listRevisions } from '@/lib/admin/restore';
import { price } from '@/lib/format';
import { Badge, BiFields, Card, Field, Notice, PageHeader, Photo, Switch, primary, secondary, type SP } from '../../../../_ui';
import { Shell } from '../../../../_ui/Shell';
import { Forbidden } from '../../../_forbidden';
import { adminContext } from '../../../../_ui/context';
import { HistoryCard, SectionStatus } from '../../_shared';

export const dynamic = 'force-dynamic';

export default async function EditSection({ params, searchParams }: { params: Promise<{ venue: string; id: string }>; searchParams: Promise<SP> }) {
  const { venue: venueId, id } = await params; const sp = await searchParams;
  const { session, mine } = await adminContext();
  if (!session) redirect(`/admin/${venueId}`);
  const venue = await getVenueRow(venueId);
  if (!venue) notFound();
  if (!canEditVenue(session, venueId)) return <Shell session={session} venues={mine} active="section"><Forbidden /></Shell>;
  const s = await getSection(id);
  if (!s || s.venue_id !== venueId) notFound();
  const [history, { sections }] = await Promise.all([listRevisions(venueId, { table: 'sections', rowId: id, limit: 30 }), venueMenuForAdmin(venueId)]);
  const items = sections.find((x) => x.id === id)?.items ?? [];
  const base = `/admin/${venueId}`; const back = `${base}/sections/${id}`;
  return (
    <Shell session={session} venues={mine} venue={venue} active="section">
      <PageHeader back={{ href: `${base}/sections`, label: 'Sections' }} eyebrow="Section" title={s.name.en} actions={<SectionStatus s={{ listed: s.listed, items }} />} />
      <Notice sp={sp} />
      <div className="grid gap-5 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)] lg:items-start">
        <form method="post" action="/api/admin/section" className="space-y-5">
          <input type="hidden" name="_action" value="save" /><input type="hidden" name="id" value={s.id} /><input type="hidden" name="_back" value={back} />
          <Card title="Name" icon="tag">
            <div className="space-y-4">
              <BiFields label="Section name" name="name" value={s.name} missing={!s.name.fa} required />
              <BiFields label="Note under the heading" name="note" value={s.note} />
            </div>
          </Card>
          <Card title="Where it shows" icon="eye">
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Order" name="position" value={s.position} inputMode="numeric" hint="Lower comes first on the public page." />
              <div><span className="text-sm font-medium">Shown to customers</span><div className="mt-1"><Switch name="listed" label="Listed" hint="Shows once it has a listed item." defaultChecked={s.listed} /></div></div>
            </div>
          </Card>
          <div className="save-bar sticky z-20 -mx-4 flex items-center gap-2 border-t border-line bg-white/95 px-4 py-3 backdrop-blur sm:-mx-6 sm:px-6 lg:static lg:mx-0 lg:border-0 lg:bg-transparent lg:p-0">
            <button className={`${primary} flex-1 sm:flex-none sm:min-w-40`} type="submit">Save</button>
            <a className={secondary} href={`${base}/sections`}>Cancel</a>
          </div>
        </form>
        <div className="space-y-5">
          <Card title="Items in this section" icon="utensils" description={items.length ? `${items.length} item${items.length === 1 ? '' : 's'}, ${items.filter((i) => i.listed).length} listed` : 'None yet. Open an item and tick this section.'}>
            {items.length > 0 && (
              <ul className="divide-y divide-line">
                {items.map((i) => (
                  <li key={i.id} className="flex items-center gap-3 py-2 first:pt-0 last:pb-0">
                    <Photo url={i.photo?.url} className="h-11 w-11 shrink-0 rounded-lg" />
                    <a href={`${base}/items/${i.id}`} className="min-w-0 flex-1 truncate text-[15px] font-medium underline-offset-4 hover:underline">{i.name.en}</a>
                    <span className="text-sm tabular-nums text-ink-muted">{i.price != null ? price(i.price) : i.variants.length ? `${i.variants.length} sizes` : ''}</span>
                    {i.listed ? <Badge tone="green">Listed</Badge> : <Badge>Unlisted</Badge>}
                  </li>
                ))}
              </ul>
            )}
          </Card>
          <HistoryCard history={history} back={back} venueId={venueId} />
        </div>
      </div>
    </Shell>
  );
}
