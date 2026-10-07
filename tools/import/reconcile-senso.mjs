// Reconciles the capture report's "website-only names" count with the import's unlisted items,
// from the raw data: which website names stopped being "website-only" and why.
import fs from 'node:fs/promises';
import path from 'node:path';
import { norm, lang, clean, splitPersian, applySpelling, SPELLING_FIXES } from './lib.mjs';
import { parseSensoWebsite } from './website-senso.mjs';

export async function reconcileSenso({ raw, date, importedUnlistedKeys }) {
  const mealsyDir = path.join(raw, 'mealsy-ro-sensocafe', date);
  const manifest = JSON.parse(await fs.readFile(path.join(mealsyDir, 'manifest.json'), 'utf8'));
  const menuFile = manifest.files.find((f) => f.type === 'decoded' && /dataCategory=1\b/.test(f.url));
  const payload = JSON.parse(await fs.readFile(path.join(mealsyDir, menuFile.path), 'utf8'));
  const menu = payload.Menus.find((m) => /^Senso Caf/.test(lang(m.Name) || ''));
  const mealsyRaw = new Map(); // norm(raw name) -> raw name
  for (const s of menu.MenuSections) for (const it of s.MenuItems) { const n = clean(lang(it.NameOnline) || lang(it.Name)); mealsyRaw.set(norm(n), n); }
  const mealsyFixed = new Map(); // norm(name after spelling fix, Persian split) -> {raw, fixed}
  for (const [, rawName] of mealsyRaw) { const en = applySpelling(splitPersian(rawName).en, 'mealsy-ro-sensocafe'); mealsyFixed.set(norm(en), { raw: rawName, fixed: en }); }
  const webManifest = JSON.parse(await fs.readFile(path.join(raw, 'sensocafe-our-menu', date, 'manifest.json'), 'utf8'));
  const cats = parseSensoWebsite(webManifest.observed.widgets);
  const webNames = new Map(); // norm(website name) -> { name, headings[] }
  for (const c of cats) for (const w of c.items) { const k = norm(w.name); if (!webNames.has(k)) webNames.set(k, { name: w.name.trim(), headings: [] }); webNames.get(k).headings.push(c.name); }
  // The capture report's rule: exact normalised match against raw Mealsy names.
  const reportWebsiteOnly = [...webNames.entries()].filter(([k]) => !mealsyRaw.has(k));
  const rows = [];
  for (const [k, w] of reportWebsiteOnly) {
    if (importedUnlistedKeys.has(k)) continue; // still an unlisted item: no difference
    const fixedName = applySpelling(w.name, 'sensocafe-our-menu');
    const kf = norm(fixedName);
    let why;
    if (kf !== k && mealsyFixed.has(kf)) why = `website spelling fix "${w.name}" → "${fixedName}" matches the Mealsy item "${mealsyFixed.get(kf).fixed}"`;
    else if (mealsyFixed.has(k) && !mealsyRaw.has(k)) why = `matches the Mealsy item after its spelling fix: "${mealsyFixed.get(k).raw}" → "${mealsyFixed.get(k).fixed}"`;
    else if (/\bjuice\b/.test(k) && mealsyFixed.has(k.replace(/\bjuice\b/, '').trim())) why = `juice name matched by meaning to the Mealsy Fresh Juice item "${mealsyFixed.get(k.replace(/\bjuice\b/, '').trim()).fixed}"`;
    else why = 'NOT FOUND in the import: must be restored';
    rows.push({ website: w.name, headings: [...new Set(w.headings)].join(' / '), outcome: why, lost: why.startsWith('NOT FOUND') });
  }
  return { reportWebsiteOnlyCount: reportWebsiteOnly.length, importedUnlistedCount: importedUnlistedKeys.size, rows };
}
