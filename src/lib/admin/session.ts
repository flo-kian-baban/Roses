// Session access for App Router pages (server components). The cookie is read, never written, here.
import { cookies } from 'next/headers';
import { COOKIE, readSessionToken, type Session } from './auth';

export async function getSession(): Promise<Session | null> {
  const jar = await cookies();
  return readSessionToken(jar.get(COOKIE)?.value);
}
