import { isAdmin } from '@/lib/admin/auth';
import { openAlerts, venueCounts } from '@/lib/admin/overview';
import { Badge, Card, Empty, LogoTile, Notice, PageHeader, When, primary, secondary, sm, type SP } from '../_ui';
import { Icon } from '../_ui/icons';
import { Shell } from '../_ui/Shell';
import { SignIn } from '../_ui/SignIn';
import { adminContext } from '../_ui/context';

export const dynamic = 'force-dynamic';

export default async function Home({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  const { session, all, mine } = await adminContext();
  if (!session) return <SignIn venues={all} sp={sp} path="/admin" />;
  const [counts, alerts] = await Promise.all([venueCounts(), openAlerts()]);
  const first = session.name.split(/\s+/)[0] || session.name;
  return (
    <Shell session={session} venues={mine} active="home">
      <PageHeader eyebrow="Welcome back" title={`Hi ${first}`} subtitle={mine.length > 1 ? 'Pick a venue to edit its menu.' : 'Open your venue to edit its menu.'} />
      <Notice sp={sp} />
      {alerts.length > 0 && (
        <Card tone="danger" icon="bell" title="Alerts" description="PIN sign-in problems that need an admin." className="mb-6">
          <ul className="divide-y divide-red-100">
            {alerts.map((a) => (
              <li key={a.id} className="py-3 first:pt-0 last:pb-0">
                <p className="flex flex-wrap items-center gap-2 text-[15px]"><Badge tone="red">{a.kind}</Badge>{a.venue_id && <strong>{all.find((v) => v.id === a.venue_id)?.name.en ?? a.venue_id}</strong>}<span>{a.message}</span></p>
                <p className="mt-1 text-xs text-ink-muted"><When at={a.created_at} /></p>
                {isAdmin(session) && (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {a.venue_id && <form method="post" action="/api/admin/alert"><input type="hidden" name="_action" value="unlock" /><input type="hidden" name="venue" value={a.venue_id} /><input type="hidden" name="_back" value="/admin" /><button className={`${primary} ${sm}`} type="submit">Unlock PIN login</button></form>}
                    <form method="post" action="/api/admin/alert"><input type="hidden" name="_action" value="seen" /><input type="hidden" name="id" value={a.id} /><input type="hidden" name="_back" value="/admin" /><button className={`${secondary} ${sm}`} type="submit">Mark as seen</button></form>
                  </div>
                )}
              </li>
            ))}
          </ul>
        </Card>
      )}
      {mine.length === 0 ? (
        <Empty icon="shield" title="No venue on this PIN" hint="Ask the main admin to add a venue to your PIN." />
      ) : (
        <ul className="grid gap-4 md:grid-cols-2">
          {mine.map((v) => {
            const c = counts.find((x) => x.venue_id === v.id);
            const addresses = v.locations.map((l) => l.address).filter(Boolean).join(' · ');
            return (
              <li key={v.id} className="overflow-hidden rounded-[24px] border border-line bg-white shadow-card">
                <a href={`/admin/${v.id}`} className="flex items-center gap-4 p-5 hover:bg-neutral-50">
                  <LogoTile venue={v} className="h-16 w-24" pad="p-2" />
                  <div className="min-w-0 flex-1">
                    <h2 className="truncate text-lg font-semibold">{v.name.en}</h2>
                    <p className="truncate text-sm text-ink-muted">{addresses || v.tagline.en || `${c?.sections ?? 0} sections`}</p>
                  </div>
                  <Icon name="right" className="h-5 w-5 text-ink-muted" />
                </a>
                <div className="grid grid-cols-4 divide-x divide-line border-t border-line text-center">
                  <Mini n={c?.listed ?? 0} label="Listed" tone="text-emerald-700" />
                  <Mini n={c?.unlisted ?? 0} label="Unlisted" />
                  <Mini n={c?.needs_price ?? 0} label="Need a price" tone={c?.needs_price ? 'text-amber-700' : ''} />
                  <Mini n={c?.persian_missing ?? 0} label="Persian missing" tone={c?.persian_missing ? 'text-amber-700' : ''} />
                </div>
                <div className="flex flex-wrap gap-2 border-t border-line p-3">
                  <a className={`${primary} ${sm}`} href={`/admin/${v.id}`}><Icon name="utensils" className="h-4 w-4" />Edit menu</a>
                  <a className={`${secondary} ${sm}`} href={`/admin/${v.id}/history`}><Icon name="history" className="h-4 w-4" />History</a>
                  {isAdmin(session) && <a className={`${secondary} ${sm}`} href={`/admin/${v.id}/details`}><Icon name="store" className="h-4 w-4" />Details</a>}
                  <a className={`${secondary} ${sm} ml-auto`} href={`/${v.id}`} target="_blank" rel="noreferrer">Public page <Icon name="external" className="h-4 w-4" /></a>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </Shell>
  );
}

function Mini({ n, label, tone = '' }: { n: number; label: string; tone?: string }) {
  return <div className="px-1 py-3"><p className={`text-xl font-semibold tabular-nums ${tone}`}>{n}</p><p className="text-[11px] font-medium leading-tight text-ink-muted">{label}</p></div>;
}
