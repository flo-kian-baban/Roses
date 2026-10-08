// Layout options, declared by each page template (step 2 of the admin rebuild, Kian 2026-10-07): the Style tab's
// "Layout" group renders exactly these controls for the venue's template; the chosen values live in venues.style and the
// template reads them through styleOf(). Colours are no longer options here: since 2026-10-08 every colour of a page is
// a token (src/venues/tokens.ts) and the Style tab edits them by page region; a colour saved as "accent" or "tile" before
// that still counts as the venue's default (tokens.ts reads it). Plain data, no React, no database: this module is
// imported by the templates, the API and the client components alike.
import type { Brand, StyleValues } from '@/lib/types';

export type StyleOption = { key: string; label: string; hint?: string } & (
  | { type: 'switch'; default: boolean }
  | { type: 'choice'; default: string; choices: { value: string; label: string }[] });
export type Template = { id: string; name: string; options: (brand: Brand | null | undefined) => StyleOption[] };

const intro: StyleOption = { key: 'intro', type: 'switch', label: 'Logo animation', default: true, hint: 'Plays while the menu loads, on every visit and refresh. Never when the phone has reduced motion on.' };
const photos: StyleOption = { key: 'photos', type: 'switch', label: 'Photos in the list', default: true, hint: 'Off: the list shows text only; the photo still opens with the item.' };

export const TEMPLATES: Record<string, Template> = {
  senso: { id: 'senso', name: 'Senso Café & Bites', options: () => [intro, photos] },
  'kebab-land': { id: 'kebab-land', name: 'Roses Kebab Land', options: () => [intro, photos] },
  default: {
    id: 'default', name: 'Default',
    options: () => [
      { key: 'header', type: 'choice', label: 'Header shows', default: 'name', choices: [{ value: 'name', label: 'The venue name' }, { value: 'logo', label: 'The logo' }, { value: 'both', label: 'Logo and name' }], hint: 'Without an uploaded logo the name is shown.' },
      intro, photos,
    ],
  },
};

export function templateOf(venue: { template?: string | null }): Template { return TEMPLATES[venue.template ?? ''] ?? TEMPLATES.default; }

// The venue's layout values with the template's defaults filled in (what a page renders).
export function styleOf(venue: { template?: string | null; style?: StyleValues | null; brand?: Brand | null }): StyleValues {
  const out: StyleValues = {};
  for (const o of templateOf(venue).options(venue.brand)) {
    const v = venue.style?.[o.key];
    out[o.key] = v === undefined || v === null ? o.default : v;
  }
  return out;
}

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
