import type { GetStaticProps } from 'next';
import Head from 'next/head';
import { getPublicMenu, getVenue } from '@/lib/menu';
import type { Section, Venue } from '@/lib/types';
import { Welcome, headScript } from '@/components/Welcome';
import { SensoPage } from '@/venues/senso';
import { styleOf } from '@/venues/styles';
import { colorCss, resolveColors } from '@/venues/tokens';

// Senso Café & Bites: its own page template and styles (src/venues/senso.tsx). Shared with the other venue:
// data access (src/lib/menu.ts), the language toggle and the welcome screen (src/components). PM build decision of
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
  // Colours: the venue's tokens (src/venues/tokens.ts; defaults = the white kit with the brand navy on phone links, Kian
  // 2026-10-07; the Style tab's choices in venues.style). The welcome screen and the list photos are the Style tab's switches.
  const style = styleOf(venue);
  const colors = resolveColors(venue);
  const css = `${colorCss(colors)}:root{--font-heading:${SYSTEM};--font-body:${SYSTEM};--font-persian:${f.persian}}`;
  return (
    <>
      <Head>
        <title>{`${venue.name.en} — Menu`}</title>
        <meta name="description" content={venue.tagline.en ?? `${venue.name.en} menu`} />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="theme-color" content={colors['page.bg'].value} />
        {venue.brand.logo && <link rel="icon" href={venue.brand.logo.url} />}
        {venue.brand.logo && <link rel="preload" as="image" href={venue.brand.logo.url} fetchPriority="high" />}
        <script dangerouslySetInnerHTML={{ __html: headScript(style.welcome !== false) }} />
      </Head>
      {/* In the body so it follows the stylesheet in cascade order. */}
      <style dangerouslySetInnerHTML={{ __html: css }} />
      {style.welcome !== false && <Welcome logo={venue.brand.logo} name={venue.name} />}
      <SensoPage venue={venue} sections={sections} photos={style.photos !== false} />
    </>
  );
}
