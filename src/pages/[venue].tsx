import type { GetStaticPaths, GetStaticProps } from 'next';
import Head from 'next/head';
import { getPublicMenu, getVenue, getVenues } from '@/lib/menu';
import type { Section, Venue } from '@/lib/types';
import { Menu } from '@/components/Menu';
import { Intro, headScript } from '@/components/Intro';

// Pre-rendered at build time from the database, served as plain HTML: no framework JavaScript, only the
// two inline scripts (intro decision, language toggle). Nothing is queried per visit.
// `runtime` is the default; it is listed only because Next 16's type validator rejects a config object without one of its known keys.
export const config = { unstable_runtimeJS: false, runtime: 'nodejs' };

type Props = { venue: Venue; sections: Section[] };

export const getStaticPaths: GetStaticPaths = async () => ({ paths: (await getVenues()).map((v) => ({ params: { venue: v.id } })), fallback: false });

export const getStaticProps: GetStaticProps<Props> = async ({ params }) => {
  const id = String(params?.venue);
  const venue = await getVenue(id);
  if (!venue) return { notFound: true };
  const sections = await getPublicMenu(id, venue.settings?.showPersianDrafts !== false);
  return { props: JSON.parse(JSON.stringify({ venue, sections })) };
};

export default function VenuePage({ venue, sections }: Props) {
  const c = venue.brand.colors ?? {};
  const f = venue.brand.fonts ?? { heading: 'serif', body: 'system-ui', persian: 'system-ui' };
  const vars = `:root{--brand-bg:${c.background ?? '#fff'};--brand-fg:${c.text ?? '#111'};--brand-accent:${c.accent ?? '#b92e2e'};--brand-muted:${c.muted ?? '#6b6b6b'};--font-heading:${f.heading};--font-body:${f.body};--font-persian:${f.persian}}`;
  const title = `${venue.name.en} — Menu`;
  return (
    <>
      <Head>
        <title>{title}</title>
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
        <Menu venue={venue} sections={sections} />
      </main>
    </>
  );
}
