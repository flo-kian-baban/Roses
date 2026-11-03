// Shared plumbing for the admin API routes (Pages Router API routes: they see the client socket for lockout
// counters and can regenerate the public page with res.revalidate).
//   route()     form posts (sign-in, sign-out, PINs, alerts): redirect back with ?error=<code> (src/lib/admin/messages.ts) or a success flag.
//   jsonRoute() the page editor (JSON in, JSON out): { ok: true, ... } or { ok: false, error } with 400/401/403/409, 500 for a server fault.
import type { IncomingMessage } from 'node:http';
import type { NextApiRequest, NextApiResponse } from 'next';
import { sessionFromRequest, type Session } from './auth';
import { liveSession } from './pins';
import type { Bi, Photo } from '@/lib/types';
import { PHOTO_HOSTS, cleanText, lengthOf, parsePrice } from '@/lib/rules';

export type Body = Record<string, string>;
export type Ctx = { req: NextApiRequest; res: NextApiResponse; session: Session | null; body: Body; back: string };

// Pre-go-live audit (2026-11-02, S1-08): a POST from another site is refused, whatever the cookie's SameSite (a page on a sibling
// subdomain counts as the same site for the cookie). Browsers say where a request comes from: Sec-Fetch-Site, and Origin on every POST.
// A request with neither is not from a browser (curl, the suite's drills), so no page can have forged it.
export function crossSite(req: IncomingMessage): string | null {
  const site = String(req.headers['sec-fetch-site'] ?? '').toLowerCase();
  if (site) return site === 'same-origin' || site === 'none' ? null : `Sec-Fetch-Site ${site}`;
  const origin = req.headers.origin;
  if (!origin) return null;
  let host = '';
  try { host = new URL(origin).host; } catch { return `Origin ${origin}`; }
  const own = [req.headers.host, req.headers['x-forwarded-host']].flatMap((h) => String(h ?? '').split(',')).map((h) => h.trim()).filter(Boolean);
  return own.includes(host) ? null : `Origin ${origin}`;
}
export function refuseCrossSite(req: IncomingMessage, res: NextApiResponse): boolean {
  const why = crossSite(req); if (!why) return false;
  console.warn(`admin api: refused a cross-site ${req.method} ${req.url} (${why})`);
  res.status(403).json({ ok: false, error: 'Refused: this request did not come from the admin itself' });
  return true;
}

// Test seams for the check suite only (pre-go-live audit H-06, H-13): with the suite's own flag ROSES_CHECK_SUITE=1 (never set in
// production, like ROSES_NOW), a request header x-roses-test: fault makes the route fail as a database fault would, and
// x-roses-test: unpublished reports the customers' page as not regenerated. Without the flag the header does nothing.
export const testing = (req: IncomingMessage | undefined, what: 'fault' | 'unpublished'): boolean =>
  process.env.ROSES_CHECK_SUITE === '1' && !!req && String(req.headers['x-roses-test'] ?? '') === what;

// A server fault answers 500 with one plain line (pre-go-live audit H-06: before, it answered 400 with the database's own text, which
// reached the staff toast); the details go to the server log.
export const SERVER_FAULT = 'Something went wrong on the server. Try again.';

export function route(opts: { anonymous?: boolean }, fn: (ctx: Ctx) => Promise<void>) {
  return async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method !== 'POST') { res.setHeader('Allow', 'POST'); res.status(405).json({ error: 'POST only' }); return; }
    if (refuseCrossSite(req, res)) return;
    const body: Body = {};
    const raw = req.body && typeof req.body === 'object' ? (req.body as Record<string, unknown>) : {};
    for (const [k, v] of Object.entries(raw)) body[k] = Array.isArray(v) ? v.join(',') : String(v ?? '');
    const back = safeBack(body._back) || '/admin';
    const session = await liveSession(await sessionFromRequest(req));
    if (!opts.anonymous && !session) { res.status(401).json({ error: 'not signed in' }); return; }
    try { await fn({ req, res, session, body, back }); }
    catch (e) { console.error('admin api error', e); redirect(res, back, { error: 'server' }); }
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

// Re-renders the venue's public page now (on-demand revalidation of the static page). A failure is logged and reported: the JSON answer
// then carries published: false and the editor says the customers' page did not update, with Try again (pre-go-live audit H-13; before,
// it said "Saved" and customers kept the old menu for up to an hour).
const unpublished = new WeakMap<object, Set<string>>();
export async function revalidateVenue(res: NextApiResponse, venueId: string): Promise<boolean> {
  const req = (res as unknown as { req?: IncomingMessage }).req;
  try {
    if (testing(req, 'unpublished')) throw new Error('not regenerated (the check suite\'s test seam)');
    await res.revalidate(`/${venueId}`);
    unpublished.get(res)?.delete(venueId);
    return true;
  } catch (e) {
    console.error(`revalidate /${venueId} failed`, e);
    const s = unpublished.get(res) ?? new Set<string>(); s.add(venueId); unpublished.set(res, s);
    return false;
  }
}

export const text = (b: Body, k: string): string | null => { const v = cleanText(b[k] ?? ''); return v === '' ? null : v; };
export const list = (b: Body, k: string): string[] => (b[k] ?? '').split(',').map((s) => s.trim()).filter(Boolean);

// ---- JSON routes (the page editor) ----
// `extra` travels with the refusal (the readability guard's suggested colour, for the one-tap fix in the Style tab).
export class ApiError extends Error { status: number; extra: Record<string, unknown>; constructor(status: number, message: string, extra: Record<string, unknown> = {}) { super(message); this.status = status; this.extra = extra; } }
export type JsonBody = Record<string, unknown>;
export type JsonCtx = { req: NextApiRequest; res: NextApiResponse; session: Session; body: JsonBody };
// A library's refusal as the route answers it: a server fault 500, someone else's newer change 409, anything else 400.
export const refusal = (r: { error: string; fault?: boolean; conflict?: boolean }, extra: Record<string, unknown> = {}): ApiError =>
  new ApiError(r.fault ? 500 : r.conflict ? 409 : 400, r.error, extra);

// POST by default; `get: true` also answers GET with the query string as the body (the Style tab loads its options that way).
// A POST must be JSON (pre-go-live audit S1-08: a form-encoded body could delete an item from a forged form) and from the admin itself.
export function jsonRoute(fn: (ctx: JsonCtx) => Promise<Record<string, unknown> | void>, opts: { get?: boolean } = {}) {
  const allow = opts.get ? 'GET, POST' : 'POST';
  return async function handler(req: NextApiRequest, res: NextApiResponse) {
    res.setHeader('Cache-Control', 'no-store');
    if (req.method !== 'POST' && !(opts.get && req.method === 'GET')) { res.setHeader('Allow', allow); res.status(405).json({ ok: false, error: `${allow} only` }); return; }
    if (req.method === 'POST') {
      if (refuseCrossSite(req, res)) return;
      const type = String(req.headers['content-type'] ?? '').split(';')[0].trim().toLowerCase();
      if (type !== 'application/json') { res.status(415).json({ ok: false, error: 'The admin API takes JSON only' }); return; }
    }
    const session = await liveSession(await sessionFromRequest(req));
    if (!session) { res.status(401).json({ ok: false, error: 'not signed in' }); return; }
    const body = (req.method === 'GET' ? { ...req.query } : req.body && typeof req.body === 'object' && !Array.isArray(req.body) ? req.body : {}) as JsonBody;
    try {
      if (testing(req, 'fault')) throw new Error('relation "items" does not exist (a simulated database fault: the check suite\'s test seam)');
      const out = await fn({ req, res, session, body });
      const missed = [...(unpublished.get(res) ?? [])];
      res.status(200).json({ ok: true, ...(out ?? {}), ...(missed.length ? { published: false, unpublished: missed } : {}) });
    } catch (e) {
      if (e instanceof ApiError) { if (e.status >= 500) console.error('admin api error', e); res.status(e.status).json({ ok: false, error: e.status >= 500 ? SERVER_FAULT : e.message, ...e.extra }); return; }
      console.error('admin api error', e);
      res.status(500).json({ ok: false, error: SERVER_FAULT });
    }
  };
}

// Readers for JSON bodies (pre-go-live audit S2-06: strict, 400 with the reason; before, a wrong type was coerced, sometimes destructively:
// section_ids "x" took an item out of every section, locations {} deleted every location). Each returns null for "not given or empty", so
// a patch only carries the fields that were sent. Text is cleaned and held to its limit (S2-02, S2-03, S2-14: src/lib/rules.ts).
export const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
export function textOf(v: unknown, what: string, max: number, opts: { lines?: boolean } = {}): string | null {
  if (v == null) return null;
  if (typeof v !== 'string') throw new ApiError(400, `${what}: expected text`);
  const t = cleanText(v, opts);
  if (lengthOf(t) > max) throw new ApiError(400, `${what} is too long: ${lengthOf(t)} characters (at most ${max})`);
  return t === '' ? null : t;
}
// Untyped short values (a venue id in a query string, a group's key): the string trimmed, or null.
export const str = (v: unknown): string | null => (typeof v === 'string' && v.trim() !== '' ? v.trim() : null);
export const idOf = (v: unknown): string => { const s = str(v); if (!s || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s)) throw new ApiError(400, 'missing or invalid id'); return s; };
export function biOf(v: unknown, what = 'text', max = 500, opts: { lines?: boolean } = {}): Bi {
  if (v == null) return { en: null, fa: null };
  if (!isObj(v)) throw new ApiError(400, `${what}: expected { en, fa }`);
  return { en: textOf(v.en, what, max, opts), fa: textOf(v.fa, `${what} (Persian)`, max, opts) };
}
export const moneyOf = (v: unknown, what = 'price'): number | null => {
  if (v === '') return null;
  const p = parsePrice(v);
  if (p === 'bad') throw new ApiError(400, `"${String(v)}" is not a ${what} (digits, up to two decimals)`);
  return p;
};
export const boolOf = (v: unknown, what = 'value'): boolean => { if (typeof v !== 'boolean') throw new ApiError(400, `${what}: expected true or false`); return v; };
export const arrOf = (v: unknown, what: string, max: number): Record<string, unknown>[] => {
  if (!Array.isArray(v)) throw new ApiError(400, `${what}: expected a list`);
  if (v.length > max) throw new ApiError(400, `${what}: at most ${max}`);
  if (!v.every(isObj)) throw new ApiError(400, `${what}: every entry must be an object`);
  return v as Record<string, unknown>[];
};
export const idsOf = (v: unknown, what: string): string[] => { if (!Array.isArray(v)) throw new ApiError(400, `${what}: expected a list of ids`); return v.map(idOf); };

// A photo (pre-go-live audit S2-04): a file uploaded here (/uploads/<key>) or, as imported, a linked photo on one of the three hosts the
// menus came from. A new address anywhere else is refused (before: //host, /\host and any https address passed); the photo an item
// already has is kept as it is (`current`).
const UPLOAD_URL = /^\/uploads\/[a-z0-9-]+\/(photo|logo)-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(jpg|png|webp|svg)$/;
export function photoUrlOk(u: string, kind: 'photo' | 'logo'): boolean {
  if (UPLOAD_URL.test(u)) return true;
  if (kind === 'logo') return /^\/brand\/[a-z0-9-]+\.(png|svg|jpg|webp)$/.test(u);
  let url: URL; try { url = new URL(u); } catch { return false; }
  return url.protocol === 'https:' && PHOTO_HOSTS.includes(url.hostname) && !url.username && !url.password && !url.port;
}
export const photoOf = (v: unknown, alt: Bi, current: string | null = null): Photo | null => {
  if (v == null || v === '') return null;
  const o = typeof v === 'string' ? { url: v } : isObj(v) ? v : null;
  if (!o) throw new ApiError(400, 'photo: expected { url }');
  const u = str(o.url); if (!u) return null;
  if (u !== current && !photoUrlOk(u, 'photo')) throw new ApiError(400, 'The photo must be uploaded here (or be one of the menu\'s own linked photos)');
  const dim = (x: unknown) => (typeof x === 'number' && Number.isInteger(x) && x > 0 && x <= 10000 ? x : null);
  const out: Photo = { url: u, alt: o.alt != null ? biOf(o.alt, 'photo description', 160) : alt };
  const key = str(o.key); if (key && UPLOAD_URL.test(`/uploads/${key}`)) out.key = key;
  if (dim(o.width)) out.width = dim(o.width);
  if (dim(o.height)) out.height = dim(o.height);
  return out;
};
