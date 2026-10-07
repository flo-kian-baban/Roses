#!/usr/bin/env node
// Greps built HTML for "Mealsy" (any case) and the whole word "Flo" in visible text and metadata.
// Photo, logo and font URLs are excepted: every http(s) URL is removed before searching, and the
// script reports how many of the raw occurrences sat inside URLs.
//   node scripts/check-brand-words.mjs .next/server/app/senso.html [more files]
import fs from 'node:fs/promises';
let bad = 0;
const URL_RE = /https?:\/\/[^\s"'<>\\)]+/g;
for (const file of process.argv.slice(2)) {
  const html = await fs.readFile(file, 'utf8');
  const noUrls = html.replace(URL_RE, 'URL');
  const visibleText = noUrls.replace(/<script[\s\S]*?<\/script>/g, ' ').replace(/<style[\s\S]*?<\/style>/g, ' ').replace(/<[^>]+>/g, ' ');
  const metadata = [...noUrls.matchAll(/<(title|meta|link)\b[^>]*>(?:[^<]*<\/title>)?/g)].map((m) => m[0]).join('\n');
  for (const [label, re] of [['Mealsy', /mealsy/gi], ['Flo (whole word)', /\bFlo\b/g]]) {
    const raw = (html.match(re) || []).length;
    const inUrls = raw - (noUrls.match(re) || []).length;
    const inText = [...visibleText.matchAll(re)].map((m) => visibleText.slice(Math.max(0, m.index - 40), m.index + 40).replace(/\s+/g, ' '));
    const inMeta = (metadata.match(re) || []).length;
    const elsewhere = (noUrls.match(re) || []).length - inText.length - inMeta;
    console.log(`${file}: ${label}: raw ${raw}; inside URLs ${inUrls} (allowed); visible text ${inText.length}; metadata ${inMeta}; elsewhere outside URLs ${Math.max(0, elsewhere)}`);
    for (const ctx of inText.slice(0, 5)) console.log('   …' + ctx + '…');
    if (inText.length || inMeta || elsewhere > 0) bad++;
  }
}
console.log(bad ? 'FAIL' : 'PASS');
process.exit(bad ? 1 : 0);
