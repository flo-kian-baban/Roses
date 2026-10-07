// Reads the sensocafe.ca capture (manifest widget extraction) into headings and items.
export function parseSensoWebsite(widgets) {
  const cats = []; let top = null; let cur = null;
  for (const w of widgets) {
    if (/©|Privacy Policy|Designed and Developed/i.test(w.text)) continue;
    if (w.type.startsWith('heading')) {
      if (/^our menu$/i.test(w.text)) continue;
      if (w.visibleOnPhone) { top = { name: w.text.trim(), hidden: false, items: [], notes: [] }; cats.push(top); cur = top; }
      else if (top) { cur = { name: `${top.name} › ${w.text.trim()}`, hidden: true, items: [], notes: [], subHeading: w.text.trim() }; cats.push(cur); }
      continue;
    }
    if (!cur) continue;
    if (w.type.startsWith('icon-list')) for (const t of w.items || []) cur.items.push({ name: t.trim(), description: null, imgSrc: null, hidden: !w.visibleOnPhone });
    else if (w.type.startsWith('price-list')) for (const it of w.items || []) cur.items.push({ name: (it.title || '').trim(), description: it.description ? it.description.trim() : null, imgSrc: it.imgSrc || null, hidden: !w.visibleOnPhone });
    else if (w.type.startsWith('text-editor') && w.text) cur.notes.push(w.text.trim());
  }
  for (const k of cats) if (k.subHeading && !k.items.length) { k.items.push({ name: k.subHeading, description: k.notes.join(' ') || null, imgSrc: null, hidden: true }); k.notes = []; k.headingOnly = true; }
  return cats;
}
