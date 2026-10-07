// Builds the Roses Kebab Land rows from the 2026-10-07 capture of roseskebablands.com/menu-land and /drinks
// (Kian's decision: the website is the only source; Mealsy is not used). One menu for both locations.
import fs from 'node:fs/promises';
import path from 'node:path';
import { norm, clean, applySpelling, fixDescription, money, encodeUrl } from './lib.mjs';
import { parseKebabLandPage } from './website-kebab-land.mjs';

const PAGES = ['roseskebablands-menu-land', 'roseskebablands-drinks'];
// Names used inside descriptions for dishes that exist under another spelling on the same site.
const ALIASES = { 'mast o mosir': 'yogurt with shallot dip maast o moosir', 'mast o moosir': 'yogurt with shallot dip maast o moosir', 'babaganosh': 'baba ghanoosh', 'baba ghanoosh': 'baba ghanoosh' };
const QTY = { a: 1, an: 1, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6 };

export async function buildKebabLand({ raw, date, drafts }) {
  const log = { fixes: [], oddities: [], persian: { fromSource: [], drafted: [], missing: [] }, unlisted: [], components: [], unusedImages: [], mergedPlacements: [], variants: [], serves: [] };
  const skey = (en) => `kebab-land:section:${norm(en).replace(/ /g, '-')}`;
  const ikey = (en) => `kebab-land:item:${norm(en).replace(/ /g, '-')}`;
  const faFor = (field, en, what) => {
    if (!en) return { fa: null, draft: false };
    if (drafts[en]) { log.persian.drafted.push({ what, field, en, fa: drafts[en] }); return { fa: drafts[en], draft: true }; }
    log.persian.missing.push({ what, field, en }); return { fa: null, draft: false };
  };
  const sections = []; const items = []; const itemByKey = new Map();
  for (const slug of PAGES) {
    const manifest = JSON.parse(await fs.readFile(path.join(raw, slug, date, 'manifest.json'), 'utf8'));
    const parsed = parseKebabLandPage(manifest.observed.widgets, slug);
    for (const u of parsed.unusedImages) log.unusedImages.push({ page: slug, ...u });
    for (const n of parsed.notes) log.oddities.push(`${slug}: ${n.note}: "${n.text}" (widget ${n.widgetIndex}).`);
    for (const s of parsed.sections) {
      const en = clean(s.name);
      const fa = faFor('name', en, `section "${en}"`);
      const noteEn = s.notes.join(' ') || null;
      const noteFa = noteEn ? faFor('note', noteEn, `section "${en}" note`) : { fa: null, draft: false };
      const faDraft = []; if (fa.draft) faDraft.push('name'); if (noteFa.draft) faDraft.push('note');
      const sec = { importKey: skey(en), name: { en, fa: fa.fa }, note: { en: noteEn, fa: noteFa.fa }, position: sections.length, listed: true, faDraft, source: [{ source: slug, heading: s.name, widgetIndex: s.widgetIndex, visibleOnPhone: s.visibleOnPhone }] };
      sections.push(sec);
      if (!s.visibleOnPhone) log.oddities.push(`Section "${en}" (${s.items.length} priced items) is hidden on phones by the website's layout (Elementor "hidden on mobile"); imported listed because every item is priced. The owner can unlist it in the admin.`);
      if (!s.items.length) log.oddities.push(`Section "${en}" has no items on the website, only the line "${noteEn}" (kept as the section note); it never shows to customers until an item is listed in it.`);
      s.items.forEach((it, idx) => {
        const nameFixed = applySpelling(it.name, slug, log.fixes);
        let key = norm(nameFixed);
        if (itemByKey.has(key)) { log.oddities.push(`"${nameFixed}" appears twice on the website (${itemByKey.get(key).source[0].heading} and ${s.name}); both kept.`); key = `${key} ${norm(s.name)}`; }
        const desc = it.description.map((d) => fixDescription(d, slug, log.fixes)).filter(Boolean).join('\n') || null;
        const variants = it.variants.map((v) => ({ label: { en: v.label, fa: null }, price: money(v.price) }));
        const price = money(it.price);
        const listed = price != null || (variants.length > 0 && variants.every((v) => v.price != null));
        const faName = faFor('name', nameFixed, `item "${nameFixed}"`);
        const faDesc = desc ? faFor('description', desc, `item "${nameFixed}"`) : { fa: null, draft: false };
        const faDraft = []; if (faName.draft) faDraft.push('name'); if (faDesc.draft) faDraft.push('description');
        let vDraft = false;
        for (const v of variants) { const f = faFor('variant', v.label.en, `size "${v.label.en}" of "${nameFixed}"`); v.label.fa = f.fa; if (f.draft) vDraft = true; }
        if (vDraft) faDraft.push('variants');
        const item = {
          importKey: ikey(key), name: { en: nameFixed, fa: faName.fa }, description: { en: desc, fa: faDesc.fa },
          price, variants, addOns: [], components: [], serves: it.serves || null,
          photo: it.imgSrc ? { url: encodeUrl(it.imgSrc), alt: { en: it.imgAlt || nameFixed, fa: faName.fa } } : null,
          listed, faDraft, source: [{ source: slug, heading: s.name, widgets: it.sourceWidgets }],
          placements: [{ section: sec.importKey, position: idx }],
        };
        items.push(item); itemByKey.set(key, item);
        if (!listed) log.unlisted.push({ item: nameFixed, section: en, websiteHeading: s.name });
        if (variants.length) log.variants.push({ item: nameFixed, section: en, sizes: variants.map((v) => `${v.label.en} $${v.price}`).join(', ') });
        if (item.serves) log.serves.push({ item: nameFixed, section: en, serves: item.serves });
      });
    }
  }

  // Combos: components named in descriptions; linked to an item of this venue when the name resolves uniquely.
  const byNorm = new Map(items.map((i) => [norm(i.name.en), i]));
  const resolve = (label) => {
    const n = norm(label).replace(/\bkabob\b|\bkabab\b/g, 'kebab');
    const tries = [n, ALIASES[n], `${n} kebab`].filter(Boolean);
    for (const t of tries) { if (byNorm.has(t)) return byNorm.get(t); const suffix = items.filter((i) => norm(i.name.en).endsWith(' ' + t)); if (suffix.length === 1) return suffix[0]; }
    return null;
  };
  for (const it of items) {
    const d = it.description.en; if (!d) continue;
    const parts = [];
    const heading = it.source[0].heading;
    // A combo lists two or more dishes: "a skewer of X, a skewer of Y", "X – Y – Z" (appetizer plates), "One Side X, One Side Y".
    // A single dish described as "Two skewers of ground beef…" is not a combo.
    if (/Appetizers/.test(heading) && /\s[–-]\s/.test(d)) for (const p of d.split(/\s[–-]\s/)) parts.push({ qty: 1, label: clean(p).replace(/^\(|\)$/g, '') });
    const skewers = [...d.matchAll(/(?:^|,|;)\s*(?:(\d+|a|an|one|two|three|four)\s+)?(skewers?|pieces?)\s+of\s+([^,;]+)/gi)];
    if (skewers.length >= 2) for (const m of skewers) parts.push({ qty: m[1] ? (QTY[m[1].toLowerCase()] ?? Number(m[1])) : 1, label: clean(m[3]) });
    if (skewers.length >= 2) for (const m of d.matchAll(/(\d+)\s+rice servings?/gi)) parts.push({ qty: Number(m[1]), label: 'Rice serving' });
    for (const m of d.matchAll(/one side ([^,]+)/gi)) parts.push({ qty: 1, label: clean(m[1]) });
    if (!parts.length) continue;
    it.components = parts.map((p) => { const hit = p.label === 'Rice serving' ? null : resolve(p.label); return { item_id: null, import_key: hit ? hit.importKey : null, label: { en: p.label, fa: null }, qty: p.qty }; });
    for (const c of it.components) { const f = faFor('component', c.label.en, `component "${c.label.en}" of "${it.name.en}"`); c.label.fa = f.fa; if (f.draft && !it.faDraft.includes('components')) it.faDraft.push('components'); }
    log.components.push({ item: it.name.en, components: it.components.map((c) => `${c.qty}× ${c.label.en}${c.import_key ? ' → ' + items.find((x) => x.importKey === c.import_key).name.en : ' (no matching item)'}`).join('; ') });
  }

  // Known factual errors, imported as-is (the owner decides in the admin).
  const byName = (n) => items.find((i) => i.name.en === n);
  const same = ['Fresh Berry Mojito-Virgin', 'Red Wine Sangria'].map(byName);
  if (same[0]?.description.en && same[0].description.en === same[1]?.description.en) log.oddities.push(`"Fresh Berry Mojito-Virgin" and "Red Wine Sangria" carry the same description on the website ("${same[0].description.en}"): a virgin mojito and a red sangria both described as rosé wine.`);
  if (byName('Black Russian')?.description.en) log.oddities.push(`"Black Russian" is described as "${byName('Black Russian').description.en}" (a Black Russian is vodka and coffee liqueur).`);
  log.oddities.push('"Blue Lagoon": the website description begins "odka, blue curaçao…"; imported with the missing V restored (section 1).');
  log.oddities.push(`Price order: Mohtasham $${byName('Mohtasham')?.price} (Barg + Chicken Breast) costs more than Soltani $${byName('Soltani Kebab')?.price} (Barg + Koobideh); as on the website.`);
  log.oddities.push('Tap-to-call: both website pages carry a call link whose digits differ from the displayed number (capture manifests: hrefDigitsMatchDisplayed = false; digits not kept). This app dials exactly the displayed number, which stays "to confirm".');
  log.oddities.push('Same dish under several names, kept as written: "Fillet Chenjeh Kebab" vs "Chenjeh Tehrani Kebab" (inside Kaseh Kebab) vs "Chenjeh Kebab" (inside Special Chef Dish, Mozaffari, Platters); "Gilaki Sour Kebab" vs "Sour Kebab" (inside Yeylaghi, Platter 4); "Yogurt with Shallot Dip (Maast o Moosir)" vs "Mast o mosir" / "Mast o Moosir" (inside the mixed appetizers); "Koobideh Kebab" inside combos could be either Bazari or Roses Koobideh, so it is not linked.');
  log.oddities.push('"Venato (Italy)" in Wine Bottles may be "Veneto"; left as written (it could be a label name).');
  log.oddities.push('"Long Island Ice tea" left as written (commonly "Iced Tea"); "Rose Cesar" left as written (the site\'s own name for its Caesar).');
  log.oddities.push('"Sultan’s Goblet" has two pictures on the website; the first (a photo) is linked, the second (a graphic titled in Persian) is not. "Persian Dreams" has a picture hidden on phones, not linked. The "Classics" picture (an Old Fashioned) belongs to no item.');
  log.oddities.push('"Sake": the website says "Bottle shown for display"; the price $70 is for a sake cup as written.');
  log.oddities.push('Descriptions that sit in two text blocks on the website ("Sultan’s Goblet", "Sake") are joined with a line break.');

  const stats = { sections: sections.length, items: items.length, mealsyItems: 0, listed: items.filter((i) => i.listed).length, unlisted: items.filter((i) => !i.listed).length, websiteNames: items.length, websiteMatched: 0, variants: log.variants.length, serves: log.serves.length, components: log.components.length, photos: items.filter((i) => i.photo).length };
  return { venue: 'kebab-land', generatedAt: new Date().toISOString(), sections, items, stats, log };
}
