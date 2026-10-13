#!/usr/bin/env node
// Writes research-report.md beside a menu research record (data/import/<date>/<venue>/research.json; Kian via the PM, 2026-10-12): the
// rules followed, the counts, the items the venue must confirm (low confidence), every existing description that contradicts the research
// (flagged, never fixed), every note for the kitchen, and the Persian drafts. Built from the record alone, so it can be written again.
//   node tools/import/research-report.mjs data/import/2026-10-12/senso/research.json
import fs from 'node:fs';
import path from 'node:path';

const file = process.argv[2];
if (!file) { console.error('usage: node tools/import/research-report.mjs <research.json>'); process.exit(2); }
const rec = JSON.parse(fs.readFileSync(file, 'utf8'));
const words = JSON.parse(fs.readFileSync('src/lib/allergens.json', 'utf8'));
const its = rec.items, name = rec.venue === 'senso' ? 'Senso Café & Bites' : 'Roses Kebab Land';
const n = (f) => its.filter(f).length;
const cell = (s) => String(s ?? '').replace(/\|/g, '\\|').replace(/\s*\n\s*/g, ' ');
const CLAIM_NAMES = /cancer|allergy|digestive|power|relaxing|stressless|women's life|ginger shot|detox/i;
const lines = [
  `# Menu research — ${name} (${rec.date})`, '',
  `Record: \`${path.basename(file)}\` beside this file (${its.length} items: every item shown on the venue's page on ${rec.date}). Applied by \`tools/import/research-apply.mjs\` (also step 7 of \`npm run setup\`), reviewed in \`reports/research-review-${rec.venue}.csv\` and read back by \`tools/import/research-review-apply.mjs\`. Written by the research, recorded as "${rec.recordedBy}".`, '',
  '## Rules followed (Kian via the PM, 2026-10-12)', '',
  '- Names, prices, sections and every existing text are never changed. A description is written only where the field is empty: English and Persian; where one language existed, the other is written from it (same ingredients, nothing added).',
  `- Style: 1–2 short lines, at most 25 English words: the key ingredients and why the item is worth ordering, not a recipe. Voice: ${rec.venue === 'senso' ? 'a warm daytime café' : 'a Persian grill with a friendly bar'}. Persian written as a Persian menu reads, not a literal translation; Western digits.`,
  '- No superlatives about the venue or the dish, no health, medical or nutrition claims, even where the item\'s name implies one (the names are the venue\'s decision, ruling 11, and stay as they are). The word lists: `tools/import/research-lexicon.mjs` (`CLAIM_WORDS`, `SUPERLATIVES`).',
  '- Every ingredient a description names (the existing ones included) is in the item\'s key ingredients, and its allergen is in the allergen draft (checked by `scripts/research-drill.mjs` with the lexicon in `tools/import/research-lexicon.mjs`).',
  `- Allergens, "contains" only, never "free-from": Health Canada's priority food allergens plus the other gluten sources, these words only: ${words.allergens.map((a) => `${a.en} (${a.fa})`).join(', ')}. Optional add-ons are the customer's choice: their allergens are in the item's note, not in its allergens. A distilled spirit does not get the grain it is made from.`,
  '- Dietary: Vegetarian or Vegan only, as drafts; empty when unsure (wine, beer and spirits included, which may be fined with animal products). Never gluten-free, dairy-free or nut-free; halal never set.',
  '- Basis per item: the assumed key ingredients and one source URL for the dish or drink type (Wikipedia where it has an article; every URL answered 200 when it was recorded).',
  '- Customers: the new descriptions are shown (marked as drafts in the admin: English "Draft", Persian "Persian draft"); the allergen and dietary drafts are not in the public HTML until an owner or admin confirms them (Confirm in the item editor, or "yes" in the review sheet).', '',
  '## Counts', '',
  `| | Items |`, '| --- | --- |',
  `| In the record (shown items) | ${its.length} |`,
  `| New English descriptions | ${n((i) => i.newEn)} |`,
  `| New Persian descriptions (Persian drafts) | ${n((i) => i.newFa)} |`,
  `| With at least one allergen in the draft | ${n((i) => i.allergens.length)} |`,
  `| No priority allergen found in the typical recipe | ${n((i) => !i.allergens.length)} |`,
  `| Dietary draft Vegetarian / Vegan / none | ${n((i) => i.dietary.includes('Vegetarian'))} / ${n((i) => i.dietary.includes('Vegan'))} / ${n((i) => !i.dietary.length)} |`,
  `| Confidence high / medium / low | ${n((i) => i.confidence === 'high')} / ${n((i) => i.confidence === 'medium')} / ${n((i) => i.confidence === 'low')} |`, '',
  ...words.allergens.map((a) => a.en).filter((a) => n((i) => i.allergens.includes(a))).map((a, k, all) => (k === 0 ? `Allergens across the drafts: ${all.map((x) => `${x} ${n((i) => i.allergens.includes(x))}`).join(', ')}.` : null)).filter(Boolean), '',
  '## Existing descriptions that contradict the research (flagged, not fixed)', '',
  ...(n((i) => i.contradiction) ? ['| Item | Why |', '| --- | --- |', ...its.filter((i) => i.contradiction).map((i) => `| ${cell(i.name)} | ${cell(i.contradiction)} |`)] : ['None.']), '',
  '## Changes the build agent made to the research drafts (before the record was written)', '',
  ...((rec.edits ?? []).length ? rec.edits.map((e) => `- ${e}`) : ['None.']), '',
  '## For the venue to confirm (low confidence)', '',
  ...(n((i) => i.confidence === 'low') ? ['| Item | What the venue must confirm |', '| --- | --- |', ...its.filter((i) => i.confidence === 'low').map((i) => `| ${cell(i.name)} | ${cell(i.note)} |`)] : ['None.']), '',
  '## Items whose names carry a health claim (names kept; descriptions describe taste and ingredients only)', '',
  ...(n((i) => CLAIM_NAMES.test(i.name)) ? its.filter((i) => CLAIM_NAMES.test(i.name)).map((i) => `- ${i.name}${i.newEn ? `: "${i.newEn}"` : ' (its own description kept)'}`) : ['None.']), '',
  '## Every item: draft and basis', '',
  '| Item | Allergens (draft) | Dietary (draft) | Key ingredients | Source | Confidence | Note |', '| --- | --- | --- | --- | --- | --- | --- |',
  ...its.map((i) => `| ${cell(i.name)} | ${i.allergens.join(', ') || '—'} | ${i.dietary.join(', ') || '—'} | ${cell(i.ingredients.join(', '))} | [${cell(i.sourceTitle || 'source')}](${i.source}) | ${i.confidence} | ${cell(i.note) || ''} |`), '',
  '## New descriptions (English and Persian drafts)', '',
  '| Item | English | Persian |', '| --- | --- | --- |',
  ...its.filter((i) => i.newEn || i.newFa).map((i) => `| ${cell(i.name)} | ${cell(i.newEn) || '(the venue\'s own)'} | ${cell(i.newFa) || '(the venue\'s own)'} |`), '',
  '## The general allergy notice (every venue, from 2026-10-12)', '',
  `- English: ${words.notice.en}`, `- Persian (draft for Kian): ${words.notice.fa}`, '',
];
const out = path.join(path.dirname(file), 'research-report.md');
fs.writeFileSync(out, lines.join('\n'));
console.log(`${out}: ${its.length} items`);
