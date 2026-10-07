import { notFound } from 'next/navigation';
import { canEditVenue } from '@/lib/admin/auth';
import { getVenueRow } from '@/lib/admin/venue';
import { venueCounts, venueMenuForAdmin, type AdminItem, type AdminSection } from '@/lib/admin/overview';
import { listingProblem, persianMissing } from '@/lib/admin/items';
import { price } from '@/lib/format';
import { Badge, Empty, Notice, PageHeader, Photo, Stat, one, primary, secondary, sm, type SP } from '../../_ui';
import { Icon } from '../../_ui/icons';
import { Shell } from '../../_ui/Shell';
import { SignIn } from '../../_ui/SignIn';
import { Forbidden } from '../_forbidden';
import { adminContext } from '../../_ui/context';
import { SectionStatus } from './_shared';

export const dynamic = 'force-dynamic';
type Show = 'all' | 'listed' | 'unlisted' | 'needs-price' | 'persian';
const SHOWS: Show[] = ['listed', 'unlisted', 'needs-price', 'persian'];

export default async function VenueAdmin({ params, searchParams }: { params: Promise<{ venue: string }>; searchParams: Promise<SP> }) {
  const { venue: venueId } = await params; const sp = await searchParams;
  const { session, mine } = await adminContext();
  const venue = await getVenueRow(venueId);
  if (!venue) notFound();
  if (!session) return <SignIn venues={[venue]} venue={venue} sp={sp} path={`/admin/${venueId}`} />;
  if (!canEditVenue(session, venueId)) return <Shell session={session} venues={mine} active="menu"><Forbidden /></Shell>;
  const [{ sections, orphans }, counts] = await Promise.all([venueMenuForAdmin(venueId), venueCounts()]);
  const c = counts.find((x) => x.venue_id === venueId);

  const show = (SHOWS as string[]).includes(one(sp, 'show') ?? '') ? (one(sp, 'show') as Show) : 'all';
  const q = (one(sp, 'q') ?? '').trim(); const ql = q.toLowerCase();
  const sectionFilter = one(sp, 'section') ?? '';
  const base = `/admin/${venueId}`;
  const url = (patch: Partial<Record<'show' | 'q' | 'section', string>>) => {
    const next = { show, q, section: sectionFilter, ...patch }; const u = new URLSearchParams();
    for (const [k, v] of Object.entries(next)) if (v && v !== 'all') u.set(k, v);
    const s = u.toString(); return `${base}${s ? `?${s}` : ''}`;
  };
  const back = url({});
  const keep = (i: AdminItem) => {
    if (show === 'listed' && !i.listed) return false;
    if (show === 'unlisted' && i.listed) return false;
    if (show === 'needs-price' && !listingProblem(i)) return false;
    if (show === 'persian' && !(i.listed && persianMissing(i).length > 0)) return false;
    if (ql && !((i.name.en ?? '').toLowerCase().includes(ql) || (i.name.fa ?? '').includes(q))) return false;
    return true;
  };
  const narrowing = show !== 'all' || !!q;
  type Group = { s: AdminSection | null; items: AdminItem[] };
  const groups: Group[] = [...sections.map((s) => ({ s, items: s.items.filter(keep) })), ...(orphans.length ? [{ s: null, items: orphans.filter(keep) }] : [])]
    .filter((g) => !sectionFilter || (g.s ? g.s.id === sectionFilter : sectionFilter === 'none'))
    .filter((g) => !narrowing || g.items.length > 0);
  const shown = groups.reduce((n, g) => n + g.items.length, 0);
  const tab = (href: string, active: boolean, label: React.ReactNode, muted = false) => (
    <a href={href} className={`inline-flex min-h-9 shrink-0 items-center gap-1.5 rounded-full px-4 text-sm whitespace-nowrap transition ${active ? 'bg-white font-semibold text-ink shadow-[0_1px_3px_rgba(0,0,0,.12),0_0_0_0.5px_rgba(0,0,0,.04)]' : muted ? 'font-medium text-neutral-400 hover:text-ink' : 'font-medium text-ink-muted hover:text-ink'}`} aria-current={active ? 'page' : undefined}>{label}</a>
  );

  return (
    <Shell session={session} venues={mine} venue={venue} active="menu">
      <PageHeader eyebrow={venue.name.en} title="Menu" subtitle="Listed = shown to customers. A section shows only when it is listed and has a listed item; an item needs a price (or a price for every size) to be listed."
        actions={<><a className={primary} href={`${base}/items/new`}><Icon name="plus" className="h-5 w-5" />New item</a><a className={secondary} href={`${base}/sections/new`}>New section</a></>} />
      <Notice sp={sp} />

      <div className="mb-5 grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="Listed" value={c?.listed ?? 0} icon="eye" tone="green" href={url({ show: show === 'listed' ? 'all' : 'listed' })} active={show === 'listed'} />
        <Stat label="Unlisted" value={c?.unlisted ?? 0} icon="eyeOff" tone="grey" href={url({ show: show === 'unlisted' ? 'all' : 'unlisted' })} active={show === 'unlisted'} />
        <Stat label="Need a price" value={c?.needs_price ?? 0} icon="dollar" tone={c?.needs_price ? 'amber' : 'grey'} href={url({ show: show === 'needs-price' ? 'all' : 'needs-price' })} active={show === 'needs-price'} />
        <Stat label="Persian missing" value={c?.persian_missing ?? 0} icon="languages" tone={c?.persian_missing ? 'amber' : 'grey'} href={url({ show: show === 'persian' ? 'all' : 'persian' })} active={show === 'persian'} hint="listed items" />
      </div>

      <div className="sticky top-14 z-20 -mx-4 space-y-2 glass px-4 py-2 sm:-mx-6 sm:px-6 lg:top-0 lg:-mx-10 lg:px-10 lg:pt-0">
        <form method="get" action={base} className="relative">
          {show !== 'all' && <input type="hidden" name="show" value={show} />}
          {sectionFilter && <input type="hidden" name="section" value={sectionFilter} />}
          <Icon name="search" className="pointer-events-none absolute left-3.5 top-1/2 h-5 w-5 -translate-y-1/2 text-neutral-400" />
          <input type="search" name="q" defaultValue={q} placeholder="Search items" enterKeyHint="search" autoComplete="off" className="h-11 w-full rounded-full border-0 bg-fill pl-11 pr-28 text-base placeholder:text-neutral-500 transition focus:bg-white focus:outline-none focus:ring-[3px] focus:ring-accent/25" />
          <div className="absolute inset-y-1 right-1 flex gap-1">
            {q && <a href={url({ q: '' })} className="flex items-center rounded-full px-2.5 text-sm font-medium text-ink-muted hover:text-ink">Clear</a>}
            <button type="submit" className="flex items-center rounded-full bg-white px-3.5 text-sm font-semibold shadow-[0_1px_3px_rgba(0,0,0,.12)] hover:bg-fill">Search</button>
          </div>
        </form>
        <div className="no-scrollbar -mx-4 flex overflow-x-auto px-4 sm:-mx-6 sm:px-6 lg:-mx-10 lg:px-10">
          <div className="flex gap-1 rounded-full bg-fill p-1">
            {tab(url({ section: '' }), !sectionFilter, 'All')}
            {sections.map((s) => tab(url({ section: s.id }), sectionFilter === s.id, <>{s.name.en}<span className="rounded-full bg-black/5 px-1.5 text-xs tabular-nums">{s.items.length}</span></>, !s.listed))}
            {orphans.length > 0 && tab(url({ section: 'none' }), sectionFilter === 'none', <>No section<span className="rounded-full bg-black/5 px-1.5 text-xs tabular-nums">{orphans.length}</span></>, true)}
          </div>
        </div>
      </div>

      {(narrowing || sectionFilter) && (
        <p className="mt-3 flex flex-wrap items-center gap-2 text-sm text-ink-muted">
          <span>{shown} item{shown === 1 ? '' : 's'}{q && <> matching <strong className="text-ink">“{q}”</strong></>}{show !== 'all' && <> · {({ listed: 'listed', unlisted: 'unlisted', 'needs-price': 'needing a price', persian: 'listed without Persian' } as Record<Show, string>)[show]}</>}</span>
          <a href={base} className="font-medium text-ink underline-offset-4 hover:underline">Show everything</a>
        </p>
      )}

      {groups.length === 0 && <div className="mt-6"><Empty icon="search" title="Nothing matches" hint="Try another word or show everything." action={<a className={secondary} href={base}>Show everything</a>} /></div>}
      {groups.map((g) => (
        <section key={g.s?.id ?? 'none'} id={g.s ? `sec-${g.s.id}` : 'sec-none'} className="mt-7 scroll-mt-44 lg:scroll-mt-32">
          <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
            <div className="min-w-0">
              <h2 className="flex flex-wrap items-center gap-x-2 gap-y-1 text-lg font-semibold">
                {g.s ? <a href={`${base}/sections/${g.s.id}`} className="underline-offset-4 hover:underline">{g.s.name.en}</a> : 'Not in any section'}
                {g.s?.name.fa && <span lang="fa" dir="rtl" className="text-base font-normal text-ink-muted">{g.s.name.fa}</span>}
              </h2>
              <div className="mt-1 flex flex-wrap gap-1.5">
                {g.s ? <SectionStatus s={g.s} /> : <Badge tone="amber">Never shown: these items are in no section</Badge>}
                {g.s && <Badge>{g.s.items.length} item{g.s.items.length === 1 ? '' : 's'} · {g.s.items.filter((i) => i.listed).length} listed</Badge>}
                {g.s && !g.s.name.fa && <Badge tone="amber">Persian missing</Badge>}
                {g.s && g.s.fa_draft.length > 0 && <Badge tone="blue">Persian draft</Badge>}
              </div>
            </div>
            {g.s && (
              <div className="flex gap-2">
                <a href={`${base}/sections/${g.s.id}`} className={`${secondary} ${sm}`}><Icon name="pencil" className="h-4 w-4" />Edit</a>
                <form method="post" action="/api/admin/section"><input type="hidden" name="id" value={g.s.id} /><input type="hidden" name="_back" value={back} /><input type="hidden" name="_action" value={g.s.listed ? 'unlist' : 'list'} /><button className={`${secondary} ${sm}`} type="submit"><Icon name={g.s.listed ? 'eyeOff' : 'eye'} className="h-4 w-4" />{g.s.listed ? 'Unlist section' : 'List section'}</button></form>
              </div>
            )}
          </div>
          {g.items.length === 0 ? (
            <Empty icon="utensils" title="No items in this section" action={<a className={`${secondary} ${sm}`} href={`${base}/items/new`}><Icon name="plus" className="h-4 w-4" />New item</a>} />
          ) : (
            <ul className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-4">{g.items.map((i) => <ItemCard key={`${g.s?.id ?? 'none'}-${i.id}`} i={i} back={back} base={base} />)}</ul>
          )}
        </section>
      ))}
    </Shell>
  );
}

function ItemCard({ i, back, base }: { i: AdminItem; back: string; base: string }) {
  const problem = listingProblem(i); const missing = persianMissing(i); const edit = `${base}/items/${i.id}`;
  const priceText = i.price != null ? price(i.price) : i.variants.length ? i.variants.map((v) => `${v.label.en ?? ''} ${v.price != null ? price(v.price) : '—'}`.trim()).join(' · ') : null;
  return (
    <li className={`flex flex-col overflow-hidden rounded-[20px] border bg-white shadow-card ${i.listed ? 'border-line' : 'border-dashed border-neutral-300'}`}>
      <a href={edit} className="relative block aspect-[4/3] bg-neutral-100">
        <Photo url={i.photo?.url} className={`h-full w-full ${i.listed ? '' : 'opacity-60'}`} />
        <span className="absolute left-2 top-2 flex flex-wrap gap-1">
          {i.listed ? <Badge tone="green" className="shadow-sm">Listed</Badge> : <Badge className="bg-white shadow-sm">Unlisted</Badge>}
          {problem && <Badge tone="amber" className="shadow-sm">Needs price</Badge>}
        </span>
      </a>
      <div className="flex flex-1 flex-col p-3">
        <a href={edit} className="line-clamp-2 font-semibold leading-snug underline-offset-4 hover:underline">{i.name.en}</a>
        {i.name.fa && <p lang="fa" dir="rtl" className="mt-0.5 truncate text-left text-sm text-ink-muted">{i.name.fa}</p>}
        <p className="mt-auto pt-2 text-[15px] font-semibold tabular-nums">{priceText ?? <span className="font-normal text-ink-muted">No price yet</span>}</p>
        {(i.fa_draft.length > 0 || (i.listed && missing.length > 0)) && (
          <div className="mt-1.5 flex flex-wrap gap-1">
            {i.listed && missing.length > 0 && <Badge tone="amber">Persian missing: {missing.join(', ')}</Badge>}
            {i.fa_draft.length > 0 && <Badge tone="blue">Persian draft</Badge>}
          </div>
        )}
      </div>
      <div className="grid grid-cols-2 divide-x divide-line border-t border-line">
        <a href={edit} className="flex min-h-10 items-center justify-center gap-1.5 text-sm font-medium hover:bg-neutral-50"><Icon name="pencil" className="h-4 w-4 text-ink-muted" />Edit</a>
        <form method="post" action="/api/admin/item" className="flex">
          <input type="hidden" name="id" value={i.id} /><input type="hidden" name="_back" value={back} /><input type="hidden" name="_action" value={i.listed ? 'unlist' : 'list'} />
          <button type="submit" disabled={!i.listed && !!problem} title={!i.listed && problem ? problem : undefined} className="flex min-h-10 flex-1 items-center justify-center gap-1.5 text-sm font-medium hover:bg-neutral-50 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-white">
            <Icon name={i.listed ? 'eyeOff' : 'eye'} className="h-4 w-4 text-ink-muted" />{i.listed ? 'Unlist' : 'List'}
          </button>
        </form>
      </div>
    </li>
  );
}
