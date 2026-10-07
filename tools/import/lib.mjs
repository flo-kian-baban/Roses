// Shared helpers for the import. Pure functions, no database access.

export const PERSIAN = /[؀-ۿ‌‏ً-ٟ]/;

// Lower-case key for matching names: Persian removed, punctuation collapsed.
export function norm(s) {
  return String(s ?? '').normalize('NFKD').replace(/[؀-ۿ‌‏]+/g, ' ').replace(/[’'`´]/g, '').replace(/[^a-z0-9]+/gi, ' ').trim().toLowerCase();
}

// Mealsy stores text as a JSON string {"En": "..."}; returns the English value or the raw string.
export function lang(s) {
  if (s == null) return null;
  if (typeof s !== 'string') return s;
  try { const j = JSON.parse(s); if (j && typeof j === 'object') return j.En ?? null; return s; } catch { return s; }
}

export function clean(s) { return String(s ?? '').replace(/\s+/g, ' ').trim(); }

// Splits a mixed string into English and Persian parts, keeping each side's word order.
export function splitPersian(s) {
  const t = clean(s);
  if (!t) return { en: null, fa: null };
  if (!PERSIAN.test(t)) return { en: t, fa: null };
  const fa = clean(t.replace(/[^؀-ۿ‌‏ً-ٟ0-9\s\-–—,،؛؟()]+/g, ' ').replace(/^[\s\-–—,()]+|[\s\-–—,()]+$/g, ''));
  let en = clean(t.replace(/[؀-ۿ‌‏ً-ٟ،؛؟]+/g, ' '));
  en = clean(en.replace(/\(\s*\)/g, '').replace(/\s+([,.)])/g, '$1').replace(/^[\s\-–—,()]+|[\s\-–—,()]+$/g, ''));
  // A description that is only Persian with an English gloss in parentheses: use the gloss as English.
  const gloss = en.match(/^\((.*)\)$/);
  if (gloss) en = clean(gloss[1]);
  return { en: en || null, fa: fa || null };
}

// Title case for section names ("Senso pizza" -> "Senso Pizza"); keeps "&" and short joiners.
export function titleCase(s) {
  const small = new Set(['and', 'or', 'of', 'the', 'with', 'o']);
  return clean(s).split(' ').map((w, i) => (small.has(w.toLowerCase()) && i > 0) ? w.toLowerCase() : (w.charAt(0).toUpperCase() + w.slice(1))).join(' ');
}

// Spelling-only fixes: misspelled English words. Transliterations are never changed.
export const SPELLING_FIXES = [
  { source: 'mealsy-ro-sensocafe', before: 'Caramel Machiato', after: 'Caramel Macchiato' },
  { source: 'mealsy-ro-sensocafe', before: 'Iced Caramel Machiato', after: 'Iced Caramel Macchiato' },
  { source: 'mealsy-ro-sensocafe', before: 'Caeser salad', after: 'Caesar Salad' },
  { source: 'mealsy-ro-sensocafe', before: 'Extra Beef Baccon', after: 'Extra Beef Bacon' },
  { source: 'sensocafe-our-menu', before: 'Match Latte', after: 'Matcha Latte' },
  { source: 'mealsy-ro-sensocafe', before: 'Brain &Tongue Omelette', after: 'Brain & Tongue Omelette' },
];
export function applySpelling(s, source, log) {
  let out = clean(s);
  for (const f of SPELLING_FIXES) {
    if (f.source === source && out === f.before) { if (log) log.push({ source, before: out, after: f.after }); out = f.after; }
  }
  return out;
}

// Misspelled English words inside descriptions (word-level, logged per occurrence).
export const DESCRIPTION_FIXES = [
  { before: 'Mozzerella', after: 'Mozzarella' },
  { before: 'Olive Oli', after: 'Olive Oil' },
];
export function fixDescription(s, source, log) {
  let out = clean(s);
  for (const f of DESCRIPTION_FIXES) if (out.includes(f.before)) { if (log) log.push({ source, before: f.before, after: f.after, kind: 'spelling (description)' }); out = out.split(f.before).join(f.after); }
  return out;
}

export function money(n) { return n == null ? null : Math.round(Number(n) * 100) / 100; }
export function encodeUrl(u) { return u ? u.replace(/ /g, '%20') : u; }

// Website heading -> Mealsy section, by meaning (Kian's decision of 2026-10-07).
// A function because "Hot & Cold Beverages" is decided per item.
export function websiteSectionFor(heading, itemName) {
  const h = heading.replace(/^Juice Bar › .*/, 'Juice Bar').replace(/^Ice Cream › .*/, 'Ice Pack').replace(/^Milkshake › Majoun$/, 'Majoun');
  const n = norm(itemName);
  switch (h) {
    case 'Appetizers': return 'Appetizer';
    case 'Salads': return 'Salad';
    case 'Senso Pizzas': return 'Senso Pizza';
    case 'Juice Bar': return 'Fresh Juice';
    case 'Ice Pack': return 'Ice Cream';
    case 'Majoun': return 'Senso Signature';
    case 'Hot & Cold Beverages':
      if (/\btea\b/.test(n)) return 'Tea & Herbal Tea';
      if (/^iced?\b/.test(n)) return 'Cold Beverage';
      return 'Hot Beverage';
    case 'Pancake & Waffle': return 'Pancake & Waffle'; // no Mealsy section means this: new section
    default: return titleCase(h); // Senso Signature, Persian Breakfast, Main Course, Ice Cream, Milkshake, Dessert
  }
}
