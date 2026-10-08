// Photo and logo upload (step 2): the file is the request body (the browser sends the resized image as image/jpeg,
// image/png or image/webp; SVG for logos only), at most 8 MB, checked by its first bytes, stored behind the storage
// interface and answered with its address, key and pixel size. No multipart parsing, no dependency.
//   POST /api/admin/upload?venue=<id>&kind=photo|logo      body: the image bytes
import type { NextApiRequest, NextApiResponse } from 'next';
import { sessionFromRequest, canEditVenue, canManage } from '@/lib/admin/auth';
import { getVenueRow } from '@/lib/admin/venue';
import { newKey, storage, EXT_TYPES } from '@/lib/storage';

export const config = { api: { bodyParser: false, responseLimit: false } };
const MAX = 8 * 1024 * 1024;
const TYPE_EXT: Record<string, keyof typeof EXT_TYPES> = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/svg+xml': 'svg' };

function sniff(buf: Buffer): keyof typeof EXT_TYPES | null {
  if (buf.length > 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'jpg';
  if (buf.length > 8 && buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return 'png';
  if (buf.length > 12 && buf.subarray(0, 4).toString('latin1') === 'RIFF' && buf.subarray(8, 12).toString('latin1') === 'WEBP') return 'webp';
  const head = buf.subarray(0, 512).toString('utf8').trimStart();
  if (head.startsWith('<') && /<svg[\s>]/i.test(buf.subarray(0, 4096).toString('utf8'))) return 'svg';
  return null;
}
// Pixel size from the file itself (PNG IHDR, JPEG SOF, WebP VP8/VP8L/VP8X, SVG width/height or viewBox).
export function dimensions(buf: Buffer, ext: string): { width: number; height: number } | null {
  try {
    if (ext === 'png') return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
    if (ext === 'jpg') {
      let i = 2;
      while (i + 9 < buf.length) {
        if (buf[i] !== 0xff) { i++; continue; }
        const m = buf[i + 1];
        if (m === 0xd8 || m === 0x01 || (m >= 0xd0 && m <= 0xd7)) { i += 2; continue; }
        const len = buf.readUInt16BE(i + 2);
        if (m >= 0xc0 && m <= 0xcf && m !== 0xc4 && m !== 0xc8 && m !== 0xcc) return { height: buf.readUInt16BE(i + 5), width: buf.readUInt16BE(i + 7) };
        i += 2 + len;
      }
      return null;
    }
    if (ext === 'webp') {
      const chunk = buf.subarray(12, 16).toString('latin1');
      if (chunk === 'VP8 ') return { width: buf.readUInt16LE(26) & 0x3fff, height: buf.readUInt16LE(28) & 0x3fff };
      if (chunk === 'VP8L') { const b = buf.readUInt32LE(21); return { width: (b & 0x3fff) + 1, height: ((b >> 14) & 0x3fff) + 1 }; }
      if (chunk === 'VP8X') return { width: buf.readUIntLE(24, 3) + 1, height: buf.readUIntLE(27, 3) + 1 };
      return null;
    }
    if (ext === 'svg') {
      const s = buf.subarray(0, 4096).toString('utf8'); const tag = s.match(/<svg[^>]*>/i)?.[0] ?? '';
      const num = (k: string) => { const m = tag.match(new RegExp(`\\s${k}="\\s*([\\d.]+)`, 'i')); return m ? Math.round(Number(m[1])) : null; };
      const w = num('width'), h = num('height'); if (w && h) return { width: w, height: h };
      const vb = tag.match(/viewBox="\s*[\d.-]+[\s,]+[\d.-]+[\s,]+([\d.]+)[\s,]+([\d.]+)/i); if (vb) return { width: Math.round(Number(vb[1])), height: Math.round(Number(vb[2])) };
      return null;
    }
  } catch { /* fall through */ }
  return null;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') { res.setHeader('Allow', 'POST'); res.status(405).json({ ok: false, error: 'POST only' }); return; }
  const session = await sessionFromRequest(req);
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
  const dim = dimensions(buf, ext);
  const stored = await storage.put(newKey(venue.id, kind, ext), buf, EXT_TYPES[ext]);
  res.status(200).json({ ok: true, url: stored.url, key: stored.key, width: dim?.width ?? null, height: dim?.height ?? null, bytes: buf.length });
}
