// Shared plumbing for the admin API routes (Pages Router API routes: they see the client socket for lockout
// counters and can regenerate the public page with res.revalidate). Forms post here and are redirected back.
import type { NextApiRequest, NextApiResponse } from 'next';
import { sessionFromRequest, type Session } from './auth';

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
export const bi = (b: Body, k: string) => ({ en: text(b, `${k}_en`), fa: text(b, `${k}_fa`) });
export const money = (b: Body, k: string): number | null => { const v = (b[k] ?? '').trim().replace(/^\$/, ''); if (v === '') return null; const n = Number(v); if (!Number.isFinite(n) || n < 0 || n > 999999) throw new Error(`"${b[k]}" is not a price`); return Math.round(n * 100) / 100; };
export const flag = (b: Body, k: string): boolean => ['1', 'on', 'true', 'yes'].includes((b[k] ?? '').toLowerCase());
export const list = (b: Body, k: string): string[] => (b[k] ?? '').split(',').map((s) => s.trim()).filter(Boolean);

// Indexed rows from a form: fields named `${prefix}${i}_${field}` for i = 0, 1, …; a row counts when any field is filled.
export function rows(b: Body, prefix: string, fields: string[], max = 60): Body[] {
  const out: Body[] = [];
  for (let i = 0; i < max; i++) {
    const row: Body = {}; let any = false;
    for (const f of fields) { const v = (b[`${prefix}${i}_${f}`] ?? '').trim(); row[f] = v; if (v) any = true; }
    if (any) out.push(row);
  }
  return out;
}
