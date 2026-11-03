// Venue, JSON (owner and admin; staff get 403):
//   update  { action:'update', id, patch:{ name, tagline, locations, showPersianDrafts, logo }, base?:{ locations } }   the Details tab
//   create  { action:'create', name:{en,fa} }                                                    "+ Add venue" (default template; admin only)
//   GET ?id=<venue>                                                                              the details as the tab holds them
import { jsonRoute, ApiError, refusal, revalidateVenue, biOf, boolOf, isObj, photoUrlOk, str, textOf, type JsonBody } from '@/lib/admin/api';
import { canEditVenue, canManage, isAdmin } from '@/lib/admin/auth';
import { byOf } from '@/lib/admin/revisions';
import { createVenue, getVenueRow, updateVenue, type VenueSnapshot } from '@/lib/admin/venue';
import type { Bi, Location, Logo, Venue } from '@/lib/types';
import { LIMITS, phoneOf } from '@/lib/rules';

const details = (v: Venue) => ({ id: v.id, name: v.name, tagline: v.tagline, locations: v.locations, logo: v.brand?.logo ?? null, settings: v.settings, template: v.template, style: v.style, brandColors: v.brand?.colors ?? {} });
// Two lists of locations compared as data (the order of an object's keys does not count).
const canon = (x: unknown): string => JSON.stringify(x, (_k, v) => (v && typeof v === 'object' && !Array.isArray(v) ? Object.fromEntries(Object.entries(v as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b))) : v));
export const LOCATIONS_CHANGED = 'Someone else changed the locations since you opened this page. They are now on screen as they are; make your change again if it is still needed.';

export default jsonRoute(async ({ req, res, session, body }) => {
  if (!canManage(session)) throw new ApiError(403, 'venue details are edited by the owner or an admin');
  if (req.method === 'GET') {
    const v = await getVenueRow(str(body.id) ?? ''); if (!v) throw new ApiError(404, 'venue not found');
    if (!canEditVenue(session, v.id)) throw new ApiError(403, 'no access to this venue');
    return { revisions: [], venue: details(v) };
  }
  if (body.action === 'create') {
    // pre-go-live audit (the PM, 2026-11-03, S1-11): "+ Add venue" is for admins (an owner's new venue was public and theirs to open: 403)
    if (!isAdmin(session)) throw new ApiError(403, 'Adding a venue is for an admin');
    const name = biOf(body.name, 'The name', LIMITS.venueName); if (!name.en) throw new ApiError(400, 'The name is required');
    const r = await createVenue({ name, id: str(body.id) }, byOf(session));
    if (!r.ok) throw refusal(r);
    await revalidateVenue(res, r.id);
    return { revisions: [], venue: r.id };
  }
  const venue = await getVenueRow(str(body.id) ?? '');
  if (!venue) throw new ApiError(404, 'venue not found');
  if (!canEditVenue(session, venue.id)) throw new ApiError(403, 'no access to this venue');
  if (body.action !== 'update') throw new ApiError(400, 'unknown action');
  if (!isObj(body.patch)) throw new ApiError(400, 'patch: expected an object');
  const p = body.patch as JsonBody;
  const base = isObj(body.base) ? body.base : null;
  // Pre-go-live audit (the PM's fix batch, 2026-11-03): every field read strictly with its limit (S2-02, S2-06: a list of locations must be a
  // list, a logo an object or null); the change is built from the venue as it is under the row's lock (D-15); a change of the locations
  // carries them as the tab last saw them (base.locations) and is refused (409, with the details as they are now) when someone else changed
  // them since (the residual of D-03: before, the tab wrote its whole older copy back).
  const r = await updateVenue(venue.id, (row) => {
    const patch: Partial<VenueSnapshot> = {};
    // the Details tab sends only the language edited (pre-go-live audit D-03): the other one stays as it is now
    const biIn = (cur: Bi, v: unknown, what: string, max: number): Bi => { if (!isObj(v)) throw new ApiError(400, `${what}: expected { en } or { fa }`); return { en: 'en' in v ? textOf(v.en, what, max) : cur.en, fa: 'fa' in v ? textOf(v.fa, `${what} (Persian)`, max) : cur.fa }; };
    if ('name' in p) { patch.name = biIn(row.name, p.name, 'The name', LIMITS.venueName); if (!patch.name.en) throw new ApiError(400, 'The English name is required'); }
    if ('tagline' in p) patch.tagline = biIn(row.tagline, p.tagline, 'The tagline', LIMITS.tagline);
    if ('showPersianDrafts' in p) patch.settings = { ...row.settings, showPersianDrafts: boolOf(p.showPersianDrafts, 'showPersianDrafts') };
    if ('logo' in p) {
      if (p.logo !== null && !isObj(p.logo)) throw new ApiError(400, 'logo: expected { url, width, height } or null');
      let logo: Logo | null = null;
      if (p.logo) {
        const o = p.logo; const url = str(o.url); const width = Number(o.width), height = Number(o.height);
        // pre-go-live audit S2-04: a new logo is an uploaded file (or one of the logos the app ships); before, any https address passed
        if (!url || (url !== row.brand?.logo?.url && !photoUrlOk(url, 'logo'))) throw new ApiError(400, 'the logo must be an uploaded file');
        if (!(width > 0 && height > 0)) throw new ApiError(400, 'the logo size could not be read; try a PNG or JPEG');
        logo = { url, width: Math.round(width), height: Math.round(height), key: str(o.key) };
      }
      patch.brand = { ...row.brand, logo };
    }
    if ('locations' in p) {
      if (!Array.isArray(p.locations)) throw new ApiError(400, 'locations: expected a list');
      if (p.locations.length > 10) throw new ApiError(400, 'At most 10 locations');
      if (base && 'locations' in base && canon(base.locations) !== canon(row.locations)) throw new ApiError(409, LOCATIONS_CHANGED, { venue: details(row) });
      const L = LIMITS.location;
      patch.locations = p.locations.map((l, i): Location => {
        if (!isObj(l)) throw new ApiError(400, 'a location must be an object');
        const prev = row.locations[i];
        const phone = textOf(l.phone, 'The phone number', L);
        const ph = phone == null ? null : phoneOf(phone);
        if (ph === 'bad') throw new ApiError(400, 'A phone number has 7 to 15 digits and can hold spaces, (), + and - only');
        const loc: Location = { label: biOf(l.label, 'The label', L), address: textOf(l.address, 'The address', L), phone: ph, hours: biOf(l.hours, 'The hours', L) };
        const confirmed = l.confirmed === undefined ? false : boolOf(l.confirmed, 'confirmed');
        if (prev?.confirm?.length && !confirmed) { // "to confirm" marks clear per field when it is edited, or for the location when confirmed
          const still = prev.confirm.filter((f) => (f === 'address' && loc.address === prev.address) || (f === 'phone' && loc.phone === prev.phone) || (f === 'hours' && loc.hours.en === prev.hours.en));
          if (still.length) loc.confirm = still;
        }
        return loc;
      });
    }
    return patch;
  }, byOf(session));
  if (!r.ok) throw refusal(r);
  await revalidateVenue(res, venue.id);
  const after = await getVenueRow(venue.id);
  return { revisions: r.revision ? [r.revision] : [], venue: after && details(after) };
}, { get: true });
