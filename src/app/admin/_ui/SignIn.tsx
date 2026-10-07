// Sign-in, rendered in place of a protected page when there is no session. On /admin/<venue> the venue is
// preselected (one link per venue to bookmark); the venue picker shows only on /admin. The hidden or chosen venue
// goes with the PIN, so a wrong PIN counts against that venue + client address exactly as before.
import type { Venue } from '@/lib/types';
import { CheckCard, LogoTile, Notice, input, one, primary, type SP } from './index';
import { Icon } from './icons';

export function SignIn({ venues, venue, sp, path }: { venues: Venue[]; venue?: Venue | null; sp: SP; path: string }) {
  const adminMode = one(sp, 'mode') === 'admin';
  return (
    <main className="flex min-h-screen flex-col items-center justify-center px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex flex-col items-center text-center">
          {venue ? <LogoTile venue={venue} className="mb-4 h-24 w-44 shadow-sm" pad="p-3" /> : <span className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-accent text-white shadow-sm"><Icon name="utensils" className="h-7 w-7" /></span>}
          <h1 className="text-2xl font-semibold tracking-tight">{venue ? venue.name.en : 'Roses menu admin'}</h1>
          <p className="mt-1 text-[15px] text-ink-muted">{adminMode ? 'Sign in with your email and password.' : venue ? 'Enter your PIN to edit this menu.' : 'Choose your venue and enter your PIN.'}</p>
        </div>
        <Notice sp={sp} />
        {one(sp, 'signedout') && <p role="status" className="mb-5 rounded-2xl border border-line bg-white px-4 py-3 text-center text-[15px]">You are signed out.</p>}

        {!adminMode && (
          <form method="post" action="/api/admin/login" className="rounded-3xl border border-line bg-white p-5 shadow-[0_1px_2px_rgba(16,16,16,.04)]">
            <input type="hidden" name="mode" value="pin" />
            <input type="hidden" name="_back" value={path} />
            {venue ? (
              <input type="hidden" name="venue" value={venue.id} />
            ) : (
              <fieldset>
                <legend className="text-sm font-medium">Venue</legend>
                <div className="mt-2 grid gap-2">
                  {venues.map((v, n) => (
                    <CheckCard key={v.id} type="radio" name="venue" value={v.id} defaultChecked={n === 0} className="min-h-14">
                      <span className="flex items-center gap-3"><LogoTile venue={v} className="h-9 w-14" pad="p-1" /><span className="font-medium">{v.name.en}</span></span>
                    </CheckCard>
                  ))}
                </div>
              </fieldset>
            )}
            <label className={`${venue ? '' : 'mt-5 '}block`}>
              <span className="text-sm font-medium">PIN</span>
              <input className={`${input} py-3.5 text-center text-3xl font-semibold tracking-[.5em] tabular-nums`} name="pin" type="password" inputMode="numeric" pattern="[0-9]{4,6}" maxLength={6} autoComplete="one-time-code" placeholder="••••" required autoFocus />
            </label>
            <button className={`${primary} mt-5 w-full py-3 text-[17px]`} type="submit">Sign in</button>
          </form>
        )}

        {adminMode && (
          <form method="post" action="/api/admin/login" className="rounded-3xl border border-line bg-white p-5 shadow-[0_1px_2px_rgba(16,16,16,.04)]">
            <input type="hidden" name="mode" value="admin" />
            <input type="hidden" name="_back" value={path} />
            <label className="block"><span className="text-sm font-medium">Email</span><input className={input} name="email" type="email" autoComplete="username" required autoFocus /></label>
            <label className="mt-4 block"><span className="text-sm font-medium">Password</span><input className={input} name="password" type="password" autoComplete="current-password" required /></label>
            <button className={`${primary} mt-5 w-full py-3 text-[17px]`} type="submit">Sign in</button>
          </form>
        )}

        <div className="mt-5 flex flex-col items-center gap-2 text-sm text-ink-muted">
          {adminMode ? <a className="font-medium text-ink underline-offset-4 hover:underline" href={path}>Sign in with a PIN instead</a> : <a className="font-medium text-ink underline-offset-4 hover:underline" href={`${path}?mode=admin`}>Admin with email and password instead</a>}
          {venue && !adminMode && <a className="underline-offset-4 hover:underline" href="/admin">Other venue</a>}
        </div>
      </div>
    </main>
  );
}
