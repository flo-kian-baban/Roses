// The welcome scene of a season, for the Style tab's preview-only season switch (Kian, 2026-10-09). Since the PM's decision of
// the same day the customers' page carries only the current season, so the preview fetches another season's scene from here and
// swaps it into the frame (src/app/admin/(app)/[venue]/_editor/Preview.tsx). Anyone who can edit the venue (the preview bar's season
// switch is on every tab since 2026-10-09, staff included; the answer is the public page's own markup); nothing is saved.
//   GET ?venue=<id>&season=<fall|winter|spring|summer>[&transition=<T1…T10>]
//       → { season, html: the scene's markup as the page renders it, script: the artwork engine to run on it (Senso's fall, winter and
//           summer), else null, tx: the transition into the menu as the page ships it for that season ({ id, key, css, js }: the venue's
//           choice for that season, or the one asked for; Senso's, every season since 2026-10-11; with its name, level, time and line), else null }
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { jsonRoute, ApiError, str } from '@/lib/admin/api';
import { canEditVenue } from '@/lib/admin/auth';
import { getVenueRow } from '@/lib/admin/venue';
import { Scene, engineFor, txFor, usesArtwork } from '@/components/Welcome';
import { TRANSITION_BY_ID, isTransitionId } from '@/lib/transitions';
import { styleOf, transitionOf } from '@/venues/styles';
import { artScene } from '@/components/welcome-art';
import { SEASONS, type Season } from '@/lib/welcome';

export default jsonRoute(async ({ session, body }) => {
  const venue = await getVenueRow(str(body.venue) ?? '');
  if (!venue) throw new ApiError(404, 'venue not found');
  if (!canEditVenue(session, venue.id)) throw new ApiError(403, 'no access to this venue');
  const season = str(body.season) ?? '';
  if (!SEASONS.some((s) => s.id === season)) throw new ApiError(400, 'unknown season');
  const art = usesArtwork(venue.template);
  const html = renderToStaticMarkup(createElement(Scene, { season: season as Season, art }));
  const a = artScene(season as Season, art);
  const asked = str(body.transition);
  if (asked && !isTransitionId(asked)) throw new ApiError(400, 'unknown transition');
  const tx = txFor(art, asked ?? transitionOf(styleOf(venue), season as Season), season as Season);
  const def = tx && TRANSITION_BY_ID[tx.id];
  return { season, html, script: a ? engineFor(a.kind) : null, tx: tx && def && { id: tx.id, key: tx.key, css: tx.css, js: tx.js, name: def.name, level: def.level, ms: def[tx.season].ms, text: def[tx.season].text } };
}, { get: true });
