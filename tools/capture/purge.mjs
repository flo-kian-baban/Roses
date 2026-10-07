#!/usr/bin/env node
// One-off purge of non-menu data from an existing capture (Kian's decision, 2026-10-07).
//   node purge.mjs [--date YYYY-MM-DD]
// Deletes the Mealsy configuration, account-detail and ordering responses (and decoded copies),
// strips the account lookup to its identifying fields, masks phone numbers, emails and network
// addresses in saved HTML and in the manifests' on-screen extraction, and records every removal
// in manifest.json under `removed` and `redactions`. capture.mjs applies the same rules on new runs.
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { NON_MENU_URL, ACCOUNT_LOOKUP_URL, ACCOUNT_KEEP_KEYS, maskContact, contactFindings, maskDeep, digitsOf } from './rules.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const RAW = path.resolve(here, '../../data/raw');
const SOURCES = JSON.parse(await fs.readFile(path.join(here, 'sources.json'), 'utf8'));
const args = Object.fromEntries(process.argv.slice(2).map((a, i, all) => a.startsWith('--') ? [a.slice(2), all[i + 1]] : []).filter((x) => x.length));
const DATE = args.date || (await fs.readdir(path.join(RAW, SOURCES[0].slug))).filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d)).sort().pop();
const now = new Date().toISOString();
const sha256 = (b) => crypto.createHash('sha256').update(b).digest('hex');

for (const s of SOURCES) {
  const dir = path.join(RAW, s.slug, DATE);
  const mPath = path.join(dir, 'manifest.json');
  const m = JSON.parse(await fs.readFile(mPath, 'utf8'));
  m.removed = m.removed || [];
  console.log(`\n=== ${s.slug}`);

  // 1. delete non-menu responses and their decoded copies
  const keep = [];
  for (const f of m.files) {
    const rule = (f.type === 'response' || f.type === 'decoded') ? NON_MENU_URL.find((r) => r.re.test(f.url)) : null;
    if (!rule) { keep.push(f); continue; }
    await fs.rm(path.join(dir, f.path), { force: true });
    m.removed.push({ path: f.path, type: f.type, url: f.url, bytes: f.bytes, sha256: f.sha256, reason: rule.reason, removedAt: now });
    console.log(`  removed ${f.path}  (${rule.reason})`);
  }
  m.files = keep;

  // 2. strip the account lookup to identifying fields only
  for (const f of m.files.filter((f) => f.type === 'response' && ACCOUNT_LOOKUP_URL.test(f.url))) {
    const p = path.join(dir, f.path);
    const obj = JSON.parse(await fs.readFile(p, 'utf8'));
    const removedKeys = Object.keys(obj).filter((k) => !ACCOUNT_KEEP_KEYS.includes(k));
    if (!removedKeys.length) continue;
    const kept = Object.fromEntries(Object.entries(obj).filter(([k]) => ACCOUNT_KEEP_KEYS.includes(k)));
    const buf = Buffer.from(JSON.stringify(kept));
    await fs.writeFile(p, buf);
    Object.assign(f, { bytes: buf.length, sha256: sha256(buf), savedUnmodified: false, removedKeys, note: `account lookup reduced to ${ACCOUNT_KEEP_KEYS.join(', ')}; account settings and contact details removed` });
    m.redactions.push({ file: f.path, note: `removed ${removedKeys.length} top-level keys (account settings and contact details); kept ${ACCOUNT_KEEP_KEYS.join(', ')}`, removedKeys, at: now });
    console.log(`  stripped ${f.path}: removed keys ${removedKeys.join(', ')}`);
  }

  // 3. mask contact details in every remaining saved text file
  for (const f of m.files.filter((f) => f.type === 'response' || f.type === 'decoded' || f.type === 'html')) {
    const p = path.join(dir, f.path);
    const text = await fs.readFile(p, 'utf8');
    const found = contactFindings(text);
    if (!Object.keys(found).length) continue;
    const r = maskContact(text);
    const buf = Buffer.from(r.text, 'utf8');
    await fs.writeFile(p, buf);
    Object.assign(f, { bytes: buf.length, sha256: sha256(buf), savedUnmodified: false, contactMasked: r.counts });
    m.redactions.push({ file: f.path, note: 'contact details masked', counts: r.counts, at: now });
    console.log(`  masked ${f.path}: ${JSON.stringify(r.counts)}`);
  }

  // 4. manifest: keep the tap-to-call finding as a boolean, then mask the on-screen extraction
  for (const l of m.observed.links || []) l.hrefDigitsMatchDisplayed = digitsOf(l.href) === digitsOf(l.text);
  const counts = {};
  m.observed = maskDeep(m.observed, counts);
  m.skipped = maskDeep(m.skipped, counts);
  m.errors = maskDeep(m.errors, counts);
  if (Object.keys(counts).length) { m.redactions.push({ file: 'manifest.json', note: 'contact details masked in the on-screen extraction', counts, at: now }); console.log(`  masked manifest.json observed: ${JSON.stringify(counts)}`); }

  m.counts = { ...m.counts, responses: m.files.filter((f) => f.type === 'response').length, decoded: m.files.filter((f) => f.type === 'decoded').length, html: m.files.filter((f) => f.type === 'html').length, removed: m.removed.length, redactions: m.redactions.length };
  m.purgedAt = now;
  await fs.writeFile(mPath, JSON.stringify(m, null, 2));
}
console.log('\npurge done');
