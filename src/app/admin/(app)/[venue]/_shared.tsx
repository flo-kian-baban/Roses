// Pieces shared by the venue pages: section status pills and history rows with their Restore forms.
import type { AdminSection } from '@/lib/admin/overview';
import type { Revision } from '@/lib/admin/restore';
import { price } from '@/lib/format';
import { Badge, Card, Empty, When, dayKey, secondary, sm } from '../../_ui';
import { Icon, type IconName } from '../../_ui/icons';

export function SectionStatus({ s }: { s: Pick<AdminSection, 'listed' | 'items'> }) {
  const listedItems = s.items.filter((i) => i.listed).length;
  if (!s.listed) return <Badge tone="red"><Icon name="eyeOff" className="h-3 w-3" />Unlisted section</Badge>;
  if (listedItems === 0) return <Badge tone="amber">Hidden: no listed item</Badge>;
  return <Badge tone="green"><Icon name="eye" className="h-3 w-3" />Shown</Badge>;
}

const VERB: Record<string, { label: string; icon: IconName; tone: string }> = {
  create: { label: 'Created', icon: 'plus', tone: 'bg-emerald-100 text-emerald-700' },
  update: { label: 'Edited', icon: 'pencil', tone: 'bg-sky-100 text-sky-700' },
  list: { label: 'Listed', icon: 'eye', tone: 'bg-emerald-100 text-emerald-700' },
  unlist: { label: 'Unlisted', icon: 'eyeOff', tone: 'bg-neutral-200 text-neutral-700' },
  delete: { label: 'Deleted', icon: 'trash', tone: 'bg-red-100 text-red-700' },
  restore: { label: 'Restored', icon: 'restore', tone: 'bg-amber-100 text-amber-800' },
};

type Snap = { price?: string | number | null; listed?: boolean; name?: { en?: string | null } } | null;
export function revisionLabel(r: Revision): string {
  if (r.table_name === 'venues') return 'Venue details';
  const s = (r.after ?? r.before) as Snap;
  return s?.name?.en ?? r.row_id;
}

export function RevisionRow({ r, back, venueId, showTarget }: { r: Revision; back: string; venueId: string; showTarget?: boolean }) {
  const v = VERB[r.action] ?? { label: r.action, icon: 'clock' as IconName, tone: 'bg-neutral-100 text-neutral-700' };
  const b = r.before as Snap; const a = r.after as Snap;
  const details: string[] = [];
  if (b && a && b.price !== a.price) details.push(`price ${b.price != null ? price(b.price) : '—'} → ${a.price != null ? price(a.price) : '—'}`);
  if (b && a && b.listed !== a.listed && r.action === 'update') details.push(a.listed ? 'now listed' : 'now unlisted');
  const href = r.table_name === 'items' ? `/admin/${venueId}/items/${r.row_id}` : r.table_name === 'sections' ? `/admin/${venueId}/sections/${r.row_id}` : `/admin/${venueId}/details`;
  const restoreForm = (label: string) => (
    <form method="post" action="/api/admin/restore" className="shrink-0">
      <input type="hidden" name="revision" value={r.id} /><input type="hidden" name="_back" value={back} />
      <button className={`${secondary} ${sm}`} type="submit"><Icon name="restore" className="h-4 w-4" />{label}</button>
    </form>
  );
  return (
    <li className="flex items-center gap-3 py-2.5 first:pt-0 last:pb-0">
      <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${v.tone}`}><Icon name={v.icon} className="h-4 w-4" /></span>
      <div className="min-w-0 flex-1 text-sm">
        <p className="line-clamp-2">
          <span className="font-medium">{v.label}</span>
          {showTarget && <> <Badge className="align-middle">{r.table_name === 'items' ? 'item' : r.table_name === 'sections' ? 'section' : 'venue'}</Badge> <a href={href} className="font-medium underline-offset-4 hover:underline">{revisionLabel(r)}</a></>}
          {details.length > 0 && <span className="text-ink-muted"> · {details.join(' · ')}</span>}
        </p>
        <p className="text-xs text-ink-muted"><When at={r.at} style={showTarget ? 'time' : 'full'} /> · {r.by.name}</p>
      </div>
      {r.before != null ? restoreForm('Restore') : r.action === 'create' ? restoreForm('Undo create') : null}
    </li>
  );
}

export function HistoryCard({ history, back, venueId, title = 'History', description = 'Restore puts it back to how it was before that change. The restore itself is recorded.' }: { history: Revision[]; back: string; venueId: string; title?: string; description?: string }) {
  return (
    <Card title={title} icon="history" description={description}>
      {history.length === 0 ? <p className="text-sm text-ink-muted">No changes yet.</p> : <ul className="divide-y divide-line">{history.map((r) => <RevisionRow key={r.id} r={r} back={back} venueId={venueId} />)}</ul>}
    </Card>
  );
}

// The full history, grouped by day (Today, Yesterday, then dates).
export function HistoryByDay({ history, back, venueId }: { history: Revision[]; back: string; venueId: string }) {
  if (history.length === 0) return <Empty icon="history" title="No changes yet" hint="Every edit made in the admin shows up here with a Restore button." />;
  const today = dayKey(new Date()); const yesterday = dayKey(new Date(Date.now() - 86400000));
  const groups: { day: string; rows: Revision[] }[] = [];
  for (const r of history) { const d = dayKey(r.at); const g = groups[groups.length - 1]; if (g && g.day === d) g.rows.push(r); else groups.push({ day: d, rows: [r] }); }
  return (
    <div className="space-y-6">
      {groups.map((g) => (
        <section key={g.day}>
          <h2 className="mb-2 px-1 text-sm font-semibold text-ink-muted">{g.day === today ? 'Today' : g.day === yesterday ? 'Yesterday' : g.day}</h2>
          <div className="rounded-[22px] border border-line bg-white p-4 shadow-card sm:px-5">
            <ul className="divide-y divide-line">{g.rows.map((r) => <RevisionRow key={r.id} r={r} back={back} venueId={venueId} showTarget />)}</ul>
          </div>
        </section>
      ))}
    </div>
  );
}
