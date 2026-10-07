// The admin frame: a sidebar on laptops, a top bar + bottom tabs on phones. Plain links and one sign-out form;
// the only "interactive" parts are native <details> dropdowns, so it works without client JavaScript.
import type { Session } from '@/lib/admin/auth';
import { isAdmin } from '@/lib/admin/auth';
import type { Venue } from '@/lib/types';
import { Icon, type IconName } from './icons';
import { Avatar, LogoTile, roleLabel } from './index';

export type NavKey = 'home' | 'menu' | 'sections' | 'history' | 'details' | 'pins' | 'item' | 'section';
type Item = { key: NavKey; label: string; href: string; icon: IconName };

export function Shell({ session, venues, venue, active, children }: { session: Session; venues: Venue[]; venue?: Venue | null; active: NavKey; children: React.ReactNode }) {
  const admin = isAdmin(session);
  const v = venue?.id;
  const venueNav: Item[] = v ? [
    { key: 'menu', label: 'Menu', href: `/admin/${v}`, icon: 'utensils' },
    { key: 'sections', label: 'Sections', href: `/admin/${v}/sections`, icon: 'layers' },
    { key: 'history', label: 'History', href: `/admin/${v}/history`, icon: 'history' },
    ...(admin ? [{ key: 'details', label: 'Venue details', href: `/admin/${v}/details`, icon: 'store' } as Item] : []),
  ] : [];
  const globalNav: Item[] = [
    { key: 'home', label: venues.length > 1 ? 'All venues' : 'Home', href: '/admin', icon: 'home' },
    ...(admin ? [{ key: 'pins', label: 'PINs', href: '/admin/pins', icon: 'key' } as Item] : []),
  ];
  const isActive = (k: NavKey) => active === k || (k === 'menu' && active === 'item') || (k === 'sections' && active === 'section');
  const tabs: Item[] = v ? [...venueNav, globalNav[0]] : globalNav;

  return (
    <div className="min-h-screen lg:pl-72">
      {/* Sidebar (laptop) */}
      <aside className="glass fixed inset-y-0 left-0 z-40 hidden w-72 flex-col border-r border-line lg:flex">
        <div className="flex items-center gap-3 px-5 pt-6 pb-5">
          <span className="flex h-10 w-10 items-center justify-center rounded-[12px] bg-[linear-gradient(180deg,var(--color-accent-bright),var(--color-accent))] text-white shadow-[inset_0_1px_0_rgba(255,255,255,.3),0_6px_16px_-6px_rgba(238,106,58,.8)]"><Icon name="utensils" strokeWidth={2.2} /></span>
          <div><p className="text-lg font-semibold leading-tight">Roses</p><p className="text-xs text-ink-muted">Menu admin</p></div>
        </div>
        <div className="px-4">
          <p className="px-2 text-[11px] font-semibold uppercase tracking-wider text-ink-muted">Venue</p>
          <VenueSwitcher venues={venues} venue={venue ?? null} />
        </div>
        <nav className="mt-5 flex-1 space-y-6 overflow-y-auto px-4">
          {venue && <NavGroup label="Menu" items={venueNav} isActive={isActive} />}
          <NavGroup label="Account" items={globalNav} isActive={isActive} />
          {venue && (
            <div>
              <p className="px-2 pb-1 text-[11px] font-semibold uppercase tracking-wider text-ink-muted">Customers see</p>
              <a href={`/${v}`} target="_blank" rel="noreferrer" className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-[15px] font-medium text-ink hover:bg-neutral-100"><Icon name="external" className="h-5 w-5 text-ink-muted" />Public page</a>
            </div>
          )}
        </nav>
        <div className="border-t border-line p-4">
          <div className="flex items-center gap-3">
            <Avatar name={session.name} />
            <div className="min-w-0 flex-1"><p className="truncate font-medium leading-tight">{session.name}</p><p className="text-xs text-ink-muted">{roleLabel(session)}</p></div>
            <form method="post" action="/api/admin/logout"><button type="submit" title="Sign out" aria-label="Sign out" className="flex h-9 w-9 items-center justify-center rounded-lg text-ink-muted hover:bg-neutral-100 hover:text-ink"><Icon name="logout" className="h-5 w-5" /></button></form>
          </div>
        </div>
      </aside>

      {/* Top bar (phone) */}
      <header className="sticky top-0 z-30 flex h-14 items-center justify-between gap-3 border-b border-line glass px-4 lg:hidden">
        <a href={venue ? `/admin/${v}` : '/admin'} className="flex min-w-0 items-center gap-2.5">
          {venue ? <><LogoTile venue={venue} className="h-8 w-11" pad="p-1" /><span className="truncate font-semibold">{venue.name.en}</span></> : <><span className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent text-white"><Icon name="utensils" className="h-4 w-4" /></span><span className="font-semibold">Roses admin</span></>}
        </a>
        <details className="relative">
          <summary className="flex items-center gap-1.5 rounded-full border border-line bg-white py-0.5 pl-0.5 pr-2 shadow-[0_1px_2px_rgba(0,0,0,.04)]"><Avatar name={session.name} className="h-8 w-8 text-xs" /><Icon name="down" className="h-4 w-4 text-ink-muted" /></summary>
          <div className="absolute right-0 top-full z-40 mt-2 w-64 overflow-hidden rounded-[20px] border border-black/5 bg-white shadow-pop">
            <div className="border-b border-line px-4 py-3"><p className="truncate font-semibold">{session.name}</p><p className="text-xs text-ink-muted">{roleLabel(session)}</p></div>
            <div className="py-1">
              {venues.length > 1 && <p className="px-4 pt-2 pb-1 text-[11px] font-semibold uppercase tracking-wider text-ink-muted">Switch venue</p>}
              {venues.length > 1 && venues.map((x) => (
                <a key={x.id} href={`/admin/${x.id}`} className="flex items-center gap-2.5 px-4 py-2 text-[15px] hover:bg-neutral-50"><LogoTile venue={x} className="h-7 w-10" pad="p-1" /><span className="min-w-0 flex-1 truncate">{x.name.en}</span>{x.id === v && <Icon name="check" className="h-4 w-4 text-accent" />}</a>
              ))}
              {(venues.length > 1 || admin) && <div className="my-1 border-t border-line" />}
              {admin && <a href="/admin/pins" className="flex items-center gap-2.5 px-4 py-2 text-[15px] hover:bg-neutral-50"><Icon name="key" className="h-5 w-5 text-ink-muted" />PINs</a>}
              {venue && <a href={`/${v}`} target="_blank" rel="noreferrer" className="flex items-center gap-2.5 px-4 py-2 text-[15px] hover:bg-neutral-50"><Icon name="external" className="h-5 w-5 text-ink-muted" />Public page</a>}
            </div>
            <form method="post" action="/api/admin/logout" className="border-t border-line p-2"><button type="submit" className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-left text-[15px] font-medium hover:bg-neutral-100"><Icon name="logout" className="h-5 w-5 text-ink-muted" />Sign out</button></form>
          </div>
        </details>
      </header>

      <main className="mx-auto w-full max-w-6xl px-4 pt-5 pb-28 sm:px-6 lg:px-10 lg:pt-8 lg:pb-12">{children}</main>

      {/* Bottom tabs (phone) */}
      <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-line glass lg:hidden" style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
        <ul className="flex">
          {tabs.map((t) => (
            <li key={t.key} className="min-w-0 flex-1">
              <a href={t.href} className={`flex flex-col items-center gap-0.5 px-1 pt-2 pb-1.5 text-[11px] font-medium ${isActive(t.key) ? 'text-accent-strong' : 'text-ink-muted'}`} aria-current={isActive(t.key) ? 'page' : undefined}>
                <Icon name={t.icon} className="h-6 w-6" strokeWidth={isActive(t.key) ? 2.2 : 1.8} /><span className="truncate">{t.label}</span>
              </a>
            </li>
          ))}
        </ul>
      </nav>
    </div>
  );
}

function NavGroup({ label, items, isActive }: { label: string; items: Item[]; isActive: (k: NavKey) => boolean }) {
  return (
    <div>
      <p className="px-2 pb-1 text-[11px] font-semibold uppercase tracking-wider text-ink-muted">{label}</p>
      <ul className="space-y-0.5">
        {items.map((i) => (
          <li key={i.key}>
            <a href={i.href} aria-current={isActive(i.key) ? 'page' : undefined} className={`flex items-center gap-3 rounded-[14px] px-3 py-2.5 text-[15px] font-medium transition ${isActive(i.key) ? 'bg-[linear-gradient(180deg,var(--color-accent-bright),var(--color-accent))] text-white shadow-[inset_0_1px_0_rgba(255,255,255,.25),0_8px_20px_-10px_rgba(238,106,58,.9)]' : 'text-ink hover:bg-fill'}`}>
              <Icon name={i.icon} className={`h-5 w-5 ${isActive(i.key) ? 'text-white' : 'text-ink-muted'}`} />{i.label}
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}

function VenueSwitcher({ venues, venue }: { venues: Venue[]; venue: Venue | null }) {
  const current = venue ?? null;
  const row = (x: Venue | null) => (
    <span className="flex min-w-0 flex-1 items-center gap-3">
      {x ? <LogoTile venue={x} /> : <span className="flex h-10 w-14 shrink-0 items-center justify-center rounded-xl border border-dashed border-neutral-300 text-ink-muted"><Icon name="store" className="h-5 w-5" /></span>}
      <span className="min-w-0"><span className="block truncate text-[15px] font-semibold leading-tight">{x ? x.name.en : 'Choose a venue'}</span><span className="block text-xs text-ink-muted">{x ? `${x.locations?.length ?? 0} location${(x.locations?.length ?? 0) === 1 ? '' : 's'}` : `${venues.length} venues`}</span></span>
    </span>
  );
  if (venues.length <= 1 && current) return <div className="mt-2 flex items-center rounded-2xl bg-fill px-3 py-2.5">{row(current)}</div>;
  return (
    <details className="relative mt-2">
      <summary className="flex items-center gap-2 rounded-2xl bg-fill px-3 py-2.5 transition hover:bg-[#ececf0]">{row(current)}<Icon name="down" className="h-4 w-4 text-ink-muted" /></summary>
      <div className="absolute inset-x-0 top-full z-50 mt-2 overflow-hidden rounded-2xl border border-black/5 bg-white p-1.5 shadow-pop">
        {venues.map((x) => (
          <a key={x.id} href={`/admin/${x.id}`} className={`flex items-center gap-2 rounded-xl px-2 py-2 hover:bg-neutral-50 ${x.id === current?.id ? 'bg-accent-soft' : ''}`}>{row(x)}{x.id === current?.id && <Icon name="check" className="h-4 w-4 text-accent" />}</a>
        ))}
      </div>
    </details>
  );
}
