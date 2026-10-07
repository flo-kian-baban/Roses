import type { ItemRow, Placement } from '@/lib/admin/items';
import type { SectionRow } from '@/lib/admin/sections';
import { listingProblem, persianMissing } from '@/lib/admin/items';
import { Badge, BiFields, Field, input, primary } from '../../../_ui';

type Props = { venueId: string; item: (ItemRow & { placements: Placement[] }) | null; sections: SectionRow[]; back: string };

// One form for create and edit. Sizes, add-ons and combo parts are fixed rows (existing ones plus two empty).
export function ItemForm({ venueId, item, sections, back }: Props) {
  const v = item?.variants ?? []; const a = item?.add_ons ?? []; const c = item?.components ?? [];
  const chosen = new Set((item?.placements ?? []).map((p) => p.section_id));
  const missing = item ? persianMissing(item) : [];
  const problem = item ? listingProblem(item) : null;
  return (
    <form method="post" action="/api/admin/item" className="space-y-6 rounded-xl border border-neutral-200 bg-white p-4">
      <input type="hidden" name="_action" value={item ? 'save' : 'create'} />
      {item ? <input type="hidden" name="id" value={item.id} /> : <input type="hidden" name="venue" value={venueId} />}
      <input type="hidden" name="_back" value={back} />

      <BiFields label="Name" name="name" value={item?.name} missing={missing.includes('name')} />
      <BiFields label="Description" name="description" value={item?.description} long missing={missing.includes('description')} />

      <div className="grid gap-3 sm:grid-cols-3">
        <Field label="Price (CAD)" name="price" value={item?.price ?? ''} inputMode="decimal" hint="Leave empty when the item has sizes with their own prices." />
        <Field label="Serves" name="serves" value={item?.serves ?? ''} hint='For platters: "2" or "3-4".' />
        <label className="block">
          <span className="text-sm font-medium">Shown to customers</span>
          <span className="mt-1 flex min-h-11 items-center gap-3 rounded-lg border border-neutral-300 px-3">
            <input type="checkbox" name="listed" className="h-5 w-5" defaultChecked={item?.listed ?? false} />
            <span>Listed</span>
          </span>
          {problem && <span className="mt-1 block text-xs text-amber-800">{problem}</span>}
        </label>
      </div>

      <fieldset>
        <legend className="text-sm font-medium">Sections</legend>
        <div className="mt-2 grid gap-2 sm:grid-cols-2">
          {sections.map((s) => (
            <label key={s.id} className="flex min-h-11 items-center gap-3 rounded-lg border border-neutral-300 px-3">
              <input type="checkbox" name="section_ids" value={s.id} className="h-5 w-5" defaultChecked={chosen.has(s.id)} />
              <span>{s.name.en}{!s.listed && <Badge> unlisted</Badge>}</span>
            </label>
          ))}
        </div>
      </fieldset>

      <fieldset>
        <legend className="text-sm font-medium">Sizes {missing.includes('sizes') && <Badge tone="amber">Persian missing</Badge>}</legend>
        <p className="text-xs text-neutral-600">For example 6 oz / 9 oz or 1-shot / Bottle, each with its price. Clear a row to remove it.</p>
        <div className="mt-2 space-y-2">
          {[...v, { label: { en: '', fa: '' }, price: null }, { label: { en: '', fa: '' }, price: null }].map((row, n) => (
            <div key={n} className="grid grid-cols-3 gap-2">
              <input className={input} name={`v${n}_en`} placeholder="Size (English)" defaultValue={row.label.en ?? ''} />
              <input className={input} name={`v${n}_fa`} placeholder="فارسی" dir="rtl" defaultValue={row.label.fa ?? ''} />
              <input className={input} name={`v${n}_price`} placeholder="Price" inputMode="decimal" defaultValue={row.price ?? ''} />
            </div>
          ))}
        </div>
      </fieldset>

      <fieldset>
        <legend className="text-sm font-medium">Add-ons and choices</legend>
        <p className="text-xs text-neutral-600">Group (for example "Milk"), choice (for example "Lactose Free"), extra price (0 when free).</p>
        <div className="mt-2 space-y-2">
          {[...a, { group: { en: '', fa: '' }, label: { en: '', fa: '' }, price: 0, required: false }, { group: { en: '', fa: '' }, label: { en: '', fa: '' }, price: 0, required: false }].map((row, n) => (
            <div key={n} className="grid grid-cols-2 gap-2 sm:grid-cols-6">
              <input className={input} name={`a${n}_group_en`} placeholder="Group (English)" defaultValue={row.group.en ?? ''} />
              <input className={input} name={`a${n}_group_fa`} placeholder="گروه" dir="rtl" defaultValue={row.group.fa ?? ''} />
              <input className={input} name={`a${n}_en`} placeholder="Choice (English)" defaultValue={row.label.en ?? ''} />
              <input className={input} name={`a${n}_fa`} placeholder="گزینه" dir="rtl" defaultValue={row.label.fa ?? ''} />
              <input className={input} name={`a${n}_price`} placeholder="+ price" inputMode="decimal" defaultValue={row.label.en ? row.price : ''} />
              <label className="flex min-h-11 items-center gap-2 px-1 text-sm"><input type="checkbox" name={`a${n}_required`} className="h-5 w-5" defaultChecked={row.required} /> required</label>
            </div>
          ))}
        </div>
      </fieldset>

      <fieldset>
        <legend className="text-sm font-medium">Combo parts</legend>
        <p className="text-xs text-neutral-600">For dishes made of other dishes (platters, mixed kebabs). Quantity and name; the item it links to is optional.</p>
        <div className="mt-2 space-y-2">
          {[...c, { item_id: null, label: { en: '', fa: '' }, qty: 1 }, { item_id: null, label: { en: '', fa: '' }, qty: 1 }].map((row, n) => (
            <div key={n} className="grid grid-cols-4 gap-2">
              <input className={input} name={`c${n}_qty`} placeholder="Qty" inputMode="numeric" defaultValue={row.label.en ? row.qty : ''} />
              <input className={input} name={`c${n}_en`} placeholder="Part (English)" defaultValue={row.label.en ?? ''} />
              <input className={input} name={`c${n}_fa`} placeholder="فارسی" dir="rtl" defaultValue={row.label.fa ?? ''} />
              <input className={input} name={`c${n}_item_id`} placeholder="Linked item id (optional)" defaultValue={row.item_id ?? ''} />
            </div>
          ))}
        </div>
      </fieldset>

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="sm:col-span-3"><Field label="Photo (web address)" name="photo_url" value={item?.photo?.url ?? ''} inputMode="url" hint="Photos are linked, not uploaded, for the MVP." /></div>
        <Field label="Photo text (English)" name="photo_alt_en" value={item?.photo?.alt?.en ?? ''} />
        <Field label="Photo text (فارسی)" name="photo_alt_fa" value={item?.photo?.alt?.fa ?? ''} dir="rtl" />
      </div>
      {item?.photo?.url && <img src={item.photo.url} alt="" className="h-24 w-24 rounded object-cover" />}

      <button className={`${primary} w-full sm:w-auto`} type="submit">{item ? 'Save' : 'Create item'}</button>
    </form>
  );
}
