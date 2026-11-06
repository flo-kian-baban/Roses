// The admin's layout rules, measured on a page (the PM, 2026-11-06: the item editor's rules of 2026-11-04 across the whole admin), shared
// by scripts/layout-drill.mjs and reports/admin-cleanup/shots.mjs. MEASURE runs in the page (page.evaluate) and returns:
//   found: what breaks the rules: the page wider than the screen; anything reaching past the screen's edges, cut by the box around it,
//     cut short (an ellipsis, a line clamp, a one-line text box holding more than it shows) or scrolling sideways;
//   sizes: the text sizes in use; radii: the corner radii of what the admin draws.
// Left out, as not the admin's own interface: the customers' page in the preview (the iframe) and the iPhone frame around it. Form
// controls keep their own drawing (the iOS switch's pill, the check box and the radio dot: .switch, .check) and a person's initials
// their circle ([data-avatar]). A row of chips made to scroll sideways on a phone (the
// preview bar in the Style tab's sheet) says so with data-scrolls-sideways and is not counted as cut; sideways: for each such row that
// scrolls, the chip its right edge cuts with the row at its start, and how much of it shows and is hidden (the PM, 2026-11-06: it stays
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
    for (const b of row.querySelectorAll('button')) { const r = b.getBoundingClientRect(); if (r.left < edge && r.right > edge) { cut = { chip: (b.textContent || b.getAttribute('aria-label') || '').trim().slice(0, 20), shown: Math.round((edge - r.left) * 10) / 10, hidden: Math.round((r.right - edge) * 10) / 10 }; break; } }
    row.scrollLeft = at;
    return cut;
  });
  return { found, sizes: [...sizes].sort(), radii: [...radii].sort(), sideways };
};

// Every admin screen, as [key, title, signed in?, setup(page), whole page too?], shared by scripts/layout-drill.mjs and
// reports/admin-cleanup/shots.mjs. sec: a section of Senso's own order with items (for its menu, the reorder and the sheets).
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
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
    ['style', 'Style tab', true, style, true],
    ['style-colour', 'Style: a colour open', true, async (p) => { await style(p); await p.click('[data-style-group="tabs"] > button'); await p.waitForSelector('[data-style-token="tabs.bg"] [data-style-swatches]'); /* opening the group opens its first colour */ }],
    ['style-welcome', 'Style: Welcome group open', true, async (p) => { await style(p); const b = p.locator('[data-style-group="welcome"] > button'); await b.scrollIntoViewIfNeeded(); await b.click(); await p.waitForSelector('[data-style-group="welcome"][data-open]'); }],
    ['details', 'Details tab', true, async (p) => { await p.goto(`${base}/admin/senso?tab=details`); await p.waitForSelector('[data-details-tab]'); }, true],
    ['team', 'Team', true, async (p) => { await p.goto(`${base}/admin/team`); await p.waitForSelector('input[name=name]'); }, true],
    ['add-venue', 'Add venue', true, async (p) => { await p.goto(`${base}/admin/new`); await p.waitForSelector('input[aria-label="Venue name"]'); }],
  ];
  return { SCREENS, signin, settle };
}
