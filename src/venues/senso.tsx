// Senso Café & Bites page template. Since Kian's review of 2026-10-07 it uses the white Apple-style kit of the admin
// (pure white, neutral greys, hairlines, pill chips, rounded photos) while keeping Senso's own voice: serif headings,
// navy accent, photos on the right. Only this file and src/pages/senso.tsx change at the redesign.
import type { Section, Venue, Item } from '@/lib/types';
import { price } from '@/lib/format';
import { Bi } from '@/components/Bi';
import { LangToggle } from '@/components/LangToggle';

const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9؀-ۿ]+/g, '-').replace(/^-|-$/g, '');

export function SensoPage({ venue, sections }: { venue: Venue; sections: Section[] }) {
  const logo = venue.brand.logo;
  let photoIndex = 0;
  return (
    <div className="mx-auto max-w-2xl px-4 pb-16">
      <header className="flex items-center justify-between gap-3 py-4">
        <div className="flex items-center gap-3">
          {logo && <img src={logo.url} width={logo.width} height={logo.height} alt="" className="h-10 w-auto" decoding="async" />}
          <div>
            <Bi as="h1" text={venue.name} className="text-xl font-semibold leading-tight" />
            <Bi as="p" text={venue.tagline} className="text-sm text-[var(--brand-muted)]" />
          </div>
        </div>
        <LangToggle />
      </header>

      <nav aria-label="Sections" className="glass no-scrollbar sticky top-0 z-10 -mx-4 overflow-x-auto border-b border-black/[.06] px-4 py-2">
        <ul className="flex gap-2 whitespace-nowrap">
          {sections.map((s) => (
            <li key={s.id}><a href={`#${slug(s.name.en ?? s.id)}`} className="inline-block rounded-full bg-[#f5f5f7] px-3.5 py-1.5 text-sm font-medium transition hover:bg-[#ececf0]"><Bi text={s.name} /></a></li>
          ))}
        </ul>
      </nav>

      {sections.map((s) => (
        <section key={s.id} id={slug(s.name.en ?? s.id)} className="scroll-mt-16 pt-9">
          <Bi as="h2" text={s.name} className="text-[26px] font-semibold leading-tight" />
          <Bi as="p" text={s.note} className="mt-1 text-sm text-[var(--brand-muted)]" />
          <ul className="mt-3 divide-y divide-black/[.06]">
            {s.items.map((i) => <ItemRow key={i.id} item={i} eager={photoIndex++ < 2} />)}
          </ul>
        </section>
      ))}

      <footer className="mt-12 space-y-4 rounded-[22px] bg-[#f5f5f7] p-5 text-sm">
        {venue.locations.map((l, n) => (
          <div key={n}>
            <Bi as="p" text={l.label} className="font-semibold" />
            {l.address && <p className="text-[var(--brand-muted)]">{l.address}</p>}
            {l.phone && <p><a href={`tel:${l.phone.replace(/[^\d+]/g, '')}`} className="font-medium text-[var(--brand-accent)] underline-offset-4 hover:underline">{l.phone}</a></p>}
            <Bi as="p" text={l.hours} className="text-[var(--brand-muted)]" />
          </div>
        ))}
      </footer>
    </div>
  );
}

function ItemRow({ item, eager }: { item: Item; eager: boolean }) {
  const groups = new Map<string, Item['add_ons']>();
  for (const a of item.add_ons) { const k = a.group.en ?? ''; groups.set(k, [...(groups.get(k) ?? []), a]); }
  return (
    <li className="flex gap-4 py-4">
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline justify-between gap-3">
          <Bi as="h3" text={item.name} className="font-medium" />
          {item.price != null && <span className="shrink-0 tabular-nums font-medium">{price(item.price)}</span>}
        </div>
        {item.serves && <p className="mt-0.5 text-xs uppercase tracking-wide text-[var(--brand-muted)]"><span lang="en">Serves {item.serves}</span><span lang="fa" dir="rtl">برای {item.serves} نفر</span></p>}
        <Bi as="p" text={item.description} className="mt-1 text-sm text-[var(--brand-muted)] whitespace-pre-line" />
        {item.variants.length > 0 && (
          <ul className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-sm">
            {item.variants.map((v, n) => <li key={n}><Bi text={v.label} /> {v.price != null && <span className="tabular-nums font-medium">{price(v.price)}</span>}</li>)}
          </ul>
        )}
        {[...groups.entries()].map(([k, list]) => (
          <p key={k} className="mt-1 text-sm text-[var(--brand-muted)]">
            {list[0].group.en && <><Bi text={list[0].group} />: </>}
            {list.map((a, n) => <span key={n}>{n > 0 && ' · '}<Bi text={a.label} />{a.price > 0 && <span className="tabular-nums"> +{price(a.price)}</span>}</span>)}
          </p>
        ))}
        {item.components.length > 0 && !item.description?.en && (
          <p className="mt-1 text-sm text-[var(--brand-muted)]">{item.components.map((c, n) => <span key={n}>{n > 0 && ' · '}{c.qty > 1 && `${c.qty}× `}<Bi text={c.label} /></span>)}</p>
        )}
      </div>
      {item.photo && (
        <img src={item.photo.url} alt={item.photo.alt?.en ?? ''} width={96} height={96} loading={eager ? 'eager' : 'lazy'} decoding="async"
          className="h-24 w-24 shrink-0 rounded-2xl bg-[#f5f5f7] object-cover" style={{ aspectRatio: '1 / 1' }} />
      )}
    </li>
  );
}
