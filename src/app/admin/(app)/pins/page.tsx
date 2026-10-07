import { redirect } from 'next/navigation';
import { getSession } from '@/lib/admin/session';
import { isAdmin } from '@/lib/admin/auth';
import { listAdmins, listPins } from '@/lib/admin/pins';
import { listVenueRows } from '@/lib/admin/venue';
import { Badge, Notice, When, input, primary, secondary } from '../../_ui';
import { Forbidden } from '../_forbidden';

export default async function Pins({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const session = await getSession();
  if (!session) redirect('/admin');
  if (!isAdmin(session)) return <Forbidden what="PIN management (main admin only)" />;
  const [pins, venues, admins] = await Promise.all([listPins(), listVenueRows(), listAdmins()]);
  return (
    <>
      <h1 className="text-2xl font-semibold">PINs</h1>
      <p className="mt-1 text-sm text-neutral-600">One PIN per person. The PIN is shown once when created; only a hash is stored. Revoke a PIN when a person leaves.</p>
      <div className="mt-4"><Notice sp={sp} /></div>
      <form method="post" action="/api/admin/pin" className="space-y-4 rounded-xl border border-neutral-200 bg-white p-4">
        <input type="hidden" name="_action" value="create" /><input type="hidden" name="_back" value="/admin/pins" />
        <label className="block"><span className="text-sm font-medium">Person</span><input className={input} name="name" required /></label>
        <fieldset><legend className="text-sm font-medium">Role</legend>
          <div className="mt-1 flex gap-4 text-sm">
            <label className="flex min-h-11 items-center gap-2"><input type="radio" name="role" value="staff" className="h-5 w-5" defaultChecked /> Staff (menu, prices, listing)</label>
            <label className="flex min-h-11 items-center gap-2"><input type="radio" name="role" value="owner" className="h-5 w-5" /> Owner (also allergen, dietary and halal notes)</label>
          </div>
        </fieldset>
        <fieldset><legend className="text-sm font-medium">Venues</legend>
          <div className="mt-1 flex flex-wrap gap-4 text-sm">{venues.map((v) => <label key={v.id} className="flex min-h-11 items-center gap-2"><input type="checkbox" name="venue_ids" value={v.id} className="h-5 w-5" /> {v.name.en}</label>)}</div>
        </fieldset>
        <button className={primary} type="submit">Create PIN</button>
      </form>
      <section className="mt-8">
        <h2 className="font-semibold">Admin accounts</h2>
        <p className="text-sm text-neutral-600">Admins sign in with their PIN on any venue and see everything. Set or change an admin PIN on the laptop: <code>npm run admin:create -- --email &lt;email&gt; --name "&lt;name&gt;" --pin &lt;digits&gt; --reset</code>.</p>
        <ul className="mt-2 divide-y divide-neutral-200 text-sm">
          {admins.map((a) => <li key={a.id} className="py-2"><strong>{a.name}</strong> · {a.email} · {a.has_pin ? <Badge tone="green">PIN set</Badge> : <Badge>no PIN</Badge>} {a.has_password ? <Badge tone="green">password set</Badge> : <Badge>no password</Badge>}</li>)}
          {admins.length === 0 && <li className="py-2 text-neutral-600">No admin accounts yet.</li>}
        </ul>
      </section>
      <h2 className="mt-8 font-semibold">Staff and owner PINs</h2>
      <ul className="mt-2 divide-y divide-neutral-200 text-sm">
        {pins.map((p) => (
          <li key={p.id} className="flex flex-wrap items-center justify-between gap-2 py-3">
            <span>
              <strong>{p.name}</strong> · {p.role} · {p.venue_ids.join(', ')} · created <When at={p.created_at} />{p.created_by_name && ` by ${p.created_by_name}`}
              {p.last_used_at && <> · last used <When at={p.last_used_at} /></>}
              {p.revoked_at ? <> <Badge tone="red">revoked <When at={p.revoked_at} /></Badge></> : <> <Badge tone="green">active</Badge></>}
            </span>
            {!p.revoked_at && <form method="post" action="/api/admin/pin"><input type="hidden" name="_action" value="revoke" /><input type="hidden" name="id" value={p.id} /><input type="hidden" name="_back" value="/admin/pins" /><button className={`${secondary} min-h-9 px-3 py-1 text-sm`} type="submit">Revoke</button></form>}
          </li>
        ))}
        {pins.length === 0 && <li className="py-3 text-neutral-600">No PINs yet.</li>}
      </ul>
    </>
  );
}
