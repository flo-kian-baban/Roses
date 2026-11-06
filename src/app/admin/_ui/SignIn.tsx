// Sign-in, rendered in place of a protected page when there is no session. On /admin/<venue> the venue is
// preselected (one link per venue to bookmark); the venue picker shows only on /admin. The hidden or chosen venue
// goes with the PIN, so a wrong PIN counts against that venue + client address exactly as before.
// In the admin's look (./look.ts; the admin-wide clean-up, 2026-11-06): the page title, the venues as rows of one card, the PIN in a
// filled field in the page title's size, one filled button.
import type { Venue } from '@/lib/types';
import { CheckCard, LogoTile, Notice, checkList, input, one, primary, type SP } from './index';
import { Icon } from './icons';
import { card, headingCls, headingStyle, pageTitle, textBtn } from './look';

export function SignIn({ venues, venue, sp, path }: { venues: Venue[]; venue?: Venue | null; sp: SP; path: string }) {
  const adminMode = one(sp, 'mode') === 'admin';
  return (
    <main className="flex min-h-screen flex-col items-center justify-center px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex flex-col items-center text-center">
          {venue ? <LogoTile venue={venue} className="mb-4 h-24 w-44" pad="p-3" /> : <span className="mb-4 flex h-14 w-14 items-center justify-center rounded-xl bg-accent-ink text-canvas"><Icon name="utensils" className="h-7 w-7" /></span>}
          <h1 className={pageTitle}>{venue ? venue.name.en : 'Roses menu admin'}</h1>
          <p className="mt-1 text-base text-ink-muted">{adminMode ? 'Sign in with your email and password.' : venue ? 'Enter your PIN to edit this menu.' : 'Choose your venue and enter your PIN.'}</p>
        </div>
        <Notice sp={sp} />
        {one(sp, 'signedout') && <p role="status" className={`${card} mb-5 px-4 py-3 text-center text-base`}>You are signed out.</p>}

        {!adminMode && (
          <form method="post" action="/api/admin/login">
            <input type="hidden" name="mode" value="pin" />
            <input type="hidden" name="_back" value={path} />
            {venue ? (
              <input type="hidden" name="venue" value={venue.id} />
            ) : (
              <fieldset className="mb-6">
                <legend className={`${headingCls} px-3 pb-1.5`} style={headingStyle}>Venue</legend>
                <div className={`${checkList} divide-y divide-line`}>
                  {venues.map((v, n) => (
                    <CheckCard key={v.id} type="radio" name="venue" value={v.id} defaultChecked={n === 0}>
                      <span className="flex items-center gap-3"><LogoTile venue={v} className="h-9 w-14" pad="p-1" /><span className="font-semibold">{v.name.en}</span></span>
                    </CheckCard>
                  ))}
                </div>
              </fieldset>
            )}
            <label className="block">
              <span className={`${headingCls} block px-3 pb-1.5`} style={headingStyle}>PIN</span>
              <span className={`${card} block p-3`}>
                <input className={`${input} mt-0 py-3 text-center text-[28px] font-semibold tracking-[.5em] tabular-nums`} name="pin" type="password" inputMode="numeric" pattern="[0-9\u06F0-\u06F9\u0660-\u0669]{4,12}" maxLength={12} autoComplete="one-time-code" placeholder="••••" required autoFocus />
              </span>
            </label>
            <button className={`${primary} mt-5 w-full`} type="submit">Sign in</button>
          </form>
        )}

        {adminMode && (
          <form method="post" action="/api/admin/login">
            <input type="hidden" name="mode" value="admin" />
            <input type="hidden" name="_back" value={path} />
            <div className={`${card} space-y-4 p-4`}>
              <label className="block"><span className="text-[13px] text-ink-muted">Email</span><input className={input} name="email" type="email" autoComplete="username" required autoFocus /></label>
              <label className="block"><span className="text-[13px] text-ink-muted">Password</span><input className={input} name="password" type="password" autoComplete="current-password" required /></label>
            </div>
            <button className={`${primary} mt-5 w-full`} type="submit">Sign in</button>
          </form>
        )}

        <div className="mt-4 flex flex-col items-center gap-0">
          {adminMode ? <a className={textBtn} href={path}>Sign in with a PIN instead</a> : <a className={textBtn} href={`${path}?mode=admin`}>Admin with email and password instead</a>}
          {venue && !adminMode && <a className={textBtn} href="/admin">Other venue</a>}
        </div>
      </div>
    </main>
  );
}
