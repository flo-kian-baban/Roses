// Photo and logo upload (step 2): the file is the request body (the browser sends the resized image as image/jpeg,
// image/png or image/webp; SVG for logos only), at most 8 MB, stored behind the storage interface and answered with its
// address, key and pixel size. No multipart parsing, no dependency. Pre-go-live audit (the PM's fix batch, 2026-11-03, S2-09): the whole
// file is checked as one image of its type and its pixel size read from it (src/lib/admin/image-check.ts), and each venue has a quota:
// 100 files an hour, 2000 files and 500 MB in all (UPLOAD_QUOTA_HOUR, UPLOAD_QUOTA_FILES, UPLOAD_QUOTA_MB override them, for tests only).
//   POST /api/admin/upload?venue=<id>&kind=photo|logo      body: the image bytes
import type { NextApiRequest, NextApiResponse } from 'next';
import { sessionFromRequest, canEditVenue, canManage } from '@/lib/admin/auth';
import { refuseCrossSite } from '@/lib/admin/api';
import { checkImage } from '@/lib/admin/image-check';
import { getVenueRow } from '@/lib/admin/venue';
import { liveSession } from '@/lib/admin/pins';
import { newKey, storage, EXT_TYPES } from '@/lib/storage';

export const config = { api: { bodyParser: false, responseLimit: false } };
const MAX = 8 * 1024 * 1024;
const num = (v: string | undefined, d: number): number => { const n = Number(v); return v && Number.isInteger(n) && n > 0 ? n : d; };
const QUOTA = () => ({ hour: num(process.env.UPLOAD_QUOTA_HOUR, 100), files: num(process.env.UPLOAD_QUOTA_FILES, 2000), bytes: num(process.env.UPLOAD_QUOTA_MB, 500) * 1024 * 1024 });
const TYPE_EXT: Record<string, keyof typeof EXT_TYPES> = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/svg+xml': 'svg' };

function sniff(buf: Buffer): keyof typeof EXT_TYPES | null {
  if (buf.length > 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'jpg';
  if (buf.length > 8 && buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return 'png';
  if (buf.length > 12 && buf.subarray(0, 4).toString('latin1') === 'RIFF' && buf.subarray(8, 12).toString('latin1') === 'WEBP') return 'webp';
  const head = buf.subarray(0, 512).toString('utf8').trimStart();
  if (head.startsWith('<') && /<svg[\s>]/i.test(buf.subarray(0, 4096).toString('utf8'))) return 'svg';
  return null;
}
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') { res.setHeader('Allow', 'POST'); res.status(405).json({ ok: false, error: 'POST only' }); return; }
  if (refuseCrossSite(req, res)) return; // pre-go-live audit S1-08
  const session = await liveSession(await sessionFromRequest(req));
  if (!session) { res.status(401).json({ ok: false, error: 'not signed in' }); return; }
  const venueId = String(req.query.venue ?? ''); const kind = req.query.kind === 'logo' ? 'logo' : 'photo';
  const venue = await getVenueRow(venueId);
  if (!venue) { res.status(404).json({ ok: false, error: 'venue not found' }); return; }
  if (!canEditVenue(session, venue.id)) { res.status(403).json({ ok: false, error: 'no access to this venue' }); return; }
  if (kind === 'logo' && !canManage(session)) { res.status(403).json({ ok: false, error: 'the logo is changed by the owner or an admin' }); return; }
  const declared = TYPE_EXT[String(req.headers['content-type'] ?? '').split(';')[0].trim().toLowerCase()];
  if (!declared || (declared === 'svg' && kind !== 'logo')) { res.status(400).json({ ok: false, error: kind === 'logo' ? 'The logo must be a JPEG, PNG, WebP or SVG file' : 'The photo must be a JPEG, PNG or WebP image' }); return; }
  const chunks: Buffer[] = []; let size = 0;
  for await (const c of req) { const b = Buffer.isBuffer(c) ? c : Buffer.from(c); size += b.length; if (size > MAX) { res.status(413).json({ ok: false, error: 'The file is too large (over 8 MB)' }); return; } chunks.push(b); }
  const buf = Buffer.concat(chunks);
  if (!buf.length) { res.status(400).json({ ok: false, error: 'The file is empty' }); return; }
  const ext = sniff(buf);
  if (!ext || ext !== declared) { res.status(400).json({ ok: false, error: 'The file is not the image type it says it is' }); return; }
  const checked = checkImage(buf, ext);
  if (!checked.ok) { res.status(400).json({ ok: false, error: `This file cannot be used: ${checked.error}. Try another photo, or save it again as a JPEG or PNG.` }); return; }
  const q = QUOTA(), used = await storage.usage(venue.id);
  if (used.lastHour >= q.hour) { res.status(429).json({ ok: false, error: `${q.hour} photos were uploaded for this venue in the last hour; try again later.` }); return; }
  if (used.files >= q.files || used.bytes + buf.length > q.bytes) { res.status(413).json({ ok: false, error: 'This venue\'s photo storage is full. Ask an admin to clear unused photos (npm run uploads:clean).' }); return; }
  const stored = await storage.put(newKey(venue.id, kind, ext), buf, EXT_TYPES[ext]);
  res.status(200).json({ ok: true, url: stored.url, key: stored.key, width: checked.width, height: checked.height, bytes: buf.length });
}
