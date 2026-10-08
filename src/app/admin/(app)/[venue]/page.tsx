import { notFound } from 'next/navigation';
import { canEditNotes, canEditVenue, canManage, isAdmin } from '@/lib/admin/auth';
import { getVenueRow } from '@/lib/admin/venue';
import { editorMenu, openAlerts } from '@/lib/admin/overview';
import { Badge, Card, Notice, When, one, primary, secondary, sm, type SP } from '../../_ui';
import { TopBar } from '../../_ui/TopBar';
import { SignIn } from '../../_ui/SignIn';
import { Forbidden } from '../_forbidden';
import { adminContext } from '../../_ui/context';
import { Editor } from './_editor/Editor';

export const dynamic = 'force-dynamic';

// One screen per venue: the page editor (Kian's admin rebuild, 2026-10-07). Data is loaded here; the editor itself is a
// client component that saves every field on change through the JSON API and reloads the preview.
export default async function VenueEditor({ params, searchParams }: { params: Promise<{ venue: string }>; searchParams: Promise<SP> }) {
  const { venue: venueId } = await params; const sp = await searchParams;
  const { session, mine, all } = await adminContext();
  const venue = await getVenueRow(venueId);
  if (!venue) notFound();
  if (!session) return <SignIn venues={[venue]} venue={venue} sp={sp} path={`/admin/${venueId}`} />;
  if (!canEditVenue(session, venueId)) return <TopBar session={session} venues={mine} active="venue"><main className="mx-auto max-w-2xl px-4 py-8"><Forbidden /></main></TopBar>;
  const t = one(sp, 'tab'); const tab = t === 'style' ? 'style' : t === 'details' ? 'details' : 'menu';
  if (tab !== 'menu' && !canManage(session)) return <TopBar session={session} venues={mine} venue={venue} active="venue"><main className="mx-auto max-w-2xl px-4 py-8"><Forbidden what={`the ${tab === 'style' ? 'Style' : 'Details'} tab (owner and admin only)`} /></main></TopBar>;
  const [menu, alerts] = await Promise.all([editorMenu(venueId), isAdmin(session) ? openAlerts() : Promise.resolve([])]);
  const back = `/admin/${venueId}`;
  return (
    <TopBar session={session} venues={mine} venue={venue} active="venue">
      {(one(sp, 'error') || one(sp, 'unlocked') || one(sp, 'seen')) && <div className="mx-auto max-w-3xl px-4 pt-4"><Notice sp={sp} /></div>}
      {alerts.length > 0 && (
        <div className="mx-auto max-w-3xl px-4 pt-4">
          <Card tone="danger" icon="bell" title="Alerts" description="PIN sign-in problems that need an admin.">
            <ul className="divide-y divide-red-100">
              {alerts.map((a) => (
                <li key={a.id} className="py-3 first:pt-0 last:pb-0">
                  <p className="flex flex-wrap items-center gap-2 text-[15px]"><Badge tone="red">{a.kind}</Badge>{a.venue_id && <strong>{all.find((v) => v.id === a.venue_id)?.name.en ?? a.venue_id}</strong>}<span>{a.message}</span></p>
                  <p className="mt-1 text-xs text-ink-muted"><When at={a.created_at} /></p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {a.venue_id && <form method="post" action="/api/admin/alert"><input type="hidden" name="_action" value="unlock" /><input type="hidden" name="venue" value={a.venue_id} /><input type="hidden" name="_back" value={back} /><button className={`${primary} ${sm}`} type="submit">Unlock PIN login</button></form>}
                    <form method="post" action="/api/admin/alert"><input type="hidden" name="_action" value="seen" /><input type="hidden" name="id" value={a.id} /><input type="hidden" name="_back" value={back} /><button className={`${secondary} ${sm}`} type="submit">Mark as seen</button></form>
                  </div>
                </li>
              ))}
            </ul>
          </Card>
        </div>
      )}
      <Editor
        venue={{ id: venue.id, name: venue.name, tagline: venue.tagline, locations: venue.locations, logo: venue.brand?.logo ?? null, settings: venue.settings, template: venue.template, style: venue.style ?? {}, brandColors: venue.brand?.colors ?? {} }}
        me={{ name: session.name, role: session.role, canNotes: canEditNotes(session), canManage: canManage(session) }}
        initial={menu} tab={tab} />
    </TopBar>
  );
}
