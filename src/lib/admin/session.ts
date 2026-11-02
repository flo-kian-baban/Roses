// Session access for App Router pages (server components). The cookie is read, never written, here.
import { cookies } from 'next/headers';
import { COOKIE, readSessionToken, type Session } from './auth';
import { liveSession } from './pins';

export async function getSession(): Promise<Session | null> {
  const jar = await cookies();
  return liveSession(await readSessionToken(jar.get(COOKIE)?.value)); // checked against the database on every page (S1-03)
}
