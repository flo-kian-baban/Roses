// Sections, JSON (the page editor). Every action answers { ok, revisions, ... } and regenerates the public page.
//   create  { action:'create', venue, name:{en,fa} }
//   update  { action:'update', id, patch:{ name, note, listed } }
//   move    { action:'move', id, direction:'up'|'down' }       or   reorder { action:'reorder', venue, section_ids }
//   delete  { action:'delete', id, items:'move'|'delete'|'keep', target_section_id }   move its items to another section (default in the UI) or delete them too
import { jsonRoute, ApiError, revalidateVenue, biOf, boolOf, idOf, str, type JsonBody } from '@/lib/admin/api';
import { canEditVenue } from '@/lib/admin/auth';
import { byOf } from '@/lib/admin/revisions';
import { createSection, deleteSection, getSection, listSections, reorderSections, updateSection, type DeleteItems, type SectionPatch } from '@/lib/admin/sections';
import { editorMenu } from '@/lib/admin/overview';
import { pool } from '@/lib/db';
import { sectionOrder } from '@/lib/admin/items';

const sectionOut = async (id: string) => { const s = await getSection(id); return s ? { id: s.id, name: s.name, note: s.note, position: s.position, listed: s.listed, fa_draft: s.fa_draft, item_ids: await sectionOrder(pool, id) } : null; };

export default jsonRoute(async ({ res, session, body }) => {
  const by = byOf(session);
  if (body.action === 'create' || body.action === 'reorder') {
    const venueId = str(body.venue) ?? '';
    if (!canEditVenue(session, venueId)) throw new ApiError(403, 'no access to this venue');
    if (body.action === 'create') {
      const name = biOf(body.name); if (!name.en) throw new ApiError(400, 'The name is required');
      const r = await createSection(venueId, { name }, by);
      if (!r.ok) throw new ApiError(400, r.error);
      await revalidateVenue(res, venueId);
      return { revisions: [r.revision], section: await sectionOut(r.id) };
    }
    const r = await reorderSections(venueId, Array.isArray(body.section_ids) ? body.section_ids.map(idOf) : [], by);
    if (!r.ok) throw new ApiError(400, r.error);
    await revalidateVenue(res, venueId);
    return { revisions: r.revision ? [r.revision] : [], section_order: r.order };
  }
  const id = idOf(body.id);
  const sec = await getSection(id);
  if (!sec) throw new ApiError(404, 'section not found');
  if (!canEditVenue(session, sec.venue_id)) throw new ApiError(403, 'no access to this venue');
  if (body.action === 'update') {
    const p = (body.patch && typeof body.patch === 'object' ? body.patch : {}) as JsonBody; const patch: SectionPatch = {};
    if ('name' in p) patch.name = biOf(p.name);
    if ('note' in p) patch.note = biOf(p.note);
    if ('listed' in p) patch.listed = boolOf(p.listed);
    const r = await updateSection(id, patch, by);
    if (!r.ok) throw new ApiError(400, r.error);
    await revalidateVenue(res, sec.venue_id);
    return { revisions: r.revision ? [r.revision] : [], section: await sectionOut(id) };
  }
  if (body.action === 'move') {
    const order = (await listSections(sec.venue_id)).map((s) => s.id);
    const i = order.indexOf(id); const j = body.direction === 'up' ? i - 1 : i + 1;
    if (j < 0 || j >= order.length) return { revisions: [], section_order: order };
    [order[i], order[j]] = [order[j], order[i]];
    const r = await reorderSections(sec.venue_id, order, by);
    if (!r.ok) throw new ApiError(400, r.error);
    await revalidateVenue(res, sec.venue_id);
    return { revisions: r.revision ? [r.revision] : [], section_order: r.order };
  }
  if (body.action === 'delete') {
    const mode: DeleteItems = body.items === 'move' ? { items: 'move', target: idOf(body.target_section_id) } : body.items === 'delete' ? { items: 'delete' } : { items: 'keep' };
    const r = await deleteSection(id, by, mode);
    if (!r.ok) throw new ApiError(400, r.error);
    await revalidateVenue(res, sec.venue_id);
    return { revisions: r.revisions, orphaned: r.orphaned, menu: await editorMenu(sec.venue_id) };
  }
  throw new ApiError(400, 'unknown action');
});
