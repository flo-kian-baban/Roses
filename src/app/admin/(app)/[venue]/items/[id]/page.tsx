import { notFound, redirect } from 'next/navigation';
import { canEditNotes, canEditVenue } from '@/lib/admin/auth';
import { getVenueRow } from '@/lib/admin/venue';
import { getItem } from '@/lib/admin/items';
import { listSections } from '@/lib/admin/sections';
import { listRevisions } from '@/lib/admin/restore';
import { Badge, Card, CheckCard, Notice, PageHeader, danger, input, secondary, sm, type SP } from '../../../../_ui';
import { Icon } from '../../../../_ui/icons';
import { Shell } from '../../../../_ui/Shell';
import { Forbidden } from '../../../_forbidden';
import { adminContext } from '../../../../_ui/context';
import { HistoryCard } from '../../_shared';
import { ItemForm } from '../_form';

export const dynamic = 'force-dynamic';

export default async function EditItem({ params, searchParams }: { params: Promise<{ venue: string; id: string }>; searchParams: Promise<SP> }) {
  const { venue: venueId, id } = await params; const sp = await searchParams;
  const { session, mine } = await adminContext();
  if (!session) redirect(`/admin/${venueId}`);
  const venue = await getVenueRow(venueId);
  if (!venue) notFound();
  if (!canEditVenue(session, venueId)) return <Shell session={session} venues={mine} active="item"><Forbidden /></Shell>;
  const item = await getItem(id);
  if (!item || item.venue_id !== venueId) notFound();
  const [sections, history] = await Promise.all([listSections(venueId), listRevisions(venueId, { table: 'items', rowId: id, limit: 50 })]);
  const base = `/admin/${venueId}`; const back = `${base}/items/${id}`;
  return (
    <Shell session={session} venues={mine} venue={venue} active="item">
      <PageHeader back={{ href: base, label: 'Menu' }} eyebrow="Item" title={item.name.en}
        actions={<>{item.listed ? <Badge tone="green" className="text-sm">Listed</Badge> : <Badge className="text-sm">Unlisted</Badge>}{item.fa_draft.length > 0 && <Badge tone="blue" className="text-sm">Persian draft: {item.fa_draft.join(', ')}</Badge>}</>} />
      <Notice sp={sp} />
      <ItemForm venueId={venueId} item={item} sections={sections} back={back} />

      <div className="mt-5 grid gap-5 lg:grid-cols-2 lg:items-start">
        {canEditNotes(session) ? (
          <Card title="Allergen, dietary and halal notes" icon="shield" description="Owner and admin only; never filled automatically.">
            <form method="post" action="/api/admin/item" className="space-y-4">
              <input type="hidden" name="_action" value="notes" /><input type="hidden" name="id" value={item.id} /><input type="hidden" name="_back" value={back} />
              <label className="block"><span className="text-sm font-medium">Allergens</span><input className={input} name="notes_allergens" placeholder="nuts, dairy, gluten" defaultValue={item.notes.allergens.join(', ')} /><span className="mt-1 block text-xs text-ink-muted">Comma separated.</span></label>
              <label className="block"><span className="text-sm font-medium">Dietary</span><input className={input} name="notes_dietary" placeholder="vegetarian, vegan" defaultValue={item.notes.dietary.join(', ')} /><span className="mt-1 block text-xs text-ink-muted">Comma separated.</span></label>
              <fieldset><legend className="text-sm font-medium">Halal</legend>
                <div className="mt-1 grid grid-cols-3 gap-2">{(['unknown', 'yes', 'no'] as const).map((v) => <CheckCard key={v} type="radio" name="notes_halal" value={v} dense defaultChecked={item.notes.halal === null ? v === 'unknown' : item.notes.halal ? v === 'yes' : v === 'no'}>{v === 'unknown' ? 'Not set' : v === 'yes' ? 'Yes' : 'No'}</CheckCard>)}</div>
              </fieldset>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="block"><span className="text-sm font-medium">Note (English)</span><input className={input} name="notes_text_en" defaultValue={item.notes.text?.en ?? ''} /></label>
                <label className="block"><span className="text-sm font-medium">Note (فارسی)</span><input className={input} name="notes_text_fa" dir="rtl" lang="fa" defaultValue={item.notes.text?.fa ?? ''} /></label>
              </div>
              <button className={secondary} type="submit">Save notes</button>
            </form>
          </Card>
        ) : (
          <Card title="Allergen, dietary and halal notes" icon="shield">
            <p className="text-sm text-ink-muted">Allergen, dietary and halal notes are set by the owner or an admin.</p>
            {(item.notes.allergens.length > 0 || item.notes.dietary.length > 0 || item.notes.halal !== null) && (
              <div className="mt-3 flex flex-wrap gap-1.5">{item.notes.allergens.map((x) => <Badge key={`a-${x}`} tone="amber">{x}</Badge>)}{item.notes.dietary.map((x) => <Badge key={`d-${x}`} tone="green">{x}</Badge>)}{item.notes.halal !== null && <Badge tone="blue">halal: {item.notes.halal ? 'yes' : 'no'}</Badge>}</div>
            )}
          </Card>
        )}
        <HistoryCard history={history} back={back} venueId={venueId} description="Restore puts the item back to how it was before that change. The restore itself is recorded." />
      </div>

      <Card tone="danger" icon="trash" title="Delete this item" description="A deleted item stays in the history and can be restored from the venue history page." className="mt-5">
        <form method="post" action="/api/admin/item" className="flex flex-wrap items-center gap-3">
          <input type="hidden" name="_action" value="delete" /><input type="hidden" name="id" value={item.id} /><input type="hidden" name="_back" value={back} />
          <CheckCard name="confirm">I am sure</CheckCard>
          <button className={`${danger} ${sm} min-h-12`} type="submit"><Icon name="trash" className="h-4 w-4" />Delete item</button>
        </form>
      </Card>
    </Shell>
  );
}
