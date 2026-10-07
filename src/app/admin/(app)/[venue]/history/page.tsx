import { notFound, redirect } from 'next/navigation';
import { canEditVenue } from '@/lib/admin/auth';
import { getVenueRow } from '@/lib/admin/venue';
import { listRevisions } from '@/lib/admin/restore';
import { Notice, PageHeader, type SP } from '../../../_ui';
import { Shell } from '../../../_ui/Shell';
import { Forbidden } from '../../_forbidden';
import { adminContext } from '../../../_ui/context';
import { HistoryByDay } from '../_shared';

export const dynamic = 'force-dynamic';

export default async function History({ params, searchParams }: { params: Promise<{ venue: string }>; searchParams: Promise<SP> }) {
  const { venue: venueId } = await params; const sp = await searchParams;
  const { session, mine } = await adminContext();
  if (!session) redirect(`/admin/${venueId}`);
  const venue = await getVenueRow(venueId);
  if (!venue) notFound();
  if (!canEditVenue(session, venueId)) return <Shell session={session} venues={mine} active="history"><Forbidden /></Shell>;
  const history = await listRevisions(venueId, { limit: 300 });
  const back = `/admin/${venueId}/history`;
  return (
    <Shell session={session} venues={mine} venue={venue} active="history">
      <PageHeader eyebrow={venue.name.en} title="History" subtitle="Every change, newest first. Restore puts the row back to how it was before that change; a deleted item comes back with its sections." />
      <Notice sp={sp} />
      <HistoryByDay history={history} back={back} venueId={venueId} />
    </Shell>
  );
}
