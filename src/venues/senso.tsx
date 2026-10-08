// Senso Café & Bites page template: the Uber Eats-style public menu kit (src/components/menu-kit.tsx) with Senso's
// header (its logo and name), navy phone links and locations footer. Kian, 2026-10-07. Redesign replaces this file only.
// Colours are tokens (src/venues/tokens.ts) read through CSS variables; Senso's defaults: the white kit with the brand
// navy on the phone links.
import type { Section, Venue } from '@/lib/types';
import { Bi } from '@/components/Bi';
import { LangToggle } from '@/components/LangToggle';
import { ItemRow, MenuDialogs, SectionTabs, slug } from '@/components/menu-kit';

export function SensoPage({ venue, sections, photos = true }: { venue: Venue; sections: Section[]; photos?: boolean }) {
  const logo = venue.brand.logo;
  let photoIndex = 0;
  return (
    <>
      <main>
        {/* Logo and language toggle only (Kian, 2026-10-07); the venue name stays as a hidden heading for screen readers and search. */}
        <header className="bg-(--c-header-bg)">
          <div className="mx-auto flex max-w-2xl items-center justify-between gap-3 px-4 pt-4 pb-3">
            {logo && <img src={logo.url} width={logo.width} height={logo.height} alt={venue.name.en ?? ''} className="h-12 w-auto shrink-0" decoding="async" />}
            <Bi as="h1" text={venue.name} className="sr-only" />
            <LangToggle />
          </div>
        </header>

        <SectionTabs sections={sections} />

        <div className="mx-auto max-w-2xl px-4 pb-16">
          {sections.map((s, n) => (
            <section key={s.id} id={slug(s.name.en ?? s.id)} data-id={s.id} className="scroll-mt-14">
              {n > 0 && <div className="section-divider" aria-hidden="true" />}
              <Bi as="h2" text={s.name} className="pt-6 text-[24px] font-bold leading-tight text-(--c-headings-title)" />
              <Bi as="p" text={s.note} className="mt-1 text-[14px] text-(--c-headings-note)" />
              <ul className="mt-3">{s.items.map((i) => <ItemRow key={i.id} item={i} eager={photoIndex++ < 1} photos={photos} />)}</ul>
            </section>
          ))}

          <footer className="mt-10 space-y-5 bg-(--c-footer-bg) text-[15px]">
            {venue.locations.map((l, n) => (
              <div key={n}>
                <Bi as="p" text={l.label} className="font-semibold text-(--c-footer-label)" />
                {l.address && <p className="text-(--c-footer-address)">{l.address}</p>}
                {l.phone && <p><a href={`tel:${l.phone.replace(/[^\d+]/g, '')}`} className="font-medium text-(--c-footer-phone) underline-offset-4 hover:underline">{l.phone}</a></p>}
                <Bi as="p" text={l.hours} className="text-(--c-footer-hours)" />
              </div>
            ))}
          </footer>
        </div>
      </main>
      <MenuDialogs sections={sections} />
    </>
  );
}
