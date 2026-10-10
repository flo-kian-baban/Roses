// The admin frame (Kian's admin rebuild, 2026-10-07): one top bar with the venue dropdown, Team (owner and admin)
// and the account menu. Plain links and native <details> dropdowns; the page editor below it is a client component.
import type { Session } from '@/lib/admin/auth';
import { canManage } from '@/lib/admin/auth';
import type { Venue } from '@/lib/types';
import { Icon } from './icons';
import { Avatar, LogoTile, roleLabel } from './index';

export function TopBar({ session, venues, venue, active, children }: { session: Session; venues: Venue[]; venue?: Venue | null; active?: 'venue' | 'team'; children: React.ReactNode }) {
  const manage = canManage(session);
  return (
    <div className="min-h-screen">
      <header className="glass sticky top-0 z-40 flex h-14 items-center gap-2 border-b border-line px-3 sm:px-4">
        <details className="relative min-w-0">
          <summary className="flex min-h-11 min-w-0 items-center gap-2 rounded-full py-1 pl-1 pr-2.5 hover:bg-fill" aria-label="Switch venue">
            {venue ? <LogoTile venue={venue} className="h-8 w-11" pad="p-1" /> : <span className="flex h-8 w-11 items-center justify-center rounded-xl border border-dashed border-neutral-300 text-ink-muted"><Icon name="store" className="h-4 w-4" /></span>}
            <span className="truncate text-[15px] font-semibold">{venue ? venue.name.en : 'Venues'}</span>
            <Icon name="down" className="h-4 w-4 shrink-0 text-ink-muted" />
          </summary>
          <div className="absolute left-0 top-full z-50 mt-2 w-72 overflow-hidden rounded-2xl border border-black/5 bg-white p-1.5 shadow-pop">
            {venues.map((x) => (
              <a key={x.id} href={`/admin/${x.id}`} className={`flex items-center gap-2.5 rounded-xl px-2 py-2 hover:bg-neutral-50 ${x.id === venue?.id ? 'bg-accent-soft' : ''}`}>
                <LogoTile venue={x} className="h-9 w-12" pad="p-1" /><span className="min-w-0 flex-1 truncate text-[15px] font-medium">{x.name.en}</span>{x.id === venue?.id && <Icon name="check" className="h-4 w-4 text-accent" />}
              </a>
            ))}
            {venues.length === 0 && <p className="px-3 py-2 text-sm text-ink-muted">No venue on this PIN.</p>}
            {manage && <a href="/admin/new" className="mt-1 flex items-center gap-2.5 rounded-xl border-t border-line px-2 py-2.5 text-[15px] font-medium text-accent-strong hover:bg-neutral-50"><span className="flex h-9 w-12 items-center justify-center rounded-xl border border-dashed border-neutral-300"><Icon name="plus" className="h-4 w-4" /></span>Add venue</a>}
          </div>
        </details>
        <div className="flex-1" />
        {manage && <a href="/admin/team" className={`flex h-11 items-center gap-1.5 rounded-full px-3 text-sm font-medium ${active === 'team' ? 'bg-ink text-white' : 'text-ink hover:bg-fill'}`}><Icon name="user" className="h-4 w-4" />Team</a>}
        <details className="relative">
          <summary className="flex min-h-11 items-center gap-1 rounded-full border border-line bg-white py-0.5 pl-1 pr-2 shadow-[0_1px_2px_rgba(0,0,0,.04)]" aria-label="Account"><Avatar name={session.name} className="h-8 w-8 text-xs" /><Icon name="down" className="h-4 w-4 text-ink-muted" /></summary>
          <div className="absolute right-0 top-full z-50 mt-2 w-64 overflow-hidden rounded-[20px] border border-black/5 bg-white shadow-pop">
            <div className="border-b border-line px-4 py-3"><p className="truncate font-semibold">{session.name}</p><p className="text-xs text-ink-muted">{roleLabel(session)}</p></div>
            {venue && <a href={`/${venue.id}`} target="_blank" rel="noreferrer" className="flex min-h-11 items-center gap-2.5 px-4 py-2.5 text-[15px] hover:bg-neutral-50"><Icon name="external" className="h-5 w-5 text-ink-muted" />Customers&rsquo; page</a>}
            <form method="post" action="/api/admin/logout" className="border-t border-line p-2"><button type="submit" className="flex min-h-11 w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-left text-[15px] font-medium hover:bg-neutral-100"><Icon name="logout" className="h-5 w-5 text-ink-muted" />Sign out</button></form>
          </div>
        </details>
      </header>
      {children}
    </div>
  );
}
