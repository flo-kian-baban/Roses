import { getSession } from '@/lib/admin/session';
import { listVenueRows } from '@/lib/admin/venue';
import { canEditVenue, isAdmin } from '@/lib/admin/auth';
import { openAlerts, venueCounts } from '@/lib/admin/overview';
import { Badge, Notice, When, secondary } from '../_ui';
import { SignIn } from '../_ui/SignIn';

export default async function Home({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const session = await getSession();
  if (!session) return <SignIn venues={await listVenueRows()} sp={sp} path="/admin" />;
  const [venues, counts, alerts] = await Promise.all([listVenueRows(), venueCounts(), openAlerts()]);
  const mine = venues.filter((v) => canEditVenue(session, v.id));
  return (
    <>
      <h1 className="text-2xl font-semibold">Venues</h1>
      <div className="mt-4"><Notice sp={sp} /></div>
      {alerts.length > 0 && (
        <section className="mb-6 rounded-xl border border-red-300 bg-red-50 p-4">
          <h2 className="font-semibold text-red-900">Alerts</h2>
          <ul className="mt-2 space-y-3">
            {alerts.map((a) => (
              <li key={a.id} className="text-sm">
                <p><Badge tone="red">{a.kind}</Badge> {a.venue_id && <strong>{a.venue_id}: </strong>}{a.message}</p>
                <p className="mt-1 text-xs text-neutral-600"><When at={a.created_at} /></p>
                {isAdmin(session) && (
                  <div className="mt-2 flex gap-2">
                    {a.venue_id && <form method="post" action="/api/admin/alert"><input type="hidden" name="_action" value="unlock" /><input type="hidden" name="venue" value={a.venue_id} /><input type="hidden" name="_back" value="/admin" /><button className={`${secondary} min-h-9 text-sm`} type="submit">Unlock PIN login</button></form>}
                    <form method="post" action="/api/admin/alert"><input type="hidden" name="_action" value="seen" /><input type="hidden" name="id" value={a.id} /><input type="hidden" name="_back" value="/admin" /><button className={`${secondary} min-h-9 text-sm`} type="submit">Mark as seen</button></form>
                  </div>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}
      <ul className="grid gap-4 sm:grid-cols-2">
        {mine.map((v) => {
          const c = counts.find((x) => x.venue_id === v.id);
          return (
            <li key={v.id} className="rounded-xl border border-neutral-200 bg-white p-4">
              <a href={`/admin/${v.id}`} className="text-lg font-semibold underline">{v.name.en}</a>
              <p className="mt-2 flex flex-wrap gap-2 text-sm">
                <Badge tone="green">{c?.listed ?? 0} listed</Badge>
                <Badge>{c?.unlisted ?? 0} unlisted</Badge>
                {c && c.needs_price > 0 && <Badge tone="amber">{c.needs_price} need a price</Badge>}
                {c && c.persian_missing > 0 && <Badge tone="amber">{c.persian_missing} listed without Persian</Badge>}
              </p>
              <p className="mt-3 flex flex-wrap gap-3 text-sm">
                <a className="underline" href={`/admin/${v.id}`}>Menu</a>
                <a className="underline" href={`/admin/${v.id}/history`}>History</a>
                {isAdmin(session) && <a className="underline" href={`/admin/${v.id}/details`}>Venue details</a>}
                <a className="underline" href={`/${v.id}`} target="_blank" rel="noreferrer">Public page ↗</a>
              </p>
            </li>
          );
        })}
      </ul>
    </>
  );
}
