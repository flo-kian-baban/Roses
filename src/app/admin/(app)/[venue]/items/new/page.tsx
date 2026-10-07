import { redirect } from 'next/navigation';
import { getSession } from '@/lib/admin/session';
import { canEditVenue } from '@/lib/admin/auth';
import { listSections } from '@/lib/admin/sections';
import { Notice } from '../../../../_ui';
import { Forbidden } from '../../../_forbidden';
import { ItemForm } from '../_form';

export default async function NewItem({ params, searchParams }: { params: Promise<{ venue: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { venue: venueId } = await params; const sp = await searchParams;
  const session = await getSession();
  if (!session) redirect(`/admin/${venueId}`);
  if (!canEditVenue(session, venueId)) return <Forbidden />;
  const sections = await listSections(venueId);
  return (
    <>
      <p className="text-sm"><a className="underline" href={`/admin/${venueId}`}>← {venueId}</a></p>
      <h1 className="mt-2 text-2xl font-semibold">New item</h1>
      <div className="mt-4"><Notice sp={sp} /></div>
      <ItemForm venueId={venueId} item={null} sections={sections} back={`/admin/${venueId}/items/new`} />
    </>
  );
}
