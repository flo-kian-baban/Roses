// Shared plumbing for the admin API routes (Pages Router API routes: they see the client socket for lockout
// counters and can regenerate the public page with res.revalidate).
//   route()     form posts (sign-in, sign-out, PINs, alerts): redirect back with ?error= or a success flag.
//   jsonRoute() the page editor (JSON in, JSON out): { ok: true, ... } or { ok: false, error } with 400/401/403.
import type { NextApiRequest, NextApiResponse } from 'next';
import { sessionFromRequest, type Session } from './auth';
import type { Bi, Photo } from '@/lib/types';

export type Body = Record<string, string>;
export type Ctx = { req: NextApiRequest; res: NextApiResponse; session: Session | null; body: Body; back: string };

export function route(opts: { anonymous?: boolean }, fn: (ctx: Ctx) => Promise<void>) {
  return async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method !== 'POST') { res.setHeader('Allow', 'POST'); res.status(405).json({ error: 'POST only' }); return; }
    const body: Body = {};
    for (const [k, v] of Object.entries((req.body ?? {}) as Record<string, unknown>)) body[k] = Array.isArray(v) ? v.join(',') : String(v ?? '');
    const back = safeBack(body._back) || '/admin';
    const session = await sessionFromRequest(req);
    if (!opts.anonymous && !session) { res.status(401).json({ error: 'not signed in' }); return; }
    try { await fn({ req, res, session, body, back }); }
    catch (e) { console.error('admin api error', e); redirect(res, back, { error: (e as Error).message || 'unexpected error' }); }
  };
}

export function redirect(res: NextApiResponse, url: string, params: Record<string, string | undefined> = {}): void {
  const u = new URL(url, 'http://local');
  for (const [k, v] of Object.entries(params)) { u.searchParams.delete(k); if (v !== undefined && v !== '') u.searchParams.set(k, v); }
  res.setHeader('Location', u.pathname + u.search + u.hash);
  res.status(303).end();
}
export function forbidden(res: NextApiResponse, why = 'not allowed'): void { res.status(403).json({ error: why }); }
function safeBack(s: string | undefined): string | null { return s && /^\/admin(\/[A-Za-z0-9\-_/]*)?(\?[^#\s]*)?$/.test(s) ? s : null; }

// Re-renders the venue's public page now (on-demand revalidation of the static page). Failure is logged, not fatal.
export async function revalidateVenue(res: NextApiResponse, venueId: string): Promise<boolean> {
  try { await res.revalidate(`/${venueId}`); return true; }
  catch (e) { console.error(`revalidate /${venueId} failed`, e); return false; }
}

export const text = (b: Body, k: string): string | null => { const v = (b[k] ?? '').trim(); return v === '' ? null : v; };
export const list = (b: Body, k: string): string[] => (b[k] ?? '').split(',').map((s) => s.trim()).filter(Boolean);

// ---- JSON routes (the page editor) ----
export class ApiError extends Error { status: number; constructor(status: number, message: string) { super(message); this.status = status; } }
export type JsonBody = Record<string, unknown>;
export type JsonCtx = { req: NextApiRequest; res: NextApiResponse; session: Session; body: JsonBody };

// POST by default; `get: true` also answers GET with the query string as the body (the Style tab loads its options that way).
export function jsonRoute(fn: (ctx: JsonCtx) => Promise<Record<string, unknown> | void>, opts: { get?: boolean } = {}) {
  const allow = opts.get ? 'GET, POST' : 'POST';
  return async function handler(req: NextApiRequest, res: NextApiResponse) {
    res.setHeader('Cache-Control', 'no-store');
    if (req.method !== 'POST' && !(opts.get && req.method === 'GET')) { res.setHeader('Allow', allow); res.status(405).json({ ok: false, error: `${allow} only` }); return; }
    const session = await sessionFromRequest(req);
    if (!session) { res.status(401).json({ ok: false, error: 'not signed in' }); return; }
    const body = (req.method === 'GET' ? { ...req.query } : req.body && typeof req.body === 'object' && !Array.isArray(req.body) ? req.body : {}) as JsonBody;
    try { const out = await fn({ req, res, session, body }); res.status(200).json({ ok: true, ...(out ?? {}) }); }
    catch (e) {
      const status = e instanceof ApiError ? e.status : 400;
      if (!(e instanceof ApiError)) console.error('admin api error', e);
      res.status(status).json({ ok: false, error: (e as Error).message || 'unexpected error' });
    }
  };
}

// Readers for JSON bodies: each returns null for "not given" so a patch only carries the fields that were sent.
export const str = (v: unknown): string | null => (typeof v === 'string' && v.trim() !== '' ? v.trim() : null);
export const idOf = (v: unknown): string => { const s = str(v); if (!s || !/^[0-9a-f-]{36}$/i.test(s)) throw new ApiError(400, 'missing or invalid id'); return s; };
export const biOf = (v: unknown): Bi => { const o = (v && typeof v === 'object' ? v : {}) as Record<string, unknown>; return { en: str(o.en), fa: str(o.fa) }; };
export const moneyOf = (v: unknown): number | null => {
  if (v == null || v === '') return null;
  const n = typeof v === 'number' ? v : Number(String(v).trim().replace(/^\$/, ''));
  if (!Number.isFinite(n) || n < 0 || n > 999999) throw new ApiError(400, `"${v}" is not a price`);
  return Math.round(n * 100) / 100;
};
export const boolOf = (v: unknown): boolean => v === true || v === 1 || v === '1' || v === 'on' || v === 'true';
// A photo: a linked web address (imported data) or an uploaded file (/uploads/<key>, with its storage key and size).
export const photoOf = (v: unknown, alt: Bi): Photo | null => {
  const o = (v && typeof v === 'object' ? v : { url: v }) as Record<string, unknown>;
  const u = str(o.url); if (!u) return null;
  if (!/^https?:\/\/\S+$/i.test(u) && !u.startsWith('/')) throw new ApiError(400, 'the photo must be a web address (https://…) or an uploaded file');
  const dim = (x: unknown) => (typeof x === 'number' && Number.isFinite(x) && x > 0 ? Math.round(x) : null);
  const out: Photo = { url: u, alt: o.alt && typeof o.alt === 'object' ? biOf(o.alt) : alt };
  if (str(o.key)) out.key = str(o.key);
  if (dim(o.width)) out.width = dim(o.width);
  if (dim(o.height)) out.height = dim(o.height);
  return out;
};
