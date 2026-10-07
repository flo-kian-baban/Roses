// Reads one roseskebablands.com page capture (manifest widget extraction) into sections and items.
// Widget order on the page: heading → [image] → "Name $price" → [description lines | "Serves N" | size line].
import { clean } from './lib.mjs';

const SKIP = /site-logo|nav_menu|nav-menu|icon\.|off-canvas|button\.|social-icons|divider/;
const SIZE = /^(\d+(?:\.\d+)?\s*(oz|ml|l|cl)|\d+-shot|shot|bottle|glass|half|full|small|medium|large)$/i;
const PAIR = /([^$]*?)\s*\$\s*(\d+(?:\.\d{1,2})?)/g;

export function pricePairs(text) {
  const t = clean(text);
  if (!t.includes('$')) return null;
  const pairs = [...t.matchAll(PAIR)].map((m) => ({ label: clean(m[1]), price: Number(m[2]) }));
  const consumed = [...t.matchAll(PAIR)].map((m) => m[0]).join('').trim();
  if (!pairs.length || clean(consumed) !== t) return null; // text that is not purely "label $price" pairs
  return pairs;
}

export function parseKebabLandPage(widgets, pageSlug) {
  const sections = []; const unusedImages = []; const notes = [];
  let cur = null, pending = null, last = null;
  const flushImage = () => { if (pending && last && !last.imgSrc && pending.visibleOnPhone) { last.imgSrc = pending.src; last.imgAlt = pending.alt; last.imgNote = 'image placed after the item on the page'; } else if (pending) unusedImages.push({ section: cur?.name, src: pending.src, visibleOnPhone: pending.visibleOnPhone, after: last?.name || null }); pending = null; };
  for (let i = 0; i < widgets.length; i++) {
    const w = widgets[i];
    if (SKIP.test(w.type)) continue;
    const text = clean(w.text || '');
    if (w.type.startsWith('heading')) {
      flushImage();
      cur = { name: clean(text.replace(/[╔╗]/g, '')), visibleOnPhone: !!w.visibleOnPhone, items: [], notes: [], page: pageSlug, widgetIndex: i };
      sections.push(cur); last = null; continue;
    }
    if (!cur) continue; // header widgets before the first heading (phone line, menu buttons)
    if (w.type.startsWith('image')) {
      const img = { src: w.image?.src || null, alt: clean(w.image?.alt || ''), visibleOnPhone: !!w.visibleOnPhone };
      if (pending && pending.visibleOnPhone) { unusedImages.push({ section: cur.name, src: img.src, visibleOnPhone: img.visibleOnPhone, after: last?.name || null, note: 'second image before the same item; the first one is used' }); continue; }
      pending = img;
      continue;
    }
    if (!w.type.startsWith('text-editor') || !text || /PHONE REMOVED/.test(text)) continue;
    const pairs = pricePairs(text);
    const next = widgets.slice(i + 1).find((x) => !SKIP.test(x.type));
    const nextPairs = next && next.type.startsWith('text-editor') ? pricePairs(clean(next.text || '')) : null;
    if (pairs) {
      const sizes = pairs.every((p) => SIZE.test(p.label));
      if (sizes && last && last.price == null && !last.variants.length) { last.variants = pairs.map((p) => ({ label: p.label, price: p.price })); last.sourceWidgets.push(i); continue; }
      if (pairs.length === 1 && pairs[0].label) {
        const m = pairs[0].label.match(/^(.*?)\s*[-–]\s*Serves\s+(\d+(?:\s*[-–]\s*\d+)?)$/i);
        last = { name: m ? clean(m[1]) : pairs[0].label, price: pairs[0].price, variants: [], serves: m ? m[2].replace(/\s+/g, '') : null, description: [], imgSrc: null, imgAlt: '', visibleOnPhone: !!w.visibleOnPhone, sourceWidgets: [i] };
        if (pending) { if (pending.visibleOnPhone) { last.imgSrc = pending.src; last.imgAlt = pending.alt; } else unusedImages.push({ section: cur.name, src: pending.src, visibleOnPhone: false, before: last.name, note: 'image hidden on phones' }); pending = null; }
        cur.items.push(last); continue;
      }
      notes.push({ section: cur.name, widgetIndex: i, text, note: 'price text not understood' }); continue;
    }
    // no price in this widget
    if (nextPairs && nextPairs.every((p) => SIZE.test(p.label)) && nextPairs[0].label) {
      last = { name: text, price: null, variants: [], serves: null, description: [], imgSrc: null, imgAlt: '', visibleOnPhone: !!w.visibleOnPhone, sourceWidgets: [i] };
      if (pending) { if (pending.visibleOnPhone) { last.imgSrc = pending.src; last.imgAlt = pending.alt; } else unusedImages.push({ section: cur.name, src: pending.src, visibleOnPhone: false, before: last.name, note: 'image hidden on phones' }); pending = null; }
      cur.items.push(last); continue;
    }
    const serves = text.match(/^Serves\s+(\d+(?:\s*[-–]\s*\d+)?)$/i);
    if (serves && last) { last.serves = serves[1].replace(/\s+/g, ''); last.sourceWidgets.push(i); continue; }
    if (last) { last.description.push(text); last.sourceWidgets.push(i); }
    else cur.notes.push(text);
  }
  flushImage();
  return { sections, unusedImages, notes };
}
