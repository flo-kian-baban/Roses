// The admin's layout rules, measured on a page (the PM, 2026-11-06: the item editor's rules of 2026-11-04 across the whole admin), shared
// by scripts/layout-drill.mjs and reports/admin-cleanup/shots.mjs. MEASURE runs in the page (page.evaluate) and returns:
//   found: what breaks the rules: the page wider than the screen; anything reaching past the screen's edges, cut by the box around it,
//     cut short (an ellipsis, a line clamp, a one-line text box holding more than it shows) or scrolling sideways;
//   sizes: the text sizes in use; radii: the corner radii of what the admin draws.
//   Also in found: a card's row divider (divide-y) under a child that does not span the card, so is not a row (Kian, 2026-11-07: lines
//   under three of the four "Needs attention" chips, under the icon and the title of "No PINs yet").
// Left out, as not the admin's own interface: the customers' page in the preview (the iframe) and the iPhone frame around it. Form
// controls keep their own drawing (the iOS switch's pill, the check box and the radio dot: .switch, .check) and a person's initials
// their circle ([data-avatar]). A row made to scroll sideways on a phone (the
// preview controls in the Style tab's sheet) says so with data-scrolls-sideways and is not counted as cut; sideways: for each such row that
// scrolls, the control its right edge cuts with the row at its start, and how much of it shows and is hidden (the PM, 2026-11-06: it stays
// visibly cut, so staff can tell the row scrolls; CUT_MIN px each at least).
export const TITLE = '28px'; // the one page-title size
export const SIZES = ['13px', '16px', '17px', TITLE];
export const RADIUS = '12px';
export const CUT_MIN = 12;
export const MEASURE = () => {
  const found = [], sizes = new Set(), radii = new Set();
  const outside = (el) => !!el.closest('.iphone, iframe');
  // what is named in a finding (a failing check's report is committed): an email address on Team or in the account menu never is
  const desc = (el) => `${el.tagName.toLowerCase()}${el.getAttribute('aria-label') ? `[${el.getAttribute('aria-label')}]` : ''} "${(el.textContent || '').trim().replace(/\s+/g, ' ').replace(/[^\s"@]+@[^\s"@]+/g, '<email>').slice(0, 30)}"`;
  if (document.documentElement.scrollWidth > innerWidth + 1) found.push(`the page is ${document.documentElement.scrollWidth} px wide on a ${innerWidth} px screen`);
  for (const el of document.body.querySelectorAll('*')) {
    if (outside(el)) continue;
    const st = getComputedStyle(el), r = el.getBoundingClientRect();
    const sideways = el.closest('[data-scrolls-sideways]');
    if (/(auto|scroll)/.test(st.overflowX) && el.scrollWidth > el.clientWidth + 1 && !el.hasAttribute('data-scrolls-sideways')) found.push(`scrolls sideways: ${desc(el)}`);
    if (r.width < 1 || r.height < 1 || st.visibility === 'hidden' || st.display === 'none' || el.closest('.sr-only')) continue;
    const pa = el.parentElement;
    if (pa && pa.classList.contains('divide-y') && parseFloat(st.borderBottomWidth) > 0) {
      const pr = pa.getBoundingClientRect(), ps = getComputedStyle(pa);
      const left = pr.left + parseFloat(ps.borderLeftWidth) + parseFloat(ps.paddingLeft), right = pr.right - parseFloat(ps.borderRightWidth) - parseFloat(ps.paddingRight);
      if (r.left > left + 1 || r.right < right - 1) found.push(`a row divider under something that is not a row: ${desc(el)} (${Math.round(r.left)}–${Math.round(r.right)} in a card ${Math.round(left)}–${Math.round(right)})`);
    }
    if (!sideways && (r.right > innerWidth + 0.5 || r.left < -0.5)) found.push(`past the screen's edge: ${desc(el)} (${Math.round(r.left)}–${Math.round(r.right)} of ${innerWidth})`);
    if (!sideways) for (let a = el.parentElement; a && a !== document.body; a = a.parentElement) { if (getComputedStyle(a).overflowX === 'visible') continue; const ar = a.getBoundingClientRect(); if (r.left < ar.left - 0.5 || r.right > ar.right + 0.5) { found.push(`cut by the box around it: ${desc(el)}`); break; } }
    const hides = st.overflowX !== 'visible' || st.textOverflow === 'ellipsis' || +st.webkitLineClamp > 0;
    if (el.tagName === 'TEXTAREA' && (el.scrollHeight > el.clientHeight + 1 || el.scrollWidth > el.clientWidth + 1)) found.push(`a text box shows part of its text: ${desc(el)}`);
    else if (!['INPUT', 'SELECT', 'OPTION'].includes(el.tagName) && !el.hasAttribute('data-scrolls-sideways') && hides && el.textContent.trim() && (el.scrollWidth > el.clientWidth + 1 || (!/(auto|scroll)/.test(st.overflowY) && el.scrollHeight > el.clientHeight + 1))) found.push(`text cut short: ${desc(el)}`);
    if ([...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim()) || ((el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') && (el.value || el.placeholder) && !['checkbox', 'radio', 'color', 'hidden', 'file'].includes(el.type))) sizes.add(st.fontSize);
    const drawn = (st.backgroundColor !== 'rgba(0, 0, 0, 0)' && st.backgroundColor !== 'transparent') || parseFloat(st.borderTopWidth) > 0 || st.backgroundImage !== 'none';
    if (drawn && !el.matches('.switch, .check, [data-avatar]') && parseFloat(st.borderTopLeftRadius) > 0) radii.add(st.borderTopLeftRadius);
  }
  const sideways = [...document.querySelectorAll('[data-scrolls-sideways]')].filter((row) => !outside(row) && row.getBoundingClientRect().width > 0 && row.scrollWidth > row.clientWidth + 1).map((row) => {
    const at = row.scrollLeft; row.scrollLeft = 0;
    const edge = row.getBoundingClientRect().right; let cut = { chip: null, shown: 0, hidden: 0 };
    for (const b of row.querySelectorAll('button')) { const r = b.getBoundingClientRect(); if (r.left < edge && r.right > edge) { cut = { chip: (b.getAttribute('aria-label') || b.textContent || '').trim().slice(0, 40), shown: Math.round((edge - r.left) * 10) / 10, hidden: Math.round((r.right - edge) * 10) / 10 }; break; } }
    row.scrollLeft = at;
    return cut;
  });
  return { found, sizes: [...sizes].sort(), radii: [...radii].sort(), sideways };
};

// Every admin screen, as [key, title, signed in?, setup(page), whole page too?], shared by scripts/layout-drill.mjs and
// reports/admin-cleanup/shots.mjs. sec: a section of Senso's own order with items (for its menu, the reorder and the sheets).
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
// The toast rule (the PM, 2026-11-19): while a toast or its strip shows, no tappable control sits under it, on any admin screen.
// UNDER_TOAST runs in the page and, at every second pixel of the toast and of the strip kept free for it, finds what a tap would reach
// were the toast not there. `under` lists every control found: a link, button, field, switch, label, anything with such a role (not
// disabled), and the preview's frame (the customers' page in it answers taps). How it looks:
//   - the strip is the element marked data-toast-zone that lies behind the toast's middle (the item editor's, the page's band on the
//     Menu, Details and laptop Style tabs, the phone Style sheet's, the full-screen preview's); none when a sheet is open (the toast is
//     at the top of the screen then, over the dim);
//   - at a point of the toast, the toast itself is looked through; the look stops at the strip when the strip is drawn solid (zone.solid:
//     an opaque background, fully visible): what scrolls behind a solid strip is hidden by it and cannot be tapped, as behind the screen's
//     edge. `bare` counts the toast's points that are over no strip (0 when the toast lies wholly in one; on a laptop its ends can
//     lie over a neighbouring column's strip, which counts like its own);
//   - at a point of the strip, anything drawn over it other than the toast counts (a menu or card that reaches into the strip);
//   - not counted: the toast's own buttons, and a button as large as the screen (the dim behind an open sheet or beside the item
//     editor on a laptop, whose tap closes it: the toast is over it wherever it is).
export const UNDER_TOAST = () => {
  const view = `${innerWidth} × ${innerHeight}`;
  const toast = document.querySelector('.toast');
  if (!toast) return { toast: null, zone: null, under: [], points: 0, bare: 0, sheet: !!document.querySelector('[data-sheet]'), view };
  const tr = toast.getBoundingClientRect();
  const zone = document.elementsFromPoint((tr.left + tr.right) / 2, (tr.top + tr.bottom) / 2).find((el) => el.matches('[data-toast-zone]')) ?? null;
  const alpha = (c) => { if (c === 'transparent') return 0; const slash = c.match(/\/\s*([\d.]+%?)\s*\)/); if (slash) return slash[1].endsWith('%') ? parseFloat(slash[1]) / 100 : Number(slash[1]); const m = c.match(/^rgba\(([^)]+)\)/); return m && m[1].split(',').length === 4 ? Number(m[1].split(',')[3]) : 1; };
  const solid = (el) => { for (let e = el; e && e !== document.documentElement; e = e.parentElement) { const cs = getComputedStyle(e); if (Number(cs.opacity) < 1 || cs.visibility !== 'visible') return false; } return alpha(getComputedStyle(el).backgroundColor) === 1; };
  const zoneSolid = !!zone && solid(zone);
  const CONTROL = 'a[href], button, input, textarea, select, summary, label, iframe, [role=button], [role=switch], [role=checkbox], [role=radio], [role=tab], [role=menuitem], [role=menuitemradio], [role=option]';
  const dim = (el) => { const r = el.getBoundingClientRect(); return r.width >= innerWidth && r.height >= innerHeight; };
  const box = (el) => { const r = el.getBoundingClientRect(); return { top: Math.round(r.top), bottom: Math.round(r.bottom), left: Math.round(r.left), right: Math.round(r.right) }; };
  const name = (c) => `${c.tagName.toLowerCase()} "${(c.getAttribute('aria-label') || c.getAttribute('title') || c.textContent || '').trim().replace(/\s+/g, ' ').replace(/[^\s"@]+@[^\s"@]+/g, '<email>').slice(0, 40)}"`;
  const under = new Map(); let points = 0, bare = 0;
  const solidOf = new Map(), isSolid = (el) => { if (!solidOf.has(el)) solidOf.set(el, el === zone ? zoneSolid : solid(el)); return solidOf.get(el); };
  // The toast is taken out of the hit test for the reading (put back at the end), so one hit test a point says what a tap would reach
  // without it; the whole list of what lies at the point is only needed behind a strip that is not solid.
  const was = toast.style.pointerEvents; toast.style.pointerEvents = 'none';
  try {
    for (const area of [toast, zone]) {
      if (!area) continue;
      const r = area.getBoundingClientRect();
      for (let y = Math.max(0, Math.ceil(r.top)); y < Math.min(innerHeight, r.bottom); y += 2) for (let x = Math.max(0, Math.ceil(r.left)); x < Math.min(innerWidth, r.right); x += 2) {
        points++;
        let first = document.elementFromPoint(x, y);
        const strip = first && first.closest('[data-toast-zone]');
        if (strip) { if (isSolid(strip)) continue; first = document.elementsFromPoint(x, y).find((el) => !toast.contains(el) && !el.matches('[data-toast-zone]')) ?? null; }
        else if (area === toast) bare++;
        const control = first && first.closest(CONTROL);
        if (!control || toast.contains(control) || control.matches(':disabled') || dim(control) || under.has(control)) continue;
        under.set(control, `${name(control)} at ${x},${y}`);
      }
    }
  } finally { toast.style.pointerEvents = was; }
  return { toast: { ...box(toast), text: toast.innerText.replace(/\s+/g, ' ').trim() }, zone: zone ? { ...box(zone), solid: zoneSolid } : null, under: [...under.values()], points, bare, sheet: !!document.querySelector('[data-sheet]'), view };
};
export function adminScreens({ base, pin, sec }) {
  const signin = async (page) => { await page.goto(`${base}/admin/senso`); if (await page.locator('input[name=pin]').count()) { await page.fill('input[name=pin]', pin); await page.click('button[type=submit]'); await page.waitForURL(`${base}/admin/senso`); } await page.waitForSelector('[data-item]'); };
  const settle = async (page) => { await page.waitForLoadState('networkidle').catch(() => {}); await page.evaluate(() => document.fonts.ready); await sleep(450); };
  const menu = async (page) => { await page.goto(`${base}/admin/senso`); await page.waitForSelector('[data-item]'); };
  const sectionMenu = async (page) => { await menu(page); const b = page.locator(`button[aria-label="Section menu: ${sec.name}"]`); await b.scrollIntoViewIfNeeded(); await b.click(); await page.waitForSelector('[role=menu]'); };
  const style = async (page) => { await page.goto(`${base}/admin/senso?tab=style`); await page.waitForSelector('[data-style-group="tabs"]'); };
  // [key, title, signed in?, setup, whole page too?]
  const SCREENS = [
    ['signin-venues', 'Sign-in: venue picker', false, async (p) => { await p.goto(`${base}/admin`); await p.waitForSelector('input[name=pin]'); }],
    ['signin-pin', 'Sign-in: PIN', false, async (p) => { await p.goto(`${base}/admin/senso`); await p.waitForSelector('input[name=pin]'); }],
    ['signin-email', 'Sign-in: email and password', false, async (p) => { await p.goto(`${base}/admin/senso?mode=admin`); await p.waitForSelector('input[name=email]'); }],
    ['menu', 'Menu tab (with an alert)', true, menu],
    ['venue-switcher', 'Venue switcher open', true, async (p) => { await menu(p); await p.evaluate(() => scrollTo(0, 0)); await p.click('summary[aria-label="Switch venue"]'); await p.waitForSelector('details[open] a[href="/admin/new"]'); }],
    ['account-menu', 'Account menu open', true, async (p) => { await menu(p); await p.evaluate(() => scrollTo(0, 0)); await p.click('summary[aria-label="Account"]'); await p.waitForSelector('details[open] form[action="/api/admin/logout"]'); }],
    ['section-menu', 'A section\'s menu', true, sectionMenu],
    ['reorder', 'Reorder items in a section', true, async (p) => { await sectionMenu(p); await p.click('[role=menu] button:has-text("Reorder items")'); await p.waitForSelector(`[data-reorder="${sec.id}"]`); await p.evaluate((id) => { const el = document.getElementById(`sec-${id}`); scrollTo(0, el.getBoundingClientRect().top + scrollY - 180); }, sec.id); }],
    ['add-item', 'Add item sheet', true, async (p) => { await menu(p); const b = p.locator(`[aria-label="Add item to ${sec.name}"]`); await b.scrollIntoViewIfNeeded(); await b.click(); await p.waitForSelector('[role=dialog] input[name=name]'); }],
    ['add-section', 'Add section sheet', true, async (p) => { await menu(p); const b = p.locator('button:has-text("Add section")').last(); await b.scrollIntoViewIfNeeded(); await b.click(); await p.waitForSelector('[role=dialog][aria-label="Add section"]'); }],
    ['rename-section', 'Rename section sheet', true, async (p) => { await sectionMenu(p); await p.click('[role=menu] button:has-text("Rename")'); await p.waitForSelector('[role=dialog][aria-label="Rename section"]'); }],
    ['delete-section', 'Delete section sheet', true, async (p) => { await sectionMenu(p); await p.click('[role=menu] button:has-text("Delete section")'); await p.waitForSelector('[role=dialog][aria-label="Delete this section?"]'); }],
    ['item-editor', 'Item editor', true, async (p) => { await menu(p); await p.fill('input[aria-label="Search items"]', 'Pumpkin Soup'); await p.locator('[data-item] button[aria-label="Edit Pumpkin Soup"]').first().click(); await p.waitForSelector('.item-panel'); }],
    // "Goes well with" (Kian via the PM, 2026-11-18): the card in view (the layout drill gives the item three pairs with the venue's longest names), and its picker
    ['item-pairs', 'Item editor: the Goes well with card', true, async (p) => { await menu(p); await p.fill('input[aria-label="Search items"]', 'Pumpkin Soup'); await p.locator('[data-item] button[aria-label="Edit Pumpkin Soup"]').first().click(); await p.waitForSelector('.item-panel [data-pairs]'); await p.locator('.item-panel [data-pairs]').scrollIntoViewIfNeeded(); }],
    ['pairs-picker', 'Goes well with picker', true, async (p) => { await menu(p); await p.fill('input[aria-label="Search items"]', 'Pumpkin Soup'); await p.locator('[data-item] button[aria-label="Edit Pumpkin Soup"]').first().click(); await p.waitForSelector('.item-panel [data-pairs-add]'); await p.locator('.item-panel [data-pairs-add]').scrollIntoViewIfNeeded(); await p.click('.item-panel [data-pairs-add]'); await p.waitForSelector('[role=dialog][aria-label^="Goes well with"] [data-pair-pick]'); }],
    ['style', 'Style tab', true, style, true],
    ['style-colour', 'Style: a colour open', true, async (p) => { await style(p); await p.click('[data-style-group="tabs"] > button'); await p.waitForSelector('[data-style-token="tabs.bg"] [data-style-swatches]'); /* opening the group opens its first colour */ }],
    ['style-welcome', 'Style: Welcome group open', true, async (p) => { await style(p); const b = p.locator('[data-style-group="welcome"] > button'); await b.scrollIntoViewIfNeeded(); await b.click(); await p.waitForSelector('[data-style-group="welcome"][data-open]'); }],
    // the preview controls' dropdowns (Kian, 2026-11-15): the Season one, with its line under the choices (the widest card)
    ['style-dropdown', 'Style: the Season dropdown open', true, async (p) => { await style(p); const b = p.locator('[data-preview-pick="season"]'); await b.scrollIntoViewIfNeeded(); await b.click(); await p.waitForSelector('[data-preview-menu="season"] [role=menuitemradio]'); }],
    ['details', 'Details tab', true, async (p) => { await p.goto(`${base}/admin/senso?tab=details`); await p.waitForSelector('[data-details-tab]'); }, true],
    ['team', 'Team', true, async (p) => { await p.goto(`${base}/admin/team`); await p.waitForSelector('input[name=name]'); }, true],
    ['add-venue', 'Add venue', true, async (p) => { await p.goto(`${base}/admin/new`); await p.waitForSelector('input[aria-label="Venue name"]'); }],
  ];
  return { SCREENS, signin, settle };
}
