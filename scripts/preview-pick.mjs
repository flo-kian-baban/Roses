// The Style tab's preview controls are dropdowns since 2026-11-15 (Kian: one row of dropdowns and two buttons, like the Menu tab's search
// row, in place of the rows of chips), so a choice is two taps: the dropdown, then its row. Shared by the drills that drive the preview
// (the preview, Style and transition drills); nothing at the top level, no server or database of its own (the page is the drill's).
//   choose(page, sel[, scope]): sel names a row by its data attribute as the chips did, e.g. '[data-preview-season="winter"]'; its
//     dropdown is opened first (unless it is open already), then the row is clicked. scope: a selector the dropdown is looked for in.
//   pickValues(page[, scope]): what the four dropdowns show ({ screen, lang, season, slot }; null when none is chosen).
const KINDS = { 'data-preview-screen': 'screen', 'data-preview-lang': 'lang', 'data-preview-season': 'season', 'data-preview-slot': 'slot' };
export const kindOf = (sel) => {
  const m = String(sel).match(/\[(data-preview-(?:screen|lang|season|slot))="/);
  if (!m) throw new Error(`not a choice of the preview's dropdowns: ${sel}`);
  return KINDS[m[1]];
};
export const menuOf = (sel) => `[data-preview-menu="${kindOf(sel)}"]`;
export async function openPick(page, sel, scope = '') {
  if (await page.locator(menuOf(sel)).count()) return;
  await page.click(`${scope ? `${scope} ` : ''}[data-preview-pick="${kindOf(sel)}"]`);
  await page.waitForSelector(`${menuOf(sel)} ${sel}`);
}
export async function choose(page, sel, scope = '') { await openPick(page, sel, scope); await page.click(`${menuOf(sel)} ${sel}`); }
export const pickValues = (page, scope = '') => page.evaluate((scope) => {
  const v = (k) => document.querySelector(`${scope ? `${scope} ` : ''}[data-preview-pick="${k}"]`)?.dataset.value || null;
  return { screen: v('screen'), lang: v('lang'), season: v('season'), slot: v('slot') };
}, scope);
