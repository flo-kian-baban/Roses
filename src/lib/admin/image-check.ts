// An uploaded image read whole before it is stored (pre-go-live audit S2-09, the PM's fix batch of 2026-11-03): before, only its first bytes
// were checked, so an image signature followed by a web page was stored, and its pixel size was taken as the file claimed. Now the file
// must be one well-formed image of its type from its first byte to its last: PNG chunks (each checksum) up to IEND and nothing after it;
// JPEG segments and scan data up to the end-of-image marker (a phone's extra images after it, as an iPhone's HDR gain map, are each
// checked the same way); a WebP file's RIFF size and chunks to the end; an SVG logo one <svg> element, without scripts, event attributes,
// external references or entity declarations. The pixel size is read from the image itself and must be 1 to 10000 on each side.
export type Checked = { ok: true; width: number | null; height: number | null } | { ok: false; error: string };
export const MAX_SIDE = 10000;

const CRC = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
function crc32(b: Uint8Array): number { let c = 0xffffffff; for (let i = 0; i < b.length; i++) c = CRC[(c ^ b[i]) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; }
const bad = (error: string): Checked => ({ ok: false, error });
const sized = (w: number, h: number): Checked => (w >= 1 && h >= 1 && w <= MAX_SIDE && h <= MAX_SIDE ? { ok: true, width: w, height: h } : bad(`The image is ${w} × ${h} pixels; at most ${MAX_SIDE} on each side`));

function png(b: Buffer): Checked {
  if (b.length < 8 || !b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return bad('not a PNG');
  let i = 8, w = 0, h = 0, idat = false;
  while (i + 12 <= b.length) {
    const len = b.readUInt32BE(i), type = b.subarray(i + 4, i + 8).toString('latin1');
    if (len > 0x7fffffff || i + 12 + len > b.length) return bad('a PNG chunk runs past the end of the file');
    if (i === 8) { if (type !== 'IHDR' || len !== 13) return bad('a PNG starts with its header'); w = b.readUInt32BE(i + 8); h = b.readUInt32BE(i + 12); }
    if (crc32(b.subarray(i + 4, i + 8 + len)) !== b.readUInt32BE(i + 8 + len)) return bad(`a PNG chunk (${type}) is damaged`);
    if (type === 'IDAT') idat = true;
    i += 12 + len;
    if (type === 'IEND') return i === b.length ? (idat ? sized(w, h) : bad('a PNG without image data')) : bad('the PNG carries something after its end');
  }
  return bad('the PNG has no end');
}

// One JPEG stream from `at`; answers where it ends (just after its end-of-image marker) and its size.
function jpegStream(b: Buffer, at: number): { end: number; w: number; h: number } | string {
  if (b[at] !== 0xff || b[at + 1] !== 0xd8) return 'not a JPEG';
  let i = at + 2, w = 0, h = 0;
  while (i < b.length) {
    if (b[i] !== 0xff) return 'a JPEG segment is damaged';
    while (b[i] === 0xff && i < b.length) i++;
    const m = b[i]; i++;
    if (m === undefined) break;
    if (m === 0xd9) return w && h ? { end: i, w, h } : 'a JPEG without a frame header';
    if (m === 0x01 || (m >= 0xd0 && m <= 0xd7)) continue;
    if (m === 0x00 || i + 2 > b.length) return 'a JPEG segment is damaged';
    const len = b.readUInt16BE(i);
    if (len < 2 || i + len > b.length) return 'a JPEG segment runs past the end of the file';
    if (m >= 0xc0 && m <= 0xcf && m !== 0xc4 && m !== 0xc8 && m !== 0xcc && len >= 7) { h = b.readUInt16BE(i + 3); w = b.readUInt16BE(i + 5); }
    i += len;
    if (m === 0xda) { // scan data: up to the next marker that is not a stuffed byte or a restart marker
      while (i < b.length) {
        if (b[i] !== 0xff) { i++; continue; }
        const n = b[i + 1];
        if (n === 0x00 || (n !== undefined && n >= 0xd0 && n <= 0xd7)) { i += 2; continue; }
        if (n === 0xff) { i++; continue; }
        break;
      }
    }
  }
  return 'the JPEG has no end';
}
function jpeg(b: Buffer): Checked {
  const first = jpegStream(b, 0);
  if (typeof first === 'string') return bad(first);
  let i = first.end;
  for (let extra = 0; i < b.length; extra++) { // what follows: zero padding, or the phone's further images (MPF), each a whole JPEG
    while (i < b.length && b[i] === 0x00) i++;
    if (i >= b.length) break;
    if (extra >= 4) return bad('the JPEG carries something after its end');
    const next = jpegStream(b, i);
    if (typeof next === 'string') return bad('the JPEG carries something after its end');
    i = next.end;
  }
  return sized(first.w, first.h);
}

function webp(b: Buffer): Checked {
  if (b.length < 20 || b.subarray(0, 4).toString('latin1') !== 'RIFF' || b.subarray(8, 12).toString('latin1') !== 'WEBP') return bad('not a WebP image');
  if (b.readUInt32LE(4) + 8 !== b.length) return bad('the WebP file\'s size does not match its contents');
  let i = 12, dims: Checked | null = null;
  while (i < b.length) {
    if (i + 8 > b.length) return bad('a WebP chunk is damaged');
    const type = b.subarray(i, i + 4).toString('latin1'), len = b.readUInt32LE(i + 4), next = i + 8 + len + (len & 1);
    if (next > b.length) return bad('a WebP chunk runs past the end of the file');
    if (i === 12) {
      if (type === 'VP8 ' && len >= 10 && b[i + 11] === 0x9d && b[i + 12] === 0x01 && b[i + 13] === 0x2a) dims = sized(b.readUInt16LE(i + 14) & 0x3fff, b.readUInt16LE(i + 16) & 0x3fff);
      else if (type === 'VP8L' && len >= 5 && b[i + 8] === 0x2f) { const v = b.readUInt32LE(i + 9); dims = sized((v & 0x3fff) + 1, ((v >> 14) & 0x3fff) + 1); }
      else if (type === 'VP8X' && len >= 10) dims = sized(b.readUIntLE(i + 12, 3) + 1, b.readUIntLE(i + 15, 3) + 1);
      else return bad('a WebP image starts with its image data');
    }
    i = next;
  }
  return dims ?? bad('a WebP image without image data');
}

function svg(b: Buffer): Checked {
  let s: string;
  try { s = new TextDecoder('utf-8', { fatal: true }).decode(b); } catch { return bad('the SVG is not text'); }
  s = s.replace(/^\uFEFF/, '');
  const body = s.replace(/<!--[\s\S]*?-->/g, '').replace(/<\?xml[^>]*\?>/, '').trim();
  if (/<!DOCTYPE|<!ENTITY/i.test(body)) return bad('the SVG declares a document type or entities');
  if (!/^<svg[\s>]/i.test(body) || !/<\/svg>$/i.test(body)) return bad('the file is not one SVG image');
  if (/<script|<foreignObject|<iframe|<object|<embed|\son[a-z]+\s*=|javascript:|<\?/i.test(body)) return bad('the SVG holds scripts or event attributes');
  if (/(?:href|src)\s*=\s*["']\s*(?!#|data:image\/)/i.test(body) || /url\(\s*["']?\s*(?!#|data:image\/)/i.test(body)) return bad('the SVG links to other files');
  const tag = body.match(/^<svg[^>]*>/i)?.[0] ?? '';
  const num = (k: string) => { const m = tag.match(new RegExp(`\\s${k}\\s*=\\s*["']\\s*([\\d.]+)(px)?\\s*["']`, 'i')); return m ? Math.round(Number(m[1])) : null; };
  const w = num('width'), h = num('height');
  if (w && h) return sized(w, h);
  const vb = tag.match(/viewBox\s*=\s*["']\s*[\d.-]+[\s,]+[\d.-]+[\s,]+([\d.]+)[\s,]+([\d.]+)\s*["']/i);
  if (vb) return sized(Math.round(Number(vb[1])), Math.round(Number(vb[2])));
  return { ok: true, width: null, height: null };
}

export function checkImage(buf: Buffer, ext: string): Checked {
  try { return ext === 'png' ? png(buf) : ext === 'jpg' ? jpeg(buf) : ext === 'webp' ? webp(buf) : ext === 'svg' ? svg(buf) : bad('not an image type the admin takes'); }
  catch { return bad('the image could not be read'); }
}
