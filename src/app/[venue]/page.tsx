import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getPublicMenu, getVenue, getVenues } from '@/lib/menu';
import { Menu } from '@/components/Menu';
import { Intro, headScript } from '@/components/Intro';

// Built from the database at build time; nothing is queried per visit.
export const dynamic = 'force-static';
export const dynamicParams = false;

export async function generateStaticParams() {
  return (await getVenues()).map((v) => ({ venue: v.id }));
}

export async function generateMetadata({ params }: { params: Promise<{ venue: string }> }): Promise<Metadata> {
  const venue = await getVenue((await params).venue);
  if (!venue) return {};
  const title = `${venue.name.en} — Menu`;
  return { title, description: venue.tagline.en ?? `${venue.name.en} menu`, icons: venue.brand.logo ? [{ url: venue.brand.logo.url }] : undefined };
}

export default async function VenuePage({ params }: { params: Promise<{ venue: string }> }) {
  const id = (await params).venue;
  const venue = await getVenue(id);
  if (!venue) notFound();
  const sections = await getPublicMenu(id, venue.settings?.showPersianDrafts !== false);
  const c = venue.brand.colors ?? {};
  const f = venue.brand.fonts ?? { heading: 'system-ui', body: 'system-ui', persian: 'Vazirmatn' };
  const faces = (f.faces ?? []).map((x) => `@font-face{font-family:"${x.family}";src:url("${x.url}");font-weight:${x.weight ?? 'normal'};font-display:swap}`).join('');
  const vars = `:root{--brand-bg:${c.background ?? '#fff'};--brand-fg:${c.text ?? '#111'};--brand-accent:${c.accent ?? '#b92e2e'};--brand-muted:${c.muted ?? '#6b6b6b'};--font-heading:${f.heading};--font-body:${f.body};--font-persian:${f.persian}}`;
  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: faces + vars }} />
      {venue.brand.logo && <link rel="preload" as="image" href={venue.brand.logo.url} fetchPriority="high" />}
      <script dangerouslySetInnerHTML={{ __html: headScript(id) }} />
      <Intro venueId={id} logo={venue.brand.logo} alt={venue.name.en ?? ''} />
      <main>
        <Menu venue={venue} sections={sections} />
      </main>
    </>
  );
}
