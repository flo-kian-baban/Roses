import { notFound } from 'next/navigation';
import { getSession } from '@/lib/admin/session';
import { canEditVenue } from '@/lib/admin/auth';
import { getVenueRow } from '@/lib/admin/venue';
import { listRevisions } from '@/lib/admin/restore';
import { Badge, Notice, When, secondary } from '../../../_ui';
import { Forbidden } from '../../_forbidden';

export default async function History({ params, searchParams }: { params: Promise<{ venue: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { venue: venueId } = await params; const sp = await searchParams;
  const session = (await getSession())!;
  if (!canEditVenue(session, venueId)) return <Forbidden />;
  const v = await getVenueRow(venueId);
  if (!v) notFound();
  const history = await listRevisions(venueId, { limit: 300 });
  const back = `/admin/${venueId}/history`;
  const label = (r: (typeof history)[number]) => { const s = (r.after ?? r.before) as { name?: { en?: string } } | null; return s?.name?.en ?? r.row_id; };
  return (
    <>
      <p className="text-sm"><a className="underline" href={`/admin/${venueId}`}>← {venueId}</a></p>
      <h1 className="mt-2 text-2xl font-semibold">History: {v.name.en}</h1>
      <p className="mt-1 text-sm text-neutral-600">Every change, newest first. "Restore" puts the row back to how it was before that change (a deleted item comes back with its sections).</p>
      <div className="mt-4"><Notice sp={sp} /></div>
      <ul className="divide-y divide-neutral-200 text-sm">
        {history.map((r) => (
          <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
            <span>
              <When at={r.at} /> · <Badge>{r.table_name}</Badge> <strong>{r.action}</strong>{' '}
              {r.table_name === 'items' ? <a className="underline" href={`/admin/${venueId}/items/${r.row_id}`}>{label(r)}</a> : r.table_name === 'sections' ? <a className="underline" href={`/admin/${venueId}/sections/${r.row_id}`}>{label(r)}</a> : 'venue details'}
              {' '}by {r.by.name} ({r.by.kind})
            </span>
            {r.before != null && <form method="post" action="/api/admin/restore"><input type="hidden" name="revision" value={r.id} /><input type="hidden" name="_back" value={back} /><button className={`${secondary} min-h-9 px-3 py-1 text-sm`} type="submit">Restore</button></form>}
            {r.before == null && r.action === 'create' && <form method="post" action="/api/admin/restore"><input type="hidden" name="revision" value={r.id} /><input type="hidden" name="_back" value={back} /><button className={`${secondary} min-h-9 px-3 py-1 text-sm`} type="submit">Undo create</button></form>}
          </li>
        ))}
        {history.length === 0 && <li className="py-2 text-neutral-600">No changes yet.</li>}
      </ul>
    </>
  );
}
