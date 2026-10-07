import { redirect } from 'next/navigation';

// Old address kept as an alias: the sign-in form now lives on /admin (venue picker) and /admin/<venue> (venue preselected).
export const dynamic = 'force-dynamic';

export default async function LoginAlias({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const one = (k: string) => (Array.isArray(sp[k]) ? sp[k]?.[0] : sp[k]) as string | undefined;
  const venue = one('venue');
  const q = new URLSearchParams();
  for (const k of ['mode', 'error', 'signedout']) { const v = one(k); if (v) q.set(k, v); }
  const qs = q.toString();
  redirect(`/admin${venue && /^[a-z0-9-]+$/.test(venue) ? `/${venue}` : ''}${qs ? `?${qs}` : ''}`);
}
