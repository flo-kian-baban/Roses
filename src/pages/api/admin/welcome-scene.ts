// The welcome scene of a season, for the Style tab's preview-only season switch (Kian, 2026-10-09). Since the PM's decision of
// the same day the customers' page carries only the current season, so the preview fetches another season's scene from here and
// swaps it into the frame (src/app/admin/(app)/[venue]/_editor/Preview.tsx). Owner and admins, like the Style tab; nothing is saved.
//   GET ?venue=<id>&season=<fall|winter|spring|summer> → { season, html: the scene's markup as the page renders it,
//                                                          script: the artwork engine to run on it (Senso's fall and winter), else null }
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { jsonRoute, ApiError, str } from '@/lib/admin/api';
import { canEditVenue, canManage } from '@/lib/admin/auth';
import { getVenueRow } from '@/lib/admin/venue';
import { Scene, engineScript, usesArtwork } from '@/components/Welcome';
import { artScene } from '@/components/welcome-art';
import { SEASONS, type Season } from '@/lib/welcome';

export default jsonRoute(async ({ session, body }) => {
  if (!canManage(session)) throw new ApiError(403, 'the Style tab is for the owner and admins');
  const venue = await getVenueRow(str(body.venue) ?? '');
  if (!venue) throw new ApiError(404, 'venue not found');
  if (!canEditVenue(session, venue.id)) throw new ApiError(403, 'no access to this venue');
  const season = str(body.season) ?? '';
  if (!SEASONS.some((s) => s.id === season)) throw new ApiError(400, 'unknown season');
  const art = usesArtwork(venue.template);
  const html = renderToStaticMarkup(createElement(Scene, { season: season as Season, art }));
  return { season, html, script: artScene(season as Season, art) ? engineScript : null };
}, { get: true });
