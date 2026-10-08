import type { GetStaticProps } from 'next';
import Head from 'next/head';
import { getPublicMenu, getVenue } from '@/lib/menu';
import type { Section, Venue } from '@/lib/types';
import { Intro, headScript } from '@/components/Intro';
import { SensoPage } from '@/venues/senso';
import { styleOf } from '@/venues/styles';

// Senso Café & Bites: its own page template and styles (src/venues/senso.tsx). Shared with the other venue:
// data access (src/lib/menu.ts), the language toggle and the intro logic (src/components). PM build decision of
// 2026-10-07: the venues are separate brands under the Roses parent brand and their pages must not look alike.
// Pre-rendered at build time from the database and served as plain HTML with no framework JavaScript
// (`runtime` is listed only because Next 16's type validator rejects a config object without one of its known keys).
export const config = { unstable_runtimeJS: false, runtime: 'nodejs' };

// Public kit fonts (Kian, 2026-10-07): the system sans on every device; the recorded brand fonts stay in the data.
const SYSTEM = "-apple-system, BlinkMacSystemFont, 'SF Pro Text', 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif";
const VENUE = 'senso';
type Props = { venue: Venue; sections: Section[] };

export const getStaticProps: GetStaticProps<Props> = async () => {
  const venue = await getVenue(VENUE);
  if (!venue) return { notFound: true };
  const sections = await getPublicMenu(VENUE, venue.settings?.showPersianDrafts !== false);
  return { props: JSON.parse(JSON.stringify({ venue, sections })) };
};

export default function Senso({ venue, sections }: Props) {
  const f = venue.brand.fonts ?? { heading: 'serif', body: 'system-ui', persian: 'system-ui' };
  // White kit for now (Kian, 2026-10-07): the recorded brand background and text colours stay in the data. The accent, the
  // intro and the list photos follow the Style tab (template-declared options, src/venues/styles.ts; defaults = the brand record).
  const style = styleOf(venue);
  const vars = `:root{--brand-bg:#ffffff;--brand-fg:#1d1d1f;--brand-accent:${style.accent};--brand-muted:#6e6e73;--font-heading:${SYSTEM};--font-body:${SYSTEM};--font-persian:${f.persian}}`;
  return (
    <>
      <Head>
        <title>{`${venue.name.en} — Menu`}</title>
        <meta name="description" content={venue.tagline.en ?? `${venue.name.en} menu`} />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        {venue.brand.logo && <link rel="icon" href={venue.brand.logo.url} />}
        {venue.brand.logo && <link rel="preload" as="image" href={venue.brand.logo.url} fetchPriority="high" />}
        <script dangerouslySetInnerHTML={{ __html: headScript() }} />
      </Head>
      {/* In the body so it follows the global stylesheet in cascade order and wins over its :root defaults. */}
      <style dangerouslySetInnerHTML={{ __html: vars }} />
      {style.intro !== false && <Intro logo={venue.brand.logo} alt={venue.name.en ?? ''} />}
      <SensoPage venue={venue} sections={sections} photos={style.photos !== false} />
    </>
  );
}
