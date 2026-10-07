import { getSession } from '@/lib/admin/session';
import { canEditVenue } from '@/lib/admin/auth';
import { BiFields, Notice, primary } from '../../../../_ui';
import { Forbidden } from '../../../_forbidden';

export default async function NewSection({ params, searchParams }: { params: Promise<{ venue: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { venue: venueId } = await params; const sp = await searchParams;
  const session = (await getSession())!;
  if (!canEditVenue(session, venueId)) return <Forbidden />;
  return (
    <>
      <p className="text-sm"><a className="underline" href={`/admin/${venueId}`}>← {venueId}</a></p>
      <h1 className="mt-2 text-2xl font-semibold">New section</h1>
      <div className="mt-4"><Notice sp={sp} /></div>
      <form method="post" action="/api/admin/section" className="space-y-4 rounded-xl border border-neutral-200 bg-white p-4">
        <input type="hidden" name="_action" value="create" /><input type="hidden" name="venue" value={venueId} /><input type="hidden" name="_back" value={`/admin/${venueId}/sections/new`} />
        <BiFields label="Section name" name="name" value={null} />
        <BiFields label="Note under the heading" name="note" value={null} />
        <p className="text-sm text-neutral-600">The new section goes last and is listed; it shows to customers once it has a listed item.</p>
        <button className={primary} type="submit">Create section</button>
      </form>
    </>
  );
}
