import { notFound, redirect } from 'next/navigation';
import { getSession } from '@/lib/admin/session';
import { canEditVenue } from '@/lib/admin/auth';
import { getSection } from '@/lib/admin/sections';
import { listRevisions } from '@/lib/admin/restore';
import { Badge, BiFields, Field, Notice, When, primary, secondary } from '../../../../_ui';
import { Forbidden } from '../../../_forbidden';

export default async function EditSection({ params, searchParams }: { params: Promise<{ venue: string; id: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { venue: venueId, id } = await params; const sp = await searchParams;
  const session = await getSession();
  if (!session) redirect(`/admin/${venueId}`);
  if (!canEditVenue(session, venueId)) return <Forbidden />;
  const s = await getSection(id);
  if (!s || s.venue_id !== venueId) notFound();
  const history = await listRevisions(venueId, { table: 'sections', rowId: id, limit: 30 });
  const back = `/admin/${venueId}/sections/${id}`;
  return (
    <>
      <p className="text-sm"><a className="underline" href={`/admin/${venueId}`}>← {venueId}</a></p>
      <h1 className="mt-2 text-2xl font-semibold">{s.name.en} {s.listed ? <Badge tone="green">Listed</Badge> : <Badge>Unlisted</Badge>}</h1>
      <div className="mt-4"><Notice sp={sp} /></div>
      <form method="post" action="/api/admin/section" className="space-y-4 rounded-xl border border-neutral-200 bg-white p-4">
        <input type="hidden" name="_action" value="save" /><input type="hidden" name="id" value={s.id} /><input type="hidden" name="_back" value={back} />
        <BiFields label="Section name" name="name" value={s.name} missing={!s.name.fa} />
        <BiFields label="Note under the heading" name="note" value={s.note} />
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Order (lower comes first)" name="position" value={s.position} inputMode="numeric" />
          <label className="block"><span className="text-sm font-medium">Shown to customers</span><span className="mt-1 flex min-h-11 items-center gap-3 rounded-lg border border-neutral-300 px-3"><input type="checkbox" name="listed" className="h-5 w-5" defaultChecked={s.listed} /><span>Listed</span></span></label>
        </div>
        <button className={primary} type="submit">Save</button>
      </form>
      <section className="mt-8">
        <h2 className="font-semibold">History</h2>
        <ul className="mt-2 divide-y divide-neutral-200 text-sm">
          {history.map((r) => (
            <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
              <span><When at={r.at} /> · <strong>{r.action}</strong> by {r.by.name}</span>
              {r.before != null && <form method="post" action="/api/admin/restore"><input type="hidden" name="revision" value={r.id} /><input type="hidden" name="_back" value={back} /><button className={`${secondary} min-h-9 px-3 py-1 text-sm`} type="submit">Restore to before this</button></form>}
            </li>
          ))}
          {history.length === 0 && <li className="py-2 text-neutral-600">No changes yet.</li>}
        </ul>
      </section>
    </>
  );
}
