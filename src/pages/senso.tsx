import type { GetStaticProps } from 'next';
import Head from 'next/head';
import { getPublicMenu, getVenue } from '@/lib/menu';
import type { Section, Venue } from '@/lib/types';
import { Intro, headScript } from '@/components/Intro';
import { SensoPage } from '@/venues/senso';

// Senso Café & Bites: its own page template and styles (src/venues/senso.tsx). Shared with the other venue:
// data access (src/lib/menu.ts), the language toggle and the intro logic (src/components). PM build decision of
// 2026-10-07: the venues are separate brands under the Roses parent brand and their pages must not look alike.
// Pre-rendered at build time from the database and served as plain HTML with no framework JavaScript
// (`runtime` is listed only because Next 16's type validator rejects a config object without one of its known keys).
export const config = { unstable_runtimeJS: false, runtime: 'nodejs' };

const VENUE = 'senso';
type Props = { venue: Venue; sections: Section[] };

export const getStaticProps: GetStaticProps<Props> = async () => {
  const venue = await getVenue(VENUE);
  if (!venue) return { notFound: true };
  const sections = await getPublicMenu(VENUE, venue.settings?.showPersianDrafts !== false);
  return { props: JSON.parse(JSON.stringify({ venue, sections })) };
};

export default function Senso({ venue, sections }: Props) {
  const c = venue.brand.colors ?? {};
  const f = venue.brand.fonts ?? { heading: 'serif', body: 'system-ui', persian: 'system-ui' };
  const vars = `:root{--brand-bg:${c.background ?? '#fff'};--brand-fg:${c.text ?? '#111'};--brand-accent:${c.accent ?? '#042c7c'};--brand-muted:${c.muted ?? '#6b6b6b'};--font-heading:${f.heading};--font-body:${f.body};--font-persian:${f.persian}}`;
  return (
    <>
      <Head>
        <title>{`${venue.name.en} — Menu`}</title>
        <meta name="description" content={venue.tagline.en ?? `${venue.name.en} menu`} />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        {venue.brand.logo && <link rel="icon" href={venue.brand.logo.url} />}
        {venue.brand.logo && <link rel="preload" as="image" href={venue.brand.logo.url} fetchPriority="high" />}
        <script dangerouslySetInnerHTML={{ __html: headScript(venue.id) }} />
      </Head>
      {/* In the body so it follows the global stylesheet in cascade order and wins over its :root defaults. */}
      <style dangerouslySetInnerHTML={{ __html: vars }} />
      <Intro venueId={venue.id} logo={venue.brand.logo} alt={venue.name.en ?? ''} />
      <main>
        <SensoPage venue={venue} sections={sections} />
      </main>
    </>
  );
}
