// Layout options, declared by each page template (step 2 of the admin rebuild, Kian 2026-10-07): the Style tab's
// "Layout" group renders exactly these controls for the venue's template; the chosen values live in venues.style and the
// template reads them through styleOf(). Colours are no longer options here: since 2026-10-08 every colour of a page is
// a token (src/venues/tokens.ts) and the Style tab edits them by page region; a colour saved as "accent" or "tile" before
// that still counts as the venue's default (tokens.ts reads it). Plain data, no React, no database: this module is
// imported by the templates, the API and the client components alike.
import type { Brand, StyleValues } from '@/lib/types';
import { DEFAULT_TRANSITION, TRANSITIONS, isTransitionId } from '@/lib/transitions';
import type { Season } from '@/lib/welcome';

export type StyleOption = { key: string; label: string; hint?: string } & (
  | { type: 'switch'; default: boolean }
  | { type: 'choice'; default: string; choices: { value: string; label: string }[] });
export type Template = { id: string; name: string; options: (brand: Brand | null | undefined) => StyleOption[] };

// The welcome screen's kill switch (Kian, 2026-10-09, replacing the logo animation): the Style tab shows it at the top of its
// Welcome group, not under Layout. A value stored under the old key "intro" is ignored (the welcome screen starts on).
const welcome: StyleOption = { key: 'welcome', type: 'switch', label: 'Welcome screen', default: true, hint: 'Before the menu, on every visit and refresh: the logo, a greeting, the language buttons and the season scene. Off: the menu opens directly.' };
const photos: StyleOption = { key: 'photos', type: 'switch', label: 'Photos in the list', default: true, hint: 'Off: the list shows text only; the photo still opens with the item.' };
// The transition from the welcome screen into the menu (owner and manager via Kian, 2026-10-10; Senso only until Kian confirms it): one
// of the ten concepts of src/lib/transitions.ts. Since 2026-10-11 (Kian's ruling) one choice per season, four options; the Style tab
// shows them in its Welcome group, a row per season, each with Play. Day one: a season not chosen yet takes the venue's single choice of
// 2026-10-10 (the stored `transition`, which nothing writes any more), else T1, so the pages stay as they were until a pick is made.
export const TX_KEYS: Record<Season, string> = { fall: 'transitionFall', winter: 'transitionWinter', spring: 'transitionSpring', summer: 'transitionSummer' };
const SEASON_NAMES: Record<Season, string> = { fall: 'Fall', winter: 'Winter', spring: 'Spring', summer: 'Summer' };
const transitionFor = (season: Season): StyleOption & { fallback: string } => ({ key: TX_KEYS[season], type: 'choice', label: `${SEASON_NAMES[season]} transition`, default: DEFAULT_TRANSITION, fallback: 'transition', choices: TRANSITIONS.map((t) => ({ value: t.id, label: `${t.id} ${t.name}` })), hint: 'From the welcome screen into the menu, after a language is tapped. The menu can be scrolled and tapped from the first moment.' });
const transitions = (['fall', 'winter', 'spring', 'summer'] as Season[]).map(transitionFor);

export const TEMPLATES: Record<string, Template> = {
  senso: { id: 'senso', name: 'Senso Café & Bites', options: () => [welcome, ...transitions, photos] },
  'kebab-land': { id: 'kebab-land', name: 'Roses Kebab Land', options: () => [welcome, photos] },
  default: {
    id: 'default', name: 'Default',
    options: () => [
      { key: 'header', type: 'choice', label: 'Header shows', default: 'name', choices: [{ value: 'name', label: 'The venue name' }, { value: 'logo', label: 'The logo' }, { value: 'both', label: 'Logo and name' }], hint: 'Without an uploaded logo the name is shown.' },
      welcome, photos,
    ],
  },
};

export function templateOf(venue: { template?: string | null }): Template { return TEMPLATES[venue.template ?? ''] ?? TEMPLATES.default; }

// The venue's layout values with the template's defaults filled in (what a page renders). An option with a `fallback` (the per-season
// transitions) takes the stored value of that older key before its default.
export function styleOf(venue: { template?: string | null; style?: StyleValues | null; brand?: Brand | null }): StyleValues {
  const out: StyleValues = {};
  for (const o of templateOf(venue).options(venue.brand)) {
    const v = venue.style?.[o.key], fb = 'fallback' in o ? venue.style?.[(o as { fallback: string }).fallback] : undefined;
    out[o.key] = v !== undefined && v !== null ? v : isTransitionId(fb) ? fb : o.default;
  }
  return out;
}
// The transition a page of this venue ships in a season (its choice for that season; see TX_KEYS).
export const transitionOf = (values: StyleValues, season: Season): string => String(values[TX_KEYS[season]] ?? '');

// Validates a layout patch against the template's declaration. Unknown keys are refused; a value equal to the
// default is stored all the same (it is what the person chose).
export function readStylePatch(venue: { template?: string | null; brand?: Brand | null }, patch: Record<string, unknown>): { ok: true; values: StyleValues } | { ok: false; error: string } {
  const options = templateOf(venue).options(venue.brand);
  const values: StyleValues = {};
  for (const [k, v] of Object.entries(patch)) {
    const o = options.find((x) => x.key === k);
    if (!o) return { ok: false, error: `"${k}" is not a layout option of this template` };
    if (o.type === 'switch') { if (typeof v !== 'boolean') return { ok: false, error: `${o.label}: on or off only` }; values[k] = v; }
    else { if (typeof v !== 'string' || !o.choices.some((c) => c.value === v)) return { ok: false, error: `${o.label}: not one of the choices` }; values[k] = v; }
  }
  return { ok: true, values };
}
