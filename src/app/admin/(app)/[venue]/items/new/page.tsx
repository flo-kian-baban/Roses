import { notFound, redirect } from 'next/navigation';
import { canEditVenue } from '@/lib/admin/auth';
import { getVenueRow } from '@/lib/admin/venue';
import { listSections } from '@/lib/admin/sections';
import { Notice, PageHeader, type SP } from '../../../../_ui';
import { Shell } from '../../../../_ui/Shell';
import { Forbidden } from '../../../_forbidden';
import { adminContext } from '../../../../_ui/context';
import { ItemForm } from '../_form';

export const dynamic = 'force-dynamic';

export default async function NewItem({ params, searchParams }: { params: Promise<{ venue: string }>; searchParams: Promise<SP> }) {
  const { venue: venueId } = await params; const sp = await searchParams;
  const { session, mine } = await adminContext();
  if (!session) redirect(`/admin/${venueId}`);
  const venue = await getVenueRow(venueId);
  if (!venue) notFound();
  if (!canEditVenue(session, venueId)) return <Shell session={session} venues={mine} active="item"><Forbidden /></Shell>;
  const sections = await listSections(venueId);
  return (
    <Shell session={session} venues={mine} venue={venue} active="item">
      <PageHeader back={{ href: `/admin/${venueId}`, label: 'Menu' }} eyebrow="Item" title="New item" subtitle="Name and price are enough to start; tick a section so customers can find it." />
      <Notice sp={sp} />
      <ItemForm venueId={venueId} item={null} sections={sections} back={`/admin/${venueId}/items/new`} />
    </Shell>
  );
}
