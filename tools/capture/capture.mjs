#!/usr/bin/env node
// Read-only discovery capture of the Roses menu sources.
//
//   node capture.mjs [--date YYYY-MM-DD] [--only slug,slug] [--out ../../data/raw]
//
// For every source in sources.json this opens the page in headless Chromium with an
// iPhone viewport, records every XHR/fetch response that has a JSON body (saved
// byte-for-byte), scrolls through every category, takes screenshots, saves the
// rendered HTML, records image URLs (never downloads images) and writes a
// manifest.json that maps every saved file to the request URL it came from.
//
// Non-menu data is never saved (rules.mjs): account, ordering and location configuration
// responses are skipped, the account lookup is reduced to identifying fields, and phone
// numbers, emails and network addresses are masked in saved HTML and in the manifest.
//
// Capture limits (enforced here): no login, no form submission, no add-to-cart,
// no orders, no personal data entered. Request headers, cookies and tokens are
// never written to disk. Responses whose URL looks like an auth endpoint are not
// saved at all; credential-looking keys inside a saved body are redacted and the
// redaction is listed in the manifest.

import { chromium, devices } from 'playwright';
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';
import { NON_MENU_URL, ACCOUNT_LOOKUP_URL, ACCOUNT_KEEP_KEYS, maskContact, maskDeep, digitsOf } from './rules.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const args = parseArgs(process.argv.slice(2));
const DATE = args.date || new Date().toISOString().slice(0, 10);
const OUT_ROOT = path.resolve(here, args.out || '../../data/raw');
const only = args.only ? new Set(args.only.split(',')) : null;
const SOURCES = JSON.parse(await fs.readFile(path.join(here, 'sources.json'), 'utf8'))
  .filter((s) => !only || only.has(s.slug));

// iPhone viewport on Chromium (Playwright's descriptor is used for viewport, UA, touch).
const DEVICE = { ...devices['iPhone 13'], defaultBrowserType: 'chromium', deviceScaleFactor: 2 };

const AUTH_URL = /\b(auth|token|login|signin|session|credential|password|oauth)\b/i;
const CREDENTIAL_KEY = /(password|passwd|secret|token|apikey|api_key|authorization|cookie|credential|sessionid|session_id|privatekey|private_key)/i;
const CREDENTIAL_QUERY = /([?&](?:key|api_key|apikey|token|access_token|auth|signature|sig|session|password)=)[^&#"'\s]+/gi;
const IMAGE_URL = /https?:\/\/[^"'\\\s<>)]+?\.(?:png|jpe?g|webp|gif|svg|avif)(?:\?[^"'\\<>)]*)?/gi;
const MAX_SHOT_PX = 16000; // Chromium cannot capture taller bitmaps in one go

const browser = await chromium.launch();
const summary = [];
for (const source of SOURCES) {
  const outDir = path.join(OUT_ROOT, source.slug, DATE);
  console.log(`\n=== [${source.n}] ${source.slug} -> ${outDir}`);
  try {
    const result = await captureSource(source, outDir);
    summary.push(result);
    console.log(`    ok: ${result.counts.responses} JSON responses, ${result.counts.screenshots} screenshots, ${result.counts.html} html, ${result.counts.imageUrls} image URLs`);
  } catch (err) {
    console.error(`    FAILED: ${err.stack || err}`);
    summary.push({ slug: source.slug, failed: String(err) });
  }
}
await browser.close();
console.log('\nSummary:');
for (const s of summary) console.log(' ', JSON.stringify(s));
process.exit(summary.some((s) => s.failed) ? 1 : 0);

// ---------------------------------------------------------------------------

async function captureSource(source, outDir) {
  for (const d of ['responses', 'decoded', 'screenshots', 'html']) await fs.mkdir(path.join(outDir, d), { recursive: true });
  const manifest = {
    source,
    capturedAt: new Date().toISOString(),
    tool: { playwright: (await import('playwright/package.json', { with: { type: 'json' } })).default.version, browser: browser.version() },
    device: { name: 'iPhone 13 (Chromium)', viewport: DEVICE.viewport, deviceScaleFactor: DEVICE.deviceScaleFactor, userAgent: DEVICE.userAgent, isMobile: DEVICE.isMobile, hasTouch: DEVICE.hasTouch },
    captureLimits: 'read-only: no login, no form submission, no add-to-cart, no orders, no personal data entered; request headers, cookies and tokens never saved',
    files: [],
    skipped: [],
    redactions: [],
    observed: {},
    imageUrls: {},
    errors: [],
  };

  const context = await browser.newContext({ ...DEVICE, locale: 'en-CA', timezoneId: 'America/Toronto' });
  const page = await context.newPage();
  page.setDefaultTimeout(30000);

  // --- response recorder -----------------------------------------------------
  let seq = 0;
  const pending = [];
  const responseImageUrls = new Set();
  page.on('response', (response) => {
    const req = response.request();
    const type = req.resourceType();
    if (type !== 'xhr' && type !== 'fetch') return;
    const p = (async () => {
      let buf;
      try { buf = await response.body(); } catch (e) { manifest.skipped.push({ url: cleanUrl(req.url()), method: req.method(), status: response.status(), reason: 'body unavailable (beacon or navigated away); nothing to save' }); return; }
      const text = buf.toString('utf8');
      const contentType = response.headers()['content-type'] || '';
      if (!looksLikeJson(text, contentType)) return; // only JSON bodies are kept
      const url = cleanUrl(req.url());
      if (AUTH_URL.test(new URL(req.url()).pathname)) {
        manifest.skipped.push({ url, method: req.method(), status: response.status(), reason: 'auth-like endpoint; body not saved' });
        return;
      }
      const nonMenu = NON_MENU_URL.find((r) => r.re.test(req.url()));
      if (nonMenu) { manifest.skipped.push({ url, method: req.method(), status: response.status(), reason: `not saved: ${nonMenu.reason}` }); return; }
      const n = String(++seq).padStart(3, '0');
      const base = `${n}-${fileSlug(req.url())}`;
      let bodyOut = buf;
      const redactedPaths = [];
      let parsed = null;
      try { parsed = JSON.parse(text); } catch { /* keep as text */ }
      let removedKeys = null;
      if (parsed && !Array.isArray(parsed) && ACCOUNT_LOOKUP_URL.test(req.url())) {
        removedKeys = Object.keys(parsed).filter((k) => !ACCOUNT_KEEP_KEYS.includes(k));
        parsed = Object.fromEntries(Object.entries(parsed).filter(([k]) => ACCOUNT_KEEP_KEYS.includes(k)));
        bodyOut = Buffer.from(JSON.stringify(parsed));
      }

      // Mealsy "Data" envelopes carry gzip+base64 payloads; decode them into decoded/ as a derived copy.
      let decodedText = null;
      if (parsed && typeof parsed === 'object' && typeof parsed.Data === 'string' && parsed.Data.startsWith('H4sI')) {
        try { decodedText = zlib.gunzipSync(Buffer.from(parsed.Data, 'base64')).toString('utf8'); } catch (e) { manifest.errors.push({ url, note: `gunzip failed: ${e.message}` }); }
      }
      const decodedParsed = decodedText ? safeParse(decodedText) : null;
      const decodedRedactions = decodedParsed ? redactCredentials(decodedParsed, []) : [];
      if (decodedRedactions.length) {
        // The raw envelope would still contain the secret in compressed form, so the envelope is saved with Data removed.
        parsed.Data = `[REDACTED: decoded payload contained credential-like keys ${decodedRedactions.join(', ')}]`;
        bodyOut = Buffer.from(JSON.stringify(parsed));
        redactedPaths.push(...decodedRedactions.map((k) => `Data(decoded).${k}`));
      } else if (parsed) {
        const r = redactCredentials(parsed, []);
        if (r.length) { bodyOut = Buffer.from(JSON.stringify(parsed, null, 0)); redactedPaths.push(...r); }
      }

      // Contact details never go to disk, whatever the endpoint.
      const bodyMask = maskContact(bodyOut.toString('utf8'));
      if (Object.keys(bodyMask.counts).length) bodyOut = Buffer.from(bodyMask.text, 'utf8');
      if (decodedText) { const d = maskContact(decodedText); if (Object.keys(d.counts).length) { decodedText = d.text; parsed.Data = '[REMOVED: decoded payload contained contact details]'; bodyOut = Buffer.from(JSON.stringify(parsed)); bodyMask.counts.decoded = d.counts; } }
      const file = `responses/${base}.json`;
      await fs.writeFile(path.join(outDir, file), bodyOut);
      manifest.files.push({
        path: file, type: 'response', url, method: req.method(), status: response.status(), contentType, resourceType: type,
        bytes: bodyOut.length, sha256: sha256(bodyOut), savedUnmodified: redactedPaths.length === 0 && !removedKeys && !Object.keys(bodyMask.counts).length,
        ...(redactedPaths.length ? { redactedKeys: redactedPaths } : {}),
        ...(removedKeys ? { removedKeys, note: `account lookup reduced to ${ACCOUNT_KEEP_KEYS.join(', ')}; account settings and contact details removed` } : {}),
        ...(Object.keys(bodyMask.counts).length ? { contactMasked: bodyMask.counts } : {}),
      });
      if (removedKeys) manifest.redactions.push({ file, note: `removed ${removedKeys.length} top-level keys (account settings and contact details)`, removedKeys });
      if (Object.keys(bodyMask.counts).length) manifest.redactions.push({ file, note: 'contact details masked', counts: bodyMask.counts });
      for (const m of text.matchAll(IMAGE_URL)) responseImageUrls.add(m[0]);
      if (decodedText) {
        const decFile = `decoded/${base}.decoded.json`;
        const decOut = decodedRedactions.length ? JSON.stringify(maskDeep(decodedParsed)) : decodedText;
        await fs.writeFile(path.join(outDir, decFile), decOut);
        manifest.files.push({ path: decFile, type: 'decoded', derivedFrom: file, url, note: 'gunzip(base64(Data)) of the response envelope; derived copy, not raw', bytes: Buffer.byteLength(decOut), sha256: sha256(Buffer.from(decOut)), ...(decodedRedactions.length ? { redactedKeys: decodedRedactions } : {}) });
        for (const m of decodedText.matchAll(IMAGE_URL)) responseImageUrls.add(m[0]);
      }
      if (redactedPaths.length) manifest.redactions.push({ file, keys: redactedPaths });
    })().catch((e) => manifest.errors.push({ url: cleanUrl(req.url()), note: `recorder error: ${e.message}` }));
    pending.push(p);
  });

  // --- navigate --------------------------------------------------------------
  const t0 = Date.now();
  await page.goto(source.url, { waitUntil: 'load', timeout: 90000 });
  await page.waitForLoadState('networkidle', { timeout: 60000 }).catch(() => manifest.errors.push({ note: 'networkidle not reached within 60s after load' }));
  manifest.observed.loadMs = Date.now() - t0;
  manifest.observed.pageTitle = await page.title();

  if (source.kind === 'mealsy') await captureMealsy(page, outDir, manifest);
  else await capturePage(page, outDir, manifest);

  await page.waitForLoadState('networkidle', { timeout: 30000 }).catch(() => {});
  await Promise.all(pending);
  manifest.observed.finalUrl = cleanUrl(page.url());

  // --- image URLs (recorded, never downloaded) --------------------------------
  const domImageUrls = await collectDomImageUrls(page);
  const all = new Set([...domImageUrls, ...responseImageUrls]);
  manifest.imageUrls = {
    note: 'URLs only; no image was downloaded by this tool. Browser rendering of the page is the only image traffic.',
    uniqueTotal: all.size,
    fromDom: [...domImageUrls].sort(),
    fromResponses: [...responseImageUrls].sort(),
  };

  await context.close();
  // Keep the tap-to-call finding as a boolean, then mask contact details in everything observed.
  for (const l of manifest.observed.links || []) l.hrefDigitsMatchDisplayed = digitsOf(l.href) === digitsOf(l.text);
  const observedCounts = {};
  manifest.observed = maskDeep(manifest.observed, observedCounts);
  manifest.skipped = maskDeep(manifest.skipped, observedCounts);
  manifest.errors = maskDeep(manifest.errors, observedCounts);
  if (Object.keys(observedCounts).length) manifest.redactions.push({ file: 'manifest.json', note: 'contact details masked in the on-screen extraction', counts: observedCounts });
  manifest.counts = {
    responses: manifest.files.filter((f) => f.type === 'response').length,
    decoded: manifest.files.filter((f) => f.type === 'decoded').length,
    screenshots: manifest.files.filter((f) => f.type === 'screenshot').length,
    html: manifest.files.filter((f) => f.type === 'html').length,
    imageUrls: all.size,
    skipped: manifest.skipped.length,
    redactions: manifest.redactions.length,
    errors: manifest.errors.length,
  };
  await fs.writeFile(path.join(outDir, 'manifest.json'), JSON.stringify(manifest, null, 2));
  return { slug: source.slug, counts: manifest.counts };
}

// --- Mealsy (Angular online-ordering app) -------------------------------------
async function captureMealsy(page, outDir, manifest) {
  const sectionSel = '.menu-section';
  await page.waitForSelector(sectionSel, { timeout: 60000 }).catch(() => manifest.errors.push({ note: 'no .menu-section rendered within 60s' }));
  await page.waitForTimeout(1500);

  await shot(page, outDir, manifest, '01-landing-viewport.png', { fullPage: false, note: 'landing view as first rendered (viewport)' });

  // Scroll through every category inside the app's scroll container so lazy content gets requested.
  const scrollInfo = await page.evaluate(async (sel) => {
    const sections = [...document.querySelectorAll(sel)];
    const visited = [];
    for (const s of sections) {
      s.scrollIntoView({ block: 'start' });
      await new Promise((r) => setTimeout(r, 350));
      visited.push(s.querySelector('.menu-section-info .title')?.textContent.trim() || s.id);
    }
    const container = sections[0]?.closest('.menu-page-container') || document.scrollingElement;
    return { visited, scrollContainer: container?.className || 'document', scrollHeight: container?.scrollHeight };
  }, sectionSel);
  manifest.observed.scrolledCategories = scrollInfo.visited;
  manifest.observed.scrollContainer = { className: scrollInfo.scrollContainer, scrollHeight: scrollInfo.scrollHeight };
  await page.waitForTimeout(1000);

  // What is on screen: category nav, sections, items (name / price / description / picture).
  manifest.observed.categoryNav = await page.$$eval('.mobile-menu-section-title', (els) => els.map((e) => e.textContent.trim()));
  manifest.observed.sections = await page.$$eval(sectionSel, (els) => els.map((s) => ({
    domId: s.id,
    title: s.querySelector('.menu-section-info .title')?.textContent.trim() ?? null,
    description: s.querySelector('.menu-section-info .description')?.textContent.trim() ?? null,
    items: [...s.querySelectorAll('.menu-item')].map((i) => ({
      name: i.querySelector('.menu-item-name')?.textContent.trim() ?? null,
      price: i.querySelector('.menu-item-price')?.textContent.trim() ?? null,
      description: i.querySelector('.menu-item-description')?.textContent.trim() ?? null,
      imgSrc: i.querySelector('img.menu-item-picture')?.getAttribute('src') ?? null,
    })),
  })));
  manifest.observed.restaurant = await page.evaluate(() => ({
    name: document.querySelector('.restaurant-name')?.textContent.trim() ?? null,
    address: document.querySelector('.restaurant--address')?.textContent.trim() ?? null,
  }));
  manifest.observed.itemCountOnScreen = manifest.observed.sections.reduce((a, s) => a + s.items.length, 0);

  // One category: scroll to the second section (or the first if only one) and screenshot the viewport.
  const catIndex = manifest.observed.sections.length > 1 ? 1 : 0;
  await page.evaluate(({ sel, i }) => document.querySelectorAll(sel)[i]?.scrollIntoView({ block: 'start' }), { sel: sectionSel, i: catIndex });
  await page.waitForTimeout(800);
  const catTitle = manifest.observed.sections[catIndex]?.title || `section-${catIndex}`;
  await shot(page, outDir, manifest, `02-category-${slugify(catTitle)}.png`, { fullPage: false, note: `category "${catTitle}" scrolled into view (viewport)` });

  // One item detail: open the first item's detail dialog (view only), screenshot, close it.
  const firstItem = page.locator('.menu-item').first();
  if (await firstItem.count()) {
    await firstItem.scrollIntoViewIfNeeded();
    await firstItem.click();
    const modal = page.locator('.menu-item-details-modal, .modal-dialog, [role=dialog]').first();
    await modal.waitFor({ state: 'visible', timeout: 10000 }).catch(() => manifest.errors.push({ note: 'item detail modal did not appear' }));
    await page.waitForTimeout(1200);
    manifest.observed.itemDetail = await page.evaluate(() => {
      const m = document.querySelector('.menu-item-details-modal, .modal-dialog, [role=dialog]');
      return m ? { text: m.innerText.replace(/\s+/g, ' ').trim().slice(0, 1000), imgSrc: m.querySelector('img')?.getAttribute('src') ?? null } : null;
    });
    await shot(page, outDir, manifest, '03-item-detail.png', { fullPage: true, note: 'first item detail dialog open (nothing added to cart)' });
    await page.keyboard.press('Escape');
    await page.waitForTimeout(500);
    const closeBtn = page.locator('.menu-item-details-modal .close-btn, .modal-dialog .close-btn').first();
    if (await closeBtn.isVisible().catch(() => false)) await closeBtn.click().catch(() => {});
    await page.waitForTimeout(500);
  }

  // Whole menu: expand the inner scroll container so the full page can be captured.
  await page.evaluate((sel) => {
    let el = document.querySelector(sel)?.closest('.menu-page-container');
    while (el && el !== document.documentElement) {
      el.style.setProperty('height', 'auto', 'important');
      el.style.setProperty('max-height', 'none', 'important');
      el.style.setProperty('overflow', 'visible', 'important');
      el = el.parentElement;
    }
    document.documentElement.style.setProperty('height', 'auto', 'important');
    document.documentElement.style.setProperty('overflow', 'visible', 'important');
    window.scrollTo(0, 0);
  }, sectionSel);
  await page.waitForTimeout(800);
  await shot(page, outDir, manifest, '04-landing-fullpage.png', { fullPage: true, note: 'whole menu, inner scroll container expanded so every category and item is in one page' });

  // Rendered HTML of the expanded menu (extra evidence; the raw data is in responses/).
  await saveHtml(page, outDir, manifest, 'html/index.html', 'rendered DOM after scrolling every category (inner scroll container expanded)');
}

// --- Plain pages (WordPress / Elementor) -------------------------------------
async function capturePage(page, outDir, manifest) {
  await page.waitForTimeout(1000);
  // Scroll the whole page in steps so lazy-loaded sections and images get requested.
  const height = await page.evaluate(async () => {
    const step = Math.max(300, Math.floor(window.innerHeight * 0.8));
    let y = 0;
    for (;;) {
      window.scrollTo(0, y);
      await new Promise((r) => setTimeout(r, 200));
      const h = document.documentElement.scrollHeight;
      if (y >= h) break;
      y += step;
    }
    window.scrollTo(0, 0);
    await new Promise((r) => setTimeout(r, 400));
    return document.documentElement.scrollHeight;
  });
  manifest.observed.scrollHeight = height;
  await page.waitForLoadState('networkidle', { timeout: 30000 }).catch(() => {});

  manifest.observed.headings = await page.$$eval('h1,h2,h3,h4,h5,h6', (els) => els.map((e) => ({ tag: e.tagName.toLowerCase(), text: e.textContent.replace(/\s+/g, ' ').trim(), visibleOnPhone: e.getClientRects().length > 0 })).filter((h) => h.text));
  manifest.observed.widgets = await page.$$eval('.elementor-widget', (els) => els.map((e) => {
    const type = e.getAttribute('data-widget_type') || (e.className.match(/elementor-widget-([a-z0-9_-]+)/) || [])[1] || 'unknown';
    const visibleOnPhone = e.getClientRects().length > 0;
    const w = { type, visibleOnPhone, text: e.innerText.replace(/\s+/g, ' ').trim().slice(0, 2000) };
    if (type.startsWith('price-list')) {
      w.items = [...e.querySelectorAll('.elementor-price-list-item')].map((li) => ({
        title: li.querySelector('.elementor-price-list-title')?.textContent.replace(/\s+/g, ' ').trim() ?? null,
        price: li.querySelector('.elementor-price-list-price')?.textContent.replace(/\s+/g, ' ').trim() ?? null,
        description: li.querySelector('.elementor-price-list-description')?.textContent.replace(/\s+/g, ' ').trim() ?? null,
        imgSrc: li.querySelector('img')?.getAttribute('src') ?? null,
      }));
    } else if (type.startsWith('icon-list')) {
      w.items = [...e.querySelectorAll('.elementor-icon-list-item')].map((li) => li.textContent.replace(/\s+/g, ' ').trim());
    } else if (type.startsWith('image')) {
      const img = e.querySelector('img');
      w.image = img ? { src: img.getAttribute('src'), alt: img.getAttribute('alt') } : null;
    } else if (type.startsWith('text-editor')) {
      w.html = e.querySelector('.elementor-widget-container')?.innerHTML.replace(/\s+/g, ' ').trim().slice(0, 3000) ?? null;
    }
    return w;
  }));
  manifest.observed.links = await page.$$eval('a[href]', (els) => els.map((a) => ({ href: a.getAttribute('href'), text: a.textContent.replace(/\s+/g, ' ').trim().slice(0, 80), visibleOnPhone: a.getClientRects().length > 0 })).filter((l) => /^(tel|callto|sms|mailto):/i.test(l.href || '')));
  manifest.observed.phoneTextOnPage = await page.evaluate(() => [...new Set((document.body.innerText.match(/\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}/g) || []))]);

  await shot(page, outDir, manifest, '01-fullpage.png', { fullPage: true, note: 'full page after scrolling to the bottom and back (lazy content loaded)' });
  await saveHtml(page, outDir, manifest, 'html/index.html', 'rendered DOM after scrolling the whole page');
}

// --- helpers -----------------------------------------------------------------
async function shot(page, outDir, manifest, name, { fullPage, note }) {
  const files = [];
  const img = fullPage ? { type: 'jpeg', quality: 82 } : { type: 'png' };
  if (fullPage) name = name.replace(/\.png$/, '.jpg');
  const dpr = DEVICE.deviceScaleFactor;
  const pageHeight = fullPage ? await page.evaluate(() => Math.max(document.documentElement.scrollHeight, document.body.scrollHeight)) : DEVICE.viewport.height;
  if (!fullPage || pageHeight * dpr <= MAX_SHOT_PX) {
    const file = `screenshots/${name}`;
    await page.screenshot({ path: path.join(outDir, file), fullPage, ...img });
    files.push(file);
  } else {
    // Tile very tall pages; Chromium cannot render a single bitmap this tall.
    const chunk = Math.floor(MAX_SHOT_PX / dpr);
    let part = 0;
    for (let y = 0; y < pageHeight; y += chunk) {
      const file = `screenshots/${name.replace(/\.jpg$/, '')}-part${String(++part).padStart(2, '0')}.jpg`;
      await page.screenshot({ path: path.join(outDir, file), fullPage: true, ...img, clip: { x: 0, y, width: DEVICE.viewport.width, height: Math.min(chunk, pageHeight - y) } });
      files.push(file);
    }
  }
  for (const file of files) {
    const buf = await fs.readFile(path.join(outDir, file));
    manifest.files.push({ path: file, type: 'screenshot', url: cleanUrl(page.url()), note: note + (files.length > 1 ? ` (tiled, ${files.length} parts, page height ${pageHeight}px)` : ''), bytes: buf.length, sha256: sha256(buf) });
  }
}

async function saveHtml(page, outDir, manifest, file, note) {
  let html = await page.content();
  let n = 0;
  html = html.replace(CREDENTIAL_QUERY, (m, p1) => { n++; return `${p1}[REDACTED]`; });
  const masked = maskContact(html);
  html = masked.text;
  const contact = Object.keys(masked.counts).length ? masked.counts : null;
  const buf = Buffer.from(html, 'utf8');
  await fs.writeFile(path.join(outDir, file), buf);
  manifest.files.push({ path: file, type: 'html', url: cleanUrl(page.url()), note, bytes: buf.length, sha256: sha256(buf), savedUnmodified: n === 0 && !contact, ...(n ? { redactedQueryValues: n } : {}), ...(contact ? { contactMasked: contact } : {}) });
  if (n) manifest.redactions.push({ file, note: `${n} credential-like query value(s) in embedded URLs replaced with [REDACTED]` });
  if (contact) manifest.redactions.push({ file, note: 'contact details masked', counts: contact });
}

async function collectDomImageUrls(page) {
  const urls = await page.evaluate(() => {
    const out = new Set();
    const add = (u) => { if (u && /^https?:/i.test(u)) out.add(u.trim()); };
    for (const img of document.querySelectorAll('img')) {
      for (const attr of ['src', 'data-src', 'data-lazy-src']) add(img.getAttribute(attr));
      for (const attr of ['srcset', 'data-srcset', 'data-lazy-srcset']) for (const c of (img.getAttribute(attr) || '').split(',')) add(c.trim().split(/\s+/)[0]);
    }
    for (const s of document.querySelectorAll('source[srcset]')) for (const c of s.getAttribute('srcset').split(',')) add(c.trim().split(/\s+/)[0]);
    for (const el of document.querySelectorAll('*')) {
      const bg = getComputedStyle(el).backgroundImage;
      if (bg && bg !== 'none') for (const m of bg.matchAll(/url\(["']?([^"')]+)["']?\)/g)) add(m[1]);
    }
    return [...out];
  });
  return new Set(urls.map((u) => u.replace(CREDENTIAL_QUERY, '$1[REDACTED]')));
}

function redactCredentials(node, trail) {
  const found = [];
  if (Array.isArray(node)) node.forEach((v, i) => found.push(...redactCredentials(v, [...trail, String(i)])));
  else if (node && typeof node === 'object') {
    for (const k of Object.keys(node)) {
      if (CREDENTIAL_KEY.test(k) && node[k] != null && typeof node[k] !== 'object') { node[k] = '[REDACTED]'; found.push([...trail, k].join('.')); }
      else found.push(...redactCredentials(node[k], [...trail, k]));
    }
  }
  return found;
}

function looksLikeJson(text, contentType) {
  if (/\bjson\b/i.test(contentType)) return true;
  const t = text.trim();
  if (!(t.startsWith('{') || t.startsWith('['))) return false;
  try { JSON.parse(t); return true; } catch { return false; }
}
function safeParse(t) { try { return JSON.parse(t); } catch { return null; } }
function cleanUrl(u) { return u.replace(CREDENTIAL_QUERY, '$1[REDACTED]'); }
function sha256(buf) { return crypto.createHash('sha256').update(buf).digest('hex'); }
function slugify(s, max = 60) { return String(s).normalize('NFKD').replace(/[^\w]+/g, '-').replace(/^-+|-+$/g, '').toLowerCase().slice(0, max) || 'x'; }
function fileSlug(rawUrl) {
  const u = new URL(rawUrl);
  const q = [...u.searchParams.entries()].filter(([k]) => !/^(key|api_key|apikey|token|access_token|auth|signature|sig|session|password)$/i.test(k)).map(([k, v]) => `${k}-${v}`).join('_');
  return slugify(`${u.host}${u.pathname}${q ? '_' + q : ''}`, 170);
}
function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i++) if (argv[i].startsWith('--')) { out[argv[i].slice(2)] = argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[++i] : true; }
  return out;
}
