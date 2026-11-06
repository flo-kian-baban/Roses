import { redirect } from 'next/navigation';
import { canManage, isAdmin } from '@/lib/admin/auth';
import { listAdmins, listPins, within, type PinRow } from '@/lib/admin/pins';
import { Avatar, Badge, Card, CheckCard, Empty, LogoTile, Notice, PageHeader, When, checkList, input, primary, type SP } from '../../_ui';
import { dangerText } from '../../_ui/look';
import { Icon } from '../../_ui/icons';
import { TopBar } from '../../_ui/TopBar';
import { Forbidden } from '../_forbidden';
import { adminContext } from '../../_ui/context';
import type { Venue } from '@/lib/types';

export const dynamic = 'force-dynamic';

// Team: PINs and admin accounts (owner and admin). Plain forms; the PIN is shown once on the response page. In the admin's look (the
// admin-wide clean-up, 2026-11-06): each group a small grey heading over a card, its people as rows.
export default async function Team({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  const { session, all, mine } = await adminContext();
  if (!session) redirect('/admin');
  if (!canManage(session)) return <TopBar session={session} venues={mine} active="team"><main className="mx-auto max-w-2xl px-4 py-8"><Forbidden what="Team (owner and admin only)" /></main></TopBar>;
  // an owner sees, creates and revokes the PINs of their own venues only; the admin accounts are for admins (pre-go-live audit S1-01)
  const admin = isAdmin(session), venues = admin ? all : mine;
  const [allPins, admins] = await Promise.all([listPins(), admin ? listAdmins() : Promise.resolve([])]);
  const pins = allPins.filter((p) => within(session, p.venue_ids));
  const active = pins.filter((p) => !p.revoked_at); const revoked = pins.filter((p) => p.revoked_at);
  return (
    <TopBar session={session} venues={mine} active="team">
      <main className="mx-auto w-full max-w-6xl px-4 pb-16 pt-6 sm:px-6 lg:px-10 lg:pt-8">
        <PageHeader eyebrow="Access" title="Team" subtitle="One PIN per person. It is shown once when created; only a hash is stored. Revoke a PIN when a person leaves." />
        <Notice sp={sp} />
        <div className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] lg:items-start">
          <Card title="New PIN" description="For a staff member or the owner. The PIN is generated for you." bare>
            <form method="post" action="/api/admin/pin" className="space-y-5 p-4">
              <input type="hidden" name="_action" value="create" /><input type="hidden" name="_back" value="/admin/team" />
              <label className="block"><span className="text-[13px] text-ink-muted">Person</span><input className={input} name="name" placeholder="Full name" required /></label>
              <fieldset><legend className="text-[13px] text-ink-muted">Role</legend>
                <div className={`${checkList} mt-1 divide-y divide-line bg-fill`}>
                  <CheckCard type="radio" name="role" value="staff" defaultChecked><span className="font-semibold">Staff</span><span className="block text-[13px] text-ink-muted">Menu, prices, photos, sections, shown or hidden</span></CheckCard>
                  <CheckCard type="radio" name="role" value="owner"><span className="font-semibold">Owner</span><span className="block text-[13px] text-ink-muted">Also allergen, dietary and halal notes, Team, Style and Details</span></CheckCard>
                </div>
              </fieldset>
              <fieldset><legend className="text-[13px] text-ink-muted">Venues</legend>
                <div className={`${checkList} mt-1 divide-y divide-line bg-fill`}>{venues.map((v) => <CheckCard key={v.id} name="venue_ids" value={v.id}><span className="flex items-center gap-2.5"><LogoTile venue={v} className="h-8 w-12" pad="p-1" /><span className="font-semibold">{v.name.en}</span></span></CheckCard>)}</div>
              </fieldset>
              <button className={`${primary} w-full`} type="submit"><Icon name="key" className="h-5 w-5" />Create PIN</button>
            </form>
          </Card>
          <div className="space-y-6">
            <Card title="Staff and owner PINs" description={active.length ? `${active.length} active` : 'No active PIN yet.'} bare={active.length > 0}>
              {active.length === 0 ? <Empty icon="key" title="No PINs yet" hint="Create one with New PIN; it is shown once, write it down for the person." /> : <ul className="divide-y divide-line">{active.map((p) => <Pin key={p.id} p={p} venues={all} />)}</ul>}
            </Card>
            {admin && <Card title="Admin accounts" description="Admins sign in with their PIN on any venue and see everything." bare>
              {admins.length === 0 ? <p className="px-4 py-3 text-base text-ink-muted">No admin accounts yet.</p> : (
                <ul className="divide-y divide-line">
                  {admins.map((a) => (
                    <li key={a.id} className="flex flex-wrap items-center gap-3 px-4 py-2.5">
                      <Avatar name={a.name} />
                      <div className="min-w-0 flex-1"><p className="text-base font-semibold [overflow-wrap:anywhere]">{a.name}</p><p className="text-[13px] text-ink-muted [overflow-wrap:anywhere]">{a.email}</p></div>
                      <div className="flex gap-3">{a.has_pin ? <Badge>PIN set</Badge> : <Badge>No PIN</Badge>}{a.has_password ? <Badge>Password set</Badge> : <Badge>No password</Badge>}</div>
                    </li>
                  ))}
                </ul>
              )}
              <p className="border-t border-line px-4 py-3 text-[13px] text-ink-muted">Set or change an admin PIN on the laptop: <code className="font-mono [overflow-wrap:anywhere]">npm run admin:create -- --email &lt;email&gt; --name &quot;&lt;name&gt;&quot; --pin &lt;6 or more digits&gt; --reset</code></p>
            </Card>}
            {revoked.length > 0 && (
              <details className="group rounded-xl bg-canvas">
                <summary className="flex min-h-11 items-center justify-between gap-3 px-4 text-base font-semibold"><span>Revoked PINs <span className="font-normal text-ink-muted">({revoked.length})</span></span><Icon name="down" className="h-5 w-5 text-ink-muted transition group-open:rotate-180" /></summary>
                <ul className="divide-y divide-line border-t border-line">{revoked.map((p) => <Pin key={p.id} p={p} venues={all} />)}</ul>
              </details>
            )}
          </div>
        </div>
      </main>
    </TopBar>
  );
}

// One PIN: the person, their role and venues, when it was made and used; Revoke in red (it takes the person's access away).
function Pin({ p, venues }: { p: PinRow; venues: Venue[] }) {
  return (
    <li className="flex flex-wrap items-center gap-3 px-4 py-2.5">
      <Avatar name={p.name} className={`h-9 w-9 ${p.revoked_at ? 'opacity-40 grayscale' : ''}`} />
      <div className="min-w-0 flex-1">
        <p className={`text-base font-semibold [overflow-wrap:anywhere] ${p.revoked_at ? 'text-ink-muted line-through' : ''}`}>{p.name}</p>
        <p className="flex flex-wrap items-center gap-x-1.5 text-[13px] text-ink-muted">
          <span className="font-semibold text-ink">{p.role === 'owner' ? 'Owner' : 'Staff'}</span>
          <span>· {p.venue_ids.map((id) => venues.find((v) => v.id === id)?.name.en ?? id).join(', ')}</span>
          <span>· created <When at={p.created_at} style="date" />{p.created_by_name ? ` by ${p.created_by_name}` : ''}</span>
          {p.last_used_at && <span>· used <When at={p.last_used_at} /></span>}
          {p.revoked_at && <span>· revoked <When at={p.revoked_at} style="date" /></span>}
        </p>
      </div>
      {!p.revoked_at && (
        <form method="post" action="/api/admin/pin"><input type="hidden" name="_action" value="revoke" /><input type="hidden" name="id" value={p.id} /><input type="hidden" name="_back" value="/admin/team" /><button className={dangerText} type="submit">Revoke</button></form>
      )}
    </li>
  );
}
