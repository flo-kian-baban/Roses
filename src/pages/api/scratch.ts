// The scratch-server probe (the PM, 2026-11-06: drills and hand-test scripts refuse to start unless their target is a scratch server).
// Only a server started with the check suite's own flag ROSES_CHECK_SUITE=1 answers: the suite's servers, and hand servers on a scratch
// copy. It names the database it uses and its uploads folder, so scripts/scratch-target.mjs can refuse the working ones before a drill
// sends anything else. Every other server (production, Kian's review server on port 3000) answers 404, as for an address that does not
// exist; the flag is never set in production (go-live checklist), like ROSES_NOW.
import type { NextApiRequest, NextApiResponse } from 'next';
import { pool } from '@/lib/db';
import { uploadDir } from '@/lib/storage';

export default async function scratch(req: NextApiRequest, res: NextApiResponse) {
  res.setHeader('Cache-Control', 'no-store');
  if (process.env.ROSES_CHECK_SUITE !== '1' || req.method !== 'GET') return res.status(404).end();
  const { rows } = await pool.query<{ db: string }>('select current_database() as db');
  res.status(200).json({ scratch: true, database: rows[0].db, uploads: uploadDir() });
}
