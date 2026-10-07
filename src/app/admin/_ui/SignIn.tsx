// Sign-in form rendered in place of a protected page when there is no session. On /admin/<venue> the venue is
// preselected (one link per venue to bookmark); the venue picker shows only on /admin. The hidden or chosen venue
// goes with the PIN, so a wrong PIN counts against that venue + client address exactly as before.
import type { Venue } from '@/lib/types';
import { Notice, input, primary } from './index';

export function SignIn({ venues, venue, sp, path }: { venues: Venue[]; venue?: Venue | null; sp: Record<string, string | string[] | undefined>; path: string }) {
  const one = (k: string) => (Array.isArray(sp[k]) ? sp[k]?.[0] : sp[k]) as string | undefined;
  const adminMode = one('mode') === 'admin';
  return (
    <main className="mx-auto max-w-md px-4 py-8">
      <h1 className="text-2xl font-semibold">{venue ? `${venue.name.en}` : 'Menu admin'}</h1>
      <p className="mt-1 text-sm text-neutral-600">{venue ? 'Sign in with your PIN for this venue, or as the main admin.' : 'Sign in with your PIN, or as the main admin.'}</p>
      <div className="mt-6"><Notice sp={sp} /></div>
      {one('signedout') && <p role="status" className="mb-4 rounded-lg border border-neutral-300 bg-white px-4 py-3">Signed out.</p>}

      {!adminMode && (
        <form method="post" action="/api/admin/login" className="rounded-xl border border-neutral-200 bg-white p-4">
          <input type="hidden" name="mode" value="pin" />
          <input type="hidden" name="_back" value={path} />
          {venue ? (
            <input type="hidden" name="venue" value={venue.id} />
          ) : (
            <fieldset>
              <legend className="text-sm font-medium">Venue</legend>
              <div className="mt-2 grid gap-2">
                {venues.map((v, n) => (
                  <label key={v.id} className="flex min-h-11 items-center gap-3 rounded-lg border border-neutral-300 px-3">
                    <input type="radio" name="venue" value={v.id} defaultChecked={n === 0} className="h-5 w-5" />
                    <span>{v.name.en}</span>
                  </label>
                ))}
              </div>
            </fieldset>
          )}
          <label className={`${venue ? '' : 'mt-4 '}block`}>
            <span className="text-sm font-medium">PIN (6 digits)</span>
            <input className={`${input} text-center text-2xl tracking-[.4em]`} name="pin" type="password" inputMode="numeric" pattern="[0-9]{6}" maxLength={6} autoComplete="one-time-code" required autoFocus />
          </label>
          <button className={`${primary} mt-4 w-full`} type="submit">Sign in</button>
        </form>
      )}

      {adminMode && (
        <form method="post" action="/api/admin/login" className="rounded-xl border border-neutral-200 bg-white p-4">
          <input type="hidden" name="mode" value="admin" />
          <input type="hidden" name="_back" value={path} />
          <label className="block"><span className="text-sm font-medium">Email</span><input className={input} name="email" type="email" autoComplete="username" required autoFocus /></label>
          <label className="mt-3 block"><span className="text-sm font-medium">Password</span><input className={input} name="password" type="password" autoComplete="current-password" required /></label>
          <button className={`${primary} mt-4 w-full`} type="submit">Sign in as admin</button>
        </form>
      )}
      <p className="mt-4 text-center text-sm">
        {adminMode ? <a className="underline" href={path}>Sign in with a PIN instead</a> : <a className="underline" href={`${path}?mode=admin`}>Main admin sign-in</a>}
      </p>
      {venue && !adminMode && <p className="mt-2 text-center text-sm"><a className="underline" href="/admin">Other venue</a></p>}
    </main>
  );
}
