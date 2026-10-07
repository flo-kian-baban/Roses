// Builds the Senso rows from the 2026-10-07 capture: Mealsy "Senso Café Menu" is the source;
// sensocafe.ca adds descriptions where Mealsy's is empty and its website-only names as unlisted items.
import fs from 'node:fs/promises';
import path from 'node:path';
import { norm, lang, clean, splitPersian, titleCase, applySpelling, fixDescription, money, encodeUrl, websiteSectionFor } from './lib.mjs';
import { parseSensoWebsite } from './website-senso.mjs';

export async function buildSenso({ raw, date, drafts }) {
  const log = { fixes: [], matches: [], juiceMatches: [], descriptionsFromWebsite: [], mergedPlacements: [], placements: [], newSections: [], persian: { fromSource: [], drafted: [], missing: [] }, unlisted: [], oddities: [] };
  const mealsyDir = path.join(raw, 'mealsy-ro-sensocafe', date);
  const manifest = JSON.parse(await fs.readFile(path.join(mealsyDir, 'manifest.json'), 'utf8'));
  const menuFile = manifest.files.find((f) => f.type === 'decoded' && /dataCategory=1\b/.test(f.url));
  const payload = JSON.parse(await fs.readFile(path.join(mealsyDir, menuFile.path), 'utf8'));
  const menu = payload.Menus.find((m) => /^Senso Caf/.test(lang(m.Name) || ''));
  if (!menu) throw new Error('Senso Café Menu not found in the Mealsy payload');
  const SRC_M = 'mealsy-ro-sensocafe', SRC_W = 'sensocafe-our-menu';
  const skey = (en) => `senso:section:${norm(en).replace(/ /g, '-')}`;
  const ikey = (en) => `senso:item:${norm(en).replace(/ /g, '-')}`;

  // Persian: from the source string when present, else from the drafts file.
  const faFor = (field, en, split, what) => {
    if (split.fa) { log.persian.fromSource.push({ what, field, en, fa: split.fa }); return { fa: split.fa, draft: false }; }
    if (en && drafts[en]) { log.persian.drafted.push({ what, field, en, fa: drafts[en] }); return { fa: drafts[en], draft: true }; }
    if (en) log.persian.missing.push({ what, field, en });
    return { fa: null, draft: false };
  };

  // --- sections from Mealsy
  const sections = []; const sectionByName = new Map();
  for (const s of [...menu.MenuSections].filter((s) => s.Status === 1).sort((a, b) => a.Position - b.Position)) {
    const rawName = clean(lang(s.NameOnline) || lang(s.Name));
    const split = splitPersian(rawName);
    const en = titleCase(split.en);
    const fa = faFor('name', en, split, `section "${en}"`);
    const sec = { importKey: skey(en), name: { en, fa: fa.fa }, note: { en: null, fa: null }, position: sections.length, listed: true, faDraft: fa.draft ? ['name'] : [], source: [{ source: SRC_M, id: s.Id, name: rawName }] };
    sections.push(sec); sectionByName.set(norm(en), sec);
    if (rawName !== en && !split.fa) log.fixes.push({ source: SRC_M, before: rawName, after: en, kind: 'section title case / whitespace' });
  }

  // --- items from Mealsy
  const items = []; const itemByKey = new Map();
  for (const s of menu.MenuSections.filter((s) => s.Status === 1)) {
    const sec = sectionByName.get(norm(titleCase(splitPersian(clean(lang(s.NameOnline) || lang(s.Name))).en)));
    for (const it of [...s.MenuItems].filter((i) => i.Status === 1).sort((a, b) => a.Position - b.Position)) {
      const rawName = clean(lang(it.NameOnline) || lang(it.Name));
      const split = splitPersian(rawName);
      const en = applySpelling(split.en, SRC_M, log.fixes);
      const key = norm(en);
      const price = money(it.Price);
      const existing = itemByKey.get(key);
      if (existing) {
        if (existing.price === price) {
          existing.placements.push({ section: sec.importKey, position: it.Position });
          existing.source.push({ source: SRC_M, id: it.Id, section: sec.name.en });
          log.mergedPlacements.push({ item: en, sections: existing.placements.map((p) => sections.find((x) => x.importKey === p.section).name.en) });
          continue;
        }
        log.oddities.push(`"${en}" appears twice in Mealsy with different prices ($${existing.price} in ${existing.placements.map((p) => sections.find((x) => x.importKey === p.section).name.en).join('/')}, $${price} in ${sec.name.en}); both kept.`);
      }
      const faName = faFor('name', en, split, `item "${en}"`);
      const dsplit = splitPersian(fixDescription(lang(it.Description), SRC_M, log.fixes));
      const faDesc = dsplit.en || dsplit.fa ? faFor('description', dsplit.en, dsplit, `item "${en}"`) : { fa: null, draft: false };
      const addOns = [];
      for (const g of it.ModifierGroups || []) {
        const gsplit = splitPersian(clean(lang(g.Name)));
        const gfa = faFor('addOns', gsplit.en, gsplit, `add-on group "${gsplit.en}" of "${en}"`);
        for (const m of g.Modifiers || []) {
          const msplit = splitPersian(clean(lang(m.Name)));
          const mfa = faFor('addOns', msplit.en, msplit, `add-on "${msplit.en}" of "${en}"`);
          addOns.push({ group: { en: gsplit.en, fa: gfa.fa }, label: { en: msplit.en, fa: mfa.fa }, price: money(m.Price) || 0, required: (g.MinPermittedModifiers || 0) > 0 });
        }
      }
      const photoUrl = encodeUrl(lang(it.PhotoPathOnline));
      const faDraft = [];
      if (faName.draft) faDraft.push('name');
      if (faDesc.draft) faDraft.push('description');
      if (addOns.length && (addOns.some((a) => a.label.fa && !log.persian.fromSource.some((p) => p.en === a.label.en)))) faDraft.push('addOns');
      const item = {
        importKey: existing ? `${ikey(en)}--${sec.importKey.split(':').pop()}` : ikey(en),
        name: { en, fa: faName.fa }, description: { en: dsplit.en, fa: faDesc.fa || dsplit.fa },
        price, variants: [], addOns, components: [], serves: null,
        photo: photoUrl && !/NoPhotos/.test(photoUrl) ? { url: photoUrl, alt: { en, fa: faName.fa } } : null,
        listed: price != null, faDraft, source: [{ source: SRC_M, id: it.Id, section: sec.name.en }],
        placements: [{ section: sec.importKey, position: it.Position }],
      };
      items.push(item); if (!existing) itemByKey.set(key, item);
    }
  }
  const mealsyCount = items.length;

  // --- website: descriptions where Mealsy's is empty; website-only names as unlisted items
  const webManifest = JSON.parse(await fs.readFile(path.join(raw, SRC_W, date, 'manifest.json'), 'utf8'));
  const cats = parseSensoWebsite(webManifest.observed.widgets);
  const freshJuice = sectionByName.get(norm('Fresh Juice'));
  const juiceItems = items.filter((i) => i.placements.some((p) => p.section === freshJuice.importKey));
  let nextPosition = 1000;
  for (const cat of cats) {
    for (const w of cat.items) {
      const fixed = applySpelling(w.name, SRC_W, log.fixes);
      const key = norm(fixed);
      let match = itemByKey.get(key);
      if (!match && /^Juice Bar/.test(cat.name) && /\bjuice\b/.test(key)) {
        match = juiceItems.find((i) => norm(i.name.en) === key.replace(/\bjuice\b/, '').trim());
        if (match) log.juiceMatches.push({ website: fixed, mealsy: match.name.en });
      }
      if (match) {
        log.matches.push({ website: fixed, heading: cat.name, mealsy: match.name.en });
        if (w.description && !match.description.en) {
          match.description.en = fixDescription(w.description, SRC_W, log.fixes);
          match.source.push({ source: SRC_W, field: 'description', heading: cat.name });
          log.descriptionsFromWebsite.push({ item: match.name.en, description: match.description.en });
          const d = faFor('description', match.description.en, { fa: null }, `item "${match.name.en}"`);
          if (d.fa) { match.description.fa = d.fa; if (!match.faDraft.includes('description')) match.faDraft.push('description'); }
        }
        continue;
      }
      // website-only
      const sectionName = websiteSectionFor(cat.name, fixed);
      let sec = sectionByName.get(norm(sectionName));
      if (!sec) {
        sec = { importKey: skey(sectionName), name: { en: sectionName, fa: null }, note: { en: null, fa: null }, position: sections.length, listed: true, faDraft: [], source: [{ source: SRC_W, heading: cat.name }] };
        const f = faFor('name', sectionName, { fa: null }, `section "${sectionName}"`); sec.name.fa = f.fa; if (f.draft) sec.faDraft.push('name');
        sections.push(sec); sectionByName.set(norm(sectionName), sec); log.newSections.push(sectionName);
      }
      const existing = itemByKey.get(key);
      if (existing) {
        if (!existing.placements.some((p) => p.section === sec.importKey)) { existing.placements.push({ section: sec.importKey, position: nextPosition++ }); }
        existing.source.push({ source: SRC_W, heading: cat.name });
        log.placements.push({ item: fixed, websiteHeading: cat.name, section: sec.name.en, note: 'second website heading, same item' });
        continue;
      }
      const item = {
        importKey: ikey(fixed), name: { en: fixed, fa: null }, description: { en: w.description ? fixDescription(w.description, SRC_W, log.fixes) : null, fa: null },
        price: null, variants: [], addOns: [], components: [], serves: null,
        photo: w.imgSrc ? { url: encodeUrl(w.imgSrc), alt: { en: fixed, fa: null } } : null,
        listed: false, faDraft: [], source: [{ source: SRC_W, heading: cat.name }],
        placements: [{ section: sec.importKey, position: nextPosition++ }],
      };
      items.push(item); itemByKey.set(key, item);
      log.placements.push({ item: fixed, websiteHeading: cat.name, section: sec.name.en });
      log.unlisted.push({ item: fixed, section: sec.name.en, websiteHeading: cat.name });
    }
    if (cat.headingOnly) log.oddities.push(`Website juice heading "${cat.subHeading}" has no list under it; imported as one unlisted item.`);
  }
  log.oddities.push('Website juice block titled "Green Mojito" lists banana milks; those lines were imported as unlisted Fresh Juice items under their own names.');

  const stats = { sections: sections.length, items: items.length, mealsyItems: mealsyCount, listed: items.filter((i) => i.listed).length, unlisted: items.filter((i) => !i.listed).length, websiteNames: cats.reduce((a, c) => a + c.items.length, 0), websiteMatched: log.matches.length };
  return { venue: 'senso', generatedAt: new Date().toISOString(), sections, items, stats, log };
}
