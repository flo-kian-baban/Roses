// Sections, JSON (the page editor). Every action answers { ok, revisions, ... } and regenerates the public page.
//   create  { action:'create', venue, name:{en,fa} }
//   update  { action:'update', id, patch:{ name, note, listed, layout } }   layout 'list' | 'grid' (Kian, 2026-10-08): owner and admin only, 403 for staff
//   move    { action:'move', id, direction:'up'|'down' }       or   reorder { action:'reorder', venue, section_ids }
//   delete  { action:'delete', id, items:'move'|'delete'|'keep', target_section_id }   move its items to another section (default in the UI) or delete them too
// Pre-go-live audit (the PM's fix batch, 2026-11-03): fields read strictly with their limits (a name 60 characters, a note 500); create
// takes the editor's key for one "Add section" (D-05: sent again it answers the section already made); an update of the name or the
// note carries them as the editor last saw them (base) and is refused (409, with the section as it is now) when someone else changed
// them since (the residual of D-03: before, the later save silently put back its own older text).
// The venue's Seasonal section (Kian, 2026-10-12) can be hidden, its note and layout changed; not renamed, moved or deleted (400).
import { jsonRoute, ApiError, refusal, revalidateVenue, biOf, boolOf, idOf, idsOf, isObj, str } from '@/lib/admin/api';
import { LIMITS } from '@/lib/rules';
import { canEditVenue, canManage } from '@/lib/admin/auth';
import { byOf } from '@/lib/admin/revisions';
import { LAYOUTS, createSection, deleteSection, getSection, listSections, reorderSections, updateSection, type DeleteItems, type SectionPatch } from '@/lib/admin/sections';
import type { SectionLayout } from '@/lib/types';
import { editorMenu } from '@/lib/admin/overview';
import { pool } from '@/lib/db';
import { sectionOrder } from '@/lib/admin/items';

const sectionOut = async (id: string) => { const s = await getSection(id); return s ? { id: s.id, name: s.name, note: s.note, position: s.position, listed: s.listed, fa_draft: s.fa_draft, layout: s.layout, seasonal: s.seasonal, item_ids: await sectionOrder(pool, id) } : null; };

export default jsonRoute(async ({ res, session, body }) => {
  const by = byOf(session);
  if (body.action === 'create' || body.action === 'reorder') {
    const venueId = str(body.venue) ?? '';
    if (!canEditVenue(session, venueId)) throw new ApiError(403, 'no access to this venue');
    if (body.action === 'create') {
      const name = biOf(body.name, 'The section name', LIMITS.section); if (!name.en) throw new ApiError(400, 'The name is required');
      const r = await createSection(venueId, { name }, by, typeof body.key === 'string' && /^[A-Za-z0-9-]{8,64}$/.test(body.key) ? body.key : null);
      if (!r.ok) throw refusal(r);
      await revalidateVenue(res, venueId);
      return { revisions: [r.revision], section: await sectionOut(r.id) };
    }
    const r = await reorderSections(venueId, idsOf(body.section_ids, 'section_ids'), by);
    if (!r.ok) throw refusal(r);
    await revalidateVenue(res, venueId);
    return { revisions: r.revision ? [r.revision] : [], section_order: r.order };
  }
  const id = idOf(body.id);
  const sec = await getSection(id);
  if (!sec) throw new ApiError(404, 'section not found');
  if (!canEditVenue(session, sec.venue_id)) throw new ApiError(403, 'no access to this venue');
  if (body.action === 'update') {
    if (!isObj(body.patch)) throw new ApiError(400, 'patch: expected an object');
    const p = body.patch; const patch: SectionPatch = {};
    if ('name' in p) patch.name = biOf(p.name, 'The section name', LIMITS.section);
    if ('note' in p) patch.note = biOf(p.note, 'The note', LIMITS.note, { lines: true });
    if ('listed' in p) patch.listed = boolOf(p.listed, 'listed');
    if ('layout' in p) {
      if (!canManage(session)) throw new ApiError(403, 'the layout of a section is set by the owner or an admin');
      if (!LAYOUTS.includes(p.layout as SectionLayout)) throw new ApiError(400, 'layout: list or grid');
      patch.layout = p.layout as SectionLayout;
    }
    const base = isObj(body.base) ? { ...('name' in body.base ? { name: body.base.name } : {}), ...('note' in body.base ? { note: body.base.note } : {}) } : null;
    const r = await updateSection(id, patch, by, base);
    if (!r.ok) throw refusal(r, r.conflict ? { section: await sectionOut(id) } : {});
    await revalidateVenue(res, sec.venue_id);
    return { revisions: r.revision ? [r.revision] : [], section: await sectionOut(id) };
  }
  if (body.action === 'move') {
    if (sec.seasonal) throw new ApiError(400, 'The Seasonal section stays first');
    const order = (await listSections(sec.venue_id)).filter((s) => !s.seasonal).map((s) => s.id);
    const i = order.indexOf(id); const j = body.direction === 'up' ? i - 1 : i + 1;
    if (j < 0 || j >= order.length) return { revisions: [], section_order: order };
    [order[i], order[j]] = [order[j], order[i]];
    const r = await reorderSections(sec.venue_id, order, by);
    if (!r.ok) throw refusal(r);
    await revalidateVenue(res, sec.venue_id);
    return { revisions: r.revision ? [r.revision] : [], section_order: r.order };
  }
  if (body.action === 'delete') {
    const mode: DeleteItems = body.items === 'move' ? { items: 'move', target: idOf(body.target_section_id) } : body.items === 'delete' ? { items: 'delete' } : { items: 'keep' };
    const r = await deleteSection(id, by, mode);
    if (!r.ok) throw refusal(r);
    await revalidateVenue(res, sec.venue_id);
    return { revisions: r.revisions, orphaned: r.orphaned, menu: await editorMenu(sec.venue_id) };
  }
  throw new ApiError(400, 'unknown action');
});
