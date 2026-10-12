// Seasonal items (Kian, 2026-10-12). An item tagged with seasons is shown only in them, everywhere (none = all year). Each venue
// has one Seasonal section, pinned first and titled by the season of the render; it holds the items placed in it that are tagged
// for that season and is hidden when none are. The season is the welcome screen's rule (the Toronto date at render, seasonNow in
// src/lib/welcome.ts, regenerated hourly), so the section, its title and the items change with the season on the 1st.
// Server only and in src/lib, outside the public stylesheet's Tailwind sources: the CSS below is written into the page in a
// <style> of its own only when a Seasonal section is shown, so a venue with no seasonal item renders byte for byte as before.
// Colours come from the venue's tokens (CSS variables) and, for Senso's motif, from the named artwork palette (src/venues/tokens.ts).
import type { Bi, SeasonId } from '@/lib/types';
import { ART_SCENES } from '@/components/welcome-art';

export const SEASON_IDS: SeasonId[] = ['fall', 'winter', 'spring', 'summer'];
export const isSeasonId = (v: unknown): v is SeasonId => typeof v === 'string' && (SEASON_IDS as string[]).includes(v);
// The tags as saved: known seasons only, each once, in the order of the year as the admin shows them.
export const seasonsOf = (v: unknown): SeasonId[] => (Array.isArray(v) ? SEASON_IDS.filter((s) => v.includes(s)) : []);

// Customers' titles: Kian, 2026-10-12, matching Senso's printed seasonal card ("Fall Menu"); they replace the "… specials" titles and
// their Persian of the same day.
export const SEASONAL_TITLES: Record<SeasonId, Bi> = {
  fall: { en: 'Fall Menu', fa: 'منوی پاییز' },
  winter: { en: 'Winter Menu', fa: 'منوی زمستان' },
  spring: { en: 'Spring Menu', fa: 'منوی بهار' },
  summer: { en: 'Summer Menu', fa: 'منوی تابستان' },
};

// Each template styles the section in its own look (Kian, 2026-10-12): Senso a small motif of the season's picked artwork before
// the title; Kebab Land a short bar in its brand red (the location labels' colour) before the title; the default template the title
// in its accent (the prices' colour). Nothing else changes: same rows, same plain prices, same popup.
const CSS: Record<string, string> = {
  senso: '.seasonal-head{display:flex;align-items:center;gap:10px;padding-top:24px}.seasonal-head>h2{padding-top:0}.seasonal-mark{width:30px;height:30px;flex:none;color:var(--c-welcome-snow)}',
  'kebab-land': 'section.seasonal>h2::before{content:"";display:inline-block;width:4px;height:.8em;margin-inline-end:10px;border-radius:2px;background:var(--c-footer-label);vertical-align:-.04em}',
  default: 'section.seasonal>h2{color:var(--c-rows-price)}',
};
export const seasonalCss = (template: string): string => CSS[template] ?? CSS.default;

// Senso's motif: one of the season's picked designs (summer: the sun, its rays and flames), the welcome artwork's own drawing, with
// every id prefixed so it never meets the welcome screen's symbols on the same page.
const MOTIF: Record<SeasonId, { ids: string[]; box: string }> = {
  fall: { ids: ['F1'], box: '0 0 64 64' },
  winter: { ids: ['W1'], box: '0 0 64 64' },
  spring: { ids: ['S1'], box: '0 0 64 64' },
  summer: { ids: ['Urays', 'Uflames', 'Udisc'], box: '0 0 200 200' },
};
const TOP = /<(symbol|linearGradient|radialGradient|filter|clipPath|mask|pattern)\b[^>]*?\bid="([^"]+)"[^>]*>[\s\S]*?<\/\1>/g;
const cache = new Map<SeasonId, { box: string; inner: string } | null>();
export function seasonalMotif(season: SeasonId): { box: string; inner: string } | null {
  const hit = cache.get(season); if (hit !== undefined) return hit;
  const scene = ART_SCENES[season], m = MOTIF[season];
  if (!scene) { cache.set(season, null); return null; }
  const top = new Map<string, string>(); for (const x of scene.defs.matchAll(TOP)) top.set(x[2], x[0]);
  const want = new Set<string>(), queue = [...m.ids];
  while (queue.length) { // the symbols and every top-level definition they reference (gradients, shared defs)
    const id = queue.shift()!; if (want.has(id) || !top.has(id)) continue; want.add(id);
    for (const r of top.get(id)!.matchAll(/(?:url\(#|href="#)([^)"]+)/g)) if (top.has(r[1]) && !want.has(r[1])) queue.push(r[1]);
  }
  let defs = [...top.keys()].filter((id) => want.has(id)).map((id) => top.get(id)!).join('');
  const ids = new Set([...defs.matchAll(/\bid="([^"]+)"/g)].map((x) => x[1]));
  defs = defs.replace(/\bid="([^"]+)"/g, (s, id: string) => (ids.has(id) ? `id="sm-${id}"` : s)).replace(/(url\(#|href="#)([^)"]+)/g, (s, p: string, id: string) => (ids.has(id) ? `${p}sm-${id}` : s));
  const out = { box: m.box, inner: `<defs>${defs}</defs>${m.ids.map((id) => `<use href="#sm-${id}"/>`).join('')}` };
  cache.set(season, out); return out;
}
