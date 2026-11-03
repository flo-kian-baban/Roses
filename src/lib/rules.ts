// Rules the server and the page editor share (pre-go-live audit, the PM's fix batch of 2026-11-03), so the editor never lets through what
// the server refuses: the price rule (H-04), how a typed price is read (S2-07, H-14), how typed text is cleaned (S2-03, S2-14), the length
// and count limits (S2-02, the PM's numbers) and Persian digits (S2-15, S2-21). No database or Node imports: this module runs in the browser.
import type { Variant } from '@/lib/types';

// The listing rule (PM): an item can be shown only if it has a price, or every size has a price. The database checks the same since
// migration 008 (listed_requires_price).
export function listingProblem(i: { price: string | number | null; variants: Variant[] }): string | null {
  if (i.price != null && i.price !== '') return null;
  if (i.variants.length && i.variants.every((v) => v.price != null && (v.price as unknown) !== '')) return null;
  return i.variants.length ? 'Every size needs a price before the item can be shown' : 'The item needs a price before it can be shown';
}

// Limits (the PM, 2026-11-03), in characters: names 100, descriptions 500, size and choice labels 60, section names 60, tagline 160,
// location fields 200. Decisions taken here, for the PM to confirm: a section's note and the allergen note's text as a description (500),
// "serves" and a combo part's label as a label (60), a venue's name as a name (100), a choice group's name as a choice label (60).
export const LIMITS = { name: 100, description: 500, label: 60, section: 60, note: 500, tagline: 160, location: 200, venueName: 100 } as const;
// Counts: at most 20 sizes, 10 choice groups of 20 choices each, 20 combo parts.
export const COUNTS = { sizes: 20, groups: 10, options: 20, parts: 20 } as const;

// The hosts the menus' linked photos come from (imported; until the photos are served from our own storage): a new linked photo must be on
// one of them (pre-go-live audit S2-04), and the customers' pages load images from them and from this site only (S2-10).
export const PHOTO_HOSTS = ['mealsymedia.s3.amazonaws.com', 'roseskebablands.com', 'sensocafe.ca'];

// Persian (U+06F0–9) and Arabic-Indic (U+0660–9) digits as Western ones: a PIN, a phone number or a price typed on a Persian keyboard.
export const westernDigits = (s: string): string => s.replace(/[\u06F0-\u06F9]/g, (d) => String(d.charCodeAt(0) - 0x06f0)).replace(/[\u0660-\u0669]/g, (d) => String(d.charCodeAt(0) - 0x0660));

// Typed text as it is saved: control characters and the invisible direction marks (U+202A–U+202E, U+2066–U+2069, e.g. pasted from Word,
// which garbled a row's price line) dropped; on one line, line breaks and tabs become spaces. The joiners Persian needs (U+200C, U+200D)
// stay. A text of only invisible characters is empty (a zero-width-only name passed "required" before).
const CONTROLS = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F\u202A-\u202E\u2066-\u2069]/g;
const INVISIBLE = /[\s\u00AD\u034F\u061C\u115F\u1160\u17B4\u17B5\u180E\u200B-\u200F\u2028\u2029\u205F-\u2064\u3164\uFE00-\uFE0F\uFEFF\uFFA0]/g;
export function cleanText(s: string, opts: { lines?: boolean } = {}): string {
  let t = s.replace(/\r\n?/g, '\n').replace(CONTROLS, '');
  t = opts.lines ? t.replace(/\t/g, ' ') : t.replace(/[\n\t]+/g, ' ');
  t = t.trim();
  return t.replace(INVISIBLE, '') === '' ? '' : t;
}
// Length as people count it (a character outside the basic plane counts once).
export const lengthOf = (s: string): number => [...s].length;

// A typed price (S2-07, H-14): digits with up to two decimals, a "$" in front allowed, a decimal comma read as a point ("1,50" = 1.50),
// Persian digits read as Western; at most 999999.99. Empty means no price. Anything else is not a price (before: " " and "$" saved $0.00,
// "0x10" and "1e3" passed, "0.001" became $0.00, and the editor let through what the server refused).
export const PRICE_RE = /^\$?\d{1,6}(\.\d{1,2})?$/;
export function parsePrice(v: unknown): number | null | 'bad' {
  if (v == null) return null;
  if (typeof v === 'number') return Number.isFinite(v) && v >= 0 && v <= 999999.99 && Math.abs(v * 100 - Math.round(v * 100)) < 1e-6 ? Math.round(v * 100) / 100 : 'bad';
  if (typeof v !== 'string') return 'bad';
  let t = westernDigits(v).replace(/\s+/g, '');
  if (t === '') return null;
  t = t.replace(/^(\$?\d{1,6}),(\d{1,2})$/, '$1.$2');
  if (!PRICE_RE.test(t)) return 'bad';
  return Math.round(Number(t.replace(/^\$/, '')) * 100) / 100;
}

// A phone number (S2-15): digits, spaces, (), +, - and dots, with 7 to 15 digits (a number with no digits gave a dead tap-to-call link);
// Persian digits read as Western.
export function phoneOf(s: string): string | 'bad' {
  const t = westernDigits(s).trim();
  if (!/^[\d\s()+\-.]+$/.test(t)) return 'bad';
  const n = t.replace(/\D/g, '').length;
  return n >= 7 && n <= 15 ? t : 'bad';
}
