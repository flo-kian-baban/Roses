// Default page template (step 2 of the admin rebuild): the template a venue added with "+ Add venue" gets. Its own
// look: the venue name set in the accent colour as the header (or the uploaded logo on its tile, or both: the Style tab
// decides), the accent on the active section tab and on prices, a quiet grey footer. Composes the shared menu kit
// like the two brand templates, reads its layout options from src/venues/styles.ts and its colours from the tokens
// (src/venues/tokens.ts: the venue name, active tab, prices and phone links default to the brand accent).
import type { Section, Venue, StyleValues } from '@/lib/types';
import { Bi } from '@/components/Bi';
import { LangToggle } from '@/components/LangToggle';
import { ItemList, MenuDialogs, SectionTabs, slug } from '@/components/menu-kit';

export function DefaultPage({ venue, sections, style }: { venue: Venue; sections: Section[]; style: StyleValues }) {
  const logo = venue.brand.logo;
  const header = logo ? String(style.header ?? 'name') : 'name';
  return (
    <>
      <main>
        <header className="bg-(--c-header-bg)">
          <div className="mx-auto flex max-w-2xl items-center justify-between gap-3 px-4 pt-4 pb-3">
            <div className="flex min-w-0 items-center gap-3">
              {logo && header !== 'name' && <span className="flex h-12 w-16 shrink-0 items-center justify-center rounded-xl bg-(--c-header-tile) p-1.5"><img src={logo.url} width={logo.width} height={logo.height} alt={header === 'logo' ? venue.name.en ?? '' : ''} className="max-h-full w-auto" decoding="async" /></span>}
              {header === 'logo' ? <Bi as="h1" text={venue.name} className="sr-only" /> : <Bi as="h1" text={venue.name} className="truncate text-[22px] font-bold leading-tight text-(--c-header-title)" />}
            </div>
            <LangToggle />
          </div>
          <Bi as="p" text={venue.tagline} className="mx-auto max-w-2xl px-4 pb-3 text-[15px] text-(--c-page-subtext)" />
        </header>

        <SectionTabs sections={sections} />

        <div className="mx-auto max-w-2xl px-4 pb-16">
          {sections.map((s, n) => (
            <section key={s.id} id={slug(s.name.en ?? s.id)} data-id={s.id} className="scroll-mt-12">
              {n > 0 && <div className="section-divider" aria-hidden="true" />}
              <Bi as="h2" text={s.name} className="pt-6 text-[24px] font-bold leading-tight text-(--c-headings-title)" />
              <Bi as="p" text={s.note} className="mt-1 text-[14px] text-(--c-headings-note)" />
              <ItemList section={s} first={n === 0} photos={style.photos !== false} className="default-price" />
            </section>
          ))}

          {venue.locations.length > 0 && (
            <footer className="mt-10 rounded-2xl bg-(--c-footer-bg) px-4 py-4 text-[15px]">
              {venue.locations.map((l, n) => (
                <div key={n} className={n > 0 ? 'mt-4' : ''}>
                  <Bi as="p" text={l.label} className="font-semibold text-(--c-footer-label)" />
                  {l.address && <p className="text-(--c-footer-address)">{l.address}</p>}
                  {l.phone && <p><a href={`tel:${l.phone.replace(/[^\d+]/g, '')}`} className="font-medium text-(--c-footer-phone) underline-offset-4 hover:underline">{l.phone}</a></p>}
                  <Bi as="p" text={l.hours} className="text-(--c-footer-hours)" />
                </div>
              ))}
            </footer>
          )}
        </div>
      </main>
      <MenuDialogs sections={sections} />
    </>
  );
}
