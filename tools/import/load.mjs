// Loads a venue file (sections + items) into Postgres. Re-runnable: rows are matched on import_key and
// updated only while they are still untouched by an admin (updated_by.kind = 'import').
import pg from 'pg';

export async function loadVenueFile(data, { databaseUrl }) {
  const client = new pg.Client({ connectionString: databaseUrl });
  await client.connect();
  const by = { kind: 'import', id: `${data.venue}@${data.generatedAt.slice(0, 10)}` };
  const counts = { sectionsInserted: 0, sectionsUpdated: 0, sectionsKept: 0, itemsInserted: 0, itemsUpdated: 0, itemsKept: 0 };
  try {
    await client.query('begin');
    const venue = await client.query('select id from venues where id = $1', [data.venue]);
    if (!venue.rowCount) throw new Error(`venue ${data.venue} missing: load venues.json first`);
    const sectionIds = new Map();
    for (const s of data.sections) {
      const r = await client.query(
        `insert into sections (venue_id, import_key, name, note, position, listed, fa_draft, source, updated_by)
         values ($1,$2,$3,$4,$5,$6,$7,$8,$9)
         on conflict (import_key) do update set name = excluded.name, note = excluded.note, position = excluded.position, fa_draft = excluded.fa_draft, source = excluded.source, updated_at = now()
           where sections.updated_by->>'kind' = 'import'
         returning id, (xmax = 0) as inserted`,
        [data.venue, s.importKey, s.name, s.note, s.position, s.listed, s.faDraft, JSON.stringify(s.source), by]);
      if (r.rowCount) { sectionIds.set(s.importKey, r.rows[0].id); r.rows[0].inserted ? counts.sectionsInserted++ : counts.sectionsUpdated++; }
      else { const k = await client.query('select id from sections where import_key = $1', [s.importKey]); sectionIds.set(s.importKey, k.rows[0].id); counts.sectionsKept++; }
    }
    for (const it of data.items) {
      const r = await client.query(
        `insert into items (venue_id, import_key, name, description, price, variants, add_ons, components, serves, photo, listed, fa_draft, source, updated_by)
         values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
         on conflict (import_key) do update set name = excluded.name, description = excluded.description, price = excluded.price, variants = excluded.variants, add_ons = excluded.add_ons,
           components = excluded.components, serves = excluded.serves, photo = excluded.photo, listed = excluded.listed, fa_draft = excluded.fa_draft, source = excluded.source, updated_at = now()
           where items.updated_by->>'kind' = 'import'
         returning id, (xmax = 0) as inserted`,
        [data.venue, it.importKey, it.name, it.description, it.price, JSON.stringify(it.variants), JSON.stringify(it.addOns), JSON.stringify(it.components), it.serves, it.photo, it.listed, it.faDraft, JSON.stringify(it.source), by]);
      let id;
      if (r.rowCount) { id = r.rows[0].id; r.rows[0].inserted ? counts.itemsInserted++ : counts.itemsUpdated++; }
      else { const k = await client.query('select id from items where import_key = $1', [it.importKey]); id = k.rows[0].id; counts.itemsKept++; continue; }
      await client.query('delete from item_sections where item_id = $1', [id]);
      for (const p of it.placements) await client.query('insert into item_sections (item_id, section_id, position) values ($1,$2,$3) on conflict do nothing', [id, sectionIds.get(p.section), p.position]);
    }
    // Combos: components carry the import_key of the dish they name; resolve it to the row id now that every item exists.
    for (const it of data.items) {
      if (!it.components?.some((c) => c.import_key)) continue;
      const comps = [];
      for (const c of it.components) { const k = c.import_key ? await client.query('select id from items where import_key = $1', [c.import_key]) : null; comps.push({ ...c, item_id: k?.rows[0]?.id ?? null }); }
      await client.query(`update items set components = $2 where import_key = $1 and updated_by->>'kind' = 'import'`, [it.importKey, JSON.stringify(comps)]);
    }
    await client.query('commit');
  } catch (e) { await client.query('rollback'); throw e; } finally { await client.end(); }
  return counts;
}

export async function loadVenues(venues, { databaseUrl }) {
  const client = new pg.Client({ connectionString: databaseUrl });
  await client.connect();
  let n = 0;
  for (const v of venues) {
    const r = await client.query(
      `insert into venues (id, name, tagline, locations, brand, settings, updated_by) values ($1,$2,$3,$4,$5,$6,$7)
       on conflict (id) do update set name = excluded.name, tagline = excluded.tagline, locations = excluded.locations, brand = excluded.brand, updated_at = now()
         where venues.updated_by->>'kind' = 'import'`,
      [v.id, v.name, v.tagline, JSON.stringify(v.locations), v.brand, v.settings || { showPersianDrafts: true }, { kind: 'import', id: 'venues' }]);
    n += r.rowCount;
  }
  await client.end();
  return n;
}
