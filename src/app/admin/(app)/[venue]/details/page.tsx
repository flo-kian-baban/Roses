import { notFound, redirect } from 'next/navigation';
import { isAdmin } from '@/lib/admin/auth';
import { getVenueRow } from '@/lib/admin/venue';
import { listRevisions } from '@/lib/admin/restore';
import { Badge, BiFields, Card, CheckCard, Field, LogoTile, Notice, PageHeader, Switch, primary, secondary, type SP } from '../../../_ui';
import { Shell } from '../../../_ui/Shell';
import { Forbidden } from '../../_forbidden';
import { adminContext } from '../../../_ui/context';
import { HistoryCard } from '../_shared';

export const dynamic = 'force-dynamic';

export default async function Details({ params, searchParams }: { params: Promise<{ venue: string }>; searchParams: Promise<SP> }) {
  const { venue: venueId } = await params; const sp = await searchParams;
  const { session, mine } = await adminContext();
  if (!session) redirect(`/admin/${venueId}`);
  const v = await getVenueRow(venueId);
  if (!v) notFound();
  if (!isAdmin(session)) return <Shell session={session} venues={mine} venue={v} active="details"><Forbidden what="venue details (main admin only)" /></Shell>;
  const history = await listRevisions(venueId, { table: 'venues', limit: 30 });
  const back = `/admin/${venueId}/details`;
  const locs = [...v.locations, { label: { en: '', fa: '' }, address: '', phone: '', hours: { en: '', fa: '' } }];
  return (
    <Shell session={session} venues={mine} venue={v} active="details">
      <PageHeader eyebrow={v.name.en} title="Venue details" subtitle="Name, tagline, locations, phone numbers and hours, as shown on the public page." />
      <Notice sp={sp} />
      <div className="grid gap-5 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)] lg:items-start">
        <form method="post" action="/api/admin/venue" className="space-y-5">
          <input type="hidden" name="id" value={v.id} /><input type="hidden" name="_back" value={back} />
          <Card title="Name" icon="tag">
            <div className="space-y-4">
              <BiFields label="Venue name" name="name" value={v.name} required />
              <BiFields label="Tagline" name="tagline" value={v.tagline} />
            </div>
          </Card>
          {locs.map((l, n) => {
            const existing = n < v.locations.length;
            return (
              <Card key={n} icon="mapPin" title={existing ? (l.label?.en || `Location ${n + 1}`) : 'Add a location'} description={existing ? 'Tap-to-call dials exactly the number as written here.' : 'Leave empty if there is no other location.'}
                actions={l.confirm?.length ? <Badge tone="amber">to confirm: {l.confirm.join(', ')}</Badge> : null}>
                <div className="space-y-3">
                  <div className="grid gap-3 sm:grid-cols-2">
                    <Field label="Label (English)" name={`l${n}_label_en`} value={l.label?.en ?? ''} placeholder="Dine-in" />
                    <Field label="Label (فارسی)" name={`l${n}_label_fa`} value={l.label?.fa ?? ''} dir="rtl" />
                  </div>
                  <Field label="Address" name={`l${n}_address`} value={l.address ?? ''} />
                  <Field label="Phone" name={`l${n}_phone`} value={l.phone ?? ''} inputMode="text" hint="Displayed and dialled exactly as written." />
                  <div className="grid gap-3 sm:grid-cols-2">
                    <Field label="Hours (English)" name={`l${n}_hours_en`} value={l.hours?.en ?? ''} hint="Optional." />
                    <Field label="Hours (فارسی)" name={`l${n}_hours_fa`} value={l.hours?.fa ?? ''} dir="rtl" />
                  </div>
                  {l.confirm?.length ? <CheckCard name={`l${n}_confirmed`}>Confirmed with the owner <span className="block text-xs text-ink-muted">Clears the “to confirm” marks for this location.</span></CheckCard> : null}
                </div>
              </Card>
            );
          })}
          <Card title="Persian" icon="languages">
            <Switch name="showPersianDrafts" label="Show Persian drafts to customers" hint="Off: drafted Persian falls back to English until it is reviewed." defaultChecked={v.settings?.showPersianDrafts !== false} />
          </Card>
          <div className="save-bar sticky z-20 -mx-4 flex items-center gap-2 border-t border-line glass px-4 py-3 sm:-mx-6 sm:px-6 lg:static lg:mx-0 lg:border-0 lg:bg-transparent lg:p-0">
            <button className={`${primary} flex-1 sm:flex-none`} type="submit">Save venue details</button>
            <a className={secondary} href={`/admin/${venueId}`}>Cancel</a>
          </div>
        </form>
        <div className="space-y-5">
          <Card title="Brand" icon="sparkle" description="Logo, colours and fonts are set in the build (import files); they are not edited here in the MVP.">
            <div className="flex items-center gap-4">
              <LogoTile venue={v} className="h-20 w-32" pad="p-3" />
              <div className="flex flex-wrap gap-1.5">{Object.entries(v.brand?.colors ?? {}).slice(0, 6).map(([k, c]) => <span key={k} className="inline-flex items-center gap-1.5 rounded-full border border-line px-2 py-0.5 text-xs"><span className="h-3 w-3 rounded-full border border-black/10" style={{ background: c }} />{k}</span>)}</div>
            </div>
          </Card>
          <HistoryCard history={history} back={back} venueId={venueId} />
        </div>
      </div>
    </Shell>
  );
}
