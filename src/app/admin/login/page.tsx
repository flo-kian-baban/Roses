import { redirect } from 'next/navigation';
import { getSession } from '@/lib/admin/session';
import { listVenueRows } from '@/lib/admin/venue';
import { Notice, input, primary } from '../_ui';

export const dynamic = 'force-dynamic';

export default async function Login({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  if (await getSession()) redirect('/admin');
  const venues = await listVenueRows();
  const one = (k: string) => (Array.isArray(sp[k]) ? sp[k]?.[0] : sp[k]) as string | undefined;
  const adminMode = one('mode') === 'admin';
  const chosen = one('venue') ?? venues[0]?.id;
  return (
    <main className="mx-auto max-w-md px-4 py-8">
      <h1 className="text-2xl font-semibold">Menu admin</h1>
      <p className="mt-1 text-sm text-neutral-600">Sign in with your PIN, or as the main admin.</p>
      <div className="mt-6"><Notice sp={sp} /></div>
      {one('signedout') && <p role="status" className="mb-4 rounded-lg border border-neutral-300 bg-white px-4 py-3">Signed out.</p>}

      {!adminMode && (
        <form method="post" action="/api/admin/login" className="rounded-xl border border-neutral-200 bg-white p-4">
          <input type="hidden" name="mode" value="pin" />
          <fieldset>
            <legend className="text-sm font-medium">Venue</legend>
            <div className="mt-2 grid gap-2">
              {venues.map((v) => (
                <label key={v.id} className="flex min-h-11 items-center gap-3 rounded-lg border border-neutral-300 px-3">
                  <input type="radio" name="venue" value={v.id} defaultChecked={v.id === chosen} className="h-5 w-5" />
                  <span>{v.name.en}</span>
                </label>
              ))}
            </div>
          </fieldset>
          <label className="mt-4 block">
            <span className="text-sm font-medium">PIN (6 digits)</span>
            <input className={`${input} text-center text-2xl tracking-[.4em]`} name="pin" type="password" inputMode="numeric" pattern="[0-9]{6}" maxLength={6} autoComplete="one-time-code" required autoFocus />
          </label>
          <button className={`${primary} mt-4 w-full`} type="submit">Sign in</button>
        </form>
      )}

      {adminMode && (
        <form method="post" action="/api/admin/login" className="rounded-xl border border-neutral-200 bg-white p-4">
          <input type="hidden" name="mode" value="admin" />
          <label className="block"><span className="text-sm font-medium">Email</span><input className={input} name="email" type="email" autoComplete="username" required autoFocus /></label>
          <label className="mt-3 block"><span className="text-sm font-medium">Password</span><input className={input} name="password" type="password" autoComplete="current-password" required /></label>
          <button className={`${primary} mt-4 w-full`} type="submit">Sign in as admin</button>
        </form>
      )}
      <p className="mt-4 text-center text-sm">
        {adminMode ? <a className="underline" href="/admin/login">Sign in with a PIN instead</a> : <a className="underline" href="/admin/login?mode=admin">Main admin sign-in</a>}
      </p>
    </main>
  );
}
