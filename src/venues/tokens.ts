// Colour tokens of the public pages (Kian, 2026-10-08: the Style tab rebuilt around the parts of the page customers see).
// This is the only file with colour literals for the public pages: every template, the menu kit and the public stylesheet
// use the CSS variables rendered from these tokens (scripts/check-colour-literals.mjs proves it). Plain data and pure
// functions, no React, no database: imported by the page templates, the Style API route and the Style tab alike.
//
// Groups follow the page from top to bottom. A token is a background (a base) or something that sits on a base: text,
// a heading, an indicator, a decoration. Tokens that sit on a base are linked to it: unless the admin sets them ("Custom"),
// they derive from the base ("Auto": dark or light text for readability, dividers a light shade of the background). A
// template may pin a venue default on a token (the brand navy on Senso's phone links, the brand red on Kebab Land's
// location labels); a pinned default gives way to the Auto rule when the base changes under it and it would be unreadable.
// Each template's default set is the look it had before the tokens existed (the white kit of 2026-10-07); the pre-token
// literals are listed next to each token so the suite can prove the day-one defaults equal them.
import type { Brand, StyleValues } from '@/lib/types';

export type GroupId = 'page' | 'header' | 'tabs' | 'headings' | 'rows' | 'sheet' | 'footer' | 'welcome';
export type Kind = 'bg' | 'text' | 'large' | 'indicator' | 'decor';
export type Rule = 'ink' | 'text' | 'muted' | 'body' | 'band' | 'line' | 'soft' | 'same' | 'leaves' | 'snow' | 'blossoms' | 'light';
export type TokenDef = { key: string; group: GroupId; label: string; kind: Kind; on?: string; rule?: Rule; note?: string };
export type State = 'auto' | 'default' | 'custom';
export type Resolved = Record<string, { value: string; state: State; why: string }>;

// WCAG 2 contrast thresholds by kind (Kian: 4.5:1 for normal text, 3:1 for large headings and non-text indicators).
export const THRESHOLD: Record<Kind, number> = { bg: 0, decor: 0, text: 4.5, large: 3, indicator: 3 };

export const GROUPS: { id: GroupId; label: string; hint: string }[] = [
  { id: 'page', label: 'Page', hint: 'The background and text of the whole page.' },
  { id: 'header', label: 'Header', hint: 'The logo and the language button at the top.' },
  { id: 'tabs', label: 'Category tabs', hint: 'The category bar that sticks to the top while scrolling.' },
  { id: 'headings', label: 'Section headings', hint: 'Section titles and the note under them.' },
  { id: 'rows', label: 'Item rows', hint: 'Each menu item in the list.' },
  { id: 'sheet', label: 'Item popup', hint: 'The item details that open on tap, and the section list.' },
  { id: 'footer', label: 'Footer', hint: 'Locations, hours and phone numbers at the bottom.' },
  { id: 'welcome', label: 'Welcome', hint: 'The welcome screen before the menu: the logo, the greeting, the two language buttons and the season scene.' },
];

// In dependency order: a token's base comes before it.
export const TOKENS: TokenDef[] = [
  { key: 'page.bg', group: 'page', label: 'Background', kind: 'bg' },
  { key: 'page.text', group: 'page', label: 'Text', kind: 'text', on: 'page.bg', rule: 'ink' },
  { key: 'page.subtext', group: 'page', label: 'Secondary text', kind: 'text', on: 'page.bg', rule: 'muted', note: 'The tagline under the name.' },
  { key: 'page.band', group: 'page', label: 'Band between sections', kind: 'decor', on: 'page.bg', rule: 'band' },
  { key: 'header.bg', group: 'header', label: 'Background', kind: 'bg', on: 'page.bg', rule: 'same' },
  { key: 'header.tile', group: 'header', label: 'Tile behind the logo', kind: 'bg', note: 'Also behind the logo on the welcome screen.' },
  { key: 'header.title', group: 'header', label: 'Venue name', kind: 'large', on: 'header.bg', rule: 'text' },
  { key: 'header.langBg', group: 'header', label: 'Language button', kind: 'bg', on: 'header.bg', rule: 'soft' },
  { key: 'header.langText', group: 'header', label: 'Language button text', kind: 'text', on: 'header.langBg', rule: 'text' },
  { key: 'tabs.bg', group: 'tabs', label: 'Bar background', kind: 'bg', on: 'page.bg', rule: 'same' },
  { key: 'tabs.text', group: 'tabs', label: 'Tab text', kind: 'text', on: 'tabs.bg', rule: 'muted' },
  { key: 'tabs.active', group: 'tabs', label: 'Active tab text', kind: 'text', on: 'tabs.bg', rule: 'text' },
  { key: 'tabs.indicator', group: 'tabs', label: 'Active tab underline', kind: 'indicator', on: 'tabs.bg', rule: 'text' },
  { key: 'tabs.list', group: 'tabs', label: 'Section-list button', kind: 'text', on: 'tabs.bg', rule: 'text' },
  { key: 'tabs.line', group: 'tabs', label: 'Hairline under the bar', kind: 'decor', on: 'tabs.bg', rule: 'line' },
  { key: 'headings.title', group: 'headings', label: 'Section title', kind: 'large', on: 'page.bg', rule: 'text' },
  { key: 'headings.note', group: 'headings', label: 'Note under the title', kind: 'text', on: 'page.bg', rule: 'muted' },
  { key: 'rows.bg', group: 'rows', label: 'Row background', kind: 'bg', on: 'page.bg', rule: 'same' },
  { key: 'rows.name', group: 'rows', label: 'Item name', kind: 'text', on: 'rows.bg', rule: 'text' },
  { key: 'rows.desc', group: 'rows', label: 'Description', kind: 'text', on: 'rows.bg', rule: 'muted' },
  { key: 'rows.price', group: 'rows', label: 'Price', kind: 'text', on: 'rows.bg', rule: 'text' },
  { key: 'rows.chipBg', group: 'rows', label: '“Serves” chip', kind: 'bg', on: 'rows.bg', rule: 'band' },
  { key: 'rows.chipText', group: 'rows', label: '“Serves” chip text', kind: 'text', on: 'rows.chipBg', rule: 'text' },
  { key: 'rows.photo', group: 'rows', label: 'Photo placeholder', kind: 'decor', on: 'rows.bg', rule: 'band' },
  { key: 'rows.line', group: 'rows', label: 'Line between rows', kind: 'decor', on: 'rows.bg', rule: 'line' },
  { key: 'sheet.bg', group: 'sheet', label: 'Popup background', kind: 'bg', on: 'page.bg', rule: 'same' },
  { key: 'sheet.title', group: 'sheet', label: 'Title', kind: 'large', on: 'sheet.bg', rule: 'text', note: 'Also “Sizes”, “Options”, “Includes” and the section list.' },
  { key: 'sheet.price', group: 'sheet', label: 'Price', kind: 'text', on: 'sheet.bg', rule: 'text', note: 'Also the sizes, options and combo parts.' },
  { key: 'sheet.body', group: 'sheet', label: 'Description text', kind: 'text', on: 'sheet.bg', rule: 'body' },
  { key: 'sheet.muted', group: 'sheet', label: 'Option prices', kind: 'text', on: 'sheet.bg', rule: 'muted', note: 'The “+$” prices and the “Menu” caption of the section list.' },
  { key: 'sheet.line', group: 'sheet', label: 'Lines between sizes and options', kind: 'decor', on: 'sheet.bg', rule: 'line' },
  { key: 'sheet.hero', group: 'sheet', label: 'Photo placeholder and group bands', kind: 'decor', on: 'sheet.bg', rule: 'band', note: 'Behind the headings of Sizes, Options, Includes and Good to know; also where a photo is missing.' },
  { key: 'sheet.closeBg', group: 'sheet', label: 'Close button', kind: 'bg', on: 'sheet.bg', rule: 'same' },
  { key: 'sheet.closeIcon', group: 'sheet', label: 'Close button icon', kind: 'indicator', on: 'sheet.closeBg', rule: 'text' },
  { key: 'sheet.dim', group: 'sheet', label: 'Dim behind the popup', kind: 'bg', note: 'Shown at 45% over the page.' },
  { key: 'footer.bg', group: 'footer', label: 'Background', kind: 'bg', on: 'page.bg', rule: 'same' },
  { key: 'footer.label', group: 'footer', label: 'Location labels', kind: 'text', on: 'footer.bg', rule: 'text' },
  { key: 'footer.address', group: 'footer', label: 'Address', kind: 'text', on: 'footer.bg', rule: 'muted' },
  { key: 'footer.hours', group: 'footer', label: 'Hours', kind: 'text', on: 'footer.bg', rule: 'muted' },
  { key: 'footer.phone', group: 'footer', label: 'Phone link', kind: 'text', on: 'footer.bg', rule: 'text' },
  // The welcome screen (Kian, 2026-10-09, replacing the logo intro): its background, the greeting, the two language buttons (the
  // remembered one filled), and the colour of each season's scene (decoration: leaves, snow, blossoms, light; no readability rule).
  { key: 'welcome.bg', group: 'welcome', label: 'Background', kind: 'bg' },
  { key: 'welcome.text', group: 'welcome', label: 'Greeting', kind: 'large', on: 'welcome.bg', rule: 'ink' },
  { key: 'welcome.btnBg', group: 'welcome', label: 'Language buttons', kind: 'bg', on: 'welcome.bg', rule: 'soft' },
  { key: 'welcome.btnText', group: 'welcome', label: 'Language button text', kind: 'text', on: 'welcome.btnBg', rule: 'text' },
  { key: 'welcome.activeBg', group: 'welcome', label: 'Remembered language button', kind: 'bg', on: 'welcome.bg', rule: 'ink', note: 'The language chosen last time.' },
  { key: 'welcome.activeText', group: 'welcome', label: 'Remembered language button text', kind: 'text', on: 'welcome.activeBg', rule: 'ink' },
  { key: 'welcome.leaves', group: 'welcome', label: 'Fall leaves', kind: 'decor', on: 'welcome.bg', rule: 'leaves', note: 'September to November.' },
  { key: 'welcome.snow', group: 'welcome', label: 'Winter snow', kind: 'decor', on: 'welcome.bg', rule: 'snow', note: 'December to February.' },
  { key: 'welcome.blossoms', group: 'welcome', label: 'Spring blossoms', kind: 'decor', on: 'welcome.bg', rule: 'blossoms', note: 'March to May.' },
  { key: 'welcome.light', group: 'welcome', label: 'Summer light', kind: 'decor', on: 'welcome.bg', rule: 'light', note: 'June to August.' },
];
export const TOKEN_BY_KEY: Record<string, TokenDef> = Object.fromEntries(TOKENS.map((t) => [t.key, t]));
export const cssVar = (key: string) => `--c-${key.replace(/\./g, '-').replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`)}`;

// The white kit's constants (Kian, 2026-10-07): ink and paper, the two greys for secondary text, the two for reading text.
const INK = '#1d1d1f', PAPER = '#ffffff', WHITE = '#ffffff', BLACK = '#000000';
const MUTED = ['#6b6b6b', '#a1a1a6'], BODY = ['#545454', '#c7c7cc'];
// The welcome scenes' own constants (Kian, 2026-10-09): warm orange leaves, a cool blue to tint snow on a light background, soft pink
// blossoms, warm yellow light. A template pins the venue's brand colours over them where it has fitting ones (see TEMPLATE_COLORS).
const LEAVES = '#e0782f', SNOW_INK = '#7f98b5', BLOSSOM = '#f2a0b4', LIGHT = '#f5c35c';

// Per template: which tokens the page uses, its base defaults, and the venue defaults pinned on linked tokens (computed
// from the brand record; a legacy Style value "accent" or "tile" saved before the tokens still counts as the venue's choice).
type TemplateColors = { omit: string[]; bases: (b: Brand | null | undefined, legacy: StyleValues) => Record<string, string>; pinned: (b: Brand | null | undefined, legacy: StyleValues) => Record<string, string> };
const brandHex = (b: Brand | null | undefined, k: string, fallback: string) => { const v = String(b?.colors?.[k] ?? '').toLowerCase(); return HEX.test(v) ? v : fallback; };
const legacyHex = (legacy: StyleValues, k: string) => { const v = legacy?.[k]; return typeof v === 'string' && HEX.test(v) ? v.toLowerCase() : null; };
export const TEMPLATE_COLORS: Record<string, TemplateColors> = {
  // Welcome screen defaults (Kian, 2026-10-09): Senso on its recorded cream with the navy on the remembered button and the brand gold
  // as leaves and summer light, its site pink as blossoms; Kebab Land on its recorded dark background with the brand red on the
  // remembered button, its site orange as leaves and its price yellow as light; both get Auto snow. The two screens never look alike.
  senso: {
    omit: ['page.subtext', 'header.tile', 'header.title'],
    bases: (b) => ({ 'page.bg': WHITE, 'sheet.dim': BLACK, 'welcome.bg': brandHex(b, 'background', '#fff8ee') }),
    pinned: (b, l) => { const accent = legacyHex(l, 'accent') ?? brandHex(b, 'accent', '#042c7c'); const gold = brandHex(b, 'gold', '#cc9434'); return { 'footer.phone': accent, 'welcome.activeBg': accent, 'welcome.leaves': gold, 'welcome.light': gold, 'welcome.blossoms': brandHex(b, 'siteLink', BLOSSOM) }; },
  },
  'kebab-land': {
    omit: ['page.subtext', 'header.title'],
    bases: (b, l) => ({ 'page.bg': WHITE, 'sheet.dim': BLACK, 'header.tile': legacyHex(l, 'tile') ?? brandHex(b, 'background', '#141414'), 'welcome.bg': brandHex(b, 'background', '#141414') }),
    pinned: (b, l) => { const accent = legacyHex(l, 'accent') ?? brandHex(b, 'accent', '#b92e2e'); return { 'footer.label': accent, 'footer.phone': accent, 'footer.address': INK, 'welcome.activeBg': accent, 'welcome.leaves': brandHex(b, 'button', '#f8512f'), 'welcome.light': brandHex(b, 'price', '#ffc14d') }; },
  },
  default: {
    omit: [],
    bases: (b, l) => ({ 'page.bg': WHITE, 'sheet.dim': BLACK, 'header.tile': legacyHex(l, 'tile') ?? brandHex(b, 'background', '#f5f5f7'), 'welcome.bg': WHITE }),
    pinned: (b, l) => { const accent = legacyHex(l, 'accent') ?? brandHex(b, 'accent', INK); return { 'header.title': accent, 'tabs.active': accent, 'tabs.indicator': accent, 'rows.price': accent, 'footer.phone': accent, 'footer.bg': '#f5f5f7', 'welcome.activeBg': accent }; },
  },
};
export const templateColors = (template: string | null | undefined) => TEMPLATE_COLORS[template ?? ''] ?? TEMPLATE_COLORS.default;
export const tokensOf = (template: string | null | undefined): TokenDef[] => { const omit = new Set(templateColors(template).omit); return TOKENS.filter((t) => !omit.has(t.key)); };

// ---- colour maths (sRGB, WCAG 2.x) ----
export const HEX = /^#[0-9a-f]{6}$/i;
export const normHex = (v: unknown): string | null => { if (typeof v !== 'string') return null; const s = v.trim().toLowerCase(); if (HEX.test(s)) return s; if (/^#[0-9a-f]{3}$/.test(s)) return `#${s[1]}${s[1]}${s[2]}${s[2]}${s[3]}${s[3]}`; return null; };
const rgb = (hex: string): [number, number, number] => [parseInt(hex.slice(1, 3), 16), parseInt(hex.slice(3, 5), 16), parseInt(hex.slice(5, 7), 16)];
const hex = (c: [number, number, number]) => `#${c.map((x) => Math.max(0, Math.min(255, Math.round(x))).toString(16).padStart(2, '0')).join('')}`;
const lin = (x: number) => { const s = x / 255; return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4; };
export const luminance = (h: string): number => { const [r, g, b] = rgb(h); return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b); };
export const contrast = (a: string, b: string): number => { const la = luminance(a), lb = luminance(b); const [hi, lo] = la > lb ? [la, lb] : [lb, la]; return (hi + 0.05) / (lo + 0.05); };
export const mix = (a: string, b: string, t: number): string => { const x = rgb(a), y = rgb(b); return hex([x[0] + (y[0] - x[0]) * t, x[1] + (y[1] - x[1]) * t, x[2] + (y[2] - x[2]) * t]); };
export const isLight = (h: string) => luminance(h) > 0.3;
export const isDark = (h: string) => !isLight(h);

// The Auto rules. `page` is the resolved page text and background (the first candidates for text on any base).
function derive(rule: Rule, base: string, page: { text: string; bg: string }): string {
  switch (rule) {
    case 'same': return base;
    case 'ink': return contrast(INK, base) >= contrast(PAPER, base) ? INK : PAPER;
    case 'text': { const c = [page.text, page.bg, INK, PAPER]; return c.find((x) => contrast(x, base) >= 4.5) ?? c.reduce((a, b) => (contrast(b, base) > contrast(a, base) ? b : a)); }
    case 'muted': return MUTED.find((x) => contrast(x, base) >= 4.5) ?? derive('text', base, page);
    case 'body': return BODY.find((x) => contrast(x, base) >= 4.5) ?? derive('text', base, page);
    case 'band': return isLight(base) ? mix(base, BLACK, 0.047) : mix(base, WHITE, 0.08);
    case 'line': return isLight(base) ? mix(base, BLACK, 0.1) : mix(base, WHITE, 0.14);
    case 'soft': return isLight(base) ? mix(base, BLACK, 0.05) : mix(base, WHITE, 0.1);
    case 'leaves': return LEAVES;
    case 'snow': return isLight(base) ? mix(base, SNOW_INK, 0.6) : mix(base, WHITE, 0.92);
    case 'blossoms': return BLOSSOM;
    case 'light': return LIGHT;
  }
}
const RULE_WHY: Record<Rule, (base: string, on: string) => string> = {
  same: (_, on) => `same as the ${on}`,
  ink: (b) => (isLight(b) ? 'dark text for a light background' : 'light text for a dark background'),
  text: (b, on) => `${isLight(b) ? 'dark' : 'light'} text for the ${on}`,
  muted: (_, on) => `grey text for the ${on}`,
  body: (_, on) => `reading text for the ${on}`,
  band: (_, on) => `a light shade of the ${on}`,
  line: (_, on) => `a hairline on the ${on}`,
  soft: (_, on) => `a soft tint of the ${on}`,
  leaves: () => 'warm orange leaves',
  snow: (b) => (isLight(b) ? 'pale blue snow for a light background' : 'white snow for a dark background'),
  blossoms: () => 'soft pink blossoms',
  light: () => 'warm yellow light',
};
// How a base is named inside a sentence ("same as the page background", "grey text for the row background").
const BASE_NAME: Record<string, string> = { 'page.bg': 'page background', 'header.bg': 'header background', 'header.langBg': 'language button', 'tabs.bg': 'tab bar background', 'rows.bg': 'row background', 'rows.chipBg': '“Serves” chip', 'sheet.bg': 'popup background', 'sheet.closeBg': 'close button', 'footer.bg': 'footer background', 'welcome.bg': 'welcome background', 'welcome.btnBg': 'language buttons', 'welcome.activeBg': 'remembered language button' };
export const baseName = (key: string): string => BASE_NAME[key] ?? TOKEN_BY_KEY[key].label.toLowerCase();
const lowerLabel = baseName;

// The stored colour choices: venues.style.colors = { "<token key>": "#rrggbb" }. Older keys "accent" / "tile" are read as venue defaults (see TEMPLATE_COLORS).
export const customColors = (style: StyleValues | null | undefined): Record<string, string> => {
  const c = (style as Record<string, unknown> | null | undefined)?.colors;
  const out: Record<string, string> = {};
  if (c && typeof c === 'object') for (const [k, v] of Object.entries(c as Record<string, unknown>)) { const h = normHex(v); if (h && TOKEN_BY_KEY[k]) out[k] = h; }
  return out;
};

// Every token of the template with its value and where it came from (what a page renders, what the Style tab shows).
export function resolveColors(venue: { template?: string | null; brand?: Brand | null; style?: StyleValues | null }, overrides?: Record<string, string | null>): Resolved {
  const tc = templateColors(venue.template);
  const legacy = (venue.style ?? {}) as StyleValues;
  const bases = tc.bases(venue.brand, legacy), pinned = tc.pinned(venue.brand, legacy);
  const custom = { ...customColors(venue.style) };
  for (const [k, v] of Object.entries(overrides ?? {})) { if (v === null) delete custom[k]; else custom[k] = v; }
  const out: Resolved = {};
  const page = { text: INK, bg: WHITE };
  for (const t of tokensOf(venue.template)) {
    const base = t.on ? out[t.on]?.value : undefined;
    let r: Resolved[string];
    if (custom[t.key]) r = { value: custom[t.key], state: 'custom', why: 'Custom' };
    else if (pinned[t.key] && (!base || THRESHOLD[t.kind] === 0 || contrast(pinned[t.key], base) >= THRESHOLD[t.kind])) r = { value: pinned[t.key], state: 'default', why: 'Venue default' };
    else if (t.rule && base) r = { value: derive(t.rule, base, page), state: 'auto', why: `Auto · ${RULE_WHY[t.rule](base, lowerLabel(t.on!))}` };
    else r = { value: bases[t.key] ?? WHITE, state: 'default', why: 'Venue default' };
    out[t.key] = r;
    if (t.key === 'page.bg') page.bg = r.value;
    if (t.key === 'page.text') page.text = r.value;
  }
  return out;
}

// The CSS a page renders for its colours: the variables on :root, plus the two rules that need a plain value because
// ::backdrop does not read custom properties in every browser (the dim at 45 %, the close button's shadow at 25 %).
export function colorCss(resolved: Resolved): string {
  const vars = Object.entries(resolved).map(([k, r]) => `${cssVar(k)}:${r.value}`).join(';');
  const dim = resolved['sheet.dim']?.value ?? BLACK;
  return `:root{${vars}}dialog.sheet::backdrop,dialog.list::backdrop{background:${dim};opacity:.45}.sheet-close{box-shadow:0 1px 4px ${dim}40}`;
}

// ---- the readability guard ----
export type GuardFail = { key: string; on: string; ratio: number; threshold: number; error: string; suggestion: { key: string; value: string } | null };
export type GuardResult = { ok: true; resolved: Resolved } | ({ ok: false } & GuardFail);
const r1 = (n: number) => (Math.round(n * 10) / 10).toFixed(1);
const dependents = (template: string | null | undefined, keys: Set<string>): Set<string> => {
  const all = new Set(keys); let grew = true;
  while (grew) { grew = false; for (const t of tokensOf(template)) if (t.on && all.has(t.on) && !all.has(t.key)) { all.add(t.key); grew = true; } }
  return all;
};
// Checks every readable pair that a patch touches (the changed tokens and everything linked to them). The first failing pair
// is refused with one line: the ratio, the threshold and the nearest colour that passes (for the token that was changed).
export function guard(venue: { template?: string | null; brand?: Brand | null; style?: StyleValues | null }, patch: Record<string, string | null>): GuardResult {
  const resolved = resolveColors(venue, patch);
  const touched = dependents(venue.template, new Set(Object.keys(patch)));
  for (const t of tokensOf(venue.template)) {
    const th = THRESHOLD[t.kind]; if (!th || !t.on) continue;
    if (!touched.has(t.key) && !touched.has(t.on)) continue;
    const ratio = contrast(resolved[t.key].value, resolved[t.on].value);
    if (ratio >= th) continue;
    const changedKey = t.key in patch ? t.key : t.on in patch ? t.on : Object.keys(patch).find((k) => dependents(venue.template, new Set([k])).has(t.on!)) ?? Object.keys(patch)[0];
    const suggestion = suggest(venue, patch, changedKey);
    const what = `${TOKEN_BY_KEY[t.key].label} on the ${lowerLabel(t.on)}`;
    const error = `${r1(ratio)}:1 — ${what} needs ${th}:1.${suggestion ? ` Use ${suggestion.value} instead.` : ''}`;
    return { ok: false, key: t.key, on: t.on, ratio, threshold: th, error, suggestion };
  }
  return { ok: true, resolved };
}
// The nearest colour to the changed one (toward black or toward white, whichever is closer) with which every touched pair passes.
function suggest(venue: { template?: string | null; brand?: Brand | null; style?: StyleValues | null }, patch: Record<string, string | null>, key: string): { key: string; value: string } | null {
  const from = patch[key]; if (!from) return null;
  const passes = (value: string) => {
    const p = { ...patch, [key]: value };
    const res = resolveColors(venue, p);
    const touched = dependents(venue.template, new Set(Object.keys(p)));
    return tokensOf(venue.template).every((t) => { const th = THRESHOLD[t.kind]; if (!th || !t.on || (!touched.has(t.key) && !touched.has(t.on))) return true; return contrast(res[t.key].value, res[t.on].value) >= th; });
  };
  for (let i = 1; i <= 100; i++) {
    const t = i / 100;
    const dark = mix(from, BLACK, t), light = mix(from, WHITE, t);
    const dOk = passes(dark), lOk = passes(light);
    if (dOk && lOk) return { key, value: isLight(from) ? dark : light };
    if (dOk) return { key, value: dark };
    if (lOk) return { key, value: light };
  }
  return null;
}
// Every readable pair of the current state that fails (shown as a warning in the Style tab; never blocks an unrelated edit).
export function unreadable(resolved: Resolved, template: string | null | undefined): { key: string; on: string; ratio: number; threshold: number }[] {
  const out: { key: string; on: string; ratio: number; threshold: number }[] = [];
  for (const t of tokensOf(template)) { const th = THRESHOLD[t.kind]; if (!th || !t.on || !resolved[t.key] || !resolved[t.on]) continue; const ratio = contrast(resolved[t.key].value, resolved[t.on].value); if (ratio < th) out.push({ key: t.key, on: t.on, ratio, threshold: th }); }
  return out;
}

// The venue's own palette (its brand record), offered as swatches. Keys become labels ("siteLink" → "Site link").
export function palette(brand: Brand | null | undefined): { label: string; value: string }[] {
  const seen = new Set<string>(); const out: { label: string; value: string }[] = [];
  for (const [k, v] of Object.entries(brand?.colors ?? {})) { const h = normHex(v); if (!h || seen.has(h)) continue; seen.add(h); out.push({ label: k.replace(/([A-Z])/g, ' $1').replace(/^./, (c) => c.toUpperCase()), value: h }); }
  return out;
}

// The colours every element had before the tokens (the white kit of 2026-10-07), per template, for the suite's day-one check.
// Three places had pure black (#000000) where the kit's ink (#1d1d1f) is now used, listed here so the difference is on record.
// The welcome screen's tokens (2026-10-09) are new and have no pre-token look; the day-one check skips them.
export const PRE_TOKEN_LOOK: Record<string, Record<string, string>> = {
  senso: { 'page.bg': '#ffffff', 'page.text': '#1d1d1f', 'page.band': '#f3f3f3', 'header.bg': '#ffffff', 'header.langBg': '#f2f2f2', 'header.langText': '#1d1d1f', 'tabs.bg': '#ffffff', 'tabs.text': '#6b6b6b', 'tabs.active': '#000000', 'tabs.indicator': '#000000', 'tabs.list': '#000000', 'tabs.line': '#e6e6e6', 'headings.title': '#1d1d1f', 'headings.note': '#6b6b6b', 'rows.bg': '#ffffff', 'rows.name': '#1d1d1f', 'rows.desc': '#6b6b6b', 'rows.price': '#1d1d1f', 'rows.chipBg': '#f3f3f3', 'rows.chipText': '#1d1d1f', 'rows.photo': '#f3f3f3', 'rows.line': '#e6e6e6', 'sheet.bg': '#ffffff', 'sheet.title': '#000000', 'sheet.price': '#000000', 'sheet.body': '#545454', 'sheet.muted': '#6b6b6b', 'sheet.line': '#e6e6e6', 'sheet.hero': '#f3f3f3', 'sheet.closeBg': '#ffffff', 'sheet.closeIcon': '#000000', 'sheet.dim': '#000000', 'footer.bg': '#ffffff', 'footer.label': '#1d1d1f', 'footer.address': '#6b6b6b', 'footer.hours': '#6b6b6b', 'footer.phone': '#042c7c' },
  'kebab-land': { 'page.bg': '#ffffff', 'page.text': '#1d1d1f', 'page.band': '#f3f3f3', 'header.bg': '#ffffff', 'header.tile': '#141414', 'header.langBg': '#f2f2f2', 'header.langText': '#1d1d1f', 'tabs.bg': '#ffffff', 'tabs.text': '#6b6b6b', 'tabs.active': '#000000', 'tabs.indicator': '#000000', 'tabs.list': '#000000', 'tabs.line': '#e6e6e6', 'headings.title': '#1d1d1f', 'headings.note': '#6b6b6b', 'rows.bg': '#ffffff', 'rows.name': '#1d1d1f', 'rows.desc': '#6b6b6b', 'rows.price': '#1d1d1f', 'rows.chipBg': '#f3f3f3', 'rows.chipText': '#1d1d1f', 'rows.photo': '#f3f3f3', 'rows.line': '#e6e6e6', 'sheet.bg': '#ffffff', 'sheet.title': '#000000', 'sheet.price': '#000000', 'sheet.body': '#545454', 'sheet.muted': '#6b6b6b', 'sheet.line': '#e6e6e6', 'sheet.hero': '#f3f3f3', 'sheet.closeBg': '#ffffff', 'sheet.closeIcon': '#000000', 'sheet.dim': '#000000', 'footer.bg': '#ffffff', 'footer.label': '#b92e2e', 'footer.address': '#1d1d1f', 'footer.hours': '#6b6b6b', 'footer.phone': '#b92e2e' },
};
// The tokens whose day-one default differs from the pre-token look, and why.
export const DAY_ONE_DIFFERENCES: { keys: string[]; before: string; after: string; why: string }[] = [
  { keys: ['tabs.active', 'tabs.indicator', 'tabs.list', 'sheet.title', 'sheet.price', 'sheet.closeIcon'], before: '#000000', after: '#1d1d1f', why: 'pure black in the kit CSS replaced by the page text colour (the kit\'s ink), so these follow the Page text token' },
];
