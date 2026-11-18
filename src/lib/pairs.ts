// "Goes well with" (Kian via the PM, 2026-11-18): up to 4 other items of the same venue that go well with an item, picked in the admin
// (the item editor's GOES WELL WITH card), shown to customers in the item's popup under its description, each with its photo (if any),
// its name in the page's language and its price as the menu's rows show it; a tap opens that item's own popup. One-way and in the
// order picked. Only pairs that are on the page themselves are shown (src/lib/menu.ts leaves the rest out silently). The popup's
// template carries the heading and the paired items' ids; the menu kit's script fills each row from that item's own row on the page
// when the popup opens (src/components/menu-kit.tsx), so the name, the price and the photo are the menu's own and cost the page nothing twice.
// Server only and in src/lib, outside the public stylesheet's Tailwind sources (like the seasonal section's look, src/lib/seasonal.ts):
// the CSS below is written into the page in a <style> of its own only when an item of the page has a pair to show, so the customers'
// stylesheet stays byte for byte the same and a page without pairs carries none of it. Colours: the Item popup group's tokens only
// (the names and prices in the popup's own Price colour, as its sizes and options are, the lines between them, the band's shade behind
// a photo while it loads); no colour literal here (scripts/check-colour-literals.mjs scans this file).
import type { Bi } from '@/lib/types';

// The heading (the PM's wording, 2026-11-18).
export const PAIRS_TITLE: Bi = { en: 'Goes well with', fa: 'پیشنهاد همراه' };

// One row per pair, as a small copy of the menu's own rows: the name and the price on the start side, a square photo on the end side
// (no photo, no square: the text starts at the same edge either way); the whole row is the button, 44 px tall at least.
export const PAIRS_CSS = '.pairs{padding:0 16px}.pairs li{border-bottom:1px solid var(--c-sheet-line)}.pairs li:last-child{border-bottom:0}'
  + '.pair{display:flex;align-items:center;justify-content:space-between;gap:12px;width:100%;min-height:44px;padding:10px 0;text-align:start;cursor:pointer;-webkit-tap-highlight-color:transparent}'
  + '.pair-text{flex:1;min-width:0}.pair-name{display:block;font-size:15px;font-weight:600;line-height:1.35;color:var(--c-sheet-price)}'
  + '.pair-price{display:block;margin-top:2px;font-size:15px;line-height:1.35;color:var(--c-sheet-price);font-variant-numeric:tabular-nums}'
  + '.pair img{flex:none;width:56px;height:56px;border-radius:8px;object-fit:cover;background:var(--c-sheet-hero)}'
  + '.pair:focus-visible{outline:2px solid var(--c-sheet-title);outline-offset:-2px;border-radius:8px}';
