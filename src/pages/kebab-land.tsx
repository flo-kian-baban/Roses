import type { GetStaticProps } from 'next';
import Head from 'next/head';
import { getPublicMenu, getVenue } from '@/lib/menu';
import type { Section, Venue } from '@/lib/types';
import { Intro, headScript } from '@/components/Intro';
import { KebabLandPage } from '@/venues/kebab-land';

// Roses Kebab Land: its own page template and styles (src/venues/kebab-land.tsx), functional only for the MVP
// (Kian's decision after Checkpoint A2; the design comes with the post-MVP redesign). Shared with Senso: data access,
// the language toggle and the intro logic. Pre-rendered at build time, plain HTML, no framework JavaScript.
export const config = { unstable_runtimeJS: false, runtime: 'nodejs' };

const VENUE = 'kebab-land';
type Props = { venue: Venue; sections: Section[] };

export const getStaticProps: GetStaticProps<Props> = async () => {
  const venue = await getVenue(VENUE);
  if (!venue) return { notFound: true };
  const sections = await getPublicMenu(VENUE, venue.settings?.showPersianDrafts !== false);
  return { props: JSON.parse(JSON.stringify({ venue, sections })) };
};

export default function KebabLand({ venue, sections }: Props) {
  const c = venue.brand.colors ?? {};
  const f = venue.brand.fonts ?? { heading: 'serif', body: 'system-ui', persian: 'system-ui' };
  // The venue's own colours (sources in the import report): dark background, white text, red accent, gold prices.
  const vars = `:root{--brand-bg:${c.background ?? '#141414'};--brand-fg:${c.text ?? '#fff'};--brand-accent:${c.accent ?? '#b92e2e'};--brand-price:${c.price ?? '#ffc14d'};--brand-muted:${c.muted ?? '#a3a3a3'};--font-heading:${f.heading};--font-body:${f.body};--font-persian:${f.persian}}`;
  return (
    <>
      <Head>
        <title>{`${venue.name.en} — Menu`}</title>
        <meta name="description" content={venue.tagline.en ?? `${venue.name.en} menu`} />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="theme-color" content={c.background ?? '#141414'} />
        {venue.brand.logo && <link rel="icon" href={venue.brand.logo.url} />}
        {venue.brand.logo && <link rel="preload" as="image" href={venue.brand.logo.url} fetchPriority="high" />}
        <script dangerouslySetInnerHTML={{ __html: headScript(venue.id) }} />
      </Head>
      <style dangerouslySetInnerHTML={{ __html: vars }} />
      <Intro venueId={venue.id} logo={venue.brand.logo} alt={venue.name.en ?? ''} />
      <main>
        <KebabLandPage venue={venue} sections={sections} />
      </main>
    </>
  );
}
