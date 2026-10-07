// Every edit writes a revision row (before/after snapshots). Restore is an ordinary edit that writes its own row.
import type { PoolClient } from 'pg';
import type { Session } from './auth';

export type By = { kind: string; id: string; name: string };
export const byOf = (s: Session): By => ({ kind: s.kind, id: s.id, name: s.name });

export async function recordRevision(client: PoolClient, r: { venueId: string; table: 'items' | 'sections' | 'venues'; rowId: string; action: string; before: unknown; after: unknown; by: By }): Promise<number> {
  const res = await client.query<{ id: number }>(
    `insert into revisions (venue_id, table_name, row_id, action, before, after, by) values ($1,$2,$3,$4,$5,$6,$7) returning id`,
    [r.venueId, r.table, r.rowId, r.action, r.before == null ? null : JSON.stringify(r.before), r.after == null ? null : JSON.stringify(r.after), JSON.stringify(r.by)]);
  return res.rows[0].id;
}
