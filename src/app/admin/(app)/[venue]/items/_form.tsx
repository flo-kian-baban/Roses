import type { ItemRow, Placement } from '@/lib/admin/items';
import type { SectionRow } from '@/lib/admin/sections';
import { listingProblem, persianMissing } from '@/lib/admin/items';
import { Badge, BiFields, Card, CheckCard, Field, Photo, Switch, input, primary, secondary } from '../../../_ui';
import { Icon } from '../../../_ui/icons';

type Props = { venueId: string; item: (ItemRow & { placements: Placement[] }) | null; sections: SectionRow[]; back: string };

// One form for create and edit. Sizes, add-ons and combo parts are fixed rows (existing ones plus two empty).
// Field names are the API contract (src/pages/api/admin/item.ts); only the layout is new.
export function ItemForm({ venueId, item, sections, back }: Props) {
  const v = item?.variants ?? []; const a = item?.add_ons ?? []; const c = item?.components ?? [];
  const chosen = new Set((item?.placements ?? []).map((p) => p.section_id));
  const missing = item ? persianMissing(item) : [];
  const problem = item ? listingProblem(item) : null;
  const cancel = `/admin/${venueId}`;
  return (
    <form method="post" action="/api/admin/item" className="space-y-5">
      <input type="hidden" name="_action" value={item ? 'save' : 'create'} />
      {item ? <input type="hidden" name="id" value={item.id} /> : <input type="hidden" name="venue" value={venueId} />}
      <input type="hidden" name="_back" value={back} />

      <div className="grid gap-5 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)] lg:items-start">
        <div className="space-y-5">
          <Card title="Name and description" icon="tag">
            <div className="space-y-4">
              <BiFields label="Name" name="name" value={item?.name} missing={missing.includes('name')} required />
              <BiFields label="Description" name="description" value={item?.description} long missing={missing.includes('description')} />
            </div>
          </Card>

          <Card title="Price" icon="dollar" description="One price, or a price for every size.">
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Price (CAD)" name="price" value={item?.price ?? ''} inputMode="decimal" prefix="$" placeholder="0.00" hint="Leave empty when the item has sizes with their own prices." />
              <Field label="Serves" name="serves" value={item?.serves ?? ''} placeholder="2 or 3-4" hint="For platters. Optional." />
            </div>
            <fieldset className="mt-5">
              <legend className="flex items-center gap-2 text-sm font-medium">Sizes {missing.includes('sizes') && <Badge tone="amber">Persian missing</Badge>}</legend>
              <p className="mt-0.5 text-xs text-ink-muted">For example 6 oz / 9 oz or 1-shot / Bottle, each with its price. Clear a row to remove it.</p>
              <div className="mt-2 space-y-2">
                <div className="hidden grid-cols-[1fr_1fr_7rem] gap-2 px-1 text-xs font-medium text-ink-muted sm:grid"><span>Size (English)</span><span>فارسی</span><span>Price</span></div>
                {[...v, { label: { en: '', fa: '' }, price: null }, { label: { en: '', fa: '' }, price: null }].map((row, n) => (
                  <div key={n} className="grid grid-cols-[1fr_1fr_5.5rem] gap-2 sm:grid-cols-[1fr_1fr_7rem]">
                    <input className={`${input} mt-0`} name={`v${n}_en`} placeholder="Size" defaultValue={row.label.en ?? ''} />
                    <input className={`${input} mt-0`} name={`v${n}_fa`} placeholder="فارسی" dir="rtl" lang="fa" defaultValue={row.label.fa ?? ''} />
                    <input className={`${input} mt-0`} name={`v${n}_price`} placeholder="$" inputMode="decimal" defaultValue={row.price ?? ''} />
                  </div>
                ))}
              </div>
            </fieldset>
          </Card>

          <details className="group rounded-[22px] border border-line bg-white shadow-card" open={a.length > 0}>
            <summary className="flex items-center justify-between gap-3 p-4 sm:p-5">
              <span className="flex items-start gap-3"><span className="mt-0.5 rounded-lg bg-accent-soft p-1.5 text-accent-strong"><Icon name="sparkle" className="h-4 w-4" /></span><span><span className="block text-[17px] font-semibold leading-tight">Add-ons and choices</span><span className="mt-1 block text-sm text-ink-muted">{a.length ? `${a.length} choice${a.length === 1 ? '' : 's'}` : 'None yet'} · tap to open</span></span></span>
              <Icon name="down" className="h-5 w-5 shrink-0 text-ink-muted transition group-open:rotate-180" />
            </summary>
            <div className="border-t border-line p-4 sm:p-5">
              <p className="text-xs text-ink-muted">Group (for example “Milk”), choice (for example “Lactose Free”), extra price (0 when free).</p>
              <div className="mt-3 space-y-3">
                {[...a, { group: { en: '', fa: '' }, label: { en: '', fa: '' }, price: 0, required: false }, { group: { en: '', fa: '' }, label: { en: '', fa: '' }, price: 0, required: false }].map((row, n) => (
                  <div key={n} className="grid grid-cols-2 gap-2 rounded-xl bg-canvas p-2 sm:grid-cols-6 sm:bg-transparent sm:p-0">
                    <input className={`${input} mt-0`} name={`a${n}_group_en`} placeholder="Group (English)" defaultValue={row.group.en ?? ''} />
                    <input className={`${input} mt-0`} name={`a${n}_group_fa`} placeholder="گروه" dir="rtl" lang="fa" defaultValue={row.group.fa ?? ''} />
                    <input className={`${input} mt-0`} name={`a${n}_en`} placeholder="Choice (English)" defaultValue={row.label.en ?? ''} />
                    <input className={`${input} mt-0`} name={`a${n}_fa`} placeholder="گزینه" dir="rtl" lang="fa" defaultValue={row.label.fa ?? ''} />
                    <input className={`${input} mt-0`} name={`a${n}_price`} placeholder="+ price" inputMode="decimal" defaultValue={row.label.en ? row.price : ''} />
                    <label className="flex min-h-11 items-center gap-2 px-1 text-sm"><input type="checkbox" name={`a${n}_required`} className="check" defaultChecked={row.required} /> required</label>
                  </div>
                ))}
              </div>
            </div>
          </details>

          <details className="group rounded-[22px] border border-line bg-white shadow-card" open={c.length > 0}>
            <summary className="flex items-center justify-between gap-3 p-4 sm:p-5">
              <span className="flex items-start gap-3"><span className="mt-0.5 rounded-lg bg-accent-soft p-1.5 text-accent-strong"><Icon name="layers" className="h-4 w-4" /></span><span><span className="block text-[17px] font-semibold leading-tight">Combo parts</span><span className="mt-1 block text-sm text-ink-muted">{c.length ? `${c.length} part${c.length === 1 ? '' : 's'}` : 'For platters and mixed kebabs'} · tap to open</span></span></span>
              <Icon name="down" className="h-5 w-5 shrink-0 text-ink-muted transition group-open:rotate-180" />
            </summary>
            <div className="border-t border-line p-4 sm:p-5">
              <p className="text-xs text-ink-muted">For dishes made of other dishes. Quantity and name; the item it links to is optional.</p>
              <div className="mt-3 space-y-2">
                {[...c, { item_id: null, label: { en: '', fa: '' }, qty: 1 }, { item_id: null, label: { en: '', fa: '' }, qty: 1 }].map((row, n) => (
                  <div key={n} className="grid grid-cols-[4rem_1fr_1fr] gap-2 sm:grid-cols-[4rem_1fr_1fr_1fr]">
                    <input className={`${input} mt-0`} name={`c${n}_qty`} placeholder="Qty" inputMode="numeric" defaultValue={row.label.en ? row.qty : ''} />
                    <input className={`${input} mt-0`} name={`c${n}_en`} placeholder="Part (English)" defaultValue={row.label.en ?? ''} />
                    <input className={`${input} mt-0`} name={`c${n}_fa`} placeholder="فارسی" dir="rtl" lang="fa" defaultValue={row.label.fa ?? ''} />
                    <input className={`${input} mt-0 col-span-3 sm:col-span-1`} name={`c${n}_item_id`} placeholder="Linked item id (optional)" defaultValue={row.item_id ?? ''} />
                  </div>
                ))}
              </div>
            </div>
          </details>
        </div>

        <div className="space-y-5">
          <Card title="Where it shows" icon="eye">
            <Switch name="listed" label="Shown to customers" hint={problem ? problem : 'Listed items appear on the public page right after Save.'} defaultChecked={item?.listed ?? false} />
            <fieldset className="mt-4">
              <legend className="text-sm font-medium">Sections</legend>
              <div className="mt-2 grid gap-2">
                {sections.map((s) => <CheckCard key={s.id} name="section_ids" value={s.id} defaultChecked={chosen.has(s.id)}>{s.name.en}{!s.listed && <Badge className="ml-2">unlisted</Badge>}</CheckCard>)}
                {sections.length === 0 && <p className="text-sm text-ink-muted">No sections yet.</p>}
              </div>
            </fieldset>
          </Card>

          <Card title="Photo" icon="image" description="Linked from a web address; nothing is uploaded in the MVP.">
            <Photo url={item?.photo?.url} className="aspect-[4/3] w-full rounded-xl" />
            <div className="mt-3 space-y-3">
              <Field label="Photo (web address)" name="photo_url" value={item?.photo?.url ?? ''} inputMode="url" placeholder="https://…" />
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Photo text (English)" name="photo_alt_en" value={item?.photo?.alt?.en ?? ''} />
                <Field label="Photo text (فارسی)" name="photo_alt_fa" value={item?.photo?.alt?.fa ?? ''} dir="rtl" />
              </div>
            </div>
          </Card>
        </div>
      </div>

      <div className="save-bar sticky z-20 -mx-4 flex items-center gap-2 border-t border-line glass px-4 py-3 sm:-mx-6 sm:px-6 lg:-mx-10 lg:px-10">
        <button className={`${primary} flex-1 sm:flex-none sm:min-w-40`} type="submit">{item ? 'Save' : 'Create item'}</button>
        <a className={secondary} href={cancel}>Cancel</a>
        {item && <span className="ml-auto hidden text-xs text-ink-muted sm:block">The public page updates right after Save.</span>}
      </div>
    </form>
  );
}
