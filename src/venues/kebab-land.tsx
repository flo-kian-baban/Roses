// Roses Kebab Land page template. Since Kian's review of 2026-10-07 it uses the white Apple-style kit of the admin
// (pure white, neutral greys, hairlines, rounded photos) while keeping Kebab Land's own voice: bold uppercase
// headings in the brand red, the logo on its dark tile, photos on the left. One menu, two locations in the footer.
// Sizes ("6 oz / 9 oz", "1-shot / Bottle"), "Serves N" and combos come from the import. Redesign replaces this file only.
import type { Section, Venue, Item } from '@/lib/types';
import { price } from '@/lib/format';
import { Bi } from '@/components/Bi';
import { LangToggle } from '@/components/LangToggle';

const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9؀-ۿ]+/g, '-').replace(/^-|-$/g, '');

export function KebabLandPage({ venue, sections }: { venue: Venue; sections: Section[] }) {
  const logo = venue.brand.logo;
  let photoIndex = 0;
  return (
    <div className="mx-auto max-w-2xl px-4 pb-16">
      <header className="flex items-center justify-between gap-3 py-4">
        <div className="flex items-center gap-3">
          {logo && <span className="flex h-12 w-16 shrink-0 items-center justify-center rounded-2xl p-1.5 ring-1 ring-black/5" style={{ background: 'var(--brand-tile)' }}><img src={logo.url} width={logo.width} height={logo.height} alt="" className="max-h-full w-auto" decoding="async" /></span>}
          <div>
            <Bi as="h1" text={venue.name} className="text-lg font-bold uppercase tracking-wide leading-tight" />
            <Bi as="p" text={venue.tagline} className="text-xs text-[var(--brand-muted)]" />
          </div>
        </div>
        <LangToggle />
      </header>

      <nav aria-label="Sections" className="glass no-scrollbar sticky top-0 z-10 -mx-4 overflow-x-auto border-b border-black/[.06] px-4 py-2">
        <ul className="flex gap-2 whitespace-nowrap">
          {sections.map((s) => (
            <li key={s.id}><a href={`#${slug(s.name.en ?? s.id)}`} className="inline-block rounded-full border border-[var(--brand-accent)] px-3.5 py-1.5 text-xs font-semibold uppercase tracking-wide text-[var(--brand-accent)] transition hover:bg-[var(--brand-accent)] hover:text-white"><Bi text={s.name} /></a></li>
          ))}
        </ul>
      </nav>

      {sections.map((s) => (
        <section key={s.id} id={slug(s.name.en ?? s.id)} className="scroll-mt-16 pt-9">
          <Bi as="h2" text={s.name} className="text-2xl font-bold uppercase tracking-wider text-[var(--brand-accent)]" />
          <Bi as="p" text={s.note} className="mt-1 text-sm text-[var(--brand-muted)]" />
          <ul className="mt-3 divide-y divide-black/[.06]">
            {s.items.map((i) => <ItemRow key={i.id} item={i} eager={photoIndex++ < 2} />)}
          </ul>
        </section>
      ))}

      <footer className="mt-12 space-y-5 rounded-[22px] bg-[#f5f5f7] p-5 text-sm">
        {venue.locations.map((l, n) => (
          <div key={n}>
            <Bi as="p" text={l.label} className="font-semibold uppercase tracking-wide text-[var(--brand-accent)]" />
            {l.address && <p>{l.address}</p>}
            {l.phone && <p><a href={`tel:${l.phone.replace(/[^\d+]/g, '')}`} className="font-medium text-[var(--brand-accent)] underline-offset-4 hover:underline">{l.phone}</a></p>}
            <Bi as="p" text={l.hours} className="text-[var(--brand-muted)]" />
          </div>
        ))}
      </footer>
    </div>
  );
}

function ItemRow({ item, eager }: { item: Item; eager: boolean }) {
  return (
    <li className="flex gap-4 py-4">
      {item.photo && (
        <img src={item.photo.url} alt={item.photo.alt?.en ?? ''} width={80} height={80} loading={eager ? 'eager' : 'lazy'} decoding="async"
          className="h-20 w-20 shrink-0 rounded-2xl bg-[#f5f5f7] object-cover" style={{ aspectRatio: '1 / 1' }} />
      )}
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline justify-between gap-3">
          <Bi as="h3" text={item.name} className="font-semibold" />
          {item.price != null && <span className="shrink-0 tabular-nums font-semibold text-[var(--brand-price)]">{price(item.price)}</span>}
        </div>
        {item.serves && <p className="mt-0.5 text-xs uppercase tracking-wide text-[var(--brand-muted)]"><span lang="en">Serves {item.serves}</span><span lang="fa" dir="rtl">برای {item.serves} نفر</span></p>}
        <Bi as="p" text={item.description} className="mt-1 text-sm text-[var(--brand-muted)] whitespace-pre-line" />
        {item.variants.length > 0 && (
          <ul className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-sm">
            {item.variants.map((v, n) => <li key={n}><Bi text={v.label} /> {v.price != null && <span className="tabular-nums font-semibold text-[var(--brand-price)]">{price(v.price)}</span>}</li>)}
          </ul>
        )}
        {item.components.length > 0 && !item.description?.en && (
          <p className="mt-1 text-sm text-[var(--brand-muted)]">{item.components.map((c, n) => <span key={n}>{n > 0 && ' · '}{c.qty > 1 && `${c.qty}× `}<Bi text={c.label} /></span>)}</p>
        )}
      </div>
    </li>
  );
}
