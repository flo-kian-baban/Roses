// Style tab, JSON (owner and admin; staff get 403 on both methods, checked by the suite). Kian, 2026-10-08: colours are
// tokens grouped by page region (src/venues/tokens.ts); the layout options stay template-declared (src/venues/styles.ts).
//   GET  ?venue=<id>                                   the template, its tokens, the venue palette, the layout options and the stored style
//   POST { action:'update', venue, patch }              patch.colors = { "<token>": "#rrggbb" | null (back to auto) }, plus layout keys
//                                                      (welcome, photos, header). Every colour goes through the readability guard: a pair
//                                                      below its WCAG threshold is refused (400) with one line and the nearest colour that passes.
//   POST { action:'reset', venue, group? }              removes the colour choices of one group, or all of them (one record on the venue; Undo works)
import { jsonRoute, ApiError, revalidateVenue, str, type JsonBody } from '@/lib/admin/api';
import { canEditVenue, canManage } from '@/lib/admin/auth';
import { byOf } from '@/lib/admin/revisions';
import { getVenueRow, updateVenue } from '@/lib/admin/venue';
import { readStylePatch, styleOf, templateOf } from '@/venues/styles';
import { GROUPS, TOKEN_BY_KEY, customColors, guard, normHex, palette, tokensOf } from '@/venues/tokens';
import type { StyleValues } from '@/lib/types';

export default jsonRoute(async ({ req, res, session, body }) => {
  if (!canManage(session)) throw new ApiError(403, 'the Style tab is for the owner and admins');
  const venue = await getVenueRow(str(body.venue) ?? '');
  if (!venue) throw new ApiError(404, 'venue not found');
  if (!canEditVenue(session, venue.id)) throw new ApiError(403, 'no access to this venue');
  const template = templateOf(venue);
  const answer = (v: typeof venue) => ({ template: { id: template.id, name: template.name }, groups: GROUPS, tokens: tokensOf(v.template), palette: palette(v.brand), layout: template.options(v.brand), values: styleOf(v), style: v.style ?? {}, brand: v.brand ?? null });
  if (req.method === 'GET') return answer(venue);

  const current = (venue.style ?? {}) as StyleValues & { colors?: Record<string, string> };
  let next: Record<string, unknown>;
  if (body.action === 'update') {
    const patch = (body.patch && typeof body.patch === 'object' ? body.patch : {}) as JsonBody;
    const { colors: colorPatch, ...layoutPatch } = patch;
    const read = readStylePatch(venue, layoutPatch);
    if (!read.ok) throw new ApiError(400, read.error);
    const colors: Record<string, string | null> = {};
    if (colorPatch !== undefined) {
      if (!colorPatch || typeof colorPatch !== 'object') throw new ApiError(400, 'colors must be an object of token → colour');
      const known = new Set(tokensOf(venue.template).map((t) => t.key));
      for (const [k, v] of Object.entries(colorPatch as Record<string, unknown>)) {
        if (!known.has(k)) throw new ApiError(400, `"${k}" is not a colour of this template`);
        if (v === null) { colors[k] = null; continue; }
        const h = normHex(v); if (!h) throw new ApiError(400, `${TOKEN_BY_KEY[k].label}: not a colour (use #rrggbb)`);
        colors[k] = h;
      }
      const g = guard(venue, colors);
      if (!g.ok) throw new ApiError(400, g.error, { guard: { key: g.key, on: g.on, ratio: g.ratio, threshold: g.threshold, suggestion: g.suggestion } });
    }
    const merged = { ...customColors(current) };
    for (const [k, v] of Object.entries(colors)) { if (v === null) delete merged[k]; else merged[k] = v; }
    next = { ...current, ...read.values, colors: merged };
  } else if (body.action === 'reset') {
    const group = str(body.group);
    if (group && !GROUPS.some((g) => g.id === group)) throw new ApiError(400, 'unknown group');
    const merged = { ...customColors(current) };
    for (const k of Object.keys(merged)) if (!group || TOKEN_BY_KEY[k]?.group === group) delete merged[k];
    next = { ...current, colors: merged };
    if (!group) { delete next.accent; delete next.tile; } // the pre-token colour choices go too
  } else throw new ApiError(400, 'unknown action');

  const r = await updateVenue(venue.id, { style: next as StyleValues }, byOf(session));
  if (!r.ok) throw new ApiError(400, r.error);
  await revalidateVenue(res, venue.id);
  const after = (await getVenueRow(venue.id))!;
  return { revisions: r.revision ? [r.revision] : [], ...answer(after) };
}, { get: true });
