import { notFound } from 'next/navigation';
import { getSession } from '@/lib/admin/session';
import { canEditNotes, canEditVenue } from '@/lib/admin/auth';
import { getItem } from '@/lib/admin/items';
import { listSections } from '@/lib/admin/sections';
import { listRevisions } from '@/lib/admin/restore';
import { Badge, Notice, When, danger, input, secondary } from '../../../../_ui';
import { Forbidden } from '../../../_forbidden';
import { ItemForm } from '../_form';
import { price } from '@/lib/format';

export default async function EditItem({ params, searchParams }: { params: Promise<{ venue: string; id: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { venue: venueId, id } = await params; const sp = await searchParams;
  const session = (await getSession())!;
  if (!canEditVenue(session, venueId)) return <Forbidden />;
  const item = await getItem(id);
  if (!item || item.venue_id !== venueId) notFound();
  const [sections, history] = await Promise.all([listSections(venueId), listRevisions(venueId, { table: 'items', rowId: id, limit: 50 })]);
  const back = `/admin/${venueId}/items/${id}`;
  return (
    <>
      <p className="text-sm"><a className="underline" href={`/admin/${venueId}`}>← {venueId}</a></p>
      <h1 className="mt-2 text-2xl font-semibold">{item.name.en} {item.listed ? <Badge tone="green">Listed</Badge> : <Badge>Unlisted</Badge>} {item.fa_draft.length > 0 && <Badge tone="blue">Persian draft: {item.fa_draft.join(', ')}</Badge>}</h1>
      <div className="mt-4"><Notice sp={sp} /></div>
      <ItemForm venueId={venueId} item={item} sections={sections} back={back} />

      {canEditNotes(session) ? (
        <form method="post" action="/api/admin/item" className="mt-6 space-y-3 rounded-xl border border-neutral-200 bg-white p-4">
          <input type="hidden" name="_action" value="notes" /><input type="hidden" name="id" value={item.id} /><input type="hidden" name="_back" value={back} />
          <h2 className="font-semibold">Allergen, dietary and halal notes <span className="text-sm font-normal text-neutral-600">(owner and admin only; never filled automatically)</span></h2>
          <label className="block"><span className="text-sm font-medium">Allergens (comma separated)</span><input className={input} name="notes_allergens" defaultValue={item.notes.allergens.join(', ')} /></label>
          <label className="block"><span className="text-sm font-medium">Dietary (comma separated, e.g. vegetarian, vegan)</span><input className={input} name="notes_dietary" defaultValue={item.notes.dietary.join(', ')} /></label>
          <fieldset><legend className="text-sm font-medium">Halal</legend>
            <div className="mt-1 flex gap-4 text-sm">{(['unknown', 'yes', 'no'] as const).map((v) => <label key={v} className="flex min-h-11 items-center gap-2"><input type="radio" name="notes_halal" value={v} className="h-5 w-5" defaultChecked={item.notes.halal === null ? v === 'unknown' : item.notes.halal ? v === 'yes' : v === 'no'} />{v}</label>)}</div>
          </fieldset>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block"><span className="text-sm font-medium">Note (English)</span><input className={input} name="notes_text_en" defaultValue={item.notes.text?.en ?? ''} /></label>
            <label className="block"><span className="text-sm font-medium">Note (فارسی)</span><input className={input} name="notes_text_fa" dir="rtl" defaultValue={item.notes.text?.fa ?? ''} /></label>
          </div>
          <button className={secondary} type="submit">Save notes</button>
        </form>
      ) : (
        <p className="mt-6 text-sm text-neutral-600">Allergen, dietary and halal notes are set by the owner or an admin.</p>
      )}

      <section className="mt-8">
        <h2 className="font-semibold">History</h2>
        <p className="text-sm text-neutral-600">Restore puts the item back to how it was before that change. The restore itself is recorded.</p>
        <ul className="mt-2 divide-y divide-neutral-200 text-sm">
          {history.map((r) => {
            const b = r.before as { price?: string | null; listed?: boolean; name?: { en: string } } | null; const a = r.after as { price?: string | null; listed?: boolean } | null;
            return (
              <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                <span><When at={r.at} /> · <strong>{r.action}</strong> by {r.by.name} ({r.by.kind}){b && a && b.price !== a.price && <> · price {b.price != null ? price(b.price) : '—'} → {a.price != null ? price(a.price) : '—'}</>}{b && a && b.listed !== a.listed && <> · {a.listed ? 'listed' : 'unlisted'}</>}</span>
                {r.before != null && <form method="post" action="/api/admin/restore"><input type="hidden" name="revision" value={r.id} /><input type="hidden" name="_back" value={back} /><button className={`${secondary} min-h-9 px-3 py-1 text-sm`} type="submit">Restore to before this</button></form>}
              </li>
            );
          })}
          {history.length === 0 && <li className="py-2 text-neutral-600">No changes yet.</li>}
        </ul>
      </section>

      <form method="post" action="/api/admin/item" className="mt-8 flex flex-wrap items-center gap-3 rounded-xl border border-red-200 bg-white p-4">
        <input type="hidden" name="_action" value="delete" /><input type="hidden" name="id" value={item.id} /><input type="hidden" name="_back" value={back} />
        <label className="flex min-h-11 items-center gap-2 text-sm"><input type="checkbox" name="confirm" className="h-5 w-5" /> I am sure</label>
        <button className={danger} type="submit">Delete item</button>
        <span className="text-xs text-neutral-600">A deleted item stays in the history and can be restored from the venue history page.</span>
      </form>
    </>
  );
}
