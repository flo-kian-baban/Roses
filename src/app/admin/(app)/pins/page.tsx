import { redirect } from 'next/navigation';
import { isAdmin } from '@/lib/admin/auth';
import { listAdmins, listPins, type PinRow } from '@/lib/admin/pins';
import { Avatar, Badge, Card, CheckCard, Empty, LogoTile, Notice, PageHeader, When, input, primary, secondary, sm, type SP } from '../../_ui';
import { Icon } from '../../_ui/icons';
import { Shell } from '../../_ui/Shell';
import { Forbidden } from '../_forbidden';
import { adminContext } from '../../_ui/context';
import type { Venue } from '@/lib/types';

export const dynamic = 'force-dynamic';

export default async function Pins({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  const { session, all, mine } = await adminContext();
  if (!session) redirect('/admin');
  if (!isAdmin(session)) return <Shell session={session} venues={mine} active="pins"><Forbidden what="PIN management (main admin only)" /></Shell>;
  const [pins, admins] = await Promise.all([listPins(), listAdmins()]);
  const active = pins.filter((p) => !p.revoked_at); const revoked = pins.filter((p) => p.revoked_at);
  return (
    <Shell session={session} venues={mine} active="pins">
      <PageHeader eyebrow="Access" title="PINs" subtitle="One PIN per person. It is shown once when created; only a hash is stored. Revoke a PIN when a person leaves." />
      <Notice sp={sp} />
      <div className="grid gap-5 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] lg:items-start">
        <Card title="New PIN" icon="plus" description="For a staff member or the owner. The PIN is generated for you.">
          <form method="post" action="/api/admin/pin" className="space-y-4">
            <input type="hidden" name="_action" value="create" /><input type="hidden" name="_back" value="/admin/pins" />
            <label className="block"><span className="text-sm font-medium">Person</span><input className={input} name="name" placeholder="Full name" required /></label>
            <fieldset><legend className="text-sm font-medium">Role</legend>
              <div className="mt-2 grid gap-2">
                <CheckCard type="radio" name="role" value="staff" defaultChecked><span className="font-medium">Staff</span><span className="block text-xs text-ink-muted">Menu, prices, photos, sections, listing</span></CheckCard>
                <CheckCard type="radio" name="role" value="owner"><span className="font-medium">Owner</span><span className="block text-xs text-ink-muted">Also allergen, dietary and halal notes</span></CheckCard>
              </div>
            </fieldset>
            <fieldset><legend className="text-sm font-medium">Venues</legend>
              <div className="mt-2 grid gap-2">{all.map((v) => <CheckCard key={v.id} name="venue_ids" value={v.id}><span className="flex items-center gap-2.5"><LogoTile venue={v} className="h-8 w-12" pad="p-1" /><span className="font-medium">{v.name.en}</span></span></CheckCard>)}</div>
            </fieldset>
            <button className={`${primary} w-full`} type="submit"><Icon name="key" className="h-5 w-5" />Create PIN</button>
          </form>
        </Card>
        <div className="space-y-5">
          <Card title="Staff and owner PINs" icon="key" description={active.length ? `${active.length} active` : 'No active PIN yet.'}>
            {active.length === 0 ? <Empty icon="key" title="No PINs yet" hint="Create one on the left; it is shown once, write it down for the person." /> : <ul className="divide-y divide-line">{active.map((p) => <Pin key={p.id} p={p} venues={all} />)}</ul>}
          </Card>
          <Card title="Admin accounts" icon="shield" description="Admins sign in with their PIN on any venue and see everything.">
            {admins.length === 0 ? <p className="text-sm text-ink-muted">No admin accounts yet.</p> : (
              <ul className="divide-y divide-line">
                {admins.map((a) => (
                  <li key={a.id} className="flex flex-wrap items-center gap-3 py-2.5 first:pt-0 last:pb-0">
                    <Avatar name={a.name} />
                    <div className="min-w-0 flex-1"><p className="truncate font-medium">{a.name}</p><p className="truncate text-xs text-ink-muted">{a.email}</p></div>
                    <div className="flex gap-1.5">{a.has_pin ? <Badge tone="green">PIN set</Badge> : <Badge>no PIN</Badge>}{a.has_password ? <Badge tone="green">password set</Badge> : <Badge>no password</Badge>}</div>
                  </li>
                ))}
              </ul>
            )}
            <p className="mt-4 text-xs text-ink-muted">Set or change an admin PIN on the laptop: <code className="rounded bg-neutral-100 px-1.5 py-0.5">npm run admin:create -- --email &lt;email&gt; --name &quot;&lt;name&gt;&quot; --pin &lt;digits&gt; --reset</code></p>
          </Card>
          {revoked.length > 0 && (
            <details className="group rounded-2xl border border-line bg-white shadow-[0_1px_2px_rgba(16,16,16,.04)]">
              <summary className="flex items-center justify-between gap-3 p-4 font-medium sm:px-5">Revoked PINs ({revoked.length})<Icon name="down" className="h-5 w-5 text-ink-muted transition group-open:rotate-180" /></summary>
              <ul className="divide-y divide-line border-t border-line px-4 py-2 sm:px-5">{revoked.map((p) => <Pin key={p.id} p={p} venues={all} />)}</ul>
            </details>
          )}
        </div>
      </div>
    </Shell>
  );
}

function Pin({ p, venues }: { p: PinRow; venues: Venue[] }) {
  const names = p.venue_ids.map((id) => venues.find((v) => v.id === id)?.name.en ?? id);
  return (
    <li className="flex flex-wrap items-center gap-3 py-3 first:pt-0 last:pb-0">
      <Avatar name={p.name} />
      <div className="min-w-0 flex-1">
        <p className="flex flex-wrap items-center gap-2 font-medium">{p.name}<Badge tone={p.role === 'owner' ? 'accent' : 'grey'}>{p.role}</Badge>{p.revoked_at ? <Badge tone="red">revoked <When at={p.revoked_at} style="date" /></Badge> : <Badge tone="green">active</Badge>}</p>
        <p className="mt-0.5 text-xs text-ink-muted">{names.join(', ')} · created <When at={p.created_at} style="date" />{p.created_by_name && ` by ${p.created_by_name}`}{p.last_used_at && <> · last used <When at={p.last_used_at} /></>}</p>
      </div>
      {!p.revoked_at && <form method="post" action="/api/admin/pin"><input type="hidden" name="_action" value="revoke" /><input type="hidden" name="id" value={p.id} /><input type="hidden" name="_back" value="/admin/pins" /><button className={`${secondary} ${sm} text-red-700`} type="submit">Revoke</button></form>}
    </li>
  );
}
