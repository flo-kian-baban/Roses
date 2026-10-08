import type { GetStaticProps } from 'next';
import Head from 'next/head';
import { getPublicMenu, getVenue } from '@/lib/menu';
import type { Section, Venue } from '@/lib/types';
import { Intro, headScript } from '@/components/Intro';
import { KebabLandPage } from '@/venues/kebab-land';
import { styleOf } from '@/venues/styles';
import { colorCss, resolveColors } from '@/venues/tokens';

// Roses Kebab Land: its own page template and styles (src/venues/kebab-land.tsx), functional only for the MVP
// (Kian's decision after Checkpoint A2; the design comes with the post-MVP redesign). Shared with Senso: data access,
// the language toggle and the intro logic. Pre-rendered at build time, plain HTML, no framework JavaScript.
export const config = { unstable_runtimeJS: false, runtime: 'nodejs' };

// Public kit fonts (Kian, 2026-10-07): the system sans on every device; the recorded brand fonts stay in the data.
const SYSTEM = "-apple-system, BlinkMacSystemFont, 'SF Pro Text', 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif";
const VENUE = 'kebab-land';
type Props = { venue: Venue; sections: Section[] };

export const getStaticProps: GetStaticProps<Props> = async () => {
  const venue = await getVenue(VENUE);
  if (!venue) return { notFound: true };
  const sections = await getPublicMenu(VENUE, venue.settings?.showPersianDrafts !== false);
  return { props: JSON.parse(JSON.stringify({ venue, sections })) };
};

export default function KebabLand({ venue, sections }: Props) {
  const f = venue.brand.fonts ?? { heading: 'serif', body: 'system-ui', persian: 'system-ui' };
  // Colours: the venue's tokens (src/venues/tokens.ts; defaults = the white kit, the brand background on the logo tile and
  // the brand red on the footer labels and phone links; the recorded dark-page colours stay in the brand record). The intro
  // and the list photos are the Style tab's layout options.
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
        <script dangerouslySetInnerHTML={{ __html: headScript() }} />
      </Head>
      <style dangerouslySetInnerHTML={{ __html: css }} />
      {style.intro !== false && <Intro logo={venue.brand.logo} alt={venue.name.en ?? ''} tile />}
      <KebabLandPage venue={venue} sections={sections} photos={style.photos !== false} />
    </>
  );
}
