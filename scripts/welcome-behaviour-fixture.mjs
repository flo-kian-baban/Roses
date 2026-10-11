#!/usr/bin/env node
// The welcome screen's behaviour on a page as served, for the "unchanged" checks of the transition drill (2026-10-10: Senso's
// transitions into the menu must leave Kebab Land's welcome behaviour, and every venue on the default template, byte for byte as it
// was). What a page's welcome screen does is in four parts of its HTML: the head decision script, the tap script (the last script of
// the overlay), the overlay itself (its scene, card and scripts; the logo's <img> is replaced by a placeholder, since the logo is data)
// and the public stylesheet (by hash). behaviourOf() extracts them; compareBehaviour() compares them with a fixture.
// Capture (from a build of the previous commit, with its server's clock fixed to a season by ROSES_NOW and ROSES_CHECK_SUITE=1):
//   node scripts/welcome-behaviour-fixture.mjs --base http://127.0.0.1:<port> --venue kebab-land --season fall --commit <sha> --out scripts/fixtures/welcome-behaviour.json
// (each run adds or replaces the venue's season in the file).
import fs from 'node:fs';
import crypto from 'node:crypto';

const sha = (s) => crypto.createHash('sha256').update(s).digest('hex');
export const HEAD_RE = /<script[^>]*>\(function\(\)\{var h=document\.documentElement,l=null;[\s\S]*?<\/script>/;
export function behaviourOf(html) {
  const head = (html.match(HEAD_RE) || [''])[0];
  const start = html.indexOf('<div id="welcome"'), end = html.indexOf('<main');
  const overlay = start >= 0 && end > start ? html.slice(start, end) : '';
  const scripts = [...overlay.matchAll(/<script>([\s\S]*?)<\/script>/g)].map((m) => m[1]);
  const tapScript = scripts.length ? scripts[scripts.length - 1] : '';
  const normalized = overlay.replace(/<img [^>]*>/g, '<img LOGO>');
  const css = [...html.matchAll(/<link rel="stylesheet" href="([^"]+)"/g)].map((m) => m[1]);
  return { head, tapScript, overlay: normalized, season: (overlay.match(/data-season="([a-z]+)"/) || [])[1] || null, stylesheets: css };
}
export async function stylesheetHashes(base, hrefs) { const out = []; for (const h of hrefs) { const t = await (await fetch(new URL(h, base))).text(); out.push({ bytes: t.length, sha256: sha(t) }); } return out; }
// The differences of a page's behaviour from the fixture's (an empty list: byte for byte the same).
export function compareBehaviour(want, got, gotCss) {
  const diffs = [];
  if (got.head !== want.head) diffs.push(`head script differs (${got.head.length} B vs ${want.head.length} B)`);
  if (got.tapScript !== want.tapScript) diffs.push(`tap script differs (${got.tapScript.length} B vs ${want.tapScript.length} B)`);
  if (want.overlay != null && got.overlay !== want.overlay) { let i = 0; while (i < got.overlay.length && got.overlay[i] === want.overlay[i]) i++; diffs.push(`overlay differs from byte ${i} (${got.overlay.length} B vs ${want.overlay.length} B): …${got.overlay.slice(Math.max(0, i - 40), i + 60)}…`); }
  if (want.css && gotCss && JSON.stringify(gotCss.map((c) => c.sha256)) !== JSON.stringify(want.css.map((c) => c.sha256))) diffs.push(`public stylesheet differs (${gotCss.map((c) => `${c.bytes} B ${c.sha256.slice(0, 12)}`).join(', ')} vs ${want.css.map((c) => `${c.bytes} B ${c.sha256.slice(0, 12)}`).join(', ')})`);
  return diffs;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const args = Object.fromEntries(process.argv.slice(2).map((a, i, all) => (a.startsWith('--') ? [a.slice(2), all[i + 1]] : [])).filter((x) => x.length));
  const html = await (await fetch(`${args.base}/${args.venue}`, { cache: 'no-store' })).text();
  const b = behaviourOf(html);
  if (b.season !== args.season) { console.error(`the page carries the ${b.season} scene, not ${args.season}`); process.exit(1); }
  const css = await stylesheetHashes(args.base, b.stylesheets);
  const file = fs.existsSync(args.out) ? JSON.parse(fs.readFileSync(args.out, 'utf8')) : { capturedFrom: {}, venues: {} };
  file.capturedFrom = { commit: args.commit, at: new Date().toISOString(), how: 'node scripts/welcome-behaviour-fixture.mjs on a build of that commit, its server clock fixed per season (ROSES_NOW with ROSES_CHECK_SUITE=1)' };
  file.venues[args.venue] = file.venues[args.venue] || {};
  file.venues[args.venue][args.season] = { head: b.head, tapScript: b.tapScript, overlay: b.overlay, css };
  fs.writeFileSync(args.out, JSON.stringify(file, null, 1) + '\n');
  console.log(`${args.venue} ${args.season}: head ${b.head.length} B, tap script ${b.tapScript.length} B, overlay ${b.overlay.length} B, stylesheets ${css.map((c) => `${c.bytes} B ${c.sha256.slice(0, 12)}`).join(', ')} → ${args.out}`);
}
