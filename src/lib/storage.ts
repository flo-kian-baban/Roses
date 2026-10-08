// Uploaded files (item photos, venue logos) behind one small interface. The only driver today writes to local disk
// (UPLOAD_DIR, default ./uploads, gitignored) and the files are served by /uploads/<key> (src/pages/api/uploads).
// Supabase Storage comes later behind the same interface, chosen by STORAGE_DRIVER; nothing else changes.
import fs from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';

export type Stored = { key: string; url: string };
export type Storage = {
  put(key: string, body: Buffer, contentType: string): Promise<Stored>;
  get(key: string): Promise<{ body: Buffer; contentType: string } | null>;
  remove(key: string): Promise<void>;
};
export const EXT_TYPES: Record<string, string> = { jpg: 'image/jpeg', png: 'image/png', webp: 'image/webp', svg: 'image/svg+xml' };
// <venue>/<kind>-<uuid>.<ext>: generated here, never from user input, so a key can be trusted as a path.
export const KEY_RE = /^[a-z0-9-]+\/(photo|logo)-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(jpg|png|webp|svg)$/;
export const newKey = (venue: string, kind: 'photo' | 'logo', ext: keyof typeof EXT_TYPES) => `${venue}/${kind}-${randomUUID()}.${ext}`;
export const urlOf = (key: string) => `/uploads/${key}`;

function localDisk(): Storage {
  const dir = path.resolve(/*turbopackIgnore: true*/ process.env.UPLOAD_DIR || 'uploads'); // the files live outside the build on purpose
  return {
    async put(key, body) {
      if (!KEY_RE.test(key)) throw new Error('bad storage key');
      await fs.mkdir(/*turbopackIgnore: true*/ path.dirname(path.join(dir, key)), { recursive: true });
      await fs.writeFile(/*turbopackIgnore: true*/ path.join(dir, key), body);
      return { key, url: urlOf(key) };
    },
    async get(key) {
      if (!KEY_RE.test(key)) return null;
      try { return { body: await fs.readFile(/*turbopackIgnore: true*/ path.join(dir, key)), contentType: EXT_TYPES[key.slice(key.lastIndexOf('.') + 1)] }; } catch { return null; }
    },
    async remove(key) { if (KEY_RE.test(key)) await fs.rm(/*turbopackIgnore: true*/ path.join(dir, key), { force: true }); },
  };
}

const driver = process.env.STORAGE_DRIVER || 'local';
if (driver !== 'local') throw new Error(`STORAGE_DRIVER "${driver}" is not available: only "local" exists until the hosting decision`);
export const storage: Storage = localDisk();
