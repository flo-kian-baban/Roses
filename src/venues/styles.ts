// Style options, declared by each page template (step 2 of the admin rebuild, Kian 2026-10-07). The Style tab renders
// exactly these controls for the venue's template; the chosen values live in venues.style and the template reads them
// through styleOf(). The recorded brand colours (venues.brand) are never changed here; they are offered as swatches and
// serve as the defaults. Plain data, no React, no database: this module is imported by the templates, the API and the
// client components alike.
import type { Brand, StyleValues } from '@/lib/types';

export type StyleOption = { key: string; label: string; hint?: string } & (
  | { type: 'color'; default: string; swatches: string[] }
  | { type: 'switch'; default: boolean }
  | { type: 'choice'; default: string; choices: { value: string; label: string }[] });
export type Template = { id: string; name: string; options: (brand: Brand | null | undefined) => StyleOption[] };

const HEX = /^#[0-9a-f]{6}$/i;
const swatches = (b: Brand | null | undefined, extra: string[] = []) => [...new Set([...Object.values(b?.colors ?? {}), ...extra].filter((c) => HEX.test(c)).map((c) => c.toLowerCase()))];
const intro: StyleOption = { key: 'intro', type: 'switch', label: 'Logo animation', default: true, hint: 'Plays while the menu loads, on every visit and refresh. Never when the phone has reduced motion on.' };
const photos: StyleOption = { key: 'photos', type: 'switch', label: 'Photos in the list', default: true, hint: 'Off: the list shows text only; the photo still opens with the item.' };

export const TEMPLATES: Record<string, Template> = {
  senso: {
    id: 'senso', name: 'Senso Café & Bites',
    options: (b) => [
      { key: 'accent', type: 'color', label: 'Accent colour', default: (b?.colors?.accent ?? '#042c7c').toLowerCase(), swatches: swatches(b), hint: 'Phone links in the footer.' },
      intro, photos,
    ],
  },
  'kebab-land': {
    id: 'kebab-land', name: 'Roses Kebab Land',
    options: (b) => [
      { key: 'accent', type: 'color', label: 'Accent colour', default: (b?.colors?.accent ?? '#b92e2e').toLowerCase(), swatches: swatches(b), hint: 'Location labels and phone links in the footer.' },
      { key: 'tile', type: 'color', label: 'Logo tile colour', default: (b?.colors?.background ?? '#141414').toLowerCase(), swatches: swatches(b, ['#000000', '#141414', '#1d1d1f']), hint: 'Behind the white logo, in the header and the intro.' },
      intro, photos,
    ],
  },
  default: {
    id: 'default', name: 'Default',
    options: (b) => [
      { key: 'accent', type: 'color', label: 'Accent colour', default: (b?.colors?.accent ?? '#1d1d1f').toLowerCase(), swatches: swatches(b, ['#1d1d1f', '#b92e2e', '#042c7c', '#0a7d4f', '#8a4b08']), hint: 'The venue name, the section underline, prices and phone links.' },
      { key: 'tile', type: 'color', label: 'Logo tile colour', default: (b?.colors?.background ?? '#f5f5f7').toLowerCase(), swatches: swatches(b, ['#ffffff', '#f5f5f7', '#141414']), hint: 'Behind the logo when one is uploaded.' },
      { key: 'header', type: 'choice', label: 'Header shows', default: 'name', choices: [{ value: 'name', label: 'The venue name' }, { value: 'logo', label: 'The logo' }, { value: 'both', label: 'Logo and name' }], hint: 'Without an uploaded logo the name is shown.' },
      intro, photos,
    ],
  },
};

export function templateOf(venue: { template?: string | null }): Template { return TEMPLATES[venue.template ?? ''] ?? TEMPLATES.default; }

// The venue's style with the template's defaults filled in (what a page renders).
export function styleOf(venue: { template?: string | null; style?: StyleValues | null; brand?: Brand | null }): StyleValues {
  const out: StyleValues = {};
  for (const o of templateOf(venue).options(venue.brand)) {
    const v = venue.style?.[o.key];
    out[o.key] = v === undefined || v === null ? o.default : v;
  }
  return out;
}

// Validates a Style tab patch against the template's declaration. Unknown keys are refused; a value equal to the
// default is stored all the same (it is what the person chose).
export function readStylePatch(venue: { template?: string | null; brand?: Brand | null }, patch: Record<string, unknown>): { ok: true; values: StyleValues } | { ok: false; error: string } {
  const options = templateOf(venue).options(venue.brand);
  const values: StyleValues = {};
  for (const [k, v] of Object.entries(patch)) {
    const o = options.find((x) => x.key === k);
    if (!o) return { ok: false, error: `"${k}" is not a style option of this template` };
    if (o.type === 'color') { if (typeof v !== 'string' || !HEX.test(v)) return { ok: false, error: `${o.label}: not a colour` }; values[k] = v.toLowerCase(); }
    else if (o.type === 'switch') { if (typeof v !== 'boolean') return { ok: false, error: `${o.label}: on or off only` }; values[k] = v; }
    else { if (typeof v !== 'string' || !o.choices.some((c) => c.value === v)) return { ok: false, error: `${o.label}: not one of the choices` }; values[k] = v; }
  }
  return { ok: true, values };
}
