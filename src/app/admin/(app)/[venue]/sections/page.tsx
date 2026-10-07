import { notFound, redirect } from 'next/navigation';
import { canEditVenue } from '@/lib/admin/auth';
import { getVenueRow } from '@/lib/admin/venue';
import { venueMenuForAdmin } from '@/lib/admin/overview';
import { Badge, Card, Empty, Notice, PageHeader, primary, secondary, sm, type SP } from '../../../_ui';
import { Icon } from '../../../_ui/icons';
import { Shell } from '../../../_ui/Shell';
import { Forbidden } from '../../_forbidden';
import { adminContext } from '../../../_ui/context';
import { SectionStatus } from '../_shared';

export const dynamic = 'force-dynamic';

export default async function Sections({ params, searchParams }: { params: Promise<{ venue: string }>; searchParams: Promise<SP> }) {
  const { venue: venueId } = await params; const sp = await searchParams;
  const { session, mine } = await adminContext();
  if (!session) redirect(`/admin/${venueId}`);
  const venue = await getVenueRow(venueId);
  if (!venue) notFound();
  if (!canEditVenue(session, venueId)) return <Shell session={session} venues={mine} active="sections"><Forbidden /></Shell>;
  const { sections, orphans } = await venueMenuForAdmin(venueId);
  const base = `/admin/${venueId}`; const back = `${base}/sections`;
  return (
    <Shell session={session} venues={mine} venue={venue} active="sections">
      <PageHeader eyebrow={venue.name.en} title="Sections" subtitle="This is the order customers see. A section shows only when it is listed and has at least one listed item; change its place with the Order number on its page."
        actions={<a className={primary} href={`${base}/sections/new`}><Icon name="plus" className="h-5 w-5" />New section</a>} />
      <Notice sp={sp} />
      {sections.length === 0 ? <Empty icon="layers" title="No sections yet" hint="Create the first section, then add items to it." action={<a className={primary} href={`${base}/sections/new`}>New section</a>} /> : (
        <ol className="space-y-2">
          {sections.map((s, n) => {
            const listed = s.items.filter((i) => i.listed).length;
            return (
              <li key={s.id} className="rounded-2xl border border-line bg-white p-3 shadow-[0_1px_2px_rgba(16,16,16,.04)] sm:p-4">
                <div className="flex items-center gap-3">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-neutral-100 text-sm font-semibold tabular-nums text-ink-muted">{n + 1}</span>
                  <a href={`${base}/sections/${s.id}`} className="min-w-0 flex-1 font-semibold leading-snug underline-offset-4 hover:underline">{s.name.en}{s.name.fa && <span lang="fa" dir="rtl" className="block text-left text-sm font-normal text-ink-muted sm:ml-2 sm:inline sm:text-base">{s.name.fa}</span>}</a>
                  <div className="flex shrink-0 gap-2">
                    <a href={`${base}/sections/${s.id}`} className={`${secondary} ${sm}`} aria-label={`Edit ${s.name.en}`}><Icon name="pencil" className="h-4 w-4" /><span className="hidden sm:inline">Edit</span></a>
                    <form method="post" action="/api/admin/section"><input type="hidden" name="id" value={s.id} /><input type="hidden" name="_back" value={back} /><input type="hidden" name="_action" value={s.listed ? 'unlist' : 'list'} /><button className={`${secondary} ${sm}`} type="submit"><Icon name={s.listed ? 'eyeOff' : 'eye'} className="h-4 w-4" />{s.listed ? 'Unlist' : 'List'}</button></form>
                  </div>
                </div>
                <div className="mt-2 flex flex-wrap gap-1.5 pl-[3.25rem]">
                  <SectionStatus s={s} />
                  <a href={`${base}?section=${s.id}`} className="inline-flex items-center whitespace-nowrap rounded-full bg-neutral-100 px-2 py-0.5 text-xs font-medium text-neutral-700 hover:bg-neutral-200">{s.items.length} item{s.items.length === 1 ? '' : 's'} · {listed} listed</a>
                  {!s.name.fa && <Badge tone="amber">Persian missing</Badge>}
                  {s.fa_draft.length > 0 && <Badge tone="blue">Persian draft</Badge>}
                </div>
              </li>
            );
          })}
        </ol>
      )}
      {orphans.length > 0 && (
        <Card tone="warn" icon="alert" title="Not in any section" description={`${orphans.length} item${orphans.length === 1 ? ' is' : 's are'} in no section, so customers never see ${orphans.length === 1 ? 'it' : 'them'}. Open an item and tick a section.`} className="mt-5"
          actions={<a className={`${secondary} ${sm}`} href={`${base}?section=none`}>See them</a>} />
      )}
    </Shell>
  );
}
