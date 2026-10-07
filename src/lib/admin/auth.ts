// Admin authentication: scrypt hashes (Node built-in, no native dependency) for passwords and PINs,
// signed HttpOnly cookie sessions (jose, HS256). Standard Node only; nothing vendor-specific.
import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';
import { SignJWT, jwtVerify } from 'jose';
import type { IncomingMessage } from 'node:http';

export const COOKIE = 'roses_session';
const SESSION_HOURS = 12;
const SCRYPT = { N: 16384, r: 8, p: 1, keylen: 32 };

export type Session = { kind: 'admin' | 'pin'; id: string; name: string; role: 'admin' | 'owner' | 'staff'; venues: string[] | 'all' };

export function hashSecret(secret: string): string {
  const salt = randomBytes(16);
  const hash = scryptSync(secret.normalize('NFKC'), salt, SCRYPT.keylen, { N: SCRYPT.N, r: SCRYPT.r, p: SCRYPT.p });
  return `$scrypt$N=${SCRYPT.N},r=${SCRYPT.r},p=${SCRYPT.p}$${salt.toString('base64')}$${hash.toString('base64')}`;
}

export function verifySecret(secret: string, stored: string): boolean {
  const m = stored.match(/^\$scrypt\$N=(\d+),r=(\d+),p=(\d+)\$([^$]+)\$([^$]+)$/);
  if (!m) return false;
  const expected = Buffer.from(m[5], 'base64');
  const hash = scryptSync(secret.normalize('NFKC'), Buffer.from(m[4], 'base64'), expected.length, { N: Number(m[1]), r: Number(m[2]), p: Number(m[3]) });
  return hash.length === expected.length && timingSafeEqual(hash, expected);
}

function secretKey(): Uint8Array {
  const s = process.env.SESSION_SECRET;
  if (!s || s.length < 32) throw new Error('SESSION_SECRET missing or shorter than 32 characters (see .env.example)');
  return new TextEncoder().encode(s);
}

export async function createSessionToken(session: Session): Promise<string> {
  return new SignJWT({ ...session }).setProtectedHeader({ alg: 'HS256' }).setIssuedAt().setExpirationTime(`${SESSION_HOURS}h`).sign(secretKey());
}

export async function readSessionToken(token: string | undefined | null): Promise<Session | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secretKey(), { algorithms: ['HS256'] });
    const p = payload as unknown as Session;
    if (!p.kind || !p.id) return null;
    return { kind: p.kind, id: p.id, name: p.name, role: p.role, venues: p.venues };
  } catch { return null; }
}

export function parseCookies(header: string | undefined): Record<string, string> {
  const out: Record<string, string> = {};
  for (const part of (header || '').split(';')) { const i = part.indexOf('='); if (i > 0) out[part.slice(0, i).trim()] = decodeURIComponent(part.slice(i + 1).trim()); }
  return out;
}

export async function sessionFromRequest(req: IncomingMessage): Promise<Session | null> {
  return readSessionToken(parseCookies(req.headers.cookie)[COOKIE]);
}

// Secure is set when the request arrived over https (directly or behind a proxy that says so), or when COOKIE_SECURE=1.
export function cookieHeader(token: string | null, req: IncomingMessage): string {
  const proto = String(req.headers['x-forwarded-proto'] || '').split(',')[0].trim();
  const secure = proto === 'https' || process.env.COOKIE_SECURE === '1' || !!(req.socket as { encrypted?: boolean }).encrypted;
  const attrs = [`${COOKIE}=${token ? encodeURIComponent(token) : ''}`, 'Path=/', 'HttpOnly', 'SameSite=Lax', token ? `Max-Age=${SESSION_HOURS * 3600}` : 'Max-Age=0'];
  if (secure) attrs.push('Secure');
  return attrs.join('; ');
}

export function canEditVenue(s: Session | null, venueId: string): boolean {
  if (!s) return false;
  return s.venues === 'all' || s.venues.includes(venueId);
}
export function canEditNotes(s: Session | null): boolean { return !!s && (s.role === 'admin' || s.role === 'owner'); }
export function isAdmin(s: Session | null): boolean { return !!s && s.kind === 'admin'; }
