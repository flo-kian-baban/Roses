// Session + the venues this person may edit, for every admin page.
import { getSession } from '@/lib/admin/session';
import { listVenueRows } from '@/lib/admin/venue';
import { canEditVenue } from '@/lib/admin/auth';

export async function adminContext() {
  const [session, all] = await Promise.all([getSession(), listVenueRows()]);
  return { session, all, mine: session ? all.filter((v) => canEditVenue(session, v.id)) : [] };
}
