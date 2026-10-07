import { notFound, redirect } from 'next/navigation';
import { canEditVenue } from '@/lib/admin/auth';
import { getVenueRow } from '@/lib/admin/venue';
import { BiFields, Card, Notice, PageHeader, primary, secondary, type SP } from '../../../../_ui';
import { Shell } from '../../../../_ui/Shell';
import { Forbidden } from '../../../_forbidden';
import { adminContext } from '../../../../_ui/context';

export const dynamic = 'force-dynamic';

export default async function NewSection({ params, searchParams }: { params: Promise<{ venue: string }>; searchParams: Promise<SP> }) {
  const { venue: venueId } = await params; const sp = await searchParams;
  const { session, mine } = await adminContext();
  if (!session) redirect(`/admin/${venueId}`);
  const venue = await getVenueRow(venueId);
  if (!venue) notFound();
  if (!canEditVenue(session, venueId)) return <Shell session={session} venues={mine} active="section"><Forbidden /></Shell>;
  const base = `/admin/${venueId}`;
  return (
    <Shell session={session} venues={mine} venue={venue} active="section">
      <PageHeader back={{ href: `${base}/sections`, label: 'Sections' }} eyebrow="Section" title="New section" subtitle="It goes last and is listed; customers see it once it has a listed item." />
      <Notice sp={sp} />
      <form method="post" action="/api/admin/section" className="max-w-3xl space-y-5">
        <input type="hidden" name="_action" value="create" /><input type="hidden" name="venue" value={venueId} /><input type="hidden" name="_back" value={`${base}/sections/new`} />
        <Card title="Name" icon="tag">
          <div className="space-y-4">
            <BiFields label="Section name" name="name" value={null} required />
            <BiFields label="Note under the heading" name="note" value={null} />
          </div>
        </Card>
        <div className="flex items-center gap-2">
          <button className={`${primary} flex-1 sm:flex-none sm:min-w-40`} type="submit">Create section</button>
          <a className={secondary} href={`${base}/sections`}>Cancel</a>
        </div>
      </form>
    </Shell>
  );
}
