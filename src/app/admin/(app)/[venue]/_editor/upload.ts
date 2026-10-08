// Photo and logo upload from the browser (step 2): the chosen file is shrunk on the phone itself with a canvas (no
// dependency; a 4000-pixel phone photo becomes a 1400-pixel JPEG of a few hundred KB), then posted as the request
// body to /api/admin/upload, which stores it behind the storage interface and answers with its address and size.
export type Uploaded = { url: string; key: string; width: number | null; height: number | null; bytes: number };
const PHOTO_TYPES = /^image\/(jpeg|png|webp)$/, LOGO_TYPES = /^image\/(jpeg|png|webp|svg\+xml)$/;

function loadImage(file: Blob): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file); const img = new Image();
    img.onload = () => { URL.revokeObjectURL(url); resolve(img); };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('This image could not be read. Try a JPEG or PNG.')); };
    img.src = url;
  });
}

// Photos: at most 1400 px on the long side, JPEG. Logos: kept as they are (PNG and SVG transparency matter) unless huge.
export async function prepareImage(file: File, kind: 'photo' | 'logo'): Promise<{ blob: Blob; type: string }> {
  if (kind === 'logo' && (file.type === 'image/svg+xml' || file.size <= 2 * 1024 * 1024)) return { blob: file, type: file.type };
  const img = await loadImage(file);
  const max = kind === 'logo' ? 1200 : 1400;
  const scale = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight));
  if (scale === 1 && file.type === 'image/jpeg' && file.size <= 700 * 1024) return { blob: file, type: file.type };
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(img.naturalWidth * scale)); canvas.height = Math.max(1, Math.round(img.naturalHeight * scale));
  const ctx = canvas.getContext('2d'); if (!ctx) throw new Error('This device cannot resize the image');
  const type = kind === 'logo' && file.type === 'image/png' ? 'image/png' : 'image/jpeg';
  if (type === 'image/jpeg') { ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, canvas.width, canvas.height); }
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, type, 0.85));
  if (!blob) throw new Error('This image could not be read. Try a JPEG or PNG.');
  return { blob, type };
}

export async function uploadImage(venue: string, kind: 'photo' | 'logo', file: File): Promise<Uploaded> {
  if (!(kind === 'logo' ? LOGO_TYPES : PHOTO_TYPES).test(file.type)) throw new Error(kind === 'logo' ? 'Choose a JPEG, PNG, WebP or SVG file' : 'Choose a JPEG, PNG or WebP photo');
  const { blob, type } = await prepareImage(file, kind);
  let r: Response;
  try { r = await fetch(`/api/admin/upload?venue=${encodeURIComponent(venue)}&kind=${kind}`, { method: 'POST', headers: { 'content-type': type }, body: blob, credentials: 'same-origin' }); }
  catch { throw new Error('No connection. Check the Wi-Fi and try again.'); }
  const j = (await r.json().catch(() => null)) as (Uploaded & { ok: boolean; error?: string }) | null;
  if (!r.ok || !j?.ok) throw new Error(j?.error || (r.status === 413 ? 'The file is too large (over 8 MB)' : `Upload failed (${r.status})`));
  return j;
}
