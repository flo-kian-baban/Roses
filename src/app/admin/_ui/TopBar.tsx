// The admin frame (Kian's admin rebuild, 2026-10-07): one top bar with the venue dropdown, Team (owner and admin) and the account menu.
// Plain links and native <details> dropdowns; the page editor below it is a client component. In the admin's look (./look.ts; the
// admin-wide clean-up, 2026-11-06): the menus are cards with rows, the chosen venue and the open page in the accent. On a phone Team is
// its icon (named for screen readers) and, below 400 px, the venue's logo tile is left out, so the venue's name is never cut short.
import type { Session } from '@/lib/admin/auth';
import { canManage, isAdmin } from '@/lib/admin/auth';
import type { Venue } from '@/lib/types';
import { Icon } from './icons';
import { Avatar, LogoTile, roleLabel } from './index';
import { popover, popoverItem } from './look';

export function TopBar({ session, venues, venue, active, children }: { session: Session; venues: Venue[]; venue?: Venue | null; active?: 'venue' | 'team'; children: React.ReactNode }) {
  const manage = canManage(session);
  return (
    <div className="min-h-screen">
      <header className="glass sticky top-0 z-40 flex h-14 items-center gap-2 border-b border-line px-3 sm:px-4">
        <details className="relative min-w-0">
          <summary className="flex min-h-11 min-w-0 items-center gap-2 rounded-xl py-1 pl-1 pr-2 hover:bg-fill" aria-label="Switch venue">
            {venue ? <LogoTile venue={venue} className="h-8 w-11 max-[400px]:hidden" pad="p-1" /> : <span className="flex h-8 w-11 items-center justify-center rounded-xl bg-fill text-ink-muted max-[400px]:hidden"><Icon name="store" className="h-4 w-4" /></span>}
            <span className="min-w-0 text-base font-semibold leading-5 [overflow-wrap:anywhere]">{venue ? venue.name.en : 'Venues'}</span>
            <Icon name="down" className="h-4 w-4 shrink-0 text-ink-muted" />
          </summary>
          <div className={`absolute left-0 top-full z-50 mt-2 w-72 ${popover}`}>
            {venues.map((x) => (
              <a key={x.id} href={`/admin/${x.id}`} className={`${popoverItem} py-1.5 ${x.id === venue?.id ? 'bg-accent-soft font-semibold text-accent-ink' : ''}`}>
                <LogoTile venue={x} className="h-9 w-12" pad="p-1" /><span className="min-w-0 flex-1 [overflow-wrap:anywhere]">{x.name.en}</span>{x.id === venue?.id && <Icon name="check" className="h-4 w-4" />}
              </a>
            ))}
            {venues.length === 0 && <p className="px-3 py-2 text-[13px] text-ink-muted">No venue on this PIN.</p>}
            {isAdmin(session) && <a href="/admin/new" className={`${popoverItem} mt-1 py-1.5 font-semibold text-accent-ink`}><span className="flex h-9 w-12 items-center justify-center rounded-xl bg-fill"><Icon name="plus" className="h-4 w-4" /></span>Add venue</a>}
          </div>
        </details>
        <div className="flex-1" />
        {manage && <a href="/admin/team" aria-label="Team" className={`flex h-11 min-w-11 items-center justify-center gap-1.5 rounded-xl px-3 text-base font-semibold ${active === 'team' ? 'bg-accent-soft text-accent-ink' : 'text-ink hover:bg-fill'}`}><Icon name="user" className="h-5 w-5" /><span className="hidden sm:inline">Team</span></a>}
        <details className="relative">
          <summary className="flex min-h-11 items-center gap-1 rounded-xl py-0.5 pl-1 pr-2 hover:bg-fill" aria-label="Account"><Avatar name={session.name} className="h-8 w-8" /><Icon name="down" className="h-4 w-4 text-ink-muted" /></summary>
          <div className={`absolute right-0 top-full z-50 mt-2 w-64 ${popover}`}>
            <div className="px-3 py-2"><p className="text-base font-semibold [overflow-wrap:anywhere]">{session.name}</p><p className="text-[13px] text-ink-muted">{roleLabel(session)}</p></div>
            {venue && <a href={`/${venue.id}`} target="_blank" rel="noreferrer" className={popoverItem}><Icon name="external" className="h-5 w-5 text-ink-muted" />Customers&rsquo; page</a>}
            <form method="post" action="/api/admin/logout"><button type="submit" className={popoverItem}><Icon name="logout" className="h-5 w-5 text-ink-muted" />Sign out</button></form>
          </div>
        </details>
      </header>
      {children}
    </div>
  );
}
